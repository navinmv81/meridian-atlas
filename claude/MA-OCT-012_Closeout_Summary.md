# Close-out: MA-OCT-012, Entities-Seed Cron Hotfix (Part 2: observation and close-out)

```text
ISSUED BY:    Program Orchestrator (October Main Lane)
EXECUTED BY:  Engineering Lead (local Claude Code, Clean (v11), branch October-2026)
REVIEWED BY:  Architect (config + deploy) + ETF Product Lead (holdings outcome)
APPROVED BY:  Founder (lane approval 2026-09-24)
PACKET:       MA-OCT-012 — Entities-seed cron hotfix, Part 2 (observation + close-out)
GATE:         Close-out
```

**Observed:** Mon 2026-09-28, 05:24–05:40Z. **Final status: COMPLETE.** All five acceptance criteria pass.

## Preconditions (Part 2)

| # | Check | Result |
|---|---|---|
| 1 | Branch `October-2026`; HEAD equals `origin/October-2026` | ✅ `October-2026`. After `git fetch`: HEAD = `origin/October-2026` = `5405e3e`, and `origin/September-2026` = `420487d` (also confirmed with `ls-remote`). |
| 2 | `ls -la .git/*.lock` | ✅ No lock files (`no matches found`). `pgrep -fl git` found no git process. Nothing was removed. |
| 3 | Tracked changes | ✅ Only the Main Lane governance docs: `claude/Meridian_October_Operating_Kit_v3_Addendum.md` (+1 line, rule 8) and `claude/October_Decisions_Log.md` (+8 lines, 26 Sep entries). Acceptable under rule 7. |

## 1. Acceptance criteria

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | The deploy output shows `0 4 * * mon`, and the version ID is recorded | **PASS** | Version `82de8589-6765-4e2f-a6d1-d854e285d12d`, created 2026-09-24T18:41:55Z and serving 100% (`wrangler deployments status`). The live trigger string `0 4 * * mon` is shown in the cron field of the 28 Sep invocation (§3 B). |
| 2 | No seed invocation on Sun 27 Sep; holdings not `partial` because of budget | **PASS** | Seed: 0 cron and 0 total invocations on 26 and 27 Sep. Holdings: 1 cron invocation on 27 Sep at 04:00:46Z, status `success`. `last_run_status` = `running:51/237:partial:0`. That is the normal status between passes, **not** a budget stop (see §3 A). `writes_today_2026-09-27` = 70,672, below holdings' 80,000 guard. |
| 3 | Seed fired once from cron at about 04:00Z on Mon 28 Sep | **PASS** | 1 cron invocation (`0 4 * * mon`, scheduled 04:00:45Z, ran 04:00:49Z, `success`). All-trigger count was 1, so there was no manual or `/run` call. The seed ran rather than skipped: `writes_today_2026-09-28` = 34,331 (§3 B). |
| 4 | Commit on `October-2026` and pushed; `origin/September-2026` unchanged at `420487d` | **PASS** | Part 1: `5405e3e` is on `origin/October-2026`. `origin/September-2026` = `420487d` (`ls-remote`, 28 Sep). This close-out's commit is recorded in the report-back. |
| 5 | Known Issue 22.1 marked resolved-pending-review, with evidence | **PASS** | §4 |

## 2. Part 1 recap (done 2026-09-24)

- **Diff:** `App/Corporate Atlas/wrangler-entities-seed.toml`
  - `crons = ["0 4 * * 1"]` changed to `crons = ["0 4 * * mon"]`.
  - The comment block was rewritten to explain named days and Cloudflare's day-of-week numbering (1 = Sunday), per brief step 2. The RE-ENABLED, frozen and `0 3 * * *` history lines were kept.
  - No other changes to the file.
- **CLAUDE.md:** two Environment Truth bullets changed.
  - The cron-numbering bullet records the fix and the version ID.
  - The LOCAL_MASTER branch line changes from `September-2026` to `October-2026`, with `September-2026` recorded as frozen at `420487d` and still the live Pages source.
- **Deploy:** version `82de8589-6765-4e2f-a6d1-d854e285d12d` at 2026-09-24T18:41:56Z.
- **Commit:** `5405e3e` on `October-2026` (5 files: toml, CLAUDE.md, Decisions Log, Addendum, MA-OCT-012 brief), pushed.
- **Lock removal (reported by Part 1, not re-observed here):** `.git/index.lock` (0 bytes) came from the Main Lane's `git status` over the Cowork bridge at about 07:00 BST on 24 Sep. It was removed at 19:41:14 BST on 24 Sep, after `pgrep -fl git` showed no owning process. No lock remains as of 28 Sep.

