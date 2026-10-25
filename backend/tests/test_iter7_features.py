# Iteration 7: live address search (Google Places + OSM), geocode OSM fallback, multi-rental, pin later, appliance-aware issues
import time
import uuid

import pytest
import requests

from test_onboarding import API, GEO, register

TRADE = "Appliance repair"


def save(s, address, geocode, **kw):
    return s.post(f"{API}/onboarding/property", json={"name": kw.pop("name", ""), "address": address, "geocode": geocode, **kw})


@pytest.fixture(scope="module")
def u():
    s = register()
    r = save(s, "1 Market St, San Francisco, CA", GEO)
    assert r.status_code == 200, r.text
    s.first_id = r.json()["id"]
    # Real flow: extra rentals are added from the Rentals tab, so the host is already in the app (skipped first setup).
    assert s.post(f"{API}/onboarding/skip").status_code == 200
    return s


@pytest.fixture(scope="module")
def other():
    return register()


# --- Live address search (Google Places New) ---
class TestAutocomplete:
    def test_short_q_422(self, u):
        assert u.get(f"{API}/onboarding/autocomplete", params={"q": "16"}).status_code == 422

    def test_requires_auth(self):
        assert requests.get(f"{API}/onboarding/autocomplete", params={"q": "1600 Amph"}).status_code in (401, 403)

    def test_google_suggestions_and_place(self, u):
        sess = uuid.uuid4().hex
        r = u.get(f"{API}/onboarding/autocomplete", params={"q": "1600 Amphitheatre Pkwy", "session": sess})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["source"] in ("google", "osm")
        assert len(d["suggestions"]) >= 1
        s0 = d["suggestions"][0]
        assert {"id", "main", "secondary", "geo"} <= set(s0)
        if d["source"] == "google":
            assert s0["geo"] is None and s0["main"]
            p = u.post(f"{API}/onboarding/place", json={"place_id": s0["id"], "session": sess})
            assert p.status_code == 200, p.text
            g = p.json()
            assert g["source"] == "google" and isinstance(g["lat"], float) and isinstance(g["lng"], float)
            for k in ("formatted_address", "city", "state", "postal_code", "country", "street"):
                assert k in g
            assert g["country"] == "US" and g["state"] == "CA"
        else:
            assert s0["geo"]["source"] == "osm"

    def test_bad_place_503(self, u):
        r = u.post(f"{API}/onboarding/place", json={"place_id": "notarealplaceid123"})
        assert r.status_code == 503
        assert "Couldn't load that address" in r.json()["detail"]


# --- Geocode falls back to OSM Photon ---
class TestGeocodeOSM:
    def test_real_address(self, u):
        r = u.post(f"{API}/onboarding/geocode", json={"address": "1600 Amphitheatre Pkwy Mountain View"})
        assert r.status_code == 200, r.text
        d = r.json()
        # Geocoding API off: Google Places text search answers first, OpenStreetMap only if Places is off too
        assert d.get("source") in ("google", "osm")
        assert d["results"] and all(x["source"] == d["source"] for x in d["results"])
        x = d["results"][0]
        assert "Mountain View" in x["formatted_address"] and abs(x["lat"] - 37.42) < 0.1
        if d["source"] == "google":
            assert x["street"].startswith("1600")  # house number kept

    def test_gibberish_422(self, u):
        time.sleep(1)
        r = u.post(f"{API}/onboarding/geocode", json={"address": "qzxqzxqzx vvbnmplk"})
        assert r.status_code == 422, r.text


