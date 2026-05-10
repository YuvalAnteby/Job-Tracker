# Job Tracker — Backend Spec

## Database Schema

### `jobs`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `company_name` | `varchar(255)` | |
| `title` | `varchar(255)` | |
| `url` | `text` | Link to original posting |
| `description` | `text` | Full raw job description text |
| `domain` | `enum` | See Domain Enum below |
| `status` | `enum` | `ACTIVE / INACTIVE / APPLIED / DELETED` |
| `llm_score` | `int` | 0–100, produced by LLM at ingestion |
| `score_override` | `int` | Nullable — manual override |
| `effective_score` | `int` | **Computed**: `score_override ?? llm_score` |
| `llm_is_applicable` | `boolean` | LLM judgement at ingestion time |
| `is_applicable_override` | `boolean` | Nullable — manual override |
| `effective_is_applicable` | `boolean` | **Computed**: `is_applicable_override ?? llm_is_applicable` |
| `is_interesting` | `boolean` | Default `true` for all saved jobs |
| `is_interesting_override` | `boolean` | Nullable |
| `llm_domain` | `enum` | What LLM classified |
| `domain_override` | `enum` | Nullable — manual override |
| `effective_domain` | `enum` | **Computed**: `domain_override ?? llm_domain` |
| `llm_summary` | `text` | Short LLM-generated summary of the role |
| `added_at` | `timestamptz` | |
| `posted_at` | `timestamptz` | Nullable — if provided by user |
| `applied_at` | `timestamptz` | Nullable |
| `deleted_at` | `timestamptz` | Nullable — soft delete |
| `notes` | `text` | Nullable — user freetext notes |

> **Computed columns** are virtual (not stored) — calculated in the query layer or as TypeORM getters. This avoids sync issues when an override is removed.

---

### `job_requirements`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `job_id` | `uuid` FK → `jobs.id` | cascade delete |
| `requirement_text` | `text` | The requirement as stated in the posting |
| `met_status` | `enum` | `MET / NOT_MET / UNCERTAIN` |
| `reason` | `text` | LLM explanation (e.g. "Kafka listed as required; not present in CV") |
| `order` | `int` | Display order |

---

### `gap_summaries`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `generated_at` | `timestamptz` | |
| `domain_filter` | `enum` | Nullable — if generated for specific domain |
| `summary` | `jsonb` | Structured output (see below) |
| `job_count` | `int` | Number of jobs included |

**`summary` JSONB shape:**
```json
{
  "domains": {
    "BACKEND": {
      "missing_skills": ["Kafka", "gRPC"],
      "partially_known": ["Kubernetes"],
      "gaps_detail": "..."
    },
    "ML": { ... }
  },
  "overall_top_gaps": ["Kafka", "system design at scale", "Kubernetes"]
}
```

---

### `settings`

| Column | Type | Notes |
|---|---|---|
| `key` | `varchar(100)` PK | |
| `value` | `jsonb` | |
| `updated_at` | `timestamptz` | |

**Keys and their value shapes:**

| Key | Value shape | Default |
|---|---|---|
| `master_cv_url` | `"https://drive.google.com/..."` | — |
| `master_cv_cached_text` | `"Full CV text..."` | populated on refresh |
| `master_cv_cached_at` | `"2025-01-01T00:00:00Z"` | |
| `score_threshold` | `70` | |
| `applicable_domains` | `["BACKEND", "FULLSTACK"]` | |
| `domain_keywords` | `{"ML": ["machine learning","deep learning","LLM"], "DEVOPS": ["kubernetes","terraform","ci/cd"]}` | |
| `telegram_allowed_chat_ids` | `[123456789]` | |
| `llm_provider` | `"gemini"` | |
| `llm_model` | `"gemini-1.5-flash"` | |

---

### Domain Enum

```
BACKEND | FULLSTACK | ML | DEVOPS | OTHER | INTERESTED
```

