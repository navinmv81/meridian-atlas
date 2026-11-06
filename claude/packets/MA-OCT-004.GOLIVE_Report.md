# MA-OCT-004.GOLIVE — Report

> ## **004 live — `e8b81bf9-6a9b-41ca-bbd1-2ec5341b11be`** (declared 16:01Z Fri 30)
> - **Rollback:** `2e4c3fc6` (deploy 4).
> - **Change closed:** LANE-1-ENG may start the 009 deploy.
> - **Carried, not blocking:** the D-2 test ticket `DQ-000036` is still `open`, because the dismiss step could not be run (§5, §7).

```text
CONTROL:  claude/packets/MA-OCT-004.GOLIVE_Control_v1.md  fe2f17fda2436172675bb97f78d1e30c2fb90b99f38a8241485c06e89fc84241 (= STATUS_BOARD row 88)
TASK:     claude/packets/MA-OCT-004.GOLIVE_Task_v1.md     87b684a6354cacdd5c684f6b67d33ada70d4a8b9ab078ed89080bb05f45203da (= Control)
GOVERNING (all re-hashed ✔):
          spec rev 1 570de1a5…5379; BUILD report 8eddf582…9616; code review 42ef7039…a8b8; FREEZES.json 4d8202bb…d7fc
COMMIT:   df4066c on origin/October-2026 (pushed; rebased onto 1a59b77, FRI30.ENG1's governance commit, which touches no App/ file)
```

## Report log (UTC, Fri 30 Oct)

| Time | Event |
|---|---|
| 06:52 | Session opened. No locks, branch `October-2026`. Hashes verified. No other Fri lane had an open production change (no FRI30 reports on disk). |
| 06:53–06:55 | M4-1 merge onto origin tip `71fab4b` (contains deploy 4 `fd7b753`). All App/Ops suites green. |
| 06:55 | Pre-flight: wrangler 4.96.0; `whoami` OK (OAuth, d1 + workers_scripts write). B5/B6 read-only re-check done. |
| 06:55 | Commit `cbc300e` → rebased to **`df4066c`** → pushed. |
| 06:56 | Pre-checks, read-only: `d1-today` 6 written / 100k; seq; B3; V2; B1; B2; B4. Rollback recorded: `2e4c3fc6`. |
| **06:56:50** | **starting MA-OCT-004 go-live** (migration 005 → seeds → one `meridian-ops` deploy → smoke) |
| 06:57:24 | M3a |
| 06:57:53 | M3 template |
| 06:57:56 | M3c |
| 06:57:58 | M3d |
| 06:58:37 | **starting `meridian-ops` deploy** |
| 06:58:48 | **deployed `e8b81bf9-6a9b-41ca-bbd1-2ec5341b11be`** |
| 06:59 | Anonymous smoke passed. Authenticated smoke waiting on the Founder's Access sign-in. |
| 07:0x | The Founder declined driving the built-in browser. The signed-in checks were handed to the Founder's own browser, with exact URLs and expected results. |
| 08:00, 12:00 | Scheduled sweeps ran on the new code: `dq_new` present (0). |
| 15:59:34 | Founder: D-1 ✔, C-1 `DQ-000029` ✔, D-3 page ✔, D-2 Submit created **DQ-000036** ✔. The dismiss (C-2) could not be run. |
| 16:00–16:01 | DQ-000036 verified read-only. Sweep logs read. `d1-today` after. Live version re-confirmed. |
| **16:01** | **004 live — `e8b81bf9`.** Change closed. |

## 1. M4-1: merge onto deploy 4

- The 004 tree was moved from `acfd069` onto `origin/October-2026` `71fab4b`, which contains `fd7b753`.
- Conflicts were exactly the review's:
  - **`ops-api.js` hunk 1:** deploy 4's loop head kept, `prevSweepStart` declared beside `raisedToday`, and 004's loop inserted after `sweepRows = runRows`.
  - **`ops-api.js` hunk 2:** deploy 4's response fields kept, then `dq_new`, `dq_since`.
  - **`wrangler-ops.toml`:** deploy 4's `OPS_SWEEP_GLEIF_CHECKS`/`OPS_SWEEP_AUTORESOLVE` kept, and **one** `OPS_SERVICE_ACTORS` line (004's superset: the ops-script entry byte-identical, plus the `bond-runner` placeholder `__BOND_RUNNER_CLIENT_ID__`).
- No other change: every 004 file hashed identical to the BUILD report before the merge.
- **Merged hashes:** `ops-api.js` `a79425275fb965445b1e0474209cec43c577e3fcea70498da31d20b93e7eb74e`; `wrangler-ops.toml` `5c4a4f4bedbcb1b59ad7178e6dfce20cdba1a487a3fbd114a1d842dfb640d8d6`.
- `wrangler deploy --dry-run` parsed the toml: one `OPS_SERVICE_ACTORS` and all 11 vars.
- **Suites on the merged tree:**

