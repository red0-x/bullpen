# Seed a fresh UI test host: first rental saved as typed (no pin) + onboarding complete. Prints email.
import uuid
import requests
from test_onboarding import API

email = f"test_ui7_{uuid.uuid4().hex[:6]}@example.com"
r = requests.post(f"{API}/auth/register", json={"name": "TEST UI7", "email": email, "password": "testpass123"})
s = requests.Session()
s.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
p = s.post(f"{API}/onboarding/property", json={"name": "Beach house", "address": "1600 Amphitheatre Parkway, Mountain View, CA",
                                               "geocode": {"unverified": True}}).json()
s.post(f"{API}/onboarding/complete")
print(email, p["id"])
