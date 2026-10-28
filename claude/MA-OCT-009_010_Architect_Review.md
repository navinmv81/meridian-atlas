# MA-OCT-009 + 010 Fixed Income spec rev 0 — Architect Review (REVIEW-A)

```text
ISSUED BY:    Main Lane — MA-OCT-009.REVA Control v1 c172471690e995664af3b03c1a548f5cc3364c3e0e5ce50ef4fd0069952f10da
              Task v1 f0bfedf023f6455d4b93d1ed3d7cbed01ef12d39c7385084b63eeca69fe1f1b8 (both verified)
EXECUTED BY:  REVIEW-A (Architect), Tue 27 Oct 2026, doc-only. 0 D1, no deploys, no git writes, no secret files.
INPUTS:       claude/MA-OCT-009_010_Spec.md rev 0             8216123ec92f17b6f0f828246305a01bb7ea4b6ec0a59f1945b192131f8ef3b4
              claude/MA-OCT-007_Spec.md rev 1.4               4d4fffefab020d516a1804843d01142452306bd07e20275a0cd1bf79759b397c
              claude/MA-OCT-008_Spec.md rev 1.2               bcdad9a2d315371b9c60b11cbcf72dfca88c99dca22fbe4e5310e2fb5f815cd3
              claude/packets/MA-OCT-008.DIL14_Report.md       c517dde7b9a561870ef1123b33d55a2d99fcbdb6f3bbb197dd946691d11c9399
              Code from git at origin/October-2026 = 721d093 (entities-api.js fac446bf…e245; ma-data.js; ETF holdings schema).
              All hashes match.
VERDICT:      PASS WITH NOTES — 0 BLOCKER, 7 MUST-FIX before build (doc or build-Control text; none changes the design), 9 NOTES.
              The design is sound: one gated, read-only, additive surface on the existing Worker.
```

**Independence.** LANE-7 wrote the spec. I did not write it or any of its inputs.

## 1. Task checks

| # | Check | Result |
|---|---|---|
| 1 | **Boundaries and ownership** | **MET.** `fi_serving_gate` is a new **Entities-domain** one-row table: reader `meridian-entities-api`, writer an operator one-statement `wrangler d1 execute` on signed evidence. 008's bond tables stay read-only, and 009/010 write nothing else. No ETF table is read or written. No Ops table is read; freshness comes from `last_polled_at` (§5.5). No cross-domain table. See N-2 on the owner label. |
| 2 | **API contracts** | **MET.** All new routes are `GET /api/fi/*` on the existing Worker. 007 R1–R4 keep their shapes. The R1f change (§4.3) only removes a `sec_bond` candidate while the gate is closed, which is the same outcome R1 already gives when the bond tables are missing (`navIsMissingTable`, step 3a). So it is backward-compatible for every 007 consumer. After 003's deploy-5 retirement, CORS is `GET, OPTIONS`, which covers every FI route. See N-6 on the response helper. |
| 3 | **Three-point check** | **MET, subject to M-3 and M-6.** Every query names its index: gate = INTEGER PK; F1 step 1 = `idx_bil_entity` (P-B2); F1 step 2 = `idx_bi_cik_final_key`, partial on the literal `'final'`, with no temp B-tree (P-B1); F1b and F2 = PKs; F3 = whole-table scan of about 30 rows plus a partial-index grouped scan (about 1.6k) plus `idx_bi_instrument` for N8-3 (about 0.7k); F4 = `idx_bi_cik_final_key` range plus a temp B-tree, bounded by the issuer's finals; R1f = `idx_bi_instrument` plus 1 gate read. Every single execution is ≤ about 1.6k, far under 50k. The schema in 008 §8.1–§8.2 provides each named index and the keyset NULL guard. |
| 4 | **Rollback (§12)** | **Not as written. See M-4.** Closing the gate cannot re-gate a rolled-back Worker. |
| 5 | **Build plan on the new dates** | **Not as written. See M-1 to M-3.** §8 and §10 still say: deploy Wed 28, release Sat 31, PepsiCo check before Mon 26. |

