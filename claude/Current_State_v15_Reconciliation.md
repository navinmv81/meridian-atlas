# Current State v15 — Reconciliation note (REC-01 … REC-05, AUD-06 files)

```text
PACKET:     MA-DEC-REC.DOC · Control v1 (44ee9eda…0c4fe) · Task v1 (ed4ea166…90dbc)
WRITTEN BY: Documentation Lead (LANE-DOC), run r-20261128T151538Z-3c78, 2026-11-28
BASE:       December-2026 HEAD 5af1351 = origin
STATUS:     For adoption into Current State v16 at C4 (REC-06). The .docx files are NOT edited.
```

**How to read the references.** `v14 ¶n` and `v15 ¶n` are paragraph numbers in a plain-text extraction of `Meridian_Atlas_Current_State_v14.docx` / `_v15.docx` (one non-empty `<w:p>` per line, extracted read-only with python `zipfile`). Table cells count as paragraphs. Repo files are cited as `path:line`. No D1, wrangler, Cloudflare API or network call was made for this note.

---

## REC-01 — KI 22.38, the token literals in public history

| | Text |
|---|---|
| **v14** | §24.6 KI register, v14 ¶447–450: "22.38 · Revoked token literals in public git history · — · **INERT.**" |
| **v15** | §24.6 carries the same row unchanged (v15 ¶410–413: "Revoked token literals … INERT."). §25.10 adds a Security row (v15 ¶701–704): "Read-only Ops GET routes public; two historical token literals in public git history (**revocation unconfirmed**) · High · OPEN — **carried from v14**." |

**Contradictions.**
1. Within v15, the same tokens are both "INERT" (§24.6) and "revocation unconfirmed / OPEN" (§25.10).
2. v15 says the Security row is "carried from v14", but v14 carries only the Ops GET routes as open (v14 ¶26 and ¶506). It does not carry the tokens as open. The "unconfirmed" wording came from somewhere else.

**Evidence.**
- "INERT" comes from `claude/October_Decisions_Log.md:16` (2026-09-24, F1): the Founder confirmed that both tokens in `c3a07c7` were already revoked (the MA-AUG-004 rotation). This is a Founder statement. No dashboard evidence was recorded with it.
- "Not confirmed" comes from `CLAUDE.md` (Environment Truth, `gleif-seed.js` security note, MA-OCT-000, 23 Sep): "Whether both historical tokens are revoked is **not confirmed**." That note was written one day before the 24 Sep statement and was never updated.
- `claude/packets/MA-DEC-ASSESS.SEC_Report.md` §4 (lines 161–183) and §6 F1 (line 214), 28 Nov:
  - There are two literals, fingerprinted only: T1 `2de0570c16a3` and T2 `0faf5d254b0a`, 93 characters each.
  - Both are in commit `c3a07c7`, which is reachable only from `origin/corporate-atlas-v4-deploy-clean`. The repo is public.
  - T2 is also on local disk, in the untracked `13F Seed/gleif-seed.js`.
  - No branch or tag tip holds either literal.
  - The report rates revocation "unconfirmed" and gives the Founder a dashboard checklist.
- `claude/December_Decisions_Log.md:17` (DML-1128-9, 28 Nov 15:08): the Founder said "as far as i know all api codes have been rotated". The log records this as a Founder statement that is **not yet evidence**, under spec SEC-03 ("confirm, or rotate rather than assume"). The same row waives the standing rule for one later edit: a packet may remove the T2 literal from the untracked file.

**Corrected text for v16** (one row; replaces both the §24.6 "INERT" row as current state and the token half of the §25.10 Security row):

> **22.38 — Token literals in public git history.** High · **OPEN, evidence pending.** Two Cloudflare API token literals (fingerprints T1 `2de0570c16a3`, T2 `0faf5d254b0a`) are in public git history at `c3a07c7`, reachable from branch `corporate-atlas-v4-deploy-clean`. T2 is also in the untracked local file `13F Seed/gleif-seed.js`. No branch tip holds either literal. The Founder has stated twice that the tokens were revoked or rotated: on 24 Sep (October F1) and on 28 Nov (DML-1128-9). No Cloudflare dashboard evidence is on record yet. Closes when the Founder reports the result of the ASSESS.SEC §4 checklist ("revoked (date)" or "rolled N"). Removing the literals from history needs its own Change Request. A later packet may remove T2 from the untracked file (DML-1128-9).

