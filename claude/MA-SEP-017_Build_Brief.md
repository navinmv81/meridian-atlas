# MA-SEP-017 — Fix Known Issue 22.26, Retire the Dead Snapshot-Export Tooling (Build Brief)

**Role: Entities Product Lead. Packet: MA-SEP-017.**

*Drafted 2026-09-09 by the Control master-lane Cowork session, directly from the Founder's two decisions on MA-SEP-016's close-out findings (both via AskUserQuestion, both "Recommended" options selected). Durable Project doc per this project's standing rule — Build Briefs are never left as in-conversation prompt text.*

---

## Context

MA-SEP-016 closed 2026-09-09 having confirmed Known Issue 22.26 (code-read only, no fix) and surfaced a new one, Known Issue 22.27, while retiring `entity_merge_exceptions`. This packet closes both:

1. **Known Issue 22.26** — `entities-seed.js` stamps `updated_at` on every `entity_master` upsert regardless of whether content actually changed, at three sites. Same defect shape as the already-fixed Known Issue 22.8. Fix confirmed transferable directly.
2. **Known Issue 22.27** — `export-exceptions-snapshot.mjs` (MA-SEP-012c/d's local snapshot tool) still queries the now-dropped `entity_merge_exceptions` table and would error if run. Founder decision: delete it — fully superseded by the live `/exceptions/ui` page, nothing depends on it.

Full evidence for both: `claude/MA-SEP-016_Closeout_Summary.md`.

---

## Part 1 — Fix Known Issue 22.26

Per MA-SEP-016's confirmed findings, add a content-diff condition to the `WHERE` clause of each of the three `entity_master` upsert sites in `App/Corporate Atlas/src/entities-seed.js`:

- `seedFundEntities` (confirmed at lines 249–251 as of MA-SEP-016's close-out — re-check current line numbers before editing, since MA-SEP-016 itself touched this file)
- `seedManagerEntities` (confirmed at lines 295–297)
- `seedIssuerEntities` (confirmed at lines 375–377)

Each currently reads `INSERT ... ON CONFLICT(normalized_name, type) DO UPDATE SET updated_at = CURRENT_TIMESTAMP` unconditionally. Per MA-SEP-016's own confirmation, the fix shape is directly transferable via SQLite's `ON CONFLICT ... DO UPDATE SET ... WHERE <diff-condition>` — no separate `UPDATE` pass needed (unlike Known Issue 22.8's shape, which touched a different file/pattern in `firds.js`). Use the same stored-vs-incoming, null-safe (`IS NOT`-guarded) comparison style already shipped for Known Issue 22.8 as the reference pattern, adapted to whatever columns each of these three sites actually writes.

**Before changing anything:** re-read all three call sites in full (not just the flagged line ranges) to confirm what "content changed" should mean for each — the three functions write different column sets (fund vs. manager vs. issuer entities), so the diff condition is not necessarily identical across all three.

**Live-verify:** run (or wait for) a real weekly `entities-seed` fire and confirm, via a `updated_at` delta count before/after, that only genuinely-changed rows have their `updated_at` bumped — mirroring the before/after `COUNT(*)`/`MAX(last_updated_at)` verification style already used for Known Issue 22.8. If waiting for the real Monday cron isn't practical within this packet's timeline, a manual `/run`-triggered fire (same mechanism already used for Known Issue 22.13/MA-SEP-010) is an acceptable substitute — state which was used in the close-out report.

## Part 2 — Retire the dead snapshot-export tooling (Known Issue 22.27)

1. Delete `App/Corporate Atlas/export-exceptions-snapshot.mjs` (MA-SEP-012c's script — queries the now-dropped `entity_merge_exceptions` table, fully superseded by the live `/exceptions/ui`).
2. `App/Corporate Atlas/refresh-exceptions-snapshot.command` (MA-SEP-012d's one-click wrapper) is a thin wrapper around the script above with no independent purpose — delete it too, since it would only ever fail once its target script is gone. Confirm nothing else references either file before deleting (repo-wide grep, same discipline MA-SEP-016 used to find this issue in the first place).
3. `App/Corporate Atlas/entity-exceptions-snapshot.html` (the generated, gitignored-since-MA-SEP-012d output file) — leave on disk if present; it's already gitignored and harmless as a stale artifact, but note its presence/absence in the close-out report. Do not spend effort chasing it down if it's not there.
4. Confirm via repo-wide grep that no other file references `entity_merge_exceptions` anywhere in the repo after these two deletions — this should now return zero hits (MA-SEP-016 found exactly these two prior to this packet).

## Do not do

- No change to `entity_exceptions`' schema or row content.
- No other Known Issue touched in this packet.
- No ETF-domain table or Worker touched.
- No attempt to resolve MA-SEP-016's Part 1 documentation-history discrepancy (the disputed `entity_merge_exceptions` drop timeline) — that is a closed, disclosed, unresolved record-keeping question, not a task for this packet. If a Cloudflare D1 Time Travel lookup ever becomes available, that's a separate, Founder-only action.
- No action on Known Issue 22.1 — still gated on the Founder's own Cloudflare dashboard walkthrough per MA-SEP-016's delivered checklist.

## Approval needed

None further — both actions in this Build Brief were already Founder-approved via this session's AskUserQuestion tool, 2026-09-09 (each via its "Recommended" option).

## Close-out evidence required

- Part 1: the exact diff for all three `WHERE` clauses, the content-diff condition chosen for each (and why, given the three sites write different columns), and the before/after verification numbers from a real or `/run`-triggered fire.
- Part 2: confirmation both files are deleted, the repo-wide grep result showing zero remaining `entity_merge_exceptions` references, and a note on whether the generated `.html` snapshot file was found on disk.
- Standard: exact commit hash(es), independent `HEAD`/`origin` confirmation, and a one-line outcome note for the Sprint Board per this project's Session Discipline rule.
