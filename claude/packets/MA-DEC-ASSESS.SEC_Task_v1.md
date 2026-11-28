# MA-DEC-ASSESS.SEC — Task v1

```text
ISSUED BY:    Program Orchestrator (December Main Lane), 2026-11-28
EXECUTED BY:  Operations Lead — fresh session, fixed line LANE_OPENER_v3.md
CONTROL:      claude/packets/MA-DEC-ASSESS.SEC_Control_v1.md
```

1. Preconditions: no `.git/*.lock`; branch `December-2026`; HEAD = `git ls-remote origin refs/heads/December-2026` = `5af13515d799ac1421b899270833978635e410db`. Note the UTC time; if inside 17:40–18:10Z or 23:50–00:10Z, wait it out before step 3.
2. Control Work 1 (source inventory) — `App/Ops/src/*.js`, `App/Corporate Atlas/*.js`, `App/ETF Refresh/*`, `13F Seed/*` Worker sources (read-only), every `wrangler-*.toml`.
3. Control Work 2 (probes), keeping a running request count.
4. Control Work 3–5.
5. Report `claude/packets/MA-DEC-ASSESS.SEC_Report.md` (sections in Control §Success order; ranked findings last; a "Non-actions" list). Then `node tools/factory/dispatch.mjs end MA-DEC-ASSESS.SEC`. Reply ≤ 5 lines: report path + SHA-256, request count, number of Critical/High findings, END line.
