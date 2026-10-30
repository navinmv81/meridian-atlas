# MA-OCT-009.BUILD — Report (LANE-1-ENG, Engineering Lead)

## Opener (07:18Z Thu 29 Oct)
- **Hashes:**
  - Control `4f043a5e…e445` matches the board (row 81).
  - Task `e5a3e6ad…695b` matches.
  - Spec rev 1 `2f83d58e…41f4` matches, but **only as the uncommitted working copy in the shared checkout**; `HEAD` still holds rev 0 `8216123e…`. See review point 9.
  - WED28.ENG1 report `20543865…cf07` matches.
- **Repo state:** no `.git/*.lock`.
- **Wrangler:** `/usr/local/bin/wrangler` 4.96.0, OAuth (`workers_scripts`, `d1` write).
- **Base:** worktree `~/MeridianAtlas-work/ma-oct-009/build-worktree`, detached at `origin/October-2026` = `acfd069`. `App/Corporate Atlas/src/entities-api.js` = `d18845ddc26666bf3253c0ed96cd77604f24b5b840c41925676d930a83ac70db`, the retirement version recorded in the ENG1 report ✅.
- **Today:** local only. **0 D1 writes, no deploy, no commit.** D1 reads today: **11 rows**, all read-only:
  - PepsiCo S1: 8;
  - the 2 smoke-fixture lookups: 3;
  - 13 + 2 EXPLAINs: 0.

## Change log (UTC)
- 07:18–07:25Z: worktree, Worker build.
- 07:26:44–07:26:51Z: T-F8 remote EXPLAIN-only pack (0 reads).
- 07:27:00Z: §4.4 PepsiCo S1 (read-only).
- 07:27–07:34Z: 010 front end and tests.
- 07:35Z: 2 read-only smoke-fixture lookups.
- **No production change was started, so none was announced.**

## 1. Build (per rev 1)
**Worker** (`App/Corporate Atlas/src/entities-api.js`, now `2262cc51dc9053b9055107ae5513bf0cc93f33696d2a3b03163a6f4b0103fe25`; +431/−14 lines; bundle 47.84 KiB, which was 29.34; `wrangler deploy --dry-run` OK, `env.DB` only, toml unchanged):
- **`fi_serving_gate` read (`fiGate`)** — §4.1:
  - a missing table or row, or any state other than `open`, means **closed**;
  - any other D1 error means **500** (outage, no data).
- **`fi_json()`** — a separate helper (N-6); 007's `json()` is untouched.
  - Closed or tables missing: `Cache-Control: no-store`.
  - Open: `public, max-age=60`.
- **F1 `/api/fi/issuers/{id}/bonds`:**
  - R3 resolution (404/409 as 007);
  - step 1 via `idx_bil_entity`;
  - **closed returns `{data_type, gate, has_bond_link, ciks:[], bonds:[]}` only** (DIL M-4), checked *before* the 10-CIK cap, so a closed 422 never leaks a CIK count;
  - more than 10 CIKs → 422 `too_many_ciks`;
  - step 2 is one `db.batch()` of per-CIK keyset statements, each with `limit + 1` rows, the literal `'final'` and the row-value range;
  - **the M-7 merge**: consume in tuple order, drop rows under 60, stop at `limit` or when a CIK with more rows has had its buffer consumed; `next_cursor` = the last row consumed, base64url `[maturity, accession, seq]`;
  - `include_matured` 0/1 (0 clamps any cursor to `[today,'',-1]`);
  - `limit` clamped to [1, 100]; bad limit, cursor or `include_matured` → 400;
  - `cik` is on every row (M-6).
