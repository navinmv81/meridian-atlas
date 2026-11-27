# MA-NOV-EXP.W2 — Exposure calculation (pure functions) + tests — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-13
EXECUTED BY:  Engineering Lead (Entities domain) — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane verification; independent review together with W3 before the C-2 release
APPROVED BY:  Founder — "Go" (NML-1113-8); Start Approval required
PACKET:       MA-NOV-EXP.W2 · Control v1 · usage class medium · write owner Engineering Lead
```

## Sources
`claude/specs/MA-NOV-EXP_Spec.md` (approved; pinned) §3.1–3.4, §4.2 (response contract), §7 (T1, T3, T4, T7–T10), §9 EXP.W2. Live route facts from `claude/packets/MA-NOV-EXP.W1R4_Report.md`: R-EXP1 answers 200, 404 `no_holdings`, 400, and **422 `too_large` with `limit:"rows"` or `limit:"size"`**; `entities` are **not** sorted by weight (review N-6 — the client must sort).

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `54b1446` = origin). Execute from `claude/packets/MA-NOV-EXP.W2_Task_v1.md`. Writable (checked by `end`): `App/ma-entities.js` (**EXP section only** — new code in a clearly delimited block; no changes to existing functions), `App/Corporate Atlas/tests/` (new `exp-compute*` files and fixtures), `claude/packets/MA-NOV-EXP.W2_Report.md`. `allow_commits: true`; may push `November-2026`.

## Allowed actions
Edit the writable paths; Node tests (load the pure functions from `ma-entities.js` via `vm`, as spec §7 says); run all existing Corporate Atlas suites; read-only git, `git ls-remote`; `git add -- <explicit paths>`; one commit; `git push origin November-2026`; write the report.

## Prohibited actions
Any UI/DOM code (that is W3); `index.html`, other `ma-*.js`, `docs/`, `generate-docs.mjs`; imports between domain files (vanilla, no modules, no frameworks); network, Worker requests, D1, wrangler; Workers code; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; installs; subagents; `13F Seed/gleif-seed.js`.

## Stop gates
Pinned hash mismatch; a spec formula that is ambiguous or contradicts the live contract (stop, report, propose); tests failing after bounded fixes; push rejected.

## Success conditions
`exp_validate` and `exp_compute` (plus small helpers) implement §3.1–3.3 exactly, incl. refused (422) inputs, sorting, Δ vs previous month; T1, T3, T4, T7–T10 pass with the spec's numbers; existing suites green; one commit pushed; report; `end`. Nothing released.
