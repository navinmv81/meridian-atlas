# MA-OCT-002b.SIGNE — Report (ETF Product Lead)

**Opening checks (Wed 4 Nov ~20:40Z):**
- Control `16684720…b2f5`: re-hashed, matches the board row (line 106) and the request. Task `f53b26de…977b` ✓.
- BUILD Report `b42b4858…09ca` ✓. Spec 002 `9ec6773a…3893` ✓. No `.git/*.lock`.
- **Note:** this packet's Control and Task files exist only in the local folder, not in the Claude Project docs.

**Scope kept:**
- Doc-only: 0 D1, 0 deploys, 0 git writes, no secrets.
- Code read-only in the build worktree (the Founder granted folder access for this session). All 11 commit-list hashes match. Diffed against `1a59b77`.

## Outcome: **SIGNED, with 3 conditions** → `claude/MA-OCT-002b_ETF_Signoff.md` `21ae25ec…2aed`
| Item | Verdict |
|---|---|
| Holdings heartbeat fields | SIGNED WITH CONDITION (C-1) |
| End-only default + `OPS_HEARTBEAT_START` gate | SIGNED WITH CONDITION (C-2) |
| Per-ETF cost + next 20 tickers | SIGNED |
| Bootstrap heartbeat | SIGNED (C-2) |
| B3 warning reading (< 5,000 under the 80k guard) | SIGNED WITH CONDITION (C-3): reading confirmed |
| Weeks-since-full-pass | SIGNED (null until first post-deploy pass completes) |
| Frozen flag | SIGNED (metric only, no case) |
| No ETF-domain table written by 002b | **Confirmed** from code |
| ETF API contracts unchanged | **Confirmed** (`index.js`, `worker-13f.js`, `ma-etf.js` byte-identical) |

## For LANE-8-ENG / MA-OCT-002b.DEPLOY (action before M10)
- **C-1:** move the holdings `measure` read (`getTodayWriteCount`, `holdings-pipeline.js` lines 179–181) after the `etf_offset` / `last_run_status` saves, wrapped in `try/catch`, then re-run `heartbeats-contract`.
- **Why:** today the read sits before the cursor save. Near the 50-subrequest limit, it could cost the cursor save and freeze the pass.
- **Scope:** M10 (holdings key) is blocked until this is done. M0–M9 and M11 are not blocked by ETF-PL.
- **C-2:** `OPS_HEARTBEAT_START` stays unset until M4 shows at least 2 subrequests of room, and turning it on needs a new ETF-PL sign-off.
- **C-3:** re-sign E5 if any other `writes_today_*` writer is ever scheduled on a Sunday.

## For others
- **Data-Identity Lead:** `INSERT OR REPLACE` into `entity_pipeline_state` versus the INSERT OR IGNORE rule is your call.
- **ETF-PL backlog:** CR-10 step 5 (guarded `DELETE` of the entity keys) remains with ETF-PL after steps 3–4.

**Stop point reached.** Status JSON and the board row are left to the Main Lane.
