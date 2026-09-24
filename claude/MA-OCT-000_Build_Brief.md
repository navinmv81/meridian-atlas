# Build Brief: MA-OCT-000, Runtime Truth Baseline

```text
ISSUED BY:    Program Orchestrator (Control)
EXECUTED BY:  Operations Lead (local Claude Code session on the Founder's Mac)
REVIEWED BY:  Architect
APPROVED BY:  Founder
PACKET:       MA-OCT-000 — Runtime truth baseline
GATE:         Build approval (issued) → Close-out approval (target ~29 Sep 2026)

ROLE:         Operations Lead
LANE:         Control / Operations
BASELINE ROOT:       /Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)
IMPLEMENTATION ROOT: /Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)/App
BUILD INSTRUCTIONS:  /Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)/claude
EXECUTE FROM:        BASELINE ROOT
FILES IN SCOPE:      claude/MA-OCT-000_* (new), CLAUDE.md (two sections),
                     claude/meridian-october-operating-kit-v2.md,
                     claude/meridian-october-revised-scope-v2.md,
                     claude/MA-OCT-004-Bond-Spec.md (copy-in only, Part 0)
```

Governing documents: `claude/meridian-october-operating-kit-v2.md`, `claude/Meridian_October_Operating_Kit_v3_Addendum.md` and `claude/meridian-october-revised-scope-v2.md`.

## Revision note (2026-09-23, rev 2)
Rev 1 was issued to the Project only and never reached disk. A first local attempt correctly **stopped** (Kit v2 §Path precedence item 4) for these reasons:
- The brief and addendum were missing from `claude/`.
- Kit v2 existed only in `~/Downloads`.
- The session was started in `June Refresh/Corporate Atlas` on `corporate-atlas-v4-deploy-clean`, a path Kit v2 says is invalid.
- The owner role (Program Orchestrator) and executing role (Operations Lead) looked like they conflicted.

Rev 2 resolves all of these:
- This brief and the addendum are now in `Clean (v11)/claude/`, written by the Program Orchestrator.
- **Part 0** brings the Kit v2 and Scope docs into the baseline.
- The session **must** start from the baseline root.
- The role question is answered in Addendum §2 ("How this reads against Kit v2's register"): the Program Orchestrator owns, the Operations Lead executes.

## Ticket
- **ID:** MA-OCT-000
- **Title:** Runtime truth baseline, including the authoritative file inventory, job inventory and GLEIF job-state snapshot
- **Stage:** ENG_IMPLEMENT (read-only discovery. The only writes allowed are documentation.)
- **Why:** Every later October packet depends on this. MA-OCT-002 fills `ops_job_registry` from the manifest produced here. MA-OCT-006 starts from the GLEIF snapshot produced here.

## Session preconditions (hard gate: stop if any fails)
1. The session is started with `Meridian Atlas Clean (v11)` as its working directory. **Not** `June Refresh/` or any other folder.
2. `git branch --show-current` returns `September-2026`.
3. This brief and `claude/Meridian_October_Operating_Kit_v3_Addendum.md` are both present.

## Approved scope

### Part 0: Bring the governing docs into the baseline
0. If they are not already in `claude/`, copy these from `~/Downloads/` with `cp -n` (never overwrite): `meridian-october-operating-kit-v2.md`, `meridian-october-revised-scope-v2.md` and `MA-OCT-004-Bond-Spec.md`. Record their checksums (`shasum`). Leave the Downloads copies where they are. The `claude/` copies are now the authoritative ones. The old August operating kits in `~/Downloads` are superseded: don't copy or use them.

### Part A: Baseline confirmation
1. `pwd`, `git status --short --branch`, `git remote -v`, `git fetch`, `git rev-parse HEAD origin/September-2026`.
2. Confirm that commits `472d7bf` (MA-SEP-017) and `821a48f` (MA-SEP-013 `/docs`) are ancestors of `HEAD` (`git merge-base --is-ancestor`).
3. Duplicate-file scan (Kit v2 rule). For each of the 11 front-end files and every `*.js` or `wrangler-*.toml` under `App/`, run `find` across the baseline root. Record every duplicate and state which copy is authoritative. `docs/` is the generated deploy mirror, not a source copy.
4. Confirm the CLAUDE.md Environment Truth items: LOCAL_MASTER path, branch, DEPLOY_BRANCH, the `App/` structure and the backend source locations. List every line that is stale.
5. **Untracked-file register.** List every untracked file. The ones already known are the `claude/MA-SEP-014/015a/015b` docs, `September_Sprint_Testing_Runbook.md`, `13F Seed/gleif-seed.js`, a Word lock file `~$…v13.docx`, and a root-level `MA-OCT-001_Spec.md`. Record each one. Do **not** commit, move or delete any of them in this packet. `gleif-seed.js` stays untouched under the standing rule. `MA-OCT-001_Spec.md` stays where it is: it is a draft input to MA-OCT-001 (Addendum §5).

