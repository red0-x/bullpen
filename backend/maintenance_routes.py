"""Rental cover photos, appliance service reminders (Fix-it card + email) and appliance history."""
import asyncio
import calendar
import logging
import re
import uuid
from datetime import date, timedelta
from html import escape
from typing import Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field

from emailer import EMAIL_FROM_NAME, EmailError, deliverable, send_email
from scoring import latest_revisions
from server import OPEN_STATES, Issue, current_host, db, get_item, get_owned, item_room, now_utc, ser

router = APIRouter(prefix="/api")
log = logging.getLogger("bullpen.maintenance")

DUE_SOON_DAYS = 30  # the Fix-it card shows up this many days before the due date
EMAIL_DAYS = 7  # the reminder email goes out this many days before (once per due date)
EVERY = {3: "Every 3 months", 6: "Every 6 months", 12: "Every year"}  # same labels as the app
KIND = {3: "quarterly", 6: "twice-yearly", 12: "yearly"}  # "yearly service"


def today() -> date:
    return now_utc().date()


def add_months(d: date, n: int) -> date:
    m = d.month - 1 + n
    y, m = d.year + m // 12, m % 12 + 1
    return date(y, m, min(d.day, calendar.monthrange(y, m)[1]))


def fmt_day(d: date) -> str:
    return d.strftime("%a, %b %-d")


def short_label(item: dict) -> str:
    """'Rheem water heater' (brand + name), or just the name."""
    return f"{item['brand']} {item['name'].lower()}" if item.get("brand") else item["name"]


def due_text(days: int) -> str:
    if days < 0:
        return f"overdue by {-days} day{'s' if days != -1 else ''}"
    if days == 0:
        return "due today"
    return f"due in {days} day{'s' if days != 1 else ''}"


# ---------- Cover photos ----------
class CoverIn(BaseModel):
    photo: Optional[str] = Field(None, max_length=400)  # storage path or /api/files/... url; null removes it


@router.put("/properties/{property_id}/cover")
async def set_cover(property_id: str, body: CoverIn, host: dict = Depends(current_host)):
    await get_owned("properties", property_id, host["id"])
    url = None
    if body.photo:
        path = body.photo.split("/api/files/", 1)[-1].split("?")[0]
        if not await db.files.find_one({"path": path, "host_id": host["id"], "is_deleted": False}):
            raise HTTPException(404, "Photo not found")
        url = f"/api/files/{path}"
    await db.properties.update_one({"id": property_id}, {"$set": {"cover_photo": url}})
    return {"ok": True, "cover_photo": url}


# ---------- Service schedule ----------
class ServiceIn(BaseModel):
    interval_months: Literal[3, 6, 12] = 12
    next_due: date
    email: bool = True


class DoneIn(BaseModel):
    done_on: Optional[date] = None
    cost: Optional[float] = Field(None, ge=0, le=1_000_000)
    contractor_id: Optional[str] = None
    note: str = Field("", max_length=500)


@router.put("/items/{item_id}/service")
async def set_service(item_id: str, body: ServiceIn, tasks: BackgroundTasks, host: dict = Depends(current_host)):
    item = await get_owned("items", item_id, host["id"])
    t = today()
    if not (t - timedelta(days=730) <= body.next_due <= add_months(t, 60)):
        raise HTTPException(400, "Pick a due date within the next five years.")
    old = item.get("service") or {}
    svc = {"interval_months": body.interval_months, "next_due": body.next_due.isoformat(), "email": body.email,
           "last_done": old.get("last_done"), "emailed_for": old.get("emailed_for")}
    await db.items.update_one({"id": item_id}, {"$set": {"service": svc}})
    tasks.add_task(safe_reminders, host["id"])  # due within a week -> the email goes out now, not at the next hourly run
    return {"service": public_service(svc)}


@router.delete("/items/{item_id}/service")
async def stop_service(item_id: str, host: dict = Depends(current_host)):
    await get_owned("items", item_id, host["id"])
    await db.items.update_one({"id": item_id}, {"$unset": {"service": ""}})
    return {"ok": True}