- `INTERESTED` = jobs that don't match any defined domain, or that the user manually flags as interesting without a technical fit intent.
- Domain resolution logic at ingestion:
  1. If posting text contains explicit domain keyword (e.g. "ML Engineer", "DevOps") → use that
  2. Else if title/description matches `domain_keywords` config → use matched domain
  3. Else if title is generic ("Software Engineer", "Developer") → check if description aligns with `applicable_domains` → assign best match
  4. Else → `INTERESTED`

---

## LLM Service — Abstract Layer

```typescript
// llm/llm.interface.ts
export interface JobAnalysisResult {
  score: number;                    // 0–100
  is_applicable: boolean;           // score >= threshold
  is_interesting: boolean;
  domain: Domain;
  summary: string;
  requirements: {
    requirement_text: string;
    met_status: 'MET' | 'NOT_MET' | 'UNCERTAIN';
    reason: string;
  }[];
}

export interface GapSummaryResult {
  domains: Record<string, {
    missing_skills: string[];
    partially_known: string[];
    gaps_detail: string;
  }>;
  overall_top_gaps: string[];
}

export interface ILLMProvider {
  analyzeJob(jobDescription: string, cvText: string, threshold: number): Promise<JobAnalysisResult>;
  generateGapSummary(jobs: JobSummaryInput[], cvText: string, domainFilter?: string): Promise<GapSummaryResult>;
  extractTextFromImage(base64Image: string): Promise<string>;
}
```

**Providers:**
- `GeminiProvider` — active implementation
- `AnthropicProvider` — stub (throws `NotImplementedException`)
- `OpenAIProvider` — stub

Provider is resolved at startup from `settings.llm_provider`. Switching provider requires only a settings update.

---

### LLM Prompts

**Job Analysis Prompt (system):**
```
You are a technical recruiter assistant. You will receive a job description and a candidate's CV.
Analyze fit and return a JSON object with this exact structure:
{
  "score": <int 0-100>,
  "is_applicable": <bool>,
  "is_interesting": <bool>,
  "domain": <"BACKEND"|"FULLSTACK"|"ML"|"DEVOPS"|"OTHER"|"INTERESTED">,
  "summary": "<2-3 sentence role summary>",
  "requirements": [
    {
      "requirement_text": "<exact requirement from posting>",
      "met_status": <"MET"|"NOT_MET"|"UNCERTAIN">,
      "reason": "<brief explanation>"
    }
  ]
}
Scoring guide:
- 90-100: candidate meets virtually all requirements
- 70-89: meets core requirements, minor gaps
- 50-69: meets some requirements, notable gaps
- <50: significant gaps
is_applicable = score >= {threshold}
UNCERTAIN: use when CV is ambiguous or requirement is vague.
Return ONLY valid JSON. No markdown, no preamble.
```

---

## API Routes

### Jobs

| Method | Route | Description |
|---|---|---|
| `POST` | `/jobs` | Add new job — triggers LLM analysis |
| `GET` | `/jobs` | List jobs with filters |
| `GET` | `/jobs/:id` | Job detail (includes requirements) |
| `PATCH` | `/jobs/:id` | Update status, overrides, notes |
| `DELETE` | `/jobs/:id` | Soft delete |
| `DELETE` | `/jobs` | Bulk soft delete — body: `{ ids: string[] }` |

**POST /jobs — Request body:**
```json
{
  "company_name": "Google",
  "title": "Backend Engineer",
  "url": "https://linkedin.com/jobs/view/...",
  "description": "<full job description text>",
  "description_image_base64": null,
  "posted_at": "2025-01-10T09:00:00Z"
}
```
Either `description` or `description_image_base64` must be present. If image is provided, backend extracts text via LLM Vision first.

**GET /jobs — Query params:**
```
status=ACTIVE|INACTIVE|APPLIED|DELETED   (default: not DELETED)
domain=BACKEND|FULLSTACK|...
applicable=true|false
interesting=true|false
search=<freetext on title/company>
page=1&limit=20
sort=added_at:desc (default)
```

**PATCH /jobs/:id — Request body (all optional):**
```json
{
  "status": "APPLIED",
  "score_override": 85,
  "is_applicable_override": true,
  "is_interesting_override": false,
  "domain_override": "BACKEND",
  "notes": "Applied via LinkedIn Easy Apply",
  "applied_at": "2025-01-11T10:00:00Z"
}
```

