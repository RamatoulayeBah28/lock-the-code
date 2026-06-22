from fastapi import FastAPI, Depends, HTTPException

from db import get_db
from schemas import ProblemCreate, ProblemUpdate
from psycopg2.extras import RealDictCursor


app = FastAPI()


@app.post("/problems", status_code=201)
def create_problem(payload: ProblemCreate, db=Depends(get_db)):
    cur = db.cursor()

    # 1. INSERT into problems using payload.title, payload.difficulty, payload.note
    #    use RETURNING id, then cur.fetchone() to get the new problem's id
    cur.execute("INSERT INTO problems (title, difficulty, note) VALUES (%s, %s, %s) RETURNING id", (payload.title, payload.difficulty, payload.note))
    res = cur.fetchone()
    problem_id = res[0]

    # 2. loop over payload.topic_ids, INSERT into problem_topics for each one
    for topic_id in payload.topic_ids:
        cur.execute("INSERT INTO problem_topics (problem_id, topic_id) VALUES (%s, %s)", (problem_id, topic_id))

    # 3. loop over payload.pattern_ids, INSERT into problem_patterns for each one
    for pattern_id in payload.pattern_ids:
        cur.execute("INSERT INTO problem_patterns (problem_id, pattern_id) VALUES (%s, %s)", (problem_id, pattern_id))

    # 4. db.commit() once everything succeeded
    db.commit()

    # 5. return something useful to the client (e.g. the new problem's id)
    return { "id": problem_id, **payload.model_dump()}

@app.get("/problems")
def get_problems(db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT " \
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
    "GROUP BY problems.id, problems.title, problems.difficulty, problems.note ")
    return cur.fetchall()  # -> [{"id": 1, "title": "Two Sum"}, {"id": 2, "title": "Valid Parentheses"}]

@app.patch("/problems/{problem_id}")
def update_problem(problem_id: int, payload: ProblemUpdate, db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)

    cur.execute("UPDATE problems " \
    "SET title = COALESCE(%s, title), " \
        "difficulty = COALESCE(%s, difficulty), " \
        "note = COALESCE(%s, note) " \
    "WHERE id = %s ", (payload.title, payload.difficulty, payload.note, problem_id) )

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
        "GROUP BY problems.id, problems.title, problems.difficulty, problems.note ", (problem_id,)
    )
    return cur.fetchone()

@app.delete("/problems/{problem_id}", status_code=204)
def delete_problem(problem_id: int, db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        "DELETE FROM problems " \
        "WHERE problems.id = %s ", (problem_id,)
    )
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Problem not found")
    
    db.commit()







