# Meridian Atlas — Release Ledger, October 2026

*Written by the Program Orchestrator (documentation) (LANE-DOC) under **MA-OCT-CLOSE.DOC** (Control v1 `4c9de01a…2b9645`, Task v1 `2f9134fa…d6ac15`). Doc-only: built from the reports on disk, `claude/October_Decisions_Log.md` (rows to ML-1106-2, 234 lines), `claude/packets/STATUS_BOARD.md` and a read-only `git log` of `origin/October-2026` (41 commits since `420487d`, HEAD `190ea2f`). No D1 query, deploy, git write or secret was used. **Final version, Fri 6 Nov 2026:** 013 and 002b rows filled from their RUN, DEPLOY, ETFCHK and OPSSIGN reports (Main Lane instruction, 6 Nov).*

*Rules for reading this ledger:*
- *Dates are UTC. "Live version" is the Cloudflare Worker version id (first 8 hex) or the git commit for local/front-end changes.*
- *Evidence hash = SHA-256 of the report file **as it is on disk on 4 Nov 2026**, first 12 hex. Multi-day reports grew over time, so an earlier hash quoted in the Decisions Log can differ from the final one here; the on-disk file is the record.*
- *Rollback is the one recorded in the evidence report. Where a later deploy has superseded a version, the rollback shown is the one that applied at the time; the current live set is in §3.*
- *013 and 002b ran after the 31 Oct go-live as October close-out items (§2). Both are complete: **002b live Fri 6 Nov 08:04Z**; **013 complete Fri 6 Nov 16:33Z, 1,862/1,862 merged**.*

---

## 1. Delivered items

### 1.1 Foundations (24 Sep – 10 Oct)

| # | Ticket | What shipped | Live version / commit | Date | Evidence (SHA-256 prefix) | Rollback |
|---|---|---|---|---|---|---|
| 1 | **MA-OCT-000** | Runtime truth baseline (47 jobs inventoried, findings F1–F10, N1, N3 → KI 22.28–22.39); branch `October-2026` created from `420487d`; `September-2026` frozen | commit `f650c03` (no deploy) | 24 Sep | `claude/MA-OCT-000_Closeout_Summary.md` `26685282b3b3` | n/a (docs). `September-2026` frozen at `420487d` |
| 2 | **MA-OCT-012** | Entities-seed cron hotfix `0 4 * * 1` → `0 4 * * mon` (stopped the Sunday co-fire with holdings; KI 22.1, 22.28) | `meridian-entities-seed` `82de8589`; commits `5405e3e`, `fa9c723` | 26 Sep (closed 28 Sep; KI 22.1 closed 5 Oct) | `claude/MA-OCT-012_Closeout_Summary.md` `deffc898c9b3` | Superseded by `1cd92fc3` (row 5). Restoring the old cron would reintroduce KI 22.1 |
| 3 | **MA-OCT-001** | Ops backend foundation: 5 `ops_*` tables, Access-gated `/api/ops/admin/*`, run-event ingest contract v1 with kill switches, the 4 anonymous POSTs closed (KI 22.37), boost pilot emitter | `meridian-ops` `56c87c9a`; commits `da38cf5`, `658326a` | 1 Oct (closed 4 Oct) | `claude/MA-OCT-001_Closeout_Summary.md` `924b7345edd6` | `589ae24c` (emergency only); superseded |
| 4 | **MA-OCT-006** | GLEIF reliability investigation, read-only (127,238 reads, 0 writes, 52/60 API calls); remediation matrix; basis for the 011 GO | commit `16918e0` (no deploy) | 28 Sep – 5 Oct (closed 10 Oct, D5 A) | `claude/MA-OCT-006_Closeout_Summary.md` `f54ae3bf814d` | n/a (read-only). R4 retention: `gleif_006.db` kept until A2 closes (ML-1025-5) |

### 1.2 002a, ENT-CR1, T12 (11 – 16 Oct)

