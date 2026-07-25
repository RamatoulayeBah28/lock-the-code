# Lock The Code — Remaining Work

## How to use this file
Each task has the exact files to touch, the SQL/code to write, and which branch to use.
Work top to bottom — earlier tasks unblock later ones.

---

## 1. Orphaned row cleanup (Railway — no branch needed, just SQL)

Run these **one at a time** in Railway → Postgres → Query tab:

```sql
DELETE FROM problems WHERE id NOT IN (SELECT DISTINCT problem_id FROM problem_topics);
```
```sql
DELETE FROM problems WHERE id NOT IN (SELECT DISTINCT problem_id FROM problem_patterns);
```

If Railway times out, try wrapping in a CTE:
```sql
WITH orphans AS (SELECT id FROM problems WHERE id NOT IN (SELECT DISTINCT problem_id FROM problem_topics))
DELETE FROM problems WHERE id IN (SELECT id FROM orphans);
```

---

## 2. Commit dashboard label + search bar changes (branch: main)

Before the plane took off, these changes were made locally but not committed:
- Label opacity bumped from 0.5 → 0.75
- Required field asterisks added
- Topics/patterns search filter added
- Migration 020 (new topics/patterns) added

```bash
git add frontend/app/\(app\)/dashboard/page.tsx backend/db/migrations/020_seed_topics_patterns.sql
git commit -m "Add searchable topic/pattern filter and required field indicators"
git push
```

---

## 3. Deck color picker (branch: main or feature/deck-color)

### Step 1 — Migration
Create `backend/db/migrations/021_add_deck_color.sql`:
```sql
ALTER TABLE decks ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#56876D';
```
Apply locally: `psql -d leetcode_review -f backend/db/migrations/021_add_deck_color.sql`
Apply on Railway via Query tab.

### Step 2 — Backend
File: `backend/deck_routes.py`, function `update_deck` (line 44)

Change the UPDATE to include color:
```python
title = payload.get("title")
color = payload.get("color")

if title:
    cur.execute(
        "UPDATE decks SET title = %s WHERE id = %s AND author_id = %s",
        (title, deck_id, user["id"])
    )
if color:
    cur.execute(
        "UPDATE decks SET color = %s WHERE id = %s AND author_id = %s",
        (color, deck_id, user["id"])
    )
```

Also update the SELECT in `get_decks` (line 29) to include `d.color`:
```sql
SELECT d.id, d.title, d.color, d.author_id, d.created_at, COUNT(f.id) AS card_count
FROM decks d LEFT JOIN flashcards f ON f.deck_id = d.id
WHERE d.author_id = %s GROUP BY d.id, d.title, d.color, d.created_at
ORDER BY d.created_at DESC
```

### Step 3 — Frontend
File: `frontend/app/(app)/flashcards/page.tsx`

Find where decks are rendered and add a color dot / border.
Add a color picker input (native `<input type="color">`) in the deck edit modal.

On change, call `PATCH /decks/{id}` with `{ color: "#hex" }`.

Display the color as a left border or dot on the deck card:
```tsx
<div style={{ borderLeft: `4px solid ${deck.color ?? '#56876D'}` }}>
```

---

## 4. More integration tests (branch: testing)

File to create: `backend/tests/test_reviews.py`

### Test 1 — Review queue empty for new user
```python
def test_review_queue_empty(client):
    response = client.get("/problems/today")
    assert response.status_code == 200
    assert response.json() is None  # or [] depending on your endpoint
```

### Test 2 — Submit a review updates next_review_at
```python
def test_submit_review(client):
    # 1. create a problem first (copy setup from test_create_problem)
    # 2. POST /problems/{id}/review with confidence=5
    # 3. assert next_review_at is in the future
    # 4. assert current_interval_days > 1
    response = client.post(f"/problems/{problem_id}/review", json={"confidence": 5, "solved_status": "solved_alone"})
    assert response.status_code == 200
    assert response.json()["current_interval_days"] > 1
```

### Test 3 — Billing webhook signature rejection
File: `backend/tests/test_billing.py`
```python
def test_webhook_rejects_bad_signature(client):
    response = client.post("/billing/webhook",
        content=b'{"type": "checkout.session.completed"}',
        headers={"stripe-signature": "bad_sig"}
    )
    assert response.status_code == 400
```

After writing tests, merge testing → main:
```bash
git checkout main && git merge testing && git push
```

---

## 5. AI flashcard generation (branch: feature/ai-flashcards)

### Backend
File: `backend/deck_routes.py`

