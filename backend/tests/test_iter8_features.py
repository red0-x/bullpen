# Iteration 8: first-setup flag vs extra rentals, multi-rental bench data, demo multi-rental + inventory across rentals
import pytest

from test_onboarding import API, GEO, register


def save(s, address, geocode, **kw):
    return s.post(f"{API}/onboarding/property", json={"name": kw.pop("name", ""), "address": address, "geocode": geocode, **kw})


# --- Onboarding complete flag with extra rentals ---
class TestFirstSetupFlag:
    def test_extra_rental_complete_keeps_first_setup_open(self):
        u = register()
        first = save(u, "1 Market St, San Francisco, CA", GEO).json()
        assert u.post(f"{API}/onboarding/skip").status_code == 200
        p2 = save(u, "500 Lake Rd, Reno, NV", {"unverified": True}, new=True)
        assert p2.status_code == 200, p2.text
        c = u.post(f"{API}/onboarding/complete", params={"property_id": p2.json()["id"]})
        assert c.status_code == 200 and c.json() == {"ok": True}
        st = u.get(f"{API}/onboarding").json()
        assert st["complete"] is False and st["first_setup"] is True and st["skipped"] is True
        assert st["property"]["id"] == first["id"]
        # Finishing the first rental now marks setup done
        assert u.post(f"{API}/onboarding/complete").status_code == 200
        assert u.get(f"{API}/onboarding").json()["complete"] is True

    def test_skip_without_address_then_extra_rental(self):
        u = register()
        assert u.post(f"{API}/onboarding/skip").status_code == 200
        p = save(u, "500 Lake Rd, Reno, NV", {"unverified": True}, new=True)
        assert p.status_code == 200, p.text
        assert u.post(f"{API}/onboarding/complete", params={"property_id": p.json()["id"]}).status_code == 200
        st = u.get(f"{API}/onboarding").json()
        print("state after extra-only:", {k: st[k] for k in ("complete", "first_setup", "skipped")}, st["property"] and st["property"]["id"])
        props = u.get(f"{API}/properties")
        assert props.status_code == 200 and any(x["id"] == p.json()["id"] for x in props.json())

    def test_gated_before_skip(self):
        u = register()
        assert u.get(f"{API}/properties").status_code == 403


# --- Bench data for multi-rental switcher ---
@pytest.fixture(scope="module")
def demo_host():
    u = register()
    assert u.post(f"{API}/onboarding/skip").status_code == 200
    r = u.post(f"{API}/demo/load")
    assert r.status_code == 200, r.text
    return u


class TestBenchMultiRental:
    def test_bench_has_multiple_rentals_with_amenities(self, demo_host):
        b = demo_host.get(f"{API}/bench")
        assert b.status_code == 200
        props = b.json()["properties"]
        assert len(props) >= 2
        ids = [p["id"] for p in props]
        assert len(set(ids)) == len(ids)
        for p in props:
            assert p["name"] and isinstance(p["amenities"], list)
            for a in p["amenities"]:
                assert {"id", "label", "trade", "active_count", "bench"} <= set(a)

    def test_amenity_ids_unique_across_rentals(self, demo_host):
        props = demo_host.get(f"{API}/bench").json()["properties"]
        am = [a["id"] for p in props for a in p["amenities"]]
        assert len(am) == len(set(am))

    def test_inventory_item_in_second_rental(self, demo_host):
        props = demo_host.get(f"{API}/properties").json()
        p2 = props[1]["id"]
        rm = demo_host.post(f"{API}/onboarding/rooms", json={"type": "kitchen", "label": "Kitchen", "property_id": p2})
        assert rm.status_code == 200, rm.text
        it = demo_host.post(f"{API}/onboarding/rooms/{rm.json()['id']}/items",
                            json={"name": "Refrigerator", "category": "appliance", "brand": "Samsung", "model": "RF28R7351SR"})
        assert it.status_code == 200 and it.json()["property_id"] == p2
        inv = demo_host.get(f"{API}/inventory", params={"property_id": p2}).json()
        hit = [i for i in inv if i["id"] == it.json()["id"]]
        assert hit and hit[0]["room"] == "Kitchen" and hit[0]["brand"] == "Samsung"
        inv1 = demo_host.get(f"{API}/inventory", params={"property_id": props[0]["id"]}).json()
        assert all(i["property_id"] == props[0]["id"] for i in inv1)
