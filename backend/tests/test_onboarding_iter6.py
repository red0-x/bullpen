# Iteration 6: property save hardening (bool lat/lng, strict unverified, trimmed address, name fallback) + 503 copy
import pytest

from test_onboarding import API, GEO, register


@pytest.fixture(scope="module")
def u():
    return register()


def save(s, address, geocode, name=""):
    return s.post(f"{API}/onboarding/property", json={"name": name, "address": address, "geocode": geocode})


# --- Geocode REQUEST_DENIED copy ---
def test_geocode_503_copy(u):
    r = u.post(f"{API}/onboarding/geocode", json={"address": "123 Lakeview Dr, South Lake Tahoe, CA 96150"})
    assert r.status_code in (200, 503), r.text
    if r.status_code == 503:
        assert r.json()["detail"] == "Address lookup isn't switched on yet. You can save the address as typed."


# --- Bool lat/lng rejected unless unverified:true ---
class TestBoolLatLng:
    def test_bool_latlng_400(self, u):
        r = save(u, "1 Market St, SF", {"lat": True, "lng": False})
        assert r.status_code == 400 and r.json()["detail"] == "Look up the address first."

    def test_bool_latlng_with_unverified_saves_unverified(self, u):
        r = save(u, "1 Market St, SF", {"lat": True, "lng": False, "unverified": True})
        assert r.status_code == 200, r.text
        assert r.json()["geocode"] == {"verified": False}
        st = u.get(f"{API}/onboarding").json()
        assert st["property"]["geocode"] == {"verified": False}

    def test_mixed_bool_and_number_400(self, u):
        assert save(u, "1 Market St, SF", {"lat": 37.7, "lng": True}).status_code == 400


# --- unverified must be exactly true ---
class TestStrictUnverified:
    @pytest.mark.parametrize("val", ["no", 1, "true", "yes", 0, None, []])
    def test_non_true_unverified_400(self, u, val):
        r = save(u, "1 Market St, SF", {"unverified": val})
        assert r.status_code == 400, f"{val!r} -> {r.status_code} {r.text}"


# --- Address trimming + name fallback ---
class TestTrimAndName:
    def test_whitespace_only_address_400(self, u):
        r = save(u, "          ", {"unverified": True})
        assert r.status_code == 400, r.text

    def test_short_after_trim_400(self, u):
        r = save(u, "   ab    ", {"unverified": True})
        assert r.status_code == 400 and r.json()["detail"] == "Type the full street address."

    def test_name_fallback_my_rental(self, u):
        r = save(u, "   , Reno NV", {"unverified": True}, name="   ")
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["name"] == "My rental" and p["address"] == ", Reno NV"
        st = u.get(f"{API}/onboarding").json()
        assert st["property"]["name"] == "My rental" and st["property"]["address"] == ", Reno NV"

    def test_name_fallback_first_part_trimmed(self, u):
        r = save(u, "  42 Elm St , Reno, NV  ", {"unverified": True})
        assert r.status_code == 200, r.text
        assert r.json()["name"] == "42 Elm St" and r.json()["address"] == "42 Elm St , Reno, NV"

    def test_name_trimmed(self, u):
        r = save(u, "42 Elm St, Reno, NV", {"unverified": True}, name="  TEST Cabin  ")
        assert r.status_code == 200 and r.json()["name"] == "TEST Cabin"

    def test_verified_name_from_street(self, u):
        r = save(u, "1 Market St, San Francisco, CA", GEO)
        assert r.status_code == 200, r.text
        assert r.json()["name"] == "1 Market St" and r.json()["geocode"]["verified"] is True


# --- Robustness: junk types in geocode shouldn't 500 ---
class TestJunkTypes:
    def test_street_non_string(self, u):
        r = save(u, "42 Elm St, Reno, NV", {"lat": 39.5, "lng": -119.8, "street": 5})
        assert r.status_code != 500, r.text

    def test_city_non_string_new_user(self):
        s = register()
        r = save(s, "42 Elm St, Reno, NV", {"lat": 39.5, "lng": -119.8, "city": 123})
        assert r.status_code != 500, r.text
