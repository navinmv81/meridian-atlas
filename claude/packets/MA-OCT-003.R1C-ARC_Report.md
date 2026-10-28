# MA-OCT-003.R1C-ARC — Report: Architect delta check of 003 + 004 specs rev 1

**Control v1** `0b1ac4ec27d788eb198f73feb9cab1c8632c9691204cc243714bc40fecf98b22` (matches STATUS_BOARD.md row 34)
**Task v1** `dc52985469d3b2115d251bccfb9dc9277edd1cf94072711f7dab8e209c53482e` (matches the Control)

```text
REPORT TO:    Main Lane
FROM:         REVIEW-A, Architect, Sat 17 Oct 2026 (~14:45 UTC)
EXECUTED ON:  Founder's instruction to execute
VERDICT:      MA-OCT-003 rev 1: PASS WITH NOTES. A3-1..A3-7 all MET. Founder F-1..F-3 written in as decided. No remote step before Sat 24.
              MA-OCT-004 rev 1: PASS WITH NOTES. A4-1..A4-4 all MET. Founder F-1..F-3 written in as decided. No remote step before Tue 27.
              Nothing new breaks boundaries, the three-point check or security.
              One build-gate condition (G-1, Sat 24 vs a still-running 011) and 7 doc notes; none blocks spec approval.
```

## 1. Preflight and inputs
- HEAD `0dd7ef0`, no `.git/*.lock`, git read with `--no-optional-locks` only. 0 D1, no deploys, no git writes. REVIEW-A did not author either spec.
- `claude/packets/MA-OCT-003.R1_Report.md` is **not on disk** (the Mac link dropped, per the Decisions Log 17 Oct), so per the Task each spec's change table was used (003 App. D, 004 App. C). **Every row was checked against the text**, not taken on trust.

| Input | SHA-256 (as found) | |
|---|---|---|
| `claude/MA-OCT-003_Spec.md` rev 1 (937 lines) | `7b8bba9f3adb582c495c3899717a98dee61d8c0f285919b221240ca1483480c2` | ✔ Task |
| `claude/MA-OCT-004_Spec.md` rev 1 (1,511 lines) | `570de1a571a69c752ce26ce3502177fbadca8e9fcb0d00b4f44f992c9dee5379` | ✔ Task |
| `claude/MA-OCT-003_Spec_rev0.md` | `8fb129ac00909aecbbd4065f05895ba88808614352f46eb8499679fd74a0ed91` | ✔ = rev 0 reviewed |
| `claude/MA-OCT-004_Spec_rev0.md` | `c3d0cd3e1ddfc02a5eeb48101eabe5f2aebbfd93dbc47df96ace15c5b51c0889` | ✔ = rev 0 reviewed |
| `claude/October_Decisions_Log.md` | `f4b3d42a005c85674e785756a57b0c772c65c57216323a14018576074a914fa2` | as found (Founder answers row; ML-1017-3) |
| `App/Corporate Atlas/src/entities-api.js` | `fac446bf…e245` | = 003 rev 1 App. C basis ✔ |

## 2. MA-OCT-003 rev 1 — required changes

| ID | Result | Where met |
|---|---|---|
| **A3-1** calendar under N-3 | **MET** | §16 calendar rule: Mon 19–Fri 23 local only; no 003/A6 remote step before Sat 24 08:05Z, **including the Access Block, dump, M1/M2 and `004-ops-cases.sql`** (ML-1017-3 overrides my "D1-only may run" view; accepted). Sat 24 has 3 production deploys (A6 ×2, routes + allowlist). Mon 26 has 2 (sweep extensions, retirement). Nothing on Sun 25. C1 and the previous version id are recorded before each deploy. Slip rule given. §5, §10.3, §17, App. B and App. D row 1 are consistent. |
| **A3-2** delete by symbol | **MET** | §10.5 R-1/R-2 name every target by symbol, with "Line numbers must never be used"; nothing under `/api/instruments/*` or `/api/entities/*` is touched. R-4 keeps GET/OPTIONS. R-9, test 4 and AC-14 add 007 R1–R4 and `nav-007-worker.test.mjs` 58/58. The base is `0dd7ef0` (D-4). The re-hash `fac446bf…e245` matches disk. |
| **A3-3(a)** reused `request_id` | **MET** | §8.4 statement (1) adds `AND NOT EXISTS (… idempotency_key = 'act:'||:request_id)`, a reuse with a different action → 409 `request_id_reused`, and the "comments serialise" line is corrected. AC-4 case 2. |
| **A3-3(b)** auto-resolve after reopen | **MET** | §9.4: key `'autoresolve:'||case_ref||':'||:now` plus the guard, and any case with a `reopened` event is skipped forever. §9.5 adds `autoresolve_skipped_reopened`. AC-11. |
| **A3-4** bound S2 | **MET** | §6 adds `idx_ops_exception_job_cond(job_id, exception_type, status, resolved_at)`. §9.1 restricts S2 to the 6 condition types, written as `UNION ALL` (the author found that the `OR` form used only the 2-column prefix, which is a good catch). Bound ≤ about 190 per job. §11.1 write costs are updated (+1 index key). AC-16 measures S2. |
| **A3-5** CSRF on E-2/C-2 | **MET** | §8.3: JSON + `X-Ops-Client`, else 400 before D1, in front of `readJson()`. Governance POSTs are noted for 002b. AC-1 case added. |
| **A3-6** secret and dump paths | **MET** | R-7 deletes `~/.meridian-secrets/admin-exceptions.env` as a local step with Founder approval, after R-6 and AC-14. §10.3: dumps go to `~/MeridianAtlas-work/ma-oct-003/` (mode 600, outside iCloud and the repo), are recorded by hash only, and are deleted after R-10. AC-15. |
| **A3-7** AC-14 observable | **MET** | AC-14: Mon 26 = Access 403 on the blocked paths + **production 410 on `/admin/exceptions`** (not under the Access app, which is better than I asked) + Worker-level 410 in test 4 + dump compare. AC-14b: 31 Oct, after R-10. |

