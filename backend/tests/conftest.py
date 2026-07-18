import pytest
import psycopg2
from fastapi.testclient import TestClient
from main import app
from db import get_db
from auth import get_current_user

TEST_DB_URL = "postgresql://ramatoulaye@localhost/leetcode_review_test"

FAKE_USER = {
    "id": "test_user_123",
    "clerk_email": "testuser@example.com",
    "first_name": "Test",
    "last_name": "User",
}


@pytest.fixture
def db():
    conn = psycopg2.connect(TEST_DB_URL)
    yield conn
    cur = conn.cursor()
    cur.execute(
        "TRUNCATE TABLE reviews, problem_topics, problem_patterns, problems, users CASCADE"
    )
    conn.commit()
    conn.close()


@pytest.fixture
def client(db):
    def override_get_db():
        yield db

    def override_get_current_user():
        return FAKE_USER    

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    cur = db.cursor()
    cur.execute("INSERT INTO users (id, clerk_email, first_name, last_name) VALUES (%s, %s, %s, %s)", (FAKE_USER["id"], FAKE_USER["clerk_email"], FAKE_USER["first_name"], FAKE_USER["last_name"]))
    db.commit()
    
    yield TestClient(app)
    app.dependency_overrides.clear()
