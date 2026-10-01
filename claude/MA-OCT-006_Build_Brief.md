# Build Brief: MA-OCT-006, GLEIF Reliability Investigation (EXECUTION) — rev 2

```text
ISSUED BY:    Program Orchestrator (October Main Lane)
EXECUTED BY:  Data-Identity Lead (local Claude Code, Clean (v11), branch October-2026)
REVIEWED BY:  Operations Lead (close-out verdict, Sat 10 Oct)
APPROVED BY:  Founder — spec approved 2026-09-26 (Q1 yes, Q2 yes, Q3 no); early start approved 2026-09-28
PACKET:       MA-OCT-006 — GLEIF reliability investigation (read-only diagnosis)
GATE:         Execution Mon 28 Sep – Fri 9 Oct → Ops review Sat 10 Oct → Founder close + MA-OCT-011 go/no-go Mon 12 Oct
```

## Revision note (rev 2, 2026-09-28)
The Founder opened this lane **3 days early** (Mon 28 Sep instead of Thu 1 Oct). Only dates and the Golden Copy publication change. **Scope, budget, read-only rules, deliverables and acceptance criteria are unchanged.** Where this brief and the spec's dates differ, **this brief wins** (spec §6.2, §6.4, §7 and §11 dates). The Operations Lead (reviewer) concurs: the change is schedule-only and adds no reads, writes or API calls.

**Amendment E1 — Golden Copy publication.** Spec §6.4 names the "1 Oct publication". Use instead **the latest Golden Copy publication available when you download on day 1**. All four files (LEI2 Level 1, RR, RX, LEI–ISIN) must come from **the same publication**. Record its publication timestamp and every file's SHA-256 in the evidence file. The ≤60 API-call freshness check (spec §6.4) is unchanged and is measured against that publication.

**Amendment E2 — shifted timeline (replaces spec §11).**

