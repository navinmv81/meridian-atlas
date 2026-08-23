# MA-SEP-003 — Change Request: local one-time seed + daily delta Worker (replaces full-file chunked Worker as the v1 architecture)

**Raised by:** Control (Cowork master-lane session), 2026-08-21, following the CPU-wall escalation
**Status:** Founder-approved 2026-08-21, then **SUPERSEDED same day** by `MA-SEP-003_Change_Request_Local_Weekly_Job.md` — Phase 2 (the daily delta Worker) was rejected after real `DLTINS` numbers came back far larger than assumed (see `MA-SEP-003_Escalation_Delta_File_Size.md`). Phase 1 (one-time local seed) below is not superseded — it was promoted into a recurring weekly job, unchanged in substance. Kept for the record, not as an active plan.
**Supersedes:** the "chunked/resumable Worker processes the full weekly FULINS_C file end-to-end" design in `MA-SEP-003_Spec.md` P0 Requirement 1 and `MA-SEP-003_Escalation_CPU_Wall.md`'s Option 2/3
**Related:** `MA-SEP-003_Spec.md`, `MA-SEP-003_Build_Brief.md`, `MA-SEP-003_Escalation_CPU_Wall.md`, `MA-SEP-003_Change_Request_Cron_Consolidation.md` (still separately open — see Interaction with other open items below)

## What's changing and why

The chunked/resumable Worker design (mirroring `edgar_bootstrap_progress`) hit a hard CPU-time wall at 82.3% through one file's resumable pass — full root cause in `MA-SEP-003_Escalation_CPU_Wall.md`. The wall exists because every invocation must re-decompress and skip-scan from byte zero to reach its resume point, and that cost grows with position. This is structurally different from EDGAR's pattern, which resumes by slicing an array of independently-fetchable URLs (no decompression, no re-scanning) — ESMA does not offer an equivalent per-instrument API, confirmed live against ESMA's own API documentation this session.

**New architecture, two phases:**

1. **One-time local seed (Phase 1).** A local Claude Code session, running with full unrestricted compute on the Founder's own machine (not inside a Worker, no CPU-time ceiling), downloads the current `FULINS_C` weekly file, decompresses and parses it fully in one pass, applies the existing CFI-C filter + ISIN dedup + entity-linkage logic already built and live-tested in `src/firds-parse.js`/`src/firds.js`, and writes to D1 (via `wrangler d1 execute` or the D1 HTTP API — same class of access already used by this project's other local seed scripts, e.g. `13F Seed/`, `App/Corporate Atlas/gate1-instrument-seed.js`, `isin-backfill.js`). This is a one-time manual operation, not a recurring pipeline component — precedented in this codebase, not a new pattern.
2. **Daily delta Worker (Phase 2), Cloudflare-native, ongoing.** Once the one-time seed establishes a full baseline, a small `meridian-firds` Worker keeps it current by pulling ESMA's daily `DLTINS` delta file(s) — materially smaller than the weekly full file — well within a single Worker invocation's CPU budget. This is the only ongoing, automated, production component, and it stays entirely inside Cloudflare (Worker + D1 + Cloudflare Cron Trigger), which was the explicit architectural constraint driving this decision (Founder: "I don't want to move anything out of Cloudflare then it messes up the architecture").

**What is NOT changing:** the `firds_instrument_reference` schema, the Entities-domain ownership, the reuse-only linkage rules (`entity_isin_map`/`instrument_master`/`entity_enrichment_queue`, no new resolver), and the zero-ETF-domain-touch constraint. This is a change to the *ingestion mechanism*, not the data model or domain boundaries.

## Impact analysis

