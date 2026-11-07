# MA-NOV-000 — Delivery-factory feasibility assessment — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-06
EXECUTED BY:  Engineering Lead — LANE-NOV-ENG (local Claude Code; a fresh session is preferred)
REVIEWED BY:  Architect — fresh, separate read-only session, on demand after the report (Main Lane routes it)
APPROVED BY:  Founder — NML-1106-4 item 4 (scope); Start Approval required; architecture approval after the report
PACKET:       MA-NOV-000 · Control v1 · usage class medium (read-only, repository and local tooling only) · write owner Engineering Lead (LANE-NOV-ENG), one file
```

## Session opener
- Folder: `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`
- Branch: **`November-2026` @ `a01ffe2`** (= origin). This overrides the stale "LOCAL_MASTER's own git branch: `October-2026`" line in `CLAUDE.md`; that line is corrected later in the Claude.md v1.2 package, not here.
- Role: Engineering Lead. Execute from `claude/packets/MA-NOV-000_Task_v1.md`.
- Before work: `ls .git/*.lock` (must be empty); SHA-256 this Control and the Task and compare with `claude/packets/MA-NOV-000_Status.json`. Mismatch → stop.
- Read the three November references in `claude/` (`claude_project_agentic_delivery_spec.md`, `meridian_atlas_agentic_delivery_factory_operating_kit.md`, `meridian_atlas_november_content_scope_and_requirements.md`), `Claude.md`-equivalent rules as recorded in `Meridian_Atlas_Current_State_v14.docx` §5.4, and the repo `CLAUDE.md`. Do not read all historical reports; sample packet files only as the Task says.

## Objective
Recommend, from evidence on this machine and in this repository, the actual mechanisms for the November delivery factory: worker launch, independent review launch, Control Tower dashboard and Founder actions, and state writes — each handoff labelled **automatic**, **assisted** or **manual** — plus one low-risk pilot. Then stop for the Founder's architecture approval.

## Allowed actions
- Read files in the repository; `git --no-optional-locks` reads; `shasum`, `grep`, `find`, `wc`, `jq`/`python3` for read-only parsing.
- Read-only tool discovery: `which`, `--version`, `--help` / `help` output of `claude`, `node`, `npm`, `python3`, `git`, `launchctl` (`launchctl print`/`list` only, filtered to `meridian` labels); listing (not reading) `~/Library/LaunchAgents/` file names.
- Reading the Claude Code **settings** files `.claude/settings.local.json` and `.claude/launch.json` in the repository to describe permission/launch configuration — report structure and keys; never print a value that looks like a token, key or URL with credentials.
- Write `claude/packets/MA-NOV-000_Report.md` (the only file this lane writes).

## Prohibited actions
- Any D1 query, `wrangler` command, Cloudflare/GitHub API call, `curl`/`fetch` to any Meridian Worker or production URL.
- Reading any secret or credential: `.env*` files, `~/.meridian-secrets/`, `~/.claude/` credential or auth files, keychain, `gh auth token`, environment variables holding tokens.
- Launching any model session or agent (`claude -p`, SDK scripts, subagents, `/` skills that call models). Feasibility is shown from help text and documentation, and labelled *unproven until pilot*.
- Installing anything (`npm install`, `pip`, `brew`), starting any server or listener, opening ports, creating LaunchAgents, `launchctl load/bootstrap/kickstart/unload`, editing crontab.
- Any git write; editing any file other than the report, including `STATUS_BOARD.md`, Status files, `CLAUDE.md`, `Claude.md`, Project files and October records.
- Changing the model or any Claude Code setting. Any command that raises a macOS password, permission or TCC prompt (ML-1013-3): stop and tell the Founder.

## Stop gates
- Hash mismatch, a lock file, or any step needing a prohibited action to answer → record the question as *open — needs pilot/permission* and continue; stop only if nothing further can be answered.
- After the report → stop. The Main Lane verifies, routes the Architect review if the Founder wants it, and prepares the architecture Decision Request.

## Success conditions
The report answers every Task question with evidence (command + result summary, file path + line) or marks it *unknown* with what would settle it; contains the handoff table; proposes one pilot within NML-1106-4's limits; lists Founder decisions; and records non-actions.
