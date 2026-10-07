# MA-OCT-006 — Day 5 run instructions (Fri 2 Oct 2026)

```text
ISSUED BY:    Data-Identity Lead (packet owner), via Founder
EXECUTED BY:  Data-Identity Lead (local Claude Code, Clean (v11), branch October-2026)
REVIEWED BY:  Operations Lead (close-out review, Sat 10 Oct)
APPROVED BY:  Founder
PACKET:       MA-OCT-006 — GLEIF reliability investigation (read-only diagnosis)
GATE:         Execution day 5 → Report 3
```

Purpose: classify every entity's identity gaps, test the rules against a 400-entity hand-checked sample, and measure completeness. Everything runs locally on files already on this Mac.

## Paths

| Name | Absolute path |
|---|---|
| REPO | `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)` |
| CA | `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)/App/Corporate Atlas` |
| CLAUDEDIR | `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)/claude` |
| WORK | `/Users/navinkumar/MeridianAtlas-work/gleif-006` |
| DAY2 / DAY3 / DAY4 / DAY5 | `WORK/day2`, `WORK/day3`, `WORK/day4`, `WORK/day5` |
| GLEIFDB | `/Users/navinkumar/MeridianAtlas-work/gleif-006/gleif_006.db` |

Quote every path; they contain spaces and brackets.

## Governing documents (unchanged)

- `CLAUDEDIR/MA-OCT-006_Spec.md`, SHA-256 `1dab3539c7431e532b54bffa90cc052cb83c016a6151ed6044518fcdb5c7b273` (§5 classification, §6.4 sample, §7.1 completeness, §7.2 relationship check).
- `CLAUDEDIR/MA-OCT-006_Spec_Review.md`, SHA-256 `6ae65d7904b597b1bfff902f9e810777f655c206237fa170013e9bb7c3d44206`.
- `CLAUDEDIR/MA-OCT-006_Build_Brief.md` (rev 2).
- Continue `CLAUDEDIR/MA-OCT-006_Evidence.md` (add §14) and `CLAUDEDIR/MA-OCT-006_Query_Ledger.md`.

## Rules for today

1. **No database queries and no GLEIF API calls.** Work only from the DAY2 exports (29 Sep snapshot), the DAY3/DAY4 outputs and GLEIFDB. Record "0 D1 reads, 0 API calls" in the ledger for today. (8 API calls remain; they are kept for the close-out.)
2. No D1 writes, no `/run` calls, no deploys. No `git add`, `commit` or `push`. Use git only with `--no-optional-locks` for reads; the MA-OCT-001 lane may be committing today.
3. In REPO, change only: `MA-OCT-006_Evidence.md`, `MA-OCT-006_Query_Ledger.md`, and the two new files named in Steps 3 and 5. Read the boost runner and its logs only; never edit them.
4. Any new in-lane ruling or deviation goes in a "Rulings for the Main Lane (today)" block at the end of the report.

## Step 0 — Preflight

- `date -u`.
- Branch is `October-2026`; `ls .git/*.lock` returns nothing.
- `shasum -a 256` the spec and spec review; both must match.
- `mkdir -p` DAY5; record `du -sh` WORK (expect about 4.1G).

## Step 1 — Record in Evidence §7 (append)

