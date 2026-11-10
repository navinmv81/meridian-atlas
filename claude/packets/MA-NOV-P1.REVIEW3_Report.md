# MA-NOV-P1.REVIEW3 — Light Architect delta review of MA-NOV-P1.FIX3 — Report

```text
ISSUED BY:    Program Orchestrator (November Main Lane) — Control v1 30feeefd…6a1c, Task v1 a6877ece…e67c (both match Status)
EXECUTED BY:  Architect — fresh interactive Claude Code session, run r-20261109T183512Z-e465, 2026-11-09 (did not author FIX3)
REVIEWED BY:  — (this is the review; lifting NML-1108-2 is the Founder's decision)
APPROVED BY:  Founder — Start Approval 2026-11-09T06:59Z ("approve MA-NOV-P1.REVIEW3")
```

## Verdict: **PASS_WITH_NOTES**

G1–G5, the closure path and the Outcomes view are all closed. I checked each one by my own experiment in temp repos (`test/helpers.mjs`, scripts in this session's scratchpad), not from the FIX3 report. Two small new notes (H1, H2) came out of edge probes. Neither blocks anything.

## Closure table

| Item | Closed? | Evidence |
|---|---|---|
| Commit `37ad1c2` | Yes | Parent `eb64d22`; HEAD = `origin/November-2026`. 41 paths: 5 `tools/factory/`, the FIX3 Task, 35 pinned. **35/35 committed blobs equal the §9 hashes.** The Task blob `fa9f1555…` equals the Status. 0 paths outside `tools/factory/` and `claude/`. |
| G1 add-then-remove | Yes | N1 (`App/secret.txt` added, then `git rm` across two commits, `allow_commits`) → exit 3 **BLOCKED** "scope violation: App/secret.txt". Extra probe: a file added inside a merge commit, then removed, with the side branch deleted → BLOCKED as well. |
| G2 other refs | Yes (see H1) | N2 (commit `App/side.txt` on `side`, return; no `allow_commits`) → **BLOCKED** "ref changed: refs/heads/side". A new tag → BLOCKED. `refs` deleted from `before.json` → REVIEW_NEEDED with `ref_check: "unavailable"`. This run's own `before.json` has `refs` (19 refs), `transitions` {size 3049} and `head` `37ad1c2`. |
| G3 young lock | Yes | Empty `.global.lock` + `check` → lock kept. A following `begin` → exit 2 "another run holds the global lock". |
| G4 no session id | Yes | Lease `sess-A`; `end` with the variable empty → exit 2, and with it unset → exit 2 "end needs the session that began the run". The Status was byte-identical afterwards. |
| G5 log rewrite | Yes | First byte dropped → BLOCKED "transitions log rewritten". Truncated to empty → BLOCKED. Appended → REVIEW_NEEDED, `transitions_check: "append-only"`. |
| Closure path | Yes (see H2) | `main-lane` + `closure_by` = CLOSED packet → accepted. Refused: no `closure_by`, `closure_by` not CLOSED (TransitionError), writer `dispatcher` (OwnershipError), unknown writer. |
| Outcomes view | Yes | The real generated board has a `## November scope — outcomes` table: BOND/EXP/HOME/OPS requirement ids, CARRY items and the CARRY observation. The real Tower *November scope* section contains BOND-12, EXP-01, HOME-07, OPS-06, CARRY items and observations. None of the 5 outcome ids appears in any of the 8 other Tower sections. 0 "OFFLINE". |
| Test 12 change | Acceptable | `git diff eb64d22 37ad1c2` of the existing tests changes only the header comment, the import and one filter line in test 12 (`!SCOPE_KINDS.includes(kind)`). That is the correct fix for the pre-existing 31/32 failure, not a weakening. |
| Tests | Yes | `node --test tools/factory/test` → **tests 40, pass 40, fail 0** (15.6 s). `git status --porcelain` was unchanged before and after. |

## New findings

| ID | Sev | Finding | Evidence | Fix |
|---|---|---|---|---|
| H1 | N (fix before the first **push**-allowed packet) | `refChanges` skips the branch HEAD is on **at `end`**, not at `begin`. A run can create a branch and finish on it without being flagged. With `allow_commits`, its commits there are accepted, and `refs/remotes/origin/<that branch>` would be skipped too, so a push of a new branch would pass. Committed paths are still scope-checked, so no out-of-scope file gets through. | `checkout -b stay` (no commits) → REVIEW_NEEDED, `ref_check: checked`. `checkout -b stay2` + commit the report with `allow_commits` → REVIEW_NEEDED. | Record the start branch in `before.json`, skip only that branch, and BLOCK "branch changed" if the end branch differs. |
| H2 | N | `closure_by` is not validated as a packet id: `../packets/MA-NOV-XB` was accepted, because the path resolves to the same file. Only `main-lane` can write it. | `exp3.mjs` | Require an id pattern such as `/^MA-[A-Z0-9.-]+$/`. |

Also noted, no action needed: the code proves only that the `closure_by` packet is CLOSED. Whether its review covered the requested changes stays a Main Lane judgment, and README line 79 says so in passing.

## Recommendation: may commit-allowed packets now be admitted? **Yes, with notes**

- Packets with `allow_commits` and **no push** may be admitted now. Have the Main Lane confirm that `run.json` `end_head` is on the expected branch until H1 is fixed.
- Before the first Control that allows a push, fix H1, with a test. H2 can go in the same small fix.

**Reviewer session id:** `3beccc2c-b18f-4a44-a884-1e7b2bab7eac` (run `r-20261109T183512Z-e465`). FIX3's session was `4dae9d0d-531f-40d8-a048-c9621b2d1332`.
