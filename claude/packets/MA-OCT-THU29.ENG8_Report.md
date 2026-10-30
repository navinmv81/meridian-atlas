# MA-OCT-THU29.ENG8 — Report (LANE-8-ENG, Engineering Lead)

Control `9ad7cc98…49fc5` and Task `e5313229…3203`: both re-hashed, and both match the board row (line 80). No `.git/*.lock`. Branch `October-2026`. Opened at 19:31Z.

**Pre-flight (19:32Z):**
- `wrangler whoami` (4.96.0): logged in.
- Live `meridian-ops` = `14aa968c` (since 24 Oct).
- No other THU29 lane report on disk; 004 not deployed.
- `d1-today` 95.
- `origin` `acfd069`, with nothing new under `App/Ops` since `16b2b10`.

## Change log (UTC)
- 19:34Z: commit **`fd7b753`**, the deploy-4 tree by explicit path (ops-api.js, wrangler-ops.toml, sweep-ext.js, sweep-ext-contract.mjs). Suite green. Pushed `acfd069..fd7b753`.
- 19:33Z: **starting** deploy 4 (`meridian-ops`, from `fd7b753`, clean worktree). **Rollback = `14aa968c-dcb8-45fc-afbd-d16d8b72aa20`.**
- 19:33:56Z: **deploy 4 live: `meridian-ops` `2e4c3fc6-b56b-4ce0-b7df-24954d05afb9`** (from `fd7b753`; previous `14aa968c`).
- **004 base = `fd7b753`.** The Founder was told in chat at ≈ 19:36Z: "deploy 4 live — 004 base = fd7b753".

## Step 1: deploy 4 ✅
**After deploy:**
- `budget-risk` and `d1-today` → 200;
- admin without a session → 302 to Access;
- `d1-today` 95;
- endpoints 11 of 15 (deploy 4 adds none).

**One manual sweep (19:34:36Z):**
- Run from the worktree's runner, which is byte-identical to `f444ce7`; trigger `manual`, `HEALTH_CHECK_NO_NOTIFY=1`.
- Run `c8598479…`; start and success heartbeats both HTTP 201.
- **The full logged response now carries the sweep fields:**
  - keys: `already_open, auto_resolved, autoresolve_skipped_reopened, daily_cap, etf, findings, gleif_checks, headroom, hold_all_jobs, lookback_days, new, ok, open_counts, overflow, raised, raised_today_before, rows_read, run_id, s2_rows_read, suppressed`;
  - values: `raised` 0, `findings` 12, `already_open` 12, `overflow` 0, **`suppressed` 0**, `s2_rows_read` {}, **`gleif_checks` {e2: null, e4: null}**, **`auto_resolved` 2**, `autoresolve_skipped_reopened` 0, open sev2 2 / sev3 19, `rows_read` 263.
