# MA-NOV-P1.REVIEW2 — Architect delta review of MA-NOV-P1.FIX2 — Report

```text
ISSUED BY:    Program Orchestrator (November Main Lane) — Control v1 a8dd81f8…de1d, Task v1 67fe9b21…b3d5
EXECUTED BY:  Architect — fresh interactive Claude Code session, run r-20261107T215253Z-231a, 2026-11-07
REVIEWED BY:  — (this is the review; the Founder decides pilot acceptance)
APPROVED BY:  Founder — Start Approval 2026-11-07T21:52Z ("approve MA-NOV-P1.REVIEW2")
```

## Verdict: **PASS_WITH_NOTES** — all original must-fix items are closed; the Founder can accept the pilot, with notes

Every must-fix item from the first review (F1–F6, D1–D3) is closed, and so are the notes it asked FIX2 to handle (F7, F9, F10, D4–D6). Each was checked by experiment or against the source, not taken from the FIX2 report. The suite passes 32/32.

FIX2 introduced no blocking problem. The commit check still has two blind spots, both found by experiment:
- **G1:** a file added and then removed in two commits is not seen.
- **G2:** a commit on another branch is not seen.

Both should be fixed before any packet whose Control allows commits or a push. Three small notes follow (G3–G5).

## 1. Commit `eb64d22`

| Check | Result |
|---|---|
| Parent / remote | parent `a74d1b7`; `HEAD` = `origin/November-2026` = `eb64d22c…f0a19a3e` |
| Paths | exactly 20: 9 under `tools/factory/` (README, dispatch, lease, state, tower-logic, util, project, helpers, pilot.test), the draft, 10 pinned files. Nothing outside `tools/factory/` and `claude/` (0 paths). |
| Pinned hashes | all 10 committed blobs (`git show eb64d22:<path> \| shasum`) equal FIX2 Task §14. The Task file itself is `f16f2fbd…a992`, which equals `MA-NOV-P1.FIX2_Status.json`. |
| Never-stage list | no Status file, `config.json`, board, Tower, `transitions.jsonl`, `runs/`, `backup/`, decisions log or `.claude/` in the commit. |

## 2. Must-fix closure

