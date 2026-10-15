# LANE-8 (Cowork, Data-Identity Lead — 008 spec): REPORT

```text
REPLYING TO:  claude/relays/LANE-8_NEXT.md (Main Lane, Fri 9 Oct; A8-1..A8-6)
FROM:         Data-Identity Lead (008 spec lane), Fri 9 Oct 2026, ~17:05 UTC
FOR:          Main Lane hash check + REVIEW-A delta check; Founder 12 Oct
```

## What I did

- **Delivered `claude/MA-OCT-008_Spec.md` rev 1.2:** 652 lines, SHA-256 `bcdad9a2d315371b9c60b11cbcf72dfca88c99dca22fbe4e5310e2fb5f815cd3`.
  - It supersedes rev 1.1, `bfa13b616112cb69ff2425b176dd35d31e5b6480d701b1af7c65a3ed51e9cee2`. I re-hashed rev 1.1 on disk before editing.
- **Inputs, all re-hashed on disk:**
  - `claude/MA-OCT-008_Architect_Review.md` `1e91b3d3da4188238178b2fc0786a0bf38edc464e3742c00297c85de100f222d` (matches NEXT);
  - `claude/relays/FREEZES.json` `cdc9606a881d7b24c92a2d675efd3b4f4d6df8205073fa299209b068d16ac346`;
  - `claude/MA-OCT-011_Spec.md` rev 1.8 `096f857d5f20725b4116149aa7438b995953d7232c14c94d178987593412b270`;
  - `claude/MA-OCT-013_Spec_Brief.md` rev 1.6 `00ec63032bfc9b0c85ff71c919ae95c64faea5e89f59485b19cd337470b53485`;
  - `claude/MA-OCT-002_Spec.md` rev 1.3 `9ec6773a2cf8be3ca855f1583bef148146d0ee6ae42a875407fc20dbfef23893`.
- **Applied A8-1 to A8-6, notes N8-1 to N8-3 and ETF PL note EP-1:**
  - **A8-1:** final inputs re-cited. 011 is now rev 1.8 and 013 rev 1.6, newer than the 1.7 and 1.5 the review cites; both supersessions are noted. The wrangler pin now matches ENT-CR1 step 1 (`--version` = 4.96.0, or the node_modules pin after CR-5; never `npx`).
  - **A8-2:** F-1..F-5, the 120 s fetch age and the UTC-date check were already in rev 1.1. The freezes are now parsed from `FREEZES.json`, with enrich **05:50–07:10**, boost **10:45–11:15 / 16:45–17:15**, Mon 03:30–08:00, bootstrap 07:55–08:05, 23:50–00:10, ENT-CR1 and 011.
  - **A8-3:**
    - Precedence is now other → structured → non-debt → debt, first match wins, applied to the security title only.
    - The structured rule needs an underlier word and excludes benchmark rates (SOFR, Treasury, Prime and the like).
    - `\\bUnits\\b` only counts in the title.
    - **AC16:** a plain SOFR floating-rate note stays `final`.
    - **AC17:** every `skipped_*` row from the dry run, for the 29 non-Wells issuers, is signed off before the first live batch.
  - **A8-4:**
    - A failing tranche keeps its `tranche_seq` with `parse_failed`, keeps its fields, and gets a NULL `instrument_key`, so it sits outside both partial indexes at 2 writes.
    - `tranche_seq = 0` is reserved for whole-filing outcomes.
    - The re-parse path is `DELETE … WHERE parser_version = ?` plus an incremental run.
    - **AC18** added.
  - **A8-5:**
    - The runner is the "sole inserter"; 013 repoints `entity_id`.
    - `status` is now (`active`, `paused`): `paused` stops polling only and bonds stay visible.
    - Issuer→bonds step 1 no longer filters on `status`, which matches R1f.
  - **A8-6:** the ETF-tree reads are stated: `issuerperiodsummary` and `issuereventstream` at build, `holdings_pipeline_state` per run, all read-only. C1's real read estimate is now ≤ 27 executions, each ≤ that CIK's event rows (about ≤ 5k in total), with `rows_read` recorded per execution and a stop at > 10k for any single execution.
  - **EP-1:** Pack C and runner batches use literal values, with the substituted SQL recorded verbatim, because wrangler cannot bind `?`.
  - **N8-1:** the read test is measured on the pilot's first live batch.
  - **N8-2:** at the pilot, check whether `--file` reports `rows_written`; if not, reconcile against `d1-today`.
  - **N8-3:** coverage counts distinct `cik` per `instrument_key`.
  - N8-4 is deferred, as the review allows, and N8-5 was already covered.
- **Q-a and Q-b applied:** `FREEZES.json` is parsed at start and before every batch, failing closed if it is missing (this replaces L8-7). The A-1 lag value comes from LANE-1-ENG's 002a report and the Decisions Log row.
- **Self-check:** the §8 DDL loads in local SQLite 3.37 (in memory, not D1), and the step-1 plan is `SEARCH bond_issuer_link USING INDEX idx_bil_entity`.
- **Other actions:** 0 D1 queries, 0 SEC requests (lane total still 49/50), 0 git writes, no locks. Only the spec and this report were written.

## Sections changed in rev 1.2, for the Architect's delta check

The full table is in spec §18.2.

**Changed:**
- the status line and inputs list;
- **§7.1** step 3, **§7.3** (rewritten) and **§7.4**;
- the **§8** domain paragraph, **§8.1** (`status`), **§8.2** (`parse_failed` rule) and **§8.3** step 1;
- **§9.2** (pin and literals), and **§9.3** gates 1 and 5;
- **§11.2** (C1 and EP-1), **§12.2** (ii), **§12.3** (replaced) and **§12.4**;
- **§14.1**;
- **§15.2** (AC14 updated; AC16, AC17 and AC18 new) and **§15.3** steps 2 and 5;
- **§16**;
- **§18.2** (new) and **Appendix B**.

**Unchanged:** §0–§6, §9.1, §9.4, §10, §11.1, §12.1, §13, §15.1, §15.4, §17 and Appendix A.

## Rulings (please log)

- **L8-7 superseded** by the parsed `FREEZES.json` check.
- **L8-9:** `status` takes two values. `paused` means stop polling only, and no route filters on `status` (A8-5).
- **L8-10:** `parse_failed` is recorded per tranche, `tranche_seq = 0` is for whole-filing outcomes only, and re-parsing is done by `DELETE` plus an incremental run (A8-4).
- **L8-11:** classifier precedence, with the benchmark-rate exclusion (A8-3).

## Questions and routing

- **To LANE-7 (please route):** drop `AND status = 'active'` from 007 §3.6 issuer→bonds (around line 215), so 007 matches 008 §8.3 and R1f. Optionally also add `last_polled_at` to the 007 §3.6 column list, as the Architect suggests.
- **To the Main Lane:** the `status` CHECK changes from three values to two. This affects only 007's text above, and no table exists yet, so there is no migration impact.

**Founder Q1–Q3 (spec §17) are unchanged.** Both reviews support all three.
