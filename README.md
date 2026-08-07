# Lock The Code

The only free technical interview study plan you need. Lock The Code uses SM-2 spaced repetition to surface the right LeetCode problem at the right time — so you actually remember patterns, not just grind and forget.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| Backend | FastAPI, Python, psycopg2 (raw SQL) |
| Database | PostgreSQL |
| Auth | Clerk |
| Payments | Stripe |
| AI | Anthropic Claude Opus 4.8 |
| Email | Resend |
| Icons | Font Awesome |
| Deploy | Vercel (frontend) + Railway (backend + DB) |

## Features

- **Problem library** — add problems with title, difficulty, topics, patterns, note, URL; full edit/delete
- **SM-2 spaced repetition** — confidence ratings (Forgot → Mastered) drive scheduling with per-problem easiness factor
- **Review queue** — daily card surfacing your most overdue problem
- **AI Tutor** — Socratic coding coach that guides you through problems using UMPIRE without giving away answers (Pro)
- **Mock Interviewer** — four interview types (Behavioral, System Design, Low-Level Design, LeetCode) with timer, code editor, structured feedback, and AI voice TTS (Pro)
- **Flashcard decks** — create custom decks manually or generate them with AI; front/back cards, pattern tags, spaced repetition, and edit-in-place (Pro)
- **Stripe billing** — free trial, monthly, annual, and lifetime plans with webhook-backed Pro status
- **Daily email notifications** — Resend-powered reminders when problems are due, skips problems already reviewed that day
- **Google Calendar sync** — ICS feed of your review schedule
- **Auth** — Clerk-powered sign-up/sign-in with per-user data isolation; account deletion cancels Stripe subscription and wipes all data
- **Contact form** — users can submit feedback and feature requests directly from the app

## Local development

### Backend with Docker (recommended)

Brings up Postgres, applies every migration, seeds reference data, and starts
the API with hot reload — one command.

```bash
cp backend/.env.example backend/.env   # fill in keys (see Environment Variables below)
docker compose up --build              # → http://localhost:8000/docs
```

`DATABASE_URL` from `backend/.env` is deliberately overridden in
`docker-compose.yml`, so the local stack can never reach the production
database — it always talks to the `db` container.

| Command | What it does |
|---|---|
| `docker compose up --build` | Start everything. Applies any new migrations first |
| `docker compose down` | Stop, **keep** the database |
| `docker compose down -v` | Stop and **wipe** the database volume |
| `docker compose logs -f backend` | Tail API logs |
| `docker compose exec backend psql $DATABASE_URL` | psql shell into the dev DB |
| `psql postgresql://postgres:postgres@localhost:5433/leetcode_review` | Same, from the host (port 5433 avoids clashing with a local Postgres) |

Source is bind-mounted, so editing a `.py` file reloads the server — no rebuild.
Rebuild only when `requirements.txt` changes.

#### How migrations are applied

`backend/db/migrate.sh` runs as a one-shot `migrate` service before the backend
starts, and records each applied file in a `schema_migrations` table. This
matters because most migrations here use bare `CREATE TABLE` / `ADD COLUMN`
without `IF NOT EXISTS`, so they cannot safely re-run — the ledger is what makes
`docker compose up` repeatable.

Re-run rules differ per file:

| File | Behavior |
|---|---|
| `db/migrations/*.sql` | Applied once each, tracked in the ledger |
| `db/seed.sql` | Re-run every time — it's `ON CONFLICT DO NOTHING`, so new topics/patterns land automatically |
| `db/seed_flashcards.sql` | Applied once — it has no `ON CONFLICT` and `flashcards` has no unique key, so re-running would duplicate every system card |

**To add a migration:** create `db/migrations/0NN_description.sql` (next number —
check `ls db/migrations | tail -1`; one number per migration, no duplicates),
then `docker compose up -d`. It applies on the next boot; no volume wipe needed.

