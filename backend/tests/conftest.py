import os
import pytest
import psycopg2
from fastapi.testclient import TestClient
from main import app
from db import get_db
from auth import get_current_user

TEST_DB_URL = os.environ.get("TEST_DB_URL", "postgresql://ramatoulaye@localhost/leetcode_review_test")

FAKE_USER = {
    "id": "test_user_123",
    "clerk_email": "testuser@example.com",
    "first_name": "Test",
    "last_name": "User",
}
FAKE_USER_A = {
    "id": "user_a_123",
    "clerk_email": "usera@example.com",
    "first_name": "User",
    "last_name": "A",
}

FAKE_USER_B = {
    "id": "user_b_456",
    "clerk_email": "userb@example.com",
    "first_name": "User",
    "last_name": "B",
}

@pytest.fixture
def db():
    conn = psycopg2.connect(TEST_DB_URL)
    try:
        yield conn
    finally:
        try:
            conn.rollback()
        except Exception:
            pass
    cur = conn.cursor()
    cur.execute(
        "TRUNCATE TABLE reviews, problem_topics, problem_patterns, problems, users CASCADE"
    )
    conn.commit()
    conn.close()

def make_client_for_user(user_payload, db):
    def override_get_db():
        yield db
    
    def override_get_current_user():
        return user_payload   
    
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user

    cur = db.cursor()
    cur.execute(
        "INSERT INTO users (id, clerk_email, first_name, last_name) VALUES (%s, %s, %s, %s)", 
        (
            user_payload["id"],
            user_payload["clerk_email"],
            user_payload["first_name"],
            user_payload["last_name"],
        ),
    )
    db.commit()

    client = TestClient(app)
    try:
        yield client
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def client(db):
    yield from make_client_for_user(FAKE_USER, db)

@pytest.fixture
def client_a(db):
    yield from make_client_for_user(FAKE_USER_A, db)

@pytest.fixture
def client_b(db):
    yield from make_client_for_user(FAKE_USER_B, db)



