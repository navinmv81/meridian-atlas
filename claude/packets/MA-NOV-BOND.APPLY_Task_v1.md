# MA-NOV-BOND.APPLY — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-25
EXECUTED BY:  Data-Identity Lead + Tech Ops — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-BOND.APPLY_Status.json (= the production D1 writes in the Control)
CONTROL:      claude/packets/MA-NOV-BOND.APPLY_Control_v1.md
```

## Pins
| File | sha256 |
|---|---|
| `claude/specs/MA-NOV-BOND_CR.md` | `3885c9999da6f9736fa7e5db6273b7e2ec2aa92c62da1a2a3f7d9a1a80b12b5b` |
| `claude/packets/MA-NOV-BOND.REVIEW_Report.md` (Tech Ops + recommendation) | `d9a78f44139721cfdd5fff944b5af116ed6a8ae35125e463f8607feb97931f78` |
| `claude/packets/MA-NOV-BOND.FIX2_Report.md` (apply method, batch vectors) | `1373dc9fa85109e85df9d4ea9fbb1d33418b4ea40d6a48d5f9089b0149f16e19` |
| `claude/packets/MA-NOV-BOND.FIX3_Report.md` (§1 F7 hash, §3 rehearsal, §5 runs) | `25ec89145722dec32bb86e7867c0cbe942dafa6ea7479ec857b2417f6a810ff1` |
| `claude/packets/MA-NOV-EXP.BFS.GO_Report.md` (BFS.CHECK queries) | `6d49490683d1ab7d4c1ff1ce0bf7cdab27e3a668cd0bab13795a59a91e64e293` |
| `App/Corporate Atlas/migrations/ma-nov-bond-cr1.sql` · `-cr1-rollback.sql` | `b2cd3751…31ff` · `0a472553…2144` |
| `App/Corporate Atlas/migrations/ma-nov-bond-cr2.sql` · `-cr2-rollback.sql` | `3a2050cd…94b6` · `54341638…893d` |
| `App/Corporate Atlas/bonds/apply/fix2-apply-run1.sql` · `fix2-rollback-run1.sql` | `47749151…7a54` · `df0ad70f…012b` |
| `App/Corporate Atlas/bonds/apply/offer-apply-run1.sql` · `offer-rollback-run1.sql` | `fad02a73…8f71` · `041ea233…4b10` |
| `App/Corporate Atlas/bonds/apply/offer-apply-run2.sql` · `offer-rollback-run2.sql` | `8e189ea5…3294` · `c3979989…149a` |

Full hashes are in `git show 5025050` / the CR and FIX3 report; check each file's full sha256 against them.

## Steps
0. **Preflight.** `whoami` (OAuth, d1 scope); HEAD = origin `5025050`; pins; bond suites pass (138); time window. **Back-fill check** (read-only, BFS.GO report's queries): the `cf.meridian-entities-enrich.expbf` ledger rows for the 06:00Z runs on Tue 24 and Wed 25 — phase, rows_read, rows_written, error_class — and Phase 1 normal before it. Record only; not a stop gate. Read today's live `rows_written` (U0).
1. **Before-hash:** `SELECT * FROM bond_issuance` → `before-hash.mjs` → must be `d70c311a8f5f06cad69b3d3558b10eff3d4ba2233044eaa93db0e6eb514ada51`.
2. **Probe:** `CREATE TABLE _cr1_probe(a TEXT, b TEXT); ALTER TABLE _cr1_probe DROP COLUMN b; DROP TABLE _cr1_probe;` Record accepted/refused; confirm `_cr1_probe` is gone.
3. **CR1:** `npx wrangler d1 execute meridian-etf --remote --file "App/Corporate Atlas/migrations/ma-nov-bond-cr1.sql"`. Verify: 26 columns; the 3 new columns NULL on all 943 rows; the 23 original columns (explicit list, original order) still hash to `d70c311a…`.
4. **FIX2:** `fix2-apply-run1.sql` batch by batch as FIX2's report describes, comparing each batch's changes with its vector; stop on the first mismatch. Reconcile: 943 rows, 638 finals, 550 with CUSIP/ISIN, 0 non-final without a reason, 0 `superseded_by` to a non-final, all at `bonds-1.3.1`. Record the post-FIX2 hash of `bond_issuance` (same method, all columns) as H2.
5. **CR2:** `ma-nov-bond-cr2.sql`. Verify the 2 tables exist (`WITHOUT ROWID`, PK only) and are empty; integrity ok.
6. **Offering run 1:** headroom rule (U + 7,989 ≤ 58,000); apply `offer-apply-run1.sql`; verify 5,902 facts + 2,087 parties at `bonds-offering-1.2.0`, 0 withheld rows.
7. **Offering run 2:** headroom rule (U + 7,581 ≤ 58,000); apply; verify totals 11,576 facts + 3,994 parties; 0 `use_of_proceeds`/`proceeds_total` rows; 0 non-NULL `selling_restrictions` values; 0 orphan tranches (every fact/party tranche exists in `bond_issuance`).
8. **Final:** `bond_issuance` hash = H2 (offering did not touch it); final `rows_written` today; reads used.

## Report — `claude/packets/MA-NOV-BOND.APPLY_Report.md`
Header (packet, run, commit, outcome DONE / PARTIAL / ROLLED_BACK, writes, reads); 1 Back-fill check; 2 Preflight + before-hash; 3 Probe; 4 CR1; 5 FIX2 reconcile + H2; 6 CR2; 7 Offering runs (headroom before each, counts); 8 Final state; 9 Rollback commands ready for the go-live packet (exact order and headroom needed); 10 Boundaries kept. Commit the report only ("MA-NOV-BOND.APPLY: bond writes to D1 — report"), push, `ls-remote`. Then `node tools/factory/dispatch.mjs end MA-NOV-BOND.APPLY`.
