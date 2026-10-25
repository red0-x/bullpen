# Bullpup Layers 2 (import/bench), 4 (outcomes), 5 (fix-it), 6 (watch) regression. Single class: shared demo state.
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
DEMO = ("host@bullpup.example.com", "bullpup123")


def _db():
    from dotenv import dotenv_values
    env = dotenv_values("/app/backend/.env")
    return MongoClient(env["MONGO_URL"])[env["DB_NAME"]]


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    r = sess.post(f"{API}/auth/login", json={"email": DEMO[0], "password": DEMO[1]})
    if r.status_code != 200:
        pytest.skip("demo login failed")
    assert sess.post(f"{API}/demo/reset").status_code == 200
    yield sess
    sess.post(f"{API}/demo/reset")


@pytest.fixture(scope="module")
def other():
    sess = requests.Session()
    email = f"TEST_iso_{uuid.uuid4().hex[:6]}@example.com".lower()
    r = sess.post(f"{API}/auth/register", json={"email": email, "password": "testpass123", "name": "TEST Iso"})
    assert r.status_code == 200, r.text
    yield sess
    db = _db()
    u = db.users.find_one({"email": email}) or db.hosts.find_one({"email": email})
    if u:
        for coll in db.list_collection_names():
            db[coll].delete_many({"host_id": u["id"]})
        db.users.delete_many({"email": email})
        db.hosts.delete_many({"email": email})


def all_bench_rows(bench):
    for p in bench["properties"]:
        for a in p["amenities"]:
            yield p, a


def find_slot(bench, prop_name, trade):
    for p, a in all_bench_rows(bench):
        if p["name"] == prop_name and a["trade"] == trade:
            return a
    return None


def contractor_by_name(s, biz):
    b = s.get(f"{API}/bench").json()
    for p, a in all_bench_rows(b):
        for c in a["bench"]:
            if c["business_name"] == biz:
                return c
    for c in b["unmatched"]:
        if c["business_name"] == biz:
            return c
    return None


