# MA-DEC-FACTORY.REVIEW — Task v1

```text
ISSUED BY:    Program Orchestrator (December Main Lane), 2026-11-28
EXECUTED BY:  Architect (REVIEW-A), fresh session, fixed line LANE_OPENER_v3.md
CONTROL:      claude/packets/MA-DEC-FACTORY.REVIEW_Control_v1.md
```

1. Confirm branch `December-2026`, HEAD `5af13515d799ac1421b899270833978635e410db` = origin, no lock; this session id ≠ `fb142bc6-270b-4f4b-b596-e2a5252b9bc4`.
2. Read: both Controls/Tasks and Reports (`MA-DEC-BOOT_Report.md` `b73d04ca…3449`, `MA-DEC-FACTORY.LABEL_Report.md` `5f061e25…ee58`), `git diff 9cb8dc7 5af1351 -- tools/factory/`.
3. Copy the repo's `tools/factory`, `claude/packets`, `claude/factory/config.json` to a temp dir; run the suite; run your own experiments for Q1–Q3 there.
4. `shasum -a 256` the two archives (Q4).
5. Write the report; `node tools/factory/dispatch.mjs end MA-DEC-FACTORY.REVIEW`; reply ≤ 5 lines.
