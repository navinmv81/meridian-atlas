# MA-OCT-009 / 010 — Data-Identity Lead review of the Fixed Income spec rev 0

```text
PACKET:     MA-OCT-009.REVD (Control v1 85abe8e2…beea75; Task v1 e898a1e3…570f10, both re-hashed against the board)
REVIEWER:   Data-Identity Lead (LANE-11). I did not author 009/010, 008 or DIL14 (DIL14 is LANE-8's adjudication).
SUBJECT:    claude/MA-OCT-009_010_Spec.md rev 0  8216123ec92f17b6f0f828246305a01bb7ea4b6ec0a59f1945b192131f8ef3b4
DATE:       Tue 27 Oct 2026. Doc-only: 0 D1, no deploys, no git writes, no secret files.
VERDICT:    PASS WITH NOTES. 0 BLOCKER · 9 MUST-FIX before build · 7 NOTE
```

## Inputs

| Input | SHA-256 | Check |
|---|---|---|
| `claude/MA-OCT-009_010_Spec.md` rev 0 | `8216123e…8f3b4` | = Task ✔ |
| `claude/MA-OCT-008_Spec.md` rev 1.2 | `bcdad9a2…15cd3` | = Task ✔ |
| `claude/packets/MA-OCT-008.DIL14_Report.md` | `c517dde7…9c399` | = Task ✔ |
| `claude/MA-OCT-007_Spec.md` rev 1.4 | `4d4fffef…397c` | = Task ✔ |
| Live code: `git --no-optional-locks show 721d093:"App/Corporate Atlas/src/entities-api.js"` (`origin/October-2026` = `721d093d2d04…`) | `fac446bf…e245` (1,678 lines) | read from git, not the working copy |
| Supporting evidence (read-only local files, the 16 Oct load) | `bonds/state/finals-2026-10-16.json` `28d32b35…e263` (633 finals, the same file DIL14 used); `bonds/state/link-seed-2026-10-15.sql` | read only |

**Founder decisions taken (not re-opened).** Q1 (`#/fi` directory as a 007 layer), Q2 (`fi_serving_gate`, Entities domain, opened by the Data-Identity Lead on AC12 evidence, also the kill switch) and Q3 (a PepsiCo check before any front end can reach R1f). The spec is consistent with all three. The findings below are about the details and the Option C calendar.

## Key facts I checked against the data