- **`meridian-firds` Worker code already built and deployed** (`src/firds.js`, `src/firds-parse.js`) is not wasted — its parsing/CFI-filter/linkage logic is reused as-is for the local Phase 1 script (same code, different execution context: local Node process instead of a Worker isolate). The chunked-resumable scaffolding (KV-based `nextIndex` progress state) becomes unnecessary once Phase 1 replaces it, and should be removed or left dormant once Phase 2's simpler delta-only Worker is built — flagged for the next session to decide, not a blocker to starting Phase 1.
- **Real production data already written this session** (10,986 instruments, +10,929 `entity_isin_map`, +10,832 `instrument_master`, +7,604 `entity_master`) is not discarded — Phase 1's full local run is idempotent (`INSERT OR IGNORE` throughout) and will simply confirm those rows and add the remaining ~7,400 unique ISINs that never got reached.
- **New complexity in Phase 2 not present in the original design:** ESMA's `DLTINS` delta files use a four-way record-type model (`NewRcrd` / `ModfdRcrd` / `TermntdRcrd` / `CancRcrd`), confirmed live against ESMA's own delta-file instructions this session. The current schema and Worker logic only know how to add-or-confirm a row (`INSERT OR IGNORE`) — there is no existing notion of "this instrument stopped trading, remove or flag it." This needs an explicit design decision in Phase 2 (simplest option: `TermntdRcrd`/`CancRcrd` → `DELETE FROM firds_instrument_reference WHERE isin = ?`, keeping the table a point-in-time snapshot rather than adding temporal `valid_from`/`valid_to` columns, which would be schema scope creep beyond what's approved). Decide with real delta-file examples in hand, not guessed — see Required diagnostic below.
- **Delta files are NOT pre-filtered to CFI-C** the way weekly `FULINS` files are (confirmed live: ESMA splits full files by CFI first letter, but delta files are not split this way) — the daily Worker must apply the CFI-C filter itself, same as today's logic already does, just against a smaller-but-not-trivial multi-part daily file.
- **Real file size/record count for `DLTINS` is not yet known.** Could not be obtained from this Cowork session (ESMA's file host has already blocked direct requests from this sandbox earlier in the packet — confirmed, not assumed). This needs the same "get real numbers before committing" diagnostic step that was done for the weekly file, run locally.
- **No schema change.** `firds_instrument_reference` as specced is unchanged.
- **No change to domain ownership or boundaries.**

## Interaction with other open items

- The still-separately-open `entities-enrich` cron-consolidation prerequisite (Cloudflare plan tier + real subrequest counts, per `MA-SEP-003_Change_Request_Cron_Consolidation.md`) is **not** a blocker to starting Phase 1 or Phase 2's diagnostic step — neither needs a new Cloudflare Cron Trigger. It **does** become a blocker again once Phase 2's delta Worker is ready to go live on an actual daily Cloudflare Cron Trigger, since that still needs a free slot from the same 5/account cap. Flagging now so it isn't a surprise later — no action needed on it today.
- This change request does not reopen or alter the CPU-wall escalation's root-cause analysis — it changes which component does the heavy one-time work, it doesn't attempt to make the Worker-based full-file approach viable.

## Rollback plan

- Phase 1 is a read-mostly-idempotent local script against production D1 (`INSERT OR IGNORE` throughout, per the existing tested code) — if it needs to be stopped mid-run, no cleanup is required; it can simply be re-run from the start with no risk of duplicate or corrupted rows.
- Phase 2's delta Worker is deployed with cron disabled by default (same standing rule as the rest of this packet) until diagnostic numbers confirm it's safe and the three-point check passes — no live risk from deploying the code alone.
- If the four-record-type delta logic proves wrong in production (e.g. a termination incorrectly deletes a row that should have persisted), the fix is a data correction against `firds_instrument_reference` only — an Entities-domain, Core-classified table with no downstream schema dependents beyond the existing `entity_isin_map`/`instrument_master` bridges, which are themselves `INSERT OR IGNORE`-safe.

## Approvals

Approved by Founder (Nav) in conversation, 2026-08-21, after reviewing the plain-language explanation of the CPU wall, the EDGAR precedent comparison, and this two-phase design. Proceed to execution: next local Claude Code session runs Phase 1 to completion and pulls real `DLTINS` diagnostic numbers for Phase 2 — see revised `MA-SEP-003_Build_Brief.md`.
