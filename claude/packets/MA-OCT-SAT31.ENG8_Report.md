# MA-OCT-SAT31.ENG8 — Report (LANE-8-ENG, Engineering Lead): 008 R-4 move → open the bond serving gate

## Opening checks (Fri 30 Oct, 21:16Z)
- Control `71e59513…bbae` matches board row 90, which shows the Founder's gate acknowledgement (30 Oct 16:30Z). Task `d80105ef…64f6` matches.
- No `.git/*.lock`; branch `October-2026`. `wrangler whoami` ✓ (4.96.0).
- FREEZES `5b3400c0…6791` ✓; no A2 window; tonight only 23:50–00:10Z.
- Readjudication `claude/MA-OCT-008_AC12_Readjudication.md` `8c306b726ee7342a3293983d085bd12557228010a695a53ddb621b27e290c832` ✓.

**Preconditions (Task (a)/(b) + readjudication §8 1–7):**

| § | Precondition | Status |
|---|---|---|
| (a) / §8-1 | 009 live: FRI30.ENG1 report (`190cbac8…5423`) shows `meridian-entities-api` `4e7ee20b` live 16:03:46Z, the gate migrated **closed**, T-F10 closed 11/11. Live read 21:2xZ: gate row 1 `closed`, `changed_at` 2026-10-30T16:03:06Z | ✓ |
| §8-2 | §4.4 PepsiCo check PASS: `claude/packets/MA-OCT-009.BUILD_Report.md` §4 and FRI30.ENG1 line 110 | ✓ |
| §8-3 | R-4 applied | step 1 of this packet |
| §8-4 | F1 for 1457 lists none of `-24-022370` / 1–4 | verified at the open smoke (the 4 rows are under `0002007029` since 28 Oct) |
| (b) / §8-5 | Founder acknowledgement: board row 90 + Decisions Log ML-1030-4 | ✓ |
| §8-6 | Readjudication SHA-256 = the value in `claude/packets/MA-OCT-FRI30.DIL_Report.md` (line 24) | ✓ |
| §8-7 | Pre-flight ✓; SAT31.ENG4 (the other Sat lane) has no report yet, so no open change | ✓ |

## Timing
- This packet is **issued for Sat 31** (Decisions Log ML-1030-3/4: "Sat: 005 deploy + R-4/gate, two lanes"). It was handed to this lane at Fri 30 21:16Z.
- Prepared read-only; waiting for the Founder's word on whether to run it tonight or on Sat 31.

## Step 1 preparation: R-4 (no write yet)
**Pre-state (read 21:18Z):** `0001193125-25-169329` holds exactly 1 row:
- seq 1, `final`, CIK `0000794447`, "Series M Debentures due September 1, 2027";
- $1,999,988,000, `instrument_key` NULL, parser `bonds-1.1.0`.

