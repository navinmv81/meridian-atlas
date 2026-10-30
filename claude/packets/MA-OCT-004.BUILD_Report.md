# MA-OCT-004.BUILD — Report

```text
PACKET:      MA-OCT-004.BUILD — 004 Data-quality ticketing — build (local only)
EXECUTED BY: Engineering Lead (LANE-4-ENG), Claude Code
CONTROL:     claude/packets/MA-OCT-004.BUILD_Control_v1.md  d7aa1da4c08a153a660ffaea2412ebf57ab9d422299db5db488e6180a3a14635  (matches STATUS_BOARD row 77)
TASK:        claude/packets/MA-OCT-004.BUILD_Task_v1.md     3904e39b12a5f5ed00728c2529752be750d2888504f82411c2da12036702782e  (matches Control)
SPEC:        claude/MA-OCT-004_Spec.md rev 1                570de1a571a69c752ce26ce3502177fbadca8e9fcb0d00b4f44f992c9dee5379  (matches Task)
SESSIONS:    Wed 28 19:40Z – usage stop (partial); resumed Thu 29 07:18Z, hashes re-verified
WORKTREE:    ~/MeridianAtlas-work/ma-oct-004/build-worktree, detached at origin/October-2026 acfd069 (moved from 721d093 on Thu 29;
             the 6 intervening commits touch no 004 file — only check-pipeline-health.js +3 lines and its test, both merged clean)
RESULT:      BUILT AND TESTED LOCALLY. 0 remote D1 reads or writes, 0 deploys, 0 commits, 0 production changes.
             Ops suites: 11 green (413 checks), plus ingest-contract.mjs, which needs live env vars and exits 2 on untouched origin as well.
             New tests fail on the pre-004 tree.
             Local D1 (wrangler 4.96.0 --local): every batch applied, every re-run 0 changes.
```

**Report log (one production change at a time):** no production change was started or made by this lane. No "starting <change>" announcement was needed.

---

## 1. What was built (Task item 2)

