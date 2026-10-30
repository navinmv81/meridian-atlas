# MA-OCT-WED28.ENG1 — Report (LANE-1-ENG, Engineering Lead)

At 19:40Z:
- Control `030b7feb…5b04` and Task `4b270eb6…0a71` were re-hashed. Both match, and so does the board row (line 75).
- No `.git/*.lock`. Branch `October-2026`.
- Wrangler is `/usr/local/bin/wrangler` 4.96.0, OAuth, `whoami` OK.
- FREEZES: tonight only 23:50–00:10Z. Every production step finished by 19:51Z, so none of them fell inside a window.

**Result:**
- All 7 steps are done.
- Deploy 5 is live (`1e54a425`).
- ENT-CR1 C2 and C3 are applied, each measured at 1 row written.
- 5 commits pushed. Final `origin/October-2026` = `acfd069`.
- **Two points for the Main Lane**, both under §5 and §6 below:
  - deploy 5's `/exceptions` smoke;
  - the C2/C3 gate conflict.

## Change log (UTC; one production change at a time)
- 19:40–19:42Z: step 1, local only. Shared checkout clean-up, then fast-forward `c3c6e4a` → `721d093`.
- 19:43Z: step 2, governance commit `0352b6b`, pushed.
  - The first push was rejected because LANE-8 had pushed `f444ce7` (runner logging) in the meantime.
  - `f444ce7` and my commit share no paths. The shared checkout's modified `13F Seed/check-pipeline-health.js` was byte-identical to `f444ce7`'s version. I restored it, rebased my commit, and re-checked that the file's content is unchanged.
- 19:44Z: step 3, 011 code commit `58cd922`, pushed.
- 19:44Z: step 4, 003 retirement commit `29ddfb4`, pushed.
- 19:45Z: step 5 pre-check. LANE-8's 008 R-1 (D1, bond tables) was logged done at 19:45Z, and no other lane had a change open.
- 19:46Z: **starting** deploy 5 (meridian-entities-api). Deployed 19:46:35Z as version `1e54a425`; smoke finished 19:46:50Z. **Done.**
- 19:48–19:49Z: ENT-CR1 preflight and before set (reads only, ≈ 320 rows).
- 19:50Z: **starting** ENT-CR1 C2. Applied 19:50:18Z; E5/E7 re-checked 19:50:20Z. **Done.**
- 19:50:27Z: gate re-read. 19:50:46Z: **starting** ENT-CR1 C3. Applied; after set finished 19:50:56Z. **Done.**
- 19:51Z: migration commit `acfd069`, pushed.
- 19:52Z: step 7, worktrees (local only).

## Commits (all on `October-2026`, pushed; staged by explicit path)
| Step | Commit | Content |
|---|---|---|
| 2 | `0352b6b` | Governance: 183 paths under `claude/` (14 modified, 169 new). `Release_Ledger.md`, `Sprint_Board.md` and `CLAUDE.md` were unchanged, so they are not included. Excluded: `Claude outputs/`, `MA-SEP-010_Change_Request.md`, `*.docx`, `~$*` (none were under `claude/`). Key-like string scan of the 183 paths: **0 hits**. |
| 3 | `58cd922` | 011 code: 10 files. `lib/gleif-reconcile-011-core.mjs`, `scripts/gleif-reconcile-011{,-plan,-verify}.mjs`, `scripts/gleif-reconcile-011-{pause,resume,status,stop}.sh`, `tests/gleif-reconcile-011{,-dryrun}.mjs`. **Secret scan: 0 key/token/secret literal assignments, 0 token-shaped literals.** There were 16 long-string hits: 11 sha256 hex digests, 3 comment rules, 1 constant name and 1 identifier. 4 references to secret-ish names (names only). |
| 4 | `29ddfb4` | 003 retirement. Patch `03-retirement-entities-api.diff` (sha256 `c02f62b1…ecc714`, re-hashed ✅) applied whole: `src/entities-api.js` (−741), `wrangler-entities-api.toml` R-5 hunk (the `[vars]` CF_ACCESS_* removed), plus `tests/entities-api-retirement.mjs`. **Tests: retirement 77/77, nav-007-worker 58/58.** |
| 6 | `acfd069` | `App/Corporate Atlas/migrations/ent-cr1b-drop-duplicate-indexes.sql`, holding only C2 + C3. The file name follows the 13 Oct ENT-CR1 report; the C1 file is unchanged. |

