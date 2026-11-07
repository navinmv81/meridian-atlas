# MA-NOV-P1.BUILD — Delivery-factory pilot build (Tower generator, dispatcher, tests) — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-07
EXECUTED BY:  Engineering Lead — LANE-NOV-ENG (local Claude Code, started with the fixed line)
REVIEWED BY:  Architect — MA-NOV-P1.REVIEW, a separate session launched after MA-NOV-P1.DEMO
APPROVED BY:  Founder — architecture approved 7 Nov 08:49 ("approve architecture as recommended"); Start Approval required for this packet
PACKET:       MA-NOV-P1.BUILD · Control v1 · usage class heavy (local build + tests, no production) · write owner Engineering Lead (LANE-NOV-ENG)
```

## Session opener
- Folder: `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`; branch **`November-2026`** (must equal `origin/November-2026` at start). `ls .git/*.lock` must be empty.
- Specification: **`claude/packets/MA-NOV-000_Report.md`** (sha256 `8b04f45bc7be22efaf4e20e2dd4cf4a011ece7ca002fbfa2f994a942c1e34519`), as approved, with the Founder's choices 1b, 2b, 3a, 4, 5a, 5b recorded in `claude/packets/MA-NOV-000_Status.json` → `decision`. Read the report; do not re-read October history.
- Execute from `claude/packets/MA-NOV-P1.BUILD_Task_v1.md`.

## Objective
Build and test, locally and dependency-free (Node built-ins only), the pilot delivery factory: the Status-JSON state library, the Tower/board generator, and the dispatcher; archive the October board; close the settings gap; commit by explicit paths and push `November-2026`. **No model is launched in this packet** — dispatcher tests use a stub binary. The first real launch is MA-NOV-P1.DEMO, which needs its own Start Approval.

## Allowed actions
- Create files under `tools/factory/` and `claude/factory/` (paths in the Task).
- `git mv claude/packets/STATUS_BOARD.md claude/packets/STATUS_BOARD_October_2026.md` (content unchanged), then generate the new `claude/packets/STATUS_BOARD.md` with `tools/factory/project.mjs`.
- Edit `.claude/settings.local.json` **only** to remove the three entries `Bash(npx wrangler d1 execute meridian-etf --remote:*)`, `Bash(npx wrangler deploy:*)`, `Bash(npx wrangler secret put:*)`, after copying the original to `claude/factory/backup/settings.local.json.pre-P1` (never committed). Founder choice 5b.
- `node --test`, `node` runs of the new scripts against fixtures and (read-only `project.mjs`) against the real Status files.
- `git add -- <explicit path>` for the Task's commit list; one `git commit`; `git push origin November-2026` (fast-forward only).
- Write `claude/packets/MA-NOV-P1.BUILD_Report.md`.

## Prohibited actions
- Launching any model or agent (`claude -p`, `--bg`, SDK, subagents) — tests must use the stub.
- Writing any `*_Status.json`, `LANE_OPENER.md`, `November_Decisions_Log.md`, October records, `CLAUDE.md`, Project files — except that the generator writes `STATUS_BOARD.md` and `claude/factory/control-tower.html`.
- npm installs or any third-party package; listeners/ports; LaunchAgents/`launchctl` changes; crontab.
- D1, `wrangler`, Cloudflare/GitHub API, production URLs; secrets or `.env*`; `docs/`, `App/`, `13F Seed/`; GitHub Pages.
- `git add -A/.`/directories, `commit -a`, `clean`, `reset`, `stash`, `restore`, `rebase`, `pull`, `--force`, `--amend`, branch create/delete.
- Changing the model or any Claude Code setting other than the three removals above. Stop before any macOS password/permission/TCC prompt.

## Stop gates
Hash mismatch; lock file; any test failing after bounded fixes within scope; the generated board losing a November packet or changing a Control hash; push rejected; anything needing a prohibited action → stop and report.

## Success conditions
1. All Task tests pass (`node --test tools/factory/test`), including the nine pilot tests.
2. `node tools/factory/project.mjs` regenerates the November board and `control-tower.html` from the real Status files with no model call, and a second run is byte-identical (idempotent) apart from `generated_at`.
3. `node tools/factory/dispatch.mjs check` on the real files reports eligibility correctly (expected: no eligible packet once this packet's own report exists).
4. `.claude/settings.local.json` no longer contains the three entries; backup exists.
5. One commit with exactly the Task's commit list; `origin/November-2026` = local HEAD.
