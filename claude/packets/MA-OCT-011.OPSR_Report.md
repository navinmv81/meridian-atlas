# MA-OCT-011.OPSR — Report

```text
CONTROL:      MA-OCT-011.OPSR Control v1, SHA-256 7849cb4a0850472564002aed9381dc5d0bb4a22767ec1de5cb76cbaf1b74f245
EXECUTED BY:  Operations Lead (LANE-1-OPS, Cowork). Doc-only: 0 D1 reads, 0 D1 writes, no deploys, no git writes, no secrets.
DATE:         Thu 15 Oct 2026, about 17:20 UTC
```

## Preflight

- No `.git/*.lock` files. HEAD `d0e6847` (`git --no-optional-locks`).
- **Independence:** I wrote none of the inputs (011 spec: Data-Identity Lead; T12 and 002a reports: LANE-1-ENG). The rulings are mine to make under the Task.
- Item 3 was started after T12 reported, as the Task requires (T12 report committed in `d0e6847`).

## Input hashes, as found on disk (all match; no stop)

| File | SHA-256 | Expected |
|---|---|---|
| `claude/packets/MA-OCT-011.OPSR_Control_v1.md` | `7849cb4a0850472564002aed9381dc5d0bb4a22767ec1de5cb76cbaf1b74f245` | ✔ board row and Founder message |
| `claude/packets/MA-OCT-011.OPSR_Task_v1.md` | `36ddb1ccb60b281177bc176fa64f1abfdbf5d636e65e1426127db6953432e621` | ✔ Control |
| `claude/MA-OCT-011_Spec.md` (rev 1.10) | `6328069130ee437d128c3c0f08081218cab7e0e5df3beb2c0010dda46c1b0aaa` | ✔ Task |
| `claude/MA-OCT-011_Ops_Review.md` | `976f08379f3f8324bb8ea8eb37e74d1c61f6a86af4c4cb07c6596190d34428f9` | ✔ (OPS-R7) |
| `claude/packets/MA-OCT-OPS.T12_Report.md` | `a99e2e507cd06284c789d1e52957ab14172f23626b41b3f61f1b48ea6b86c5b0` | as found |
| `claude/packets/MA-OCT-002a_Report.md` | `7996e98c80c241252033b5f239a1e7582bda0f73347c23f9ff389cc3c9c29531` | ✔ equals T12's commit appendix |
| `claude/packets/MA-OCT-011.BUILD_Report.md` (for the ECA format) | `c8f664281707ae92769ad3b8f17fc231ff8f648810a78cc7fba4e1b2fcca653f` | as found |

## 1. Read ceiling (F-3): **ruling OPS-R9**

**Ceiling: 350,000 rows read for the whole 011 run** (Fri 16 export → Fri 23 re-export), accepted as proposed.

Why it is safe:
- The plan (≈ 290k) is ≈ 5.8% of **one** day's 5M cap, spread over 8 days. The account read ~46k on Thu 15 by 07:11 UTC (T12 gate reading).
- Every execution stays ≤ 1k reads, apart from the X1/X2 export pages (≤ 5k rows; ≤ 10k reads even at 2×). All well under 50k. Index audit unchanged (§6 (i)).
- The 2-reads-per-`IN`-row figure is now measured, so the pre-image/read-back/CAS line (≈ 140k) is no longer the uncertain part. Only the export multiplier is.

**Binding conditions:**
- **R9-1. Running total.** The runner keeps a cumulative `rows_read` for 011 (from `meta.rows_read`, all steps including exports) and **stops before any step that would take it over 350k**. It logs the total in each day's `recon/<date>/` export for R-4 reconciliation.
- **R9-2. Friday's export cap.** Friday's export runs with `--max-reads` **160,000** (enough to complete and measure a 2× export of ≈ 148k with 8% slack). It records the measured X1/X2 multiplier per table.
- **R9-3. Re-projection after Friday's export.** The Engineering Lead writes one line: measured export reads, and **projected total = Friday export + ≈ 140k (measured 2×) + post-run re-export at the Friday figure**.
  - **Projected ≤ 350k:** proceed. No re-rule.
  - **Projected > 350k and ≤ 450k** (the expected 2× case is ≈ 436k): **pre-ruled now — the ceiling becomes 450k** with no further review, provided R9-1 holds at 450k, every execution stays ≤ 50k, and no single day's 011 reads exceed 200k (4% of 5M). The line goes to this lane before the Sat 17 pilot, and I confirm it in one line in the next recon sign-off. The pilot does not wait for me.
  - **Projected > 450k, or any export page > 50k reads, or the export hits its 160k `--max-reads`:** **stop before the Sat 17 pilot.** No 011 write runs until the Operations Lead re-rules on the measured figures (option: narrow the post-run re-export to the touched rows only, which cuts its cost to ≈ 2 × 25.5k).
- **R9-4. No change to writes.** This ruling is reads-only. The write gates (25k/day, 60k account, 110k total, 1.3× stop) are untouched.

