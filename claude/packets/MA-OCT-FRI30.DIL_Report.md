# MA-OCT-FRI30.DIL — Report (Data-Identity Lead, LANE-11)

**Executed:** Fri 30 Oct 2026, ≈ 06:55Z → 14:25Z (Mac clock), in a **fresh Claude Code session**. It did not author A2.BUILD, R-1, R-2 or R-3. The earlier session's stop note is kept at the end.

**Outcome:**
- **AC12 PASS.** R-1 and R-2 methods confirmed, R-4 move list signed, gate **not** opened.
- **A2 G-2 FAIL: 1 error in 150 → STOP.**
- **L-A2-1 confirmed.**

## Pre-flight
- Control `98b63faf9bd06de8004f911eda1448dcc3dec916b9b85d8474ed964f2c838035`: matches `STATUS_BOARD.md` line 91 and the hash I was invoked with.
- Task `0c8d62c4ae81f71a04f9d3ab83258335c96970410b491bd2aaa181612dad06af`: matches the Control.
- Governing inputs re-hashed, all match the Task:
  - DIL14 `c517dde7…c399`;
  - THU29.ENG8 `52699fea…e5f61f5ad`;
  - A2.BUILD `e2cf858e…0caa0`;
  - run docs `ce539336…7e625e7`;
  - FREEZES `4d8202bb…d7fc`.
- Branch `October-2026`, no `.git/*.lock`.
- `/usr/local/bin/wrangler` 4.96.0, `whoami` OK (OAuth, account `ea360704…`).
- **No production change was made by this lane,** so there was nothing to announce. FRI30.ENG1 (the only other Fri lane report) shows 009 held behind 004's open change. My D1 use was read-only.

## Step 1: AC12 re-adjudication → PASS
Full document: `claude/MA-OCT-008_AC12_Readjudication.md`, **sha256 `8c306b726ee7342a3293983d085bd12557228010a695a53ddb621b27e290c832`**.

**R-1 (in-place CIK re-point): CONFIRMED.**
- Live: the 4 PepsiCo Singapore rows are under `0002007029`. The link is `unmatched` / `paused` / entity NULL. PepsiCo Inc → 1457 is unchanged.
- Delete + re-ingest would have re-created the guarantor link.

**R-2 (row-preserving re-parse): CONFIRMED.**
- Live: 191/191 rows are `bonds-1.2.0`, and exactly 37 differ from 16 Oct, only in spread, benchmark and confidence.
- **37/37 spreads correct against source,** checked by me from the cached text, not with the parser.
- Integer-bp rounding (1.905% → 191) is noted for 009/010 labels and not counted as an error.

**R-3 review:** the 3 Comcast filings (subsidiary guarantors) and the 4 index-unavailable covers (Dominion ×2, Verizon, Welltower OP) were each read by me. All are correct. **0 wrong-issuer links population-wide.**

**Fresh 10-row check** (my own seeded draw from the 165 re-parsed finals): **10/10.** The draw landed entirely on Toyota, which is 115 of the 165.

**60-row figure:** **240/240.** Wrong-issuer links: **0** in the sample, **0** in the population. The 37 spreads: **100%.**

**R-4 (not in any prior packet; required by 009 §4.5(1)):**
- The scan of all 326 cached finals finds exactly **1** remarketing: NextEra Energy Capital `0001193125-25-169329` / 1.
- That move to `skipped_other` is **signed**. An engineering lane applies it, about 10 writes, guarded.
- Alternatively, the Founder picks the RB-3 alternative and the move is withdrawn.

**Gate-opening statement and read-back:** in the AC12 document §8, with 7 preconditions. Precondition 1 is **not met**: the 009 deploy is not live, and 009 is held behind 004 as of 14:17Z.
- **Run only after the Founder acknowledges.** From Mon 2 Nov it needs the Founder's approval.
- **I did not open the gate.** The table does not exist yet.

## Step 2: A2 G-2 → FAIL (1 error) → STOP

**The draw:**
- Re-drawn independently from the A2 worktree (`g2-draw`) into a scratch file: sha256 **`8d3dc22b19d898fa35a4587c23b3d85afc324e7318d6356525c23500b679f03d`**, equal to F-4 and byte-identical to the dry run.
- I also **re-implemented the draw myself:** same 150 ids, same order, population 3,648, base plan `e3854698…a6e6a8`, exclusions `ac1c1572…b4f7`.

**Adjudication:** all 150, against the pinned GC (`gleif_006.db`): legal, other and transliterated names; country; category; entity and registration status; plus a GC-wide name-collision check.
- **149 correct. All 150 rows are ACTIVE/ISSUED and same-country.**
- Collisions I resolved as correct:
  - 66 Incitec Pivot → Dyno Nobel Ltd (renamed, same LEI);
  - 135 Cigna Holding Co (not The Cigna Group);
  - 138 GDI (the other record is RETIRED);
  - 70 Afentra and 148 Saudi Telecom (collisions only on unrelated former or short names).

