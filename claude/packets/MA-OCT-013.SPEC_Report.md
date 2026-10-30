# MA-OCT-013.SPEC — Report

**Control** v1 `7952429e04ca2a62c9ae8751e9244ee26b15a91cddc73e6e7b8df4cf9160a083` (matches the Status Board row) · **Task** v1 `7eb108b867610a08cc86370bd3b2b0a003b9b3750f825cc11c39731c6ab76029` (matches) · **Executed by:** LANE-11-ENG, Engineering Lead for the Data-Identity Lead · Thu 29 Oct 2026, 19:32–19:50 UTC.

## Verdict
**Both Task items are done, there are 3 Founder questions, and there were 0 D1 writes.** The measurement is complete and under cap: **48,046 reads, 85 executions, largest execution 2,400**. The core merge on Mon 2 costs **≈ 32.0k writes**, which replaces the brief's ≤ 40.9k estimate; repoints are measured at 148 writes, not the "≤ 10k" placeholder. The core run fits Mon 2 **only if Q1 is yes**.

## Session checks
| Check | Result |
|---|---|
| Lock files | none |
| Branch / HEAD | `October-2026`, `acfd069` |
| Wrangler | `/usr/local/bin/wrangler` 4.96.0; `wrangler whoami` OK (OAuth; `d1 (write)` scope, not used) |
| Freeze bands | no D1 call inside a `FREEZES.json` band (`9c368fa6…e829`). The helper refused 21:50–22:15 and 23:45–00:15. |
| Production changes | **none**, so none to announce. The read lane ran alongside the others. |
| Secrets | no secret file read |
| Git | no git writes; no worktree created. Scripts and outputs are in `~/MeridianAtlas-work/ma-oct-013/`, outside the shared checkout. |
| Brief | `a79bb98b…13de` matches the Task. **The Task calls it "rev 1.6"; the file is rev 1.7** (L13-6, label only). |

## Item 1 — Pre-spec measurement (spec §4)
- **Runner checks pass,** matched by index name:
  - `idx_iem_entity_key` (`SEARCH … USING COVERING INDEX idx_iem_entity_key (entity_id=?)`);
  - `bond_issuer_link` is present, with `idx_bil_entity`.
  - `entity_merge_redirect` is absent, as expected.
- **No temp B-tree for `GROUP BY`** on any pattern; the measured reads are about 1 per seek plus 1–2 per matched row.
- **Sample, then full:** the 500-id sample cost 5,510 reads, and extrapolated to about 28.8k for all 2,622 candidates. That fit the cap, so the full set was measured directly; no figure is extrapolated.
- **Measured R:**
  - `instrument_entity_map`: 205 rows (core 74: two-way 71, three-way 2, OTP 1; optional remainder 132);
  - `entity_isin_map`: 0;
  - exposure: 0 (so R_collide = 0);
  - `bond_issuer_link`: 0;
  - relationships: 0 to repoint (1 parent edge on OTP 467290, which survives);
  - `fund_entity_link`: 0;
  - queue: 2,621 of 2,622 candidates have a row, all to delete, 0 repointed.
- **Brief-scope reads:** 10,828, against the declared 35k cap.

| Query group | Executions | Reads |
|---|---|---|
| M0 catalog | 1 | 157 |
| EXPLAIN set E1–E11 | 11 | 0 |
| Sample S-* | 9 | 5,510 |
| Full F-* | 45 | 23,674 |
| Survivor/holder state V-* | 18 | 18,441 |
| `fund_entity_link` | 1 | 264 |
| **Total** | **85** | **48,046** |

Writes: 0.

## Item 2 — Full spec
`claude/MA-OCT-013_Spec.md` rev 0, **`9a7466775ab8e91cc5ad70458d789138fa95d41a147d4b585ab20aeb1add69a3`** (376 lines). It covers:

