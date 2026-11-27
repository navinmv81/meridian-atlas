# MA-NOV-EXP.BFS.ON — Report

```text
PACKET:     MA-NOV-EXP.BFS.ON · Control v1 (d9b81aba…0260120) · Task v1 (e1e99001…0cb5669) — both verified
RUN:        r-20261122T101403Z-6e3c (interactive, LANE_OPENER_v2)
ROLE:       Operations Lead
COMMIT:     b2895b6 "MA-NOV-EXP.BFS.ON: switch on the exposure back-fill (end pause row)" — pushed before the run; ls-remote November-2026 = b2895b6
OUTCOME:    DONE — pause row 3 ended (1 row), case event 220 written, no open pause for the job
STOP GATES: none hit
```

Pins checked before starting: GO report `6d494906…e293` and CHECK report `c084d777…587f`. Both match.

## 1. Pre-check (1 SELECT)

`ops_job_pause` for `cf.meridian-entities-enrich.expbf` held one row: `pause_id` 3, `starts_at` 2026-11-21T08:24:16Z, `ends_at` 2099-01-01T00:00:00Z, **open now = 1**. The gate "pause row not open" was not hit.

## 2–3. SQL file, commit, run

- **File:** `App/Ops/migrations/switch-on-2026-11-22-expbf.sql`. It is the GO report's switch-on SQL verbatim, with the payload filled as `{"packet":"MA-NOV-EXP.BFS.ON","founder_words":"switch on back-fill","pause_id":3}`. The Founder words are the ones recorded in the Status Start Approval (2026-11-22T09:58Z).
- **Commit and push:** `b2895b6`, explicit path only, pushed to `November-2026` before the run.
- **Run:** once, from the repo root: `npx wrangler d1 execute meridian-etf --remote --yes --file App/Ops/migrations/switch-on-2026-11-22-expbf.sql`.
  - Result: 2 queries, **`changes` 2**, `rows_written` 6, `rows_read` 20, `last_row_id` 220, 1 attempt.
  - The 2 changes are 1 UPDATE row (pause 3) and 1 INSERT row (event 220, matching `last_row_id`). So the UPDATE changed exactly 1 row, and the "≠ 1 row" gate was not hit.

## 4. Verification (2 read-only SELECTs, within the 3 allowed)

| Check | Result |
|---|---|
| Pause row ended | `pause_id` 3, `ends_at` **2026-11-22T10:14:41Z**, `ended` = 1 |
| No open pause for the job | Pause 3 is the job's only `ops_job_pause` row, and it is ended. So no pause is open |
| Case event | `event_id` 220, `pause_ended`, from `2099-01-01T00:00:00Z` to `2026-11-22T10:14:41Z`, payload as above, actor `ops_lead:wrangler`, `occurred_at` 2026-11-22T10:14:41.611Z, key `pause_end:cf.meridian-entities-enrich.expbf:3` |

`pause_ended` is a new event type. Migration 003 names only `pause_added`. The GO report flagged this for the Main Lane, and this Control names the action without a different event name, so the GO name was used.

## 5. First expected run

The back-fill step now passes the pause guard. Today is Sun 22 Nov, and Mon 23 Nov is outside the Tue–Sat window. So the **first real run is Tue 24 Nov 2026 06:00Z**, unless the budget guard skips it for lack of headroom. In that case it is the next Tue–Sat 06:00Z with enough headroom.

To check that morning, use the BFS.GO report's §"BFS.CHECK" ledger SELECT on `ops_job_run`, with check day 2026-11-24. On a real run, expect `expbf` to be a run (not `skipped/pause`), with `rows_written` ≤ the 40,000 cap.

## Switch-off SQL (stops the job again; no deploy needed)

This is from the GO report, unchanged. Fill `<packet>` and `<reason>`, then run once from the repo root with `npx wrangler d1 execute meridian-etf --remote --file <file>`:

```sql
INSERT INTO ops_job_pause (job_id, starts_at, ends_at, reason, created_by)
  SELECT 'cf.meridian-entities-enrich.expbf', strftime('%Y-%m-%dT%H:%M:%SZ','now'), '2099-01-01T00:00:00Z',
         '<packet>: back-fill switched off — <reason>', 'ops_lead:wrangler'
  WHERE NOT EXISTS (SELECT 1 FROM ops_job_pause
                    WHERE job_id = 'cf.meridian-entities-enrich.expbf' AND ends_at > strftime('%Y-%m-%dT%H:%M:%SZ','now'));
INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, from_value, to_value, payload, actor, actor_source, actor_role, occurred_at, idempotency_key)
  VALUES ('ops_control', 'cf.meridian-entities-enrich.expbf', 'pause_added', NULL, '2099-01-01T00:00:00Z',
          '{"packet":"<packet>","reason":"<reason>"}', 'ops_lead:wrangler', 'system', 'Operations Lead',
          strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'pause:cf.meridian-entities-enrich.expbf:<packet>');
```

The pause takes effect from the next run. A run already in progress finishes, at most 3 batches, each one transaction.

## Boundaries kept

- **Files written:** only `App/Ops/migrations/switch-on-2026-11-22-expbf.sql` (new) and this report.
- **D1:** the one SQL file was run once (2 rows changed). There were 3 read-only SELECTs in all: 1 pre-check and 2 verification. No other writes and no DDL.
- **Not done:** no deploys, code edits, registry or budget edits, secrets or `.env*`, installs or subagents.
- **Not touched:** `*_Status.json`, the board, the Tower, `transitions.jsonl`, logs, the LANE_OPENER files, Main Lane records, `13F Seed/gleif-seed.js`.
- **Git:** one commit with an explicit path, pushed to `November-2026`; no history rewritten. This report itself is not committed.