| File (worktree) | Status | SHA-256 | What |
|---|---|---|---|
| `App/Ops/migrations/005-ops-dq.sql` | new | `bdf7144d…d0031` | `ops_dq_ticket_member` + `idx_ops_dq_member_object`, verbatim §6 DDL, additive |
| `App/Ops/src/cases.js` | changed (440 → 1,025 lines) | `22ba06a2…c0780` | DQ vocabularies (§7.2–7.3), key rules (§6 + E8), D-1 list, D-2 create (§8.3 caller classes, §9.3 object dedupe, §8.4 CSRF, N4-1 five-status cap → 429), DQ engine on C-2 (all 11 §7.1 actions; §7.5 authority; 004-6 `do_not_merge` guard; A4-3 member guards), C-1 DQ detail (members ≤ 200 + keyset `members_after`, `merged_into` via `entity_merge_redirect`, tolerant of the table being absent) |
| `App/Ops/src/dq-page.js` | new (144) | `c388f396…bd2` | D-3 page and the 007 prefill contract (§9.1–9.2): CSP with nonce, every value escaped, `ref` whitelist, 0 D1 |
| `App/Ops/src/ops-api.js` | changed (+9) | `f019ed8f…eb4` | sweep `dq_new` + `dq_since` (§9.5, F-3); header endpoint note. Router unchanged — D-routes go through `handleAdmin` → JWT → allowlist → `handleCases` |
| `App/Ops/wrangler-ops.toml` | changed | `c29efc7e…92f` | `bond-runner` allowlist entry (routes `[D-2]`, types `[missing_entity]`; Client ID placeholder `__BOND_RUNNER_CLIENT_ID__`), `OPS_DQ_ENABLED`, `OPS_DQ_CONSUMER_ENABLED`, `OPS_DQ_DAILY_CREATE_CAP = 100`. ops-script entry byte-identical. |
| `13F Seed/check-pipeline-health.js` | changed (+2) | `701d228a…afb` | one notification line "N new data-quality tickets." when `dq_new > 0` (N4-5: no new prompt) |
| `App/Ops/migrations/m3a-ki2217.sql` | new | `f5219054…136` | §10.1 verbatim (+ header) |
| `App/Ops/migrations/m3c-links.sql` | new | `88ad8256…e84` | §10.2 M3c verbatim (+ header) |
| `App/Ops/seeds/seed-template.sql` | new | `76e40ccb…c2af` | §10.2 template verbatim |
| `App/Ops/seeds/m3-seeds.json` | new | `f9b551c7b03a98c63e9933752fabe44efa76c254273967cf653d74379629b679` | Appendix D, **byte-for-byte** (test-checked against the spec text) — 5 seeds, 30 members |
| `App/Ops/seeds/m4-minimum.json` | new | `272aa9f1b234830b2207f6ee1926e5c5bcc1f15b8887c9d60fdf70e2e83de1e5` | Appendix D, byte-for-byte — 4 seeds, 7 members |
| `App/Ops/seeds/m3d-009dil.json` | **new (Task item 2)** | `907c6f02ea4d8ef8755b412368abe7d4f994beaa041acb40031093f1d623c225` | **D-2** "37 Caterpillar boilerplate labels" and **D-3** "duplicate CUSIP `14913UAP5`" from the 009 DIL review (`5bb8b8c7…5d58`, D-2/D-3, N-5). Built from 008's `bonds/state/finals-2026-10-16.json` (`28d32b35…e263`); the rows are re-checked against D1 by B5/B6 before the seed runs (§6 step 4) |
| `App/Ops/tools/seed-sql.mjs` | new | `e503e382…f8f` | generator (§10.2): compact JSON, quotes doubled, `__SEEDS__`/`__FILE_SHA__` replaced on SQL lines only, refusals (NUL, dup dedupe, missing key, template ≠ 4 placeholders); `--unmatched` maps 008's list (N4-3 SHA in the event) |
| `App/Ops/tests/dq-contract.mjs` | new | `42e05490…71c` | 68 checks |
| `App/Ops/tests/dq-seeds.mjs` | new | `d18edfd6…159` | 32 checks |
| `App/Ops/tests/dq-page.mjs` | new | `46d85f97…106` | 19 checks |
| `App/Ops/tests/{cases-contract,sweep-contract,health-check.test}.mjs` | changed | — | 005 applied in 003's harness; one 003 assertion that pinned the pre-004 409 now expects the DQ engine; AC-20 added to sweep (3) and health-check (1) |

**`meridian-ops` endpoint count: 14 of 15** — the 7 after A6, plus 003's E-1, E-2, C-1, C-2, plus 004's D-1, D-2, D-3. **1 spare**, so 005 Option B can add exactly one route and no more. Worker files stay under 1,500 lines (largest: `cases.js` 1,025).

**D-2 / D-3 seeds (new, not in spec Appendix D):**

| dedupe | type / sev / status | anchor | members | owner |
|---|---|---|---|---|
| `dil009:d2:caterpillar_tranche_labels` | `data_error` / sev3 / `triaged` | `source_record` `review:MA-OCT-009-DIL:D-2` | 37 × `bond` `<accession>#<seq>` (`none`, `object_ref` = instrument_key + label head) | Data-Identity Lead (as the review says) |
| `dil009:d3:cusip:14913UAP5` | `data_error` / sev3 / `triaged` | `instrument` `CUSIP:14913UAP5` | `0001104659-24-088590#1`, `0001104659-24-088828#1` (`review`) | Data-Identity Lead (the review asks for an authoritative-filing decision) |

The fixes stay with 008 (parser cover-title extraction; marking the duplicate row). 004 only records them, as with every other seed.

---

## 2. Build findings and decisions (for the Architect code review, Thu 29)