**SQL** `App/Corporate Atlas/bonds/state/r4-nextera-2026-10-31.sql` `106eaa0a644ab0f5aa4081d21b1c73b51c8ac3802c2c8e3debe08bd12609a06d`, one batch, **expected changes `[1, 1]`**:
1. `INSERT OR IGNORE` the whole-filing **`tranche_seq = 0`, `skipped_other`** audit row (the existing skipped rows' format: `parse_confidence` 0, nulls). It is guarded on the final row still existing.
   - `parser_version 'bonds-1.2.0-r4'`: the RB-3 rule is applied by hand. The parser does not implement it yet.
2. `DELETE` tranche 1, guarded on `filing_status = 'final'` and on the audit row now existing.

**Rollback** `…/r4-nextera-2026-10-31.rollback.sql` `70318ed2854f407763783df6829f885c2a98038b611308b8c727342371ba9c58`: re-insert the exact pre-move row, then delete the audit row (guarded). Expected `[1, 1]`.

**Three-point check:**
1. PK operations only (`sqlite_autoindex_bond_issuance_1`).
2. 2 rows in a single execution.
3. ≈ 6–10 writes (readjudication §7: ≈ 10). Entities domain, bond table only.

**After the move:** NextEra Energy Capital loses 1 final row. The prep note said "15 → 14", confusing filings with rows; see the result below. Future incremental runs skip the accession, because `knownAccessions` is keyed on the accession.

## Change log (UTC)
- 21:18Z: Founder in chat: **"Run tonight"**. This lane runs the packet on Fri 30 instead of Sat 31.
- 21:20:25Z: **starting** R-4 move (`bond_issuance`, 2 statements). SAT31.ENG4: its report appeared at 21:19Z (step 1 local only; production steps planned for Sat ≥ 00:10Z), so there was no open change. This line first said "no report", written before the check; corrected after reading it.

## Step 1: R-4 ✅ (21:20:25Z)
- **Batch:** `changes [1, 1]` as required; rows_written `[2, 1]` (3 writes).
- **Read-back:** `0001193125-25-169329` now holds only seq 0, `skipped_other`, CIK `0000794447`, confidence 0, `bonds-1.2.0-r4`. Tranche 1 is gone.
- **Totals:** final **633 → 632**, skipped_other **51 → 52**, others unchanged. NextEra Energy Capital finals now 31.
- **Re-run:** `changes [0, 0]`.
- **Rollback** (not needed): `r4-nextera-2026-10-31.rollback.sql` `70318ed2…9c58`.
- 21:21:42Z: **starting** gate open (`fi_serving_gate`, 1 statement). SAT31.ENG4 still has no production step open (planned Sat ≥ 00:10Z).

## Step 2: gate open ✅ (21:21:42Z; executor LANE-8-ENG, authority Data-Identity Lead per §8)
**Statement:** §8's `UPDATE fi_serving_gate SET state='open', … WHERE id=1 AND state='closed'`, exactly as written. **`meta.changes = 1`**, 1 write.

**Evidence string, full SHA-256s:**
- `claude/MA-OCT-008_AC12_Readjudication.md` `8c306b726ee7342a3293983d085bd12557228010a695a53ddb621b27e290c832` (AC12 PASS);
- `claude/packets/MA-OCT-009.BUILD_Report.md` `a32e8d0bede75210b1c94ef2b263bb5d3baf3683068751b932324808df336459` (the §4.4 PepsiCo check);
- the §8 open instruction, same readjudication SHA-256;
- R-4: this report's first 4,215 bytes `1854b31e0d2b2eec9462f4cc053080fa4683f69e142ffcddfe508787fc938e21`. This report is append-only after that point, so `head -c 4215 … | shasum -a 256` reproduces it.

**Read-back:** `id 1`, **`state 'open'`**, **`changed_at 2026-10-30T21:21:43Z`**, `changed_by 'Data-Identity Lead'`. The evidence equals the string as written (compared byte for byte).

## T-F10 open re-run (anonymous, 21:21:55–21:22:30Z, `meridian-entities-api` `4e7ee20b`): all correct, no kill switch
| Call | Result |
|---|---|
| F1 `/api/fi/issuers/1457/bonds` | 200, `gate:"open"`, `ciks` = [`0000077476` PEPSICO INC, `cik`, 95]. **19 bonds**, all under `0000077476`. **None of `0001104659-24-022370` / 1–4** (§8-4 ✓). `public, max-age=60` |
| `/api/fi/ciks/0002007029/bonds` | 200 open, the **4** Singapore rows `-24-022370` / 1–4 under their own CIK |
| `/api/fi/bonds/0001104659-24-022370/1` | 200. `bond.cik 0002007029`, Floating Rate Notes due 2027, $300,000,000. `issuer` NavLink `unmatched` / `no_mapping`, 0 candidates (M-8: no LEI for an unmatched filer). Body mentions neither 1457 nor PEPSICO INC. `filer` = {"cik": "0002007029", "issuer_name": "PepsiCo Singapore Financing I Pte. Ltd."} |
| R1 `/api/instruments/CA00206RNL29` | 200. **Now carries the `sec_bond` candidate**: entity 14289 AT&T Inc, LEI `549300Z40J86GGSTL398`, `source_table bond_issuer_link`, confidence 95 (closed state at 16:04Z: 0 candidates) |
| **M-6 cache proof:** `/api/fi/coverage` ×2 (21:22:10 / :12) | **`x-fi-cache: miss` → `hit`** |
| **M-6 cache proof:** `/api/fi/issuers/1457/ladder` ×2 (21:22:14 / :16) | **`miss` → `hit`**; 12 years |
| `/api/fi/bonds/0001193125-25-169329/1` (the R-4 row) | **404**, `no-store` (moved out) |
| R1 `US5949181045` · search · `/admin/exceptions` · `?limit=abc` | 200 · 200 · 410 · 400, as at T-F10 closed |

- **The Cache API does hit on `workers.dev`:** 009.BUILD expected a miss, so the cached read budget applies from now.

## Step 3: Founder told "bonds live" with `changed_at 2026-10-30T21:21:43Z` (this reply)

## Close-out
**Production changes (one at a time):**
1. R-4 (21:20:25Z, 3 writes);
2. gate open (21:21:42Z, 1 write).

**D1:** 4 writes, about 2k reads (read-backs, smoke).

**Deviation:** run on **Fri 30, 21:18–21:23Z**, not Sat 31, on the Founder's chat instruction "Run tonight". SAT31.ENG4 had no open production change; its steps are planned for Sat ≥ 00:10Z.

**Kill switch** (any lane, any time): `UPDATE fi_serving_gate SET state='closed', changed_at=strftime('%Y-%m-%dT%H:%M:%SZ','now'), changed_by='<role>', evidence='<reason>' WHERE id=1 AND state='open';`, then `changes = 1` and the read-back.

**Git:** nothing to commit. `bonds/state/r4-nextera-2026-10-31{,.rollback}.sql` are gitignored state; this report waits for the Main Lane's commit list.

**Carried to 010 / Main Lane:**
- the parser does not implement RB-3 yet (a hand-applied move, `bonds-1.2.0-r4`);
- the spread rounding and the "fixed for life" notes (readjudication §8).
