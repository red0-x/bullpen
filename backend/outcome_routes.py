"""Layer 4 (job outcomes and live re-rank) and Layer 5 (health checks and the Fix-it list)."""
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from scoring import covers, rank
from server import (JobOutcome, current_host, db, get_owned, host_catalog, now_utc, scored_contractors, ser,
                    sync_issue_status)

router = APIRouter(prefix="/api")
UNDO_SECONDS = 60
STALE_DAYS = 90


class OutcomeIn(BaseModel):
    contractor_id: Optional[str] = None
    showed_up: bool
    on_time: bool = False
    rating: int = Field(ge=1, le=5)
    note: str = Field("", max_length=1000)


def day(d) -> str:
    return d.strftime("%b %-d")


async def slot_ranks(host_id: str, issue: dict, prop: dict) -> dict:
    contractors = await scored_contractors(host_id)
    ranked = rank([c for c in contractors if covers(c, {"trade": issue["trade_needed"] or ""}, prop)])
    return {c["id"]: (c["rank"], c.get("business_name") or c["name"], c["score"]) for c in ranked}


def rank_changes(before: dict, after: dict, cid: str, why: str) -> list:
    msgs = []
    who = after.get(cid, before.get(cid, (None, "Another contractor")))[1]
    for k, (r_after, name, _) in after.items():
        r_before = before.get(k, (None,))[0]
        if r_before != r_after and r_before and r_after:
            reason = why if k == cid else f"{who}: {why[0].lower() + why[1:]}"
            msgs.append(f"{name} moved from #{r_before} to #{r_after}: {reason}")
    if cid in after and before.get(cid, (None,))[0] == after[cid][0]:
        b, a = before[cid][2], after[cid][2]
        if a is not None and b is not None and a != b:
            msgs.insert(0, f"{after[cid][1]} stays #{after[cid][0]}, score {b} → {a}: {why}")
    return msgs


def describe(o: dict) -> str:
    if not o["showed_up"]:
        return f"No-show on {day(o['date'])}"
    return f"{'On time' if o['on_time'] else 'Late'} on {day(o['date'])}, {o['rating']} stars"


async def booked_contractor(issue_id: str) -> Optional[str]:
    r = await db.requests.find_one({"issue_id": issue_id, "response": "booked"}, sort=[("responded_at", -1)])
    return r["contractor_id"] if r else None


async def touch_everyone(issue_id: str, now) -> dict:
    reqs = await db.requests.find({"issue_id": issue_id}, {"contractor_id": 1}).to_list(200)
    ids = list({r["contractor_id"] for r in reqs})
    before = {c["id"]: c.get("last_contacted") for c in
              await db.contractors.find({"id": {"$in": ids}}, {"id": 1, "last_contacted": 1}).to_list(200)}
    await db.contractors.update_many({"id": {"$in": ids}}, {"$set": {"last_contacted": now}})
    return before


async def next_backup(host_id: str, issue: dict, prop: dict) -> Optional[dict]:
    asked = {r["contractor_id"] for r in await db.requests.find({"issue_id": issue["id"]}).to_list(200)}
    contractors = await scored_contractors(host_id)
    for c in rank([c for c in contractors if covers(c, {"trade": issue["trade_needed"] or ""}, prop)]):
        if c["rank"] and c["id"] not in asked:
            return {"id": c["id"], "business_name": c["business_name"], "score": c["score"], "reason": c["reason"]}
    return None


@router.post("/issues/{issue_id}/outcome")
async def log_outcome(issue_id: str, body: OutcomeIn, host: dict = Depends(current_host)):
    issue = await get_owned("issues", issue_id, host["id"])
    prop = await get_owned("properties", issue["property_id"], host["id"])
    cid = body.contractor_id or await booked_contractor(issue_id)
    if not cid:
        raise HTTPException(400, "Book someone first, then log how it went.")
    await get_owned("contractors", cid, host["id"])
    req = await db.requests.find_one({"issue_id": issue_id, "contractor_id": cid}, {"_id": 0})
    now = now_utc()
    before = await slot_ranks(host["id"], issue, prop)
    o = JobOutcome(host_id=host["id"], contractor_id=cid, issue_id=issue_id, request_id=req["id"] if req else None,
                   showed_up=body.showed_up, on_time=body.on_time and body.showed_up, rating=body.rating,
                   note=body.note, date=now).model_dump()
    o["undo"] = {"last_contacted": await touch_everyone(issue_id, now)}
    await db.job_outcomes.insert_one(o)
    await sync_issue_status(issue_id)
    after = await slot_ranks(host["id"], issue, prop)
    o.pop("_id", None)
    o.pop("undo")
    return {"outcome": ser(o), "changes": rank_changes(before, after, cid, describe(o)),
            "next_backup": None if body.showed_up else await next_backup(host["id"], issue, prop),
            "undo_seconds": UNDO_SECONDS}


@router.post("/outcomes/{outcome_id}/undo")
async def undo_outcome(outcome_id: str, host: dict = Depends(current_host)):
    o = await db.job_outcomes.find_one({"id": outcome_id, "host_id": host["id"]})
    if not o:
        raise HTTPException(404, "Not found")
    if now_utc() - o["created_at"] > timedelta(seconds=UNDO_SECONDS + 5):
        raise HTTPException(400, "Undo has expired. Edit the outcome instead.")
    await db.job_outcomes.delete_one({"id": outcome_id})
    for cid, lc in (o.get("undo") or {}).get("last_contacted", {}).items():
        await db.contractors.update_one({"id": cid}, {"$set": {"last_contacted": lc}})
    await sync_issue_status(o["issue_id"])
    return {"ok": True}


