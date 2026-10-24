# Bullpup Layer 3 regression: "Something broke" diagnose (AI), issues, candidates, requests, responses, isolation
import base64
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
DEMO = ("host@bullpup.example.com", "bullpup123")
HOTTUB_JPG = "/tmp/hottub.jpg"
PIPE_JPG = "/tmp/pipe.jpg"


def _db():
    from dotenv import dotenv_values
    env = dotenv_values("/app/backend/.env")
    return MongoClient(env["MONGO_URL"])[env["DB_NAME"]]


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    r = sess.post(f"{API}/auth/login", json={"email": DEMO[0], "password": DEMO[1]})
    if r.status_code != 200:
        pytest.skip(f"demo login failed {r.status_code}")
    sess.created_ids = []
    yield sess
    # cleanup: only the issues this worker created (xdist-safe)
    for iid in sess.created_ids:
        sess.delete(f"{API}/issues/{iid}")


@pytest.fixture(scope="module")
def cat(s):
    props = s.get(f"{API}/properties").json()
    by = {p["name"]: p for p in props}
    def am(pname, label):
        return next(a for a in by[pname]["amenities"] if a["label"] == label)
    return by, am


def _mk(s, prop, amen, trade, note, photo=None, urgency="today"):
    r = s.post(f"{API}/issues", json={"property_id": prop["id"], "amenity_id": amen["id"] if amen else None,
                                      "trade_needed": trade, "urgency": urgency, "host_note": note,
                                      "ai_diagnosis": None, "photo_base64": photo})
    assert r.status_code == 200, r.text
    s.created_ids.append(r.json()["id"])
    return r.json()