Experiments ran in temp repos made with `test/helpers.mjs` (script: this session's scratchpad `exp.mjs`).

| ID | Closed? | Evidence |
|---|---|---|
| **F1** commits | **Closed** | **A** uncommitted edit → BLOCKED. **B** tracked edit committed, no `allow_commits` → BLOCKED (scope + "commits not allowed"). **B2** same with `allow_commits` → BLOCKED (scope). **C** new `App/new.js` committed → BLOCKED. **D** report committed with `allow_commits` → REVIEW_NEEDED. **D2** report committed without it → BLOCKED "commits not allowed". **H** pre-dirty Main Lane file swept unchanged with `allow_commits` → REVIEW_NEEDED, listed in `committed_preexisting_unchanged`; without it (**H2**) → BLOCKED. **H3** pre-dirty file *changed* then committed → BLOCKED. **H4** changed, committed, working tree restored → BLOCKED. So the "unchanged" acceptance cannot launder a changed file. **R** `--amend` → BLOCKED "not a descendant". **R2** `reset --soft HEAD~1` → BLOCKED. New gaps: G1, G2. |
| **F2** global lock | **Closed** | 3-way concurrent `begin` of different packets: **20/20 trials exactly one winner, one lease**. With a live `begin` lock, `check` kept it, and a second `begin` was refused (exit 2). A lock with a live pid, expired or not, was kept. An expired lock with a dead pid and no lease was retired. Residual: G3. |
| **F3 (b)** Tower states | **Closed** | `towerStatus` with `refresh_s` 30. Age 60 s → LIVE. 61 s idle → SNAPSHOT ("Idle — snapshot from … (1 min ago) …"). 61 s with a lease → RUNNING (snapshot), amber. now = expiry → not stale (strict `>`). Expiry + 1 s → STALE RUN, red, checked before LIVE. The generated Tower contains **0** occurrences of "OFFLINE". |
| **F4** fixed line | **Closed** | `control-tower.html` (generated 21:52:53Z by this run's `begin`) shows `Follow claude/packets/LANE_OPENER_v2.md (sha256 67913343…71d6) …`, and that equals `shasum` of the file. `config.json` has no `opener`, so the default applied. |
| **F5 + F9** session ids | **Closed** | This run: lease, Status `run` and `before.json` all hold `a7ec301b-e98c-486c-98e2-ddcdcfa683c9`, which equals `CLAUDE_CODE_SESSION_ID`. `before.json` `head` = `eb64d22`. In a temp repo, begun as `sess-A`: `end` from `sess-B` → exit 2 "begun by another session", and the Status, lease and global lock were byte-identical with no `run.json`. Residual: G4. |
| **F6** own Status | **Closed** | An own-Status write through the state library during the run → BLOCKED "own Status changed during run (rev 2→3)". A raw same-rev edit → BLOCKED "edited outside the state library". |
| **D1** §4 = code | **Closed** | Row by row, the draft §4 table equals `state.mjs` `TRANSITIONS`, the `HELD_STATES` exit (`resume_state`, else READY) and `DISPATCHER_TRANSITIONS`. It states the four "not allowed" cases and "`dispatcher-hold` writes only `hold`; the dispatcher sets BLOCKED first" (matches `dispatch.mjs:331-339`). |
| **D2** §3.4 | **Closed** | Line 69: the Main Lane copies the verdict; `review` is not a dispatcher field. |
| **D3** DEPLOY_BRANCH | **Closed** | Patch line 28: "`October-2026` `/docs` is the live Pages source (since 2026-10-31)". |

## 3. Notes

| ID | Closed? | One line |
|---|---|---|
| F7 | Closed | `isAtomicTemp` rejects `.payload.123.tmp`, temp files of non-existent Status files and `.config.json.1.tmp`. It accepts temp files of existing Status, board and Tower files, and lists them in `ignored_temp_files`. |
| F10 | Closed | `claude/factory/transitions.jsonl` has 5 rows, including this run's `READY→EXECUTING` by `dispatcher` at rev 3. Residual: G5. |
| D4 | Closed | Patch line 27 is now a placeholder "VERIFIED <date> (<packet that applies the patch>)". |
| D5 | Closed | §7.1: a review holds the execution slot, as the code does. |
| D6 | Closed | §3.1 excepts the dispatcher's three transitions. §3.6 says refused writes throw and are not logged, and successful writes go to `transitions.jsonl`. |

## 4. New findings

| ID | Sev | Finding | Evidence | Recommended fix |
|---|---|---|---|---|
| G1 | M (before any commit-allowed packet) | The commit check uses the **net** diff `start..HEAD`. A file added in one commit and removed in a later one is invisible, but it stays in history and would be pushed. Given CLAUDE.md's public-history token incident, this matters. | **N1**: `allow_commits`, commit `App/secret.txt`, then `git rm` + commit → `end` exit 0, **REVIEW_NEEDED**. | Union of `git log --format= --name-only start..HEAD` (every commit's paths), not just the net diff. |
| G2 | M (before any commit- or push-allowed packet) | Only HEAD is compared. A commit on another branch, with HEAD moved back, is invisible even without `allow_commits`. | **N2**: `checkout -b side`, commit `App/side.txt`, check back out → `end` exit 0, **REVIEW_NEEDED**. | Snapshot `git for-each-ref` (heads, tags, remotes) in `before.json`; BLOCK on any ref other than the current branch changing. A moved `refs/remotes/origin/*` also shows a push. |
| G3 | N | A global lock that exists but cannot be parsed counts as an orphan, and `check` retires it straight away. A lock between `open('wx')` and its write is exactly that, so a concurrent `check` or `begin` can retire a live lock in that window. The 20 race trials did not hit it. | An empty `.global.lock` + `check` → retired. | Retire an unparsable lock only if its mtime is older than ~60 s, or write it to a temp file and `link()` it into place. |
| G4 | N | `end` skips the session check when the caller has no `CLAUDE_CODE_SESSION_ID`, e.g. a plain terminal. | Begun as `sess-A`, ended with the variable unset → REVIEW_NEEDED. | Refuse, or at least record "ended without a session id" in `blocked_reason`/`run.json`, when the lease has an id and the caller has none. |
| G5 | N | `transitions.jsonl` is wholly exempt from the scope check, so a worker can append or rewrite history undetected. The Status `rev` stays the real check. | `FOUNDER_ACTION_FILES` (`dispatch.mjs:130`) | Record the file's size and hash in `before.json`; at `end`, check that the old bytes are an unchanged prefix. |

Also noted, no action needed: the draft grew to 2,520 words (rev 1 had 2,139). The Tower's lease card omits `session_id`, although the Status `run` record has it.

## 5. Tests

`node --test tools/factory/test` → **tests 32, pass 32, fail 0** (13.0 s). Afterwards, `git status` shows no test artefacts in the real repo. Nothing tests G1–G5. The 14–15 numbering gap is documented in the test header and README.

## 6. Acceptance checklist (Delivery Spec §10 / Kit §12)

| # | Criterion | First review | Now | Evidence |
|---|---|---|---|---|
| 1 | Dispatch → execution → evidence → independent review → Founder gate → record update, no copy-paste relay | Partly | **Met (assisted)** | This is the first run whose records carry the reviewer's session id (`a7ec301b…`), distinct from FIX2's `61fceddb…`. The commit check (F1) and the global lock (F2) now back the evidence step. |
| 2 | Required tests | Met (stub) | **Met** | 32/32. The commit and race gaps from review 1 are now tested (23–26, 29). G1/G2 are untested. |
| 3 | Live and stale states visible in the Tower | Partly | **Met** | F3 and F4 are closed. Checked from source and the generated HTML only; no browser was allowed. |
| 4 | One state system; projections; no parallel queue | Met | **Met** | Still Status-only. `transitions.jsonl` is a history log, not a queue: nothing reads it to decide work. |
| 5 | Model verbatim; no secrets; no prod/D1/deploy/scheduler/settings change | Met | **Met** | `config.model` is `claude-opus-5-5` (Founder 09:21Z, uncommitted Main Lane edit). `a74d1b7..eb64d22` touches only `tools/factory/` and `claude/`. `settings.local.json` has 0 `npx wrangler` entries. |

**Can the Founder accept the pilot? Yes, with notes.**
- **Conditions of the notes:** G1 and G2 should be fixed, with tests, before the first packet whose `run_profile` sets `allow_commits` or whose Control allows a push. G3–G5 can go into the same fix packet.
- **What stays manual:**
  - The Founder types the fixed line and gives every approval in words.
  - The Main Lane records approvals, copies verdicts into `review{}`, does close-out and confirms `other_status_changes`.
- **What is assisted:** the session runs `check`, `begin`, the work and `end`.
- **What is automatic:** the scope and commit check, the lease and global lock, report hashing, `run.json`, `transitions.jsonl` and Tower and board regeneration.
- **Parked:** the headless mode.

## Could not verify

- Rendering of the Tower in a browser. No browser tool is allowed by the Control.
- The real headless binary, which is parked and prohibited here.
- This run's own `end` record, which is written after this report.

**Reviewer session id:** `a7ec301b-e98c-486c-98e2-ddcdcfa683c9` (run `r-20261107T215253Z-231a`, holder pid 21516). It did not author FIX2: FIX2's session was `61fceddb-61bc-440a-b883-f848b302dd24`.