| # | Finding / decision | Why | Where |
|---|---|---|---|
| **E8** | `deriveInstrumentKey` produces **bare 12-character ISIN keys** (no prefix), plus `CUSIP:`, `TICKER:` and `NAME:`. The spec's `^[A-Z]{2,8}:\S{1,120}$` would reject every ISIN key. Accepted: bare ISIN **or** the spec form. The 007 placeholders are still refused. | §6 asked the build to confirm against `deriveInstrumentKey` (`App/Corporate Atlas/task_6a_instrument_normalization.mjs:57`) | `dq-page.js` `INSTRUMENT_KEY_RE` |
| B-1 | `bond` keys use 003's live form `<accession>#<tranche_seq>`, so the bond rule is the spec's character set plus `#`. 008 defines no bond key. 003's `OBJECT_DOMAINS.bond` already uses `#`. | one bond key form across Ops | `DQ_OBJECT_DOMAINS.bond` |
| B-2 | `member_update → fixed` on Entities types needs an earlier `fix_scheduled` event (409 `fix_not_scheduled`). AC-9 presumes it, and §7.1 says "same authority rule as resolve fixed". **Review question:** App. A B1 implies marking a KI 22.17 member `fixed` after M3a without a scheduled fix. Under this build the DIL would `schedule_fix` first, or use `not_a_problem`. | AC-9 Given; §7.1 last paragraph | `dqAction` |
| B-3 | A service token can never `resolve`, `dismiss` or `reopen` a DQ ticket, or set a member `fixed`. This is enforced in code before D1, **whatever the allowlist says** (defence in depth on top of §8.5). | §7.5 "never" | `SERVICE_NEVER` |
| B-4 | AC-12 says member 931's `see_also` "= `DQ-M-000001`". The byte-for-byte Appendix D text is `"DQ-M-000001 (do_not_merge 931/1216)"`. Appendix D governs, and the test checks the prefix. | spec internal wording gap | `dq-seeds.mjs` |
| B-5 | The fixed template's `UPDATE … WHERE case_ref LIKE 'DQ-SEED-%'` is a **SCAN** of `ops_data_quality_ticket` (SQLite LIKE is case-insensitive, so no index). The table holds about 22 rows during the seeds, and the scan reads the same rows each run. It was left verbatim because the spec fixes the template. | three-point check point 1 | §4 below |
| B-6 | `CAST(? AS TEXT)` on a JS number bind gives `'9.0'` under a REAL bind, which broke event `subject_id` matching in tests. The Worker now binds `String(ticket_id)` for every 004 event. 003's `CAST(exception_id AS TEXT)` (a column, not a bind) is unaffected. | correctness under D1's numeric binding | `dqMemberAction` |
| B-7 | A re-run of M3a spends an AUTOINCREMENT id, so case_refs after a re-run shift by one against the spec's dry-run (`DQ-000011…`). Tests refer to seeds by `dedupe_key`. **The run sheet does not re-run before M3**, so production numbering matches the spec. | honest numbering | §6 |
| B-8 | 008's `bonds/state/unmatched-issuers.json` **does not exist**, and 008's runner never writes one. M4 = the named 4 only. The `--unmatched` path is built and tested (a fixture repeating a named CIK gives 1 ticket) for when LANE-8-ENG supplies the file (spec D-3). | dependency, not a blocker | §6 step 8 |
| B-9 | The `bond-runner` Client ID is unknown, so the toml carries `__BOND_RUNNER_CLIENT_ID__.access`. No Access token can have that `common_name`, so the entry fails closed. If the Founder has created the token before the deploy, substitute the ID (§6 step 5). Otherwise AC-18c waits for a later deploy. | §8.5 | `wrangler-ops.toml` |
| B-10 | D-2 accepts `X-Ops-Client` ∈ `console | dq-page | service` only (§8.4). `script` is refused on D-2 but still accepted on E-2/C-2 (003 R1-1). | §8.4 | `createDqTicket` |
| B-11 | D-1 shows `resolver_role` (the `actor_role` on the resolve/dismiss event) for terminal rows on the page only, with 0 extra reads at the default status set. | §7.5 "the D-1 list shows it" | `listDqTickets` |
| B-12 | `sweep` `dq_since` = the previous `local.health-check` start, taken from the L2 rows (0 extra reads). With no prior start in the window, it falls back to 24 h. | §9.5 | `ops-api.js` |

