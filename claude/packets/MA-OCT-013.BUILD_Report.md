# MA-OCT-013.BUILD — Report (LANE-1-ENG, Engineering Lead)

**Outcome: built, tested and dry-run. Reported 07:28Z Thu 5, ahead of the 15:00Z hard stop.**
- Commit **`3c8866b`** on `October-2026`, pushed.
- **0 D1 writes.** D1 reads in all: 67,983 (schema 228 + export 67,755).
- Ready for MA-OCT-013.CHECK.

## Opener (20:59Z Wed 4)
- **Hashes:**
  - Control `ef2174da…ae9d` matches board row 108;
  - Task `b6518a01…a345` matches;
  - `MA-OCT-013.SPEC1_Report.md` exists;
  - spec rev 1 `e6dc85677278ef672c47a73c021395c6d1f65146b661d426a411f51cae57f098` matches.
- **Environment:**
  - wrangler 4.96.0 via `/usr/local/bin/wrangler`, `whoami` OK;
  - no `.git/*.lock`;
  - own worktree `~/MeridianAtlas-work/ma-oct-013/build-worktree`, from `f362131`.
- **Work split:** most of the build was written Wed 4, 21:00–21:20Z. The session paused at a usage limit, so the interim report is superseded by this one. The rest was done Thu 5, 06:09–07:28Z.

## 1. Files (commit `3c8866b`, explicit paths)
| Path | SHA-256 |
|---|---|
| `App/Corporate Atlas/lib/merge-013-core.mjs` (new) | `5b08b958a6538db87b47aecf2362758f82beca5bdcd201d01d566964bf71672d` |
| `App/Corporate Atlas/scripts/merge-013.mjs` (new) | `4d643f1ab78ffb45048cd072c352443855fa2df704d0a865ee89a60d8654d103` |
| `App/Corporate Atlas/scripts/merge-013.sh` (new, +x) | `0034db646598d9ccb12da9311629f133ce6fefcba1fe1cee14a8a9377bcbf24f` |
| `App/Corporate Atlas/migrations/ma-oct-013-entity-merge-redirect.sql` (new, **not applied**) | `82765b1097a3a308c0cd6c241fc472f33ca789f9bd09a414a46da574f9879816` |
| `App/Corporate Atlas/tests/merge-013.test.mjs` (new) | `7d735000fbd19b1bcea9f36b71ed2338efbbcefdbccb1b20dbf7f2b9914769cb` |
| `claude/packets/MA-OCT-013.BUILD_RunSheet.md` (new) | `4050ef755d3231a0c00d6921aab195a03671ccfe01189d2ea4e29fd7117c57aa` |
| `.gitignore` (mod) | `.merge-013-paused`, `.merge-013-stop` |

**Deviation from the §17 build list:** the flags were added to the **root** `.gitignore`. `App/Corporate Atlas/.gitignore` does not exist, and the 011 flags already live in the root file. The secret scan of every committed file found 0 key-like strings.

## 2. What the runner does (rev 1, A2 pattern)
- **Entry point (Ops M-2):**
  - every command goes through `merge-013.sh`, which sources `~/MeridianAtlas-work/merge-013/013.env`;
  - line 1 of the output is `WORK_DIR=… JOB_ID=manual.entity-merge-013`;
  - `init` sets modes 600/700 and never overwrites;
  - it refuses an env pointing at 011 / A2, or a wrong `JOB_ID`;
  - it uses its own flags, and `stop` SIGTERMs only a pid whose command line is `merge-013.mjs`.
- **Plan (§5):**
  - built from a read-only keyset export (5k pages, with `cik`);
  - the plan-time assertions refuse the plan on: M-6 disjointness; an I-1 reject; a bad signature file; the R guard (> 5k, ±20 % of 62, or > 10k repoint writes); a missing index;
  - holds (listed): unsigned I-1 pairs; new I-1 pairs; N-2 mismatch; changed state; a Filings/13F reference; `do_not_merge`; protected 103540;
  - `fund_entity_link` and guard-table rows → referred, never repointed;
  - new pairs → November list.
