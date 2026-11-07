# MA-NOV-P1.BUILD — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-07T08:53Z
EXECUTED BY:  Engineering Lead — LANE-NOV-ENG
REVIEWED BY:  Architect — MA-NOV-P1.REVIEW (separate session)
APPROVED BY:  Founder — Start Approval (recorded in MA-NOV-P1.BUILD_Status.json)
CONTROL:      claude/packets/MA-NOV-P1.BUILD_Control_v1.md (sha256 in MA-NOV-P1.BUILD_Status.json)
```

Node built-ins only (`node:fs`, `node:path`, `node:crypto`, `node:child_process`, `node:test`, `node:assert`, `node:os`). ES modules. No network.

## §1 Preflight
`pwd`; no `.git/*.lock`; branch `November-2026`; `HEAD` = `git ls-remote origin refs/heads/November-2026`; Control/Task hashes match the Status file; every §7 pinned hash matches. Mismatch → stop.

## §2 State library — `tools/factory/lib/state.mjs`
- `readStatus(id)`, `listStatus(prefix)`; `writeStatus(id, mutate, {writer, expectRev})`: read → check `rev === expectRev` → apply → **field-ownership check** → `rev + 1` → write temp file in the same folder → `fs.renameSync`. A missing `rev` reads as 1.
- **Field ownership** (MA-NOV-000 §Q6.1, Founder choice 4; applies to `MA-NOV-*` packets):
  - `dispatcher`: may change only `lease`, `heartbeat`, `run`, `updated`, `updated_by`, and `state` for the transitions READY→EXECUTING, EXECUTING→REVIEW_NEEDED, EXECUTING→BLOCKED.
  - `main-lane`: any field.
  - Anything else → throw `OwnershipError`; nothing written.
- **Transitions** (v1.1 names plus DRAFT, CHANGES_REQUESTED, PAUSED, CAPACITY_HOLD): DRAFT→READY; READY→EXECUTING|BLOCKED|PAUSED|CAPACITY_HOLD; EXECUTING→REVIEW_NEEDED|BLOCKED; REVIEW_NEEDED→CHANGES_REQUESTED|DECISION_NEEDED|APPROVED; CHANGES_REQUESTED→READY; DECISION_NEEDED→APPROVED|CHANGES_REQUESTED|BLOCKED; APPROVED→CLOSED; BLOCKED|PAUSED|CAPACITY_HOLD→(their `hold.resume_state` or READY). Others throw `TransitionError`.

## §3 Eligibility — `tools/factory/lib/eligibility.mjs`
Same rules as `claude/packets/LANE_OPENER.md` step 3, plus: no live lease; no `claude/factory/PAUSE.json`; no `hold`; Status `run_profile` present (`allowed_tools`, `permission_mode`, `allowed_write_paths`) for `dispatch run`. Returns `{eligible:[…], ineligible:[{id, reasons:[…]}]}` — reasons drive the Tower's "why not ready" text.

## §4 Generator — `tools/factory/project.mjs`
Reads `claude/packets/MA-NOV-*_Status.json`, `claude/factory/PAUSE.json` (optional), `claude/factory/config.json`. Writes:
1. **`claude/packets/STATUS_BOARD.md`** (after the §6 archive step): first line `# Status Board — November 2026 (generated — do not edit; run node tools/factory/project.mjs)`, `generated_at`, then the heading **`## November 2026 — admitted packets`** and a table with the **same columns as today** (Packet | State | Control (SHA-256) | Lane / tool | Write owner | Next gate | Blocker | Usage). Row text: `<id> — <title>`; Control cell `v<N> \`<sha256>\``. Values come from Status keys `title`, `lane`, `write_owner`, `next_gate`, `blocker`, `usage_class` (fallback `—`). This keeps `LANE_OPENER.md` working unchanged.
2. **`claude/factory/control-tower.html`**: one self-contained file (inline CSS/JS, system fonts, light/dark), JSON snapshot embedded, `generated_at`, `<meta http-equiv="refresh" content="30">`. Sections: *Waiting for you* (READY without `start_approval`; DECISION_NEEDED; holds; global pause), *Running* (lease holder, run id, heartbeat age — amber > `heartbeat_amber_s`, red past lease expiry), *Ready*, *In review*, *Blocked/held* (with reasons from §3), *Closed* (last 10), *Recent runs*, the fixed line from `LANE_OPENER.md`, and a footer with `generated_at`. Client JS shows **OFFLINE** when `now − generated_at > 2 × refresh` (Q5.4). Idle (no lease) shows as idle, not blocked. No secrets, no network.
3. Deterministic output: sorted keys and rows; two runs differ only in `generated_at`.

## §5 Dispatcher — `tools/factory/dispatch.mjs`
- `check`: prints §3 result; exit 0.
- `run <ID> [--dry-run]`:
  1. Re-check eligibility for `<ID>`; refuse if ineligible.
  2. Resolve binary: env `CLAUDE_BIN` if set (tests), else `config.claude_bin` if set, else the newest `~/Library/Application Support/Claude/claude-code/*/*/claude.app/Contents/MacOS/claude` by version; must be executable; `--version` must succeed.
  3. Model: `config.model`; **null → refuse** with "Founder has not recorded the model (choice 2b)". Never invent or change it.
  4. Lease: `fs.openSync('claude/factory/leases/<ID>.lease','wx')` containing `{run_id, pid, acquired, expires}`; `EEXIST` → refuse (duplicate launch).
  5. `writeStatus(writer:'dispatcher')`: state EXECUTING, `lease`, `run{run_id, session_id, started, log}`.
  6. Launch (not with `--dry-run`): `<bin> -p --session-id <uuid> --model <config.model> --output-format stream-json --verbose --permission-mode <run_profile.permission_mode> --permission-prompts none --allowedTools <run_profile.allowed_tools> --setting-sources project`, cwd = repo, stdin = the prompt `Execute claude/packets/<Task> under claude/packets/<Control> (Control sha256 …, Task sha256 …). Founder Start Approval recorded in claude/packets/<ID>_Status.json.`, stdout/stderr → `claude/factory/runs/<run_id>/worker.jsonl` / `worker.err`. Every 30 s write `heartbeat` (log mtime). No retry on any failure.
  7. After exit: scope check — `git status --porcelain` before vs after; any new/changed path outside `run_profile.allowed_write_paths` → BLOCKED (`blocker`: scope violation, list paths). Else exit 0 and the Control's report exists → REVIEW_NEEDED, `run.report_sha256`; else BLOCKED with the reason. A log line containing a usage/quota-limit error → also write `hold{type:"CAPACITY_HOLD", set_by:"dispatcher", reason, at}` (§Q7) via a separate main-lane-class write path inside the dispatcher that is limited to `hold` only (document this exception in the README).
  8. Move the lease file to `claude/factory/runs/<run_id>/lease.json` (rename, no delete).
- Stale lease (expired, process gone) found by `check` or `run` → report it, set BLOCKED with "interrupted run — no automatic rerun"; never relaunch.
- `status`: one line per November packet.

## §6 Archive, settings, config
1. Verify `claude/packets/STATUS_BOARD.md` hash = §7 pin, then `git mv` it to `claude/packets/STATUS_BOARD_October_2026.md`; then run `project.mjs` to create the new board and the Tower.
2. Settings: copy `.claude/settings.local.json` → `claude/factory/backup/settings.local.json.pre-P1`; remove exactly the three entries named in the Control; keep everything else byte-for-byte equivalent JSON; show before/after entry counts (3 → 0 allow entries expected).
3. Create `claude/factory/config.json`: `{"schema":1,"model":null,"claude_bin":null,"heartbeat_amber_s":300,"lease_ttl_s":7200,"refresh_s":30}`. Create empty dirs `claude/factory/leases/`, `claude/factory/runs/` with a `.gitkeep` each.
4. **Model proposal for choice 2b:** read this session's own `--model` value from its parent process command line (`ps -o command= -p $PPID`; report only the model value) and put it in the report as *proposed*. Do **not** write it into `config.json` — the Founder confirms it and the Main Lane records it.

## §7 Tests — `tools/factory/test/` (`node --test tools/factory/test`)
Stub binary `tools/factory/test/fixtures/fake-claude.mjs` (env-controlled: exit code, sleep, write the report or not, write outside scope, emit a quota error, print `--version`). Every test runs in a temp copy (`fs.mkdtempSync`), never the real repo. Required:
1. invalid transition refused; 2. duplicate launch (second `wx`) refused; 3. stale approval (Task edited after approval) refused; 4. scope violation → BLOCKED; 5. global pause blocks launch, active run finishes; 6. interrupted worker (killed + expired lease) → BLOCKED, no rerun; 7. capacity hold blocks launch and shows on the Tower; 8. record-update interruption (crash between temp write and rename) leaves the original intact and the next write succeeds; 9. stale/offline display (old `generated_at` → OFFLINE in the HTML logic);
plus: 10. ownership — dispatcher writing `start_approval` throws; 11. model null → run refused; 12. generated board parses with `LANE_OPENER.md`'s step-3 rule and preserves every Control hash; 13. generator idempotent.

## §8 Commit (explicit paths only)
**Pinned (Main Lane files; verify hash, then `git add --`):**

| Path | SHA-256 |
|---|---|
| `claude/packets/MA-NOV-BOOT_Report.md` | `78664d7ead355b973c88113b92a5a2ed2b7e71132df931c740b8231c4b9b7e00` |
| `claude/packets/MA-NOV-BOOT_Status.json` | `cf00592429bb3c280933e861a8b76b036e48446db6689235aaa2811fdf4ce7c8` |
| `claude/packets/MA-NOV-000_Control_v1.md` | `9afaea82b7a9bfcad65e518b19d61ebe6e1d6f8c2705a962941ae30d73c6e1c0` |
| `claude/packets/MA-NOV-000_Task_v1.md` | `361b8a04faad8b07399e2a586cc63f7576e94263e5d1791f45b20074cbf28559` |
| `claude/packets/MA-NOV-000_Report.md` | `8b04f45bc7be22efaf4e20e2dd4cf4a011ece7ca002fbfa2f994a942c1e34519` |
| `claude/packets/MA-NOV-000_Status.json` | `aefef90fac1fe36d6d8864e535f220c19462f03e163161336615870c708fd1e4` |
| `claude/packets/LANE_OPENER.md` | `3a5684b4ff777854aac95fc9d53f532c6ee66f0c626de7fc305f66cbc608cae2` |
| `claude/November_Decisions_Log.md` | `2940f01184da30b3edaff5457ece38993b03075ca92632c1908e51d0189e6a33` |
| `claude/packets/October_Close_Reconciliation.md` | `01580c5f2345d508560511b35c08dc5f8fc9ddefdb067cc45b29312340c2a62c` |
| `claude/packets/MA-NOV-P1.BUILD_Control_v1.md` | `c049828bbd66f3c92c40110a542bae640ca27ee0d9cc1a39bd52d964b034f7aa` |
| `claude/packets/STATUS_BOARD.md` | `fefe33de23339eaadf7560bd5f3357dc8d66c9e94f381afd0b67eb4ca8983e78` |
| `claude/packets/MA-OCT-002a.A6R_Status.json` | `c28f0113739e0e64a542f2a047676a5695fc47edb9fae4f03886826e58f80b64` |
| `claude/packets/MA-OCT-002a_Status.json` | `869baeafc01622ab5f8c79b6ceeee795b5f69d40001b25d5336b16aa1f2bfa7b` |
| `claude/packets/MA-OCT-003.BUILD_Status.json` | `744c53224bed644798fa8a24d884d233e44f857bba4a2a8a53087d004b7f5968` |
| `claude/packets/MA-OCT-005.SPEC_Status.json` | `ebd7fe5004ec1777d17ccd3c40b49d2c79a39e11ef80b288ea483b4b252b17d7` |
| `claude/packets/MA-OCT-007.P1_Status.json` | `ec46a83b689e168de1c9e6a911b37f909af9db89707b8d543e620475ffb3f223` |
| `claude/packets/MA-OCT-008.BUILD_Status.json` | `60ff695502a91caa5e8591900c32c6580d0c82fffe52eae1a78cff8f09567002` |
| `claude/packets/MA-OCT-009.SPEC_Status.json` | `c1f3705b03cf3a70fb54e910e9239f9f1d0622923e4ad27ff8542c9cc54cdbe4` |
| `claude/packets/MA-OCT-011.APOPS_Status.json` | `67465e804473d48c6c07d34c69ba86693dbf6fe3b0d4b6dd36bf117c50e0ddc5` |
| `claude/packets/MA-OCT-011.CLOSEREV-ARC_Status.json` | `a384b68ad029b8a18ebc238aa6ed0bd42ad49b1edccf5b36508bf08556c45633` |
| `claude/packets/MA-OCT-011.CLOSEREV-OPS_Status.json` | `f2967ced05814f4b39253aec6214cf54c0f0083bf0db38be33060ed72e147c29` |
| `claude/packets/MA-OCT-011.CLOSE_Status.json` | `4452cc663fa22320935c1d5b249b72bc0e624550503c035ea9d2e9f7564f5497` |
| `claude/packets/MA-OCT-011.DIL29_Status.json` | `5e6332c8f068b3aafc3a4ebf8a21e4d6e0df5afa6e49e3db81431fc6b189b0e2` |
| `claude/packets/MA-OCT-011.R110R_Status.json` | `0647cca08d4ba1181d97082c22362ce414974547bdb308b527ac2ce3632a4414` |
| `claude/packets/MA-OCT-SAT24.ENG1_Status.json` | `20f9bfba361266e09ad6e38c7a8b0e3b991ebf619928078aa2f370e602c41cfb` |
| `claude/packets/MA-NOV-P1.BUILD_Task_v1.md` | this file — verified against `MA-NOV-P1.BUILD_Status.json` |

**Created by this lane (add each by path; list them in the report):** every file under `tools/factory/`; `claude/factory/config.json`, `claude/factory/control-tower.html`, `claude/factory/leases/.gitkeep`, `claude/factory/runs/.gitkeep`; `claude/packets/STATUS_BOARD.md` (generated); the rename to `claude/packets/STATUS_BOARD_October_2026.md`.

**Never staged:** `.claude/settings.local.json`, `claude/factory/backup/`, `claude/packets/MA-NOV-P1.BUILD_Status.json`, `claude/packets/MA-NOV-P1.BUILD_Report.md`, the root-level November duplicates, and every other untracked file listed in MA-NOV-BOOT Task v2 §1.

Then `git diff --cached --name-status` (expect `R` for the board rename) → `git commit -m "MA-NOV-P1.BUILD: factory state lib, Tower/board generator, dispatcher, tests; October board archived; pending governance records" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"` → `git push origin November-2026`.

## §9 Report — `claude/packets/MA-NOV-P1.BUILD_Report.md`
Header; files created (path, lines, sha256); test output summary (13 named results); `project.mjs` run on real files (rows generated, hashes preserved, idempotency check); `dispatch.mjs check` output on real files; settings before/after counts; proposed model value (§6.4); commit SHA and `ls-remote`; non-actions; deviations. Stop.
