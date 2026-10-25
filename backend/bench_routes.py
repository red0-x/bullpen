"""Layer 2 (contacts import, contractor CRUD, ranked bench) and Layer 6 (bench watch)."""
import re
import uuid
from datetime import timedelta
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ai import AIError, extract_contractors
from scoring import covers, rank
from server import (TRADES, Contractor, WatchSignal, current_host, db, get_owned, host_catalog, now_utc,
                    public_contractor, scored_contractors, ser)

router = APIRouter(prefix="/api")
EDITABLE = ("name", "business_name", "phone", "email", "trades", "service_area", "notes", "status", "pinned",
            "snooze_until", "verified_at", "last_contacted")


class ContractorIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    business_name: str = Field("", max_length=120)
    phone: str = Field("", max_length=40)
    email: str = Field("", max_length=160)
    trades: List[str] = Field(min_length=1)
    service_area: List[str] = Field(default_factory=list)
    notes: str = Field("", max_length=1000)


class ContractorPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    business_name: Optional[str] = Field(None, max_length=120)
    phone: Optional[str] = Field(None, max_length=40)
    email: Optional[str] = Field(None, max_length=160)
    trades: Optional[List[str]] = None
    service_area: Optional[List[str]] = None
    notes: Optional[str] = Field(None, max_length=1000)
    status: Optional[Literal["active", "unreachable", "out_of_business"]] = None
    pinned: Optional[bool] = None
    snooze_until: Optional[str] = None
    verified_at: Optional[str] = None
    last_contacted: Optional[str] = None


class ExtractIn(BaseModel):
    text: str = Field(min_length=1, max_length=20000)


class ImportRow(ContractorIn):
    merge_into: Optional[str] = None


class ImportIn(BaseModel):
    rows: List[ImportRow] = Field(min_length=1, max_length=200)


def digits(phone: str) -> str:
    d = re.sub(r"\D", "", phone or "")
    return d[-10:] if len(d) >= 10 else d


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def find_duplicate(row: dict, existing: list) -> Optional[dict]:
    first = norm((row.get("name") or "").split(" ")[0]) if row.get("name") else ""
    for c in existing:
        if row.get("phone") and digits(row["phone"]) and digits(row["phone"]) == digits(c.get("phone")):
            return c
        if row.get("email") and row["email"].lower() == (c.get("email") or "").lower():
            return c
        rb, cb = norm(row.get("business_name")), norm(c.get("business_name"))
        if rb and cb and (rb == cb or (len(rb) > 5 and (rb in cb or cb in rb))):
            return c
        if not row.get("business_name") and row.get("name") and norm(row["name"]) == norm(c.get("name")):
            return c
        same_trade = set(row.get("trades") or []) & set(c.get("trades") or [])
        if first and len(first) > 2 and same_trade and (first == norm(c["name"].split(" ")[0]) or cb.startswith(first)):
            return c
    return None


def clean_trades(trades: list) -> list:
    lookup = {t.lower(): t for t in TRADES}
    return [lookup[t.lower()] for t in trades if isinstance(t, str) and t.lower() in lookup]


async def slots_for(contractor: dict, catalog: list) -> list:
    return [f"{p['name']} · {a['label']}" for p in catalog for a in p["amenities"] if covers(contractor, a, p)]


def parse_dt(v):
    from datetime import datetime
    return datetime.fromisoformat(v.replace("Z", "+00:00")) if isinstance(v, str) and v else None


# ---------- Contractors ----------
@router.get("/contractors/{contractor_id}")
async def get_contractor(contractor_id: str, host: dict = Depends(current_host)):
    await get_owned("contractors", contractor_id, host["id"])
    c = next(c for c in await scored_contractors(host["id"]) if c["id"] == contractor_id)
    outcomes = await db.job_outcomes.find({"contractor_id": contractor_id, "host_id": host["id"]},
                                          {"_id": 0, "undo": 0}).sort("date", -1).to_list(200)
    return {"contractor": public_contractor(c), "slots": await slots_for(c, await host_catalog(host["id"])),
            "outcomes": [ser(o) for o in outcomes]}


