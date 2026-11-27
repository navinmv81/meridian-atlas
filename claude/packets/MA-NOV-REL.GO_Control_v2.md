# MA-NOV-REL.GO — November single go-live: exposure, Ops, homepage, bonds (index + entities-api deploy + Pages → `November-2026` `/docs`) — Control v2

```text
ISSUED BY:    Program Orchestrator (November Main Lane), 2026-11-26 (supersedes Control v1 of 2026-11-22)
EXECUTED BY:  Operations Lead + Engineering Lead — interactive Claude Code via LANE_OPENER_v2.md, **with the Founder present** (one manual step)
REVIEWED BY:  Main Lane verification of the post-release checks
APPROVED BY:  Founder — "one go-live, no piecemeal" (NML-1122-10); "index in, go-live Thursday" (26 Nov 06:34); this packet's Start Approval is the **release approval**
PACKET:       MA-NOV-REL.GO · Control v2 · usage class medium · write owner Operations Lead
```

## What
One release for all of November: exposure screen (EXP), Ops cleanup, homepage (HOME), and bonds (BOND-01–12). Bond data is already live (MA-NOV-BOND.APPLY); the exposure route and back-fill are already live. This packet adds the rest, in this order:
- **Part A — prep (repo only):**
  - (M-1) one release token `rel-20261126` as a `?v=` stamp on every local `<script src>` (and local stylesheet, if any) in `App/index.html`;
  - (M-2) restore the docs-mirror check in `App/Ops/tests/ops-a.test.mjs` as a hard check (11 files byte-identical + `docs/.nojekyll`);
  - index files `App/Corporate Atlas/migrations/ma-nov-bond-idx1.sql` (`CREATE INDEX IF NOT EXISTS idx_bi_cik_status ON bond_issuance(cik, filing_status, status_reason);`) and `ma-nov-bond-idx1-rollback.sql` (`DROP INDEX IF EXISTS idx_bi_cik_status;`);
  - `node generate-docs.mjs --dry-run` + diff, then `node generate-docs.mjs`; confirm `docs/.nojekyll`;
  - write the release CR `claude/specs/MA-NOV-REL_CR.md` (change, impact, D1 cost, rollback per part, checks);
  - all front-end, Ops, FI and exposure suites green; one commit; push `November-2026`.
- **Part B — index (D1, one DDL):** apply `ma-nov-bond-idx1.sql` once; verify the plans (see Steps).
- **Part C — Worker:** deploy `meridian-entities-api` from the pushed commit, with the previous version captured; live API checks.
- **Part D — Founder, manual:** ask the Founder to switch GitHub Pages to **`November-2026` / `/docs`** and wait for "switched". Do not proceed without it.
- **Part E — front-end checks** (≥ 10 min after the push, `cache-control: no-cache`).
- **CLAUDE.md:** after Part E passes, update the DEPLOY_BRANCH entry only.

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`, branch `November-2026` (HEAD `01dd3dc` = origin). Live site `https://navinmv81.github.io/meridian-atlas/` (currently `October-2026` `/docs`, `98e830e`). D1 commands from the repo root with `--remote`, **no `-c`**; Worker commands always with `-c "App/Corporate Atlas/wrangler-entities-api.toml"`. Code 10000: retry once after `whoami`, then stop. Writable (checked by `end`): `App/index.html` (stamps only), `App/Ops/tests/ops-a.test.mjs` (mirror check only), `App/Corporate Atlas/migrations/ma-nov-bond-idx1.sql`, `App/Corporate Atlas/migrations/ma-nov-bond-idx1-rollback.sql`, `docs/`, `CLAUDE.md` (DEPLOY_BRANCH entry only), `claude/specs/MA-NOV-REL_CR.md`, `claude/packets/MA-NOV-REL.GO_Report.md`. `allow_commits: true` (Part A commit; a second commit for CLAUDE.md + report); may push `November-2026`.

## Allowed actions
Edits within scope; `generate-docs.mjs` (dry run and real); tests; `wrangler whoami`; the one index DDL file, once; read-only D1: `EXPLAIN QUERY PLAN` and SELECTs on `bond_issuance`, `bond_offering_*` and `sqlite_master` only (≤ 12 statements, ≤ 10,000 rows read; **no `PRAGMA quick_check`/`integrity_check`** — NML-1125-2); `deployments list -c …`; **one** `npx wrangler deploy -c …` (and `--dry-run` before it); `npx wrangler rollback <captured> -c … -m "<reason>"` only on a trigger; HTTP GETs to the live site, `meridian-entities-api` routes named below and the two Ops GET routes; read-only git, `git ls-remote`; ask the Founder in the session; write the report.

## Prohibited actions
Changing GitHub settings yourself; any other code change; any other D1 write; other Workers; toml, crons, secrets; `October-2026` or `September-2026` branches; force-push; `.env*`, printing tokens; `*_Status.json`, board, Tower, `transitions.jsonl`, logs; installs; subagents; `13F Seed/gleif-seed.js`.

## Time rules
Part B only between 07:10Z and 23:45Z, never in 05:50–07:10Z or 23:50–00:10Z.

## Stop gates
Pinned hash mismatch; HEAD ≠ origin; suites failing; `generate-docs` changes files other than `index.html`, `ma-entities.js`, `ma-ops.js`, `ma-search.js`; the Founder does not confirm the Pages switch (stop after Part C, report "API released, front end not released" — safe, the API change is additive).

## Rollback triggers
- **B:** index plans not `SEARCH … USING INDEX idx_bi_cik_status` for the issuer-counts query, or any 009 F1 final-list query no longer on its partial index `idx_bi_cik_final_key` → run `ma-nov-bond-idx1-rollback.sql`, stop.
- **C:** deploy errors; bindings or routes differ; an API check below fails and cannot be fixed in one line → `wrangler rollback <captured>`; stop (index may stay; it is harmless).
- **E:** a front-end check fails and cannot be fixed in one line → ask the Founder to switch Pages back to **`October-2026` / `/docs`**; record. Worker stays (additive).

## Success conditions
Index live with verified plans; `meridian-entities-api` deployed (previous → new version ids); API checks pass; Pages switched by the Founder; front-end checks pass; CLAUDE.md DEPLOY_BRANCH updated; report with every check and the Founder's live UAT checklist; `end`. Or a clean partial outcome with evidence.
