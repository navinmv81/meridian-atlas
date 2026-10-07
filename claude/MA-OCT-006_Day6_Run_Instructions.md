# MA-OCT-006 — Day 6 run instructions (from Fri 2 Oct 2026, evening)

```text
ISSUED BY:    Data-Identity Lead (packet owner), via Founder
EXECUTED BY:  Data-Identity Lead (local Claude Code, Clean (v11), branch October-2026)
REVIEWED BY:  Operations Lead (close-out review, Sat 10 Oct)
APPROVED BY:  Founder
PACKET:       MA-OCT-006 — GLEIF reliability investigation (read-only diagnosis)
GATE:         Execution day 6 → Report 3b + DRAFT close-out package
```

Purpose: settle the T1 precision bound, check the second pilot fire, and draft the ranked remediation matrix, the MA-OCT-011 go/no-go assessment and the close-out summary. All work is local. It can run on any day, weekends included, because it uses no database queries.

## Paths

| Name | Absolute path |
|---|---|
| REPO | `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)` |
| CA | `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)/App/Corporate Atlas` |
| CLAUDEDIR | `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)/claude` |
| WORK | `/Users/navinkumar/MeridianAtlas-work/gleif-006` |
| DAY2 … DAY6 | `WORK/day2` … `WORK/day6` |
| GLEIFDB | `/Users/navinkumar/MeridianAtlas-work/gleif-006/gleif_006.db` |

Quote every path; they contain spaces and brackets.

## Governing documents (unchanged)

- `CLAUDEDIR/MA-OCT-006_Spec.md`, SHA-256 `1dab3539c7431e532b54bffa90cc052cb83c016a6151ed6044518fcdb5c7b273` (§9 deliverables, §9.1 matrix, §9.2 go/no-go, §10 acceptance criteria).
- `CLAUDEDIR/MA-OCT-006_Spec_Review.md`, SHA-256 `6ae65d7904b597b1bfff902f9e810777f655c206237fa170013e9bb7c3d44206`.
- `CLAUDEDIR/MA-OCT-006_Build_Brief.md` (rev 2).
- `CLAUDEDIR/MA-OCT-011_Spec_Brief.md` (read only; the 011 lane owns final costing and gate wording).
- Continue `CLAUDEDIR/MA-OCT-006_Evidence.md` (add §15) and `CLAUDEDIR/MA-OCT-006_Query_Ledger.md`.

## Rules for this run

1. **No database queries and no GLEIF API calls.** Work only from WORK files and GLEIFDB. Record "0 D1 reads, 0 API calls" in the ledger. (D10, the final trend snapshot, is a separate short run on a weekday after 07:05 UTC.)
2. No D1 writes, no `/run` calls, no deploys. No `git add`, `commit` or `push`. Use git only with `--no-optional-locks` for reads.
3. In REPO, change only: `MA-OCT-006_Evidence.md`, `MA-OCT-006_Query_Ledger.md`, and two new files: `MA-OCT-006_Remediation_Matrix.md` and `MA-OCT-006_Closeout_Summary.md` (marked DRAFT). Never edit the MA-OCT-011 or MA-OCT-013 files. Read the boost runner and its logs only.
4. Any new in-lane ruling or deviation goes in a "Rulings for the Main Lane (today)" block at the end of the report.

## Step 0 — Preflight

- `date -u`. Branch is `October-2026`; `ls .git/*.lock` returns nothing.
- `shasum -a 256` the spec and spec review; both must match.
- `mkdir -p` DAY6; record `du -sh` WORK.

## Step 1 — Pilot H11 check, 16:50 UTC slot of 2 Oct (read only)

- Read `CA/logs/entities-enrich-boost.log` and `CA/logs/entities-enrich-boost-heartbeat.log` for the 2 Oct 16:50 UTC fire.
- Same four checks as day 5: boost-log format and outcome values unchanged; heartbeat lines only in the heartbeat log; boost-log line written even if the heartbeat failed; fire time against the 16:50 slot.
- Also record: did `/run` get called, and was the terminal heartbeat delivered or "not delivered"?
- Record in Evidence §15 under "Pilot H11 check (16:50)". If this run starts after 3 Oct, also include any later fires up to the time of the run.

## Step 2 — T1 precision top-up

Goal: decide whether T1 precision's one-sided 95% lower bound reaches 98%.

- With zero errors, the bound reaches 98% at n = 149. Combined checked T1 so far: 88 (50 on 1 Oct + 38 in the 400-sample, per Evidence §14; use the exact figure recorded there).
- Draw additional T1 rows not previously checked, fixed seed `20261003` (record it), until the combined total is **at least 150**. Exclude `government` entities (see ruling D6-1 below).
- Hand-check each one against the GLEIF L1 record (name, country, legal form, status) exactly as on 1 Oct. Output `DAY6/t1_topup.csv`.
- Report the combined n, the number of errors and the one-sided 95% lower bound. If any error is found, describe it and recompute; do not stop early.

## Step 3 — Wrong-LEI detail (new integrity class, 25 rows)