@router.post("/contractors")
async def add_contractor(body: ContractorIn, host: dict = Depends(current_host)):
    trades = clean_trades(body.trades)
    if not trades:
        raise HTTPException(400, "Pick a trade from the list.")
    c = Contractor(host_id=host["id"], **{**body.model_dump(), "trades": trades,
                                          "service_area": [a.strip() for a in body.service_area if a.strip()]})
    await db.contractors.insert_one(c.model_dump())
    return {"contractor": ser(c.model_dump()), "slots": await slots_for(c.model_dump(), await host_catalog(host["id"]))}


@router.patch("/contractors/{contractor_id}")
async def patch_contractor(contractor_id: str, body: ContractorPatch, host: dict = Depends(current_host)):
    before = await get_owned("contractors", contractor_id, host["id"])
    patch = body.model_dump(exclude_unset=True)
    if "trades" in patch:
        patch["trades"] = clean_trades(patch["trades"] or [])
        if not patch["trades"]:
            raise HTTPException(400, "Pick a trade from the list.")
    for k in ("snooze_until", "verified_at", "last_contacted"):
        if k in patch:
            patch[k] = parse_dt(patch[k])
    if patch:
        await db.contractors.update_one({"id": contractor_id}, {"$set": patch})
    undo = {k: before.get(k) for k in patch}
    after = await get_owned("contractors", contractor_id, host["id"])
    return {"contractor": ser(after), "before": ser(undo)}


@router.delete("/contractors/{contractor_id}")
async def delete_contractor(contractor_id: str, host: dict = Depends(current_host)):
    await get_owned("contractors", contractor_id, host["id"])
    if await db.requests.find_one({"contractor_id": contractor_id}) or \
            await db.job_outcomes.find_one({"contractor_id": contractor_id}):
        raise HTTPException(400, "They have job history. Mark them out of business instead.")
    await db.contractors.delete_one({"id": contractor_id, "host_id": host["id"]})
    await db.watch_signals.delete_many({"contractor_id": contractor_id, "host_id": host["id"]})
    return {"ok": True}


# ---------- Import ----------
@router.post("/contractors/extract")
async def extract(body: ExtractIn, host: dict = Depends(current_host)):
    catalog = await host_catalog(host["id"])
    try:
        rows = await extract_contractors(body.text, TRADES, sorted({p["city"] for p in catalog}))
    except AIError:
        return {"ok": False, "message": "Couldn't read that right now."}
    existing = await db.contractors.find({"host_id": host["id"]}, {"_id": 0}).to_list(2000)
    out = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        row = {k: str(r.get(k) or "").strip() for k in ("name", "business_name", "phone", "email", "notes")}
        if not (row["name"] or row["business_name"]) or not (row["phone"] or row["email"] or row["notes"]):
            continue
        row["name"] = row["name"] or row["business_name"]
        row["trades"] = clean_trades(r.get("trades") or [])
        row["service_area"] = [str(a).strip() for a in (r.get("service_area") or []) if str(a).strip()]
        unsure = {str(u) for u in (r.get("unsure") or [])}
        if not row["trades"]:
            unsure.add("trade")
        row["unsure"] = sorted(unsure)
        dup = find_duplicate(row, existing + [x for x in out])
        row["duplicate_of"] = {"id": dup["id"], "business_name": dup.get("business_name") or dup["name"]} if dup else None
        row["slots"] = await slots_for(row, catalog)
        row["key"] = str(uuid.uuid4())
        out.append(row)
    if not out:
        return {"ok": True, "rows": [], "message": "We couldn't find any contractors in that. Try pasting names and phone numbers."}
    return {"ok": True, "rows": out}


