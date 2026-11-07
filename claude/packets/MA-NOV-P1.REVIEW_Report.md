# MA-NOV-P1.REVIEW — Independent Architect review of the delivery-factory pilot — Report

```text
ISSUED BY:    Program Orchestrator (November Main Lane) — Control v1 74ea6be9…9498, Task v1 ec20fc25…6ae0
EXECUTED BY:  Architect — fresh interactive Claude Code session, run r-20261107T105411Z-2bf1, 2026-11-07
REVIEWED BY:  — (this is the review)
APPROVED BY:  Founder — pilot acceptance is a separate Founder decision
```

## Verdict: **PASS_WITH_NOTES** — no blocking findings; do not accept the pilot until the 9 must-fix items close

The loop works as built and the evidence is real. The DEMO run was bracketed, its hashes match, there were no scope violations and its lease was retired. The headless run blocked cleanly, with no retry and nothing written. All 22 tests pass.

The scope check has two real holes, both shown by experiment:
- it does not see committed files;
- it does not refuse two different packets begun at the same moment.

Three more problems sit on the Founder's surface:
- the Tower shows the superseded fixed line;
- the Tower reads OFFLINE whenever the factory is idle;
- interactive runs record no session id, so the draft's own independence rule cannot be evidenced.

The DEMO draft contradicts the implemented state machine in four places and gets one CLAUDE.md fact wrong.

Two items need a Founder decision: F3, a periodic regenerator or a relabel, and D1, which transition table is canonical.

## Findings

Severity: **B** = blocking · **M** = must-fix before acceptance · **N** = note.

