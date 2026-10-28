# MA-OCT-002a.A6R — Report (REVIEW-A, Architect): A6 `meridian-control` split — gate S-1

**Control:** `claude/packets/MA-OCT-002a.A6R_Control_v1.md` SHA-256 `daa9e6b59a869e5ab939e50dea5e7dea508aa15dbed36dd603b537efb0c04d65` (verified; matches the STATUS_BOARD row). Task v1 `9b0ac41e239421e1d43888495ce6372550db93d82fea2b316d61e81a6e0266dc` (verified).
**Date:** Fri 23 Oct 2026, ≈ 06:15 UTC. **Git:** shared checkout `October-2026` at `c3c6e4a`; `origin/October-2026` = `7330a7f`; no `.git/*.lock`; read with `--no-optional-locks`; no git writes. **0 D1. No deploy. No project code run.** Only `git merge-file` and `node --check` were run, on scratch copies outside the repo, deleted afterwards. The worktree was read under a read grant; no key file was opened.
**Independence:** LANE-1-ENG built A6. REVIEW-A wrote none of it.

## Inputs

| Input | SHA-256 / id | |
|---|---|---|
| Commit `7330a7f` (on `origin/October-2026`) | `7330a7f551a7…` | ✔ |
| `claude/MA-OCT-002_Spec.md` rev 1.3 (§13, CR-1, AC-a6) | `9ec6773a…3893` | ✔ Task |
| `claude/packets/MA-OCT-002a_Report.md` | Task pins `7996e98c…9531` | **see F-0** |
| `App/Ops/src/control-api.js` / `ops-api.js` / `wrangler-control.toml` / `tests/control-split.mjs` (in `7330a7f`) | `6a5e0a2f…0832` / `173f120e…1d29` / `f6770d2a…2e6b` / `5bac1384…04f8` | ✔ = report |
| Worktree `~/MeridianAtlas-work/a6-worktree` | all **169** tracked files under `App/` and `docs/` hash-equal to `7330a7f`; no extra file in `App/Ops`; no `cases.js` / `sweep-ext.js` | ✔ clean |

**F-0 (input pin; no effect on the verdict).** The Task pins the build report at `7996e98c…`. That is the **shared checkout's pre-A6 copy**, and it ends at "Day Wed 14": it has **no Thu 22 section and no steps C0–C6**. The Thu 22 section exists only in the copy committed in `7330a7f` (blob SHA-256 `594727fd…4b75`). I reviewed that copy, which the commit id pins. The shared checkout's copy updates when LANE-8-ENG fast-forwards. Main Lane: re-pin it as `7330a7f:claude/packets/MA-OCT-002a_Report.md`.

## Verdict: **PASS WITH NOTES. S-1 is MET** (A6 is built, tested, reviewed and committed), subject to **R-A6-1** in the Sat 24 Control.

## Checks

**(1) §13 exactly: MET.**
- **`meridian-control` serves the 8 endpoints, same paths:** GET `sprint-board`, `release-ledger`, `events`, `drift`; POST `admin/sprint-board`, `…/:id/stage`, `admin/release-ledger`, `…/:id/event`. Anything else → 404. The legacy anonymous-POST 401 rule is copied.
- **`meridian-ops` serves 7 endpoints:** `budget-risk`, `openfigi-status`, `cf/invocations`, `cf/d1-today`, `admin/jobs`, `ingest/run-event`, `ingest/sweep`.
- **It has 2 rules:**
  - (1) legacy POST → 401, unchanged and checked **before** rule 2;
  - (2) the 4 moved public GETs → **302** to the same path and query on `meridian-control`, with `Access-Control-Allow-Origin: *` and `Cache-Control: no-store`, 0 D1.
- **The moved admin POSTs** on `meridian-ops` fall through `handleAdmin` to 404, after the JWT, with nothing written.
- **The ops Worker no longer names** `sprintboarditems` / `releaseledger` / `operationalevents` outside comments.
- `TRACKED_SCRIPTS` gains `meridian-control`.

**(2) Moved definitions byte-identical: MET.**
- Independent check: I extracted every top-level declaration of `control-api.js` (25) and compared each with the same declaration in `c3c6e4a:App/Ops/src/ops-api.js`. **24 are byte-identical:** handlers, `STAGE_ORDER`, `RELEASE_EVENT_TYPES`, `json` / `jsonPrivate` / `badRequest` / `readJson`, `CORS_HEADERS`, the JWKS cache, the base64url helpers, `getAccessJwks`, `verifyAccessJwt`, `withoutCors`, `LEGACY_POST_RE`.
- The only new code is `handleAdmin` (the 4 POST branches, lifted unchanged, then 404) and the router. `control-api.js` has **no imports**.
- The report's "21/21" counts the same set, grouped differently.

**(3) Empty AUD and GET+HEAD redirect: MET.**
- `verifyAccessJwt` returns `{ok:false}` when `CF_ACCESS_AUD` is empty, **before reading any token**, so every `/api/ops/admin/*` route on `meridian-control` is 401 until the Founder's AUD is committed.
- The redirect matches `GET` **and** `HEAD`. `OPTIONS` stays 204 with CORS.
- **The front end follows it:** `ma-data.js` `data_opsGet` → `fetchWithTimeout` is a plain `fetch(url, {signal})`, with no credentials and no custom headers, so it is a simple CORS request. The browser follows the cross-origin 302 when the redirect itself carries `ACAO: *` (it does), and `meridian-control`'s GETs answer `ACAO: *` too. ✔