| # | Ticket | What shipped | Live version / commit | Date | Evidence (SHA-256 prefix) | Rollback |
|---|---|---|---|---|---|---|
| 5 | **MA-OCT-002a A5** | Auth gates: `/run` on delta, seed and figi (+ figi `/rematch`) return 401 without a per-Worker secret; bootstrap `/trigger` removed (404). Closed KI 22.35, 22.36, 22.49 | seed `1cd92fc3`, figi `5c8c547c`, delta `b0b774ed`, bootstrap `0a968cdc`; commits `8f06ed0`, `45cdb9d` | 12 Oct 18:42Z | `packets/MA-OCT-002a_Report.md` `594727fde67b` | seed `82de8589`, figi `ae7fd10d`, delta `7d316b5e`, bootstrap `4cdf40f3` (emergency only) |
| 6 | **MA-OCT-002a A1 + A2** | Job registry loaded (49 rows) + local sync script; read-time lateness and planned pauses (`ops_job_pause`) on `GET /api/ops/admin/jobs` | `meridian-ops` `b34fa8d8`; commit `45cdb9d` | 12 Oct 18:48Z | same report `594727fde67b` | `56c87c9a` |
| 7 | **MA-OCT-002a A3** | Alerting sweep `POST /api/ops/ingest/sweep` (key auth, deduped cases, macOS notification); health-check LaunchAgent revived (4 slots/day, review date 31 Dec 2026). KI 22.30 health-check half | `meridian-ops` `0905784d`; commit `1b9dbde` | 13 Oct | same report `594727fde67b` | Kill switches first (`OPS_SWEEP_ENABLED=false`, `ingest_enabled=0`, pause flag, uninstall); then `b34fa8d8` (drops the sweep) |
| 8 | **MA-OCT-002a A4** | Local boost bundle: on-disk outbox + same-run_id replay, `d1-today` pre-flight (F7), out-of-window skip, wrangler pinned 4.96.0 (also FIRDS); secrets moved to `~/.meridian-secrets/` | local LaunchAgent (no Worker); commit `3960aee` | 14 Oct 05:16Z | same report `594727fde67b` | `git checkout 1b9dbde -- <7 paths>`, restore the two `.env` copies, re-run the boost install script |
| 9 | **MA-OCT-ENT-CR1 C1** | Composite index `idx_iem_entity_key` on `instrument_entity_map(entity_id, instrument_key)` (removes the ~33k-row scan per issuer view) | D1 index; commit `4bf5530` | 13 Oct 09:33:45Z | `packets/MA-OCT-ENT-CR1.EXEC_Report.md` `2587137cb219` | CR rev 1 rollback plan (`DROP INDEX`); not taken |
| 10 | **MA-OCT-OPS.T12** | Registry rows `manual.gleif-reconcile-011`, `local.bonds-ingest`; emitter keys `gleif-011`, `local-bonds` (one `OPS_INGEST_KEYS` put); 003 read pack; governance commit; boost pause flag (Fri 16) | `meridian-ops` `9d437dd1` (secret change); commit `d0e6847` | 15–16 Oct | `packets/MA-OCT-OPS.T12_Report.md` `c31a73ef8024` | `0905784d`; `gleif-011` key later retired (row 14, K-5) |

### 1.3 Data runs and 007 Phase 1 (15 – 24 Oct)