---

### Gap Summary

| Method | Route | Description |
|---|---|---|
| `POST` | `/gap/generate` | Enqueue background gap analysis |
| `GET` | `/gap/latest` | Get latest summary (all or by domain) |
| `GET` | `/gap/history` | List past summaries |

**POST /gap/generate — Request body:**
```json
{
  "domain_filter": "BACKEND"   // null = all domains
}
```

**Response (202 Accepted):**
```json
{ "message": "Gap analysis enqueued. You will be notified via Telegram when ready." }
```

---

### Settings

| Method | Route | Description |
|---|---|---|
| `GET` | `/settings` | Get all settings (CV text excluded) |
| `PATCH` | `/settings` | Update one or more settings keys |
| `POST` | `/settings/cv/refresh` | Re-fetch CV from Google Drive URL, update cache |

---

## Telegram Bot

**Auth middleware:** every update is checked against `settings.telegram_allowed_chat_ids`. Unknown chat_id → silent ignore.

**Commands:**

| Command | Description |
|---|---|
| `/start` | Welcome message + command list |
| `/add` | Start guided job-add flow (multi-step conversation) |
| `/jobs [n]` | List last *n* jobs (default 5). Shows: company, title, score, status |
| `/applicable` | List jobs where `effective_is_applicable = true` |
| `/gap [domain]` | Trigger gap summary generation (background). Optional domain filter |
| `/status <id_prefix>` | Get status of a specific job by partial ID |
| `/help` | Command list |

**`/add` flow (multi-step):**
```
Bot: "Send me the job URL:"
User: https://linkedin.com/jobs/view/...
Bot: "Now paste the job description (or send a screenshot):"
User: <text or image>
Bot: "Company name? (or type 'skip' to let me extract it)"
User: Google
Bot: "Job title? (or 'skip')"
User: skip
Bot: ⏳ Analyzing...
Bot: ✅ Added! Score: 82/100 · Domain: BACKEND · Applicable: YES
     Missing: Kafka, Kubernetes
     View: /job_<short_id>
```

**Gap summary notification (sent automatically when background job completes):**
```
✅ Gap Analysis Ready (BACKEND · 12 jobs)

🔴 Missing: Kafka, gRPC, Kubernetes
🟡 Partial: Redis (basic usage, advanced patterns missing)

Top 3 skills to invest in:
1. Kafka — required in 8/12 jobs
2. Kubernetes — required in 6/12 jobs
3. gRPC — required in 4/12 jobs
```

---

## NestJS Module Structure

```
src/
├── app.module.ts
├── jobs/
│   ├── jobs.module.ts
│   ├── jobs.controller.ts
│   ├── jobs.service.ts
│   ├── entities/
│   │   ├── job.entity.ts
│   │   └── job-requirement.entity.ts
│   └── dto/
│       ├── create-job.dto.ts
│       ├── update-job.dto.ts
│       └── jobs-filter.dto.ts
├── gap/
│   ├── gap.module.ts
│   ├── gap.controller.ts
│   ├── gap.service.ts
│   └── entities/gap-summary.entity.ts
├── llm/
│   ├── llm.module.ts
│   ├── llm.service.ts          # resolves provider from settings
│   ├── llm.interface.ts
│   └── providers/
│       ├── gemini.provider.ts
│       ├── anthropic.provider.ts
│       └── openai.provider.ts
├── settings/
│   ├── settings.module.ts
│   ├── settings.service.ts     # typed get/set + CV refresh
│   └── entities/setting.entity.ts
└── telegram/
    ├── telegram.module.ts
    └── telegram.service.ts     # Telegraf bot setup + command handlers
```

---

## Error Handling Notes

- If LLM call fails at ingestion → job is saved with `llm_score = null`, `status = ACTIVE`, and a `llm_error` flag. User can trigger re-analysis manually via `PATCH /jobs/:id/reanalyze`.
- If Google Drive CV fetch fails → use `master_cv_cached_text`. If cache is also empty → return error to client.
- Telegram image submissions → forwarded as base64 to LLM Vision for text extraction before job analysis.
