# MA-OCT-006 — Day 7 run instructions (Mon 5 Oct 2026): D10 snapshot, final re-sync, close-out FINAL

```text
ISSUED BY:    Data-Identity Lead (packet owner), via Founder
EXECUTED BY:  Data-Identity Lead (local Claude Code, Clean (v11), branch October-2026)
REVIEWED BY:  Operations Lead (close-out review)
APPROVED BY:  Founder (gate Mon 12 Oct)
PACKET:       MA-OCT-006 — GLEIF reliability investigation (read-only diagnosis)
GATE:         Execution day 7 → close-out package FINAL, ready for the Operations Lead
```

Purpose: take the last D1 trend snapshot, bring every 006 file into agreement with the day-6 rulings, and turn the DRAFT close-out into the final package.

## Paths

| Name | Absolute path |
|---|---|
| REPO | `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)` |
| CA | `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)/App/Corporate Atlas` |
| CLAUDEDIR | `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)/claude` |
| WORK | `/Users/navinkumar/MeridianAtlas-work/gleif-006` |
| DAY7 | `WORK/day7` |
| GLEIFDB | `/Users/navinkumar/MeridianAtlas-work/gleif-006/gleif_006.db` |

Quote every path; they contain spaces and brackets.

## Governing documents (unchanged)

- `CLAUDEDIR/MA-OCT-006_Spec.md`, SHA-256 `1dab3539c7431e532b54bffa90cc052cb83c016a6151ed6044518fcdb5c7b273`.
- `CLAUDEDIR/MA-OCT-006_Spec_Review.md`, SHA-256 `6ae65d7904b597b1bfff902f9e810777f655c206237fa170013e9bb7c3d44206`.
- `CLAUDEDIR/MA-OCT-006_Build_Brief.md` (rev 2).
- Day-6 outputs: `MA-OCT-006_Remediation_Matrix.md` (SHA `ce93f54f…bea6`) and `MA-OCT-006_Closeout_Summary.md` (SHA `942f4a06…0abc`). Check both hashes before editing; stop and report if either differs.

## Rules for this run

1. **D1 queries are allowed only in Step 1, only from 07:05 UTC** (after the 04:00 seed and the 06:50 enrich run), each with `EXPLAIN QUERY PLAN` first, in exactly the as-run form, through the existing `d1q.sh`. Stop and report at 200k cumulative reads (currently 92,300); hard stop at 250k. No single execution over 50k reads.
2. **No GLEIF API calls** (52 of 60 used; the remaining 8 stay unused unless the Operations Lead asks for a re-check).
3. No D1 writes, no `/run` calls, no deploys. **No `git add`, `commit` or `push` in this run.** The single close-out commit happens later, after the Operations Lead's verdict, with the file list and hashes the Main Lane provides (Build Brief "Git and commit rules").
4. In REPO, change only the 006 files: `MA-OCT-006_Evidence.md`, `MA-OCT-006_Query_Ledger.md`, `MA-OCT-006_Remediation_Matrix.md`, `MA-OCT-006_Closeout_Summary.md`, `MA-OCT-006_classification.csv`, `MA-OCT-006_sample_adjudication.csv`. Never edit MA-OCT-011, MA-OCT-013 or Main Lane files.
5. Any new in-lane ruling or deviation goes in a "Rulings for the Main Lane (today)" block.

## Step 0 — Preflight

- `date -u` (must be 07:05 UTC or later before Step 1 runs). Branch `October-2026`; `ls .git/*.lock` returns nothing.
- Spec, spec review, matrix and DRAFT close-out hashes match the values above.
- `mkdir -p` DAY7; record `du -sh` WORK.

## Step 1 — Final runtime snapshot (D1, read-only)

