# Iteration 11 edge cases (testing agent): email claim, undo ordering, book reuse, outcome edit revert, cover ownership
import datetime as dt
import os

import pytest
from pymongo import MongoClient

from test_onboarding import API, GEO, register

_env = dict(l.strip().split("=", 1) for l in open("/app/backend/.env") if "=" in l and not l.startswith("#"))
DB = MongoClient(_env["MONGO_URL"].strip('"'))[_env["DB_NAME"].strip('"')]


def day(n):
    return (dt.date.today() + dt.timedelta(days=n)).isoformat()


@pytest.fixture(scope="module")
def h():
    s = register()
    p = s.post(f"{API}/onboarding/property", json={"name": "TEST Edge", "address": "1 Market St, San Francisco, CA", "geocode": GEO}).json()
    s.post(f"{API}/onboarding/skip")
    rm = s.post(f"{API}/onboarding/rooms", json={"type": "garage", "property_id": p["id"]}).json()
    it = s.post(f"{API}/onboarding/rooms/{rm['id']}/items", json={"name": "Furnace", "category": "appliance", "brand": "Carrier"}).json()
    c = s.post(f"{API}/contractors", json={"name": "TEST H", "business_name": "TEST HVAC Co", "phone": "5551113333",
                                           "trades": ["HVAC"], "service_area": ["San Francisco"]}).json()
    s.pid, s.item, s.cid = p["id"], it["id"], c["contractor"]["id"]
    return s


# Email claim logic: due within 7 days -> emailed_for set (even though example.com is not delivered)
def test_email_claim(h):
    import time
    r = h.put(f"{API}/items/{h.item}/service", json={"interval_months": 6, "next_due": day(4), "email": True})
    assert r.status_code == 200 and r.json()["service"]["label"] == "Every 6 months"
    time.sleep(2)
    svc = DB.items.find_one({"id": h.item})["service"]
    assert svc["emailed_for"] == day(4)
    # far date -> not claimed
    h.put(f"{API}/items/{h.item}/service", json={"interval_months": 6, "next_due": day(20), "email": True})
    time.sleep(2)
    assert DB.items.find_one({"id": h.item})["service"]["emailed_for"] == day(4)
    # email off -> not claimed
    h.put(f"{API}/items/{h.item}/service", json={"interval_months": 6, "next_due": day(2), "email": False})
    time.sleep(2)
    assert DB.items.find_one({"id": h.item})["service"]["emailed_for"] == day(4)


# Two manual logs: only the newest can be undone; undo restores due date
def test_undo_only_newest(h):
    h.put(f"{API}/items/{h.item}/service", json={"interval_months": 3, "next_due": day(5)})
    a = h.post(f"{API}/items/{h.item}/service/done", json={"done_on": day(-1), "cost": 80}).json()
    nd_a = a["service"]["next_due"]
    b = h.post(f"{API}/items/{h.item}/service/done", json={"done_on": day(0), "cost": 90.5, "contractor_id": h.cid}).json()
    assert b["log"]["cost"] == 90.5
    assert h.delete(f"{API}/service-logs/{a['log']['id']}").status_code == 400
    assert h.delete(f"{API}/service-logs/{b['log']['id']}").status_code == 200
    hist = h.get(f"{API}/items/{h.item}/history").json()
    assert hist["service"]["next_due"] == nd_a and hist["total_cost"] == 80 and hist["jobs"] == 1
    assert h.delete(f"{API}/service-logs/{a['log']['id']}").status_code == 200
    assert h.get(f"{API}/items/{h.item}/history").json()["service"]["next_due"] == day(5)
    # bad done dates / bad contractor / negative cost
    assert h.post(f"{API}/items/{h.item}/service/done", json={"done_on": day(5)}).status_code == 400
    assert h.post(f"{API}/items/{h.item}/service/done", json={"contractor_id": "nope"}).status_code == 404
    assert h.post(f"{API}/items/{h.item}/service/done", json={"cost": -1}).status_code == 422


# Book: HVAC trade guessed, reused while open, fixit card hidden while job open; outcome edit to no-show reverts
def test_book_and_outcome_edit(h):
    h.put(f"{API}/items/{h.item}/service", json={"interval_months": 12, "next_due": day(3)})
    b1 = h.post(f"{API}/items/{h.item}/service/book").json()
    b2 = h.post(f"{API}/items/{h.item}/service/book").json()
    assert b1["id"] == b2["id"] and b2["existing"] is True
    iss = h.get(f"{API}/issues/{b1['id']}").json()
    iss = iss.get("issue", iss)
    assert iss["kind"] == "service" and iss["trade_needed"] == "HVAC"
    assert not [i for i in h.get(f"{API}/fixit").json()["items"] if i["kind"] == "service"]
    r = h.post(f"{API}/issues/{b1['id']}/outcome", json={"contractor_id": h.cid, "showed_up": True, "rating": 5, "cost": 150})
    assert r.status_code == 200, r.text
    out = r.json()
    oid = (out.get("outcome") or out)["id"]
    hist = h.get(f"{API}/items/{h.item}/history").json()
    assert hist["services"][0]["cost"] == 150 and hist["services"][0]["contractor"] == "TEST HVAC Co"
    assert hist["service"]["next_due"] > day(300)
    r = h.put(f"{API}/outcomes/{oid}", json={"contractor_id": h.cid, "showed_up": False, "rating": 1})
    assert r.status_code == 200, r.text
    hist = h.get(f"{API}/items/{h.item}/history").json()
    assert hist["service"]["next_due"] == day(3) and not hist["services"]


# Cover: other host's file rejected; remove works; other host can't set
def test_cover_ownership(h):
    o = register()
    o.post(f"{API}/onboarding/skip")
    with open("/app/frontend/assets/images/icon.png", "rb") as f:
        up = o.post(f"{API}/upload", files={"file": ("c.png", f, "image/png")}).json()
    assert h.put(f"{API}/properties/{h.pid}/cover", json={"photo": up["url"]}).status_code == 404
    assert o.put(f"{API}/properties/{h.pid}/cover", json={"photo": up["url"]}).status_code == 404
    assert h.put(f"{API}/properties/{h.pid}/cover", json={"photo": None}).json()["cover_photo"] is None


# Service job finished after reminders were stopped: the job (cost, contractor) should still appear in history
def test_service_job_after_stop_keeps_history(h):
    h.put(f"{API}/items/{h.item}/service", json={"interval_months": 12, "next_due": day(3)})
    b = h.post(f"{API}/items/{h.item}/service/book").json()
    assert h.delete(f"{API}/items/{h.item}/service").status_code == 200
    r = h.post(f"{API}/issues/{b['id']}/outcome", json={"contractor_id": h.cid, "showed_up": True, "rating": 4, "cost": 210})
    assert r.status_code == 200, r.text
    hist = h.get(f"{API}/items/{h.item}/history").json()
    costs = [x.get("cost") for x in hist["repairs"] + hist["services"]]
    assert 210 in costs, f"finished service job vanished from history: repairs={hist['repairs']} services={hist['services']}"
