# MA-OCT-011.CLOSEREV-ARC — Report (REVIEW-A, Architect): 011 close-out review (A deferred)

**Control:** `claude/packets/MA-OCT-011.CLOSEREV-ARC_Control_v1.md` SHA-256 `b0973c6cbb9a4e179933cd10b3387fc6f9dd4f27405b5454268e2c12b097f95d` (verified; matches the STATUS_BOARD row). Task v1 `a95183c0001440e7f242508a1948dc545cbc88b7bab1a3aee3aa68bf32ba0c83` (verified).
**Date:** Fri 23 Oct 2026, ≈ 06:30 UTC. **Git:** HEAD `c3c6e4a`, no `.git/*.lock`, read with `--no-optional-locks`, no git writes. **0 D1. No code run.** I re-hashed and re-counted local files only. `~/MeridianAtlas-work/gleif-011/` was read under the existing grant; `ops-ingest.env` was not opened.
**Independence:** LANE-11-ENG ran 011 and wrote the close-out. REVIEW-A wrote none of it.

## Inputs (re-hashed; all match)

`claude/packets/MA-OCT-011.CLOSE_Report.md` `89dab615…7c9a`; RUN report `d032abfb…b28b`; spec rev 1.10 `63280691…0aaa`. Close-out files as listed in CLOSE §4: `postrun-2026-10-22.json` `6af4ccdf…`, `spot-check-25.json` `20ed4b55…`, `a-deferral-list.json` `86ec9d99…`, `exceptions-closeout.json` `7fe7eb2f…`, `retained-rollback-inputs.json` `ca6d6cc8…`, `handoff-013.json` `0597e15d…`, `review-lists.json` `db65589b…`, `exceptions.json` `08417ae3…`. Plan `e3854698…e6a8`.

## Verdict: **PASS WITH NOTES. 011 may close on its completed steps** (P, B, C, C-reasons, RC-15, E-C), subject to **CA-1** and **CA-2** below. A, ECA, E-A and Q are deferred to MA-OCT-011.A2 under the inputs in §3.

## 1. Checks

