from fastapi.testclient import TestClient
from src.app import app

client = TestClient(app)


def test_get_activities():
    resp = client.get("/activities")
    assert resp.status_code == 200
    data = resp.json()
    # Expect some known activity keys to be present
    assert "Chess Club" in data
    assert isinstance(data["Chess Club"], dict)


def test_signup_and_unregister_lifecycle():
    activity = "Chess Club"
    email = "pytest-user@example.com"

    # Ensure the test email is not already present; if it is, remove it first
    resp = client.get("/activities")
    assert resp.status_code == 200
    activities = resp.json()
    participants = activities[activity]["participants"]
    if email in participants:
        # remove to start from a clean state
        del_resp = client.delete(f"/activities/{activity}/participants", params={"email": email})
        assert del_resp.status_code == 200

    # Sign up
    signup_resp = client.post(f"/activities/{activity}/signup", params={"email": email})
    assert signup_resp.status_code == 200
    signup_data = signup_resp.json()
    assert "Signed up" in signup_data.get("message", "")

    # Confirm participant is present
    resp2 = client.get("/activities")
    activities2 = resp2.json()
    assert email in activities2[activity]["participants"]

    # Try signing up again (should fail with 400)
    duplicate = client.post(f"/activities/{activity}/signup", params={"email": email})
    assert duplicate.status_code == 400

    # Unregister
    del_resp = client.delete(f"/activities/{activity}/participants", params={"email": email})
    assert del_resp.status_code == 200
    del_data = del_resp.json()
    assert "Unregistered" in del_data.get("message", "")

    # Confirm removal
    resp3 = client.get("/activities")
    activities3 = resp3.json()
    assert email not in activities3[activity]["participants"]
