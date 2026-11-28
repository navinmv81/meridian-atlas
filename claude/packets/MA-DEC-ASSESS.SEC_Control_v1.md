# MA-DEC-ASSESS.SEC — read-only security and access assessment (SEC-01, SEC-03, AUD-01) — Control v1

```text
ISSUED BY:    Program Orchestrator (December Main Lane), 2026-11-28
EXECUTED BY:  Operations Lead (security assessment) — interactive Claude Code via LANE_OPENER_v3.md (fixed line)
REVIEWED BY:  Main Lane verification; findings ranked at C1b; any fix is a separate packet with its own review
APPROVED BY:  Founder — run spec Workstreams A and F (DML-1128-2); Start Approval in MA-DEC-ASSESS.SEC_Status.json
PACKET:       MA-DEC-ASSESS.SEC · Control v1 · usage class medium · write owner Operations Lead (report only)
```

## Objective
Establish, with evidence, what an anonymous caller can reach on the live Workers and what is over-privileged, and prepare the evidence for whether the two historical token literals are revoked. Recommend options for SEC-02. **Change nothing.**

## Session facts
Folder `/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`; branch `December-2026`, HEAD `5af1351` = origin. Hosts in the front end: `meridian-ops`, `meridian-entities-api`, `meridian-proxy`, `meridian-13f`, `meridian-filings` (`*.navinmv1981.workers.dev`); also `meridian-control`, `meridian-holdings`, `meridian-entities-enrich`, `meridian-entities-seed`, `meridian-bootstrap` (from `wrangler-*.toml`).

## Work
1. **Route inventory (SEC-01, AUD-01) from source:** for every Worker in the repo, list each route: method, path, auth (none / Access / service token / bearer secret / admin 401-closed), CORS header, D1 tables read or written, and who calls it (front end module, Ops console `console-page.js`/`ma-ops.js`, the health-check LaunchAgent under `App/Ops/scripts/`, other Workers).
2. **Live anonymous probe:** for each route the source says is reachable without auth and that is a GET (or OPTIONS), send **one** request with no credentials and no cookies: record HTTP status, content-type, response size, top-level JSON keys and row counts, and a one-line **data class** (e.g. "job names and run times", "case titles", "D1 usage numbers"). **Never record values** beyond counts and key names. Also send one anonymous request to each mutating route only as `OPTIONS` or a GET to its path, never POST/PUT/DELETE. Budget: ≤ 60 requests total; estimate the D1 reads each probe causes from the route code and total them. Not inside 17:40–18:10Z or 23:50–00:10Z, not on Sunday.
3. **Consumers if protected (input to SEC-02):** exactly which callers would break if the anonymous GETs were closed, and how each could authenticate (the existing Access service token in `OPS_SERVICE_ACTORS`, an Access policy on the hostname/path, or a bearer secret). Give 2–3 options with effect on the console, the LaunchAgent sweep, free-tier cost and rollback. No recommendation is applied.
4. **Token revocation evidence (SEC-03):** locate every token literal in git history (`git log -p --all` / `git grep` across reachable commits, including `c3a07c7`) and in the untracked `13F Seed/gleif-seed.js`. Report each by **location and a fingerprint only** — `sha256(token)` first 12 hex characters and its length; never the literal, never any part of it. Do **not** call any API with a literal. Write a short Founder checklist for the Cloudflare dashboard (My Profile → API Tokens, and account API tokens) to confirm whether each token still exists, by name/creation date, plus the rotation steps if revocation cannot be confirmed. Note whether the repo is public (`gh repo view --json visibility` or the remote URL).
5. **Over-privilege (AUD-01):** `wrangler secret list` per Worker (`-c` each toml; names only); `.claude/settings.local.json` allow-list entries that permit deploys, secret writes or remote D1 execution (names of entries only); CORS `*` on routes that return non-public data; any admin route that is not fail-closed.
6. **Findings:** ranked list, each with severity (Critical / High / Medium / Low), owner, and proposed disposition (fix now / schedule / accept), plus which spec requirement it feeds.

## Allowed
Read-only git and file reads; `curl` GET/OPTIONS as in step 2 (no auth headers, no cookies); `npx wrangler whoami`, `npx wrangler deployments list -c …`, `npx wrangler secret list -c …` (read-only); `gh repo view` (read-only); write `claude/packets/MA-DEC-ASSESS.SEC_Report.md`; `dispatch.mjs end`.

## Prohibited
Any write, deploy, rollback, secret put/delete, D1 query or write (`wrangler d1 …` of any kind), Access/Cloudflare dashboard or API changes, POST/PUT/PATCH/DELETE to any route, using or printing any token or secret value or any part of a literal, reading `.env*` files, `git` writes of any kind, editing any file but the report, installs, subagents, `13F Seed/gleif-seed.js` beyond a read-only scan for the fingerprint.

## Stop gates
Lock present; HEAD ≠ `5af1351` or ≠ origin; any command would print a secret value; a probe returns data that looks like credentials or personal data (stop probing that host, record the route, report it as Critical); request budget reached.

## Success
Report with: route inventory table; probe table (status, keys, counts, data class, est. D1 reads); consumer map and SEC-02 options; token-fingerprint table and Founder checklist; over-privilege list; ranked findings. Then `end`.
