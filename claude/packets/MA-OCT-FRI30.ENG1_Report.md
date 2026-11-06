# MA-OCT-FRI30.ENG1 — Report (LANE-1-ENG, Engineering Lead)

At 06:53Z:
- Control `4d512cea…0838` and Task `9f5d5f01…466d` were re-hashed. Both match, and so does the board row (line 89).
- Governing inputs re-hashed ✅: spec rev 1 `2f83d58e…41f4`, 009.BUILD report `a32e8d0b…6459`, code review `42ef7039…a8b8`, FREEZES `4d8202bb…d7fc`.
- No `.git/*.lock`. Branch `October-2026`.
- Wrangler is `/usr/local/bin/wrangler` 4.96.0, OAuth.

## Change log (UTC; one production change at a time)
- 06:54Z: shared checkout fast-forwarded `acfd069` → `71fab4b` (LANE-8's 008 R-2/R-3 and the 003 deploy-4 commits).
  - The shared tree's untracked `App/Ops/src/sweep-ext.js` and `App/Ops/tests/sweep-ext-contract.mjs` were byte-identical to `fd7b753`.
  - I copied them to `~/MeridianAtlas-work/stale-shared-20261030/` (kept), removed them, and fast-forwarded. Git wrote back identical content, re-checked with `cmp`.
- 06:54:48Z: step 1, governance commit `1a59b77`, pushed (local only).
- 06:55Z: step 2, M9-3 / M9-4 in the 009 worktree (local only).
- 06:56:39Z: step 3, 009 commit `058c389`, pushed.
  - It was rebased once over LANE-4's `df4066c` (004 go-live code), with no shared paths.
  - The suites were re-run on the rebased tree: all green.
- Step 4 is waiting for LANE-4-ENG's "004 live" line (MA-OCT-004.GOLIVE report not yet written at 06:56Z).
- 06:57:38Z: read-only pre-check. `meridian-entities-api` live = **`1e54a425-492d-43f4-aa8e-c688ea1a0a4a`** (100 %, deployed 28 Oct 19:46Z). This is the rollback target.
- 14:17Z: the 004 report is still "IN PROGRESS".
  - Its status reads: "deployed; authenticated smoke pending … The production change stays **open** … **009 must not start yet**".
  - `meridian-ops` `e8b81bf9` has been live since 06:58:48Z.
  - So **009 is held**. Its "004 live" line is still a placeholder.
- 16:01Z: LANE-4 declares "**004 live — `e8b81bf9`** … Change closed: LANE-1-ENG may start the 009 deploy".
- 16:02Z: pre-flight.
  - No other Fri lane has an open change (004 GOLIVE closed; DIL, A2.CODEREV and 013 reviews are read-only).
  - `wrangler whoami` OK.
  - `d1-today` rowsWritten 540.
  - `hold_all_jobs` = false.
  - `fi_serving_gate` is absent (160 reads, a `sqlite_master` lookup).
- 16:03Z: **starting** 009 gate migration (closed). Three-point check:
  - (a) INTEGER PK;
  - (b) one execution, 1 row;
  - (c) about 3 writes against 540 written today.
  - Applied 16:03:03Z. Read-back and P-F4 done 16:03:07Z. **Done.**
- 16:03:18Z: §4.4 PepsiCo re-check (read-only). **PASS.**
- 16:03:40Z: **starting** 009 Worker deploy (meridian-entities-api). Deployed 16:03:51Z; smoke finished 16:04:12Z. **Done.**
- 16:04:38Z: live version re-confirmed. **009 done 16:04Z.** The gate is **not** opened.

## Result
**Steps 1–4 are complete. The 009 deploy is live and closed.**

| | Value |
|---|---|
| **New version** | **`4e7ee20b-e1aa-4d9c-a5f7-82fb537a975b`** (100 %, 16:03:46Z) |
| **Rollback version** | **`1e54a425-492d-43f4-aa8e-c688ea1a0a4a`** (deploy 5, recorded 06:57:38Z) |
| Gate | `fi_serving_gate` row 1 = `closed`, `changed_at` 2026-10-30T16:03:06Z, `changed_by` Engineering Lead, evidence DIL14 `c517dde7…9c399` (AC12 FAIL) |
| D1 writes by this packet | **3** (the migration) |
| D1 reads by this packet | about 340: 160 table check + 2 migration + 1 read-back + 8 S1 + 1 hold + 160 pre-check `sqlite_master`; EXPLAINs 0 |

## 1. Governance commit — `1a59b77` (pushed)
- 83 paths under `claude/`, staged by explicit path. Key-like string scan: 0 hits.
- Includes `claude/relays/FREEZES.json` `4d8202bb…d7fc`. **It is in the repo ahead of Sat 31's A2 run.**
- Includes `claude/MA-OCT-009_010_Spec.md` rev 1 `2f83d58e…41f4` (**M9-1**), `claude/MA-OCT-013_Spec.md`, the 004/009 code review, and all packets, reports, statuses and the Decisions Log.
- Not included: `Claude outputs/`, `MA-SEP-010_Change_Request.md`, `*.docx`, `~$*`, and `13F Seed/gleif-seed.js`.

## 2. M9-3 / M9-4 front-end fixes (in the 009 commit)
- **M9-3** (`_navExplain`, `_navRenderInstrument`):
  - When `state = ambiguous` and there are fewer than 2 candidates, the card shows "Our sources disagree about the issuer." (or "Several issuers share this ISIN."), with **no "Choose one."** and **no "{n} candidate issuers — none is selected for you" line**.
  - Any single candidate row is still shown.
  - With 2 or more candidates the 007 copy is unchanged.
  - The 007 card has no report-a-problem path to reuse; none exists in `ma-entities.js` today.
  - New fixtures: 0, 1 and 2 candidates.
- **M9-4:**
  - The Bonds section and the CIK layer now say "**latest filing among the bonds shown {date}**". The date is the maximum `filing_date` of the rows on screen.
  - F1's per-response `freshness.latest_filing_date` is no longer displayed anywhere.
  - With no rows on screen, no latest-filing figure is shown.
  - I chose the review's sanctioned fallback over the F3 lookup. F3 is about 1.5k reads uncached, and the Cache API is expected to miss on `workers.dev` (009.BUILD §3). Calling it on every issuer view would replace the ≤ 55-read issuer budget with about 1.5k.
  - The directory's per-issuer "latest filing" (F3 `latest_filing`) is unchanged, because it already is the issuer-wide figure.
  - **The spec owner still amends §5.2** to define the F1 field as per-response (review M9-4, third bullet).
- **Tests:**
  - `fi-010-frontend` **69/69** (62 + 7 new).
  - Mutation checks: reverting either half of each fix gives 2, 2, 1 and 3 FAILs respectively.

## 3. 009 commit — `058c389` (pushed; rebased once over `df4066c`, no shared paths)
Explicit paths:

| File | SHA-256 |
|---|---|
| `App/Corporate Atlas/src/entities-api.js` (unchanged since the build) | `2262cc51…fe25` |
| `migrations/009-fi-serving-gate.sql` | `aceda836…e00b` |
| `tests/fi-009-worker.test.mjs` | — |
| `tests/fi-009-explain.mjs` | — |
| `tests/fi-010-frontend.test.mjs` | — |
| `tests/nav-007-worker.test.mjs` (fixture-only change) | — |
| `App/ma-entities.js` | — |
| `App/index.html` | — |

- The message cites spec rev 1 `2f83d58e…` (M9-1).
- **The front end ships only with the Mon 2 site release.** `docs/` was not regenerated, and Pages still serves `September-2026/docs`.
- Tests on the rebased tree:
  - fi-009-worker 133/133;
  - fi-010-frontend 69/69;
  - fi-009-explain 14/14;
  - nav-007-worker 58/58;
  - retirement 77/77;
  - nav-007-frontend 39/39;
  - nav-007-key 34/34.

## 4. 009 deploy (run sheet, 009.BUILD §5)
- **M9-2 is settled by ML-1030-1.** The A2 window is re-pinned to Sat 31 07:10Z → Sun 1 00:10Z, so no A2 freeze applies today.
- The deploy ran after LANE-4's "004 live — `e8b81bf9`" (16:01Z), with no other change open, outside every freeze (next freeze 16:45Z).

| # | Step | Result |
|---|---|---|
| 0 | Preconditions | whoami OK; `d1-today` rowsWritten 540; `hold_all_jobs` false; FREEZES clear; no lane mid-change ✅ |
| 1 | Pre-009 version | `1e54a425-492d-43f4-aa8e-c688ea1a0a4a` ✅ |
| 2 | Gate migration | `meta`: rows_read 2, **rows_written 3**, changes 2, `changed_db` true, attempts 1. Read-back: exactly 1 row, `id=1`, `state='closed'`, `changed_by='Engineering Lead'` ✅ |
| 3 | P-F4 live | `SEARCH fi_serving_gate USING INTEGER PRIMARY KEY (rowid=?)` ✅ |
| 4 | §4.4 re-check | S1 rows_read 8; all 4 rows `cik = 0002007029`; `instrument_key` and `cusip` NULL. **PASS** ✅ |
| 5 | Deploy | From the worktree at `058c389` (clean tree; `origin/October-2026` = `058c389`). `4e7ee20b` at 100 %. Bindings: `env.DB` only ✅ |
| 6 | T-F10 closed | **11/11**, table below ✅ |
| 7 | Close-out | `d1-today` at 16:04Z still shows 540 written. Its lag is 25–30 min, so the +3 is not yet visible. |

**Pre-deploy baseline (16:03Z, live `1e54a425`):** `GET /api/instruments/CA00206RNL29` → `matched` with a **`sec_bond`** candidate (the ungated R1f), and `/api/fi/coverage` → 404.

**T-F10 closed (16:04Z, `4e7ee20b`):**
| Call | Result |
|---|---|
| `/api/fi/issuers/1457/bonds` | 200 `{"data_type":"issuance_reference","gate":"closed","ciks":[],"bonds":[],"has_bond_link":true}`, `no-store`. **Exactly those 5 keys: `has_bond_link` only** (DIL M-4) ✅ |
| `/api/fi/ciks/0002007029/bonds` | 200 closed, `has_bond_link:true`, `no-store` ✅ |
| `/api/fi/bonds/0001104659-24-022370/1` | 200 `{…,"gate":"closed","bond":null,"issuer":null}`, `no-store` ✅ |
| `/api/fi/coverage` | 200 `{…,"gate":"closed","issuers":[],"totals":null}`, `no-store`, no `x-fi-cache` (closed bodies never touch the cache) ✅ |
| `/api/fi/issuers/1457/ladder` | 200 `{…,"gate":"closed","years":[]}`, `no-store` ✅ |
| R1 `/api/instruments/CA00206RNL29` | 200 `unmatched` / `not_in_universe`, **0 candidates, no `sec_bond`**: the R1f exposure is closed ✅ |
| R1 `/api/instruments/US5949181045` | 200 `matched` ✅ |
| `/api/entities/search?q=pepsico` | 200, 3 results ✅ |
| `/admin/exceptions` | 410 `moved_to` ✅ |
| `/api/fi/issuers/1457/bonds?limit=abc` | 400 ✅ |

The leak check found none of `cik`, `issuer_name`, `finals`, `totals`, `maturity_date`, `accession_number`, `principal_amount`, `issuers`, `securities`, `multi_cik_keys` or `freshness` in any closed body.

**M-6 cache proof:** this cannot run with the gate closed (009.BUILD review point 6). It runs in the T-F10 **open** re-run, straight after the gate opens. Until then the planned budget is the uncached one.

## 5. M-4 rollback rule (in force from 16:04Z)
- **Rollback target:** **`1e54a425-492d-43f4-aa8e-c688ea1a0a4a`**. Never the pre-003 `73851c02`.
- **Data-only incident** (a wrong row or count once the gate is open): **close the gate**. This is the guarded mirror UPDATE `… SET state='closed' … WHERE id=1 AND state='open'`, requiring `changes = 1`, with a read-back. Any lane may do it, any time, logged the same day. **Never roll the Worker back for a data problem.**
- **Worker defect before the Mon 2 site release** (front end not live; exposure API-only): `wrangler rollback 1e54a425-492d-43f4-aa8e-c688ea1a0a4a --config "App/Corporate Atlas/wrangler-entities-api.toml"` is acceptable.
  - That version carries the **ungated R1f**: `CA00206RNL29` would return `sec_bond` again.
  - So the same day, either re-deploy a fixed 009 or deploy the one-constant R1f switch-off.
- **Worker defect on or after Mon 2, while AC12 has not passed or R-1 is not applied:** **no rollback below `4e7ee20b`.** Ship a forward fix, or a rollback together with the R1f switch-off.
- **After AC12 has passed and R-1 is applied:** a rollback to `1e54a425` is acceptable.
- **Front-end defect:** before Mon 2, don't ship it. After the release, revert the 010 changes and run `generate-docs.mjs`.
- **Gate table:** left in place (fails closed, 1 row).
- **The gate was not opened.** Opening needs the Data-Identity Lead's signed instruction plus the Founder's acknowledgement (spec §4.1). After that, T-F10 runs again open, with the cache proof.

## 6. Not in this packet
- The A2 code commit (patches 00–05) waits for REVIEW-A's A2 code-review pass (Task step 5).
- Still open before Mon 2 (review §B.3 item 5):
  - the T-F9 live and 375 px browser pass, which needs a preview config serving the 009 worktree (009.BUILD review point 7);
  - the spec errata (009 T-F10 cache proof, §5.2 F1 field) to the spec owner.

**For the Main Lane: `FREEZES.json` changed after step 1.**
- At 15:30Z the working copy became `5b3400c0…6791`. It removes the A2 run window (ML-1030-2, "A2 deferred to November").
- The **committed** copy (`1a59b77`, `4d8202bb…`) still holds the Sat 31 07:10Z → Sun 1 00:10Z A2 window. That is the stricter of the two.
- Not committed by this packet, whose step 1 was already done at 06:54Z. It goes in the next governance commit.

**Shared checkout:** fast-forwarded to `058c389` at 16:05Z, with no blockers. Its `entities-api.js` is now `2262cc51…`.

**Left as found:**
- `13F Seed/gleif-seed.js`, `.env*` and `.claude/settings.local.json` untouched.
- No secrets read. No macOS prompts. No commits to `September-2026`. No `git add -A`.
- `~/MeridianAtlas-work/stale-shared-20261030/` holds the two sweep-ext copies (identical to `fd7b753`).
- This report is not committed yet; it goes in the next governance commit.
