# Iteration 14: Issue page dispatch flow (pick -> send -> waiting -> booked / next / empty), phone, twilio webhook
import os
import re
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", os.environ.get("EXPO_BACKEND_URL", "")).rstrip("/")
if not BASE_URL:
    for line in open("/app/frontend/.env"):
        if "BACKEND_URL=" in line:
            BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
API = f"{BASE_URL}/api"
PHONE_RE = re.compile(r"\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}|\+1\d{10}")


@pytest.fixture(scope="module")
def s():
    ss = requests.Session()
    r = ss.post(f"{API}/auth/login", json={"email": "host@bullpup.example.com", "password": "bullpup123"})
    if r.status_code != 200:
        pytest.skip("login failed")
    ss.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    assert ss.post(f"{API}/demo/reset").status_code == 200
    return ss


def issues(s):
    return s.get(f"{API}/issues").json()


@pytest.fixture(scope="module")
def tahoe(s):
    hot = [i for i in issues(s) if i["trade_needed"] == "Hot tub & spa" and i["status"] == "open"]
    assert hot, "no Tahoe hot tub issue"
    return hot[0]["id"]


@pytest.fixture(scope="module")
def plumb(s):
    p = [i for i in issues(s) if i["trade_needed"] == "Plumbing" and i["status"] == "open"]
    assert p, "no plumbing issue"
    return p[0]["id"]


def gd(s, iid):
    r = s.get(f"{API}/issues/{iid}/dispatch")
    assert r.status_code == 200, r.text
    return r.json()


# --- GET dispatch: pick state
def test_get_pick_state(s, tahoe):
    d = gd(s, tahoe)
    assert d["state"] == "pick"
    assert 1 <= len(d["picks"]) <= 3
    assert d["current"]["name"] == d["picks"][0]["name"]
    assert d["message"] and "Can you come" in d["message"]
    assert " · " in d["eyebrow"] and d["headline"]
    assert isinstance(d["timeline"], list) and d["timeline"]
    assert any(p["tag"] == "New to you" for p in d["picks"]), d["picks"]
    for p in d["picks"]:
        assert {"name", "short", "tag", "reason", "why"} <= set(p)


def test_no_contractor_phone_in_dispatch(s, tahoe, plumb):
    for iid in (tahoe, plumb):
        txt = s.get(f"{API}/issues/{iid}/dispatch").text
        assert "phone" not in txt.replace("host_phone_set", ""), txt
        assert not PHONE_RE.search(txt), PHONE_RE.search(txt)


def test_get_dispatch_404(s):
    assert s.get(f"{API}/issues/nope-xyz/dispatch").status_code == 404


def test_get_dispatch_unauth():
    assert requests.get(f"{API}/issues/x/dispatch").status_code in (401, 403)


# --- PATCH message
def test_patch_message(s, tahoe):
    r = s.patch(f"{API}/issues/{tahoe}/dispatch", json={"message": "TEST_ edited message please come"})
    assert r.status_code == 200
    assert gd(s, tahoe)["message"] == "TEST_ edited message please come"


def test_patch_message_too_long(s, tahoe):
    assert s.patch(f"{API}/issues/{tahoe}/dispatch", json={"message": "x" * 601}).status_code == 422


def test_patch_message_empty(s, tahoe):
    r = s.patch(f"{API}/issues/{tahoe}/dispatch", json={"message": ""})
    assert r.status_code == 422, r.text


def test_test_reply_400_when_pick(s, tahoe):
    r = s.post(f"{API}/issues/{tahoe}/dispatch/test-reply", json={"reply": "yes", "time": "7:30 PM"})
    assert r.status_code == 400


# --- send -> waiting
def test_send_waiting(s, tahoe):
    first = gd(s, tahoe)["current"]["short"]
    assert s.post(f"{API}/issues/{tahoe}/dispatch/send").status_code == 200
    d = gd(s, tahoe)
    assert d["state"] == "waiting"
    sent = datetime.fromisoformat(d["sent_at"])
    assert abs((datetime.fromisoformat(d["call_at"]) - sent) - timedelta(minutes=15)) < timedelta(seconds=2)
    assert abs((datetime.fromisoformat(d["next_at"]) - sent) - timedelta(minutes=30)) < timedelta(seconds=2)
    texts = [(e["text"], e["dot"]) for e in d["timeline"]]
    assert (f"You replied YES. Texted {first}.", "done") in texts
    assert (f"Call {first} if no reply.", "pending") in texts


