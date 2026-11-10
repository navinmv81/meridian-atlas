# MA-NOV-P1.FIX4 — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-10
EXECUTED BY:  Engineering Lead — interactive, LANE_OPENER_v2.md
REVIEWED BY:  Main Lane verification; MA-NOV-P1.REVIEW4 (light) after the reset
APPROVED BY:  Founder — Start Approval in MA-NOV-P1.FIX4_Status.json
CONTROL:      claude/packets/MA-NOV-P1.FIX4_Control_v1.md
```

Usage is tight (84% weekly): keep changes focused; no exploration beyond the files named.

## A. Code fixes (`tools/factory/`)
1. **H1:** `begin` and headless `run` record `start_branch` (`git symbolic-ref --short HEAD`, or `DETACHED`) in `before.json`. At the end: if the current branch ≠ `start_branch` → BLOCKED "branch changed: <start> → <end>"; `refChanges` skips only `refs/heads/<start_branch>` (and, with `allow_commits`, `refs/remotes/origin/<start_branch>`). Missing `start_branch` (older runs) → `branch_check: "unavailable"`.
2. **H2:** `closure_by` must match `/^MA-[A-Z0-9][A-Z0-9.-]*$/` and name an existing CLOSED packet; otherwise throw.
3. **Tests:** keep all 40; add 41 branch created and finished on → BLOCKED; 42 new branch pushed (remote ref) with `allow_commits` → BLOCKED; 43 missing `start_branch` → `branch_check: unavailable`; 44 `closure_by` with `../` or bad pattern → refused.

## B. `Claude.md` v1.2 install (`claude/governance/`)
4. Create `claude/governance/Claude_md_v1.2.md`: the approved standing amendments to `Claude.md` v1.1, built from the draft rev 2 with: header `STATUS: APPROVED — Founder 2026-11-10 06:51 (NML-1110-1); amends Claude.md v1.1 (Project)`; the **three updates** — (a) §4 adds `CHANGES_REQUESTED → APPROVED` (Main Lane only, with `closure_by` naming a CLOSED follow-up packet whose review covered the changes; id-validated); (b) §3/§5 describe the commit, every-commit, ref, start-branch, transitions-log and session guards (G1–G5, H1); (c) DRAFT outcome / carry-over / Founder-request / plan records (`kind`, write owner NONE, never runnable); and the **open-question answers** Q2 yes, Q3 no (manual capacity entries), Q4 yes, Q5 yes recorded in place of the questions. Keep the draft file unchanged as history.
5. **Repository `CLAUDE.md` patch:** apply the draft's patch table (lines 5, 27, 28, 44, 48, 75, 79–100) as revised in rev 2, plus one pointer line near the top: "Standing operating rules: `Claude.md` v1.1 (Project) as amended by `claude/governance/Claude_md_v1.2.md`." For line 27 run `pwd`, `git branch --show-current`, `git remote -v` and write `VERIFIED 2026-11-10 (MA-NOV-P1.FIX4)` only if all three match; line 44 (cron capacity) cannot be verified without the network → keep its date and add "(not re-verified in November)". Replace the "Current Sprint Packet" section with a short pointer to `claude/November_Decisions_Log.md` and the Tower. Change nothing else in `CLAUDE.md`.

## C. Tower redesign (`tools/factory/project.mjs`, `lib/tower-logic.mjs`)
6. Restyle the generated `control-tower.html` to match `claude/factory/design/interim-tower-reference.html`: the same tokens (light/dark), header with snapshot badge (LIVE / SNAPSHOT / RUNNING / STALE RUN), **Waiting for you** cards (coloured by kind, reply line + Copy button), **Work** as columns of cards (Running / Ready / In review / Blocked-held / Closed) with chips (lane, usage, `ctl <hash prefix>`, session), **Start a run** panel (fixed line + Copy + 4 steps), **Path** (milestones Done/Now/Next), **Handoffs** table, **November scope** cards (requirement chips, dependencies, observations), **Recent runs** and **Recent decisions** (from `transitions.jsonl`). System font stacks only; no network; inline CSS/JS; Copy uses `navigator.clipboard` with a fallback text.
7. **New record kinds (rendered, never runnable, excluded from eligibility and work columns):**
   - `kind: "founder-request"` — `request_type` (start | decision | note), `question`, `options[]` (optional), `reply` (exact line), `due`, `status` (open | answered | withdrawn), `answer`, `answered_at`. Open ones render under *Waiting for you*; answered ones under *Recent decisions*.
   - `kind: "plan"` — `milestones[{when, title, detail, status: done|now|next}]`, `handoffs[{step, today: automatic|assisted|manual, how, target}]`. One plan record drives *Path* and *Handoffs*.
   - A READY packet with no `start_approval` still renders under *Waiting for you* as a start approval with reply `approve <ID>`.
8. **Tests:** 45 founder-request open/answered placement; 46 plan renders milestones and handoffs; 47 kinds excluded from eligibility; 48 HTML contains no `http://` or `https://` URL and no "OFFLINE"; existing Tower tests updated, not weakened.
9. Render the Tower from a temp copy of the real Status files plus one sample founder-request and one sample plan; describe it in the report (and attach a screenshot path if a browser/preview tool is available; otherwise say so).

