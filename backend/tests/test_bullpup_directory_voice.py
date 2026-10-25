# Bullpup iteration 4: SF sample directory (/api/directory) + voice agent (/api/voice/ask)
import os

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
DEMO = ("host@bullpup.example.com", "bullpup123")
TRADES = ["Plumbing", "HVAC", "Pool service", "Hot tub & spa", "Appliance repair", "Cleaning", "Electrical"]


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    r = sess.post(f"{API}/auth/login", json={"email": DEMO[0], "password": DEMO[1]})
    if r.status_code != 200:
        pytest.skip(f"demo login failed {r.status_code}")
    return sess


# --- auth guard
def test_directory_requires_auth():
    assert requests.get(f"{API}/directory", params={"trade": "Plumbing"}).status_code == 401


def test_voice_requires_auth():
    assert requests.post(f"{API}/voice/ask", json={"message": "hi"}).status_code == 401


# --- directory
@pytest.mark.parametrize("trade", TRADES)
def test_directory_each_trade(s, trade):
    r = s.get(f"{API}/directory", params={"trade": trade})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["sample_data"] is True and d["area"] == "San Francisco"
    res = d["results"]
    assert len(res) == 4
    assert all(b["trade"] == trade for b in res)
    assert [b["rank"] for b in res] == [1, 2, 3, 4]
    scores = [b["score"] for b in res]
    assert scores == sorted(scores, reverse=True)
    for b in res:
        assert isinstance(b["score"], int) and 0 <= b["score"] <= 100
        assert "stars from" in b["reason"] and "mi away" in b["reason"]
        assert len(b["photos"]) == 2 and len(b["reviews"]) == 4
        assert b["phone"].startswith("(415) 555-")
        assert "_id" not in b


def test_directory_lat_lng_changes_distance(s):
    base = {b["id"]: b["distance_miles"] for b in s.get(f"{API}/directory", params={"trade": "Plumbing"}).json()["results"]}
    near = s.get(f"{API}/directory", params={"trade": "Plumbing", "lat": 37.80, "lng": -122.44}).json()["results"]
    assert any(base[b["id"]] != b["distance_miles"] for b in near)


def test_directory_far_origin_falls_back_to_sf(s):
    base = s.get(f"{API}/directory", params={"trade": "Plumbing"}).json()["results"]
    far = s.get(f"{API}/directory", params={"trade": "Plumbing", "lat": 40.7, "lng": -74.0}).json()["results"]
    assert [b["distance_miles"] for b in base] == [b["distance_miles"] for b in far]


def test_directory_unknown_trade(s):
    r = s.get(f"{API}/directory", params={"trade": "Roofing"})
    print("unknown trade ->", r.status_code, r.json().get("trade"), r.json()["results"][0]["trade"] if r.ok else None)
    assert r.status_code == 200


def test_directory_missing_trade_422(s):
    assert s.get(f"{API}/directory").status_code == 422


def test_directory_photos_served():
    r = requests.get(f"{BASE_URL}/directory/p0.jpg")
    assert r.status_code == 200 and r.headers.get("content-type", "").startswith("image")


# --- voice
def test_voice_broken_returns_camera(s):
    r = s.post(f"{API}/voice/ask", json={"message": "my toilet is cracked", "history": [], "page": "/"}, timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()
    print("voice camera:", d)
    assert d["ok"] is True
    assert isinstance(d["reply"], str) and len(d["reply"]) > 0
    assert d["action"] == "camera"


def test_voice_general_reply(s):
    r = s.post(f"{API}/voice/ask", json={"message": "What needs me today?", "history": [], "page": "/"}, timeout=60)
    assert r.status_code == 200
    d = r.json()
    print("voice general:", d)
    assert d["action"] in ("camera", "fixit", "bench", "properties", "issue", "none")
    if d["action"] == "issue":
        assert d["issue_id"]


def test_voice_bench_nav(s):
    r = s.post(f"{API}/voice/ask", json={"message": "Show me my bench of contractors", "history": [], "page": "/"}, timeout=60)
    d = r.json()
    print("voice bench:", d)
    assert r.status_code == 200 and d["action"] in ("bench", "none")


def test_voice_validation(s):
    assert s.post(f"{API}/voice/ask", json={"message": ""}).status_code == 422
    assert s.post(f"{API}/voice/ask", json={"message": "x" * 1001}).status_code == 422
    assert s.post(f"{API}/voice/ask", json={"message": "hi", "history": [{}] * 13}).status_code == 422
