# MA-DEC-REC.DOC — Task v1

```text
ISSUED BY:    Program Orchestrator (December Main Lane), 2026-11-28
EXECUTED BY:  Documentation Lead — fresh session, fixed line LANE_OPENER_v3.md
CONTROL:      claude/packets/MA-DEC-REC.DOC_Control_v1.md
```

## Pins — Main Lane records to commit unedited (any mismatch → stop)
| File | sha256 |
|---|---|
| `claude/December_Decisions_Log.md` | `352d74bb551725791a691693b5aedc1ebed8e151f1b9510ba01493ba86dc5978` |
| `claude/packets/MA-DEC-BOOT_Status.json` | `dab8e2ec78314b8aee20be0e1a562dc100fec850a559ef841c754349b6fd2a80` |
| `claude/packets/MA-DEC-FACTORY.LABEL_Status.json` | `7681a8e265528762aabff8bcaa2fa68ceb2d4abcfdadf7ca8f144fcbe2f7edbe` |
| `claude/packets/MA-DEC-FACTORY.LABEL_Report.md` | `5f061e25324a5d16df7eb2d36e6bdcd330303601f3e1a02144b43dc39b1fee58` |
| `claude/packets/MA-DEC-FACTORY.REVIEW_Control_v1.md` | `3c35c503dccf814e1d7baed840f6e8c0b8b95b5518e1e29ae4ee0127bef81ad7` |
| `claude/packets/MA-DEC-FACTORY.REVIEW_Task_v1.md` | `39c47cf77f1b395399bcdbac08bd229547f4bfa935a35559bb78e198695f453a` |
| `claude/packets/MA-DEC-FACTORY.REVIEW_Status.json` | `b06eeb9a18777ca2e400e851b957ad5b1a90c73e694613e6f22360773f600e42` |
| `claude/packets/MA-DEC-FACTORY.REVIEW_Report.md` | `2d9f26320a7dcd962f91f73ad6a033b93ea13c1a2c33f1234276d5f8666d628e` |
| `claude/packets/MA-DEC-ASSESS.SEC_Control_v1.md` | `3c210aaae633992612d54883d49cb169ee402189767d2d66c007755a800b4f27` |
| `claude/packets/MA-DEC-ASSESS.SEC_Task_v1.md` | `07d1d35335b66d4b6a545d36d03fd88ec2c8b27429270204fede7cf7f7942c65` |
| `claude/packets/MA-DEC-ASSESS.SEC_Status.json` | `feaecb2b25ac5f578e7fe49101b411c6c05bae506c03a83e95471747091e4694` |
| `claude/packets/MA-DEC-ASSESS.SEC_Report.md` | `d7779eaaed0fa2d174105e78a170a42b8e0b764c68151314f7a09f3d809178e3` |
| `claude/packets/MA-DEC-CARRY_Status.json` | `dede2e3eb237afc48835e17b4c4f9f50b375e275538d4e7a4c029693241c52e6` |
| `claude/packets/MA-DEC-REC.DOC_Control_v1.md` | `44ee9eda9ac8b0f181e31c1b441355ff971e3361ea7b29c50536f23a2970c4fe` |
| `claude/packets/MA-DEC-REC.DOC_Task_v1.md` | as in `MA-DEC-REC.DOC_Status.json` |

## Steps
1. Preconditions: no `.git/*.lock`; branch `December-2026`; HEAD = `git ls-remote origin refs/heads/December-2026` = `5af13515d799ac1421b899270833978635e410db`; pins match.
2. Control Work 1–6 (read-only); sources: `Meridian_Atlas_Current_State_v14.docx`, `Meridian_Atlas_Current_State_v15.docx`, `claude/November_Decisions_Log.md`, `claude/October_Decisions_Log.md`, `claude/Release_Ledger_November_2026.md`, `claude/packets/STATUS_BOARD_November_2026.md`, `claude/packets/MA-NOV-*` reports and Status files, `claude/packets/MA-DEC-ASSESS.SEC_Report.md`, `claude/December_Decisions_Log.md`.
3. Control Work 7: write `claude/Current_State_v15_Reconciliation.md`.
4. Control Work 8: `git add --` the note + every pinned path + this Task; `git diff --cached --name-only` = that list; commit; push; `git ls-remote origin refs/heads/December-2026`.
5. Report `claude/packets/MA-DEC-REC.DOC_Report.md` (commit, staged list, pins observed, one line per item with its outcome, non-actions). Then `node tools/factory/dispatch.mjs end MA-DEC-REC.DOC`. Reply ≤ 5 lines.
