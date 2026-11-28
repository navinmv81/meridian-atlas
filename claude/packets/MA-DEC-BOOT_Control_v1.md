# MA-DEC-BOOT — December bootstrap: `December-2026` branch, December records, factory month prefix — Control v1

```text
ISSUED BY:    Program Orchestrator (December Main Lane), 2026-11-28
EXECUTED BY:  Engineering Lead — LANE-DEC-ENG (new local Claude Code session)
REVIEWED BY:  Main Lane verification from git and disk, factory tests re-run by the Main Lane; the factory diff gets an independent light delta review before the first December packet that writes product code
APPROVED BY:  Founder — DML-1128-2 (scope, branch); Start Approval in MA-DEC-BOOT_Status.json required before execution
PACKET:       MA-DEC-BOOT · Control v1 · usage class light · write owner Engineering Lead (LANE-DEC-ENG)
```

## Session opener
- Folder: `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`.
- Branch at start: `November-2026` @ `9cb8dc7d1fb7eb252b860d3c7e271eeb3fa8520d` (= origin).
- Role: Engineering Lead. Execute from `claude/packets/MA-DEC-BOOT_Task_v1.md`.
- This packet is **not** run through `dispatch.mjs begin/end` (the dispatcher cannot see `MA-DEC-*` packets until this packet lands). Do not run `dispatch.mjs` or `project.mjs` at all.
- Before work: `ls .git/*.lock` (must be empty); SHA-256 this Control and the Task and compare with `MA-DEC-BOOT_Status.json` (`control.sha256`, `task.sha256`, and `start_approval`). Any mismatch or no approval → stop.

## Objective
Create `December-2026` from `9cb8dc7` and switch to it; make the delivery factory recognise December packets (`MA-DEC-*`) exactly as it recognises `MA-NOV-*`; record the December branch in `CLAUDE.md`; commit the December records and those changes in one commit on `December-2026`; push with upstream. `November-2026`, GitHub Pages, `docs/`, `App/`, Workers and D1 stay untouched.

## Allowed actions
- Read-only git (`--no-optional-locks status|diff|log|show|ls-remote|rev-parse`), `shasum -a 256`, `grep`.
- `git switch -c December-2026` (from `9cb8dc7`; no tracked file changes).
- Edits within `tools/factory/` only as the Task §3 states (month-prefix list), plus new/updated tests in `tools/factory/test/` and one paragraph in `tools/factory/README.md`.
- `node --test tools/factory/test` (temp repos only, as today).
- Three line edits in `CLAUDE.md` (Task §4).
- Secret scan of the commit list (patterns in the Task); counts only, never print matches.
- `git add -- <explicit path>` one path per argument; one `git commit` with the Task's message; `git push -u origin December-2026`.
- Write `claude/packets/MA-DEC-BOOT_Report.md`.

## Prohibited actions
- `git add -A|.|<dir>`, `commit -a`, globs; `clean`, `reset`, `stash`, `restore`, `checkout -- <path>`, `rm`, `mv`, `rebase`, `pull`, `merge`, `cherry-pick`, `--force*`, `--amend`, tags, deleting branches or lock files.
- Any commit or push to `November-2026` or any other branch.
- Committing anything outside the commit list, including `13F Seed/gleif-seed.js`, `.claude/settings.local.json`, `.docs-dry-run/`, `Claude outputs/`, `claude/factory/backup/`, `claude/factory/runs/`, the root-level reference copies (`meridian_atlas_december_run_spec.md`, `claude_project_agentic_delivery_spec.md`, `meridian_atlas_agentic_delivery_factory_operating_kit.md`, `meridian_atlas_november_content_scope_and_requirements.md`), `MA-SEP-010_Change_Request.md`, any `*Current_State_v13*`/`~$*` file, `claude/factory/transitions.jsonl`, `MA-DEC-BOOT_Status.json`, `MA-DEC-BOOT_Report.md`.
- Editing any Status file, `STATUS_BOARD.md`, `control-tower.html`, `config.json`, either LANE_OPENER, Main Lane records, `App/`, `docs/`, `generate-docs.mjs`, `13F Seed/`.
- Any `wrangler` command, D1 query, Cloudflare API call, secret or `.env*` read, scheduler/LaunchAgent change, GitHub Pages setting, install, subagent.
- Any command that raises a macOS password, permission or TCC prompt: stop and tell the Founder.

## Stop gates
Precondition failure; hash mismatch; any factory test failing (existing 40 or new); secret-scan count ≠ 0; staged list ≠ commit list; push rejected (not resolved by pull/rebase here). After Task step 8 → stop for Main Lane verification.

## Success conditions
1. One commit on `December-2026`, parent `9cb8dc7`, `git show --name-only` = commit list.
2. `origin/December-2026` = local HEAD = that commit; `origin/November-2026` still `9cb8dc7`.
3. `node --test tools/factory/test`: all pass, including new tests proving (a) an `MA-DEC-*` READY packet with a valid Founder approval is eligible for `check`/`begin`, (b) the dispatcher field-ownership guard applies to `MA-DEC-*`, (c) `project.mjs` lists both months, (d) `MA-NOV-*` behaviour unchanged.
4. Local branch `December-2026`; Pages, `docs/`, `App/`, Workers, D1 untouched.

## Report-back
`claude/packets/MA-DEC-BOOT_Report.md`: commit SHA, `git show --stat`, staged list, per-file SHA-256 (pinned vs observed for pinned files), factory diff summary, test output summary (counts), secret-scan count, push output, `ls-remote` for both branches, final `git status --porcelain`, non-actions, deviations. Report and Status ride with the next authorised commit.
