# MA-NOV-P1.FIX3 — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-09
EXECUTED BY:  Engineering Lead — interactive, LANE_OPENER_v2.md
REVIEWED BY:  Architect — MA-NOV-P1.REVIEW3
APPROVED BY:  Founder — Start Approval in MA-NOV-P1.FIX3_Status.json
CONTROL:      claude/packets/MA-NOV-P1.FIX3_Control_v1.md
```

Keep changes minimal; usage is tight.

## Code (`tools/factory/`)
1. **G1:** the commit check uses the union of paths from every commit in `git log --format= --name-only <start>..HEAD` (plus the net diff), so a file added then removed is still checked.
2. **G2:** `begin` and headless `run` save `git for-each-ref --format='%(refname) %(objectname)'` in `before.json`. At the end, any ref other than the current branch that changed, appeared or disappeared → BLOCKED "ref changed: <ref>" (a moved `refs/remotes/origin/<current branch>` is allowed only with `allow_commits`). A missing ref snapshot (runs begun by older code) → record `ref_check: "unavailable"` in `run.json`, not BLOCKED.
3. **G3:** an unparsable `.global.lock` is retired only if its mtime is older than 60 s.
4. **G4:** if the lease has a `session_id` and the caller has none → refuse (exit 2, nothing written) "end needs the session that began the run".
5. **G5:** `before.json` records the size and SHA-256 of `claude/factory/transitions.jsonl`; at `end`, BLOCKED "transitions log rewritten" unless the old bytes are an unchanged prefix.
6. **Closure path:** add `CHANGES_REQUESTED → APPROVED` for writer `main-lane` only, and only when the mutation sets `closure_by` (the id of a CLOSED follow-up packet whose review covered the requested changes); otherwise throw. Document it in the README.
7. **Outcomes view:** Status records with `kind: "outcome"` or `kind: "carry-over register"` render in a separate *November scope* section of the Tower and the board, with their `requirements`, `dependencies` and `observations` (if any), and do not appear in the work columns.
8. **Tests:** keep all 32; add 33 add-then-remove across commits → BLOCKED; 34 commit on another branch → BLOCKED; 35 missing ref snapshot → `ref_check: unavailable`; 36 unparsable lock younger than 60 s kept, older retired; 37 `end` without session id when the lease has one → refused; 38 transitions log rewritten → BLOCKED, appended → accepted; 39 closure path accepted with `closure_by`, refused without; 40 Outcomes section renders requirements and excludes outcome records from work columns.

## Commit (explicit paths)
9. Stage each changed/added file under `tools/factory/` and every file in the pinned table (verify each hash first; a mismatch → stop):

| Path | SHA-256 |
|---|---|
| `claude/November_Decisions_Log.md` | `48709e52f83515fa6d17f3e722c9fedb57e4f12117cc5b86d529a55b4508c499` |
| `claude/factory/config.json` | `268ea8cff19ce1be7df9992990f6a1a64d85324d8fd94ce74360f73e37aa70f5` |
| `claude/factory/runs/r-20261107T092212Z-c0da/lease.json` | `79d83469101a32abe8ec3d6d7998abb1f71ed7e64d18a959eb47c290b7ab9ad2` |
| `claude/factory/runs/r-20261107T092212Z-c0da/run.json` | `fc109d71536ab3d298e8185e7e1d510e01632d6ffbe27faf67458dcfb3a8afa9` |
| `claude/factory/runs/r-20261107T092212Z-c0da/worker.err` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `claude/factory/runs/r-20261107T092212Z-c0da/worker.jsonl` | `e490dcdf732d94dff0ee01d022e535f681da1d5296da81be395c69d6cc11afc4` |
| `claude/factory/runs/r-20261107T095946Z-3762/before.json` | `8094d5e0da55704b55bf669ef9232a7f47016c36157fffc11a9ecc3be1f10cbd` |
| `claude/factory/runs/r-20261107T095946Z-3762/lease.json` | `5edfb63b895f7d41f2892952526bb71db3b1c5fab6f98580374c9f1133e9c8b3` |
| `claude/factory/runs/r-20261107T095946Z-3762/run.json` | `d1d4ae8629ac4489cac1dc5443bfd3a70e30bb22d90681bcc1fc213dca2532dd` |
| `claude/factory/runs/r-20261107T105411Z-2bf1/before.json` | `6df73673b489ac98950338347cbe3a799e2f3b07bb55608ea1225a067e5c7631` |
| `claude/factory/runs/r-20261107T105411Z-2bf1/lease.json` | `edbc77349b0d8cec837a23284b04e5614c3ebc784b2c20acd05464bc1bd28f1a` |
| `claude/factory/runs/r-20261107T105411Z-2bf1/run.json` | `bcfaa54e502a1f017926893a23839c3839cb09bb4b0c675d621f0947d2803a45` |
| `claude/factory/runs/r-20261107T202556Z-a368/before.json` | `6ac1f604fef703019f4e4aa9aaa2ece23ef3591a5b036987926278d68bddec3f` |
| `claude/factory/runs/r-20261107T202556Z-a368/lease.json` | `6f689de0426af72947ce85c65949cf1e57cf87ae5c6e94c28df2e065e6f9cc54` |
| `claude/factory/runs/r-20261107T202556Z-a368/run.json` | `3c670760c60f98b8a1e2a1417bf175742faf393e9ef18681c5e5e964127a2228` |
| `claude/factory/runs/r-20261107T215253Z-231a/before.json` | `2d565d134fbd783a9ebe91fac61283201ea93b700c0511b86660459008abfda9` |
| `claude/factory/runs/r-20261107T215253Z-231a/global.lock.json` | `1c394855f456fef15972f1c82f1544578990f0d8638558e65cdcc84a45160f84` |
| `claude/factory/runs/r-20261107T215253Z-231a/lease.json` | `7c8cbcc069cbd74efe94830c572270b7567b01c10bf87e0602eac95fe7e8412c` |
| `claude/factory/runs/r-20261107T215253Z-231a/run.json` | `ef3f7db06a19754e4131b26a6b847ee18a7df9513b84a7bf8cd1409731c1aa4c` |
| `claude/packets/MA-NOV-BOND_Status.json` | `98040492819d473ba3de19761e8658a79dee51ffe42fc30336617fad74ae8b97` |
| `claude/packets/MA-NOV-CARRY_Status.json` | `a620cc504f656bc90e8a22778f9b88924f8e98155551dddf9c01890cca74444a` |
| `claude/packets/MA-NOV-EXP_Status.json` | `703f0a18a58cf271fd2be53b8cc40b783871cdf1750148ca275951c89d483dec` |
| `claude/packets/MA-NOV-HOME_Status.json` | `5478915cc78ddc48c852808e17a1552f6a3906024ab10358063fe8ac3cf5798d` |
| `claude/packets/MA-NOV-OPS_Status.json` | `bdd287435dd5e41b9367591b56e7a1bf380f9f7350546dafa94f1b1f1b1efa0b` |
| `claude/packets/MA-NOV-P1.BUILD_Status.json` | `2a7a269e78fa5f320ceb7979b04944af6ef4c052eb608f7b40d3a54d4d0e75db` |
| `claude/packets/MA-NOV-P1.DEMO_Status.json` | `cc7230e778c0a67f2b363bec2ed1310bce36f13944d61dbcc5fbd3f7b3e16efd` |
| `claude/packets/MA-NOV-P1.FIX2_Report.md` | `a1a7b0e9c3d7a40efa2691d936bbb2b9328be9f2d6d11aeb6b3b011637668de5` |
| `claude/packets/MA-NOV-P1.FIX2_Status.json` | `a9c76cd0f0108690d0ab461f1accd3e009e9d62e8a6310dad8e6662799997a96` |
| `claude/packets/MA-NOV-P1.FIX3_Control_v1.md` | `5ea7be9bb3901e2f03afea3c9dae123a82989d22f44e64413d195248ff1bbfa2` |
| `claude/packets/MA-NOV-P1.FIX_Status.json` | `d5c84600c4ae32763971c63dd0a5b950991612a6b34377f27272315d063b9fa2` |
| `claude/packets/MA-NOV-P1.REVIEW2_Control_v1.md` | `a8dd81f8028c27f7822c4cf566b24dce3e90c3cad82b38043eb5c4eb5a53de1d` |
| `claude/packets/MA-NOV-P1.REVIEW2_Report.md` | `dcb1e3db2c20f772024591a69945877232034a4d3dcaefd150be80d2564266e5` |
| `claude/packets/MA-NOV-P1.REVIEW2_Status.json` | `4c5bdafccb6721f7100800b82e680da4328ef4c25cef91ee653e7f56d6fc9dbc` |
| `claude/packets/MA-NOV-P1.REVIEW2_Task_v1.md` | `67fe9b21c80613172282a8c06b456258eb4f6c58937b32c0cd136b86c625b3d5` |
| `claude/packets/MA-NOV-P1.REVIEW_Status.json` | `b94a26b3c751229357b158338a5e2a138359bc821cf59e44e069609be6fc7879` |
| `claude/packets/MA-NOV-P1.FIX3_Task_v1.md` | this file — verified against `MA-NOV-P1.FIX3_Status.json` |

Message `MA-NOV-P1.FIX3: commit check covers every commit and all refs (G1, G2), lock/session/log guards (G3-G5), follow-up closure path, Outcomes view; pilot records` + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never stage: `MA-NOV-P1.FIX3_Status.json`, the FIX3 report, `STATUS_BOARD.md`, `control-tower.html`, `transitions.jsonl` (they change during this run; the next commit takes them), `claude/factory/backup/`, `.claude/`, root-level November duplicates, `13F Seed/gleif-seed.js`, other untracked files. Push `November-2026`.
10. Report `claude/packets/MA-NOV-P1.FIX3_Report.md`: per item — change, file:line, test id; suite result; commit SHA + `ls-remote`; non-actions. Then `end`.
