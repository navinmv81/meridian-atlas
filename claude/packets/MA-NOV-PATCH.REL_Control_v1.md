# MA-NOV-PATCH.REL — November patch release: UIT funds on screen, trust wording, bootstrap cron off, dead agent removed — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-27
EXECUTED BY:  Operations Lead + Engineering Lead — interactive Claude Code via LANE_OPENER_v2.md, **Founder present** (Part D)
REVIEWED BY:  Main Lane verification of the live checks
APPROVED BY:  Founder — patch plan (NML-1126-6); this packet's Start Approval is the release approval
PACKET:       MA-NOV-PATCH.REL · Control v1 · usage class small · write owner Operations Lead
```

## What
- **A — front end (repo):**
  1. `App/ma-etf.js`: remove `SPY`, `QQQ`, `DIA` from the hard-coded `NO_NPORT` set (UIT.REVIEW F4) so their Holdings tab shows the stored holdings. Nothing else in that set changes.
  2. `App/ma-entities.js` (exposure block only): when R-EXP1 answers `no_holdings` with reason `no_series_id`, say plainly: **"This fund doesn't file a holdings report we can read (it isn't a 1940-Act fund — for example a commodity or crypto trust), so its holdings can't be shown."** Other `no_holdings` reasons keep "We don't have this fund's holdings." Front end only — no Worker change.
  3. `generate-docs.mjs`: `--dry-run` writes to a directory under `os.tmpdir()` instead of `.docs-dry-run/` in the repo (REL.GO finding); print the path. No other change.
  4. `App/index.html`: bump every `?v=rel-20261126` to `?v=rel-20261127`.
  5. Tests updated/added for 1–3; all front-end, exposure, ETF and Ops suites green (incl. the docs-mirror hard check); `node generate-docs.mjs --dry-run` → diff (expect `index.html`, `ma-etf.js`, `ma-entities.js` only) → `node generate-docs.mjs`; `docs/.nojekyll` present; one commit; push `November-2026` (Pages already serves `November-2026` `/docs`, so the push is the release).
- **B — bootstrap cron off (three-point check in the report):** in `App/ETF Refresh/wrangler-bootstrap.toml` set `crons = []` (keep a comment with the old `0 */4 * * *` and the reason: bootstrap complete since 2026-06-11, 0 work per run, frees 1 of 5 cron slots — DIAG.HEALTH §3.5). Capture the current version; `npx wrangler deploy -c "App/ETF Refresh/wrangler-bootstrap.toml"`; confirm the output lists no schedule and bindings/vars unchanged. Rollback: restore the line and redeploy (or `wrangler rollback <captured>`).
- **C — live checks (≥ 10 min after the push, `cache-control: no-cache`):** served files byte-identical to `docs/` (11) + `/.nojekyll`; stamps `rel-20261127`; `GET /api/exposure/etf/SPY`, `/QQQ`, `/DIA`, `/MDY` → 200 with holdings, newest months 2026-09 / 2026-06 / 2026-07 / 2026-09; `/GLD` → 404 `no_series_id`; screen: exposure with SPY in the mix works; GLD shows the new wording; ETF Holdings tab for SPY and MDY shows holdings; IVV exposure unchanged.
- **D — dead agent removed (Founder present):** `com.meridianatlas.financialfact-backfill` (exit 78 daily since ~23 Aug; registry `held`). `launchctl bootout gui/$(id -u)/com.meridianatlas.financialfact-backfill`; **move** (do not delete) its plist from `~/Library/LaunchAgents/` to `~/Library/LaunchAgents/_retired-meridian/` (create it); confirm `launchctl list` no longer shows it. Its script and logs in `13F Seed/` stay untouched. Rollback: move the plist back and `launchctl bootstrap gui/$(id -u) <plist>`.
- **CLAUDE.md:** DEPLOY_BRANCH entry: add the new stamp and commit (one line); Cron Trigger capacity line: 4 of 5 in use after B. Nothing else.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `f538f6e` = origin). Worker commands always with `-c`. Writable (checked by `end`): `App/ma-etf.js` (NO_NPORT only), `App/ma-entities.js` (exposure no-holdings wording only), `App/index.html` (stamps only), `generate-docs.mjs` (dry-run target only), `App/ETF Refresh/wrangler-bootstrap.toml` (crons only), `App/Corporate Atlas/tests/`, `App/Ops/tests/`, `docs/`, `CLAUDE.md` (the two lines), `claude/packets/MA-NOV-PATCH.REL_Report.md`. Outside the repo: the one plist move in Part D. `allow_commits: true` (Part A commit; a second for toml + CLAUDE.md + report); may push.

## Allowed actions
Edits within scope; tests; generate-docs; `whoami`; `deployments list` / one `deploy` / `rollback` (trigger only) for `meridian-bootstrap` only; HTTP GETs to the live site and the public exposure route; `launchctl list/print/bootout` for the one label and the one `mv`; read-only git; commits; push; write the report.

## Prohibited actions
Any D1 query or write; other Workers; any other toml/cron/secret; GitHub settings; other LaunchAgents; deleting files; `13F Seed/` contents; `.env*`, printing tokens; Status/board/Tower/logs; installs; subagents; `13F Seed/gleif-seed.js`.

## Stop gates
Pin mismatch; HEAD ≠ origin; suites failing; generate-docs diff beyond the 3 files; bootstrap deploy output shows a changed binding/var or a remaining schedule (→ rollback); Founder not present for Part D (skip D, report it).

## Success conditions
Released and verified; bootstrap deployed without a cron (previous → new version ids); agent booted out and plist moved; CLAUDE.md two lines; report with every check, the three-point check for B, and rollback commands; `end`.
