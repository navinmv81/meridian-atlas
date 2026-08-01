# Meridian Atlas — August Operating Layer Blueprint
Prepared as Program Orchestrator + Architect + UX Lead + Engineering Lead + Operations Lead, per the August Sprint Orchestrator Prompt. Grounded directly against the live repository and the governing documents (Virtual Team Role Specifications v3, Current State v11, August Operating Kit) — not written from memory of prior conversation alone.

---

## 1. Environment confirmation and role stance

**Program Orchestrator speaking.** Confirmed runtime: Claude Desktop app, Claude Pro subscription, with Claude Chat/Cowork (this session — design, schema, code drafting, file edits) and Claude Code (separate session, same Mac, real terminal, authenticated `wrangler`, Git) both operating against the same local repository. This session does not have live network access to Cloudflare's API — Claude Code is the runtime layer for migrations, deploys, and verification. That division is a hard technical fact of this environment, not a process preference, and it matches the Operating Kit's own Build/Release session model.

Two corrections to ground truth, found by reading the actual repo rather than trusting the docs alone:

1. **Canonical folder location has moved.** Current State v11 (§15.4) says the 11 frontend files live at `/Users/navinkumar/Desktop/MeridianAtlas/June Refresh/`. That path no longer exists — the live working folder is `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)/App/`. All paths below use this real location.
2. **`meridian-proxy`'s `index.js` is 4,624 lines**, not "13 routes, ~1,500 lines" as the last full audit recorded. It is already more than 3x past the Non-Negotiable Worker-split trigger (15 routes / ~1,500 lines). This directly decides Section 5 below: nothing new goes into `meridian-proxy`.

Everything else in this blueprint treats **Virtual Team Role Specifications v3** as authoritative for roles, rules, and process, and **Current State v11** as authoritative for live system facts (tables, Workers, row counts), reconciled against direct repo inspection where the two disagree.

Role stance per section: Section 2 — Architect. Section 3 — Architect + Program Orchestrator. Section 4 — Architect. Section 5 — Architect + Engineering Lead. Section 6 — UX Lead + Engineering Lead. Section 7 — Architect + Engineering Lead. Section 8 — Entities Product Lead + Architect. Section 9 — Program Orchestrator. Section 10 — Operations Lead. Section 11 — Engineering Lead.

---

## 2. Implementation decision

**Architect speaking.**

Build one new Cloudflare Worker, `meridian-ops`, owning four new D1 tables (`sprintboarditems`, `releaseledger`, `operationalevents`, `openfigicache`), all in the shared `meridian-etf` database. Extend the existing `ma-ops.js` panel with an internal tab bar (System Health / Sprint Board / Release Ledger / Events / Drift) rather than building a second dashboard. Add two new generic Worker-call functions to `ma-data.js` and route every new frontend call through them — this is the first place in the codebase that will actually honor the "no inline fetch() in modules" rule as literally written, since `ma-ops.js` and `ma-13f.js` both currently call `fetch()` directly against their own hardcoded Worker URL constants. That existing pattern is left alone; new code does not repeat it.

OpenFIGI resolution stays exactly where it already lives — `meridian-entities-figi`, deployed and live as of today's first production batch (968/1000 OpenFIGI matches, 611 written to `instrument_entity_map`) — under the Entities Product Lead domain. The one addition is `openfigicache`, so the 35.7% "matched by OpenFIGI but not in `entity_master`" group from today's run can be re-checked later without spending OpenFIGI API calls again.

No alternative options are presented, per the mission's instruction.

---

## 3. Concrete build scope