Add a new endpoint after line 72:
```python
@router.post("/decks/{deck_id}/generate")
def generate_flashcards(deck_id: int, payload: dict, user=Depends(get_current_user), db=Depends(get_db)):
    # 1. Fetch the deck title to use as context
    cur = db.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT title FROM decks WHERE id = %s AND author_id = %s", (deck_id, user["id"]))
    deck = cur.fetchone()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")

    topic = payload.get("topic", deck["title"])
    count = min(payload.get("count", 5), 10)  # cap at 10

    import anthropic
    from config import get_settings
    client_ai = anthropic.Anthropic(api_key=get_settings().anthropic_api_key)

    prompt = f"""Generate {count} flashcards for the topic: {topic}.
Return ONLY a JSON array, no explanation. Format:
[{{"front": "question", "back": "answer"}}, ...]
Keep fronts concise (the question/concept), backs thorough but under 3 sentences."""

    message = client_ai.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )

    import json
    cards = json.loads(message.content[0].text)

    # Insert cards into the deck
    inserted = []
    for card in cards:
        cur.execute(
            "INSERT INTO flashcards (front, back, deck_id, author_id) VALUES (%s, %s, %s, %s) RETURNING id, front, back",
            (card["front"], card["back"], deck_id, user["id"])
        )
        inserted.append(cur.fetchone())
    db.commit()
    return inserted
```

### Frontend
File: `frontend/app/(app)/flashcards/page.tsx`

Add a "Generate with AI" button inside the deck detail view.
On click, open a small modal asking for a topic (pre-filled with deck title) and card count (1–10).
POST to `/decks/{deck_id}/generate`, then append returned cards to the local state.

---

## 6. Security hardening (branch: feature/security)

### Rate limiting on AI endpoints
File: `backend/chat_routes.py`

Add a check before calling Claude. Use the existing `ai_interview_usage` table pattern from the plan:
```sql
CREATE TABLE ai_usage (
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    usage_date DATE NOT NULL,
    call_count INT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, usage_date)
);
```

Before each Claude call:
```python
cur.execute(
    "INSERT INTO ai_usage (user_id, usage_date, call_count) VALUES (%s, CURRENT_DATE, 1) "
    "ON CONFLICT (user_id, usage_date) DO UPDATE SET call_count = ai_usage.call_count + 1 "
    "RETURNING call_count",
    (user["id"],)
)
count = cur.fetchone()["call_count"]
db.commit()
if count > 20:  # 20 AI calls per day per user
    raise HTTPException(status_code=429, detail="Daily AI limit reached")
```

### Input length limits
File: `backend/schemas.py`

Import `Field` from pydantic and add max lengths:
```python
from pydantic import BaseModel, Field

class ProblemCreate(BaseModel):
    title: str = Field(..., max_length=200)
    difficulty: Literal["easy", "medium", "hard"]
    note: str | None = Field(None, max_length=2000)
    url: str | None = Field(None, max_length=500)
    topic_ids: list[int]
    pattern_ids: list[int]
```

---

## 7. Docker (branch: feature/docker)

