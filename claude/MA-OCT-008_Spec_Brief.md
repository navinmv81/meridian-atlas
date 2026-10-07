# Spec Brief: MA-OCT-008, SEC Corporate-Bond Ingestion (SPEC LANE)

```text
ISSUED BY:    Program Orchestrator (October Main Lane)
EXECUTED BY:  Data-Identity Lead (packet owner; writes the spec) — local Claude Code, Clean (v11); separate from the 006 and 011 lanes
REVIEWED BY:  Architect + Operations Lead (Fri 9 Oct)
APPROVED BY:  Founder (spec, seed list and folder change request — Mon 12 Oct)
PACKET:       MA-OCT-008 — SEC corporate-bond ingestion
GATE:         Spec Thu 8 Oct → reviews Fri 9 Oct → Founder Mon 12 Oct → build Wave 2 (after 007 starts), feeding 009 → 010 in Wave 3

ROLE:           Data-Identity Lead
LANE:           Data-Identity (SPEC ONLY)
BASELINE ROOT:  /Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)
BRANCH:         October-2026 (read-only for this lane)
FILES IN SCOPE: claude/MA-OCT-008_Spec.md (new, the only file this lane writes)
```

## Why
Scope v2 commits a Fixed Income vertical: SEC EDGAR corporate-bond issuance data (not pricing), served by 009 and shown by 010. 008 is the data layer. The input spec `claude/MA-OCT-004-Bond-Spec.md` (SHA-256 `90531b573b8df4466c54c3a0a494350aa5e05b961082dc23bcca7df4afdc2a2a`) already proves the source and the preliminary-vs-final trap, but its `EXECUTE FROM: Fixed Income/src/` is **not approved** (Addendum §5): the folder needs a change request and Architect review inside this spec gate.

## Lane rules (hard)
1. **Doc-only.** No code edits, deploys, secrets, cron or LaunchAgent changes, no migrations.
2. **D1: no queries in this lane.** List every query the design needs with its expected `EXPLAIN QUERY PLAN` and read estimate; the Main Lane routes a read-only query pack to an executing session later (as for 002).
3. **No git writes.** Read git only with `git --no-optional-locks`; check `ls .git/*.lock` first (Addendum rule 6). The approved spec is committed later by the next executing lane (rule 7).
4. Write **only** the file named in scope. Report any in-lane ruling to the Main Lane the same day.
5. Use `/write-spec`. Frontend stays vanilla JS (no frameworks, no bundlers); backend stays Cloudflare Workers.
6. **SEC EDGAR exception (this lane only):** at most **50** read-only requests to `data.sec.gov` / `sec.gov/Archives`, each with the required identifying `User-Agent` header and ≥150 ms apart, for the seed-list and second-issuer checks below. Log every request (URL, status, time). No other network calls.

## Inputs (read first)
- `claude/meridian-october-revised-scope-v2.md` §"Fixed Income Vertical" and Addendum §4–§5 (incl. the cut list: 20-issuer seed list as the fallback).
- `claude/MA-OCT-004-Bond-Spec.md` (input spec; verify the hash above).
- Source: `App/ETF Refresh/src/worker-filings.js` (`meridian-filings`, same EDGAR URL patterns), `worker-13f.js`, the Entities schema (`entity_master`, `instrument_master`, `instrument_entity_map`, CIK and LEI fields), every `wrangler*.toml` (cron slots are **5/5**).
- `claude/MA-OCT-001_Spec.md` §7 (ingest contract v1, so the ingester reports runs to Ops), `claude/MA-OCT-011_Spec.md` rev 1.1 and `claude/MA-OCT-013_Spec_Brief.md` (survivor rule S1) for entity linkage while identity data is changing.

## Scope to specify
1. **Seed issuer list (prerequisite, Founder approval 12 Oct):** 30 issuers (fallback 20), with CIK, linked `entity_id`/LEI where known, and why each is in (issuance frequency, diversity of structures).
2. **Second-issuer preliminary-filing check (prerequisite):** prove on at least one issuer other than ICE (CIK 0001571949) that preliminary / subject-to-completion filings are detected and rejected, and FWPs handled, using the SEC exception above.
3. **Discovery → parse → store:** `424B2/3/5/7` and `FWP` discovery via `submissions/CIK…json`; final-filing detection; tranche parsing (issuer, CIK, linked entity, tranche label, rate type, coupon/spread, principal, maturity, seniority where reliable, filing date, accession number, source URL, parsing confidence).
4. **Domain and tables:** declare the domain of every new table and its sole writer (Entities/instrument domain is the default; a fourth "Fixed Income" domain needs a Founder decision), keys, indexes and idempotency (`INSERT OR IGNORE` on accession + tranche), and how bonds join the 007 navigation contract (`instrument_master` / `instrument_entity_map` or a linked table).
5. **Where it runs:** no new cron slot exists. Choose between an on-request Worker route, a local runner (011 precedent) or extending an existing Worker, and justify against the 50-subrequest limit, CPU limits and the SEC rate rule. Ops heartbeats via the 001 contract.
6. **Folder change request:** propose the code location (`Fixed Income/src/` or under an existing tree) as `MA-OCT-008-CR1`, with Architect review.
7. **Entity linkage while identity changes:** link by CIK first, LEI second; follow S1 survivors after 013 merges; unmatched issuers raise data-quality tickets later (004), never auto-create entities silently.
8. **Out of scope:** municipal bonds, secondary pricing/TRACE, paid sources, the API (009) and UI (010).

## The spec must define
1. D1 budget (initial load and steady state), three-point check per query and per run, run-time gates (hold, budget, recovery), and a freeze on Sundays 04:00–07:00 UTC, the Monday 04:00 UTC seed and any GO'd 011 run (17–23 Oct).
2. Parsing-confidence rules and the acceptance threshold (sampled precision on final terms).
3. Acceptance criteria, test plan (incl. the preliminary-filing negative test), rollback, and at most 3 Founder questions with recommended answers.
4. The hand-off contract to 009 (fields, freshness and coverage metadata).

## Report-backs to the Main Lane
1. **Day 1:** preflight, outline, the draft seed list, and the SEC request log so far.
2. **Thu 8 Oct:** `claude/MA-OCT-008_Spec.md` with its SHA-256, the final seed list and the second-issuer check result.