def public_service(svc: Optional[dict]) -> Optional[dict]:
    if not svc:
        return None
    days = (date.fromisoformat(svc["next_due"]) - today()).days
    return {**{k: v for k, v in svc.items() if k != "emailed_for"}, "days_left": days, "label": EVERY[svc["interval_months"]],
            "state": "overdue" if days < 0 else "soon" if days <= DUE_SOON_DAYS else "ok"}


async def record_service(host_id: str, item: dict, done_on: date, cost: Optional[float], contractor_id: Optional[str],
                         note: str, issue_id: Optional[str] = None, outcome_id: Optional[str] = None) -> dict:
    """Log a finished service and move the next due date one interval past it (no schedule -> just the log)."""
    svc = item.get("service")
    doc = {"id": str(uuid.uuid4()), "host_id": host_id, "item_id": item["id"], "property_id": item["property_id"],
           "done_on": done_on.isoformat(), "cost": cost, "contractor_id": contractor_id, "note": note.strip(),
           "issue_id": issue_id, "outcome_id": outcome_id, "prev_service": svc, "created_at": now_utc()}
    await db.service_logs.insert_one(doc)
    if svc:
        new = {**svc, "last_done": done_on.isoformat(), "next_due": add_months(done_on, svc["interval_months"]).isoformat()}
        await db.items.update_one({"id": item["id"]}, {"$set": {"service": new}})
    doc.pop("_id", None)
    return doc


@router.post("/items/{item_id}/service/done")
async def service_done(item_id: str, body: DoneIn, host: dict = Depends(current_host)):
    item = await get_owned("items", item_id, host["id"])
    if not item.get("service"):
        raise HTTPException(400, "Set a service schedule first.")
    done_on = body.done_on or today()
    if done_on > today() + timedelta(days=1) or done_on < today() - timedelta(days=730):
        raise HTTPException(400, "Pick the day it was done.")
    if body.contractor_id:
        await get_owned("contractors", body.contractor_id, host["id"])
    doc = await record_service(host["id"], item, done_on, body.cost, body.contractor_id, body.note)
    fresh = await get_owned("items", item_id, host["id"])
    return {"log": ser({k: v for k, v in doc.items() if k != "prev_service"}), "service": public_service(fresh.get("service"))}


@router.delete("/service-logs/{log_id}")
async def undo_service(log_id: str, host: dict = Depends(current_host)):
    """Undo a logged service: only the newest one for that appliance, so the due date rolls back cleanly."""
    doc = await get_owned("service_logs", log_id, host["id"])
    newest = await db.service_logs.find_one({"host_id": host["id"], "item_id": doc["item_id"]}, sort=[("created_at", -1)])
    if newest["id"] != log_id:
        raise HTTPException(400, "Only the most recent service can be removed.")
    if doc.get("issue_id"):
        raise HTTPException(400, "This one came from a booked job. Edit that job's outcome instead.")
    await db.service_logs.delete_one({"id": log_id})
    if doc.get("prev_service"):
        await db.items.update_one({"id": doc["item_id"], "service": {"$exists": True}}, {"$set": {"service": doc["prev_service"]}})
    return {"ok": True}


