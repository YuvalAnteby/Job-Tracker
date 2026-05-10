# Job Tracker — Architecture

## Overview

A personal job-search management system. Jobs are added manually via a web frontend or Telegram bot. On ingestion, an LLM compares the job posting against the master CV and produces a fit score, per-requirement gap analysis, and domain classification. The frontend provides a dashboard for tracking companies, jobs, and skill gaps over time.

---

## Component Map

```
┌─────────────────────────────────────────────────────────────┐
│                        User                                 │
│          │ Browser                    │ Telegram            │
└──────────┼────────────────────────────┼─────────────────────┘
           │                            │
     ┌─────▼──────┐              ┌──────▼──────┐
     │  Frontend  │              │ Telegram Bot│
     │ React/Vite │              │  (Telegraf) │
     └─────┬──────┘              └──────┬──────┘
           │ HTTP/REST                  │ HTTP/REST
           └──────────────┬─────────────┘
                          │
                   ┌──────▼──────┐
                   │   Backend   │
                   │   NestJS    │
                   │             │
                   │ ┌─────────┐ │
                   │ │LLM Svc  │ │◄──► Gemini API
                   │ │(abstract│ │     (pluggable)
                   │ └─────────┘ │
                   │ ┌─────────┐ │
                   │ │ Gap Job │ │  (background)
                   │ └─────────┘ │
                   └──────┬──────┘
                          │
                   ┌──────▼──────┐
                   │ PostgreSQL  │
                   │  (Docker)   │
                   └─────────────┘
```

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Backend | NestJS + TypeScript | Consistent with existing projects |
| Frontend | React + Vite + Tailwind | No Next.js for now |
| Database | PostgreSQL 16 | Docker container |
| ORM | TypeORM | Familiar from other projects |
| LLM | Gemini API | Abstract layer — swappable |
| Telegram | Telegraf.js | NestJS-friendly |
| Background jobs | `@nestjs/bull` + Redis | Or simple in-memory queue for MVP |
| Containerization | Docker Compose | Runs on Windows |

---

## Data Flow

### Adding a Job (Ingestion)

```
User submits job
  (URL + description text/image)
        │
        ▼
Backend receives POST /jobs
        │
        ├─► If image → extract text via Gemini Vision
        │
        ├─► Fetch master CV text from settings
        │   (cached in DB, sourced from Google Drive)
        │
        ├─► LLM Analysis (synchronous, ~3–8s)
        │     ├── Score (0–100)
        │     ├── is_applicable (score >= threshold)
        │     ├── is_interesting flag
        │     ├── Domain classification
        │     └── Per-requirement breakdown
        │           ├── MET
        │           ├── NOT_MET
        │           └── UNCERTAIN
        │
        └─► Save to DB (jobs + job_requirements)
              └─► Return full job object to client
```

### Gap Summary (On-Demand, Background)

```
User triggers POST /gap/generate
  (optional domain filter)
        │
        ▼
Backend enqueues background job
        │
        ▼
Job runs:
  Fetch all non-deleted jobs from DB
  + master CV text
        │
        ▼
LLM generates structured gap summary
  grouped by domain
        │
        ▼
Save summary to gap_summaries table
        │
        ▼
Telegram notification → user
```

---

## Docker Compose Services

```yaml
services:
  postgres:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: jobtracker
      POSTGRES_USER: jobtracker
      POSTGRES_PASSWORD: <secret>
    ports:
      - "5432:5432"

  redis:          # Only needed if using Bull for background jobs
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    depends_on: [postgres, redis]
    env_file: .env
    ports:
      - "3000:3000"

  frontend:
    build: ./frontend
    ports:
      - "5173:80"

volumes:
  pgdata:
```

> **Note:** For MVP, Bull + Redis can be replaced with a simple `setImmediate`-based in-process queue to avoid the extra Redis container. Switch to Bull when/if needed.

---

## Environment Variables (`.env`)

```env
# DB
DATABASE_URL=postgresql://jobtracker:<pass>@postgres:5432/jobtracker

# LLM
LLM_PROVIDER=gemini
GEMINI_API_KEY=...

# Telegram
TELEGRAM_BOT_TOKEN=...
TELEGRAM_ALLOWED_CHAT_IDS=123456789   # comma-separated

# App
SCORE_THRESHOLD=70                    # default; overridable via settings table
PORT=3000
```

> All values in `.env` are **defaults and secrets only**. Runtime config (CV URL, threshold, domain rules) lives in the `settings` DB table and can be changed without restart.

---

## Project Directory Structure

```
job-tracker/
├── docker-compose.yml
├── .env
├── backend/
│   ├── src/
│   │   ├── jobs/
│   │   ├── gap/
│   │   ├── llm/
│   │   │   ├── llm.service.ts        # abstract interface
│   │   │   └── providers/
│   │   │       ├── gemini.provider.ts
│   │   │       └── anthropic.provider.ts  # stub
│   │   ├── telegram/
│   │   ├── settings/
│   │   └── app.module.ts
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── api/
│   ├── Dockerfile
│   └── package.json
└── specs/
    ├── ARCHITECTURE.md  (this file)
    ├── BACKEND.md
    ├── FRONTEND.md
    └── CONFIG.md
```
