# MA-NOV-EXP.W3R3 — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-19
EXECUTED BY:  Engineering Lead + UX Lead — interactive, LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-EXP.W3R3_Status.json (= approval of the wording below)
CONTROL:      claude/packets/MA-NOV-EXP.W3R3_Control_v1.md
```

## Pins
| File | blob |
|---|---|
| `App/ma-entities.js` at HEAD | `c87a2f42e9a802f90aaf627be191ee78177a010b` |

## The panel, exactly (values from `exp_compute`; % to 2 dp)
**Heading:** `What your portfolio is made of`

Lines, in this order. **Hide any line whose value is 0.00%**, except the first.
1. `Companies we could identify` — direct + via ETFs.
2. `Holdings we couldn't match to a company` — unmapped + no-identifier + merge-unresolved, as one number, with a `▸ details` toggle showing:
   - `Not linked to a company in our data` — unmapped
   - `No identifier in the fund's filing` — no-identifier
   - `Linked to a merged record we couldn't resolve` — merge-unresolved
   (details also hide 0.00 lines)
3. `Fund cash, derivatives and other items` — fund residual, with an ⓘ tooltip: `What the funds report outside their listed holdings, such as cash, derivatives and borrowings. It can be slightly negative.`
4. One line **per** unsupported input: `Not analysed: {SYMBOL} ({a}%)` followed by one plain sentence:
   - too large (422 rows or size): `This fund is too large to look through here.`
   - no stored holdings: `We don't have this fund's holdings.`
   - unknown symbol / month not stored / invalid: `We don't recognise this fund.`
5. One line per not-loaded input: `Couldn't load: {SYMBOL} ({a}%)` + `Retry`.
6. `Not allocated` — unallocated.

**Sum line:** `✓ Adds up to 100%`. If the check fails: `⚠ Doesn't add up to 100% ({x}%). Please report this.`
**Footnote (small):** `We don't guess. Anything we can't match to a company is shown separately, never spread across other companies.`
**Confidence line:** `About {n}% of the company exposure from your ETFs relies on lower-confidence matching. Treat those companies as indicative.` with the existing hide toggle labelled `Hide them` / `Show them` next to it (n rounded to a whole number; hide the line when n = 0).
**Bar:** segments follow the same grouping (companies · couldn't match · fund other items · not analysed · couldn't load · not allocated); negative segments are not drawn.

Remove from this panel: the old line labels, "Merge redirect unresolved", "No-identifier holdings", "Unsupported inputs", "Not loaded", "Sum", and the old two-sentence explanation.

## Work
1. Apply the above in the EXP UI block; no change to calculation outputs.
2. Tests (`exp-ui`): zero lines hidden; grouping sums (couldn't-match = unmapped + no-id + unresolved); per-input "Not analysed" lines with the right sentence for 422 / 404 / unknown; sum line both ways; confidence line hidden at 0; banned words absent.
3. Preview (≤ 5 look-throughs): `#/exposure?i=ETF:VXUS:50,ETF:EEM:50` and `#/exposure?i=ETF:EEM:60,EQ:2191:15`; capture the panel text before and after.
4. Suites; commit "MA-NOV-EXP.W3R3: plain-language portfolio panel" (explicit paths); push; `ls-remote`.

## Report — `claude/packets/MA-NOV-EXP.W3R3_Report.md`
Header; 1 Before/after panel text (both scenarios); 2 Tests; 3 Deviations; 4 Boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-EXP.W3R3`.