Keep §24.6 as the October record, but mark that row "superseded — see 22.38 in §26 (v16)" so the two sections no longer disagree. Also correct the §25.10 Security row's "carried from v14" claim: only the Ops GET routes were carried from v14.

**Confidence:** high on what the records say and why they disagree. The actual revocation state is **unknown**, and only the dashboard can settle it.

---

## REC-02 — When the FIRDS weekly seed started failing

| | Text |
|---|---|
| **v14** | v14 ¶426 (§24.6): "FIRDS still failing → CR-11 (November)". v14 ¶505 (§24.9): "CR-11 — move FIRDS off wrangler (**failing every Sunday since 18 Oct**)." |
| **v15** | v15 ¶389 and ¶468 carry the v14 text unchanged (§24 record). v15 ¶649 (§25.9): "OK since 8 Nov, after **failing 5 Sundays (4 Oct – 1 Nov)** with no alert". v15 ¶668 (§25.10, 22.31): "FIRDS recovered 8 Nov". |

**Evidence (settled from repo files; no D1 needed).** The primary source is `App/Corporate Atlas/logs/firds-seed.log`, the runner's own outcome log, read only. Each line is one run.

| log line | UTC | Outcome | wrangler binary in the error |
|---|---|---|---|
| 16 | 2026-09-27 10:03Z | **success** (+104 instruments) | — |
| 17 | 2026-10-04 10:00Z | **error**: first `wrangler d1 execute` SELECT failed | `npx wrangler` |
| 18 | 2026-10-11 10:07Z | **error**, same step | `npx wrangler` |
| 19 | 2026-10-18 10:07Z | **error**, same step | pinned `App/Corporate Atlas/node_modules/.bin/wrangler` |
| 20 | 2026-10-25 11:09Z | **error**, same step | pinned |
| 21 | 2026-11-01 11:09Z | **error**, same step | pinned |
| 22 | 2026-11-08 11:02Z | **success** (+216) | — |
| 23–24 | 15 Nov, 22 Nov | success | — |

Earlier lines (1, 4, 6, 11, 13, 15) show the same failure on 22 Aug, 23 Aug, 1 Sep, 6 Sep and 20 Sep, between successes. The fault was intermittent long before October.

Corroboration:
- `claude/November_Decisions_Log.md:32` (NML-1108-3): the 8 Nov run was the "first success since 27 Sep".
- `claude/packets/MA-NOV-DIAG.HEALTH_Report.md:55, :73, :82`: 5 Sundays in a row, 10-04 → 11-01, at the first `wrangler d1 execute` SELECT. Before that, 3 failures in 6 runs.
- `claude/packets/MA-NOV-CARRY_Status.json:31`.

Where "18 Oct" came from: `claude/October_Decisions_Log.md:211` says "FIRDS weekly run has failed on both Sundays **since the wrangler pin (18, 25 Oct)**". `:224` then says "CR-11 (FIRDS failing since 18 Oct) opened". The pin landed on 14 Oct (`3960aee`, `claude/October_Decisions_Log.md:145`). The October lane counted only the post-pin failures. The 4 and 11 Oct failures, which ran under `npx`, were not counted.

**Finding.** v15 is right and v14 is wrong. The streak began on **Sun 4 Oct** and ran for five Sundays, to 1 Nov. It started before the wrangler pin, so v14's "since the pin" framing is wrong too. Not handed to MA-DEC-ASSESS.OPS: no D1 query is needed.

**Corrected text for v16** (KI 22.31 / CR-11, and a footnote on the §24 rows that say "since 18 Oct"):

