# MA-DEC-FACTORY.LABEL — Task v1

```text
ISSUED BY:    Program Orchestrator (December Main Lane), 2026-11-28
EXECUTED BY:  Engineering Lead — LANE-DEC-ENG, fixed line LANE_OPENER_v3.md
APPROVED BY:  Founder — Start Approval in claude/packets/MA-DEC-FACTORY.LABEL_Status.json
CONTROL:      claude/packets/MA-DEC-FACTORY.LABEL_Control_v1.md
```

## Pins (commit as-is; any mismatch → stop)
| File | sha256 |
|---|---|
| `claude/December_Decisions_Log.md` | `c96429f5c2bea0aea7c3645deb901fd048bb3ccd0640ffa1ccbdb8b4a7d51e03` |
| `claude/packets/MA-DEC-BOOT_Status.json` | `9559ca9401ba0c09c30e32b80b7b2f3232676530d3cf02a051c11e8d72dbb06c` |
| `claude/packets/MA-DEC-BOOT_Report.md` | `b73d04ca39ed871c18a3f2a1f100d069f099c13b1ff977ce4fb1e32e12a43449` |
| `claude/packets/LANE_OPENER_v3.md` | `7aeefea2132c7b619099c9558e67aa2a4d12baf501f3adccd8003a02cb9d6f8f` |
| `claude/factory/config.json` | `dbf5664d186c21997c513c7e4b805987da20769dfa8f43312bdd45be87b01176` |
| `claude/packets/MA-DEC-FACTORY.LABEL_Control_v1.md` | `104e84e41b452c04bd8b3342149b367171906738e7b793c64682922f98f05d3e` |
| Archive: `STATUS_BOARD_November_2026.md` (from `710242e`) | `44404582ce6319e9f162587d882231105d747ea5b50a659596b6e659442cd7d7` |
| Archive: `control-tower_November_2026.html` (from `710242e`) | `e23f3462913d037e2021fe3b798c5793f7919f9bcc7abca70036758e96b87aac` |

## Steps
1. Preconditions: no `.git/*.lock`; branch `December-2026`; HEAD = `git ls-remote origin refs/heads/December-2026` = `710242ee02b525947f0cd988f89d30373df8a56b`; pins match.
2. Control §What 1 (archives from git; verify hashes).
3. Control §What 2–4 (code, guard, tests, README). `node --test tools/factory/test` → all pass.
4. Control §What 5 (`node tools/factory/project.mjs` once; check the two headings).
5. Control §What 6: `git add --` each path; `git diff --cached --name-only` = commit list; commit; `git push origin December-2026`; `git ls-remote origin refs/heads/December-2026`.
6. Report `claude/packets/MA-DEC-FACTORY.LABEL_Report.md`: commit, staged list, archive hashes, pins observed, code diff summary, test counts, the two heading lines, push output, non-actions. Then `node tools/factory/dispatch.mjs end MA-DEC-FACTORY.LABEL`. Reply ≤ 5 lines.