| Component | Type | Notes |
|---|---|---|
| `meridian-ops` Worker (`ops-api.js`) | Worker/backend | New. On-request only, no cron. |
| `sprintboarditems` table | D1 schema | New. Core. |
| `releaseledger` table | D1 schema | New. Core. |
| `operationalevents` table | D1 schema | New. Core (append-only). |
| `openfigicache` table | D1 schema | New. Derived/Cache. Owned jointly: written by `meridian-entities-figi` (Entities domain), read by `meridian-ops` (Ops domain) — see Section 8 for the boundary rule this requires. |
| One-time seed script (`seed-ops-tables.js`) | Deployment logic | Migrates the current real state of `Sprint_Board.md` / `Release_Ledger.md` into the new tables so the board doesn't start empty or fictional. |
| `entities-figi.js` cache-write | Operational logic | Small additive change: write every OpenFIGI response (matched or not) to `openfigicache`, not just successful `instrument_entity_map` inserts. |
| `ma-data.js` — `data_opsGet` / `data_opsPost` | Frontend | New generic Worker-call wrappers. |
| `ma-ops.js` — tab bar + 5 new views | Frontend | New `ops_`-prefixed functions (see Section 6 for the full list and naming-collision reasoning). |
| `index.html` | Frontend | No change required — the existing OPS nav entry point (`openOps()`) is unchanged; new views live inside the same panel. |
| `ma-entities.js` | Frontend | Optional, out of core scope — see Section 6.4. |
| Migration file `001-ops-schema.sql` | Deployment logic | New folder: `App/Ops/migrations/`. |
| `wrangler-ops.toml` | Deployment logic | New. |

---

## 4. D1 schema to implement

All four tables live in the existing shared `meridian-etf` database (ID `43e80149-5333-4917-b678-6a8218ca4f93`). Per the Non-Negotiable table-classification rule, each is declared below with class, rows at launch, rows/month, rows at 12 months, and retention rule.

### 4.1 `sprintboarditems` — **Core**

```sql
CREATE TABLE IF NOT EXISTS sprintboarditems (
  ticket_id        TEXT PRIMARY KEY,          -- e.g. 'MA-AUG-001'
  title            TEXT NOT NULL,
  domain           TEXT NOT NULL,             -- 'Entities','ETF','13F','Filings','Ops','Equities','FixedIncome','Derivatives','Control'
  lane             TEXT NOT NULL CHECK(lane IN ('control','data_identity','application','ops','release')),
  stage            TEXT NOT NULL CHECK(stage IN (
                     'IDEA','PRODUCT_SPEC','ARCH_REVIEW','UX_REVIEW','ENG_DIAGNOSTIC',
                     'FOUNDER_APPROVAL','ENG_IMPLEMENT','OPS_RELEASE_REVIEW','RELEASE_READY',
                     'CLOSED','BLOCKED')),
  owner_role       TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','BLOCKED','CLOSED')),
  blocker          TEXT NULL,
  next_step        TEXT NULL,
  approval_needed  TEXT NULL,
  notes            TEXT NULL,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sprintboarditems_stage  ON sprintboarditems(stage);
CREATE INDEX IF NOT EXISTS idx_sprintboarditems_domain ON sprintboarditems(domain);
CREATE INDEX IF NOT EXISTS idx_sprintboarditems_lane   ON sprintboarditems(lane);
```

Rows at launch: ~10 (4 existing epics + this operating-layer epic + known fast-follow sub-items). Rows/month: 15–30. Rows at 12 months: ~250–350. Retention: none — permanent record; revisit with an archive table only if this ever exceeds a few thousand rows, which is not expected at this project's cadence.

### 4.2 `releaseledger` — **Core**