> **FIRDS weekly seed (local.firds-weekly-seed, Sun 11:00 London).** The seed failed at its first `wrangler d1 execute` read on five Sundays in a row: 4, 11, 18 and 25 Oct and 1 Nov. Its last success before that was 27 Sep. It has succeeded every Sunday since 8 Nov (8, 15, 22 Nov). The fault is intermittent and older than the streak: there were also failures on 22–23 Aug, 1 and 6 Sep and 20 Sep. It is not caused by the 14 Oct wrangler pin, because 4 and 11 Oct failed under `npx`. October records that say "since 18 Oct" counted only the failures after the pin. No alert was raised because the job has no Ops ledger emitter. Root cause not fixed (CR-11 open). The error text is cut off in the log, so code 10000 is not confirmed.

**Confidence:** high. The runner's own log has one line per run with timestamps.

---

## REC-03 — Contradictions inside v15 §10 (Ops) and §15 (Deployment record)

| # | Where | Old text (kept from v14) | New text (November) | Replacement for v16 |
|---|---|---|---|---|
| 3a | §10 ¶147 vs ¶151 | "Console: the operator console (**Cases and DQ tabs**) … since OPS.A (31 Oct) **all seven Ops views** live inside it …" | "Console. **Four tabs** (Health, Cases, DQ, Drift & Budget) … Events, Sprint and Release were removed from the front end only" | "Console: the operator console is reachable only after Cloudflare Access sign-in, and a signed-out request is redirected (302) to the Access login. Since 21 Nov (MA-NOV-UI.OPS.BUILD `4ad4ca3`, live 26 Nov) it has **four tabs**: System Health, Cases, DQ Tickets, Drift & Budget. Events, Sprint Board and Release Ledger were removed from the front end only, and their routes and tables stay. (From OPS.A on 31 Oct until 26 Nov it held seven views.) Access keeps its own session cookie, so signing out of GitHub or the Cloudflare dashboard does not sign out of Access." |
| 3b | §10 ¶148 vs ¶154 | "Worker heartbeats and drift (002b, 6 Nov): holdings, **bootstrap**, enrich and seed send run events …" (present tense) | "Retired. **The bootstrap cron (27 Nov)** …" | "Worker heartbeats and drift (002b, 6 Nov): the cron Workers send run events. Today that is holdings, entities-seed and entities-enrich; bootstrap stopped sending them when its cron was removed on 27 Nov (`4e417f40`), and its Worker is kept. The sweep reads each Worker's live cron schedule with a read-only Workers token and opens a case on drift. The first Friday sweep read 6 Workers with 0 drift and 0 errors. The first heartbeat-level view surfaced the enrich phase1 stall (100 attempted / 0 progressed)." |
| 3c | §15 ¶164 vs ¶165 | "The current mechanism — edit in App/ → node generate-docs.mjs → commit docs/ → **push October-2026** — and the 31 Oct switch …" | "The current mechanism is: … → **push November-2026**, with the ?v= stamp bumped …" | Delete ¶164 and keep one paragraph: "Sections 15.1–15.7 carried forward. Current mechanism: edit in App/ → bump the `?v=rel-YYYYMMDD` stamp on every local script in App/index.html → `node generate-docs.mjs` → commit docs/ → push the live Pages branch (November-2026 since 26 Nov; the December branch takes over at its go-live). Switches: October-2026 /docs on 31 Oct (§24.2), November-2026 /docs on 26 Nov (§25.2). Rollback source: October-2026 /docs at `98e830e`. See CLAUDE.md (DEPLOY_BRANCH)." |

Checked and consistent, so no change: §10 ¶142–146 and ¶149 (domain, Workers, registry, alerting, cases/DQ, kill switches) and ¶152–153.

Outside REC-03's scope, recorded for the v16 writer only: `CLAUDE.md` (DEPLOY_BRANCH) still says "the script tags carry no version stamp". That contradicts v15 ¶10 and the release path, and has been untrue since 26 Nov. `CLAUDE.md` is not edited here.

**Confidence:** high. Each pair sits in the same section, and the November side is backed by `claude/packets/MA-NOV-UI.OPS.BUILD_Report.md:9, :94` and `claude/Release_Ledger_November_2026.md` row 7.

---

## REC-04 — Wording for v15 §25.7, the 25 Nov read figure

