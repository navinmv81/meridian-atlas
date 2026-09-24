# Build Brief: MA-OCT-012, Entities-Seed Cron Hotfix (stop the Sunday co-fire)

```text
ISSUED BY:    Program Orchestrator (October Main Lane)
EXECUTED BY:  Engineering Lead (local Claude Code, Clean (v11), branch October-2026)
REVIEWED BY:  Architect (config + deploy) and ETF Product Lead (holdings outcome)
APPROVED BY:  Founder, 2026-09-24 (lane opened)
PACKET:       MA-OCT-012 — Entities-seed cron hotfix
GATE:         Build + deploy approved at lane opening (deploy by Sat 26 Sep) → Close-out (after Mon 28 Sep observation)

ROLE:         Engineering Lead
LANE:         Operations (owner: Operations Lead)
BASELINE ROOT:       /Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)
IMPLEMENTATION ROOT: .../App
BUILD INSTRUCTIONS:  .../claude
EXECUTE FROM:        App/Corporate Atlas
FILES IN SCOPE:      App/Corporate Atlas/wrangler-entities-seed.toml (cron line + its comment only),
                     CLAUDE.md (Environment Truth: cron-numbering bullet + LOCAL_MASTER branch line only),
                     claude/October_Decisions_Log.md, claude/Meridian_October_Operating_Kit_v3_Addendum.md,
                     claude/MA-OCT-012_Build_Brief.md (commit only — Main Lane edits, Addendum rule 7),
                     claude/MA-OCT-012_Closeout_Summary.md (new)
```

## Revision note (rev 2, 2026-09-24)
Precondition 2 is now met: `October-2026` = `f650c03`. This revision widens the CLAUDE.md scope to fix the stale LOCAL_MASTER branch line. It adds the Main Lane's governance-doc edits to the commit, per Addendum rule 7, and adds a lock check to preflight, per Addendum rule 6.

## Why
MA-OCT-000 findings F2 and F3, confirmed by the Architect review as N2. `crons = ["0 4 * * 1"]` was meant to mean Monday. Cloudflare numbers day-of-week 1–7 with **1 = Sunday**, so the seed has fired **in the same second as `meridian-holdings`** every Sunday since at least 30 Aug. The two jobs share the account-wide write budget. On 20 Sep, `writes_today` was already at 83,638 at 04:00:15, and holdings stopped `partial` (`31/237`). This is the most likely root cause of **Known Issue 22.1**. The next co-fire is **Sun 27 Sep 04:00Z**.

## Session preconditions (hard gate)
1. Working directory is inside `Clean (v11)`.
2. `git branch --show-current` returns **`October-2026`**, meaning the MA-OCT-000 commit handoff is done. If the branch is `September-2026`, STOP; commits there are prohibited.
3. `hold_all_jobs` is `false` (read-only check).
4. `ls .git/*.lock` returns nothing. **One `index.lock` from the Main Lane (24 Sep, about 07:00 BST) is expected.** Confirm no git process is running (`pgrep -fl git`), remove it, and record the removal. Report any other lock before touching it (Addendum rule 6).

## Approved scope
1. **Diagnostic (report before editing):**
   - Confirm `src/entities-seed.js` has no day-of-week logic. A pre-read by the Main Lane found none: no `getUTCDay` or `scheduledTime` checks.
   - Confirm the seed's guard reads **and** increments `writes_today_<date>` (lines ~159–191). Moving to Monday therefore creates its own Monday counter, and the guard still works.
   - Confirm `wrangler-holdings.toml` stays `0 4 * * sun` (not touched).
2. **Change one line**, plus correct its comment in the same toml. Use the named-day form; no numeric day-of-week:
   ```toml
   crons = ["0 4 * * mon"]
   ```
   Update the comment to say: Monday 04:00 UTC; named day used because Cloudflare numbers day-of-week 1 = Sunday (see MA-OCT-000 F2); was `0 4 * * 1`, which fired on Sundays and co-fired with holdings.
3. **Deploy** from `App/Corporate Atlas`: `wrangler deploy -c wrangler-entities-seed.toml`. Capture the deploy output, including the printed schedule line, which must show `0 4 * * mon`, and the version ID.
4. **CLAUDE.md:** in the cron-numbering Environment Truth bullet, add that `meridian-entities-seed` is now `0 4 * * mon`, deployed with version ID and date. In the LOCAL_MASTER branch line, change `September-2026` to **`October-2026`**, and record that `September-2026` is frozen as the September release and live Pages source until the October go-live.
5. **Commit and push to `October-2026`:** the toml, CLAUDE.md, `claude/October_Decisions_Log.md`, `claude/Meridian_October_Operating_Kit_v3_Addendum.md` and `claude/MA-OCT-012_Build_Brief.md`, staged by explicit path. Message: `MA-OCT-012: entities-seed cron 0 4 * * 1 -> 0 4 * * mon (stop Sunday co-fire with holdings; F2/KI 22.1)`.
6. **Observe:**
   - **Sun 27 Sep:** `meridian-holdings` fires at 04:00Z and `meridian-entities-seed` does **not**. Holdings `last_run_status` should not be `partial` because of budget. Record `writes_today_2026-09-27`.
   - **Mon 28 Sep:** `meridian-entities-seed` fires at 04:00Z. Record its invocation (`meridian-ops` `/api/ops/cf/invocations`) and `writes_today_2026-09-28`.
7. Write `claude/MA-OCT-012_Closeout_Summary.md` with the evidence, then report to the Main Lane.

## Three-point check (recorded; this is a slot change, not a new cron)
- **Cron count:** unchanged at 5/5.
- **Index audit:** not applicable. No query changes.
- **Read and write budget:** unchanged per invocation (the seed's existing ~30k-row weekly pass after the MA-SEP-017 fix, 65,000-headroom pre-flight guard). The only effect is that seed and holdings move onto separate UTC days.
- **Known overlap (accepted):** a Monday seed run can still overlap `entities-enrich` at 06:00 and 06:50. Enrich's writes are small (~44 entities per run), so this overlap is accepted.

## Do not do
- Don't change `entities-seed.js` code, the holdings or bootstrap crons, or any guard.
- Don't touch F5, F6, F7 or F9 (those are in MA-OCT-002 scope).
- Don't run `/run` manually. The observation must be the real cron fire.
- Don't commit to `September-2026`, and don't run `generate-docs.mjs`.

## Acceptance criteria
1. The deploy output shows the schedule as `0 4 * * mon`, and the version ID is recorded.
2. On Sun 27 Sep there was no seed invocation, and holdings did not end `partial` because of budget. If holdings ends partial for another reason, record it; that doesn't fail this packet.
3. On Mon 28 Sep the seed fired once from cron at about 04:00Z.
4. The commit is on `October-2026` and pushed. `origin/September-2026` is unchanged at `420487d`.
5. Known Issue 22.1 is marked **resolved-pending-review** in the close-out, with the evidence.

## Rollback
Revert the toml line to `0 4 * * 1` and run `wrangler deploy -c wrangler-entities-seed.toml` (that restores the Sunday behaviour), or `git revert` the commit and redeploy. No data changes to undo.

## Handoff back
Two report-backs to the Main Lane:
1. **After deploy (by Sat 26 Sep):** a deploy confirmation for the record, with the diff, deploy output and version ID. The Founder's lane approval already covers the deploy, because of the Sunday deadline.
2. **After Mon 28 Sep:** the close-out. The Architect and ETF Product Lead then give their verdicts.
