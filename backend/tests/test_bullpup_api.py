# Bullpup backend regression: auth, demo, catalog, issue flow, contractors
import os, uuid, time
from datetime import datetime, timedelta, timezone
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL").rstrip("/")
DEMO = {"email": "host@bullpup.example.com", "password": "bullpup123"}


@pytest.fixture(scope="session")
def tokens():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=DEMO, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code} {r.text}")
    return r.json()


@pytest.fixture(scope="session")
def s(tokens):
    ses = requests.Session()
    ses.headers.update({"Authorization": f"Bearer {tokens['access_token']}"})
    return ses


# ---- Auth ----
class TestAuth:
    def test_login_returns_tokens_no_hash(self, tokens):
        assert tokens["access_token"] and tokens["refresh_token"]
        assert tokens["email"] == DEMO["email"]
        assert "password_hash" not in tokens

    def test_me_bearer(self, s):
        r = s.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200 and r.json()["email"] == DEMO["email"]
        assert "password_hash" not in r.json()

    def test_me_no_auth(self):
        assert requests.get(f"{BASE_URL}/api/auth/me").status_code == 401

    def test_refresh_json_body(self, tokens):
        r = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
        assert r.status_code == 200 and r.json()["access_token"]
        bad = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": "junk"})
        assert bad.status_code == 401

    def test_register_and_login(self):
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{BASE_URL}/api/auth/register", json={"name": "TEST_User", "email": email, "password": "password123"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["access_token"] and d["email"] == email and "password_hash" not in d
        me = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {d['access_token']}"})
        assert me.status_code == 200 and me.json()["email"] == email
        dup = requests.post(f"{BASE_URL}/api/auth/register", json={"name": "x", "email": email, "password": "password123"})
        assert dup.status_code == 400

    def test_login_wrong_password(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": f"nouser_{uuid.uuid4().hex[:6]}@example.com", "password": "nope12345"})
        assert r.status_code == 401


# ---- Catalog / demo / bench / watch / directory ----
class TestCatalog:
    def test_properties(self, s):
        r = s.get(f"{BASE_URL}/api/properties")
        assert r.status_code == 200
        props = r.json()
        assert isinstance(props, list) and len(props) > 0 and "amenities" in props[0]

    def test_bench(self, s):
        r = s.get(f"{BASE_URL}/api/bench")
        assert r.status_code == 200, r.text
        assert r.json()

    def test_fixit(self, s):
        r = s.get(f"{BASE_URL}/api/fixit")
        assert r.status_code == 200, r.text

    def test_watch_and_check(self, s):
        assert s.get(f"{BASE_URL}/api/watch").status_code == 200
        r = s.post(f"{BASE_URL}/api/watch/check")
        assert r.status_code == 200, r.text

    def test_directory(self, s):
        r = s.get(f"{BASE_URL}/api/directory", params={"trade": "Plumbing"})
        assert r.status_code == 200, r.text
        assert r.json()

    def test_demo_status(self, s):
        r = s.get(f"{BASE_URL}/api/demo/status")
        assert r.status_code == 200


# ---- Issue flow ----
class TestIssueFlow:
    def test_diagnose_text(self, s):
        r = s.post(f"{BASE_URL}/api/issues/diagnose", json={"note": "Kitchen sink is leaking under the cabinet"}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        print("DIAGNOSE:", d)
        assert "ok" in d
        empty = s.post(f"{BASE_URL}/api/issues/diagnose", json={"note": ""})
        assert empty.status_code == 400

    def test_full_flow(self, s):
        props = s.get(f"{BASE_URL}/api/properties").json()
        prop = props[0]
        am = next((a for a in prop["amenities"] if a["trade"] == "Plumbing"), prop["amenities"][0])
        r = s.post(f"{BASE_URL}/api/issues", json={"property_id": prop["id"], "amenity_id": am["id"],
                    "trade_needed": am["trade"], "urgency": "today", "host_note": "TEST_ leak"})
        assert r.status_code == 200, r.text
        iid = r.json()["id"]
        try:
            g = s.get(f"{BASE_URL}/api/issues/{iid}")
            assert g.status_code == 200, g.text
            d = g.json()
            assert d["issue"]["status"] == "open"
            assert len(d["candidates"]) >= 1, "no candidates"
            assert len(d["candidates"]) <= 3
            cid = d["candidates"][0]["id"]
            dr = s.post(f"{BASE_URL}/api/issues/{iid}/draft", json={"contractor_id": cid}, timeout=90)
            assert dr.status_code == 200 and dr.json()["message"]
            print("DRAFT ai:", dr.json()["ai"])
            rq = s.post(f"{BASE_URL}/api/requests", json={"issue_id": iid, "contractor_id": cid,
                        "message": dr.json()["message"], "channel": "copy"})
            assert rq.status_code == 200, rq.text
            rid = rq.json()["id"]
            assert s.get(f"{BASE_URL}/api/issues/{iid}").json()["issue"]["status"] == "waiting"
            dup = s.post(f"{BASE_URL}/api/requests", json={"issue_id": iid, "contractor_id": cid, "message": "x", "channel": "copy"})
            assert dup.status_code == 400
            nb = s.post(f"{BASE_URL}/api/requests/{rid}/response", json={"response": "booked"})
            assert nb.status_code == 400
            when = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
            bk = s.post(f"{BASE_URL}/api/requests/{rid}/response", json={"response": "booked", "scheduled_for": when})
            assert bk.status_code == 200, bk.text
            iss = s.get(f"{BASE_URL}/api/issues/{iid}").json()["issue"]
            assert iss["status"] == "scheduled" and iss["scheduled_for"]
            # undo response then rebook
            u = s.post(f"{BASE_URL}/api/requests/{rid}/response/undo")
            assert u.status_code == 200
            assert s.get(f"{BASE_URL}/api/issues/{iid}").json()["issue"]["status"] == "waiting"
            assert s.post(f"{BASE_URL}/api/requests/{rid}/response", json={"response": "booked", "scheduled_for": when}).status_code == 200
            oc = s.post(f"{BASE_URL}/api/issues/{iid}/outcome", json={"showed_up": True, "on_time": True, "rating": 5, "note": "TEST_"})
            assert oc.status_code == 200, oc.text
            od = oc.json()
            print("OUTCOME changes:", od["changes"])
            assert s.get(f"{BASE_URL}/api/issues/{iid}").json()["issue"]["status"] == "resolved"
            uo = s.post(f"{BASE_URL}/api/outcomes/{od['outcome']['id']}/undo")
            assert uo.status_code == 200, uo.text
            assert s.get(f"{BASE_URL}/api/issues/{iid}").json()["issue"]["status"] == "scheduled"
            s.post(f"{BASE_URL}/api/requests/{rid}/response/undo")
            assert s.delete(f"{BASE_URL}/api/requests/{rid}").status_code == 200
            assert s.get(f"{BASE_URL}/api/issues/{iid}").json()["issue"]["status"] == "open"
        finally:
            s.delete(f"{BASE_URL}/api/issues/{iid}")
        assert s.get(f"{BASE_URL}/api/issues/{iid}").status_code == 404


# ---- Contractors ----
class TestContractors:
    def test_crud(self, s):
        r = s.post(f"{BASE_URL}/api/contractors", json={"name": "TEST_Bob", "business_name": "TEST_Bob Plumbing",
                   "phone": "555-111-2222", "trades": ["Plumbing"], "service_area": []})
        assert r.status_code == 200, r.text
        cid = r.json()["contractor"]["id"]
        p = s.patch(f"{BASE_URL}/api/contractors/{cid}", json={"pinned": True, "phone": "555-999-0000"})
        assert p.status_code == 200, p.text
        g = s.get(f"{BASE_URL}/api/contractors/{cid}").json()["contractor"]
        assert g["phone"] == "555-999-0000" and g["pinned"] is True
        bad = s.post(f"{BASE_URL}/api/contractors", json={"name": "x", "trades": ["Nope"]})
        assert bad.status_code == 400
        assert s.delete(f"{BASE_URL}/api/contractors/{cid}").status_code == 200
        assert s.get(f"{BASE_URL}/api/contractors/{cid}").status_code == 404

    def test_extract_and_import(self, s):
        r = s.post(f"{BASE_URL}/api/contractors/extract",
                   json={"text": "TEST_Ann Lee, Sparkle Cleaning, 555-303-4040, cleaner\nTEST_Joe, Joe's HVAC 555-202-1111"}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        print("EXTRACT:", d)
        imp = s.post(f"{BASE_URL}/api/contractors/import", json={"rows": [
            {"name": "TEST_Imported", "business_name": "TEST_Imp Co", "phone": "555-777-8888", "trades": ["Plumbing"]}]})
        assert imp.status_code == 200, imp.text
        bid = imp.json()["batch_id"]
        assert imp.json()["created"] == 1
        assert s.post(f"{BASE_URL}/api/contractors/import/{bid}/undo").status_code == 200