| # | Ticket | What shipped | Live version / commit | Date | Evidence (SHA-256 prefix) | Rollback |
|---|---|---|---|---|---|---|
| 11 | **MA-OCT-007 Phase 1 (Worker)** | Instrument–issuer navigation routes R1–R4 on `meridian-entities-api` (Worker tests 58/58) | `meridian-entities-api` `73851c02`; commit `0dd7ef0` | 15 Oct 17:16:51Z | `packets/MA-OCT-007.P1_Report.md` `b487f3969229` | `0f475f4c` (9 Sep; proven byte-identical to repo before the change) |
| 12 | **MA-OCT-007 Phase 1 (front end)** | Router, overlay stack, Instrument card, paged linked instruments; BR-1 (5xx = outage + Retry), BR-2 (placeholder identifiers hidden). Founder UAT PASS 22 Oct (12-step sheet `e5f4d1326bac`). Released with row 25 | commits `3989ab1`, `e4ee5c8`, `c3c6e4a`; live via `98e830e` | built 18–21 Oct; live 31 Oct | `packets/MA-OCT-007.BR1_Report.md` `6c2096e541ce`; P1 report above | Pages rollback (row 25) |
| 13 | **MA-OCT-011** | Offline GLEIF reconciliation from the pinned 28 Sep Golden Copy: steps P, B, C, C-reasons, RC-15, E-C. 76 forward batches + 1 restore, **54,936 D1 writes, 0 mismatches**, reads 247,468 / 350k. §9 re-based PASS (16,936 LEI-bearing rows = expected), 200/200 sample, 25/25 spot checks, all invariants 0. A, ECA, E-A **deferred** (E-4: A-pilot 48/50; Founder "Defer A", 21 Oct) | local runner (no Worker); code commit `58cd922` (28 Oct) | 17–22 Oct | `packets/MA-OCT-011.RUN_Report.md` `d032abfbb445`; `packets/MA-OCT-011.CLOSE_Report.md` `89dab6159c12`; CLOSEREV-ARC `a9c1cd196c88`; CLOSEREV-OPS `408948c20bdc` | Runner `restore --batch <id>` per batch (proven on A-001: 250/250, 1,293 writes, 0 mismatches) |
| 14 | **MA-OCT-002a A6** + K-5 + boost resume | `meridian-control` Worker split (admin governance routes behind the 'meridian-control admin' Access app; `ops-script` service token); `gleif-011` ingest key retired (K-5); boost resumed after the 011 pause | `meridian-control` `c442209c` (first version); `meridian-ops` `fffe9f9f`; commits `7330a7f`, `ccff23b` | 24 Oct 08:17–08:23Z | `packets/MA-OCT-SAT24.ENG1_Report.md` `a1a43c577565`; A6R `76fe7e011212` | control: leave unused (§13); ops → `3c88f8d2` (post-K-5) |
| 15 | **MA-OCT-008** (load) | SEC corporate-bond ingestion: local manual runner, tables `bond_issuer_link` + `bond_issuance` (Entities domain); all 30 seed issuers loaded (Toyota 457 + 27-issuer initial load, ≈2,750 lane writes); 51 skips signed (AC17) | local runner; D1 load 15–16 Oct; code commit `16b2b10` (28 Oct) | 15–16 Oct | `packets/MA-OCT-008.BUILD_Report.md` `c58271be9d82`; `packets/MA-OCT-008.AC17_Report.md` `1a8a29348d6e` | Rollback SQL per run in `bonds/state/`; bonds not served until the gate opens (row 23) |

### 1.4 Go-live week (24 – 31 Oct)