**Notes on the commits:**
- **Step 4's patch includes the toml hunk.** The Task names only `entities-api.js`, but the patch is a single hashed artefact, and the retirement test's R-5 check fails without the toml hunk. Both post-images are byte-identical to the stale shared copies moved aside in step 1.
- **The `entities-api.js` SHA-256 after step 4 is the 009 build base:** `d18845ddc26666bf3253c0ed96cd77604f24b5b840c41925676d930a83ac70db`.
- **LANE-8 pushed `16b2b10` (008 bond code, 41 files) while I was committing step 6.**
  - All 41 files were already in the shared tree, untracked and byte-identical.
  - A plain rebase would have had to overwrite them, so I built the step-6 commit with plumbing instead: a temporary index from `origin/October-2026` plus my one file, then `commit-tree`, then `reset --mixed`.
  - No LANE-8 file was touched. Its untracked `bonds/state/` files stay as they were.

## 1. Shared checkout clean-up → fast-forward
Each file was diffed against `origin/October-2026` (`721d093`) and against LANE-8's `eng8-worktree` (`76f4261` at the time). Each was then **copied** (`cp -p`, `cmp`-verified) to `~/MeridianAtlas-work/stale-shared-20261028/`, keeping its path. The tracked files were restored with `git restore`, and the copied untracked files were removed from the shared tree.
- `sweep-ext.js` and `sweep-ext-contract.mjs` were left alone (LANE-8's). After the fast-forward, LANE-8's `f444ce7` / `16b2b10` made them tracked.
- Fast-forward `c3c6e4a` → `721d093` was clean.

| File | Working sha256 (12) | = origin? | = eng8? |
|---|---|---|---|
| `App/Corporate Atlas/src/entities-api.js` (tracked) | `d18845ddc266` | no | no |
| `App/Corporate Atlas/wrangler-entities-api.toml` (tracked) | `a6e0a6ec104b` | no | no |
| `App/Ops/src/ops-api.js` (tracked) | `ec85886ee116` | no | no |
| `App/Ops/wrangler-ops.toml` (tracked) | `fadd9d2d67a8` | no | no |
| `App/Ops/src/cases.js` | `6ff88abc4502` | no | no |
| `App/Ops/migrations/004-ops-cases.sql` | `d7c96c550550` | **yes** | yes |
| `App/Ops/migrations/m1-entity-exceptions-to-ops.sql` | `bf0f81d7abf7` | **yes** | yes |
| `App/Ops/migrations/m2-seed-gleif-cases.sql` | `a6e621d39ef3` | **yes** | yes |
| `App/Ops/tests/cases-contract.mjs` | `82088e3b9412` | no | no |
| `App/Ops/tests/migration-m1.mjs` | `bb57169746c5` | **yes** | yes |
| `App/Ops/tools/m1-render.mjs` | `864fd1cc004c` | **yes** | yes |

**Six copies are not identical to any committed file or to eng8.** Their blobs are found nowhere in `git log --all`. Each is kept in the stale folder and nothing was discarded. Each is an *older or other* state of a file that origin now has in a newer form:
- **`entities-api.js` and `wrangler-entities-api.toml`:** the 003 retirement already applied. These are **byte-identical to the patch post-image committed in step 4**, so nothing is lost.
- **`ops-api.js`:** a pre-A6 version. The header still describes the "August Operating Layer" and the governance routes, and it has none of origin's A6 and later changes. Its 358 diff lines are all origin's later work.
- **`wrangler-ops.toml`:** `OPS_SERVICE_ACTORS = "{}"` plus `OPS_SWEEP_GLEIF_CHECKS` / `OPS_SWEEP_AUTORESOLVE = "true"` and their comment. Origin has the real `ops-script` actor map, and the two sweep vars belong to deploy 4 (LANE-8).
- **`cases.js` and `cases-contract.mjs`:** they predate BREVA N-1. They lack `SERVICE_ROUTE_IDS` and the fail-closed route check, and the 3 N-1 test cases.

None of the six holds work that origin lacks.

## 5. Deploy 5 (meridian-entities-api) — DEPLOYED
- **Live-site search:** all 12 files in `origin/September-2026:docs/` have **0 matches** for `/exceptions` or `/admin/exceptions`. The only entities-API base URLs are `ENTITIES_API_URL` (`ma-entities.js:6`) and `ENTITIES_API` (`ma-etf.js:2997`), both used for `/api/entities/*`. Decision: deploy.
- **Rollback version** (live before the deploy): **`73851c02-f891-478d-abe1-1e2e5290f11f`** (15 Oct, 007 R1–R4).
- **Deployed** from `29ddfb4` (clean tree for both files) at 19:46:35Z. **New version `1e54a425-492d-43f4-aa8e-c688ea1a0a4a`**, at 100%. Bindings: `env.DB` only (the CF_ACCESS vars are gone, per R-5).

| Smoke | Before | After |
|---|---|---|
| `GET /admin/exceptions` | 401 | **410** `{"error":"gone","moved_to":"meridian-ops /api/ops/admin/cases (MA-OCT-003)"}` ✅ |
| `GET /exceptions` (and `/exceptions/ui`) | 302 | **302** to `meridian-atlas-except.cloudflareaccess.com/cdn-cgi/access/login/…`; see the note below |
| `GET /api/instruments/US5949181045` (R1) | 200 | **200** (MICROSOFT, `placeholder_key:false`) ✅ |
| `GET /api/entities/search?q=microsoft` | 200 | **200** (entity 1371) ✅ |
| `OPTIONS` allow-methods | — | `GET, OPTIONS` (R-4) ✅ |

**Note for the Main Lane: `/exceptions` → 410 cannot be seen from outside.**
- The 015b `/exceptions` Access app (AUD `af2ac4…`) still sits in front of `/exceptions*`, with its policy on Block since the Sat 24 freeze. The 003 spec §4 row 132 says it is deleted on 31 Oct (R-10).
- Cloudflare's edge answers with the Access login redirect, so these requests never reach the Worker. The state before the deploy was the same 302, so this is not a regression.
- The Worker's 410 rule is the single regex `^/(admin/)?exceptions(/|$)`. It is proven live on `/admin/exceptions`, and the retirement test covers `/exceptions` directly (77/77).
- I did **not** roll back. A rollback would leave `/exceptions` unchanged and would bring the retired code back.
- The `/exceptions` 410 can be re-checked live after R-10 deletes the Access app.

## 6. ENT-CR1 C2 then C3 — APPLIED (CR rev 1 `fb13ff3e…6c20`, re-hashed ✅)
**Gate conflict, reported as asked.**
- Tonight's Task states AR-2(b), "`rowsWritten` ≤ 35,000".
- ML-1013-2 (13 Oct) set a stricter gate for C2/C3 after 23 Oct: "reading + own writes + 1.05 × *N*ᵢₘ ≤ 100,000", which gives a reading ≤ about 23,000.
- I found no later ruling that reconciles the two. ML-1025-5 and ML-1028-1 schedule "C2/C3 (AR-2 write gates)" but restate no figure.
- **I applied both.** The stricter gate was met by a wide margin, so the conflict did not affect tonight's outcome. It is still worth settling for the record.

Preflight, re-measured at 19:49Z:
- S1 *R*ᵢ = 32,769.
- **S3 *N*ᵢₘ = 73,006**, unchanged.
- `hold_all_jobs` = `false`.
- ST: no `sqlite_stat1` (no `ANALYZE`).
- P9 before: 5 `instrument_master` indexes + 2 iem indexes.

| Gate | `d1-today` rowsWritten | AR-2(b) ≤ 35,000 | ML-1013-2: reading + own + 1,000 margin (unseen writers in the 25–30 min lag; LANE-8 R-1 ≤ 20) + 1.05 × 73,006 | hold |
|---|---|---|---|---|
| before C2 (19:49:57Z) | 99 | ✅ | 99 + 0 + 1,000 + 76,657 = **77,756** ≤ 100,000 ✅ | false |
| before C3 (19:50:27Z) | 99 | ✅ | 99 + 1 + 1,000 + 76,657 = **77,757** ≤ 100,000 ✅ | false |

**Measured DDL cost (D1 `meta`, as reported):**
| | Statement | rows_read | rows_written | changes | changed_db | size_after | duration | attempts |
|---|---|---|---|---|---|---|---|---|
| C2 | `DROP INDEX IF EXISTS idx_instrument_master_isin;` (19:50:18Z) | 319 | **1** | 0 | true | 458,391,552 | 48.87 ms | 1 |
| C3 | `DROP INDEX IF EXISTS idx_instrument_master_cusip_issuer;` (19:50:46Z) | 317 | **1** | 0 | true | 457,383,936 | 25.84 ms | 1 |

**What the measurement shows:**
- A `DROP INDEX` bills **1 write (the schema row), not one per entry**. C2 was well under 1,000, so C3 went ahead the same night.
- The 13 Oct worst-case premise (a DROP billed at about *N*ᵢₘ) is disproved. **New standing figure: `DROP INDEX` ≈ 1 write + about 2 × the `sqlite_master` rows read.**
- C3 alone reduced `size_after` by 1,007,616 bytes. There is no "before" size for C2.

**Plans (EXPLAIN QUERY PLAN; 0 reads each):**
| # | Before (19:49Z) | After C3 (19:50Z) | Verdict |
|---|---|---|---|
| E1 | `SEARCH iem USING INDEX idx_iem_entity_key (entity_id=? AND instrument_key>?)` / `SEARCH im … autoindex_1` | identical | ✅ |
| E2 | `… SEARCH instrument_entity_map USING COVERING INDEX idx_iem_entity_key (entity_id=?)` | identical | ✅ |
| E3 | `SEARCH iem … idx_iem_entity_key` / `SEARCH im … autoindex_1` / `USE TEMP B-TREE FOR ORDER BY` | identical | ✅ no new SCAN/B-tree |
| E4 | `SEARCH … COVERING INDEX idx_iem_entity_key (entity_id=?)` | identical | ✅ |
| E5 | `SCAN im` + correlated `SEARCH iem` / `SEARCH ofc` (PK covering); no multi-index OR | identical (also re-checked after C2) | ✅ expected SCAN (N-1) |
| E6 | `SEARCH … COVERING INDEX idx_instrument_master_cusip_issuer (cusip_issuer_6=?)` | `SEARCH … COVERING INDEX **idx_instrument_cusip6** (cusip_issuer_6=?)` | ✅ surviving twin, same shape |
| E7 | `SEARCH … USING INDEX idx_instrument_master_isin (isin=?)` | `SEARCH … USING INDEX **idx_instrument_isin** (isin=?)` (already after C2) | ✅ surviving twin |
| E8 | `SEARCH h … autoindex_1` / `SEARCH im USING INDEX idx_instrument_master_cusip_issuer` LEFT-JOIN / `SEARCH iem` (PK) / `TEMP B-TREE ORDER BY` | same with **`idx_instrument_cusip6`** | ✅ |
| E8b | `… SEARCH im USING INDEX idx_instrument_master_cusip_issuer` LEFT-JOIN … | same with **`idx_instrument_cusip6`**, all other lines identical | ✅ |
| E9a / E9b | `idx_holdings_month` / `idx_holdings_status_series_month` paths, iem by PK | identical | ✅ no-regression |
| E10 | `SCAN im USING INDEX autoindex_1` / `SEARCH iem` (PK covering) | identical | ✅ |

**After the change:**
- P9 after: `instrument_master` has `sqlite_autoindex_instrument_master_1`, `idx_instrument_isin` and `idx_instrument_cusip6`; iem has `sqlite_autoindex_instrument_entity_map_1` and `idx_iem_entity_key`. That is 3 + 2, as the CR expects.
- **Pass rule met.** RB-2 was not needed.
- Packet D1 total, about 1,600 rows read: preflight 321, P9 × 2 = 316, the two DROPs 636, E-plans 0, hold re-read 1. **Rows written: 2.**
- Migration of record: `acfd069`.
- The runner was a guarded scratch script. It allowed only SELECT and EXPLAIN plus the two literal DROPs, ran through `--config wrangler-entities-enrich.toml`, and retried once after 30 s on 10000/7403 (never needed). The full per-statement JSON is in the scratchpad `ent.jsonl`.

## 7. Worktrees
| Worktree | `status --porcelain` | HEAD (on origin?) | Action |
|---|---|---|---|
| `~/MeridianAtlas-work/a6-worktree` | empty | `ccff23b` (yes) | **removed** |
| `~/MeridianAtlas-work/mon26-worktree` | empty | `721d093` (yes) | **removed** |
| `~/MeridianAtlas-work/ma-oct-003/eng8-worktree` | — | `16b2b10` | **kept** (LANE-8) |
| `~/MeridianAtlas-work/ma-oct-004/build-worktree` | — | `721d093` | untouched (004 lane; not in scope) |

`git worktree prune` was run.

## Left as found
- `claude/MA-OCT-009_010_Spec.md` was modified in the shared tree by another lane after `0352b6b`. It is not mine, so I left it uncommitted.
- `13F Seed/gleif-seed.js`, `.env*`, `.claude/settings.local.json`, `Claude outputs/`, `MA-SEP-010_Change_Request.md` and `*.docx` were not touched.
- LANE-8's untracked `App/Corporate Atlas/bonds/state/*` files are untouched.
- No secrets were read. There were no macOS prompts, no commits to `September-2026`, and no `git add -A`.
- This report is uncommitted. It goes in the next governance commit.
