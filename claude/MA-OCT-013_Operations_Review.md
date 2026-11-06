# MA-OCT-013 — Operations Lead Review (013 spec rev 0)

```text
REVIEWER:     Operations Lead (LANE-1-OPS; did not write the 013 brief, spec or measurement)
PACKET:       MA-OCT-013 — KI 22.41 duplicate-entity merge, spec rev 0
VERDICT:      PASS WITH NOTES — 0 BLOCKER, 6 MUST-FIX before the run, 10 NOTES
DATE:         Fri 30 Oct 2026
BASIS:        Founder ML-1029-4 (Q1 Mon 2 cap 33k and account ≤ 70k; Q2 LEI-bearing survivor; Q3 cross-pair LEIs → November);
              Option C (ML-1025-5; Tue 3 = go-live, no production change); A2 option A (ML-1029-6; A2 Sat-only, may be partial);
              OPS-R6, R8, R10, R11, R12; A2 Ops review (M-1..M-6)
```

## Evidence

| Input | SHA-256 |
|---|---|
| `claude/MA-OCT-013_Spec.md` rev 0 | `9a7466775ab8e91cc5ad70458d789138fa95d41a147d4b585ab20aeb1add69a3` ✔ (Task) |
| `claude/packets/MA-OCT-013.SPEC_Report.md` | `d06c5e5bb8bb6f97950e7b5863224d56a6a2584f5201b9d49d680d313990c19d` ✔ (Task) |
| `claude/relays/FREEZES.json` (as found) | `4d8202bbaf2cb9f854fc3870f3c4f624af963c6d3972467f5aeb2b5d9019d7fc`. The A2 window is re-pinned to Sat 31 07:10Z → Sun 1 00:10Z; **there is no 013 window yet** (M-3). |

**Code and context** read from `origin/October-2026` = `71fab4b` (`git --no-optional-locks show`):
- `ops-api.js`: the sweep's `job_lost`, `budget_risk` headroom against `daily_cap` 100k, and the Sunday 75k/80k checks;
- `entities-enrich` cron times `0 6`, `50 6`;
- the 011/A2 control-surface pattern (A2.BUILD, `gleif-a2.sh`).

The runner `merge-013.mjs` does not exist yet (its own build packet). 0 D1, no deploys, no git writes, no secrets; work-folder files were not opened.

## Checks

