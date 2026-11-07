# MA-NOV-P1.FIX2 — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-07
EXECUTED BY:  Engineering Lead — interactive, LANE_OPENER_v2.md
REVIEWED BY:  Architect — MA-NOV-P1.REVIEW2
APPROVED BY:  Founder — Start Approval in MA-NOV-P1.FIX2_Status.json
CONTROL:      claude/packets/MA-NOV-P1.FIX2_Control_v1.md
```

Read the review report first. Finding ids below refer to it.

## Code (`tools/factory/`)
1. **F1 commits:** `begin` records `head: git rev-parse HEAD` in `before.json`. `end`: if HEAD moved, add `git diff --name-only <before.head>..HEAD` to the checked paths (same allowed/ignored rules); BLOCK "commits not allowed for this packet" if HEAD moved and `run_profile.allow_commits !== true`; BLOCK "HEAD is not a descendant of the start commit" if `git merge-base --is-ancestor` fails. Same in headless `run`.
2. **F2 global lock:** `begin` and `run` take `claude/factory/leases/.global.lock` with O_EXCL before the per-packet lease; released (renamed into the run folder) at `end`, at run completion and in stale-lease handling. The existing directory read stays as a second check.
3. **F3 option (b) — Tower honesty, no scheduler:** replace the age-only OFFLINE rule with: **LIVE** (snapshot younger than 2 × `refresh_s`); **SNAPSHOT** (older, no live lease) — show "Idle — snapshot from <time> (<n> min ago); regenerated on every begin/end and Main Lane update", not OFFLINE; **RUNNING (snapshot)** (older, live lease not expired) — show the run with "snapshot <n> min old"; **STALE RUN** (a lease past its expiry) — red. Remove "OFFLINE" for idle. Keep the logic in `tower-logic.mjs` and test each state.
4. **F4 fixed line:** `config.json` may name `opener` (default `claude/packets/LANE_OPENER_v2.md` when absent); `project.mjs` shows that file and its computed SHA-256. Do not edit the real `config.json` (prohibited) — the default must produce the v2 line.
5. **F5 + F9 session ids:** `begin` records `session_id` from `CLAUDE_CODE_SESSION_ID` (null if absent) in the lease, `run` and `before.json`. `end` records `ended_by_session`; if both ids exist and differ → refuse (exit 2, nothing written) with "this run was begun by another session".
6. **F6 own Status:** in interactive mode, any change to the running packet's own `_Status.json` between `begin` and `end` (other than the dispatcher's own writes) → BLOCKED "own Status changed during run (rev x→y)". Rev bumps on other packets are listed in `run.json` → `other_status_changes`.
7. **F7 temp files:** the ignore rule accepts only temp files whose base name is an existing `*_Status.json`, `STATUS_BOARD.md` or `control-tower.html`; ignored paths are listed in `run.json` → `ignored_temp_files`.
8. **F10 history:** every successful `writeStatus` appends `{at, id, writer, from, to, rev}` to `claude/factory/transitions.jsonl` (append-only; created if missing). That file is ignored by the scope check like `PAUSE.json`.
9. **Tests:** keep all 22; add 23 committed out-of-scope file → BLOCKED; 24 allowed commit with `allow_commits` → REVIEW_NEEDED; 25 commit without `allow_commits` → BLOCKED; 26 concurrent `begin` of two packets (15 trials) → exactly one succeeds each time; 27 Tower fixed line = v2 file hash; 28 session id recorded, `end` from another session refused; 29 own-Status edit → BLOCKED; 30 temp-file rule (accepted vs rejected names); 31 `transitions.jsonl` rows; 32 Tower states LIVE / SNAPSHOT / RUNNING (snapshot) / STALE RUN. Fix test numbering (no gaps) or document the gap.

## Draft (`claude/governance/Claude_md_v1.2_amendments.md`)
10. **D1:** replace the §4 state table with the transitions in `tools/factory/lib/state.mjs` exactly, and state "`dispatcher-hold` writes only `hold`; the dispatcher sets BLOCKED first".
11. **D2:** the Main Lane copies the review verdict into `review{}` (the dispatcher does not).
12. **D3:** CLAUDE.md patch line for DEPLOY_BRANCH: "`October-2026` `/docs` is the live Pages source (since 2026-10-31)". **D4:** replace the "VERIFIED 2026-11-07 (MA-NOV-P1.DEMO)" claim with `VERIFIED <date> (<packet that applies the patch>)`. **D5:** reviews hold the execution slot (current behaviour). **D6:** remove the §3.1/§3.2 conflict; say refused writes throw and are not logged, while successful writes are logged to `transitions.jsonl`.
13. Add a short "Revision 2" note at the top listing D1–D6. Keep `STATUS: DRAFT`.

## Commit (explicit paths) and report
14. Stage each changed/added file under `tools/factory/`, the draft, and these pinned Main Lane files:

| Path | SHA-256 |
|---|---|
| `claude/packets/LANE_OPENER_v2.md` | `67913343f1233fa61780d33375ab4e79db742bdf59692d227eebe445cd8671d6` |
| `claude/packets/MA-NOV-P1.DEMO_Control_v2.md` | `5a9934fdebf50f33e034b900060bcc406a627fdb615577a54785f483a814b3b4` |
| `claude/packets/MA-NOV-P1.DEMO_Task_v2.md` | `91bdfcb4252015f566edbef0a19a3e92bdd501ee887bd662aec119acbf92ce7c` |
| `claude/packets/MA-NOV-P1.DEMO_Report.md` | `e77486ebf307cf571b833481d275028e59404ff7858c74ee299780b834c25ff7` |
| `claude/packets/MA-NOV-P1.FIX_Report.md` | `a7e23d72084a014fa30e4d22a05a374fffeef71ea28e5505cac594ebd2e9fd97` |
| `claude/packets/MA-NOV-P1.REVIEW_Control_v1.md` | `74ea6be9bad1237b54431041b3477107fa649e2bb23f52fc5466c8bac4d79498` |
| `claude/packets/MA-NOV-P1.REVIEW_Task_v1.md` | `ec20fc25818ba0a39e3182718feafd0b0f6d8a3e5e1bae172a7cdcf0a3ef6ae0` |
| `claude/packets/MA-NOV-P1.REVIEW_Report.md` | `7677ad1d033fd3e2b59a29745c16e166c72c2b4dded5d98e417784ac1b26cb99` |
| `claude/packets/MA-NOV-P1.FIX2_Control_v1.md` | `a261f67e6ec856cbcb861346ed4437c2f070b37f659e3a36d7965e2cd81d5d5c` |
| `claude/packets/MA-NOV-P1.FIX2_Task_v1.md` | this file — verified against `MA-NOV-P1.FIX2_Status.json` |

Message `MA-NOV-P1.FIX2: review must-fix (commit-aware scope check, global lock, Tower states, session ids, own-Status guard, transitions log); v1.2 draft rev 2` + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never stage: `*_Status.json`, `config.json`, `STATUS_BOARD.md`, `control-tower.html`, `transitions.jsonl`, `claude/factory/runs/`, `claude/factory/backup/`, `claude/November_Decisions_Log.md`, `.claude/`, root-level November duplicates, other untracked files. Push `November-2026`.
15. Report `claude/packets/MA-NOV-P1.FIX2_Report.md`: per finding — change, file:line, test id; suite result; commit SHA + `ls-remote`; non-actions. Then `end`.