@router.post("/contractors/import")
async def import_rows(body: ImportIn, host: dict = Depends(current_host)):
    catalog = await host_catalog(host["id"])
    created, merged, slots = [], [], {}
    for row in body.rows:
        trades = clean_trades(row.trades)
        if not trades:
            raise HTTPException(400, f"Pick a trade for {row.business_name or row.name}.")
        data = {**row.model_dump(exclude={"merge_into"}), "trades": trades}
        if row.merge_into:
            c = await get_owned("contractors", row.merge_into, host["id"])
            patch = {k: data[k] for k in ("name", "business_name", "phone", "email") if data[k] and not c.get(k)}
            patch["trades"] = sorted(set(c["trades"]) | set(trades))
            patch["service_area"] = sorted(set(c["service_area"]) | set(data["service_area"]))
            if data["notes"] and data["notes"] not in (c.get("notes") or ""):
                patch["notes"] = ((c.get("notes") or "") + " · " + data["notes"]).strip(" ·")
            await db.contractors.update_one({"id": c["id"]}, {"$set": patch})
            merged.append({"id": c["id"], "before": {k: c.get(k) for k in patch}})
            slots[c["business_name"] or c["name"]] = await slots_for({**c, **patch}, catalog)
        else:
            c = Contractor(host_id=host["id"], **data).model_dump()
            await db.contractors.insert_one(c)
            created.append(c["id"])
            slots[c["business_name"] or c["name"]] = await slots_for(c, catalog)
    batch = {"id": str(uuid.uuid4()), "host_id": host["id"], "created": created, "merged": merged, "at": now_utc()}
    await db.import_batches.insert_one(batch)
    return {"batch_id": batch["id"], "created": len(created), "merged": len(merged), "slots": slots}


@router.post("/contractors/import/{batch_id}/undo")
async def undo_import(batch_id: str, host: dict = Depends(current_host)):
    batch = await db.import_batches.find_one({"id": batch_id, "host_id": host["id"]})
    if not batch:
        raise HTTPException(404, "Nothing to undo.")
    await db.contractors.delete_many({"id": {"$in": batch["created"]}, "host_id": host["id"],
                                      "last_contacted": None})
    for m in batch["merged"]:
        await db.contractors.update_one({"id": m["id"], "host_id": host["id"]}, {"$set": m["before"]})
    await db.import_batches.delete_one({"id": batch_id})
    return {"ok": True}


# ---------- Bench ----------
@router.get("/bench")
async def bench(host: dict = Depends(current_host)):
    catalog = await host_catalog(host["id"])
    contractors = await scored_contractors(host["id"])
    slotted, out = set(), []
    for p in catalog:
        amenities = []
        for a in p["amenities"]:
            ranked = rank([dict(c) for c in contractors if covers(c, a, p)])
            slotted.update(c["id"] for c in ranked)
            amenities.append({**ser(a), "bench": [public_contractor(c) for c in ranked],
                              "active_count": len([c for c in ranked if c["rank"]])})
        out.append({**ser({k: v for k, v in p.items() if k != "amenities"}), "amenities": amenities})
    unmatched = [public_contractor(c) for c in rank(contractors) if c["id"] not in slotted]
    return {"properties": out, "unmatched": unmatched, "trades": TRADES,
            "cities": sorted({p["city"] for p in catalog})}


# ---------- Bench watch (sample signals) ----------
SIGNAL_TYPES = ["response_time", "public_rating", "business_open", "phone_working", "license_status"]
SCRIPT = {
    1: [("Yucca Spa Care", "phone_working", "no", "Phone number disconnected"),
        ("Cool Desert HVAC", "response_time", "300", None)],
    2: [("Tahoe Pipe & Drain", "business_open", "no", "Listed as permanently closed"),
        ("Oak Town Appliance", "public_rating", "3.6", "rating")],
    3: [("Lakeside Appliance", "license_status", "expired", "License expired")],
}
FLAGS = {("phone_working", "no"), ("business_open", "no")}