- **Statements (§6.2):**
  - step 1 is an `INSERT` (not `OR IGNORE`) of the redirect token under the full predicate P;
  - steps 2–6 each need T plus their own CAS;
  - step 4 carries the dangling-reference guard;
  - `cik` is fill-only;
  - step 7 is the (iii) LEI with W1-A, `lei IS NULL` and the post-merge key.
- **Batches:** one 50-merge batch is one D1 call, so one transaction.
- **Allow-list (§6.4):** checked on every rendered statement and again in the transport at execute time.
- **Gates (§9):**
  - index preconditions (hard stop, matched on name and column list);
  - `hold_all_jobs`;
  - the boost pause row, the 17:50 end event and the pause flag;
  - flags;
  - the calendar (FREEZES bands with the own "013 run" window skipped, 21:58–22:02, no start ≥ 23:15, no write ≥ 23:30, Sunday, Monday < 08:00);
  - `d1-today` headroom (011 rules);
  - the 33k / 70k caps on Thu 5 (25k / 60k on any other day).
- **Stop at a batch boundary** writes `remainder.json` + `.sha256`.
- **Restore (§11):** in the Arch M-1 order, then verified byte for byte against the batch pre-image.
- **Reuse:** headroom, rendering helpers, run log and outbox come from 011. Not reused: 011's transports and calendar, which hard-code 011's allow-list and run windows. 011 code is unchanged.

## 3. Tests: `tests/merge-013.test.mjs` **87/87**
| # | MUST-FIX | Result |
|---|---|---|
| T-1 | Arch M-1 | merge → (iii) LEI → restore **byte-identical** (runner end to end); restore order asserted; three-way/OTP shape round trip |
| T-2 | Arch M-2 | changed after the pre-image → 0 changes; class `raced`; redirect with a live duplicate = breach |
| T-3 | Ops M-4 | 10 unplanned-child cases → step-1 miss, 0 changes; delete guard refuses with the token forced |
| T-4 | Arch M-2 W1-A | LEI held elsewhere → 0 changes; `lei IS NULL` CAS |
| T-5 | Arch M-4 | `cik` fill-only, skipped when held elsewhere, never overwrites, NULL on restore |
| T-6 | I-1 | FUJI / Nice / ALPHA refused; reject in the set or signature file → refused; the 6 need a signature |
| T-7 | Arch M-6 | chain, duplicate twice, existing redirect, three-way holder → refused |
| T-8 | ETF MF-2 | ETF table, 13F/Filings write, `fund_entity_link` write refused at render and at execute (`exec_refused`); `fund_entity_link` row → merge referred, others merged |
| T-9 | Arch M-3 / ETF MF-1 | Filings/13F row (plan) and a fact by `cik` (execute) → held |
| T-10 | Ops M-5 | 33k / 70k (Thu 5), 25k / 60k otherwise, `headroom_unavailable`; calendar (23:15, 21:58–22:02, band, Sunday, Monday < 08:00, no FREEZES); 23:30 write stop; batch-boundary stop + `remainder.json` with SHA |
| T-11 | Ops M-2 | init 600/700, no overwrite; WORK_DIR/JOB_ID first; refuses 011/A2 dir and wrong job; `stop` signals only the 013 pid; SIGTERM → `killed`, 0 writes |
| T-12 | BUILD | 4 missing indexes, and a right name on the wrong columns → refused before any write |
| T-13 | Arch M-5 / N-2 | seed upsert after the merge: 0 inserts (two-way); three-way twin re-inserted (documents the hold); N-2 mismatch held |
| T-14 | Arch N-1 | single hop; the real 007 R2/R3 route resolves merged 1010 → 10 |
| T-15 | Ops M-1 | job, emitter and 900 s on start + terminal events; a foreign emitter key refused; run-log fallback |
| T-16 | Ops M-3 | no pause row → held; no 17:50 end event → held; both → starts |

**Fails on today's tree:**
- on `f362131`, the suite exits 1 (module not found);
- with only the core lib dropped in, it also exits 1.

**Mutation checks (6):**
- **5 killed:** step-4 guard removed; step-1 child probes removed; execute allow-list removed; restore order changed; cik "held elsewhere" removed.
- **1 equivalent:** dropping the render-time allow-list is still caught at execute by T-8.

