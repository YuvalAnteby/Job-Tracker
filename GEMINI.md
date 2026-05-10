# Project: Job Tracker

## Overview

A personal job-search management system. Jobs are added manually via a web frontend or Telegram bot. On ingestion, an LLM compares the job posting against the master CV and produces a fit score, per-requirement gap analysis, and domain classification. The frontend provides a dashboard for tracking companies, jobs, and skill gaps over time.

## Monorepo Structure

```
/
├── backend/          ← NestJS (TypeScript) REST API
├── frontend/         ← React + Vite (TypeScript) SPA
└── infra/
    ├── .env                      ← single source of truth for all env vars
    ├── .env.example
    ├── docker-compose.yml        ← dev
    ├── docker-compose.prod.yml   ← production
    ├── docker-compose.tests.yml  ← E2E test isolation
    ├── Dockerfile.backend
    ├── Dockerfile.frontend
    └── init-scripts/             ← postgres init SQL
```

- Never mix imports across the `backend/` and `frontend/` boundary.
- Never suggest running `npm install` or scripts without specifying which workspace (`backend` or `frontend`).
- All environment variables are defined in `infra/.env`. Never hardcode values that belong there.
- When adding a new environment variable: add it to `infra/.env.example`, note which service consumes it (backend, frontend, or postgres), and use the correct prefix (`VITE_` for frontend, no prefix for backend).

## Tech Stack

| Layer      | Technology                                                                  |
| ---------- | --------------------------------------------------------------------------- |
| Backend    | NestJS, TypeScript, TypeORM, PostgreSQL                                     |
| Frontend   | React 19, Vite, TypeScript, Tailwind CSS                                    |
| Testing    | Jest + Supertest (backend), Vitest + React Testing Library + MSW (frontend) |
| Containers | Docker, docker-compose (dev / prod / tests)                                 |

## Roadmap (for context — do not implement ahead of schedule)

1. **Phase 1 — Core MVP:** NestJS backend with full ingestion flow, TypeORM entities, abstract LLM service (Gemini default), settings table, and React frontend dashboard.
2. **Phase 2 — Gap Summary:** Background job generation saving structured summaries to the DB, complete with a dedicated frontend view.
3. **Phase 3 — Telegram Bot:** Telegraf integration with secure chat ID whitelisting, multi-step job additions, and background summary notifications.

## Database

- Primary ORM is TypeORM.
- **Schema sync is intentional during MVP** (`synchronize: true` in dev). Do not replace with migrations until the schema stabilizes post-MVP.
- Raw SQL via `QueryRunner` or `DataSource.query()` is acceptable for complex reporting or performance-critical queries. Always add a comment explaining why raw SQL was necessary. Never use raw SQL for standard CRUD.
- The database runs in Docker. Never assume a locally installed PostgreSQL instance.
- All `POSTGRES_*` env vars are read from `infra/.env`. TypeORM will not initialize without them.

## Docker

- Dev: `docker compose -f infra/docker-compose.yml up -d --build`
- Prod: `docker compose -f infra/docker-compose.prod.yml up -d --build`
- Tests: `docker compose -f infra/docker-compose.tests.yml up --abort-on-container-exit`
- Services communicate internally via Docker service names on `jobtracker-net` (e.g. `postgres:5432`).
- Never suggest connecting to `localhost` for inter-service communication inside Docker.

## Swagger / API Documentation

- Swagger is enabled on the backend at `/api/docs`.
- Every controller must have `@ApiTags()`. Every endpoint must have `@ApiOperation()` and `@ApiResponse()`.
- This is non-negotiable — never generate an endpoint without Swagger decorators.

## Commit Message Convention

Always use Conventional Commits format:

```
<type>(optional scope): <short description>

Types: feat, fix, refactor, chore, test, docs, perf, ci
Examples:
  feat(cpu): add pagination to CPU search endpoint
  fix(frontend): correct nestClient base URL for prod
  chore(infra): update postgres image to 16-alpine
```

- Scope should match the affected area: `backend`, `frontend`, `infra`, or a module name (e.g. `cpu`, `gpu`).
- Never generate a generic commit message like "update files" or "fix bug".

## General Rules

- Never use `any` in TypeScript — applies to both backend and frontend.
- Always assume `"strict": true` in both `tsconfig.json` files.
- When scaffolding a feature end-to-end, always generate backend first, then frontend.
- Scoped instruction files (`.github/instructions/`) apply on top of these rules. In case of conflict, the scoped file takes precedence.
- This is a portfolio project targeting the Israeli high-tech industry. Code quality, structure, and documentation standards should reflect production-grade work.

<!-- End of Global Instructions -->