- merge classes and scope (§5): core 1,979 deletes = 1,878 two-way + 100 three-way + OTP 1; November: 642 optional plus the 6 cross-pair LEIs; never: `103540` (protected);
- statement order with CAS and the B13-1 / B13-2 rules (§6);
- every child-table repoint (§7);
- the write budget against the Mon 2 caps (§8);
- batching and run gates (§9), verification (§10), the rollback manifest (≈ 31.5k) and horizon (§11);
- ETF impact (§12): no exposure number changes on Mon 2, and 74 instrument links consolidate;
- A2 / 011 interaction (§13), acceptance criteria (§14), timeline (§15) and the CR (§17).

## New findings, beyond the brief
1. **50 three-way cases:** both twins have no LEI, and the matched LEI is on a third row. This is why the "743" and the 1,928 pairs overlap by 100 rows; 006 counted them as disjoint.
2. **`103540` touches the protected pair DQ-M-000002** (its LEI is held by 2589 and 25577). It is excluded.
3. **OTP:** the LEI holder `467290` (`holding`, created 2 Oct by live Phase 3) is newer than `2019`. "Older" and "LEI-bearing" disagree here (Q2).
4. **The 6 (v) deferred LEIs are cross-pair identities** (8 survivors, 7 duplicates, 4 outside rows) (Q3).
5. **Mon 2 budget gap:** under 011's gates, about 26k is available, against a core of 32.0k (Q1).

## Item 3 — Founder questions (spec §16)
- **Q1:** a Mon 2-only 013 cap of 33k, with account + batch ≤ 70k. **Recommended: yes.**
- **Q2:** the LEI-bearing row survives the three-way and OTP cases, and the optional remainder moves to November. **Recommended: yes.**
- **Q3:** route the cross-pair LEIs to adjudication. **Recommended: yes.**

## Lane rulings
- **L13-1:** the measurement scope went beyond the brief's 4 tables, within the 50k cap.
- **L13-2:** three merge shapes are defined; the three-way and OTP survivor is pending Q2.
- **L13-3:** `103540` is excluded.
- **L13-4:** queue rows are deleted, not repointed.
- **L13-5:** no `survivor_id` index.
- **L13-6:** the brief's label versus its hash.

## Files
| File | SHA-256 |
|---|---|
| `claude/MA-OCT-013_Spec.md` | `9a7466775ab8e91cc5ad70458d789138fa95d41a147d4b585ab20aeb1add69a3` |
| `~/MeridianAtlas-work/ma-oct-013/ledger.jsonl` | `6b9ed205174a8a3ac625bc99d38cacbe3e2bb0b5480aa77052737066efee6654` |
| `ids.json` | `d21a12d2a16a262a67eb4594a502f4195ae7e9f171c5fb83055d4116d29a9078` |
| `out/S.summary.json` | `80b4064ab1f2710940bec18e857b8d80952bf97b13dc10b0d365c7b3e26a4f3d` |
| `out/F.summary.json` | `f0fb8bab4769374db2044904576f357ec76321a6a049a8ceff989cae80ff440d` |
| `out/V.summary.json` | `9130244a96f11a0ccb0830ed7acf24b2db605079c307561992cf0ba679c34027` |
| `out/FEL.json` | `c6eecaa02f839b81538b05b49419c5833fb44879831bffe2457850c7bb7cb2d7` |
| `measure.py` | `0486f59e059805d3b3bc58931655ee32c31ed6ec593e5def592df1b383f28818` |
| `d1r.sh` | `bd6b7759a9389cd6f772802e77174442fb27ed8c550095bfb49b863084c1c6d5` |

Both `claude/` files are untracked; the Main Lane lists them for the next commit (rule 7).

## Open for the Fri 30 reviews
- **Architect:** the three-way and OTP statement shapes (§6), the rollback day (§11), and the second-guard thresholds (§9).
- **Operations Lead:** the Q1 ceilings; the pause set for the run window; one production change at a time against the Mon 2 site release.
- **ETF Product Lead:** §12.
- **Data-Identity Lead:** the pilot spot-check procedure; the E-X2 signing rule (§5 item 3).
