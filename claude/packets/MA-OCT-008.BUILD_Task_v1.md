# MA-OCT-008.BUILD — Task v1 (immutable): SEC corporate-bond ingestion build

**ISSUED BY:** Main Lane (Program Orchestrator), Wed 14 Oct · **EXECUTED BY:** LANE-8-ENG, Engineering Lead (new Claude Code session) · **REVIEWED BY:** Architect + Operations Lead (close-out); Data-Identity Lead signs AC17 · **APPROVED BY:** Founder (GATE-1012 D3 A, 10 Oct)

Build **`claude/MA-OCT-008_Spec.md` rev 1.2** (`bcdad9a2d315371b9c60b11cbcf72dfca88c99dca22fbe4e5310e2fb5f815cd3`) following its **§15.3 test plan**, with Founder answers Q1 (seed list: the 5 G-SIBs replaced by PepsiCo, Union Pacific, Lowe's, Dominion, Welltower), Q2 (issuers with no Corporate Atlas entity ingested **unlinked**; list each for a DQ ticket — 004 is not built yet, so keep the list in the report), Q3 (code in `App/Corporate Atlas/bonds/`, CR1 approved). All spec rulings (L8-1..L8-11, A8-1..A8-6, Ops R-1..R-5, A-1) bind.

## Calendar (spec §12.4: pilot Thu 15, initial load Fri 16, both before the 011 window; else Tue 27)
| Day | Work | D1 writes |
|---|---|---|
| **Wed 14 (today)** | §15.3 steps 1–2: parser + runner + control scripts; fixtures and unit tests; **dry run over all 30 issuers** (SEC requests ≤ 1,500, User-Agent per §9.2, ≥ 200 ms apart). Report counts by `filing_status` and 20 random parsed rows. | **0** |
| **Thu 15** | Only after **MA-OCT-T12** (LANE-1-ENG, Thu morning) reports your registry row `local.bonds-ingest` and emitter `local-bonds` live, and the **Data-Identity Lead has signed AC17** (the skipped rows) — both come from separate packets. Then step 3 migration `008-bonds.sql` + P-B1..P-B3; step 4 Pack C + `bond_issuer_link` seed; step 5 **live pilot** (ICE, UnitedHealth, Toyota Motor Credit), multipliers recorded. | ≤ ≈ 500 |
| **Fri 16** | Step 6 **initial load** (re-declare first if any multiplier > 4.5×); step 7 sample + Ops reconciliation inputs. Must finish before **Sat 17 00:00 UTC** (011 window). If it can't, stop at a clean cursor; next slot Tue 27. | ≤ 8,000 |

## Binding gates
- §9.3 gates in order; FREEZES.json read at start and before every batch.
- **ML-1012-1 replaces §9.3 A-1's derived values:** account ceiling **60,000**; F-1 own-row window **max(45 min, since last fetch)**. Run cap 8,000/day; stop at > 1.3× declared.
- Wrangler `App/Corporate Atlas/node_modules/.bin/wrangler` (now pinned 4.96.0, commit `3960aee`) or `/usr/local/bin/wrangler` 4.96.0; never `npx`.
- Weekdays Tue–Fri only for live writes; never during 17–23 Oct.

## Limits
- **No git writes (ML-1012-2):** LANE-1-ENG is the only committer; the Main Lane issues a commit list for `App/Corporate Atlas/bonds/` and the migration when this packet closes.
- Touch only `App/Corporate Atlas/bonds/**` and the new migration file. Do not edit Ops code, A4/A5 files, 011 files or Entities Workers.
- Secrets: the emitter key is read by path from `~/.meridian-secrets/` (600) once T12 creates it; never printed. **ML-1013-3:** stop and tell the Founder before any command that could raise a macOS password or permission prompt.

## Report
Append one dated section per day to `claude/packets/MA-OCT-008.BUILD_Report.md` (work, tests, SEC request count, D1 reads/writes per statement, file list with SHA-256, the unlinked-issuer list, questions). Stop at the end of each day and reply one line: **"MA-OCT-008.BUILD day <date> reported"**.