| # | Ticket | What shipped | Live version / commit | Date | Evidence (SHA-256 prefix) | Rollback |
|---|---|---|---|---|---|---|
| 16 | **MA-OCT-003** deploy 3 | Exception management on `meridian-ops`: case routes E-1/E-2/C-1/C-2, service-token allowlist; 004 indexes; **M1/M2** migration of the 9 legacy `entity_exceptions` records into Ops (3 `do_not_merge` decisions unchanged) + 2 GLEIF cases | `meridian-ops` `14aa968c`; commit `76f4261` | 24 Oct | `packets/MA-OCT-SAT24.ENG8_Report.md` `260290fcf18b`; build `1307bf3684f0`; BREVA `365464181ee7`; BREVD `d630fe73b451` | `fffe9f9f` |
| 17 | **MA-OCT-MON26.ENG1** | Stopped the `/api/ops-health` full scan of `entity_master` (cause of the 25 Oct 5M-read breach, ML-1025-3): 491 rows/call (was ≈88.8k). `ma-ops.js` hidden-tab poll pause (front end, shipped with row 25) | `meridian-proxy` `9253b611`; commit `721d093` | 26 Oct 19:46:36Z | `packets/MA-OCT-MON26.ENG1_Report.md` `beb88f13beca` | `c95aa7b9` (9 Aug; proven byte-identical) |
| 18 | **MA-OCT-003** deploy 5 | Retirement on `meridian-entities-api`: `/exceptions` + `/admin/exceptions` removed (`/admin/exceptions` 410) | `meridian-entities-api` `1e54a425`; commit `29ddfb4` | 28 Oct | `packets/MA-OCT-WED28.ENG1_Report.md` `20543865fe63` | `73851c02` |
| 19 | **MA-OCT-ENT-CR1 C2/C3** | Dropped duplicate indexes `idx_instrument_master_isin`, `idx_instrument_master_cusip_issuer`. ENT-CR1 complete | D1; commit `acfd069` | 28 Oct | same report `20543865fe63` | Re-create both indexes (CR rev 1) |
| 20 | **MA-OCT-003** deploy 4 | GLEIF condition checks E1/E2/E4/E5/E6 in the sweep, S2 suppression, auto-resolve; health-check runner logs the full sweep response (S-3) | `meridian-ops` `2e4c3fc6`; commits `fd7b753`, `f444ce7` | 29 Oct | `packets/MA-OCT-THU29.ENG8_Report.md` `52699fea9fa7`; WED28.ENG8 `edeaaddecf18` | `14aa968c` |
| 21 | **MA-OCT-004** | Data-quality ticketing: DQ routes D-1/D-2/D-3, DQ engine on C-1/C-2, migration 005 (`ops_dq_ticket_member`) + M3a/M3/M3c/M3d (468 writes; seeds incl. KI 22.17 → `DQ-000028..35`), sweep `dq_new` | `meridian-ops` `e8b81bf9`; commit `df4066c` | 30 Oct 06:58:48Z | `packets/MA-OCT-004.GOLIVE_Report.md` `e280d367a15b`; build `8eddf582f2b6`; BUILD.REVA `1a92830524a0` | `2e4c3fc6` |
| 22 | **MA-OCT-009 + 010** | Fixed Income API (F1/F1b/F2/F3/F4, gated R1f) + `fi_serving_gate` table (created **closed**) + 010 Fixed Income page (front end, shipped with row 25). PepsiCo pre-deploy check PASS (8 reads) | `meridian-entities-api` `4e7ee20b`; commits `058c389`, `1a59b77` | 30 Oct 16:03:46Z | `packets/MA-OCT-FRI30.ENG1_Report.md` `190cbac85e89`; build `a32e8d0bede7` | Rule M-4: no rollback below `4e7ee20b` without the R1f switch-off once the front end is live |
| 23 | **MA-OCT-008 fixes + bond gate open** | R-1 PepsiCo Singapore rows moved to their own CIK (28 Oct); R-2 parser `bonds-1.2.0` (37 spread-less floating finals → 0, 29 Oct); R-3 filer re-scan (0 co-registrants); **AC12 PASS** (30 Oct); R-4 NextEra `0001193125-25-169329` → `skipped_other` (finals 633 → 632); **gate opened 21:21:42Z** (Data-Identity Lead + Founder acknowledgement). Cache API proven on `workers.dev` | commits `845614f`, `71fab4b`; D1 `fi_serving_gate` | 28–30 Oct | `packets/MA-OCT-SAT31.ENG8_Report.md` `19ceafa00a1a`; `claude/MA-OCT-008_AC12_Readjudication.md` `8c306b726ee7`; FRI30.DIL `7602d5a84565` | Gate kill switch closes the gate (any lane, no acknowledgement); R-4 rollback SQL saved |
| 24 | **MA-OCT-005** | Operator console (Cases + DQ tabs; console route `GET /api/ops/admin/console`, 0 reads; 15/15 routes) + 004 `dq_since` late-start fix | `meridian-ops` `1109edb6`; commit `ca15f70` | 30 Oct 21:23:31Z | `packets/MA-OCT-SAT31.ENG4_Report.md` `27277593da88`; build `b165d238dba5` | `e8b81bf9` |
| 25 | **MA-OCT-REL.SITE** | October site release: `docs/` regenerated (007 + 010 + 005 front ends, Ops poll pause, AC12 spread copy); GitHub Pages switched to `October-2026` `/docs`; all 11 files verified byte-identical at 09:49Z; `CLAUDE.md` DEPLOY_BRANCH updated | commits `98e830e`, `a3e3f1f` | 31 Oct 09:24:58Z | `packets/MA-OCT-REL.SITE_Report.md` `9aeb3c0d0314` | Founder switches Pages back to `September-2026` `/docs` (`420487d`, frozen) |
| 26 | **MA-OCT-OPS.A** | All Ops views behind the signed-in console; terminal OPS button opens the console (signed-out → 302 to Access). No Worker deploy (`1109edb6`, 15/15) | commit `f362131` | 31 Oct | `packets/MA-OCT-OPS.A_Report.md` `b6a423d8d456` | `git revert f362131`, regenerate `docs/`, commit |
| — | **October go-live** | Founder UAT items 1–5 passed; Ops login re-checked in a private window; **October 2026 release signed off** | site `October-2026` @ `98e830e` + `f362131` | 31 Oct | Decisions Log ML-1031-6, ML-1031-7 | Pages → `September-2026` `/docs` |