1. **The 4 PepsiCo Singapore rows have no instrument key.** In the 16 Oct load, `0001104659-24-022370` tranches 1–4 all have `instrument_key = NULL` (and no ISIN or CUSIP):
   - FRN 2027 $300m, SOFR + 56;
   - 4.650% 2027 $550m;
   - 4.550% 2029 $450m;
   - 4.700% 2034 $450m.

   All four sit under CIK 0000077476 → entity 1457 PepsiCo Inc (`link_method 'cik'`, 95). R1f keys on `instrument_key`, so **R1 cannot return these rows today**. The exposure is through F1 (PepsiCo Inc's Bonds) and F2 only, and both are behind the gate. Spec §14 Q3 and C4 assume "the 4 PepsiCo Singapore keys" exist. They do not, so the check must be defined on the primary keys (finding M-3).
2. **276 of 633 finals carry an `instrument_key`.** On 16 Oct, no key had more than one CIK (N8-3 = 0). **19 keys appear in more than one filing**: reopenings or taps (Toyota and Caterpillar MTNs), plus **one exact duplicate**, CUSIP `14913UAP5`. That CUSIP is in accessions `0001104659-24-088590` and `-088828`: same date, same $500m.
3. **The minimum `parse_confidence` among finals is 70.** Rows below 60 are stored as `parse_failed` (008 §14.1), so the Worker's `≥ 60` filter is a safeguard. It removes nothing today.
4. **The live R1f (step 3a at `721d093`)** is `SELECT cik FROM bond_issuance WHERE instrument_key = ? AND filing_status = 'final' LIMIT 1`, then a `bond_issuer_link` PK read. It has no gate, no confidence filter and no N8-3 check.
5. **37 of the 633 finals (all Caterpillar Financial, CIK 0000764764)** have a `tranche_label` that is prospectus-cover boilerplate ("…PROSPECTUS SUPPLEMENT Dated…"). **37 floating or fixed-to-floating finals have no spread** (DIL14 P-2).

---

## Findings

| # | Sev | § | Finding | Required change |
|---|---|---|---|---|
| **M-1** | MUST-FIX | §0, §8, §12 | **The code baseline is the stale working copy.** §0 cites `entities-api.js` `d18845dd…c70db`, which is 003's uncommitted retirement copy. Live code at `721d093` is `fac446bf…e245`, and 003 deploy 5 (retirement) lands on Wed 28 **before** the 009 build. | Re-baseline on the **committed** 003 deploy-5 version of `entities-api.js` (Wed 28). Record its SHA-256 and deployed version id before the 009 diff. §12's rollback target is that version, not the pre-003 one. |
| **M-2** | MUST-FIX | §4.1, §8, §10, §12 | **The calendar is pre-Option C.** The spec has a Wed 28 deploy, a Sat 31 last deploy and a front end in the October release. Option C (ML-1025-5, ML-1026-1) has:<br>- the 009/010 build Wed 28, local;<br>- the Worker deploy Thu 29 with the gate closed;<br>- the 007 + 010 front ends in the Mon 2 Nov site release;<br>- last production change Mon 2 Nov;<br>- go-live Tue 3 Nov. | Rewrite §8 and §10 to that calendar. In §4.1:<br>- **opening** the gate is a production-visible change and happens by **Mon 2 Nov** (Wed 28 – Thu 29 is the plan, after the AC12 re-check). Opening later needs the Founder's say-so;<br>- **closing** (the kill switch) is allowed at any time, by any lane, and is logged the same day.<br>Remove "Sat 31" and "Sun 1 Nov" from §4.1. |
| **M-3** | MUST-FIX | §14 Q3, §10, §4.3 | **The pre-deploy PepsiCo check is undefined, and its premise is wrong** (fact 1). | Define it as below (≤ 8 PK reads, read-only, in the 009 build before the Thu 29 deploy). |
| **M-4** | MUST-FIX | §4.2, §7.2 | **Closed-gate contradiction.** §4.2 says no issuer name or count from the bond tables leaves the Worker while the gate is closed. §7.2 shows the section "when the gate is closed and the entity has CIKs", which needs F1 to return `ciks` (issuer names from `bond_issuer_link`). | While closed, F1 and F1b return `{data_type, gate:"closed", has_bond_link: true\|false, ciks: [], bonds: []}`. That is a boolean only: no CIK, no issuer name, no count. 010 shows the notice only when `has_bond_link` is true. F2, F3 and F4 return nothing beyond §4.2. T-F1 and T-F10 must assert that no `cik` or `issuer_name` key is present. |
| **M-5** | MUST-FIX | §4.3 | **R1f keeps the arbitrary `LIMIT 1` CIK pick** (008 N8-3 applies to bond → issuer). F2 handles N8-3; R1f does not. A key filed by both a co-registrant and a parent would show whichever CIK D1 returns first, which may be the guarantor. | In the gated R1f: `SELECT DISTINCT cik FROM bond_issuance WHERE instrument_key = ? AND filing_status = 'final' AND parse_confidence >= 60 LIMIT 2`. With 2 CIKs, add **no** `sec_bond` candidate and set `source_conflict` as 007 §5.1 already defines. This is 1 extra index read. Add it to T-F6. |
| **M-6** | MUST-FIX | §5.2, §7.2 | **Multi-CIK merge versus the guarantor rule.** 008 §8.3 justifies F1's merge across CIKs with "a parent and its finance subsidiary linked to one entity". L8-4 / L8-12 and DIL14 forbid exactly that: it is a guarantor link (the NextEra Capital → 27953 and Welltower OP → 2289 signings keep subsidiaries on their **own** entities). | §5.2 states the rule: `bond_issuer_link.entity_id` is always the **filer's own** legal entity, so a multi-CIK entity arises only from same-entity CIKs, such as 013 twin merges. When `ciks.length > 1`, F1 rows carry `cik` and 010 shows the filer name per row ("Filed by {issuer_name}"). Strike 008's parent/finance-subsidiary example from the 009 text. |
| **M-7** | MUST-FIX | §4.1 | **The gate statement needs a guard, a read-back and full evidence.** The migration's evidence uses an abbreviated hash ("c517dde7…9c399"). There is no record of who executed the statement, because the Data-Identity Lead in Cowork cannot run D1. | Open with `UPDATE fi_serving_gate SET state='open', changed_at=strftime('%Y-%m-%dT%H:%M:%SZ','now'), changed_by='Data-Identity Lead', evidence='<AC12 re-test report path> <full sha256>; <PepsiCo check report path> <full sha256>' WHERE id=1 AND state='closed';`. Require `changes = 1`, then `SELECT * FROM fi_serving_gate WHERE id=1`.<br>- **Executor:** the build or engineering lane, on the Data-Identity Lead's signed open instruction, with the Founder's acknowledgement logged in the Decisions Log. `changed_by` records the authority, and the execution report records the executor.<br>- **Close** with the mirror statement (`WHERE id=1 AND state='open'`).<br>- The migration's evidence string uses the full SHA-256. |
| **M-8** | MUST-FIX | §5.4, §7.3, §7.6 | **CIK and LEI provenance on the page.** Entity 2289's `entity_master.cik` is wrong (DQ-1: it holds Welltower Inc's CIK). | 010 shows the **filer CIK from `bond_issuer_link`** (the bond's own `cik`), never `entity_master.cik`. The LEI is shown **only** as the linked entity's `entity_master.lei` through the NavLink. For an unmatched filer, show no LEI, even when GLEIF has one (Welltower Inc, PepsiCo Singapore). That LEI belongs to a 004 ticket, not the page. |
| **M-9** | MUST-FIX (only if F4 ships) | §5.6, §7.2 | **The ladder can double-count.** 19 keys appear in several filings (fact 2), including one exact duplicate ($500m twice). `SUM(principal_amount)` per year then overstates. | The ladder counts **distinct securities**: `instrument_key` when present, else (accession, seq). Principal is shown only for keys with a single filing, or labelled "as filed (may include reopenings)". Otherwise ship the counts-only ladder (UX Q2). The F1 table may still list each filing tranche (see N-1). |
| N-1 | NOTE | §7.1, §15 Q4 | **Q4:** `#/bond/{accession}/{seq}` is acceptable. It identifies a **filing tranche record**, not an instrument, so 007's "no third key form" rule (§3.5) is not broken. | The route value must never appear as an `instrument_key`, in NavLink `identifiers`, or in any written table. Where `instrument_key` is set and the key appears in other filings, the detail layer says "Also filed in N other filing(s)" (reopenings). |
| N-2 | NOTE | §5.2, §15 Q5 | **Q5:** applying `parse_confidence ≥ 60` in the Worker, with the cursor set to the **last scanned** tuple, is acceptable and correct. It keeps plan P-B1, and a filtered row cannot cause a gap or a repeat. Today it filters nothing (minimum 70). | A page may return fewer than `limit` rows with a non-null `next_cursor`. 010 must keep "Show 25 more" while `next_cursor` is set. T-F2 already covers this. |
| N-3 | NOTE | §4.2, §5.5, §15 Q6 | **Q6:** withhold F3 counts while closed. **Yes.** PepsiCo Inc's count currently includes the 4 wrong-issuer rows, so counts are not safe until AC12 passes. | Also apply `parse_confidence >= 60` to the N8-3 count query, so all F3 figures use the served-row rule. |
| N-4 | NOTE | §4.1, §15 Q7 | **Q7:** opening on the Data-Identity Lead's signed AC12 evidence plus the Founder's acknowledgement is enough. Founder-only is not needed. | Keep a separation of roles: the lane that adjudicated AC12 (LANE-8's Data-Identity Lead) signs the re-test; this lane (LANE-11) signs the open instruction after checking the evidence below; an engineering lane executes. Closing needs no acknowledgement. |
| N-5 | NOTE | §7.3 | **Tranche titles.** 37 Caterpillar labels are prospectus boilerplate (fact 5). | Use the generated title ("{coupon} {Type} due {maturity}") whenever `tranche_label` matches `PROSPECTUS\|SUPPLEMENT\|Dated` or is longer than 120 characters. 004 ticket D-2. |
| N-6 | NOTE | §7.3, §7.4 | **Guarantor.** 008 stores no guarantor field, so v1 shows **none**, and that is the right behaviour: the issuer shown is always the bond's own filer CIK's link. | Never derive a guarantor from `bond_issuer_link` or from a parent edge. A guarantor field waits for a parsed and adjudicated source (November). |
| N-7 | NOTE | §7.4 | "Not stated on cover" for a NULL seniority (388 of 633 finals) asserts something the parser did not check. | Use "Not parsed — see filing", in line with AC-F4's honesty rule. |

### M-3: the pre-deploy PepsiCo check (≤ 8 PK reads)

The check runs in the 009 build, read-only, before the Thu 29 Worker deploy and again before the Mon 2 Nov front-end release.

- **S1** (4 PK reads): `SELECT accession_number, tranche_seq, cik, instrument_key, filing_status, parse_confidence FROM bond_issuance WHERE accession_number = '0001104659-24-022370' AND tranche_seq IN (1,2,3,4)`.
- **S2** (≤ 4 PK reads, only for the S1 rows with a non-null `instrument_key`): `SELECT instrument_key FROM instrument_master WHERE instrument_key IN (…)`.

**PASS** if, for every S1 row, either:
- `cik = '0002007029'` (R-1 done; the row is no longer under PepsiCo Inc); or
- `instrument_key IS NULL`, or that key has no `instrument_master` row, so no instrument card or holding can reach it through R1.

If R-1 has deleted the rows and not re-ingested them, that is also a PASS (nothing to expose); record it.

**FAIL** if any S1 row has `cik = '0000077476'` **and** a non-null `instrument_key` that is present in `instrument_master`. On a FAIL:
- the Mon 2 Nov front-end release may not ship until the gated R1f (§4.3) is live **and** T-F10 shows R1 returning no `sec_bond` candidate for that key;
- open a 004 ticket.

**Expected today** (16 Oct data): PASS, with all 4 keys NULL and S2 not executed. That is 4 reads.

**Record:** the 4 rows (no values beyond those listed in S1), `rows_read`, and PASS or FAIL, in the build report.

### Gate-opening evidence (Task item 1)

The gate opens only when all four of the following hold. Each is cited by path and full SHA-256 in `evidence`.

1. **The AC12 re-test report** shows every DIL14 §5 condition met:
   - the 60-row sample at ≥ 98% with the corrections;
   - **0 wrong-issuer links**, in the sample and in the R-3 filer-list scan of every final filing;
   - the 37 formerly spread-less rows ≥ 98% correct;
   - the R-4 remarketing moves signed.
2. **The PepsiCo rows:** `0001104659-24-022370` tranches 1–4 are stored under **CIK 0002007029**. Its `bond_issuer_link` row is `link_method = 'unmatched'`, `entity_id` NULL, `status = 'paused'` (L8-12), until DQ-5 is resolved. **Expected issuer:** PepsiCo Singapore Financing I Pte. Ltd. (not PepsiCo Inc 1457).
3. **F1 for entity 1457** (gate test mode, or the build's fixture run on live data with T-F1's open state) lists none of those four tranches.
4. **The M-3 check** is PASS.

### 010 issuer identity (Task item 3)

- **Issuer** = the entity linked to the bond's **own filer CIK** (`bond_issuer_link.entity_id` → 007 R3 survivor), with the 008 §8.1 band.
- An unmatched filer shows "Issuer not linked to Corporate Atlas yet · {issuer_name} (CIK {cik})". For the PepsiCo Singapore rows that text is "PepsiCo Singapore Financing I Pte. Ltd. (CIK 0002007029)".
- **Guarantor:** none in v1 (N-6).
- **LEI and CIK:** see M-8.
- **Gate closed:** see M-4. The Bonds section shows "Bond data is being quality-checked and isn't shown yet." only where `has_bond_link` is true. The directory and the CIK layer show only that notice and the disclosure. Nothing else from the bond tables is shown.

### Row filters (Task item 2)

- §5.1's `filing_status = 'final' AND parse_confidence >= 60` matches 008 §16 and DIL14.
- 60–79 rows carry `check_source` (008 §14.1).
- F2 returns 404 on a non-served row.
- R1f gains the filter in §4.3, and M-5 adds the N8-3 check.
- Only N-3 (the N8-3 count) lacks the confidence filter.
- **"No bond row shown linked to a guarantor"** rests on:
  - the data rules (L8-4, L8-12, DIL14 R-1 and R-3), enforced by the gate evidence above;
  - M-5 (R1f ambiguity);
  - M-6 (the multi-CIK rule).

  With those, no 009 path can attach a filer's bonds to another legal entity.

---

## Data-quality items for 004 tickets (Task item 5)

| # | Item | Proposed 004 ticket |
|---|---|---|
| D-1 | PepsiCo Singapore Financing I (CIK 0002007029): its 4 rows sit under PepsiCo Inc (DIL14 P-1) | **Already seeded** in 004 rev 1 M4 (`sec_cik:0002007029`, members 3367 / 31416, `current_wrong_link_entity` 1457). No new ticket. Resolve after R-1. |
| D-2 | 37 Caterpillar Financial finals (CIK 0000764764) with boilerplate `tranche_label` | `data_error`, owner Data-Identity Lead, fix in the 008 parser (cover-title extraction); one aggregate ticket, members = the 37 PKs |
| D-3 | CUSIP `14913UAP5` stored twice (accessions `0001104659-24-088590` and `-088828`, same date, $500m each): a duplicate or amended filing | `data_error`: decide which filing is authoritative, then mark the other row in a 008 fix (it inflates coverage and principal) |
| D-4 | 37 floating / fixed-to-floating finals without a spread (DIL14 P-2) | Tracked by 008 R-2. Open a ticket only if R-2 does not close it before the gate opens. |
| D-5 | Entity 2289 `cik` (DQ-1) | **Already seeded** (004 `wrong_identifier:entity:2289:cik`). Relevant to M-8. |
| D-6 | GM Financial (DQ-3), Pfizer NL (DQ-4), Welltower Inc (DQ-2) | **Already seeded** in 004 M4. Their bonds show as "Issuer not linked yet" until resolved. |

## Answers to §15 (Data-Identity Lead)

| Q | Answer |
|---|---|
| 4 | **Yes**, with N-1's conditions |
| 5 | **Yes** (N-2) |
| 6 | **Withhold** while closed (N-3); also M-4 |
| 7 | **Data-Identity Lead + Founder acknowledgement**, executed by an engineering lane (M-7, N-4) |
