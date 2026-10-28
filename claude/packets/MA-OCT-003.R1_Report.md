# MA-OCT-003.R1 — Report (LANE-3, Operations Lead): 003 and 004 specs rev 1

**Control v1** `9c42ff1017a08cc927bb460d9575bfa5a78f43b3a99d2929d630ea572904c27b`: matches STATUS_BOARD row 32 and the Status JSON.
**Task v1** `1c3c1e6e199f903715853fa6c7d6ec8844bce1eccc5789674cf864622c0a1f1a`: matches the Control.
**Date:** Sat 17 Oct 2026, on the Founder's "execute it".
**Git:** `October-2026` @ `0dd7ef0`, read with `--no-optional-locks` only. No `.git/*.lock` at start.
**Doc-only:** 0 D1 reads or writes, no deploys, no git writes. No secret file opened. No command that could raise a macOS prompt.
**Files written** (all inside the Control's write scope): the two specs, their `_rev0` copies, and this report.

## Outputs

| File | SHA-256 | Lines |
|---|---|---|
| `claude/MA-OCT-003_Spec.md` **rev 1** | `7b8bba9f3adb582c495c3899717a98dee61d8c0f285919b221240ca1483480c2` | 937 |
| `claude/MA-OCT-004_Spec.md` **rev 1** | `570de1a571a69c752ce26ce3502177fbadca8e9fcb0d00b4f44f992c9dee5379` | 1,511 (incl. ≈ 520 lines of verbatim seed JSON, App. D) |
| `claude/MA-OCT-003_Spec_rev0.md` (copy, made first) | `8fb129ac00909aecbbd4065f05895ba88808614352f46eb8499679fd74a0ed91` | = rev 0 |
| `claude/MA-OCT-004_Spec_rev0.md` (copy, made first) | `c3d0cd3e1ddfc02a5eeb48101eabe5f2aebbfd93dbc47df96ace15c5b51c0889` | = rev 0 |

**Inputs (hash-checked):**
- REVARC `598caa80…2d63` ✓; REVDIL `37aaa057…f217` ✓; DIL14 `c517dde7…c9399` ✓.
- Read pack results `93a8d434…af99`; Decisions Log `df022fe2…631e` (ML-1017-1..3).
- `entities-api.js` at `0dd7ef0`: `fac446bf…e245`.

**Bridge note:** after the two spec writes were confirmed, the device stopped responding. **Re-hashed on disk after it reconnected (Sat 17, ≈ 14:40 UTC): both specs match the SHA-256s above (937 and 1,511 lines), the `_rev0` copies still equal rev 0, and there is no `.git/*.lock`.**

## Task item 1 — required changes applied

Each spec ends with a change table: **003 Appendix D** (21 rows) and **004 Appendix C** (19 rows).

| Spec | Applied | Not applied |
|---|---|---|
| 003 | A3-1..A3-7 (all); 003-1..003-8 (all); REVARC notes RQ-1..5 and N3-1..N3-4 | none |
| 004 | A4-1..A4-4 (all); 004-1..004-9 (all); REVARC notes RQ-1..3 and N4-1..N4-5 | none |

**Where the reviews overlap or conflict, the wording taken and why:**

| # | Point | Wording taken | Why |
|---|---|---|---|
| 1 | REVDIL 003-6 lets the Access Block stay on Thu 22; A3-1 lets D1-only steps run in the window | **ML-1017-3**: every remote step ≥ Sat 24, the Access Block included | The Main Lane ruling came after both reviews, and Task item 3 restates it |
| 2 | Sat 24 deploy count (A3-1 "≤ 3") and REVDIL's Mon 26 retirement | Sat 24: A6 (2 deploys) + 003 routes. Mon 26: sweep extensions, then the `entities-api` retirement. | Satisfies both reviews |
| 3 | REVDIL 003-4 (two options) and REVARC N3-1 | Exclude the 011 runner from `GLEIF_JOBS` (E1 and E4) | Covers both reviews; no change to 011's emitter |
| 4 | A4-2 (token scope) and 004-9 / Founder 003-Q3 (who may resolve) | One allowlist, `OPS_SERVICE_ACTORS`, defined in 003 §8.5 (`ops-script`), with 004 adding `bond-runner`. Neither token ever resolves, dismisses or reopens a `DQ-` ticket. | One mechanism for both Founder answers |
| 5 | DIL14 `identity_mismatch` and REVDIL `wrong_identifier` | `wrong_identifier` | REVDIL gives the seed shape; same meaning |
| 6 | REVDIL 004-1 ("no entity" for GM Financial and Pfizer NL) and DIL14 DQ-3/DQ-4 (corrected: candidates exist) | `missing_entity` tickets **with candidate members** and DIL14's actions; only Welltower Inc gets `create_entity` | DIL14 is later and checked against the 16 Oct export |
| 7 | REVDIL 004-7 (`source` in the edge key) and the `entity_relationships` PK | The key carries `source` **and** `created_at`; `object_ref` holds all five fields; new build check B4 | Legacy and 011 edges are both `gleif`; only `created_at` tells them apart |

## Task item 2 — Founder answers (17 Oct, all YES), moved into the body

| Answer | Where |
|---|---|
| 003 Q1: auto-resolve replayed `job_missed`, under its own switch and cap, audited, **never re-closing a human reopen** | 003 header F-1, §9.4 (any `reopened` event → skipped; collision-free idempotency key), AC-11 |
| 003 Q2: keep `entity_exceptions` until a November drop, **after every merge writer (013 first) reads `do_not_merge` from Ops** | 003 header F-2, §10.6 (pairs 931/1216, 2589/25577, 2014/25655 named as protected), §19 H-2 |
| 003 Q3: scoped service token; raises, never resolves or dismisses Entities tickets; allowlist live before admission | 003 header F-3, §8.5, AC-1b; 004 §7.5, AC-18 |
| 004 Q1: reopen KI 22.9 as an aggregate (delete = Data-Identity Lead packet ≥ Sat 24, full edge identity) | 004 header F-1, §10.2 (now unconditional), M3c links; legacy `DQ-M-000004…7` unchanged |
| 004 Q2: 008's runner raises `missing_entity` with the token | 004 header F-2, §8.5 (`bond-runner`, D-2 / `missing_entity` only), AC-18c |
| 004 Q3: new-DQ count in the health-check notification | 004 header F-3, §9.5 (`dq_new`, one covering-index count, 0 writes), AC-20 |

Both specs' §19 now say "no Founder questions open".

## Task item 3 — calendar (ML-1017-3)

**003:**

| When | What |
|---|---|
| Mon 19 – Fri 23 | Local only: A6, `cases.js`, sweep extensions and retirement, each in its own commit; tests 1–4. **No remote step.** |
| Sat 24 ≥ 08:05 UTC | **Deploy 1** `meridian-control`; **deploy 2** `meridian-ops` without the governance routes (A6). Then `004-ops-cases.sql` and **deploy 3**, the 003 routes and allowlist. Then the Founder's Access Block → dump → M1/M2 → the token is admitted. |
| Sun 25 | Nothing (UK clock change; the Sun freeze) |
| Mon 26 | **Deploy 4**, the sweep extensions; re-dump; **deploy 5**, the `entities-api` retirement; R-6 to R-8 |
| 31 Oct | R-10, AC-14b |

**004:** local build from Mon 26; remote from Tue 27, **only after 003 is live**. Rev 0's D-1 ("003 live by Fri 23") is removed. Slip rule: if Sat 24 slips, 004 slips with it, and 007's button is deferred under 007 §12. The Main Lane records that effect by Wed 28.

## Task item 4 — known DQ items seeded by 004

All are in 004 §10.2 and §10.4, with verbatim data in Appendix D:

| Item | Seed |
|---|---|
| Welltower OP LLC CIK on 2289 | `wrong_identifier`, entity 2289, `cik` 0000766704 → 0001917598; fixed before 008's 2289 link (H-3) |
| Welltower Inc | `missing_entity`, `sec_cik:0000766704`, `create_entity` |
| GM Financial | `missing_entity` with candidates 3324, 30187, 103981 (`merge_then_assign_lei`; a 013 input) |
| Pfizer NL | `missing_entity`, `co_registrant_of` Pfizer, candidate 106006; never linked to the parent |
| PepsiCo Singapore Financing I (CIK 0002007029) | `missing_entity` recording the wrong link to guarantor PepsiCo Inc 1457 (008 R-1 moves the rows), candidates 3367 and 31416 |
| OTP Bank pair | `entity_merge`, 2019 / 467290, `fix_ref` MA-OCT-013 |
| KI 22.44 | 24 members from Evidence §15.3: 6 `replace_lei_t1`, 5 `review`, 13 `null_and_offline_match`; 931 cites `DQ-M-000001` |
| KI 22.43 | Aggregate, 0 members, `fix_ref` MA-OCT-011 |
| KI 22.9 | Aggregate, 4 full-identity edges |

Plus M5: 7 011 close-out aggregates, waiting on H-1.

## Task item 5 — change tables

003 Appendix D and 004 Appendix C, one row per required change and Founder answer, each with its location.

## Author's local checks (not a review; the reviewers re-check)

**Setup:** Python `sqlite3` 3.45.1 in an in-memory database. Loaded from the real repo files: `002-ops-control-plane.sql`, 003's `004-ops-cases.sql` (both indexes), 004's `005-ops-dq.sql`, and the 015b and 015c migrations (9 rows). Then the specs' own SQL in order: 003 M1, M2; 004 M3a, the M3 template over Appendix D, the M3c links, M4.

**Results:**
- **Row changes per step:** M2 4 · M3 47 · M3c 4 · M4 19.
- **Final state:**
  - 19 DQ tickets (9 `DQ-M-*` + `DQ-000010…19`) and 2 seeded exceptions;
  - member actions 6/5/13 for KI 22.44, 37 `dedupe`, 4 `delete_edge`;
  - events `created` 19, `decision_recorded` 7, `migrated` 9, `dismissed` 2, `fix_scheduled` 2, `linked` 4.
- **Re-runs** of M2, M3a, M3, the M3c links and M4: **0 changes each**.
- **The spec text matches what was tested:** 004 Appendix D's JSON and the §10.2 template and links were extracted from the spec and compared equal to the dry-run's inputs.
- **One plan finding, fixed in 003 rev 1:** S2 written with `OR` used only `(job_id, exception_type)` of the new index. Rewritten as `UNION ALL`, both branches use the full key: a covering seek for open cases and a `resolved_at` range for the snooze (003 §9.1).
- The idempotency guard probe is a covering seek on `sqlite_autoindex_ops_case_event_1`.

## For the Main Lane

1. Both specs are re-hashed and confirmed on disk (bridge note). Issue the delta-check Controls: Architect for A3-*/A4-*, Data-Identity Lead for 003-*/004-* and the seed data in 004 Appendix D.
2. **Hand-offs recorded in the specs:**

| # | Hand-off |
|---|---|
| H-1 | LANE-11 supplies the 011 close-out lists and SHAs (M5, KI 22.43) |
| H-2 | 013 brief: exclude the `do_not_merge` pairs; add the OTP Bank, GM Financial and PepsiCo Singapore clusters; read `do_not_merge` from Ops. Needs its own packet. |
| H-3 | 008: link 2289 only after its `wrong_identifier` fix |
| H-4 | Data-Identity Lead fix packets ≥ Sat 24 |

3. **Founder steps the build will ask for:**
   - **Sat 24:** create the "meridian-control admin" Access app; set the `/exceptions` Access Block; create the `ops-script` token after AC-1b.
   - **Mon 26:** approve the R-7 local deletes, including `~/.meridian-secrets/admin-exceptions.env`.
   - **Wed 28:** create the `bond-runner` token after AC-18c.
   - **31 Oct:** delete the blocked `/exceptions` Access app.
4. **001 §5.2 comment correction** (DV-1, `subject_id` numeric) is recorded for the 001 owner's next touch. 001 was not edited by this packet.

Stop point reached. Reply: **"MA-OCT-003.R1 reported"**.
