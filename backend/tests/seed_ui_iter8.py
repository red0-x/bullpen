# Seed UI test hosts for iter 8: A = demo data (3 rentals, skipped setup); B = 2 own rentals + Samsung fridge in rental 2 Kitchen.
import json
import uuid
import requests
from test_onboarding import API, GEO


def reg(tag):
    email = f"test_ui8{tag}_{uuid.uuid4().hex[:6]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"name": f"TEST UI8{tag}", "email": email, "password": "testpass123"})
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    return email, s


ea, a = reg("a")
a.post(f"{API}/onboarding/skip")
a.post(f"{API}/demo/load")
pa = [{"id": p["id"], "name": p["name"]} for p in a.get(f"{API}/properties").json()]
bench = a.get(f"{API}/bench").json()["properties"]
am = {p["id"]: [x["id"] for x in p["amenities"]] for p in bench}

eb, b = reg("b")
p1 = b.post(f"{API}/onboarding/property", json={"name": "Beach house", "address": "1 Market St, San Francisco, CA", "geocode": GEO}).json()
b.post(f"{API}/onboarding/complete")
p2 = b.post(f"{API}/onboarding/property", json={"name": "Lake cabin", "address": "500 Lake Rd, Reno, NV", "geocode": {"unverified": True}, "new": True}).json()
rm = b.post(f"{API}/onboarding/rooms", json={"type": "kitchen", "label": "Kitchen", "property_id": p2["id"]}).json()
it = b.post(f"{API}/onboarding/rooms/{rm['id']}/items", json={"name": "Refrigerator", "category": "appliance", "brand": "Samsung", "model": "RF28R7351SR"}).json()
b.post(f"{API}/onboarding/complete", params={"property_id": p2["id"]})
print(json.dumps({"a": ea, "a_props": pa, "a_amen": am, "b": eb, "b_p1": p1["id"], "b_p2": p2["id"], "b_item": it["id"]}))
