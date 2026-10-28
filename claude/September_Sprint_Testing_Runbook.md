# Meridian Atlas — September 2026 Sprint: Testing & Verification Runbook

**Owner:** Founder (Nav) | **Frequency:** As needed, whenever verifying a packet's real-world behavior directly rather than relying on a swim-lane's self-report
**Last Updated:** 2026-09-12 | **Last Run:** 2026-09-01 — MA-SEP-003 (FIRDS core ingestion) PASSED, full end-to-end test pack in progress

## Purpose

Every September packet reports its own close-out with live evidence, but that evidence lives in a swim-lane session's report, not in anything you can see yourself without knowing where to look. This runbook is that "where to look" — one packet at a time, in build order, each flagged up front as either **UI-visible** (you can see it by opening the app) or **backend-only, no UI** (you have to query D1 or call a Worker endpoint directly — there is nothing to click).

## The one thing to understand before testing anything: two copies of the frontend exist

- **LOCAL_MASTER** — `Meridian Atlas Clean (v11)`, on your Mac, branch `September-2026`. The 11 frontend files (`index.html`, `ma-*.js`) live inside its `App/` subfolder. This is where new frontend code lands first and where you can preview work before it's live.
- **DEPLOY_BRANCH** — `corporate-atlas-v4-deploy-clean`, what GitHub Pages actually serves to the real world. It requires the same 11 files flat at root, no `App/` wrapper. **A change in LOCAL_MASTER is never live until someone manually flattens and copies it into DEPLOY_BRANCH** — pushing LOCAL_MASTER to GitHub does not do this. As of 2026-09-09, MA-SEP-013 has generated and pushed a `/docs` folder on `September-2026` itself as the new intended live source, but the actual GitHub Pages Settings flip (Step 5) has not run yet — so as of this update, the real live site is still `corporate-atlas-v4-deploy-clean`, unchanged.

Practical consequence: opening `.../Meridian Atlas Clean (v11)/App/index.html` (or `docs/index.html`, the MA-SEP-013 mirror) directly in your browser shows you **LOCAL_MASTER's current code** — which includes any frontend work that's code-complete but not yet live. It will never show you backend-only work, because backend-only work has no frontend code to show, in either copy.

## FIRDS integration — everything that touches it, one place to test it (added 2026-09-12)

**Why this section exists:** FIRDS (MA-SEP-003) is one packet, but three more packets have since touched what it produces or how it's surfaced — a fix to its data-refresh path (Known Issue 22.8, via MA-SEP-007), a fix to whether its entities are findable/labeled at all (MA-SEP-014), and a diagnostic confirming what it deliberately does *not* do (relationship edges, surfaced during MA-SEP-004). Testing MA-SEP-003 alone (the original section below) no longer covers "the FIRDS integration" as it stands today. This section is the consolidated version — run all four parts for a real end-to-end FIRDS check, not just Part 1.

**Part 1 — core ingestion (MA-SEP-003).** Already below, unchanged, already run and PASSED 2026-09-01. Confirms the weekly local job is loaded and landing rows in `firds_instrument_reference`.

