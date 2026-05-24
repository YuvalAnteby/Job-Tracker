# Job Tracker — Config & Implementation Guide

## Configuration Philosophy

> **Rule:** Nothing that a user might want to tune should require a backend restart or rebuild.

All runtime config lives in the `settings` DB table.  
Secrets (API keys, DB credentials, bot token) live in `.env` — these are startup-time and do require a restart if changed, which is acceptable.

---

## Settings Reference

### `master_cv_url`
**Type:** `string`  
**Example:** `"https://docs.google.com/document/d/<doc_id>/edit"` or `"https://drive.google.com/file/d/<file_id>/view"`

The link to your CV. Supported formats:
1. **Google Docs**: Just paste the standard share link. The backend auto-converts it to a `.txt` export.
2. **Markdown/Text file in Google Drive**: Paste the share link. The backend auto-converts it to a direct download.
3. **Raw URL**: Any URL that returns plain text or markdown directly.

When `POST /settings/cv/refresh` is called:
1. Backend fetches this URL (applying auto-conversions for Drive/Docs)
2. Content is retrieved as raw text/markdown
3. Stores result in `master_cv_cached_text`
4. Updates `master_cv_cached_at`

---

### `master_cv_cached_text`
**Type:** `string`  
Set automatically by CV refresh. Passed as-is to LLM prompts. Do not edit manually unless necessary.

---

### `score_threshold`
**Type:** `number` (0–100)  
**Default:** `70`

Jobs with `effective_score >= score_threshold` have `effective_is_applicable = true`.  
Changing this setting does **not** retroactively recompute past jobs — those would need a re-analysis trigger. Future ingestion uses the new threshold immediately.

---

### `applicable_domains`
**Type:** `string[]`  
**Default:** `["BACKEND", "FULLSTACK"]`

Only jobs in these domains go through full applicability scoring. Jobs classified into other domains (ML, DEVOPS, etc.) are saved as `is_interesting = true` but `is_applicable = false` unless manually overridden.

---

### `domain_keywords`
**Type:** `Record<string, string[]>`  
**Default:**
```json
{
  "ML":     ["machine learning", "deep learning", "llm", "nlp", "pytorch", "tensorflow", "mlops"],
  "DEVOPS": ["kubernetes", "terraform", "ci/cd", "devops", "sre", "infrastructure", "helm"],
  "BACKEND":["backend", "back-end", "server-side", "api", "microservices"],
  "FULLSTACK": ["full stack", "fullstack", "full-stack"]
}
```

Used by the domain resolution logic when the LLM domain is not explicit. Keywords are matched case-insensitively against job title + first 500 chars of description.

**Domain resolution priority:**
1. LLM returns an explicit domain → use it
2. Title/description matches `domain_keywords` → use highest-confidence match
3. Title is generic + description aligns with `applicable_domains` domains → assign best match
4. Nothing matches → `INTERESTED`

---

### `telegram_allowed_chat_ids`
**Type:** `number[]`  
**Example:** `[123456789]`

Get your chat ID by messaging `@userinfobot` on Telegram.  
The bot silently ignores any message from an ID not in this list.

---

### `llm_provider`
**Type:** `"gemini" | "anthropic" | "openai"`  
**Default:** `"gemini"`

Switching provider:
1. Update `settings.llm_provider` and `settings.llm_model`
2. Make sure the corresponding API key is in `.env`
3. No restart needed — `LlmService` reads provider from settings on each call

---

### `llm_model`
**Type:** `string`  
**Default:** `"gemini-1.5-flash"`

Recommended models per provider:

| Provider | Recommended model | Notes |
|---|---|---|
| Gemini | `gemini-1.5-flash` | Fast, cheap, good at structured JSON |
| Gemini (higher quality) | `gemini-1.5-pro` | Use if flash output quality is insufficient |
| Anthropic | `claude-3-5-haiku-20241022` | Fast + cheap |
| Anthropic (reasoning) | `claude-sonnet-4-5` | Better gap analysis quality |
| OpenAI | `gpt-4o-mini` | Cost-efficient |

---

## Switching LLM Providers — Step-by-Step

1. Add API key to `.env`:
   ```env
   ANTHROPIC_API_KEY=sk-ant-...
   ```
2. Restart backend (only needed once to pick up new env var)
3. In the Settings UI (or via `PATCH /settings`):
   ```json
   { "llm_provider": "anthropic", "llm_model": "claude-sonnet-4-5" }
   ```
4. Next job added will use Anthropic. No code changes needed.

---

## Implementation Phases

### Phase 1 — Core MVP (do this first)

- [ ] Docker Compose with Postgres
- [ ] NestJS project scaffold (jobs, settings, llm modules)
- [ ] DB migrations: `jobs`, `job_requirements`, `settings` tables
- [ ] `SettingsService` with typed get/set
- [ ] `LlmService` with `GeminiProvider` (text-only, no image)
- [ ] `POST /jobs` — full ingestion flow (text description only)
- [ ] `GET /jobs`, `GET /jobs/:id`
- [ ] `PATCH /jobs/:id` — status + overrides
- [ ] `DELETE /jobs/:id` — soft delete
- [ ] React frontend: dashboard table + job detail modal + add job form
- [ ] CV refresh endpoint + Settings UI

### Phase 2 — Gap Summary

- [ ] `gap_summaries` table + migration
- [ ] `GapService` with background job (simple `setImmediate` or `setTimeout` for MVP)
- [ ] `POST /gap/generate` + `GET /gap/latest`
- [ ] Gap Summary page in frontend

### Phase 3 — Telegram Bot

- [ ] Telegraf setup in NestJS
- [ ] Auth middleware (chat_id whitelist from settings)
- [ ] `/add` multi-step flow
- [ ] `/jobs`, `/applicable`, `/gap` commands
- [ ] Telegram notification on gap summary completion

### Phase 4 — Polish

- [ ] Image upload in add-job form (frontend + LLM Vision extraction)
- [ ] Bulk delete in frontend
- [ ] `PATCH /jobs/:id/reanalyze` — retry failed LLM analysis
- [ ] `/gap/history` — past summaries list
- [ ] Redis + Bull for proper background jobs (replaces `setTimeout`)
- [ ] Mobile-responsive layout

---

## Local Development Setup

```bash
# 1. Clone repo, copy env
cp .env.example .env
# fill in GEMINI_API_KEY, TELEGRAM_BOT_TOKEN, etc.

# 2. Start DB
docker compose up postgres -d

# 3. Run backend
cd backend
npm install
npm run migration:run
npm run start:dev

# 4. Run frontend
cd frontend
npm install
npm run dev
```

For Telegram bot local dev, use `ngrok` or `localtunnel` to expose the backend webhook, or use polling mode (Telegraf supports both).

---

## Notes on Re-analysis

If a job was ingested before the current master CV was set, or if the LLM call failed at ingestion time, you can retrigger analysis:

```
PATCH /jobs/:id/reanalyze
```

This fetches the cached CV, re-runs the LLM prompt, and overwrites `llm_score`, `llm_is_applicable`, `llm_domain`, and all `job_requirements` rows. Any manual overrides (`score_override`, etc.) are preserved.

---

## Deduplication

Since ingestion is manual, hard deduplication is light:
- On `POST /jobs`, check if `url` already exists and is not soft-deleted → return `409 Conflict` with the existing job's ID.
- If the existing job is soft-deleted → allow re-adding (creates a new record).