| Item | Result | How I checked |
|---|---|---|
| **§9 re-based without A: 16,936 = 16,936** | **MET** | 16,627 (29 Sep) + 5 (live Phase 3, before Fri's export) + 1 (502685, Phase 3, Sat 17) + 303 (P inserted) = 16,936. The reconciliation to the nominal 16,935 (= 20,612 − 3,677) holds: 304 fresh-basis P statements = 303 applied + 1 raced; 4 of the 308 were already present at export; the one extra is OTP's holding row 467290 (not a P row). The **whole-table basis** (ML-1015-1) is the one my R110R-1 asked to be stated ✔. |
| **Sampled diff 200/200** | **MET** (accepted as evidence) | On the columns 011 wrote, against `gleif_006.db`. The E-A part is correctly N/A. |
| **Invariants 0** | **MET** | New duplicate LEIs; `normalized_name`/`type`; LEI, country or non-placeholder-name overwrites; wrong-LEI rows touched; A rows live: all 0. KI 22.9 edges unchanged. |
| **Edges 674 + 5** | **MET** | `legal_parent` 73 → 752 = +679, 0 removed. The plan (fresh basis) has **EC 675** statements; the E-C checkpoints tally **674 applied + 1 already present** (my re-count). The other 5 are live Phase 3 edges, each named. ECA (44) and E-A (298) wrote nothing ✔. |
| **NLD 165 explained** | **MET** | 128 + 24 + 5 + 8 = 165. The 8 "neither" rows were hydrated by 011, and then live Phase 3 correctly stamped its generic marker (GLEIF gives no reason). That is why the pool reads 0, below the spec's ≤ 10. |
| **25/25 spot checks** | **MET, with deviation D-1** | 175 columns, including the one §4.2c fallback row (211195, B-024-fb), checked against what was actually applied. **D-1:** spec §9 calls for **API** spot checks; these were against the 28 Sep Golden Copy. That proves execution, not freshness. Freshness was covered by Fri 16's gate (50/50 HTTP 200 from the local lane), and the identity-risk bucket (A) did not run. I accept it for this close-out. **A2 must run real API spot checks** (≥ 10 A rows). |
| **R9-1 247,468 / 350,000** | **MET** | Per-day reads 73,489 + 29,086 + 0 + 56,136 + 11,637 + 2,514 + 74,606 = 247,468. The ledger holds 248,466 = 247,468 + 998 probe/EXPLAIN reads from 13–14 Oct (before R9-1's `since` of 16 Oct 20:38Z). Writes 54,936 and 011 total 55,716 also re-add. Under 25k/day every day. |
| **013 hand-off** | **MET, with A3-H below** | 392 twins and 22 deferred-LEI rows (9 LEIs) with full payload (R-3). **With A deferred, the 392 survivor rows have no LEI from 011.** |
| **A deferral list (3,676 / 298 / 44)** | **MET** | 4,018 rows = 3,676 + 298 + 44. ECA is 44, not 45: OTP Bank's parent LEI row (467290) already existed on the fresh basis. Flags: APILOT wrong 2; APILOT-named legal form 6; derived candidates 11 (non-binding); GC category `FUND` 42. |
| **268-file rollback manifest** | **MET, with CA-1** | I re-hashed all 268 files (140.7 MB): **267 match**. The one that differs is `d1-ledger.jsonl`, and only by appending: its first 280 lines hash exactly to the manifest's value, and the 16 lines after them are Thu 22's re-export (74,606 reads, 0 writes). Nothing was altered. The retained manifest simply predates the final ledger state. |

## 2. Required to close

- **CA-1. Re-issue the retained-inputs manifest** (`closeout/retained-rollback-inputs.json`), so the retained ledger is the **final** one (296 lines). Record the new SHA-256 in the board row. Reads 0, writes 0.
- **CA-2. RA-13 K-5:** set the `gleif-011` emitter entry in `OPS_INGEST_KEYS` to the all-zero hash (or remove it) and record which. Do it after N-3 lifts and the A6 deploys; one `OPS_INGEST_KEYS` change, with the Operations Lead confirming the list is the old list minus that key. **Least privilege:** A2 is a new run, so it gets a **new** emitter key under K-1..K-4, not this one kept alive. After K-5, the key file can be deleted (local, Founder approval).

## 3. A2 re-plan inputs I require (for the A2 spec; Architect review before any A2 plan)

1. **Matcher fix in a spec revision:**
   - T1 compares legal form (the Up-C / Inc-vs-LLC class);
   - reject currency-name rows and any match to a GC `FUND` record for an operating or currency entity (the 2488 class).
   
   Inputs: the **Data-Identity Lead's full 29-row legal-form list** (not yet published; required), APILOT's two wrong rows, the 42 GC-`FUND` rows, and the 6 named rows. The 11 derived candidates are not binding.
2. **Re-establish criterion 3 on the fixed matcher.** 006's T1 lower bound (150/150, 98.02%) is **contradicted** by APILOT (48/50). A2 needs a **fresh adjudicated sample of the fixed matcher's output**, with a one-sided 95% lower bound ≥ 98%, **before** the A2 GO. A2 then also needs its own pilot plus a 50/50 adjudication (RA-12, RA-15 and E-4 unchanged).
3. **State the evidence basis, and decide `gleif_006.db` retention** (see §4).
4. **A fresh export and a new SHA-pinned plan.** The Fri 16 A pre-images are stale.
   - **Recompute F-2 against live-created rows.** Live Phase 3 keeps creating `holding` rows for LEIs that A would place on operating rows. The OTP Bank pair (2019 / 467290, `529900W3MOO00A18X956`) is one already, and it is now a real duplicate identity.
   - **Every A target whose LEI is now held by another row is withheld and listed for 013**, never written (the `NOT EXISTS` guard already enforces this, W1-A).
5. **Order against 013 (Main Lane to rule).** Either order works, provided:
   - **(a) 013's spec must not assume the S1 survivor holds an LEI.** With A deferred, S1 reads "the older row survives". The 392 pairs carry no 011 LEI on either side.
   - **(b)** A2's plan is generated **after** 013 if 013 goes first, so the twins are already gone and the pre-images are post-merge.
   - **(c)** The AR11-1 horizon still applies to 011's standing writes (P/B/C): 011 rollback is valid until 013's first write. A2 has its own pre-images and its own horizon.
6. **Real GLEIF API spot checks in A2** (D-1), ≥ 10 A rows, from the local lane; Fri 16 showed it can reach the API.
7. Carry forward E-A (298) and ECA (44) under E-1..E-5 and RA-15, gated by A2's A writes (E-2).

## 4. `gleif_006.db`: keep it past 31 Oct, until A2 closes or is formally abandoned (Founder sets an end date)

- **The 31 Oct date does not apply.** Under R4 and §7 ("R4 GO keeps it until 011 closes"), the 31 Oct deletion applies only "if 011 is not opened", and 011 was opened. A2 is the deferred remainder of 011.
- **Keeping it is the cheap path.** A2's matcher fix is a re-filter of 006's reviewed T1 set on the same 28 Sep publication, and APILOT's adjudication is on that basis. Deleting it forces a new GC, a re-run of 006's tiers (N-2) and a new sample.
- **It still has to be adjudicated.** Item 3.2's fresh adjudicated sample is required either way, because the matcher changes.
- **Staleness:** by November the 28 Sep Level 1 values age. The A2 spec must either refresh Level 1 from a newer GC **for already-matched rows only** (identity stays on the reviewed basis), or accept 28 Sep values under a new ≤ 50-call freshness gate. It should say which.
- **Not a dependency elsewhere:** rollback (R-2) and the 013 payload (R-3) are independent of the DB.
- **Recommended end date:** 30 Nov, or A2 close if earlier. Delete and record after that.

## 5. Notes (non-blocking)

- **N-1.** The restore run-log line reads `after: "A-001+"` (the forward marker). The cursor file is authoritative and correct (next = A-001). Write `"<id>-restored"` in a later runner build.
- **N-2.** The 7403 token-refresh race happened again (3rd time) and a 7009 outage was seen. Both failed with 0 reads, and the read-only export retried safely. This is for 002b's wrangler-resilience work, not 011.
- **N-3.** The 011 code files are still untracked (CLOSE §6). They belong in the Main Lane commit list together with the verify script `b887e2f9…bb21` (only the `--a-deferred` / `--p-raced` flags were added).

## Files written

- `claude/packets/MA-OCT-011.CLOSEREV-ARC_Report.md` (this file). Nothing else. The board, the status JSON and the Decisions Log are for the Main Lane.
