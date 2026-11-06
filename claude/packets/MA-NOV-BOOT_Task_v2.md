# MA-NOV-BOOT — Task v2 (supersedes Task v1 `7c715eb7…2573`)

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-06T20:30Z
EXECUTED BY:  Engineering Lead — LANE-NOV-ENG (local Claude Code)
REVIEWED BY:  Program Orchestrator verification from git and disk
APPROVED BY:  Founder — NML-1106-4; Start Approval required
CONTROL:      claude/packets/MA-NOV-BOOT_Control_v2.md  sha256 b6fd8d27fd54ba7ffe7f0d193f54fe2ba9d6284b7a969ef1ad4f7e0f6350c146
```

The Control's allowed/prohibited actions and stop gates apply to every step. This Task's own SHA-256 is recorded in `claude/packets/MA-NOV-BOOT_Status.json`; verify it before step 1.

**Path note:** the three November reference documents are committed from `claude/`. Byte-identical copies also sit at the repository root (the Founder's first placement); they are **excluded and never staged**, and this lane does not delete them.

## §1 Expected `git status --porcelain` before step 1 (exact set)

```
 M claude/October_Decisions_Log.md
 M claude/packets/MA-OCT-013.ETFCHK_Status.json
 M claude/packets/MA-OCT-013.OPSSIGN_Status.json
 M claude/packets/MA-OCT-CLOSE.COMMIT_Status.json
 M claude/packets/MA-OCT-CLOSE.DOC_Status.json
 M claude/packets/STATUS_BOARD.md