```sql
CREATE TABLE IF NOT EXISTS releaseledger (
  release_id                 TEXT PRIMARY KEY,        -- e.g. 'REL-2026-08-001'
  ticket_ids                 TEXT NOT NULL,            -- JSON array, e.g. '["MA-AUG-001"]'
  change_summary             TEXT NOT NULL,
  frontend_files             TEXT NULL,
  worker_files                TEXT NULL,
  d1_migration_status        TEXT NOT NULL DEFAULT 'none' CHECK(d1_migration_status IN ('none','pending','applied','failed','rolled_back')),
  worker_deploy_status        TEXT NOT NULL DEFAULT 'not_started' CHECK(worker_deploy_status IN ('not_started','in_progress','deployed','failed','rolled_back')),
  frontend_push_status        TEXT NOT NULL DEFAULT 'not_started' CHECK(frontend_push_status IN ('not_started','in_progress','pushed','failed','rolled_back')),
  verification_status        TEXT NOT NULL DEFAULT 'not_started' CHECK(verification_status IN ('not_started','in_progress','passed','failed')),
  production_parity_status   TEXT NOT NULL DEFAULT 'unknown' CHECK(production_parity_status IN ('unknown','aligned','diverged')),
  rollback_note               TEXT NULL,
  status                     TEXT NOT NULL DEFAULT 'NOT_READY' CHECK(status IN ('NOT_READY','READY','DEPLOYING','DEPLOYED','VERIFIED','ROLLED_BACK')),
  created_at                  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at                  DATETIME DEFAULT CURRENT_TIMESTAMP,
  closed_at                   DATETIME NULL
);
CREATE INDEX IF NOT EXISTS idx_releaseledger_status ON releaseledger(status);
```

