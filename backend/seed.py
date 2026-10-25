import random
import uuid
from datetime import datetime, timedelta, timezone

AMENITY_TRADES = {
    "pool": "Pool service",
    "hot_tub": "Hot tub & spa",
    "plumbing": "Plumbing",
    "kitchen_appliances": "Appliance repair",
    "hvac": "HVAC",
    "cleaning": "Cleaning",
}
AMENITY_LABELS = {
    "pool": "Pool", "hot_tub": "Hot tub", "plumbing": "Plumbing",
    "kitchen_appliances": "Kitchen appliances", "hvac": "HVAC", "cleaning": "Cleaning",
}

TAHOE, JT, OAK = "South Lake Tahoe", "Joshua Tree", "Oakland"

PROPERTIES = [
    {"name": "Tahoe Cabin", "city": TAHOE, "address": "1 Pinecone Way, South Lake Tahoe, CA (sample)",
     "amenities": [("hot_tub", None), ("plumbing", None), ("kitchen_appliances", None), ("hvac", None),
                   ("cleaning", None)]},
    {"name": "Joshua Tree A-Frame", "city": JT, "address": "2 Yucca Mesa Rd, Joshua Tree, CA (sample)",
     "amenities": [("pool", None), ("hot_tub", None), ("plumbing", None), ("hvac", None), ("cleaning", None)]},
    {"name": "Oakland Duplex", "city": OAK, "address": "3 Lakeshore Ave, Oakland, CA (sample)",
     "amenities": [("plumbing", None), ("kitchen_appliances", None), ("hvac", None), ("cleaning", None),
                   ("custom", ("EV charger", "Electrical"))]},
]

# name, business, trades, areas, profile (jobs, show_p, ontime_p, rating_mu, resp_min), extras
CONTRACTORS = [
    ("Dave Ortiz", "Dave's Pools", ["Pool service"], [JT, "Yucca Valley"], "dave", {}),
    ("Rosa Lin", "Desert Blue Pool Co", ["Pool service"], [JT], (5, 1.0, 0.9, 4.6, 40), {}),
    ("Kai Brennan", "Sierra Spa Service", ["Hot tub & spa"], [TAHOE], (6, 1.0, 0.85, 4.7, 30), {}),
    ("Marta Reyes", "High Desert Hot Tubs", ["Hot tub & spa", "Plumbing"], [JT], (4, 1.0, 0.75, 4.4, 90), {}),
    ("Theo Banks", "Yucca Spa Care", ["Hot tub & spa", "Cleaning"], [JT], None, {}),
    ("Mike Duran", "Mike's Plumbing", ["Plumbing", "Appliance repair"], [OAK], (7, 1.0, 1.0, 4.8, 20), {}),
    ("Gus Patel", "Bay Flow Plumbing", ["Plumbing"], [OAK], "unreliable", {}),
    ("Hana Moore", "Alpine Plumbing", ["Plumbing"], [TAHOE], (5, 1.0, 0.8, 4.5, 60), {"pinned": True}),
    ("Jo Whitaker", "Tahoe Pipe & Drain", ["Plumbing", "Appliance repair"], [TAHOE], (3, 1.0, 0.67, 4.0, 180), {}),
    ("Luis Romero", "Rock & Pipe Plumbing", ["Plumbing", "HVAC"], [JT], (4, 1.0, 1.0, 4.6, 45), {}),
    ("Priya Shah", "Lakeside Appliance", ["Appliance repair"], [TAHOE], (3, 1.0, 1.0, 4.3, 120), {}),
    ("Ben Cho", "Oak Town Appliance", ["Appliance repair", "HVAC"], [OAK], (4, 1.0, 0.75, 4.2, 75), {}),
    ("Sam Okafor", "East Bay Appliance", ["Appliance repair"], [OAK], (2, 1.0, 1.0, 4.0, 200),
     {"status": "unreachable"}),
    ("Nora Hale", "Summit Heating & Air", ["HVAC"], [TAHOE], (4, 1.0, 0.75, 4.5, 50), {}),
    ("Ray Castillo", "Cool Desert HVAC", ["HVAC"], [JT], (5, 1.0, 0.8, 4.4, 35), {}),
    ("Dee Washington", "Bay Air Comfort", ["HVAC"], [OAK, TAHOE], (3, 1.0, 1.0, 4.7, 25), {}),
    ("Ivy Park", "Sparkle Turnover Co", ["Cleaning"], [TAHOE, JT, OAK], (8, 1.0, 0.88, 4.6, 15), {}),
    ("Ana Flores", "Fresh Nest Cleaning", ["Cleaning"], [OAK, TAHOE], (8, 1.0, 1.0, 4.9, 10), {}),
]

NOTES = {
    "Pool service": ["Pool water cloudy before check-in", "Pool pump making a grinding noise"],
    "Hot tub & spa": ["Hot tub not heating", "Hot tub jets weak, filter alarm on"],
    "Plumbing": ["Kitchen sink draining slowly", "Toilet running nonstop", "Shower drip won't stop"],
    "Appliance repair": ["Dishwasher not draining", "Fridge not cooling"],
    "HVAC": ["AC blowing warm air", "Furnace won't kick on"],
    "Cleaning": ["Turnover clean between guests", "Deep clean after a long stay"],
}


def _id():
    return str(uuid.uuid4())


def _dave_date(now):
    d = datetime(now.year, 7, 12, 15, 0, tzinfo=timezone.utc)
    return d if (now - d).days >= 90 else datetime(now.year - 1, 7, 12, 15, 0, tzinfo=timezone.utc)