| # | Area | Result |
|---|---|---|
| 1 | **Domain** | Writes `entity_master` (deletes and key updates), `entity_enrichment_queue` (deletes), `instrument_entity_map` (74 repoints), a new Entities table `entity_merge_redirect` (declared Entities-owned in CR1), and 3 LEIs. **No ETF or Ops table written**, apart from heartbeats through ingest. ✅ |
| 2 | **Mon 2 write budget** | Core ≈ 32,011, including ≈ 480 heartbeat writes, against **013's cap of 33k** (margin ≈ 1k). **Account:** seed ≈ 33–34k at 08:05 + 013 32.0k + small others (bootstrap, sweeps, Ops events) ≈ 66.5k, against **≤ 70k**. **Margin ≈ 3.5k:** a seed above ≈ 36.5k, or an extra writer, makes the gate stop the run early (M-5). The sweep's `budget_risk` (headroom < 5k of 100k) does not fire at 70k. ✅ with M-5 |
| 3 | **Freeze (Mon 03:30–08:00Z)** | Runner start ≥ 08:05 (07:55–08:05 bootstrap band); stop by 23:45Z; FREEZES bands, including both boost bands. ✅ The sweep at 22:00 is not a FREEZES band; it's covered by the spec text only (N-1). |
| 4 | **Batching** | ≤ 50 merges, ≤ 400 statements, ≤ ≈ 900 writes per batch, checkpoint per batch; ≈ 40 batches + pilot; 1.3× stop. ✅ |
| 5 | **Kill switch** | "Pause and stop flags plus `hold_all_jobs`" are named, but **without paths, scripts or work dir**. That is the A2 M-5 gap again (M-2). |
| 6 | **Monitoring** | "Outbox or R-4" is stated, but **there is no Ops registry job, no emitter key and no `expected_max_duration_s`**, so heartbeats would be refused (401) or the sweep could raise `job_lost` (M-1). |
| 7 | **Sweep interaction** | The 13 job types are unaffected; 013's job is not a GLEIF job (E1–E4 don't apply; E5 does). The slots at 08/12/18/22 are covered by FREEZES bands except 22:00 (N-1). ✅ |
| 8 | **Other writers during the run** | Seed (04:00) and enrich (06:00/06:50) finish before 08:05 and don't fire again before 23:45; FIRDS is Sunday; delta has no cron. **Boost fires at 11:50 and 17:50 UTC (GMT) inside the run day** and processes `pending` queue rows, including the 2,601 duplicate queue rows 013 deletes (M-3, M-4). |
| 9 | **Correctness under a CAS miss (ops impact)** | Step 4 deletes the duplicate even if step 2 (repoint) or step 3 (queue delete) missed. That leaves a **dangling reference**, which then fails the §10 "0 dangling" check at close-out (M-4). |
| 10 | **Restore time** | Per-batch ≈ 900 writes, same day. **Full ≈ 31.5k**: not Mon 2 (seed + run + rollback > 80k), not Tue 3 (go-live, no production change). The spec says "its own day" but gives no date (M-6). |
| 11 | **Reads** | ≈ 110k on Mon 2 (export ≈ 45k, CAS ≈ 12k, re-export ≈ 50k); every execution ≤ 45k, pages ≤ 5k. 2.2% of 5M. ✅ |
| 12 | **A2 partial / post-011** | Plan from a post-A2 export. A2 LEIs on survivors accepted, not required. E-X2 withholds merged only on the Data-Identity Lead's signature. A2 and 013 rollback horizons stated. ✅ November A2 remainder: N-6. |

## Findings

### MUST-FIX before the run (Main Lane hash check of rev 0.1 or the build brief; no new Ops review)