- **F1b `/api/fi/ciks/{cik}/bonds`:** 10-digit CIK, PK step 1, `entity_id: null`.
- **F2 `/api/fi/bonds/{acc}/{seq}`:**
  - closed returns `{bond:null, issuer:null}` whether or not the bond exists;
  - open: a not-final, under-60 or absent bond → 404 `not_found`;
  - the filer is the row's own `cik`;
  - the issuer is a 007 NavLink (`sec_bond`, `bond_issuer_link`, `DBT`), and the LEI comes only from the linked `entity_master` row via R3 (M-8);
  - unmatched filer → `unmatched` with no candidate;
  - a key under 2+ CIKs → `ambiguous` / `source_conflict`;
  - carries `other_filings`, `check_source`, `rate_label`, `parser_version` and `ingested_at`.
- **F3 `/api/fi/coverage`:**
  - three statements in one batch;
  - bands: `unmatched`, else `navBand('sec_bond', confidence)`;
  - totals, `multi_cik_keys` under the served-row rule, and `as_of` = MAX(`last_polled_at`).
- **F4 `/api/fi/issuers/{id}/ladder`:**
  - distinct securities (key, else accession+seq);
  - `principal_usd` only for USD securities filed once;
  - `reopened`; `other_currencies`;
  - 10-CIK cap.
- **Cache (M-5):**
  - F3/F4 use the Worker Cache API, keyed on URL + `__fi_gate=state|changed_at`; F4 also keys on the UTC date;
  - TTL 1 h (the stored copy is `max-age=3600`; the client gets 60 s);
  - `x-fi-cache: hit|miss`;
  - the gate is always read before the cache;
  - closed or missing-table bodies are never cached.
- **R1f gated (§4.3):**
  - gate read at step 3a, only when the gate is open;
  - `SELECT DISTINCT cik … filing_status = 'final' AND parse_confidence >= 60 LIMIT 2`;
  - 1 CIK → `bond_issuer_link` PK → `sec_bond` candidate;
  - 2 CIKs → no candidate, state `ambiguous`, reason `source_conflict`;
  - missing bond tables are tolerated, as in 007.
- **Router:** `/api/fi/*`, GET only. CORS is unchanged (`GET, OPTIONS`).

**Migration** `App/Corporate Atlas/migrations/009-fi-serving-gate.sql` (`aceda8365bcbde199538aa3a517f4bccc1853f569675d985806364b84938e00b`):
- It is §4.1 verbatim, created **closed**, ≈ 3 writes, idempotent.
- Evidence string: DIL14 `c517dde7…9c399`, re-hashed ✅.
- **Not applied.**

**010 front end** (local only; ships with the Mon 2 Nov site release; `docs/` not regenerated):
- `App/ma-entities.js`, `d97ea124f32e4e953979d77361ca3bc085f11fd4be176c0b6a523cc3b8f40c26`, +368 lines:
  - a Bonds section after "Linked instruments" (hidden unless `has_bond_link`; closed → notice + disclosure only), with freshness line, disclosure, ladder (plain HTML/CSS), table (25 a page, "Show 25 more ↓" while `next_cursor` is set), "Filed by" when there is more than one CIK, "Show matured", and rows opening `#/bond/{acc}/{seq}?from=entity:{id}:{page}`;
  - bond detail layer: title rule D-2/N-5, terms, reopenings line, SEC link (`noopener noreferrer`), quality line, filer CIK from `bond_issuer_link`, linked candidate or "Issuer not linked … (CIK …)" with no LEI, "View instrument";
  - `#/fi` directory: totals, client-side filter, Linked / "Not linked yet" chips;
  - `#/fi/cik/{cik}` layer;
  - every §7.5 line; a 640 px stacked-row media query;
  - `_navOpen` / `_navRetry` now dispatch through one `_navRender(kind)`.
- `App/index.html`, `86f4961f9631205018b539a56114e70114fd57a6c798c7c2ee37c952b8c8b437`:
  - `parse()` accepts `#/fi`, `#/fi/cik/\d{10}` and `#/bond/\d{10}-\d{2}-\d{6}/[1-9]\d{0,5}`;
  - one "Fixed Income" nav button (`openFixedIncome()`).

