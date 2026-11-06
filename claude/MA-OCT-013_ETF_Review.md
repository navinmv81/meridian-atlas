# MA-OCT-013 — ETF Product Lead Review of the 013 Spec

```text
ISSUED BY:    Main Lane, Control MA-OCT-013.REVE v1 (7574397d…f094), Fri 30 Oct 2026 07:00Z
EXECUTED BY:  ETF Product Lead (ETF-PL), Cowork
REVIEWS:      claude/MA-OCT-013_Spec.md rev 0  9a7466775ab8e91cc5ad70458d789138fa95d41a147d4b585ab20aeb1add69a3
              SPEC report                      d06c5e5bb8bb6f97950e7b5863224d56a6a2584f5201b9d49d680d313990c19d
MODE:         Doc-only. 0 D1 calls, 0 deploys, 0 git writes, no secret file read.
```

## Verdict: **PASS WITH NOTES**

**0 BLOCKER · 2 MUST-FIX before run · 6 NOTE.**

013 writes no ETF-domain table, leaves `fund_entity_link` untouched in core, and does not change any ETF API contract. The 74 instrument-link repoints do not change any ETF overlap or exposure number that the ETF terminal reads. The two must-fix items are small and need no redesign:

- **MF-1** fills a measurement gap behind the spec's "0 dangling references" claim, on tables outside the Entities domain.
- **MF-2** makes the "no ETF table written" claim structural (enforced by the runner) rather than declarative.

The Founder decisions in ML-1029-4 (Q1 cap 33k / account ≤ 70k; Q2 LEI-bearing survivor, 642 → November; Q3 cross-pair → November) are taken as given and are not re-opened.

## 1. Method

The §12 claims were checked against the code on `October-2026` (no lock files), not taken from the spec's prose:

- **ETF Worker** `meridian-proxy` (`App/ETF Refresh/src/index.js`): every ETF route.
- **ETF UI** `ma-etf.js`: every call into entity data.
- **gate3** `App/Corporate Atlas/gate3-exposure.js`: how `instrument_entity_map` feeds exposure.
- **Schemas**: `corporate-atlas-v1.sql`, the ETF Refresh migrations, and the Sprint 2/3 Filings/13F migrations.
- **Every reader** of `entity_id` outside the Entities Workers.

## 2. ETF-domain impact (Task focus)

| Focus item | Finding | Evidence |
|---|---|---|
| **No ETF table written** | **Holds.** Spec §6–§8 write only `entity_merge_redirect`, `entity_master`, `entity_enrichment_queue` and `instrument_entity_map` in core. None of these is ETF-domain. No ETF table (`etf_master`, `fund_holdings_monthly`, `fund_snapshot_monthly`, `universe_changes_monthly`, `holdings_pipeline_state`, `etf_aliases`, `edgar_bootstrap*`) holds an `entity_id`, so none can dangle. | ETF schemas and migrations: no `entity_id` column in ETF tables |
| **ETF overlap reads** | **Unaffected.** `/api/etf-overlap` and `/api/etf-compare` compute on `fund_holdings_monthly` weights only. | `index.js` L470–L700 |
| **ETF exposure reads** | **Unaffected.** `/api/etf-exposure` (Exposure Explorer, `metafc`) reads `fund_holdings_monthly`, `etf_master` and `etf_aliases`. It never reads `instrument_entity_map` or `entity_exposure_monthly`. | `index.js` L702–L760; `ma-etf.js` L2578–L2579 |
| **ETF holdings → entity icon** | **Unaffected.** `handleEntityIconClick` → `/api/entities/isin/:isin` joins `entity_isin_map` → `entity_master`. The spec measured 0 `entity_isin_map` rows on candidates. | `ma-etf.js` L2989–L2999; `entities-api.js` L343–L357 |
| **The 74 instrument-link repoints** | **Correct for ETF-adjacent consumers.** `instrument_key` is the PK, so a repoint cannot collide or duplicate. It moves the issuer of 74 instruments from twin to survivor in gate3 pass 2 (CUSIP-only holdings), the 13F holdings route and 007 R1/R2. Coverage (`fund_exposure_coverage.mapped_weight`) is unchanged, because each instrument stays mapped. N-1 covers the timing of the exposure effect. | `gate3-exposure.js` L82, L95–L103 |
| **`fund_entity_link` untouched** | **Holds in core** (0 rows on candidates; spec §4, measured as a 264-row scan). §7 row 2 still carries an auto-repoint rule for it. MF-2 asks that this rule become stop-and-refer. | spec §4, §7 |
| **ETF API contracts unchanged** | **Holds.** No ETF route, response shape or `metafc` field changes. 013 deploys nothing. | — |
| **ETF D1 budget on Mon 2** | **No contention.** The holdings cron is `0 4 * * sun` (Sun 1, inside its own freeze band). Bootstrap (`0 */4 * * *`) is complete and exits early. No ETF writer needs Mon 2 headroom after 08:00Z, so Q1's 70k account ceiling costs the ETF lane nothing. | `wrangler-holdings.toml`, `wrangler-bootstrap.toml`, `bootstrap.js` |
| **Partial-A2 / post-011 state** | **No ETF dependency.** A2 writes LEIs on Entities rows only, and §5 plan-time re-derivation treats A2 LEIs as accepted, not required. The ETF-side conclusions above hold whether A2 is complete or partial. | spec §5 item 4, §13 |

