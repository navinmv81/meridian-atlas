# MA-SEP-003 — Change Request: recurring weekly local job with kill switch (replaces the daily delta Worker)

**Raised by:** Control (Cowork master-lane session), 2026-08-21, following the DLTINS diagnostic
**Status:** Founder-approved 2026-08-21 (Nav, in conversation) — proceed to execution
**Supersedes:** `MA-SEP-003_Change_Request_Delta_Architecture.md`'s Phase 2 (the daily delta Worker). Phase 1 of that document (one-time local seed) is not superseded — it's promoted into the recurring job below, unchanged in substance.
**Related:** `MA-SEP-003_Spec.md` ("2026-08-21 Architecture Revision v2"), `MA-SEP-003_Build_Brief.md`, `MA-SEP-003_Escalation_Delta_File_Size.md`, `MA-SEP-003_Escalation_CPU_Wall.md`

## What's changing and why

The daily-delta-Worker architecture (previous Change Request) was built on an assumption — "daily deltas are materially smaller than the weekly full file" — that the Phase 2 diagnostic step disproved before any Worker code was written: one part of one day's `DLTINS` delta runs ~452–460 MiB uncompressed, over 5x the weekly `FULINS_C` file, for a CFI-C hit rate of ~0.01%. Real numbers: `MA-SEP-003_Escalation_Delta_File_Size.md`.

**New approach:** the weekly `FULINS_C` file is already exactly what's needed — pre-filtered to funds by ESMA, and a complete snapshot each week rather than a diff. Re-running the already-built, already-tested Phase 1 seed logic on a weekly schedule achieves the same "stay current" goal the delta approach was chasing, with none of its complexity: no four-way record-type branching, no CFI filtering of an unfiltered firehose, no new parsing logic at all. It becomes a **recurring job on the Founder's own machine** (macOS LaunchAgent), not a Cloudflare Worker — the same category of mechanism already used in this codebase for MA-AUG-003's `financialfact_reported` backfill.

**Explicit Founder requirement, not optional:** because this job now runs indefinitely on a recurring schedule rather than once, it needs a real control surface — a way to install it, pause it, fully stop it, and check its status — rather than firing forever with no off switch short of manually deleting system files. Full design below and in `MA-SEP-003_Spec.md` Requirement 6.

## Design: the control surface (the "kill switch")

Four scripts, living under `App/Corporate Atlas/scripts/` (exact filenames for the build session to confirm against existing naming conventions in that folder):

1. **`firds-seed-install.sh`** — writes `~/Library/LaunchAgents/com.meridianatlas.firds-weekly-seed.plist` and loads it (`launchctl bootstrap gui/$(id -u) <path>`, with `launchctl load` as a compatibility fallback on older macOS). Schedules the seed script weekly, comfortably after ESMA's ~09:00 CET Sunday publish — exact local time set against the machine's real timezone (`date` output), not assumed.
2. **`firds-seed-uninstall.sh`** — the hard stop / kill switch. Unloads the LaunchAgent (`launchctl bootout gui/$(id -u) com.meridianatlas.firds-weekly-seed`) and deletes the `.plist` file. After this runs, nothing fires again on any schedule until `install` is explicitly re-run. This is the answer to "how do I make this stop, permanently, right now."
3. **`firds-seed-pause.sh`** / **`firds-seed-resume.sh`** — soft stop/start. Creates/removes a flag file (`App/Corporate Atlas/.firds-seed-paused`). The seed script checks for this file as the very first thing it does — before any network call or D1 write — and if present, logs "paused, skipping this run" and exits immediately, at zero cost. The LaunchAgent stays loaded and scheduled; each fire while paused is a true no-op. Lets the Founder pause without touching `launchctl` at all, and resume just as easily.
4. **`firds-seed-status.sh`** — reports, in one glance: is the LaunchAgent currently loaded (`launchctl print gui/$(id -u)/com.meridianatlas.firds-weekly-seed`), is the pause flag currently set, and when the job last ran with what outcome — read from a log file (`App/Corporate Atlas/logs/firds-seed.log`) the seed script appends one line to on every invocation (timestamp, outcome: success/paused/error, row-count deltas).

**Acceptance for this control surface specifically:** all four scripts exist and are each exercised at least once during the build session — a real run fires, gets paused, a paused fire is confirmed to be a true no-op (check the log — no network calls, no D1 writes), gets resumed, and the whole thing is uninstalled and reinstalled cleanly. Not just written — actually run and observed working.

## Impact analysis

- **Phase 1's already-built seed script is reused, not rewritten** — it just gains the pause-flag check at the top and gets wired to a LaunchAgent instead of being a one-off manual invocation.
- **`meridian-firds`'s Worker deployment is retired.** It served its purpose (proving the chunked approach was viable, then proving it wasn't, at real scale, with real bugs found and fixed along the way) but has no ongoing role under this architecture. Recommend the next session actually undeploy it (`wrangler delete` or equivalent) and remove the now-dead `FIRDS_PROGRESS` KV namespace, rather than leaving a disabled, unused Worker sitting in the account indefinitely — flagged as a decision for the build session, not assumed here.
- **No Cloudflare Cron Trigger is used by this packet at all.** The account's 5/5 Cron Trigger situation, and the `entities-enrich` subrequest-ceiling risk found while investigating it, remain real and worth resolving on their own — but MA-SEP-003 is now fully decoupled from that resolution. `MA-SEP-003_Change_Request_Cron_Consolidation.md` stays open as its own independent item.
- **No schema change.** `firds_instrument_reference` as specced is unchanged. Termination/cancellation handling, which the delta approach needed new logic for, is no longer needed — a full-snapshot weekly re-pull handles it implicitly (an instrument absent from this week's file simply isn't refreshed; existing retention policy already treats rows as "keep forever" once seen).
- **New operational dependency:** the pipeline's ongoing freshness now depends on the Founder's Mac being on and awake around the scheduled weekly time. This is the same category of dependency MA-AUG-003's LaunchAgent-based backfill already carries — not a new risk category for this codebase, but worth naming. The `status` script exists specifically so a missed run is visible rather than silently discovered weeks later.

## Rollback plan

- Full rollback is the kill switch itself: `firds-seed-uninstall.sh` removes all future scheduling in one step, no partial states to clean up.
- The seed script's writes remain `INSERT OR IGNORE` throughout — a bad run (partial fetch, malformed file, etc.) cannot corrupt existing data; at worst it fails to add anything new, visible via the status log.
- If the control scripts themselves have a bug, the LaunchAgent can be removed directly via standard `launchctl`/`rm` commands without depending on the scripts working correctly — no hard dependency of the kill switch on the rest of the tooling.

## Approvals

Approved by Founder (Nav) in conversation, 2026-08-21, immediately after reviewing the real `DLTINS` diagnostic numbers that ruled out the daily-delta-Worker approach. Proceed to execution: next local Claude Code session builds the control surface, verifies one real weekly run end-to-end (including exercising pause/resume/uninstall), and retires the unused Worker deployment. See revised `MA-SEP-003_Build_Brief.md`.