def baseline(c: dict, now) -> list:
    seed = sum(map(ord, c["id"]))
    return [("response_time", str(30 + seed % 150)), ("public_rating", f"{4.2 + (seed % 7) / 10:.1f}"),
            ("business_open", "yes"), ("phone_working", "yes"), ("license_status", "active")]


async def latest_signals(host_id: str) -> dict:
    sigs = await db.watch_signals.find({"host_id": host_id}, {"_id": 0}).sort("date", 1).to_list(50000)
    latest = {}
    for s in sigs:
        latest.setdefault(s["contractor_id"], {})[s["signal_type"]] = s
    return latest


@router.get("/watch")
async def watch(host: dict = Depends(current_host)):
    contractors = await scored_contractors(host["id"])
    latest = await latest_signals(host["id"])
    alerts = await db.watch_signals.find({"host_id": host["id"], "alert": {"$ne": None}}, {"_id": 0}) \
        .sort("date", -1).to_list(100)
    names = {c["id"]: c.get("business_name") or c["name"] for c in contractors}
    run = await db.watch_runs.find_one({"host_id": host["id"]}) or {}
    return {
        "sample_data": True,
        "last_run": run.get("at").isoformat() if run.get("at") else None,
        "contractors": [{**public_contractor(c), "signals": {t: ser(s) for t, s in latest.get(c["id"], {}).items()}}
                        for c in rank(contractors)],
        "alerts": [ser({**a, "business_name": names.get(a["contractor_id"])}) for a in alerts],
    }


@router.post("/watch/check")
async def watch_check(host: dict = Depends(current_host)):
    now = now_utc()
    contractors = await db.contractors.find({"host_id": host["id"]}, {"_id": 0}).to_list(2000)
    latest = await latest_signals(host["id"])
    run = await db.watch_runs.find_one_and_update({"host_id": host["id"]}, {"$inc": {"runs": 1}, "$set": {"at": now}},
                                                  upsert=True, return_document=True)
    n = run["runs"]
    changes, new_docs = [], []
    by_name = {c["business_name"]: c for c in contractors}
    for c in contractors:
        if c["id"] not in latest:
            for t, v in baseline(c, now):
                new_docs.append(WatchSignal(host_id=host["id"], demo=c.get("demo", False), contractor_id=c["id"],
                                            signal_type=t, value=v, date=now).model_dump())
            changes.append(f"Started watching {c['business_name'] or c['name']}")
    for name, t, v, alert in SCRIPT.get(n, []):
        c = by_name.get(name)
        if not c or c["status"] != "active":
            continue
        prev = latest.get(c["id"], {}).get(t)
        if prev and prev["value"] == v:
            continue
        if alert == "rating":
            alert = f"Rating dropped from {prev['value'] if prev else '4.5'} to {v} this month"
        new_docs.append(WatchSignal(host_id=host["id"], demo=c.get("demo", False), contractor_id=c["id"],
                                    signal_type=t, value=v, date=now, alert=alert).model_dump())
        if (t, v) in FLAGS:
            await db.contractors.update_one({"id": c["id"]}, {"$set": {"status": "unreachable"}})
            changes.append(f"{name}: {alert}. Marked unreachable.")
        elif alert:
            changes.append(f"{name}: {alert}")
        else:
            changes.append(f"{name}: replies slower lately (about {round(int(v) / 60)} h)")
    if new_docs:
        await db.watch_signals.insert_many(new_docs)
    return {"run": n, "changes": changes or ["No changes. Everyone on the bench looks the same as last check."],
            "changed": bool(changes)}


@router.post("/watch/alerts/{signal_id}/ack")
async def ack_alert(signal_id: str, acknowledged: bool = True, host: dict = Depends(current_host)):
    await get_owned("watch_signals", signal_id, host["id"])
    await db.watch_signals.update_one({"id": signal_id}, {"$set": {"acknowledged": acknowledged}})
    return {"ok": True}
