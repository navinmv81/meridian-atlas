# MA-OCT-013 — ETF Product Lead post-run spot check (N-6)

```text
ISSUED BY:    Main Lane, Control MA-OCT-013.ETFCHK v1 (df394bc0…8578), Fri 6 Nov 2026 18:55Z
EXECUTED BY:  ETF Product Lead (ETF-PL), Claude Code, read-only, 18:52–18:57Z Fri 6 Nov
GOVERNING:    MA-OCT-013.RUN_Report.md   0152c923f0ea42c026dcb105ded2a4f187c51b760e84cccaf333841a731a4ccb  (verified)
              MA-OCT-013_ETF_Review.md   381ccb991149f6c76fb265f17eefbbe26a014eb3f7d89e8236696b7bf6da6e84  (verified; N-6, MF-1..MF-2)
MODE:         0 D1 writes, 0 deploys, 0 git writes, no secret file read.
              D1 reads 1,701 via wrangler 4.96.0 + 3 live API calls (cap raised by the Founder from 1,000 to about 10k mid-packet, see §5)
```

## Verdict: **SIGNED WITH NOTE**

013 changed no ETF number. All 62 repointed instruments now resolve to their survivor, and nothing else changed on those rows. The ETF API routes and response shapes are unchanged: no ETF table was written or read by the runner, and neither Worker was deployed after 30 Oct. There are no rows to restore.

The **note**: N-6 was **not** run as written. The Founder approved a substitute part-way through the packet (§5):

- No pre-run ETF baseline was ever captured, so the "byte-identical to the Sun 1 baseline" test cannot be done by anyone.
- The live `/api/etf-overlap` and `/api/etf-exposure` calls were replaced by structural evidence, because of their D1 read cost.

## 1. What 013 repointed (ETF-visible set)

| Measure | Value | Source |
|---|---|---|
| `instrument_entity_map` rows on merge candidates (pre-run export) | 63 | `plan-fri6/export/children.json` |
| Repointed by the run | **62** (spec rev 0 said 74; rev 1 re-derived at plan time) | `plan.json` `iem_keys` = pre-image `iem` rows, 62 = 62, ids match 62/62 |
| Not repointed | 1: `TW0004772009` → 92126, pair 92126→107305 held `i1_unsigned` | plan `held.i1_unsigned`; live row still 92126 (q07). Duplicate not merged, so nothing dangles |
| Held by ETFs | all 62 ISINs appear in `fund_holdings_monthly` (2–31 rows each) | q02 |

## 2. N-6 checks

| # | Check | Result | Evidence |
|---|---|---|---|
| A | The repointed instruments now resolve to survivors | **PASS: 62/62 at survivor, 0 at duplicate, 0 other** | q05, live PK read of `instrument_entity_map` vs `plan.json` survivor map |
| B | Nothing else changed on those rows | **PASS: 0 differences** in `source`, `confidence`, `created_at` vs pre-images | q05 vs `preimages/*.json` |
| C | Entity icon on 3 ISINs held by ETFs: `KYG5635P1090` Longfor (dup 91053 → 16558; IEMG, VNQI, MCHI …), `CNE100003S06` China Resources Micro (2205 → 16895; EEMV, IEMG, MCHI …), `KYG2121Q1055` China Feihe (88305 → 97756; IEMG, AVEM, MCHI …) | **UNCHANGED: HTTP 404 `{"error":"Not found"}`**, so the icon greys ("Entity not yet resolved"). Response shape matches `handleIsinLookup`'s 404 branch | live `meridian-entities-api` `/api/entities/isin/:isin`, 18:55Z |
| C′ | Was the 404 there before 013? | **Yes, pre-existing.** `entity_isin_map` has 0 rows for all 62 ISINs, both now (q06) and in the pre-run export (`isin: 0`). 013 never writes that table (guard table, probe only) | q06; export manifest; runner allow-list |
| D | `/api/etf-overlap` on ETFs that hold them | **Not run live (Founder: cheap checks only).** The route reads only `etf_master`, `fund_holdings_monthly` and `fund_snapshot_monthly`. None can be written, or even read, by the 013 runner. | `index.js` L470–574 (unchanged since `721d093`); §3 |
| E | `/api/etf-exposure` on those holdings | **Not run live (same reason).** The route reads only `fund_holdings_monthly`, `etf_master` and `etf_aliases`, and never an Entities table. | `index.js` L702+; §3 |
| F | ETF API response shapes unchanged | **PASS.** `meridian-proxy` last deployed 2026-10-26T19:46Z (version `9253b611…`). `meridian-entities-api` last deployed 2026-10-30T16:03Z (version `4e7ee20b…`). Both are before the run, and 013 deploys nothing. | `wrangler deployments list` |