| Suite | Result |
|---|---|
| `dq-contract` | 68 |
| `dq-page` | 19 |
| `dq-seeds` | 32 (incl. the Appendix D byte check) |
| `cases-contract` | 66 |
| `sweep-contract` | 26 |
| `sweep-ext-contract` | 34 |
| `health-check` | 18 |
| `migration-m1` | 29 |
| `control-split` | 100 |
| `lateness` | 42 |
| `admin-jobs-lateness` | 13 |
| `boost-heartbeat-resilience` | exit 0 |
| `ingest-contract` | exit 2, live-only as before |

- **Endpoints: 14 of 15.**
- **Commit `df4066c`:** 19 files, explicit paths, no 005 file (`ma-ops.js`, `ma-data.js` and `console-page.js` are absent).

## 2. D-2 / D-3 re-check against live D1 (read-only, 40 rows read)

- **B5:** 37 `final` rows for CIK `0000764764`. All 37 carry boilerplate labels and equal the 37 keys in `m3d-009dil.json` exactly, with 0 missing and 0 new.
- **B6:** both `CUSIP:14913UAP5` rows (`0001104659-24-088590#1`, `0001104659-24-088828#1`) are still `final`, filed 2024-08-13, $500m each.
- **Nothing dropped.**

## 3. Pre-checks (read-only) and M4-2

| Check | Result |
|---|---|
| `d1-today` before | rowsWritten 6, rowsRead 56,068 |
| **M4-2 seq** | `sqlite_sequence` `ops_data_quality_ticket` = **27** (not 9). New case_refs therefore start at `DQ-000028`. Gating is on counts; case_refs are recorded, not asserted. |
| Tickets before | 9 (7 resolved, 2 open). B3 = 9. V2 = 0. `ops_dq_ticket_member` absent. |
| B1 | all 37 KI 22.17 ISINs still on more than one entity (148 rows read) |
| B2 | 24 entities; `current_lei` matches the seed for all 24 (48 rows read). 013's hand-off file does not exist yet, so the overlap check is not applicable. |
| B4 | all 4 KI 22.9 edges present with `source='gleif'` and the exact `created_at` (4 rows read) |

## 4. Production writes (Ops tables only)