---

## 3. Tests (Task item 3)

| Suite | Result on 004 tree | On the **pre-004** tree (`origin/October-2026` src, with only the new tests / 005 / seeds / tools copied in) |
|---|---|---|
| `dq-contract.mjs` (new) | **68/68**, exit 0 | **FAIL**, exit 1 — 11 pass, then 4 fail and a crash (D-2 CSRF, bond-runner 201, nav-007 caller class, key validation; D-routes do not exist) |
| `dq-seeds.mjs` (new) | **32/32** | **FAIL**, exit 1, on a true pre-004 tree (no 005/seeds/tools). With those copied in it passes, as expected: it tests the data files and SQL, not the Worker |
| `dq-page.mjs` (new) | **19/19** | **FAIL** (module `src/dq-page.js` absent) |
| `sweep-contract.mjs` (+AC-20) | **26/26** | **FAIL** 1 (AC-20: no `dq_new`) |
| `health-check.test.mjs` (+AC-20) | **18/18** | fails in the scratch copy. The scratch run lacks the live script's environment, so this column is not evidence for AC-20; the sweep suite is. |
| `cases-contract.mjs` (003) | **66/66** | — (one assertion updated: DQ comment now 200 via the engine) |
| `migration-m1`, `control-split`, `lateness`, `admin-jobs-lateness`, `boost-heartbeat-resilience` | 29, 100, 42, 13, pass | unchanged |
| `ingest-contract.mjs` | exit 2 | **exit 2 on untouched origin too** — a live-endpoint script that needs `OPS_INGEST_URL` etc. Not run by this lane, not a regression. |

**Coverage against §15 step 1:**
- AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-9 (1/2/3), AC-10, AC-14, AC-18 (1–4), AC-18c (in the harness), AC-19 (absent table, 2-hop redirect, cycle);
- the caller-class matrix and allowlist, CSRF and preflight (no `Access-Control-Allow-*`);
- the five-status cap 429 (a duplicate report is still folded under the cap);
- key validation (placeholders), request-id replay/reuse, and actor attribution (email / `service:<label>`, `common_name` in the payload, `actor_role`);
- member cap 100/call, 500/ticket; keyset paging of D-1 (every ticket exactly once) and of C-1 members;
- the `OPS_DQ_ENABLED` switch (EXC C-2 unaffected);
- every 004 statement the harness runs is EXPLAINed, with 0 scans.

**Local D1 migration test (wrangler 4.96.0 `--local --persist-to <scratch>`, `wrangler whoami` pre-flight OK; nothing remote):**

| Step | Result | tickets / members / events (cumulative) |
|---|---|---|
| 002, 003, 004, **005**, 015b, 015c, 003 M1 (rendered), M2 | success | 9 / 0 / 27 |
| gate V2 / B3 | V2 = 0, B3 = 9 | — |
| **M3a** · re-run | success · **0 changes** | 10 / 37 / 30 |
| **M3 template** (m3-seeds) | success | 15 / 67 / 37 |
| **M3c links** · M3 + M3c re-run | success · **0 changes** | 15 / 67 / 41 |
| **M4 named 4** | success | 19 / 74 / 45 |
| M4 008 list fixture (repeats PepsiCo SG + 1 new) · both re-run | success (1 new ticket) · **0 changes** | 20 / 74 / 46 |
| **M3d 009 D-2/D-3** · re-run | success · **0 changes** | 22 / 113 / 48 |

This also proves that wrangler's own `--file` splitter handles the `;` that sits inside the JSON literals (e.g. "…db1bc; wrong_lei_detail…").

