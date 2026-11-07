# MA-NOV-P1.REVIEW — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-07
EXECUTED BY:  Architect — fresh session via LANE_OPENER_v2.md
REVIEWED BY:  —
APPROVED BY:  Founder — Start Approval in MA-NOV-P1.REVIEW_Status.json
CONTROL:      claude/packets/MA-NOV-P1.REVIEW_Control_v1.md
```

You did not write any of the work under review. Review it against the specification, not against the authors' own reports. Read the reports for claims, then check the claims.

## 1. Code (`tools/factory/`, commits `2d41378`, `a74d1b7`)
- State library: field ownership (dispatcher / dispatcher-hold / main-lane), transition table, compare-and-swap on `rev`, temp-file + rename. Is any path able to write a field its writer does not own?
- Eligibility vs `LANE_OPENER_v2.md` step 4 — same rules? Any way two packets run at once, or an approval survives a Control/Task change?
- `begin`/`end`: lease semantics, expiry, `before.json`, scope check. **Specifically check:** a packet whose Control allows git commits — does `end`'s porcelain/hash comparison treat committed files correctly, or would a legitimate commit look like a violation (or hide one)? Use a temp-repo experiment if needed.
- The two concurrency fixes in the FIX report (temp-file ignore regex; rev read order) — correct and not over-broad?
- Headless path (parked by Founder choice B): `--tools`, sign-in classification, no-retry, capacity hold.
- Generator: deterministic, no model or network calls, OFFLINE logic, idle vs blocked vs held. **Known Main Lane finding to confirm:** `project.mjs` reads `LANE_OPENER.md` (v1) for the fixed line, so the Tower shows the superseded line.
- Run `node --test tools/factory/test`; record pass/fail counts.

## 2. Evidence of the loop
- DEMO run `r-20261107T095946Z-3762`: Status history (`rev`, state path READY→EXECUTING→REVIEW_NEEDED), `run.json`, `before.json`, lease retired, `report_sha256` = actual report hash, no scope violations; approval bound to Control v2 / Task v2 hashes.
- Blocked headless run `r-20261107T092212Z-c0da`: BLOCKED, no retry, nothing written.
- Independence: confirm your session id differs from every run's session/run id recorded in the Status files and run folders.

## 3. DEMO deliverable (`claude/governance/Claude_md_v1.2_amendments.md`)
Accuracy against its cited sources; any rule that would weaken an existing safeguard (admission, immutable hashes, separation of duties, Founder interface, secrets, git discipline); the proposed `CLAUDE.md` patch lines — correct line numbers and facts; length (~2,140 words vs ~1,800 asked) — material or not.

## 4. Acceptance checklist (Delivery Spec §10 / Kit §12) — mark each met / not met / partly, with evidence
1. Dispatch → execution → evidence → independent review → Founder gate → record update, without copy-paste relay (state which steps are automatic / assisted / manual).
2. Tests shown: invalid transition, duplicate launch, stale approval, scope violation, pause, interrupted worker, capacity hold, record-update interruption, stale/offline display.
3. Live state and stale/offline states visible in the HTML Tower.
4. One state system (Status JSON); board and Tower are projections; no parallel YAML/JSON queue.
5. Model unchanged and passed verbatim; no secrets in client HTML; no production, D1, deploy, scheduler or settings change beyond the approved 5b removal.

## Report — `claude/packets/MA-NOV-P1.REVIEW_Report.md`
Four-line header; **verdict**; findings table (id, severity, area, finding, evidence, recommended fix); acceptance checklist; what you could not verify and why; your session id. Keep it under ~1,500 words plus tables. Then run `end` and stop.