?? .claude/settings.local.json
?? "13F Seed/gleif-seed.js"
?? "Claude outputs/"
?? MA-SEP-010_Change_Request.md
?? Meridian_Atlas_Current_State_v13.docx
?? claude/November_Decisions_Log.md
?? claude/claude_project_agentic_delivery_spec.md
?? claude/meridian_atlas_agentic_delivery_factory_operating_kit.md
?? claude/meridian_atlas_november_content_scope_and_requirements.md
?? claude/packets/MA-NOV-BOOT_Control_v1.md
?? claude/packets/MA-NOV-BOOT_Control_v2.md
?? claude/packets/MA-NOV-BOOT_Status.json
?? claude/packets/MA-NOV-BOOT_Task_v1.md
?? claude/packets/MA-NOV-BOOT_Task_v2.md
?? claude/packets/MA-OCT-CLOSE.COMMIT_Report.md
?? claude_project_agentic_delivery_spec.md
?? meridian_atlas_agentic_delivery_factory_operating_kit.md
?? meridian_atlas_november_content_scope_and_requirements.md
?? ~$ridian_Atlas_Current_State_v13.docx
```

Tolerated differences: `~$ridian_Atlas_Current_State_v13.docx` (a Word lock file) and the three root-level November copies may each be absent. Any other difference → stop.

## §2 Commit list — 15 paths, pinned SHA-256

| # | Path | SHA-256 |
|---|---|---|
| 1 | `claude/October_Decisions_Log.md` | `05717e5112c6cd9f704bf952e68bd3bfe3a9a33515c21a3f269849cc74fdf1ae` |
| 2 | `claude/packets/STATUS_BOARD.md` | `7ce53909344122009c8b1dd5cc5bf5faa701ef2e367c49dd20f5f2942fd38985` |
| 3 | `claude/packets/MA-OCT-013.ETFCHK_Status.json` | `f19dbcc3c67eabfe6cd2727c6a745fceac73a9dc73e505277a2e5aafb0784faa` |
| 4 | `claude/packets/MA-OCT-013.OPSSIGN_Status.json` | `f1eebfd92c554bd896c416f7dd6ef86e82452793d9ea167dda2b8ee1320e61d9` |
| 5 | `claude/packets/MA-OCT-CLOSE.COMMIT_Status.json` | `4aa8508d3e9891e4abd14e3744cc490f9879f58751ad56b70448847792431110` |
| 6 | `claude/packets/MA-OCT-CLOSE.DOC_Status.json` | `f5bd722bbcff3e87a13040734d347c42cadfb5d7f1aa7a62058fdde8660e2604` |
| 7 | `claude/packets/MA-OCT-CLOSE.COMMIT_Report.md` | `49f42a878d2f416f681db77c86071b8d6557737c85f881613fb54d7c95749f1c` |
| 8 | `claude/claude_project_agentic_delivery_spec.md` | `65d5af54a285df02d0297dab08e20541d20ad9d3568d9b054294d87304100971` |
| 9 | `claude/meridian_atlas_agentic_delivery_factory_operating_kit.md` | `31275d05994d84cfd7a966e85e6a806cea19c320fb248af4447cacd42e9b63ed` |
| 10 | `claude/meridian_atlas_november_content_scope_and_requirements.md` | `c16c8e195b46da83a50d41a6d22646d742a4594db66255cbec23ffd92f2e5a03` |
| 11 | `claude/November_Decisions_Log.md` | `fc6ac7ae97eb2211dac2b1a616fd33cb98f60b5a7db18c0cda69f2868c34daaa` |
| 12 | `claude/packets/MA-NOV-BOOT_Control_v1.md` (superseded record) | `719f0a4a89ab24c2b705582cb5ec225ec90173eb6bcb1733403d263cd8894206` |
| 13 | `claude/packets/MA-NOV-BOOT_Task_v1.md` (superseded record) | `7c715eb73e90d764aae0bb5da9c2c0fcd242cbfa8e9f538a6c6345b280282573` |
| 14 | `claude/packets/MA-NOV-BOOT_Control_v2.md` | `b6fd8d27fd54ba7ffe7f0d193f54fe2ba9d6284b7a969ef1ad4f7e0f6350c146` |
| 15 | `claude/packets/MA-NOV-BOOT_Task_v2.md` | this file — verified against `MA-NOV-BOOT_Status.json` |

## §3 Steps

1. **Preflight.** `pwd` = the Control's folder; `ls .git/*.lock` empty; `git --no-optional-locks branch --show-current` = `October-2026`; `git --no-optional-locks rev-parse HEAD` = `git ls-remote origin refs/heads/October-2026` = `5c3c57e4a42ea370943fc4e4788fcf339e724d95`; `git ls-remote origin refs/heads/November-2026` empty and `git --no-optional-locks branch --list November-2026` empty; `git status --porcelain` = §1.
2. **Hashes.** `shasum -a 256` each of §2 rows 1–14 and this Task; all must match.
3. **Secret scan** over the 15 files (print counts only, never matched text):
   - Scan A, must total **0** on rows 1–12 and 14, and exactly **1** on each of rows 13 and 15 (the Task files: the hit is this pattern's own definition line): `grep -cE 'CF_API_TOKEN=|CLOUDFLARE_API_TOKEN=|[Bb]earer [A-Za-z0-9_-]{20,}|-----BEGIN|[Cc]lient[-_ ][Ss]ecret["'"'"' :=]+[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_|sk-[A-Za-z0-9]{20,}'`
   - Scan B, report only: count of `grep -oE '[A-Za-z0-9_-]{40,}'` matches that are not pure lowercase hex. Main Lane baseline on rows 1–11: **9** (all file or index names); rows 12–15 add file names and the scan pattern itself (record the number). Any match that is not a file, index or identifier name → stop.
4. **Stage** with one `git add -- "<path>"` per §2 row (15 commands). Then `git diff --cached --name-only` must equal the 15 paths exactly.
5. **Commit:**
   ```
   MA-NOV-BOOT: October post-close records + November reference docs (governance only)

   October close-out records (ML-1106-3/4, Status files, CLOSE.COMMIT report),
   the three 2 Nov November reference documents, the November Decisions Log
   and the MA-NOV-BOOT Control/Task (v1 superseded, v2 executed). No product code, docs/ or Worker change.

   Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
   ```
   Then `git show --name-only --format=%H HEAD` must list the 15 paths.
6. **Push** `git push origin October-2026`. Must be a fast-forward from `5c3c57e`. Rejected → stop (no pull, no rebase).
7. **Branch:** `git branch November-2026 HEAD`; `git push -u origin November-2026`.
8. **Switch:** `git switch November-2026` (no file changes expected; confirm `git status --porcelain` shows only §1's excluded paths + `MA-NOV-BOOT_Status.json`).
9. **Verify and report.** `git ls-remote origin refs/heads/October-2026 refs/heads/November-2026` both = new commit; `git --no-optional-locks rev-parse HEAD` = same; write `claude/packets/MA-NOV-BOOT_Report.md` per the Control's report-back list; stop for Main Lane verification. Do not commit the report.