## 2. Tests: all green on the build, and the new suites fail on the pre-009 / pre-010 tree
| Suite | Result | On the base tree (`acfd069`) |
|---|---|---|
| `tests/fi-009-worker.test.mjs` (T-F1–T-F7, new; real 008 + 009 migrations on node:sqlite; mocked `caches.default`) | **133/133** | `FI_WORKER=<acfd069 file>`: 6 FAIL, then it aborts, **exit 1** |
| `tests/fi-010-frontend.test.mjs` (T-F9 on fixtures, new; real `ma-entities.js` in vm; **`data_entitiesGet` answered by the real 009 Worker** on a node:sqlite fixture) | **62/62** | `NAV_SRC=<acfd069 file>`: `ReferenceError: _loadIssuerBonds is not defined`, **exit 1** |
| `tests/fi-009-explain.mjs` (T-F8 local) | **14/14 plans** | — |
| `tests/nav-007-worker.test.mjs` (007 T2–T9) | **58/58** (fixture-only change, see review point 1) | — |
| `tests/entities-api-retirement.mjs` | **77/77** | — |
| `tests/nav-007-frontend.test.mjs` / `nav-007-key.test.mjs` | **39/39** / **34/34** | — |

**Mutation checks.** Every mutant was killed:
- Worker: lax gate (`/open/i`) → T-F1 fail; cursor = largest tuple fetched → 7 fail; closed F1 leaks `ciks` → 4; no M-7 stop rule → 1; cache key without gate → 2; ungated R1f → 3; no ≥ 60 filter → fail.
- Front end: short page drops "Show more" → 1; no closed notice → 1; LEI shown for an unmatched filer → 1.

**T-F7 differential.** Against `acfd069` with the gate open:
- R1 (a plain key, a single-CIK bond key, a placeholder, an unknown key), R2 (the first page, `limit=1`, a merged id, a gone id, a bad limit), the ISIN lookup, `/nope` and `/` all have **status, body and every header byte-identical**.
- OPTIONS is unchanged.

**T-F8 EXPLAIN** (local node:sqlite and **live D1, EXPLAIN only, 0 rows read**, 07:26:44–51Z). The live plans are identical to the local ones:
| Plan | Result |
|---|---|
| P-F4 gate | `SEARCH fi_serving_gate USING INTEGER PRIMARY KEY (rowid=?)`. Local only: the table is not migrated yet, so it runs live on Fri in step 3. |
| P-B2 F1 step 1 | `SEARCH bond_issuer_link USING INDEX idx_bil_entity (entity_id=?)` |
| F1b / F2 link | `SEARCH bond_issuer_link USING INDEX sqlite_autoindex_bond_issuer_link_1 (cik=?)` |
| **P-B1 F1 step 2** | `SEARCH bond_issuance USING INDEX idx_bi_cik_final_key (cik=? AND (maturity_date,accession_number,tranche_seq)>(?,?,?))`. No temp B-tree, so the row-value keyset is a true index range. |
| P-F1 F2 PK | `SEARCH … sqlite_autoindex_bond_issuance_1 (accession_number=? AND tranche_seq=?)` |
| P-F1 `other_filings` | `SEARCH … idx_bi_instrument (instrument_key=?)` + `TEMP B-TREE FOR count(DISTINCT)` (a handful of rows) |
| P-F2 F3 links | `SCAN bond_issuer_link` (≈ 30) |
| P-F2 F3 counts | `SCAN bond_issuance USING INDEX idx_bi_cik_final_key`. **No temp B-tree for GROUP BY**, so it costs about 1 × 633, not the §6 estimate of 2.5 × 633. |
| P-F2 F3 N8-3 | `SEARCH … idx_bi_instrument (instrument_key>?)` + `TEMP B-TREE FOR count(DISTINCT)` |
| **P-F3 F4** | `SEARCH … idx_bi_cik_final_key (cik=? AND maturity_date>?)`, no temp B-tree |
| R1f probe | `SEARCH … idx_bi_instrument (instrument_key=?)` + `TEMP B-TREE FOR DISTINCT` (≤ 2 rows) |
| §4.4 S1 / S2 / S3 | PK autoindex / `COVERING INDEX sqlite_autoindex_instrument_master_1` / `SEARCH fund_holdings_monthly USING COVERING INDEX idx_holdings_cusip (cusip=?)`. That is the required index; it shows as COVERING because the query selects `1`. |

