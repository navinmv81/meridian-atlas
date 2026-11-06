# MA-OCT-008 — AC12 re-adjudication (DIL14 §5 re-test)

```text
ISSUED BY:    Data-Identity Lead (LANE-11), packet MA-OCT-FRI30.DIL, Fri 30 Oct 2026 ≈ 14:30Z
              Fresh Claude Code session. Did not build 008, R-1, R-2 or R-3, and did not draw the original 60-row sample.
EXECUTED BY:  Data-Identity Lead. D1 read-only (≈ 1.0k rows read, 0 written), no deploys, no git writes. 0 SEC requests (cache only).
              External look-ups for A2 row 73 only (see the FRI30.DIL report).
GOVERNING:    DIL14 report c517dde7b9a561870ef1123b33d55a2d99fcbdb6f3bbb197dd946691d11c9399 §5
              THU29.ENG8 report 52699fea9fa71b302293f85fd1291d03ad7ed12317a607c015772b065e61f5ad (R-2, R-3, step-4 evidence pack)
              WED28.ENG8 report (R-1, in-place re-point)
              009/010 spec rev 1 2f83d58e0042ebfe920f5823598ee3827c21c57b6bbc103f552cef419b2841f4 §4.1, §4.4, §4.5
RESULT:       AC12 PASS. Every DIL14 §5 condition is met. R-1 and R-2 methods CONFIRMED. R-4 move list SIGNED (1 row).
              The gate is NOT opened. The opening statement (§6) runs only after its preconditions and the Founder's acknowledgement.
```

## 1. Evidence used (all hashes re-computed this session)

| Input | SHA-256 |
|---|---|
| `bonds/state/sample60-2026-10-16.json` | `fc9ce6294ed71bba4436be18d9a20237b696dd5b0667a5d362163a38cd3dcbfd` |
| `bonds/state/r1-pepsico-sg-2026-10-28.sql` | `d6f33154d13e8831899d6fea7ec3839ceebbc72806f7ce9b4801cd45afe379fc` |
| `bonds/state/r2-reparse-2026-10-29.sql` | `673979efd48d474a2af40a27b1373bdf7b5b13ee0a0c448de1f03771cabaa167` |
| `bonds/state/r2-fills-2026-10-29.json` (37 fills) | `81d393e30984d04295e5669ed74fea61da225d7830eb233fcb59b6c2dc946e58` |
| `bonds/state/r3-filer-scan-2026-10-29.json` | `25ea49b56c5ad3154b0f9713763c9c47e9928dc0770f29b79ae59d6c2227dcae` |
| `bonds/state/finals-2026-10-16.json` (pre-R-2 population) | as DIL14 (`28d32b35…e263`) |
| `bonds/state/cache/` (845 SEC documents; key = sha256(url)[:32]) | read only |

**Live D1 reads (read-only, all EXPLAINed first):**
- `bond_issuance` for the 4 R-2 CIKs: the declared 943-row small-table SCAN, the same plan as the ENG8 guard.
- The 4 PepsiCo rows by PK.
- `bond_issuer_link` for `0002007029` and `0000077476` by PK.

## 2. R-1 (PepsiCo Singapore; DIL14 P-1, sample row 9): method CONFIRMED

**Live state, 30 Oct:**
- `0001104659-24-022370` / 1–4 are `cik = '0002007029'`, `final`, `parse_confidence` 85, `instrument_key` NULL.
- Link `0002007029`: `entity_id` NULL, `unmatched`, confidence 1, `status = 'paused'`. This is L8-12, as §4.5(2) requires.
- PepsiCo Inc `0000077476` → 1457 is unchanged.

**Ruling: the in-place guarded `UPDATE … SET cik` is accepted in place of DIL14's delete + re-ingest.**
- The end state is the one R-1 intended: the rows sit under the issuer's own CIK, with the parsed values untouched.
- Re-ingesting would have re-created the guarantor link, because the parser's cover hint misses this filing. The literal method would have failed AC12 again.
- Future PepsiCo incremental runs skip the accession, since `knownAccessions` is keyed on accession.

**One note, not an error:** the 4 rows still say `parser_version = 'bonds-1.1.0'`. That is correct, because they were not re-parsed.

## 3. R-2 (37 floating spreads; DIL14 P-2, sample rows 43, 44, 46): method CONFIRMED, values 37/37 correct

**Method ruling.** The new rows are the stored row plus only the 1.1.0 → 1.2.0 delta. This "row-preserving re-parse" is accepted.
- A plain re-parse would have dropped 15 Toyota FWP-sourced CUSIP/ISINs and 3 Home Depot cross-check confidences. Neither has anything to do with the spread defect.
- I verified this on live D1. The 191 rows under the 4 CIKs are all `bonds-1.2.0`, and 165 of them are `final`.
- Against the 16 Oct finals, **exactly 37 rows differ**. Every difference is limited to `spread_bps`, `benchmark` and `parse_confidence`, and equals `r2-fills`.
- 0 unexpected changes. 0 spread-less floating or fixed-to-floating finals remain under these CIKs.

