"""Issue page: Bullpen picks the 3 best pros, texts the one the host approves, calls at +5 min, moves on at +10.
Contractors reply by text ("YES 7:30"). The host gets texts too and answers "how did it go?" by text."""
import asyncio
import logging
import os
import re
import uuid
from datetime import datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from server import Contractor, ContractorRequest, JobOutcome, current_host, db, get_owned, issue_bench, now_utc, sync_issue_status

router = APIRouter(prefix="/api")
log = logging.getLogger("bullpen.dispatch")
TZ = ZoneInfo("America/Los_Angeles")
CALL_AFTER, NEXT_AFTER = timedelta(minutes=15), timedelta(minutes=30)
CENTERS = {"south lake tahoe"}
# Sample pros near Tahoe that aren't on the host's bench yet (made-up businesses): name, stars, reviews, miles
NEARBY = {"Hot tub & spa": [("High Sierra Pool & Spa", 4.7, 112, 4), ("Lakeside Spa Repair", 4.1, 9, 7), ("Emerald Bay Spa Care", 4.3, 31, 11)]}


def short(name: str) -> str:
    w = name.replace("&", " ").split()
    return " ".join(w[:2]) if len(w) > 2 else name


def local(dt: datetime) -> datetime:
    return dt.astimezone(TZ) if dt.tzinfo else dt.replace(tzinfo=ZoneInfo("UTC")).astimezone(TZ)


def hm(dt: datetime, day: bool = False) -> str:
    d = local(dt)
    t = d.strftime("%-I %p") if d.minute == 0 else d.strftime("%-I:%M %p")
    return f"{d.strftime('%a')} {t}" if day else t


def e164(p: str) -> Optional[str]:
    d = re.sub(r"\D", "", p or "")
    return f"+1{d}" if len(d) == 10 else f"+{d}" if len(d) == 11 and d[0] == "1" else None