## 3. Observation evidence

### A. Holdings and budget (D1 `holdings_pipeline_state`, read-only)

| Key | Value |
|---|---|
| `hold_all_jobs` | `false` |
| `last_full_run` | `2026-09-27T04:00:46.847Z` |
| `last_run_status` | `running:51/237:partial:0` |
| `writes_today_2026-09-20` (before the fix, co-fire) | **83,638** |
| `writes_today_2026-09-27` (after the fix, holdings alone) | **70,672** |
| `writes_today_2026-09-28` (seed alone, Monday) | **34,331** |
| Earlier Sundays, for reference | 09-06 = 61,715; 09-09 = 57,353; 09-13 = 54,657 |

**Why the 27 Sep "partial" is not a budget stop.** The source is `App/ETF Refresh/src/holdings-pipeline.js`:
- Each invocation processes `PIPELINE_BATCH_SIZE = 20` ETFs starting from `etf_offset`.
- It then writes `running:<newOffset>/<total>:partial:<batch.length − completed>`.
- It writes `complete:…` only when the offset wraps past 237.

So `running:…` is the normal status for every invocation except the last one in a pass. The trailing number is the count of ETFs in the batch that did **not** finish.

| Date | Status | ETFs completed | Stopped by budget? |
|---|---|---|---|
| 20 Sep | `running:31/237:partial:9` | 11 of 20 | **Yes** (MA-OCT-000 F3). The counter was already at 83,638 by 04:00:15, and the ≥80,000 per-ETF guard stopped new ETFs. |
| 27 Sep | `running:51/237:partial:0` | **all 20** (offset 31 → 51) | **No.** The run finished at 70,672 writes, under the 80,000 limit. No guard fired. |

The run's cause for stopping was the designed batch size, not the write budget.

