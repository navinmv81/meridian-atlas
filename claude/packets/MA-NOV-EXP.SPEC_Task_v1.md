# MA-NOV-EXP.SPEC — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-11
EXECUTED BY:  Entities Product Lead + Architect — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-EXP.SPEC_Status.json
CONTROL:      claude/packets/MA-NOV-EXP.SPEC_Control_v1.md
```

Usage note: the weekly limit resets Wed 09:00; if this run starts before then it may be cut off (no effect beyond a BLOCKED run). Be economical: read the files named, not the whole repo.

## Pins (verify before starting)
| File | sha256 |
|---|---|
| `meridian_atlas_november_content_scope_and_requirements.md` | `c16c8e195b46da83a50d41a6d22646d742a4594db66255cbec23ffd92f2e5a03` |
| `claude/packets/MA-NOV-SA1_Report.md` | `419e433726fa37275dff4ef8cea49d362cae3746eacd56d7a5024bf612ab3aea` |
| `claude/packets/MA-NOV-BQ2_Report.md` | `9b133cdea2715d19520d2988ddcc65241c80309c19aae21820a3ef91bdc15102` |
| `claude/packets/MA-NOV-EXP.SPEC_Control_v1.md` | verified against `MA-NOV-EXP.SPEC_Status.json` |

## Inputs
Scope doc §3 (EXP-01–12, acceptance line) and §6; SA1 §2 (EXP rows), §4, §5, §8; BQ2 (exposure stale: `entity_exposure_monthly` 2026-03 vs holdings 2026-08; coverage 42/237 funds; mapping tiers). Code: `App/Corporate Atlas/entities-api.js`, `App/Corporate Atlas/gate3-exposure.js`, `App/ma-entities.js`, `App/ma-etf.js`, `App/ETF Refresh/src/index.js` (overlap join), relevant migrations. Decisions already taken: no persistence in November; EXP-08 period differences over the two stored months; holdings C1 by separate CR; Corporate Atlas is the spine; no account/brokerage.

## The spec — `claude/specs/MA-NOV-EXP_Spec.md`
1. **Problem, users, goals, non-goals** (from scope §3, §6).
2. **Journey:** inputs → combined exposure and gaps → company → connected evidence; screens and states (incl. EXP-11 empty/error/unsupported).
3. **Calculation (EXP-02–07):** exact formulas — input validation (totals, duplicates, no silent normalisation), ETF-derived exposure = allocation × holding weight aggregated by **entity** via `instrument_entity_map`, direct equity → entity, direct vs indirect split, contribution per input, concentrations/shared exposure, ambiguity handling (heuristic tier shown, never merged silently), unresolved bucket (never redistributed). Worked numeric example.
4. **Data contract:** the read route(s) on `meridian-entities-api` (path, params, response JSON, errors, caching, row-read budget per call with an index plan); which tables are read; no writes. Client-side vs server-side split and why (Workers CPU/subrequest limits, D1 5M reads/day).
5. **Freshness (EXP-08) and the gate3 back-fill:** how `entity_exposure_monthly`/`fund_exposure_coverage` become current (months 2026-04…08 at least), measured or estimated write volume per month (use ≤10 sizing queries, e.g. holdings rows per month/fund counts), daily-cap plan (100k writes/day soft cap, other jobs' load), whether gate3 can stay a local script (CLAUDE.md recurring-job rule) or needs a Worker, and the date/period labels the UI shows. Whether EXP can read holdings directly instead of the pre-computed table — compare.
6. **Evidence links (EXP-09, EXP-10):** which existing routes/panels; universe and period labels for ETF, 13F, bonds.
7. **Acceptance tests (EXP-12):** ≥5 hand-checkable examples (incl. overlapping ETFs, direct+ETF same company, heuristic mapping, unmapped holdings, stale month), each with inputs and expected outputs; plus UI state tests.
8. **Change and rollback plan:** Worker deploy (route), Pages release (UI), prod processing (gate3) — each with its approval gate and rollback.
9. **Work units:** small, dependency-ordered packets (S/M), each with writable paths, gates and an estimate; target to fit SA1's EXP ≈8 packet-days or say why not.
10. **Cross-lane review:** ETF Product Lead (tables read, ETF contract impact), Tech Ops (three-point check per new query/route, budgets).
11. **Open decisions for the Founder** (numbered, each with a recommendation).

## Report — `claude/packets/MA-NOV-EXP.SPEC_Report.md`
Header (packet, run, outcome), 1 Summary (≤10 lines + the open decisions), 2 Sizing queries (SQL · result · rows_read; total), 3 Deviations/gaps, 4 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-EXP.SPEC`.
