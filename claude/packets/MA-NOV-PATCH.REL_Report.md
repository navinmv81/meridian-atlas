# MA-NOV-PATCH.REL — Report

```text
PACKET:    MA-NOV-PATCH.REL · Control v1 (ba257bef…50e4) · Task v1 (8d2a2c62…5152)
RUN:       r-20261127T171054Z-1ae7 (interactive, Founder present)
EXECUTED:  Operations Lead + Engineering Lead, 2026-11-27 17:10–17:30Z
OUTCOME:   DONE. Released and verified; bootstrap cron off; dead agent removed.
COMMITS:   7cdb345 (Part A, pushed 17:14:27Z) · second commit = toml + CLAUDE.md + this report
BOOTSTRAP: b2ab8f09-3e71-4200-a57a-fd4eac03fa55 → 4e417f40-e440-4e46-8c72-6942b694edd0
```

## Pre-flight
- Folder, branch `November-2026`, remote `navinmv81/meridian-atlas`; no `.git/*.lock`.
- HEAD `f538f6e` = `origin/November-2026` = `ls-remote`.
- Pins: UIT.REVIEW `bc9a38b8…aa58` ✓, UIT.APPLY `f66dd7c4…9fbf` ✓, DIAG.HEALTH `ee66f230…a935` ✓, REL.GO report unchanged since `bb3815b` ✓.

## A — front end (commit `7cdb345`)
| # | File | Change |
|---|---|---|
| 1 | `App/ma-etf.js` | `NO_NPORT`: removed `SPY`, `QQQ`, `DIA`. The other 20 tickers are unchanged (test-checked). |
| 2 | `App/ma-entities.js` | `exp_unsupportedSentence`: `no_holdings` + `no_series_id` → "This fund doesn't file a holdings report we can read (it isn't a 1940-Act fund — for example a commodity or crypto trust), so its holdings can't be shown." Other `no_holdings` reasons keep "We don't have this fund's holdings." **Also one line in `exp_compute`'s unsupported-row build:** it now copies the route's reason (`detail`) onto the row for `no_holdings`. Without it, the wording could not reach the panel, because the row dropped `detail`. Exposure block only; no Worker change. |
| 3 | `generate-docs.mjs` | `--dry-run` writes to `mkdtempSync(os.tmpdir()/ma-docs-dry-run-*)` and prints the path. Nothing else changed. The old repo `.docs-dry-run/` (untracked) was left alone, because deleting files is prohibited. |
| 4 | `App/index.html` | 9 × `?v=rel-20261126` → `?v=rel-20261127`. |
| 5 | tests | `exp-ui.test.mjs`: the `no_series_id` check now expects the new sentence, and new checks cover no reason and another reason (both keep the generic sentence). New `App/Ops/tests/patch-rel.test.mjs` (8 checks): NO_NPORT contents, dry-run target under tmpdir with 11 files and none in the repo, 9 stamps. |

**Suites:** all unit suites in `App/Corporate Atlas/tests/`, `App/Ops/tests/` and `App/ETF Refresh/tests/` passed. Key counts: exp-ui 271/0, exp-compute 160/0, exp-route ok, home-entry 177/0, bond-ui 120/120, ops-a 41/0 (incl. the REL.GO M-2 docs-mirror hard check after generate), ops-console, patch-rel 8/0, ops-health 26/26. Two scripts are live/manual runners, not unit suites, and exit without running: `ingest-contract.mjs` needs `OPS_INGEST_*` env and `gleif-reconcile-011-dryrun.mjs` needs an input path. Neither touches the changed files.

**Dry run:** the output went to `/var/folders/…/T/ma-docs-dry-run-CMKRJs`. `diff -rq` against `docs/` showed exactly `index.html`, `ma-entities.js`, `ma-etf.js`, then the dir was removed. `node generate-docs.mjs` copied 11/11, and `docs/.nojekyll` is present.

## B — bootstrap cron off
**Three-point check:**
1. **Index audit:** no query added or changed. The Worker code is untouched; only the trigger is removed.
2. **Single execution:** fewer executions. Six scheduled runs a day become zero. `/trigger` behaviour is unchanged.
3. **Budget:** D1 reads and writes go down. Each run did 0 work (bootstrap `complete` since 2026-06-11) plus its own run-event emits, and those stop too. One of 5 account cron slots is freed.

**Deploy** (`npx wrangler deploy -c "App/ETF Refresh/wrangler-bootstrap.toml"`, wrangler 4.96.0):
```
Your Worker has access to the following bindings:
env.DB (meridian-etf)                         D1 Database
env.OPS_INGEST_URL ("https://meridian-ops.navinmv1981.work...")  Environment Variable
env.OPS_EMITTER ("bootstrap-cf")              Environment Variable
Uploaded meridian-bootstrap (6.67 sec)
Deployed meridian-bootstrap triggers (4.14 sec)
  https://meridian-bootstrap.navinmv1981.workers.dev
Current Version ID: 4e417f40-e440-4e46-8c72-6942b694edd0
```
- The output has no `schedule:` line, so no cron remains.
- Bindings and vars are the same as before (DB, OPS_INGEST_URL, OPS_EMITTER). The secret `OPS_INGEST_KEY` is not shown by deploy and was not touched.
- Previous version (from `deployments list`): `b2ab8f09-3e71-4200-a57a-fd4eac03fa55`.
- The toml keeps a comment with the old `0 */4 * * *` and the reason.