### Part B: Confirm September carry-overs (read-only)
6. **MA-SEP-013 Steps 5–6.**
   - **Step 5 is DONE.** On 2026-09-23 the Founder confirmed he switched GitHub Pages to `September-2026` `/docs` manually, and the site is live. Follow-up commit `420487d` ("Incident fix: add .nojekyll…") is part of that go-live.
   - **Your job:** corroborate this read-only. Use `gh api repos/navinmv81/meridian-atlas/pages` if `gh` is authenticated. Otherwise fetch the live site URL and check that it serves the `docs/` build. Record the Jekyll incident, meaning what broke and what `.nojekyll` fixed, in the close-out from `git show 420487d`.
   - **Step 6:** as part of step 23, update CLAUDE.md's `DEPLOY_BRANCH` line from `corporate-atlas-v4-deploy-clean` to `September-2026` (`/docs`). Keep `corporate-atlas-v4-deploy-clean` recorded as the rollback source.
   - Do **not** change the Pages settings.
7. **MA-SEP-017 residual.** Count `entity_master` rows by `updated_at` date for 2026-09-14 and 2026-09-21 (the Monday cron dates), set against rows with `created_at` on those dates. Before running it, check that the query uses an index or stays under 50k reads.
8. **Known Issue 22.1.** Read-only. Pull the recent `/run` and cron history for `meridian-entities-seed` and `meridian-holdings` if the token allows. If it doesn't, record the gap. The Founder's dashboard check is a separate Wave 0 item (0.4).

### Part C: Runtime truth inventory (the core deliverable)
9. **Intended state from source:** every `wrangler-*.toml` and `wrangler.toml` under the baseline root, covering Worker name, main file, cron expressions (including commented-out or held ones), D1 bindings, service bindings and routes.
10. **Effective state from Cloudflare:** the list of deployed Worker scripts, and each one's cron schedules (Cloudflare API `workers/scripts` and `workers/scripts/{name}/schedules`, or the `wrangler` equivalent). Use the credential in `13F Seed/.env` without printing it. If the token lacks scope, record exactly which call failed and what scope is missing.
11. **Local schedules:** `launchctl list | grep -i meridian` and `~/Library/LaunchAgents/com.meridianatlas.*.plist`. Record label, program, interval, whether it is loaded or paused, and where its log file lives.
12. **Manual and on-request scripts:** the `scripts/` folders, `*.mjs` and `*.command` files, and `/run` endpoints. Record purpose, the tables each writes, and its kill switch if it has one.
13. **Controls:** for each job, record its kill switch or hold key and current value, its write guard and limit, any cursor or checkpoint and its current value, and its last run (from the pipeline-state tables). Use read-only queries only.
14. **Cron capacity:** count active cron triggers against the Free-plan cap of 5 per account.
15. **D1 budget snapshot:** writes and reads today, storage, and current `writes_today_*` counters.

### Part D: GLEIF job-state snapshot (input to MA-OCT-006)
16. For `entities-seed`, `entities-enrich`, `entities-delta`, `entities-figi` and any local GLEIF scripts: record the intended and effective schedule, hold state, cursor and last success.
17. Profile `entity_enrichment_queue` with **aggregate counts only**: counts by status, age bucket, retry count and failure reason. Check the index first. The full profile is MA-OCT-006's job.
18. Record the total number of `entity_master` rows, and how many have and lack an LEI. No row-level extraction.

### Part E: Outputs
19. **`claude/MA-OCT-000_Job_Manifest.md`**, a readable inventory. One row per job: job ID, Worker or script, source path (relative to the baseline root), domain (ETF / Entities / 13F / Ops / Market / Other), proposed owner role, execution mode (cron / on-request / local schedule / manual), intended schedule, effective schedule, drift flag, kill switch and its state, write-guard profile, last start, success and failure, cursor, and notes.
20. **`claude/MA-OCT-000_job_manifest.json`**, the same data in machine-readable form, to seed `ops_job_registry` in MA-OCT-002.
21. **`claude/MA-OCT-000_Closeout_Summary.md`**, containing the findings, drift list, orphans (deployed with no source, or source that was never deployed), gaps (for example token scope), the Part B carry-over results and the Part A untracked-file register.
22. **`claude/MA-OCT-000_Change_Request_October_Branch.md`**, drafted with `/change-request`. It proposes creating `October-2026` from `September-2026` and covers impact, risk and rollback. It is **drafted only, not executed**.
23. **CLAUDE.md update:** correct the Environment Truth lines found stale in step 4, and replace the "Current Sprint Packet" section with MA-OCT-000. This is the only file edit outside `claude/`.
24. Check that the October IDs MA-OCT-000 to 011 don't collide with the live `sprintboarditems` table (read-only). Report the result. Don't write to the board.

