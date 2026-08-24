# Job Tracker Agent Instructions

These instructions apply to the whole repository. More specific instructions
live in nested `AGENTS.md` files:

- `backend/AGENTS.md` for the NestJS API
- `frontend/AGENTS.md` for the React/Vite app

Codex loads instructions from the repository root down to the current working
directory, so the nested files add service-specific guidance when working in
those trees.

## Project Context

Job Tracker is a personal job-search management system. Jobs enter through the
web frontend or Telegram bot. The backend uses an LLM to compare postings with
the master CV, producing a fit score, requirement gap analysis, and domain
classification. The frontend provides the dashboard for jobs, companies, and
skill gaps.

Repository layout:

```text
backend/   NestJS + TypeScript REST API
frontend/  React + Vite + TypeScript SPA
infra/     Docker Compose files, Dockerfiles, and environment templates
specs/     Architecture and feature specifications
```

Read the relevant files in `specs/`, `PRODUCT.md`, and `DESIGN.md` before
implementing behavior or UI. The roadmap is phased; do not implement future
phase features ahead of the requested scope.

## Repo-Wide Rules
- Never scan any of the files from `.gitignore` unless you specifically need a specific folder or file from there. (e.g. node_modules, .env, dist, build etc.)
- Keep `backend/` and `frontend/` independent. Never mix imports across that
  boundary.
- When implementing an end-to-end feature, implement and verify the backend
  before the frontend.
- Use strict TypeScript. Never use `any`; prefer a specific type, `unknown`, or
  a generic.
- Use explicit return types on functions and methods, including async functions.
- Inspect existing code and conventions before adding abstractions or dependencies.
- All environment variables belong in `infra/.env`. Never hardcode values that belong there.
- New environment variables must also be added to `infra/.env.example`, with the
  consuming service noted.
- Use `VITE_` for frontend environment variables and no prefix for backend variables.
- The database is expected to run in Docker. Do not assume a locally installed PostgreSQL server.
- Do not use `localhost` for inter-service communication inside Docker; use
  Docker service names.
- For complex or performance-critical reporting, raw SQL is acceptable only with
  a comment explaining why. Use TypeORM for ordinary CRUD.

## Useful Commands

Always identify the workspace when giving or running npm commands:

```text
Backend:  npm --prefix backend run <script>
Frontend: npm --prefix frontend run <script>
```

Root Docker commands:

```text
npm run docker:dev
npm run docker:prod
npm run docker:down
npm run docker:logs
npm run docker:test:backend
```

## Change Conventions

- For new files, provide or describe the complete file.
- For existing files, identify the exact insertion or replacement location
  instead of reproducing unrelated content.
- Verify changes with the narrowest relevant workspace lint, build, and test
  commands.
- Use Conventional Commits: `feat`, `fix`, `refactor`, `chore`, `test`,
  `docs`, `perf`, or `ci`, with a scope such as `backend`, `frontend`,
  `infra`, or a feature module.