| Step | Tickets / members / dq events after | D1 meta | Expected (count gate) |
|---|---|---|---|
| Before | 9 / 0 / 25 | — | — |
| **Migration 005** | table + `idx_ops_dq_member_object` + member autoindex present | written 4 | additive DDL ✔ |
| **M3a** | 10 / 37 / 28 | written 140, read 121 | +1 / +37 / +3 ✔; DQ-M-000008/9 → dismissed/duplicate naming **DQ-000028** ✔ |
| **M3** template (rendered `0b60f389…`) | 15 / 67 / 35 | written 165, read 156 | +5 / +30 / +7 (5 created + 2 fix_scheduled) ✔ |
| **M3c** links | 15 / 67 / 39 | written 13, read 26 | +4 linked events ✔ |
| **M3d** D-2/D-3 (rendered `50422fa8…`) | 17 / 106 / 41 | written 146, read 139 | +2 / +39 / +2 ✔ |
| **Seeds + migration total** | | **written 468** (estimate ≈ 460; D1's per-file `changes` runs +1 against row counts) | ✔ |

**Content verified per `dedupe_key`:**

| Ticket | Seed | Content |
|---|---|---|
| **DQ-000028** | `ki:22.17` | 37 `dedupe` |
| **DQ-000029** | `ki:22.44` | sev2; 24 members: `replace_lei_t1` 6, `review` 5, `null_and_offline_match` 13; member 931 `see_also` "DQ-M-000001 (do_not_merge 931/1216)" |
| **DQ-000030** | `ki:22.9` | 4 `delete_edge`; `DQ-M-000004…7` each have one `linked` event and stay `resolved/accepted_no_fix` |
| **DQ-000031** | `ki:22.43` | `fix_pending`; `fix_ref` "MA-OCT-011 (bucket C)" |
| **DQ-000032** | `wrong_identifier` | entity 2289; `cik` 0000766704 → 0001917598 |
| **DQ-000033** | OTP | `entity_merge` `fix_pending`; members 2019 and 467290; `fix_ref` MA-OCT-013 |
| **DQ-000034** | D-2 | 37 bond members |
| **DQ-000035** | D-3 | anchored on `CUSIP:14913UAP5`, 2 members |

**Not run, deliberately:**
- **M4** (the four named 008 issuers). Task step 4 lists M3/M3a/M3c/M3d only. M4's PepsiCo Singapore text ("its 4 rows currently sit under PepsiCo Inc") predates 008 R-1, which moved those rows on Wed 28 and is being re-adjudicated by FRI30.DIL today. **Main Lane decision:** run M4 as is, or after a text fix. It is ≈ 73 writes, and the rendered file is ready.
- **M5:** waits on H-1.
- **The M3a idempotency re-run:** it would spend another AUTOINCREMENT id (M4-2). Idempotency is proven locally and on the local D1.

## 5. Smoke

| Check | Result |
|---|---|
| Anonymous GET D-1, D-3, C-1 (`DQ-000029`), `/console` | **302 to Access login**, no `Access-Control-Allow-Origin` ✔ (AC-1) |
| Cross-site preflight `OPTIONS` D-2 (`Origin: https://evil.example`) | 403, no ACAO ✔ |
| Public `GET /api/ops/cf/d1-today` | 200 ✔ |
| **D-1 list** (signed in, Founder's browser) | ✔ Founder: list shown |
| **C-1 on a DQ ref** (`DQ-000029`) | ✔ Founder |
| **D-3 page + CSP header** | ✔ Founder: page and headers checked |
| **D-2 create** via the D-3 page Submit (test ref `TICKER:ZZSMOKE004`) | ✔ **DQ-000036**, opened 15:59:34.951Z. Verified read-only: `missing_mapping`, sev3, `open`, `instrument:TICKER:ZZSMOKE004`, `object_ref` `{"via":"nav-007"}` (whitelist only), `source_system` `ma-ui`, `raised_by` = the Founder's Access email, `raised_via` `consumer_screen`, owner Data-Identity Lead (AC-6). |
| **Dismiss of the test ticket** (C-2 DQ) | ✖ **Not run.** The Founder could not run the DevTools snippet. DQ-000036 stays `open` (§7 item 1). The C-2 DQ path is the 68-check `dq-contract` suite on this exact tree. Production C-1 on the same Worker works. |
| **Sweep `dq_new`** | ✔ 08:00:09Z and 12:00:05Z responses (S-3 full-response log) carry `dq_new: 0` and `dq_since`, with `rows_read` 229 / 222. 0 is correct: the seeds are `triaged`/`fix_pending`, and `dq_new` counts `open`. **Finding (§7 item 2):** the 12:00 sweep's `dq_since` was still the 22:00Z (Thu) start, because the 08:00 run's `start` row reached Ops only at 12:00:06Z (outbox replay) while its `end` row was on time. |
| `d1-today` after (16:01Z) | 523 written / 100k (0.5%), 114,782 read. Includes this go-live's 468, DQ-000036 and the day's other lanes. |
| Live version (16:01Z) | `e8b81bf9-6a9b-41ca-bbd1-2ec5341b11be` 100%, message "MA-OCT-004 go-live (DQ ticketing, df4066c)" |

## 7. Open items (for the Main Lane)

1. **Dismiss DQ-000036** (the go-live test ticket):
   - **How:** C-2 `dismiss`, disposition `not_a_problem`, by the Founder, from any signed-in tab on `meridian-ops` (the DevTools snippet given in chat), or from the 005 console after Mon 2.
   - **Never** by a direct D1 write: the audit trail must show the transition.
   - **Until then:** it is one sev3 `open` ticket. Being `open` and opened after the 12:00Z sweep, it will show as `dq_new` at the next sweep (~18:00Z). That is expected, not an incident.
2. **`dq_new` window after a late `start` event:**
   - **Cause:** `sweep()` takes the previous health-check run's time from its `start` row only. When that row is replayed late from the runner's outbox, `dq_since` falls back one run, so a ticket can be counted in two consecutive notifications. Cosmetic: no wrong data, no extra writes.
   - **Fix:** one condition in `ops-api.js` — accept the run's `end` row too, which carries the same `started_at`.
   - **Proposed:** ride with the next `meridian-ops` deploy (005, Sat 31) with a test, not a separate deploy today.
3. **M4 (the four named 008 issuers):** not run (§4). Main Lane decides: run as is, or after FRI30.DIL's PepsiCo re-adjudication updates the text.
4. **Spec errata** (from the code review, unchanged): App. A B1 / B-2 ruling; AC-12 `see_also` wording → spec owner.
5. **`bond-runner` token:** the toml still holds the fail-closed placeholder. AC-18c waits for the Founder's Client ID and a later deploy.

## 6. Rollback (recorded)

- **Code:** `wrangler rollback 2e4c3fc6-b56b-4ce0-b7df-24954d05afb9` (deploy 4). `14aa968c` only with LANE-8-ENG's agreement.
- **Kill switches:** `OPS_DQ_ENABLED`/`OPS_DQ_CONSUMER_ENABLED`, each followed by a deploy.
- **Migration 005:** stays.
- **Seeds:** dismissed via C-2, never deleted.