**(4) Per-bundle writer check: ACCEPTED** (in place of AC-a6's literal "only in `ops-api.js`" grep).
- It follows `import './x'` transitively from each entry: `ops-api.js` (+ `lateness.js`, and 003's `cases.js` / `sweep-ext.js` after the rebase) versus `control-api.js` (alone).
- It asserts that `ops_*` are written only inside the ops bundle, the governance tables only by `control-api.js`, the bundles share no file, and control never names an `ops_*` table.
- That is the correct reading of §13's "one writer per table" once 003's modules land. **See N-1** for one regex gap.

**(5) AC-a6 test 100/100 and failure on the unsplit code: ACCEPTED as evidence** (not re-run; read-only review).
- The test covers routes 7/8, redirect, parity against a pre-split capture made from `c3c6e4a`'s handlers, the 001 AC4 auth matrix on `meridian-control` (including empty AUD), CORS and writers.
- The mutation run (pre-split `ops-api.js` in place) fails 17 checks.
- AC-a6's live parts (the `ma-ops.js` tabs on the real site; the matrix against the real Access app) are steps C3 to C5.

**(6) Clean 3-way merge with 003: MET (re-done independently).**
- `git merge-file` with base `c3c6e4a`, ours `7330a7f`, theirs the shared checkout's 003 working copy (`ec85886e…`): **0 conflicts**.
- The merged file parses, and it has A6's rule 2 plus 003's imports, `serviceGate` and case hook in `handleAdmin` (ahead of `/jobs`).
- **A6 does not touch `wrangler-ops.toml`** (identical to `c3c6e4a`), so there is no toml conflict.
- **Endpoints after 003:** 7 + 4 = **11 of 15**.
- 003's tests on the merged tree (63/34/23) are the builder's evidence; I did not run them.
- **The suggested rebase is safe:**
  - in the shared checkout, of the files `7330a7f` touches only `ops-api.js` is locally modified, and stash/pop carries it;
  - A6's new files (`control-api.js`, `wrangler-control.toml`, the test, the fixture) do not exist there, so the `--ff-only` cannot collide with untracked files;
  - 003's untracked files are untouched by a plain `git stash`.

**(7) Sat 24 steps C0–C6: ACCEPTED with R-A6-1.**
- **Deploy only from the worktree.** Verified clean and 003-free, with the `c3c6e4a` toml, so it cannot ship 003's routes, sweep code or vars. That is consistent with BREVA S-3.
- **Order:** control → Access app → ops, matching §13.
- **Rollback by recorded version ids** (BREVA S-5): C0 records the live `meridian-ops` version before C4; a control rollback redeploys the C1 version; control can be left deployed and unused.
- **C3's check** (a missing-field POST → 400 with the Founder's session) proves auth without writing a production row.
- **C4's checks** cover `d1-today` and the ingest keys, which the boost and the health-check depend on.
- **C5** is the live-site AC-a6 step.

**(8) Live front end unaffected: MET.**
- `ma-ops.js` and `ma-data.js` are not in the commit (no `App/*.js` or `docs/` change).
- The 4 GETs follow the 302 (see 3).
- The 2 POSTs in `ma-ops.js` use the legacy anonymous paths, which return 401 before and after, on both Workers.
- `OPS_API_URL` (`meridian-proxy …/api/ops-health`) is unrelated.

## Required for the Sat 24 Control

**R-A6-1. Keep Sat 24 within the 3-production-deploy cap** (A3-1 counted "A6 ×2 + 003 routes").

- **The problem:** C0–C6 deploy `meridian-control` **twice** (C1 with an empty AUD, then the C3 redeploy with the AUD) plus `meridian-ops` (C4). With 003's deploy 3, that makes **4**.
- **Preferred fix:** do the Founder's Access-app step **first**, as 003's own run sheet already orders it (its step 1). That means C2 → commit the AUD (C3's commit) → **one** `meridian-control` deploy (C1 with the AUD, then C3's auth checks) → C4. That keeps 3.
- **If the app cannot be created before the Worker exists:** the Main Lane may rule that the second `meridian-control` deploy does not count against the cap, because nothing routes to that Worker until C4 and an empty AUD is fail-closed. Record that ruling in the Control.

## Notes (non-blocking)

- **N-1.** The writer regex is `(INSERT( OR IGNORE)? INTO|UPDATE|DELETE FROM)`. It misses `INSERT OR REPLACE INTO` and `REPLACE INTO`. No code uses those on these tables today; widen the pattern so the check stays honest for 004.
- **N-2. C3 commits the AUD from a detached-HEAD worktree.** Push with `git push origin HEAD:October-2026` as a fast-forward only. If anything else has reached `origin/October-2026` since `7330a7f`, stop and rebase; never force. LANE-1-ENG remains the only committer (ML-1012-2).
- **N-3.** C1 makes the 4 governance GETs public on `meridian-control` straight away (the same data `meridian-ops` already serves publicly). That is intended by §13, not an exposure change.
- **N-4.** After C6, BREVA **S-3 still applies to 003's deploy 3.** Once LANE-8-ENG rebases, the shared checkout holds A6 + 003 diff 01 **and** diff 02. Deploy 3 must come from a tree without diff 02 and the sweep vars.
- **N-5.** `CONTROL_BASE_URL` (an optional var) can repoint the redirect. It is not set in `wrangler-ops.toml`, and should stay unset unless reviewed: a wrong value would send the live tabs elsewhere, though only as a reversible 302.

## Files written

- `claude/packets/MA-OCT-002a.A6R_Report.md` (this file). Nothing else. The board, the status JSON and the Decisions Log are for the Main Lane.