**Production is separate.** Railway builds with `railpack` (see
`backend/railway.toml`), not this Dockerfile, and migrations there are applied by
hand in the Railway Query tab. Always run the migration on Railway **before**
deploying code that depends on the new column.

### Backend without Docker

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
DB_DIR=db PGHOST=localhost PGDATABASE=leetcode_review bash db/migrate.sh
uvicorn main:app --reload --port 8000
```

Prerequisites: Python 3.12+, PostgreSQL.

### Frontend

Prerequisites: Node.js 20+.

```bash
cd frontend
npm install
cp .env.local.example .env.local  # fill in NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, NEXT_PUBLIC_API_URL
npm run dev
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `CLERK_SECRET_KEY` | Yes | Clerk backend secret |
| `CLERK_JWT_KEY` | No | PEM key for offline JWT verification |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Yes | Clerk webhook secret (user.deleted handler) |
| `NOTIFY_SECRET` | Yes | Shared secret for cron auth + unsubscribe tokens |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `ANTHROPIC_API_KEY` | Yes | Claude API key (Tutor + Interviewer) |
| `RESEND_API_KEY` | Yes | Resend API key (email notifications) |
| `FRONTEND_URL` | Yes | e.g. `https://lockthecode.net` |
| `BACKEND_URL` | Yes | e.g. `https://lock-the-code-production.up.railway.app` |

## Webhooks

| Endpoint | Source | Purpose |
|---|---|---|
| `POST /webhook` | Stripe | Subscription lifecycle (activate, cancel, payment failed) |
| `POST /clerk/webhook` | Clerk | Cancel Stripe sub + delete user data on account deletion |
| `POST /notify/daily` | Cron (Railway) | Send daily review reminder emails |

## Roadmap

### Shipped
- [x] Problem CRUD with topics, patterns, difficulty, URL, notes
- [x] SM-2 spaced repetition with confidence ratings
- [x] Review queue
- [x] Clerk auth with per-user data isolation
- [x] Stripe billing (free trial, monthly, annual, lifetime)
- [x] AI Tutor mode (Claude Opus 4.8, Socratic/UMPIRE, streaming)
- [x] Mock Interviewer — 4 types (Behavioral, System Design, LLD, LeetCode), timer, code editor, structured feedback
- [x] AI voice TTS for interviewer (Web Speech API, sentence-boundary streaming)
- [x] Flashcard decks with edit-in-place, pattern tags, SRS session
- [x] AI flashcard generation (Claude, scope enforcement, preview + edit before save, duplicate avoidance)
- [x] Daily email notifications (Resend, timezone-aware, skips already-reviewed)
- [x] Google Calendar sync (ICS feed)
- [x] Account deletion webhook (cancels Stripe, cascades DB delete)
- [x] Contact / feedback form
- [x] Deploy (Vercel + Railway)
- [x] Deck color picker
- [x] Walkthrough of the app for new users
- [x] One-command local dev stack (Docker Compose, auto-migrations, hot reload)

### Next up

- [ ] **`BackgroundTasks` for the welcome email** — emails currently send synchronously inside
      `get_current_user` and the Stripe webhook, blocking a new user's first request and risking
      webhook retries _(one afternoon, zero infra)_
- [ ] **Redis cache for the problem list** — Railway Redis add-on + `redis-py`, cache-aside on
      `GET /problems` with invalidation on all four write paths _(one day)_
- [ ] **Integration tests for critical paths** — SM-2 scheduling and the Stripe webhook, the two
      places a silent break costs the most _(highest value on this list)_
- [ ] **Sentry for 5xx alerts** — nothing currently notifies on a production 500 _(one hour)_

### Backlog

- [ ] Rate limiting on AI endpoints (unbounded per-user spend today)
- [ ] Input length limits on request schemas
- [ ] Rollback handling in the DB connection pool
- [ ] `require_pro` dependency to replace four copies of the same gate
- [ ] Health check that actually queries the database