Rendered file SHA-256s, for Thursday comparison: m3-seeds.sql `0b60f389…7bee47`; m4-minimum.sql `bc627cdd…b9677b`; m3d-009dil.sql `50422fa8…56b5da`.

**EXPLAIN on local D1 (workerd SQLite):**

| Query | Plan |
|---|---|
| D-1 default, per status | `SEARCH … COVERING INDEX idx_ops_dq_queue (status=?)` |
| D-1 keyset | `… idx_ops_dq_queue (status=? AND (severity,opened_at)>(?,?))` |
| D-1 `?type=` | `SEARCH … idx_ops_dq_type (ticket_type=? AND status=?)` + temp B-tree sort (rows of one type and status) |
| D-1 object | `COVERING idx_ops_dq_object (object_domain=? AND object_key=?)`; members → `idx_ops_dq_member_object` → `INTEGER PRIMARY KEY` |
| D-1 resolver role | `idx_ops_case_event_subject (subject_type=? AND subject_id=?)` |
| D-2 dedupe probe | `idx_ops_dq_object (object_domain=? AND object_key=?)` |
| D-2 cap count | `COVERING idx_ops_dq_queue (status=? AND severity=? AND opened_at>?)` |
| idempotency probe / D-2 read-back | `sqlite_autoindex_ops_case_event_1 (idempotency_key=?)` → PK |
| C-1 ticket / events | `sqlite_autoindex_ops_data_quality_ticket_1 (case_ref=?)` / `COVERING idx_ops_case_event_subject` |
| C-1 members page, keyset | `COVERING sqlite_autoindex_ops_dq_ticket_member_1 (ticket_id=?)` / `(ticket_id=? AND (object_domain,object_key)>(?,?))` |
| C-2 resolve member check, `NO_OPEN_MEMBER` guard, add_members count / guard | `sqlite_autoindex_ops_dq_ticket_member_1 (ticket_id=?)` |
| C-2 member read / member-changed guard | `… (ticket_id=? AND object_domain=? AND object_key=?)` |
| C-2 `fix_scheduled` probe | `idx_ops_case_event_subject (subject_type=? AND subject_id=?)` |
| sweep `dq_new` | `COVERING idx_ops_dq_queue (status=? AND severity=? AND opened_at>?)` |
| seed (1) guard / (3) join / M3a legacy / B3 | `idx_ops_dq_object` / `autoindex_…_2 (dedupe_key=?)` / `idx_ops_dq_type` / `COVERING autoindex_…_3 (legacy_source=?)` |
| seed (2) `case_ref LIKE 'DQ-SEED-%'` | **`SCAN ops_data_quality_ticket`** (B-5; about 22 rows) |
| B5 (D-2 re-check) | `bond_issuance USING INDEX idx_bi_cik_final_key (cik=?)` |
| B6 / B6b (D-3 re-check) | `sqlite_autoindex_bond_issuance_1 (accession_number=? AND tranche_seq=?)` / `idx_bi_instrument (instrument_key=?)` |
| `entity_merge_redirect` probes | the table does not exist yet (013 creates it). Its PK is `duplicate_id INTEGER PRIMARY KEY`, so `IN (…)` is a rowid search, as for 007 R3 P8. Confirm remotely after 013. |

Remote plans and `rows_read` are confirmed on Thursday (AC-15, §6 step 7).

---

## 4. Three-point check (Task item 4)

**1. Index audit.** Every 004 read and guard is a `SEARCH` on a named index or a PK/unique probe (§3 table):
- **Exception:** the spec-fixed seed statement (2), a SCAN of `ops_data_quality_ticket`. It is an Ops table of about 22 rows at seed time and about 100 at 12 months; it is not a large table. It runs once per seed file, so 5 runs on Thursday at ≤ 25 rows each.
- **New indexes:** one table and one index, `idx_ops_dq_member_object`, plus the member UNIQUE autoindex.
- **Tables touched:** no ETF, `fund_holdings_monthly` or `entity_master` table is read by the Worker. The Entities reads are only the `entity_merge_redirect` PK probes, and they are tolerant of the table being missing.
- **B-checks:** they read `entity_isin_map`, `entity_master`, `entity_relationships` and `bond_issuance` by index or PK, read-only, once.

