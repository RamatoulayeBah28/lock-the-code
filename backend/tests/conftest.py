import pytest
import psycopg2
from psycopg2.extras import RealDictCursor
from db import get_db
from fastapi.testclient import TestClient
from main import app
from auth import get_current_user

@pytest.fixture
def db():
    # setup
    conn = psycopg2.connect("postgresql://ramatoulaye@localhost/leetcode_review_test")
    yield(conn) # pause the fixture and hand whatever I yield to test

    # teardown
    cur = conn.cursor()
    cur.execute("TRUNCATE TABLE users, problems, problem_topics, problem_patterns, reviews CASCADE")
    conn.commit()
    conn.close()

@pytest.fixture
def client(db):
    def override_get_db():
        yield(db)

    def override_get_current_user():
        return {"id": "test_user_123", "clerk_email": "user123@gmail.com", "first_name": "Leo", "last_name": "Duck"}
    
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    yield TestClient(app)
    # clear the overrides
    app.dependency_overrides.clear()



    