| | Text |
|---|---|
| **v15 §25.7** (¶583) | "D1 reads. Normally far under the cap; 25 Nov reached 2.34M of 5M because of one whole-database integrity check (Section 25.8)." |
| **v15 §1** (¶28) and **§25.8** (¶614–615) | "peak read day 25 Nov 2.34M of 5M, caused by one whole-database integrity check" · "PRAGMA quick_check in BOND.APPLY read 2.03M rows against a 50k budget … No harm (2.34M of 5M)" |

**Evidence.** `claude/packets/MA-NOV-BOND.APPLY_Report.md`:
- `:95` and `:197`: `PRAGMA quick_check` read **2,031,185** rows, because it scans the whole database.
- `:154`: the CR2 verify step read 2,031,353 rows, of which `quick_check` was 2,031,185.
- `:157`: the packet's total was 2,086,677 rows, or 55,492 without `quick_check`.
- `:161`: the account had read **2.34M** of its 5M at **21:31Z**.
- `:201`: no cap was reached and no job was affected.
- `claude/November_Decisions_Log.md:113` (NML-1125-2) records the deviation and the new rule.

So 2.34M is one account-wide `d1-today` reading taken at 21:31Z, not a closed-day total. About 2.03M of it (≈ 87 %) came from the single `quick_check`. The other ≈ 0.31M was that day's ordinary traffic: back-fill, site, jobs, and the packet's other ≈ 55k reads.

**Replacement for §25.7** (and the same sense in §1 and §25.8):

> **D1 reads.** Normally far under the 5M/day cap. On 25 Nov the account had read **2.34M of 5M** by 21:31Z (one `d1-today` reading, not a full-day total). **One integrity check caused it:** a single whole-database `PRAGMA quick_check`, run by MA-NOV-BOND.APPLY, read 2,031,185 rows (≈ 87 % of the figure) against the packet's 50k read budget. The rest was ordinary daily traffic. No cap was reached and no job was affected. Rule since then: integrity checks are table-scoped only (NML-1125-2).

**Confidence:** high. The figures are from the executing packet's own report.

---

## REC-05 — The Ops console's fourth tab (Drift & Budget) as an approved scope change

**v14 / v15.** v14 ¶193 says the console holds seven views since OPS.A. The OPS outcome lists only "System Health, Cases, DQ match the main product; Events / Sprint Board / Release Ledger tabs removed" (`claude/packets/STATUS_BOARD_November_2026.md`, MA-NOV-OPS row). It does not name Drift & Budget. v15 ¶41, ¶151 and ¶554 list four tabs, including Drift & Budget, but never say it was a decision.

**Evidence.**
- `claude/packets/MA-NOV-SA1_Report.md:16`: "Ops has 7 tabs, not 6 (`Drift & Budget` also exists)".
- `:24`: Q3, keep it (recommended) or remove it with the other three.
- `claude/November_Decisions_Log.md:42` (NML-1110-5, the SA1 recommendation, includes "keep Drift & Budget").
- **`claude/November_Decisions_Log.md:43` (NML-1110-6, 2026-11-10, Founder 20:16: "approve scope as recommended" … "keep Drift & Budget")**: this is the approving row.
- Built in `4ad4ca3` (`claude/November_Decisions_Log.md:88`, NML-1121-5). Its Deployment Drift panel was dropped (UD-2), per `claude/packets/MA-NOV-UI.OPS.BUILD_Report.md:23`.

**Wording for v16** (§10 and §25.4):

> **Drift & Budget, the console's fourth tab, is an approved November scope change.** The OPS requirements (OPS-01–06) were written against a six-view console. They kept System Health, Cases and DQ, and removed Events, Sprint Board and Release Ledger. The scope assessment found a seventh view, Drift & Budget, that the requirements did not mention (MA-NOV-SA1, Q3). The Founder approved keeping it on 10 Nov with the November scope (NML-1110-6, "approve scope as recommended"). It was restyled with the others in MA-NOV-UI.OPS.BUILD (`4ad4ca3`, 21 Nov; live 26 Nov). Its deployment-drift panel, which read the frozen `releaseledger`, was removed (UD-2). The tab now shows the write budget, Cloudflare usage today, OpenFIGI coverage and cron invocations.