# --- Diagnose (AI) ---
class TestDiagnose:
    def test_requires_input(self, s):
        r = s.post(f"{API}/issues/diagnose", json={"note": "  "})
        assert r.status_code == 400

    def test_text_tahoe_hottub(self, s, cat):
        by, am = cat
        r = s.post(f"{API}/issues/diagnose", json={"note": "Hot tub at Tahoe cabin not heating, guests arrive Friday 4pm"}, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["ok"], d
        g = d["draft"]
        print(g)
        assert g["property_id"] == by["Tahoe Cabin"]["id"]
        assert g["amenity_id"] == am("Tahoe Cabin", "Hot tub")["id"]
        assert g["trade"] == "Hot tub & spa"
        assert g["urgency"] in ("today", "this_week")

    def test_unclear(self, s):
        r = s.post(f"{API}/issues/diagnose", json={"note": "hmm"}, timeout=60)
        d = r.json()
        print(d)
        assert r.status_code == 200
        assert (not d["ok"]) or d["draft"].get("can_tell") is False or not d["draft"].get("trade")

    def test_photo(self, s):
        # photo only (bath faucet), no note: vision must drive the guess
        b64 = base64.b64encode(open(PIPE_JPG, "rb").read()).decode()
        r = s.post(f"{API}/issues/diagnose", json={"photo_base64": "data:image/jpeg;base64," + b64, "note": ""}, timeout=60)
        d = r.json()
        print(d)
        assert r.status_code == 200 and d["ok"], d
        assert d["draft"]["trade"] in ("Plumbing", None)

    def test_unauth(self):
        r = requests.post(f"{API}/issues/diagnose", json={"note": "x"})
        assert r.status_code == 401


# --- Issues + candidates ---
class TestIssues:
    def test_validation(self, s, cat):
        by, am = cat
        r = s.post(f"{API}/issues", json={"property_id": by["Oakland Duplex"]["id"], "amenity_id": am("Tahoe Cabin", "Hot tub")["id"],
                                          "trade_needed": "Plumbing", "urgency": "today"})
        assert r.status_code == 400
        r = s.post(f"{API}/issues", json={"property_id": by["Oakland Duplex"]["id"], "trade_needed": "Juggling", "urgency": "today"})
        assert r.status_code == 400
        r = s.post(f"{API}/issues", json={"property_id": by["Oakland Duplex"]["id"], "trade_needed": "Plumbing", "urgency": "asap"})
        assert r.status_code == 422

    def test_tahoe_hottub_with_photo(self, s, cat):
        by, am = cat
        b64 = base64.b64encode(open(HOTTUB_JPG, "rb").read()).decode()
        i = _mk(s, by["Tahoe Cabin"], am("Tahoe Cabin", "Hot tub"), "Hot tub & spa", "TEST_ hot tub cold", photo=b64)
        assert i["status"] == "open" and i["photo_url"]
        ph = s.get(f"{BASE_URL}{i['photo_url']}")
        assert ph.status_code == 200 and ph.headers["content-type"] == "image/jpeg" and ph.content[:2] == b"\xff\xd8"
        g = s.get(f"{API}/issues/{i['id']}").json()
        assert [c["business_name"] for c in g["candidates"]] == ["Sierra Spa Service"]
        assert g["active_total"] == 1
        # open-for and add
        of = s.get(f"{API}/issues/open-for", params={"amenity_id": i["amenity_id"]}).json()
        assert of["issue"]["id"] == i["id"]
        r = s.post(f"{API}/issues/{i['id']}/add", json={"note": "TEST_ also leaking"})
        assert r.status_code == 200
        g = s.get(f"{API}/issues/{i['id']}").json()
        assert g["issue"]["updates"][-1]["note"] == "TEST_ also leaking"
        assert any(x["id"] == i["id"] for x in s.get(f"{API}/issues").json())

    def test_bad_photo(self, s, cat):
        by, am = cat
        r = s.post(f"{API}/issues", json={"property_id": by["Oakland Duplex"]["id"], "trade_needed": "Plumbing",
                                          "urgency": "today", "host_note": "TEST_ bad", "photo_base64": "%%%notb64"})
        assert r.status_code == 400

    def test_oakland_ev_none(self, s, cat):
        by, am = cat
        i = _mk(s, by["Oakland Duplex"], am("Oakland Duplex", "EV charger"), "Electrical", "TEST_ ev dead")
        g = s.get(f"{API}/issues/{i['id']}").json()
        assert g["active_total"] == 0 and g["candidates"] == []

    def test_oakland_plumbing(self, s, cat):
        by, am = cat
        i = _mk(s, by["Oakland Duplex"], am("Oakland Duplex", "Plumbing"), "Plumbing", "TEST_ sink leak")
        g = s.get(f"{API}/issues/{i['id']}").json()
        names = [c["business_name"] for c in g["candidates"]]
        print(names, [(c["business_name"], c["rank"], c.get("status")) for c in g["bench"]])
        assert names[0] == "Mike's Plumbing"
        assert all(c["rank"] for c in g["candidates"])


# --- Requests / responses ---
class TestRequests:
    @pytest.fixture(scope="class")
    def issue(self, s, cat):
        by, am = cat
        return _mk(s, by["Oakland Duplex"], am("Oakland Duplex", "Plumbing"), "Plumbing", "TEST_ toilet running")

    def _first(self, s, iid):
        r = s.get(f"{API}/issues/{iid}")
        assert r.status_code == 200, f"{r.status_code} {r.text[:200]}"
        return r.json()

    def test_draft(self, s, issue):
        c = self._first(s, issue["id"])["candidates"][0]
        r = s.post(f"{API}/issues/{issue['id']}/draft", json={"contractor_id": c["id"]}, timeout=60)
        d = r.json()
        print(d)
        assert r.status_code == 200 and len(d["message"]) > 20 and isinstance(d["ai"], bool)

    def test_request_undo(self, s, issue):
        c = self._first(s, issue["id"])["candidates"][0]
        r = s.post(f"{API}/requests", json={"issue_id": issue["id"], "contractor_id": c["id"], "message": "hi", "channel": "copy"})
        assert r.status_code == 200
        rid = r.json()["id"]
        g = self._first(s, issue["id"])
        assert g["issue"]["status"] == "waiting"
        assert c["id"] not in [x["id"] for x in g["candidates"]]
        assert s.delete(f"{API}/requests/{rid}").status_code == 200
        g = self._first(s, issue["id"])
        assert g["issue"]["status"] == "open" and g["requests"] == []
        assert g["candidates"][0]["id"] == c["id"]

    def test_no_answer_declined_booked(self, s, issue):
        iid = issue["id"]
        c1 = self._first(s, iid)["candidates"][0]
        r1 = s.post(f"{API}/requests", json={"issue_id": iid, "contractor_id": c1["id"], "message": "hi", "channel": "copy"}).json()
        assert s.post(f"{API}/requests/{r1['id']}/response", json={"response": "no_answer"}).status_code == 200
        g = self._first(s, iid)
        assert g["issue"]["status"] == "open"
        assert c1["id"] not in [x["id"] for x in g["candidates"]]
        assert g["requests"][0]["response"] == "no_answer" and g["requests"][0]["response_minutes"] is None
        # undo response
        assert s.post(f"{API}/requests/{r1['id']}/response/undo").status_code == 200
        g = self._first(s, iid)
        assert g["issue"]["status"] == "waiting" and g["requests"][0]["response"] is None
        assert s.post(f"{API}/requests/{r1['id']}/response", json={"response": "declined"}).status_code == 200
        c2 = self._first(s, iid)["candidates"][0]
        assert c2["id"] != c1["id"]
        r2 = s.post(f"{API}/requests", json={"issue_id": iid, "contractor_id": c2["id"], "message": "hi", "channel": "messages"}).json()
        assert s.post(f"{API}/requests/{r2['id']}/response", json={"response": "booked"}).status_code == 400
        when = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        assert s.post(f"{API}/requests/{r2['id']}/response", json={"response": "booked", "scheduled_for": when}).status_code == 200
        g = self._first(s, iid)
        assert g["issue"]["status"] == "scheduled" and g["issue"]["scheduled_for"]
        assert s.post(f"{API}/requests/{r2['id']}/response/undo").status_code == 200
        g = self._first(s, iid)
        assert g["issue"]["status"] == "waiting" and not g["issue"].get("scheduled_for")


# --- Isolation ---
class TestIsolation:
    def test_other_host_404(self, s, cat):
        by, am = cat
        i = _mk(s, by["Tahoe Cabin"], am("Tahoe Cabin", "HVAC"), "HVAC", "TEST_ iso",
                photo=base64.b64encode(open(HOTTUB_JPG, "rb").read()).decode())
        o = requests.Session()
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        u = o.post(f"{API}/auth/register", json={"name": "TEST Other", "email": email, "password": "testpass123"}).json()
        try:
            assert o.get(f"{API}/issues/{i['id']}").status_code == 404
            assert o.get(f"{BASE_URL}{i['photo_url']}").status_code == 404
            assert o.delete(f"{API}/issues/{i['id']}").status_code == 404
            assert o.post(f"{API}/issues/{i['id']}/add", json={"note": "x"}).status_code == 404
            assert o.get(f"{API}/issues").json() == []
        finally:
            db = _db()
            db.users.delete_one({"id": u["id"]})
            db.login_attempts.delete_many({"identifier": {"$regex": email}})