- **E2/E4 are null as expected.** This was not the first sweep of the UTC day (BREVD N-1). E2/E4 first run at the Fri 30 08:00Z sweep.
- **Auto-resolved, read back from D1** (both `job_missed` for the health-check's own clock-change-day slots, resolution `replayed`, by `service:health-check-local`; well under the cap of 20):
  - `EXC-S-6B07AF310592`: 25 Oct 18:00Z slot;
  - `EXC-S-369787EDD1D2`: 25 Oct 22:00Z slot.
- **No mass resolve or suppress.**

**Rollback (not needed):** `wrangler rollback 14aa968c-dcb8-45fc-afbd-d16d8b72aa20`, or set `OPS_SWEEP_GLEIF_CHECKS` / `OPS_SWEEP_AUTORESOLVE` to `"false"` and deploy.

## Step 2: 008 R-2 (spreads)
**Parser `bonds-1.2.0`, commit `845614f`.** Three fixes, from the cached source text:

| Fix | Problem | Change |
|---|---|---|
| **A** (Toyota MTN) | The labelled field "Spread: +65 basis points" sits 1,626 characters past the tranche anchor, beyond the 1,200 window | That field alone is searched in a 3,000-character window, still cut at the next tranche |
| **B** (Capital One, American Express) | (1) "base rate … plus 2.260%" was not a known benchmark wording. (2) The fixed-to-floating stop rule (`\d.\d%`) matched **the spread value itself** and cut the window just before it | "base rate" added; a rate preceded by "plus" / "Spread of" no longer counts as a stop |
| **C** (Home Depot) | The tranche's own "Compounded SOFR plus 0.330%" is at the 74th anchor; the cap was 60 | Cap raised to 150 |

**Tests:**
- +5 tests (sample rows 43, 44 and 46, an American Express fixed-to-floating filing, Home Depot, plus the version), on 5 new cached SEC fixtures.
- Parse **31/31**; the old parser fails all 5. Ingest 17/17.

**Differential, old vs new parser, over all 632 stored filings** (cache, 0 SEC requests):
- **37 row changes, all spread/benchmark fills.** 12 of them also raise `parse_confidence` 70 → 85: a floating row is complete once its spread is found.
- The 37 changed keys are **exactly** D1's 37 spread-less finals:
  - American Express 14;
  - Toyota 11;
  - Capital One 11;
  - Home Depot 1.
- **0** other field changes anywhere.
- **Values:** 33–226 bps, SOFR, except Capital One `0001193125-26-387878` (EUR notes), where EURIBOR is correct (+1.072% / +1.451%, read from source).
- **Rounding:** the INTEGER column rounds to whole bps, e.g. 1.905% → 191 and 0.581% → 58.

**Re-parse method (R-2 scope: `parser_version = 'bonds-1.1.0'` and the 4 named CIKs, 191 rows):**
- **Why not a plain re-parse:** it would have changed 15 Toyota rows' CUSIP/ISIN (taken from same-deal FWPs by the live run) and 3 Home Depot confidences (FWP cross-check). Those are effects of the missing FWPs, not of the parser change.
- **What the new rows are instead:** each is **the stored row, plus only the fields the 1.1.0 → 1.2.0 change alters for it**, with `parser_version` and `ingested_at` updated.
- **Proof:**
  - for all 37 changed rows, the stored row equals the old parser's plain output, so they carry no FWP effect;
  - the delta is limited to `spread_bps`, `benchmark` and `parse_confidence`;
  - 0 problems.
- The result equals what an incremental re-ingest would produce, without re-discovery drift (a moving lookback window, or filings added since 16 Oct).

**Batch:**
- One `--command` batch of **192 statements**: a **count-guarded** DELETE (it applies only if exactly 191 rows match), then 191 `INSERT OR IGNORE` (the runner's own `insertSql`).
- If the guard fails, the inserts are ignored on their existing primary keys, so nothing changes.
- Files:
  - SQL: `bonds/state/r2-reparse-2026-10-29.sql` `673979ef…a167`;
  - rollback: `…rollback.sql` `1132a2d3…04bf`. It restores the exact pre-write rows, count-guarded on 1.2.0 = 191.

**Three-point check (before the write):**
1. **Plan.** The DELETE is a `SCAN bond_issuance` (943 rows), run twice with the guard, so about 1.9k reads. That is the declared small-table scan (§16's coverage query is the same). The INSERTs go by PK.
2. **Single execution < 50k.** ≈ 1.9k reads; writes below.
3. **Budget.** Cost model `writeCost`, delete plus insert (computed below). `d1-today` 95 at 19:41Z. F-5 ceiling 60,000. Inside DIL14's ≈ 1.3k estimate and the 8k day cap.

**No serving gate is created or opened.**

**Write estimate:** 191 rows (165 final, 91 keyed): 638 delete + 638 insert = **≈ 1,276**.

- 19:42Z: **starting** 008 R-2 re-parse batch (`bond_issuance` only; no other lane mid-change, `meridian-ops` deploy 4 already verified).

### R-2 result ✅ (19:42:21Z, one batch, 192 statements, all success)
| Statement | changes | rows_written | rows_read |
|---|---|---|---|
| Guarded DELETE | **191** | 191 | 2,077 |
| INSERTs | **191** | 638 | — |

- **Total 829 writes** (estimate ≈ 1,276; D1 counts delete-side index entries lower). Reads 2,484.
- **Read-back:**
  - the 4 CIKs hold **191 rows, all `bonds-1.2.0`**, and every row is **byte-identical** to the rebuilt set (keys and all columns);
  - **spread-less floating / fixed-to-floating finals: 0 population-wide** (was 37);
  - table totals unchanged: final 633, parse_failed 9, preliminary 184, skipped_non_debt 45, skipped_other 51, skipped_structured 21.
- **Sample rows:** 43 → 65 bps SOFR, 44 → 48 bps SOFR, 46 → 226 bps SOFR.
- **Re-run:** 0 changes (the guard blocks it).
- **Commits:** `845614f` (parser, tests, fixtures).

## Step 3: 008 R-3 (filer-list re-scan): tool ready, run ⏸ waiting for the SEC User-Agent
- **Tool:** `bonds/bonds-filer-scan.mjs` plus `tests/bonds-filer-scan.test.mjs` (4/4), commit **`71fab4b`**.
  - It goes through the runner's `secClient`: `SEC_USER_AGENT`, ≥ 200 ms, cap 400 for this run, ledger `bonds/state/r3-sec-requests.jsonl`.
  - Report only; no D1 access.
- **Inputs (read-only D1):** 326 final filings, 34 links.
- **Index pages cached:** 0, so **326 EDGAR requests** are needed (inside the 1,500 cap).
- **Why it's held:** `SEC_USER_AGENT` is not set in this environment, and its value (a name plus a contact e-mail) is not recorded in the repo or the request ledger. SEC needs a contact e-mail in it, and this lane will not put the Founder's e-mail into third-party requests without the Founder saying so.
- 20:14Z: **starting** R-3 scan (SEC EDGAR index pages only; D1 read-only). Founder instruction in chat: User-Agent "Meridian Atlas" plus the Founder's account e-mail, for R-3 only. It was set as an environment variable for that one command and never written to a file. Done at 20:16:51Z.

### R-3 result ✅: **0 co-registrants under a parent CIK** (stop condition not met; D1 read-only)
- **Requests:** **326** (cap 400 for the run, 1,500 runner cap). 322 → 200, **4 → 503**, not retried: the Task caps R-3 at 326.
- **Verdicts:**

  | Verdict | Filings | Detail |
  |---|---|---|
  | single filer | **300** | — |
  | stored under their own co-registrant CIK | **19** | NextEra Energy Capital `0000794447` 15, Welltower OP `0001917598` 2, PepsiCo Singapore `0002007029` 1 (R-1, last night), Pfizer Netherlands `0002058265` 1 |
  | other filers not on the cover | **3** | Comcast `0001166691` ×3: filers NBCUniversal Media LLC and Comcast Cable Communications LLC are **subsidiary guarantors**, not named as issuers. DIL14 §1 already lists these as false hits. Correct as stored |
  | index unavailable (503) | **4** | adjudicated from the cached covers below |
  | **CANDIDATE** | **0** | — |

- **The 4 index-unavailable filings**, checked from their cached covers with 0 requests using the parser's `coverIssuers` / `coverIssuerHint`:
  - Dominion `0001193125-24-132931` and `-24-259704`, and Verizon `0001193125-25-170770`: no co-issuer named and no "guaranteed by", so each is the filer's own issuance;
  - Welltower OP `0001193125-25-171785`: the cover names Welltower OP LLC, guaranteed, and it is **already stored under its own co-registrant CIK** `0001917598`. That makes the full co-registrant count 20, as expected.
- **Files:**
  - report `bonds/state/r3-filer-scan-2026-10-29.json` `25ea49b56c5ad3154b0f9713763c9c47e9928dc0770f29b79ae59d6c2227dcae`;
  - request ledger `r3-sec-requests.jsonl` `fd963c398b3b51ae737fc4853f7f5a81c654e6bf7e09166a3480870c213282b6`.

  Both are in `bonds/state/` (gitignored), worktree and shared.

## Step 4: AC12 evidence pack for the Data-Identity Lead (re-adjudication)
DIL14 §5's pass conditions, and where each one stands:

| DIL14 §5 condition | Evidence | Status |
|---|---|---|
| **0 wrong-issuer links in the sample** (row 9, P-1) | R-1 (Wed 28, WED28.ENG8 report `edeaadde…d715`): the 4 PepsiCo Singapore rows moved to `0002007029` (`unmatched`, `paused`). M-3 PASS. SQL `r1-pepsico-sg-2026-10-28.sql` `d6f33154d13e8831899d6fea7ec3839ceebbc72806f7ce9b4801cd45afe379fc` | **For DIL:** confirm the **in-place re-point** (one guarded UPDATE of `cik`) in place of delete + re-ingest. Re-ingest would have re-created the guarantor link, because the parser's cover hint misses this filing |
| **0 wrong-issuer links population-wide** (R-3) | 0 candidates in 326 final filings, as above | Met, subject to DIL review of the 3 Comcast and 4 cover-checked filings |
| **The 37 spreads ≥ 98% correct** (R-2) | Parser 1.2.0 (`845614f`); all 37 filled; the list with before/after values is `bonds/state/r2-fills-2026-10-29.json` `81d393e30984d04295e5669ed74fea61da225d7830eb233fcb59b6c2dc946e58` | **For DIL:** check the 37 against source. Integer bps rounds half-bps (1.905% → 191; 0.581% → 58; 0.867% → 87). Capital One `-26-387878` is EUR / EURIBOR |
| **The 4 error rows re-adjudicated** (43, 44, 46 + row 9) | 43 → 65 bps SOFR; 44 → 48 bps SOFR; 46 → 226 bps SOFR (coupon 6.051% unchanged); row 9 → issuer CIK `0002007029` | For DIL |
| **Fresh 10-row random check of the re-parsed CIKs** | Population: the 191 `bonds-1.2.0` rows under the 4 CIKs. All non-spread columns are byte-identical to before R-2 (differential plus read-back) | For DIL: draw the 10 |
| **60-row field accuracy ≥ 98%** (with corrections) | Before: 237/240. Rows 43, 44 and 46's 3 spread errors are now filled, so **240/240 if the DIL confirms them** | For DIL |

**R-2 method notes for the DIL:**
- The new rows are **the stored rows plus only the 1.1.0 → 1.2.0 delta**. A plain re-parse would have dropped 15 Toyota FWP-sourced CUSIP/ISINs and 3 Home Depot FWP cross-check confidences.
- Proof: the 37 delta rows equal the old parser's output exactly, with no FWP effect; 0 problems.
- 12 rows also gain `parse_confidence` 70 → 85.

**R-2 files:**
- SQL `r2-reparse-2026-10-29.sql` `673979efd48d474a2af40a27b1373bdf7b5b13ee0a0c448de1f03771cabaa167`;
- rollback `…rollback.sql` `1132a2d3a931963639f60c8c600e5113e95da2bba3056013dbe79d9bd07c04bf`, which restores the exact pre-write rows.

**Not in this packet:** R-4 (the remarketing rule).

**Serving gate:** not created and not opened. It belongs to 009, and the Data-Identity Lead opens it.

## Close-out
**Steps:** 1 ✅, 2 ✅, 3 ✅, 4 ✅ (pack above).

**Production changes, one at a time:**
1. deploy 4 `2e4c3fc6` (19:33:56Z);
2. the manual sweep (19:34:36Z);
3. the R-2 batch (19:42:21Z).

R-3 made 326 SEC reads and no production change.

**D1 by this lane:** 829 writes from R-2, plus the sweep's own writes (2 auto-resolves with events). Reads about 8k.

**Git (explicit paths, ML-1028-1):** `fd7b753` (deploy 4), `845614f` (R-2), `71fab4b` (R-3 tool), all pushed. This report is not committed.

**Left untracked:** `bonds/state/`, which holds `r2-reparse-2026-10-29{,.rollback}.sql`, `r2-fills-2026-10-29.json`, `r3-filer-scan-2026-10-29.json` and `r3-sec-requests.jsonl`, plus the existing state files.

**For the 004 lane:** **004 base = `fd7b753`** (deploy 4 live as `2e4c3fc6`).

**For Fri 30:** the 08:00Z sweep is the first of the UTC day, so E2/E4 run then. Expect one `gleif_stuck_in_progress` case (BREVD) if the 11 Jun row still shows.