## 3. Findings

### BLOCKER
None.

### MUST-FIX before run

**MF-1 — Measure the Filings/13F `entity_id` copies before claiming "0 dangling references".** *Owner: Engineering Lead for Data-Identity; Architect to rule. 13F/Filings owner informed. Not ETF-domain.*

Four tables outside the Entities domain store a copy of `entity_id` taken at seed time:

| Table | How `entity_id` is set | Index |
|---|---|---|
| `managerissuerpositionquarterly` | `iem.entity_id` | `idx_mqp_entity_id` |
| `issuerperiodsummary` | `entity_master` joined on `cik` | `idx_ips_entity_id` |
| `issuereventstream` | `cik` → `entity_id` map | `idx_ies_entity_id` |
| `financialfact_reported` | — | no `entity_id` index |

Spec §4 / Appendix A did not probe any of them. §10 checks only tables 1–7, but §2 goal 2 and §14 claim "0 dangling references".

**Why it matters.** The Issuer page (`handleIssuerPanels`, `entities-api.js` L757+) reads ownership, financials and events by `WHERE entity_id = ?`, **without** the R3 redirect. If a duplicate carries rows there, the survivor's page silently loses them until the 13F/Filings seeds re-derive.

**Fix (no redesign):**

1. Add three indexed probes over the deletion set to the Mon 2 plan-time read pack: about 2k ids × 3, ≈ 6–8k reads, inside the ≈ 110k read plan.
2. Do **not** scan `financialfact_reported` by `entity_id`, because that column has no index. Probe it by the duplicate's `cik` from the pre-image, only when the `cik` is non-null.
3. If R = 0, record it.
4. If R > 0:
   - 013 still writes none of these tables (§3 non-goal stands);
   - list the rows with a SHA-256;
   - name the recovery: the next seed of each table re-derives from the repointed links and the surviving `cik`, or the issuer panels are made redirect-aware (Architect's call);
   - amend the §14 wording to "0 dangling references in Entities-domain tables; Filings/13F copies listed".

**MF-2 — Make "no ETF table written" and "`fund_entity_link` untouched" runner-enforced.** *Owner: Engineering Lead (013 build packet).*

The spec states both claims but enforces neither.

- **Table allow-list.** The runner refuses, at plan and at execute, any statement whose target is not in:
  - `entity_merge_redirect`, `entity_master`, `entity_enrichment_queue`, `instrument_entity_map`;
  - `entity_relationships`, `entity_isin_map`, `entity_exposure_monthly`, `bond_issuer_link` (each at 0 rows today);
  - plus the runner's own outbox and run-log tables.
- **Dry run proves it.** Add an §14 acceptance line: the Sun 1 dry run fails closed on a statement aimed at an ETF table.
- **`fund_entity_link` becomes stop-and-refer.** Replace §7 row 2's auto-repoint with: *any `fund_entity_link` row on a duplicate at plan time → drop that merge and refer it to ETF-PL*. Measured today: 0. `fund_entity_link` is the holder bridge for gate3 and the ETF ↔ entity join, so a change to it is an ETF-visible identity decision, not a mechanical repoint.

### NOTE

**N-1 — Correct the §12 wording on when exposure consolidates.** gate3 writes `entity_exposure_monthly` with `INSERT OR IGNORE` on PK `(report_month, entity_id, holder_entity_id)` and never deletes a month first (L77, L88).

- Recomputing an **existing** month therefore will not raise a survivor's `weight_sum` for a holder it already has. Only new `(survivor, holder)` pairs and **future** months pick up the 74 links.
- Nothing is lost against today, because the duplicates carry 0 exposure rows.
- So "consolidates on next recompute" is true only for new months, or after a month-scoped clear owned by the Entities lane.
- Text fix only; no change to the run.

**N-2 — If the B13-2 fold ever triggers, §12 no longer holds.** If the plan-time export finds exposure rows on a duplicate, the fold changes the survivor's `entity_exposure_monthly` numbers (Corporate Atlas, not the ETF terminal). The run report should then list the affected `(month, survivor, holder)` keys for ETF-PL, and §12's "no exposure number changes on Mon 2" must not be carried into the close-out unchanged.

**N-3 — The 13F holdings route returns survivor ids after the merge.** The route at `worker-13f.js` L229 returns `iem.entity_id` live. For the 74 instruments it returns the survivor id from Mon 2. Any id a client kept from before the merge resolves through R3. This is correct; it is recorded so that a 13F-side check does not read it as a regression.

**N-4 — Hop-limit text vs code.** Spec §6 says "≤ 5 hops", but `NAV_MAX_HOPS = 3` in `entities-api.js` L367. This is harmless, because 013 never chains (each redirect is one hop). Align the text.

**N-5 — Use the current `FREEZES.json`.** The spec pins `FREEZES.json` `9c368fa6…e829`. The file on disk is now `4d8202bb…d7fc` (re-issued 30 Oct; A2 re-pinned to a Sat-only run, ML-1030-1). In addition:

- the "≈ 22:00 health-check sweep" band in §9 is not in `FREEZES.json` `recurring`, so the runner must carry it itself;
- §13 still says A2 runs "Fri 30 – Sat 31".

The runner should read and hash the live file at plan time. *For Operations Lead; not ETF.*

**N-6 — ETF-side Mon 2 post-run spot check (no D1 writes, ≤ 1k reads).** After §10, ETF-PL will run the following against the survivors of the 74 repointed instruments:

- `/api/etf-overlap` and `/api/etf-exposure` on 3 ETFs that hold them;
- the ETF holdings entity icon on 3 ISINs;
- confirm the responses match the Sun 1 baseline byte-for-byte except for timestamps.

This is ETF-PL's own release-review evidence; it does not gate the run.

## 4. Tables and Workers touched (cross-lane review rule)

| Object | 013 core | Domain |
|---|---|---|
| `entity_merge_redirect` (new) | create + 1,979 inserts | Entities (CR1) |
| `entity_master` | 1,979 deletes, 1,878 key updates, 3 LEI writes | Entities |
| `entity_enrichment_queue` | ≤ 1,979 deletes | Entities |
| `instrument_entity_map` | 74 repoints | Entities (ETF-visible via gate3 pass 2) |
| `entity_relationships`, `entity_isin_map`, `entity_exposure_monthly`, `bond_issuer_link` | 0 rows today; guarded rules | Entities |
| `fund_entity_link` | 0; stop-and-refer under MF-2 | Entities (ETF bridge) |
| ETF tables | **none**, read or written | ETF |
| Filings/13F `entity_id` copies | read-only probes under MF-1; never written | Filings/13F |
| Workers / deploys | none (local runner) | — |

**Index safety:** every 013 probe is a covering-index `SEARCH` (spec §4). The MF-1 probes use the existing `idx_mqp_entity_id`, `idx_ips_entity_id` and `idx_ies_entity_id`. `financialfact_reported` is probed by `cik`, never scanned.

## 5. Sign-off condition

ETF-PL signs the Mon 2 release review when:

1. MF-1 and MF-2 are folded into the 013 build packet or a spec rev 1;
2. the Sun 1 dry run shows the MF-2 allow-list failing closed.

N-1 to N-5 can be folded as text at the same time.