**Note for the ETF Product Lead (record only, outside this packet's scope):** at 20 ETFs per weekly invocation, a full pass over 237 ETFs takes about 12 weeks. The next one on Sun 4 Oct continues from offset 51.

### B. Invocations, 26 Sep 00:00Z → 28 Sep ~05:40Z

Method: the same one MA-OCT-000 used. The data comes from `meridian-ops` `GET /api/ops/cf/invocations?script=…&date=…`, which is read-only Cloudflare GraphQL Analytics: `workersInvocationsScheduled` for cron runs, `workersInvocationsAdaptive` for all triggers.

| Worker | 26 Sep (Sat) | 27 Sep (Sun) | 28 Sep (Mon) |
|---|---|---|---|
| `meridian-entities-seed` | 0 cron / 0 all | **0 cron / 0 all** ✅ | **1 cron / 1 all** ✅: cron `0 4 * * mon`, scheduled 04:00:45Z, ran 04:00:49Z, `success` |
| `meridian-holdings` | 0 / 0 | **1 cron / 1 all** ✅: cron `0 4 * * sun`, scheduled 04:00:45Z, ran 04:00:46Z, `success` | 0 / 0 |
| `meridian-entities-enrich` | 2 cron (06:00:48, 06:50:48, both `success`) / 4 all | 2 cron (06:00:51, 06:50:46, both `success`) / 3 all | 0 / 0 (not yet due when observed) |

**The seed ran; it did not skip.** Its guard (`checkWriteBudget`, `DAILY_CAP` = 100,000, needs 65,000 headroom) found no `writes_today_2026-09-28` key, so it read 0 used and 100,000 headroom and proceeded. If the guard had skipped, the seed would have written nothing and the key would not exist. Instead the key holds 34,331. Holdings made no invocation on 28 Sep, and enrich does not write this counter (MA-OCT-000 F7), so the whole 34,331 comes from the seed. That fits its expected ~30k-row weekly pass.

**The literal log line was not retrieved.** Historical Workers Logs have no read-only wrangler command (`wrangler tail` is live only), and the `.env` token lacks Workers Scripts read (MA-OCT-000 §5.2). The D1 counter above is the evidence used instead. If the reviewers want the line itself, the Founder can open Dashboard → Workers → `meridian-entities-seed` → Logs for 28 Sep 04:00Z and look for `Cron complete`.

### C. Trigger for `meridian-entities-seed`

- `wrangler deployments status`: one deployment (2026-09-24T18:41:56Z), `82de8589…` at 100%. There have been no deployments since.
- **Live trigger string: `0 4 * * mon`,** as shown in the Cloudflare-reported `cron` field of the 28 Sep invocation. This matches the dashboard reading recorded by the Main Lane on 26 Sep (Decisions Log).
- **Not listed directly.** The schedules API (`workers/scripts/{name}/schedules`) is out of reach for the `.env` token (known gap). `wrangler versions view` does not print triggers, and `wrangler triggers` has no read-only subcommand. The evidence above is corroboration from runtime behaviour.

### D. Overlap with `entities-enrich` (Monday 06:00 and 06:50; accepted in the brief)

**No overlap happened on 28 Sep.** The seed's only invocation had already finished (`success`) before enrich's first Monday slot. The seed runs as a single cron invocation, so it cannot still be running at 06:00. Enrich's 28 Sep fires fall after this observation window and are not recorded here.

**Recorded, not in scope:** enrich had more total triggers than cron triggers on 26 Sep (4 vs 2) and 27 Sep (3 vs 2). These are fetch-triggered invocations, most likely the local boost LaunchAgent (MA-OCT-000 manifest). This is not related to this packet.

## 4. Known Issue 22.1: resolved-pending-review

- **Cause removed:** the seed and holdings no longer fire in the same second on Sundays. On 27 Sep, holdings ran alone; the seed moved to Monday and ran alone.
- **Effect gone:**
  - Holdings finished its full 20-ETF batch under budget (70,672 against the 80,000 guard), compared with an 11-of-20 budget stop on 20 Sep (83,638).
  - The seed ran on its own UTC day, with its own counter and full headroom.
- **Still open:** the "Sunday 04:00 misattribution" dashboard check (Wave 0 item 0.4) is a separate Founder item and is not closed by this packet.
- **Next confirming data point:** Sun 4 Oct / Mon 5 Oct. Expect the same pattern, with holdings continuing from offset 51.

## 5. Follow-ups (not done here; for the next packet that touches these files)

1. **`CLAUDE.md` line 27** (LOCAL_MASTER absolute path) still says "confirm `git branch` shows `September-2026`". It should say `October-2026`.
2. **`App/Corporate Atlas/wrangler-entities-seed.toml` lines 17–18:** the comment reads "…Changed from daily to / # Weekly, Monday 04:00 UTC…", with a capital "W" in the middle of a sentence. This is cosmetic only.
3. **Rule 8 references archive files not found in this repo:** `claude/Sprint_Board_September_2026_Archive.md` and `claude/Release_Ledger_September_2026_Archive.md` do not appear in `git status` (neither tracked nor untracked). They may exist only on the Cowork side. Main Lane to confirm.
4. **Rule 7, still uncommitted:** the Main Lane edits to the Addendum (rule 8) and the Decisions Log (26 Sep entries) were **not** included in this commit, because this packet named no governance docs for it. They are still uncommitted and are for the next executing lane, or for the Main Lane to name.

## 6. Reads and writes this session

| # | Call | Plan | Rows read | Rows written |
|---|---|---|---|---|
| — | First `wrangler d1 execute` attempt | Auth error 10000 (transient; the retry succeeded, no query ran) | 0 | 0 |
| Q1 | `EXPLAIN QUERY PLAN SELECT key … WHERE key = 'hold_all_jobs'` (auth retry check) | — | 0 | 0 |
| Q2 | `EXPLAIN QUERY PLAN` for the Q3 query | `SCAN holdings_pipeline_state USING INDEX sqlite_autoindex_holdings_pipeline_state_1` (small key–value table) | 0 | 0 |
| Q3 | `SELECT key, substr(value,1,200) FROM holdings_pipeline_state WHERE key IN (…) OR key LIKE 'writes_today_2026-09-%' OR key LIKE 'last_%' OR … ORDER BY key` | as above | 60 | 0 |
| — | 9 × `meridian-ops` `/api/ops/cf/invocations` (GraphQL Analytics) | — | 0 D1 | 0 |
| **Total** | | | **60** | **0** |

Other activity:
- **Cloudflare:** read-only only (`deployments status`, `versions view`, analytics). No deploy, no trigger change, no `/run`.
- **Git:** the only write is this close-out's commit.

## 7. Deviations

1. **Log line not retrieved**, as described in §3 B. The seed's outcome was shown instead by the D1 write counter and the analytics status. The Founder can check the dashboard if the reviewers want it.
2. **Trigger list not read directly**, as described in §3 C. This is the known token-scope gap. The evidence is the live `cron` field together with the deployment status.
3. **Observation window ended at about 05:40Z on 28 Sep**, not 12:00Z. Everything in scope (the seed's 04:00 fire) had already finished. Only the accepted enrich overlap (D) was still in the future, and the seed had finished before it.
4. **Governance docs not committed** (§5 item 4), because this packet named none.