**Values, checked against the cached source text by me, not by re-running the parser:**

| Group | Rows | Source wording | Result |
|---|---|---|---|
| Toyota MTN floating | 11 | "Spread: +NN basis points" (one value per filing) | 11/11 |
| Home Depot floating | 1 | "Compounded SOFR plus 0.330%" | 1/1 |
| American Express fixed-to-floating | 14 | "Compounded SOFR … plus X%" per tranche | 14/14 |
| Capital One fixed-to-floating | 11 | "base rate … plus X%" | 11/11 (incl. EUR notes → EURIBOR) |

**Detail:**
- For the two filings with more spread phrases than fixed-to-floating tranches (`0001104659-26-010376`, `0001193125-25-089345`), I read each phrase in context. The extra phrase belongs to the filing's plain floating tranche, which is not in the 37. Each fixed-to-floating tranche got its own spread.
- **Rounding:** the INTEGER column rounds to the nearest bp: 1.905% → 191, 0.581% → 58, 0.867% → 87, 1.508% → 151, 2.036% → 204, 1.072% → 107, 1.451% → 145. **Not counted as an error.** For 009/010: show these as "≈ +191 bps" or source-exact only after a NUMERIC column exists (November); do not claim exactness.
- **Sample rows:** 43 → 65 bps SOFR ✔; 44 → 48 bps SOFR ✔; 46 → 226 bps SOFR (source "plus 2.260%"), coupon 6.051% unchanged ✔.

## 4. R-3 (co-registrant filer-list scan): reviewed, 0 wrong-issuer links

I accept the scan's counts: 326 filings; 300 single filer; 19 stored under their own co-registrant CIK; 3 with other filers not on the cover; 4 with the index unavailable (503); **0 candidates**.

**3 Comcast filings** (`-24-143955`, `-24-225214`, `-25-113873`), under CIK `0001166691`:
- The cover reads "We are offering …"; "we" is Comcast Corporation, the filer.
- The other two filers, NBCUniversal Media LLC and Comcast Cable Communications LLC, appear only as "fully and unconditionally guaranteed by our wholly-owned subsidiaries".
- They are guarantors, not issuers, so they are **correct as stored**.

**4 cover-checked filings** (the index returned 503), each cover read by me:
- **Dominion Energy `-24-132931`, `-24-259704`:** the cover issuer is Dominion Energy, Inc. (the filer, `0000715957`). There is no co-issuer and no guarantor. Correct.
- **Verizon `-25-170770`:** the cover issuer is Verizon Communications Inc. (the filer, `0000732712`). The word "guarant…" does not occur in the first 10k characters. Correct.
- **Welltower OP `-25-171785`:** the cover says "Welltower OP LLC (the “issuer”) … Fully and unconditionally guaranteed by Welltower Inc." It is stored under Welltower OP's own CIK `0001917598`. Correct.

**Population result: 0 wrong-issuer links.** This also matches DIL14's independent cover scan.

## 5. Fresh 10-row random check of the re-parsed CIKs

- **Draw:** the 165 `final` rows among the 191 `bonds-1.2.0` rows, ordered by `sha256('MA-OCT-FRI30.DIL.AC12:' + accession/seq)`, first 10.
- **Coverage:** all 10 fell on Toyota (TMCC is 115 of the 165; American Express 27, Home Depot 12, Capital One 11). That is the draw as made; I did not re-draw.

| Accession / seq | Rate type | Coupon | Principal | Maturity | Issuer | Result |
|---|---|---|---|---|---|---|
| 0000950103-26-000574 / 1 | fixed (callable MTN) | 4.15% | 25,000,000 | 2031-01-21 | TMCC | ✔ |
| 0000950103-24-013927 / 1 | fixed | 3.70% | 25,000,000 | 2027-09-28 | TMCC | ✔ |
| 0000950103-24-003395 / 1 | fixed | 5.00% | 25,000,000 | 2027-03-12 | TMCC | ✔ |
| 0000950103-25-014688 / 1 | fixed | 4.75% | 25,000,000 | 2037-11-19 | TMCC | ✔ |
| 0000950103-24-015011 / 1 | fixed | 4.35% | 35,000,000 | 2027-10-22 | TMCC | ✔ |
| 0000950103-25-013408 / 1 | fixed | 4.05% | 125,000,000 | 2030-10-22 | TMCC | ✔ |
| 0000950103-26-000297 / 2 | fixed | 3.750% | 750,000,000 | 2028-01-12 | TMCC | ✔ |
| 0000950103-25-000270 / 3 | fixed | 4.950% | 700,000,000 | 2030-01-09 | TMCC | ✔ |
| 0000950103-24-000197 / 4 | fixed | 4.800% | 800,000,000 | 2034-01-05 | TMCC | ✔ |
| 0000950103-24-014724 / 3 | fixed | 4.600% | 750,000,000 | 2031-10-10 | TMCC | ✔ |

