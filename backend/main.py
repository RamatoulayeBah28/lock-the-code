from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import hashlib
import hmac
import requests
import resend
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

@app.post("/notify/daily")
def notify_daily(request: Request, db=Depends(get_db)):
    settings = get_settings()
    print(type(settings))
    print(settings.model_dump())
    print(hasattr(settings, "notify_secret"))
    print(dir(settings))

    if request.headers.get("NOTIFY_SECRET") != settings.notify_secret:
        raise HTTPException(status_code=403, detail="Forbidden")

    resend.api_key = settings.resend_api_key

    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        "SELECT user_id, array_agg(title ORDER BY next_review_at) AS titles "
        "FROM problems "
        "WHERE next_review_at::date <= CURRENT_DATE "
        "GROUP BY user_id"
    )
    rows = cur.fetchall()

    for row in rows:
        clerk_res = requests.get(
            f"https://api.clerk.com/v1/users/{row['user_id']}",
            headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
        )
        if not clerk_res.ok:
            continue
        addresses = clerk_res.json().get("email_addresses", [])
        if not addresses:
            continue

        email = addresses[0]["email_address"]
        titles = row["titles"]
        count = len(titles)
        label = "problem" if count == 1 else "problems"
        items_html = "".join(
            f"<li style='margin:6px 0;color:#313628;font-size:15px;'>{t}</li>"
            for t in titles
        )

        html = f"""
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#ffffff;">
  <h2 style="font-size:22px;font-weight:600;color:#313628;margin:0 0 8px;">
    You have {count} {label} due today &#128274;
  </h2>
  <p style="color:#6b7280;font-size:15px;margin:0 0 20px;">
    Don't forget to practice daily, consistency is key.
  </p>
  <ul style="background:#fafafa;border:1px solid #e5e7eb;border-radius:10px;padding:16px 16px 16px 32px;margin:0 0 24px;list-style:disc;">
    {items_html}
  </ul>
  <a href="https://lockthecode.net/review"
     style="display:inline-block;background:#a20021;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none;padding:12px 28px;border-radius:9999px;">
    Start Reviewing &rarr;
  </a>
  <p style="color:#9ca3af;font-size:13px;margin:32px 0 24px;">
    You got this! Consistency beats cramming every time.
  </p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px;" />
  <div style="text-align:center;">
    <img src="https://lockthecode.net/lock-the-code-fav.png" alt="Lock The Code" style="height:36px;width:auto;opacity:0.7;" />
    <p style="color:#d1d5db;font-size:11px;margin:6px 0 0;">Lock The Code &middot; lockthecode.net</p>
  </div>
</div>
"""

        resend.Emails.send({
            "from": "Lock The Code <contact@lockthecode.net>",
            "to": email,
            "subject": f"You have {count} {label} due today",
            "html": html,
        })

    return {"notified": len(rows)}


def _calendar_token(user_id: str, secret: str) -> str:
    return hmac.new(secret.encode(), user_id.encode(), hashlib.sha256).hexdigest()[:32]


@app.get("/calendar/token")
def get_calendar_token(user=Depends(get_current_user)):
    settings = get_settings()
    token = _calendar_token(user["id"], settings.notify_secret)
    return {"token": token, "user_id": user["id"]}


@app.get("/calendar/{user_id}/{token}.ics")
def get_calendar_ics(user_id: str, token: str, db=Depends(get_db)):
    settings = get_settings()
    expected = _calendar_token(user_id, settings.notify_secret)
    if not hmac.compare_digest(token, expected):
        raise HTTPException(status_code=403, detail="Forbidden")

    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        "SELECT id, title, url, next_review_at FROM problems "
        "WHERE user_id = %s AND next_review_at IS NOT NULL "
        "ORDER BY next_review_at",
        (user_id,),
    )
    problems = cur.fetchall()

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Lock The Code//EN",
        "X-WR-CALNAME:Lock The Code Reviews",
        "X-WR-CALDESC:Your spaced repetition review schedule",
        "X-PUBLISHED-TTL:PT24H",
    ]

    for p in problems:
        dt = p["next_review_at"]
        date_str = dt.strftime("%Y%m%d")
        safe_title = (
            str(p["title"])
            .replace("\\", "\\\\")
            .replace(",", "\\,")
            .replace(";", "\\;")
        )
        lines += [
            "BEGIN:VEVENT",
            f"UID:ltc-{p['id']}@lockthecode.net",
            f"DTSTART:{date_str}T170000",
            f"DTEND:{date_str}T180000",
            f"SUMMARY:Practice {safe_title}",
            f"URL:{p['url'] or 'https://lockthecode.net/review'}",
            "END:VEVENT",
        ]

    lines.append("END:VCALENDAR")
    ics = "\r\n".join(lines) + "\r\n"
    return Response(content=ics, media_type="text/calendar; charset=utf-8")