**Confidence:** high. There is one explicit Founder approval row.

---

## AUD-06 — Consistency of the November records (files only, no D1)

Files compared:
- `claude/packets/STATUS_BOARD_November_2026.md` (generated 2026-11-28T09:05:57Z)
- `claude/Release_Ledger_November_2026.md`
- `claude/November_Decisions_Log.md`
- the 85 `claude/packets/MA-NOV-*_Status.json` files
- `claude/factory/transitions.jsonl` (read only)
- v15 §25

**Not checkable:** the Project `Sprint_Board.md` mirror is **not in this repo**. Only `claude/Sprint_Board_September_2026_Archive.md` and `Sprint_Board_August.html` exist. It is frozen legacy and "receive[s] no November writes" (`claude/governance/Claude_md_v1.2.md:54`, `CLAUDE.md` Environment Truth). By design it holds no November closes or production changes. Either retire its name from the AUD-06 list, or check it where it lives (the Cowork Project).

### Packet closes
- Board: 60 packets CLOSED. Status files: 60 CLOSED. The sets match exactly. The other 25 Status files are records (outcomes, FR1–FR19, PLAN, CARRY), all DRAFT. Every CLOSED packet is named in the Decisions Log.
- **M-1 (wording gap, not a conflict).** For 13 closed packets, the log row that names the packet never says it closed. The close is recorded only in the Status file, the board and `transitions.jsonl`, or in a later row that uses a short name. The 13 are: BOND.FIX2, BOND.OFFER2, EXP.BFS.CHECK, EXP.BFS.REVIEW, EXP.UI.REVIEW, EXP.W1.REVIEW, EXP.W1R3.REVIEW, EXP.W1R3, EXP.W2, EXP.W3R3, P1.REVIEW4, UI.HOME.BUILD, UI.POLISH. Example: P1.REVIEW4 appears only in its issue row, NML-1111-7, while the CLOSED transition is in `transitions.jsonl` at 2026-11-11T20:57:47Z.
- **M-2 (expected).** `transitions.jsonl` has a CLOSED event for 57 of the 60. MA-NOV-000, MA-NOV-BOOT and MA-NOV-P1.REVIEW have none, because they closed before the log's first entry (2026-11-07T20:34:54Z). Their closes are in the Decisions Log and Status files.
- **M-3 (state mismatch).** The four outcome records MA-NOV-BOND, MA-NOV-EXP, MA-NOV-HOME and MA-NOV-OPS are still **DRAFT**, with "Next gate: Scope assessment … before any spec". The ledger, v15 §25.11 and NML-1128-1 say all of that scope is live and November is closed. The outcome records were never moved to a final state.

### Production changes
Each of the 7 ledger rows has its key identifier in the log and in v15 §25:
- `a9ffeaae`
- `aa39edf6`
- `f442c51` / 16,931
- `e35d7c55` / 21:22
- 11,450
- `4e417f40`
- `7cdb345`

Mismatches:
- **M-4 (missing production change).** The ledger omits **MA-NOV-EXP.C1R2**. That run deployed `866c6cb2` (from `c5d0cad`, previous `4e7ee20b`) to `meridian-entities-api` on 13 Nov (`claude/November_Decisions_Log.md:63`, NML-1113-5; `MA-NOV-EXP.C1R2_Status.json` `main_lane_verification`, 10:05:58Z). It stayed in production until W1R4's `bb8ad0aa`, later on 13 Nov. Ledger row 1 starts at `bb8ad0aa`. The "Superseded" line names C1R2 only as a step ("superseded by W1R3 → C1R2 → W1R4"), with no version or time. v15 also has no `866c6cb2`. Add a ledger-style line in v16 §25.2: C1R2 · `866c6cb2` · 13 Nov · rollback `4e7ee20b`.
- **M-5 (time not in the log).** Ledger row 3 gives "22 Nov 10:14Z" for BFS.ON. The log's BFS.ON rows (`:98`, `:100`) record the switch-on and the Founder's words but no 10:14Z. The time is in the BFS.ON report and Status. Minor: no conflict, only a missing cross-reference.
- **M-6 (the C1 deploy).** The C1 deploy `e6ddf979` is in the ledger's Superseded section and in the log, but not in v15. The automatic rollback is only described in words (v15 ¶596–597). v16 may add the version id.

