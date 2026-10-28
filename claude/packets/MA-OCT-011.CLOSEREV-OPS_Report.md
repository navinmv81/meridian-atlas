# MA-OCT-011.CLOSEREV-OPS — Report

```text
CONTROL:      MA-OCT-011.CLOSEREV-OPS Control v1, SHA-256 5d716d42ca83b16e58986a0a98caea57f3e015aa560f8747f3f02fd5f4fb0707 (matches STATUS_BOARD row 51)
TASK:         v1, SHA-256 0589d3d3f7c483893116d460eef2980741155ab54caa987f2472560e572f69f5 (matches the Control)
EXECUTED BY:  Operations Lead (LANE-1-OPS, Cowork). Doc-only: 0 D1 reads/writes, no deploys, no git writes, no key file opened.
DATE:         Fri 23 Oct 2026, about 06:18 UTC
VERDICT:      PASS WITH NOTES
```

## Preflight and inputs

- No `.git/*.lock` files. HEAD `c3c6e4a` (`git --no-optional-locks`).
- **Independence:** I neither wrote nor ran the close-out. The four daily sign-offs I use as a cross-check are my own R-4 work, which is what this Task asks me to compare against.

| Input | SHA-256 | Check |
|---|---|---|
| `claude/packets/MA-OCT-011.CLOSE_Report.md` | `89dab6159c124ce7c996c4b35fff43948a8673069417808dc857bf92419b7c9a` | ✔ Task |
| `claude/packets/MA-OCT-011.RECOND_Report.md` | `07d02d69bcf03ba918730b2e290851b2761ac578aba6eb6484d5a9e5b277c412` | ✔ the four sign-offs: Sat 17 `6f5ddf9e…8a5b`, Mon 19 `d1505090…8367`, Tue 20 `0ef5a638…ec81`, Wed 21 `93d4d913…8fd0` |
| `claude/relays/FREEZES.json` | `cdc9606a881d7b24c92a2d675efd3b4f4d6df8205073fa299209b068d16ac346` | unchanged since 9 Oct |
| Basis | RELOPS `991c4629…c81b`; OPSR `87d2036e…6b1f` (OPS-R9/R10); RECON17 `585bba21…dcb9` (OPS-R11) | — |

## 1. Totals against the four daily sign-offs: **RECONCILED**

| Day | Sign-off (RECOND) | CLOSE §5 | Agree |
|---|---|---|---|
| Fri 16 (export) | reads 73,489 (OPSR/RELOPS) | 0 writes / 73,489 reads | ✅ |
| Sat 17 | 23 batches; 5,553 applied, 1 raced; D1 24,752; 47 events; 011 24,987; reads 29,086 | same | ✅ |
| Mon 19 | 47 batches (+1 cap refusal line); 11,059 applied, 130 raced; D1 24,403; 95 events; 011 24,878; reads 56,136 | same | ✅ |
| Tue 20 | 5 batches; 813 applied (+1 already present); D1 2,945; 10 events; 011 2,995; reads 11,637 | same | ✅ |
| Wed 21 | 1 forward + 1 restore; 250 → restored; D1 2,836; 4 events; 011 2,856; reads 2,514 | same | ✅ |
| Thu 22 (re-export) | not an R-4 day (0 writes) | 0 writes / 74,606 reads | ✅ (single day ≤ 200k; execution max 5,000) |
| **Sum (recomputed)** | — | **76 forward + 1 restore; 17,675 applied, 17,425 standing; 131 raced; 0 mismatches; D1 54,936; events 156; 011 55,716; reads 247,468** | ✅ every figure re-added |

- Reads chain: 73,489 → 102,575 → 158,711 → 170,348 → 172,862 → **247,468 ≤ 350,000** (OPS-R9; the 450k step was never needed). Plus 1 diagnostic read outside the ledger on Sat 17 = 247,469.
- **Writes:**
  - ≤ 25k by 011 on every day: peak 24,987 Sat; Mon's cap refusal was the gate working;
  - account ≤ 60k at every gate: peak 59,158 Mon;
  - total 55,716 ≤ 110k;
  - every batch ≤ 1.3× (max 1.09×, Sat P).
- **Calendar:** no batch on Sun 18, none before 08:05 on Mon, none in a FREEZES.json window. The CLOSE re-export also waited out the 16:45–17:15 band.
- §9 re-based without A (16,936 = 16,936, +1 traced to Phase 3's row 467290), 200/200, 25/25, invariants 0: accepted as reported. That is the Architect's lane (CLOSEREV-ARC); I found nothing in my day records that contradicts it.

## 2. Runner state: **CONFIRMED**

- **Holds:** `e4-trigger.json` `7e3c9153…3094`, `ea-dropped.json` `b9e18517…daac`, `a-pilot.json` `61af982c…`. No pause or kill flag; no runner process.
- **Cursor file:** next = **A-001** (index 73), 75 done, `restored = [A-001]`. The gates refuse A-001, A-002, ECA-001, EA-001 and Q-001.
- **The `A-001+` question from my Wed 21 note is answered:** the run-log `cursor` field is a per-line "batch completed" marker that restore lines reuse. The authoritative cursor is the cursor file, and it reads A-001. **Accepted.** I support the suggested cosmetic fix (`after: "<id>-restored"`), but only in A2's build, not as a change to the closed 011 runner.
- **OPS-R10 release: never issued.** OPS-R11: `--outbox-live-confirmed` was never used, and every write day had a signed R-4 before the next day's first batch (Tue 20's was late; the gate held A-001 until it existed).

