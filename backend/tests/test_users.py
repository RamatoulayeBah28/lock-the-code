# test valid session is recognized, missing auth rejected and user a cannnot see user b's data and vice versa
from fastapi.testclient import TestClient
from main import app
from db import get_db
from auth import get_current_user

def test_me_returns_authenticated_user(client):
    response = client.get("/me")
    assert response.status_code == 200

    data = response.json()
    assert data["id"] == "test_user_123"

def test_user_a_sees_only_own_problems(db):
    user_a = {
        "id": "user_a_123",
        "clerk_email": "usera@example.com",
        "first_name": "User",
        "last_name": "A",
    }
    user_b = {
        "id": "user_b_456",
        "clerk_email": "userb@example.com",
        "first_name": "User",
        "last_name": "B",
    }

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    app.dependency_overrides[get_current_user] = lambda: user_a
    client_a = TestClient(app)
    cur = db.cursor()
    cur.execute(
        "INSERT INTO users (id, clerk_email, first_name, last_name) VALUES (%s, %s, %s, %s)",
        (user_a["id"], user_a["clerk_email"], user_a["first_name"], user_a["last_name"]),
    )
    cur.execute(
        "INSERT INTO users (id, clerk_email, first_name, last_name) VALUES (%s, %s, %s, %s)",
        (user_b["id"], user_b["clerk_email"], user_b["first_name"], user_b["last_name"]),
    )
    db.commit()

    response = client_a.post("/problems", json={
        "title": "Two Sum",
        "difficulty": "easy",
        "note": "",
        "url": "",
        "topic_ids": [1],
        "pattern_ids": [1],
    })
    assert response.status_code == 201

    app.dependency_overrides[get_current_user] = lambda: user_b
    client_b = TestClient(app)
    response = client_b.get("/problems")
    assert response.status_code == 200
    assert response.json() == []

    app.dependency_overrides.clear()


# def test_me_rejects_missing_auth(client):


