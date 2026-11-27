# MA-NOV-EXP.UI.REVIEW — Task v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-18
EXECUTED BY:  Architect + UX reviewer — fresh session via LANE_OPENER_v2.md
APPROVED BY:  Founder — Start Approval in MA-NOV-EXP.UI.REVIEW_Status.json
CONTROL:      claude/packets/MA-NOV-EXP.UI.REVIEW_Control_v1.md
```

## Pins
| File | sha256 |
|---|---|
| `claude/specs/MA-NOV-EXP_Spec.md` | `785df4d54f96c580c7b72829be9cd0ed11990b5583213fb4045fe66b48e2fc3e` |
| `claude/packets/MA-NOV-EXP.W2_Report.md` | `ca65b4d9506e4439b91fbed17fbb1d825a11aa299365ae3dadf5d01d82d53f0b` |
| `claude/packets/MA-NOV-EXP.W3_Report.md` | `2cb5aca3271e2b19f41f50df4834bea37cd6bedbddc9d76bb84b0e0ead04c8b4` |

## Checks
1. **Scope:** `git diff 54b1446 797839b --stat` — only `App/ma-entities.js` (additions + the named hooks), one line in `App/index.html`, tests. No existing behaviour removed (show any `-` lines in `ma-entities.js` and judge them).
2. **Calculation (W2):** independently recompute T1 (§3.4) by hand or a separate script — every number; check reconciliation, negative weights, merge redirect, refused (422) and not-loaded handling, sort, Δ; judge W2 §4's two choices.
3. **Safety:** every API-sourced string (company names, ETF names, identifiers) is escaped before insertion into HTML; the hash parser rejects malformed input safely (fuzz a few: script tags, huge numbers, 11 inputs, negative, `%00`); no inputs stored (no localStorage/sessionStorage/cookies); no new network hosts.
4. **Spec conformance:** Screen A and B §1–8, every §2 state, §5.1 labels, §6 evidence labels verbatim; banned words absent from all EXP strings; "by company" labelling for overlap.
5. **Preview (≤ 10 look-throughs):** EEM 60 + TSMC (2191) 15 → TSMC 22.88, unallocated 25, total 100.00; VXUS 50 + EEM 50 → VXUS *too large*; compare toggle; company link → Back; 375 px. Anything the W3 report claims that you cannot reproduce is a finding.
6. **Accessibility basics:** keyboard path through pickers, table sort (aria-sort), focus after actions, contrast using the app's variables.
7. **W3 §5 gaps — judge each and recommend:** (5.1) router workaround vs adding `exposure` to the `index.html` router at release; (5.2) single-ETF stale warning (T6) — e.g. a client rule against today's date vs a newest-month field from the route; (5.3) picker badge month only after load; (5.4) ETF holdings link closes the layer (fix needs `ma-etf.js`, ETF lane).
8. **Performance:** render time and DOM size for the largest served ETF (SPAB, ~1,131 entities) and "Show more".

## Report — `claude/packets/MA-NOV-EXP.UI.REVIEW_Report.md`
Four-line header; verdict; findings table (id · B/M/N · item · evidence · fix); judgements on W2 §4 and W3 §5; **recommendation: may the screen go to Founder UAT, then release (yes / yes with conditions / no)**; look-throughs used; your session id; under ~900 words. Then `end` and stop.