def _job_plan(profile, rng, now):
    """Return list of (date, showed, on_time, rating, response_minutes)."""
    if profile == "unreliable":
        return [
            (now - timedelta(days=52), True, True, 4, 60),
            (now - timedelta(days=38), True, False, 3, 240),
            (now - timedelta(days=12), False, False, 1, 300),
            (now - timedelta(days=4), False, False, 1, 420),
        ]
    if profile == "dave":
        last = _dave_date(now)
        return [(last - timedelta(days=24), True, True, 5, 30), (last, True, True, 4, 45)]
    jobs, show_p, ontime_p, rating_mu, resp = profile
    plan = []
    for i in range(jobs):
        days = int(55 - i * (50 / max(jobs, 1))) - rng.randint(0, 3)
        ontime = rng.random() < ontime_p
        rating = max(1, min(5, round(rating_mu + rng.uniform(-0.6, 0.6))))
        plan.append((now - timedelta(days=max(days, 2), hours=rng.randint(0, 8)), True, ontime, rating,
                     max(5, int(resp * rng.uniform(0.6, 1.4)))))
    return plan


def build_demo(host_id: str, host_name: str, now: datetime) -> dict:
    rng = random.Random(42)
    base = {"host_id": host_id, "demo": True}
    props, amenities = [], []
    for n, p in enumerate(PROPERTIES):
        pid = _id()
        props.append({**base, "id": pid, "name": p["name"], "city": p["city"], "address": p["address"],
                      "created_at": now + timedelta(milliseconds=n)})  # distinct, so the listed order is stable
        for kind, custom in p["amenities"]:
            label, trade = custom if custom else (AMENITY_LABELS[kind], AMENITY_TRADES[kind])
            amenities.append({**base, "id": _id(), "property_id": pid, "type": kind, "label": label,
                              "trade": trade, "maintenance_schedule": None, "created_at": now})

    contractors, issues, requests, outcomes = [], [], [], []
    city_of = {p["id"]: p["city"] for p in props}
    for i, (name, biz, trades, areas, profile, extra) in enumerate(CONTRACTORS):
        cid = _id()
        slug = biz.lower().replace("'", "").replace("&", "and").replace(" ", "")
        c = {**base, "id": cid, "name": name, "business_name": biz, "phone": f"(555) 01{i:02d}-{1200 + i * 7}",
             "email": f"hello@{slug}.example.com", "trades": trades, "service_area": areas,
             "notes": "Sample contractor for demo", "status": extra.get("status", "active"),
             "last_contacted": None, "pinned": extra.get("pinned", False), "created_at": now}
        if profile:
            slots = [a for a in amenities if a["trade"] in trades and city_of[a["property_id"]] in areas]
            for date, showed, on_time, rating, resp in _job_plan(profile, rng, now):
                slot = rng.choice(slots)
                iid, rid = _id(), _id()
                sent = date - timedelta(hours=rng.randint(4, 30))
                issues.append({**base, "id": iid, "property_id": slot["property_id"], "amenity_id": slot["id"],
                               "photo_url": None, "host_note": rng.choice(NOTES[trades[0]]),
                               "ai_diagnosis": None, "trade_needed": trades[0], "urgency": "this_week",
                               "guest_arrival": None, "status": "resolved" if showed else "open",
                               "created_at": sent - timedelta(hours=1), "updated_at": date})
                requests.append({**base, "id": rid, "issue_id": iid, "contractor_id": cid,
                                 "drafted_message": f"Hi {name.split()[0]}, it's {host_name}. Could you help with: "
                                                    f"{issues[-1]['host_note'].lower()}?",
                                 "sent_at": sent, "response": "booked",
                                 "responded_at": sent + timedelta(minutes=resp), "response_minutes": resp,
                                 "created_at": sent})
                outcomes.append({**base, "id": _id(), "contractor_id": cid, "issue_id": iid,
                                 "request_id": rid, "showed_up": showed, "on_time": on_time if showed else False,
                                 "rating": rating, "note": "" if showed else "Didn't show, no call",
                                 "date": date, "created_at": date})
                c["last_contacted"] = max(filter(None, [c["last_contacted"], sent]))
        contractors.append(c)
    # Bay Flow no-show issue remains open; mark older ones resolved
    open_ids = [o["issue_id"] for o in outcomes if not o["showed_up"]]
    for iss in issues:
        if iss["id"] in open_ids[:-1]:
            iss["status"] = "resolved"
    signals = []
    for i, c in enumerate(contractors):
        reading = {"response_time": str(20 + (i * 37) % 160), "public_rating": f"{4.3 + (i % 6) / 10:.1f}",
                   "business_open": "yes", "phone_working": "yes" if c["status"] == "active" else "no",
                   "license_status": "active"}
        for t, v in reading.items():
            signals.append({**base, "id": _id(), "contractor_id": c["id"], "signal_type": t, "value": v,
                            "date": now - timedelta(days=28), "alert": None, "created_at": now})
        if c["business_name"] == "High Desert Hot Tubs":
            signals.append({**base, "id": _id(), "contractor_id": c["id"], "signal_type": "public_rating",
                            "value": "4.7", "date": now - timedelta(days=24), "alert": None, "created_at": now})
            signals.append({**base, "id": _id(), "contractor_id": c["id"], "signal_type": "public_rating",
                            "value": "3.9", "date": now - timedelta(days=2),
                            "alert": "Rating dropped from 4.7 to 3.9 this month", "created_at": now})
    return {"properties": props, "amenities": amenities, "contractors": contractors, "issues": issues,
            "requests": requests, "job_outcomes": outcomes, "watch_signals": signals}
