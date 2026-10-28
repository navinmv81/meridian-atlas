# MA-OCT-003.BREVA — Report (REVIEW-A, Architect): 003 build review

**Control:** `claude/packets/MA-OCT-003.BREVA_Control_v1.md` SHA-256 `b7376cae598b3249b081c6b16122d3b71f8328859422682e8cb7a7520b1d768b` (verified; matches the STATUS_BOARD row). Task v1 `638db3bc80e558dc57b24cbd4ebee5d4ee9f89f8001af64e44dc20e2119ca114` (verified).
**Date:** Thu 22 Oct 2026, ≈ 07:45 UTC. **Git:** `October-2026`, HEAD `c3c6e4a`, no `.git/*.lock`, read with `--no-optional-locks`, no git writes. **0 D1. No code run.** `~/MeridianAtlas-work/ma-oct-003/` was read under a read grant; no key file was opened.
**Independence:** LANE-8-ENG built this. REVIEW-A wrote the REVARC / R1C-ARC findings it implements, not the code.

## Inputs (all re-hashed; all match the build report)

| Input | SHA-256 |
|---|---|
| Spec rev 1 `claude/MA-OCT-003_Spec.md` | `7b8bba9f…80c2` |
| Build report `claude/packets/MA-OCT-003.BUILD_Report.md` (days 1–3 + Sat 24 run sheet) | `1307bf36…efba` |
| `App/Ops/src/cases.js` / `src/sweep-ext.js` / `src/ops-api.js` | `6ff88abc…dcc1b` / `15f3f179…e130` / `ec85886e…23cd` |
| `App/Ops/migrations/004-ops-cases.sql` / `m1-…sql` / `m2-…sql` | `d7c96c55…f0` / `bf0f81d7…6ce` / `a6e621d3…55eab` |
| `App/Ops/tools/m1-render.mjs` / `App/Ops/wrangler-ops.toml` | `864fd1cc…7bb` / `fadd9d2d…903dca` |
| tests `cases-contract` / `migration-m1` / `sweep-ext-contract` | `82088e3b…ec8b` / `bb571697…c078` / `476e41e1…593a` |
| `App/Corporate Atlas/src/entities-api.js` / `wrangler-entities-api.toml` / `tests/entities-api-retirement.mjs` | `d18845dd…70db` / `a6e0a6ec…788a` / `02598a8a…f5de8` |
| patches `01-routes…` / `02-sweep…` / `03-retirement…` | `7855781e…525b` / `107b0cf0…a728a` / `c02f62b1…c714` |

**Cross-checks done by me:**

- `git diff HEAD` of `ops-api.js` and `wrangler-ops.toml` = the 01 + 02 hunks as described.
- `git diff 0dd7ef0` of the two `entities-api` files is **byte-identical** to diff 03.
- `entities-api.js` has no change between `0dd7ef0` and HEAD (D-4 holds).
- The SQL bodies of `004-ops-cases.sql`, M1 and M2 equal spec §6, §10.2 and §10.4. The only differences are added comments and M1's `__FILE_SHA__` / `__COMMIT__` placeholders for the spec's "filled at build".

## Verdict: **PASS WITH NOTES. Sat 24 may proceed only if the gates S-1 to S-5 below hold.**

The code meets rev 1 and R1C-ARC. All the build notes are accepted. **S-1 is the real gate:** A6 is not on disk today. There is no `App/Ops/src/control-api.js` and no `wrangler-control.toml`, and 003's routes cannot ship before A6, because of the 15-endpoint rule in §8.1. If S-1 is not met by Fri 23, 003's own slip rule applies (Mon 26 / Tue 27, same order).

## 1. Code against rev 1 and R1C-ARC: MET

