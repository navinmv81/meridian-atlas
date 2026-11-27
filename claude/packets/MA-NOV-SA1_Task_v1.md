# MA-NOV-SA1 — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-10
EXECUTED BY:  Architect + Product Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-SA1_Status.json
CONTROL:      claude/packets/MA-NOV-SA1_Control_v1.md
```

Usage is tight (~86% weekly; reset Wed 09:00): be economical — targeted reads (grep, specific files), no full-repo sweeps, no long outputs. If you run short, write what you have with gaps marked.

## Pins (verify before starting)
| File | sha256 |
|---|---|
| `meridian_atlas_november_content_scope_and_requirements.md` | `c16c8e195b46da83a50d41a6d22646d742a4594db66255cbec23ffd92f2e5a03` |
| `claude/packets/MA-NOV-SA1_Control_v1.md` | verified against `MA-NOV-SA1_Status.json` |

## Work
For every requirement in the scope document (OPS-01–06, EXP-01–12, BOND-01–12, HOME-01–07):
1. **Baseline:** what exists today (file/function, Worker, table) and what is missing. Evidence = path + line or query result.
2. **Classify:** `REUSE` (works as is), `EXTEND` (small change), `NEW` (build), `BLOCKED` (data/identity/dependency gap) — and `MUST` / `SHOULD` / `DEFER` for November.
3. **Size:** S (≤1 packet-day) / M (2–3) / L (>3), plus schema change yes/no and production processing yes/no (each needs its own approval).

Then:
4. **Bond failure inventory (BOND-01–04):** current parse success/failure counts by failure reason, from D1 (≤ the Control's query budget) or, if unavailable, from code and October reports. State the baseline number improvement will be measured against.
5. **Data and identity gaps** that block EXP (coverage of entity/issuer links for holdings, LEI/ISIN mapping, 13F joins); include the CARRY observations (FIRDS +145 entities, entities-seed ~37.5k writes).
6. **Holdings cycle option C** (faster refresh; EXP-08 depends on freshness): options within the Free plan (cron slots 5/5, 100k writes/day, 80k guard) — e.g. retiring `meridian-bootstrap`'s cron, a second weekly slot, smaller-but-more-frequent batches — with write budgets. Recommend one; no change made.
7. **Carry-overs:** which of the 18 must enter November scope (dependency for an outcome) vs stay in the register.
8. **Capacity:** Founder ~2–3 h/day; one worker; weekly usage resets Wed. Estimate packet-days for MUST and for MUST+SHOULD; fit against the weeks left in November.
9. **Recommendation:** the minimum complete scope (per outcome: requirements in, out, deferred), a dependency-ordered packet sequence (small units, each with its approval gates), the trade-offs the Founder must decide, and risks.

## Report — `claude/packets/MA-NOV-SA1_Report.md`
Header (packet, run, outcome line), then sections: 1 Summary (≤12 lines, with the decisions for the Founder as a numbered list), 2 Requirement table (id · baseline · class · priority · size · schema · prod · evidence), 3 Bond inventory, 4 Data/identity gaps, 5 Holdings option C, 6 Carry-overs, 7 Capacity, 8 Recommended scope and sequence, 9 Risks, 10 Queries run (each with rows_read; total), 11 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-SA1`.