**2. Single execution ≤ 50k rows.**

| Call | Worst-case reads | Typical | Note |
|---|---|---|---|
| D-1 | ≤ 3 × 101 + terminal-row events | ≤ 153 at the default limit | |
| D-2 | dedupe ≤ 10 + cap ≤ 100 + idempotency 1 + read-back 2 | ≤ 120 | |
| C-1 DQ | 1 + ≤ 200 events + ≤ 201 members + 1 + redirect probes ≤ 5 × 200 | ≤ 405, ≤ 500 with redirects | |
| C-2 DQ | resolve member check ≤ 500, `fix_scheduled` probe ≤ 200, guards 1–2, plus load ×2 | ≤ about 710 | worst case, on a 500-member aggregate with 200 events |
| Sweep `dq_new` | 1 + new rows | | |
| Seed batches | | ≤ about 200 reads each | |

**Largest single execution: about 710 rows, far below 50k.**

**3. Per-invocation read/write budget.** Counting basis: 003 §11. One write = the row plus 1 per index.
- `ops_data_quality_ticket`: 7 indexes, so an INSERT costs 8 and a case_ref UPDATE costs 2.
- Member INSERT costs 3 (the UNIQUE autoindex plus `idx_ops_dq_member_object`).
- Event INSERT costs 3 (subject index plus idempotency autoindex).

| Thursday one-time | Rows changed (local) | Est. index-weighted writes |
|---|---|---|
| 005 migration | DDL | ≈ 0 |
| M3a (1 ticket, 37 members, 3 events, 2 legacy updates) | 44 | 1×8 + 2 + 37×3 + 3×3 + 2×5 = **140** |
| M3 template (5, 30, 7 events) | 47 | 5×8 + 5×2 + 30×3 + 7×3 = **161** |
| M3c links (4 events) | 4 | **12** |
| M4 named 4 (4, 7, 4 events) | 19 | 4×8 + 4×2 + 7×3 + 4×3 = **73** |
| M3d D-2/D-3 (2, 39, 2 events) | 45 | 2×8 + 2×2 + 39×3 + 2×3 = **143** |
| Smoke (§6 step 7; 1 console D-2 test ticket + 1 dismiss) | ≈ 3 | ≈ 20 |
| **Total** | **≈ 162** | **≈ 550** — 0.55% of 100k. Below the spec's ≤ 1,100, because 008's list is absent (each CIK there adds about 13). |

**Steady state** is unchanged from spec §11.1: ≤ about 600 writes and ≤ about 3k reads a day, with the 100/day create cap and the per-call limits above. **Every remote step reads `d1-today` first, and stops if headroom is below 10,000.**

---

## 5. Kill switches and rollback ids (for the run sheet)

| Change | Rollback | Id to record |
|---|---|---|
| `meridian-ops` 004 deploy | `wrangler rollback <deploy-4 version id>` (preferred), or `OPS_DQ_ENABLED="false"` + deploy | **deploy-4 version id** — taken from `MA-OCT-THU29.ENG8_Report.md` and re-read from `wrangler deployments list` at step 2. The older fallback is 003 deploy 3 `14aa968c`. Rolling back below deploy 4 also removes deploy 4: LANE-8-ENG must agree. |
| D-3 page only | `OPS_DQ_CONSUMER_ENABLED="false"` + deploy | — |
| `005-ops-dq.sql` | leave in place (additive; spec §17) | — |
| Seed tickets | `dismiss not_a_problem` + `member_update` by the DIL or Founder (§17); events stay | case_refs recorded at step 8 |
| `check-pipeline-health.js` line | revert the 2 lines (local file) | — |

---

## 6. Thu 29 go-live run sheet (one production change at a time; Ops-domain writes only)

