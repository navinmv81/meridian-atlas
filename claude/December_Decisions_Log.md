# Meridian Atlas — December 2026 Decisions Log

Maintained by the Program Orchestrator (December Main Lane). November rulings are history, not December permissions. November records (`claude/November_Decisions_Log.md`, `claude/Release_Ledger_November_2026.md`, `Meridian_Atlas_Current_State_v15.docx`) are closed and kept unchanged. Timestamps are Europe/London = UTC (GMT).

Governing references: `Claude.md` v1.1 as amended by `claude/governance/Claude_md_v1.2.md`; `meridian_atlas_agentic_delivery_factory_operating_kit.md`; `claude_project_agentic_delivery_spec.md`; `claude/meridian_atlas_december_run_spec.md` (sha256 `9448a08a…9edb`, approved DML-1128-2); `Meridian_Atlas_Current_State_v15.docx`.

| Date | Ref | Decision | Approved by | Next |
|---|---|---|---|---|
| 2026-11-28 | DML-1128-1 | **December Main Lane opened** ("December Main Lane — Stability, Trust and Security"), 09:10Z, after the Founder closed November (NML-1128-1, 09:05). Role per Operating Kit §2: priorities, outcomes, approval preparation, exception resolution — no production authority. Baseline (read-only, `--no-optional-locks`): `November-2026` HEAD = origin = `9cb8dc7`; no `.git/*.lock`; untracked local files present and untouched. Pages stays on `November-2026` `/docs`; rollback source `October-2026` `/docs` `98e830e`. | Founder (request); Main Lane | Founder: run-spec §10 decisions |
| 2026-11-28 | DML-1128-2 | **Founder (09:12): "Approve 1-6".** (1) Theme and all eight workstreams A–H approved; run spec approved. (2) A, F, G are P0 and run first; D moves up beside A in the build order. (3) Branch **`December-2026`**, cut from `November-2026` `9cb8dc7`; Pages stays on `November-2026` `/docs` until the December go-live. (4) Full-reset credit (expires 10 Dec 22:00 GMT) will be spent **at a moment the Founder chooses**; the Main Lane flags the heavy packets that suit it but does not assume it. (5) Go-live **Thu 17 Dec**; freeze from **Fri 18 Dec**. (6) October carry-overs not in the spec (A2, 007 Phase 2, parser remarketing rule, held merges beyond EXP-D5) stay out. Decision 7 (freshness target) is taken at C1b. **Founder note:** weekly usage is at 28% on 28 Nov and the credit is in reserve, so the plan is pulled forward — C0 and the first read-only assessment start today rather than 30 Nov. | Founder | MA-DEC-BOOT |
| 2026-11-28 | DML-1128-3 | **Factory finding before issue:** `tools/factory` is hard-wired to the `MA-NOV-` prefix (`eligibility.mjs` default, `dispatch.mjs` `running`/`statusLines`, `project.mjs` listing, `state.mjs` ownership guard). An `MA-DEC-*` packet would be invisible to `dispatch check`/`begin` and the board, and the dispatcher field-ownership guard would not apply to it. Fix folded into MA-DEC-BOOT as the minimum change for the factory to keep running unchanged (spec §3, last bullet): a single month-prefix list covering `MA-NOV-` and `MA-DEC-`, tests added. Displaces nothing. Because of this, MA-DEC-BOOT itself runs from its Control directly (like MA-NOV-BOOT), not through `dispatch begin/end`. **MA-DEC-BOOT Control v1 + Task v1 issued.** | Main Lane | Founder: Start Approval |
| 2026-11-28 | DML-1128-4 | **MA-DEC-BOOT verified (12:20Z).** Commit **`710242e`** (13 paths, parent `9cb8dc7`) = `origin/December-2026`; `origin/November-2026` still `9cb8dc7`; the 4 pinned files match inside the commit; `docs/` `App/` `13F Seed/` untouched; factory tests **52/52** (lane) and **52/52 re-run by the Main Lane**; report `b73d04ca…3449`. `dispatch check` now lists `MA-DEC-*`. BOOT → REVIEW_NEEDED: the factory diff still needs its independent light delta review (MA-DEC-FACTORY.REVIEW). | Main Lane (verification) | FACTORY.LABEL |
| 2026-11-28 | DML-1128-5 | **Founder (12:14): "adjust the Nov headings — this is causing confusion."** Cause: `project.mjs` hard-codes "November" in the board title/sections and the Tower title/heading/scope section; the board and Tower were last generated 09:05 under November. Main Lane: (1) **`LANE_OPENER_v3.md`** issued (sha256 `7aeefea2…6f8f`) — v2 with the header lines changed to December only, procedure unchanged; v1/v2 kept as history; (2) `claude/factory/config.json`: `opener` → v3, new `board` = {`label` "December 2026", `prefix` "MA-DEC-"} (ignored by the current code). **MA-DEC-FACTORY.LABEL Control v1 + Task v1 issued:** month label and board prefix read from config, November board and Tower archived byte-identical, December board/Tower generated; eligibility and dispatch unchanged. Then MA-DEC-FACTORY.REVIEW (independent, light) covers BOOT + LABEL. | Founder (request); Main Lane | Founder: Start Approval |

## Lane register (December)

| Lane | Surface | State | Notes |
|---|---|---|---|
| December Main Lane — Stability, Trust and Security | Cowork | **OPEN · active** | Program Orchestrator |
| November Main Lane | Cowork | CLOSED · reference only | November closed 28 Nov (NML-1128-1) |
| LANE-DEC-ENG (fixed-line runs) | Claude Code (local) | Opens with MA-DEC-BOOT | One packet per fresh session |
| Dispatcher | `tools/factory/dispatch.mjs` | Carried; prefix fix in MA-DEC-BOOT | Interactive begin/end; headless parked |

## Plan (pulled forward under DML-1128-2)

| Checkpoint | Packets | Target |
|---|---|---|
| C0 | MA-DEC-BOOT (branch, records, factory prefix) · MA-DEC-FACTORY.LABEL (December headings) · MA-DEC-FACTORY.REVIEW | Sat 28 Nov |
| C1a | MA-DEC-ASSESS.SEC (no D1) · MA-DEC-REC.DOC (doc-only) · MA-DEC-ASSESS.DATA (read-only D1; reads the Sun 29 Nov holdings run) · MA-DEC-ASSESS.OPS (read-only) | 28 Nov – Tue 1 Dec |
| C1b | One Founder decision request: ranked findings, freshness target, cuts | Wed 2 Dec |
| C2–C3 | A → D → B → C → E; H as filler | 3 – 15 Dec |
| C4 | Single go-live, close, v16, archives, coverage matrix | Thu 17 Dec; freeze from Fri 18 Dec |

Rules for every C1a packet: no D1 writes; per-fund equality queries only, no whole-database checks (25 Nov: one check used 2.34M reads); no D1 reads during the freeze windows (05:50–07:10, 11:40–12:10, 17:40–18:10, 23:50–00:10Z) or on Sunday.