### Is anything still reading the D1 `sprintboarditems` / `releaseledger` tables? (cross-check with ASSESS.SEC F3)

| Code | Reads/writes the tables? | Live caller? |
|---|---|---|
| `App/Ops/src/control-api.js:88–89, :120, :165, :204, :308` (GET sprint-board, release-ledger, drift; admin writes `:102, :148, :177, :252, :274`), deployed as meridian-control `c442209c` | **Yes.** It is the only deployed reader. | **None.** ASSESS.SEC §1.2 and §3.1: removed from the console by MA-NOV-UI. The 4 anonymous GETs still answer 200 with ACAO `*` (F3), and closing them is MA-DEC-SEC.FIX0 (DML-1128-9). |
| `App/Ops/src/ops-api.js:55–56` | No (domain-boundary comment). The legacy paths 302 to meridian-control. | — |
| Front end: `App/ma-ops.js` / `docs/ma-ops.js:632–633` | No. A comment only: the drift panel and the `/api/ops/drift` request were removed (UD-2). No `sprint-board`, `release-ledger`, `/api/ops/events` or `/api/ops/drift` request remains in `App/*.js` or `App/index.html`. | — |
| `App/Ops/seed-ops-tables.js` | Writes (retired seeder) | None (ASSESS.SEC: legacy POSTs return 401) |
| `App/Corporate Atlas/sprintboard_update*.sql`, `releaseledger_update_ma_sep_010.sql`, `App/ETF Refresh/sprintboard_update_ma_sep_011_*.sql` | Historical INSERT/UPDATE files from September | None (not run since September; frozen) |
| `App/Ops/migrations/001-ops-schema.sql`, `App/Ops/tests/control-split.mjs`, `tests/fixtures/a6-pre-split-capture.json` | Schema, tests and fixtures | Test-only |
| `tools/factory/**`, `13F Seed/**`, `App/**/scripts/**` | No reference | — |

**AUD-06 verdict.** Nothing in the front end or the factory reads the legacy tables. The only reader is meridian-control's 4 anonymous GETs, which have no caller and are already scheduled to close (F3 → SEC.FIX0). The MA-NOV-OPS outcome still lists "D1 sprintboarditems/releaseledger sync check (carry-over 13)" as a dependency (board, MA-NOV-OPS row). That check was not done in November, so it should be carried into the December record or formally dropped.

**Confidence:** high for the file comparisons. Medium for M-1, which used a text heuristic: a row mentions the packet ID but has no "closed" wording. The rows were spot-checked (NML-1111-7, NML-1113-3).

---

## Summary for the v16 writer

| Item | Outcome | Action at C4 |
|---|---|---|
| REC-01 | Records disagree. Revocation is a Founder statement (24 Sep, 28 Nov) without dashboard evidence. | One 22.38 row: OPEN, evidence pending; mark the §24.6 "INERT" row superseded; fix "carried from v14" |
| REC-02 | **Settled:** 5 Sundays, 4 Oct – 1 Nov (runner log). v14's "since 18 Oct" counted only the failures after the pin. | Use the REC-02 text. No hand-off to ASSESS.OPS. |
| REC-03 | 3 contradictions (3a console tabs, 3b bootstrap heartbeats, 3c push branch) | Replace as tabled |
| REC-04 | 2.34M is a 21:31Z reading. 2.03M (≈ 87 %) came from one `quick_check`. | Use the REC-04 text in §1, §25.7 and §25.8 |
| REC-05 | Approved: NML-1110-6 (10 Nov 20:16) | Use the REC-05 text |
| AUD-06 | 6 mismatches (M-1 to M-6). There is no live reader of the legacy tables beyond control-api's caller-less GETs. Sprint_Board.md is not in the repo. | Record M-3 and M-4 in v16. November records stay unchanged. |
