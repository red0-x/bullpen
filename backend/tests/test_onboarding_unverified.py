# Iteration 5: "Save address as typed" fallback (unverified geocode) + property geocode validation
import pytest

from test_onboarding import API, GEO, register


@pytest.fixture(scope="module")
def u():
    return register()


# --- Geocode lookup disabled on Google key -> 503 with friendly message ---
class TestGeocodeDisabled:
    def test_geocode_503_message(self, u):
        r = u.post(f"{API}/onboarding/geocode", json={"address": "123 Lakeview Dr, South Lake Tahoe, CA 96150"})
        assert r.status_code in (200, 503), r.text
        if r.status_code == 503:
            assert "switched on" in r.json()["detail"]


# --- POST /api/onboarding/property geocode validation ---
class TestPropertyGeocode:
    def test_empty_geocode_400(self, u):
        r = u.post(f"{API}/onboarding/property", json={"name": "", "address": "1 Market St, SF", "geocode": {}})
        assert r.status_code == 400 and r.json()["detail"] == "Look up the address first."

    def test_unverified_false_flag_400(self, u):
        r = u.post(f"{API}/onboarding/property", json={"name": "", "address": "1 Market St, SF", "geocode": {"unverified": False}})
        assert r.status_code == 400

    def test_lat_out_of_range_400(self, u):
        r = u.post(f"{API}/onboarding/property", json={"name": "", "address": "1 Market St, SF", "geocode": {"lat": 200, "lng": 0}})
        assert r.status_code == 400 and "valid" in r.json()["detail"]

    def test_lng_out_of_range_400(self, u):
        r = u.post(f"{API}/onboarding/property", json={"name": "", "address": "1 Market St, SF", "geocode": {"lat": 10, "lng": -181}})
        assert r.status_code == 400

    def test_unverified_saves_and_persists(self, u):
        r = u.post(f"{API}/onboarding/property", json={"name": "", "address": "123 Lakeview Dr, South Lake Tahoe, CA", "geocode": {"unverified": True}})
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["geocode"] == {"verified": False}
        assert p["name"] == "123 Lakeview Dr" and p["city"] == "" and "_id" not in p
        st = u.get(f"{API}/onboarding").json()
        assert st["property"]["id"] == p["id"] and st["property"]["geocode"] == {"verified": False}
        assert st["property"]["address"] == "123 Lakeview Dr, South Lake Tahoe, CA"
        u.pid = p["id"]

    def test_unverified_with_extra_junk_stripped(self, u):
        r = u.post(f"{API}/onboarding/property", json={"name": "TEST Typed", "address": "123 Lakeview Dr, South Lake Tahoe, CA",
                                                       "geocode": {"unverified": True, "evil": "x", "lat": "37"}})
        assert r.status_code == 200, r.text
        assert r.json()["geocode"] == {"verified": False} and r.json()["name"] == "TEST Typed"
        assert r.json()["id"] == u.pid  # upsert, not a second property

    def test_valid_latlng_verified_true_upgrade(self, u):
        r = u.post(f"{API}/onboarding/property", json={"name": "", "address": "1 Market St, San Francisco, CA", "geocode": GEO})
        assert r.status_code == 200, r.text
        g = r.json()["geocode"]
        assert g["verified"] is True and g["lat"] == GEO["lat"] and g["lng"] == GEO["lng"]
        assert r.json()["id"] == u.pid and r.json()["city"] == "San Francisco"

    def test_unverified_property_can_finish(self):
        s = register()
        assert s.post(f"{API}/onboarding/property", json={"name": "", "address": "9 Pine Rd, Truckee, CA", "geocode": {"unverified": True}}).status_code == 200
        st = s.get(f"{API}/onboarding").json()
        assert st["can_finish"] is True
        r = s.post(f"{API}/onboarding/complete")
        assert r.status_code == 200, r.text
        assert s.get(f"{API}/properties").status_code == 200
