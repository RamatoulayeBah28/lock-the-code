def test_no_problems_added(client):
    response = client.get("/problems")
    assert response.status_code == 200
    assert response.json() == []

def test_create_problem(client):
    topics = client.get("/topics").json()
    topic_id = topics[0]["id"]
    patterns = client.get("/patterns").json()
    pattern_id = patterns[0]["id"]

    response = client.post("/problems", json={
        "title": "Two Sum",
        "difficulty": "easy",
        "note": "",
        "url": "",
        "topic_ids": [topic_id],
        "pattern_ids": [pattern_id],

    })
    assert response.status_code == 201
    assert len(response.json()["topics"]) == 1
    assert len(response.json()["patterns"]) == 1

def test_invalid_difficulty(client):
    topics = client.get("/topics").json()
    topic_id = topics[0]["id"]
    patterns = client.get("/patterns").json()
    pattern_id = patterns[0]["id"]

    response = client.post("/problems", json={
        "title": "Valid Palindrome",
        "difficulty": "test",
        "note": "",
        "url": "",
        "topic_ids": [topic_id],
        "pattern_ids": [pattern_id],
    })
    assert response.status_code == 422
    