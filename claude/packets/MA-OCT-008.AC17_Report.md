# MA-OCT-008.AC17: Report (LANE-8, Data-Identity Lead)

**Control** v1 `e8655b0e8fa0fddd8c36a52dfb9977d18774f8ae486272d433deb88ffd282be6`, which matches the STATUS_BOARD row. **Task** v1 `6a3a955b16b0efddff0eafc3dd25e2804ed859debe7595bf8701c48c01814d16` ✔. Thu 15 Oct ≈ 05:55 UTC. HEAD `3960aee`, branch `October-2026`, no `.git/*.lock`.

**Start approval:** taken from the Founder's chat instruction to this session ("execute it", 15 Oct 05:40 UTC). The Main Lane owns the Status file, so I did **not** edit it. Please move it to EXECUTING, then to REPORTED.

## Result
- **AC17: 51 of 51 signed, 0 rejected.** Every skip is common stock, a DRIP, depositary shares, Equity Units, a selling-holder resale or an exchange offer. I scanned all 51 for a debt title. The 7 hits are debt components of Equity Units or exchangeable-note share resales, not standalone bonds.
- **B-1: accept.** **B-1b: accept, generalised as L8-14:** a row is `final` only if `principal_amount` > 0. **B-2: accept.**
- **B-3: accept with conditions.** At least 8 B-3 rows go into the 60-row precision sample, and B-3 is withdrawn if precision is below 98%. The parse path is logged.
- **B-4: accept with conditions.** Prefixed symbols (`C$`, `A$`) are matched before a bare `$`; cp1252 decoding applies only to HTML5 numeric references.
- **Demand notes: accept, as new rule 5 on the fall-through only.** I extended it to merger documents (→ `skipped_other`) and stock-plan supplements (→ `skipped_non_debt`). I opened all 45 affected documents and pre-signed their accessions (39 demand-note, 5 merger, 1 plan).
- **L8-12, co-registrants:** NextEra Energy Capital Holdings, Welltower OP LLC and Pfizer Netherlands International Finance B.V. are stored under their own CIK with their own `bond_issuer_link` row (`status = 'paused'`, linked by the §11 rules). If unmatched: `entity_id` NULL plus a DQ ticket. Never under the parent. If the co-registrant's CIK is unknown, hold the rows. Up to 3 extra link rows; the 30 polled issuers are unchanged.
- **L8-13, recurring instruments (19 keys):** all rows load. 009 shows one bond per `instrument_key`, taking the terms from the latest filing, with an "N filings" badge. Principal is never summed.
- **Pilot:** may start after the build lane codes the rulings, re-runs the dry run (any new skip outside the signed lists must be signed), and T12 is done. No pilot issuer is affected by L8-12.

## Rulings to log
R2b (B-1), L8-12, L8-13, L8-14, and spec §7.3 rule 5 (demand / merger / plan). v2 backlog:
- the new-notes leg of exchange offers (Boeing, Realty Income ex-Spirit, Verizon, Comcast, ICE);
- remarketed Equity-Unit debt;
- issuer–guarantor edges.

## Independence flag
**This chat session previously served as REVIEW-A (Architect)**: the 008 Architect review and its rev 1.2 check. The Task sends B-3 and B-4 to the Architect at close-out, and I add L8-12. **That check must be done by a fresh Architect session, not REVIEW-A in this session.**

## Files
- Written: `claude/MA-OCT-008_AC17_Signoff.md` **`5cdb7d89ac34360698b991c6d1769a5381b5a0a5d1b222cc46462063f889f4e0`**; this report.
- Read: `packets/MA-OCT-008.BUILD_Report.md` `142383c6…220b`; spec rev 1.2 `bcdad9a2…5cd3`; `bonds/state/dryrun-2026-10-14.json` `f6048710…6602`; cached filings in `bonds/state/cache/` (read-only).
- 0 D1 statements, 0 SEC requests, 0 git writes, 0 code edits. No command that could raise a macOS prompt.