**Gates (all four before step 1):**
- **G1** — LANE-8-ENG has posted **"deploy 4 live — 004 base = <commit>"**, and `MA-OCT-THU29.ENG8_Report.md` carries the deploy-4 commit hash and version id. *At 07:30Z Thu that report did not exist yet (`THU29.ENG8_Status.json` = READY); deploy 4 starts ≥ 08:05Z.*
- **G2** — the Architect code review of 004 is a PASS (ML-1025-5, Thu 29).
- **G3** — LANE-1-ENG has committed the 004 files on top of the deploy-4 commit (§6 step 0). This lane does not commit (Task).
- **G4** — no other lane is mid-change. Announce "starting MA-OCT-004 go-live <UTC>" in this report's log.

**Window:**
- **12:20–16:40Z.** It sits after deploy 4 and its sweep check, clear of the 12:00 sweep (±2 min), the 11:45–12:15 and 16:45–17:15 boost bands, and the 18:00 sweep.
- Alternative: 18:20–23:45Z.
- A2's Entities freeze starts Fri 08:05Z. It does not affect Ops writes, but 004 should finish today.

| # | Step | Command / check | Expect / stop rule |
|---|---|---|---|
| 0 | **Rebase onto deploy 4** (LANE-1-ENG, with this lane) | `git fetch origin`; `git merge-base --is-ancestor <deploy4> origin/October-2026`; new worktree from `origin/October-2026`; bring over the 004 file set (§1 table). Then `git pull --rebase` and commit by explicit path. **Likely conflict points:** `src/ops-api.js` `sweep()` (deploy 4 changes the sweep and its logging; keep both — 004 adds only `prevSweepStart`, the `dq_new` query and 2 response fields); `wrangler-ops.toml` `[vars]` (deploy-4 switches + 004 lines); `tests/sweep-contract.mjs`, `tests/health-check.test.mjs` (append-only on both sides). | Then run **all** `App/Ops/tests/*.mjs` → all green except the live-only `ingest-contract`. The endpoint count is still 14. Re-hash the files in §1. **Any red → STOP.** |
| 1 | Pre-flight | `/usr/local/bin/wrangler --version` (4.96.0); `wrangler whoami`; re-read `claude/relays/FREEZES.json`; `GET /api/ops/cf/d1-today` | not inside a freeze; headroom ≥ 10,000 |
| 2 | Record C1 | `wrangler deployments list -c App/Ops/wrangler-ops.toml` → current = deploy-4 version id (**rollback id**); confirm the deployed code = deploy-4 commit | mismatch → STOP |
| 3 | B-checks (read-only, ≤ about 350 reads) | **B3** `SELECT COUNT(*) FROM ops_data_quality_ticket WHERE legacy_source='entity_exceptions'` = 9, plus 003 V2 = 0. **B1** 37-ISIN ambiguity (`idx_entity_isin_map_isin`). **B2** 24 LEIs by PK. **B4** the 4 edges by PK (spec App. A). **B5** `SELECT accession_number, tranche_seq, tranche_label FROM bond_issuance WHERE cik='0000764764' AND filing_status='final'` → filter the label rule → must equal the **37** keys in `m3d-009dil.json`. **B6** the two `14913UAP5` rows by PK, still both `final`, $500m. | B3/V2 off → STOP. B1/B2/B4 differences are noted per member by `comment` after the seeds (spec App. A), not a stop. **B5/B6 differ → do not run M3d**; regenerate the file from the live read and get it re-reviewed. |
| 4 | Migration | `wrangler d1 execute meridian-etf --remote -c wrangler-ops.toml --file migrations/005-ops-dq.sql` | success; `PRAGMA index_list(ops_dq_ticket_member)` shows `idx_ops_dq_member_object` |
| 5 | bond-runner entry | If the Founder has created the `bond-runner` Access service token, replace `__BOND_RUNNER_CLIENT_ID__` with its **Client ID** (an identifier, not the secret) and re-run `dq-contract.mjs`. Otherwise deploy with the placeholder (fails closed) and note that AC-18c waits for a later deploy. | never paste the Client Secret anywhere |
| 6 | **One `meridian-ops` deploy** | `cd App/Ops && /usr/local/bin/wrangler deploy -c wrangler-ops.toml` from the committed tree | record the new version id |
| 7 | Smoke + AC-1 / AC-15 | **Anonymous:** `curl -si …/api/ops/admin/dq-tickets` → Access block (no CORS headers). **Founder browser, signed in:** GET `/api/ops/admin/dq-tickets` (D-1) → 200, `rows_read` ≤ 153; GET `/api/ops/admin/cases/DQ-M-000004` → 200, `accepted_no_fix`; GET `/api/ops/admin/dq/new?type=missing_mapping&domain=entities&key=US0378331005&via=nav-007` → the form. **Sweep:** next scheduled health-check sweep response carries `dq_new`. **EXPLAIN remotely:** D-1 default, D-2 dedupe, cap count, C-1 members (`--command "EXPLAIN QUERY PLAN …"`) = §3. | any 5xx, `rows_read` above the limits, or a plan that differs → **rollback** to the step-2 id and STOP |
| 8 | Seeds (each: `d1-today` first; record per-file `changes`) | Render: `node tools/seed-sql.mjs --in seeds/m3-seeds.json --out <scratch>/m3-seeds.sql` (and m4-minimum, m3d-009dil); compare the rendered SHA-256s with §3. Then `--remote --file` **in order: M3a → M3 → M3c → M4 → M3d**. **No re-run before M3** (B-7). If LANE-8-ENG has delivered `unmatched-issuers.json`: `--unmatched <file>` after M4, recording its SHA (N4-3). | **Expected rows changed:** M3a 44 (`DQ-000010`); M3 47 (`DQ-000011…15`); M3c 4; M4 19 (`DQ-000016…19`); M3d 45 (`DQ-000020/21`). Total ≈ 550 weighted writes. Any `success:false` → STOP (each file is atomic). |
| 9 | Verify (read-only) | the AC-11/12/13/17 queries as in `dq-seeds.mjs` (counts, 6/5/13, 4 edges, 4 links, named 4, D-2 37, D-3 2); one idempotency re-run of M3a (expect 0 changes); then C-1 on the KI 22.17 ticket → `rows_read` ≤ 405 (AC-15) | mismatch → C-2 corrections per §17, no deletes |
| 10 | Hand-offs and report | the D-3 URL pattern to the 007 lane; `bond-runner` admission only after AC-18c passes live (Founder); the M5 hand-off still waits on H-1; `check-pipeline-health.js` is already in place locally once committed (local file, not a remote step) | report with every version id, SHA and count |

**Not in this run (Wed 28/later per spec §16, carried):**
- AC-6 to AC-8 with the Founder in a real browser.
- AC-14 on/off.
- AC-20 live.
- M5 (waits on H-1).
- 007's button: deferred if 004 is not live today (007 §12; ML-1017-3).

---

## 7. Open items for the Main Lane

1. **Run-sheet gate G1:** this report names the deploy-4 hash by reference only, because `MA-OCT-THU29.ENG8_Report.md` did not exist at 07:30Z Thu. Fill it at step 0.
2. **Review question B-2** (`member_update → fixed` precondition, versus App. A B1) and **wording B-4** (AC-12 `see_also`) go to the Architect review and the spec owner.
3. **B-8:** 008's `unmatched-issuers.json` does not exist. LANE-8-ENG decides whether to produce it (spec D-3) or to rely on the `bond-runner` raises (F-2).
4. **B-9:** the Founder creates the `bond-runner` token and gives its Client ID before step 6, or AC-18c moves to a later deploy.
5. **Commit list for LANE-1-ENG:** the §1 file set, by explicit path. `.claude/settings.local.json`, `13F Seed/gleif-seed.js` and `.env*` are untouched by this lane.

MA-OCT-004.BUILD reported.