**Row 73, entity 106395 "NEWDAY FUNDING" → LEI `549300M95T1WCOXEOR81` NEWDAY FUNDING TRANSFEROR LTD: ERROR (wrong entity).**
- **What the D1 row is:** the stripped holdings `security_name` of 9 ABS notes (`ABS-O`, XS ISINs), created by `entities-seed` Step 3 on 29 Jul. Its neighbours are other ABS programme names (Delamare Cards, Tower Bridge Funding, Elstree Funding…).
- **Why the match is wrong:** the Transferor is the programme's receivables seller. It matched only through its **former** name "NEWDAY FUNDING LTD" with "LTD" stripped. In the pinned GC it holds **0 ISINs**. The only NewDay Funding entity with securities is **NEWDAY FUNDING MASTER ISSUER PLC** (`213800GBPRAJHSB5YK19`).
- **What could not be checked:** the ISIN → issuer link itself. Neither GLEIF (3 calls) nor ESMA FIRDS (3 calls; the notes are London-listed) returned a record. I rule the row an error on the structural evidence: an LEI I cannot confirm, with positive evidence against it, fails a 0-error gate.
- **New matcher class,** not covered by R-LF/R-CUR/R-FUND: a **form-less D1 name matched only via a GC other/previous name**.
  - A rough screen of the 3,648 finds **31** rows that matched only through a GC "other" name. Some are legitimate renames, such as Sparebanken Vest → Norge and Altice Holdings 1 → Altice France Lux 3.
  - At least one more looks like an **R-LF gap:** 1275 "Citadel Securities L.P." → "Citadel Securities Global Holdings LLC". The dotted `L.P.` probably escapes the form compare.
  - **These are screens, not adjudications.** They are input for the November re-spec.

**Consequence:**
- Under Arch M-2 (n = 150, 0 errors; any error → STOP) and Founder Q3, **A2 does not get a GO for Sat 31 and defers to November.**
- The F-5 file records `errors: 1`, so the runner would write `holds/g2-stop.json` if handed it.
- I wrote nothing into `~/MeridianAtlas-work/gleif-a2/`, which does not exist yet. The run lane's `init` stays clean.

**Files** (F-5 format: `packet "MA-OCT-A2.G2"`, `sample_sha256`, `n = adjudicated = 150`, `errors`, `data_identity_lead`, `ops_spot_check`):

| File | sha256 |
|---|---|
| `claude/relays/a2/g2-sample.json` | `8d3dc22b19d898fa35a4587c23b3d85afc324e7318d6356525c23500b679f03d` |
| `claude/relays/a2/g2-adjudication.json` (per-row verdict and basis) | `94d74ec08d3915281a5b7cce6bc9116ece050f203f1aae8116b5d962e59e1cfd` |

Originals are in `~/MeridianAtlas-work/ma-oct-fri30-dil/`.

**Ops spot-check (Sat morning, a different reader, ≥ 15 rows):** still worth doing as independent confirmation. Please **include row 73.** `ops_spot_check` is left pending in the file.

## Step 3: L-A2-1 → CONFIRMED (keep the currency-name FUND clause)
- **Reach:** across all 3,676 released A rows, the clause reaches **only 2488** "HONG KONG DOLLAR" (GC "HONG KONG DOLLAR", category FUND). No other FUND row has a currency name.
- **Counts:** per-rule sets stay 24 / 1 / 5, and the **excluded total stays 28**.
- **Why keep the clause rather than drop 2488 from R-FUND's `expected_ids`:** dropping it would change the SHA-pinned `A2_exclusions_DIL.json` (`ac1c1572…`). That forces a C-4 re-pin and a re-review, for no change in what is excluded.

## Hygiene
- **D1:** read-only. About 1,000 rows read (one 943-row declared small-table scan, plus PK and index reads, each EXPLAINed). 0 writes.
- **Other:** no deploys and no gate opening. 0 SEC requests (cache only). 3 GLEIF calls (≤ 20). 3 ESMA FIRDS register reads.
- **Secrets:** none read (ML-1024-1). No macOS prompt.
- **Git:** no staging or commits. `13F Seed/gleif-seed.js`, `.env*` and `.claude/settings.local.json` were untouched.
- **Files written:**
  - `claude/MA-OCT-008_AC12_Readjudication.md`;
  - `claude/relays/a2/g2-sample.json` and `g2-adjudication.json`;
  - this report;
  - `~/MeridianAtlas-work/ma-oct-fri30-dil/` (my own work folder).

## For the Main Lane
1. **The Founder needs to know today:**
   - **A2 is deferred** (G-2 STOP, Q3).
   - **AC12 passed.** The gate opens only after 009 is live, the §4.4 PASS, R-4 applied (or the RB-3 alternative chosen), the §4.5(3) test, and the Founder's acknowledgement.
2. **R-4 apply** needs an engineering-lane slot, about 10 writes, guarded, with a rollback file. Or the Founder chooses the RB-3 alternative.
3. **November A2 re-spec inputs:**
   - the matcher class "form-less D1 name matched via a GC other/previous name" (row 73);
   - the R-LF dotted-form gap (1275);
   - the 31-row screen list (re-runnable from the plan + GC).

---

### Earlier stop note (kept for history; superseded by the above)
At ≈ 06:55Z the packet was invoked in the session that ran MA-OCT-A2.BUILD as LANE-11-ENG. That session wrote the A2 rules, made L-A2-1 and drew the G-2 sample. It stopped for author/adjudicator independence (Arch M-3; ML-1025-2 precedent) on the Founder's "Stop, use fresh session". This report is the fresh session's execution under the same Control and Task.
