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
- **Mock Interviewer** — simulates a real technical interview with timer, code editor, and structured feedback (Pro)
- **Flashcard decks** — create custom decks with front/back cards, pattern tags, spaced repetition, and edit-in-place (Pro, one free try)
- **Stripe billing** — free trial, monthly, annual, and lifetime plans with webhook-backed Pro status
- **Daily email notifications** — Resend-powered reminders when problems are due, skips problems already reviewed that day
- **Google Calendar sync** — ICS feed of your review schedule
- **Auth** — Clerk-powered sign-up/sign-in with per-user data isolation; account deletion cancels Stripe subscription and wipes all data
- **Contact form** — users can submit feedback and feature requests directly from the app

## Local development

### Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in keys (see Environment Variables below)
uvicorn main:app --reload --port 8000
```

Run migrations in order:

```bash
for f in db/migrations/*.sql; do psql $DATABASE_URL < "$f"; done
```

Then seed reference data:

```bash
psql $DATABASE_URL < db/seed.sql
```

### Frontend

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
- [x] Mock Interviewer mode (timer, code editor, structured feedback)
- [x] Flashcard decks with edit-in-place, pattern tags, SRS session
- [x] Daily email notifications (Resend, timezone-aware, skips already-reviewed)
- [x] Google Calendar sync (ICS feed)
- [x] Account deletion webhook (cancels Stripe, cascades DB delete)
- [x] Contact / feedback form
- [x] Deploy (Vercel + Railway)

### Todo
- [ ] Deck color picker
- [ ] AI-generated flashcard content
- [ ] Tooltips throughout the app
- [ ] Rollback plan for production deploys
- [ ] Pattern filter on decks page
