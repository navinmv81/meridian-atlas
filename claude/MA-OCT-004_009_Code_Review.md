# MA-OCT-004 + MA-OCT-009/010 — Architect code review

```text
PACKET:      MA-OCT-BUILD.REVA — Architect code review (REVIEW-A), Claude Code, read-only
CONTROL:     claude/packets/MA-OCT-BUILD.REVA_Control_v1.md  0e3f6288…15f6 (matches STATUS_BOARD row 85)
TASK:        claude/packets/MA-OCT-BUILD.REVA_Task_v1.md     fa563ec2…3c4 (matches Control)
INPUTS:      004 report 8eddf582…616 ✅ · 004 spec rev 1 570de1a5…379 ✅ (committed at HEAD)
             009 report a32e8d0b…459 ✅ · 009/010 spec rev 1 2f83d58e…1f4 ✅ (working copy only; HEAD = rev 0 8216123e…)
             FREEZES.json 9c368fa6…e829
DATE:        Thu 29 Oct 2026, 20:15–20:45Z
ACTIONS:     0 D1 writes · 0 D1 rows read · 4 remote EXPLAIN QUERY PLAN (of ≤ 20) · 0 deploys · 0 commits · 0 code edits
             wrangler 4.96.0 /usr/local/bin, whoami OK; `wrangler deployments list` (read-only) for meridian-ops and meridian-entities-api
             Scratch merge of 004 onto fd7b753 in the session scratchpad only (no worktree or shared-checkout change)
```

## Verdicts

| Build | Verdict | BLOCKER | MUST-FIX before deploy | MUST-FIX before Mon 2 release | NOTE | May deploy Fri 30 |
|---|---|---|---|---|---|---|
| **004** DQ ticketing (`meridian-ops`) | **PASS WITH NOTES** | 0 | 3 (M4-1..M4-3) | — | 9 | **Yes, first**, once M4-1..M4-3 are closed |
| **009** FI API (`meridian-entities-api`) + **010** page | **PASS WITH NOTES** | 0 | 2 (M9-1, M9-2) | 2 (M9-3, M9-4; 010 front end) | 5 | **Yes, after 004 is done**, once M9-1 and M9-2 are closed |

There must be one production change at a time. 004 completes first: migration, deploy, smoke, seeds and verification. Then 009 runs: gate migration and deploy. Both are sequenced by the Main Lane against the A2 run (see M4-3 and M9-2).

---

## Part A — MA-OCT-004 (worktree `~/MeridianAtlas-work/ma-oct-004/build-worktree`)

### A.1 Base and endpoints (Task: "confirm the base is deploy 4")

**Live state:** `meridian-ops` is at `2e4c3fc6-b56b-4ce0-b7df-24954d05afb9`, message "MA-OCT-003 deploy 4 (sweep, fd7b753)", created 2026-10-29T19:34:01Z. `fd7b753` is on `origin/October-2026` (tip is now `71fab4b`, and the 008 commits after `fd7b753` touch no 004 file). ✅

**The worktree is not on deploy 4.** It is detached at `acfd069`, the parent of `fd7b753`. The report says this and plans a rebase at run-sheet step 0, but the 29 Oct decisions log entry "built + tested locally on deploy-4 base" is wrong → **M4-1**.

**Endpoints: 14 of 15, confirmed.** `fd7b753` changes only `ops-api.js` `sweep()`, adds `sweep-ext.js` and its test, and adds 2 toml vars, with no new route. The count is therefore 11 (THU29.ENG8) plus D-1, D-2 and D-3, which is 14, leaving 1 spare for 005 Option B.

### A.2 Findings

**M4-1 — MUST-FIX before deploy: rebase onto deploy 4. There are two textual conflicts, and both resolve by keeping both sides.**

The reviewer merged the 004 file set onto `fd7b753` in a scratch repo:

- **`App/Ops/src/ops-api.js` `sweep()`, hunk 1.** Keep deploy 4's loop head (`gleifOn`, `latByJob`, `sweepRows = runRows`). Declare `prevSweepStart = null` beside `raisedToday`, and insert 004's `prevSweepStart` loop straight after `sweepRows = runRows;`.
- **`App/Ops/src/ops-api.js` `sweep()`, hunk 2.** Keep deploy 4's response fields (`suppressed`, `s2_rows_read`, `gleif_checks`, `auto_resolved`, `autoresolve_skipped_reopened`), then add `dq_new: dqNew, dq_since: dqSince` before `rows_read`.
- **`App/Ops/wrangler-ops.toml` `[vars]`.** Keep deploy 4's `OPS_SWEEP_GLEIF_CHECKS` and `OPS_SWEEP_AUTORESOLVE`. Replace deploy 4's `OPS_SERVICE_ACTORS` line with 004's line, which is a superset (ops-script entry byte-identical plus the `bond-runner` entry). Keeping both lines is a duplicate TOML key, and wrangler will refuse it.

On the merged tree, every Ops suite is green:

| Suite | Result |
|---|---|
| `dq-contract` | 68 |
| `dq-page` | 19 |
| `dq-seeds` | 31, plus the Appendix D byte check, which skips outside the shared checkout and passes in the worktree |
| `cases-contract` | 66 |
| `sweep-contract` | 26 |
| `sweep-ext-contract` (deploy 4) | 34 |
| `health-check.test` | 18 |
| `migration-m1` | 29 |
| `control-split` | 100 |
| `lateness` | 42 |
| `admin-jobs-lateness` | 13 |

`boost-heartbeat-resilience` passes in the real worktree (207). In the scratch copy it fails only because sibling `Corporate Atlas` files are absent. `ingest-contract` is live-only (exit 2), as reported.

**Closing M4-1.** LANE-1-ENG makes the same resolution, runs all `App/Ops/tests/*.mjs` on the committed tree, and records the SHA-256 of the merged `ops-api.js` and toml. No re-review is needed if the merge differs from `acfd069`+004 only in these hunks. Any other change returns to REVIEW-A.

**M4-2 — MUST-FIX before deploy: the expected case_refs in run-sheet step 8 may be wrong. Gate on counts, not on case_refs.**

Step 8 expects M3a to produce `DQ-000010`, and so on through `DQ-000021`, on the assumption that `sqlite_sequence` for `ops_data_quality_ticket` is 9. That assumption is not established:

- **Earlier re-runs may have advanced the sequence.** On Sat 24, M1's V4 re-ran the file once via `--file` and once via `--command`. M1's ticket insert is `INSERT OR IGNORE … SELECT` over 9 rows that already exist. In SQLite, a row ignored on a UNIQUE conflict still spends an AUTOINCREMENT value. The reviewer reproduced this on node:sqlite: 3 conflicting rows advanced `seq` from 3 to 6.
  - So the live `seq` may be 9, 18 or 27. D1's `changed_db false` does not settle it.
  - The `INSERT … SELECT … WHERE NOT EXISTS` form (D-2, seed template) does not spend ids. The `VALUES` form (M3a) does.
- **The step-7 smoke may take an id first.** The report's §4 budget includes "1 console D-2 test ticket" in the step-7 smoke. If that ticket is created, it takes an id before the seeds run.

Amend the run sheet:
- **(a)** Step 3 adds `SELECT seq FROM sqlite_sequence WHERE name = 'ops_data_quality_ticket'` (1 row) and records it.
- **(b)** Step 8's stop rules use per-file `changes` and per-`dedupe_key` counts. Case_refs are recorded, not asserted.
- **(c)** Any D-2 test ticket in the smoke runs after step 9, or is not created at all.

B-7's statement that "production numbering matches the spec" should be withdrawn. Case_ref gaps are cosmetic, so no code change is needed.

**M4-3 — MUST-FIX before deploy: the run sheet is dated Thu 29 12:20–16:40Z. Go-live is now Fri 30, inside the A2 window.**

Re-issue the window for Fri 30 against `FREEZES.json` (`9c368fa6…`):

- **Recurring freezes:** 05:50–07:10, 07:55–08:05, 10:45–11:15, 11:45–12:15, 16:45–17:15, 17:45–18:15 and 23:50–00:10.
- **A2 window:** 08:05Z Fri → 00:10Z Sun.