async def sync_service_job(host_id: str, issue_id: str):
    """A booked service job keeps its service log in step with the job's latest outcome:
    showed up -> logged (cost, who) and the due date moves on; undone / no-show -> reverted."""
    issue = await db.issues.find_one({"id": issue_id, "host_id": host_id}, {"_id": 0})
    if not issue or issue.get("kind") != "service" or not issue.get("item_id"):
        return
    outs = latest_revisions(await db.job_outcomes.find({"issue_id": issue_id, "host_id": host_id}, {"_id": 0, "undo": 0}).to_list(200))
    done = max((o for o in outs if o["showed_up"]), key=lambda o: o["created_at"], default=None)
    existing = await db.service_logs.find_one({"host_id": host_id, "issue_id": issue_id}, {"_id": 0})
    item = await db.items.find_one({"id": issue["item_id"], "host_id": host_id}, {"_id": 0})
    if not item:
        return
    if done and existing:
        await db.service_logs.update_one({"id": existing["id"]}, {"$set": {
            "cost": done.get("cost"), "contractor_id": done["contractor_id"], "note": done.get("note", ""), "outcome_id": done["id"]}})
    elif done:  # logged even if reminders were stopped meanwhile, so the job stays in the history
        await record_service(host_id, item, done["date"].date(), done.get("cost"), done["contractor_id"], done.get("note", ""),
                             issue_id, done["id"])
    elif existing:
        await db.service_logs.delete_one({"id": existing["id"]})
        if item.get("service") and existing.get("prev_service"):
            await db.items.update_one({"id": item["id"]}, {"$set": {"service": existing["prev_service"]}})


# Which trade services an appliance (first match wins).
TRADE_WORDS = [(r"hot tub|\bspa\b|jacuzzi", "Hot tub & spa"), (r"\bpool", "Pool service"),
               (r"furnace|\bac\b|a/c|air condition|hvac|heat pump|thermostat|vent|mini.?split", "HVAC"),
               (r"water heater|toilet|sink|shower|bath|faucet|sump|sprinkler|pipe|water softener", "Plumbing"),
               (r"panel|outlet|light|smoke|alarm|\bfan\b|electric|generator", "Electrical")]


def service_trade(item: dict) -> str:
    name = item["name"].lower()
    return next((t for pat, t in TRADE_WORDS if re.search(pat, name)), "Appliance repair")


@router.post("/items/{item_id}/service/book")
async def book_service(item_id: str, host: dict = Depends(current_host)):
    """Turn a due service into a job on the bench (or reopen the one already in progress)."""
    item = await get_item(host["id"], item_id)
    if not item:
        raise HTTPException(404, "Not found")
    svc = item.get("service")
    if not svc:
        raise HTTPException(400, "Set a service schedule first.")
    existing = await db.issues.find_one({"host_id": host["id"], "item_id": item_id, "kind": "service", "status": {"$in": OPEN_STATES}})
    if existing:
        return {"id": existing["id"], "existing": True}
    due = date.fromisoformat(svc["next_due"])
    what = " ".join(x for x in (item.get("brand"), item.get("model"), item["name"].lower()) if x)
    where = f" in the {item['room'].lower()}" if item.get("room") else ""
    issue = Issue(host_id=host["id"], property_id=item["property_id"], item_id=item_id, kind="service",
                  trade_needed=service_trade(item), urgency="this_week" if (due - today()).days <= 7 else "can_wait",
                  host_note=f"{KIND[svc['interval_months']].capitalize()} service for the {what}.",
                  ai_diagnosis=f"Routine {KIND[svc['interval_months']]} service for the {what}{where}, due {due.strftime('%b %-d')}.")
    await db.issues.insert_one(issue.model_dump())
    return {"id": issue.id, "existing": False}


