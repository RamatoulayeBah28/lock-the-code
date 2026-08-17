# test valid session is recognized, missing auth rejected and user a cannnot see user b's data and vice versa

def test_me_returns_authenticated_user(client):
    response = client.get("/me")
    assert response.status_code == 200

    data = response.json()
    assert data["id"] == "test_user_123"
    assert data["clerk_email"] == "testuser@example.com"

def test_user_a_sees_only_own_problems(client_a, client_b):
    payload = {
        "title": "Two Sum",
        "difficulty": "easy",
        "note": "",
        "url": "",
        "topic_ids": [1],
        "pattern_ids": [1],
    }
    response = client_a.post("/problems", json=payload)
    assert response.status_code == 201

    response = client_b.get("/problems")
    assert response.status_code == 200
    assert response.json() == []


# def test_me_rejects_missing_auth(client):