# --- Multiple rentals ---
class TestMultiRental:
    def test_new_rental_flow(self, u, other):
        r = save(u, "500 Lake Rd, Reno, NV", {**GEO, "lat": 39.5, "lng": -119.8, "city": "Reno", "street": "500 Lake Rd"}, new=True)
        assert r.status_code == 200, r.text
        p2 = r.json()
        assert p2["id"] != u.first_id and p2["onboarding"] is False
        st1 = u.get(f"{API}/onboarding").json()
        assert st1["property"]["id"] == u.first_id and st1["first_setup"] is True
        st2 = u.get(f"{API}/onboarding", params={"property_id": p2["id"]}).json()
        assert st2["property"]["id"] == p2["id"] and st2["first_setup"] is False and st2["rooms"] == []
        # room into rental 2
        rm = u.post(f"{API}/onboarding/rooms", json={"type": "Kitchen", "property_id": p2["id"]})
        assert rm.status_code == 200 and rm.json()["property_id"] == p2["id"]
        it = u.post(f"{API}/onboarding/rooms/{rm.json()['id']}/items",
                    json={"name": "Refrigerator", "category": "appliance", "brand": "Samsung", "model": "RF28R7351SR"})
        assert it.status_code == 200
        st2 = u.get(f"{API}/onboarding", params={"property_id": p2["id"]}).json()
        assert len(st2["rooms"]) == 1 and st2["rooms"][0]["items"][0]["brand"] == "Samsung"
        assert u.get(f"{API}/onboarding").json()["rooms"] == []  # first rental untouched
        # update rental 2 by id
        r = save(u, "502 Lake Rd, Reno, NV", {**GEO, "lat": 39.5, "lng": -119.8}, name="Lake cabin", property_id=p2["id"])
        assert r.status_code == 200 and r.json()["id"] == p2["id"] and r.json()["name"] == "Lake cabin"
        assert save(other, "502 Lake Rd, Reno, NV", GEO, property_id=p2["id"]).status_code == 404
        assert other.get(f"{API}/onboarding", params={"property_id": p2["id"]}).status_code == 404
        assert other.post(f"{API}/onboarding/rooms", json={"type": "bath", "property_id": p2["id"]}).status_code == 404
        c = u.post(f"{API}/onboarding/complete", params={"property_id": p2["id"]})
        assert c.status_code == 200 and c.json() == {"ok": True}
        # finishing an extra rental doesn't mark the unfinished first setup as done
        st1 = u.get(f"{API}/onboarding").json()
        assert st1["complete"] is False and st1["first_setup"] is True
        # properties counts
        props = {p["id"]: p for p in u.get(f"{API}/properties").json()}
        assert props[p2["id"]]["rooms_count"] == 1 and props[p2["id"]]["items_count"] == 1
        assert props[u.first_id]["rooms_count"] == 0
        u.p2 = p2["id"]
        u.item_id = it.json()["id"]

    def test_demo_rental_rooms_and_clear(self, u):
        assert u.post(f"{API}/demo/load").status_code == 200
        demo = [p for p in u.get(f"{API}/properties").json() if p.get("demo")]
        assert demo
        rm = u.post(f"{API}/onboarding/rooms", json={"type": "bathroom", "property_id": demo[0]["id"]})
        assert rm.status_code == 200
        u.post(f"{API}/onboarding/rooms/{rm.json()['id']}/items", json={"name": "Toilet", "category": "fixture"})
        props = {p["id"]: p for p in u.get(f"{API}/properties").json()}
        assert props[demo[0]["id"]]["rooms_count"] == 1
        assert u.delete(f"{API}/demo").status_code == 200
        assert u.get(f"{API}/onboarding/rooms/{rm.json()['id']}").status_code == 404
        inv = u.get(f"{API}/inventory").json()
        assert all(i["property_id"] != demo[0]["id"] for i in inv)


# --- Pin later ---
class TestPinLater:
    def test_unverified_then_pin(self, u):
        r = save(u, "77 Pine St, Truckee, CA", {"unverified": True}, name="Pine house", new=True)
        assert r.status_code == 200 and r.json()["geocode"] == {"verified": False}
        pid = r.json()["id"]
        geo = {**GEO, "lat": 39.33, "lng": -120.18, "city": "Truckee", "street": "77 Pine St", "source": "osm"}
        r = save(u, "77 Pine St, Truckee, CA 96161, USA", geo, name="Pine house", property_id=pid)
        assert r.status_code == 200, r.text
        g = r.json()["geocode"]
        assert g["verified"] is True and g["source"] == "osm" and g["lat"] == 39.33
        assert r.json()["city"] == "Truckee" and r.json()["name"] == "Pine house"
        r = save(u, "77 Pine St, Truckee, CA", {**geo, "source": "evil"}, property_id=pid)
        assert r.json()["geocode"]["source"] == "google"


# --- Appliance-aware issues ---
class TestAppliance:
    def test_inventory(self, u, other):
        inv = u.get(f"{API}/inventory", params={"property_id": u.p2}).json()
        assert len(inv) == 1 and inv[0]["room"] == "Kitchen" and inv[0]["model"] == "RF28R7351SR"
        assert "_id" not in inv[0]
        r = other.get(f"{API}/inventory")  # other is still gated on onboarding -> 403, never others' items
        assert r.status_code == 403 or r.json() == []

    def test_issue_item_validation(self, u):
        base = {"trade_needed": TRADE, "urgency": "this_week", "host_note": "TEST fridge leaking"}
        bad = u.post(f"{API}/issues", json={**base, "property_id": u.first_id, "item_id": u.item_id})
        assert bad.status_code == 400
        ok = u.post(f"{API}/issues", json={**base, "property_id": u.p2, "item_id": u.item_id})
        assert ok.status_code == 200, ok.text
        iid = ok.json()["id"]
        d = u.get(f"{API}/issues/{iid}").json()
        assert d["item"]["brand"] == "Samsung" and d["item"]["model"] == "RF28R7351SR" and d["item"]["room"]
        u.issue_id = iid

    def test_diagnose_guesses_item(self, u):
        r = u.post(f"{API}/issues/diagnose", json={"note": "The fridge at the lake cabin is leaking"}, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True, d
        assert d["draft"]["item_id"] == u.item_id
        assert d["draft"]["property_id"] == u.p2

    def test_draft_mentions_model(self, u):
        c = u.post(f"{API}/contractors", json={"name": "TEST Al", "business_name": "TEST Appliance Co", "phone": "5551234567",
                                               "trades": [TRADE], "service_area": ["Reno"]})
        assert c.status_code == 200, c.text
        cid = c.json()["contractor"]["id"]
        r = u.post(f"{API}/issues/{u.issue_id}/draft", json={"contractor_id": cid}, timeout=90)
        assert r.status_code == 200, r.text
        msg = r.json()["message"]
        assert "RF28R7351SR" in msg or "Samsung" in msg, msg