# ---------- Appliance history ----------
@router.get("/items/{item_id}/history")
async def item_history(item_id: str, host: dict = Depends(current_host)):
    hid = host["id"]
    item = await get_item(hid, item_id)
    if not item:
        raise HTTPException(404, "Not found")
    prop = await db.properties.find_one({"id": item["property_id"], "host_id": hid}, {"_id": 0, "name": 1})
    issues = await db.issues.find({"host_id": hid, "item_id": item_id}, {"_id": 0, "photo_url": 0, "fix_steps": 0}).sort("created_at", -1).to_list(200)
    ids = [i["id"] for i in issues]
    outs = latest_revisions(await db.job_outcomes.find({"host_id": hid, "issue_id": {"$in": ids}}, {"_id": 0, "undo": 0}).to_list(2000))
    booked = await db.requests.find({"host_id": hid, "issue_id": {"$in": ids}, "response": "booked"}, {"_id": 0}).to_list(2000)
    logs = await db.service_logs.find({"host_id": hid, "item_id": item_id}, {"_id": 0, "prev_service": 0}).sort([("done_on", -1), ("created_at", -1)]).to_list(500)
    cids = {o["contractor_id"] for o in outs} | {r["contractor_id"] for r in booked} | {x["contractor_id"] for x in logs if x.get("contractor_id")}
    names = {c["id"]: c.get("business_name") or c["name"] for c in
             await db.contractors.find({"host_id": hid, "id": {"$in": list(cids)}}, {"_id": 0, "id": 1, "name": 1, "business_name": 1}).to_list(500)}

    repairs = []
    for i in issues:
        if i.get("kind") == "service" and i["status"] == "resolved":
            continue  # a finished service job shows up as a service below
        mine = sorted((o for o in outs if o["issue_id"] == i["id"]), key=lambda o: o["created_at"])
        fixed = next((o for o in reversed(mine) if o["showed_up"]), None)
        last_booked = max((r for r in booked if r["issue_id"] == i["id"]), key=lambda r: r["responded_at"], default=None)
        cid = (fixed or (mine[-1] if mine else None) or last_booked or {}).get("contractor_id")
        repairs.append(ser({"issue_id": i["id"], "kind": i.get("kind", "repair"), "date": i["created_at"], "status": i["status"],
                            "what": i.get("ai_diagnosis") or i.get("host_note") or i.get("trade_needed"), "trade": i.get("trade_needed"),
                            "contractor": names.get(cid), "contractor_id": cid, "cost": fixed.get("cost") if fixed else None,
                            "rating": fixed["rating"] if fixed else None, "fixed_on": fixed["date"] if fixed else None,
                            "no_shows": sum(1 for o in mine if not o["showed_up"])}))
    services = [ser({**x, "contractor": names.get(x.get("contractor_id"))}) for x in logs]
    costs = [x["cost"] for x in repairs + services if x.get("cost") is not None]
    return {"item": ser({**{k: v for k, v in item.items() if k != "service"}, "property_name": prop["name"] if prop else ""}),
            "service": public_service(item.get("service")), "repairs": repairs, "services": services,
            "total_cost": round(sum(costs), 2), "jobs": len(repairs) + len(services),
            "open_service_issue": next((i["id"] for i in issues if i.get("kind") == "service" and i["status"] in OPEN_STATES), None)}


# ---------- Reminder emails ----------
def reminder_html(name: str, rows: list) -> str:
    first = escape((name or "there").split(" ")[0])
    lis = "".join(
        f'<tr><td style="padding:12px 0;border-top:1px solid #E8D9C6">'
        f'<div style="font-size:16px;font-weight:bold;color:#3A1F14">{escape(r["what"])}</div>'
        f'<div style="font-size:14px;color:#7A5A48">{escape(r["where"])}</div>'
        f'<div style="font-size:14px;font-weight:bold;color:{"#8A3418" if r["days"] < 0 else "#7B3F25"}">'
        f'{escape(r["when"])}</div></td></tr>' for r in rows)
    brand = escape(EMAIL_FROM_NAME)
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF4EA">'
        '<tr><td align="center" style="padding:24px 12px">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;'
        'border:1.5px solid #E8D9C6;border-radius:20px">'
        '<tr><td style="padding:24px;font-family:Arial,Helvetica,sans-serif">'
        f'<div style="font-size:13px;font-weight:bold;letter-spacing:1px;color:#7B3F25;text-transform:uppercase">{brand} service reminder</div>'
        f'<h1 style="margin:8px 0 4px;font-size:24px;color:#3A1F14">Hi {first}, {"a service is" if len(rows) == 1 else f"{len(rows)} services are"} coming up</h1>'
        '<p style="margin:0 0 12px;font-size:15px;color:#7A5A48">A quick check now keeps it from breaking mid-stay.</p>'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0">{lis}</table>'
        f'<p style="margin:16px 0 0;font-size:15px;color:#3A1F14">Open {brand} to mark it done or book a pro from your bench.</p>'
        f'<p style="margin:20px 0 0;font-size:12px;color:#7A5A48">Sent by {brand} because you set a service reminder. '
        "Turn it off on the appliance's page in the app. We never ask for your password or card details by email.</p>"
        "</td></tr></table></td></tr></table>")


