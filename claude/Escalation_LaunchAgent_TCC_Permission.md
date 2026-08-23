# Escalation — macOS TCC blocks all launchd-spawned `node` jobs from reading `~/Desktop`, silently, since at least 2026-08-21

**Raised by:** local Claude Code session, 2026-08-22, during MA-SEP-003's control-surface build/test session
**Status:** RESOLVED 2026-08-22 — both the TCC permission block and the follow-on PATH bug are fixed and confirmed via real `launchctl kickstart -k` fires of all three LaunchAgents, with real log output (not just "no error thrown"). See "Update 2026-08-22" and "Resolution 2026-08-22 (PATH fix + real re-fire verification)" below.
**Scope:** Cross-packet. Found while testing MA-SEP-003, but affects two already-CLOSED packets' recurring jobs as well.

## What was found

MA-SEP-003's new weekly LaunchAgent (`com.meridianatlas.firds-weekly-seed`) fires correctly (`launchctl` confirms it loads and is scheduled), but the actual triggered run fails immediately with:

```
Error: EPERM: process.cwd failed with error operation not permitted, uv_cwd
```

The local session isolated the cause with disposable `launchctl submit` test jobs: **macOS TCC (Transparency, Consent & Control) blocks `node`, when spawned by `launchd` with no Finder/Terminal consent chain, from touching anything under `~/Desktop/...` — including a plain `readFileSync`.** This is not a bug in any of the four control scripts or in `firds-local-seed.mjs`; it's an OS-level permission wall that only a `launchd`-spawned process hits (the same binary run directly from a Terminal shell — which already carries Desktop consent — works fine, which is how the session was still able to genuinely exercise the script logic).

## Why this is bigger than MA-SEP-003

The session checked whether the two other existing LaunchAgents in this codebase — `com.meridianatlas.financialfact-backfill` (MA-AUG-003, closed 2026-08-12) and `com.meridianatlas.health-check` — actually run, since they're the same class of mechanism against the same protected folder. **They don't.** Both have been failing with this identical EPERM on every scheduled fire since at least 2026-08-21 (backfill's 09:00 slot, health-check's 18:00 slot), invisible because their output goes to log files nobody was actively checking.

This means:
- **MA-AUG-003's `financialfact_reported` backfill has not actually run since ~2026-08-21**, despite being reported CLOSED with ~202,000 rows landed as of 2026-08-08. No data corruption — the backfill is `INSERT`-based and simply hasn't fired, so nothing is wrong with existing rows — but any assumption that coverage kept climbing past 2026-08-21 is not currently true.
- The health-check watchdog (delivered under MA-AUG-004, itself flagged at the time as "deliberately scoped down") has also not been running, so it has not been catching anything since the same date.

Neither of these is a MA-SEP-003 defect — they predate this packet's work entirely and were only discovered because this packet built and tested a new LaunchAgent of the same kind.

## The fix