| Day | Work | Output |
|---|---|---|
| **Mon 28 Sep** (start **after 07:30 UTC**, once enrich's 06:50 run is finished) | Preflight; download the Golden Copy (E1) and build `gleif_006.db`; D0, D1 and D9 (**EXPLAIN only**) | **Report 1 (day 1)** |
| Tue 29 Sep | D2–D5 exports (~113k reads); first D6/D7/D8 after 06:50 and before the 10:50 boost; **`wrangler tail` the 06:50 enrich cron** | Exports and tail capture |
| Wed 30 Sep – Fri 2 Oct | Second `tail` (Wed 30 Sep 06:50); D6/D7 on 30 Sep and 2 Oct; H1–H13 verdicts by local replay | **Report 2 (Fri 2 Oct): H1–H13 interim verdicts.** If H4/H5 are confirmed, say so (Q3 still = no early hotfix). |
| Sat 3 – Mon 5 Oct | Classification over the full population; sample drawn and adjudicated; API freshness check. **No queries Sun 4 Oct 04:00–07:00 UTC or Mon 5 Oct during the 04:00 seed** | Classification and adjudication CSVs |
| Tue 6 Oct | Completeness cuts; relationship check; KI 22.9; MA-SEP-017 residual (13, 20 and 28 Sep) | **Report 3: interim findings** |
| Wed 7 – Fri 9 Oct | D10 trend snapshot (Fri 9 Oct); matrix draft; write-cost estimates; 011 criteria assessment | **Report 4 (Fri 9 Oct): close-out package** |
| Sat 10 Oct | Operations Lead review (Addendum §3 reviewer block) | Verdict |
| Mon 12 Oct | Founder gate: 006 close and **011 go/no-go** | Decision |

D6 still runs on **3 separate days** (29 Sep, 30 Sep, 2 Oct); the two `tail` captures are 29 and 30 Sep instead of 2 and 3 Oct. D10 moves from 12 Oct to 9 Oct. The MA-SEP-017 "bonus check" (spec §6.2) still holds: the D2 export on 29 Sep comes after the first Monday seed fire (28 Sep, MA-OCT-012 CLOSED).

## Governing document
**`claude/MA-OCT-006_Spec.md`**, SHA-256 `1dab3539c7431e532b54bffa90cc052cb83c016a6151ed6044518fcdb5c7b273`. Verify the hash before starting, and stop if it differs. Execute it as written, including §6 evidence plan, §6.3 budget, §9 deliverables and §10 acceptance criteria, with the dates and publication amended by E1–E2 above. Also read `claude/MA-OCT-006_Spec_Review.md` (Operations Lead notes N-1 to N-6), SHA-256 `6ae65d7904b597b1bfff902f9e810777f655c206237fa170013e9bb7c3d44206`.

## Founder decisions at the spec gate (26 Sep)
| Q | Decision | Effect on execution |
|---|---|---|
| Q1 | **Yes** | Download the Golden Copy (L1, RR, RX, LEI–ISIN; one publication, per E1). Use **≤ 60 GLEIF API calls** in total, for the freshness check only. |
| Q2 | **Yes** | Answer the MA-SEP-017 residual from the D2 export (13, 20 and 28 Sep), then recommend closing it. No index CR. |
| Q3 | **No** | **No early hotfix packet.** If H4/H5 are confirmed (~2 Oct), report it to the Main Lane as an interim finding; the fix goes through the matrix like every other root cause. |

## Conditions from the Operations Lead review (binding)
1. **N-1: work folder.** Use `~/MeridianAtlas-work/gleif-006/`, **not** `~/Desktop/...`. On day 1, confirm the path isn't under iCloud Drive (`ls -la ~/Library/Mobile\ Documents/` and `brctl status` or equivalent), and record the result. At close-out, delete the unzipped Golden Copy CSVs. Keep `gleif_006.db` only if 011 is GO.
2. **N-2: evidence files.** Any CSV over 10 MB goes into `claude/` as `.csv.gz` or a summary only, with the full file kept in the work folder. Record every SHA-256.
3. **Query ledger kept live.** Record each query's plan, reads and writes on the day it runs.
4. **Budget:** stop and report to the Main Lane at **200k** reads. Hard stop at **250k**. **0 D1 writes.**

## Preflight (day 1, stop on any failure)
1. `pwd` = baseline root; `git --no-optional-locks branch --show-current` = `October-2026`; HEAD = `fa9c723` or a fast-forward descendant.
2. `ls .git/*.lock` returns nothing (Addendum rule 6). If one exists, report it before touching it.
3. `npx wrangler whoami`, run interactively (not under launchd).
4. At least 25 GB free, and the work folder is not iCloud-synced (N-1).
5. Both hashes above match (spec and spec review), and this brief's hash matches the one the Main Lane gave you.
6. Time is after 07:30 UTC on Mon 28 Sep (enrich's 06:50 run finished).

## Git and commit rules
- This lane **may commit once, at close-out**, on `October-2026`. Stage by explicit path only:
  - its `claude/MA-OCT-006_*` deliverables (§9);
  - the Main Lane governance docs pending under rule 7, **only those the Main Lane lists with hashes at close-out time** (the list changes daily; ask for it).
- **Coordination:** the MA-OCT-001 build lane starts Thu 1 Oct and may commit on `October-2026` during 1–9 Oct. Before committing, run `git fetch` and `git pull --ff-only`. If fast-forward fails, **stop and report**; don't merge or rebase on your own.
- Never commit the work folder, the Golden Copy files, or `13F Seed/gleif-seed.js`.

## Do not do
- No D1 writes, deploys, cron changes, queue resets, backfills or exception writes (spec §3).
- No `/run` calls on any Worker. Runtime evidence comes only from `wrangler tail` and scheduled fires.
- No queries in the Sunday 04:00–07:00 UTC window or during the Monday 04:00 UTC seed.
- Don't touch `entities-enrich-boost-run.mjs`: MA-OCT-001 changes it from ~8 Oct (pilot emitter).

## One extra ask for the day-1 report
MA-OCT-001 needs the **Data-Identity Lead's written "yes"** to its pilot change to `entities-enrich-boost-run.mjs` (001 Build Brief A3 and A1 pilot mapping: the runner emits `skipped` / `failed` / `success` / `partial` events to `meridian-ops`). Give it, or give your objection, in one line in Report 1, quoting 001 Build Brief A3.

## Report-backs to the Main Lane
1. **Mon 28 Sep (day 1):** preflight results, including the iCloud check, the Golden Copy publication timestamp and file hashes, the EXPLAIN plans for D0, D1 and D9, and the 001 pilot "yes"/objection.
2. **Fri 2 Oct:** H1–H13 interim verdicts, especially H4/H5.
3. **Tue 6 Oct:** interim findings.
4. **Fri 9 Oct:** close-out package (§9 deliverables plus the query ledger), ready for the Operations Lead review on Sat 10 Oct.