Create `backend/Dockerfile`:
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Create `docker-compose.yml` at project root:
```yaml
version: "3.9"
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file:
      - ./backend/.env
    depends_on:
      - db
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: leetcode_review
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

Test locally:
```bash
docker compose up --build
```

---

## 8. Google Calendar ICS (already partially done)

The ICS endpoint and calendar sync buttons already exist on the dashboard.
The `/calendar/token` and `/calendar/{user_id}/{token}.ics` endpoints are live.

What's left: verify the ICS feed actually imports correctly into Apple Calendar and Google Calendar by testing it manually with your own account.

If the feed URL works → no code changes needed, just test it.
If it doesn't → check `backend/main.py` for the ICS route and verify the `DTSTART`/`DTEND` format matches RFC 5545.

---

## 9. AI Interviewer v2 (branch: feature/interviewer-v2)

All changes go in `frontend/app/(app)/chat/interview/page.tsx` unless noted.

### 9a — Reset after feedback
After the AI delivers its final feedback, show a "Start New Interview" button instead of keeping the user on the feedback screen.

In the interview page, detect when feedback has been delivered (you likely already set a `feedbackDelivered` state or similar). When true, render:
```tsx
<button onClick={() => resetInterview()}>Start New Interview</button>
```
`resetInterview()` clears all state and navigates back to the setup step (company, seniority, question type selection).

---

### 9b — Interview type selection step (new first setup step)

Before the current company/seniority screen, add a step that asks:
> "What kind of interview do you want to simulate?"

Four options as clickable cards:
- **LeetCode-style** — algorithm/data structures (current flow, unchanged)
- **Behavioral** — tell me about a time…
- **System Design** — design a distributed system
- **Surprise me** — AI picks randomly from the three

Add a `interviewType` field to your step state:
```tsx
type InterviewType = "leetcode" | "behavioral" | "system_design" | "any";
```

Then branch the rest of the setup flow based on this selection.

---

### 9c — Behavioral interview flow

**If user has a job description:**
1. Ask: "Do you have a job description?" → Yes / No buttons
2. If Yes: show a `<textarea>` to paste the JD + a file input to upload their resume PDF
3. Resume upload: send as `multipart/form-data` to a new backend endpoint `POST /chat/parse-resume` that extracts text via Claude and returns it as a string. Store in state.
4. Start interview — no code editor. Show the user's **camera feed** (`navigator.mediaDevices.getUserMedia({ video: true, audio: false })`) so they can see themselves while talking. Renders in a small pip-style box.
5. Backend prompt context: include `job_description` and `resume_text` so Claude asks targeted behavioral questions.

**If no job description (general behavioral):**
1. Show a text input: "What role are you targeting?" with placeholder options: `New Grad SWE`, `Full-Stack Developer`, `AI Engineer`, `Backend Engineer`
2. File input: upload resume (same parse flow as above)
3. Same camera feed + no code editor
4. Backend prompt: general behavioral for the specified role

**Camera implementation:**
```tsx
const videoRef = useRef<HTMLVideoElement>(null);

useEffect(() => {
  navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    .then(stream => {
      if (videoRef.current) videoRef.current.srcObject = stream;
    });
  return () => { /* stop tracks on cleanup */ };
}, []);

// Render:
<video ref={videoRef} autoPlay muted className="rounded-xl w-40 h-28 object-cover" />
```

---

### 9d — System design interview flow

Same setup as LeetCode-style (company + seniority), but:
- No algorithm question — AI opens with a system design prompt (e.g. "Design Twitter's feed")
- Keep the code editor (useful for drawing ASCII diagrams / jotting component names)
- Backend prompt context: `mode: "system_design"`, `company`, `seniority`
- Add `"system_design"` as a mode in `backend/chat_routes.py` alongside `"tutor"` and `"interviewer"`

---

### 9e — AI replies out loud (Text-to-Speech)

Use the browser's built-in `SpeechSynthesis` API — no backend changes, no cost, no API key.

```tsx
function speak(text: string) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  // Pick a natural-sounding voice if available
  const voices = speechSynthesis.getVoices();
  const preferred = voices.find(v => v.name.includes("Samantha") || v.name.includes("Google US English"));
  if (preferred) utterance.voice = preferred;
  speechSynthesis.speak(utterance);
}
```

Call `speak(newAssistantMessage)` after each complete AI response streams in.

Add a mute toggle button (speaker icon) so users can turn it off. Store `isMuted` in state and skip `speak()` when true.

---

### 9f — Backend prompt changes for new modes

File: `backend/chat_routes.py`

Add cases for `"behavioral"` and `"system_design"` in the system prompt builder. Current `"interviewer"` mode becomes the LeetCode-style mode.

```python
if mode == "behavioral":
    role_context = context.get("role", "Software Engineer")
    jd = context.get("job_description", "")
    resume = context.get("resume_text", "")
    system = f"""You are a senior engineering manager conducting a behavioral interview
for a {role_context} role. {"Job description: " + jd if jd else ""}
{"Candidate resume: " + resume if resume else ""}
Ask one behavioral question at a time using the STAR format.
After 4-5 questions, provide structured written feedback."""

elif mode == "system_design":
    company = context.get("company", "a tech company")
    seniority = context.get("seniority", "mid-level")
    system = f"""You are a {seniority} engineer at {company} conducting a system design interview.
Open with one system design question. Ask clarifying questions. Guide the candidate
through requirements, high-level design, deep dives, and trade-offs.
After 20 minutes of discussion, provide structured written feedback."""
```

---

## Branch summary

| Branch | Purpose |
|---|---|
| `main` | Ship fixes directly (labels, orphaned rows, migration 021) |
| `testing` | All new pytest tests |
| `feature/deck-color` | Deck color picker (backend + frontend) |
| `feature/ai-flashcards` | AI flashcard generation |
| `feature/security` | Rate limiting + input validation |
| `feature/docker` | Dockerfile + docker-compose |
| `feature/interviewer-v2` | Behavioral + system design flows, TTS, reset, camera |