**Part 2 — LEI-change refresh path (Known Issue 22.8, fixed via MA-SEP-007).** Confirms a re-run against an *already-processed* file is a true no-op (the original bug: it wasn't, and silently created duplicate `entity_isin_map` rows on any LEI change).

```
wrangler d1 execute meridian-etf --remote --command "SELECT COUNT(*) FROM entity_isin_map WHERE isin IN ('US77926X2962','US92189L1035','US92647X7562');"
```
**Expected result:** exactly 3 rows (one per ISIN) — these are the 3 ISINs originally found duplicated before the fix (Known Issue 22.8's original discovery). More than 3 total, or more than 1 for any single ISIN, means the retroactive cleanup didn't hold.

```
cd "App/Corporate Atlas"
node firds-local-seed.mjs
```
**Expected result:** if no newer weekly ESMA file has published since the last real run, every table's delta reports 0 — including `firdsRefRefreshed`. A non-zero `firdsRefRefreshed` count against an unchanged file would mean the content-diff `WHERE` clause (the actual fix) has regressed. **This is the single most direct test of Known Issue 22.8's fix** — it was verified once this way during MA-SEP-007's build/close-out; re-running it here is a genuine re-confirmation, not a formality.
**Note:** this only exercises the *no-op* path. A true positive test — a real ISIN's LEI actually changing between two weekly files — can't be manufactured on demand; it depends on ESMA's real data changing. If you want to force a positive test rather than wait for one, that would mean hand-editing a row in `firds_instrument_reference` to simulate a stale LEI before a re-run — flag that separately if you want it done, it's not part of this routine check.

**Part 3 — FIRDS entity discoverability & directory-tier label (MA-SEP-014, closed 2026-09-04).**

*UI-visible: YES.*

1. Open LOCAL_MASTER's `App/index.html` (or `docs/index.html`), search for a real FIRDS-sourced fund name — **"UBS"** or **"iShares"** are the names cited in MA-SEP-014's own Spec as the concrete, reproducible test.
   **Expected result:** the fund is found by its real name, not by its LEI. Before this fix, a FIRDS-created entity whose `name` field still held its raw LEI string was invisible to this search — finding it this way is the direct proof the fix is live.
2. Open that entity's detail view.
   **Expected result:** a small label reading **"Directory-tier (ESMA FIRDS), as of {date}"** near the entity-type/LEI header area.
3. Open a **non**-FIRDS entity (any US GLEIF-sourced or N-PORT-derived entity, e.g. a name you know predates FIRDS) and confirm the label does **not** appear.
   **Expected result:** no label. A false positive here (the label showing on a non-FIRDS entity) would be worse than the label missing — MA-SEP-014's own Spec calls this out explicitly as the one failure mode to check for, not just the positive case.
4. Optional D1 spot-check on the three originally-flagged rows:
   ```
   wrangler d1 execute meridian-etf --remote --command "SELECT entity_id, name, lei FROM entity_master WHERE entity_id IN (210102, 210982, 211328);"
   ```
   **Expected result:** `name` is a real legal name for all three, not a raw LEI string (each `lei` value repeated as `name` was the original defect).

**Part 4 — confirm the deliberate non-feature: FIRDS writes zero relationship edges.** This isn't a bug to find — it's a fact this project confirmed during MA-SEP-004's build and re-confirmed during today's (2026-09-12) diagnosis of the "no parent/child showing" question (see Sprint Board, MA-SEP-004 row and Known Issues 22.9/22.10). Worth one explicit check so it reads as *confirmed*, not *assumed*, going forward:

1. Open the same FIRDS entity from Part 3 (or any other confirmed-FIRDS entity) in the Corporate Atlas UI.
   **Expected result:** no Children section (Subsidiaries/Managed Funds are both empty, so MA-SEP-004's own logic correctly hides the section entirely) and the Ownership Chain panel shows "Not reported" for both Direct and Ultimate parent.
   **This is correct, not broken.** FIRDS's `firds-local-seed.mjs` only ever populates `entity_isin_map`/`instrument_master`/`entity_master` — it has never written to `entity_relationships`, confirmed by direct code read (see MA-SEP-014 Spec's Non-Goals). A FIRDS entity showing real Children/Ownership data would actually be the surprising result.

### FIRDS integration — consolidated verification checklist

- [ ] Part 1: `firds-seed-status.sh` shows `Loaded: YES`, `Paused: NO`; a direct run logs a clean outcome
- [ ] Part 2: the 3 originally-duplicated ISINs are each a single `entity_isin_map` row; a same-file re-run reports 0 across all tables including `firdsRefRefreshed`
- [ ] Part 3: a real FIRDS fund name (e.g. "UBS"/"iShares") is findable by name; its detail view shows the directory-tier label; a non-FIRDS entity does not show that label
- [ ] Part 4: the same FIRDS entity shows no Children section and "Not reported" ownership rows — expected, not a defect

---

## Recommended execution order for this pass (2026-08-31, extended 2026-09-12)

The Founder is running the full pack once, end to end, before deciding on go-live and formal sprint closure — not just spot-checking one packet. Suggested order, backend-only packets first (lowest risk, no browser needed), UI-visible last, go-live checks after that:

1. MA-SEP-001 (baseline entity count)
2. **MA-SEP-003 — FIRDS, all 4 parts above** (Part 1 already PASSED 2026-09-01; Parts 2–4 added 2026-09-12, not yet independently re-run this pass)
3. MA-SEP-007 (entity dup backlog)
4. MA-SEP-009 (parent/child LEI fix)
5. MA-SEP-010 (entities-enrich throughput)
6. MA-SEP-011 (`meridian-holdings` cadence + guard fixes)
7. MA-SEP-012a/b (admin API) and MA-SEP-012c/d (snapshot viewer + refresh) — **superseded, see note below**
8. MA-SEP-004 (Corporate Atlas hierarchy — UI to click through; note the real data-coverage caveat below before assuming a failure)
9. MA-SEP-013 — Steps 2-4 done (docs/ pushed to `September-2026`); Step 5 (Pages source flip) still not run as of this update — this is the go-live step itself, after everything above passes

**Note on Step 8 (MA-SEP-004):** testing against a random entity will correctly show no parent/child data — `legal_parent` coverage is effectively 0-2 edges/entity project-wide today (Known Issue 22.9/22.10's real data-coverage gap, not a rendering defect). Use **BlackRock** or **iShares Trust** specifically (the one real-data case verified during MA-SEP-004's build) to see the feature working. A backlog item (MA-OCT-003) is now open to close this coverage gap via an offline GLEIF bulk backfill — see Sprint Board.

**Note on Step 7:** `entity_merge_exceptions` and its `/admin/exceptions` routes (MA-SEP-012a/b/c/d) are retired as of MA-SEP-016 (2026-09-09) — the table is dropped and the routes unconditionally reject. The Data Quality Exception Engine (`/exceptions/ui`, MA-SEP-015a/b/c) is the live replacement. This runbook's MA-SEP-012a/b/c/d sections below are kept for historical reference only — do not run them expecting live behavior.

## Prerequisites

- [ ] A terminal on the Mac where LOCAL_MASTER lives, with `wrangler` installed and authenticated (the real Cloudflare API token lives in `13F Seed/.env`)
- [ ] `wrangler d1 execute meridian-etf --remote --command "..."` for any D1 check below
- [ ] For any Worker endpoint call requiring a secret (MA-SEP-010, 011, 012b), the secret value from its gitignored local file — Cloudflare secrets are write-only once stored via `wrangler secret put`, so the local file is the only remaining copy
- [ ] **None of this runs from the Cowork session** — it has no Cloudflare API access. Every command below is either something you run yourself in Terminal, or something to hand to a local Claude Code session.

---

## MA-SEP-001 — Entity duplicate cleanup

**UI-visible:** No — backend/data-only.

### Procedure

**Step 1: Confirm the merge landed**
```
wrangler d1 execute meridian-etf --remote --command "SELECT COUNT(*) FROM entity_master;"
```
**Expected result:** 33,124 rows.
**If it fails:** A different count means either the merge didn't land as reported, or more entities have been added/merged since (check the Sprint Board's more recent packets — MA-SEP-007 also merged rows on top of this).

**Step 2: Spot-check a known duplicate is now single**
```
wrangler d1 execute meridian-etf --remote --command "SELECT entity_id, name, lei FROM entity_master WHERE name LIKE '%Danaher%';"
```
**Expected result:** One row, not two.
**If it fails:** The merge for this specific entity didn't take — worth a fresh look, not something to assume is fine.

### Verification
- [ ] Row count matches
- [ ] Danaher (or another known pre-merge duplicate) resolves to a single row

---

## MA-SEP-003 — FIRDS (European fund reference data) — core ingestion

**UI-visible:** No — and it's not even a Cloudflare Worker. The final architecture is a recurring **local** job (a macOS LaunchAgent), not something running in Cloudflare at all. Its output feeds Corporate Atlas indirectly (ISIN/issuer LEI matching), but there's no FIRDS screen anywhere.

**See the consolidated "FIRDS integration" section above for the full picture (Parts 2–4) — this section is Part 1 only.**

### Procedure

**Correction, 2026-08-31 (verified directly against the real repo via the linked-device bridge — the paths originally written here were wrong):** the FIRDS control scripts and seed script live in `App/Corporate Atlas/` and `App/Corporate Atlas/scripts/`, **not** in a `13F Seed/` folder (that folder holds the unrelated 13F pipeline's own scripts). All commands below run from `App/Corporate Atlas/`.

**Step 1: Check the LaunchAgent is actually loaded, and see the last run at a glance**
```
cd "App/Corporate Atlas"
./scripts/firds-seed-status.sh
```
**Expected result:** `Loaded: YES (com.meridianatlas.firds-weekly-seed)`, `Paused: NO`, and the last few lines of `logs/firds-seed.log`. As of 2026-08-31, the last recorded run was **2026-08-30T10:03:08Z — success, all deltas 0** (expected: no newer weekly ESMA file had published since the prior real run on 2026-08-29).
**If it fails / shows `Loaded: NO`:** run `./scripts/firds-seed-install.sh` to (re)install — it's idempotent, safe to re-run even if already loaded.

**Step 2: Force a run directly** (don't wait for Sunday 11:00 local) — there's no force-run flag on the status script; run the seed script directly instead, still from `App/Corporate Atlas/`:
```
node firds-local-seed.mjs
```
**Expected result:** a real run against the current weekly ESMA file, printing/logging a row-count delta per table (`firds_instrument_reference`, `entity_isin_map`, `instrument_master`, `entity_enrichment_queue`, `entity_master`, `firds_ref_refreshed`) — 0 across the board is a valid, correct outcome if no newer weekly file has published since the last run, not a failure.

**Step 3: Confirm the data landed**
```
wrangler d1 execute meridian-etf --remote --command "SELECT COUNT(*), MAX(last_updated_at) FROM firds_instrument_reference;"
```
**Expected result:** a row count in the tens of thousands (18,417+ as of the last real run, 2026-09-01) and a recent `last_updated_at`.

### Verification
- [ ] `firds-seed-status.sh` shows `Loaded: YES`, `Paused: NO`
- [ ] A direct `node firds-local-seed.mjs` run completes and logs a clean outcome (0 deltas is fine)
- [ ] `firds_instrument_reference`'s row count and `last_updated_at` reflect the run

### Troubleshooting
| Symptom | Likely Cause | Fix |
|---|---|---|
| `Loaded: NO` | Never installed on this machine, or uninstalled | Run `./scripts/firds-seed-install.sh` — idempotent, safe even if already loaded |
| `Paused: YES` | Someone ran `./scripts/firds-seed-pause.sh` and never resumed | Run `./scripts/firds-seed-resume.sh` if you want it active again |
| Run fails with `EPERM`/permission error | macOS TCC blocking `launchd`-spawned `node` (this project's own recurring issue — see `claude/Escalation_LaunchAgent_TCC_Permission.md`) | Grant Full Disk Access / Files-and-Folders access to the real `node` binary per that doc |
| `spawnSync npx ENOENT`, `ETIMEDOUT`, or `Authentication error [code: 10000]` in `logs/firds-seed.log` or a direct `wrangler d1 execute` call | Transient `npx`/wrangler/Cloudflare-API flakiness — now confirmed 3 times (2026-08-22 `ENOENT`, 2026-08-23 `ETIMEDOUT`, 2026-09-01 `[code: 10000]`), each with a clean success on retry and no fix applied. The 2026-09-01 instance was checked thoroughly before concluding transient — `wrangler whoami` (valid token, correct scopes incl. `d1:write`), single-account login (no ambiguity), and `wrangler d1 list` all succeeded while the `execute` call alone failed, then succeeded outright on a plain retry minutes later | Just re-run the same command. Time-of-day/calendar date is irrelevant — the 2026-08-22 instance resolved in 7 minutes. Only escalate if the *same* command fails **twice in a row** with a fresh, complete error message — a single occurrence, however alarming-looking (`Authentication error` included), has never once needed a real fix in this project's history |

---

## MA-SEP-004 — Corporate Atlas parent-child hierarchy

**UI-visible: YES** — this is the one packet you can actually click through, and only in LOCAL_MASTER right now (not yet live).

### Procedure

**Step 1: Open LOCAL_MASTER's index.html**
Open `.../Meridian Atlas Clean (v11)/App/index.html` (or `docs/index.html`, MA-SEP-013's mirror) in your browser.

**Step 2: Find a real fan-out case**
Search for **BlackRock** or **iShares Trust**, open its entity detail overlay. **Do not test against a random/arbitrary entity first** — see the coverage-gap note in the Recommended Execution Order section above; a random entity showing nothing is expected, not a failure.
**Expected result:** A **Children** section (Subsidiaries / Managed Funds) showing entries capped at 12, with a "+84 more" indicator (BlackRock/iShares Trust has 96 real children). The **Ownership Chain** rows should be clickable — clicking a parent navigates to that parent's own detail.
**If it fails:** If you see no Children section at all even for BlackRock/iShares, confirm you're opening the file from `September-2026` branch, not an older checkout.

**Step 3 (optional): spot-check the backend directly**
```
curl "https://<meridian-entities-api-url>/api/entities/<blackrock-entity-id>/graph"
```
**Expected result:** JSON with both `parents` and `children` arrays, children count near 96.

### Verification
- [ ] Children section renders, correctly capped, for BlackRock/iShares Trust
- [ ] Ownership Chain rows are clickable
- [ ] A random non-asset-manager entity correctly shows no Children section and "Not reported" ownership rows — expected, not a defect (see coverage-gap note above)
- [ ] This is NOT yet visible on the live GitHub Pages site — that's expected until MA-SEP-013 Step 5 runs

---

## MA-SEP-007 — Entity duplicate backlog

**UI-visible:** No — backend/data-only, same shape as MA-SEP-001.

### Procedure

**Step 1: Confirm the merged total**
```
wrangler d1 execute meridian-etf --remote --command "SELECT COUNT(*) FROM entity_master;"
```
**Expected result:** Reflects roughly 1,845 additional merged groups on top of MA-SEP-001's baseline.

**Step 2: Confirm the three deliberately-NOT-merged risk cases are still separate**
```
wrangler d1 execute meridian-etf --remote --command "SELECT entity_id, name, lei FROM entity_master WHERE name LIKE '%SLM%' OR name LIKE '%Navient%';"
```
Repeat for Santander Bank Polska / Erste Bank Polska, and OPAP Holding SA / Allwyn AG.
**Expected result:** Each pair still shows as two separate rows sharing an LEI — these were correctly left unmerged as real corporate-action risk cases, not accidentally missed.

### Verification
- [ ] Entity count reflects the merge
- [ ] All three named risk-case pairs remain separate

---

## MA-SEP-009 — Parent/child LEI mirror-write fix

**UI-visible:** Indirectly — the fix makes MA-SEP-004's Ownership Chain feature actually populate with real data going forward, but there's no dedicated screen of its own.

### Procedure

**Step 1: Check for real positive cases**
```
wrangler d1 execute meridian-etf --remote --command "SELECT COUNT(*) FROM entity_master WHERE direct_parent_lei IS NOT NULL;"
```
**Expected result:** A small but non-zero and growing count (this was 0 of 43,578 before the fix — any positive number confirms the fix is live and working).

### Verification
- [ ] Count is non-zero
- [ ] Spot-check one such entity in MA-SEP-004's UI (Step 2 above) shows a clickable, non-empty Ownership Chain

---

## MA-SEP-010 — entities-enrich throughput boost

**UI-visible:** No.

### Procedure

**Step 1: Check the LaunchAgent**
```
launchctl list | grep entities-enrich-boost
```
**Expected result:** Loaded, scheduled around 10:50/16:50 UTC.

**Step 2: Manually trigger a run** (retrieve the secret from its gitignored local file first)
```
curl -X POST "https://<meridian-entities-enrich-url>/run" -H "X-Enrich-Run-Secret: <secret-from-local-file>"
```
**Expected result:** 200, real GLEIF calls logged.
**If it fails:** A 401 with the correct secret means the deployed secret and your local file have drifted — re-check which one is current.

**Step 3: Confirm backlog is shrinking**
```
wrangler d1 execute meridian-etf --remote --command "SELECT COUNT(*) FROM entity_master WHERE <phase-3-eligible condition>;"
```
Compare against a prior count — should be decreasing over time, not flat.

### Verification
- [ ] LaunchAgent loaded and firing on schedule
- [ ] Manual `/run` call succeeds with the correct secret, rejected without it
- [ ] Backlog count trending down

---

## MA-SEP-011 — Known Issue 22.12 close-out (`meridian-holdings` cadence + guard fixes)

**UI-visible:** No.

### Procedure

**Step 1: Confirm the comment was actually retired**
Open `meridian-holdings`' source and check the code comment no longer reads "Emergency mitigation... not yet reviewed" — it should reflect the reviewed, permanent cadence.

**Step 2: Confirm `/run` now requires auth (Known Issue 22.18)**
```
curl -X POST "https://<meridian-holdings-url>/run"                                    # no header — expect rejection
curl -X POST "https://<meridian-holdings-url>/run" -H "X-<secret-header-name>: wrong"  # wrong secret — expect rejection
curl -X POST "https://<meridian-holdings-url>/run" -H "X-<secret-header-name>: <real-secret-from-local-file>"  # expect 200
```

**Step 3: Confirm the write-guard cadence is unchanged and still safe**
```
wrangler d1 execute meridian-etf --remote --command "SELECT * FROM <holdings write-tracking table> ORDER BY run_date DESC LIMIT 5;"
```
**Expected result:** Weekly Sunday cadence continuing as before — this packet changed guard logic and auth, not the schedule itself.

### Verification
- [ ] Comment retired
- [ ] `/run` auth matrix behaves correctly
- [ ] Cadence unchanged (still weekly Sunday)

---

## MA-SEP-012a/b — Entity Merge Exception Management *(historical — retired 2026-09-09 via MA-SEP-016, see note above)*

**UI-visible: NO, by design.** This is the one the Founder specifically asked about — there is genuinely nothing to see in `index.html`. It's a Founder-only admin surface with no navigation entry anywhere.

### Procedure

**Step 1: Retrieve the secret**
Find the gitignored local file the build session created (check `git status --ignored` in the repo, or ask whichever local session built this where it wrote the file) and read the secret value from it.

**Step 2: List the seeded exceptions**
```
curl "https://<meridian-entities-api-url>/admin/exceptions" -H "X-Admin-Exceptions-Secret: <secret>"
```
**Expected result (historical, pre-retirement):** 200, JSON array with 3 rows — SLM Corp/Navient Corp, Santander Bank Polska/Erste Bank Polska, OPAP Holding SA/Allwyn AG, each `decision: do_not_merge`. **As of 2026-09-09, this route unconditionally rejects every call — a 200 here today would itself be the anomaly.**

**Step 3: Confirm it's actually gated**
```
curl "https://<meridian-entities-api-url>/admin/exceptions"                                    # no header
curl "https://<meridian-entities-api-url>/admin/exceptions" -H "X-Admin-Exceptions-Secret: wrong"  # wrong secret
```
**Expected result:** Both rejected, not 200 — and post-retirement, so is the correct-secret call from Step 2.

### Verification
- [ ] Post-2026-09-09: all three variants (no header, wrong secret, correct old secret) are rejected — this route is retired, not live
- [ ] Nothing about this shows up anywhere in `index.html` or `ma-entities.js` — that's correct, not missing
- [ ] The live replacement is `/exceptions/ui` (MA-SEP-015a/b/c) — test that surface instead for current exception-management behavior

---

## MA-SEP-012c/012d — Local snapshot viewer + one-click refresh *(historical — both files deleted 2026-09-09 via MA-SEP-017, see note above)*

**UI-visible:** Sort of — it was a real page, but a standalone local file, not part of the app (`index.html`/`ma-entities.js` had zero references to it, by design).

**As of 2026-09-09, both `export-exceptions-snapshot.mjs` and its wrapper `refresh-exceptions-snapshot.command` have been deleted (Known Issue 22.27, closed via MA-SEP-017).** The steps below no longer apply — kept for historical reference only. Do not attempt to run them; the `.command` file no longer exists.

### Verification
- [ ] Confirm both files are absent from `App/Corporate Atlas/` — their absence is correct, not a regression
- [ ] The generated `entity-exceptions-snapshot.html` may still be present on disk as a stale, gitignored artifact — harmless, no action needed

---

## MA-SEP-013 — September Sprint Go-Live

**UI-visible:** Partially — the `/docs` mirror on `September-2026` (Steps 2-4, done 2026-09-09) can be opened and tested exactly like `App/index.html` today. The live-site cutover itself (Step 5, GitHub Pages source flip) has not run yet — until it does, there is no live-site behavior change to test, only the local `/docs` mirror.

### Procedure (once Step 5 runs)

Re-run MA-SEP-004's UI check above (Step 2, BlackRock/iShares) against the **real live GitHub Pages URL**, not just LOCAL_MASTER — this is the first time that check means anything on the actual live site. Also spot-check that `App/index.html`'s and `docs/index.html`'s behavior match (they should be byte-identical per the dry-run diff already performed during Steps 2-4).

### Verification
- [ ] Live site loads at all post-cutover
- [ ] MA-SEP-004's BlackRock/iShares check passes on the live URL, not just locally
- [ ] `docs/index.html` and `App/index.html` behave identically

---

## Troubleshooting (general)

| Symptom | Likely Cause | Fix |
|---|---|---|
| A backend-only packet's work isn't visible anywhere in `index.html` | Expected — it was never meant to be a UI feature | Use that packet's D1/curl checks above instead |
| A UI feature (MA-SEP-004) isn't visible even in LOCAL_MASTER | Wrong branch checked out, or file opened from a stale copy | Confirm you're on `September-2026` and opening `App/index.html` from LOCAL_MASTER, not an old checkout |
| A UI feature is visible locally but not on the live site | Expected until MA-SEP-013 (Go-Live) Step 5 runs — LOCAL_MASTER/`docs` and the live GitHub Pages source are still separate until then | Wait for or schedule MA-SEP-013 Step 5 |
| A secret-gated endpoint rejects the "correct" secret | The gitignored local file may be stale, or the secret was rotated since — or, for `/admin/exceptions` specifically, it's deliberately retired (2026-09-09) and rejects everything now by design | Re-check `wrangler secret list` (names only, not values) against the local file's freshness; for `/admin/exceptions`, a rejection is now the correct behavior, not a drift signal |
| A FIRDS-sourced entity shows no parent/child data | Expected — FIRDS writes zero relationship edges by design (see FIRDS integration Part 4 above) | Not a defect; test MA-SEP-004's hierarchy feature against BlackRock/iShares instead, which has real relationship coverage |

## History

| Date | Run By | Notes |
|---|---|---|
| 2026-08-30 | — | Runbook created; not yet exercised end-to-end against live infrastructure. |
| 2026-08-31 | Control (Cowork session, via linked-device bridge) | MA-SEP-003/FIRDS section corrected — the original `13F Seed/` path and script name were wrong; verified the real location (`App/Corporate Atlas/`, `scripts/firds-seed-*.sh`) and real run history (`logs/firds-seed.log`) directly against the repo before rewriting. Added the missing MA-SEP-012c/012d section (post-dated the runbook's original 012a/b entry). Added a recommended execution order for the Founder's full end-to-end pass ahead of go-live/close. No other packet's steps re-verified against live infrastructure this pass — the Founder is about to do that himself. |
| 2026-09-01 | Control (Cowork session, via linked-device bridge) | Fixed a real schema error in the MA-SEP-001 and MA-SEP-007 test queries — both used `SELECT id, ...` against `entity_master`, but that table's actual primary key column is `entity_id` (confirmed directly against `migrations/corporate-atlas-v1.sql`), not `id`. Corrected both to `SELECT entity_id, name, lei ...`. Neither had been run against live D1 before now, so this error was never caught until the Founder hit it live. |
| 2026-09-01 | Founder | **MA-SEP-003 (FIRDS) — PASSED.** Hit a transient `Authentication error [code: 10000]` on the first `node firds-local-seed.mjs` attempt (see updated Troubleshooting row — 3rd confirmed occurrence of this class, resolved on plain retry, no fix needed). Direct `wrangler d1 execute` then confirmed 18,417 rows (up from 18,384 on 2026-08-29). Full seed run: correctly found no new weekly file since the last real ingest (next ESMA publish is Sunday 2026-09-06), reprocessed the existing file idempotently, real before/after `COUNT(*)` deltas 0 across all 5 tables — exactly the expected, correct outcome for a re-run against an already-processed file, not a failure. |
| 2026-09-12 | Control (Cowork session, direct device-bridge code read + project doc reconciliation) | **Added the consolidated "FIRDS integration" section** (Parts 2–4) in response to a direct Entities-lane question ("how do we test any FIRDS integration that we did for Sep?") — the original runbook only covered MA-SEP-003's core ingestion (Part 1), not the three packets that have since touched FIRDS's output: Known Issue 22.8's LEI-change refresh fix (MA-SEP-007), MA-SEP-014's discoverability/directory-tier labeling fix, and the confirmed-by-design fact (from MA-SEP-004/MA-SEP-014) that FIRDS writes zero relationship edges. Also updated the MA-SEP-004 section with the real data-coverage caveat (test BlackRock/iShares, not a random entity — see today's separate Sprint Board note on Known Issues 22.9/22.10 and new backlog item MA-OCT-003), marked MA-SEP-012a/b/c/d sections as historical/retired per MA-SEP-016/017, and updated the two-copies-of-the-frontend note and MA-SEP-013 section to reflect Steps 2-4 being done (Step 5 still pending). None of Parts 2–4 or the updated MA-SEP-004 caveat have been independently re-run against live infrastructure by the Founder yet as of this update — this entry documents the runbook update itself, not a new test pass. |
