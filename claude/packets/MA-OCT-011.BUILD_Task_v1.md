# MA-OCT-011.BUILD — Task v1 (immutable): build the 011 runner (no production writes)

**ISSUED BY:** Main Lane (Program Orchestrator), Mon 12 Oct · **EXECUTED BY:** LANE-11-ENG, Engineering Lead (new Claude Code session, separate from LANE-1-ENG) · **REVIEWED BY:** Architect + Operations Lead (Fri 16 release review, separate packet) · **APPROVED BY:** Founder (GATE-1012 D1: GO Option 1, E-A kept)

Build what **`claude/MA-OCT-011_Spec.md` rev 1.9** (`e09c01b97729bb5a33b8bf9f1c3f23fc129caa24bb6db32456ae0868d31f2d22`) requires for the Sat 17 pilot, **up to but not including** plan generation, the release check and any production write:

1. **Runner** `App/Corporate Atlas/scripts/gleif-reconcile-011.mjs` and the four control scripts (`-status.sh`, `-pause.sh`, `-resume.sh`, `-stop.sh`) per §7: interactive only; pause flag checked before every batch; kill switch; refuses to start if `hold_all_jobs` is true; **headroom gate before every batch, fail closed** (§4.3); `outcome` vocabulary and heartbeat mapping as §7's table; append-only `runlog.jsonl` written before each heartbeat; uses the 002a outbox module `App/Corporate Atlas/lib/ops-outbox.mjs` (commit `8f06ed0`) when present, else the run-log fallback.
2. **Plan generator** (§4.1, §4.2c, §3.0): every statement carries its tier tag (N-2); excluded tiers never emitted; Bucket D twin rule and the 013 hand-off file with the full payload for the 9 deferred LEIs / 22 rows (R-3); E-A per E-1..E-5; A pilot handling per AR11-2 / RA-12 / RA-14.
3. **Pre-image, read-back diff and per-batch restore** (§9, §10) with the compare-and-set on `gleif_enrichment_version = 11`.
4. **Dry run, 0 writes**, against the local `gleif_006.db` and read-only D1 point/EXPLAIN reads. **EXPLAIN set** for every statement pattern (no `SCAN entity_master`; no execution > 45k reads; 2.5 × N rule).
5. **Fail-closed test:** a `d1-today` outage gives 0 writes and a `headroom_unavailable` event; cursor unchanged.
6. **Rollback rehearsal on ≤ 20 rows** (§11) — the only remote writes this packet may make: **≤ 100 row-writes total**, on Thu 15 only, after a `d1-today` check, outside every `FREEZES.json` window.

## Binding rules from rulings
- **ML-0910-1 / ML-1010-3:** 011's own Ops ingest writes count toward its 25k/day cap — the runner counts the events it actually delivers (≈ 5 row-writes each, incl. outbox replays and `failed` / `headroom_unavailable`).
- **ML-1012-1 (OPS-R3 F-5 is now active — `d1-today` lags 25–30 min):** account ceiling for 011 batches **60,000** (not 70,000); F-1's own-row window = **max(45 min, time since last fetch)**; F-2 monotonic check and F-3 midnight guard as specified. The Operations Lead confirms these figures at the Fri 16 release review.
- **N-4:** ≤ 25k row-writes/day by 011; no Sunday, no Monday before 08:00 UTC, no enrich window, no `FREEZES.json` window.
- **Credentials:** wrangler OAuth interactive; the ingest key is read by path from `~/MeridianAtlas-work/gleif-011/` (mode 600) and never printed (K-2). **Generating the key, the `OPS_INGEST_KEYS` put, the registry row and the boost pause row are not in this packet** — they are MA-OCT-011.T12 (LANE-1-ENG, authorised by the Operations Lead).
- **GLEIF calls: 0** in this packet (the ≤ 50-call freshness allowance is used at the Fri 16 gate).
- Work folder `~/MeridianAtlas-work/gleif-011/` (not iCloud); `gleif_006.db` read in place, read-only.

## Limits
- D1: read-only except item 6; **≤ 20k reads total**, each execution ≤ 45k; record per-statement `meta`. `/usr/local/bin/wrangler` 4.96.0 only; never `npx`.
- **Git: no git writes (ML-1012-2).** LANE-1-ENG works in the same folder and is the only committer this week; the Main Lane issues a commit list for the 011 files when this packet closes.
- Touch only the 011 paths (`App/Corporate Atlas/scripts/gleif-reconcile-011*`, any new 011-only `lib/` or `tests/` files). Do not edit files LANE-1-ENG owns (Ops code, A4/A5 files, Entities Workers).

## Report
Append one dated section per day to `claude/packets/MA-OCT-011.BUILD_Report.md` (work done, tests, D1 reads/writes per statement, file list with SHA-256, open questions). Stop at the end of each day and reply one line: **"MA-OCT-011.BUILD day <date> reported"**. Target: build complete Thu 15 evening.
