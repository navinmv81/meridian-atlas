# MA-NOV-BOOT — November bootstrap: governance commit + `November-2026` branch — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-06
EXECUTED BY:  Engineering Lead — LANE-NOV-ENG (new local Claude Code session)
REVIEWED BY:  Program Orchestrator verification from git and disk (governance-only commit; no product review)
APPROVED BY:  Founder — kickoff decision NML-1106-4 (scope); Start Approval required before execution
PACKET:       MA-NOV-BOOT · Control v1 · usage class light · write owner Engineering Lead (LANE-NOV-ENG)
```

## Session opener
- Folder: `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`
- Branch at start: `October-2026` @ `5c3c57e` (= `origin/October-2026`, checked by `git ls-remote` 6 Nov 20:00Z)
- Role: Engineering Lead. Execute from `claude/packets/MA-NOV-BOOT_Task_v1.md`.
- Before work: `ls .git/*.lock` (must be empty); SHA-256 this Control and the Task and compare with the status board / `MA-NOV-BOOT_Status.json`. Any mismatch → stop.

## Objective
Commit the October post-close governance records and the November reference documents to `October-2026` in one governance-only commit, push it, create `November-2026` from that commit, push it, and switch the local checkout to `November-2026`. Nothing else.

## Preconditions (all must hold; otherwise stop and report)
1. `git status --porcelain` equals the expected set in the Task (§1) exactly — no more, no fewer paths.
2. Every file in the commit list has the SHA-256 pinned in the Task (§2).
3. Local `October-2026` HEAD = `git ls-remote origin refs/heads/October-2026` = `5c3c57e4a42ea370943fc4e4788fcf339e724d95`.
4. `November-2026` does not exist locally or on origin.

## Allowed actions
- Read-only inspection (`git --no-optional-locks status|diff|log|ls-remote`, `shasum -a 256`, `grep`).
- A secret scan of the exact files in the commit list (pattern list in the Task); scan results are counted, never printed.
- `git add -- <explicit path>` for each path in the commit list, one path per argument.
- `git commit` with the message in the Task (no `-a`, no `--amend`).
- `git push origin October-2026` (fast-forward only).
- `git branch November-2026 <new commit>`; `git push -u origin November-2026`.
- `git switch November-2026` (both branches point at the same commit, so no tracked file changes).
- Write `claude/packets/MA-NOV-BOOT_Report.md` (the only file this lane writes).

## Prohibited actions
- `git add -A`, `git add .`, `git add <directory>`, `git commit -a`, wildcards or pathspec globs.
- `git clean`, `reset`, `stash`, `restore`, `checkout -- <path>`, `rm`, `mv`, `rebase`, `pull`, `merge`, `cherry-pick`, `--force`/`--force-with-lease`, `--amend`, tag changes, deleting any branch or lock file.
- Committing anything not in the commit list, including: `13F Seed/gleif-seed.js`, `.claude/settings.local.json`, `Claude outputs/`, `MA-SEP-010_Change_Request.md`, `Meridian_Atlas_Current_State_v13.docx`, `~$ridian_Atlas_Current_State_v13.docx`, any A2/011 patch, `MA-NOV-BOOT_Status.json`, `MA-NOV-BOOT_Report.md`.
- Editing any file other than the report. No `generate-docs.mjs`, no `docs/` change, no product code.
- Any `wrangler` command, D1 query, Cloudflare API call, secret read, scheduler/LaunchAgent change, GitHub Pages setting change.
- Any command that raises a macOS password, permission or TCC prompt (ML-1013-3): stop and tell the Founder.

## Stop gates
- Any precondition failure, hash mismatch, non-zero secret-scan count, staged-list mismatch, or push rejection → stop, write the report, change nothing further. A rejected push is **not** resolved by pull/rebase in this packet.
- After step 9 of the Task → stop for Main Lane verification.

## Success conditions
1. One new commit on `October-2026` whose `git show --name-only` equals the commit list exactly.
2. `origin/October-2026` = `origin/November-2026` = local HEAD = that commit (`ls-remote`).
3. Local branch is `November-2026`; `git status --porcelain` shows only the excluded paths plus `MA-NOV-BOOT_Status.json` and the report.
4. GitHub Pages, `docs/`, Workers and D1 untouched.

## Report-back
`claude/packets/MA-NOV-BOOT_Report.md`: commit SHA, `git show --stat`, staged list, per-file SHA-256 table (pinned vs observed), secret-scan count, push outputs, `ls-remote` lines, final `git status --porcelain`, non-actions, deviations. The report and the Status update ride with the next authorised commit (rule 7).
