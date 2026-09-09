# MA-SEP-016 — Retire Legacy Exception Tooling, Close Admin-Routes Exposure, Confirm Known Issue 22.26 (Build Brief)

**Role: Entities Product Lead. Packet: MA-SEP-016.**

*Drafted 2026-09-06 by the Control master-lane Cowork session, directly from the Founder's reconciliation of MA-SEP-015c's close-out findings (four decisions, all "Recommended" options selected via AskUserQuestion). This is a durable Project doc per this project's standing rule — Build Briefs are never left as in-conversation prompt text.*

---

## Context

MA-SEP-015c closed 2026-09-06 with two disclosed carried-forward items and two new findings. This packet resolves the four items the Founder decided to act on now:

1. `DROP TABLE entity_merge_exceptions` — safety gate satisfied twice over (re-verified field-for-field twice, most recently 2026-09-06); Founder go-ahead now given.
2. The old secret-gated `/admin/exceptions` routes on `meridian-entities-api` are still live — retry a narrower fix than the full-deletion edit that tripped the local session's safety classifier twice during MA-SEP-015c.
3. Known Issue 22.1 (unexplained Sunday `entities-seed` firing) recurred a third time (2026-09-06) — priority bumped, but the real root-cause step needs the Founder's own direct Cloudflare Workers Observability dashboard access, which no local session's API token has ever had. This packet cannot close that gap by itself — see Part 4.
4. A new, unconfirmed finding — `entities-seed`'s weekly write path may be stamping `updated_at` on the entire `entity_master` table regardless of content change (29,839 rows touched in one window 2026-09-06, only 86 genuinely new) — same defect shape as the already-fixed Known Issue 22.8, much larger blast radius. Code-confirm only in this packet.

Full evidence for all of the above: `claude/MA-SEP-015c_Closeout_Summary.md`.

---

## Part 1 — Retire `entity_merge_exceptions`

1. Immediately before dropping, re-confirm current state one more time (cheap, belt-and-suspenders): row count and content of `entity_merge_exceptions` (expect 3, unchanged since MA-SEP-015b's migration), and row count of `entity_exceptions` (expect 9 — the 3 migrated rows plus MA-SEP-015c's 6 seeded rows for Known Issues 22.9/22.17).
2. `DROP TABLE entity_merge_exceptions`.
3. Confirm via a schema query (`SELECT name FROM sqlite_master WHERE type='table'` or D1's equivalent) that the table no longer exists.
4. Grep the repo for any remaining reference to `entity_merge_exceptions` — expect zero, since MA-SEP-015b/015c already moved all routes off it. If anything remains, report it rather than silently removing it.

## Part 2 — Close the old `/admin/exceptions` exposure (narrower approach)

The full-deletion edit was attempted twice during MA-SEP-015c and blocked both times by the local session's own safety classifier. Do **not** retry full deletion of the route handlers or `checkAdminExceptionsAuth` itself.

Instead: modify `checkAdminExceptionsAuth` so it unconditionally returns a rejection (401, 403, or 410 — pick whichever fits the existing response-shape conventions in this file) for every call, regardless of any secret header presented. Leave the route dispatch entries and the function's existence in place — only its behavior changes, from "check a secret" to "always reject."

Live-verify: GET, POST, and PUT to `/admin/exceptions` all now return the rejection status, tested both with no secret header and with the old (already-rotated) secret value. Confirm this doesn't touch or interact with the new Cloudflare Access-protected `/exceptions` routes from MA-SEP-015b/c in any way — they should behave exactly as before.

Note for the record: this step closes the "old routes still technically reachable" concern. It does not change anything about the 2026-08-31 secret-rotation incident's resolution — Cloudflare Access already fully supersedes the shared-secret model for the exceptions surface; this is closing a leftover door, not fixing a live secret risk.

## Part 3 — Confirm or deny Known Issue 22.26 (code read only, no fix)

Read `entities-seed.js`'s write path — the weekly logic that inserts/updates `entity_master` rows. Confirm or deny: does it lack a content-diff `WHERE` clause (the same defect class already fixed in Known Issue 22.8, which touched `firds_instrument_reference`'s refresh logic), such that it stamps `updated_at` on a row even when no field actually changed?

Report back: the exact write statement(s) involved, file/line reference, and a clear confirmed/denied verdict. If confirmed, note whether the same fix shape as 22.8 (a stored-vs-incoming content comparison added to the `WHERE` clause) would apply directly, and roughly how large that diff would be — but do **not** implement the fix in this packet. This is a confirm-only step; the fix (if confirmed real) is its own future small packet.

## Part 4 — Known Issue 22.1, third recurrence (not a build task)

This item cannot be closed by this packet. Root-causing the unexplained Sunday `entities-seed` firing requires the Founder's own direct Cloudflare Workers Observability dashboard access — no local session's API token has ever had the necessary scope, across all three occurrences (2 Aug, 9 Aug, 6 Sep).

Deliverable for this packet: write a short, concrete checklist of exactly what to look for in the dashboard (Workers → `entities-seed` → Trigger Events / Logs, filtered to the Sunday 04:00 UTC windows on 2026-08-02, 2026-08-09, and 2026-09-06) so that whenever the Founder has a few minutes with the dashboard open, the check is mechanical rather than exploratory. Hand this checklist back in the close-out report — do not attempt to fetch or infer dashboard data through any other means.

## Do not do

- No other Known Issue touched in this packet.
- No ETF-domain table or Worker touched.
- No change to `entity_exceptions`' row content — that population is MA-SEP-015c's own closed scope, not reopened here.
- No scope creep into the October exceptions-UI revamp the Founder separately flagged — that is unscoped, tracked separately, not part of this packet.

## Approval needed

None further — all four actions in this Build Brief were already Founder-approved via this session's AskUserQuestion tool, 2026-09-06 (each via its "Recommended" option).

## Close-out evidence required

- Part 1: confirmation of the pre-drop re-verification counts, confirmation the `DROP TABLE` executed, confirmation via schema query the table no longer exists, and the repo-wide grep result.
- Part 2: the exact code change to `checkAdminExceptionsAuth`, and the live-verification results for all three routes (GET/POST/PUT) under both no-secret and old-secret conditions.
- Part 3: the confirm/deny verdict, exact write statement(s)/line references, and (if confirmed) the estimated fix shape/size — no fix implemented.
- Part 4: the dashboard-check checklist, handed back verbatim.
- Standard: exact commit hash(es), independent `HEAD`/`origin` confirmation (this project has hit real drift between the two before), and a one-line outcome note for the Sprint Board per this project's Session Discipline rule.
