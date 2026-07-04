from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from auth import get_current_user
from config import get_settings
from db import get_db
from schemas import ProblemCreate, ProblemUpdate, ReviewCreate
from stripe_routes import router as stripe_router
from chat_routes import router as chat_router
from psycopg2.extras import RealDictCursor


app = FastAPI()

_settings = get_settings()
print(f"[startup] CORS origins: {_settings.cors_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origins,
    allow_origin_regex=r"https://(lock-the-code.*\.vercel\.app|lockthecode\.net|www\.lockthecode\.net)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stripe_router)
app.include_router(chat_router)


@app.get("/me")
def get_me(user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT id, is_pro, subscription_status FROM users WHERE id = %s", (user["id"],))
    return cur.fetchone()


@app.get("/topics")
def get_topics(user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT id, topic FROM topics ORDER BY topic")
    return cur.fetchall()

@app.get("/patterns")
def get_patterns(user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT id, pattern FROM patterns ORDER BY pattern")
    return cur.fetchall()

@app.post("/problems", status_code=201)
def create_problem(payload: ProblemCreate, user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)

    cur.execute(
        "INSERT INTO problems (title, difficulty, note, url, user_id) VALUES (%s, %s, %s, %s, %s) RETURNING id",
        (payload.title, payload.difficulty, payload.note, payload.url, user["id"]),
    )
    problem_id = cur.fetchone()["id"]

    for topic_id in payload.topic_ids:
        cur.execute("INSERT INTO problem_topics (problem_id, topic_id) VALUES (%s, %s)", (problem_id, topic_id))

    for pattern_id in payload.pattern_ids:
        cur.execute("INSERT INTO problem_patterns (problem_id, pattern_id) VALUES (%s, %s)", (problem_id, pattern_id))

    db.commit()

    cur.execute(
        "SELECT "
        "problems.id, "
        "problems.title, "
        "problems.difficulty, "
        "problems.note, "
        "problems.url, "
        "array_agg(DISTINCT topics.topic) AS topics, "
        "array_agg(DISTINCT patterns.pattern) AS patterns "
        "FROM problems "
        "JOIN problem_topics ON problems.id = problem_topics.problem_id "
        "JOIN topics ON problem_topics.topic_id = topics.id "
        "JOIN problem_patterns ON problems.id = problem_patterns.problem_id "
        "JOIN patterns ON problem_patterns.pattern_id = patterns.id "
        "WHERE problems.id = %s "
        "GROUP BY problems.id, problems.title, problems.difficulty, problems.note, problems.url ", (problem_id,)
    )
    return cur.fetchone()


@app.get("/problems")
def get_problems(user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT " \
    "problems.id, " \
    "problems.title, " \
    "problems.difficulty, " \
    "problems.note, " \
    "problems.url, " \
    "array_agg(DISTINCT topics.topic) AS topics, " \
    "array_agg(DISTINCT patterns.pattern) AS patterns " \
    "FROM problems " \
    "JOIN problem_topics ON problems.id = problem_topics.problem_id " \
    "JOIN topics ON problem_topics.topic_id = topics.id " \
    "JOIN problem_patterns ON problems.id = problem_patterns.problem_id " \
    "JOIN patterns ON problem_patterns.pattern_id = patterns.id " \
    "WHERE problems.user_id = %s " \
    "GROUP BY problems.id, problems.title, problems.difficulty, problems.note, problems.url ", (user["id"],))
    return cur.fetchall()  # -> [{"id": 1, "title": "Two Sum"}, {"id": 2, "title": "Valid Parentheses"}]

@app.get("/problems/today")
def get_problem(user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT " \
    "problems.id, " \
    "problems.title, " \
    "problems.difficulty, " \
    "problems.note, " \
    "problems.url, " \
    "array_agg(DISTINCT topics.topic) AS topics, " \
    "array_agg(DISTINCT patterns.pattern) AS patterns " \
    "FROM problems " \
    "JOIN problem_topics ON problems.id = problem_topics.problem_id " \
    "JOIN topics ON problem_topics.topic_id = topics.id " \
    "JOIN problem_patterns ON problems.id = problem_patterns.problem_id " \
    "JOIN patterns ON problem_patterns.pattern_id = patterns.id " \
    "WHERE next_review_at <= now() AND problems.user_id = %s " \
    "GROUP BY problems.id, problems.title, problems.difficulty, problems.note ORDER BY next_review_at ASC LIMIT 1 ", (user["id"],))
    return cur.fetchone()

@app.patch("/problems/{problem_id}")
def update_problem(problem_id: int, payload: ProblemUpdate, user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)

    cur.execute("UPDATE problems " \
    "SET title = COALESCE(%s, title), " \
        "difficulty = COALESCE(%s, difficulty), " \
        "note = COALESCE(%s, note), " \
        "url = COALESCE(%s, url) " \
    "WHERE id = %s AND user_id = %s ", (payload.title, payload.difficulty, payload.note, payload.url, problem_id, user["id"]))

    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Problem not found")

    if payload.topic_ids is not None:
        cur.execute("DELETE FROM problem_topics WHERE problem_id = %s", (problem_id,))

        for topic_id in payload.topic_ids:
            cur.execute("INSERT INTO problem_topics (problem_id, topic_id) VALUES (%s, %s)", (problem_id, topic_id))
    if payload.pattern_ids is not None:
        cur.execute("DELETE FROM problem_patterns WHERE problem_id = %s", (problem_id,))
        for pattern_id in payload.pattern_ids:
            cur.execute("INSERT INTO problem_patterns (problem_id, pattern_id) VALUES (%s, %s)", (problem_id, pattern_id))

    db.commit()
    cur.execute(
        "SELECT " \
        "problems.id, " \
        "problems.title, " \
        "problems.difficulty, " \
        "problems.note, " \
        "array_agg(DISTINCT topics.topic) AS topics, " \
        "array_agg(DISTINCT patterns.pattern) AS patterns " \
        "FROM problems " \
        "JOIN problem_topics ON problems.id = problem_topics.problem_id " \
        "JOIN topics ON problem_topics.topic_id = topics.id " \
        "JOIN problem_patterns ON problems.id = problem_patterns.problem_id " \
        "JOIN patterns ON problem_patterns.pattern_id = patterns.id " \
        "WHERE problems.id = %s " \
        "GROUP BY problems.id, problems.title, problems.difficulty, problems.note, problems.url ", (problem_id,)
    )
    return cur.fetchone()

@app.delete("/problems/{problem_id}", status_code=204)
def delete_problem(problem_id: int, user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        "DELETE FROM problems " \
        "WHERE problems.id = %s AND problems.user_id = %s ", (problem_id, user["id"])
    )
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Problem not found")

    db.commit()

@app.post("/problems/{problem_id}/review")
def review_problem(problem_id: int, payload: ReviewCreate, user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)

    cur.execute(
        "SELECT current_interval_days, easiness_factor, repetitions FROM problems WHERE id = %s AND user_id = %s",
        (problem_id, user["id"])
    )
    row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Problem not found")

    # Map confidence 1-5 to SM-2 quality 0-5 (skipping q=1, which has no natural
    # equivalent in the 5-label set: Forgot→0, Weak→2, Okay→3, Good→4, Mastered→5)
    quality = {1: 0, 2: 2, 3: 3, 4: 4, 5: 5}[payload.confidence]

    ef = row["easiness_factor"]
    reps = row["repetitions"]
    interval = row["current_interval_days"]

    if quality < 3:
        new_reps = 0
        new_interval = 1
    else:
        new_reps = reps + 1
        if reps == 0:
            new_interval = 1
        elif reps == 1:
            new_interval = 6
        else:
            new_interval = round(interval * ef)

    new_ef = max(1.3, ef + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))

    cur.execute("INSERT INTO reviews (problem_id, confidence, solved_status) VALUES (%s, %s, %s)", (problem_id, payload.confidence, payload.solved_status))

    cur.execute(
        "UPDATE problems SET current_interval_days = %s, easiness_factor = %s, repetitions = %s, "
        "last_practiced = now(), next_review_at = now() + (%s * INTERVAL '1 day') WHERE id = %s",
        (new_interval, new_ef, new_reps, new_interval, problem_id)
    )

    db.commit()

    return {"problem_id": problem_id, "new_interval_days": new_interval, "new_ef": new_ef}