## 3. Cloudflare incidents: none read or wrote. **Ruling OPS-R12: pre-flight token refresh becomes standard**

| When | Lane / step | Code | Effect |
|---|---|---|---|
| Fri 16 20:38:16Z | 011 export, first page | **7403** (wrangler OAuth refresh race) | 0 rows; re-run 25 s later OK |
| Sat 17 14:34:53Z | 011 startup `hold_all_jobs` | **7403** (refresh race) | startup failed closed, 0 writes; heartbeat spooled then delivered |
| Thu 22 17:16:14Z | 011 CLOSE re-export | **7403** (refresh race) | 0 rows |
| Thu 22 17:16:23Z | 011 CLOSE re-export | **7009** "Upstream service unavailable" (≈ 2 min) | 0 rows; `SELECT 1` OK at 17:18:32, export completed |

(Outside 011: 003.BUILD's R1 read pack also hit a 7403 on 21 Oct and retried.)

**Pattern:** every 7403 coincides with wrangler rewriting its OAuth config in the same second. So it is a client-side token-expiry race at the first call of a session, not an account or permission fault. The 7009 is a genuine short upstream outage. All four failed closed with 0 rows read or written. P-3/B-1 would also have covered a mid-batch case.

**OPS-R12 (standing, all local wrangler-based runners and read packs: 011/A2, 013, 008, FIRDS seed, 003/004 read packs):**
1. **Pre-flight before the first D1 call of a session:** run `wrangler whoami` with the pinned 4.96.0, by path. This forces any due token refresh. Wait **≥ 30 s**. Then run one `SELECT 1` probe (0 rows). Proceed only if the probe succeeds. If the session lasts more than 45 min, repeat this before the next step.
2. **On a 7403 at session start:** one retry after ≥ 30 s, then stop and report. **Never `wrangler login` mid-run,** and never switch wrangler version or use `npx` (OPS-N-1, 6 Oct).
3. **On 7009, 7500 or a timeout:** treat it as an upstream outage. P-3/B-1 govern any write batch. For reads, retry at most 3 times (30/120/300 s), then stop.
4. **Record every occurrence** (code, UTC, step, rows read/written) in the lane report. Ops tracks the rate. If it happens more than once a week with the pre-flight in place, escalate to a Cloudflare API-token setup (a scoped API token instead of OAuth) under a separate change request reviewed by the Architect.

The boost runner is exempt: it has made no wrangler calls since A4 (14 Oct).

## 4. Sat 24+ hand-offs

### 4a. K-5: retire the `gleif-011` ingest key

| | |
|---|---|
| **Who** | LANE-1-ENG executes; the Operations Lead authorises (here) and verifies from the lane report (OPS-R6 pattern). |
| **When** | **Sat 24, ≥ 07:15 UTC, after the N-3 freeze ends at 00:00Z and as its own step**: either **before** the 002 A6 / 003 `meridian-ops` deploys, or after they are verified. **Never in the same minute as a deploy** (ML-1017-3, one change at a time). Not in 07:55–08:05, 10:45–11:15 or 16:45–17:15. |
| **Method (Ops choice: remove, not zero)** | One `wrangler secret put OPS_INGEST_KEYS --config wrangler-ops.toml`, the JSON piped on stdin, rebuilt from the T12 canonical hash map (`f1840595…6520`) **minus `gleif-011`**. **Before (K-3):** `boost-local`, `health-check-local`, `gleif-011`, `local-bonds`. **After:** `boost-local`, `health-check-local`, `local-bonds`. Nothing else changes; `local-bonds` stays because 008 still needs it. A2 will get a **new** key (K-1 again), never this one. |
| **Verify (K-4 style)** | The old `gleif-011` key gets **401**. `boost-local`, `health-check-local` and `local-bonds` each still authenticate (400 on an invalid body). Record the new `meridian-ops` version and the before/after lists, **hashes and names only**. |
| **Optional, recommended** | Set `ops_job_registry.ingest_enabled = 0` for `manual.gleif-reconcile-011`. It is one guarded `UPDATE` with its `ops_case_event`, ≤ 10 writes, D1 Ops tables. The row stays as history. |
| **Key file** | Only **after** verification passes: delete `~/MeridianAtlas-work/gleif-011/ops-ingest.env`. **First check the R-2 retention manifest** (`retained-rollback-inputs.json` `ca6d6cc8…5a28`): if it lists that file, note the exclusion in the K-5 report, so retention isn't broken by a deletion. The canonical hash map stays (it holds hashes, not keys). |
| **Rollback** | If any of the other three emitters stops authenticating, re-put the full T12 canonical map (4 hashes) from `ops-ingest-keys.canonical-map.json` straight away, or `wrangler rollback` `meridian-ops` to the version before the put. Report to Ops the same day. |

### 4b. Boost resume and `ops_job_pause` row 1

- **Row 1 expires 24 Oct 00:00Z.** From then on the lateness view no longer marks boost slots `paused`. But the **flag file is still set**, so every fire is a no-op with no heartbeat. Any slot after 00:00Z that passes while the flag is still set will read **`missed`**, and the A3 health-check will raise a sev3 `job_missed` case. That is noise, not a failure.
- **Ops decision:** **resume on Sat 24, 07:15–10:40 UTC**, so the first live fire is **Sat 24 10:50Z**. Do it independently of, and preferably **before**, the `meridian-ops` deploys: any heartbeat lost during a deploy is spooled by the outbox. If the morning slips past 10:45, **either** extend the pause with a second guarded `ops_job_pause` row to the actual resume time (≤ 10 writes, audited), **or** accept and annotate the one `missed` slot in the 003 case. Never leave the flag set overnight with no pause row.

| | |
|---|---|
| **Who** | LANE-1-ENG (separate small packet); Ops verifies. |
| **Command** | `"App/Corporate Atlas/scripts/entities-enrich-boost-resume.sh"`. It removes `.entities-enrich-boost-paused`. No launchctl or plist change. |
| **Verify** | Flag absent. At the first fire, the run log shows `fired … in_window=true` with real `writes_today`, `start` and `success` heartbeats 201, and the outbox is empty. The lateness view shows that slot `on_time` and 17–23 Oct `paused`. |
| **Rollback** | Re-run `entities-enrich-boost-pause.sh` (instant), plus a new pause row if the pause will last past the next slot. |

- **DST, Sun 25 Oct (UK clocks go back):** the boost moves from **10:50/16:50 UTC to 11:50/17:50 UTC** (002a T-D2; lateness raises `dst_shift`). **FREEZES.json still lists the boost bands at 10:45–11:15 / 16:45–17:15 UTC.** **The Main Lane should update FREEZES.json for Sun 25 onwards (11:45–12:15 / 17:45–18:15 UTC)** before any runner (A2, 013, 008) relies on it. The A3 health-check slots move the same way.

### 4c. Other items carried

- **Retention (R-2):** `~/MeridianAtlas-work/gleif-011/`, 268 files, manifest `ca6d6cc8…5a28`. Kept ≥ 30 days after close **and** until 013 closes, independently of `gleif_006.db` (deleted 31 Oct under R4). **011's rollback stays valid until 013's first write (AR11-1).**
- **A2:** inputs as listed in CLOSE §6. Ops conditions for its review:
  - a fresh export (A pre-images drift);
  - N-2 re-tiering if built after `gleif_006.db` is deleted;
  - a new key (K-1);
  - the same gates (60k account / F-5 unless re-measured, 25k/day, R-4, OPS-R10/R11/R12);
  - a new read ceiling ruled from its own projection.
- **The DIL's full 29-row legal-form list** is still unpublished (CLOSE §4) and is needed before A2's plan. Data-Identity Lead to publish it.
- **Close-out exceptions** (204823, 207528, OTP pair, 502685, 2303, 2488, 42 GC-FUND rows) go to 013 / 004 as CLOSE lists.
- **Commit list:** the 011 code files are still untracked. That is the Main Lane's ML-1012-2 list, and Ops has no objection.

## Notes

- **N-1 (non-blocking):** the CLOSE report says the GLEIF API "is blocked by the egress proxy" for Cowork lanes, but it answered 50/50 from LANE-11-ENG on Fri 16. That is not an Ops matter, but A2's freshness gate depends on it. Re-test it before A2's plan.
- **N-2:** 011 used ≈ 71% of its read ceiling and ≈ 51% of its 110k write ceiling. The headroom came from deferring A, not from estimation error. For A2, carry the measured multipliers (P +1 write per AUTOINCREMENT insert; keyset exports 1 read per row; `IN` lookups 2 reads per row).

## Verdict: **PASS WITH NOTES**

All totals reconcile with the four signed days. The runner state is confirmed stopped at A-001 with E-4 and the E-A/ECA drop in force. No incident read or wrote. **OPS-R12 is adopted. K-5 and the boost resume are specified with who, when and rollback. FREEZES.json needs its DST update for Sun 25.** Nothing blocks closing MA-OCT-011 on its completed steps.

**Stop point:** after this report.
