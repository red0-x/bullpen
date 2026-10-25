# Iteration 4 regression: item frame_point/position validation + gate exact-or-slash open-route matching
import pytest

from test_onboarding import API, GEO, register


@pytest.fixture(scope="module")
def room_user():
    s = register()
    r = s.post(f"{API}/onboarding/property", json={"name": "TEST Fix Home", "address": "1 Market St, San Francisco, CA", "geocode": GEO})
    assert r.status_code == 200, r.text
    r = s.post(f"{API}/onboarding/rooms", json={"type": "kitchen"})
    assert r.status_code == 200, r.text
    s.room_id = r.json()["id"]
    return s


# --- Item frame_point / position validation ---
class TestItemValidation:
    @pytest.mark.parametrize("fp", [{"x": None, "y": None}, {"x": 1.5, "y": 0.2}, {"x": -0.1, "y": 0.5}, {"x": 0.5}, {"x": "abc", "y": 0.3}])
    def test_bad_frame_point_422(self, room_user, fp):
        r = room_user.post(f"{API}/onboarding/rooms/{room_user.room_id}/items", json={"name": "TEST Bad", "category": "appliance", "frame_point": fp})
        assert r.status_code == 422, (fp, r.status_code, r.text)

    def test_valid_frame_point_persisted(self, room_user):
        r = room_user.post(f"{API}/onboarding/rooms/{room_user.room_id}/items",
                           json={"name": "TEST Fridge", "category": "appliance", "frame_point": {"x": 0.6, "y": 0.4}, "source": "photo"})
        assert r.status_code == 200, r.text
        iid = r.json()["id"]
        room = room_user.get(f"{API}/onboarding/rooms/{room_user.room_id}").json()
        item = next(i for i in room["items"] if i["id"] == iid)
        assert item["frame_point"] == {"x": 0.6, "y": 0.4}

    def test_edge_frame_point_ok(self, room_user):
        r = room_user.post(f"{API}/onboarding/rooms/{room_user.room_id}/items", json={"name": "TEST Edge", "frame_point": {"x": 0, "y": 1}})
        assert r.status_code == 200, r.text

    def test_position_dict_accepted(self, room_user):
        pos = {"x": 1.2, "y": -0.3, "z": 2.5, "anchor_id": "abc-123", "distance_m": 1.8}
        r = room_user.post(f"{API}/onboarding/rooms/{room_user.room_id}/items", json={"name": "TEST AR Oven", "source": "ar", "position": pos})
        assert r.status_code == 200, r.text
        iid = r.json()["id"]
        room = room_user.get(f"{API}/onboarding/rooms/{room_user.room_id}").json()
        item = next(i for i in room["items"] if i["id"] == iid)
        assert item["position"]["x"] == 1.2 and item["position"]["anchor_id"] == "abc-123"

    def test_position_bad_value_422(self, room_user):
        r = room_user.post(f"{API}/onboarding/rooms/{room_user.room_id}/items", json={"name": "TEST AR", "position": {"x": [1, 2]}})
        assert r.status_code == 422

    def test_patch_ignores_frame_point(self, room_user):
        # ItemPatch has no frame_point field -> extra key ignored, stored value must stay valid
        r = room_user.post(f"{API}/onboarding/rooms/{room_user.room_id}/items", json={"name": "TEST Patch", "frame_point": {"x": 0.1, "y": 0.2}})
        iid = r.json()["id"]
        r = room_user.patch(f"{API}/onboarding/items/{iid}", json={"frame_point": {"x": 2, "y": 0}, "name": "TEST Patched"})
        assert r.status_code == 200, r.text
        assert r.json()["frame_point"] == {"x": 0.1, "y": 0.2} and r.json()["name"] == "TEST Patched"


# --- Gate exact-or-slash matching ---
class TestGateMatching:
    def test_open_paths(self):
        s = register()
        assert s.get(f"{API}/auth/me").status_code == 200
        assert s.get(f"{API}/onboarding").status_code == 200
        # files path: 404 (not found) rather than 403 means the gate let it through
        assert s.get(f"{API}/files/doesnotexist.jpg").status_code in (404, 400)

    def test_gated_paths(self):
        s = register()
        for p in ("/properties", "/issues", "/contractors", "/filesX", "/uploads", "/onboardingX"):
            r = s.get(f"{API}{p}")
            assert r.status_code in (403, 404, 405), (p, r.status_code)
            if r.status_code != 403:
                # route doesn't exist (404/405) - acceptable, just not 200
                assert r.status_code != 200
        for p in ("/properties", "/issues"):
            assert s.get(f"{API}{p}").status_code == 403