Rows at launch: ~4 (current 4 epics' release rows, migrated from `Release_Ledger.md`). Rows/month: 5–15. Rows at 12 months: ~100–150. Retention: none — permanent deployment audit trail; tiny volume, real value.

### 4.3 `operationalevents` — **Core (append-only)**

```sql
CREATE TABLE IF NOT EXISTS operationalevents (
  event_id     INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type   TEXT NOT NULL CHECK(event_type IN (
                'packet_created','ticket_state_changed','gate_passed','gate_failed',
                'build_started','build_completed','worker_deployed','frontend_pushed',
                'migration_applied','verification_passed','verification_failed',
                'release_closed','release_rolled_back')),
  ticket_id    TEXT NULL,     -- references sprintboarditems.ticket_id
  release_id   TEXT NULL,     -- references releaseledger.release_id
  actor_role   TEXT NOT NULL, -- 'Architect','Engineering Lead','Operations Lead','Program Orchestrator','Founder','Claude Code'
  payload      TEXT NULL,     -- JSON, event-specific
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_operationalevents_ticket  ON operationalevents(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_operationalevents_release ON operationalevents(release_id, created_at);
CREATE INDEX IF NOT EXISTS idx_operationalevents_type    ON operationalevents(event_type, created_at);
```

Rows at launch: 0. Rows/month: 30–80 (every stage change, deploy, and verification at this project's real cadence). Rows at 12 months: ~500–1,000. Retention: none — this is the audit log the whole event-driven model depends on; matches the precedent already set by `issuerperiodsummary`'s explicit "no time-based prune" decision. Revisit only if volume becomes non-trivial, which is not expected.

### 4.4 `openfigicache` — **Derived/Cache**

```sql
CREATE TABLE IF NOT EXISTS openfigicache (
  instrument_key    TEXT PRIMARY KEY,   -- references instrument_master.instrument_key
  figi_name         TEXT NULL,
  figi_ticker       TEXT NULL,
  has_warning       INTEGER NOT NULL DEFAULT 0,
  normalized_name   TEXT NULL,          -- pre-computed normalizeName(figi_name)
  matched_entity_id INTEGER NULL,       -- entity_id found against entity_master AT CACHE-WRITE TIME; may be stale, re-check on reuse
  checked_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_openfigicache_normalized_name ON openfigicache(normalized_name);
```

Rows at launch: 0. Rows/month: up to ~30,000 in the first month while the current ~29,600-instrument backlog clears, then near-zero (new instruments only, as the ETF/13F universe grows). Rows at 12 months: ~55,000–70,000 (converges with `instrument_master`'s size). Retention: none — the entire point is to never re-ask OpenFIGI the same question twice; this is memory, not a cache in the prunable sense.

**Domain ownership, stated explicitly per the Non-Negotiable rule:** `sprintboarditems`, `releaseledger`, `operationalevents` are Ops-domain, owned by the Operations Lead / Program Orchestrator lane — no ETF, Entities, 13F, or Filings pipeline may write to them. `openfigicache` is the one deliberate cross-domain exception: it is written by `meridian-entities-figi` (Entities domain, at the point OpenFIGI is called) and read-only from `meridian-ops`. This is a data flow, not a write-boundary violation — only one Worker ever writes to it, matching the existing precedent of `meridian-entities-api` reading (never writing) ETF-domain tables for its exposure routes.

---

## 5. Worker and route build

**Architect + Engineering Lead speaking.**

**Decision: new Worker, not an extension.** `meridian-proxy`'s `index.js` is 4,624 lines against a ~1,500-line trigger — adding anything here would be adding to an already-overdue split, not a marginal extension. `meridian-entities-api` was considered and rejected: its domain is entity identity, not delivery operations, and mixing the two would blur exactly the boundary the Non-Negotiable Rules exist to protect.

**New Worker: `meridian-ops`**
- File: `App/Ops/src/ops-api.js`
- Config: `App/Ops/wrangler-ops.toml`
- No cron trigger — on-request only, matching the `meridian-entities-api` / `meridian-13f` / `meridian-filings` precedent for human-driven, low-volume Workers.
- D1 binding: same `meridian-etf` database, binding name `DB`.

**Routes:**

| Route | Method | Purpose | Emits event |
|---|---|---|---|
| `/api/ops/sprint-board` | GET | List all `sprintboarditems`, optionally `?stage=` filter | — |
| `/api/ops/sprint-board` | POST | Create a new ticket `{ticket_id, title, domain, lane, owner_role, ...}` | `packet_created` |
| `/api/ops/sprint-board/:ticket_id/stage` | POST | `{stage, actor_role, next_step?, blocker?, approval_needed?, notes?}` — validates the transition is a legal forward move or a BLOCKED/unblock pair (see Section 7), updates the row and inserts the event in one `env.DB.batch()` call | `ticket_state_changed` (+ `gate_passed`/`gate_failed` if payload specifies) |
| `/api/ops/release-ledger` | GET | List all `releaseledger` rows | — |
| `/api/ops/release-ledger` | POST | Create a new release packet | `packet_created` (payload `{packet_type:'release'}`) |
| `/api/ops/release-ledger/:release_id/event` | POST | `{event_type, payload, actor_role}` — one of `build_started/build_completed/worker_deployed/frontend_pushed/migration_applied/verification_passed/verification_failed/release_closed/release_rolled_back`; applies the matching column update from Section 7's state machine and inserts the event, atomically | (the `event_type` given) |
| `/api/ops/events` | GET | `?ticket_id=&release_id=&since=&limit=` — paginated timeline, `ORDER BY created_at DESC` | — |
| `/api/ops/drift` | GET | Compares `releaseledger` rows where `worker_deploy_status='deployed'` and `frontend_push_status != 'pushed'` (or the reverse) — surfaces frontend/backend parity gaps | — |
| `/api/ops/budget-risk` | GET | Reads today's `writes_today_` key from `holdings_pipeline_state` (same shared counter every pipeline already uses) against `DAILY_WRITE_LIMIT=80000` | — |
| `/api/ops/openfigi-status` | GET | Counts: `instrument_master` total, `instrument_entity_map` coverage, `openfigicache` hit count and no-existing-entity count | — |

Read/write budget declaration (comment at top of `ops-api.js`, per the three-point-check spirit even though this Worker carries no cron): every route is a single-digit number of indexed point queries or small list scans against tables that will hold, at most, a few thousand rows for the foreseeable life of this project. No route touches `fund_holdings_monthly`, `entity_master`, or any other high-volume table except `/api/ops/openfigi-status`'s two `COUNT(*)` queries, both of which hit indexed columns (`instrument_entity_map.instrument_key` PK, `openfigicache.instrument_key` PK).

---

## 6. Frontend file-level build plan

**UX Lead + Engineering Lead speaking.**

### 6.1 `ma-data.js` (currently 163 lines — Yahoo quote fetching + formatting helpers only; does not yet have a generic Worker-call wrapper, despite the Architecture doc's rule that all external calls should route through it)

Add:
```js
const OPS_WORKER_BASE = 'https://meridian-ops.navinmv1981.workers.dev';

async function data_opsGet(path) {
  return fetchWithTimeout(`${OPS_WORKER_BASE}${path}`);
}

async function data_opsPost(path, body) {
  try {
    const r = await fetch(`${OPS_WORKER_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await r.json();
    return { ok: r.ok, status: r.status, data };
  } catch (e) {
    return { ok: false, status: 0, error: e.message, data: null };
  }
}

window.data_opsGet = data_opsGet;
window.data_opsPost = data_opsPost;
```
This reuses the existing `fetchWithTimeout` helper already in the file. Note honestly: this is the *first* real use of the documented "route through data.js" rule for a dashboard-style call — `ma-ops.js`'s existing `openOps()` and `ma-13f.js`'s Worker calls both call `fetch()` directly today. That pre-existing pattern is left untouched; only new code follows the stricter rule.

### 6.2 `ma-ops.js` (currently 382 lines, single full-screen panel, no tabs)

Naming: the file's existing top-level functions (`openOps`, `closeOps`, `_renderOpsPanel`, `_svgGauge`, etc.) predate the `mgr_`/`ent_` collision-prevention convention adopted in Sprint 2/3 specifically because of the `_freshnessBadge` collision (Current State §7.4). All *new* top-level functions below use an `ops_` prefix to avoid repeating that risk; existing functions are not renamed.

New functions:
- `ops_renderTabBar()` — injects a 5-tab strip (System Health / Sprint Board / Release Ledger / Events / Drift) above the existing Section 1–6 content, which becomes the "System Health" tab's body unchanged.
- `ops_switchTab(tabName)` — shows/hides the corresponding section; remembers the last-viewed tab via `localStorage` (this is real deployed product code, not a Claude-generated artifact, so `localStorage` is appropriate here — unlike the restriction that applies to Claude.ai artifacts).
- `ops_loadSprintBoard()` / `ops_renderSprintBoard(data)` — calls `data_opsGet('/api/ops/sprint-board')`, renders ticket cards grouped by stage.
- `ops_changeTicketStage(ticketId)` — opens a small form (reusing `ma-modal.js`) to collect `{stage, next_step, blocker, approval_needed, notes}`, then `data_opsPost('/api/ops/sprint-board/'+ticketId+'/stage', ...)`, then reloads the board.
- `ops_loadReleaseLedger()` / `ops_renderReleaseLedger(data)`.
- `ops_recordReleaseEvent(releaseId)` — modal-driven event recording against `/api/ops/release-ledger/:id/event`.
- `ops_loadEventTimeline(filters)` / `ops_renderEventTimeline(data)`.
- `ops_loadDriftPanel()` / `ops_renderDriftPanel(data)`.
- `ops_loadBudgetRisk()` / `ops_renderBudgetRisk(data)` — reuses the existing (unprefixed, but same-file-scoped) `_svgGauge` helper.
- `ops_loadOpenFigiStatus()` / `ops_renderOpenFigiStatus(data)`.

`openOps()` itself gains one line — call `ops_renderTabBar()` after the existing panel is created — and is otherwise unchanged.

### 6.3 `index.html` (1,788 lines)

No change required. The existing OPS nav entry point already calls `openOps()`; the new tabs live inside that same panel. If, after seeing it, the tab bar feels like it deserves top-level nav entries instead of being nested inside OPS, that is a UX Lead decision to revisit later, not assumed here.

### 6.4 `ma-entities.js` (1,448 lines) — optional, out of core scope

The only plausible touch is a small "via OpenFIGI" source tag next to `instrument_entity_map` rows where `source='openfigi_tier1'`. This is genuinely optional polish, and rather than guess at a function name I haven't verified, this is flagged for the Engineering Lead's diagnostic pass at build time to identify the exact existing render function before touching it — not invented here.

---

## 7. Auto-update logic

**Architect + Engineering Lead speaking.**

**Event vocabulary** (13 types, `operationalevents.event_type` CHECK-constrained to exactly these — matches the Operating Kit's own list verbatim):
`packet_created`, `ticket_state_changed`, `gate_passed`, `gate_failed`, `build_started`, `build_completed`, `worker_deployed`, `frontend_pushed`, `migration_applied`, `verification_passed`, `verification_failed`, `release_closed`, `release_rolled_back`.

**Payload shape** (JSON in `operationalevents.payload`), by event type:
- `ticket_state_changed`: `{"from_stage":"ENG_IMPLEMENT","to_stage":"OPS_RELEASE_REVIEW"}`
- `gate_failed`: `{"gate":"ARCH_REVIEW","reason":"..."}`
- `worker_deployed`: `{"worker":"meridian-ops","version_id":"fca91563-..."}`
- `frontend_pushed`: `{"commit":"684b9e4","files":["ma-ops.js","ma-data.js"]}`
- `release_rolled_back`: `{"reason":"..."}` (required — enforced in the route handler, not just the schema)

**Sprint board state machine** (`sprintboarditems.stage`), same order already established in `Sprint_Board.md`:
`IDEA → PRODUCT_SPEC → ARCH_REVIEW → UX_REVIEW → ENG_DIAGNOSTIC → FOUNDER_APPROVAL → ENG_IMPLEMENT → OPS_RELEASE_REVIEW → RELEASE_READY → CLOSED`, with `BLOCKED` reachable from any stage and returning to the stage it left from once unblocked. The Worker route validates that a `ticket_state_changed` request only moves forward one step, or into/out of `BLOCKED` — it rejects arbitrary jumps, so the board cannot be put into an inconsistent state from a stray POST.

**Release ledger state machine** (`releaseledger` status columns), driven entirely by the event route:
- `build_started` → sets `worker_deploy_status` or `frontend_push_status` to `in_progress` (payload specifies which)
- `worker_deployed` → `worker_deploy_status = 'deployed'`
- `frontend_pushed` → `frontend_push_status = 'pushed'`
- `migration_applied` → `d1_migration_status = 'applied'`
- `verification_passed` → `verification_status = 'passed'`; if this is the last outstanding column, `releaseledger.status` auto-advances to `'VERIFIED'`
- `verification_failed` → `verification_status = 'failed'`, `status` reverts to `'NOT_READY'`
- `release_closed` → `status = 'DEPLOYED'` (or `'VERIFIED'` if already there), `closed_at = now`, and **cascades**: every `ticket_id` in the release's `ticket_ids` JSON array has its `sprintboarditems.stage` moved to `CLOSED` in the same `env.DB.batch()` call
- `release_rolled_back` → `status = 'ROLLED_BACK'`, `rollback_note` required

**Storage model:** every state-changing route wraps its `sprintboarditems`/`releaseledger` UPDATE and its `operationalevents` INSERT into one `env.DB.batch()` call, so the event log and the derived current-state tables never drift apart from a partial write. The board and ledger are never edited freehand — every field change is a side effect of an event being recorded.

---

## 8. OpenFIGI implementation placement

**Entities Product Lead + Architect speaking.**

No relocation — `meridian-entities-figi` is correctly placed under the Entities domain (identity/instrument resolution lane), already deployed, already live-verified against production today (first batch: 1000 considered, 968 OpenFIGI matches, 611 written to `instrument_entity_map`, 357 with no existing `entity_master` match, 32 with no OpenFIGI match at all).

**Cache key discipline:** `openfigicache.instrument_key` is the primary key, matching `instrument_entity_map`'s own key — a 1:1 relationship between "have we asked OpenFIGI about this instrument" and "has it been resolved." Every `/run` invocation writes to `openfigicache` for *every* instrument it considers, regardless of outcome — not just the ones that resolved to an existing entity. This is the one code change needed to `entities-figi.js`: currently it only writes `instrument_entity_map` rows for matches; it should additionally write (or upsert) an `openfigicache` row for every instrument in the batch, using `INSERT OR IGNORE` (never overwrite a previous check) or `ON CONFLICT DO UPDATE SET checked_at = ...` if re-checking is intentional.

**Fallback logic:** the 357/1000 "OpenFIGI matched a name, but no existing `entity_master` row" group from today's run is not lost — it is now cheaply re-checkable by joining `openfigicache.normalized_name` against `entity_master.normalized_name` without spending another OpenFIGI API call, any time `entity_master` gains new rows (e.g. after the next `entities-seed.js` run, or after the `normalizeName()` CORP/CORPORATION gap is fixed). This becomes a new, cheap route candidate for a future sprint (`/api/ops/openfigi-status` already surfaces the count; a `/api/entities-figi/rematch` route is a natural fast-follow, not built here).

**UI placement:** surfaced only in the new OPS dashboard's "OpenFIGI status" tab (Section 6.2) — coverage percentage, cache hit count, unmatched-but-cached count. Not surfaced on the entity/Issuer page in this scope (see Section 6.4 — optional, deferred).

**Table-boundary rule, restated:** `openfigicache` may only ever be written by `meridian-entities-figi`. It must never write to `entity_master` directly (no auto-creation of entities from OpenFIGI names — this was already an approved decision from the original MA-AUG-001 diagnostic and remains unchanged) and must never overwrite GLEIF-sourced canonical entity facts. `meridian-ops` only reads it.

---

## 9. Build sequence

As if coding starts now, in Claude Code, in this exact order — each step gates the next:

1. **Migration** — `App/Ops/migrations/001-ops-schema.sql` creates all four tables + indexes from Section 4. Run via `wrangler d1 execute meridian-etf --remote --file=...`. **Gate:** row count sanity check (all four start at the declared "rows at launch" figure or zero).
2. **`meridian-ops` Worker** — write `ops-api.js` with all 9 routes from Section 5, `wrangler-ops.toml` with no `[triggers]`. Deploy. **Gate:** `curl` each GET route once, confirm empty-but-valid JSON (no schema errors) before any data exists.
3. **Seed script** — `seed-ops-tables.js`, one-time, migrates the real current content of `Sprint_Board.md` and `Release_Ledger.md` (4 tickets, their real stages/statuses/decisions) into `sprintboarditems` and `releaseledger` via the new POST routes — not raw SQL, so the event log correctly records `packet_created` for each. **Gate:** GET `/api/ops/sprint-board` shows all 4 real tickets at their real current stages (MA-AUG-001 unblocked/implement, MA-AUG-002 verified/cadence-pending, MA-AUG-003 and 004 still PRODUCT_SPEC).
4. **`ma-data.js`** — add `data_opsGet`/`data_opsPost`. **Gate:** none needed, pure addition, no existing function touched.
5. **`ma-ops.js` — read-only views first** — tab bar, Sprint Board view, Release Ledger view (no write actions yet). **Gate:** open OPS in a real browser, confirm all 4 tickets render correctly, confirm the existing System Health tab is pixel-identical to today's `ma-ops.js` behavior (regression check).
6. **`ma-ops.js` — write actions** — `ops_changeTicketStage`, `ops_recordReleaseEvent`. **Gate:** change one real ticket's stage through the UI, confirm the event lands in `operationalevents` and the board reflects it on reload.
7. **Event timeline + drift + budget-risk + OpenFIGI-status tabs.** **Gate:** each renders without error against real (small or zero) data.
8. **`entities-figi.js` cache-write enhancement** — add the `openfigicache` write to the existing, already-deployed Worker. **Gate:** one supervised `/run` call, confirm `openfigicache` row count matches that run's `considered` count.
9. **Retroactive event backfill (optional)** — a short script inserting `operationalevents` rows for today's real MA-AUG-001/002 history (root-cause fix, migration, deploy, first batch), so the timeline has continuity from day one rather than starting mid-story. Optional — flag for founder decision, not assumed.

---

## 10. Verification and deployment

**Operations Lead speaking.**

**D1 plan checks:** `EXPLAIN QUERY PLAN` on every new query before deployment — all nine routes' queries hit either a primary key (`ticket_id`, `release_id`, `instrument_key`) or a newly-created index (`stage`, `domain`, `lane`, `status`, `ticket_id+created_at`, `release_id+created_at`, `event_type+created_at`, `normalized_name`); none should show `SCAN TABLE` on any table beyond the four new ones, which are trivially small.

**Budget checks:** this entire feature adds, at steady state, perhaps 30–80 D1 writes/month and a handful of reads per dashboard open — functionally zero against the shared 80,000/day write guard and 5M/day read ceiling. The one exception is `openfigicache`'s first-month backfill (~30,000 writes total, spread across the same batched `/run` calls `entities-figi.js` already makes, already governed by the existing shared `checkWriteBudget()` guard).

**Route tests:** for each of the 9 routes, one successful call and one deliberately malformed call (missing required field, invalid stage value) before considering the route done — confirms the CHECK constraints and route-level validation both actually reject bad input rather than silently corrupting state.

**UI checks:** open OPS before and after the change, screenshot both, confirm System Health tab renders identically (regression check per Section 9 step 5); confirm all 5 tabs are reachable and each loads without a console error.

**Worker deploy order:** migration first (Section 9 step 1), then `meridian-ops` deploy (step 2) — never deploy a Worker that assumes tables which don't exist yet.

**GitHub push order:** per the Non-Negotiable separation, pushing frontend files to GitHub Pages and running `wrangler deploy` are two separate actions that must both be recorded. Once `ma-data.js`/`ma-ops.js` changes are ready, commit and push to `corporate-atlas-v4-deploy-clean` (the branch GitHub Pages actually serves), and record both the Worker deploy and the frontend push as separate `operationalevents`/`releaseledger` column updates — this is exactly the drift the new Drift Panel exists to catch if it's ever missed.

**Post-release drift validation:** once live, open `/api/ops/drift` and confirm it reports no mismatch for this release's own `releaseledger` row — a clean self-test of the feature using the feature itself.

---

## 11. Immediate Claude Code brief

```
Work in: /Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)

Build the August Operating Layer per August_Operating_Layer_Blueprint.md in this folder.
Follow the Build Sequence in Section 9 exactly, in order, stopping at each gate to show me
the verification result before continuing. Do not skip ahead to later steps even if they
seem quick. Specifically:

1. Create App/Ops/migrations/001-ops-schema.sql with the 4 tables and indexes from
   Section 4. Run it against production meridian-etf via wrangler d1 execute --remote.
   Verify row counts.
2. Write App/Ops/src/ops-api.js implementing the 9 routes in Section 5's table, and
   App/Ops/wrangler-ops.toml (no cron trigger). Deploy. Curl each GET route once.
3. Write and run a one-time seed-ops-tables.js that POSTs the real current content of
   Sprint_Board.md and Release_Ledger.md into the new tables via the new routes.
4. Add data_opsGet/data_opsPost to ma-data.js exactly as specified in Section 6.1.
5. Extend ma-ops.js: tab bar + read-only Sprint Board + Release Ledger views first
   (Section 6.2's ops_-prefixed function list). Verify the existing System Health tab
   is unchanged before adding write actions.
6. Add the write actions (ops_changeTicketStage, ops_recordReleaseEvent), then the
   Event Timeline, Drift, Budget Risk, and OpenFIGI Status tabs.
7. Add the openfigicache write to the already-deployed entities-figi.js, per Section 8.
8. Run the verification checklist in Section 10 before considering this release-ready.

Do not add anything to App/ETF Refresh/src/index.js (meridian-proxy) — it is already
4,624 lines, well past the 1,500-line Worker-split trigger. Do not create new D1 tables
beyond the four specified. Do not enable any cron trigger — none of this needs one.
```