## 2. ML-1012-1 and related rulings in 011 rev 1.10: **CONFIRMED**

| Item | Where in rev 1.10 | Status |
|---|---|---|
| Account ceiling **60,000** | §4.3 lines on the guard, "F-5 is in force", and the N-4 table checkpoint row | ✅ present in all three places; no leftover 70k used as a live limit (70k appears only as "rev 1.9" / "was") |
| F-1 window **max(45 min, time since the last fetch)** | §4.3 "F-5 is in force (ML-1012-1)" | ✅ Consistent with F-5's own formula (measured lag 25–30 min + 5 = 35 min); 45 min is the more conservative figure and governs |
| **ML-1010-3** delivered-write counting | §4.3 "Ops ingest writes (ML-1010-3)" and the N-4 checkpoint row | ✅ Counts writes actually delivered, ≈ 5 per event, **including outbox replays and `failed` / `headroom_unavailable` events** — my OPC clarification is written in |
| **OQ-7** `hold_all_jobs` → run-log `held`, heartbeat `skipped` / `hold` | §3.5 "Recorded rulings" (cross-referenced from §4.3) | ✅ Matches 002 A1 reason codes |
| **OQ-8** calendar and freeze refusals → no batch, `gate.jsonl` only | §3.5 | ✅ Accepted: a refusal is not a run, so no heartbeat; the R-4 recon reads `gate.jsonl` with the run log |
| **OQ-9** freeze matched by name (prefix); "011 run window — other Entities writers frozen" does not block 011 | §3.5 | ✅ Accepted. Condition: the match is on the freeze's declared name prefix, not a substring, so an unrelated freeze containing "011" still blocks |

Location note (no edit needed): OQ-7/8/9 are recorded in §3.5, not §4.3. That is fine; the Task's "§4.3" reference covers both.

The Operations Lead confirms F-5 in force at the Fri 16 release review, as §4.3 says.

## 3. MA-OCT-OPS.T12: **SIGNED** (with two items still open by design)