**Founder answers (003):**
- **F-1** auto-resolve: never re-closes a human reopen; switch + cap; ships `true` Mon 26 after AC-11 passes in test 3 (§9.4).
- **F-2** keep frozen: the drop only after merge writers, 013 first, read `do_not_merge` from Ops; the 3 pairs are protected (§10.6).
- **F-3** scoped token: raise, read and comment, never resolve/dismiss/reopen `DQ-`; allowlist live before admission (§8.5, AC-1b).

All three are written in as decided ✔.

**New material checked:**
- **§8.5 allowlist** (`OPS_SERVICE_ACTORS`, a `[vars]` value holding identifiers only):
  - checked after `verifyAccessJwt` on every admin route;
  - unknown token or out-of-scope route/action → 403 before D1;
  - actor `service:<label>`, raw `common_name` in the payload (N3-3 ✔);
  - admission order explicit, one token per caller, `~/.meridian-secrets/` mode 600 with expiry, never in repo, logs or reports;
  - rollback = remove from the Access policy, then revoke (§17).

  **Sound** ✔.
- **Rewritten S2:** the bound holds for condition types (≤ 1 case per episode per day). Event-type cases are no longer read ✔.
- **M2 E4-delta seed** (`EXC-M-000002`): it is suppressed against the automatic E4 by S2 while open (AC-10). ≤ 20 writes ✔.
- **Boundaries:** unchanged from rev 0. Ops writes only; Entities reads (`entity_exceptions`, `entity_enrichment_queue`) only; no ETF table; no cron ✔.

## 3. MA-OCT-004 rev 1 — required changes

| ID | Result | Where met |
|---|---|---|
| **A4-1** dates | **MET** | Header, §5, §16: local from Mon 26; remote Tue 27, only after 003 is live. Slip rule tied to 003's Sat 24 (D-1), and 007's button deferred under 007 §12. Rev 0's Fri 23 prep is dropped, which is consistent with the Task. |
| **A4-2** token scoping | **MET** | One mechanism (003 §8.5). 004 §8.3 caller matrix: `bond-runner` = D-2 `missing_entity` only; `ops-script` = none on D-2, and on `DQ-` only `comment`/`assign`/`triage`. §8.5: a separate token, admitted after the 004 deploy is verified, stored at `~/.meridian-secrets/bond-runner-ops.env` (mode 600, expiry). AC-18 (2), AC-18c. |
| **A4-3** member guards | **MET** | §7.1 "Member-level actions": the member `UPDATE` is guarded by expected state and `NOT EXISTS`, and the ticket bump and event are each conditioned on `member_status = :to AND updated_at = :now`. `add_members` and `link_exception` follow the same pattern. AC-9. |
| **A4-4** 013 hand-off | **MET** | §7.6 and §10.6: never rewritten; resolved on read through `entity_merge_redirect`, which is read-only, PK-probed, tolerant of a missing table, at most 5 hops and cycle-guarded; `merged_into` returned. B2 compares the 24 ids with 013's hand-off file. AC-19. |

**Founder answers (004):**
- **F-1** KI 22.9 is now an unconditional aggregate. The legacy `DQ-M-000004…7` get `linked` events and are not changed. The delete must match all 5 identity fields (§10.2).
- **F-2** the `bond-runner` token is raise-only (§8.5, §10.4).
- **F-3** `dq_new` uses one covering count and 0 writes, with no new macOS permission (§9.5, AC-20).

All three are written in as decided ✔.

**My rev 0 notes:** `base-uri 'none'` ✔, five-status cap ✔, member keyset page ✔, M4 file SHA ✔, and `fix_ref` only in the event ✔ (§7.5 says `proposed_resolution` is never rewritten).