**Not run today:** T-F10 (the live smoke) belongs to the deploy run sheet in §5.

## 3. M-6: proving Cache API hits on `workers.dev`
1. **Expected result: a miss.** Cloudflare does not promise Cache API operations on `*.workers.dev` (spec C5). Until T-F10 shows a `hit`, the **uncached budget is the planned figure**:
   - per screen: issuer ≤ 55, ladder ≤ 1.3k, detail ≤ 16;
   - directory ≈ 0.7k + 30 + 0.7k, which comes out **≤ 1.5k** using the measured plan above, not 2.4k;
   - **≈ 0.5–0.7M reads/day worst**, about 10–14 % of 5M.
2. **Proof run, with the gate open only.** With the gate closed, F3/F4 answer `no-store` and never touch the cache (spec §5.7), so **no `x-fi-cache` header exists to record**. The cache proof therefore cannot run in Friday's closed-gate T-F10. That clashes with the spec's T-F10 wording; see review point 6.
   - It runs in the **T-F10 open re-run**, straight after the gate opens: `GET /api/fi/coverage` twice and `GET /api/fi/issuers/1457/ladder` twice, 1–5 s apart, recording `x-fi-cache` on each.
   - Second response = `hit` → the cached figure (≈ 0.25M/day worst).
   - Second response = `miss` → the cache is treated as absent, the uncached figure stands, and **F4 stays first in the §11 cut order**.
3. **Optional uncached measurement** (≤ 1.5k reads, read-only, any day): run the three F3 statements with `wrangler d1 execute … --json` and record `meta.rows_read`. This replaces the planning estimate with a measured figure.

## 4. §4.4 PepsiCo check — **PASS** (07:27:00Z, read-only)
**S1** (`SEARCH bond_issuance USING INDEX sqlite_autoindex_bond_issuance_1 (accession_number=? AND tranche_seq=?)`) **rows_read = 8**. That meets the Task's ≤ 8 and the spec's ≤ 12 bound. The spec expected 4; D1 bills 2 reads per PK lookup.

| accession_number | tranche_seq | cik | instrument_key | cusip | filing_status | parse_confidence |
|---|---|---|---|---|---|---|
| 0001104659-24-022370 | 1 | **0002007029** | NULL | NULL | final | 85 |
| 0001104659-24-022370 | 2 | **0002007029** | NULL | NULL | final | 85 |
| 0001104659-24-022370 | 3 | **0002007029** | NULL | NULL | final | 85 |
| 0001104659-24-022370 | 4 | **0002007029** | NULL | NULL | final | 85 |

- All 4 rows have `cik = '0002007029'`, so R-1 is done (WED28.ENG8).
- S2 was not run (every key is NULL) and S3 was not run (every CUSIP is NULL).
- **PASS.** It is re-run before the Friday deploy (run sheet step 4) and before the Mon 2 release.

## 5. Deploy run sheet — 009 Worker, **Fri 30 Oct, after the Architect code review**
**Freezes Fri (UTC):** 05:50–07:10, 07:55–08:05, 10:45–11:15, 11:45–12:15, 16:45–17:15, 17:45–18:15, 23:50–00:10. Re-read `claude/relays/FREEZES.json` on the day. **Suggested slot:** 08:10–10:30Z, or 19:00–23:30Z.