**Regression:**
- nav-007-worker 58/58.
- `gleif-reconcile-011.test.mjs` 41/42. The failing test, "heartbeats through the real 002 outbox", **fails identically on the untouched base `f362131`** in the shared checkout. It is pre-existing and not 013's; flagged to the Main Lane.

## 4. Export and plan (read-only, Thu 5 07:11:23–07:12:05Z, outside every band)
- **Export:** `~/MeridianAtlas-work/ma-oct-013/build/export-thu5`, manifest `6133c424…8b06`.
  - **69 calls, 67,755 reads, 0 writes**; largest execution 5,000 reads.
  - The spec planned ≈ 45k for the keyset plus ≈ 6k for probes. The extra is the 1,868-row queue and child IN-list probes; still ≤ 45k per execution.
- **Rows:**
  - `entity_master`: 44,517;
  - instrument links on candidates: 63 (62 run set + 1 on sign-eligible 92126);
  - queue: 1,868;
  - guard and Filings/13F tables: **0** on any candidate;
  - `fund_entity_link`: 264 (scan), 0 on candidates;
  - redirects: none (table absent);
  - `do_not_merge`: 3 tickets → ids 931/1216, 2589/25577, 2014/25655, **none in the run set**.
- **Plan `ea8bace81ff9b5d2ea072d82f510e2fb451235ff15034cd70acd06b2d722c02d`:**
  - **1,862 merges, 38 batches, R = 62, 2 cik fills, 3 (iii) LEIs, 30,395 writes declared** (§8: ≈ 30,396);
  - held: the 6 sign-eligible (no signature); every other held list 0;
  - **154 new groups** → `new-pairs.json` (November list).
- **This plan is a BUILD reference only.** RUN re-exports at R3 and must match it (run sheet).

## 5. Replica dry run (local SQLite, no D1 writes; `build/dryrun.sh`)
| Step | Result |
|---|---|
| Replica | built from the export with the live DDL; hash `52ac0591…d45b` (`entity_master` 44,517 / queue 1,868 / iem 63) |
| `migrate` | `entity_merge_redirect` created |
| `run` (clock Thu 18:20Z, account 5k, ops gates off: local only) | **38 / 38 batches, 1,862 merged, 0 raced, 0 breach, 0 stop conditions** → `entity_master` 42,655 (−1,862), queue 6, redirects 1,862 |
| `lei` | 3 / 3 applied (113390, 110563, 2778) |
| `verify` | `ok: true`: 0 live duplicates, 0 missing survivors, 0 survivor = duplicate, every reference probe 0, 0 held ids merged |
| Writes (modeled, §8 basis) | 29,918 merges + 456 heartbeats + 21 LEI = **30,395**, within 2 % of §8 |
| `restore --all` | 38 batches, 1,862 merges, **all byte-identical**; table hash back to `52ac0591…d45b` |

- **Covered by the tests:**
  - allow-list fails closed on an ETF-table statement: T-8;
  - `do_not_merge` / I-1 reject refused: T-6, plan;
  - `headroom_unavailable` fails closed: T-10.
- Ledger `build/dryrun-work/d1-ledger.jsonl` `d6ac5239…e615`.

## 6. Run sheet
- `claude/packets/MA-OCT-013.BUILD_RunSheet.md` (`4050ef75…57aa`) covers R0–R8 with exact commands.
- It also has the kill switch / pause / status table, the per-batch restore, the remainder rule, the boost pause SQL (Ops) and the signature-file format.
- Target start ≥ 18:15Z.

## 7. For CHECK / RUN
1. **Build-list deviation:** root `.gitignore` (§1).
2. **The live `entity_master` export costs ≈ 45k reads at R3.** The runner's whole export is ≈ 68k reads, within the §8 156k read plan.
3. **R1 (registry row + emitter key) is the Operations Lead's step.** Without it the run uses the R-4 run log.
4. **The 6 sign-eligible pairs are merged only with the Data-Identity signature file** at R3.
5. **Pre-existing 011 test failure:** see §3.

**Hygiene:**
- no secrets read; no macOS prompts;
- explicit-path staging; nothing on `September-2026`;
- `13F Seed/gleif-seed.js`, `.env*` and `.claude/settings.local.json` untouched.