---

## 2. Post-go-live items (October close-out)

*The Founder's condition (ML-1030-6): 013 and 002b are delivered before any November work starts. The Founder kept 013 in October (ML-1105-5), superseding the November-item-#1 fallback of ML-1105-3/4.*

| # | Ticket | What shipped | Live version / commit | Date | Evidence (SHA-256 prefix) | Rollback |
|---|---|---|---|---|---|---|
| 27 | **MA-OCT-002b** | B1 effective schedules + drift via a read-only Workers token; B2 Worker heartbeats (holdings end-only, bootstrap, enrich phase1/phase23, seed; delta dual-write code only, held); B3 ETF per-ETF write cost + pass-cycle metric; B4 KI 22.14 (enrich budget from analytics) + FIRDS failure count; B5 KI 22.39 CR-10 steps 1–2 (`entity_pipeline_state`, migration 009). Fix `global_fetch_strictly_public` on 4 Workers after bootstrap heartbeats got HTTP 404 (Fri 04:06–04:07Z). Proven: enrich 06:00/06:50Z events, bootstrap 08:00Z event, first Friday sweep read 6 Workers' schedules — 7 jobs updated, **0 drift, 0 errors** | `meridian-ops` `d9c3c386` (code `2af53666`); bootstrap `b2ab8f09`; enrich `5c64e54e`; seed `135607d4`; holdings `888af088`; delta `47c216c0`; commits `7c0ad2e`, `e93d71e` | Deployed Thu 5 Nov 20:13–20:46Z; fix Fri 6 04:06Z; **live Fri 6 Nov 08:04Z** | `packets/MA-OCT-002b.DEPLOY_Report.md` `5ad3c24ab3e5`; SIGNE (ETF PL, SIGNED with C-1..C-3) `5faaaa1ab205`; SIGND (DIL, 4 SIGNED + 2 WITH CONDITION) `34ddcb866b7c`; build `b42b48585dec` | ops → `1109edb6` (code) / delete `CF_WORKERS_READ_TOKEN` / re-put K-5 key map; bootstrap → `0b6cc67e` (pre-packet `0a968cdc`); enrich → `d669f9fc` (pre `23fd2660`); seed → `14332e4c` (pre `1cd92fc3`); holdings → `790a5482` (pre `93ab6411`); delta → `b0b774ed`; registry `m3-…rollback.sql`; `OPS_HEARTBEATS_ENABLED="false"` |
| 28 | **MA-OCT-013** | Duplicate-entity merge (KI 22.41) under survivor rule S1 (older, LEI-bearing row survives). Spec rev 1 `e6dc8567…f098` (15 review must-fix + 4 entity-id tables measured); runner built, crash-safety fix (B-1) and headroom-gate fix (FIX2, T-18) each re-checked by the Architect; `entity_merge_redirect` created. **38/38 batches, 1,862/1,862 merged, 0 raced, 0 breach, 11,298 merge writes** (+3 LEI changes = 24 D1 rows, +5 setup; 11,327 lane writes). B01 pilot + Data-Identity spot check 20/20. **62** instrument links repointed to survivors; 3 LEIs applied. R8 verify ok (1,862 redirects, 0 duplicates live, every reference probe 0, held ids merged 0); 007 redirect check 5/5. ETF PL: no ETF number changed (SIGNED WITH NOTE). Ops R-4: run log = recon = D1 ledger (SIGNED WITH NOTE). Held for November: 6 unsigned pairs, 101 three-way/OTP rows, 7 Filings-linked merges, 154 new candidate pairs | local runner (no Worker); D1 `entity_master`, `instrument_entity_map`, `entity_merge_redirect`; commits `3c8866b` (build), `5e41e7b` (FIX), `190ea2f` (FIX2) | **Fri 6 Nov** 12:29Z (migration) → 16:30–16:33:47Z (B02–B38 + LEIs); no Day 2 needed | `packets/MA-OCT-013.RUN_Report.md` `0152c923f0ea`; ETFCHK `4ee07f76714f`; OPSSIGN `4961f23149a2`; SPOT_B01 `9f59ee8150f2`; CHECK2 `eb04f85a3248`; CHECK `49603cfe54a8`; FIX2 `61e2eba90ea9`; FIX `5e7fc9e45bd5`; BUILD `5ce5154b39e3`; SPEC1 `97bcf83cbad7` | Runner `restore --batch <id>` from write-once pre-images, reverse order (spec rev 1 §11; round trip proven byte-identical in the replica dry run and in CHECK). Full rollback ≈29.9k writes = Founder + Operations Lead decision, ≤ 25k/day, never Sunday; CAS misses listed, not forced. **011's rollback horizon ended at 013's first write (12:29:19Z)**. Boost pause row `pause_id 2` expires Sat 7 14:00Z (rollback SQL saved) |