| # | Step | Command / check | Pass rule (else stop) |
|---|---|---|---|
| 0 | Preconditions | Architect review PASS; spec rev 1 committed; the §7 Worker commit pushed; `wrangler whoami`; FREEZES; no other lane mid-change; `d1-today` read; `hold_all_jobs` = false. Log "**starting** 009 gate migration" with UTC time. | all true |
| 1 | Record the pre-009 version | `wrangler deployments list --config "App/Corporate Atlas/wrangler-entities-api.toml"` | expect `1e54a425-492d-43f4-aa8e-c688ea1a0a4a` (deploy 5). Record whatever is live. |
| 2 | Three-point check, then the gate migration (closed) | (a) index: INTEGER PK; (b) one execution, ≈ 3 rows; (c) budget ≈ 3 writes against `d1-today`. Then `wrangler d1 execute meridian-etf --remote -c "App/Corporate Atlas/wrangler-entities-enrich.toml" --file "App/Corporate Atlas/migrations/009-fi-serving-gate.sql"`, then the read-back `SELECT * FROM fi_serving_gate`. | exactly 1 row, `id=1`, `state='closed'`, `changed_by='Engineering Lead'`; record `meta` |
| 3 | P-F4 live | `EXPLAIN QUERY PLAN SELECT state, changed_at FROM fi_serving_gate WHERE id = 1` | `SEARCH … USING INTEGER PRIMARY KEY` |
| 4 | §4.4 re-check | S1 as §4 above (≤ 12 reads) | PASS |
| 5 | Deploy | Log "**starting** 009 Worker deploy". From the worktree at the Worker commit, with a clean tree for `src/entities-api.js`: `wrangler deploy --config "App/Corporate Atlas/wrangler-entities-api.toml"` | new version id recorded, 100 % |
| 6 | **T-F10 closed** (≤ 12 calls, `https://meridian-entities-api.navinmv1981.workers.dev`) | `/api/fi/issuers/1457/bonds` · `/api/fi/ciks/0002007029/bonds` · `/api/fi/bonds/0001104659-24-022370/1` · `/api/fi/coverage` · `/api/fi/issuers/1457/ladder` · R1 `/api/instruments/CA00206RNL29` (a served bond key, CIK 0000732717, looked up 07:35Z) · regressions `/api/instruments/US5949181045`, `/api/entities/search?q=pepsico`, `/admin/exceptions` | (a) 5 FI routes 200 with `gate:"closed"`, `no-store` and none of `cik`, `issuer_name`, counts or bond fields; F1 1457 `has_bond_link:true`. (b) R1 for `CA00206RNL29`: **no `sec_bond`** candidate. (c) Regressions: 200 / 200 / 410 `moved_to`. (d) The M-6 `x-fi-cache` proof is N/A while closed (§3) |
| 7 | Close-out | `d1-today` after +30 min; report, with version ids, `meta` and smoke bodies. Log "done". | — |

**Rollback rule (M-4; spec §12):**
- **Target:** the version recorded in step 1 (expected `1e54a425`), **never** the pre-003 `73851c02`.
- **Data incident** (a wrong row or count): **close the gate**. Do not roll the Worker back. Today the gate is closed from the migration, so there is nothing to close.
- **Worker defect before Mon 2** (front end not live): `wrangler rollback <step-1 id> --config …` is acceptable, because the exposure is API-only. But it restores the **ungated R1f**, so the same day either re-deploy a fixed 009 or deploy the one-constant R1f switch-off.
- **Worker defect on or after Mon 2, before AC12 has passed and R-1 is applied:** no rollback below 009. Ship a forward fix, or a rollback together with the R1f switch-off.
- **After AC12 has passed and R-1 is applied:** a rollback to the step-1 version is acceptable.
- **Failed T-F10 (a):** a closed route leaking any withheld field is a Worker defect. Roll back to the step-1 id at once and report.
- **The gate table** stays in place (it fails closed).