| ID | Sev | Area | Finding | Evidence | Recommended fix |
|---|---|---|---|---|---|
| F1 | M | `end` scope check | Committing a file hides an out-of-scope write. `before.json` does not record HEAD, and porcelain shows only uncommitted paths. Committing an allowed path is handled correctly, and so is sweeping pre-dirty Main Lane files into a commit. | `dispatch.mjs:63-77`, `:363-364`. Temp-repo experiment (scratchpad `commit-exp*.mjs`): **B** edit clean tracked `App/keep.txt` + `git commit` → `end` exit 0, REVIEW_NEEDED. **C** new `App/new.js` committed → REVIEW_NEEDED. **D** allowed file + report committed → REVIEW_NEEDED (correct). **H** Main-Lane-dirty file swept by `commit -a` → BLOCKED "scope violation: App/keep.txt" (correct). Control **A** (uncommitted) → BLOCKED. | Record `git rev-parse HEAD` in `before.json`. At `end`, add `git diff --name-only <before>..HEAD` paths to the check. BLOCK if HEAD moved and the Control does not allow commits, or if the new HEAD is not a descendant. |
| F2 | M | One run at a time | The "one run at a time" check is not atomic. It reads the `leases/` directory and only then takes a per-packet O_EXCL lease, so two different packets begun together both start. | `dispatch.mjs:210-214` then `lease.mjs:16`. `race.mjs`: concurrent `begin MA-NOV-A1` / `begin MA-NOV-B1` → **14/15 trials both succeeded**. | Take one global O_EXCL lock (e.g. `leases/.global.lock`) before the per-packet lease, and release it at `end`/stale handling. Add a test. |
| F3 | M (Founder decision) | Tower OFFLINE vs idle | Nothing regenerates the Tower on a timer; it is rewritten only on a dispatcher event. The page goes OFFLINE 2×`refresh_s` (60 s) after the last write. So an idle factory, and even a live interactive run, reads OFFLINE. That contradicts spec Q5.4 ("idle … distinct from blocked, held or offline"). | `tower-logic.mjs:5-8`, `project.mjs:161`. README "Day-to-day use" says run it manually. The current Tower was generated at `10:54:11Z` while this run was EXECUTING; at `10:57:46Z` the page is OFFLINE. | Either (a) a `launchd` interval regenerator (needs approval, TCC note at `CLAUDE.md:49`), or (b) change the label to "snapshot N min old (no generator running)", keep OFFLINE for "generator expected but silent", and show "idle" from the snapshot. |
| F4 | M | Tower fixed line | The Tower shows the superseded v1 line. A Founder copying it gets the v1 procedure, which has no `begin`/`end` and so produces an unbracketed run. | `project.mjs:28-35` reads `LANE_OPENER.md`. `control-tower.html` contains "Follow claude/packets/LANE_OPENER.md (sha256 3a5684b4…cae2)". Main Lane finding **confirmed**. | Read `LANE_OPENER_v2.md`, or a `config.json` field naming the current opener. Test that the hash shown equals the file's. |
| F5 | M | Independence evidence | Interactive runs record no `session_id`. BUILD and FIX were not bracketed at all, so their Status `run` holds only prose times. The DEMO draft's §6 rule (distinct session ids) therefore cannot be checked from the records. | `dispatch.mjs:352` (`runRec` has no session field). `MA-NOV-P1.BUILD_Status.json` run: "exact start not recorded". `CLAUDE_CODE_SESSION_ID` is present in the session environment. | `begin` should record `session_id` from `CLAUDE_CODE_SESSION_ID` (null if absent) in the lease, `run` and `before.json`. |
| F6 | M | `end` own-Status check | A worker can edit its own Status (or another packet's) without detection, provided it also bumps `rev`. Writer identity is self-declared: `main-lane` bypasses ownership, and so does any id outside `MA-NOV-*`. | `dispatch.mjs:230`, `:233`; `state.mjs:74-76`. Experiment **F**: worker raw edit `rev+1, blocker:"worker-set"` → REVIEW_NEEDED. | In interactive mode the dispatcher writes nothing between `begin` and `end`. So any own-Status rev change should BLOCK unless a decision-log row covers it. For other packets, log rev bumps in `run.json` for Main Lane confirmation. Document the honour-system writer. |
| F7 | N | Temp-file ignore regex | The regex ignores any dotfile `.<x>.<digits>[.<hex>].tmp` in `claude/packets/` or `claude/factory/`, not only in-flight temp files. The rev-order fix (revs before the git snapshot at `begin`, after it at `end`) is correct. | `dispatch.mjs:123`, `:297-299`, `:223-228`. Experiment **G**: `claude/packets/.payload.123.tmp` → REVIEW_NEEDED. | Require the base name to be an existing Status, board or Tower file. List ignored temp paths in `run.json`. |
| F8 | N | Scope-check blind spots | Gitignored paths, writes outside the repo, and reads are invisible to the check. | Experiment **E2**: write to ignored `.env` → REVIEW_NEEDED. | Document this as a limit. Optionally snapshot `--ignored` for `.env*` paths. |
| F9 | N | `end` caller | `end` does not check that the caller is the lease holder, so any session can end another's run. | `dispatch.mjs:372-379` | Compare the holder pid or session id. Warn on mismatch. |
| F10 | N | Transition history | Status keeps only the latest state. The DEMO path READY→EXECUTING→REVIEW_NEEDED can only be inferred: `before.json` `status_rev 9` (after `begin`), `end` → rev 10, Main Lane → rev 11. Main Lane writes are made by ad-hoc scripts. | `runs/r-…3762/before.json`; `claude/factory/backup/ml-scratch-1.mjs` | Append `{rev, from, to, writer, at}` to `claude/factory/transitions.jsonl` on every `writeStatus`. |
| F11 | N | Docs and records | Several small mismatches: (a) the Control cites `project.mjs --stdout`, which does not exist, and `--check` prints a summary rather than a diff (`project.mjs:5`, `:257`). (b) The DEMO Status `write_owner` says "headless run", but the run was interactive. (c) The headless run c0da is recorded as "worker exit 1", from pre-FIX code; the FIX classifier now covers this exact log (an `assistant` event with `error:"authentication_failed"`), per test 22. (d) The `config.json` model change is uncommitted. | as cited | Main Lane tidy-up. |

**DEMO deliverable** — `claude/governance/Claude_md_v1.2_amendments.md` (sha256 `081c2d56…3f33`):

| ID | Sev | Area | Finding | Evidence | Recommended fix |
|---|---|---|---|---|---|
| D1 | M (Founder decision) | §4 state table | The table contradicts the implemented transitions in four places. (1) EXECUTING→PAUSED/CAPACITY_HOLD is not allowed. (2) DECISION_NEEDED→CLOSED is not allowed. (3) "any→BLOCKED" is not allowed from DRAFT, REVIEW_NEEDED, CHANGES_REQUESTED or APPROVED. (4) `dispatcher-hold` cannot change `state`: the dispatcher sets BLOCKED and then `hold`. The draft's Source line says the README fixes only three transitions, but the code fixes all of them. Root cause: the DEMO Task's read list excluded `state.mjs`. | `state.mjs:16-26`, `:33`; `dispatch.mjs:240-248` | Founder picks the table. Then the code and v1.2 are aligned in one packet. |
| D2 | M | §3.4 | "The dispatcher … copies the verdict into `review{}`" is wrong: the dispatcher may not write `review`. The error is inherited from the Q6.1 spec text. | `state.mjs:30` | Make it "the Main Lane copies the verdict", or add `review` to the dispatcher's fields deliberately. |
| D3 | M | CLAUDE.md patch, line 28 | "`October-2026` stays the Pages source until a Founder-approved go-live" is factually wrong. The October go-live happened on 2026-10-31. | `CLAUDE.md:29` (DEPLOY_BRANCH changed by MA-OCT-REL.SITE) | "`October-2026` `/docs` is the live Pages source (since 2026-10-31)". |
| D4 | N | Patch, line 27 | "VERIFIED 2026-11-07 (MA-NOV-P1.DEMO): `pwd` returned…" claims a check DEMO did not make. Its Task allowed only reading tools, and its report records no such check. | DEMO Task v2; `MA-NOV-P1.DEMO_Report.md` | Use a placeholder filled by the applying packet. |
| D5 | N | §7.1 | "Review … does not count against the execution slot" relaxes WIP in the text only. In code, a review uses `begin`, which takes a lease and blocks every other `begin`, as this run did. | `dispatch.mjs:345` | Align: either reviews hold the slot (current behaviour) or `begin` gets a review mode. |
| D6 | N | §3.1/§3.6 | §3.1 says the "Main Lane [is] sole writer of … state transitions", which conflicts with §3.2. §3.6 says refused writes are "logged", but the code throws and nothing is logged. | `state.mjs:96-97` | Wording, or add logging. |
| D7 | N | Length | 2,139 words against ~1,800 asked. Tables and markup account for most of the excess. **Not material.** | `wc -w` | — |

**Checked and correct in the draft:**
- All seven CLAUDE.md line numbers (5, 27, 28, 44, 48, 75, 79–100) match the file today (`sed -n`).
- The §1 precedence order matches Q6.2 and adds "archives".
- The on-disk location matches Q6.2 (case-insensitive APFS).
- No rule weakens admission, immutable hashes, the Founder interface, secrets or git discipline. §1.2 strengthens them. D5 is the only relaxation.

## Code review notes (no finding)

- **Ownership:** the CAS on `rev` and the temp-file + `rename` write are correct. `wx` is used on the temp file, and a crash before rename leaves the original intact (test 8).
- **Dispatcher fields and transitions:** they match the README. `dispatcher-hold` is limited to `hold`.
- **Eligibility vs `LANE_OPENER_v2` step 4:** same rules (state READY; Founder approval with `at`; both hashes equal to Status and disk; no report), plus lease, pause, hold and `run_profile`.
- **Stale approvals:** a Control or Task changed after approval is refused (test 3). Changing either during a run is caught by the scope check, because neither file is in `allowed_write_paths`.
- **Lease handling:** expiry → BLOCKED with no rerun (tests 6, 20). The lease is renamed, never deleted.
- **Headless mode** (parked): `--tools` and `--allowedTools` are both passed (test 21). Sign-in failure → BLOCKED with no hold (test 22). One attempt, no retry. A quota error → BLOCKED plus `hold` (test 7). The model comes from `config.json` verbatim; null → refused (test 11).
- **Generator:** Node built-ins only; no model calls, network or secrets. The only difference between two runs is `generated_at` (test 13).

**Tests:** `node --test tools/factory/test` → **tests 22, pass 22, fail 0** (9.2 s). Tests 14–15 do not exist; the numbering skips from 13 to 16. Nothing covers F1, F2 or F6.

## Evidence of the loop

- **DEMO `r-20261107T095946Z-3762`:**
  - `run.json` shows interactive, 09:59:46Z→10:01:47Z, REVIEW_NEEDED, `scope_violations: []`, lease not expired.
  - The lease is retired to `runs/…/lease.json`, and `leases/` holds only this review's lease.
  - `report_sha256 e77486eb…5ff7` equals `shasum` of `MA-NOV-P1.DEMO_Report.md`.
  - `start_approval` is bound to Control v2 `5a9934fd…b3b4` and Task v2 `91bdfcb4…ce7c`, and both equal the disk hashes. The v1 approval is kept as `previous_start_approval`.
  - The state path is inferred, not logged (F10).
- **Headless `r-20261107T092212Z-c0da`:**
  - BLOCKED, exit 1, `scope_violations: []`, run once with no retry.
  - The log holds three events: init (model `claude-opus-5-5`), `authentication_failed`, and "Not logged in · Please run /login" with 0 output tokens.
  - No report or other file was written.
- **Independence:**
  - This session id `4e97c250-c0d4-4af3-90fe-c8d87d64a493` and holder pid 5901 appear in no Status or run record.
  - The only recorded session id is `2d9e33d1…` (headless c0da). The DEMO holder pid was 4718.
  - BUILD and FIX have no session ids at all (F5).

## Acceptance checklist (Delivery Spec §10 / Kit §12)

| # | Criterion | Mark | Evidence |
|---|---|---|---|
| 1 | Dispatch → execution → evidence → independent review → Founder gate → record update, without copy-paste relay | **Partly** | No packet text is relayed: only the fixed line is typed. **Manual:** the Founder types the fixed line, and the Founder gate goes through the Main Lane. **Assisted:** the session runs `check`/`begin` and executes; review is a fresh session started the same way. **Automatic:** scope check, report hash, `run.json`, lease retirement and regeneration at `end`. **Manual:** the Main Lane writes the verdict and close-out. Only DEMO and this review were bracketed; BUILD and FIX were not. F1 and F2 weaken the evidence step. |
| 2 | Tests: invalid transition, duplicate launch, stale approval, scope violation, pause, interrupted worker, capacity hold, record-update interruption, stale/offline display | **Met** (stub) | Tests 1, 2+16, 3, 4/4c/18, 5, 6+20, 7, 8, 9 all pass. Gaps: commit-hiding and cross-packet races (F1, F2). |
| 3 | Live and stale/offline states visible in the HTML Tower | **Partly** | The Running card shows mode, holder, run and lease expiry, and the OFFLINE logic is embedded. But OFFLINE also fires when idle or during a live interactive run (F3), and the fixed line is v1 (F4). |
| 4 | One state system; board and Tower are projections; no parallel queue | **Met** | Only `*_Status.json` is read (`project.mjs:64-79`). No YAML or JSON queue exists. The October board is archived. |
| 5 | Model unchanged and verbatim; no secrets in client HTML; no prod/D1/deploy/scheduler/settings change beyond 5b | **Met** | `config.model` is `claude-opus-5-5` (Founder, 09:21Z), and the worker init event shows the same model. The only secret-like word in the Tower is the footer text "no secrets". `git diff --name-only a01ffe2 a74d1b7` shows only `claude/` and `tools/factory/` paths. `.claude/settings.local.json` has 0 `npx wrangler` entries, and the pre-P1 copy is in `claude/factory/backup/`. |

## Could not verify

- **The full state history of DEMO, BUILD and FIX:** there is no transition log, and these Status files are untracked.
- **Who ran BUILD and FIX:** no session ids were recorded.
- **The 5b removal as a git diff:** `settings.local.json` is untracked, so only the current contents and the backup file were checked.
- **The real binary with `--tools`, and real quota-error shapes:** checking them would need a signed-in headless run, which is parked and prohibited here.
- **Tower rendering in a browser:** the logic was checked from source and tests only. No browser was used, because the Control allows no such tool.

Experiments ran in temp repos made by the project's own `helpers.mjs`; nothing in the real repository was touched. The scripts are in this session's scratchpad.

**Reviewer session id:** `4e97c250-c0d4-4af3-90fe-c8d87d64a493` (run `r-20261107T105411Z-2bf1`, holder pid 5901).