## 2. Findings

### MUST-FIX before build (spec text or the build Control)

- **M-1 (§8, §10) Re-plan to Option C.**
  - **Wed 28 (local build).** It starts only after 003's deploy-5 retirement is **committed on `origin/October-2026`**: at `721d093`, `entities-api.js` is still the pre-retirement `fac446bf…`. The 009 diff is built on that retirement commit.
  - **Thu 29.** In order: the gate migration (closed); the pre-deploy PepsiCo check (M-3); EXPLAIN T-F8; the deploy (pre-deploy version id recorded, which is now the **retirement** version); T-F10 with the gate closed.
  - **Gate opening.** It opens only after the 008 AC12 re-check passes (Wed 28–Thu 29) and R-1 has moved the 4 PepsiCo Singapore rows.
  - **Mon 2 Nov.** The 007 and 010 front ends ship together in the site release. This is the last production change.
  - **Tue 3.** Go-live.
  - Remove "Sat 31 last deploy" and "Sun 1 sign-off" (§4.1, §8, §10).
- **M-2 (§4.3, §10) Release gate for the front end.** The 007 front end calls R1. **Mon 2's site release may ship only if the gated R1f (the 009 deploy) is live**, or else the one-constant R1f switch-off from Founder Q3 is deployed first. Until Mon 2, R1f's ungated exposure is API-only, because GitHub Pages still serves `September-2026/docs` (ML-1026-1).
- **M-3 (§14 Q3, now inside the 009 build) Define the ≤ 8-read PepsiCo check exactly.**
  - For each of the 4 keys:
    - (a) `instrument_master` by PK `instrument_key`;
    - (b) a holding probe on `fund_holdings_monthly` **by CUSIP only**: `WHERE cusip = ? LIMIT 1`, which is a SEARCH on `idx_holdings_cusip (cusip, report_month)`.
  - **Never probe holdings by ISIN or `instrument_key`.** `fund_holdings_monthly` has no index on either (its only indexes are `(series_id, report_month)`, `(security_ticker, report_month)` and `(cusip, report_month)`), so such a probe is a full scan of the largest table. That breaks the project's no-full-scan rule.
  - EXPLAIN first and record the result.
  - If any key is found, the R1f switch-off (M-2) ships with the Thu 29 deploy at the latest.
- **M-4 (§12) The rollback caveat does not hold.**
  - **The problem:** the gate exists only in the 009 code. A `wrangler rollback` to the pre-009 version (now the 003 retirement version) brings back the **ungated** R1f, and closing the gate has no effect on that code.
  - **The rule:**
    - (a) Before AC12 passes and R-1 is applied, do not roll the Worker back below the 009 version once the front end is live (Mon 2). If a rollback is unavoidable, deploy the R1f switch-off constant with it.
    - (b) After AC12 passes and R-1 is applied, a rollback is acceptable: the wrong-issuer rows are gone, and no row is < 60 today (C2).
    - (c) Data-only incidents are handled by closing the gate, never by a Worker rollback.
- **M-5 (§5.7; Architect Q8) The cache key must carry the gate *version*, not only its state.**
  - Q8 asked whether a closed gate can serve a cached open body. It **cannot**: the gate is read first, the key includes the state, and closed responses are `no-store`.
  - **But there is a stale-open path:**
    1. The gate is open, and F3 or F4 is cached under `…+open` with bad data.
    2. The incident closes the gate.
    3. The data is fixed.
    4. The gate reopens within 1 h.
    5. The pre-fix `…+open` body is served again.
  - **Fix:** key = URL + `state` + `changed_at` (read in the same 1-row PK read, so no extra cost). Every gate flip then invalidates the cache.