- **D4-1** (in-lane ruling, 1 Oct, reported to the Main Lane 1 Oct): GLEIF `DUPLICATE`-status LEIs are excluded from T1, because a DUPLICATE registration is not the entity's valid LEI (9 rows).
- **MA-OCT-001 pilot acknowledgement** (sent 2026-10-01 18:41 UTC): ACK WITH CONDITIONS — (1) boost-log lines keep their format and outcome values and are written before the heartbeat; (2) heartbeat output goes to a separate log; (3) the pause-flag check stays first, and the heartbeat never changes the exit code or the `/run` call; (4) the go-live commit and time are recorded; (5) non-blocking notes on scheduled slot, out-of-window fires and missed fires.
- **Main Lane notice (1 Oct):** the pilot runner went live 2026-10-01 19:08:13 UTC (commit `da38cf5`); first pilot run 2 Oct 10:50 UTC; heartbeats go to `CA/logs/entities-enrich-boost-heartbeat.log`. **H11 split time = 2026-10-01 19:08:13 UTC.** Boost runs before it are pre-pilot evidence; runs after it are read together with the heartbeat log.
- **Main Lane reading of condition (1), accepted on 1 Oct:** `start` is sent at the same time as `/run`, after the pre-flight, is never awaited before `/run`, and never writes to the boost log. Condition (1) therefore applies to the terminal events (skipped, failed, success, partial). Its intent holds as long as a slow or failed `start` cannot delay `/run`, change the exit code, or stop the final boost-log line being written.

## Step 2 — Finish the name matcher (local only)

- Add the fuzzy part of tier T3 from spec §5.3: token-sort similarity ≥ 0.92 against GLEIF legal, other and transliterated names, using the current `normalizeName`.
- Report how many of the 15,960 "unexplained remainder" entities (Evidence §12.3) become unique fuzzy matches (T3) and how many stay "none".
- **Script-gap check:** for the remainder entities, find candidate GLEIF records whose legal name is written in a non-Latin script (detect by Unicode script of the characters, not by country) and that have **no** Latin-script other name. Count the Meridian entities that can only match such records. Label them "(a) script gap": they can never be matched by an English name.
- Output `DAY5/t3_fuzzy.csv` and a counts table in Evidence §14.

## Step 3 — Full classification (spec §5.1–5.2)

Scope: every non-fund entity in `DAY2/d2_entity_master.csv`.

- Unit = one (entity, field) gap over `lei`, `direct_parent_lei`, `ultimate_parent_lei`, `name`, `country`, using the gap definitions in spec §5.1.
- Apply the §5.2 rules in order (steps 1, 1′, 1″, 2, 3, plus W). Evidence sources: GLEIF Level 1, RR and RX in GLEIFDB; the D2/D3/D4 exports; the Step 2 tiers; and the formal H1–H13 verdicts in Evidence §13 as the "stalled path" evidence for category (d).
- Parent gaps: only for entities with a valid LEI, and only after the §7.2 relationship check, in this order:
  1. an ACTIVE RR relationship for the child and type;
  2. an RX exception with its real reason → (b);
  3. a `legal_parent` edge in `entity_relationships` compared with the mirror fields (edge without mirror, or the reverse → (c));
  4. the parent's own D2 row and its GLEIF name (mismatch → W);
  5. only an RR parent that Meridian lacks and that (d) does not explain → (c).
- Use the Known Issue numbers: 22.40 (sticky diff), 22.41 (duplicate twins), 22.42 (escaped names), 22.43 (wrong NO_LINK markers).
- For each gap record: `entity_id, field, category, rule_step, evidence_ref, confidence, h_ids, rc_id, ki`.
- Output `DAY5/classification.csv` (full). Copy it into CLAUDEDIR as `MA-OCT-006_classification.csv`, or as `MA-OCT-006_classification.csv.gz` if it is over 10 MB (condition N-2). Record both SHA-256s.
- Acceptance: **zero unclassified gaps.** Add two tables to Evidence §14: category × field, and category × entity type. Report funds separately.

## Step 4 — Known Issue 22.9 (separate W item)

- Check the 4 known-bad `legal_parent` edges (parent/child 1565/3, 2247/143, 2476/49, 6980/194) against RR (expected: no such relationship) and against `DAY2/d5_exceptions.csv`.
- For each child, report its current GLEIF match, if any.
- Record it in Evidence §14 as a W row: root cause "MA-SEP-001 merge", routed to MA-OCT-003/004 as a data-quality ticket, not to MA-OCT-011.

