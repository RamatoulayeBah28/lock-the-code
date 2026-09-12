def create_problem(client):
    topic_id = client.get("/topics").json()[0]["id"]
    pattern_id = client.get("/patterns").json()[0]["id"]

    response = client.post("/problems", json={
        "title": "Review Test Problem",
        "difficulty": "easy",
        "note": "",
        "url": "",
        "topic_ids": [topic_id],
        "pattern_ids": [pattern_id],
    })

    assert response.status_code == 201
    return response.json()["id"]


def test_review_queue_is_empty_for_new_user(client):
    response = client.get("/problems/today")

    assert response.status_code == 200
    assert response.json() is None


def test_review_problem_follows_sm2_progression(client):
    problem_id = create_problem(client)

    first = client.post(
        f"/problems/{problem_id}/review",
        json={"confidence": 5, "solved_status": "solved_alone"},
    )
    assert first.status_code == 200
    assert first.json()["new_interval_days"] == 1

    second = client.post(
        f"/problems/{problem_id}/review",
        json={"confidence": 5, "solved_status": "solved_alone"},
    )
    assert second.status_code == 200
    assert second.json()["new_interval_days"] == 6

    third = client.post(
        f"/problems/{problem_id}/review",
        json={"confidence": 5, "solved_status": "solved_alone"},
    )
    assert third.status_code == 200
    assert third.json()["new_interval_days"] == 16


def test_low_confidence_resets_review_schedule(client):
    problem_id = create_problem(client)

    for _ in range(3):
        response = client.post(
            f"/problems/{problem_id}/review",
            json={"confidence": 5},
        )
        assert response.status_code == 200

    response = client.post(
        f"/problems/{problem_id}/review",
        json={"confidence": 1, "solved_status": "not_solved"},
    )

    assert response.status_code == 200
    assert response.json()["new_interval_days"] == 1