## C — live checks (17:24:34Z, 10 min 7 s after the push; `cache-control: no-cache`)
| Check | Result |
|---|---|
| 11 files at `https://navinmv81.github.io/meridian-atlas/` vs `docs/` | all 200, all byte-identical ✓ |
| `/.nojekyll` | 200 ✓ |
| Script stamps | 9 × `?v=rel-20261127`; the browser loaded all 9 with the new stamp ✓ |

| Exposure route | HTTP | report_month | holdings | entities |
|---|---|---|---|---|
| SPY | 200 | 2026-09 ✓ | 504 | 493 |
| QQQ | 200 | 2026-06 ✓ | 105 | 98 |
| DIA | 200 | 2026-07 ✓ | 30 | 29 |
| MDY | 200 | 2026-09 ✓ | 400 | 400 |
| GLD | 404 `{"error":"no_holdings","reason":"no_series_id"}` ✓ | — | — | — |
| IVV | 200 | 2026-03 (unchanged) | 507 | 501 |

**Screen** (in-app browser, live site):
- **Exposure with SPY 40 / GLD 20 / IVV 40:** computes 510 companies. SPY shows "holdings available (Sep 2026)", and the panel reads "Not analysed: GLD (20.00%)" with the new 1940-Act sentence ✓.
- **IVV 100 alone:** Mar 2026, 501 companies, 100.07% + −0.07%, the same as before ✓.
- **ETF Holdings tab, SPY:** 504 holdings, period end 2026-09-30, NVIDIA 8.38% top. The N-PORT block is gone ✓.
- **ETF Holdings tab, MDY:** 400 holdings, period end 2026-09-30 ✓.

## D — dead agent removed (Founder OK 17:15Z: "Yes, remove it")
- Before: `launchctl list` showed `-  78  com.meridianatlas.financialfact-backfill`.
- `launchctl bootout gui/501/com.meridianatlas.financialfact-backfill` → rc 0.
- The plist was moved to `~/Library/LaunchAgents/_retired-meridian/com.meridianatlas.financialfact-backfill.plist` (created the folder). Nothing was deleted.
- After: `launchctl list | grep -c financialfact` → 0. The remaining Meridian agents (firds-weekly-seed, entities-enrich-boost, health-check) are untouched, and so is everything in `13F Seed/`.

## CLAUDE.md (two lines)
- DEPLOY_BRANCH, new sub-bullet: patch release 2026-11-27, stamp `rel-20261127`, commit `7cdb345`.
- Cron Trigger capacity: now 4 of 5 in use after removing bootstrap's cron (version `4e417f40…`).
- Only these two lines are committed. The working tree also has a pre-existing, uncommitted Main Lane edit to the "LOCAL_MASTER's own git branch" line. It is not part of this packet: it was left unstaged and stays in the working tree.

## Rollback
- **A:** `git revert 7cdb345 && push November-2026`, which restores `rel-20261126` and the old NO_NPORT/wording. Pages serves the reverted `/docs`; allow ~10 min for the cache. The full-site fallback is unchanged: switch Pages to `October-2026` `/docs` (`98e830e`).
- **B:** restore `crons = ["0 */4 * * *"]` in `App/ETF Refresh/wrangler-bootstrap.toml` and run `npx wrangler deploy -c "App/ETF Refresh/wrangler-bootstrap.toml"`, or `npx wrangler rollback b2ab8f09-3e71-4200-a57a-fd4eac03fa55 -c "App/ETF Refresh/wrangler-bootstrap.toml"`. Re-check cron capacity (5/5) first.
- **D:** `mv ~/Library/LaunchAgents/_retired-meridian/com.meridianatlas.financialfact-backfill.plist ~/Library/LaunchAgents/ && launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.meridianatlas.financialfact-backfill.plist`

## Boundaries
- No D1 query or write. The only Worker deployed was `meridian-bootstrap`, and no other toml, cron or secret was changed.
- No GitHub settings were touched. The only LaunchAgent changed was the one above.
- No file was deleted, and nothing in `13F Seed/` was touched. No `.env` was read or printed.
- Status, board, Tower and log files were not edited. Nothing was installed, and no subagents were used.
- Writes stayed within the allowed paths. **Disclosed:** the one extra line in `exp_compute` (A-2 above) is inside `ma-entities.js`'s exposure block and only serves the no-holdings wording.
