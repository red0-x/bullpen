from datetime import datetime, timedelta

WEIGHTS = {"show": 0.40, "on_time": 0.20, "rating": 0.25, "speed": 0.15}
NEW_SCORE = 60
RECENT_DAYS = 90
NEUTRAL_SPEED = 0.6


def speed_component(avg_minutes):
    if avg_minutes is None:
        return NEUTRAL_SPEED
    return max(0.0, min(1.0, 1 - (avg_minutes - 15) / (24 * 60 - 15)))


def _fmt_day(d: datetime) -> str:
    return d.strftime("%b %-d")


def latest_revisions(outcomes: list) -> list:
    """Edited outcomes are new records with revision_of; only the newest per original counts."""
    latest = {}
    for o in outcomes:
        key = o.get("revision_of") or o["id"]
        if key not in latest or o["created_at"] > latest[key]["created_at"]:
            latest[key] = o
    return list(latest.values())


def watch_adjustments(signals: list, now: datetime) -> list:
    """signals: watch_signals for one contractor. Returns [(delta, reason)]."""
    by_type = {}
    for s in sorted(signals, key=lambda s: s["date"]):
        by_type.setdefault(s["signal_type"], []).append(s)
    out = []
    ratings = by_type.get("public_rating", [])
    if len(ratings) >= 2 and ratings[-2]["date"] >= now - timedelta(days=31):
        new, month_ago = float(ratings[-1]["value"]), float(ratings[-2]["value"])
        if month_ago - new >= 0.3:
            out.append((-min(15, round((month_ago - new) * 12)), f"Rating dropped from {month_ago:.1f} to {new:.1f} this month"))
    resp = by_type.get("response_time", [])
    if resp and float(resp[-1]["value"]) >= 240:
        out.append((-4, f"Slow to reply lately (about {round(float(resp[-1]['value']) / 60)} h)"))
    lic = by_type.get("license_status", [])
    if lic and lic[-1]["value"] != "active":
        out.append((-10, f"License {lic[-1]['value']}"))
    return out


def score_contractor(c: dict, outcomes: list, requests: list, now: datetime, adjust: list | None = None) -> dict:
    base = _score_base(c, latest_revisions(outcomes), requests, now)
    if base["ranked"] and adjust:
        base["score"] = max(0, min(100, base["score"] + sum(d for d, _ in adjust)))
        base["reason"] = f"{base['reason']} · {adjust[0][1]}"
        base["watch"] = [r for _, r in adjust]
    return base


def _score_base(c: dict, outcomes: list, requests: list, now: datetime) -> dict:
    status = c.get("status", "active")
    if status != "active":
        label = "Unreachable" if status == "unreachable" else "Out of business"
        return {"score": None, "ranked": False, "is_new": False, "jobs": len(outcomes),
                "reason": f"{label}, not ranked", "last_success": None}
    if not outcomes:
        return {"score": NEW_SCORE, "ranked": True, "is_new": True, "jobs": 0,
                "reason": "New, no history yet", "last_success": None}

    cutoff = now - timedelta(days=RECENT_DAYS)
    total_w = show_w = ontime_w = rating_w = rating_sum = 0.0
    showed, ratings, last_success, no_shows = 0, [], None, []
    for o in outcomes:
        w = 2 if o["date"] >= cutoff else 1
        total_w += w
        if o["showed_up"]:
            showed += 1
            show_w += w
            if o["on_time"]:
                ontime_w += w
            if last_success is None or o["date"] > last_success:
                last_success = o["date"]
        else:
            no_shows.append(o["date"])
        if o.get("rating"):
            rating_w += w
            rating_sum += w * o["rating"]
            ratings.append(o["rating"])

    show = show_w / total_w
    on_time = ontime_w / show_w if show_w else 0.0
    rating = ((rating_sum / rating_w) - 1) / 4 if rating_w else 0.5
    times = [r["response_minutes"] for r in requests if r.get("response_minutes") is not None]
    speed = speed_component(sum(times) / len(times) if times else None)

    score = round(100 * (WEIGHTS["show"] * show + WEIGHTS["on_time"] * on_time
                         + WEIGHTS["rating"] * rating + WEIGHTS["speed"] * speed))

    reason = f"Showed up {showed} of {len(outcomes)}"
    if ratings:
        reason += f", {sum(ratings) / len(ratings):.1f} stars"
    recent_ns = [d for d in no_shows if d >= now - timedelta(days=30)]
    if recent_ns:
        reason += f", no-show on {_fmt_day(max(recent_ns))}"
    return {"score": score, "ranked": True, "is_new": False, "jobs": len(outcomes),
            "reason": reason, "last_success": last_success}


def rank(scored: list) -> list:
    """scored: contractor dicts carrying score fields. Ranked first, then greyed out."""
    active = [c for c in scored if c["ranked"]]
    inactive = [c for c in scored if not c["ranked"]]
    active.sort(key=lambda c: (
        not c.get("pinned", False),
        -c["score"],
        -(c["last_success"].timestamp() if c["last_success"] else 0),
        c["name"].lower(),
    ))
    for i, c in enumerate(active, start=1):
        c["rank"] = i
    for c in inactive:
        c["rank"] = None
    return active + sorted(inactive, key=lambda c: c["name"].lower())


def area_matches(areas, city: str) -> bool:
    city = city.lower().strip()
    return any(a and (a in city or city in a) for a in (x.lower().strip() for x in areas))


def covers(contractor: dict, amenity: dict, prop: dict) -> bool:
    trades = {t.lower() for t in contractor.get("trades", [])}
    return amenity["trade"].lower() in trades and area_matches(contractor.get("service_area", []), prop["city"])
