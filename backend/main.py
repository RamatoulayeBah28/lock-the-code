from fastapi import FastAPI, Depends, HTTPException, Request
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response
import hashlib
import hmac
import requests
import resend
from auth import get_current_user
from config import get_settings
from db import get_db
from schemas import ProblemCreate, ProblemUpdate, ReviewCreate, NotificationSettings
from stripe_routes import router as stripe_router
from chat_routes import router as chat_router
from flashcard_routes import router as flashcard_router
from deck_routes import router as deck_router
from clerk_routes import router as clerk_router
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
app.include_router(flashcard_router)
app.include_router(deck_router)
app.include_router(clerk_router)

@app.get("/me")
def get_me(user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT id, is_pro, subscription_status FROM users WHERE id = %s", (user["id"],))
    return cur.fetchone()


@app.get("/topics")
def get_topics(db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT id, topic FROM topics ORDER BY topic")
    return cur.fetchall()

@app.get("/patterns")
def get_patterns(db=Depends(get_db)):
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

    if request.headers.get("NOTIFY_SECRET") != settings.notify_secret:
        raise HTTPException(status_code=403, detail="Forbidden")

    resend.api_key = settings.resend_api_key

    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        "SELECT p.user_id, COUNT(*) AS due_count, "
        "array_agg(p.title ORDER BY p.next_review_at ASC) AS titles, "
        "(SELECT p2.url FROM problems p2 "
        " WHERE p2.user_id = p.user_id "
        " AND p2.next_review_at::date <= CURRENT_DATE "
        " AND (p2.last_practiced IS NULL OR p2.last_practiced::date < CURRENT_DATE) "
        " ORDER BY p2.next_review_at ASC LIMIT 1) AS urgent_url "
        "FROM problems p "
        "JOIN users u ON p.user_id = u.id "
        "WHERE p.next_review_at::date <= CURRENT_DATE "
        "AND (p.last_practiced IS NULL OR p.last_practiced::date < CURRENT_DATE) "
        "AND u.email_notifications_enabled = TRUE "
        "AND u.email_notification_hour = EXTRACT(HOUR FROM now() AT TIME ZONE COALESCE(u.timezone, 'UTC'))::int "
        "GROUP BY p.user_id"
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
        count = row["due_count"]
        titles = row["titles"]
        urgent_title = titles[0]
        other_titles = titles[1:]
        urgent_url = row["urgent_url"] or "https://lockthecode.net/review"
        label = "problem" if count == 1 else "problems"
        others_html = (
            "<div style='margin-top:16px;border-top:1px solid #e5e7eb;padding-top:12px;'>"
            "<p style='color:#9ca3af;font-size:12px;font-weight:600;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.05em;'>Still to tackle</p>"
            "<ul style='margin:0;padding-left:18px;'>"
            + "".join(f"<li style='color:#6b7280;font-size:14px;margin:3px 0;'>{t}</li>" for t in other_titles)
            + "</ul></div>"
        ) if other_titles else ""
        unsub_token = _unsubscribe_token(row["user_id"], settings.notify_secret)
        unsub_url = f"{settings.backend_url}/unsubscribe/{row['user_id']}/{unsub_token}"

        html = f"""
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#ffffff;">
  <h2 style="font-size:22px;font-weight:600;color:#313628;margin:0 0 8px;">
    You have 1 problem due today &#128274;
  </h2>
  <p style="color:#6b7280;font-size:15px;margin:0 0 20px;">
    Start with the most overdue one:
  </p>
  <div style="background:#fafafa;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;margin:0 0 24px;">
    <p style="margin:0;color:#313628;font-size:16px;font-weight:600;">{urgent_title}</p>
    {others_html}
  </div>
  <a href="{urgent_url}"
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
    <p style="margin:4px 0 0;">
      <a href="{unsub_url}" style="color:#d1d5db;font-size:11px;">Unsubscribe</a>
    </p>
  </div>
</div>
"""

        resend.Emails.send({
            "from": "Lock The Code <contact@lockthecode.net>",
            "to": [email],
            "subject": "You have 1 problem due today",
            "html": html,
        })

    return {"notified": len(rows)}


@app.get("/settings/notifications")
def get_notification_settings(user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        "SELECT email_notifications_enabled, email_notification_hour, timezone FROM users WHERE id = %s",
        (user["id"],),
    )
    return cur.fetchone()


@app.patch("/settings/notifications")
def update_notification_settings(payload: NotificationSettings, user=Depends(get_current_user), db=Depends(get_db)):
    cur = db.cursor()
    cur.execute(
        "UPDATE users SET email_notifications_enabled = %s, email_notification_hour = %s, timezone = %s WHERE id = %s",
        (payload.enabled, payload.hour, payload.timezone, user["id"]),
    )
    db.commit()
    return {"ok": True}


@app.get("/unsubscribe/{user_id}/{token}")
def unsubscribe_email(user_id: str, token: str, db=Depends(get_db)):
    settings = get_settings()
    expected = _unsubscribe_token(user_id, settings.notify_secret)
    if not hmac.compare_digest(token, expected):
        raise HTTPException(status_code=403, detail="Invalid unsubscribe link")
    cur = db.cursor()
    cur.execute(
        "UPDATE users SET email_notifications_enabled = FALSE WHERE id = %s",
        (user_id,),
    )
    db.commit()
    return HTMLResponse(f"""
<html>
<head><title>Unsubscribed — Lock The Code</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:80px auto;padding:0 24px;text-align:center;">
  <img src="https://lockthecode.net/lock-the-code-fav.png" alt="Lock The Code" style="height:40px;width:auto;opacity:0.7;margin-bottom:24px;" />
  <h2 style="color:#313628;margin:0 0 8px;">You've been unsubscribed</h2>
  <p style="color:#6b7280;margin:0 0 24px;">You won't receive daily review reminders anymore.</p>
  <p style="color:#6b7280;font-size:14px;">
    Changed your mind? Re-enable emails in your
    <a href="{settings.frontend_url}/settings" style="color:#a20021;">settings</a>.
  </p>
</body>
</html>
""")


def _calendar_token(user_id: str, secret: str) -> str:
    return hmac.new(secret.encode(), user_id.encode(), hashlib.sha256).hexdigest()[:32]


def _unsubscribe_token(user_id: str, secret: str) -> str:
    return hmac.new(secret.encode(), f"unsub:{user_id}".encode(), hashlib.sha256).hexdigest()[:32]


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


# ── Code execution (Judge0 CE proxy) ──────────────────────────────────────────

_JUDGE0_LANGUAGE_IDS = {
    "python": 71,       # Python 3.8.1
    "javascript": 63,   # JavaScript Node.js 12.14.0
    "typescript": 74,   # TypeScript 3.7.4
    "java": 62,         # Java OpenJDK 13.0.1
    "cpp": 54,          # C++ GCC 9.2.0
    "go": 60,           # Go 1.13.5
}


class ExecuteRequest(BaseModel):
    language: str
    code: str


class ContactMessage(BaseModel):
    subject: str
    message: str


@app.post("/contact")
def submit_contact(body: ContactMessage, user=Depends(get_current_user)):
    settings = get_settings()
    if not settings.resend_api_key:
        raise HTTPException(status_code=503, detail="Email not configured")

    subject = body.subject.strip()
    message = body.message.strip()
    if not subject or not message:
        raise HTTPException(status_code=422, detail="Subject and message are required")

    # Look up sender email from Clerk so we can reply directly
    clerk_res = requests.get(
        f"https://api.clerk.com/v1/users/{user['id']}",
        headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
    )
    sender_email = ""
    if clerk_res.ok:
        addresses = clerk_res.json().get("email_addresses", [])
        if addresses:
            sender_email = addresses[0]["email_address"]

    resend.api_key = settings.resend_api_key
    resend.Emails.send({
        "from": "Lock The Code <contact@lockthecode.net>",
        "to": ["contact@lockthecode.net"],
        "reply_to": sender_email or "noreply@lockthecode.net",
        "subject": f"[Contact] {subject}",
        "html": f"""
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#ffffff;">
  <h2 style="font-size:20px;font-weight:600;color:#313628;margin:0 0 16px;">New contact message</h2>
  <p style="margin:0 0 4px;font-size:13px;color:#6b7280;"><strong>From:</strong> {sender_email or user['id']}</p>
  <p style="margin:0 0 4px;font-size:13px;color:#6b7280;"><strong>Subject:</strong> {subject}</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
  <p style="font-size:15px;color:#313628;white-space:pre-wrap;margin:0;">{message}</p>
</div>
""",
    })
    return {"ok": True}


@app.post("/execute")
async def execute_code(body: ExecuteRequest, user=Depends(get_current_user)):
    import httpx
    settings = get_settings()
    if not settings.judge0_api_key:
        raise HTTPException(status_code=503, detail="Code execution not configured — set JUDGE0_API_KEY")

    language_id = _JUDGE0_LANGUAGE_IDS.get(body.language, 71)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(
                "https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true",
                json={"source_code": body.code, "language_id": language_id},
                headers={
                    "Content-Type": "application/json",
                    "X-RapidAPI-Key": settings.judge0_api_key,
                    "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
                },
            )
        if not res.is_success:
            raise HTTPException(status_code=503, detail="Code execution service error")
        data = res.json()
        return {
            "stdout": data.get("stdout") or "",
            "stderr": (data.get("stderr") or "") + (data.get("compile_output") or ""),
            "exit_code": data.get("exit_code") or 0,
        }
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Code execution timed out")






