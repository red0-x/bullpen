# Onboarding feature tests: gate, state, geocode/staticmap, property, rooms, items, upload/files, AI suggest
import os
import uuid

import pytest
import requests

def _base():
    url = os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    if not url:
        for line in open("/app/frontend/.env"):
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                url = line.split("=", 1)[1].strip().strip('"')
    return url.rstrip("/")

BASE_URL = _base()
API = f"{BASE_URL}/api"
KITCHEN = "/tmp/ob/kitchen.jpg"
GEO = {"lat": 37.7749, "lng": -122.4194, "city": "San Francisco", "state": "CA", "postal_code": "94103", "street": "1 Market St"}


def register():
    email = f"test_ob_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"name": "TEST Onb", "email": email, "password": "testpass123"})
    assert r.status_code == 200, r.text
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    s.token = r.json()["access_token"]
    return s


@pytest.fixture(scope="module")
def user():
    return register()


@pytest.fixture(scope="module")
def other():
    return register()


# --- Gate ---
class TestGate:
    def test_gated_before_onboarding(self, user):
        for p in ("/properties", "/issues"):
            r = user.get(f"{API}{p}")
            assert r.status_code == 403, (p, r.status_code)
            assert "Finish setting up" in r.json()["detail"]

    def test_open_routes(self, user):
        assert user.get(f"{API}/auth/me").status_code == 200
        r = user.get(f"{API}/onboarding")
        assert r.status_code == 200
        d = r.json()
        for k in ("property", "rooms", "completed_rooms", "can_finish", "complete", "skipped"):
            assert k in d
        assert d["property"] is None and d["can_finish"] is False and d["rooms"] == []

    def test_complete_without_property_400(self, user):
        assert user.post(f"{API}/onboarding/complete").status_code == 400

    def test_room_before_property_400(self, user):
        assert user.post(f"{API}/onboarding/rooms", json={"type": "kitchen"}).status_code == 400

    def test_skip_opens_app(self):
        s = register()
        assert s.get(f"{API}/properties").status_code == 403
        assert s.post(f"{API}/onboarding/skip").json() == {"ok": True}
        assert s.get(f"{API}/properties").status_code == 200
        assert s.get(f"{API}/issues").status_code == 200
        assert s.get(f"{API}/onboarding").json()["skipped"] is True


# --- Geocode / staticmap ---
class TestMaps:
    def test_geocode_clean_503(self, user):
        r = user.post(f"{API}/onboarding/geocode", json={"address": "1 Market St, San Francisco"})
        assert r.status_code in (200, 503), r.status_code
        if r.status_code == 503:
            assert "detail" in r.json()

    def test_geocode_validation(self, user):
        assert user.post(f"{API}/onboarding/geocode", json={"address": "ab"}).status_code == 422

    def test_staticmap(self, user):
        r = user.get(f"{API}/onboarding/staticmap", params={"lat": 37.77, "lng": -122.41})
        assert r.status_code in (200, 502, 503)
        assert user.get(f"{API}/onboarding/staticmap", params={"lat": 100, "lng": 0}).status_code == 422