**October formally closes** after these two items, the CLOSE.COMMIT packet, and the Founder's close line (ML-1105-5, ML-1106-2).

---

## 3. Live state at October close (Fri 6 Nov 2026)

| Component | Live | Set by |
|---|---|---|
| GitHub Pages | `October-2026` `/docs` @ `98e830e` + `f362131` | rows 25, 26 |
| `meridian-ops` | `d9c3c386` (code `2af53666`; 15 routes) | row 27 |
| `meridian-control` | `c442209c` | row 14 |
| `meridian-entities-api` | `4e7ee20b` | row 22 |
| `meridian-proxy` | `9253b611` | row 17 |
| `meridian-entities-seed` | `135607d4` | row 27 |
| `meridian-entities-figi` | `5c8c547c` | row 5 |
| `meridian-entities-delta` | `47c216c0` (cron held) | row 27 |
| `meridian-bootstrap` | `b2ab8f09` | row 27 |
| `meridian-holdings` | `888af088` (heartbeat end-only) | row 27 |
| `meridian-entities-enrich` | `5c64e54e` | row 27 |
| `meridian-filings`, `meridian-13f` | not deployed in October | — |
| Bond serving gate | **open** since 30 Oct 21:21:42Z | row 23 |
| Duplicate merge | 1,862 duplicates merged; `entity_merge_redirect` 1,862 rows | row 28 |
| Branch | `origin/October-2026` HEAD `190ea2f` (41 commits since `420487d`); close-out docs and reports commit with MA-OCT-CLOSE.COMMIT | — |

---

## 4. Carried items (to November)

