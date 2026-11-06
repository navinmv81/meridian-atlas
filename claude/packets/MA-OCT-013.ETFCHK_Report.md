# MA-OCT-013.ETFCHK — Report (ETF Product Lead, ETF-PL)

**Control v1** `df394bc0f0c42d5e9a9f2582a66e7639b05084e7f55eda26ed992c9615b60578` matches the file on disk and `STATUS_BOARD.md` line 114. **Task v1** `2d89aac2f09b8052171c8bcf6bb184f8c9488763e7821736ec71f7aeeb41b4f4` matches the Control.

- **Governing inputs:** RUN report `0152c923…4ccb` ✓; ETF review `381ccb99…6e84` ✓.
- **Repo:** branch `October-2026`, no `.git/*.lock`.
- **Wrangler:** `/usr/local/bin/wrangler` 4.96.0; `whoami` OK, account `ea360704…`.

## VERDICT: **SIGNED WITH NOTE**

**Output:** `claude/MA-OCT-013_ETF_PostRun_Check.md`, sha256 `a5d16cf29cdf4509950742ceb76003ca620135bfb83c1c52c7e712d1a3aced74` (73 lines).

- **No ETF number changed through 013.** The runner's per-statement allow-list (`190ea2f`, sha `9ee97999…8499`, test T-8) cannot read or write any ETF table. Every one of the run's 11,324 ledger writes is in the `merge-B*`, `lei-` and `migrate` labels.
- **The repointed instruments resolve to survivors:** **62/62** live `instrument_entity_map` rows sit at the plan's survivor, with 0 differences in any other column against the pre-images. The 63rd export row (`TW0004772009`) is held `i1_unsigned` and unchanged.
- **Entity icon on 3 ISINs** (Longfor `KYG5635P1090`, China Resources Micro `CNE100003S06`, China Feihe `KYG2121Q1055`; held by IEMG, MCHI, EEMV, VNQI and others): all three return **404, the same as before 013**. `entity_isin_map` has 0 rows for all 62 ISINs, both before (export) and now, and 013 never writes that table.
- **ETF API shapes unchanged.** `meridian-proxy` was last deployed 26 Oct and `meridian-entities-api` 30 Oct, both before the run.
- **No rows to restore.** Nothing goes to the Data-Identity Lead.

## Notes (why "WITH NOTE")

1. **N-6 not run as written, by Founder ruling in this session.**
   - Read-cap overrun: 1,328 reads against the 1,000 cap after two queries. I stopped and asked.
   - Founder: **"Cheap checks only"**, with the cap raised to about 10k.
   - The live `/api/etf-overlap` and `/api/etf-exposure` calls were replaced by code and allow-list evidence. Overlap's plan is a nested loop costing about |A|×|B| reads, about 200k even for the smallest pair. When I asked, I had said overlap was cheap; that was wrong. Exposure is an unindexed `LIKE` scan.
   - **Totals: 1,701 D1 reads + 3 API calls; 0 writes.**
2. **No pre-run ETF baseline was ever captured** (the run was brought forward, ML-1106-1). So "byte-identical except timestamps" cannot be shown by anyone; §3 of the check proves it structurally instead.
3. **November ETF items (not 013):**
   - **(a)** `/api/etf-overlap` and `/api/etf-exposure?stock=` read-cost risk, estimated from the query plan;
   - **(b)** the holdings entity icon uses only `entity_isin_map`, so it stays grey for instruments that `instrument_entity_map` / 007 R1 already resolve.
4. Close-out wording: **62** instruments repointed, not 74.

## Hygiene
- Read-only throughout: 0 D1 writes, no deploys, no git staging or commits.
- No secret file read.
- Run artefacts under `~/MeridianAtlas-work/merge-013/` were read and not modified. My query ledger and outputs are in `/private/tmp/claude-501/-Users-navinkumar--claude-spares-spare-En7Z7f/f2c643a2-a396-4a6b-8add-9bbec2bce443/scratchpad/etfchk/`.
- `MA-OCT-013.ETFCHK_Status.json` was left for the Main Lane (outside this Control's write ownership).