004 writes only Ops tables, so it is not an "other Entities writer". However, the A2 spec (§ one-change rule) says A2 batches do not run while another lane deploys `meridian-ops`, because A2 reads `d1-today` and posts `run-event` there. The Main Lane must therefore either:
- finish 004 before A2's first live batch, or
- declare an A2 pause for 004's steps 4–9.

Step 1 re-reads FREEZES on the day. The B-checks (step 3) read Entities tables and are read-only, so they are allowed during A2.

**N4-1 — NOTE: the B5/B6 re-check now matters.** `m3d-009dil.json` was built from 008's `finals-2026-10-16.json`. Since then:
- R-1 moved 4 PepsiCo rows on Wed 28;
- R-2 re-parsed 191 rows on Thu 29 at 19:42Z, using a row-preserving rebuild.

Caterpillar CIK `0000764764` rows may be among them. The run sheet already says that if B5 or B6 differ, M3d does not run. That rule stands unchanged. Record B5's 37 keys in the report.

### A.3 Rulings on the lane's open items

| Item | Ruling |
|---|---|
| **B-2 `member_update → fixed` needs `fix_scheduled`** | **Upheld; the build is correct.** §7.1's last paragraph applies §7.5's `resolve fixed` rule to members, so App. A B1's instruction ("`member_update` → `fixed` after M3a") is read as: the Data-Identity Lead first runs `schedule_fix` with `fix_ref` naming the change that cleared the ISIN (e.g. MA-OCT-013), then marks the member `fixed`, with a note naming that packet. If no applied packet explains it, the member gets a `comment` (B1 as written). **Limitation (NOTE N4-2):** `schedule_fix` is allowed only from `open`/`triaged`, and the probe is ticket-wide, so an aggregate carries one `fix_ref` event. Members cleared by a second packet are marked `fixed` with the note naming it. **Spec erratum** for App. A B1 → spec owner. |
| **E8 bare-ISIN keys** | **Accepted.** `deriveInstrumentKey` returns `isin.trim()` for any 12-character value, so bare keys are the live form, and `INSTRUMENT_KEY_RE` correctly accepts `^[A-Z]{2}[A-Z0-9]{9}\d$` beside the `PREFIX:value` form. **NOTE N4-3:** two live key shapes are refused (400 / "not a reportable instrument"): a 12-character `isin` that is not ISIN-shaped, and a `TICKER:` key with an inner space (`deriveInstrumentKey` only trims). This fails closed, so no code change is needed for October. In November, count them with a read-only query and decide. |
| **`LIKE 'DQ-SEED-%'` scan on the ticket table** | **Accepted, as spec-fixed text.** Confirmed remotely: `SCAN ops_data_quality_ticket` (EXPLAIN, 0 rows read). The table holds 9 rows today and about 22 at the last seed. With 5 runs that is ≤ about 110 reads in total, and it is a one-off. **NOTE N4-4 (November spec):** a case-sensitive range (`case_ref >= 'DQ-SEED-' AND case_ref < 'DQ-SEED.'`) would use the `case_ref` autoindex. Template text is not changed in this build. |
| **B-7 AUTOINCREMENT numbering** | **Accepted as cosmetic.** Case_refs may have gaps, and every test and verification keys on `dedupe_key`. The claim that production matches the spec dry-run is not accepted (M4-2). |
| B-3 (service token never resolves, dismisses, reopens or sets a member `fixed`, on all DQ types) | Accepted. It is stricter than §7.5 (which covers Entities types only) and enforced before D1. |
| B-4 (AC-12 `see_also` wording) | Accepted. Appendix D governs, and the test checks the prefix. Spec erratum on AC-12 → spec owner. |
| B-6 (`String(ticket_id)` bind) | Accepted. It matches the seeds' `CAST(ticket_id AS TEXT)` on an integer column. |
| B-8 (008's `unmatched-issuers.json` absent) | Accepted. M4 is the named 4 only, and the `--unmatched` path is tested. |
| B-9 (`bond-runner` placeholder) | Accepted. The placeholder `__BOND_RUNNER_CLIENT_ID__.access` cannot match a token `common_name`, so it fails closed. AC-18c waits for the Client ID. Only the Client ID goes in the toml, never the secret. |
| B-10, B-11, B-12 | Accepted as built. |

### A.4 Code spot-checks (`cases.js`, `dq-page.js`, `ops-api.js`)

- **`dqAction`:**
  - The service-token refusal comes before any D1 call.
  - The order is: idempotency replay → `expected_status` → transition table → `do_not_merge` protection → member-open guard.
  - The `fix_scheduled` probe is `LIMIT 1` on `idx_ops_case_event_subject`.
  - The event is written before the UPDATE, and the UPDATE is conditioned on the event (BN-1). ✅
- **`dqMemberAction`:** the member change comes first. The ticket bump and the event are conditioned on `updated_at = :now`, which is §7.1 A4-3 exactly. ✅
  - **NOTE N4-5:** the 500-member cap is a pre-read and not atomic, so two concurrent `add_members` calls can exceed 500 by up to 99. This is harmless at the expected volume.
- **`createDqTicket`:**
  - Caller classes are checked before D1.
  - The object-scoped dedupe (§9.3) runs both as a pre-read and as a `NOT EXISTS` guard on the insert, with a race fallback to `reported_again`.
  - The daily cap covers all five statuses.
  - The pending case_ref is finalised in the same batch. ✅
- **`dq-page.js`:** placeholders are refused, `ref` is whitelisted, `candidates` are integer-checked and capped at 10, and the page makes 0 D1 calls. ✅
- **Sweep `dq_new`:** it counts `status = 'open'` only. Seeds are `triaged`/`fix_pending`, so the seeds will not trigger the "N new data-quality tickets" line. That is the intended behaviour.

### A.5 Three-point check — confirmed

1. **Index audit.** Remote EXPLAIN on the existing tables (0 rows read each):
   - sweep `dq_new` and the D-2 cap count → `COVERING INDEX idx_ops_dq_queue (status=? AND severity=? AND opened_at>?)`;
   - D-2 dedupe → `idx_ops_dq_object (object_domain=? AND object_key=?)`;
   - `fix_scheduled` probe → `idx_ops_case_event_subject (subject_type=? AND subject_id=?)`;
   - seed (2) → `SCAN ops_data_quality_ticket`, the accepted exception.

   The member-table plans can only be EXPLAINed after 005 is applied (run-sheet step 7). The local plans in the report §3 are accepted.
2. **Single execution ≤ 50k rows.** The worst case is about 710 rows (C-2 on a 500-member aggregate). ✅
3. **Budget.** The one-time load is about 550 index-weighted writes (0.55 % of 100k). Steady state is ≤ about 600 writes and about 3k reads a day. Every remote step reads `d1-today` first, with a 10,000-row headroom stop. ✅

### A.6 Rollback ids (verified live)

- **004 deploy:** roll back to **`2e4c3fc6`** (deploy 4).
- **Fallback:** `14aa968c` (deploy 3) only with LANE-8-ENG's agreement, because it also removes the deploy-4 sweep.
- **Kill switches:** `OPS_DQ_ENABLED` and `OPS_DQ_CONSUMER_ENABLED`, each followed by a deploy.
- **005 migration:** stays in place.
- **Seeds:** dismissed via C-2. Nothing is deleted.

---

## Part B — MA-OCT-009 / 010 (worktree `~/MeridianAtlas-work/ma-oct-009/build-worktree`)

### B.1 Base and reproduction

**Base `acfd069`.** There is no drift to `origin/October-2026` (`71fab4b`) on any 009/010 path. The live `meridian-entities-api` is **`1e54a425-492d-43f4-aa8e-c688ea1a0a4a`** (deploy 5), the rollback target. ✅

**File hashes** match the report: `entities-api.js` `2262cc51…`, `009-fi-serving-gate.sql` `aceda836…`, `ma-entities.js` `d97ea124…`, `index.html` `86f49616…`.

**Suites reproduced by the reviewer:**

| Suite | Result |
|---|---|
| `fi-009-worker` | 133/133 |
| `fi-010-frontend` | 62/62 |
| `fi-009-explain` | 14/14 |
| `nav-007-worker` | 58/58 |
| `entities-api-retirement` | 77/77 |
| `nav-007-frontend` | 39/39 |
| `nav-007-key` | 34/34 |

### B.2 Findings

**M9-1 — MUST-FIX before deploy: commit spec rev 1 first.** `HEAD` (and origin) hold rev 0 `8216123e…`. Rev 1 `2f83d58e…` exists only as the shared checkout's working copy. LANE-1-ENG commits it, by explicit path, before the 009 Worker commit, and the Worker commit message cites `2f83d58e…`. This upholds lane item 5.

**M9-2 — MUST-FIX before deploy: the run-sheet slot conflicts with the A2 window.** The suggested slot, 08:10–10:30Z Fri, is inside A2's "other Entities writers frozen" window. `fi_serving_gate` is an Entities-domain table (spec §3). The A2 spec exempts "the one-row `fi_serving_gate` flip". It does not exempt the **CREATE** migration. Choose one:
- **(a)** run the gate migration (about 3 writes) in the **07:10–07:55Z** Fri gap; or
- **(b)** the Main Lane records an explicit A2 exemption for the CREATE.

The Worker deploy writes nothing to D1, but it is still the one production change of its moment. The Main Lane sequences it after 004's step 9 and between A2 batches, and the run sheet logs the UTC start.

**M9-3 — MUST-FIX before the Mon 2 site release (010; not a Friday blocker): `ambiguous`/`source_conflict` with fewer than 2 candidates (lane item 3).**
- **The Worker is correct.** Spec §4.3 makes a key filed under 2 CIKs `source_conflict`, never an arbitrary pick, and 007 §5.1 maps `source_conflict` to `ambiguous`.
- **The front end is not.** `_navRenderInstrument` prints "{n} candidate issuers — none is selected for you", and the state line says "Our sources disagree about the issuer. **Choose one.**" With 0 or 1 candidates there is nothing to choose ("0 candidate issuers").
- **Fix:** when `state = 'ambiguous'` and `candidates.length < 2`, drop the count line and "Choose one." Show "Our sources disagree about the issuer." plus the existing report-a-problem path, and add one T-F9 fixture.
- No served key spans 2 CIKs today (N8-3 = 0, Wed 28), so there is no live exposure before the fix.

**M9-4 — MUST-FIX before the Mon 2 site release (010): F1 "latest filing" (lane item 6). The current form is not accepted.**
- **Why it misleads.** `freshness.latest_filing_date` is the maximum over the rows fetched for one page. With `include_matured=0`, pages are ordered by maturity, so page 1 routinely misses the issuer's newest filing. Labelling it "latest filing" (AC-F6) misstates freshness.
- **What may ship Friday.** The Worker field may ship as is, because Friday is API-only.
- **What must change before Mon 2.**
  - The 010 page must take the issuer's latest filing from F3's per-issuer `latest_filing` for the issuer's CIK(s). F3 is the cached directory call, and its uncached cost is about 1.5k reads.
  - If that is not built in time, the fallback is to label the value "latest filing among the bonds shown".
  - The spec owner amends §5.2 to define the F1 field as per-response.

**N9-1 — NOTE: R1 now makes one gate read per call.** That is +1 read per instrument view, which is trivial. A D1 error other than "missing table" on that read now returns 500 from R1. This is the same failure domain as R1's other reads. Accepted.

**N9-2 — NOTE: report items 3, 4 and 8 are accepted.**
- Item 3: `other_filings` and N8-3 come from one statement.
- Item 4: F4's SELECT adds `parse_confidence`, and the plan is unchanged.
- Item 8: F3 is about 1.5k reads with no GROUP BY temp B-tree. That figure stays "planned" until it is measured.

**N9-3 — NOTE: report item 10 (gate open/close statements not held in a file) is accepted.** They are run on the Data-Identity Lead's signed instruction (§4.1).

### B.3 Rulings on the lane's six items

| # | Item | Ruling |
|---|---|---|
| 1 | 007 test-fixture change | **Accepted.** Verified: 7 lines change in the fixture DDL/data only (the `parse_confidence` column, plus `fi_serving_gate` seeded `open`). All 58 assertions are unchanged, and the suite re-ran at 58/58. The closed, garbage and missing gate cases are covered by T-F6. |
| 2 | Cache proof moved to the open-gate re-run | **Accepted.** §5.7 (closed bodies are never cached) overrides T-F10's "closed, with the cache proof", which is a spec contradiction; erratum → spec owner. **Closed T-F10:** asserts `no-store` on F3/F4 and no `x-fi-cache: hit`. **Open re-run:** F3 ×2 and F4 ×2, 1–5 s apart, recording `x-fi-cache`. **Budget:** until a `hit` is recorded, the uncached budget is the planned figure, and F4 stays first in the §11 cut order. |
| 3 | `ambiguous` with 0 candidates on the 007 card | The Worker is right; the front-end copy must change → **M9-3** (before Mon 2). |
| 4 | Live-browser pass incl. 375 px deferred to Fri 30 | **Accepted.** The T-F9 live pass (fixtures, 375 px stacked rows with no horizontal scroll, Back closes one layer) is a gate for the **Mon 2 site release**, not for the Friday Worker deploy. Main Lane call on tooling: the reviewer recommends a preview served from the **009 worktree's own, untracked** launch config, removed afterwards. Do not edit the shared checkout's tracked `.claude/launch.json`. |
| 5 | Spec rev 1 committed before the 009 commit | **Upheld** → **M9-1**. |
| 6 | F1 "latest filing" per page | **Not accepted as labelled** → **M9-4** (before Mon 2). The Worker may ship Friday unchanged. |

### B.4 Code spot-checks (`entities-api.js`)

- **`fiGate`:** a missing table → closed; a row with any state other than `'open'` → closed; any other error → thrown (500). This matches §4.1. ✅
- **Cache key:** URL + `__fi_gate=state|changed_at` (and the UTC date for F4). The gate is read before the cache, and closed or missing-table bodies are never stored. A gate flip therefore can never resurrect a pre-close body. ✅
- **R1f:** runs only when the gate is open, with the `'final'` literal kept in SQL, `parse_confidence >= 60`, and `DISTINCT cik … LIMIT 2`. 2 CIKs → no candidate plus `source_conflict`. ✅
- **Closed F1:** checked before the 10-CIK cap, so a closed 422 cannot leak a CIK count (DIL M-4). ✅

### B.5 Three-point check — confirmed

1. **Index audit.** All 14 plans are as required, and the live EXPLAINs (build lane, 0 rows) are identical to the local ones:
   - P-B1 is a true row-value index range on `idx_bi_cik_final_key`, with no temp B-tree.
   - F3's `SCAN bond_issuer_link` covers about 30 rows, and its count is an index scan over about 633 finals.
2. **Single execution ≤ 50k.** The largest is F3 uncached, at ≤ about 1.5k. ✅
3. **Budget.**
   - **Gate migration:** about 3 writes.
   - **Uncached worst case:** about 0.5–0.7M reads/day (10–14 % of 5M).
   - **Cached:** about 0.25M, once a hit is proven.
   - **PepsiCo S1:** 8 reads, PASS. It is re-run at run-sheet step 4. ✅

### B.6 Rollback (verified live)

- **Target:** `1e54a425` (deploy 5), never `73851c02`.
- **Data incident:** close the gate; do not roll back the Worker.
- **Worker defect before Mon 2:** a rollback is acceptable, plus the same-day R1f switch-off or a fixed re-deploy (the rollback restores the ungated R1f).
- **Gate table:** stays in place (it fails closed).

---

## Part C — Fri 30 order (for the Main Lane)

1. **LANE-1-ENG:**
   - commit spec rev 1 (M9-1);
   - rebase and commit the 004 files onto the origin tip, which contains `fd7b753`, with the M4-1 resolution, all Ops suites green, and the merged hashes recorded;
   - commit the 009 Worker files.
2. **Main Lane:**
   - amend the 004 run sheet (M4-2 sequence read and count-based stops; M4-3 Fri window);
   - choose M9-2 (a) or (b);
   - sequence both changes against A2's first batch.
3. **004 go-live** (steps 1–10), then **"004 done <UTC>"**.
4. **009:** gate migration (in the slot chosen for M9-2) → P-F4 → §4.4 re-check → deploy → T-F10 closed. **"009 done <UTC>"**.
5. **Before Mon 2:** M9-3, M9-4, and the T-F9 live and 375 px pass; then the spec errata (004 App. A B1 and AC-12; 009 T-F10 and §5.2) to the spec owners.