| Item | Source | Notes |
|---|---|---|
| **A2** — the deferred GLEIF A-rows (A 3,648 + ECA 44 + E-A 296 + Q) | ML-1021-2, ML-1030-2 | G-2 FAIL 149/150 (former-name match, ~31 similar rows) → new rule needed; A2.CODEREV must-fix ×3 (C-4 bypass, G-2 incomplete file, G-4 exit 4). `gleif_006.db` kept until A2 closes |
| A2/011 patches 00–05 uncommitted | ML-1031-6 | Commit with the A2 re-spec |
| **CR-11** — FIRDS weekly run failing since the wrangler pin (18, 25 Oct; 1 Nov expected) | 002b.BUILD, ML-1104-1 | Opened as a November item |
| Lock the read-only Ops GET routes behind Access | ML-1031-3/4 | November security item; hiding the panel did not make the routes private |
| M4 — 4 named 008 issuer DQ tickets | ML-1030-2 | Text predates the 28 Oct PepsiCo fix; Data-Identity Lead refreshes |
| Parser remarketing rule (R-4 applied by hand) | SAT31.ENG8 | Parser does not yet apply it |
| 010 display notes (spread rounding, reset-note label) | SAT31.ENG8 | Release-check notes |
| **007 Phase 2** (ETF screen wiring) | ML-1031-6 | |
| Phone-width top button row overflow | REL.SITE | Pre-existing |
| Optional: shorter Cloudflare Access session | ML-1031-6 | Founder setting |
| **013 held items:** 6 unsigned likely-same-company pairs; 101 three-way/OTP rows; 7 (+1 three-way) Filings/13F-linked merges after owning lanes repoint ("R-F"); 154 new candidate pairs; 6 cross-pair LEIs to Data-Identity adjudication | ML-1029-4, ML-1104-3, ML-1106-2 | November |
| 013 runner: log startup errors (the 13:29Z Cloudflare 7403 left no run-log line); runner's date-specific cap (CHECK N-14) | OPSSIGN N-1, CHECK | November #1 hygiene |
| Boost `pause_id 2` expiry check Sat 7 after 14:00Z (11:50Z boost has `start` + `success`) | OPSSIGN | Operations Lead |
| ETF: `/api/etf-overlap` and `/api/etf-exposure?stock=` read-cost risk; holdings entity icon uses only `entity_isin_map` (grey for instruments 007 resolves) | ETFCHK notes 3a/3b | ETF Product Lead |
| **002b follow-ons:** KI 22.39 CR-10 steps 3–5 (each signed separately); ETF C-2 holdings start events need new ETF-PL sign-off; close the 2 bootstrap `job_missed` cases with a note → `e93d71e`; enrich phase1 frozen (100 attempted / 0 progressed, `EXC-S-8D9277CA552E`) and no Phase 2+3 GLEIF calls for 3 days → Data-Identity Lead; registry-sync `observed_since` diff | 002b.DEPLOY | Owners named |
| 011 runner: write `after: "<id>-restored"` on restore lines | 011.CLOSE | Cosmetic |
| `sprintboarditems` / `releaseledger` D1 sync for October | Sprint_Board.md (15 Oct) | **Not verified in this packet** (doc-only, no D1) |

---

## 5. Process record (short)

- Production changes to 31 Oct: **18 Worker code deploys + 2 secret-only versions** (T12, K-5) across 8 Workers (`meridian-ops` 8 code + 2 secret versions, `meridian-entities-api` 3, seed 2, figi, delta, bootstrap, control, proxy 1 each); ENT-CR1's 3 index changes; Ops migrations 002–005 + M1/M2/M3; **2 site releases**. Close-out (5–6 Nov): 002b 10 code deploys (incl. the 4-Worker fix) + 6 secret versions across 6 Workers, migration 009; 013 migration + 11,327 lane writes. One secret-print incident (24 Oct, ENG8): the `ops-script` Client Secret was printed to a session; rotated the same day (ML-1024-1).
- One D1 free-tier breach: 25 Oct reads over 5M/day from the `/api/ops-health` scan; fixed 26 Oct (row 17).
- Two Main Lane packet errors were caught before harm: A2 runner never built (ML-1029-5) and no 013 build packet (ML-1030-2).
- Go-live was planned for Tue 3 Nov (ML-1025-5) and brought forward to Sat 31 Oct (ML-1031-2).
- 013 hit two runner defects before writing any merge: crash safety (CHECK B-1, fixed `5e41e7b`) and a headroom-gate clock-order bug that failed closed on every batch (fixed `190ea2f`). A transient Cloudflare 7403 at 13:29Z stopped the runner with 0 writes; the run resumed on the Founder's approval and finished in one day.
