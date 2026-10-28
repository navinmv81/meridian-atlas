# MA-OCT-008.BUILD — Report

**Lane:** LANE-8-ENG (Engineering Lead, 008 build lane; new Claude Code session) · **Control** v1 `ccf533c0ab5c20235aefa3aaedc8c58d5b2deff076c7290f3284d51fd452a48d` · **Task** v1 `1bdc15366aa61ff0f1dbbc9c7d5f21855963d9b65da2bc7e94e7e9738e2ec3e8` · **Spec** rev 1.2 `bcdad9a2d315371b9c60b11cbcf72dfca88c99dca22fbe4e5310e2fb5f815cd3`

Executors never review their own work: everything below is input for the Data-Identity Lead (AC17, B-rulings, Q2 list), the Architect and the Operations Lead.

---

## Wed 14 Oct 2026 — day 1 (§15.3 steps 1–2: parser, runner, control scripts, fixtures, tests, dry run)

### 0. Start checks
- Control file re-hashed = board row `ccf533c0…2d48d` ✔; Task file re-hashed = `1bdc1536…e3e8` ✔; spec re-hashed = `bcdad9a2…815cd3` ✔.
- `pwd` = LOCAL_MASTER, branch `October-2026`, HEAD `3960aee` (= Control's HEAD at issue). No `.git/*.lock`. Git read only with `--no-optional-locks`. **No git writes.**
- `claude/relays/FREEZES.json` SHA-256 `cdc9606a881d7b24c92a2d675efd3b4f4d6df8205073fa299209b068d16ac346` (= the spec's cited hash).
- Wrangler pin: `App/Corporate Atlas/node_modules/.bin/wrangler --version` = 4.96.0 and `/usr/local/bin/wrangler --version` = 4.96.0. No other wrangler call was made today. Never `npx`.
- Start Approval: taken from the Founder's chat instruction to this session ("execute today's work", 14 Oct ≈ 05:48 UTC). `MA-OCT-008.BUILD_Status.json` is Main Lane-owned and was **not** edited (still `READY`); please move it to `EXECUTING`.
- No command that could raise a macOS password, permission or TCC prompt was run (ML-1013-3). Secrets: none read or printed; `~/.meridian-secrets/` was listed (names and modes only).

### 1. What was built (all under `App/Corporate Atlas/bonds/` + the migration file; CR1)

| File | What it is |
|---|---|
| `bonds-parse.mjs` | Pure parser (no I/O): R1 visible text, R2 preliminary test (424B only), A8-3 title gate with precedence other → structured → non-debt → debt, tranche parse for three layouts (cover lines; MTN key:value term sheets; retail-note CUSIP tables), full-maturity resolution, coupon / spread / benchmark, seniority, currency, CUSIP/ISIN with check digits, FWP term-sheet reader (columnar and single layouts) for identifiers and the §14.1 cross-check, §14.1 confidence, A8-4 per-tranche `parse_failed`. |
| `bonds-discover.mjs` | §7.1 discovery over `submissions` (+ `files[]` pages when `recent` does not reach the lookback; L8-1 cap for Wells). |
| `bonds-lib.mjs` | SEC client (User-Agent from `SEC_USER_AGENT`, ≥ 200 ms between request starts, 1,500 cap per run, 403/429 → stop `SEC_RATE`, request ledger, gzip document cache); FREEZES.json + Tue–Fri gate (fail closed); headroom gate (F-1/F-2/F-3, 120 s freshness, ML-1012-1 values from config); wrangler pin check + D1 transport (`--file` batches with literal SQL, `--command` reads); heartbeat key loader (mode 600, emitter must be `local-bonds`). |
| `bonds-ingest.mjs` | Runner. `--mode=initial|incremental [--dry-run] [--cik=…]`. Gates in §9.3 order; batched `INSERT OR IGNORE`, ≤ 100 statements, a filing never split; 10000 → one retry after 5 s then `failed`/`CF_API_10000`; cursor = last committed accession; `last_polled_at` per polled issuer; 001 heartbeats through `lib/ops-outbox.mjs` (imported, not edited) with the fixed `detail.metrics` key set. Dry run: 0 D1 calls, 0 heartbeats (an event costs ≈ 5 D1 writes). |
| `bonds-config.json` | 30 seed CIKs (Q1 list), lookback 2024-01-01, Wells cap 60 × 424B2, SEC limits, run cap 8,000, declared initial 6,000, **`account_ceiling` 60,000 and `unpolled_window_min` 45 with `lag_source` = Decisions Log 12 Oct ML-1012-1** (Task: ML-1012-1 replaces §9.3 A-1). |
| `bonds-stop.sh`, `bonds-pause.sh`, `bonds-resume.sh`, `bonds-status.sh` | Control surface. Stop writes `state/STOP` + SIGTERMs the runner; resume clears STOP only with `--clear-stop`; status is read-only (no D1, no network, never prints the key). All four exercised today (flags set and cleared; no runner running). |
| `fixtures/` (20 documents + `manifest.json`) | §15.3 step 1 set: the six 4 Oct documents (Duke prelim / FWP / Equity Units final; UNH prelim / FWP / final), the ICE 11/13 Aug 2026 pair, Caterpillar, Deere and Toyota MTN pricing supplements, one Wells structured 424B2, one Verizon 424B3 exchange offer, one Southern junior subordinated deal; plus GM preliminary / placeholder / final retail supplements (B-1, B-1b), an Amex SOFR FRN deal (AC16), an AT&T euro FRN (cp1252 €) and an Oracle 8-tranche deal. gzip; manifest carries accession, URL and SHA-256 of each HTML. |
| `tests/bonds-parse.test.mjs`, `tests/bonds-ingest.test.mjs` | 32 tests (below). Fakes for SEC and D1; 0 network, 0 D1. |
| `.gitignore` (in `bonds/`) | `state/`. **Deviation from CR1's wording:** CR1 adds the line to the root `.gitignore`; the Task limits this lane to `bonds/**` + the migration, so the rule sits in `bonds/.gitignore` instead (same effect). |
| `App/Corporate Atlas/migrations/008-bonds.sql` | The §8 DDL verbatim. **Written, not applied** (that is Thu step 3). |

`bonds-lib.mjs` and `bonds-discover.mjs` are not in §9.2's file list; they are support modules inside `bonds/` (no new folder). `state/` (gitignored) holds the run log, SEC ledger, document cache (≈ 243 MB fetched, stored gzip), dry-run outputs and sample.

### 2. Tests — 32 / 32 pass (`node --test "App/Corporate Atlas/bonds/tests/"*.test.mjs`)
- **AC1** ICE 11 Aug 2026, Duke 10 Aug 2026, UNH 17 Jun 2025 prelims → `preliminary`, one `tranche_seq = 0` row, 0 tranches ✔
- **AC2** Duke FWP 11 Aug (visible text says "Preliminary Prospectus") → never preliminary, no row ✔
- **AC3** Duke 12 Aug 2026 Equity Units → `skipped_non_debt` ✔
- **AC4** UNH 18 Jun 2025 → 4 tranches incl. $500,000,000 4.400% due 2028-06-15, all full maturities, confidence ≥ 80; with the same-deal FWP: all 4 CUSIP/ISIN filled, cross-check agrees, confidence ≥ 95 ✔
- **AC5** Wells market-linked 424B2 → `skipped_structured` ✔
- **AC16** Amex 22 Jul 2025 SOFR floater stays `final`, `floating`, `SOFR`, spread parsed; title rule: "linked to Compounded SOFR" = plain FRN, "linked to the S&P 500 Index" / "Common Stock of Amazon" = structured (structured before non-debt, L8-11) ✔
- **AC18** synthetic two-tranche filing: year-only tranche → `parse_failed`, own `tranche_seq`, NULL `instrument_key`, fields kept; the other tranche `final` ✔ (the `DELETE … WHERE parser_version` + incremental half needs D1 → pilot/live)
- **AC6** (fake D1) re-run writes 0 rows ✔ · **AC7** stop flag mid-run → in-flight batch completes, 1 batch only, `killed` with cursor ✔ · **AC8** d1-today unavailable / > 120 s / other UTC day / F-2 drop → `partial` `headroom_unavailable`; F-3 23:50–00:10 refused ✔ · **AC9** FREEZES.json windows (live file) incl. boost bands, bootstrap buffer, ENT-CR1 fallback, Sun/Mon, 011 window 17–23 Oct; Tue 27 allowed ✔ · **AC14** hold `'true'` → `skipped`/`hold`; hold unreadable or missing → `hold`, `detail.hold = "unavailable"`; pause → `pause`; FREEZES missing/unparseable → `out_of_window`, `freezes_unavailable` ✔ · **AC15** config without `account_ceiling` → live run refused, dry run unaffected ✔
- MTN term sheets (Cat, Deere floating with ISIN key, Toyota callable), Southern junior sub, GM B-1/B-1b, AT&T EUR, Oracle 8/8 maturities, check digits, literal SQL quoting, batch packing, same-deal FWP window ✔

### 3. Dry run (§15.3 step 2) — run `5edc6131-1181-4c67-9ebb-c96e177cb16f`, 06:16:30–06:17:14 UTC
`node bonds-ingest.mjs --mode=initial --dry-run --operator=LANE-8-ENG`. **0 D1 calls, 0 D1 writes, 0 heartbeats.** The run started inside the entities-enrich window 05:50–07:10, which a dry run ignores and logs (`would_apply: ["entities-enrich 05:50–07:10 UTC"]`, FREEZES `cdc9606a…c346`).

**Counts by `filing_status` (rows that would be written):**

| final | preliminary | skipped_non_debt | skipped_structured | skipped_other | parse_failed | **total rows** | filings examined |
|---|---|---|---|---|---|---|---|
| 628 | 187 | 44 | 22 | 7 | 55 (46 whole-filing + 9 tranche) | **943** | 632 |

- `parse_failed` breakdown: 33 demand-note rate notices (Cat PowerInvestment, Toyota IncomeDriver, GM Right Notes, Duke PremierNotes, Dominion Reliability Investment), 6 merger / information statements (Capital One–Discover, Boeing–Spirit, UNP–Norfolk Southern, NextEra, Amazon, Dominion 424B3), 3 MTN programme supplements / other headers, 4 FWP cross-check disagreements (§14.1 forced ≤ 59), 5 tranches whose year-only maturity could not be resolved to a single date (GM ×2, Duke, CVS, Union Pacific).
- Finals by confidence: 100 → 44 · 95 → 228 · 90 → 51 · 85 → 288 · **75 → 2 · 70 → 15** (17 rows would carry `check_source: true`). Identifier on 272 / 628 finals (43 %); currencies USD 556, EUR 50, CAD 12, GBP 10.
- **Estimated writes 2,786** (§8.2 cost model: 4 per keyed final, 3 per unkeyed final, 2 per audit / tranche `parse_failed`) in **10 batches**, vs the spec's ≈ 3.8k estimate and the declared 6,000. Real multipliers come from the pilot (N-1).
- Outputs (gitignored): `state/dryrun-2026-10-14.sql` `13076e561ba4a14ca6ebbd0bb2cc79e52a023382a4cbcd6f023596ac7334c764` (943 literal `INSERT OR IGNORE`, batch headers); `state/dryrun-2026-10-14.json` `f60487104b5d1316d0387f79ef50aa5cda78642a7f3e3b4b812b3576e6876602` (every filing: status, rule, title, notes, FWPs used, cover-issuer hint, rows).
- **Local SQLite check (not D1):** `008-bonds.sql` applied to an in-memory DB; all 943 statements satisfy the CHECKs; a second load changes 0 rows (idempotent); 0 final rows with NULL maturity. Local EXPLAIN: P-B1 `SEARCH bond_issuance USING INDEX idx_bi_cik_final_key (cik=? AND (maturity_date,accession_number,tranche_seq)>(?,?,?))` with no temp B-tree; P-B2 `SEARCH bond_issuer_link USING INDEX idx_bil_entity (entity_id=?)`; P-B3 `SEARCH … USING COVERING INDEX sqlite_autoindex_bond_issuance_1 (accession_number=?)`; R1f `idx_bi_instrument`. The binding P-B checks are on D1 after Thursday's migration (AC10).

### 4. SEC requests — 848 today, all HTTP 200 (cap 1,500)
| Purpose | Requests |
|---|---|
| `submissions` for the 30 CIKs (first look) | 30 |
| Discovery into the cache: 632 424B primary documents + Meta `files[]` page 1 (`submissions` re-used from the first look) | 633 |
| The two 4 Oct FWPs for fixtures (Duke, UNH) | 2 |
| Dry run: fresh `submissions` (30) + Meta `files[]` page (1) + same-deal FWPs for tranches without an identifier (152); 424B documents served from today's cache | 183 |
| **Total** | **848** (data.sec.gov 62, www.sec.gov 786; ≈ 243 MB) |

User-Agent `Meridian Atlas navinmv1981@gmail.com` (§9.2). Requests are sequential and the client sleeps until 200 ms after the previous start. The ledger logged completion time + duration only; start gaps reconstructed from it bottom out at 198–199 ms on 15 requests, which is millisecond rounding in that reconstruction, not a breach (≤ 5/s held). The ledger now also records `started` per request, so future runs prove the spacing directly.

### 5. D1 reads / writes
**0 / 0.** No D1 statement of any kind today (the dry run makes none; the accession probe is skipped because `bond_issuance` does not exist until Thursday).

### 6. Build-lane interpretations needing a ruling (Data-Identity Lead; Architect for B-3/B-4) — each is in code, named, and tested
| # | Finding (evidence) | What the build does | Effect on the dry run |
|---|---|---|---|
| **B-1** | GM Financial Term Notes and Verizon InterNotes "Preliminary Pricing Supplement No. …" 424B2s carry **neither** R2 marker in the first 2,000 chars, yet carry CUSIP, coupon and maturity with principal `[ ]` (e.g. GM `0000804269-25-000030`, Verizon `0001193125-24-223675`). Under R2 alone they parse to confidence 80 and **would be served** (D12 breach). | 424B only: heading `Preliminary Pricing Supplement No./dated` in the first 2,000 visible chars → `preliminary`. | 22 filings preliminary instead of final |
| **B-1b** | GM `0000804269-25-000017` (3 Mar 2025) is headed "Pricing Supplement No. 5" but its amount cells are `[]`; the priced No. 5 followed on 10 Mar. | A retail-note table whose amount cells are `[ ]` placeholders → `preliminary`. | 1 filing |
| **B-2** | Exchange offers are mostly titled "Offer(s) to Exchange" (ICE, Verizon ×2, Comcast, Realty Income); the literal `exchange offer` rule only catches Boeing. | `offers? to exchange` counts as the exchange-offer rule → `skipped_other`. | 5 filings |
| **B-3** | NextEra titles "Debentures, Series due 2031" and Toyota "Medium-Term Notes, Series B due …" fail `\b(Notes?|Debentures?|Bonds?)\s+due\b`; GM/Verizon retail supplements have a CUSIP table, no "due" title. | Debt rule also accepts ", Series [X]" before "due", and a retail CUSIP table under a pricing-supplement header. | ≈ 80 filings parse instead of `parse_failed` |
| **B-4** | §7.4's currency list has no CAD; C$ tranches (Amazon, NextEra, Welltower, AT&T) would be stored as USD. AT&T writes € as `&#128;` (cp1252). | Adds CAD (`C$`, `CAD`), AUD (`A$`); maps cp1252 code points 128–159. | 12 CAD rows; AT&T euro rows EUR |

Also requested: **demand notes** (33 rate-reset notices, "Variable Denomination Floating Rate Demand Notes") currently fall to `parse_failed` per §7.3 ("no title found"). Recommend adding them to `skipped_other` so coverage counts read correctly — not done without a ruling.

### 7. AC17 — every `skipped_*` row for the 29 non-Wells issuers (51 rows; Data-Identity Lead to sign each before the first live batch)
All 22 `skipped_structured` rows are Wells Fargo (outside AC17). My own pass found no false skip (equity, depositary shares, equity units, DRIP/ATM and resale prospectuses; exchange offers), but that is not the sign-off. Table at the end of this section (§ Appendix D1-A).

### 8. Unlinked-issuer list (Founder Q2) and identity findings
- **Linkage is not run yet** (Pack C + the `bond_issuer_link` seed are Thursday step 4). As of today: linked by Pack B (7 Oct) = **3** (ICE 348, Apple 1662, Meta 355). **Pending Pack C = 27**: Wells Fargo, Capital One, American Express, Caterpillar Financial, John Deere Capital, Toyota Motor Credit, GM Financial, Amazon, Oracle, AT&T, Verizon, Comcast, Pfizer, AbbVie, UnitedHealth, CVS, Boeing, Home Depot, PepsiCo, Union Pacific, Lowe's, Duke, Southern, NextEra, Dominion, Realty Income, Welltower. The final unlinked list (each a 004 `missing_entity` DQ ticket) will be in Thursday's section.
- **L8-4 question — co-registrant subsidiary issuers filed under the parent's CIK.** The cover names a different legal issuer, guaranteed by the parent: **NextEra Energy Capital Holdings, Inc.** (32 finals under NextEra Energy CIK 753308), **Welltower OP LLC** (6 under Welltower 766704), **Pfizer Netherlands International Finance B.V.** (4 under Pfizer 78003). Linking these rows to the parent entity would be a wrong-issuer link by L8-4's own reasoning. The build only records `cover_issuer_hint` in the dry-run JSON; it changes no row. Needs a Data-Identity Lead ruling before the load (options: per-filing CIK of the co-registrant; keep under parent with a note; exclude).

### 9. Other findings (recorded, no action taken)
1. **Meta's `recent` window starts 2024-06-18**, so it needs `files[]` paging (§7.1 assumed none of the 30 did). Discovery pages `files[]` whenever `recent` doesn't reach the lookback (1 extra request).
2. **Same instrument on several accessions:** 19 instrument keys recur (Toyota amended pricing supplements, Caterpillar reopenings, e.g. `CUSIP:14913V2E7` on `…26-093473` and `…26-095146`). The PK is per accession, so both rows load; 009's issuer→bonds list would show the bond twice. Question for 009 / Data-Identity Lead: group by `instrument_key`, or 008 marks the later filing (e.g. amendment / reopening flag)?
3. **FWP disagreements forced to `parse_failed` (4):** AT&T `0001193125-26-344905` (maturity 2028-08-17 vs FWP 2028-08-10 — likely a 424B misread), Verizon `0001193125-25-064062` (principal 2.25bn vs FWP 1.6875bn), Dominion `0001193125-25-173213` and `0001193125-26-263513` Series B (FWP section of Series A matched, because neither coupon parsed — likely false conflicts). Conservative by design (§14.1).
4. **Identifier coverage 43 %** of finals: large public deals rarely print CUSIPs in the 424B and only some same-deal FWPs match. Bond → issuer navigation (goal 4) covers only keyed rows.
5. Boeing yields 0 finals (its 2024 notes came via 144A + exchange offer; the rest is equity/merger) — correct, but the issuer will show no bonds.
6. Spec §5 count for Toyota (97) vs discovery 98; Wells 495 → capped 60 (37 prelim, 22 structured, 1 plain callable note final).

### 10. Thursday readiness (not started; nothing live today)
Blocked until **both**: (a) **MA-OCT-T12** reports registry row `local.bonds-ingest` + emitter `local-bonds` live (the runner reads the key from `~/.meridian-secrets/bonds-ops-ingest.env`, mode 600, emitter must equal `local-bonds` — **T12 please confirm the file name**, or tell me the path); (b) **Data-Identity Lead signs AC17** (51 rows) and rules on **B-1..B-4** (B-1/B-1b at minimum, since they protect D12). Then: migration in a non-freeze window → P-B1..P-B3 on D1 → Pack C (EXPLAIN first; stop on any `SCAN entity_master`) → link seed → pilot ICE / UnitedHealth / Toyota Motor Credit with multipliers and the N8-2 `rows_written` check. Thu budget ≤ ≈ 500 writes.

### 11. File list (SHA-256, at report time)
| File | SHA-256 |
|---|---|
| `App/Corporate Atlas/bonds/bonds-parse.mjs` | `228bd59aae32bd343a5611196b4e4d2e8d4d31ac9ad3eb678a018303c2b85813` |
| `App/Corporate Atlas/bonds/bonds-ingest.mjs` | `666a81e412f722bc53dac93ef678b6fb530dbfa1dd4de96b0406c8af47ad6256` |
| `App/Corporate Atlas/bonds/bonds-lib.mjs` | `34775d08a371f3dbbbd9aa0500211a407a8d545b2398ab111c29bbd4e3153708` |
| `App/Corporate Atlas/bonds/bonds-discover.mjs` | `baf6a26062938038efd24ce8f548dbfe4bd60916a3f63d7fc19c8fa946b154a4` |
| `App/Corporate Atlas/bonds/bonds-config.json` | `3e6667c8fdb3342cb3c4eed018eaedef823ac7489b9abe51d6e2ac61f8b36a9d` |
| `App/Corporate Atlas/bonds/bonds-stop.sh` | `2c2635a0c969bc499b2733d2e0ed643e42a905f0862da80277106f44063482d6` |
| `App/Corporate Atlas/bonds/bonds-pause.sh` | `71988da6d62c9ca8f25a9f5b83ee6ab994795b347579b6f67366819910f31ab3` |
| `App/Corporate Atlas/bonds/bonds-resume.sh` | `661b7cced584fe10ef0ee74d374a983a5572cdcfd743165614f706271cc994cf` |
| `App/Corporate Atlas/bonds/bonds-status.sh` | `491d7135c672ab9ed75395a115ac2038cb2283371e6db6c2a3b3d1f7e717cc11` |
| `App/Corporate Atlas/bonds/.gitignore` | `cb43153f43809f7f111e06347a5b3e22ef05e3a25e15076cfa1df6be570914f6` |
| `App/Corporate Atlas/bonds/tests/bonds-parse.test.mjs` | `95ce332e0d6867bcd7412d5ec559b305a22eb87bf8e8950f2767037056aa726f` |
| `App/Corporate Atlas/bonds/tests/bonds-ingest.test.mjs` | `ceb6aad400bae9a463462334e5ce02dd80f050569de4f2f281379cf8b737fb3b` |
| `App/Corporate Atlas/bonds/fixtures/manifest.json` (+ 20 `.htm.gz`, hashes in the manifest) | `9848508d53bfddbbff9a046f596b3a767574ed4965f7566ebf3613647104645c` |
| `App/Corporate Atlas/migrations/008-bonds.sql` (not applied) | `ee26e3099c0e65c80a4727278acae87d17bdc24ce615f85ad64ee8c668259b40` |

Note: `bonds-lib.mjs` changed once after the dry run (ledger `started` field only); the dry run ran with the earlier version. The parser and runner are byte-identical to the dry-run versions.

**Commit list for the Main Lane (ML-1012-2; LANE-1-ENG commits):** `App/Corporate Atlas/bonds/` (everything except `state/`, which `bonds/.gitignore` excludes) and `App/Corporate Atlas/migrations/008-bonds.sql`. Suggest committing after Thursday so the list carries the pilot fixes.

### 12. Questions
1. **Data-Identity Lead:** rule on B-1, B-1b, B-2, B-3, B-4 and the demand-note proposal; sign AC17 (51 rows); rule on the co-registrant issuers (§8).
2. **009 / Data-Identity Lead:** duplicate instruments across amendments / reopenings (§9.2).
3. **T12 / Operations Lead:** the ingest key file path and name for `local-bonds`.
4. **Main Lane:** move the Status file to `EXECUTING`; confirm the `bonds/.gitignore` placement (CR1 wording said root `.gitignore`).

### Appendix D1-A — AC17 sign-off list (29 non-Wells issuers; 51 rows; full JSON record in `state/dryrun-2026-10-14.json`)
| Issuer | Accession | Form | Filed | Status | Title (first 90 chars after the supplement header) | DIL sign |
|---|---|---|---|---|---|---|
| Intercontinental Exchange, Inc. | 0001193125-24-197925 | 424B3 | 2024-08-09 | skipped_other | Offer to Exchange Any and All of Its Outstanding 3.625% Senior Notes due 2028 for Notes of | |
| Capital One Financial | 0001193125-24-064921 | 424B5 | 2024-03-11 | skipped_non_debt | is accurate or complete. Any representation to the contrary is a criminal offense. The dat | |
| Capital One Financial | 0001193125-26-171719 | 424B7 | 2026-04-23 | skipped_other | (To prospectus dated March 11, 2024) Capital One Financial Corporation 10,345,906 Shares C | |
| Capital One Financial | 0001193125-26-263726 | 424B7 | 2026-06-09 | skipped_non_debt | NO. 2 (To prospectus dated March 11, 2024 and prospectus supplement dated April 23, 2026)  | |
| American Express | 0001104659-26-092092 | 424B2 | 2026-08-06 | skipped_non_debt | (To Prospectus Dated February 9, 2024) American Express Company 1,600,000 Depositary Share | |
| Oracle | 0001193125-26-032756 | 424B5 | 2026-02-02 | skipped_non_debt | (To Prospectus dated February 2, 2026) Up to $20,000,000,000 of Common Stock  | |
| Oracle | 0001193125-26-035662 | 424B5 | 2026-02-03 | skipped_non_debt | (To Prospectus dated February 2, 2026) Up to $20,000,000,000 of Common Stock  | |
| Oracle | 0001193125-26-037818 | 424B5 | 2026-02-04 | skipped_non_debt | (To Prospectus dated February 2, 2026) 100,000,000 Depositary Shares Each Representing a 1 | |
| Oracle | 0001193125-26-278585 | 424B5 | 2026-06-23 | skipped_non_debt | (To Prospectus dated February 2, 2026) Up to $20,000,000,000 of Common Stock  | |
| Verizon Communications | 0001193125-25-075323 | 424B3 | 2025-04-08 | skipped_other | Verizon Communications Inc. Offer to Exchange $2,191,082,000 aggregate principal amount of | |
| Verizon Communications | 0001193125-25-292398 | 424B3 | 2025-11-24 | skipped_other | Verizon Communications Inc. Offer to Exchange $2,161,606,000 aggregate principal amount of | |
| Comcast | 0001193125-26-340289 | 424B3 | 2026-08-07 | skipped_other | Offer to Exchange Up to $1,172,013,000 aggregate principal amount of new 5.168% Notes due  | |
| Boeing | 0001193125-24-246629 | 424B5 | 2024-10-29 | skipped_non_debt | (To Prospectus dated October 22, 2024) 112,500,000 Shares The Boeing Company Common Stock  | |
| Boeing | 0001193125-24-246634 | 424B5 | 2024-10-29 | skipped_non_debt | (To Prospectus dated October 22, 2024) 100,000,000 Depositary Shares Each Representing a 1 | |
| Boeing | 0001193125-24-260962 | 424B3 | 2024-11-18 | skipped_other | Exchange Offer for Up to $1,000,000,000 6.259% Senior Notes due 2027 Up to $1,500,000,000  | |
| Duke Energy Corp | 0001104659-26-024721 | 424B5 | 2026-03-06 | skipped_non_debt | (To Prospectus dated September 23, 2025) Up to $6,000,000,000 Common Stock  | |
| Duke Energy Corp | 0001104659-26-094253 | 424B5 | 2026-08-12 | skipped_non_debt | (To Prospectus dated September 23, 2025) 35,000,000 Equity Units (Initially Consisting of  | |
| Southern Co | 0000092122-24-000053 | 424B2 | 2024-05-03 | skipped_non_debt | (to Prospectus dated February 16, 2024) 50,000,000 Shares Common Stock ___________________ | |
| Southern Co | 0000092122-25-000092 | 424B2 | 2025-11-04 | skipped_non_debt | (To Prospectus Dated February 16, 2024) 35,000,000 2025 Series A Equity Units (Initially C | |
| Southern Co | 0000092122-26-000048 | 424B2 | 2026-06-08 | skipped_non_debt | (to Prospectus dated June 5, 2026) 50,000,000 Shares Common Stock ________________________ | |
| NextEra Energy | 0001193125-24-163714 | 424B2 | 2024-06-20 | skipped_non_debt | (To prospectus dated March 22, 2024) NextEra Energy, Inc. 40,000,000 Equity Units (Initial | |
| NextEra Energy | 0001193125-24-246576 | 424B2 | 2024-10-29 | skipped_non_debt | (To prospectus dated March 22, 2024) NextEra Energy, Inc. 30,000,000 Equity Units (Initial | |
| NextEra Energy | 0001193125-25-338333 | 424B5 | 2025-12-31 | skipped_non_debt | (To prospectus dated March 22, 2024) NextEra Energy, Inc. Up to $4,000,000,000 Common Stoc | |
| NextEra Energy | 0001193125-26-083556 | 424B2 | 2026-03-02 | skipped_non_debt | (To prospectus dated March 22, 2024) NextEra Energy, Inc. 40,000,000 Equity Units (Initial | |
| Dominion Energy | 0001193125-24-130830 | 424B5 | 2024-05-03 | skipped_non_debt | Dated February 21, 2023) Dominion Energy, Inc. $1,800,000,000 Common Stock  | |
| Dominion Energy | 0001193125-25-039297 | 424B5 | 2025-02-27 | skipped_non_debt | Dated February 21, 2023) Dominion Energy, Inc. $1,200,000,000 Common Stock  | |
| Dominion Energy | 0001193125-25-186445 | 424B3 | 2025-08-22 | skipped_non_debt | (To Prospectus Dated February 21, 2023) Explanatory Note: Dominion Energy, Inc. has appoin | |
| Dominion Energy | 0001193125-25-260905 | 424B5 | 2025-10-31 | skipped_non_debt | Dated October 31, 2025) Dominion Energy, Inc. $1,800,000,000 Common Stock  | |
| Realty Income | 0001104659-24-000822 | 424B3 | 2024-01-03 | skipped_other | 424B3 1 tm2333021-6_424b5.htm 424B3 tm2333021-6_424b5 - none - 13.6563045s TABLE OF CONTEN | |
| Realty Income | 0001104659-24-025001 | 424B7 | 2024-02-16 | skipped_non_debt | (To prospectus dated February 16, 2024) 1,738,767 Shares Common Stock  | |
| Realty Income | 0001104659-24-025009 | 424B5 | 2024-02-16 | skipped_non_debt | (to prospectus dated February 16, 2024) Dividend Reinvestment and Stock Purchase Plan 10,9 | |
| Realty Income | 0001104659-24-026707 | 424B5 | 2024-02-23 | skipped_non_debt | (To prospectus dated February 16, 2024) 120,000,000 Shares Common Stock  | |
| Realty Income | 0001104659-25-108170 | 424B5 | 2025-11-07 | skipped_non_debt | (To prospectus dated February 16, 2024) 150,000,000 Shares Common Stock  | |
| Realty Income | 0001104659-26-057437 | 424B5 | 2026-05-08 | skipped_non_debt | (To prospectus dated February 16, 2024) 150,000,000 Shares Common Stock  | |
| Welltower | 0001193125-24-037135 | 424B5 | 2024-02-15 | skipped_non_debt | (To prospectus dated April 1, 2022) $3,500,000,000 Common Stock We and Welltower OP LLC en | |
| Welltower | 0001193125-24-123725 | 424B5 | 2024-04-30 | skipped_non_debt | (To prospectus dated April 1, 2022) $3,500,000,000 Common Stock We and Welltower OP LLC en | |
| Welltower | 0001193125-24-234383 | 424B7 | 2024-10-08 | skipped_non_debt | (To prospectus dated April 1, 2022) Up to 23,471,419 Shares Common Stock Welltower OP LLC  | |
| Welltower | 0001193125-24-246204 | 424B5 | 2024-10-29 | skipped_non_debt | (To prospectus dated April 1, 2022) $5,000,000,000 Common Stock We and Welltower OP LLC en | |
| Welltower | 0001193125-25-066515 | 424B5 | 2025-03-28 | skipped_non_debt | (To prospectus dated March 28, 2025) $7,500,000,000 Common Stock We and Welltower OP LLC e | |
| Welltower | 0001193125-25-067208 | 424B7 | 2025-03-28 | skipped_non_debt | (To prospectus dated March 28, 2025) Up to 23,471,419 Shares Common Stock Welltower OP LLC | |
| Welltower | 0001193125-25-067214 | 424B5 | 2025-03-28 | skipped_non_debt | (To prospectus dated March 28, 2025) 390,590 Shares Common Stock  | |
| Welltower | 0001193125-25-067217 | 424B5 | 2025-03-28 | skipped_non_debt | (To prospectus dated March 28, 2025) 238,868 Shares Common Stock  | |
| Welltower | 0001193125-25-067221 | 424B7 | 2025-03-28 | skipped_non_debt | (To prospectus dated March 28, 2025) 1,563,904 Shares Common Stock  | |
| Welltower | 0001193125-25-167387 | 424B7 | 2025-07-29 | skipped_non_debt | (To prospectus dated March 28, 2025) 949,412 Shares Common Stock  | |
| Welltower | 0001193125-25-252583 | 424B5 | 2025-10-28 | skipped_non_debt | (To prospectus dated March 28, 2025) $7,500,000,000 Common Stock We and Welltower OP LLC e | |
| Welltower | 0001193125-25-252597 | 424B7 | 2025-10-28 | skipped_non_debt | (To prospectus dated March 28, 2025) 1,182,070 Shares Common Stock  | |
| Welltower | 0001193125-25-252621 | 424B5 | 2025-10-28 | skipped_non_debt | (To prospectus dated March 28, 2025) 4,542,926 Shares Common Stock  | |
| Welltower | 0001193125-26-188994 | 424B5 | 2026-04-29 | skipped_non_debt | (To prospectus dated March 28, 2025) 176,172 Shares Common Stock  | |
| Welltower | 0001193125-26-189032 | 424B7 | 2026-04-29 | skipped_non_debt | (To prospectus dated March 28, 2025) 138,740 Shares Common Stock  | |
| Welltower | 0001628280-26-050175 | 424B5 | 2026-07-28 | skipped_non_debt | (To prospectus dated March 28, 2025) $7,500,000,000 Common Stock We and Welltower OP LLC e | |
| Welltower | 0001628280-26-050180 | 424B7 | 2026-07-28 | skipped_non_debt | (To prospectus dated March 28, 2025) 261,753 Shares Common Stock  | |

### Appendix D1-B — per-issuer counts (rows that would be written)
| # | Issuer | CIK | filings | final | preliminary | skipped_non_debt | skipped_structured | skipped_other | parse_failed |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Intercontinental Exchange, Inc. | 0001571949 | 7 | 7 | 3 | 0 | 0 | 1 | 0 |
| 2 | Wells Fargo & Company | 0000072971 | 60 | 1 | 37 | 0 | 22 | 0 | 0 |
| 3 | Capital One Financial | 0000927628 | 16 | 11 | 6 | 2 | 0 | 1 | 1 |
| 4 | American Express | 0000004962 | 17 | 27 | 3 | 1 | 0 | 0 | 0 |
| 5 | Caterpillar Financial Services | 0000764764 | 43 | 37 | 0 | 0 | 0 | 0 | 6 |
| 6 | John Deere Capital Corp | 0000027673 | 35 | 35 | 0 | 0 | 0 | 0 | 0 |
| 7 | Toyota Motor Credit Corp | 0000834071 | 98 | 115 | 0 | 0 | 0 | 0 | 10 |
| 8 | General Motors Financial Co. | 0000804269 | 44 | 33 | 17 | 0 | 0 | 0 | 12 |
| 9 | Apple Inc. | 0000320193 | 2 | 4 | 1 | 0 | 0 | 0 | 0 |
| 10 | Amazon.com | 0001018724 | 13 | 42 | 6 | 0 | 0 | 0 | 1 |
| 11 | Meta Platforms | 0001326801 | 6 | 17 | 3 | 0 | 0 | 0 | 0 |
| 12 | Oracle | 0001341439 | 13 | 24 | 5 | 4 | 0 | 0 | 0 |
| 13 | AT&T | 0000732717 | 11 | 29 | 1 | 0 | 0 | 0 | 1 |
| 14 | Verizon Communications | 0000732712 | 58 | 52 | 28 | 0 | 0 | 2 | 1 |
| 15 | Comcast | 0001166691 | 5 | 9 | 1 | 0 | 0 | 1 | 0 |
| 16 | Pfizer | 0000078003 | 4 | 11 | 2 | 0 | 0 | 0 | 0 |
| 17 | AbbVie | 0001551152 | 8 | 27 | 4 | 0 | 0 | 0 | 0 |
| 18 | UnitedHealth Group | 0000731766 | 6 | 18 | 3 | 0 | 0 | 0 | 0 |
| 19 | CVS Health | 0000064803 | 6 | 11 | 3 | 0 | 0 | 0 | 0 |
| 20 | Boeing | 0000012927 | 6 | 0 | 2 | 2 | 0 | 1 | 1 |
| 21 | Home Depot | 0000354950 | 4 | 12 | 2 | 0 | 0 | 0 | 0 |
| 22 | PepsiCo | 0000077476 | 14 | 23 | 7 | 0 | 0 | 0 | 0 |
| 23 | Union Pacific | 0000100885 | 3 | 2 | 1 | 0 | 0 | 0 | 1 |
| 24 | Lowe's Companies | 0000060667 | 2 | 5 | 1 | 0 | 0 | 0 | 0 |
| 25 | Duke Energy Corp | 0001326160 | 22 | 9 | 7 | 2 | 0 | 0 | 8 |
| 26 | Southern Co | 0000092122 | 16 | 6 | 7 | 3 | 0 | 0 | 0 |
| 27 | NextEra Energy | 0000753308 | 38 | 32 | 18 | 4 | 0 | 0 | 1 |
| 28 | Dominion Energy | 0000715957 | 30 | 11 | 8 | 4 | 0 | 0 | 12 |
| 29 | Realty Income | 0000726728 | 22 | 12 | 8 | 5 | 0 | 1 | 0 |
| 30 | Welltower | 0000766704 | 23 | 6 | 3 | 17 | 0 | 0 | 0 |
| | **Total** | | **632** | **628** | **187** | **44** | **22** | **7** | **55** |

### Appendix D1-C — 20 random parsed rows (finals; seed 20261014, mulberry32, population 628; `state/sample20-2026-10-14.txt` `0d450c38e2bc3abc41c8f46d9a8c8d8a578bb285087b4594974c5b50e1a8a93f`)
| Issuer | Accession | Seq | Form | Filed | Rate type | Coupon | Spread bps | Benchmark | Principal | Ccy | Maturity | Seniority | instrument_key | Conf |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Toyota Motor Credit Corp | 0000950103-24-008004 | 1 | 424B2 | 2024-06-06 | floating |  | 34 | SOFR | 1650000000 | USD | 2025-06-10 |  | CUSIP:89236TMG7 | 95 |
| Toyota Motor Credit Corp | 0000950103-26-000574 | 1 | 424B2 | 2026-01-16 | fixed | 4.15 |  |  | 25000000 | USD | 2031-01-21 |  | CUSIP:89236TPL3 | 95 |
| Toyota Motor Credit Corp | 0000950103-26-003611 | 2 | 424B2 | 2026-03-11 | fixed | 4.05 |  |  | 1150000000 | USD | 2029-03-13 |  |  | 85 |
| Toyota Motor Credit Corp | 0000950103-26-006131 | 1 | 424B2 | 2026-04-24 | fixed_to_floating | 4.141 | 43 | SOFR | 500000000 | USD | 2027-10-27 |  | CUSIP:89236TPY5 | 95 |
| Duke Energy Corp | 0001104659-24-000673 | 1 | 424B5 | 2024-01-03 | fixed | 4.85 |  |  | 550000000 | USD | 2027-01-05 | senior |  | 85 |
| John Deere Capital Corp | 0001104659-24-069478 | 1 | 424B2 | 2024-06-07 | fixed | 4.85 |  |  | 850000000 | USD | 2029-06-11 | senior | US24422EXT18 | 95 |
| Home Depot | 0001104659-24-072914 | 5 | 424B2 | 2024-06-18 | fixed | 4.75 |  |  | 1250000000 | USD | 2029-06-25 |  |  | 85 |
| Home Depot | 0001104659-24-072914 | 7 | 424B2 | 2024-06-18 | fixed | 4.95 |  |  | 1750000000 | USD | 2034-06-25 |  |  | 85 |
| Caterpillar Financial Services | 0001104659-24-088587 | 1 | 424B3 | 2024-08-13 | fixed | 4.4 |  |  | 650000000 | USD | 2027-10-15 |  | CUSIP:14913UAR1 | 95 |
| Caterpillar Financial Services | 0001104659-24-088588 | 1 | 424B3 | 2024-08-13 | fixed | 4.375 |  |  | 600000000 | USD | 2029-08-16 |  | CUSIP:14913UAQ3 | 95 |
| PepsiCo | 0001104659-25-010139 | 2 | 424B2 | 2025-02-06 | fixed | 4.45 |  |  | 750000000 | USD | 2028-02-07 | senior |  | 85 |
| Caterpillar Financial Services | 0001104659-26-000778 | 1 | 424B3 | 2026-01-06 | fixed | 4.15 |  |  | 500000000 | USD | 2031-01-08 |  | CUSIP:14913UBH2 | 95 |
| Amazon.com | 0001104659-26-027669 | 1 | 424B5 | 2026-03-13 | floating |  | 35 | EURIBOR | 1750000000 | EUR | 2028-03-16 |  | XS3305167390 | 100 |
| Amazon.com | 0001104659-26-107122 | 2 | 424B5 | 2026-09-11 | fixed | 5.55 |  |  | 1000000000 | GBP | 2032-09-14 |  | XS3504677694 | 95 |
| UnitedHealth Group | 0001193125-24-072775 | 5 | 424B5 | 2024-03-20 | fixed | 5.375 |  |  | 1750000000 | USD | 2054-04-15 |  | US91324PFC14 | 100 |
| CVS Health | 0001193125-24-134264 | 1 | 424B2 | 2024-05-08 | fixed | 5.4 |  |  | 1000000000 | USD | 2029-06-01 | senior |  | 85 |
| American Express | 0001193125-25-089345 | 2 | 424B2 | 2025-04-22 | fixed_to_floating | 5.016 |  |  | 1500000000 | USD | 2031-04-25 |  |  | 85 |
| General Motors Financial Co. | 0001193125-25-248780 | 1 | 424B2 | 2025-10-23 | fixed | 4.2 |  |  | 1000000000 | USD | 2028-10-27 | senior | US37045XFL55 | 100 |
| Pfizer | 0001193125-25-289779 | 7 | 424B5 | 2025-11-20 | fixed | 5.7 |  |  | 500000000 | USD | 2065-11-15 |  |  | 85 |
| Intercontinental Exchange, Inc. | 0001193125-26-349174 | 1 | 424B5 | 2026-08-13 | fixed | 4.7 |  |  | 1250000000 | USD | 2029-08-20 | senior |  | 85 |

---

## Thu 15 Oct 2026 — day 2 (AC17 rulings coded, tests, full dry run re-run; pilot NOT started)

### 0. Start checks
- HEAD `3960aee`, branch `October-2026`, no `.git/*.lock`; no git writes. Only pre-existing change in the tree outside this lane: `claude/October_Decisions_Log.md` (not mine).
- Rulings source: `claude/MA-OCT-008_AC17_Signoff.md` `5cdb7d89ac34360698b991c6d1769a5381b5a0a5d1b222cc46462063f889f4e0` (AC17 packet CLOSED on the board).
- **Pilot gate: MA-OCT-OPS.T12 is `EXECUTING` with no report** (`MA-OCT-OPS.T12_Status.json`, updated 05:58Z). Per the Founder's instruction the pilot was **not** started: no migration, no Pack C, no link seed, no D1 statement of any kind.
- T12's Task confirms the key file `~/.meridian-secrets/bonds-ops-ingest.env` (emitter `local-bonds`), which matches the runner, and accepts `bonds/.gitignore` for `state/` (answers day-1 questions 3 and 4).

### 1. Rulings coded (parser `bonds-1.1.0`; nothing was written under `bonds-1.0.0`, so no re-parse path is needed)
| Ruling | Code | Test |
|---|---|---|
| **B-1 / R2b** | 424B only: `Preliminary\s+Pricing\s+Supplement` in the first 2,000 visible chars → `preliminary` (rule label `R2b`), in §7.2 before the title gate; FWP never classified | R2b test (no "No." needed; FWP; beyond 2,000 chars); GM fixture → `R2b` |
| **B-1b** | retail table with `[ ]` amount cells → `preliminary` | GM 3 Mar 2025 fixture |
| **L8-14** principal guard | a row is `final` only if `principal_amount` > 0; else per-tranche `parse_failed` with `fail_reason` (run record only) | synthetic no-principal test |
| **B-2** | rule 1 adds `exchange\s+offers?`, `offers?\s+to\s+exchange` (title scope) | plural / Realty Income fixture |
| **B-3** (a)/(b) + conditions 1, 2, 4 | (a) `(Notes?|Debentures?|Bonds?),?\s*Series[ X]\s+due` after the strict rule; (b) retail table under a pricing header; order unchanged (other → structured → non-debt → debt). B-3b rows also need a coupon or a floating benchmark and a full maturity. Every row carries `path` (`7.3-4` / `B-3a` / `B-3b`) and every filing writes a run-log line `kind: "filing"` with `final_paths` | paths on NextEra (B-3a), GM (B-3b), UNH (7.3-4); structured title with ", Series B due" stays structured |
| **B-4** + conditions 1–4 | `C$`/`CA$`/`CAD`/"Canadian dollar(s)" → CAD, `A$`/`AUD`/"Australian dollar(s)" → AUD, `US$`/`U.S.$` → USD, all before €, £, CHF, ¥ and a bare `$` (USD). Currency from the tranche title / cover line only: the term-sheet and offering-sentence currencies are no longer used, only compared and noted (0 such notes in the run). cp1252 only on numeric refs `&#128;`–`&#159;` / `&#x80;`–`&#x9F;` | AT&T `&#128;`; Amazon C$ and NextEra C$ fixtures; raw C1 byte untouched |
| **Rule 5** (i)–(iii) | only on the "no title" fall-through: demand notes / named programmes → `skipped_other` `demand_note`; merger and consent documents → `skipped_other` `merger_document`; DSPP/DRIP → `skipped_non_debt` `stock_plan`; reason in the run record | Toyota IncomeDriver, UNP merger proxy, Dominion Direct fixtures; a debt title with "PremierNotes" in prose still parses |
| **N-3** | audit title: SEC legend and EDGAR header tokens stripped, cover offering line preferred. Report/run-record only; classification still uses the unchanged title extractor (so no signed row can move) | Capital One → "7,500,000 Shares Common Stock"; Realty Income → "Offers to Exchange All Outstanding Notes … Spirit Realty, L.P. …" |
| **L8-12** co-registrants | parser names the cover's co-registrant issuer(s). The runner reads the filing's own EDGAR index (≤ 3 requests, cached), requires an **exact** normalised name match to a filer other than the parent, and writes every row of that filing under the co-registrant's CIK. Holds the filing (not written, listed) if: mixed cover (≥ 2 issuer names); guarantee with no named issuer; CIK not established; index budget spent; or in a live run no `bond_issuer_link` row for that CIK. Never falls back to the parent | runner test: resolved → own CIK, mixed → held, guarantee-only → held, nothing written under the parent CIK, one index request, B-3 path logged |

**Build-lane interpretations inside the rulings (for the fresh Architect session at close-out):**
1. **B-3a designator optional.** The ruling's literal pattern `Series\s+[A-Z0-9-]+\s+due` does not match NextEra's "Debentures, Series due 2031", which the ruling names as covered, so the designator is optional (`Series(?:\s+X)?\s+due`).
2. **Rule 5 (ii) widened** with `TRANSACTION PROPOSED` and `joint proxy statement/prospectus`. Union Pacific–Norfolk Southern `0001193125-25-226560` prints "MERGER" as an image, and the ruling pre-signs it as a merger document. With the literal patterns only 44 of the 45 pre-signed rows moved; with this, all 45 move and nothing else does.
3. **FWP matching, not the cross-check.** AT&T `0001193125-26-344905` was matched to AT&T's next-day **USD** floater FWP on the same shelf (due 10 Aug 2028). The 424B states 17 Aug 2028 three times. An FWP section whose title currency differs from the tranche's is now not the same deal. The §14.1 disagreement rule is unchanged, and the Verizon and two Dominion conflicts still force `parse_failed`.
4. Day-1 bugs found while coding L8-12, fixed before the reported run: the EDGAR-index reader took the mailing address into the filer name, and "…Guaranteed by Welltower Inc. Welltower OP LLC" was read as a second issuer. Two earlier dry runs today (`5ac12cf8…`, `a8d2e46e…`) are superseded by run `11b2fadd…` below.

### 2. Tests — 43 / 43 pass (`node --test "App/Corporate Atlas/bonds/tests/"*.test.mjs`; 0 network, 0 D1)
Day-1's 32, plus 11 for the rulings above. Seven new fixtures were taken from the 14 Oct cache with 0 SEC requests: Amazon C$, NextEra C$, Toyota IncomeDriver, UNP merger proxy, Dominion Direct, Capital One DRIP, Realty Income exchange offer. Their hashes are in `fixtures/manifest.json`.

### 3. Dry run — run `11b2fadd-23ed-4745-9749-90bbc15a98c4` (0 D1 calls, 0 D1 writes, 0 heartbeats)
| final | preliminary | skipped_non_debt | skipped_structured | skipped_other | parse_failed | total rows | filings | held |
|---|---|---|---|---|---|---|---|---|
| **628** | 189 | 45 | 21 | 51 | **9** | 943 | 632 | **0** |

- **vs 14 Oct (signed run):** 45 filings `parse_failed` → `skipped_*` (exactly the 45 pre-signed accessions: 39 demand notes, 5 merger documents, 1 stock plan). AT&T tranche `parse_failed` → `final` (interpretation 3). 42 finals now carry their co-registrant's CIK. **No coupon, principal, maturity, spread, rate type, currency or instrument key changed on any other row.**
- **Wells window shifted overnight** (60 most recent 424B2, L8-1): 4 new filings (all `preliminary`), and 4 dropped out of the window, including the single plain Wells final from 14 Oct. Wells now has 0 finals.
- Est. writes 2,785 (cost model) in 10 batches; declared 6,000.
- Outputs: `state/dryrun-2026-10-15.sql` `a055a82be2ae48ef0ae0a61118fd4944b64705c8032ca41b8e6b037ab2646d88`; `state/dryrun-2026-10-15.json` `c783aef1a5e64b235df7b083afe1559e646c2e1ccdf62ab00bb4a48b658b45af`.
- Local SQLite (not D1): all 943 statements pass the migration's CHECKs, a reload changes 0 rows, and there are 0 finals without principal and 0 finals without maturity. Final currencies: USD 555, EUR 51, CAD 12, GBP 10.

**Every `skipped_*` row not on the signed lists (§1 = 51, §2 pre-signed = 45):**
- **29 AC17 issuers: none.** No new skip needs a signature before any pilot or load batch.
- **Wells Fargo (outside AC17 by spec §7.3): 21 `skipped_structured`.** All 21 were already `skipped_structured` on 14 Oct, so there is no new Wells skip: 0001839882-26-049114, -049115, -049126, -049152, -049625, -049789, -049790, -049927, -049987, -050143, -050201, -050206, -050207, -050209, -050271, -050272, -050273, -050283, -050294, -050327, -050351.

**B-3 paths (final rows):** `7.3-4` 526 · **`B-3a` 57** (Toyota Motor Credit, NextEra Energy Capital Holdings) · **`B-3b` 45** (GM Financial Term Notes, Verizon InterNotes). Condition 3 is feasible: the §14.2 sample must draw ≥ 4 from each B-3 path. The sampler will be stratified on `path` from the run log when the sample is drawn after the load.

**L8-12 co-registrants (to seed as `bond_issuer_link` rows, `status = 'paused'`, linked by §11 rules at Pack C; `entity_id` NULL + 004 ticket if no match):**
| Cover issuer | Own CIK (EDGAR index) | Parent CIK | Filings | Finals | Index read from |
|---|---|---|---|---|---|
| NextEra Energy Capital Holdings, Inc. | 0000794447 | 0000753308 | 15 | 32 | 0001104659-24-008198 |
| Welltower OP LLC | 0001917598 | 0000766704 | 3 | 6 | 0001193125-25-148908 |
| Pfizer Netherlands International Finance B.V. | 0002058265 | 0000078003 | 1 | 4 | 0001193125-25-120844 |

`bond_issuer_link` will be 33 rows (30 polled + 3 paused). No pilot issuer is affected. Main Lane to record this for the Founder, as the sign-off asks.

**The 9 `parse_failed` rows:**
- 2 MTN programme supplements (no tranche): Caterpillar 0001104659-26-035983 and Toyota 0000950103-24-000970.
- 3 tranches whose year-only maturity could not be resolved to one date: GM 0001193125-25-129568 #1 and #2, and Duke 0001104659-24-091286 #1. The CVS and Union Pacific cases from day 1 now resolve.
- 1 whole filing with no tranche found: GM 0001193125-25-308634, unchanged as ruled.
- 3 FWP disagreements kept: Verizon 0001193125-25-064062 #1, and Dominion 0001193125-25-173213 #2 and 0001193125-26-263513 #2.

Total: 2 + 3 + 1 + 3 = 9.

### 4. SEC requests — 100 today, all HTTP 200 (cap 1,500 per run)
- 3 dry runs × 30 `submissions` + 1 Meta `files[]` page = 93.
- 4 new Wells documents.
- 3 EDGAR filing-index pages (L8-12, within the ≤ 3 allowance).

Everything else (424B documents, FWPs) was served from the 14 Oct cache. The ledger now records `started` per request: the minimum start-to-start gap today is ≥ 200 ms by construction and is logged directly.

### 5. D1 reads / writes
**0 / 0.**

### 6. Pilot — waiting on T12 (nothing started)
Order once T12 reports the registry row `local.bonds-ingest` and the `local-bonds` emitter (with the key file present, mode 600):
1. migration `008-bonds.sql` in a non-freeze window, then P-B1..P-B3 on D1;
2. Pack C (EXPLAIN first; stop on any `SCAN entity_master`) and the link seed: 30 polled rows + 3 paused co-registrant rows;
3. pilot on ICE, UnitedHealth and Toyota Motor Credit, with multipliers and the N8-2 `rows_written` check.

Toyota's demand-note rows are pre-signed and there are no new Toyota skips, so the pilot waits on no further sign-off. Thursday's budget is ≤ ≈ 500 writes. FREEZES.json today: boost 10:45–11:15 and 16:45–17:15, midnight 23:50–00:10, bootstrap 07:55–08:05.

### 7. Files (SHA-256 at report time)
| File | SHA-256 |
|---|---|
| `App/Corporate Atlas/bonds/bonds-parse.mjs` (`bonds-1.1.0`) | `12faec06b8ed6b726b59ffdc7fe346bb7064fd8e64685a38c5de09baddb3b5fc` |
| `App/Corporate Atlas/bonds/bonds-ingest.mjs` | `edb21bc7ac89c116b3cd68ff3085f46dd822c9667b4311f9d1ea785988216245` |
| `App/Corporate Atlas/bonds/bonds-lib.mjs` | `34775d08a371f3dbbbd9aa0500211a407a8d545b2398ab111c29bbd4e3153708` |
| `App/Corporate Atlas/bonds/bonds-discover.mjs` | `baf6a26062938038efd24ce8f548dbfe4bd60916a3f63d7fc19c8fa946b154a4` |
| `App/Corporate Atlas/bonds/bonds-config.json` (+ `co_registrant_index_max: 3`) | `ce5130004828844b2e36854a5e047ab69f68dcbc824c697f741ceae8027c1f29` |
| `App/Corporate Atlas/bonds/tests/bonds-parse.test.mjs` | `64b42cf8d15a58c4e7848d0fb7fb0fb6923dc1c95107ce856c3cc8d8ce51d5e6` |
| `App/Corporate Atlas/bonds/tests/bonds-ingest.test.mjs` | `6d28a57f88a6dfa7326d271fd7a761e98b74244bbfbcacd96dcbe8bf21e28ddc` |
| `App/Corporate Atlas/bonds/fixtures/manifest.json` (27 documents) | `bb48f0a8d367f3a9a7876b07ba060c9806657173b8724357edc4e5c85537b355` |
| control scripts, `.gitignore`, `migrations/008-bonds.sql` | unchanged from day 1 |

### 8. Questions
1. **Fresh Architect session (close-out):** interpretations 1–3 above, alongside B-3, B-4 and L8-12, as the sign-off routes them.
2. **Main Lane:** log rulings R2b, L8-12, L8-13 and L8-14; record the 33-row `bond_issuer_link` for the Founder; tell this lane when T12 reports.

### Appendix D2-A — per-issuer rows (run `11b2fadd`; co-registrant rows counted under their parent's seed line)
| # | Issuer | filings | final | preliminary | skipped_non_debt | skipped_structured | skipped_other | parse_failed |
|---|---|---|---|---|---|---|---|---|
| 1 | Intercontinental Exchange, Inc. | 7 | 7 | 3 | 0 | 0 | 1 | 0 |
| 2 | Wells Fargo & Company | 60 | 0 | 39 | 0 | 21 | 0 | 0 |
| 3 | Capital One Financial | 16 | 11 | 6 | 2 | 0 | 2 | 0 |
| 4 | American Express | 17 | 27 | 3 | 1 | 0 | 0 | 0 |
| 5 | Caterpillar Financial Services | 43 | 37 | 0 | 0 | 0 | 5 | 1 |
| 6 | John Deere Capital Corp | 35 | 35 | 0 | 0 | 0 | 0 | 0 |
| 7 | Toyota Motor Credit Corp | 98 | 115 | 0 | 0 | 0 | 9 | 1 |
| 8 | General Motors Financial Co. | 44 | 33 | 17 | 0 | 0 | 9 | 3 |
| 9 | Apple Inc. | 2 | 4 | 1 | 0 | 0 | 0 | 0 |
| 10 | Amazon.com | 13 | 42 | 6 | 0 | 0 | 1 | 0 |
| 11 | Meta Platforms | 6 | 17 | 3 | 0 | 0 | 0 | 0 |
| 12 | Oracle | 13 | 24 | 5 | 4 | 0 | 0 | 0 |
| 13 | AT&T | 11 | 30 | 1 | 0 | 0 | 0 | 0 |
| 14 | Verizon Communications | 58 | 52 | 28 | 0 | 0 | 2 | 1 |
| 15 | Comcast | 5 | 9 | 1 | 0 | 0 | 1 | 0 |
| 16 | Pfizer | 4 | 11 | 2 | 0 | 0 | 0 | 0 |
| 17 | AbbVie | 8 | 27 | 4 | 0 | 0 | 0 | 0 |
| 18 | UnitedHealth Group | 6 | 18 | 3 | 0 | 0 | 0 | 0 |
| 19 | CVS Health | 6 | 11 | 3 | 0 | 0 | 0 | 0 |
| 20 | Boeing | 6 | 0 | 2 | 2 | 0 | 2 | 0 |
| 21 | Home Depot | 4 | 12 | 2 | 0 | 0 | 0 | 0 |
| 22 | PepsiCo | 14 | 23 | 7 | 0 | 0 | 0 | 0 |
| 23 | Union Pacific | 3 | 2 | 1 | 0 | 0 | 1 | 0 |
| 24 | Lowe's Companies | 2 | 5 | 1 | 0 | 0 | 0 | 0 |
| 25 | Duke Energy Corp | 22 | 9 | 7 | 2 | 0 | 7 | 1 |
| 26 | Southern Co | 16 | 6 | 7 | 3 | 0 | 0 | 0 |
| 27 | NextEra Energy | 38 | 32 | 18 | 4 | 0 | 1 | 0 |
| 28 | Dominion Energy | 30 | 11 | 8 | 5 | 0 | 9 | 2 |
| 29 | Realty Income | 22 | 12 | 8 | 5 | 0 | 1 | 0 |
| 30 | Welltower | 23 | 6 | 3 | 17 | 0 | 0 | 0 |

---

## Thu 15 Oct 2026 — day 2, evening (T12 reported; Pack C done read-only; live writes NOT run)

### 1. Gates
- **MA-OCT-OPS.T12 reported** (`REVIEW_NEEDED`, commit `d0e6847`):
  - registry row `local.bonds-ingest` is active, `expected_max_duration_s` 3600;
  - `local-bonds` is in `OPS_INGEST_KEYS`, with a K-4 accepted test event (201) and a refused wrong-key event (401);
  - the key file `~/.meridian-secrets/bonds-ops-ingest.env` is present, mode 600 (contents not read).
- AC17 is signed. Both Task gates for the pilot are therefore met.
- `d1-today` at 17:17Z: 751 account rows written. FREEZES `cdc9606a…c346` (unchanged).
- My code files are unchanged since the day-2 report (hashes re-checked).

### 2. Migration — attempted, blocked, not applied
At ≈ 17:20Z the migration call (`008-bonds.sql`, via `wrangler d1 execute --remote --file`, after the calendar and `d1-today` gates) was **refused by this session's permission control** ("Modify Shared Resources"). Nothing reached D1. As instructed by that control, I did not retry by any other route. **No D1 write has been made by this lane.** The migration, P-B1..P-B3, the link seed and the pilot all wait on the Founder's explicit go-ahead for live D1 writes from this session.

### 3. Pack C (§11.2) — done, read-only (0 writes; 129 rows read in total)
| Step | Statement / plan | Executions | rows_read |
|---|---|---|---|
| catalog | `sqlite_master` (bond tables absent; `entity_merge_redirect` absent → C4 skipped) | 1 | 150 |
| C1 | `SELECT '<cik>' AS cik, entity_id FROM issuereventstream WHERE cik = '<cik>' AND entity_id IS NOT NULL LIMIT 1` → `SEARCH … idx_issuereventstream_cik (cik=?)`. The 27 pending CIKs + 3 co-registrants were run one per call; a first 10-statement call returned D1 7500 (internal error), 0 reads | 30 | 20 (max 1) |
| B3-style PK check | `entity_master WHERE entity_id IN (…)` → `SEARCH … INTEGER PRIMARY KEY` | 1 | 46 |
| C2 | `entity_master WHERE lei IN (17 LEIs)` → `SEARCH entity_master USING INDEX idx_entity_master_phase3 (lei=?)` (a SEARCH; the spec named `idx_entity_master_lei`) | 1 | 43 |

All literal SQL and per-execution `rows_read` are in `bonds/state/packc.jsonl` and `bonds/state/d1-ledger.jsonl`.

**LEI sources (local golden copy `gleif_006.db`, publish 2026-09-28; 0 GLEIF API calls):**
- **GLEIF `lei_isin` over each issuer's own parsed bond ISINs.** This was unanimous per issuer: Caterpillar Financial (32 of 35 ISINs), Deere Capital (32/35), Toyota Motor Credit (66/70), GM Financial (14/14), Southern (2/2), Realty Income (2/2).
- **Exact GLEIF legal name** for the rest. These are treated as proposals unless confirmed by `entity_master.cik`.

**Findings:**
- **C1 points at 5 entities that no longer exist** (Comcast 14452, Home Depot 1790, Lowe's 2320, Southern 2299, Realty Income 14471). They were probably merged away, and `issuereventstream` still holds the old ids. A DQ note goes to the 013/merge owner.
- **7 issuers do have a live entity whose own `entity_master.cik` equals the filer CIK:** Comcast 2242, Realty Income 2278, Southern 1763, Wells 14523, Home Depot 1563, Boeing 24917, Amazon 352. Pack B (via `issuerperiodsummary`) and C1 missed them. These are §8.1 `cik` links, found via C2.
- **Welltower: wrong CIK on an entity.** Entity 2289 has the name and LEI of Welltower OP LLC (`T6IZ0MBEG5ACZDTR7D06`) but `entity_master.cik = 0000766704`, which is Welltower Inc. Welltower Inc's own LEI `254900F33BIAR82QTA19` has no entity. The seed therefore leaves Welltower Inc **unmatched** and proposes 2289 for the OP LLC (CIK 0001917598). This needs a DQ ticket to fix the CIK on 2289.

### 4. `bond_issuer_link` seed — prepared, NOT executed
File: `bonds/state/link-seed-2026-10-15.sql` `36c6ed3ae4a9021fcbb411f272d5d0a1ba639f36d21ea3407783820db0825317`. 33 `INSERT OR IGNORE` statements, ≈ 93 writes; loads cleanly against the migration locally.

| link_method / status | Rows | Issuers |
|---|---|---|
| `cik` 95 / active | 24 | ICE 348, Apple 1662, Meta 355; C1: Capital One 2323, Amex 1673, Oracle 1571, AT&T 14289, Verizon 1830, Pfizer 1874, AbbVie 1534, UnitedHealth 1642, CVS 1896, PepsiCo 1457, Union Pacific 1722, Duke 1526, NextEra 1421, Dominion 1858; via C2: Comcast 2242, Realty Income 2278, Southern 1763, Wells 14523, Home Depot 1563, Boeing 24917, Amazon 352 |
| `lei` 85 / active | 3 | Caterpillar Financial 27863, John Deere Capital 27881, Toyota Motor Credit 28007. Each is the subsidiary's own entity, never the parent (L8-4) |
| `unmatched` / active | 3 | GM Financial (LEI 5493008B6JBRUJ90QL97, no entity → 004 ticket), Lowe's (pending DIL: C3 proposal 1753), Welltower Inc (no entity → 004 ticket; 2289 CIK DQ) |
| `unmatched` / paused (L8-12) | 3 | NextEra Energy Capital Holdings 0000794447 (pending DIL: C3 proposal 27953), Welltower OP LLC 0001917598 (pending DIL: C3 proposal 2289), Pfizer Netherlands International Finance B.V. 0002058265 (LEI 254900YI79T8NMNA4349, no entity → 004 ticket) |

**For the Data-Identity Lead to sign** (each becomes `manual` 100 by an `UPDATE`, ≈ 2 writes each, after signature):
- Lowe's → 1753;
- NextEra Energy Capital Holdings → 27953;
- Welltower OP LLC → 2289.

**Unlinked-issuer list (Q2, 004 `missing_entity`):** GM Financial, Welltower Inc and Pfizer Netherlands International Finance B.V., plus the 3 above until they are signed.

### 5. Pilot — sized, not started
Model writes: ICE ≈ 30, UnitedHealth ≈ 77, Toyota Motor Credit ≈ 456. Add the migration (≈ a few), the link seed (≈ 93), and heartbeats plus `last_polled_at` (≈ 30 + 6). **The full 3-issuer pilot is ≈ 700 writes, over Thursday's "≤ ≈ 500".** Proposal: tonight run the migration, P-B1..P-B3, the seed, and ICE + UnitedHealth (≈ 240, multipliers measured); Toyota first on Fri 16 before the load, inside Friday's 8,000. Founder to choose.

Commands, in order, after approval and outside FREEZES windows (Thu window open until 23:50Z):
1. `wrangler d1 execute meridian-etf --remote -c wrangler-entities-enrich.toml --file migrations/008-bonds.sql --json --yes`
2. P-B1..P-B3 EXPLAIN (read-only)
3. `--file bonds/state/link-seed-2026-10-15.sql`
4. `SEC_USER_AGENT=… node bonds/bonds-ingest.mjs --mode=initial --cik=0001571949,0000731766` (heartbeats on), then the same again for AC6 (0 rows)
5. Toyota `--cik=0000834071` per the Founder's choice.

---

## Thu 15 Oct 2026 — day 2, live steps (Founder Start Approval, ML-1015-4)

Scope run exactly as ruled: (1) migration, (2) plan checks, (3) link seed, (4) pilot for **ICE and UnitedHealth only**. Toyota Motor Credit is **not** run (first on Fri 16, before the initial load). Lowe's, NextEra Energy Capital Holdings and Welltower OP LLC are seeded `unmatched`. All steps ran 17:25–17:28Z, outside every FREEZES window (`cdc9606a…c346`), with `d1-today` at 751 account rows before each write. Each `wrangler d1 execute` used the pinned 4.96.0 binary and was approved by the Founder at the prompt.

### Writes (D1, measured by wrangler `meta.rows_written`)
| Step | When (UTC) | Statements | rows_read | **rows_written** | Note |
|---|---|---|---|---|---|
| 1 Migration `008-bonds.sql` (`ee26e309…9b40`) | 17:25:52 | 5 | 8 | **9** | 2 tables, 3 indexes |
| 3 Link seed `state/link-seed-2026-10-15.sql` (`36c6ed3a…7317`) | 17:26:27 | 33 | 33 | **93** | = model (3 per linked row, 2 per unmatched). A first call failed before reaching D1 (wrangler resolves `--file` from `App/Corporate Atlas/`); re-issued with the absolute path |
| 4 Pilot run `c64dba7e-f17e-4081-a52c-77095a78fc44` (`--mode=initial --cik=0001571949,0000731766`) | 17:26:52–17:27:40 | 32 + 2 | 71 + 2 | **107 + 2** | batch 1 declared 107, measured 107; `last_polled_at` 2 |
| AC6 re-run `c475dbac-a661-460d-b6e0-ae86577fffbd` (`--mode=incremental`, same CIKs) | 17:27:57–17:28:03 | 2 | 0 | **2** | 0 batches; `last_polled_at` only |
| Ops events (4 delivered, ≈ 5 rows each, ML-0910-1) | — | — | — | **≈ 20** | `start` + `success` × 2, all HTTP 201 |
| **Thursday total for this lane** | | | | **≈ 233** | inside the ≈ 500 cap |

### Checks
- **AC10 on D1 (P-B1..P-B3):**
  - P-B1: `SEARCH bond_issuance USING INDEX idx_bi_cik_final_key (cik=? AND (maturity_date,accession_number,tranche_seq)>(?,?,?))`, no temp B-tree;
  - P-B2: `SEARCH bond_issuer_link USING INDEX idx_bil_entity (entity_id=?)`;
  - P-B3: `SEARCH bond_issuance USING COVERING INDEX sqlite_autoindex_bond_issuance_1 (accession_number=?)`;
  - R1f: `idx_bi_instrument`. **PASS.**
- **Link seed read-back:** cik/active 24, lei/active 3, unmatched/active 3, unmatched/paused 3, every unmatched row with NULL `entity_id`. Pilot issuers: ICE → 348 (`cik`), UnitedHealth → 1642 (`cik`), Toyota → 28007 (`lei`, not yet polled).
- **Pilot content:**
  - 13 filings: ICE 7 (7 final, 3 preliminary, 1 `skipped_other` exchange offer); UnitedHealth 6 (18 final, 3 preliminary).
  - D1 read-back of all 32 rows equals the dry-run record (`dryrun-2026-10-15.json`) field for field: **0 mismatches**; `parser_version` `bonds-1.1.0`.
  - **AC1** holds on live data: the ICE 11 Aug 2026 and UNH 17 Jun 2025 preliminaries are stored as `preliminary` audit rows, 0 tranches.
- **N-1 multipliers (measured):** keyed final 4, unkeyed final 3, audit row 2, `last_polled_at` update 1, link row 3 (linked) / 2 (unmatched). All ≤ 4.5×, so **no re-declare** is needed before the load.
- **N8-2:** `wrangler d1 execute --file` returns **one aggregate `meta` per file**, with `rows_written` and "Total queries executed", not one per statement. The runner sums it, so per-batch writes are measured (`writes_basis = wrangler meta.rows_written`).
- **AC6:** re-run wrote 0 bond rows. **PASS.**
- **AC13:** `ops_job_run` (indexed read `idx_ops_job_run_job_at`, 6 rows) holds `start` + `success` for both runs, with `rows_written` 109 / 2, `items_attempted` / `items_progressed` 13/13 and 0/0, and `detail.metrics` in the fixed key set. Heartbeat log and `events.jsonl` agree. **PASS for these runs.**
- **§12.2 (ii):** largest single execution in the pilot read 71 rows (the batch); the setup catalog read 164. Nothing approaches 50k.
- Gates exercised live: calendar, `hold_all_jobs` (read, `false`), pause and stop flags (absent), headroom (`d1-today` fresh, F-1/F-2/F-3 ok; ceiling 60,000, run cap 8,000).

### Not done (by ruling)
- Toyota Motor Credit pilot: Fri 16, first, before the initial load (≈ 456 model writes).
- The 3 C3 proposals stay `unmatched` until the Data-Identity Lead signs. AC7, AC8, AC9, AC14 and AC15 were exercised in tests and the dry run, as §15.3 step 6 allows.

### Friday plan (for the Main Lane's Control)
1. Toyota `--mode=initial --cik=0000834071`, then its AC6 re-run.
2. Initial load for the remaining 25 polled issuers, declared 6,000 (dry-run model ≈ 2.8k in total, minus the pilot's share), run cap 8,000. It must end before Sat 17 00:00Z (011 window); the 23:50Z F-3 guard stops it anyway.
3. §14.2 sample (≥ 4 rows each from B-3a and B-3b) and the Ops reconciliation inputs.

---

## Fri 16 Oct 2026 — day 3 (ML-1016-1: Toyota pilot, AC6, initial load, §14.2 sample)

All writes were made 18:32–18:40Z, outside every FREEZES window (`cdc9606a…c346`) and well before the 23:50Z stop. `d1-today` read 628 at the start of the evening; my code is unchanged since Thursday (`bonds-parse.mjs` `12faec06…`, `bonds-ingest.mjs` `edb21bc7…`, `bonds-lib.mjs` `34775d08…`, config `ce513000…`). Each `wrangler d1 execute` was approved by the Founder at the prompt. 011.FRI ran in parallel. The per-batch headroom gate read the shared account figure 8 times during the load: 634 each time, which reflects the 25–30 min lag; F-1 adds own unpolled rows.

### Runs
| Run | Scope | Outcome | Filings | Rows (final / prelim / non-debt / structured / other / failed) | Batches (declared = measured) | **rows_written** |
|---|---|---|---|---|---|---|
| `064c8b35-5385-49a6-99ed-284d07522105` 18:32Z | Toyota `--mode=initial` | **skipped `hold`, `detail.hold = "unavailable"`** | 0 | — | — | 0 (+1 event) |
| `388351bf-055b-49f7-ac6e-68384d62183b` 18:38Z | Toyota `--mode=initial` (re-run) | success | 98 | 115 / 0 / 0 / 0 / 9 / 1 | 364 + 92 = 456 | **457** |
| `af6758f3-dfb3-4b7b-808b-c2bc0a12325a` 18:38Z | Toyota AC6 re-run (incremental) | success, 0 batches | 0 | — | — | **1** (`last_polled_at`) |
| `c3a5bedc-ed79-44ba-8bb6-84967d96ab2a` 18:39–18:40Z | Initial load, the other **27** issuers | success | 521 | 493 / 178 / 45 / 21 / 41 / 8 | 236+357+276+297+300+278+257+231 = 2,232 (8 batches) | **2,259** (incl. 27 `last_polled_at`) |
| **Day total, this lane** | | | | | | **2,717 + ≈ 35 for 7 Ops events ≈ 2,752** |

Declared 6,000, stop line 7,800, run cap 8,000: never approached. No batch was retried. SEC requests in live runs: 50 (27 + 3 `submissions` incl. Meta's `files[]` page, plus 21 new Wells documents); all HTTP 200. Everything else was served from cache.

**Notes:**
1. **AC14 on live data.** The first Toyota run's single `hold_all_jobs` read failed transiently (the intermittent wrangler/API failures this week). The gate failed closed, made 0 writes, and sent a `skipped`/`hold` event. A manual read straight after returned `'false'`, and the re-run proceeded.
2. **Correction: 27, not 25.** The initial load covered the **27** remaining seed issuers (30 minus ICE, UnitedHealth and Toyota). "25" in my Thursday plan, which the Friday instruction repeated, was my arithmetic error. The run's scope is spec §15.3 step 6 ("initial load for the rest"); no other scope was added.
3. **All 30 issuers are now loaded.** No issuer waits for a slot after 24 Oct.

### Checks
- **Toyota AC6:** re-run wrote 0 bond rows. **PASS.** (ICE/UnitedHealth AC6 passed Thursday.)
- **Multipliers (N-1):** every one of the 11 live batches (Thu + Fri) measured exactly its declared §8.2 cost (4 / 3 / 2 per row). Max 4×.
- **No drift from the dry run:** none of the 500 dry-run filings in the load changed status (521 − 21 new Wells filings). No non-Wells skip falls outside the signed lists (§1 + §2 pre-signed).
- **Co-registrants:** all 19 co-registrant filings were written under their own CIKs (NextEra Energy Capital Holdings 0000794447 ×15, Welltower OP LLC 0001917598 ×3, Pfizer Netherlands International Finance 0002058265 ×1). None went under a parent CIK, and none was held.
- **Wells window (L8-1):** 21 Wells filings are new since Thursday's dry run: 10 preliminary, 6 structured (signed outside AC17, rule 7.3-2) and **5 final**. The 5 finals are Wells Fargo & Company (parent issuer, not Wells Fargo Finance LLC) Medium-Term Notes, Series AA, "Fixed Rate Callable Notes": `0001839882-26-050980`, `-050985`, `-050986`, `-050996`, `-051003`. I checked them against their covers and "Interest Rate:" lines (e.g. 5.50% due 2029-10-16, $10,158,000; 6.60% due 2046-10-16, $768,000). They are plain debt, not structured, and the parser read them correctly (my check, not the adjudication; they can be drawn in a future sample).
- **AC13 / Ops reconciliation (§15.3 step 7):** today's `ops_job_run` rows (indexed `idx_ops_job_run_job_at`, 8 rows read) match the run log for all 4 runs, on start/terminal phases and `rows_written` (0 / 457 / 1 / 2,259). File: `state/ops-recon-2026-10-16.json` `36d44c2d7e4ce2f78a5762587231cdb8c772e5a233f89797029f32dca06f2d28`. **For the Operations Lead to confirm.**

### D1 coverage after the load (§16 aggregate; small-table scan, 1,886 rows read)
**943 rows across 33 CIKs:** final 633 · preliminary 184 · skipped_non_debt 45 · skipped_other 51 · skipped_structured 21 · parse_failed 9.
- Final rows = 628 from the dry run + 5 new Wells notes.
- The Wells preliminary/structured mix differs from the dry run because its 60-filing window moved.
- File: `state/coverage-2026-10-16.json` `7980649f1a5a69167b50e9c3cb11a7779d87d4ed685b1abf0c78b65f4c975d74`.

### §14.2 sample (AC12) — drawn, for the Data-Identity Lead to adjudicate (Operations Lead spot-check)
- **Population:** 633 final rows read from D1 (`state/finals-2026-10-16.json` `28d32b35…e263`).
- **Seed and method:** seed **20261016** (mulberry32). Draws are without replacement over rows sorted by accession, tranche_seq: (1) one per CIK with finals (30 CIKs); (2) at least 4 from B-3a and 4 from B-3b (AC17 B-3 condition 3); (3) the rest proportional by CIK, largest remainder.
- **Result:** 60 rows, all 30 CIKs, paths 7.3-4 = 47, **B-3a = 8, B-3b = 5**.
- **Files:** `state/sample60-2026-10-16.json` `fc9ce6294ed71bba4436be18d9a20237b696dd5b0667a5d362163a38cd3dcbfd`; table below (= `state/sample60-2026-10-16.md` `324977d3…6a37`).
- **Pass rule (§14.2):** ≥ 98% of the 240 field checks correct (≤ 4 errors), 0 wrong-issuer links, 0 served rows from a preliminary, structured or non-debt filing.
- **AC17 condition 3:** if the B-3 rows score below 98%, B-3 is withdrawn.
- I have not adjudicated any row (executors never review their own work).

| # | CIK | Accession | Seq | Path | Rate type | Coupon | Spread bps | Benchmark | Principal | Ccy | Maturity | Source | principal ✓ | coupon/spread ✓ | maturity ✓ | rate type ✓ | issuer link ✓ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 0000004962 | 0001104659-24-050659 | 1 | 7.3-4 | fixed_to_floating | 5.915 | 163 | SOFR | 500000000 | USD | 2035-04-25 | [424B2](https://www.sec.gov/Archives/edgar/data/4962/000110465924050659/tm2412478-3_424b2.htm) |  |  |  |  |  |
| 2 | 0000004962 | 0001193125-25-245381 | 1 | 7.3-4 | fixed_to_floating | 4.804 | 124 | SOFR | 2000000000 | USD | 2036-10-24 | [424B2](https://www.sec.gov/Archives/edgar/data/4962/000119312525245381/d94743d424b2.htm) |  |  |  |  |  |
| 3 | 0000027673 | 0001104659-25-020206 | 1 | 7.3-4 | floating |  | 50 | SOFR | 500000000 | USD | 2028-03-06 | [424B2](https://www.sec.gov/Archives/edgar/data/27673/000110465925020206/tm258126d2_424b2.htm) |  |  |  |  |  |
| 4 | 0000027673 | 0001104659-26-106397 | 1 | 7.3-4 | fixed | 4.8 |  |  | 400000000 | USD | 2029-09-11 | [424B2](https://www.sec.gov/Archives/edgar/data/27673/000110465926106397/tm2625053d7_424b2.htm) |  |  |  |  |  |
| 5 | 0000060667 | 0001193125-25-216381 | 1 | 7.3-4 | fixed | 3.95 |  |  | 650000000 | USD | 2027-10-15 | [424B2](https://www.sec.gov/Archives/edgar/data/60667/000119312525216381/d54563d424b2.htm) |  |  |  |  |  |
| 6 | 0000064803 | 0001193125-24-134264 | 3 | 7.3-4 | fixed | 5.7 |  |  | 1250000000 | USD | 2034-06-01 | [424B2](https://www.sec.gov/Archives/edgar/data/64803/000119312524134264/d826150d424b2.htm) |  |  |  |  |  |
| 7 | 0000064803 | 0001193125-24-271505 | 1 | 7.3-4 | fixed | 7 |  |  | 2250000000 | USD | 2055-03-10 | [424B2](https://www.sec.gov/Archives/edgar/data/64803/000119312524271505/d899678d424b2.htm) |  |  |  |  |  |
| 8 | 0000072971 | 0001839882-26-050985 | 1 | 7.3-4 | fixed | 5.85 |  |  | 9268000 | USD | 2031-10-16 | [424B2](https://www.sec.gov/Archives/edgar/data/72971/000183988226050985/r10579wfc_424b2-34641.htm) |  |  |  |  |  |
| 9 | 0000077476 | 0001104659-24-022370 | 2 | 7.3-4 | fixed | 4.65 |  |  | 550000000 | USD | 2027-02-16 | [424B2](https://www.sec.gov/Archives/edgar/data/77476/000110465924022370/tm244508-4_424b2.htm) |  |  |  |  |  |
| 10 | 0000077476 | 0001104659-25-010139 | 2 | 7.3-4 | fixed | 4.45 |  |  | 750000000 | USD | 2028-02-07 | [424B2](https://www.sec.gov/Archives/edgar/data/77476/000110465925010139/tm2430885-3_424b2.htm) |  |  |  |  |  |
| 11 | 0000078003 | 0001193125-25-289779 | 4 | 7.3-4 | fixed | 4.5 |  |  | 1250000000 | USD | 2032-11-15 | [424B5](https://www.sec.gov/Archives/edgar/data/78003/000119312525289779/d95338d424b5.htm) |  |  |  |  |  |
| 12 | 0000092122 | 0000092122-25-000026 | 1 | 7.3-4 | fixed | 6.375 |  |  | 1800000000 | USD | 2055-03-15 | [424B2](https://www.sec.gov/Archives/edgar/data/92122/000009212225000026/so2025bjsnfinalprosuppfixe.htm) |  |  |  |  |  |
| 13 | 0000100885 | 0001193125-25-025131 | 1 | 7.3-4 | fixed | 5.1 |  |  | 1000000000 | USD | 2035-02-20 | [424B5](https://www.sec.gov/Archives/edgar/data/100885/000119312525025131/d928171d424b5.htm) |  |  |  |  |  |
| 14 | 0000320193 | 0001140361-25-017543 | 3 | 7.3-4 | fixed | 4.5 |  |  | 1000000000 | USD | 2032-05-12 | [424B2](https://www.sec.gov/Archives/edgar/data/320193/000114036125017543/ny20048442x3_424b2.htm) |  |  |  |  |  |
| 15 | 0000354950 | 0001104659-24-072914 | 4 | 7.3-4 | fixed | 4.875 |  |  | 1000000000 | USD | 2027-06-25 | [424B2](https://www.sec.gov/Archives/edgar/data/354950/000110465924072914/tm2416003-3_424b2.htm) |  |  |  |  |  |
| 16 | 0000354950 | 0001104659-25-088715 | 1 | 7.3-4 | fixed | 3.75 |  |  | 500000000 | USD | 2028-09-15 | [424B2](https://www.sec.gov/Archives/edgar/data/354950/000110465925088715/tm2525219-2_424b2.htm) |  |  |  |  |  |
| 17 | 0000715957 | 0001193125-24-132931 | 1 | 7.3-4 | fixed | 6.875 |  |  | 1000000000 | USD | 2055-02-01 | [424B2](https://www.sec.gov/Archives/edgar/data/715957/000119312524132931/d780808d424b2.htm) |  |  |  |  |  |
| 18 | 0000726728 | 0001104659-24-094021 | 1 | 7.3-4 | fixed | 5 |  |  | 350000000 | GBP | 2029-10-15 | [424B5](https://www.sec.gov/Archives/edgar/data/726728/000110465924094021/tm2422541-4_424b5.htm) |  |  |  |  |  |
| 19 | 0000726728 | 0001104659-25-058902 | 2 | 7.3-4 | fixed | 3.875 |  |  | 650000000 | EUR | 2035-06-20 | [424B5](https://www.sec.gov/Archives/edgar/data/726728/000110465925058902/tm2515449-5_424b5.htm) |  |  |  |  |  |
| 20 | 0000731766 | 0001193125-24-072775 | 4 | 7.3-4 | fixed | 5 |  |  | 1250000000 | USD | 2034-04-15 | [424B5](https://www.sec.gov/Archives/edgar/data/731766/000119312524072775/d800247d424b5.htm) |  |  |  |  |  |
| 21 | 0000731766 | 0001193125-24-183865 | 3 | 7.3-4 | fixed | 4.8 |  |  | 1250000000 | USD | 2030-01-15 | [424B5](https://www.sec.gov/Archives/edgar/data/731766/000119312524183865/d809300d424b5.htm) |  |  |  |  |  |
| 22 | 0000732712 | 0001193125-24-037819 | 1 | 7.3-4 | fixed | 3.5 |  |  | 1000000000 | EUR | 2032-06-28 | [424B2](https://www.sec.gov/Archives/edgar/data/732712/000119312524037819/d784976d424b2.htm) |  |  |  |  |  |
| 23 | 0000732712 | 0001193125-24-057532 | 2 | B-3b | fixed | 5.3 |  |  | 128000 | USD | 2054-03-15 | [424B2](https://www.sec.gov/Archives/edgar/data/732712/000119312524057532/d791431d424b2.htm) |  |  |  |  |  |
| 24 | 0000732712 | 0001193125-24-083157 | 1 | B-3b | fixed | 4.95 |  |  | 954000 | USD | 2034-04-15 | [424B2](https://www.sec.gov/Archives/edgar/data/732712/000119312524083157/d811092d424b2.htm) |  |  |  |  |  |
| 25 | 0000732712 | 0001193125-24-131776 | 1 | B-3b | fixed | 5.1 |  |  | 1311000 | USD | 2029-05-15 | [424B2](https://www.sec.gov/Archives/edgar/data/732712/000119312524131776/d788865d424b2.htm) |  |  |  |  |  |
| 26 | 0000732712 | 0001193125-24-137085 | 1 | B-3b | fixed | 5 |  |  | 923000 | USD | 2029-05-15 | [424B2](https://www.sec.gov/Archives/edgar/data/732712/000119312524137085/d792914d424b2.htm) |  |  |  |  |  |
| 27 | 0000732712 | 0001193125-24-219526 | 1 | B-3b | fixed | 4.15 |  |  | 708000 | USD | 2029-09-15 | [424B2](https://www.sec.gov/Archives/edgar/data/732712/000119312524219526/d885056d424b2.htm) |  |  |  |  |  |
| 28 | 0000732712 | 0001193125-25-277994 | 3 | 7.3-4 | fixed | 5.75 |  |  | 1500000000 | USD | 2045-11-30 | [424B2](https://www.sec.gov/Archives/edgar/data/732712/000119312525277994/d66751d424b2.htm) |  |  |  |  |  |
| 29 | 0000732717 | 0001193125-26-033630 | 3 | 7.3-4 | fixed | 5.125 |  |  | 1250000000 | USD | 2036-04-30 | [424B2](https://www.sec.gov/Archives/edgar/data/732717/000119312526033630/d31343d424b2.htm) |  |  |  |  |  |
| 30 | 0000732717 | 0001193125-26-346869 | 1 | 7.3-4 | floating |  | 65 | SOFR | 1100000000 | USD | 2028-08-10 | [424B2](https://www.sec.gov/Archives/edgar/data/732717/000119312526346869/d180822d424b2.htm) |  |  |  |  |  |
| 31 | 0000764764 | 0001104659-24-088588 | 1 | 7.3-4 | fixed | 4.375 |  |  | 600000000 | USD | 2029-08-16 | [424B3](https://www.sec.gov/Archives/edgar/data/764764/000110465924088588/tm2421463d3_424b3.htm) |  |  |  |  |  |
| 32 | 0000764764 | 0001104659-26-058801 | 1 | 7.3-4 | fixed | 4.5 |  |  | 1000000000 | USD | 2031-05-15 | [424B3](https://www.sec.gov/Archives/edgar/data/764764/000110465926058801/tm2614213d2_424b3.htm) |  |  |  |  |  |
| 33 | 0000794447 | 0001193125-24-155917 | 1 | 7.3-4 | fixed | 6.75 |  |  | 1200000000 | USD | 2054-06-15 | [424B2](https://www.sec.gov/Archives/edgar/data/753308/000119312524155917/d845362d424b2.htm) |  |  |  |  |  |
| 34 | 0000794447 | 0001193125-25-018467 | 1 | B-3a | fixed | 4.85 |  |  | 1000000000 | USD | 2028-02-04 | [424B2](https://www.sec.gov/Archives/edgar/data/753308/000119312525018467/d928265d424b2.htm) |  |  |  |  |  |
| 35 | 0000794447 | 0001193125-25-138936 | 2 | B-3a | fixed | 4.67 |  |  | 1400000000 | CAD | 2035-06-12 | [424B2](https://www.sec.gov/Archives/edgar/data/753308/000119312525138936/d939377d424b2.htm) |  |  |  |  |  |
| 36 | 0000804269 | 0001193125-25-042787 | 1 | 7.3-4 | floating |  | 117 | SOFR | 300000000 | USD | 2028-04-04 | [424B5](https://www.sec.gov/Archives/edgar/data/804269/000119312525042787/d149610d424b5.htm) |  |  |  |  |  |
| 37 | 0000804269 | 0001193125-26-004449 | 2 | 7.3-4 | fixed | 5.45 |  |  | 600000000 | USD | 2036-01-08 | [424B2](https://www.sec.gov/Archives/edgar/data/804269/000119312526004449/d14884d424b2.htm) |  |  |  |  |  |
| 38 | 0000834071 | 0000950103-24-000197 | 1 | B-3a | floating |  | 65 | SOFR | 500000000 | USD | 2026-01-05 | [424B2](https://www.sec.gov/Archives/edgar/data/834071/000095010324000197/dp204799_424b2-mtn1287.htm) |  |  |  |  |  |
| 39 | 0000834071 | 0000950103-25-005958 | 3 | B-3a | fixed | 4.8 |  |  | 750000000 | USD | 2030-05-15 | [424B2](https://www.sec.gov/Archives/edgar/data/834071/000095010325005958/dp228784_424b2-mtn1333.htm) |  |  |  |  |  |
| 40 | 0000834071 | 0000950103-25-008888 | 1 | 7.3-4 | fixed_to_floating | 4.75 | 60 | SOFR | 200000000 | USD | 2027-07-21 | [424B2](https://www.sec.gov/Archives/edgar/data/834071/000095010325008888/dp231671_424b2-mtn1338.htm) |  |  |  |  |  |
| 41 | 0000834071 | 0000950103-26-000297 | 2 | B-3a | fixed | 3.75 |  |  | 750000000 | USD | 2028-01-12 | [424B2](https://www.sec.gov/Archives/edgar/data/834071/000095010326000297/dp239762_424b2-mtn1356.htm) |  |  |  |  |  |
| 42 | 0000834071 | 0000950103-26-000699 | 1 | 7.3-4 | fixed | 5 |  |  | 30000000 | USD | 2041-01-22 | [424B2](https://www.sec.gov/Archives/edgar/data/834071/000095010326000699/dp240195_424b2-mtn1360.htm) |  |  |  |  |  |
| 43 | 0000834071 | 0000950103-26-003611 | 1 | B-3a | floating |  |  |  | 450000000 | USD | 2029-03-13 | [424B2](https://www.sec.gov/Archives/edgar/data/834071/000095010326003611/dp243145_424b2-mtn1364.htm) |  |  |  |  |  |
| 44 | 0000834071 | 0000950103-26-007114 | 1 | B-3a | floating |  |  |  | 400000000 | USD | 2028-05-12 | [424B2](https://www.sec.gov/Archives/edgar/data/834071/000095010326007114/dp246584_424b2-mtn1373.htm) |  |  |  |  |  |
| 45 | 0000834071 | 0000950103-26-007114 | 3 | B-3a | fixed | 4.55 |  |  | 800000000 | USD | 2031-05-14 | [424B2](https://www.sec.gov/Archives/edgar/data/834071/000095010326007114/dp246584_424b2-mtn1373.htm) |  |  |  |  |  |
| 46 | 0000927628 | 0001193125-24-019419 | 2 | 7.3-4 | fixed_to_floating | 6.051 |  |  | 1000000000 | USD | 2035-02-01 | [424B2](https://www.sec.gov/Archives/edgar/data/927628/000119312524019419/d711664d424b2.htm) |  |  |  |  |  |
| 47 | 0001018724 | 0001104659-26-027125 | 6 | 7.3-4 | fixed | 4.55 |  |  | 4000000000 | USD | 2033-03-13 | [424B5](https://www.sec.gov/Archives/edgar/data/1018724/000110465926027125/tm266670-4_424b5.htm) |  |  |  |  |  |
| 48 | 0001018724 | 0001104659-26-027125 | 10 | 7.3-4 | fixed | 5.95 |  |  | 3000000000 | USD | 2066-03-13 | [424B5](https://www.sec.gov/Archives/edgar/data/1018724/000110465926027125/tm266670-4_424b5.htm) |  |  |  |  |  |
| 49 | 0001018724 | 0001104659-26-081786 | 3 | 7.3-4 | fixed | 4.8 |  |  | 4250000000 | USD | 2031-07-09 | [424B5](https://www.sec.gov/Archives/edgar/data/1018724/000110465926081786/tm2619352-2_424b5.htm) |  |  |  |  |  |
| 50 | 0001166691 | 0001193125-24-143955 | 3 | 7.3-4 | fixed | 5.65 |  |  | 1200000000 | USD | 2054-06-01 | [424B2](https://www.sec.gov/Archives/edgar/data/1166691/000119312524143955/d834121d424b2.htm) |  |  |  |  |  |
| 51 | 0001326160 | 0001104659-24-002930 | 1 | 7.3-4 | fixed | 4.85 |  |  | 50000000 | USD | 2027-01-05 | [424B5](https://www.sec.gov/Archives/edgar/data/1326160/000110465924002930/tm242317-3_424b5.htm) |  |  |  |  |  |
| 52 | 0001326801 | 0001193125-24-197096 | 3 | 7.3-4 | fixed | 4.75 |  |  | 2500000000 | USD | 2034-08-15 | [424B2](https://www.sec.gov/Archives/edgar/data/1326801/000119312524197096/d874457d424b2.htm) |  |  |  |  |  |
| 53 | 0001326801 | 0001193125-26-201738 | 6 | 7.3-4 | fixed | 6.45 |  |  | 4000000000 | USD | 2066-05-15 | [424B2](https://www.sec.gov/Archives/edgar/data/1326801/000119312526201738/d109954d424b2.htm) |  |  |  |  |  |
| 54 | 0001341439 | 0001193125-25-217490 | 1 | 7.3-4 | fixed | 4.45 |  |  | 3000000000 | USD | 2030-09-26 | [424B2](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) |  |  |  |  |  |
| 55 | 0001341439 | 0001193125-25-217490 | 2 | 7.3-4 | fixed | 4.8 |  |  | 3000000000 | USD | 2032-09-26 | [424B2](https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm) |  |  |  |  |  |
| 56 | 0001551152 | 0001104659-25-015715 | 2 | 7.3-4 | fixed | 4.875 |  |  | 1000000000 | USD | 2030-03-15 | [424B5](https://www.sec.gov/Archives/edgar/data/1551152/000110465925015715/tm255723-6_424b5.htm) |  |  |  |  |  |
| 57 | 0001551152 | 0001104659-26-092114 | 4 | 7.3-4 | fixed | 4.875 |  |  | 1500000000 | USD | 2031-09-15 | [424B5](https://www.sec.gov/Archives/edgar/data/1551152/000110465926092114/tm2621452-3_424b5.htm) |  |  |  |  |  |
| 58 | 0001571949 | 0001193125-25-272388 | 1 | 7.3-4 | fixed | 3.95 |  |  | 600000000 | USD | 2028-12-01 | [424B5](https://www.sec.gov/Archives/edgar/data/1571949/000119312525272388/d96893d424b5.htm) |  |  |  |  |  |
| 59 | 0001917598 | 0001193125-25-148908 | 1 | 7.3-4 | fixed | 4.5 |  |  | 600000000 | USD | 2030-07-01 | [424B5](https://www.sec.gov/Archives/edgar/data/766704/000119312525148908/d56051d424b5.htm) |  |  |  |  |  |
| 60 | 0002058265 | 0001193125-25-120844 | 2 | 7.3-4 | fixed | 3.25 |  |  | 1000000000 | EUR | 2032-05-19 | [424B5](https://www.sec.gov/Archives/edgar/data/78003/000119312525120844/d910320d424b5.htm) |  |  |  |  |  |

### Open after today
1. **Data-Identity Lead:**
   - adjudicate the 60-row sample (AC12);
   - sign or reject the 3 C3 link proposals (Lowe's → 1753, NextEra Energy Capital Holdings → 27953, Welltower OP LLC → 2289); each is an `UPDATE` to `manual`, ≈ 2 writes;
   - raise the 004 DQ items: GM Financial, Welltower Inc and Pfizer Netherlands have no entity; entity 2289 stores Welltower Inc's CIK.
2. **Operations Lead:** confirm the AC13 reconciliation above.
3. **Main Lane:**
   - commit list (ML-1012-2): `App/Corporate Atlas/bonds/` (except `state/`) and `App/Corporate Atlas/migrations/008-bonds.sql`;
   - close-out review by a **fresh** Architect session (B-3, B-4, L8-12 and the three day-2 interpretations).
4. **Not done by design:** no recurring schedule (§3).
   - The next incremental run is manual, outside freezes, and **not during 17–23 Oct** (011 window).
   - 009 must treat rows as served only once AC12 passes (§14.2: a fail blocks 009 reads).