**New material checked:**
- **Seed template + `seed-sql.mjs` + Appendix D:**
  - The data is embedded as a single SQL string literal, with single quotes doubled. That is the complete escaping rule for a SQLite literal, so the reviewed JSON cannot break out of the literal ✔.
  - Idempotent: `dedupe_key` UNIQUE, the open-on-same-object guard, `INSERT OR IGNORE` members and events, and fixed event keys ✔.
  - A file stopped part-way is resumed by a re-run ✔.
  - The data holds public identifiers and names only ✔.
  - A seed skipped by the open-object guard would be caught by AC-12, AC-13 and AC-17 (they assert each named seed) ✔.
- **Edge member keys:** they use `…:legal_parent:gleif:2026-06-10T19:51:32` (no space, so they pass the `\S` key rule), with the verbatim `created_at` (`2026-06-10 19:51:32`) in `object_ref` and B4 re-reading by PK ✔.
- **Boundaries:**
  - Ops writes only.
  - New Entities **reads** are `entity_merge_redirect` PK probes and build checks B1, B2 and B4 (PK or index, ≤ 250 reads).
  - No ETF table.
  - `ops_dq_ticket_member` remains Ops-domain, as declared.
  - No cron. The notification is a one-line change to an existing local script ✔.
- **Three-point check:** every query is an index `SEARCH` or a PK/unique probe; per-call well under 50k; one-time writes ≤ about 1,100, each run behind `d1-today` ✔. See note R1-3 on one stated maximum.

## 4. Build-gate condition (not a spec defect; for the 003 build brief or Control)

- **G-1. Sat 24 `meridian-ops` deploys versus a still-running 011.**
  - 003 §16 assumes the 011 run ends 23 Oct. But 011's pilot only started today, after the P-3 fix (P3R; RUN Control v3), and the runner calls `d1-today` and `run-event` on `meridian-ops` around every batch. 003 itself says "a redeploy mid-batch makes it fail closed". Deploys 2 and 3 (A6, then routes) therefore need a precondition: **no 011 batch in flight, and 011 either closed or held at a checkpoint, confirmed by LANE-11-ENG and the Main Lane before deploy 2**.
  - If 011 is still running on Sat 24, either deploy between batches with 011 held, or apply 003's own slip rule (move the Sat 24 block to Mon 26/Tue 27).
  - This keeps ML-1017-3's intent ("one change at a time during the 011 run").

## 5. Notes (non-blocking; fix at the next revision or in the build)

- **R1-1. `X-Ops-Client` vocabulary differs.** 003 §8.3 accepts `console|script|dq-page`; 004 §8.4 says `console|dq-page|service`. The `bond-runner` caller would send `service`. Use one set in `cases.js`, for example `console|script|service|dq-page`, and say so in both specs.
- **R1-2. `member_update` statement (1) does not re-check the ticket's status.** §7.1 allows member actions only on `open`/`triaged`/`fix_pending` tickets, but the guarded `UPDATE` tests only the member row. Add `AND EXISTS (SELECT 1 FROM ops_data_quality_ticket WHERE ticket_id = :tid AND status IN ('open','triaged','fix_pending'))`, so a concurrent resolve cannot be followed by a member change.
- **R1-3. C-1 redirect worst case is understated.** 200 members × ≤ 5 hops = ≤ 1,000 probes, so C-1 can reach about 1,405 reads, not "≤ 500 with redirects" (§11.2). That is still far under 50k, so the three-point check holds. Correct the number, or cap the redirect probes per call (013's brief says chains are flattened on write, so 1 hop normally suffices).
- **R1-4. `WHERE case_ref LIKE 'DQ-SEED-%'`** (template step 2) does not use the BINARY `case_ref` index, because `LIKE` is case-insensitive. It is a scan of a small Ops table (< 1,000 rows). Declare it as a bounded scan, or use `case_ref >= 'DQ-SEED-' AND case_ref < 'DQ-SEED.'` for an index seek.
- **R1-5. Generator placeholder order.** Substitute `__FILE_SHA__` first, and `__SEEDS__` by splitting the fixed template, so that no data value containing a placeholder token is ever rewritten. Refuse an input file containing NUL. Unit-test it with a value containing `'`, `__SEEDS__` and `--`.
- **R1-6. Stale key format in 004 §6** (line 159). `entity_relationships:<parent>-><child>:legal_parent` should add `:<source>:<created_at, T-separated>`, to match Appendix D and AC-12.
- **R1-7. The §9.4 reopen probe** reads the case's events on `idx_ops_case_event_subject` and then filters `event_type`, so it is "≤ events per case" rather than "one probe". Bounded (≤ 20 candidates × ≤ 200), so this is a wording fix only.

## 6. Questions for the Main Lane
1. Put **G-1** in the 003 build Control (Sat 24 precondition), or rule it here?
2. Route R1-1..R1-7 to the build brief (preferred: none changes a plan number or a review finding), rather than a rev 2 before approval?

REVIEW-A did not edit any spec, STATUS_BOARD.md or a Status JSON.