- **M-6 (§5.7, §6) Do not count on the Worker Cache API on `*.workers.dev`.**
  - `meridian-entities-api` is served only at `meridian-entities-api.navinmv1981.workers.dev` (no route or custom domain in its toml; `ma-data.js` `ENTITIES_WORKER_BASE`).
  - Cloudflare's Cache API page promises functional cache operations for Workers on **custom domains**. It does not promise them on `*.workers.dev`, and community reports say `cache.put` / `cache.match` do nothing there.
  - **Either** T-F10 proves a cache hit (for example a diagnostic header on F3, called twice), **or** §6 states the uncached budget: F3 ≤ about 2.4k per call; F4 up to about 1.6k per issuer view for the largest issuer. Worst day ≈ 300 × (55 + 1.6k) + directory calls ≈ **0.6–0.75M reads/day (≈ 12–15 % of 5M)**.
  - That is still within limits, but it is the figure to plan on. F4 stays first in the §11 cut order. Browser `max-age=60` is unaffected.
- **M-7 (§5.2 step 6) Define the multi-CIK cursor exactly.**
  - The cursor is the tuple of the **last row consumed in the merged order** (returned, or dropped by the < 60 filter) at the moment the page fills.
  - It is **not** the largest tuple fetched from any CIK. Each CIK fetches `limit + 1` rows, and a "max scanned" reading would skip rows that were fetched but not consumed, leaving gaps.
  - T-F2 must include a case where one CIK's fetched tail extends past the page cut.

### NOTES (non-blocking)

- **N-1 (§4.1).** On a D1 error other than a missing table, return a 5xx outage (007 BR-1: Retry), not "closed". It is still fail-closed (no data), but it stops an outage from being shown to users as "being quality-checked".
- **N-2 (§3).** Owner label: the project rule puts new Entities-domain tables under the **Entities Product Lead**. Write "Entities Product Lead (Data-Identity Lead lane)", so the gate's owner and its opener are clearly the same role.
- **N-3 (§0).** The spec pins `entities-api.js` at `d18845dd…`, which is 003's then-uncommitted retirement copy, not git. Re-pin the build to the committed retirement commit (M-1).
- **N-4 (§4.3).** R1f uses `LIMIT 1` per `instrument_key`. For a key held by more than one CIK (N8-3), the candidate is nondeterministic. F2 handles this as `ambiguous`, R1f does not. Raise it as a 007 follow-up; it does not block.
- **N-5 (§5.2, §5.6).** Cap the CIKs per entity in F1 and F4 (for example ≤ 10, beyond that a 422). Reads are then bounded by spec, not by data. 008 assumed ≤ 3.
- **N-6 (§5.7).** Use a separate FI response helper for `Cache-Control`, so 007's `json()` and the R1–R4 headers stay byte-identical (the differential test from 003's retirement can be reused).
- **N-7.** 008's `migrations/008-bonds.sql` and runner (`App/Corporate Atlas/bonds/`) are still **untracked** in git. Put them on the Main Lane commit list before the 009 build tests against their schema.
- **N-8 (§4.1).** Gate-flip calendar: a flip is a data write, not a deploy. Restate it for Option C: allowed any day once AC12 has passed; on Mon 2 / Tue 3 only with the Founder's say-so. Run T-F10 again with the gate **open** right after it opens.
- **N-9 (Architect Q9).** The 1 h per-colo cache on F3/F4 is acceptable against the runner's cadence (manual runs, a few a week), once M-5's gate-version key is in place. After a runner run, counts and freshness can lag ≤ 1 h. Say so in the freshness line's tooltip or in the spec.

## 3. Answers to §15 (Architect)

- **Q8.** No: a closed gate cannot serve a cached open body. There is a stale-open path across a close and reopen; fix it with M-5.
- **Q9.** Yes, acceptable with M-5 (N-9). M-6 decides whether that cache is actually in effect.

## 4. Founder decisions checked (not re-opened)

- **Q1** (`#/fi` as a 007 layer; full FI panel in November): §7.1 and §7.6 match.
- **Q2** (`fi_serving_gate`, created closed, opened on AC12 evidence, also the kill switch): §4 matches. M-4 and M-5 tighten it.
- **Q3** (PepsiCo check before any front end can reach R1f): now pre-deploy (M-1, M-3), with the release gate M-2.
