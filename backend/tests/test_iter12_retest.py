# Iteration 12 retest: rental palette index (distinct colours) consistent across /properties and /onboarding
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL").rstrip("/")


@pytest.fixture(scope="module")
def s():
    ses = requests.Session()
    r = ses.post(f"{BASE_URL}/api/auth/login", json={"email": "test_ui11@example.com", "password": "testpass123"})
    if r.status_code != 200:
        pytest.skip("login failed")
    ses.headers["Authorization"] = f"Bearer {r.json()['access_token']}"
    return ses


# Palette: /properties gives 0..n-1 distinct indexes in created order
def test_properties_palette_distinct(s):
    props = s.get(f"{BASE_URL}/api/properties").json()
    assert len(props) >= 3
    pal = [p["palette"] for p in props]
    assert pal == list(range(len(props)))
    assert all(isinstance(x, int) for x in pal)


# Palette: /onboarding?property_id matches /properties for every rental
def test_onboarding_palette_matches(s):
    props = s.get(f"{BASE_URL}/api/properties").json()
    for p in props:
        st = s.get(f"{BASE_URL}/api/onboarding", params={"property_id": p["id"]}).json()
        assert st["property"]["id"] == p["id"]
        assert st["property"]["palette"] == p["palette"], (p["name"], st["property"]["palette"], p["palette"])


# Palette: created_at values unique (otherwise count-based index in /onboarding can collide)
def test_created_at_unique(s):
    props = s.get(f"{BASE_URL}/api/properties").json()
    cs = [p["created_at"] for p in props]
    assert len(set(cs)) == len(cs), cs