## 6. Files to commit
1. **Prerequisite governance:** `claude/MA-OCT-009_010_Spec.md` rev 1 (`2f83d58e…41f4`; uncommitted working copy in the shared checkout, written by the spec lane).
2. **009 Worker commit** (before the Fri deploy; it is the deploy source):
   - `App/Corporate Atlas/src/entities-api.js` `2262cc51…fe25`;
   - `App/Corporate Atlas/migrations/009-fi-serving-gate.sql` `aceda836…e00b`;
   - `App/Corporate Atlas/tests/fi-009-worker.test.mjs` `7d57ea2b…e7f1`;
   - `App/Corporate Atlas/tests/fi-009-explain.mjs` `4d649615…857b`;
   - `App/Corporate Atlas/tests/nav-007-worker.test.mjs` `c5714096…5986` (fixture-only change).
3. **010 front-end commit** (any day before Mon 2; Pages serves `September-2026/docs`, so committing to `October-2026` publishes nothing):
   - `App/ma-entities.js` `d97ea124…0c26`;
   - `App/index.html` `86f49616…b437`;
   - `App/Corporate Atlas/tests/fi-010-frontend.test.mjs` `d87e0e4e…f6df8f2`.
   - `docs/` is regenerated only in the Mon 2 release (`node generate-docs.mjs`).
4. **This report.**

## 7. Review points (for the Architect code review)
1. **007 test fixture changed (fixture only, all 58 assertions unchanged).**
   - With R1f gated, T9's `sec_bond` case only exists with the gate open.
   - `tests/nav-007-worker.test.mjs` now creates `fi_serving_gate` (state `open`) and adds `parse_confidence` (default 95) to its `bond_issuance`, with 7 lines changed.
   - Without that change T9 fails: correctly, since the gate is missing and therefore closed.
   - The ungated behaviour is no longer reachable, by design. T-F6 covers the closed, garbage and missing cases.
2. **F1 `freshness.latest_filing_date`** is the latest `filing_date` among the rows *fetched for this request*. The spec does not define it, and a per-issuer MAX would cost up to the issuer's full finals count (> 55). The front end labels it "latest filing". Alternative: drop it from F1 and use F3's per-issuer `latest_filing`.
3. **F2 `other_filings` and the N8-3 check** use one statement, `COUNT(*), COUNT(DISTINCT cik)`, instead of the spec's two (fewer reads, same index).
4. **F4's SELECT adds `parse_confidence`.** The spec's SQL omitted it, but the ≥ 60 drop needs it. The plan is unchanged (P-F3).
5. **R1f 2-CIK case:** state `ambiguous` / `source_conflict` even when the remaining candidate list has 0 or 1 entries (spec §4.3, "the state is `source_conflict`"). 007 consumers that assume "ambiguous ⇒ ≥ 2 candidates" should be checked: `_navRenderInstrument` prints "{n} candidate issuers — none is selected for you".
6. **T-F10 cache proof vs. the closed gate:** see §3. The spec asks for `x-fi-cache` in the closed-gate smoke, but §5.7 forbids caching closed bodies. I propose that the proof moves to the open re-run. Main Lane / Architect ruling needed.
7. **T-F9 live-browser and 375 px pass not done today.**
   - A file:// page can't be scripted in the built-in browser.
   - Serving the worktree would mean editing the tracked shared `.claude/launch.json` or starting a server from Bash, and I did neither.
   - Covered today by `fi-010-frontend.test.mjs` (62 checks on the real file plus the real Worker), plus a static check of the 640 px rule.
   - The live pass (preview on fixtures, 375 px, Back behaviour) is Fri 30's 010 item in spec §10. **It needs a preview config that serves the 009 worktree**, which is a Main Lane call.
8. **The F3 budget is lower than the spec**: about 1.5k, not 2.4k, because there is no GROUP BY temp B-tree (§2).
9. **Spec rev 1 is not committed.** `HEAD` holds rev 0. It needs to land (governance) before or with the 009 commit, so the commit references a committed spec.
10. **Gate statement evidence:** the migration's evidence string carries the full DIL14 SHA-256, but in the seed row only. The open and close statements (spec §4.1) are not in any file. They are executed per instruction, so nothing new is needed.

**Left as found:** shared checkout untouched (only this report is written there); no commit; no deploy; 0 D1 writes; no secrets read; no macOS prompts.