async def send_due_reminders(host_id: Optional[str] = None) -> int:
    """One email per host listing services due within EMAIL_DAYS (each due date is emailed once)."""
    t = today()
    q = {"service.email": True, "service.next_due": {"$lte": (t + timedelta(days=EMAIL_DAYS)).isoformat()}, **({"host_id": host_id} if host_id else {})}
    due = [i for i in await db.items.find(q, {"_id": 0}).to_list(5000) if i["service"].get("emailed_for") != i["service"]["next_due"]]
    by_host: dict = {}
    for i in due:
        by_host.setdefault(i["host_id"], []).append(i)
    sent = 0
    for hid, items in by_host.items():
        user = await db.users.find_one({"id": hid}, {"_id": 0, "email": 1, "name": 1})
        if not user:
            continue
        claimed = []
        for i in items:  # claim atomically so two servers never email the same due date twice
            nd = i["service"]["next_due"]
            r = await db.items.update_one({"id": i["id"], "service.next_due": nd, "service.emailed_for": {"$ne": nd}},
                                          {"$set": {"service.emailed_for": nd}})
            if r.modified_count:
                claimed.append(i)
        if not claimed or not deliverable(user["email"]):
            continue
        rooms = {r["id"]: r for r in await db.rooms.find({"id": {"$in": [i["room_id"] for i in claimed]}}, {"_id": 0}).to_list(500)}
        props = {p["id"]: p["name"] for p in await db.properties.find({"id": {"$in": [i["property_id"] for i in claimed]}}, {"_id": 0, "id": 1, "name": 1}).to_list(100)}
        rows = []
        for i in sorted(claimed, key=lambda x: x["service"]["next_due"]):
            d = date.fromisoformat(i["service"]["next_due"])
            days = (d - t).days
            room = item_room(rooms.get(i["room_id"]))
            rows.append({"what": f"{short_label(i)}: {KIND[i['service']['interval_months']]} service",
                         "where": " · ".join(x for x in (room, props.get(i["property_id"], "")) if x),
                         "when": f"{due_text(days).capitalize()} ({fmt_day(d)})", "days": days})
        subject = (f"{rows[0]['what'].split(':')[0]} service is {due_text(rows[0]['days'])}" if len(rows) == 1
                   else f"{len(rows)} rental services are coming up")
        try:
            await send_email(to=user["email"], subject=subject, html=reminder_html(user.get("name", ""), rows))
            sent += 1
        except (EmailError, ValueError) as e:
            log.warning("reminder email to host %s not sent: %s", hid, e)
            if str(e) not in BILLING:  # transient failure: release the claim so the next hourly run retries
                for i in claimed:
                    nd = i["service"]["next_due"]
                    await db.items.update_one({"id": i["id"], "service.emailed_for": nd}, {"$set": {"service.emailed_for": None}})
    return sent


BILLING = {"insufficient_credits", "integration_disabled", "daily_limit_reached"}  # owner's account state: don't retry in a loop


async def safe_reminders(host_id: Optional[str] = None):
    try:
        await send_due_reminders(host_id)
    except Exception as e:  # never let a reminder failure break a request or the loop
        log.warning("reminders failed: %s", e)


_loop_task: Optional[asyncio.Task] = None


async def _reminder_loop():
    await asyncio.sleep(20)
    while True:
        await safe_reminders()
        await asyncio.sleep(3600)


def start_reminders():
    global _loop_task
    if _loop_task is None:
        _loop_task = asyncio.create_task(_reminder_loop())
