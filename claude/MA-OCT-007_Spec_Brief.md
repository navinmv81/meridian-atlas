# Spec Brief: MA-OCT-007, Standalone Instrument–Issuer Navigation (SPEC LANE)

```text
ISSUED BY:    Program Orchestrator (October Main Lane)
EXECUTED BY:  Engineering Lead (packet owner; writes the spec) — local Claude Code, Clean (v11)
REVIEWED BY:  UX Lead + Data-Identity Lead (Fri 9 Oct). ETF Product Lead consulted on ETF screens.
APPROVED BY:  Founder (spec approval Mon 12 Oct; Founder UAT at the end of the build)
PACKET:       MA-OCT-007 — Standalone instrument–issuer navigation
GATE:         Spec Thu 8 Oct → reviews Fri 9 Oct → Founder Mon 12 Oct → build Wave 2 (ticket button last, after 004)

ROLE:           Engineering Lead
LANE:           Platform (SPEC ONLY)
BASELINE ROOT:  /Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)
BRANCH:         October-2026 (read-only for this lane)
FILES IN SCOPE: claude/MA-OCT-007_Spec.md (new, the only file this lane writes)
```

## Why
Scope v2 keeps this as a standalone packet, not part of Fixed Income: a user on any instrument (equity, ETF holding, mapped instrument, and later a bond) must reach its issuer entity, and from any issuer reach all its instruments, without losing context and with honest states where a mapping is missing, ambiguous or weak.

## Lane rules (hard)
1. **Doc-only.** No code edits, deploys, secrets, cron or LaunchAgent changes, no migrations.
2. **D1: no queries in this lane.** List every query the design needs with its expected `EXPLAIN QUERY PLAN` and read estimate; the Main Lane routes a read-only query pack to an executing session later (as for 002).
3. **No git writes.** Read git only with `git --no-optional-locks`; check `ls .git/*.lock` first (Addendum rule 6). The approved spec is committed later by the next executing lane (rule 7).
4. Write **only** the file named in scope. Report any in-lane ruling to the Main Lane the same day.
5. Use `/write-spec`. Frontend stays vanilla JS (no frameworks, no bundlers); backend stays Cloudflare Workers.

## Inputs (read first)
- `claude/meridian-october-revised-scope-v2.md` §"Instrument–Issuer Navigation" (required journeys and acceptance criteria) and Addendum §4 (D4) and §5.
- Source: `App/ma-entities.js`, `App/ma-etf.js`, `App/index.html`, the Search and Modal modules, `App/Corporate Atlas/src/entities-api.js` (existing routes incl. `/api/entities/:id/instruments`, `/isin/:isin`, `/issuer-panels`), `entities-figi.js` (OpenFIGI mappings), and the schema for `instrument_master`, `instrument_entity_map`, `entity_isin_map`, `entity_master`.
- `claude/MA-OCT-011_Spec.md` (rev 1.1) and `claude/MA-OCT-013_Spec_Brief.md` (survivor rule S1, Founder 3 Oct), `claude/MA-OCT-004-Bond-Spec.md` (bond identifiers), `Sprint_Board.md` KI 22.17 and 22.41.

## Scope to specify
1. **Navigation contract.** Canonical identifiers (entity id, instrument id; ISIN/CUSIP/ticker as context, never as keys), route/URL shape for deep links, and the payload each screen needs. One contract used by OpenFIGI-backed mappings now and SEC bond mappings (008/009) later.
2. **Journeys:** instrument row or detail → issuer; issuer → linked instruments (paginated or progressive); bond detail ↔ issuer (contract only now; wired when 009/010 land). Context preserved across the round trip.
3. **Mapping states:** matched, unmatched, ambiguous (e.g. KI 22.17 duplicate ISIN rows), low-confidence; mapping source and confidence shown, never hidden.
4. **Identity changes during October:** 011 may add ~4.1k LEIs and 013 merges duplicates (S1: the older, LEI-bearing row survives). Define how links to a merged-away entity id resolve (redirect or survivor lookup) so deep links do not break.
5. **API needs:** reuse existing `meridian-entities-api` routes where possible; any new route, with its query, expected plan and read cost (index audit, ≤50k single execution). No new Worker unless justified with a change request.
6. **Ticket escalation (build last, after 004):** "report missing mapping" raises a data-quality ticket through the authenticated Ops API only (D4: consumer screens raise, never hold, state). The public site has no session today, so propose how the button authenticates (e.g. Access-gated link-out vs hidden for anonymous users) and take this to the Founder as a question.
7. **Screens touched:** ETF screens (`ma-etf.js`) need the ETF Product Lead's consent; Corporate Atlas (`ma-entities.js`) is Entities-domain display. No writes from the front end.

## The spec must define
1. Acceptance criteria mapped to Scope v2's five criteria, plus the merge-redirect case.
2. Read budget for every new query and page; pagination limits.
3. Phasing that fits Wave 2 (navigation + states first; ticket button last, gated on 004).
4. UAT script for the Founder.
5. Test plan, rollback (front-end files via `generate-docs.mjs` at the October go-live), and at most 3 Founder questions with recommended answers.

## Report-backs to the Main Lane
1. **Day 1:** preflight (branch, no locks, files readable), outline, and any blocking question.
2. **Thu 8 Oct:** `claude/MA-OCT-007_Spec.md` with its SHA-256.