## Architecture constraints
- **Read-only against D1 and Cloudflare.** No `INSERT`, `UPDATE`, `DELETE` or DDL. No `wrangler deploy`. No trigger or cron changes.
- Run `EXPLAIN QUERY PLAN` on every D1 query before running it. A `SCAN` on a large table (`fund_holdings_monthly`, `entity_master`, `instrument_entity_map`, `financialfact_reported`) means stop and rewrite the query or use a count from metadata.
- Budget: the whole packet stays under **250k D1 reads**. Record the read count per query in the close-out.
- Secrets never appear in chat, logs, output files or commits.
- The SEC and GLEIF APIs are not called in this packet.

## UX constraints
- None. This packet changes no front end.

## Touched assets
- **Created:** the four `claude/MA-OCT-000_*` output files, plus the three Part 0 copies.
- **Edited:** `CLAUDE.md` (Environment Truth and Current Sprint Packet sections only).
- **Read only:** everything else under the baseline root, the Cloudflare account and D1 `meridian-etf`.

## Files out of scope
- All application code in `App/` (`*.js`, `*.toml`, `index.html`).
- `docs/`, `13F Seed/gleif-seed.js` (standing rule: leave it untouched), any `.env` file (read the credential only, never edit it) and every file in the Part A untracked-file register.

## Dependencies
- None upstream. Local Claude Code on the Mac is required, because Cowork cannot reach the Cloudflare API.

## Do not do
- Don't fix any drift, orphan, broken job or stale hold you find. **Record it only.** Fixes are for their own packets.
- Don't create the `October-2026` branch. Draft the Change Request only.
- Don't change GitHub Pages settings.
- Don't create folders outside `claude/`.
- Don't run anything from `June Refresh/` or on `corporate-atlas-v4-deploy-clean`.
- Don't commit anything without first showing the diff. Commit to `September-2026` only, and only these files: this brief, the addendum, the three Part 0 docs, the four `claude/MA-OCT-000_*` outputs and `CLAUDE.md`. Stage them by explicit path. Never use `git add -A` or `git add .`.

## Acceptance criteria
1. Part 0 is done, and the checksums are recorded.
2. Every `wrangler*.toml` in the baseline is matched to a deployed Worker, or flagged "not deployed".
3. Every deployed Worker is matched to a source file, or flagged "orphan".
4. Every job has an intended schedule, an effective schedule, a drift flag, an execution mode, a domain and a proposed owner role.
5. Every LaunchAgent and every manual or on-request writer is listed, along with the tables it writes.
6. The cron count is reported against the 5-per-account cap.
7. The GLEIF snapshot (Part D) is complete, or its gaps are named.
8. The Part B carry-over results are recorded as confirmed, not confirmed, or needs the Founder.
9. The duplicate-file register and the untracked-file register are recorded.
10. CLAUDE.md is updated, and the diff is shown.
11. The branch Change Request is drafted.
12. Total D1 reads are reported and under 250k. There are zero D1 writes.

## Test commands (minimum)
```bash
cd "/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)"
pwd && git branch --show-current && git status --short --branch && git remote -v
ls claude/MA-OCT-000_Build_Brief.md claude/Meridian_October_Operating_Kit_v3_Addendum.md
git fetch && git rev-parse HEAD origin/September-2026
git merge-base --is-ancestor 472d7bf HEAD && echo OK-017
git merge-base --is-ancestor 821a48f HEAD && echo OK-013
find . -name "wrangler*.toml" -not -path "*/node_modules/*" -not -path "./.git/*"
launchctl list | grep -i meridian
ls ~/Library/LaunchAgents | grep -i meridian
```
Any D1 query must be run as `EXPLAIN QUERY PLAN` first, then as the query itself via `wrangler d1 execute meridian-etf --remote`.

## Rollback method
- Documentation only. Revert the commit (`git revert <sha>`) to restore the previous CLAUDE.md and remove the added `claude/` files. No runtime state changes.

## Required evidence (in the close-out summary)
- Command outputs for Part A (hashes, and branch and remote lines).
- A table of each D1 query with its plan and read count.
- Cloudflare inventory output, redacted of account IDs where appropriate.
- The CLAUDE.md diff.
- The commit SHA and confirmation that `HEAD` equals `origin/September-2026` after the push.
- Final status: complete, partial, blocked or rolled back.

## Handoff back
Send the close-out to the **Architect** for review using the reviewer block in Addendum §3. Once the verdict is `PASS` or `PASS WITH NOTES`, the Program Orchestrator reconciles it into the Sprint Board mirror and Release Ledger and asks the Founder for close-out approval.