class TestLayers:
    # ---- Bench ----
    def test_bench_shape(self, s):
        r = s.get(f"{API}/bench")
        assert r.status_code == 200
        b = r.json()
        assert b["properties"] and b["trades"]
        p, a = next(all_bench_rows(b))
        assert "bench" in a and "active_count" in a
        for _, a in all_bench_rows(b):
            ranks = [c["rank"] for c in a["bench"] if c["rank"]]
            assert ranks == list(range(1, len(ranks) + 1))
            for c in a["bench"]:
                assert c.get("reason")

    def test_contractor_crud_and_patch_before(self, s):
        r = s.post(f"{API}/contractors", json={"name": "TEST_Pat", "business_name": "TEST_Pat Plumbing",
                                               "trades": ["plumbing"], "service_area": ["Oakland"]})
        assert r.status_code == 200, r.text
        c = r.json()["contractor"]
        assert c["trades"] == ["Plumbing"]
        assert any("Oakland" in x for x in r.json()["slots"])
        rr = s.patch(f"{API}/contractors/{c['id']}", json={"pinned": True})
        assert rr.status_code == 200
        assert rr.json()["before"] == {"pinned": False}
        slot = find_slot(s.get(f"{API}/bench").json(), "Oakland Duplex", "Plumbing")
        assert slot["bench"][0]["id"] == c["id"] and slot["bench"][0]["rank"] == 1
        rr = s.patch(f"{API}/contractors/{c['id']}", json={"status": "unreachable"})
        assert rr.json()["before"]["status"] == "active"
        slot = find_slot(s.get(f"{API}/bench").json(), "Oakland Duplex", "Plumbing")
        me = next(x for x in slot["bench"] if x["id"] == c["id"])
        assert me["rank"] is None
        assert s.post(f"{API}/contractors", json={"name": "x", "trades": ["Juggling"]}).status_code == 400
        assert s.delete(f"{API}/contractors/{c['id']}").status_code == 200
        assert s.get(f"{API}/contractors/{c['id']}").status_code == 404

    def test_delete_with_history_400(self, s):
        c = contractor_by_name(s, "Bay Flow Plumbing")
        assert c, "Bay Flow Plumbing missing in demo"
        r = s.delete(f"{API}/contractors/{c['id']}")
        assert r.status_code == 400

    # ---- Import ----
    def test_extract_and_import_undo(self, s):
        text = ("Mike plumbing 510-555-0100 oakland. Jenny Cho hot tub care (530) 555-0199 "
                "jenny@sparklespa.example.com Tahoe. Bob fixes stuff 555-0123")
        r = s.post(f"{API}/contractors/extract", json={"text": text}, timeout=90)
        assert r.status_code == 200
        d = r.json()
        assert d["ok"], d
        rows = d["rows"]
        print([(x["name"], x["trades"], x["unsure"], x["duplicate_of"]) for x in rows])
        assert len(rows) == 3
        mike = next(x for x in rows if "mike" in x["name"].lower())
        assert mike["duplicate_of"] and "Mike" in mike["duplicate_of"]["business_name"]
        bob = next(x for x in rows if "bob" in x["name"].lower())
        assert "trade" in bob["unsure"]
        jenny = next(x for x in rows if "jenny" in x["name"].lower())
        assert "Hot tub" in " ".join(jenny["trades"]) or jenny["trades"]
        # import without bob's trade -> 400
        payload = [{k: x[k] for k in ("name", "business_name", "phone", "email", "trades", "service_area", "notes")}
                   for x in (jenny, bob)]
        assert s.post(f"{API}/contractors/import", json={"rows": payload}).status_code in (400, 422)
        payload[1]["trades"] = ["Handyman"] if "Handyman" in s.get(f"{API}/bench").json()["trades"] else [s.get(f"{API}/bench").json()["trades"][0]]
        mrow = {k: mike[k] for k in ("name", "business_name", "phone", "email", "trades", "service_area", "notes")}
        mrow["merge_into"] = mike["duplicate_of"]["id"]
        before_mike = s.get(f"{API}/contractors/{mrow['merge_into']}").json()["contractor"]
        r = s.post(f"{API}/contractors/import", json={"rows": payload + [mrow]})
        assert r.status_code == 200, r.text
        res = r.json()
        assert res["created"] == 2 and res["merged"] == 1
        assert isinstance(res["slots"], dict)
        print(res["slots"])
        r = s.post(f"{API}/contractors/import/{res['batch_id']}/undo")
        assert r.status_code == 200
        after_mike = s.get(f"{API}/contractors/{mrow['merge_into']}").json()["contractor"]
        assert after_mike["trades"] == before_mike["trades"]
        assert after_mike.get("phone") == before_mike.get("phone")
        b = s.get(f"{API}/bench").json()
        names = {c["name"] for _, a in all_bench_rows(b) for c in a["bench"]} | {c["name"] for c in b["unmatched"]}
        assert not any("Jenny" in n or n.startswith("Bob") for n in names)
        assert s.post(f"{API}/contractors/import/{res['batch_id']}/undo").status_code == 404

    def test_extract_nothing(self, s):
        r = s.post(f"{API}/contractors/extract", json={"text": "the quick brown fox jumps over the lazy dog"}, timeout=90)
        d = r.json()
        assert r.status_code == 200
        assert d["ok"] and d["rows"] == []
        assert "couldn't find any contractors" in d["message"]

    # ---- Fix-it ----
    def test_fixit_order_and_demo_items(self, s):
        d = s.get(f"{API}/fixit").json()
        kinds = [i["kind"] for i in d["items"]]
        order = {"issue": 0, "outcome": 1, "gap": 2, "stale": 3, "watch": 4}
        assert [order[k] for k in kinds] == sorted(order[k] for k in kinds)
        titles = [i["title"] for i in d["items"]]
        print(titles)
        assert any(t.startswith("Only 1 hot tub contractor at Tahoe Cabin") for t in titles)
        assert "No EV charger contractor at Oakland Duplex." in titles
        assert any("Dave's Pools: Haven't talked since July. Still in business?" == t for t in titles)
        assert any("High Desert Hot Tubs: Rating dropped from 4.7 to 3.9 this month" in t for t in titles)
        assert any(i["kind"] == "issue" for i in d["items"])

    def test_watch_ack_removes_from_fixit(self, s):
        d = s.get(f"{API}/fixit").json()
        w = next(i for i in d["items"] if i["kind"] == "watch")
        assert s.post(f"{API}/watch/alerts/{w['signal_id']}/ack").status_code == 200
        ids = [i["id"] for i in s.get(f"{API}/fixit").json()["items"]]
        assert w["id"] not in ids
        s.post(f"{API}/watch/alerts/{w['signal_id']}/ack?acknowledged=false")
        assert w["id"] in [i["id"] for i in s.get(f"{API}/fixit").json()["items"]]

    def test_stale_snooze(self, s):
        d = s.get(f"{API}/fixit").json()
        st = next(i for i in d["items"] if i["kind"] == "stale")
        until = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        r = s.patch(f"{API}/contractors/{st['contractor_id']}", json={"snooze_until": until})
        assert r.status_code == 200
        assert st["id"] not in [i["id"] for i in s.get(f"{API}/fixit").json()["items"]]
        s.patch(f"{API}/contractors/{st['contractor_id']}", json={"snooze_until": None})
        assert st["id"] in [i["id"] for i in s.get(f"{API}/fixit").json()["items"]]

    # ---- Outcomes ----
    def _booked_issue(self, s, prop_name, trade):
        props = s.get(f"{API}/properties").json()
        p = next(x for x in props if x["name"] == prop_name)
        a = next(x for x in p["amenities"] if x["trade"] == trade)
        r = s.post(f"{API}/issues", json={"property_id": p["id"], "amenity_id": a["id"], "trade_needed": trade,
                                          "host_note": "TEST_ outcome issue", "urgency": "this_week"})
        assert r.status_code == 200, r.text
        issue = r.json().get("issue", r.json())
        slot = find_slot(s.get(f"{API}/bench").json(), prop_name, trade)
        top = slot["bench"][0]
        req = s.post(f"{API}/requests", json={"issue_id": issue["id"], "contractor_id": top["id"],
                                              "message": "hi", "channel": "copy"})
        assert req.status_code == 200, req.text
        when = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        rr = s.post(f"{API}/requests/{req.json()['id']}/response", json={"response": "booked", "scheduled_for": when})
        assert rr.status_code == 200, rr.text
        assert s.get(f"{API}/issues/{issue['id']}").json()["issue"]["status"] == "scheduled"
        return issue, top, slot

    def test_outcome_noshow_rerank_undo_edit(self, s):
        issue, top, slot = self._booked_issue(s, "Joshua Tree A-Frame", "Plumbing")
        assert len([c for c in slot["bench"] if c["rank"]]) >= 1
        fx = [i["kind"] for i in s.get(f"{API}/fixit").json()["items"] if i.get("issue_id") == issue["id"]]
        assert fx == ["outcome"]
        r = s.post(f"{API}/issues/{issue['id']}/outcome", json={"showed_up": False, "on_time": False,
                                                                 "rating": 1, "note": "TEST_ no show"})
        assert r.status_code == 200, r.text
        d = r.json()
        print(d["changes"], d["next_backup"])
        assert d["undo_seconds"] == 60
        assert d["changes"] and any("No-show on" in m for m in d["changes"])
        assert s.get(f"{API}/issues/{issue['id']}").json()["issue"]["status"] == "open"
        oid = d["outcome"]["id"]
        # undo
        assert s.post(f"{API}/outcomes/{oid}/undo").status_code == 200
        assert s.get(f"{API}/issues/{issue['id']}").json()["issue"]["status"] == "scheduled"
        # log again showed up -> resolved, then edit to no-show
        r = s.post(f"{API}/issues/{issue['id']}/outcome", json={"showed_up": True, "on_time": True, "rating": 5})
        assert r.status_code == 200
        oid = r.json()["outcome"]["id"]
        assert s.get(f"{API}/issues/{issue['id']}").json()["issue"]["status"] == "resolved"
        r = s.put(f"{API}/outcomes/{oid}", json={"showed_up": False, "on_time": False, "rating": 1})
        assert r.status_code == 200
        assert r.json()["outcome"]["revision_of"] == oid
        assert s.get(f"{API}/issues/{issue['id']}").json()["issue"]["status"] == "open"
        s.delete(f"{API}/issues/{issue['id']}")

    def test_outcome_requires_booking(self, s):
        props = s.get(f"{API}/properties").json()
        p = props[0]
        a = p["amenities"][0]
        r = s.post(f"{API}/issues", json={"property_id": p["id"], "amenity_id": a["id"], "trade_needed": a["trade"],
                                          "host_note": "TEST_ nobook", "urgency": "can_wait"})
        issue = r.json().get("issue", r.json())
        r = s.post(f"{API}/issues/{issue['id']}/outcome", json={"showed_up": True, "rating": 5})
        assert r.status_code == 400
        assert s.post(f"{API}/issues/{issue['id']}/outcome", json={"showed_up": True, "rating": 9}).status_code == 422
        s.delete(f"{API}/issues/{issue['id']}")

    # ---- Watch ----
    def test_watch_scripted_runs(self, s):
        w = s.get(f"{API}/watch").json()
        assert w["sample_data"] is True and w["contractors"]
        r1 = s.post(f"{API}/watch/check").json()
        print(r1)
        assert any("Yucca Spa Care: Phone number disconnected. Marked unreachable." == m for m in r1["changes"])
        r2 = s.post(f"{API}/watch/check").json()
        print(r2)
        assert any(m.startswith("Tahoe Pipe & Drain: Listed as permanently closed") for m in r2["changes"])
        assert any(m.startswith("Oak Town Appliance: Rating dropped") for m in r2["changes"])
        for biz in ("Yucca Spa Care", "Tahoe Pipe & Drain"):
            c = contractor_by_name(s, biz)
            assert c["rank"] is None and c["status"] == "unreachable"
        titles = [i["title"] for i in s.get(f"{API}/fixit").json()["items"] if i["kind"] == "watch"]
        assert any("Yucca Spa Care" in t for t in titles) and any("Tahoe Pipe" in t for t in titles)
        s.post(f"{API}/watch/check")
        r4 = s.post(f"{API}/watch/check").json()
        assert r4["changed"] is False

    # ---- Isolation ----
    def test_isolation(self, s, other):
        c = contractor_by_name(s, "Bay Flow Plumbing")
        assert other.get(f"{API}/contractors/{c['id']}").status_code == 404
        assert other.patch(f"{API}/contractors/{c['id']}", json={"pinned": True}).status_code == 404
        assert other.delete(f"{API}/contractors/{c['id']}").status_code == 404
        sig = s.get(f"{API}/watch").json()["alerts"][0]["id"]
        assert other.post(f"{API}/watch/alerts/{sig}/ack").status_code == 404
        issues = s.get(f"{API}/issues").json()
        issues = issues.get("issues", issues) if isinstance(issues, dict) else issues
        iid = issues[0]["id"]
        assert other.post(f"{API}/issues/{iid}/outcome", json={"showed_up": True, "rating": 5}).status_code == 404
        o = _db().job_outcomes.find_one({"contractor_id": c["id"]})
        assert other.put(f"{API}/outcomes/{o['id']}", json={"showed_up": True, "rating": 5}).status_code == 404
        assert other.post(f"{API}/outcomes/{o['id']}/undo").status_code == 404
        assert other.post(f"{API}/contractors/import/xyz/undo").status_code == 404
        ob = other.get(f"{API}/bench").json()
        assert all(not a["bench"] for _, a in all_bench_rows(ob))
        assert other.get(f"{API}/fixit").status_code == 200
        assert other.get(f"{API}/watch").json()["contractors"] == []
