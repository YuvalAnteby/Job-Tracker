# Job Tracker — Frontend Spec

## Stack

- React 18 + Vite
- Tailwind CSS
- React Router v6
- TanStack Query (React Query) — data fetching + cache
- TanStack Table — jobs list
- Axios — HTTP client
- `react-hot-toast` — notifications

---

## Routes

| Route | Page | Notes |
|---|---|---|
| `/` | Dashboard / Jobs List | Main view |
| `/jobs/:id` | Job Detail | Full job view (can also open as modal from `/`) |
| `/gap` | Gap Summary | On-demand skill gap view |
| `/settings` | Settings | CV, threshold, domain config |

---

## Pages

---

### `/` — Dashboard

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ Job Tracker              [+ Add Job]  [⚙ Settings] │
├──────────┬──────────────────────────────────────────┤
│ Filters  │  Jobs Table                              │
│          │                                          │
│ Domain ▼ │  Company  │ Title │ Score │ Domain │ Date│
│ Status ▼ │  ─────────────────────────────────────── │
│ Fit    ▼ │  Google   │ BE    │  82   │BACKEND │ ... │
│          │  Meta     │ FS    │  61   │FULLST. │ ... │
│ [Search] │  ...                                     │
│          │                                          │
│          │  [Select all] [Delete selected]          │
└──────────┴──────────────────────────────────────────┘
```

**Filter panel (left sidebar or top bar):**
- Domain: multi-select (BACKEND, FULLSTACK, ML, DEVOPS, OTHER, INTERESTED, All)
- Status: multi-select (ACTIVE, INACTIVE, APPLIED, DELETED hidden by default)
- Fit: All / Applicable only / Interesting only
- Freetext search: company name or title

**Jobs table columns:**
- Checkbox (for bulk select)
- Company name
- Job title
- Score badge (color-coded: green ≥ threshold, yellow 50–threshold, red <50). If override exists → show override score with a small ✏️ icon.
- Domain tag (pill)
- Status badge (ACTIVE / INACTIVE / APPLIED)
- Date added
- Actions: [View] [Mark Inactive] [Mark Applied] [Delete]

**Sorting:** by date added (default desc), score, company name.

**Bulk actions bar** (appears when ≥1 row selected):
```
3 jobs selected  [Mark Inactive] [Mark Applied] [Delete]
```

Bulk delete → confirmation modal before action.

---

### Job Detail — Modal or `/jobs/:id`

Opens as a **modal** when clicked from the dashboard (URL updates to `/jobs/:id` for shareability). Can also be navigated to directly.

```
┌─────────────────────────────────────────────────────┐
│ ← Back    Google — Backend Engineer         [✕]    │
│           Score: 82/100  ✏️               BACKEND  │
│           ACTIVE   [Mark Applied] [Mark Inactive]   │
│           Added: Jan 10, 2025  Posted: Jan 9, 2025  │
│                                    [🔗 Open Posting] │
├─────────────────────────────────────────────────────┤
│ LLM Summary                                         │
│ "A senior backend role focused on distributed       │
│  systems, requiring strong Kafka and gRPC skills."  │
├─────────────────────────────────────────────────────┤
│ Requirements                                        │
│                                                     │
│ ✅ Node.js / TypeScript          You have this      │
│ ✅ PostgreSQL                    You have this      │
│ ❌ Kafka                         Not in CV          │
│ ❌ Kubernetes                    Not in CV          │
│ ⚠️  System design at scale       CV shows some exp, │
│                                  unclear depth      │
│ ✅ REST API design               You have this      │
├─────────────────────────────────────────────────────┤
│ Notes (editable)                                    │
│ ┌─────────────────────────────────────────────────┐│
│ │ ...                                             ││
│ └─────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────┤
│ Overrides                                           │
│ Score override: [__] (blank = use LLM score)        │
│ Applicable:  ○ Auto (LLM)  ○ Yes  ○ No             │
│ Domain:  [BACKEND ▼] (blank = use LLM domain)       │
│                                          [Save]     │
├─────────────────────────────────────────────────────┤
│ Danger zone                                         │
│ [🗑 Delete Job]                                     │
└─────────────────────────────────────────────────────┘
```

**Visual legend for requirements:**
- ✅ Green — `MET`
- ❌ Red — `NOT_MET`
- ⚠️ Yellow — `UNCERTAIN`

Each requirement row is expandable to show the full `reason` text from LLM.

---

### `/gap` — Gap Summary

```
┌─────────────────────────────────────────────────────┐
│ Skill Gap Summary                                   │
│                                                     │
│ Domain filter: [All ▼]              [Generate New]  │
│                                                     │
│ Last generated: Jan 10, 2025 14:32 · 15 jobs       │
├─────────────────────────────────────────────────────┤
│ BACKEND (12 jobs)                                   │
│                                                     │
│ 🔴 Missing skills:                                  │
│    • Kafka (8 jobs)                                 │
│    • Kubernetes (6 jobs)                            │
│    • gRPC (4 jobs)                                  │
│                                                     │
│ 🟡 Partial knowledge:                               │
│    • Redis (basic → advanced patterns needed)       │
│    • System design (need to demonstrate scale)      │
│                                                     │
│ ────────────────────────────────────────────────    │
│ ML (3 jobs)                                         │
│ 🔴 Missing: PyTorch, MLflow, experience with LLMs  │
│ ...                                                 │
├─────────────────────────────────────────────────────┤
│ Overall top gaps (all domains):                     │
│ 1. Kafka  2. Kubernetes  3. PyTorch                 │
└─────────────────────────────────────────────────────┘
```

**"Generate New" button behavior:**
- POST `/gap/generate`
- Button becomes disabled with spinner
- Toast: "Generating gap analysis in background. You'll get a Telegram notification when ready."
- Page auto-refreshes `/gap/latest` when user revisits or after polling.

---

### `+ Add Job` — Modal

Triggered from the top nav button. Opens a modal.

```
┌─────────────────────────────────────┐
│ Add Job                        [✕] │
├─────────────────────────────────────┤
│ Company *                           │
│ [_______________________________]   │
│                                     │
│ Job Title *                         │
│ [_______________________________]   │
│                                     │
│ Job URL *                           │
│ [_______________________________]   │
│                                     │
│ Posted date (optional)              │
│ [_______________________________]   │
│                                     │
│ Job Description                     │
│ ○ Paste text  ● Upload image        │
│ ┌──────────────────────────────┐   │
│ │                              │   │
│ │  Drop image or click         │   │
│ │                              │   │
│ └──────────────────────────────┘   │
│                                     │
│              [Cancel]  [Analyze →]  │
└─────────────────────────────────────┘
```

After clicking "Analyze →":
- Button shows spinner + "Analyzing with AI..."
- On success → modal closes, new job appears at top of list, toast: "✅ Google — Backend Engineer added (Score: 82)"
- On LLM error → toast: "⚠️ Job saved but analysis failed. You can retry from the job detail."

---

### `/settings` — Settings

```
┌─────────────────────────────────────────────────────┐
│ Settings                                            │
├─────────────────────────────────────────────────────┤
│ Master CV                                           │
│ Google Drive URL:                                   │
│ [https://drive.google.com/...              ] [Save] │
│ Last fetched: Jan 10, 2025 10:00           [Refresh]│
│                                                     │
├─────────────────────────────────────────────────────┤
│ Scoring                                             │
│ Applicability threshold: [70] (0–100)      [Save]  │
│ (Jobs scoring ≥ this are marked as applicable)      │
│                                                     │
├─────────────────────────────────────────────────────┤
│ Domain Configuration                                │
│                                                     │
│ Applicable domains (jobs in these domains are       │
│ scored for applicability):                          │
│ [✅ BACKEND] [✅ FULLSTACK] [☐ ML] [☐ DEVOPS]      │
│                                                     │
│ Domain keywords (JSON editor):                      │
│ ┌─────────────────────────────────────────────────┐│
│ │{                                                ││
│ │  "ML": ["machine learning", "deep learning"],   ││
│ │  "DEVOPS": ["kubernetes", "terraform"]          ││
│ │}                                                ││
│ └─────────────────────────────────────────────────┘│
│                                          [Save]     │
├─────────────────────────────────────────────────────┤
│ LLM Provider                                        │
│ Provider: [gemini ▼]  Model: [gemini-1.5-flash ▼]  │
│                                          [Save]     │
└─────────────────────────────────────────────────────┘
```

---

## Shared Components

| Component | Description |
|---|---|
| `ScoreBadge` | Colored pill showing score. Green/Yellow/Red based on threshold. Shows ✏️ if override. |
| `DomainTag` | Small pill: BACKEND / FULLSTACK / ML / DEVOPS / INTERESTED |
| `StatusBadge` | ACTIVE (green) / INACTIVE (gray) / APPLIED (blue) |
| `RequirementRow` | ✅/❌/⚠️ icon + requirement text + expandable reason |
| `ConfirmModal` | Generic confirmation dialog with title + message + confirm/cancel |
| `JobFormModal` | Add job form |
| `JobDetailModal` | Full job view |
| `Toast` | Via `react-hot-toast` |

---

## State Management Notes

- All server state via **TanStack Query** (`useQuery`, `useMutation`)
- No global client state manager needed (Zustand/Redux overkill for this scope)
- Optimistic updates for status changes (mark inactive, mark applied)
- Job list query key: `['jobs', filters]` — invalidated after any mutation

---

## Responsive Considerations

- Primary use: desktop browser (full table view)
- Mobile: filter panel collapses to drawer, table becomes card list
- Not a priority for MVP
