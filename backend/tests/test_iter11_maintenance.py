# Iteration 11: rental cover photos, appliance service reminders (Fix-it + email), job costs, appliance history
import datetime as dt
import os

import pytest
import requests

from test_onboarding import API, GEO, register


@pytest.fixture(scope="module")
def h():
    s = register()
    p = s.post(f"{API}/onboarding/property", json={"name": "Lake", "address": "1 Market St, San Francisco, CA", "geocode": GEO}).json()
    assert s.post(f"{API}/onboarding/skip").status_code == 200
    rm = s.post(f"{API}/onboarding/rooms", json={"type": "garage", "property_id": p["id"]}).json()
    it = s.post(f"{API}/onboarding/rooms/{rm['id']}/items", json={"name": "Water heater", "category": "appliance", "brand": "Rheem"}).json()
    c = s.post(f"{API}/contractors", json={"name": "TEST Pl", "business_name": "TEST Plumb", "phone": "5551112222",
                                           "trades": ["Plumbing"], "service_area": ["San Francisco"]}).json()
    s.pid, s.item, s.cid = p["id"], it["id"], c["contractor"]["id"]
    return s


@pytest.fixture(scope="module")
def other():
    s = register()
    s.post(f"{API}/onboarding/skip")
    return s


def day(n):
    return (dt.date.today() + dt.timedelta(days=n)).isoformat()


class TestService:
    def test_validation_and_owner(self, h, other):
        assert h.put(f"{API}/items/{h.item}/service", json={"interval_months": 5, "next_due": day(3)}).status_code == 422
        assert h.put(f"{API}/items/{h.item}/service", json={"interval_months": 12, "next_due": day(3000)}).status_code == 400
        assert other.put(f"{API}/items/{h.item}/service", json={"interval_months": 12, "next_due": day(3)}).status_code == 404
        assert other.get(f"{API}/items/{h.item}/history").status_code == 404
        assert h.post(f"{API}/items/{h.item}/service/done", json={}).status_code == 400  # no schedule yet

    def test_set_and_fixit_card(self, h):
        r = h.put(f"{API}/items/{h.item}/service", json={"interval_months": 12, "next_due": day(3), "email": True})
        assert r.status_code == 200, r.text
        svc = r.json()["service"]
        assert svc["state"] == "soon" and svc["days_left"] == 3 and "emailed_for" not in svc
        fx = h.get(f"{API}/fixit").json()
        card = next(i for i in fx["items"] if i["kind"] == "service")
        assert card["item_id"] == h.item and "Rheem water heater" in card["title"] and "due in 3 days" in card["title"]
        assert fx["counts"]["service"] == 1

    def test_far_due_not_on_fixit(self, h):
        h.put(f"{API}/items/{h.item}/service", json={"interval_months": 6, "next_due": day(90)})
        assert not [i for i in h.get(f"{API}/fixit").json()["items"] if i["kind"] == "service"]
        h.put(f"{API}/items/{h.item}/service", json={"interval_months": 12, "next_due": day(-2)})
        card = next(i for i in h.get(f"{API}/fixit").json()["items"] if i["kind"] == "service")
        assert card["overdue"] is True and "overdue by 2 days" in card["title"]

    def test_done_moves_date_and_undo(self, h):
        r = h.post(f"{API}/items/{h.item}/service/done", json={"cost": 50.5, "note": "DIY flush", "done_on": day(0)})
        assert r.status_code == 200, r.text
        d = r.json()
        nxt = dt.date.today().replace(year=dt.date.today().year + 1)
        assert d["service"]["next_due"] in (nxt.isoformat(), (nxt - dt.timedelta(days=1)).isoformat())
        assert d["log"]["cost"] == 50.5 and "prev_service" not in d["log"]
        hist = h.get(f"{API}/items/{h.item}/history").json()
        assert hist["services"][0]["note"] == "DIY flush" and hist["total_cost"] == 50.5
        assert h.delete(f"{API}/service-logs/{d['log']['id']}").status_code == 200
        hist = h.get(f"{API}/items/{h.item}/history").json()
        assert hist["services"] == [] and hist["service"]["next_due"] == day(-2)


