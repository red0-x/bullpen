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

from scoring import score_contractor, rank, covers
from seed import build_demo

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


class Issue(DocBase):
    property_id: str
    amenity_id: Optional[str] = None
    photo_url: Optional[str] = None
    host_note: str = ""
    ai_diagnosis: Optional[str] = None
    trade_needed: Optional[str] = None
    urgency: Optional[Literal["today", "this_week", "can_wait"]] = None
    guest_arrival: Optional[datetime] = None
    status: Literal["open", "waiting", "scheduled", "resolved"] = "open"
    updated_at: datetime = Field(default_factory=now_utc)


class ContractorRequest(DocBase):
    issue_id: str
    contractor_id: str
    drafted_message: str
    sent_at: Optional[datetime] = None
    response: Optional[Literal["no_answer", "declined", "booked"]] = None
    responded_at: Optional[datetime] = None
    response_minutes: Optional[int] = None


class JobOutcome(DocBase):
    contractor_id: str
    issue_id: str
    request_id: Optional[str] = None
    showed_up: bool
    on_time: bool
    rating: int = Field(ge=1, le=5)
    note: str = ""
    date: datetime


class WatchSignal(DocBase):
    contractor_id: str
    signal_type: str
    value: str
    date: datetime
    alert: Optional[str] = None


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
    by_c_out, by_c_req = {}, {}
    for o in outcomes:
        by_c_out.setdefault(o["contractor_id"], []).append(o)
    for r in reqs:
        by_c_req.setdefault(r["contractor_id"], []).append(r)
    return [{**c, **score_contractor(c, by_c_out.get(c["id"], []), by_c_req.get(c["id"], []), now)}
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


@api.get("/")
async def root():
    return {"app": "Bullpup", "ok": True}


app.include_router(api)
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
