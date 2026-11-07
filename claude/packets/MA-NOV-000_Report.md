# MA-NOV-000 — Delivery-factory feasibility assessment — Report

```text
ISSUED BY:    Program Orchestrator (November Main Lane) — Control v1 9afaea82…c1e0, Task v1 361b8a04…8559
EXECUTED BY:  Engineering Lead — LANE-NOV-ENG (local Claude Code, desktop app, fresh session), 2026-11-06
REVIEWED BY:  Architect — fresh read-only session, on demand (not yet run)
APPROVED BY:  Founder — Start Approval 2026-11-06T21:19Z ("approve MA-NOV-000"); architecture approval pending this report
```

Started via `LANE_OPENER.md` (sha256 `3a5684b4…a2` matched). Eligibility: Status `start_approval` hashes = Status `control`/`task` hashes = on-disk hashes; no prior report. Only MA-NOV-000 was READY in the November section.

## 1. Answers

### Q1 Baseline
- `pwd` = LOCAL_MASTER path. `git branch --show-current` = `November-2026`. `rev-parse HEAD origin/November-2026` = `a01ffe2d…b672` for both. **Confirmed `November-2026` @ `a01ffe2` = origin.**
- `ls .git/*.lock` → no matches (no lock).
- Modified, uncommitted: `claude/November_Decisions_Log.md`, `claude/packets/STATUS_BOARD.md` (these are the Main Lane's own edits).
- Untracked (names only): `.claude/settings.local.json`, `13F Seed/gleif-seed.js`, `Claude outputs/`, `MA-SEP-010_Change_Request.md`, `Meridian_Atlas_Current_State_v13.docx`, `~$ridian_Atlas_Current_State_v13.docx`, the three root-level November duplicates (`cmp`: byte-identical to the `claude/` copies), and `claude/packets/` `LANE_OPENER.md`, `MA-NOV-000_{Control_v1,Task_v1}.md`, `MA-NOV-000_Status.json`, `MA-NOV-BOOT_{Report.md,Status.json}`.
- `git worktree list`: 13 October worktrees under `~/MeridianAtlas-work/` (12 detached, `fix2-local` on a branch). This is precedent for reviewer worktrees, and also clean-up debt.

### Q2 Existing state system
1. **Inventory:** there are 93 `*_Status.json` files, and all parse. The core keys appear in every one of them: `packet`, `state`, `owner`, `control{version,file,sha256}`, `task{version,file,sha256}`, `usage_class`, `updated`, `updated_by`. Coverage of the other keys:

   | Key | Files | Share |
   |---|---|---|
   | `blocker` | 80 | 86% |
   | `write_owner` | 60 | 64% |
   | `report` | 59 | 63% |
   | `review_needed` | 35 | 37% |
   | `phase` | 1 | 1% |
   | `start_approval` | 1 | 1% (MA-NOV-000 only) |

   **Variants:**
   - `report` is written three ways: `{file,sha256}`, `{sha256}` alone, or `{sha256_prefix}` (4 files).
   - Outputs appear as `output`, `outputs` (once as a dict, once as a list) or a bare `output_sha256`.
   - Approvals appear as `founder_approval{text,at}` (7 files), `approved{by,at,rev}`, `release_approval` or `start_approval`.
   - There is a long tail of one-off keys (`days`, `cursor`, `day_totals`, `worker_live`, `reviews`, …).
2. **State names in use:** READY 11, CLOSED 79, EXECUTING 2, REVIEW_NEEDED 1. Everything in use is a `Claude.md` v1.1 name, and APPROVED, DECISION_NEEDED and BLOCKED are never used in Status files. The board also uses free-text states such as `APPROVED (10 Oct, D2 A)` and `CLOSED — 1,862/1,862 merged…`. None of the spec's new states (DRAFT, CHANGES_REQUESTED, PAUSED, CAPACITY_HOLD) are used. The spec's RUNNING and ACCEPTED correspond to v1.1's EXECUTING and APPROVED: pick one name for each (recommendation: keep EXECUTING and APPROVED, and add the four new ones).
3. **Board vs Status** (parsed with python, board rows matched by packet id):
   - **Board and Status disagree (9):**

     | Packet | Board | Status |
     |---|---|---|
     | 003.BUILD | REVIEW_NEEDED | READY |
     | 011.CLOSE | REVIEW_NEEDED | READY |
     | 009.SPEC | REVIEW_NEEDED | READY |
     | 005.SPEC | REVIEW_NEEDED | READY |
     | 011.R110R | DECISION_NEEDED | CLOSED |
     | 011.CLOSEREV-ARC | CLOSED | READY |
     | 011.CLOSEREV-OPS | CLOSED | READY |
     | 011.DIL29 | CLOSED | READY |
     | 002a.A6R, SAT24.ENG1 | CLOSED | READY |

     Note: the last row covers two packets, so the table has nine rows for ten packets.
   - **Not CLOSED on both board and Status (4):** 008.BUILD REVIEW_NEEDED, 007.P1 EXECUTING, 002a EXECUTING, 011.APOPS READY.
   - **Spec rows with no Status file (4), all APPROVED:** 007, 011, 008, 002.
   - The October board has 13 rows that are not CLOSED, and 12 October Status files are not CLOSED. Together that is 14 distinct packets. The Main Lane's count of 10 probably used a different basis (it is not reproduced here).
   - **Structural drift:** board line 22 ("Packets not yet admitted — may not run") heads ~78 rows that *are* admitted with Control hashes. Six Status files have no exact board id (they sit under the parent id `MA-OCT-002`, which appears 8 times). All Control hashes agree wherever both sides carry one.
   - **Recommended reconciliation:** one Main Lane record, "October close reconciliation" (citing ML-1106-4), sets every October packet to CLOSED with a `close_reason`:
     - `completed`: the five where the board says CLOSED and Status says READY (board is the later evidence), plus 011.R110R.
     - `carried`: 003.BUILD, 009.SPEC, 005.SPEC, 008.BUILD, 007.P1, 002a, 011.APOPS, 011.CLOSE. Each is linked to a November triage ticket and is not reopened.

     Spec-approval rows become history. Then archive the October board file unchanged (rename it to `STATUS_BOARD_October_2026.md`) and generate the November board.
4. **Other state copies:**
   - **D1 tables:** `sprintboarditems`/`releaseledger` are read and written only by `meridian-control` (`App/Ops/src/control-api.js:23-27`). The public GETs are `/api/ops/sprint-board` and `/api/ops/release-ledger` (`:473-474`). Admin POSTs sit under `/api/ops/admin/*` (Access-authenticated, `:433-460`). The Ops UI shows both as read-only tabs (`App/ma-ops.js:469-470`), and OPS-01 removes those tabs. Recommendation: make them **read-only legacy**, with no November writes and the routes kept (OPS-05).
   - **October HTML board:** `claude/meridian-october-board.html` is **not on disk or in git** (`find`, `git log --all`): it is Project-only.
   - **Project `Sprint_Board.md` mirror:** Project-only.

   Both become frozen legacy. The only live state is `claude/packets/*_Status.json`.
5. **Minimal Status JSON additions** (each field has one owner):

   | Field | Owner |
   |---|---|
   | `phase` (SPEC/BUILD/INVESTIGATION/REVIEW) | Main Lane |
   | `rev` (integer, +1 on every write; writers compare-and-swap) | every writer |
   | `lease{run_id,holder,acquired,expires}` | dispatcher |
   | `heartbeat` (ISO time) | dispatcher (from the worker's log activity) |
   | `run{run_id,session_id,started,ended,exit_code,log}` | dispatcher |
   | `hold{type:PAUSED/CAPACITY_HOLD,set_by,at,reason,resume_state,reset_at?}` | Founder action, via the Main Lane |
   | `start_approval` (kept), with `scope_sha256` = hash of the Control and Task files together | Founder action |
   | `review{reviewer,run_id,file,sha256,verdict}` | reviewer run (the dispatcher records the result) |
   | `decision{request_file,choice,at,artifact_sha256}` | Founder action |

   Normalise `report` to `{file,sha256}`. The global pause lives in a separate `claude/factory/PAUSE.json` (owner: Founder action). Example:

```json
{"packet":"MA-NOV-P1","state":"EXECUTING","phase":"BUILD","rev":7,
 "control":{"version":"v1","file":"MA-NOV-P1_Control_v1.md","sha256":"…"},
 "task":{"version":"v1","file":"MA-NOV-P1_Task_v1.md","sha256":"…"},
 "start_approval":{"by":"Founder","at":"2026-11-09T09:00Z","words":"approve P1",
   "control_sha256":"…","task_sha256":"…","scope_sha256":"…","recorded_by":"Main Lane"},
 "lease":{"run_id":"r-20261109T0901Z-3f2a","holder":"dispatcher","acquired":"…","expires":"…"},
 "heartbeat":"2026-11-09T09:14Z",
 "run":{"run_id":"r-20261109T0901Z-3f2a","session_id":"<uuid>","log":"claude/factory/runs/r-…/worker.jsonl","exit_code":null},
 "hold":null,"review":null,"decision":null,
 "report":{"file":"MA-NOV-P1_Report.md","sha256":null},
 "usage_class":"light","updated":"2026-11-09T09:14Z","updated_by":"dispatcher"}
```

### Q3 Worker launch
1. **`claude` is not on PATH** (`which claude` → not found; nothing in `~/.local/bin`, `/usr/local/bin` or `/opt/homebrew/bin`). The binary exists only inside the desktop app, at `~/Library/Application Support/Claude/claude-code/2.1.317/91184d3d9ba3/claude.app/Contents/MacOS/claude` (`--version` → `2.1.317 (Claude Code)`). That path changes with every app update.
   - **What `--help` shows:**
     - Headless mode: `-p/--print` and `--output-format text|json|stream-json`.
     - Background sessions: `--bg` plus `agents`, `logs <id>`, `stop <id>`, `attach`.
     - Run identity: `--session-id <uuid>`, `-n/--name`.
     - Permissions: `--permission-mode acceptEdits|auto|bypassPermissions|manual|dontAsk|plan`, and `--permission-prompts host|none` ("none" auto-denies anything that would prompt).
     - Tool limits: `--allowedTools` / `--disallowedTools` / `--tools`.
     - Settings: `--setting-sources user,project,local`, `--settings`, `--restricted`.
     - Working directory and model: `--add-dir`, `-w/--worktree`, `--model`, `--max-budget-usd` (with `--print`).
   - **Model:** this session's own process was started by the app with an explicit `--model=…` flag (`ps -o command= -p $PPID`). So **a headless launch does not inherit the desktop picker**: with no `--model`, it falls back to the user-settings/account default, which may differ. Inheriting the "current" model without naming it is *unproven until pilot*; see Decision 2.
2. **Dispatcher, one bounded run:**
   1. Check that state is READY, the approval hashes match the files on disk, there is no hold or pause, and no lease exists.
   2. Create the lease atomically: `fs.openSync('claude/factory/leases/<ID>.lease','wx')` (O_EXCL). The volume is local APFS (`df` → `/dev/disk3s5`, not iCloud), so this is atomic. Status writes go to a temp file followed by `rename(2)`.
   3. Generate `run_id`, used as `--session-id`.
   4. Launch: `"$CLAUDE_BIN" -p --session-id <uuid> --output-format stream-json --verbose --permission-mode acceptEdits --permission-prompts none --allowedTools "<from Control>" --setting-sources project < Task file`, with cwd = repo, `stdout` → `claude/factory/runs/<run_id>/worker.jsonl`, and the exit code captured.
   5. Evidence lands in the report named by the Control, plus the run log.

   *Unproven until pilot:* exact prompt piping, and whether `--setting-sources project` still finds auth.
3. **What is observable:** process exit code; the end-of-stream `result` event (stream-json); log growth, which serves as the heartbeat; the lease expiry. `claude stop <id>` exists for `--bg` sessions. **What is not observable:** the worker's internal progress or what it intends to do; whether an external side effect completed just before a crash. Stale-lease handling must therefore mark the run BLOCKED, and never rerun automatically.
4. Labels: see the handoff table. Every launch step is *unproven until pilot*; only the help text supports it.

### Q4 Independent review launch
- **Mechanism:** the same binary, a new `--session-id`, `--no-session-persistence` (optional), `--permission-mode plan` or `--tools "Read,Grep,Glob"` plus a single allowed write to its review file, `--permission-prompts none`, and the prompt = review Control + the hashes of the diff/report under review.
- **Separation:** `-w/--worktree` gives a separate checkout. October already used detached review worktrees (13 listed in Q1), so the pattern is proven, though not yet by this launcher.
- **Independence evidence:** a distinct run_id/session_id; a separate log file; no `--resume`/`--continue`; the reviewer's prompt contains only artifacts, never the executor's transcript. The dispatcher records both session ids, and the Tower flags any equality.
- *Unproven until pilot.* Today's review start is **manual**: the Founder opens a fresh session.

### Q5 Control Tower and Founder actions
1. **Runtimes:** `node` v24.14.1 (`/usr/local/bin`), `npm` 11.11.0, `python3` 3.9.6, `jq` present. The proposal is a dependency-free `node` script `tools/factory/project.mjs` that reads every Status JSON file plus `PAUSE.json` and writes `claude/packets/STATUS_BOARD.md` (generated) and `claude/factory/control-tower.html`, with no model calls. Refresh options: a manual run after each state write (pilot); a `launchd` interval later (needs approval, TCC note in `CLAUDE.md:49`); file-watch is possible but adds a long-running process.
2. **Serving:**
   - **`file://`:** the HTML embeds a JSON snapshot plus a `generated_at` stamp, and `<meta http-equiv="refresh" content="30">` reloads it. No listener is needed, and the page works offline.
   - **A `127.0.0.1` listener:** allows live heartbeats and action endpoints, but it is a new service, which is prohibited now and needs approval.
   - **A published Claude artifact:** it cannot read local files, so each refresh would need a model or MCP publish. That breaks the "no model for refresh" rule, so it is only usable as an occasional manual snapshot.
3. **Founder actions:**
   - **(a) Assisted:** the Founder tells the Main Lane, which writes the decision with `rev`/hash binding. A stale request is rejected when its rev no longer matches, and a duplicate is rejected by an idempotency key. No secrets are involved.
   - **(b) Localhost endpoint:** a per-session token injected at serve time, with CSRF and Origin checks; actions carry the `rev` and `scope_sha256`. This needs the listener approval.
   - **(c) Decision file:** the Founder creates `claude/factory/decisions/<ID>-<rev>.json`. Without a key, a "signature" is only Founder-only authorship, so it can't be verified.

   **Recommendation for the pilot: (a).** The Tower shows actions labelled *manual/assisted*.
4. **Stale/offline display:**
   - The heartbeat comes from Status `heartbeat`, which the dispatcher writes from log mtime.
   - Thresholds: amber when the heartbeat is older than 5 minutes; red/STALE when it is older than the lease expiry.
   - If the generator itself stops, the page's own JS compares `generated_at` with the browser clock and shows **OFFLINE** after 2 refresh intervals, with no server needed.
   - When there is no lease, the Tower shows idle, which is distinct from blocked, held or offline.

### Q6 Write ownership and precedence
1. **Draft v1.2 rule:**

   > The Main Lane is the sole writer of a packet's admission, state transitions, approvals, decisions and holds. The dispatcher may write only `lease`, `heartbeat`, `run` and the EXECUTING/terminal-run transitions an admitted, approved packet permits. A reviewer run writes only its review file, and the dispatcher copies its verdict. Every write is a compare-and-swap on `rev` via temp-file + rename. A write that would change any other field, or that sees a mismatched `rev`, is refused and logged. `STATUS_BOARD.md` is a generated projection with no hand edits.
2. **Precedence:**
   - **Recommended order:**
     1. Founder decision record.
     2. The packet's Control/Task (hash-bound).
     3. `Claude.md` (Project governance).
     4. Repo `CLAUDE.md` (environment truth).
     5. November spec and kit (design intent, not permission).
     6. `.claude/settings.local.json` (a harness enforcement layer, not authority).
   - **Conflict found:** `settings.local.json` pre-allows `npx wrangler d1 execute meridian-etf --remote:*`, `npx wrangler deploy:*` and `npx wrangler secret put:*`. That contradicts the "never npx" rule (v14 §5.4) and must not reach an unattended worker. Use `--setting-sources project` or `--restricted` for factory runs (see Decision 5).
   - **Case sensitivity:** the volume is case-insensitive APFS (`os.path.exists('claude.MD')` → True at the repo root). So `Claude.md` cannot sit beside `CLAUDE.md`. Recommendation: store v1.2 as `claude/governance/Claude_md_v1.2.md` (a distinct name, so a nested folder `CLAUDE.md` can't be auto-loaded by accident), and add one pointer line in the repo `CLAUDE.md`. Never overwrite the repo file.
3. **Stale lines in repo `CLAUDE.md`:**
   - `:5` "Last updated 2026-08-27".
   - `:27` VERIFIED line still names `September-2026`.
   - `:28` branch = `October-2026` (now `November-2026`).
   - `:44` cron capacity "as of 2026-09-23" (re-verify; not checked here because it needs the API).
   - `:48` `Sprint_Board.md` note (now legacy).
   - `:75` September master-lane paragraph.
   - `:79-100` the whole Current Sprint Packet section (MA-OCT-000).

### Q7 Usage and capacity
- `--help` lists no usage command.
- `~/Library/Application Support/Claude/plan-usage-history.json` exists (file name seen while locating the binary). It was **not read**, because it is outside the allowed scope.
- The desktop app also exposes a session-usage tool, which was not called.
- Whether either is legitimate, credential-free telemetry is *unknown*. Settling it needs Founder permission to inspect the file's structure.
- **Recommendation:** use the manual `hold{type:"CAPACITY_HOLD",set_by:"Founder",reason,reset_at}` entry, written by the Main Lane. The Tower shows a banner marked "manual entry, not telemetry", and the dispatcher refuses launches while it is set. A quota error in a worker log sets the same hold automatically (`set_by:"dispatcher"`), with no retry.

### Q8 Pilot proposal
**Confirmed, with one addition.**
- Build `tools/factory/project.mjs` (Status → November `STATUS_BOARD.md` + `control-tower.html`).
- Build `tools/factory/dispatch.mjs` (validate, lease, launch one doc-only worker, record the run).
- Archive the October board unchanged.
- The worker task is a doc edit: for example, drafting `claude/governance/Claude_md_v1.2.md` from §Q6. That task launches the selected model once, and so needs its own Start Approval.
- No production, D1, LaunchAgent or listener.

**Tests it must show** (node test file plus fixtures under `tools/factory/test/`):

| # | Test | Expected result |
|---|---|---|
| 1 | Invalid transition (READY→CLOSED) | refused |
| 2 | Duplicate launch | second `wx` fails |
| 3 | Stale approval (Task edited after approval) | hash mismatch refused |
| 4 | Scope violation | write outside the allowed paths is detected by a post-run `git status` diff and the run is marked BLOCKED |
| 5 | Pause | `PAUSE.json` blocks a new launch, and the active run finishes |
| 6 | Interrupted worker | killed process + expired lease → BLOCKED, no rerun |
| 7 | Capacity hold | blocks launch, and the banner shows |
| 8 | Record-update interruption | temp file left, original intact, regenerate is idempotent |
| 9 | Stale/offline display | old `generated_at` → OFFLINE |

## 2. Handoff table

| Step | Mechanism | Label | Proven? | Risk |
|---|---|---|---|---|
| Dispatch | `dispatch.mjs`, started by the Founder or Main Lane | assisted | unproven | eligibility logic bugs; tests 1–3 cover them |
| Worker start | app-bundled `claude -p --session-id …` | automatic (once dispatched) | unproven (help text only) | binary path changes per update; model not inherited |
| Evidence | report file + `worker.jsonl` + exit code | automatic | unproven | worker exits without a report → BLOCKED |
| Review start | same binary, new session, worktree/read-only tools | assisted (dispatcher on Main Lane go) | worktree pattern proven in Oct; launcher unproven | reviewer sees executor context only if wired wrongly; session ids are compared |
| Verdict | review file → dispatcher copies the verdict | automatic | unproven | malformed verdict → DECISION_NEEDED |
| Founder gate | Founder → Main Lane writes the decision (option a) | manual/assisted | proven (current practice) | latency; stale request rejected by `rev` |
| Record update | temp + rename, CAS on `rev`, regenerate board/HTML | automatic | unproven | interruption → test 8 |
| Next readiness | dispatcher re-evaluates on its next manual run | assisted | unproven | needs interval approval before it can be automatic |

## 3. Recommended architecture

- **State:** one state system, `claude/packets/*_Status.json`, plus `rev`, `lease`, `heartbeat`, `run`, `hold`, `review` and `decision`, each field with one owner. `STATUS_BOARD.md` and `control-tower.html` are generated projections. D1 board tables, the October HTML and the Project mirror are frozen legacy.
- **Dispatcher:** a dependency-free `node` script. It validates, takes an O_EXCL lease and launches **one** headless worker through the app-bundled Claude Code binary, with an explicit per-Control tool allowlist, `--permission-prompts none` and project-only settings. It writes atomically.
- **Review:** on demand, in a separate session id and worktree with read-only tools; independence is evidenced by distinct ids and logs.
- **Tower:** a `file://` HTML page with an embedded snapshot and auto-reload, and a client-side OFFLINE check. No model or listener in the pilot.
- **Founder actions:** assisted via the Main Lane, bound to `rev` + `scope_sha256`. A localhost action endpoint is phase 2, after separate approval.
- **Capacity:** a manual hold, plus an automatic hold on a quota error, with no retries.
- **Schedule:** none in the pilot. A `launchd` interval only after approval.

## 4. Founder decisions needed

1. **Launch path.**
   - **Options:** (a) keep the manual fixed line; (b) `dispatch.mjs` resolves the app-bundled binary each run; (c) the Founder installs the CLI on PATH.
   - **Recommendation: (b) for the pilot**, with (c) as an option later.
2. **Model for headless runs.**
   - **Options:** (a) omit `--model` (the account/user default may differ from the app picker); (b) the Founder records the current model id once in `claude/factory/config.json`, and the dispatcher passes it verbatim, never changing it.
   - **Recommendation: (b).**
3. **Founder action transport.**
   - **Options:** (a) assisted via the Main Lane; (b) localhost endpoint; (c) decision files.
   - **Recommendation: (a) for the pilot.**
4. **v1.2 write-ownership rule.** Accept the Q6.1 draft, or keep "Main Lane sole writer" with the dispatcher writing only to `claude/factory/runs/`.
   - **Recommendation:** accept the draft. It is necessary for leases.
5. **Permissions for factory runs.**
   - **Options:** (a) `--setting-sources project` with an explicit allowlist per Control; (b) also remove the three `npx wrangler` allows from `.claude/settings.local.json`.
   - **Recommendation: (a) now and (b) via a small change request.** Also reconcile October through one Main Lane record (Q2.3).

## 5. Non-actions and deviations
- **Not done:** no D1, `wrangler`, Cloudflare/GitHub API or production calls; no secrets or `.env` reads; no model or agent launches (this lane used no subagents); no installs, listeners or `launchctl` changes; no git writes; no edits other than this report.
- **`launchctl list` read (filtered to `meridian`):** `financialfact-backfill` last exit 78, `firds-weekly-seed` 1, `entities-enrich-boost` 0, `health-check` 0. This is recorded only (FIRDS has its own decision request).
- **Deviation 1:** to locate the `claude` binary, the directory names of `~/Library/Application Support/Claude/` were listed (names only; no file read), and the hosting process's flag names were read via `ps` (tool lists and model flag; no values that look like secrets).
- **Deviation 2:** the existence of `~/Library/Mobile Documents/…/Desktop` was tested, to rule out iCloud for lease atomicity.
- **Unchanged:** the model and every Claude Code setting.
