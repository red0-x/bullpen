# Bullpup Layer 1 regression: auth, demo data, properties, contractor scoring, isolation
import os
import uuid
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
DOMAIN = ["properties", "amenities", "contractors", "issues", "requests", "job_outcomes", "watch_signals"]


def _db():
    from dotenv import dotenv_values
    env = dotenv_values("/app/backend/.env")
    return MongoClient(env["MONGO_URL"])[env["DB_NAME"]]


def new_host(prefix="test"):
    s = requests.Session()
    email = f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register", json={"name": "TEST Host", "email": email, "password": "testpass123"})
    assert r.status_code == 200, r.text
    return s, r.json(), email


@pytest.fixture(scope="module")
def created():
    users = []
    yield users
    db = _db()
    for uid in users:
        u = db.users.find_one({"id": uid})
        for c in DOMAIN:
            db[c].delete_many({"host_id": uid})
        db.users.delete_one({"id": uid})
        # only this worker's attempts (xdist-safe; a global regex wipes other workers' lockout counters)
        if u:
            db.login_attempts.delete_many({"identifier": {"$regex": f":{u['email']}$"}})


@pytest.fixture(scope="module")
def host(created):
    s, u, email = new_host()
    created.append(u["id"])
    return s, u, email


# --- Auth ---
class TestAuth:
    def test_register_returns_user_and_cookies(self, host):
        s, u, email = host
        assert u["email"] == email and "password_hash" not in u and "_id" not in u
        assert "access_token" in s.cookies and "refresh_token" in s.cookies

    def test_bcrypt_hash(self, host):
        u = _db().users.find_one({"id": host[1]["id"]})
        assert u["password_hash"].startswith("$2b$")

    def test_me(self, host):
        r = host[0].get(f"{API}/auth/me")
        assert r.status_code == 200 and r.json()["id"] == host[1]["id"]

    def test_duplicate_register(self, host):
        r = requests.post(f"{API}/auth/register", json={"name": "x", "email": host[2], "password": "testpass123"})
        assert r.status_code == 400

    def test_short_password(self):
        r = requests.post(f"{API}/auth/register", json={"name": "x", "email": "test_short@example.com", "password": "abc"})
        assert r.status_code == 422

    def test_demo_login_and_httponly(self):
        r = requests.post(f"{API}/auth/login", json={"email": "host@bullpup.example.com", "password": "bullpup123"})
        assert r.status_code == 200
        sc = r.headers.get("set-cookie", "").lower()
        assert "httponly" in sc and "samesite=none" in sc and "secure" in sc

    def test_wrong_password(self, host):
        r = requests.post(f"{API}/auth/login", json={"email": host[2], "password": "wrongpass1"})
        assert r.status_code == 401 and "doesn't match" in r.json()["detail"]

    def test_unauth(self):
        for p in ["/auth/me", "/properties", "/contractors", "/demo/status"]:
            assert requests.get(f"{API}{p}").status_code == 401

    def test_bearer_fallback(self, host):
        tok = host[0].cookies.get("access_token")
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {tok}"})
        assert r.status_code == 200

    def test_refresh(self, host):
        r = host[0].post(f"{API}/auth/refresh")
        assert r.status_code == 200

    def test_cors_credentials(self):
        r = requests.options(f"{API}/auth/login", headers={"Origin": BASE_URL, "Access-Control-Request-Method": "POST"})
        assert r.headers.get("access-control-allow-origin") == BASE_URL
        assert r.headers.get("access-control-allow-credentials") == "true"

    def test_bruteforce_lockout(self, created):
        s, u, email = new_host()
        created.append(u["id"])
        codes = [requests.post(f"{API}/auth/login", json={"email": email, "password": "badpass99"}).status_code
                 for _ in range(6)]
        assert codes[:5] == [401] * 5 and codes[5] == 429, codes

    def test_logout(self, created):
        s, u, _ = new_host()
        created.append(u["id"])
        s.post(f"{API}/auth/logout")
        assert s.get(f"{API}/auth/me").status_code == 401


# --- Demo data & properties ---
class TestDemo:
    def test_empty_then_load(self, host):
        s = host[0]
        assert s.get(f"{API}/properties").json() == []
        assert s.get(f"{API}/demo/status").json()["demo_loaded"] is False
        r = s.post(f"{API}/demo/load").json()
        assert r["status"] == "loaded"
        c = r["counts"]
        assert c["properties"] == 3 and c["amenities"] == 15 and c["contractors"] == 18

    def test_load_twice(self, host):
        assert host[0].post(f"{API}/demo/load").json()["status"] == "already_loaded"
        assert len(host[0].get(f"{API}/properties").json()) == 3

    def test_properties_structure_and_badges(self, host):
        props = {p["name"]: p for p in host[0].get(f"{API}/properties").json()}
        assert set(props) == {"Tahoe Cabin", "Joshua Tree A-Frame", "Oakland Duplex"}
        for p in props.values():
            assert len(p["amenities"]) == 5
        ev = [a for a in props["Oakland Duplex"]["amenities"] if a["label"] == "EV charger"][0]
        assert ev["active_count"] == 0
        ht = [a for a in props["Tahoe Cabin"]["amenities"] if a["type"] == "hot_tub"][0]
        assert ht["active_count"] == 1

    def test_contractor_scoring(self, host):
        cs = {c["business_name"]: c for c in host[0].get(f"{API}/contractors").json()}
        assert len(cs) == 18
        assert cs["Alpine Plumbing"]["rank"] == 1 and cs["Alpine Plumbing"]["pinned"]
        assert cs["East Bay Appliance"]["rank"] is None
        assert cs["East Bay Appliance"]["reason"] == "Unreachable, not ranked"
        assert cs["Yucca Spa Care"]["score"] == 60 and cs["Yucca Spa Care"]["reason"] == "New, no history yet"
        bf = cs["Bay Flow Plumbing"]
        assert "no-show" in bf["reason"] and bf["score"] < 60, bf
        assert cs["Dave's Pools"]["last_contacted"][5:7] == "07", cs["Dave's Pools"]["last_contacted"]
        ranked = [c["score"] for c in cs.values() if c["rank"] and not c["pinned"]]
        assert all("_id" not in c for c in cs.values())

    def test_bench_endpoint(self, host):
        props = host[0].get(f"{API}/properties").json()
        a = props[0]["amenities"][0]
        r = host[0].get(f"{API}/amenities/{a['id']}/bench")
        assert r.status_code == 200 and r.json()["amenity"]["id"] == a["id"]
        assert host[0].get(f"{API}/amenities/nope/bench").status_code == 404

    def test_reset_keeps_counts(self, host):
        before = {p["id"] for p in host[0].get(f"{API}/properties").json()}
        r = host[0].post(f"{API}/demo/reset").json()
        assert r["status"] == "reset" and r["counts"]["properties"] == 3
        after = host[0].get(f"{API}/properties").json()
        assert len(after) == 3 and not before & {p["id"] for p in after}
        assert len(host[0].get(f"{API}/contractors").json()) == 18

    def test_isolation(self, host, created):
        s2, u2, _ = new_host()
        created.append(u2["id"])
        assert s2.get(f"{API}/properties").json() == []
        assert s2.get(f"{API}/contractors").json() == []
        a = host[0].get(f"{API}/properties").json()[0]["amenities"][0]
        assert s2.get(f"{API}/amenities/{a['id']}/bench").status_code == 404

    def test_clear(self, host):
        assert host[0].delete(f"{API}/demo").json()["status"] == "cleared"
        assert host[0].get(f"{API}/properties").json() == []
