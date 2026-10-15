# MA-OCT-007.P1 — Report

**Lane:** LANE-1-ENG, Engineering Lead (Claude Code). **Packet:** 007 Phase 1 build of spec rev 1.4 `4d4fffef…397c`.
**Opening checks:**
- Control `73ad4f22…c712` matches the STATUS_BOARD row.
- Task `abfdba59…8708` matches the hash in the Control.
- Spec hash re-checked.
- No `.git/*.lock`.
- Branch `October-2026`, HEAD `d0e6847` (T12's commit).
- Wrangler `/usr/local/bin/wrangler` 4.96.0.

**Start approval:** the Founder's paste line, Thu 15 Oct ~16:58 UTC. Status.json still read READY; the Main Lane owns that file.

---

## Day Thu 15 Oct 2026

### Hard deadline met: `meridian-entities-api` Worker live and verified (Fri 16 22:00 UTC deadline)

| | |
|---|---|
| **New version** | **`73851c02-f891-478d-abe1-1e2e5290f11f`**, deployed 17:16:51 UTC, at 100%. This is before the 011 N-3 Entities Worker freeze (17–23 Oct) and outside every FREEZES.json window. |
| **Pre-deploy version (rollback target)** | `0f475f4c-e344-42f3-8081-96938e9c9d0c` (9 Sep). Rollback: `wrangler rollback` to it (§14.2). |
| **Live = repo before the change** | The deployed script content of `0f475f4c` was downloaded through the script-content API, using wrangler's OAuth session (token never printed). It was compared with a `--dry-run` bundle of the repo source at `d0e6847`: **byte-identical**. So the deploy drops no live-only change. |
| **Source** | `App/Corporate Atlas/src/entities-api.js` SHA-256 `fac446bf000d17f1aef740588d91b0947dbe74ceaae517f53d57d427209fe245` (+363/−5 lines). Bundle 57.97 KiB, 14.56 KiB gzip. |

### What shipped (Worker only; backward-compatible, §7.1)

- **R3: redirect handling in `GET /api/entities/:id`** (§6.2–§6.3).
  - A direct hit returns today's body plus `redirect: null`, at 0 extra reads.
  - A PK miss follows `entity_merge_redirect` for up to 3 hops, with a cycle guard. Outcomes:
    - resolved: 200 with `redirect {requested_id, resolved_id, chain, merged_at, packet}`;
    - `gone`: 404 `{error:'not_found', state:'gone', requested_id}`, plus `chain` when a survivor is missing;
    - `redirect_too_deep` / `redirect_cycle`: 409.
  - **"no such table" counts as no redirect row**, so R3 ships before 013. The front end checks only status codes (`ma-entities.js:988`, `:1289`), so the new 404 body is compatible.
- **R2 + R4: paged `/api/entities/:id/instruments?limit=&cursor=`.**
  - Keyset on `instrument_key`, fetching limit + 1 rows.
  - Limit defaults to 25 and is clamped to [1, 100]; a non-integer is a 400. Cursor = last key, with no OFFSET.
  - The first page carries `total` (counted to 1,001; `total_capped: true` means "1,000+").
  - Rows are NavLink-shaped. A row's state comes from its own band, and R1 stays the authoritative resolver.
  - The R3 order is applied: `redirect` comes back with survivor data, and gone → 404.
  - **Without `limit` or `cursor`, the legacy 75-row body is unchanged (T5).**
- **R1: `GET /api/instruments/:key[?isin=]`** (§5.1), all steps 0–6:
  - the placeholder guard runs with 0 reads (R7-2);
  - R1a–R1d;
  - **R1f is coded with missing-table tolerance** (008's tables don't exist live yet);
  - redirects are followed per candidate;
  - candidates are deduped by resolved id, with a primary row plus `also_sources` (R7-3);
  - the state table applies N7-11 precedence;
  - the candidate cap is 10, with `candidates_truncated`;
  - `isin_source: 'holding'` covers N7-10, and `lei` is returned for `lei_only`.
- **Not built:** R5 (out of v1, E7-1), ETF files (Phase 2) and the ticket button (Phase 4).

### Tests (local, 0 D1): `App/Corporate Atlas/tests/nav-007-worker.test.mjs` **58/58**

- **Harness:** the real fetch handler, on an in-memory `node:sqlite` D1 shim. The test file's SHA-256 is `eaccae75a1c928a95d239ece28e58b1eb0298d44c2329bdb36da8583e9c429a5`.
- **T2 (R1 states):** matched; low_confidence (heuristic 75); the corroboration case (R7-3); isin_duplicate; N7-11 precedence; source_conflict and candidate order; lei_only (R7-8); not_in_universe; no_mapping; redirect_unresolved; merged twins collapsing to the survivor; ISIN from the holding (N7-10); bad `?isin=` → 400.
  - **The 5 placeholder forms each make 0 D1 calls.** `CUSIP:000000001` is not a placeholder.
  - A matched instrument uses ≤ 6 statements.
  - With no 008 or 013 tables, it still resolves.
- **T3 (R2):** 3 pages with no gaps or duplicates, in key order; `next_cursor` null at the end; clamp to 100; `abc` and `-3` → 400; 0 → 1; cursor-only → 25; R4 capped at 1,000+; a heuristic row → low_confidence; a redirected id → survivor + redirect; a gone id → 404.
- **T4 (R3):** hit; 1-hop; 3-hop; 4-hop → 409 too_deep; cycle → 409; survivor missing → 404 with chain; never-existed → 404; table missing → hit OK and unknown → 404 (no 500).
- **T5:** the legacy body is byte-equal to the original query, and still caps at 75.
- **T9:** NavLink conformance on R1, R2 rows and the placeholder output, plus a `sec_bond` fixture through R1f.

### T6: plan checks on live D1 (the deploy gate, AC8), 17:16:27–17:16:36 UTC, 0 rows read

| # | Live plan | vs Appendix A.3 |
|---|---|---|
| P1 R1a | `SEARCH instrument_master USING INDEX sqlite_autoindex_instrument_master_1 (instrument_key=?)` | ✅ |
| P2 R1b | `SEARCH instrument_entity_map USING INDEX sqlite_autoindex_instrument_entity_map_1 (instrument_key=?)` | ✅ |
| P3 R1c | `SEARCH entity_isin_map USING INDEX idx_entity_isin_map_isin (isin=?)` | ✅ |
| P4 R1d (IN-list) and the R3 entity probe | `SEARCH entity_master USING INTEGER PRIMARY KEY (rowid=?)` | ✅ |
| P6 R2 | `SEARCH iem USING INDEX idx_iem_entity_key (entity_id=? AND instrument_key>?)` / `SEARCH im USING INDEX sqlite_autoindex_instrument_master_1 (instrument_key=?)`, **no temp B-tree** | ✅ |
| P7 R4 | `CO-ROUTINE` / `SEARCH instrument_entity_map USING COVERING INDEX idx_iem_entity_key (entity_id=?)` / `SCAN (subquery-1)` (the ≤ 1,001-row co-routine) | ✅ (same as ENT-CR1 E2) |
| P8 R3 redirect | `no such table: entity_merge_redirect` | N/A until 013. This is the tolerated case. |
| P10 R1f | `no such table: bond_issuance` / `bond_issuer_link` | N/A until 008 applies its migration. **Follow-up:** run P10 when 008's tables exist, because R1f activates automatically then. |

*k* = **1**, from ENT-CR1's R7-7 measurement: R2 read 52 at limit 25 and 202 at limit 100. So AC2's bound is ≤ 2 × (`limit` + 1).

### Live verification (17:17–17:18 UTC)

| Call | Result |
|---|---|
| `GET /api/entities/28088` | 200; body keys `entity, redirect`; `redirect: null` |
| `GET /api/entities/28088/instruments` (legacy) | 200; keys `instruments` only; **75 rows** (unchanged) |
| `…/instruments?limit=25` | 25 rows; `total` 871; `total_capped` false; `next_cursor` set; key order starts `US21H0226488` |
| `…?limit=500` | clamped to 100 |
| `…?limit=abc` and `?limit=xyz&cursor=` | **400** `limit must be an integer` |
| `GET /api/entities/25782` (MA-SEP-007 loser) | **404** `{"error":"not_found","state":"gone","requested_id":25782}` |
| `GET /api/instruments/US5949181045` | matched; entity 1371 "Microsoft Corp."; `isin_tier1` 100 high; 1 `also_sources` row |
| `US9219378190`, `CA46431R1029`, `US0321084339` (KI 22.17 list) | **ambiguous / isin_duplicate**, 2 `firds_direct` candidates each, none pre-selected |
| `CUSIP:999999999` | unmatched / not_in_universe |
| `CUSIP:000000000`, `NAME:N/A` | unmatched / no_mapping / `placeholder_key: true` / no candidates |
| Legacy `/api/entities/search`, `/api/entities/isin/:isin` | 200, unchanged |
| `/exceptions` (no Access) | 302 to the Access login, unchanged |

**Rollout note:** one call a few seconds after the deploy (`?limit=abc`) returned the legacy 200 body. Re-run directly, it gave 400. The likely cause is an edge still on the old version mid-rollout. Every later call matched the new version.

### Budget (Control: 0 writes, ≤ 20k reads)

- **D1 writes: 0.**
- **D1 reads:** EXPLAINs 0. The live verification ran through the Worker, which this lane does not meter; the estimate is ≈ 4.5k. The largest single call was the legacy `/instruments` on entity 28088, at ≈ 2 × 871 plus a sort.

### Deviations and notes

1. **17:03 UTC (inside the boost PM band, 16:45–17:15):** I started the T6 script before checking the clock. **It never reached D1.** The command hung on a stray `cat >` that was waiting on stdin, before the script file was even written. I stopped it at 17:06, and it produced no output and made no wrangler call. T6 then ran properly at 17:16, after the band. From now on I'll check the clock before every remote step.
2. **Placeholder rule (§3.1) implemented as written:** `CUSIP:` followed by 6–9 zeros, and `NAME:N/A|NA|NONE`.
3. **R2 `total` when capped:** returned as 1000 with `total_capped: true`, so the UI shows "1,000+".
4. **`merged_at` / `packet` on a chain** come from the requested id's own (first) merge hop.

### Rulings made in this lane

- **R-P1-1:** each R2 row's `state` is derived from that mapping row's band only (`matched` / `low_confidence`). The authoritative state comes from R1 on click. §4.2 asks R2 rows for a source badge and band, not a resolved state.
- **R-P1-2:** R1's `unmatched` reason precedence is `redirect_unresolved` > `lei_only` > `not_in_universe` > `no_mapping`. §5.1 lists the four reasons but gives no order.

### Next (Fri 16 → Wed 21; front end, local only, not released)

- **`ma-data.js`:** `data_instrumentKey` (a byte port of `deriveInstrumentKey`, with T1 on ≥ 30 fixtures) and `data_entitiesGet`.
- **`index.html`:** the hash router and history contract (R7-6, R7-10, N7-13).
- **`ma-entities.js`:** card, badges, paging (R7-4), redirect notice and fallback, provenance strip.
- **Verification:** T7/T8 in the browser preview, desktop and 375 px.
- **No more Worker deploys are planned.** The freeze runs 17–23 Oct; the next slot is Sat 24 08:05 UTC, if the front end needs a Worker fix.

**Commit (Thu 15):** Worker source + tests + this report, by explicit path; its SHA is in the Founder line.