def twilio():
    sid, tok, num = (os.environ.get(k) for k in ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"))
    if not (sid and tok and num):
        return None, None
    from twilio.rest import Client
    return Client(sid, tok), num


async def send_text(to: Optional[str], body: str) -> bool:
    c, num = twilio()
    to = e164(to or "")
    if not c or not to:
        return False
    try:
        await asyncio.to_thread(lambda: c.messages.create(to=to, from_=num, body=body))
        return True
    except Exception as e:  # trial limits, bad numbers: logged for the owner, the flow carries on
        log.warning("text failed: %s", str(e)[:160])
        return False


async def place_call(to: Optional[str], say: str) -> bool:
    c, num = twilio()
    to = e164(to or "")
    if not c or not to:
        return False
    try:
        await asyncio.to_thread(lambda: c.calls.create(to=to, from_=num, twiml=f"<Response><Say>{say}</Say><Pause length=\"1\"/><Say>{say}</Say></Response>"))
        return True
    except Exception as e:
        log.warning("call failed: %s", str(e)[:160])
        return False


async def event(issue_id: str, host_id: str, text: str, dot: str = "done", at: Optional[datetime] = None, key: Optional[str] = None):
    await db.issue_events.insert_one({"id": str(uuid.uuid4()), "issue_id": issue_id, "host_id": host_id, "at": at or now_utc(),
                                      "text": text, "dot": dot, "key": key})


async def context(issue: dict, host_id: str):
    prop = await get_owned("properties", issue["property_id"], host_id)
    am = await db.amenities.find_one({"id": issue.get("amenity_id"), "host_id": host_id}, {"_id": 0}) if issue.get("amenity_id") else None
    label = am["label"] if am else issue.get("trade_needed") or "Repair"
    sm = issue.get("summary") or {}
    note = (issue.get("host_note") or issue.get("ai_diagnosis") or "").strip()
    first = re.split(r"(?<=[.!?])\s", note)[0][:60] if note else f"{label} needs a fix."
    return prop, label, {"headline": sm.get("headline") or (first if first.endswith((".", "!", "?")) else first + "."),
                         "title": sm.get("title") or f"{label} issue",
                         "phrase": sm.get("phrase") or f"The {label.lower()} needs a fix"}


async def build_picks(host: dict, issue: dict, prop: dict) -> list:
    bench = [c for c in await issue_bench(host["id"], issue, prop, set()) if c["rank"]]
    picks = []
    for c in bench:
        m = re.match(r"Showed up \d+ of \d+", c.get("reason") or "")
        picks.append({"key": c["id"], "contractor_id": c["id"], "name": c["business_name"] or c["name"], "tag": "Yours",
                      "reason": m.group(0) if m else "On your bench", "why": f"{c['business_name'] or c['name']}: {c['reason']}. Ranked by show-ups, on-time arrivals, ratings and reply speed."})
    if prop["city"].lower() in CENTERS:
        for name, stars, n, mi in NEARBY.get(issue.get("trade_needed") or "", []):
            picks.append({"key": f"dir:{name}", "contractor_id": None, "name": name, "tag": "New to you",
                          "reason": f"{stars} stars, {mi} mi" if n >= 20 else f"{mi} mi away",
                          "detail": f"{stars} stars · {mi} mi", "why": f"{name}: {stars} stars from {n} reviews, {mi} mi from {prop['name']}."})
    return picks


def draft(host: dict, prop: dict, issue: dict, phrase: str) -> str:
    where = f"{prop['address'].split(',')[0].strip()} in {prop['city']}"
    guests = f" and guests arrive {hm(issue['guest_arrival'], day=True)}" if issue.get("guest_arrival") else ""
    return f"Hi, it's {host['name'].split(' ')[0]}'s place at {where}. {phrase}{guests}. Can you come tonight or tomorrow morning?"


async def ensure(host: dict, issue: dict) -> dict:
    d = issue.get("dispatch")
    if d:
        return d
    prop, label, sm = await context(issue, host["id"])
    hid, iid = host["id"], issue["id"]
    if issue["status"] in ("scheduled", "resolved"):  # booked before this page existed
        r = await db.requests.find_one({"issue_id": iid, "response": "booked"}, {"_id": 0}, sort=[("responded_at", -1)])
        c = await db.contractors.find_one({"id": (r or {}).get("contractor_id")}, {"_id": 0})
        d = {"state": "booked", "picks": [{"name": (c or {}).get("business_name") or "Your pro"}], "current": 0, "message": "",
             "booked_text": hm(issue["scheduled_for"], day=True) if issue.get("scheduled_for") else "booked"}
    else:
        picks = await build_picks(host, issue, prop)
        for s in issue.get("seed_events") or []:
            await event(iid, hid, s["text"], at=issue["created_at"])
        if not issue.get("seed_events"):
            await event(iid, hid, f"You reported it. {sm['headline']}" + (f" Guests {hm(issue['guest_arrival'], day=True)}." if issue.get("guest_arrival") else ""), at=issue["created_at"])
        if picks:
            backups = len(picks[:3]) - 1
            who = f"{short(picks[0]['name'])}" + (f" and {backups} backup{'s' if backups != 1 else ''}" if backups else "")
            user = await db.users.find_one({"id": hid}, {"_id": 0, "phone": 1})
            texted = await send_text((user or {}).get("phone"), f"Bullpen: {sm['title']} at {prop['name']}. Best pick: {who}. Reply YES and I'll text {short(picks[0]['name'])}.")
            area = prop["city"].split()[-1]
            await event(iid, hid, f"Ranked {len(picks)} {label.lower()} pros near {area}. {'Texted you' if texted else 'Picked'} {who}.")
        d = {"state": "pick" if picks else "empty", "picks": picks[:3] + picks[3:], "current": 0, "message": draft(host, prop, issue, sm["phrase"])}
    await db.issues.update_one({"id": iid}, {"$set": {"dispatch": d}})
    return d


def view(d: dict, issue: dict, prop: dict, label: str, sm: dict, events: list, phone_set: bool) -> dict:
    picks = d.get("picks") or []
    cur = picks[d["current"]] if d.get("current", 0) < len(picks) else None
    tl = [{"at": e["at"].isoformat(), "text": e["text"], "dot": e["dot"]} for e in events]
    if d["state"] == "next":  # B9 shows the attempt from the host's first YES onwards
        first = next((i for i, e in enumerate(tl) if e["text"].startswith("You replied YES")), 0)
        tl = tl[first:]
    return {"state": d["state"], "chip": f"{label} · {prop['name']}", "eyebrow": f"{prop['name']} · {sm['title']}",
            "headline": sm["headline"], "picks": [{k: p.get(k) for k in ("name", "tag", "reason", "why", "detail")} | {"short": short(p["name"])} for p in picks[:3]],
            "current": {k: cur.get(k) for k in ("name", "tag", "reason", "why", "detail")} | {"short": short(cur["name"])} if cur else None,
            "prev": short(picks[d["current"] - 1]["name"]) if d.get("current") else None,
            "message": d.get("message", ""), "sent_at": d.get("sent_at"), "call_at": d.get("call_at"), "next_at": d.get("next_at"),
            "called": bool(d.get("called")), "booked_text": d.get("booked_text"), "timeline": tl, "host_phone_set": phone_set}


@router.get("/issues/{issue_id}/dispatch")
async def get_dispatch(issue_id: str, host: dict = Depends(current_host)):
    issue = await get_owned("issues", issue_id, host["id"])
    d = await ensure(host, issue)
    prop, label, sm = await context(issue, host["id"])
    events = await db.issue_events.find({"issue_id": issue_id, "host_id": host["id"]}, {"_id": 0}).sort("at", 1).to_list(200)
    user = await db.users.find_one({"id": host["id"]}, {"_id": 0, "phone": 1})
    out = view(d, issue, prop, label, sm, events, bool((user or {}).get("phone")))
    for k in ("sent_at", "call_at", "next_at"):
        out[k] = out[k].isoformat() if isinstance(out[k], datetime) else out[k]
    return out


class EditIn(BaseModel):
    message: Optional[str] = Field(None, min_length=1, max_length=600)
    note: Optional[str] = Field(None, min_length=3, max_length=500)


@router.patch("/issues/{issue_id}/dispatch")
async def edit_dispatch(issue_id: str, body: EditIn, host: dict = Depends(current_host)):
    issue = await get_owned("issues", issue_id, host["id"])
    d = await ensure(host, issue)
    if d["state"] not in ("pick", "next"):
        raise HTTPException(400, "That text has already gone out.")
    if body.message:
        d["message"] = body.message.strip()
    if body.note:  # "Not right? Change it": new headline and message from the host's words
        note = body.note.strip().rstrip(".")
        summary = {"headline": f"{note[0].upper()}{note[1:]}.", "title": note[:40], "phrase": f"{note[0].upper()}{note[1:]}"}
        await db.issues.update_one({"id": issue_id}, {"$set": {"host_note": body.note.strip(), "summary": summary}})
        issue["summary"] = summary
        prop, _, _ = await context(issue, host["id"])
        d["message"] = draft(host, prop, issue, summary["phrase"])
    await db.issues.update_one({"id": issue_id}, {"$set": {"dispatch": d}})
    return {"ok": True}


class PhoneIn(BaseModel):
    phone: str = Field(min_length=7, max_length=20)


@router.put("/me/phone")
async def set_phone(body: PhoneIn, host: dict = Depends(current_host)):
    p = e164(body.phone)
    if not p:
        raise HTTPException(400, "Enter a US mobile number, like 415 555 0123.")
    await db.users.update_one({"id": host["id"]}, {"$set": {"phone": p}})
    return {"ok": True}


async def approve(host: dict, issue: dict) -> dict:
    d = await ensure(host, issue)
    if d["state"] not in ("pick", "next"):
        raise HTTPException(400, "Already sent.")
    pick = d["picks"][d["current"]]
    if not pick.get("contractor_id"):  # new to you: joins the bench so their record builds up
        c = Contractor(host_id=host["id"], name=pick["name"], business_name=pick["name"], trades=[issue["trade_needed"]],
                       service_area=[(await get_owned("properties", issue["property_id"], host["id"]))["city"]],
                       notes="Added from Bullpen's picks", demo=bool(issue.get("demo")))
        await db.contractors.insert_one(c.model_dump())
        pick["contractor_id"] = c.id
    c = await db.contractors.find_one({"id": pick["contractor_id"]}, {"_id": 0})
    now = now_utc()
    req = ContractorRequest(host_id=host["id"], issue_id=issue["id"], contractor_id=c["id"], drafted_message=d["message"],
                            sent_at=now, channel="messages", demo=bool(issue.get("demo")))
    await db.requests.insert_one(req.model_dump())
    await db.contractors.update_one({"id": c["id"]}, {"$set": {"last_contacted": now}})
    if not c.get("demo"):  # sample contractors are made up: nothing to send
        await send_text(c.get("phone"), f"{d['message']}\n\nReply YES with a time (like YES 7:30 PM), or NO.")
    s = short(pick["name"])
    await db.issue_events.delete_many({"issue_id": issue["id"], "dot": "pending"})
    await event(issue["id"], host["id"], f"You replied YES. Texted {s}.", at=now)
    await event(issue["id"], host["id"], f"Call {s} if no reply.", "pending", at=now + CALL_AFTER, key="call")
    d.update(state="waiting", sent_at=now, call_at=now + CALL_AFTER, next_at=now + NEXT_AFTER, called=False, request_id=req.id)
    await db.issues.update_one({"id": issue["id"]}, {"$set": {"dispatch": d}})
    await sync_issue_status(issue["id"])
    return d


@router.post("/issues/{issue_id}/dispatch/send")
async def send(issue_id: str, host: dict = Depends(current_host)):
    issue = await get_owned("issues", issue_id, host["id"])
    await approve(host, issue)
    return {"ok": True}


def parse_time(text: str) -> Optional[datetime]:
    m = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?", text.lower())
    if not m:
        return None
    h, mi, ap = int(m.group(1)), int(m.group(2) or 0), (m.group(3) or "")[:1]
    if h > 23 or mi > 59:
        return None
    if ap == "p" and h < 12:
        h += 12
    elif not ap and 1 <= h <= 7:
        h += 12  # "YES 7:30" from a contractor means the evening
    now = local(now_utc())
    t = now.replace(hour=h % 24, minute=mi, second=0, microsecond=0)
    return t + timedelta(days=1) if t < now else t


def when_text(t: datetime) -> str:
    now = local(now_utc())
    lt = local(t)
    day = "tonight" if lt.date() == now.date() and lt.hour >= 17 else "today" if lt.date() == now.date() else "tomorrow" if lt.date() == (now + timedelta(days=1)).date() else lt.strftime("%a")
    return f"{day} {hm(t)}"


async def book(issue: dict, when: datetime):
    d = issue["dispatch"]
    s = short(d["picks"][d["current"]]["name"])
    now = now_utc()
    req = await db.requests.find_one({"id": d["request_id"]}, {"_id": 0})
    await db.requests.update_one({"id": d["request_id"]}, {"$set": {"response": "booked", "responded_at": now, "scheduled_for": when,
                                                                    "response_minutes": max(1, int((now - req["sent_at"].replace(tzinfo=now.tzinfo)).total_seconds() // 60))}})
    await db.issue_events.delete_many({"issue_id": issue["id"], "dot": "pending"})
    user = await db.users.find_one({"id": issue["host_id"]}, {"_id": 0, "phone": 1})
    prop = await db.properties.find_one({"id": issue["property_id"]}, {"_id": 0, "name": 1})
    texted = await send_text((user or {}).get("phone"), f"Bullpen: Booked. {s}, {when_text(when)} at {prop['name']}.")
    await event(issue["id"], issue["host_id"], f"{s} replied YES for {hm(when)}.{' Texted you.' if texted else ''}", "good")
    d.update(state="booked", booked_text=when_text(when), checkin_at=when + timedelta(hours=14))
    await event(issue["id"], issue["host_id"], "Text you tomorrow: how did it go?", "pending", at=d["checkin_at"], key="checkin")
    await db.requests.update_one({"id": d["request_id"]}, {"$set": {"scheduled_for": when}})
    await db.issues.update_one({"id": issue["id"]}, {"$set": {"dispatch": d, "scheduled_for": when}})
    await sync_issue_status(issue["id"])


class TestReplyIn(BaseModel):
    reply: str = Field(pattern="^(yes|no|silent)$")
    time: Optional[str] = Field(None, max_length=20)


@router.post("/issues/{issue_id}/dispatch/test-reply")
async def test_reply(issue_id: str, body: TestReplyIn, host: dict = Depends(current_host)):
    """Plays a contractor's reply without a real text, so the flow can be seen on a Twilio trial account."""
    issue = await get_owned("issues", issue_id, host["id"])
    d = issue.get("dispatch") or {}
    if d.get("state") != "waiting":
        raise HTTPException(400, "Nobody is waiting on a reply right now.")
    s = short(d["picks"][d["current"]]["name"])
    if body.reply == "yes":
        when = parse_time(body.time or "7:30 PM")
        if not when:
            raise HTTPException(400, "Use a time like 7:30 PM.")
        await book(issue, when)
    elif body.reply == "no":
        await advance(issue, f"{s} said no.")
    else:
        if not d.get("called"):
            await db.issue_events.delete_many({"issue_id": issue_id, "key": "call"})
            await event(issue_id, host["id"], f"No reply. Called {s}, no answer.")
        await advance(issue, "No answer in 30 min.")
    return {"ok": True}


async def advance(issue: dict, why: str):
    d = issue["dispatch"]
    s = short(d["picks"][d["current"]]["name"])
    await db.requests.update_one({"id": d.get("request_id"), "response": None}, {"$set": {"response": "no_answer", "responded_at": now_utc()}})
    await db.issue_events.delete_many({"issue_id": issue["id"], "dot": "pending"})
    d["current"] += 1
    if d["current"] >= len(d["picks"]):
        d["state"] = "empty"
        await event(issue["id"], issue["host_id"], f"{why} Nobody left to try.", "alert")
    else:
        nxt = d["picks"][d["current"]]["name"]
        d["state"] = "next"
        await event(issue["id"], issue["host_id"], f"{why} Picked {nxt}.", "alert")
        await event(issue["id"], issue["host_id"], "Waiting for your YES.", "pending", key="now")
        user = await db.users.find_one({"id": issue["host_id"]}, {"_id": 0, "phone": 1})
        await send_text((user or {}).get("phone"), f"Bullpen: {s} didn't answer. Next best: {nxt}. Reply YES and I'll text them.")
    await db.issues.update_one({"id": issue["id"]}, {"$set": {"dispatch": d}})
    await sync_issue_status(issue["id"])


async def tick():
    now = now_utc()
    for issue in await db.issues.find({"dispatch.state": "waiting"}, {"_id": 0}).to_list(500):
        d = issue["dispatch"]
        s = short(d["picks"][d["current"]]["name"])
        if not d.get("called") and now >= d["call_at"].replace(tzinfo=now.tzinfo):
            r = await db.issues.update_one({"id": issue["id"], "dispatch.called": False}, {"$set": {"dispatch.called": True}})
            if r.modified_count:
                c = await db.contractors.find_one({"id": d["picks"][d["current"]]["contractor_id"]}, {"_id": 0})
                if c and not c.get("demo"):
                    await place_call(c.get("phone"), f"Hi, this is Bullpen. {d['message']} Please reply to our text with yes and a time.")
                await db.issue_events.delete_many({"issue_id": issue["id"], "key": "call"})
                await event(issue["id"], issue["host_id"], f"No reply. Called {s}, no answer.")
        if now >= d["next_at"].replace(tzinfo=now.tzinfo):
            r = await db.issues.update_one({"id": issue["id"], "dispatch.state": "waiting"}, {"$set": {"dispatch.state": "moving"}})
            if r.modified_count:
                issue["dispatch"]["called"] = True
                await advance(issue, "No answer in 30 min.")
    for issue in await db.issues.find({"dispatch.state": "booked", "dispatch.checkin_at": {"$lte": now}, "dispatch.checked": {"$ne": True}}, {"_id": 0}).to_list(200):
        r = await db.issues.update_one({"id": issue["id"], "dispatch.checked": {"$ne": True}}, {"$set": {"dispatch.checked": True}})
        user = await db.users.find_one({"id": issue["host_id"]}, {"_id": 0, "phone": 1})
        if r.modified_count:
            s = short(issue["dispatch"]["picks"][issue["dispatch"]["current"]]["name"])
            texted = await send_text((user or {}).get("phone"), f"Bullpen: How did {s} do? Reply with a few words, like: showed up on time, great job, $180.")
            await db.issue_events.delete_many({"issue_id": issue["id"], "key": "checkin"})
            await event(issue["id"], issue["host_id"], f"{'Texted you' if texted else 'Asked you'}: how did {s} do?")


def twiml(msg: str) -> Response:
    from xml.sax.saxutils import escape
    return Response(f"<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Message>{escape(msg)}</Message></Response>", media_type="application/xml")


@router.post("/twilio/sms")
async def inbound_sms(request: Request):
    form = dict(await request.form())
    tok = os.environ.get("TWILIO_AUTH_TOKEN")
    if tok:
        from twilio.request_validator import RequestValidator
        url = f"{request.headers.get('x-forwarded-proto', request.url.scheme)}://{request.headers.get('x-forwarded-host', request.url.netloc)}{request.url.path}"
        if not RequestValidator(tok).validate(url, form, request.headers.get("x-twilio-signature", "")):
            raise HTTPException(403, "Bad signature")
    frm, body = e164(form.get("From", "")), (form.get("Body") or "").strip()
    low = body.lower()
    user = await db.users.find_one({"phone": frm}, {"_id": 0})
    if user:  # the host: YES approves the current pick, anything else after a booking is "how it went"
        issue = await db.issues.find_one({"host_id": user["id"], "dispatch.state": {"$in": ["pick", "next"]}}, {"_id": 0}, sort=[("created_at", -1)])
        if issue and re.match(r"^\s*(yes|y|ok|send)\b", low):
            d = await approve(user, issue)
            return twiml(f"Texting {short(d['picks'][d['current']]['name'])} now.")
        issue = await db.issues.find_one({"host_id": user["id"], "dispatch.checked": True, "dispatch.outcome_saved": {"$ne": True}}, {"_id": 0}, sort=[("created_at", -1)])
        if issue:
            d = issue["dispatch"]
            req = await db.requests.find_one({"id": d["request_id"]}, {"_id": 0})
            showed = not re.search(r"no.?show|didn'?t (show|come)|never came", low)
            stars = re.search(r"\b([1-5])\s*(stars?|/5)\b", low)
            rating = int(stars.group(1)) if stars else (2 if not showed else 3 if re.search(r"\b(ok|okay|fine|late)\b", low) else 5)
            cost = re.search(r"\$\s*(\d+(?:\.\d{1,2})?)", body)
            o = JobOutcome(host_id=user["id"], contractor_id=req["contractor_id"], issue_id=issue["id"], request_id=req["id"], showed_up=showed,
                           on_time=showed and "late" not in low, rating=rating, note=body[:1000], cost=float(cost.group(1)) if cost and showed else None, date=now_utc())
            await db.job_outcomes.insert_one(o.model_dump())
            await db.issues.update_one({"id": issue["id"]}, {"$set": {"dispatch.outcome_saved": True}})
            await sync_issue_status(issue["id"])
            await event(issue["id"], user["id"], f"You said: {body[:120]}. Saved how it went.")
            return twiml("Thanks, saved. That helps rank who you call next time.")
        return twiml("Bullpen here. Open the app to see what's going on.")
    digits = re.sub(r"\D", "", frm or "")[-10:]
    for issue in await db.issues.find({"dispatch.state": "waiting"}, {"_id": 0}).to_list(500):
        d = issue["dispatch"]
        c = await db.contractors.find_one({"id": d["picks"][d["current"]]["contractor_id"]}, {"_id": 0})
        if not c or not digits or re.sub(r"\D", "", c.get("phone", ""))[-10:] != digits:
            continue
        if re.match(r"^\s*(no|n|sorry|can'?t)\b", low):
            await advance(issue, f"{short(c['business_name'] or c['name'])} said no.")
            return twiml("No problem, thanks for letting us know.")
        if re.match(r"^\s*(yes|y|yeah|yep|sure|ok)\b", low):
            when = parse_time(body)
            if not when:
                return twiml("Great! What time can you come? Reply like YES 7:30 PM.")
            await book(issue, when)
            prop = await db.properties.find_one({"id": issue["property_id"]}, {"_id": 0})
            return twiml(f"You're booked for {when_text(when)} at {prop['address'].split(',')[0]}. Thanks!")
        return twiml("Reply YES with a time (like YES 7:30 PM), or NO.")
    return twiml("Bullpen here. We couldn't match this text to a job.")


_task: Optional[asyncio.Task] = None


async def _loop():
    while True:
        try:
            await tick()
        except Exception as e:
            log.warning("dispatch tick failed: %s", e)
        await asyncio.sleep(20)


def start():
    global _task
    if _task is None:
        _task = asyncio.create_task(_loop())
