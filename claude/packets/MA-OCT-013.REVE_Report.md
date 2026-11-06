# MA-OCT-013.REVE — Report

**Control** v1 `7574397de7fc870097b1ab8d87bb460860f50f4f8fbc517ed0050ca4bf51f094` (matches the Status Board row and `REVE_Status.json`) · **Task** v1 `48dc21803b6b9a3fb1d7fef23ef176bcdb1cdaefa67f4c858f9f296a571aa737` (matches) · **Executed by:** ETF Product Lead (ETF-PL), Cowork · Fri 30 Oct 2026, 06:55–07:00Z (Control stamped 07:00Z).

## Verdict
**PASS WITH NOTES: 0 BLOCKER, 2 MUST-FIX before run, 6 NOTE.** 013 writes no ETF table and leaves `fund_entity_link` untouched in core. The 74 instrument repoints change no ETF overlap or exposure read, and the ETF API contracts are unchanged.

Review: `claude/MA-OCT-013_ETF_Review.md` `381ccb991149f6c76fb265f17eefbbe26a014eb3f7d89e8236696b7bf6da6e84`.

## Session checks
| Check | Result |
|---|---|
| Control hash vs board / Task hash vs Control | match / match |
| Spec rev 0 / SPEC report hashes (Task) | `9a746677…69a3` match / `d06c5e5b…c19d` match |
| Branch / lock files | `October-2026` / none (checked at start and end) |
| D1 / deploys / git writes / secrets | 0 / 0 / 0 / none read |

## Findings
| # | Severity | Finding | Owner |
|---|---|---|---|
| MF-1 | MUST-FIX before run | **Filings/13F `entity_id` copies were not measured.** `managerissuerpositionquarterly`, `issuerperiodsummary`, `issuereventstream` and `financialfact_reported` hold `entity_id` copies. The Issuer panels read them without the R3 redirect. Add indexed probes at plan time (≈ 6–8k reads; `financialfact_reported` by `cik` only), list any hits, and scope the §14 "0 dangling" wording. 013 still writes none of these tables. | Eng Lead / Architect |
| MF-2 | MUST-FIX before run | **Make "no ETF table written" runner-enforced.** Add a table allow-list that is proven fail-closed on the Sun 1 dry run. Change `fund_entity_link` from auto-repoint (§7 row 2) to stop-and-refer to ETF-PL. | Eng Lead (build packet) |
| N-1 | NOTE | §12 "consolidates on next recompute": gate3 uses `INSERT OR IGNORE`, so only new months or new (survivor, holder) pairs pick up the 74 links. No loss against today. Text fix. | Eng Lead |
| N-2 | NOTE | If the B13-2 fold triggers at plan time, list the affected exposure keys for ETF-PL; §12 then no longer holds as written. | Eng Lead |
| N-3 | NOTE | The 13F holdings route returns survivor ids from Mon 2. This is correct, not a regression. | info |
| N-4 | NOTE | Spec says "≤ 5 hops"; code has `NAV_MAX_HOPS = 3`. Harmless (013 makes 1 hop). Align the text. | Eng Lead |
| N-5 | NOTE | `FREEZES.json` is now `4d8202bb…d7fc` (spec pins `9c368fa6…e829`). The 22:00 sweep band is not in the file, and §13's A2 dates are stale. The runner should read and hash the live file. | Ops Lead |
| N-6 | NOTE | ETF-PL Mon 2 post-run spot check: overlap, exposure and the entity icon on the repointed instruments against a Sun 1 baseline, ≤ 1k reads, non-gating. | ETF-PL |

## ETF budget
No ETF writer runs on Mon 2 after 08:00Z: holdings runs Sun 04:00Z, and bootstrap is complete and exits early. Q1's 70k account ceiling costs the ETF lane nothing.

## Files
| File | SHA-256 |
|---|---|
| `claude/MA-OCT-013_ETF_Review.md` | `381ccb991149f6c76fb265f17eefbbe26a014eb3f7d89e8236696b7bf6da6e84` |
| `claude/packets/MA-OCT-013.REVE_Report.md` | this file |

Both files are untracked; the Main Lane lists them for the next commit. `REVE_Status.json` was not edited (Main Lane owns it).

MA-OCT-013.REVE reported