**10/10** (40/40 field checks, 10/10 issuer). For the four multi-tranche filings, coupon, principal and maturity were read together in the cover's own tranche line.

## 6. The 60-row figure, with corrections

| | Before (DIL14) | Now |
|---|---|---|
| Field accuracy | 237/240 (98.75%) | **240/240 (100%)**: rows 43, 44 and 46 confirmed against source (§3) |
| Wrong-issuer links in the sample | 1 (row 9) | **0**: row 9 is under `0002007029` (§2) |
| Wrong-issuer links, population (R-3) | not run | **0** (§4) |
| The 37 formerly spread-less rows | 0/37 | **37/37 (100%)** |

**AC12 = PASS.** DIL14 §5 required ≥ 98%, 0 wrong-issuer links in the sample and the population, and ≥ 98% on the 37. All are met.

## 7. R-4 (remarketing rule, RB-3): move list SIGNED

**Scan:** I applied RB-3's pattern (`\bThis is a remarketing\b` or `\bremarketing of\b`, in the first 3,000 visible characters) to all 326 final filings, offline from the cache (0 missing).

| Accession / seq | CIK | Row | Move (signed) |
|---|---|---|---|
| `0001193125-25-169329` / 1 | `0000794447` NextEra Energy Capital Holdings | Series M Debentures due 2027-09-01, $1,999,988,000, `final` | → whole-filing **`skipped_other`** (008 §7.3 rule 1): delete tranche 1 and write the `tranche_seq = 0` audit row (008 §8 whole-filing rule) |

- **Exactly 1 hit,** as DIL14 P-3 predicted.
- **Not moved:** 3 Meta filings (`0001326801`; `-24-197096`, `-25-261217`, `-26-201738`) contain "remarketing of" only deep in the body (about 136k characters in). They are not remarketings, and the rule correctly leaves them.
- **Who writes it:** an engineering lane builds and runs it as a guarded, count-checked statement pair with a rollback file, after a three-point check. It is ≈ 10 writes.
- **Alternative for the Founder (RB-3):** keep remarketed debt as bonds, so rule 1 drops "remarketing" in v2. In that case this move is withdrawn.

## 8. Gate-opening instruction (for an engineering lane; do NOT run yet)

**Preconditions, all required, each checked by the executing lane and recorded in its report:**
1. The 009 Worker deploy is live (`meridian-entities-api`, FRI30.ENG1 step 4 or its successor). The `fi_serving_gate` migration has run, and the gate reads `closed`. **Not met at 14:17Z Fri 30: 009 is held behind 004.**
2. The 009 spec §4.4 PepsiCo check: **PASS**, recorded in that lane's report (path + full SHA-256).
3. The R-4 move in §7 is applied and read back, **or** the Founder has chosen the RB-3 alternative in the Decisions Log.
4. 009 spec §4.5(3): F1 for entity 1457 (fixture run on live data with T-F1's open state) lists none of `0001104659-24-022370` / 1–4.
5. **The Founder's acknowledgement is logged** in the Decisions Log. After Mon 2 Nov this must be the Founder's **approval** (§4.1).
6. The executing lane re-hashes this file and confirms it equals the SHA-256 recorded for it in `claude/packets/MA-OCT-FRI30.DIL_Report.md`.
7. Pre-flight: `/usr/local/bin/wrangler` 4.96.0 and `wrangler whoami`; no open production change in another lane; outside FREEZES windows; before 23:45Z.

**Statement** (one `--command`, `meridian-etf`, remote). Fill the three `<…>` with paths and **full** SHA-256s:
```sql
UPDATE fi_serving_gate
SET state='open', changed_at=strftime('%Y-%m-%dT%H:%M:%SZ','now'), changed_by='Data-Identity Lead',
    evidence='claude/MA-OCT-008_AC12_Readjudication.md <full sha256 of this file> (AC12 PASS); <009 report path with the §4.4 PepsiCo check> <full sha256>; claude/MA-OCT-008_AC12_Readjudication.md §8 open instruction <same sha256>; R-4: <R-4 apply report path> <full sha256> or <Decisions Log id for the RB-3 alternative>'
WHERE id=1 AND state='closed';
```
**Require `meta.changes = 1`.** If it is 0, stop. Do not retry; report the gate's current row.

**Read-back:**
```sql
SELECT id, state, changed_at, changed_by, evidence FROM fi_serving_gate WHERE id=1;
```
Expect `state = 'open'`, `changed_by = 'Data-Identity Lead'`, and the evidence string exactly as written.

**After the open:**
- Run T-F10 again with the gate open (≤ 12 Worker calls).
- Record the executing lane as executor in its report.

**Kill switch (any lane, any time, no acknowledgement needed):** the mirror statement `SET state='closed' … WHERE id=1 AND state='open'`, with the same `changes = 1` check and read-back. Log it the same day.

**Notes for 009/010, carried forward:**
- The spread rounding in §3.
- The 4 fixed-to-fixed reset notes (DIL14 §1) must not be labelled "fixed for life".
