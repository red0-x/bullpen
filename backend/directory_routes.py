"""Sample San Francisco contractor directory (made-up businesses) and the voice assistant endpoint."""
import json
import math
import random
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ai import AIError, _json, _run
from server import TRADES, current_host, db, host_catalog

router = APIRouter(prefix="/api")
SF = (37.7749, -122.4194)
PHOTOS = {"Plumbing": [0, 1], "HVAC": [2, 3], "Pool service": [4, 5], "Hot tub & spa": [6, 7],
          "Appliance repair": [8, 9], "Cleaning": [10, 11], "Electrical": [12, 13]}
HOODS = [("Mission", 37.7599, -122.4148), ("Sunset", 37.7531, -122.4950), ("SoMa", 37.7785, -122.4056),
         ("Richmond", 37.7802, -122.4826), ("Noe Valley", 37.7502, -122.4337), ("Bayview", 37.7299, -122.3920),
         ("Marina", 37.8037, -122.4368), ("Daly City", 37.6879, -122.4702)]
NAMES = {
    "Plumbing": ["Golden Gate Pipeworks", "Mission Drain & Rooter", "Fog City Plumbing", "Twin Peaks Plumbing Co"],
    "HVAC": ["Bay Breeze Heating & Air", "Sunset Climate Pros", "Presidio HVAC", "Muni Heat & Cool"],
    "Pool service": ["Crystal Bay Pools", "Sutro Pool Care", "Blue Fog Pool Co", "Lands End Pool Service"],
    "Hot tub & spa": ["Steam & Soak Spa Repair", "Bay Spa Doctors", "Hot Tub Heroes SF", "Ocean Beach Spa Care"],
    "Appliance repair": ["FixIt Fast Appliance", "Castro Appliance Repair", "SF Fridge & Range", "Dogpatch Appliance"],
    "Cleaning": ["Turnover Tidy SF", "Fresh Fog Cleaning", "Golden Hour Housekeeping", "Hayes Valley Clean Co"],
    "Electrical": ["Spark Bay Electric", "Embarcadero Electrical", "Bright Line Electric", "Cable Car Electric"],
}
REVIEWS = [
    (5, "Came the same day and fixed it before our guests checked in. Clear price up front."),
    (5, "Friendly, tidy, and explained everything. Will call again."),
    (4, "Good work, arrived about 30 minutes late but kept me posted."),
    (3, "Fixed it, but it took two visits to get the part."),
    (5, "Answered on a Sunday night. Lifesaver for a rental host."),
    (4, "Fair price and solid work. Booking took a couple of days."),
]
AUTHORS = ["Priya K.", "Marcus T.", "Elena R.", "Sam W.", "Jordan L.", "Aiko M.", "Diego F.", "Hannah B."]


def _build():
    rng = random.Random(7)
    out = []
    for trade, names in NAMES.items():
        for i, name in enumerate(names):
            hood, lat, lng = HOODS[(i * 3 + len(trade)) % len(HOODS)]
            rating = round(rng.uniform(3.9, 4.95), 1)
            revs = [REVIEWS[(i + k) % len(REVIEWS)] for k in range(4)]
            out.append({
                "id": f"sf-{trade[:3].lower()}-{i}", "business_name": name, "trade": trade, "neighborhood": hood,
                "lat": lat + rng.uniform(-0.01, 0.01), "lng": lng + rng.uniform(-0.01, 0.01),
                "rating": rating, "review_count": rng.randint(18, 420), "years_in_business": rng.randint(2, 30),
                "licensed": rng.random() > 0.15, "insured": rng.random() > 0.1,
                "avg_response_minutes": rng.choice([12, 20, 35, 45, 60, 90, 180]),
                "jobs_completed": rng.randint(80, 2400), "emergency_service": rng.random() > 0.4,
                "phone": f"(415) 555-{100 + len(out):04d}", "email": f"hello@{name.lower().replace(' ', '').replace('&', '')}.example.com",
                "address": f"{100 + i * 37} Sample St, {hood}, San Francisco, CA",
                "photos": [f"/directory/p{n}.jpg" for n in PHOTOS[trade]],
                "reviews": [{"author": AUTHORS[(i + k * 3) % len(AUTHORS)], "rating": r, "text": t,
                             "when": f"{k + 1} {'week' if k == 0 else 'weeks'} ago"} for k, (r, t) in enumerate(revs)],
            })
    return out


