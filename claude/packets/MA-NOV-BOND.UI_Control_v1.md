# MA-NOV-BOND.UI — Bond visibility + "Offering details" / "Who's involved" (API + screen), local only — Control v1

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-22
EXECUTED BY:  Engineering Lead + UX Lead (Entities domain) — interactive Claude Code via LANE_OPENER_v2.md
REVIEWED BY:  Main Lane; the single go-live release packet re-checks it live
APPROVED BY:  Founder — bond spec v1 §5 + v2 §10 (NML-1122-2); single go-live (NML-1122-10); Start Approval required. No deploy, no D1 writes
PACKET:       MA-NOV-BOND.UI · Control v1 · usage class medium · write owner Engineering Lead
```

## Scope
- **API** (`meridian-entities-api`, FI routes only): spec v1 §5 — issuer document counts by class (F1), bond detail with `status_reason` / `superseded_by` / `status_note` (F2), the exceptions list (F5), and per spec v2 §10 `offering: { facts, parties, states }` on bond detail (one PK-range read per CR2 table). Measure D-CR3: plan + reads of the issuer counts query; add `idx_bi_cik_status` **only as a recommendation** (no DDL here).
- **Screen** (`ma-entities.js` FI/bond block only): issuer document counts with plain reasons; drafts never shown as bonds; "Offering details" and "Who's involved" panels exactly as spec v2 §10 (labels, groups, source links, the three not-shown states; show-where-found fields omitted when absent); phone width; keyboard; banned words absent.
- **Fields hidden by the §6.3 gate** (from MA-NOV-BOND.REVIEW, if it has run) are read from one constant list, so the release can hide fields without code changes.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD = origin). Writable (checked by `end`): `App/Corporate Atlas/src/entities-api.js` (FI routes only), `App/ma-entities.js` (FI/bond block only), `App/Corporate Atlas/tests/` (new `bond-ui*`/`fi-nov*` files), `claude/packets/MA-NOV-BOND.UI_Report.md`. `allow_commits: true`; may push `November-2026`.

## Allowed actions
Edit within scope; tests; **local preview with a local Worker** (`npx wrangler dev --local -c "App/Corporate Atlas/wrangler-entities-api.toml"`) against a **local** D1 seeded from one read-only `SELECT *` of `bond_issuance` + `bond_issuer_link` (≤ 2 statements, ≤ 2,000 rows) and the committed CR1/CR2 migrations + FIX2/offering apply SQL run **locally only**; the front end served locally and pointed at the local Worker for the preview; screenshots to the scratchpad; read-only git, `git ls-remote`; `git add -- <explicit paths>`; one commit; push; write the report.

## Prohibited actions
`wrangler deploy` (real) or any remote D1 write; running SQL against remote D1 beyond the 2 reads; other routes; other files; `docs/`; storage; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; installs (beyond what `wrangler dev` already uses); subagents; `13F Seed/gleif-seed.js`.

## Stop gates
Pinned hash mismatch; a spec v2 §10 label that cannot be applied as written; existing suites failing; push rejected.

## Success conditions
API + screen built; tests; local preview shows an issuer with each class, a multi-tranche deal with per-tranche price and early repayment, a pricing supplement showing "Not stated in the filing" for the trustee, Who's involved with roles; D-CR3 measured; one commit pushed; report with screenshots' observations; `end`. Nothing deployed.
