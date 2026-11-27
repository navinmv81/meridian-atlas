# MA-NOV-REL.GO — Task v2

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-26 (supersedes Task v1)
EXECUTED BY:  Operations Lead + Engineering Lead — interactive, LANE_OPENER_v2.md, Founder present
APPROVED BY:  Founder — Start Approval in MA-NOV-REL.GO_Status.json (= release approval)
CONTROL:      claude/packets/MA-NOV-REL.GO_Control_v2.md
```

## Pins
| File | sha256 |
|---|---|
| `claude/specs/MA-NOV-UI_Spec.md` (§4 release plan) | `4b9896de89f238a8299bae579052dd0f46b98a6e1d612a56a9a957780a164abd` |
| `claude/packets/MA-NOV-UI.REVIEW_Report.md` (must-carry list) | `bec0ce5d313f01417144a4d556f4d93a8c6413f7b7ce09aafd725cd57cfabc6f` |
| `claude/packets/MA-NOV-BOND.UI_Report.md` (§4 D-CR3, §6 release notes and live checks) | `c0456a5f5ac2d01cce33c6e5eec68888dd74f93c34c8b78ab3894b9cdd1825c6` |
| `claude/packets/MA-NOV-BOND.APPLY_Report.md` (§9 rollback order) | `54df631fe1caf4e1007b8348f62ea971050aa892ddcb6c7a5ba9c4dff27ac634` |

## Steps (C = `-c "App/Corporate Atlas/wrangler-entities-api.toml"`)
1. **A — prep.** Stamps `?v=rel-20261126`; mirror hard check; the two index files; dry-run generate + diff (expect exactly `index.html`, `ma-entities.js`, `ma-ops.js`, `ma-search.js` vs `docs/` today); generate; `docs/.nojekyll`; suites green (bond-ui, fi-009-worker, fi-010-frontend, exp-*, home-entry, ops-*, nav-007-*, incl. the restored mirror check); write `claude/specs/MA-NOV-REL_CR.md`; commit "MA-NOV-REL.GO: November release — docs/ regenerated, script stamps, bond index files" (explicit paths); push; `ls-remote`.
2. **B — index.** `whoami`; time rule; `EXPLAIN QUERY PLAN` of the issuer-counts query (BOND.UI §4) and of the 009 F1 final-list query **before**; apply `ma-nov-bond-idx1.sql` once; the same two plans **after** → counts on `idx_bi_cik_status (cik=?)`, F1 still on `idx_bi_cik_final_key`; `sqlite_master` shows the index. Record rows written (≈ 943).
3. **C — Worker.** `deployments list C` → capture the current version (rollback target); `npx wrangler deploy C --dry-run`; `npx wrangler deploy C`; record the new version id; confirm bindings/routes unchanged. **API checks (GET, read-only):** the five in BOND.UI §6 (Dominion 1858 with and without `documents=1`; CIK 0000715957 documents = 22, `next_cursor` null; AbbVie `0001104659-24-027205/6` offering 25 facts / 22 parties, no withheld fields, `issue_price_pct` 99.657; Verizon `0001193125-24-131776/1` trustee `not_disclosed`); plus `GET /api/exposure/etf/SPY` → 200 with `newest_stored_month` (exposure still served by the new version).
4. **D — Founder.** Ask: "Please switch GitHub Pages (Settings → Pages) to branch November-2026, folder /docs, and reply 'switched'." Wait.
5. **E — checks** (≥ 10 min after the push; `cache-control: no-cache`): served files byte-identical to `docs/` (11) and `/.nojekyll` 200; script tags carry `?v=rel-20261126`; homepage at 1280/800/375 (Research card, DELAYED, no sideways scroll); company search "Taiwan Semiconductor" → #2191 → Back; `#/exposure` example shows "✓ Adds up to 100%"; Dominion issuer footer + "show list"; AbbVie bond page Offering details + Who's involved; O-11: one GET each of the Ops `release-ledger` and `sprint-board` routes → 200 with rows.
6. **Pass →** update the CLAUDE.md DEPLOY_BRANCH entry (source `November-2026` `/docs` at the Part A commit; rollback source `October-2026` `/docs` at `98e830e`; stamp rule: bump `?v=` on every release; entities-api version ids); second commit (CLAUDE.md + report); push. **Fail →** rollbacks per Control; record.

## Report — `claude/packets/MA-NOV-REL.GO_Report.md`
Header (outcome RELEASED / API-ONLY / ROLLED BACK; commits; version ids; D1 writes/reads); A diff + tests; B plans before/after; C deploy + API checks; D Founder's confirmation time; E checks table; **Founder live UAT checklist** (signed-in Ops console: four tabs, Cases drawer, DQ, Drift & Budget, Health, phone; homepage; exposure; bonds: Dominion, AbbVie, Verizon); rollback commands for every part; CLAUDE.md change; boundaries kept. Then `node tools/factory/dispatch.mjs end MA-NOV-REL.GO`.