## 3. Why D/E are unaffected without a live call

- **Runner allow-list (ETF MF-2), enforced per statement at execute.** Runner `merge-013.mjs` sha256 `9ee97999…8499` is the CHECK2-passed `190ea2f`.
  - `WRITE_TABLES` = `entity_merge_redirect`, `entity_master`, `entity_enrichment_queue`, `instrument_entity_map`.
  - Any table outside the write, guard and read-extra sets is refused (`checkStatement`, `merge-013-core.mjs` L101–113). `etf_master`, `fund_holdings_monthly`, `fund_snapshot_monthly` and `etf_aliases` are in none of them, so the runner could not even read them.
  - Test T-8 covers this ("a statement on an ETF table is refused").
- **Run ledger.** `d1-ledger.jsonl` has 416 calls with 11,324 writes, and every write sits in the `merge-B*` (11,298), `lei-` (24) and `migrate` (2) labels. The RUN report's other 5 setup writes (pause row 3, migration 2) include the pause row from the Founder-authorised Ops script, which is outside the runner's ledger.
- **So:** ETF overlap and exposure inputs were not touched. Their numbers can only differ from before 013 through the normal holdings pipeline, not through 013.

## 4. MF-1 / MF-2 (my review's must-fix items) — confirmed in the run

- **MF-1:** the `mqp`, `ies`, `ips` and `facts` (by cik) probes ran per batch. The R8 verify shows all of them at 0 (RUN report).
- **MF-2:**
  - The allow-list is enforced (§3).
  - `fund_entity_link` is stop-and-refer: the `fel` probe ran 39 times, and `plan.refer.etf_pl_fund_entity_link` = `[]`. **Nothing was referred to ETF-PL.**
  - R8 `fel` = 0.

## 5. Notes (the "WITH NOTE")

1. **No pre-run baseline exists.** Spec §10 and my N-6 assumed a Sun 1 ETF baseline. The run was brought forward to Fri 6 (ML-1106-1), and no lane captured one. Byte-for-byte comparison is therefore impossible, and the checks above prove "unchanged by 013" structurally instead.
2. **Read-cap overrun, then a Founder ruling.** My first two wrangler reads cost 1,328 against the Task's 1,000 cap. The ISIN count on the partial index `idx_fhm_isin` cost 1,164, against my estimate of about 1,000. I stopped and asked. **The Founder chose "cheap checks only", with the cap raised to about 10k.** Final total: **1,701 reads** (q01 164, q02 1,164, q03 186, q04 0, q05 124, q06 62, q07 1) + 3 API calls. 0 writes.
3. **I mis-estimated the overlap cost when I asked.** I had told the Founder that overlap ×1–2 was cheap. Its plan (q04 `EXPLAIN`) is a nested loop over `idx_holdings_series_month`, so reads ≈ |A| + |A|×|B|. Even the smallest holder pair (MCHI with about 600 holdings × EEMV with about 350) is about 200k reads per call. So overlap was left out under the same ruling.
4. **ETF-domain finding (not 013):**
   - `/api/etf-overlap` costs about |A|×|B| D1 reads per call. Large pairs (IEMG × SCHE) are estimated in the millions, against the 5M/day account cap.
   - `/api/etf-exposure?stock=` uses an unindexed `UPPER(security_name) LIKE '%…%'`, so it scans `fund_holdings_monthly` on every call.
   - Both are estimates from the query plan, not measurements. They go to ETF-PL as a November read-budget item.
5. **ETF UX gap (pre-existing, not 013):** the holdings entity icon resolves through `entity_isin_map` only. All 62 repointed ISINs have no row there, so the icon is grey, even though `instrument_entity_map` and 007 R1 now resolve them to survivors. This is a November candidate: point the icon at R1 / `instrument_entity_map`.
6. Count wording: the close-out should say **62** instruments repointed, not the spec rev 0's 74.

## 6. Evidence files (local, not committed)

Scratchpad `/private/tmp/claude-501/-Users-navinkumar--claude-spares-spare-En7Z7f/f2c643a2-a396-4a6b-8add-9bbec2bce443/scratchpad/etfchk/`: `ledger.jsonl` (per-query reads/writes), `out/q01–q07.json`, `repoint_map.json`, `api/isin-*.json`. The run artefacts were read in place under `~/MeridianAtlas-work/merge-013/` and not modified.