| Item | Code | Result |
|---|---|---|
| Routes E-1, E-2, C-1, C-2 (§8.2) | `cases.js` `handleCases`, behind `verifyAccessJwt`, then `serviceGate` in `handleAdmin` (6-line hook) | **MET.** E-1: keyset per status on `INDEXED BY idx_ops_exception_queue` (or `idx_ops_exception_job` for `job_id`), merged with a global `(severity, opened_at, id)` cursor, which is a correct k-way merge. C-1: EXC and DQ detail. C-2 on a `DQ-` ref returns 409 `dq_actions_arrive_with_ma_oct_004`. |
| Transition engine (§7.1, §8.4, A3-3(a)) | `ACTIONS`, `validateAction`, `setClause` per action, `caseAction` | **MET.** `SET` is chosen per action; only resolve, dismiss and reopen touch the resolution columns. `resolved_by` is the verified actor. The `NOT EXISTS (idempotency_key)` guard is in place; replay gives 200 and reuse gives 409 `request_id_reused`. Stale or illegal transitions give 409 with the current state. BN-1 shape (§2 below). |
| CSRF (A3-5) | `csrfOk`: `application/json` and `X-Ops-Client ∈ {console, script, service, dq-page}` on E-2/C-2, checked before the body is read and before D1 | **MET.** R1-1's single vocabulary applied. |
| Service-token allowlist (§8.5, A4-2, F-3) | `serviceGate` on **every** admin route after the JWT; `adminRouteId` maps everything outside the 4 routes to `other`; an unparseable map fails closed; actor `service:<label>`, `common_name` in the payload; `serviceActionAllowed` per kind | **MET.** The tests cover unknown token, DQ resolve/dismiss/reopen, governance routes, `/jobs` and a bad map, all 403 with 0 D1. See N-1 for one hardening. |
| Kill switch | `OPS_CASES_ENABLED === 'false'` → 503, after the allowlist and before D1 | **MET.** |
| Sweep extensions (§9.1–§9.5) | `sweep-ext.js` plus the diff-02 hooks | **MET.** Details: conditions re-keyed per UTC date (`job_frozen` keeps its cursor marker); S2 written as `UNION ALL` (A3-4) for jobs with a condition finding only; existing open cases with old keys are suppressed by (job, type) (BN-12); `L2_SQL` gains `error_class`; E1, E5, E6 come from L2; E2 (`LIMIT 50`, `job_id` phase23) and E4 run once a UTC day and fail soft; 011 is excluded from `GLEIF_JOBS`; auto-resolve (§9.4, A3-3(b)) uses a per-`:now` key, the reopened probe plus a SQL guard, cap 20, on only when exactly `"true"`; the response fields match §9.5. |
| Retirement (§10.5 R-1..R-5) | diff 03 | **MET.** 19 symbols are removed as one asserted block (A3-2, by symbol). R-3's 410 rule sits after the `/api/*` matches. None of those can match an `/exceptions` path and nothing touches D1 before routing, so it answers **before any D1 access**. CORS is `GET, OPTIONS` with `Content-Type` only (R-4). The toml `[vars]` are removed (R-5). `/api/entities/*` and `/api/instruments/*` are untouched (differential test, plus `nav-007-worker` 58/58). |
| M1 renderer (R1-5) | `m1-render.mjs`: the fragment is split (must occur exactly once), NUL refused, commit must be lowercase hex, output mode 600 outside the repo | **MET.** See N-6 on tying the SHA to the commit. |

## 2. Rulings on the open design notes