A one-time macOS permission grant: add the `node` binary to **Full Disk Access** in System Settings → Privacy & Security. This is a GUI-consent action tied to the logged-in Founder — it cannot be performed by:
- the local Claude Code session (falls under "modifying system or security settings," correctly declined), or
- this Cowork session (the device bridge has no path to TCC's consent database; TCC additions require the System Settings GUI or a signed MDM profile, neither available here).

**Before granting anything: confirm the exact `node` binary path actually in use**, rather than assuming `/usr/local/bin/node`. This machine is Apple Silicon (arm64) — a Homebrew-installed `node` on Apple Silicon normally resolves to `/opt/homebrew/bin/node`, not `/usr/local/bin/node` (that path is the Intel Homebrew / some `nvm` default). Granting Full Disk Access to the wrong path fixes nothing. Confirm with `which node` in a Terminal, and/or check what binary path the LaunchAgent `.plist`s actually invoke (`cat ~/Library/LaunchAgents/com.meridianatlas.firds-weekly-seed.plist`, same for the other two) — if `node` is a symlink, TCC generally needs the real resolved binary added, not the symlink path.

Alternative (not recommended, much bigger change): move `LOCAL_MASTER` outside `~/Desktop` entirely, since folders like `~/Documents` and `~/Downloads` carry the same TCC protection under recent macOS versions — this doesn't actually avoid the problem, just relocates it. Full Disk Access is the correct fix, not a folder move.

## Once granted

Fixes all three LaunchAgents at once (`firds-weekly-seed`, `financialfact-backfill`, `health-check`) — worth testing all three, not just re-firing MA-SEP-003's. Verify each with its own `launchctl kickstart -k gui/$(id -u)/<label>` and checking that run's log output actually shows real activity (not just "no error").

## Update 2026-08-22 — permission fix CONFIRMED working; a second, unrelated blocker found immediately after

Founder granted the narrower of the two options discussed (Privacy & Security → **Files and Folders → Desktop Folder** for `/usr/local/bin/node`, not the broader Full Disk Access) after a live walkthrough of exactly what each option exposes. This is the scoped fix, not the blanket one — it covers only `~/Desktop/...`, not Mail/Messages/Photos/Documents/etc.

**Confirmed working, with direct before/after evidence from the real `launchd`-triggered log:**
- Before the grant: `launchctl kickstart -k` on the FIRDS LaunchAgent failed before the script could execute any of its own code (`EPERM: process.cwd failed`) — no log line was even written.
- After the grant: the identical `launchctl kickstart -k` command produced a full log entry (`2026-08-22T08:21:35.835Z`) showing the script started, read its own files, and ran real logic through to a database-call attempt. Confirms the TCC/Desktop-folder block is resolved for real `launchd`-spawned fires, not just for Terminal-run tests.

**New, separate, unrelated finding — a PATH problem, not a permission problem:** that same fire then failed with `spawnSync npx ENOENT`. `launchd` runs jobs with a minimal default `PATH` (`/usr/bin:/bin:/usr/sbin:/sbin`) that does not include `/usr/local/bin`, where this machine's `node` (`/usr/local/bin/node`) and `npx` (`/usr/local/bin/npx`, confirmed via `which npx`) both live — unlike an interactive Terminal session, which loads the full shell-profile PATH. This is a plain config/code fix, not a security or OS-consent issue, and is the same class of bug that likely also affects `financialfact-backfill` and `health-check`, since both shell out to `wrangler` the same way.

**Recommended fix (for the next build session):** add an explicit `PATH` entry (including `/usr/local/bin`) to each of the three LaunchAgent `.plist`s' `EnvironmentVariables` dict, rather than patching every individual `spawn`/`spawnSync` call inside each script — one fix per plist covers any subprocess call the script makes, not just the `npx wrangler` one found so far.

## Resolution 2026-08-22 (PATH fix + real re-fire verification)

**Fix applied:** added an explicit `EnvironmentVariables` → `PATH` entry (`/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin`, node's actual resolved directory listed first) to all three `.plist`s — `com.meridianatlas.firds-weekly-seed`, `com.meridianatlas.financialfact-backfill`, `com.meridianatlas.health-check`. Fixed at the plist level (not by patching individual `spawn`/`spawnSync` calls in each script) so it covers any subprocess call any of the three scripts make, not just the one `npx wrangler` case found. `App/Corporate Atlas/scripts/firds-seed-install.sh` was also updated to bake this into any future reinstall, so a re-run of that script doesn't silently regress and drop the fix. The other two plists have no install script — they're hand-maintained; the fix lives only in the `.plist` file itself for those two.

**All three unloaded and reloaded** (`launchctl bootout` + `bootstrap`) so the edits took effect, then **all three re-fired for real via `launchctl kickstart -k gui/$(id -u)/<label>`**, with real log output confirmed for each (not just absence of error):

- **`health-check`** — ran clean: real D1 headroom check (`99814/100000 remaining`), "All clear" output, no errors.
- **`financialfact-backfill`** — ran a real batch: 144 issuers processed, 11,316 logical rows / 19,431 real Cloudflare rows written, persisted offset advanced `2470 → 2605` (1,206 issuers remaining in the pool of 3,811 non-priority issuers). Real SEC EDGAR fetches, real D1 writes, real offset persistence — genuinely working, not just error-free.
- **`firds-weekly-seed`** — ran a real batch against a genuinely new file (`FULINS_C_20260822_01of01.zip`, not the same file as the prior manual test): `firds_instrument_reference` 18,353→18,384 (+31), `entity_isin_map` 36,859→36,893 (+34), `instrument_master` 72,754→72,785 (+31), `entity_master` 43,555→43,578 (+23), `entity_enrichment_queue` +0 (expected, see MA-SEP-003_Build_Brief.md). Confirms the LaunchAgent path genuinely round-trips: ESMA fetch → parse → D1 write → row-count delta, not a manual-invocation-only success.

**Financialfact-backfill catch-up assessment (per Founder's explicit request, no manual catch-up run performed):** offset was stuck at 2470 since the outage began (~2026-08-21); the forced re-fire above advanced it to 2605. Remaining pool: 1,206 issuers ÷ 135/day (`AUTO_BATCH_SIZE`) ≈ 9 more daily fires to reach completion. One day's slot (~135 issuers) was fully missed during the outage window and is not separately recovered — daily cadence absorbs this as roughly one extra day added to the runway, nothing more. **Recommendation: no manual catch-up run needed** — flagged back to Founder per instruction, not run.

**New, separate, unrelated finding surfaced by this real second-file run of `firds-weekly-seed`:** `entity_isin_map`'s delta (+34) exceeds `firds_instrument_reference`'s delta (+31) by exactly 3 — investigated, and it's 3 ISINs whose issuer LEI changed between the 2026-08-15 file and the 2026-08-22 file. Because `firds_instrument_reference` is `INSERT OR IGNORE`-only (no `UPDATE ... WHERE last_updated_at < publication_date` refresh path — despite `MA-SEP-003_Spec.md`'s "Proposed Schema Change" > "Retention" section describing exactly that mechanism), the old LEI's row is never touched, and the new LEI produces a brand-new `entity_isin_map` row instead of replacing the old one — so those 3 ISINs are now each mapped to two different entities. Confirmed via `/validate-data`: 0 such duplicates before this run, 3 after. This is a genuine implementation gap against the Spec's own stated design, not a bug introduced today — just newly *observed* because this is the first time two different real weekly files have been run through the pipeline. Not fixed in this session (out of today's scope); flagged to the Founder in the MA-SEP-003 Sprint Board close-out notes and in chat.

## Not yet decided

- Whether MA-AUG-003 needs a formal reopen / regression note, or whether a Sprint Board Known Issue entry is sufficient — logged as a new Known Issue below pending Founder direction.
- Whether the 3-ISIN duplicate-mapping gap (found this session, see Resolution above) needs its own packet/fix session, or can sit as a tracked known issue until it affects something downstream.
