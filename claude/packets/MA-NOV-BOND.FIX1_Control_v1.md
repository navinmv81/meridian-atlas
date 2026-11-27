# MA-NOV-BOND.FIX1 — Bond parser 1.3.0: reliability fixes F1, F2, F3, F4, F7, F8 (local only) — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-22
EXECUTED BY:  Data-Identity Lead + Engineering Lead — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane build check; BOND.REVIEW (independent) before any write
APPROVED BY:  Founder — bond spec v2 approved with decisions 1–13 as recommended (NML-1122-2); Start Approval required. No D1 writes, no SEC requests
PACKET:       MA-NOV-BOND.FIX1 · Control v1 · usage class medium · write owner Data-Identity Lead
```

## Scope
Spec v1 §4 (carried into v2 §1; both pinned): **F1** title gate for drafts, **F2** deal-level draft → final match (runner; issuer family from `bond_issuer_link` / co-registrants, read from stored state or a read-only query), **F3** programme supplements → `skipped_other/program_supplement`, **F4** maturity wordings from the cached GM/Duke filings, **F7** remarketing → `skipped_other/remarketing`, **F8** a `status_reason` for every non-final and partial row (emitted by the parser and carried by the runner; **no D1 column yet** — that is CR1 at apply time). Parser version `bonds-1.3.0`. Fixtures from the local cache; tests. F5/F6 are FIX2.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD = origin). Writable (checked by `end`): `App/Corporate Atlas/bonds/bonds-parse.mjs`, `App/Corporate Atlas/bonds/bonds-ingest.mjs` (runner changes for F2/F8 only), `App/Corporate Atlas/bonds/bonds-lib.mjs` (if needed), `App/Corporate Atlas/bonds/tests/`, `App/Corporate Atlas/bonds/fixtures/`, `claude/packets/MA-NOV-BOND.FIX1_Report.md`. `allow_commits: true`; may push `November-2026`.

## Allowed actions
Edit within scope; read the cached filings and stored state; build fixtures from the cache (gzipped, as existing fixtures); run the bond tests and an **offline, no-write** parse of the cached corpus to measure the effect (the runner's `--offline` + a dry-run/no-D1 mode; if the runner cannot run without D1 writes, measure with the parser alone); up to 4 read-only D1 SELECTs (≤ 20,000 rows) e.g. for the issuer family list; read-only git, `git ls-remote`; `git add -- <explicit paths>`; one commit; push; write the report.

## Prohibited actions
Any D1 write or migration; SEC/EDGAR or other network requests; running discover or ingest against D1; changes to `bonds-config.json` run caps, LaunchAgent scripts, Workers, front end, `docs/`; `.env*`, secrets; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; installs; subagents; `13F Seed/gleif-seed.js`.

## Stop gates
Pinned hash mismatch; any path that would write to D1 or call the network; existing bond tests failing after bounded fixes; push rejected.

## Success conditions
F1, F2, F3, F4, F7, F8 implemented with a fixture + test each; existing 52 tests still pass; offline before/after counts per class from the cached corpus (no writes); one commit pushed; report; `end`.