- **BN-1 (event first, then guarded update): ACCEPTED.**
  - D1 runs a `db.batch()` as one transaction. The event `INSERT … SELECT … WHERE status = :expected AND NOT EXISTS(key)` and the `UPDATE … WHERE status = :expected AND EXISTS(event with that key and :now, same subject)` are therefore **both applied or both not**. Nothing in the transaction can change the row between them.
  - The invariants hold: no change without exactly one event; a reused `request_id` never changes state; two racing requests give one winner (the loser's event `SELECT` no longer matches `status`).
  - It is strictly better than §8.4's order for AC-6 and `assign`, because the pre-image is captured in the same statement.
  - Cost ≤ about 7 reads (two autoindex probes, one row read each way), in line with AC-16's ≤ 6. **This deviation from §8.4's literal order is recorded as accepted;** 004 extends the same shape.
- **BN-6 (frozen-branch re-derivation): ACCEPTED.** `frozenBranches()` uses the same two predicates as `lateness.js` `jobState()`: last 3 success/partial with the same non-null `cursor_after`; latest with `attempted > 0` and `progressed = 0`. Dropping `job_frozen` only when E1 fires and the cursor branch is false is exactly §9.3's "F4 branch skipped". The predicate now exists in two places; see N-7.
- **BN-7 (E5 covers manual runners): ACCEPTED.** §9.3's table says "any `local_schedule` job", while its own 011 paragraph requires `local_auth_failure` for a `manual` runner. Covering `local_schedule` and `manual` reconciles the two, and it costs 0 reads.
- **BN-11 (auto-resolve uses BN-1's shape with the reopened guard in SQL): ACCEPTED.** A reopen that commits between the probe and the batch makes the event `SELECT` empty, so the `UPDATE` cannot apply. This closes A3-3(b) against races, not only sequentially.
- **R-9 grep exclusion of `/api/ops/admin/exceptions`: ACCEPTED.** The needle `/admin/exceptions` is a substring of 003's own new route. The test excludes exactly that prefix and nothing else, and look-alike paths still 404.
- **No objection to the others:**
  - BN-2: the `manual:<request_id>` locator, UNIQUE, which makes a replay a no-op.
  - BN-3.
  - BN-4: an unknown or foreign `run_id` gives 422.
  - BN-5: the allowlist also guards `/jobs`.
  - BN-8: 002a's sweep test is kept byte-identical as the baseline.
  - BN-9: auto-resolve is off unless the var is exactly `"true"`.
  - BN-10: E2's cutoff format, and fail-soft (see N-5).
  - BN-12.

## 3. Three-point check and deploy split: PASS

- **Index audit.** Every new query is a `SEARCH` on a named index or a declared bounded scan:
  - E-1: queue or job index; closed statuses ≤ 500.
  - C-1: case autoindex; `idx_ops_case_event_subject`; **new** `idx_ops_dq_linked_exc`; PKs.
  - C-2 / E-2: autoindex probes.
  - S2: **new** `idx_ops_exception_job_cond`, `UNION ALL`, covering.
  - E2: `idx_enrich_queue_status`, `LIMIT 50`.
  - E4: `idx_ops_job_run_job_type_at`.
  - Auto-resolve: queue index plus subject and idempotency probes.
  - M1: 9-row `entity_exceptions` scan (declared) plus autoindex joins.

  `INDEXED BY` on E-1 fails closed if an index is missing. Nothing touches `fundholdingsmonthly` or `entity_master`. The local EXPLAINs in test 1 and test 3 match §11.2; the remote confirmation is run-sheet step 7.
- **Single execution < 50k:** the maximum is the sweep, ≤ 1,000. C-1 ≤ 230.
- **Budget:** steady ≤ about 220 writes/day; Sat 24 one-time ≈ 200 writes and ≈ 700 reads, matching §11.1 and §16.
- **Boundaries:** Ops writes only. Entities `entity_exceptions` and `entity_enrichment_queue` are read only. No ETF table. No cron.
- **Deploy split:**
  - deploy 3 = diff 01 + `cases.js` (+ 004, M1, M2 files);
  - deploy 4 = diff 02 + `sweep-ext.js`;
  - deploy 5 = diff 03 (no A6 dependency).

  Rebasing 01/02 onto A6 by LANE-8-ENG, with LANE-1-ENG committing, is per ML-1021-3. The hooks sit at the top of `handleAdmin` and inside `sweep()`, neither of which A6 removes. That is sound. **See S-3:** the working tree today holds 01 **and** 02.

## 4. Sat 24 run sheet: ACCEPTED, with gates S-1..S-5

**Already right:**

- The order (A6 → 004 indexes → deploy 3 → AC-1/16 → freeze → dump → guard → M1 → V1–V4 → M2 → admission → AC-1b/2/4 → observe sweeps) is spec §10.3 / §16.
- ≤ 3 production deploys.
- G-1 is required in writing before step 3 (deploy 2). 011.RUN is CLOSED and 011.CLOSE is reads-only, so it is satisfiable.
- `d1-today` is read before each write. Times avoid the FREEZES bands and the sweep slots. The 10:00–10:40 M1 window ends before 10:45.
- Each step has a rollback. Founder actions are listed. The token is created before deploy 3 and admitted only after step 7 (ML-1021-3).
- Dumps go to `~/MeridianAtlas-work/ma-oct-003/` (hash only), and M1 is rendered against the routes commit.
- Deploy 5 waits for 007's front-end release (ML-1022-1) and the Mon 26 re-dump compare.

**Gates the Sat 24 Control must carry:**

- **S-1. A6 must exist, pass its tests and be reviewed and committed before Sat 24.** It is absent today, and R0 and deploys 1–2 depend on it. A6's own review is outside this packet. If S-1 is not met, apply the slip rule. **Do not ship deploy 3 without A6:** it would take `meridian-ops` to 19 endpoints against the 15 cap.
- **S-2. G-1 in writing** (LANE-11-ENG + Main Lane) before step 3, as the run sheet says.
- **S-3. Deploy 3 must not carry the sweep extensions.**
  - `wrangler deploy` ships the **working tree**, and today's `ops-api.js` contains diff 02 (the `sweep-ext.js` import and hooks), while the toml contains `OPS_SWEEP_GLEIF_CHECKS` / `OPS_SWEEP_AUTORESOLVE = "true"`.
  - LANE-1-ENG deploys deploy 3 from a tree that is exactly A6 + diff 01 + the routes files, with no `sweep-ext.js` import and no sweep vars. Record that tree's `ops-api.js` and toml SHA-256, and confirm C1 deployed = the "003 routes" commit.
  - **Production check:** the 17:00 UTC sweep response on deploy 3 must **not** contain `suppressed`, `gleif_checks` or `auto_resolved`. If it does, the sweep shipped early: roll back to the deploy-2 version.
- **S-4. Commit the step-5 `OPS_SERVICE_ACTORS` change before deploy 3,** so C1 deployed = repo holds. Its value is the Client ID, an identifier (§8.5); see N-2. The M1 render still uses the routes commit whose template is unchanged; see N-6.
- **S-5. Rollback targets are the version ids recorded on the day,** not the hard-coded `0905784d` (spec §17, run-sheet step 3), which may be stale after 002a's deploys. A rollback or a kill-switch redeploy is incident response and may exceed the ≤ 3 cap; record it if used.

## Notes (non-blocking)

- **N-1.** `serviceGate` trusts `entry.routes` as given. An entry that listed `"other"` would open `/jobs` and the governance routes to that token. Reject (fail closed) any route outside `E-1/E-2/C-1/C-2` (and later 004's D-routes) when the map is parsed.
- **N-2.** `OPS_SERVICE_ACTORS` lives in `[vars]`, so the token's **Client ID** will be in the public repo. Per §8.5 it is an identifier; the secret stays in `~/.meridian-secrets/` and the token is still refused without it. Acceptable. Moving it to a Worker secret later is a spec change, not needed now.
- **N-3.** On E-2, a reused `request_id` with a **different body** returns the original case (200), not 409. That is harmless, because no second case is created; document it as replay semantics.
- **N-4.** Auto-resolve's reopened probes are not capped: up to 100 matched candidates, each probing up to that case's event count. That is bounded and tiny in practice; capping the probes at the resolve cap would tighten the bound.
- **N-5.** E2's cutoff compares strings in `YYYY-MM-DD HH:MM:SS`. A `last_attempt` stored in ISO `T` form would be misjudged only within the cutoff's own day. That is acceptable. E2/E4 fail soft and are not retried until the next UTC day.
- **N-6.** In run-sheet step 10, also check that the printed `template_sha256` equals `git --no-optional-locks show <routes commit>:App/Ops/migrations/m1-entity-exceptions-to-ops.sql | shasum -a 256`, so the recorded SHA is the committed template's.
- **N-7.** The frozen predicate now exists in `lateness.js` and `sweep-ext.js`. Any later change to `jobState()` must change `frozenBranches()` with it; test 3 pins today's behaviour.
- **N-8.** Step 14: right after admission, run the negative checks first: the two 403s (DQ `resolve`, `/jobs`). Remove the token from the policy at once if either does not return 403. Only then run the real `acknowledge`.

## Files written

- `claude/packets/MA-OCT-003.BREVA_Report.md` (this file). Nothing else. The board, the status JSON and the Decisions Log are for the Main Lane.