def test_send_twice_400(s, tahoe):
    assert s.post(f"{API}/issues/{tahoe}/dispatch/send").status_code == 400


def test_patch_after_send_400(s, tahoe):
    assert s.patch(f"{API}/issues/{tahoe}/dispatch", json={"message": "late edit"}).status_code == 400


def test_test_reply_invalid(s, tahoe):
    assert s.post(f"{API}/issues/{tahoe}/dispatch/test-reply", json={"reply": "maybe"}).status_code == 422


# --- no -> next -> send -> silent -> next -> send -> no -> empty
def test_no_then_silent_then_empty(s, tahoe):
    d0 = gd(s, tahoe)
    names = [p["name"] for p in d0["picks"]]
    assert s.post(f"{API}/issues/{tahoe}/dispatch/test-reply", json={"reply": "no"}).status_code == 200
    d = gd(s, tahoe)
    assert d["state"] == "next" and d["current"]["name"] == names[1]
    assert d["prev"] == d0["picks"][0]["short"]
    assert d["timeline"][0]["text"].startswith("You replied YES")
    assert any(e["dot"] == "pending" and "Waiting for your YES" in e["text"] for e in d["timeline"])
    assert s.post(f"{API}/issues/{tahoe}/dispatch/send").status_code == 200
    assert gd(s, tahoe)["state"] == "waiting"
    assert s.post(f"{API}/issues/{tahoe}/dispatch/test-reply", json={"reply": "silent"}).status_code == 200
    d = gd(s, tahoe)
    if len(names) >= 3:
        assert d["state"] == "next" and d["current"]["name"] == names[2]
        assert any("Called" in e["text"] for e in d["timeline"])
        assert s.post(f"{API}/issues/{tahoe}/dispatch/send").status_code == 200
        assert s.post(f"{API}/issues/{tahoe}/dispatch/test-reply", json={"reply": "no"}).status_code == 200
        d = gd(s, tahoe)
    assert d["state"] == "empty", d["state"]
    assert d["current"] is None
    assert any("Nobody left" in e["text"] for e in d["timeline"])


# --- yes -> booked
def test_yes_booked(s, plumb):
    d = gd(s, plumb)
    assert d["state"] == "pick"
    assert s.post(f"{API}/issues/{plumb}/dispatch/send").status_code == 200
    r = s.post(f"{API}/issues/{plumb}/dispatch/test-reply", json={"reply": "yes", "time": "7:30 PM"})
    assert r.status_code == 200
    d = gd(s, plumb)
    assert d["state"] == "booked"
    assert "7:30 PM" in d["booked_text"]
    assert any(e["dot"] == "pending" and e["text"] == "Text you tomorrow: how did it go?" for e in d["timeline"])
    assert any(e["dot"] == "good" and "replied YES for 7:30 PM" in e["text"] for e in d["timeline"])
    st = [i for i in issues(s) if i["id"] == plumb]
    full = s.get(f"{API}/issues/{plumb}").json()
    assert full["issue"]["status"] == "scheduled", full["issue"]["status"]
    # checkin_at = booked + 14h: pending checkin event time
    ev = [e for e in d["timeline"] if e["text"].startswith("Text you tomorrow")][0]
    assert ev["at"]


def test_test_reply_400_when_booked(s, plumb):
    assert s.post(f"{API}/issues/{plumb}/dispatch/test-reply", json={"reply": "no"}).status_code == 400


# --- phone
@pytest.mark.parametrize("phone,code", [("415 555 0123", 200), ("+1 (415) 555-0123", 200), ("12345678", 400), ("123", 422), ("abcdefghij", 400)])
def test_phone(s, phone, code):
    assert s.put(f"{API}/me/phone", json={"phone": phone}).status_code == code


# --- twilio webhook signature
def test_twilio_no_signature_403():
    r = requests.post(f"{API}/twilio/sms", data={"From": "+14155550123", "Body": "YES"})
    assert r.status_code == 403, r.status_code