@router.put("/outcomes/{outcome_id}")
async def edit_outcome(outcome_id: str, body: OutcomeIn, host: dict = Depends(current_host)):
    old = await get_owned("job_outcomes", outcome_id, host["id"])
    issue = await get_owned("issues", old["issue_id"], host["id"])
    prop = await get_owned("properties", issue["property_id"], host["id"])
    before = await slot_ranks(host["id"], issue, prop)
    o = JobOutcome(host_id=host["id"], demo=old.get("demo", False), contractor_id=old["contractor_id"],
                   issue_id=old["issue_id"], request_id=old.get("request_id"), showed_up=body.showed_up,
                   on_time=body.on_time and body.showed_up, rating=body.rating, note=body.note, date=old["date"],
                   revision_of=old.get("revision_of") or old["id"]).model_dump()
    await db.job_outcomes.insert_one(o)
    o.pop("_id", None)
    await sync_issue_status(old["issue_id"])
    after = await slot_ranks(host["id"], issue, prop)
    return {"outcome": ser(o), "changes": rank_changes(before, after, old["contractor_id"], f"edited, {describe(o)}")}


# ---------- Fix-it list ----------
def since(d) -> str:
    return d.strftime("%B") if d.year == now_utc().year else d.strftime("%B %Y")


@router.get("/fixit")
async def fixit(host: dict = Depends(current_host)):
    now = now_utc()
    catalog = await host_catalog(host["id"])
    props = {p["id"]: p for p in catalog}
    contractors = await scored_contractors(host["id"])
    issues = await db.issues.find({"host_id": host["id"], "status": {"$in": ["open", "waiting", "scheduled"]}},
                                  {"_id": 0}).sort("created_at", 1).to_list(500)
    items = {"waiting": [], "outcomes": [], "gaps": [], "stale": [], "watch": []}

    for i in issues:
        p = props.get(i["property_id"])
        if not p:
            continue
        a = next((x for x in p["amenities"] if x["id"] == i.get("amenity_id")), None)
        what = (a["label"] if a else i["trade_needed"]) or "Issue"
        base = {"issue_id": i["id"], "property": p["name"], "subtitle": i.get("ai_diagnosis") or i.get("host_note"),
                "urgency": i.get("urgency"), "guest_arrival": ser(i).get("guest_arrival")}
        if i["status"] == "scheduled":
            items["outcomes"].append({**base, "id": f"outcome-{i['id']}", "kind": "outcome",
                                      "title": f"How did the {what.lower()} job at {p['name']} go?",
                                      "action": "Log outcome", "scheduled_for": ser(i).get("scheduled_for")})
        else:
            items["waiting"].append({**base, "id": f"issue-{i['id']}", "kind": "issue", "status": i["status"],
                                     "title": f"{what} at {p['name']}: " + ("waiting on a reply" if i["status"] == "waiting" else "needs a contractor"),
                                     "action": "Find help" if i["status"] == "open" else "Check replies"})

    for p in catalog:
        for a in p["amenities"]:
            active = [c for c in contractors if c["ranked"] and covers(c, a, p)]
            if len(active) >= 2:
                continue
            label = a["label"] if a["type"] == "custom" else a["label"].lower()
            title = (f"No {label} contractor at {p['name']}." if not active else
                     f"Only 1 {label} contractor at {p['name']}. If they're busy, you're stuck.")
            items["gaps"].append({"id": f"gap-{a['id']}", "kind": "gap", "title": title, "count": len(active),
                                  "trade": a["trade"], "city": p["city"], "amenity_id": a["id"],
                                  "action": "Add contractor"})

    for c in contractors:
        if c["status"] != "active":
            continue
        seen = max([d for d in (c.get("last_contacted"), c.get("verified_at")) if d] or [c["created_at"]])
        snoozed = c.get("snooze_until") and c["snooze_until"] > now
        if now - seen >= timedelta(days=STALE_DAYS) and not snoozed:
            items["stale"].append({"id": f"stale-{c['id']}", "kind": "stale", "contractor_id": c["id"],
                                   "title": f"{c['business_name'] or c['name']}: Haven't talked since {since(seen)}. Still in business?",
                                   "action": "Still active"})

    names = {c["id"]: c["business_name"] or c["name"] for c in contractors}
    alerts = await db.watch_signals.find({"host_id": host["id"], "alert": {"$ne": None}, "acknowledged": {"$ne": True}},
                                         {"_id": 0}).sort("date", -1).to_list(50)
    for s in alerts:
        items["watch"].append({"id": f"watch-{s['id']}", "kind": "watch", "signal_id": s["id"],
                               "contractor_id": s["contractor_id"],
                               "title": f"{names.get(s['contractor_id'], 'A contractor')}: {s['alert']}",
                               "subtitle": "Bench watch · sample data", "action": "Got it"})

    ordered = items["waiting"] + items["outcomes"] + items["gaps"] + items["stale"] + items["watch"]
    return {"items": ordered, "counts": {k: len(v) for k, v in items.items()},
            "setup": {"properties": len(catalog), "contractors": len(contractors)}}