DIRECTORY = _build()


def miles(a, b):
    dlat, dlng = math.radians(b[0] - a[0]), math.radians(b[1] - a[1])
    h = math.sin(dlat / 2) ** 2 + math.cos(math.radians(a[0])) * math.cos(math.radians(b[0])) * math.sin(dlng / 2) ** 2
    return 3958.8 * 2 * math.asin(math.sqrt(h))


def rank_directory(trade: str, origin) -> list:
    """Bayesian rating (prior 4.2 over 25 reviews) minus distance and slow replies. Calculated in code."""
    out = []
    for b in DIRECTORY:
        if b["trade"] != trade:
            continue
        dist = miles(origin, (b["lat"], b["lng"]))
        bayes = (b["rating"] * b["review_count"] + 4.2 * 25) / (b["review_count"] + 25)
        score = round(max(0, min(100, (bayes - 3) / 2 * 100 - dist * 2 - (5 if b["avg_response_minutes"] > 90 else 0)
                                     + (3 if b["licensed"] else -15))))
        reason = f"{b['rating']} stars from {b['review_count']} reviews · {dist:.1f} mi away"
        out.append({**b, "distance_miles": round(dist, 1), "score": score, "reason": reason})
    out.sort(key=lambda b: (-b["score"], b["distance_miles"]))
    for i, b in enumerate(out, 1):
        b["rank"] = i
    return out


@router.get("/directory")
async def directory(trade: str, lat: Optional[float] = None, lng: Optional[float] = None,
                    host: dict = Depends(current_host)):
    origin = (lat, lng) if lat is not None and lng is not None and miles(SF, (lat, lng)) < 60 else SF
    used = trade if trade in TRADES else "Plumbing"
    return {"sample_data": True, "area": "San Francisco", "trade": used, "results": rank_directory(used, origin)}


class VoiceIn(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    history: List[dict] = Field(default_factory=list, max_length=12)
    page: str = Field("", max_length=200)


VOICE_SYSTEM = (
    "You are Bullpup, a friendly voice assistant inside a web app for vacation rental hosts. You help with things "
    "that broke at their rentals and finding contractors. Replies are spoken aloud: 1-3 short sentences, no lists, "
    "no markdown. Reply with ONLY JSON: {\"reply\": str, \"action\": one of \"camera\" (open the camera to photo the "
    "problem), \"fixit\", \"bench\", \"properties\", \"issue\" (needs issue_id), \"none\", \"issue_id\": str|null}. "
    "Suggest the camera when they describe something broken. Never claim to send messages or book anyone."
)


@router.post("/voice/ask")
async def voice_ask(body: VoiceIn, host: dict = Depends(current_host)):
    catalog = await host_catalog(host["id"])
    issues = await db.issues.find({"host_id": host["id"], "status": {"$in": ["open", "waiting", "scheduled"]}},
                                  {"_id": 0, "id": 1, "trade_needed": 1, "status": 1, "ai_diagnosis": 1,
                                   "host_note": 1}).to_list(20)
    ctx = {"host": host["name"].split(" ")[0], "page": body.page,
           "properties": [{"name": p["name"], "city": p["city"], "amenities": [a["label"] for a in p["amenities"]]}
                          for p in catalog],
           "open_issues": [{"id": i["id"], "trade": i["trade_needed"], "status": i["status"],
                            "about": (i.get("ai_diagnosis") or i.get("host_note") or "")[:120]} for i in issues]}
    convo = "\n".join(f"{m.get('role', 'user')}: {str(m.get('text', ''))[:400]}" for m in body.history[-8:])
    try:
        data = _json(await _run(VOICE_SYSTEM, f"App context: {json.dumps(ctx)}\nConversation so far:\n{convo}\n"
                                              f"user: {body.message}"))
    except AIError:
        return {"reply": "Sorry, I couldn't think that through right now. You can tap Something broke and snap a photo.",
                "action": "none", "ok": False}
    action = data.get("action") if data.get("action") in ("camera", "fixit", "bench", "properties", "issue", "none") else "none"
    issue_id = data.get("issue_id") if action == "issue" and data.get("issue_id") in {i["id"] for i in issues} else None
    return {"reply": str(data.get("reply") or "Okay.")[:600], "action": "none" if action == "issue" and not issue_id else action,
            "issue_id": issue_id, "ok": True}
