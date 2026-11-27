# MA-NOV-EXP.W2 — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-13
EXECUTED BY:  Engineering Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-EXP.W2_Status.json
CONTROL:      claude/packets/MA-NOV-EXP.W2_Control_v1.md
```

## Pins
| File | sha256 / blob |
|---|---|
| `claude/specs/MA-NOV-EXP_Spec.md` | `785df4d54f96c580c7b72829be9cd0ed11990b5583213fb4045fe66b48e2fc3e` |
| `claude/packets/MA-NOV-EXP.W1R4_Report.md` | `a26673d4383dca8c44d78bf9153a3528d0e482081fc5ad327dc2f79e7412aac0` |
| `App/ma-entities.js` at HEAD (git blob) | `63a7113c5746750aa5549f85ec43415b810be937` |

## Work
1. **`exp_validate(inputs)`** — §3.1: allocation range and 2 dp, total rules (blocked > 100.005 with the exact message; unallocated line < 99.995; never rescale), duplicates (same ETF ticker; same entity after redirect) blocked with a combine helper, ETF + direct same company **not** a duplicate, ≤ 10 inputs. Returns errors per row + overall.
2. **`exp_compute(inputs, lookthroughs)`** — §3.3 exactly: per-ETF `T, M, U, N, R`; contributions; combined/direct/indirect; inputs reaching each company; shared exposure (k ≥ 2); pairwise overlap "by company"; confidence band = lowest contributing band; Low-confidence share; negative weights kept with a note; reconciliation within 0.01 (return the check, never force it).
   - **Input outcomes:** 200 → computed; 404 `no_holdings` → *unsupported: no stored holdings*; **422 `too_large`** → *unsupported: too large for live look-through* (`limit` "rows" or "size" kept for the message); 400 → invalid; 5xx/network → *not loaded*. Unsupported and not-loaded allocations go to their own lines (never spread).
   - **Sort** companies by combined exposure, descending (tie: name, then entity id) — review N-6.
   - **Months:** per-ETF month; mixed-month and stale (> 3 months older than the newest stored) flags as §5.1; **Δ vs previous month** for T9.
   - No DOM, no fetch — pure functions only, in one delimited `// ===== EXP (MA-NOV-EXP.W2) =====` block.
3. **Tests** `App/Corporate Atlas/tests/exp-compute.test.mjs` (+ JSON fixtures in `tests/fixtures/exp-compute/`): T1 (worked example: every number in §3.4's table, reconciliation 100.00, shared {X, Z}, Y/Y′ separate, Low share 8.02%, O_A,B 11.00), T3, T4, T7, T8, T9, T10, plus: a 422 `size` input and a 422 `rows` input → unsupported lines; sort order; >10 inputs; 2-dp rule. Fixtures shaped exactly like the live R-EXP1 body.
4. Run all Corporate Atlas suites; commit "MA-NOV-EXP.W2: exposure calculation (exp_validate, exp_compute) + tests T1, T3, T4, T7–T10" with explicit paths; push; `ls-remote`.

## Report — `claude/packets/MA-NOV-EXP.W2_Report.md`
Header (packet, run, commit, outcome); 1 Summary; 2 Functions and signatures (for W3); 3 Tests (per case, numbers); 4 Deviations / spec questions; 5 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-EXP.W2`.