| Check | Evidence in the T12 report | Result |
|---|---|---|
| **K-3 emitters BEFORE** = `boost-local`, `health-check-local` | Live probe 06:18Z (old keys accepted, new names 401); 002a Wed 14: "no put today; emitters `boost-local`, `health-check-local`" | ✅ |
| **K-3 emitters AFTER** = old + `gleif-011` + `local-bonds`, no other change | One `secret put` 07:10:46Z; canonical map of 4 distinct hashes (`f1840595…6520`), old two recomputed from their key files; old keys re-probed after the put and still authenticate; secret names unchanged (`CF_ANALYTICS_TOKEN`, `OPS_INGEST_KEYS`) | ✅ |
| **K-4 accept/refuse** | `gleif-011`: 201 (run `39f1c43a…`), wrong key 401. `local-bonds`: 201 (run `0755d65a…`), wrong key 401. Terminal-only `skipped`/`empty_input`, `end_only=1` — cannot become lost runs (R-T12-2 accepted) | ✅ both |
| **Registry rows** | `manual.gleif-reconcile-011`: Entities, Data-Identity Lead, manual, `gleif-011`, **900 s per batch (N-2)**, active. `local.bonds-ingest`: Entities, Data-Identity Lead, manual, `local-bonds`, 3600 s (008 §9.4), active. `INSERT OR IGNORE`; audit events 14, 15 (`registry_added`, R-T12-3 accepted) | ✅ |
| **`ops_job_pause`** | `pause_id 1`, `local.entities-enrich-boost`, `2026-10-17T00:00Z` → `2026-10-24T00:00Z`; guarded by NOT EXISTS; audit event 16 | ✅ |
| New Worker version recorded | `meridian-ops` `9d437dd1…` (prev `0905784d`, which matches 002a's Wed 14 record) | ✅ |
| Budget | ≈ 31 writes / ≤ 150; 141 metered reads / ≤ 5k; gate held; outside freezes; no TCC prompt | ✅ |
| Key handling | 32-byte keys, `O_EXCL`, mode 600, outside repo and iCloud; only 8-hex prefixes printed | ✅ |

**Notes on signing:**
- **Residual on K-3 "exactly":** a probe cannot prove no third name exists; the basis is the documented Tue 13 put plus the canonical map. Accepted as sufficient.
- **Open, not a T12 defect:**
  - **Boost pause flag** (`entities-enrich-boost-pause.sh`) on **Fri 16 after the 16:50 UTC fire**. **This is a Fri 16 release-check item:** the release check confirms the flag is set, and the pause row covers the window regardless.
  - **K-5** (zero or remove the two keys) at 011 close-out.
- **Deviation 1 (secret value printed to the ENG transcript):** recorded; the Founder accepted the exposure without rotation on 15 Oct, and 003 AC-15 retires the secret from Sat 24 Oct. Ops notes the route is Access-gated (015b). No further Ops action.
- **Correction for the Decisions Log:** the Wed 14 entry says `.env.admin-exceptions` was "now mode 600"; T12 found it **644**. It is now at `~/.meridian-secrets/admin-exceptions.env`, mode 600. Main Lane to correct the log line.
- **003:** spec §10.5 R-7 / AC-15 should name the new path, as T12 says.

## 4. 002a A4 production evidence (Wed 14): **ACCEPTED**

| Claim | Evidence | Ops view |
|---|---|---|
| **2/14 slots recorded** | 14 Oct 10:50Z (run `53c758c5`) and 16:50Z (run `1a8fc831`), both `start` + `success`, `trigger=launchd`, `detail.slot` | ✅ 2/2 terminal events, 0 permanent losses |
| **Outbox spool-and-replay seen live** | 10:54 `start` timed out → spooled; 16:55 run replayed it → 201, "delivered=1 expired=0 remaining=0"; row received 16:55:18 | ✅ The first real production recovery. Order follows A4-R1 (replay only after own terminal delivered) |
| **Real headroom figures** | Run-log `writes_today=208` and `426`, not `headroom=100000` | ✅ Real account totals. They are lagged by 25–30 min, which is expected and is why F-5 is in force for 011 |
| 0 `wrangler_auth_10000` | No wrangler or npx in the runner | ✅ |

**This satisfies 011's observability gate: the outbox is live** (§4.3 N-4 row; OPS-R7 release check "outbox live, or R-4 reconciliation"). R-4 daily reconciliation **still runs** for 011 as written in its spec (OPS-R8) — the outbox and recon together are belt and braces during the run week.

**Points for the record, not queries that block:**
- **AC-a4 stays open** until 14 non-paused slots (≈ 30 Oct, given the 17–23 Oct pause). Acceptance here is of the go-live evidence, not AC-a4 closure.
- **`end_only=1` on a run whose `start` arrives later by replay** (10:50 slot): lateness groups by `run_id` so the slot reads correctly. For 003: the flag should be re-evaluated, or ignored, when a later `start` for the same `run_id` arrives.
- The boost's headroom is computed against 100k (`headroom_80k` only logged). Unchanged from 002 rev 1.3 and not a 011 matter; 011 uses its own 60k gate.

## 5. ECA release format: **CONFIRMED** (ruling OPS-R10)

The Operations Lead's release for the Thu 22 edge steps is exactly:

```json
{"release": "EA", "steps": ["ECA", "EA"], "no_open_trigger": true}
```

passed as `--ea-release`. This matches the runner (`333e48e2…2f26`) and RA-15 / R110R-B1.

- **ECA is released only when `steps` names it explicitly.** A release with no `steps`, or with `steps: ["EA"]`, releases E-A only and blocks ECA. Ops will use that form only if it chooses to hold ECA deliberately.
- **Ops issues the release only when all of these hold**, checked from the day's recon files and holds directory:
  1. the A adjudication records ≥ 50/50 (Data-Identity Lead, with the Ops spot-check);
  2. every A batch has a checkpoint `success`/`partial` with 0 mismatches and a passed read-back diff (OPS-R7 R-1 (b));
  3. no `holds/e4-trigger.json`, no A drop, no failed A batch, no `ea-dropped.json`;
  4. the previous run day's R-4 reconciliation is signed.
- `no_open_trigger: true` is an attestation by Ops at the time of issue; the runner re-checks the holds itself, so a trigger opened afterwards still blocks.
- The drop path (`--drop-ea` / `ea-dropped.json` drops both; `eca-ea-dropped.json` when A stops; `restore --batch <A>` deletes dependent ECA edges first) is accepted as built.

## Rulings

| ID | Ruling |
|---|---|
| **OPS-R9** | 011 read ceiling **350k**, cumulative, enforced by the runner (R9-1). Friday export `--max-reads` 160k. Projected ≤ 350k: proceed. 350k–450k: ceiling pre-raised to **450k** (≤ 200k/day by 011, ≤ 50k per execution). Over 450k or a capped export: stop before the Sat 17 pilot for an Ops re-rule. |
| **OPS-R10** | ECA/E-A release format `{"release":"EA","steps":["ECA","EA"],"no_open_trigger":true}` confirmed. ECA only when named. Issued only under the four conditions in §5. |
| — | ML-1012-1 (60k; max(45 min, since last fetch)), ML-1010-3 (delivered writes) and OQ-7/8/9 confirmed present in rev 1.10. |
| — | MA-OCT-OPS.T12 **signed**. Open by design: Fri 16 boost pause flag (release-check item), K-5 at close-out. |
| — | 002a A4 production evidence **accepted**; 011's outbox gate is met. AC-a4 stays open to ≈ 30 Oct. |

## For the Main Lane

1. Put R9-1 to R9-3 into LANE-1-ENG's Fri 16 export step (the `--max-reads 160000` value and the one-line re-projection).
2. Add to the Fri 16 release check: boost pause flag set after 16:50 UTC; F-5 in force confirmed; Friday's re-projection line.
3. Correct the Decisions Log Wed 14 line on `.env.admin-exceptions` (644, now moved, 600).

## Stop point

Report written. No other files touched.