# --- Property + rooms + items ---
class TestFlow:
    def test_property_requires_latlng(self, user):
        r = user.post(f"{API}/onboarding/property", json={"name": "", "address": "1 Market St, SF", "geocode": {}})
        assert r.status_code == 400

    def test_property_create_update(self, user):
        r = user.post(f"{API}/onboarding/property", json={"name": "", "address": "1 Market St, San Francisco, CA", "geocode": GEO})
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["name"] == "1 Market St" and p["city"] == "San Francisco" and "_id" not in p
        r2 = user.post(f"{API}/onboarding/property", json={"name": "TEST Cabin", "address": "1 Market St, San Francisco, CA", "geocode": GEO})
        assert r2.json()["id"] == p["id"] and r2.json()["name"] == "TEST Cabin"
        st = user.get(f"{API}/onboarding").json()
        assert st["property"]["id"] == p["id"] and st["can_finish"] is True

    def test_rooms_items_crud(self, user, other):
        r = user.post(f"{API}/onboarding/rooms", json={"type": "Kitchen", "label": "Main"})
        assert r.status_code == 200
        room = r.json()
        assert room["type"] == "kitchen" and room["items"] == [] and room["status"] == "in_progress"
        rid = room["id"]
        # PATCH merge scan_data
        user.patch(f"{API}/onboarding/rooms/{rid}", json={"scan_data": {"frames": [{"path": "a"}]}})
        r = user.patch(f"{API}/onboarding/rooms/{rid}", json={"scan_data": {"ar": {"planes": 2}}, "status": "complete", "label": "Big"})
        d = r.json()
        assert d["scan_data"]["frames"] == [{"path": "a"}] and d["scan_data"]["ar"] == {"planes": 2}
        assert d["status"] == "complete" and d["label"] == "Big"
        assert user.patch(f"{API}/onboarding/rooms/{rid}", json={"status": "bogus"}).status_code == 422
        # items
        r = user.post(f"{API}/onboarding/rooms/{rid}/items", json={"name": "Fridge", "category": "Appliance", "brand": "  ",
                                                                   "frame_point": {"x": 0.5, "y": 0.4}, "source": "photo"})
        assert r.status_code == 200, r.text
        it = r.json()
        assert it["brand"] is None and it["category"] == "appliance" and it["frame_point"] == {"x": 0.5, "y": 0.4}
        assert user.post(f"{API}/onboarding/rooms/{rid}/items", json={"name": "x", "source": "bad"}).status_code == 422
        r = user.patch(f"{API}/onboarding/items/{it['id']}", json={"brand": "LG", "model": ""})
        assert r.json()["brand"] == "LG" and r.json()["model"] is None
        g = user.get(f"{API}/onboarding/rooms/{rid}").json()
        assert len(g["items"]) == 1 and g["items"][0]["brand"] == "LG"
        st = user.get(f"{API}/onboarding").json()
        assert st["completed_rooms"] == 1 and len(st["rooms"][0]["items"]) == 1
        # ownership
        assert other.get(f"{API}/onboarding/rooms/{rid}").status_code == 404
        assert other.patch(f"{API}/onboarding/items/{it['id']}", json={"name": "hack"}).status_code == 404
        assert other.delete(f"{API}/onboarding/items/{it['id']}").status_code == 404
        assert other.post(f"{API}/onboarding/rooms/{rid}/items", json={"name": "hack"}).status_code == 404
        assert other.delete(f"{API}/onboarding/rooms/{rid}").status_code == 404
        # delete item
        it2 = user.post(f"{API}/onboarding/rooms/{rid}/items", json={"name": "Sink", "source": "manual"}).json()
        assert user.delete(f"{API}/onboarding/items/{it2['id']}").json() == {"ok": True}
        assert user.patch(f"{API}/onboarding/items/{it2['id']}", json={"name": "z"}).status_code == 404
        # delete room cascades items
        assert user.delete(f"{API}/onboarding/rooms/{rid}").json() == {"ok": True}
        assert user.get(f"{API}/onboarding/rooms/{rid}").status_code == 404
        assert user.patch(f"{API}/onboarding/items/{it['id']}", json={"name": "z"}).status_code == 404

    def test_complete_opens_gate(self, user):
        assert user.post(f"{API}/onboarding/complete").json() == {"ok": True}
        assert user.get(f"{API}/onboarding").json()["complete"] is True
        assert user.get(f"{API}/properties").status_code == 200
        props = user.get(f"{API}/properties").json()
        assert any(p.get("name") == "TEST Cabin" for p in (props if isinstance(props, list) else props.get("properties", [])))


# --- Upload / files / AI suggest ---
class TestUpload:
    def test_upload_get_suggest(self, user, other):
        with open(KITCHEN, "rb") as f:
            r = user.post(f"{API}/upload", files={"file": ("kitchen.jpg", f, "image/jpeg")})
        assert r.status_code == 200, r.text
        up = r.json()
        assert up["url"] == f"/api/files/{up['path']}"
        size = os.path.getsize(KITCHEN)
        g = user.get(f"{BASE_URL}{up['url']}")
        assert g.status_code == 200 and len(g.content) == size and g.headers["content-type"].startswith("image/jpeg")
        g2 = requests.get(f"{BASE_URL}{up['url']}", params={"token": user.token})
        assert g2.status_code == 200 and len(g2.content) == size
        assert requests.get(f"{BASE_URL}{up['url']}").status_code == 401
        assert other.get(f"{BASE_URL}{up['url']}").status_code == 404
        assert other.post(f"{API}/onboarding/suggest", json={"photo": up["url"]}).status_code == 404
        s = user.post(f"{API}/onboarding/suggest", json={"photo": up["url"]}, timeout=120)
        assert s.status_code == 200, s.text
        d = s.json()
        print("SUGGEST:", d)
        assert d["ok"] is True and d["room_type"] == "kitchen" and len(d["items"]) >= 1

    def test_upload_empty(self, user):
        r = user.post(f"{API}/upload", files={"file": ("e.jpg", b"", "image/jpeg")})
        assert r.status_code == 413