| # | Section | Finding | Required change |
|---|---|---|---|
| **M-1** | §9 Observability | **No Ops identity for the run.** Heartbeats need a registry row and a key, or `meridian-ops` refuses them; without a per-batch `expected_max_duration_s`, the sweep can raise `job_lost` (sev2). | **Registry** (LANE-1-ENG executes; Ops authorises here, OPS-R6): `manual.entity-merge-013`, domain Entities, owner Data-Identity Lead, mode `manual`, emitter `merge-013`, **`expected_max_duration_s = 900` per batch**. **Key K-1..K-4:** new 32-byte key, mode 600, in the 013 work dir, never printed. **K-3:** the list before is the one recorded after A2's put (expected `boost-local`, `health-check-local`, `local-bonds`, `gleif-a2`); after = that + `merge-013`; K-4 accept/refuse evidence. **When:** its own step, **not during A2 batches or any other `meridian-ops` change**. Either Sat 31 after A2's last batch and the 005 deploy are verified, or Mon 2 ≥ 08:05 **before** the migration. The key cannot be added once the run's `meridian-ops` / `OPS_INGEST_KEYS` freeze (§9) is in force. **K-5** at 013 close. |
| **M-2** | §9 Kill switch | Flag paths, control scripts and work dir are unnamed. The A2 review found that the shared 011 scripts default to the wrong dir and can't SIGTERM the runner. | Own work dir `~/MeridianAtlas-work/merge-013/` (700) and **own flags** (`App/Corporate Atlas/.merge-013-paused`, `.merge-013-stop`, gitignored, never the 011/A2 flags). **One entry script** (the A2 `gleif-a2.sh` pattern) that sources an env file and prints `WORK_DIR` and `JOB_ID` first, providing pause, resume, stop (SIGTERM via its own pid), status and restore. A test proves stop reaches the 013 runner. The run sheet shows the exact commands. |
| **M-3** | §9 "Pause the other Entities writers" | The mechanism isn't concrete, and **boost runs during the run day** (11:50/17:50 UTC). Boost Phase 2/3 changes `pending` queue rows and may touch duplicates and survivors mid-run. FREEZES.json has **no 013 window**, and Cloudflare crons don't read it anyway (A2 review M-1). | **Boost:** pause flag + `ops_job_pause` row (`local.entities-enrich-boost`, Mon 2 08:00Z → Tue 3 00:10Z), LANE-1-ENG, **authorised here**. Resume Tue 3 ≥ 07:15Z (a resume is not a production deploy). **Enrich crons:** no action needed, provided the run ends by 23:45Z Mon (the next fire is Tue 06:00). **Seed:** before the plan export, confirm `cf.meridian-entities-seed`'s Mon 2 run has an `end` event and `d1-today` reflects it. FIRDS (Sun) and delta (no cron): nothing. **Main Lane:** add the dated FREEZES window "013 run — other Entities writers frozen", Mon 2 08:00Z → Tue 3 00:10Z (it binds the local runners: boost, 008). |
| **M-4** | §6 steps 2–4, §9 stop conditions | **Possible dangling references.** Step 4 (delete the duplicate) is guarded only on `lei IS NULL`, the key and the redirect. If a repoint (step 2) or the queue delete (step 3) misses its CAS, because a live writer changed that row, the duplicate is still deleted and a child row points at a missing entity. That fails §10's "0 dangling references" and needs a manual fix. The stop rule counts only step 4/5 misses. | Step 4 also requires `NOT EXISTS` for the duplicate in each child table it touched: `entity_enrichment_queue`; `instrument_entity_map` via `idx_iem_entity_key`; `entity_relationships` child/parent; `fund_entity_link`; `entity_isin_map`; `bond_issuer_link`; exposure. These are indexed probes at ≈ 1 read each when empty. **A step-2 or step-3 CAS miss is a stop condition** for that batch: no delete, listed, read-back recorded. The Architect confirms the SQL shape (REVA). |
| **M-5** | §8 Mon 2, §9 Production end | **Thin margin, no remainder rule.** Account ≈ 66.5k of 70k, and 013 ≈ 32.0k of 33k. A larger seed, or any extra writer, makes the gate refuse the tail. Tue 3 is go-live with **no production change**, so "waits for a new Control" means November. Mon 2 also carries the **site release** (and 005 UAT); "one change at a time" needs an order. | (a) **Pre-agree with the Founder:** any un-run remainder (whole merges only, at a batch boundary) goes to **November** with the optional set. Close-out lists the merged and un-merged ids. **No Tue 3 writes.** (b) **Order on Mon 2:** 013 plan export ≥ 08:05 → migration → pilot → batches → verification, then the site release, or the site release first and 013 after it is verified. **Never interleaved.** Recommend 013 first: its gate and margin depend on the morning's account state. (c) Before the export, record `d1-today` (seed total) and the projected account (seed + 33k). If the projection is > 70k, re-scope at plan time, not mid-run. |
| **M-6** | §11 Rollback | **The restore calendar is unstated.** | **Per-batch restore:** same day, ≈ 900 writes, inside the 70k gate (at most ≈ 3 batches after a full run). **Full rollback (≈ 31.5k):** a Founder + Ops decision, **earliest Wed 4 Nov** (Mon 2 has no room; Tue 3 has no production change), ≤ 25k a day, so **2 run days**. Restore CAS misses (rows changed by enrich from Tue 06:00 or the seed on Mon 9) are listed, not forced. **Retention:** `merge-013/` rollback inputs (pre-images, checkpoints, plan, redirect ids; SHA manifest) ≥ 30 days after 013 closes, independent of `gleif_006.db`. |

### NOTES

