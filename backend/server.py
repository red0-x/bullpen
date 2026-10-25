from dotenv import load_dotenv
load_dotenv()

import os
import logging
import secrets
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Literal, Optional

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.cors import CORSMiddleware

import base64
from scoring import score_contractor, rank, covers, watch_adjustments, latest_revisions
from seed import build_demo, AMENITY_TRADES
from ai import diagnose, draft_message, template_message, AIError

TRADES = sorted(set(AMENITY_TRADES.values()) | {"Electrical"})

client = AsyncIOMotorClient(os.environ["MONGO_URL"], tz_aware=True)
db = client[os.environ["DB_NAME"]]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"

app = FastAPI()
api = APIRouter(prefix="/api")
logger = logging.getLogger("bullpup")
logging.basicConfig(level=logging.INFO)

DOMAIN = ["properties", "amenities", "contractors", "issues", "requests", "job_outcomes", "watch_signals"]


def now_utc():
    return datetime.now(timezone.utc)


# ---------- Data model ----------
class DocBase(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    host_id: str
    demo: bool = False
    created_at: datetime = Field(default_factory=now_utc)


class Host(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    password_hash: str
    created_at: datetime = Field(default_factory=now_utc)


class Property(DocBase):
    name: str
    city: str
    address: str


class Amenity(DocBase):
    property_id: str
    type: Literal["pool", "hot_tub", "plumbing", "kitchen_appliances", "hvac", "cleaning", "custom"]
    label: str
    trade: str
    maintenance_schedule: Optional[str] = None


class Contractor(DocBase):
    name: str
    business_name: str = ""
    phone: str = ""
    email: str = ""
    trades: List[str] = []
    service_area: List[str] = []
    notes: str = ""
    status: Literal["active", "unreachable", "out_of_business"] = "active"
    last_contacted: Optional[datetime] = None
    pinned: bool = False
    snooze_until: Optional[datetime] = None
    verified_at: Optional[datetime] = None


class Issue(DocBase):
    property_id: str
    amenity_id: Optional[str] = None
    photo_url: Optional[str] = None
    host_note: str = ""
    ai_diagnosis: Optional[str] = None
    fix_steps: List[str] = []
    safety_note: Optional[str] = None
    diy: Optional[Literal["yes", "maybe", "no"]] = None
    trade_needed: Optional[str] = None
    urgency: Optional[Literal["today", "this_week", "can_wait"]] = None
    guest_arrival: Optional[datetime] = None
    status: Literal["open", "waiting", "scheduled", "resolved"] = "open"
    scheduled_for: Optional[datetime] = None
    updates: List[dict] = []
    updated_at: datetime = Field(default_factory=now_utc)


class ContractorRequest(DocBase):
    issue_id: str
    contractor_id: str
    drafted_message: str
    sent_at: Optional[datetime] = None
    response: Optional[Literal["no_answer", "declined", "booked"]] = None
    responded_at: Optional[datetime] = None
    response_minutes: Optional[int] = None
    channel: Optional[Literal["copy", "messages"]] = None


class JobOutcome(DocBase):
    contractor_id: str
    issue_id: str
    request_id: Optional[str] = None
    showed_up: bool
    on_time: bool
    rating: int = Field(ge=1, le=5)
    note: str = ""
    date: datetime
    revision_of: Optional[str] = None


class WatchSignal(DocBase):
    contractor_id: str
    signal_type: str
    value: str
    date: datetime
    alert: Optional[str] = None
    acknowledged: bool = False


DEMO_MODELS = {"properties": Property, "amenities": Amenity, "contractors": Contractor, "issues": Issue,
               "requests": ContractorRequest, "job_outcomes": JobOutcome, "watch_signals": WatchSignal}


def ser(doc: dict) -> dict:
    out = {}
    for k, v in doc.items():
        if k in ("_id", "password_hash"):
            continue
        out[k] = v.isoformat() if isinstance(v, datetime) else v
    return out


# ---------- Auth ----------
class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


def hash_pw(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def check_pw(p: str, h: str) -> bool:
    return bcrypt.checkpw(p.encode(), h.encode())


def make_token(uid: str, kind: str, delta: timedelta) -> str:
    return jwt.encode({"sub": uid, "type": kind, "exp": now_utc() + delta}, JWT_SECRET, algorithm=JWT_ALG)


def set_auth_cookies(resp: Response, uid: str):
    resp.set_cookie("access_token", make_token(uid, "access", timedelta(hours=12)), httponly=True,
                    secure=True, samesite="none", max_age=43200, path="/")
    resp.set_cookie("refresh_token", make_token(uid, "refresh", timedelta(days=7)), httponly=True,
                    secure=True, samesite="none", max_age=604800, path="/")


async def current_host(request: Request) -> dict:
    token = request.cookies.get("access_token")
    auth = request.headers.get("Authorization", "")
    if not token and auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid session")
    if payload.get("type") != "access":
        raise HTTPException(401, "Invalid session")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "That email already has an account. Try logging in.")
    host = Host(name=body.name.strip(), email=email, password_hash=hash_pw(body.password))
    await db.users.insert_one(host.model_dump())
    set_auth_cookies(response, host.id)
    return ser(host.model_dump())


@api.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower()
    fwd = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    ident = f"{fwd or (request.client.host if request.client else 'x')}:{email}"
    att = await db.login_attempts.find_one({"identifier": ident})
    if att and att.get("count", 0) >= 5 and att["last"] > now_utc() - timedelta(minutes=15):
        raise HTTPException(429, "Too many attempts. Try again in 15 minutes.")
    user = await db.users.find_one({"email": email})
    if not user or not check_pw(body.password, user["password_hash"]):
        await db.login_attempts.update_one({"identifier": ident},
                                           {"$inc": {"count": 1}, "$set": {"last": now_utc()}}, upsert=True)
        raise HTTPException(401, "Email or password doesn't match.")
    await db.login_attempts.delete_one({"identifier": ident})
    set_auth_cookies(response, user["id"])
    return ser(user)


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/", secure=True, samesite="none")
    response.delete_cookie("refresh_token", path="/", secure=True, samesite="none")
    return {"ok": True}


@api.get("/auth/me")
async def me(host: dict = Depends(current_host)):
    return ser(host)


@api.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    try:
        payload = jwt.decode(token or "", JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid session")
    if payload.get("type") != "refresh" or not await db.users.find_one({"id": payload["sub"]}):
        raise HTTPException(401, "Invalid session")
    set_auth_cookies(response, payload["sub"])
    return {"ok": True}


@api.post("/auth/forgot-password")
async def forgot(body: ForgotIn):
    user = await db.users.find_one({"email": body.email.lower()})
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({"token": token, "user_id": user["id"], "used": False,
                                                   "expires_at": now_utc() + timedelta(hours=1)})
        logger.info("Password reset link: /reset-password?token=%s", token)
    return {"ok": True}


@api.post("/auth/reset-password")
async def reset_password(body: ResetIn):
    rec = await db.password_reset_tokens.find_one({"token": body.token, "used": False})
    if not rec or rec["expires_at"] < now_utc():
        raise HTTPException(400, "That reset link has expired.")
    await db.users.update_one({"id": rec["user_id"]}, {"$set": {"password_hash": hash_pw(body.password)}})
    await db.password_reset_tokens.update_one({"token": body.token}, {"$set": {"used": True}})
    return {"ok": True}


# ---------- Scoring helpers ----------
async def scored_contractors(host_id: str) -> list:
    now = now_utc()
    contractors = await db.contractors.find({"host_id": host_id}, {"_id": 0}).to_list(2000)
    outcomes = await db.job_outcomes.find({"host_id": host_id}, {"_id": 0}).to_list(20000)
    reqs = await db.requests.find({"host_id": host_id}, {"_id": 0}).to_list(20000)
    signals = await db.watch_signals.find({"host_id": host_id}, {"_id": 0}).to_list(50000)
    by_c_out, by_c_req, by_c_sig = {}, {}, {}
    for o in outcomes:
        by_c_out.setdefault(o["contractor_id"], []).append(o)
    for r in reqs:
        by_c_req.setdefault(r["contractor_id"], []).append(r)
    for s in signals:
        by_c_sig.setdefault(s["contractor_id"], []).append(s)
    return [{**c, **score_contractor(c, by_c_out.get(c["id"], []), by_c_req.get(c["id"], []), now,
                                     watch_adjustments(by_c_sig.get(c["id"], []), now))}
            for c in contractors]


def public_contractor(c: dict) -> dict:
    return ser({**c, "last_success": c.get("last_success")})


# ---------- Properties & bench ----------
@api.get("/properties")
async def list_properties(host: dict = Depends(current_host)):
    props = await db.properties.find({"host_id": host["id"]}, {"_id": 0}).sort("created_at", 1).to_list(100)
    amenities = await db.amenities.find({"host_id": host["id"]}, {"_id": 0}).to_list(1000)
    contractors = await scored_contractors(host["id"])
    out = []
    for p in props:
        tiles = []
        for a in [a for a in amenities if a["property_id"] == p["id"]]:
            bench = rank([dict(c) for c in contractors if covers(c, a, p)])
            active = [c for c in bench if c["ranked"]]
            tiles.append(ser({**a, "active_count": len(active), "total_count": len(bench),
                              "top": [{"id": c["id"], "business_name": c["business_name"], "score": c["score"],
                                       "reason": c["reason"]} for c in active[:3]]}))
        out.append(ser({**p, "amenities": tiles}))
    return out


@api.get("/amenities/{amenity_id}/bench")
async def amenity_bench(amenity_id: str, host: dict = Depends(current_host)):
    a = await db.amenities.find_one({"id": amenity_id, "host_id": host["id"]}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Amenity not found")
    p = await db.properties.find_one({"id": a["property_id"], "host_id": host["id"]}, {"_id": 0})
    contractors = await scored_contractors(host["id"])
    bench = rank([c for c in contractors if covers(c, a, p)])
    return {"amenity": ser(a), "property": ser(p), "bench": [public_contractor(c) for c in bench]}


@api.get("/contractors")
async def list_contractors(host: dict = Depends(current_host)):
    return [public_contractor(c) for c in rank(await scored_contractors(host["id"]))]


# ---------- Demo data ----------
async def demo_counts(host_id: str) -> dict:
    return {
        "demo_loaded": await db.properties.count_documents({"host_id": host_id, "demo": True}) > 0,
        "own_contractors": await db.contractors.count_documents({"host_id": host_id, "demo": {"$ne": True}}),
        "own_properties": await db.properties.count_documents({"host_id": host_id, "demo": {"$ne": True}}),
    }


async def clear_demo(host_id: str):
    demo_props = [p["id"] for p in await db.properties.find({"host_id": host_id, "demo": True}, {"id": 1}).to_list(100)]
    linked = [i["id"] for i in await db.issues.find({"host_id": host_id, "property_id": {"$in": demo_props}},
                                                    {"id": 1}).to_list(5000)]
    await db.issues.delete_many({"host_id": host_id, "id": {"$in": linked}})
    await db.requests.delete_many({"host_id": host_id, "issue_id": {"$in": linked}})
    await db.issue_photos.delete_many({"host_id": host_id, "issue_id": {"$in": linked}})
    await db.watch_runs.delete_many({"host_id": host_id})
    for coll in DOMAIN:
        await db[coll].delete_many({"host_id": host_id, "demo": True})


async def insert_demo(host: dict) -> dict:
    data = build_demo(host["id"], host["name"], now_utc())
    counts = {}
    for coll, docs in data.items():
        validated = [DEMO_MODELS[coll](**d).model_dump() for d in docs]
        if validated:
            await db[coll].insert_many(validated)
        counts[coll] = len(validated)
    return counts


@api.get("/demo/status")
async def demo_status(host: dict = Depends(current_host)):
    return await demo_counts(host["id"])


@api.post("/demo/load")
async def demo_load(host: dict = Depends(current_host)):
    if (await demo_counts(host["id"]))["demo_loaded"]:
        return {"status": "already_loaded"}
    return {"status": "loaded", "counts": await insert_demo(host)}


@api.post("/demo/reset")
async def demo_reset(host: dict = Depends(current_host)):
    await clear_demo(host["id"])
    return {"status": "reset", "counts": await insert_demo(host)}


@api.delete("/demo")
async def demo_clear(host: dict = Depends(current_host)):
    await clear_demo(host["id"])
    return {"status": "cleared"}


# ---------- Something broke (issues + requests) ----------
MAX_PHOTO_B64 = 7_000_000
OPEN_STATES = ["open", "waiting", "scheduled"]


class DiagnoseIn(BaseModel):
    photo_base64: Optional[str] = Field(None, max_length=MAX_PHOTO_B64)
    note: str = Field("", max_length=1000)


class IssueIn(BaseModel):
    property_id: str
    amenity_id: Optional[str] = None
    trade_needed: str
    urgency: Literal["today", "this_week", "can_wait"]
    host_note: str = Field("", max_length=1000)
    ai_diagnosis: Optional[str] = Field(None, max_length=1500)
    fix_steps: List[str] = Field(default_factory=list, max_length=8)
    safety_note: Optional[str] = Field(None, max_length=500)
    diy: Optional[Literal["yes", "maybe", "no"]] = None
    guest_arrival: Optional[datetime] = None
    photo_base64: Optional[str] = Field(None, max_length=MAX_PHOTO_B64)


class IssueAddIn(BaseModel):
    note: str = Field("", max_length=1000)
    photo_base64: Optional[str] = Field(None, max_length=MAX_PHOTO_B64)


class DraftIn(BaseModel):
    contractor_id: str
    guest_arrival_text: Optional[str] = Field(None, max_length=80)


class RequestIn(BaseModel):
    issue_id: str
    contractor_id: str
    message: str = Field(min_length=1, max_length=1500)
    channel: Literal["copy", "messages"]


class ResponseIn(BaseModel):
    response: Literal["no_answer", "declined", "booked"]
    scheduled_for: Optional[datetime] = None


async def host_catalog(host_id: str) -> list:
    props = await db.properties.find({"host_id": host_id}, {"_id": 0}).sort("created_at", 1).to_list(100)
    amenities = await db.amenities.find({"host_id": host_id}, {"_id": 0}).to_list(1000)
    for p in props:
        p["amenities"] = [a for a in amenities if a["property_id"] == p["id"]]
    return props


async def get_owned(coll: str, doc_id: str, host_id: str) -> dict:
    doc = await db[coll].find_one({"id": doc_id, "host_id": host_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    return doc


async def save_photo(host_id: str, issue_id: str, b64: Optional[str]) -> Optional[str]:
    if not b64:
        return None
    if "," in b64[:80]:
        b64 = b64.split(",", 1)[1]
    try:
        base64.b64decode(b64, validate=True)
    except Exception:
        raise HTTPException(400, "That photo couldn't be read. Try another one.")
    pid = str(uuid.uuid4())
    await db.issue_photos.insert_one({"id": pid, "host_id": host_id, "issue_id": issue_id, "data": b64,
                                      "created_at": now_utc()})
    return pid


@api.get("/trades")
async def trades(host: dict = Depends(current_host)):
    return TRADES


@api.post("/issues/diagnose")
async def diagnose_issue(body: DiagnoseIn, host: dict = Depends(current_host)):
    if not body.photo_base64 and not body.note.strip():
        raise HTTPException(400, "Add a photo or tell us what broke.")
    catalog = await host_catalog(host["id"])
    b64 = body.photo_base64.split(",", 1)[1] if body.photo_base64 and "," in body.photo_base64[:80] else body.photo_base64
    try:
        draft = await diagnose(body.note, b64, catalog, TRADES, now_utc().strftime("%A %Y-%m-%d"))
    except AIError:
        return {"ok": False, "message": "Couldn't read that right now. Tell us what broke below."}
    if not draft.get("can_tell"):
        draft["diagnosis"] = None
        draft["fix_steps"] = []
    draft["fix_steps"] = [str(s)[:240] for s in (draft.get("fix_steps") or [])][:6]
    if draft.get("diy") not in ("yes", "maybe", "no"):
        draft["diy"] = None
    prop_ids = {p["id"] for p in catalog}
    am = {a["id"]: a for p in catalog for a in p["amenities"]}
    if draft.get("property_id") not in prop_ids:
        draft["property_id"] = None
    if draft.get("amenity_id") not in am or (draft["property_id"] and am[draft["amenity_id"]]["property_id"] != draft["property_id"]):
        draft["amenity_id"] = None
    if draft["amenity_id"] and not draft["property_id"]:
        draft["property_id"] = am[draft["amenity_id"]]["property_id"]
    return {"ok": True, "draft": draft}


@api.get("/issues/open-for")
async def open_issue_for(amenity_id: str, host: dict = Depends(current_host)):
    doc = await db.issues.find_one({"host_id": host["id"], "amenity_id": amenity_id, "status": {"$in": OPEN_STATES}},
                                   {"_id": 0}, sort=[("created_at", -1)])
    return {"issue": ser(doc) if doc else None}


@api.post("/issues")
async def create_issue(body: IssueIn, host: dict = Depends(current_host)):
    await get_owned("properties", body.property_id, host["id"])
    if body.amenity_id:
        a = await get_owned("amenities", body.amenity_id, host["id"])
        if a["property_id"] != body.property_id:
            raise HTTPException(400, "That amenity belongs to another property.")
    if body.trade_needed not in TRADES:
        raise HTTPException(400, "Pick a trade from the list.")
    issue = Issue(host_id=host["id"], **body.model_dump(exclude={"photo_base64"}))
    photo_id = await save_photo(host["id"], issue.id, body.photo_base64)
    if photo_id:
        issue.photo_url = f"/api/issues/{issue.id}/photo/{photo_id}"
    await db.issues.insert_one(issue.model_dump())
    return ser(issue.model_dump())


@api.post("/issues/{issue_id}/add")
async def add_to_issue(issue_id: str, body: IssueAddIn, host: dict = Depends(current_host)):
    await get_owned("issues", issue_id, host["id"])
    photo_id = await save_photo(host["id"], issue_id, body.photo_base64)
    update = {"note": body.note, "photo_url": f"/api/issues/{issue_id}/photo/{photo_id}" if photo_id else None,
              "at": now_utc()}
    await db.issues.update_one({"id": issue_id}, {"$push": {"updates": update}, "$set": {"updated_at": now_utc()}})
    return {"ok": True, "issue_id": issue_id}


@api.delete("/issues/{issue_id}")
async def delete_issue(issue_id: str, host: dict = Depends(current_host)):
    await get_owned("issues", issue_id, host["id"])
    for coll in ("issues",):
        await db[coll].delete_one({"id": issue_id, "host_id": host["id"]})
    await db.requests.delete_many({"issue_id": issue_id, "host_id": host["id"]})
    await db.issue_photos.delete_many({"issue_id": issue_id, "host_id": host["id"]})
    return {"ok": True}


@api.get("/issues/{issue_id}/photo/{photo_id}")
async def issue_photo(issue_id: str, photo_id: str, host: dict = Depends(current_host)):
    doc = await db.issue_photos.find_one({"id": photo_id, "issue_id": issue_id, "host_id": host["id"]})
    if not doc:
        raise HTTPException(404, "Photo not found")
    return Response(base64.b64decode(doc["data"]), media_type="image/jpeg",
                    headers={"Cache-Control": "private, max-age=86400"})


@api.get("/issues")
async def list_issues(host: dict = Depends(current_host)):
    docs = await db.issues.find({"host_id": host["id"], "status": {"$in": OPEN_STATES}},
                                {"_id": 0}).sort("created_at", -1).to_list(200)
    props = {p["id"]: p for p in await host_catalog(host["id"])}
    out = []
    for d in docs:
        p = props.get(d["property_id"], {})
        a = next((x for x in p.get("amenities", []) if x["id"] == d.get("amenity_id")), None)
        out.append(ser({**d, "property_name": p.get("name"), "amenity_label": a["label"] if a else None}))
    return out


async def issue_bench(host_id: str, issue: dict, prop: dict, contacted: set) -> list:
    contractors = await scored_contractors(host_id)
    slot = {"trade": issue["trade_needed"] or ""}
    bench = rank([c for c in contractors if covers(c, slot, prop)])
    return [public_contractor({**c, "contacted": c["id"] in contacted}) for c in bench]


@api.get("/issues/{issue_id}")
async def get_issue(issue_id: str, host: dict = Depends(current_host)):
    issue = await get_owned("issues", issue_id, host["id"])
    prop = await get_owned("properties", issue["property_id"], host["id"])
    amenity = await db.amenities.find_one({"id": issue.get("amenity_id"), "host_id": host["id"]}, {"_id": 0})
    reqs = await db.requests.find({"issue_id": issue_id, "host_id": host["id"]}, {"_id": 0}).sort("created_at", 1).to_list(100)
    bench = await issue_bench(host["id"], issue, prop, {r["contractor_id"] for r in reqs})
    names = {c["id"]: c for c in bench}
    candidates = [c for c in bench if c["rank"] and not c["contacted"]][:3]
    outcomes = await db.job_outcomes.find({"issue_id": issue_id, "host_id": host["id"]}, {"_id": 0, "undo": 0}).to_list(200)
    outs = sorted(latest_revisions(outcomes), key=lambda o: o["created_at"])
    no_shows = {o["contractor_id"] for o in outs if not o["showed_up"]}
    return {
        "outcomes": [ser({**o, "business_name": names.get(o["contractor_id"], {}).get("business_name")}) for o in outs],
        "issue": ser(issue), "property": ser(prop), "amenity": ser(amenity) if amenity else None,
        "requests": [ser({**r, "no_show": r.get("response") == "booked" and r["contractor_id"] in no_shows,
                          "contractor": {k: names.get(r["contractor_id"], {}).get(k) for k in
                                         ("name", "business_name", "phone")}}) for r in reqs],
        "candidates": candidates, "bench": bench,
        "active_total": len([c for c in bench if c["rank"]]),
    }


@api.post("/issues/{issue_id}/draft")
async def draft_request(issue_id: str, body: DraftIn, host: dict = Depends(current_host)):
    issue = await get_owned("issues", issue_id, host["id"])
    prop = await get_owned("properties", issue["property_id"], host["id"])
    c = await get_owned("contractors", body.contractor_id, host["id"])
    amenity = await db.amenities.find_one({"id": issue.get("amenity_id"), "host_id": host["id"]}, {"_id": 0}) \
        if issue.get("amenity_id") else None
    ctx = {"host_name": host["name"], "contractor_name": c["name"], "business": c["business_name"],
           "property": prop["name"], "address": prop["address"], "trade_needed": issue["trade_needed"],
           "what_broke": amenity["label"] if amenity else issue["trade_needed"],
           "problem": issue.get("ai_diagnosis") or issue.get("host_note") or issue["trade_needed"],
           "urgency": issue.get("urgency"), "guest_arrival": body.guest_arrival_text}
    try:
        return {"message": await draft_message(ctx), "ai": True}
    except AIError:
        return {"message": template_message(ctx), "ai": False}


async def sync_issue_status(issue_id: str):
    reqs = await db.requests.find({"issue_id": issue_id}, {"_id": 0}).to_list(200)
    outs = latest_revisions(await db.job_outcomes.find({"issue_id": issue_id}, {"_id": 0}).to_list(200))
    if any(o["showed_up"] for o in outs):
        st = {"status": "resolved"}
        await db.issues.update_one({"id": issue_id}, {"$set": {**st, "updated_at": now_utc()}})
        return
    no_shows = {o["contractor_id"] for o in outs if not o["showed_up"]}
    booked = [r for r in reqs if r.get("response") == "booked" and r["contractor_id"] not in no_shows]
    if booked:
        latest = max(booked, key=lambda r: r["responded_at"])
        st = {"status": "scheduled", "scheduled_for": latest.get("scheduled_for")}
    else:
        st = {"status": "waiting" if any(not r.get("response") for r in reqs) else "open", "scheduled_for": None}
    await db.issues.update_one({"id": issue_id}, {"$set": {**st, "updated_at": now_utc()}})


@api.post("/requests")
async def log_request(body: RequestIn, host: dict = Depends(current_host)):
    issue = await get_owned("issues", body.issue_id, host["id"])
    prop = await get_owned("properties", issue["property_id"], host["id"])
    c = await get_owned("contractors", body.contractor_id, host["id"])
    if c["status"] != "active" or not covers(c, {"trade": issue["trade_needed"] or ""}, prop):
        raise HTTPException(400, "That contractor doesn't cover this job.")
    if await db.requests.find_one({"issue_id": body.issue_id, "contractor_id": body.contractor_id}):
        raise HTTPException(400, "You've already asked them about this issue.")
    now = now_utc()
    req = ContractorRequest(host_id=host["id"], issue_id=body.issue_id, contractor_id=body.contractor_id,
                            drafted_message=body.message, sent_at=now, channel=body.channel)
    doc = req.model_dump()
    await db.requests.insert_one(doc)
    await sync_issue_status(body.issue_id)
    await db.contractors.update_one({"id": body.contractor_id}, {"$set": {"last_contacted": now}})
    return ser(doc)


@api.delete("/requests/{request_id}")
async def undo_request(request_id: str, host: dict = Depends(current_host)):
    req = await get_owned("requests", request_id, host["id"])
    await db.requests.delete_one({"id": request_id})
    await sync_issue_status(req["issue_id"])
    return {"ok": True}


@api.post("/requests/{request_id}/response")
async def request_response(request_id: str, body: ResponseIn, host: dict = Depends(current_host)):
    req = await get_owned("requests", request_id, host["id"])
    if req.get("response"):
        raise HTTPException(400, "You've already logged a reply for this request.")
    if body.response == "booked" and not body.scheduled_for:
        raise HTTPException(400, "Pick the date they're coming.")
    now = now_utc()
    minutes = None if body.response == "no_answer" else max(1, int((now - req["sent_at"]).total_seconds() // 60))
    await db.requests.update_one({"id": request_id}, {"$set": {
        "response": body.response, "responded_at": now, "response_minutes": minutes,
        "scheduled_for": body.scheduled_for if body.response == "booked" else None}})
    await sync_issue_status(req["issue_id"])
    await db.contractors.update_one({"id": req["contractor_id"]}, {"$set": {"last_contacted": now}})
    return {"ok": True}


@api.post("/requests/{request_id}/response/undo")
async def undo_response(request_id: str, host: dict = Depends(current_host)):
    req = await get_owned("requests", request_id, host["id"])
    if not req.get("response"):
        raise HTTPException(400, "Nothing to undo.")
    await db.requests.update_one({"id": request_id}, {"$set": {"response": None, "responded_at": None,
                                                               "response_minutes": None, "scheduled_for": None}})
    await sync_issue_status(req["issue_id"])
    return {"ok": True}


@api.get("/")
async def root():
    return {"app": "Bullpup", "ok": True}


app.include_router(api)

import bench_routes  # noqa: E402
import outcome_routes  # noqa: E402

app.include_router(bench_routes.router)
app.include_router(outcome_routes.router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ["FRONTEND_URL"].split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    for coll in DOMAIN:
        await db[coll].create_index([("host_id", 1), ("demo", 1)])
        await db[coll].create_index("id", unique=True)
    demo_email = os.environ["DEMO_HOST_EMAIL"].lower()
    demo_pw = os.environ["DEMO_HOST_PASSWORD"]
    existing = await db.users.find_one({"email": demo_email})
    if not existing:
        await db.users.insert_one(Host(name="Demo Host", email=demo_email, password_hash=hash_pw(demo_pw)).model_dump())
    elif not check_pw(demo_pw, existing["password_hash"]):
        await db.users.update_one({"email": demo_email}, {"$set": {"password_hash": hash_pw(demo_pw)}})


@app.on_event("shutdown")
async def shutdown():
    client.close()