- **D10** (spec §6.2): `SELECT status, COUNT(*) FROM entity_enrichment_queue GROUP BY status`. Expected plan `SCAN … USING COVERING INDEX idx_enrich_queue_status`, about 29k reads. Compare with D3-0929 (29 Sep) and with MA-OCT-000's 26 Sep figures.
- **D8** (same key list as day 4, dates `2026-10-05` and `2026-10-04`): about 15 reads.
- **D6** (exact Phase 3 SELECT, `LIMIT 45`): about 5.5k reads. Report the head position in the day-2 pool order, positions advanced since 1 Oct, implied successful runs (cross-check the boost log and heartbeat log since 1 Oct), and the updated days-to-clear estimate.
- Outputs to DAY7 with SHA-256s; ledger rows written as each query runs.

## Step 2 — Pilot H11 tally (read only)

- From `CA/logs/entities-enrich-boost.log` and `CA/logs/entities-enrich-boost-heartbeat.log`: every fire since the split time 2026-10-01 19:08:13 UTC — slot, fire time, outcome, `/run` called or not, terminal heartbeat delivered or not.
- Summarise: fires, failures (and cause), heartbeats not delivered, late fires. Record in Evidence §16.

## Step 3 — Final re-sync of the classification

- Regenerate the classification so it reflects the day-6 rulings: **D6-1** (government entities out of automated tiers → (a) manual review), **D6-4** (OPAP not W; 24 wrong-LEI rows), **D6-5** (the 4 wrong-LEI entities with GLEIF parent links excluded from parent backfill). Keep everything else identical to run 2.
- Re-run the zero-unclassified check. Diff the new file against the day-5 file and report exactly which rows changed and why (expected: the 6 government T1 rows, the OPAP row, the parent rows of the 4 wrong-LEI entities).
- Replace `DAY5/classification.csv` only by writing a new `DAY7/classification.csv`, then update `CLAUDEDIR/MA-OCT-006_classification.csv` from it. Record old and new SHA-256s.
- If the sample-adjudication file needs a matching correction (e.g. the day-6 T1 count basis), update `CLAUDEDIR/MA-OCT-006_sample_adjudication.csv` the same way and record both SHAs.

## Step 4 — Final numbers everywhere

Make every 006 document agree with the re-synced classification and today's snapshot:

- **Evidence:** new §16 "Day 7 and final re-sync"; earlier sections stay as written, with a one-line pointer where a number was later corrected.
- **Remediation Matrix:** update the counts, the write-cost estimates, the go/no-go table and the 006 recommendation if anything moved. State plainly, under criterion 1, that the parent count passes in (entity, field) gaps (1,529) but would not pass in entities (812) (ruling D6-6), so the Founder sees it.
- **Close-out Summary:** remove "DRAFT"; set status to **"Final — submitted for Operations Lead review"**; complete the §10 acceptance checklist (each item met / met with deviation, with the Evidence section); list every ruling (R1–R10, D4-1, D5-1 … D5-8, D6-1 … D6-6, any D7); list every deliverable with its SHA-256; state the final read, write and API totals.
- **Query Ledger:** day-7 rows and the final totals.

## Step 5 — Deliverables manifest

Add a table at the end of the Close-out Summary: every `claude/MA-OCT-006_*` file with its final SHA-256 and size, and a line confirming none exceeds 10 MB (condition N-2). Also list the WORK files that stay outside the repo and what R4 does with them after 12 Oct.

## Step 6 — Report (in the chat)

"Report 4 (close-out package) — to the Main Lane", covering:

- the D10 / D8 / D6 results and the final drain estimate;
- the pilot H11 tally since go-live;
- the classification diff from the re-sync;
- any number that changed in the matrix or the 011 recommendation;
- the final SHA-256 of every 006 deliverable (the manifest);
- reads (today and cumulative of 200k), writes (0), API calls (52 of 60);
- confirmation that no git add/commit/push was run, and a request to the Main Lane for the close-out commit file list (rule 7) once the Operations Lead has given a verdict;
- "Rulings for the Main Lane (today)".