- For each of the 25 wrong-LEI rows from Evidence §14: `entity_id`, entity name, current LEI, the GLEIF legal name of that LEI, the GLEIF relationship between the two entities (if any, e.g. the LEI belongs to a subsidiary), source (`match_source`), and the correct LEI if the entity itself has a T1 match.
- Output `DAY6/wrong_lei_detail.csv` and a summary table in Evidence §15. This is the input for a fix route; no fix is proposed inside 006 beyond naming the owner packet.

## Step 4 — Ranked remediation matrix (spec §9.1)

Write `CLAUDEDIR/MA-OCT-006_Remediation_Matrix.md`:

- One row per root cause (RC-1 … RC-14, plus the integrity rows: KI 22.40, 22.41, 22.42, 22.43, KI 22.9, wrong LEIs, normalizer gaps, `'NULL'` text values).
- Columns exactly as spec §9.1: Rank, RC-id, Root cause, Category (a–d, W), Affected (entities / field-gaps), Evidence (query IDs, H-ids, file refs), Proposed fix and packet, Owner (Addendum §2 role), D1 write cost (one-time + recurring), Risk (data, budget, cron, domain), Confidence.
- Ranking rule from spec §9.1: recoverable field-gaps × confidence (high = 1.0, medium = 0.6), ties broken by lower write cost then lower risk. Use **high-confidence counts only** for the ranking figure (D5-6 condition); show medium-confidence counts in a separate column.
- **Write costs:** compute them from the actual row counts, stating the statement pattern for each (e.g. one guarded `UPDATE` per row) and the index writes it triggers. Take the `entity_master` / `entity_relationships` / queue index list from the day-1 D0 catalog in the ledger. Label every figure "006 estimate; final costing in the MA-OCT-011 / MA-OCT-013 specs".
- Include both R9 options as separate rows or a sub-table: Option 1 offline GLEIF reconciliation (Level 1 T1 matching + placeholder hydration + Level 2 parents with real reasons, duplicate-aware) and Option 2 Level 2 parent backfill only. Show what each delivers (gaps closed) and costs, and the KI 22.41 merge (MA-OCT-013) separately.
- Product note row: for parent gaps that are legitimate GLEIF exceptions (b), the fix is showing GLEIF's reason in Corporate Atlas rather than a blank. Name it as a candidate UI follow-up, owner to be assigned by the Main Lane.

## Step 5 — MA-OCT-011 go/no-go assessment (spec §9.2)

- Assess all seven §9.2 criteria with high-confidence numbers only. For each: the criterion as written, the evidence, PASS / FAIL / NOT APPLICABLE AS WORDED, and why.
- Where the wider R9 scope breaks a criterion as worded (expected: 4 write budget and 5 tables touched), say so and point to the MA-OCT-011 spec lane, which proposes the amended wording. Do not write amended wording here.
- Give a 006 recommendation: GO / NO-GO / DEFER for each R9 option, with the reasons.
- Put this as a section in the Remediation Matrix file and summarise it in Evidence §15.

## Step 6 — DRAFT close-out summary

Write `CLAUDEDIR/MA-OCT-006_Closeout_Summary.md`, marked **DRAFT — pending D10 trend snapshot and Operations Lead review**, with the four-line header from the Addendum (§3). Contents:

- headline findings (F4 explained; H1–H13 verdicts; integrity findings with KI numbers);
- the four-way classification totals and completeness (raw vs achievable);
- the size of the prize;
- MA-SEP-017 residual answer (R5) and KI 22.9;
- the remediation matrix summary and the 011 recommendation;
- the Ops feed (spec §8) status, including the pilot heartbeat findings;
- an acceptance-criteria checklist against spec §10, each marked met / met with deviation / pending, citing the Evidence section;
- the query ledger total, API calls used, the rulings list (R1–R10, D4-1, D5-1 … D5-8, any D6 rulings);
- the remaining items: D10 snapshot, final re-sync, R4 cleanup after 12 Oct.

## Step 7 — Report 3b (in the chat)

"Report 3b — to the Main Lane", covering:

- the pilot 16:50 check;
- T1 precision: combined n, errors, lower bound, and whether it reaches 98%;
- the wrong-LEI summary;
- the top 5 rows of the ranked matrix;
- the 011 go/no-go assessment per criterion and the 006 recommendation per option;
- confirmation that the DRAFT close-out summary is written, with SHA-256s of the two new files;
- reads (0 this run; 92,300 cumulative) and API calls (52 of 60);
- the remaining plan: D10 snapshot (next weekday, after 07:05 UTC; not during the Mon 04:00 UTC seed), final re-sync, close-out to the Operations Lead;
- "Rulings for the Main Lane (today)".

No `git add`, `commit` or `push`.

## Rulings issued with these instructions (record in Evidence §7)

- **D6-1 (Data-Identity Lead):** `government` entities are excluded from automated LEI matching (T1 included) and routed to manual review, because the government/no-LEI sample cell scored 20–33% (n = 15). Report the change to the T1 count.
- **D6-2 (Founder, 2 Oct):** the remaining close-out work is pulled forward and runs from 2 Oct; only the D10 snapshot needs a weekday morning. The Ops review (Sat 10 Oct) and the Founder gate (Mon 12 Oct) are unchanged.