| # | Note |
|---|---|
| N-1 | **Sweep slots:** the runner keeps ±2 min of 08:00, 12:00, 18:00 and **22:00** UTC. The first three sit inside FREEZES bands; 22:00 does not. Add 21:58–22:02 to the runner's own calendar check (the A2 runner already does ±2 min). |
| N-2 | **R-4 (OPS-R8):** export `recon/2026-11-02/` by 23:30Z Mon. The Operations Lead signs by **Tue 3 09:00Z** as close-out evidence; no next run day depends on it. OPS-R11: `--outbox-live-confirmed` is never used. Needs a standing Ops grant to `merge-013/recon/` (as RECOND). |
| N-3 | **Pilot:** besides the 20-row Data-Identity spot check, run the §10 reference probes on the **50 pilot ids** (≤ ≈ 500 reads) before batch 2, so a dangling-reference defect shows at 50 merges, not 1,979. |
| N-4 | **Reads ≈ 110k:** fine. No A2 reads on Mon (A2's ceiling is separate). |
| N-5 | **OPS-R12 pre-flight** (`wrangler whoami` 4.96.0 by path, wait ≥ 30 s, `SELECT 1`) before the export and before the first write. A startup 7403 fails closed; never `wrangler login` mid-run. |
| N-6 | **A2 November remainder** (A-012..015, ECA, E-A under ML-1029-6) **must be re-planned from a post-013 export.** Step 5 changes two-way survivors' `normalized_name`, and A2's CAS pins `normalized_name`, so the old A2 plan would miss or be refused. Record this in the A2 close-out. |
| N-7 | **Migration** (`CREATE TABLE entity_merge_redirect`, ≈ 3 writes) runs as its own recorded step after CR1 approval, with `IF NOT EXISTS`. Rollback after a full restore: drop the table only when 0 rows have `packet='MA-OCT-013'` and 007/004 tolerate its absence (they do: "tolerant of a missing table"). |
| N-8 | **Change freeze during the run** (`meridian-ops`, `OPS_INGEST_KEYS`, Entities Workers): compatible with the Mon 2 site release (Pages only). Any 009/010 Worker change on Mon 2 is sequenced by the Main Lane, outside 013's batches. |
| N-9 | **Pilot hold and E-X2 signatures** depend on the Data-Identity Lead being available Mon morning. Book the slot, so the 08:05 start isn't followed by a long idle hold that pushes batches into the 11:45–12:15 / 17:45–18:15 bands. |
| N-10 | **Heartbeats** (≈ 80 events, ≈ 480 writes) count toward the 33k cap (ML-1010-3). With M-4's extra probes, reads rise by ≈ 2k; writes are unchanged. |

## Answers to the Ops focus points (Task)

- **Mon 2 write budget:** fits (≈ 32.0k / 33k; account ≈ 66.5k / 70k), with little margin. M-5 sets the remainder rule.
- **Batching:** sound (≤ 50 merges per batch, checkpoints, 1.3×).
- **Kill switch:** needs concrete flags and scripts (M-2).
- **Monitoring:** needs a job, key and per-batch duration (M-1), plus R-4 (N-2).
- **Sweep:** no conflict once M-1 is in place; 22:00 slot per N-1.
- **Restore time:** per batch same day; full rollback ≥ Wed 4 over 2 days (M-6).

## Verdict

**PASS WITH NOTES.**
- The design is measured, not guessed: R = 74 repoints, 0 exposure rows on duplicates.
- Merges are CAS-guarded, batched, and reversible from pre-images, with no ETF table written.
- Founder Q1's 33k / 70k caps fit.

**M-1 to M-6 go into the build brief or rev 0.1 before the Mon 2 release check.** M-4, the dangling-reference guard, is the one that changes the SQL; the rest are operational. The Ops authorisations in M-1 (registry row and key) and M-3 (boost pause row, Mon 2 08:00Z → Tue 3 00:10Z) are given here, for LANE-1-ENG to execute.