class TestServiceJob:
    def test_book_outcome_cost_and_undo(self, h):
        b = h.post(f"{API}/items/{h.item}/service/book").json()
        assert b["existing"] is False
        assert h.post(f"{API}/items/{h.item}/service/book").json() == {"id": b["id"], "existing": True}
        iss = h.get(f"{API}/issues/{b['id']}").json()
        assert iss["issue"]["kind"] == "service" and iss["issue"]["trade_needed"] == "Plumbing" and iss["item"]["id"] == h.item
        fx = h.get(f"{API}/fixit").json()["items"]
        assert not [i for i in fx if i["kind"] == "service"]
        assert any(i["kind"] == "issue" and "Rheem water heater service" in i["title"] for i in fx)
        rq = h.post(f"{API}/requests", json={"issue_id": b["id"], "contractor_id": h.cid, "message": "hi", "channel": "copy"}).json()
        h.post(f"{API}/requests/{rq['id']}/response", json={"response": "booked", "scheduled_for": dt.datetime.utcnow().isoformat() + "Z"})
        o = h.post(f"{API}/issues/{b['id']}/outcome", json={"showed_up": True, "on_time": True, "rating": 5, "note": "anode", "cost": 180}).json()
        assert o["outcome"]["cost"] == 180
        hist = h.get(f"{API}/items/{h.item}/history").json()
        assert hist["services"][0]["contractor"] == "TEST Plumb" and hist["services"][0]["cost"] == 180
        assert hist["service"]["last_done"] == day(0) and hist["open_service_issue"] is None
        # edit outcome cost -> service log follows
        e = h.put(f"{API}/outcomes/{o['outcome']['id']}", json={"showed_up": True, "on_time": True, "rating": 4, "note": "anode", "cost": 200})
        assert e.status_code == 200
        assert h.get(f"{API}/items/{h.item}/history").json()["services"][0]["cost"] == 200
        # service-job log can't be removed directly
        lid = h.get(f"{API}/items/{h.item}/history").json()["services"][0]["id"]
        assert h.delete(f"{API}/service-logs/{lid}").status_code == 400
        # undo the (first) outcome -> latest revision remains, so still logged; no-show edit reverts
        e2 = h.put(f"{API}/outcomes/{e.json()['outcome']['id']}", json={"showed_up": False, "rating": 1})
        assert e2.status_code == 200
        hist = h.get(f"{API}/items/{h.item}/history").json()
        assert hist["services"] == [] and hist["service"]["next_due"] == day(-2)

    def test_repair_history_with_cost(self, h):
        base = {"property_id": h.pid, "item_id": h.item, "trade_needed": "Plumbing", "urgency": "today", "host_note": "TEST leaking"}
        iid = h.post(f"{API}/issues", json=base).json()["id"]
        hist = h.get(f"{API}/items/{h.item}/history").json()
        rep = next(r for r in hist["repairs"] if r["issue_id"] == iid)
        assert rep["kind"] == "repair" and rep["status"] in ("open", "waiting") and rep["what"] == "TEST leaking"


class TestCover:
    def test_cover(self, h, other):
        img = "/tmp/ob/kitchen.jpg"
        data = open(img, "rb").read() if os.path.exists(img) else b"\xff\xd8\xff\xe0" + b"0" * 100
        up = h.post(f"{API}/upload", files={"file": ("c.jpg", data, "image/jpeg")}).json()
        r = h.put(f"{API}/properties/{h.pid}/cover", json={"photo": up["url"]})
        assert r.status_code == 200 and r.json()["cover_photo"] == up["url"]
        assert next(p for p in h.get(f"{API}/properties").json() if p["id"] == h.pid)["cover_photo"] == up["url"]
        assert any(p.get("cover_photo") == up["url"] for p in h.get(f"{API}/bench").json()["properties"])
        assert other.put(f"{API}/properties/{h.pid}/cover", json={"photo": up["url"]}).status_code == 404
        mine = other.post(f"{API}/onboarding/property", json={"name": "O", "address": "2 Market St, SF", "geocode": GEO}).json()
        assert other.put(f"{API}/properties/{mine['id']}/cover", json={"photo": up["url"]}).status_code == 404  # someone else's file
        assert h.put(f"{API}/properties/{h.pid}/cover", json={"photo": None}).json()["cover_photo"] is None
