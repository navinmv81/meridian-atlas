# MA-OCT-002a — Task v1 (immutable): 002a build

**ISSUED BY:** Main Lane (Program Orchestrator), Sun 11 Oct · **EXECUTED BY:** LANE-1-ENG, Engineering Lead (Claude Code) · **REVIEWED BY:** Architect + ETF PL (close-out review, separate packet); Operations Lead (A4/A5 evidence); Data-Identity Lead (CR-5 / CR-7 conditions) · **APPROVED BY:** Founder

Build 002a from **`claude/MA-OCT-002_Spec.md` rev 1.3** (`9ec6773a2cf8be3ca855f1583bef148146d0ee6ae42a875407fc20dbfef23893`, approved 9 Oct): items **A1–A6** (§5.1), acceptance criteria **AC-a1…AC-a7** (§19.1), test plan §19.3, rollback §19.4 and every carry-forward item in **§19.5** (B-1, A-3…A-8, R-1…R-6). Binding conditions in the spec: Ops items (§0.1), Data-Identity Lead conditions §8.6 and §10.1 (C1–C6, L6-1 path (ii), L6-2), CR-6 (§10.2). Also binding: OPS-R3 F-1..F-5, OPS-R4 X-1..X-7 (lag sample), ML-0910-1 / ML-1010-3 (011 counts its delivered Ops writes).

## Priority and calendar (Main Lane ruling ML-1011-1 replaces spec §18's dates, which have passed)
A4 and A5 are on 011's critical path (011 runs Sat 17). **Order: A5 → A4 → A1/A2 → A3 → A6** (spec R-2: A4 and A5 before A6). A6 may slip past 002a; it only gates 003/004.

| Day | Work | Remote D1 writes |
|---|---|---|
| **Sun 11 (today)** | **First:** read `GET /api/ops/cf/d1-today` and record the account's writes today (Founder reports ≈ 80% used at 07:09 UTC after the holdings run). (1) `/usr/local/bin/wrangler whoami` — does the OAuth login carry Workers Scripts **read**? Put the answer in the first line of the report. (2) If yes: C1 deployed = repo downloads and diffs for `meridian-entities-delta`, `-seed`, `-figi`, `meridian-bootstrap` (read-only, §10.2). If no: skip and report — the Founder creates the Workers-Read token. (3) Local only: A5 gate code + `wrangler dev` tests; A4 code (outbox module `App/Corporate Atlas/lib/ops-outbox.mjs` per R-5, out-of-window `skipped`, `trigger` label, `d1-today` pre-flight, no wrangler/npx in the boost runner, 4.96.0 pin for FIRDS) + extended `boost-heartbeat-resilience.mjs`; A2 migration file + lateness unit tests. | **0.** No deploys today. |
| **Mon 12, after 08:00 UTC** | A5 deploys only after C1 passes for that Worker (else STOP, per L6-2): bootstrap `/trigger` removed; delta, seed, figi gated (one secret per Worker via `wrangler secret put`, checked first, constant-time compare, fail closed); AC-a5 401 tests ×2 per route. Then A2 migration + A1 registry load; `d1-today` lag sampled before, +1, +5, +15 min (R-5, F-4). | ≈ 160 |
| **Tue 13** | **ENT-CR1 runs first** in this lane under its own Control (08:05–10:30 UTC). **No 002 work before ENT-CR1 is verified** (RA-7). Afterwards: A3 sweep route + health-check revival (AC-a3) — needs the Founder for ≈ 5 min (Login Items → Allow in the Background + supervised first run); if he can't, move A3 to Wed. | ≤ 220 |
| **Wed 14** | A4 go-live: swap the new boost runner in and re-run its install script **outside 10:45–11:15 and 16:45–17:15 UTC**; observe the next two fires (AC-a4 count starts). FIRDS pin lands today (A-8). A6 if time remains. | ≈ 50 |
| **Thu 15** | Buffer; close-out evidence; report. | — |

**The live boost runner and its plist are not modified before the Wed 14 go-live.** Build the new runner beside it (e.g. `*.next.mjs`) and swap at go-live.

## Limits
- Build total **≤ 500 D1 writes, ≤ 50k reads** (AC-a7); record per-statement `meta`; any single execution ≤ 45k reads (GROUP BY / DISTINCT / ORDER BY without a covering index estimated at 2.5 × N).
- Before **every** remote write step: read `d1-today`; **stop if account writes today + the step's writes > 70,000**, or if `d1-today` is unreachable (fail closed).
- Freezes: `claude/relays/FREEZES.json` (Sun 04:00–07:05; Mon 03:30–08:00; enrich 05:50–07:10; bootstrap 07:55–08:05; boost bands 10:45–11:15 / 16:45–17:15; 23:50–00:10). No Entities Worker or boost change 17–23 Oct.
- Wrangler only as `/usr/local/bin/wrangler` (4.96.0); never `npx`.
- Secrets only via `wrangler secret put`; never printed, logged, committed or pasted. `OPS_INGEST_KEYS` entries hash-only; key files outside the repo and iCloud. Never print `.env*`.
- Do not switch on the health-check or financialfact "Allow in the Background" toggles yourself; the Founder does it at A3.

## Git (this lane is an authorised write lane)
- Branch `October-2026` only; fast-forward only; stage **explicit paths** (never `git add -A`); push after verifying; record each commit SHA in the report. Never touch `September-2026` or `corporate-atlas-v4-deploy-clean`.
- Never stage `.claude/settings.local.json`, `13F Seed/gleif-seed.js`, `Claude outputs/`, `.env*`, or any `~$*` file.
- Governance docs under `claude/` (rule 7) are committed **only** from a Main Lane commit list (`claude/packets/COMMIT_LIST_*.md`, with hashes); none is issued yet. Do not commit `claude/` files otherwise.

## Report
Append one dated section per build day to `claude/packets/MA-OCT-002a_Report.md`: what was done, AC evidence, D1 reads/writes (per statement and day total), `d1-today` readings, Worker version IDs (A-4), commits, deviations, blockers, Founder actions needed. **Stop at the end of each day's row** and reply one line: "MA-OCT-002a day <date> reported". The Founder says "continue" to start the next day.