## D. Commit and report
10. Stage each changed/added file under `tools/factory/`, `claude/governance/Claude_md_v1.2.md`, `CLAUDE.md`, and every pinned file below (verify hashes first):

| Path | SHA-256 |
|---|---|
| `claude/November_Decisions_Log.md` | `dbc2b6514250ee45c14796ffb7135455ff7c457220e9fec41898e338207eff26` |
| `claude/packets/MA-NOV-CARRY_Status.json` | `3854cae6cbbed863be0a48c922232c4d0749e3e8fb1cc4cb47f9b5c9034c8941` |
| `claude/packets/MA-NOV-P1.BUILD_Status.json` | `e0d4438051caa0aee336d7388d52bffa752b2dfcc0896fac6a6c293abea5da4d` |
| `claude/packets/MA-NOV-P1.DEMO_Status.json` | `e9826b73a0771f8b20f641bc2b517d62c4fea68ed0b1e02c2d445ddb3cf409b7` |
| `claude/packets/MA-NOV-P1.FIX_Status.json` | `b72cd69c09c71456cd4038b8303a3c69cfd51e391c92619643258818dd2cac97` |
| `claude/factory/design/interim-tower-reference.html` | `7a35bff04508e03ab30f49130132000d6eb32e42b3649d33f569b4e76a47af1a` |
| `claude/factory/runs/r-20261109T064454Z-91b0/before.json` | `8d0907dfafb04583b4dd8e00ed0001f5fd028fab0ffde5a986c2f30b98ee2b60` |
| `claude/factory/runs/r-20261109T064454Z-91b0/global.lock.json` | `c9b5eb0df54dd55bfbbf85243ba6bca0f6ae55e94e8aec36a0facd9d5b6690e1` |
| `claude/factory/runs/r-20261109T064454Z-91b0/lease.json` | `6064ac4a533f2c3da5236cd27039e4d79f7f93ba48d2858f7b56308a1e69c3f7` |
| `claude/factory/runs/r-20261109T064454Z-91b0/run.json` | `9c6033991625510052f803b069693b5a382a82213a72ce0b74753588374ae5d7` |
| `claude/factory/runs/r-20261109T183512Z-e465/before.json` | `13a0ea567587fc4d26ef86a9e8867f1fb1e3c2b9d45a7bbba0e2fdd640e193a4` |
| `claude/factory/runs/r-20261109T183512Z-e465/global.lock.json` | `8ef0b23587fc971a4c0b48502e1aad74be568e94486e8aba13763f073c3349df` |
| `claude/factory/runs/r-20261109T183512Z-e465/lease.json` | `689abe8ba415bc7d538a9d1b1a16669a4a788507ca212a83e658cdb1c40947d6` |
| `claude/factory/runs/r-20261109T183512Z-e465/run.json` | `3ae23ba81c6ade3a97565e3d93f41403fbbe466e19d4d0b4356ee14792826d0a` |
| `claude/packets/MA-NOV-P1.FIX3_Report.md` | `4c6eb020df6a8d351eeb0ff9c0587dc3245ca3b4c6944f0aadfa9597f0109dae` |
| `claude/packets/MA-NOV-P1.FIX3_Status.json` | `6e48b94023abcd61e2b9f61468e20179f100d0ebe9a65084d7edc80b80ed3f61` |
| `claude/packets/MA-NOV-P1.FIX4_Control_v1.md` | `5286fe553b8fa01b8534536924c4b4831609547f313c1527116ca33e4ba6d2e6` |
| `claude/packets/MA-NOV-P1.REVIEW3_Control_v1.md` | `30feeefd46a9aff895af02cb1210793fafc34b5d3a0f8deb781c5d4d561f6a1c` |
| `claude/packets/MA-NOV-P1.REVIEW3_Report.md` | `dd256043b75b7b5618adac3e2ceee51be17fb4e8e078ce474faebcfb0a58042b` |
| `claude/packets/MA-NOV-P1.REVIEW3_Status.json` | `57f33a7d569a13e82d12ea86fb38a2a80fa0c92256b1756f510d072b2afb7218` |
| `claude/packets/MA-NOV-P1.REVIEW3_Task_v1.md` | `a6877ece08edf06935b781ef48836fb564a400ced32a230eaa631c901733e67c` |
| `claude/packets/MA-NOV-P1.FIX4_Task_v1.md` | this file — verified against `MA-NOV-P1.FIX4_Status.json` |

Message `MA-NOV-P1.FIX4: start-branch check (H1), closure_by validation (H2); Claude.md v1.2 installed + CLAUDE.md patch; Tower redesign with founder-request and plan records` + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never stage: `MA-NOV-P1.FIX4_Status.json`, the report, real `STATUS_BOARD.md`, `control-tower.html`, `transitions.jsonl`, `claude/factory/backup/`, `.claude/`, root-level November duplicates, `13F Seed/gleif-seed.js`, other untracked files. `git push origin November-2026`.
11. Report `claude/packets/MA-NOV-P1.FIX4_Report.md`: per item — change, file:line, test id; suite result; Tower description (+ screenshot path or "no browser tool"); `CLAUDE.md` lines changed with verification results; commit SHA + `ls-remote`; non-actions. Then `end`.