## Step 5 — 400-entity hand-checked sample (spec §6.4)

- Fixed seed `20261002` (record it).
- Strata: LEI status (valid / none / malformed) × entity type × country bucket (US / EU+UK / other / NULL) × derived source:
  - GLEIF bulk = `match_source` set;
  - FIRDS = `holding` row created with its LEI as the name;
  - enrich-parent = `holding` row created by Phase 3;
  - holdings-seed = everything else.
- At least 15 per non-empty type × LEI-status cell; the rest proportional.
- For each sampled entity, decide its **true** category by looking at the GLEIF L1 / RR / RX records directly, not at the rule output. Then compare with the Step 3 category.
- Output `DAY5/sample400.csv` and `CLAUDEDIR/MA-OCT-006_sample_adjudication.csv` (400 rows: `entity_id, stratum, rule_category, adjudicated_category, agree, note`). Record SHA-256s.
- Pass thresholds: overall agreement ≥ 95%, and ≥ 90% in every cell with n ≥ 15. If a threshold fails, revise the rule once, re-run Steps 3 and 5, and report both results.
- T1 precision: combine the sampled T1 rows with the 50 from 1 Oct (`DAY4/t1_sample50.csv`). Report precision and its one-sided 95% lower bound. If the bound is below 98%, say so plainly.

## Step 6 — Completeness (spec §7.1)

- For `lei`, `direct_parent_lei`, `ultimate_parent_lei`, `name` and `country`: raw fill rate and achievable fill rate, where achievable = filled ÷ (filled + (c) + (d)).
- Cut by entity type, country bucket, derived source and LEI status. Tables go in Evidence §14.
- Cross-check: the D2 LEI fill must reproduce 16,627 / 43,998 (37.8%).

## Step 7 — First pilot boost check (read only)

Only if the session is open after 11:05 UTC; repeat after 17:05 UTC if still open.

- Read `CA/logs/entities-enrich-boost.log` and `CA/logs/entities-enrich-boost-heartbeat.log` for 2 Oct.
- Check:
  1. boost-log lines after 2026-10-01 19:08:13 UTC keep the old format and outcome values (`paused`, `skipped_headroom`, `fired`, `http_<n>`, `error`);
  2. heartbeat lines appear only in the heartbeat log;
  3. every fire has its boost-log line, even if its heartbeat failed;
  4. fire time against its slot (10:50 / 16:50 UTC), for H11 lateness.
- Record in Evidence §14 under "Pilot H11 check". If the session closes before 11:05 UTC, write "carried to Report 4".

## Step 8 — Report 3 (in the chat)

"Report 3 (Fri 2 Oct) — to the Main Lane", covering:

- Step 2: fuzzy-match and script-gap counts from the 15,960 remainder;
- classification totals (category × field), with zero unclassified confirmed;
- the Known Issue 22.9 result;
- sample agreement (overall, plus any failing cells) and T1 precision with its 95% lower bound;
- completeness headline: raw vs achievable for `lei`, `direct_parent_lei` and `ultimate_parent_lei`;
- an updated size-of-the-prize table, replacing the first cut;
- the pilot H11 check, or "carried to Report 4";
- reads today (0) and cumulative (92,300 of 200k); API calls 52 of 60;
- plan for Mon 5 – Fri 9 Oct:
  - D10 trend snapshot on Fri 9 Oct after 07:05 UTC; no queries during the Mon 5 Oct 04:00 UTC seed;
  - the ranked remediation matrix (spec §9.1), with D1 write costs for both R9 options (offline GLEIF reconciliation, and Level 2 backfill only) and for the KI 22.41 duplicate-merge packet;
  - the MA-OCT-011 go/no-go assessment (spec §9.2);
  - the close-out package (due Fri 9 Oct) and the R4 cleanup plan;
- "Rulings for the Main Lane (today)": any new in-lane ruling or deviation, or "none".

No `git add`, `commit` or `push`.
