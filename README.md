# Meridian Atlas — Clean Snapshot (v11, July 26, 2026)

This folder is a clean copy of everything that's actually live/current as of the
Sprint 4 release (commit `684b9e4` on `corporate-atlas-v4-deploy-clean`), pulled
out of the messier working folders (`June Refresh`, `July Refresh`) so there's
one place that reflects reality without old branches, dead files, or multi-GB
scratch data mixed in.

## What's here

- **App/** — the full frontend + Cloudflare Workers source, straight from
  `June Refresh` (the `corporate-atlas-v4-deploy-clean` branch). This is what's
  deployed to GitHub Pages + Cloudflare Workers today.
- **13F Seed/** — the seed/backfill scripts (`seed-holdings.js`,
  `seed-entity-cik.js`, `seed-financialfact.js`, etc.) from
  `July Refresh/Base Files/13F Seed`, plus the `.env` needed to run them.
- **Meridian_Atlas_Current_State_v11.docx** (inside App/) — the current-state
  doc covering everything through Sprint 4.

## What was deliberately left out (and why)

- `.git` history, `.DS_Store`, `.wrangler` — not needed for a working copy.
- `node_modules` (App/Corporate Atlas, 13F Seed) — reinstall with `npm install`.
- `gleif_local.db` (2.5GB) + the GLEIF golden-copy CSV/ZIP dumps (~800MB) — a
  local scratch build from a one-time GLEIF seeding run. Re-downloadable from
  GLEIF if ever needed again; not part of the running app.
- `2025_Q1`–`2025_Q4` folders inside 13F Seed (~1.7GB total) — raw SEC bulk
  INFOTABLE.tsv downloads used as input for the seed scripts. Re-downloadable
  from SEC's bulk data site; not needed unless re-running a from-scratch seed.

## Known open items (see Current State doc, Section 21.8, for detail)

- `financialfact_reported` "Phase 1" scope predates some now-resolved CIKs
  (e.g. Danaher) — Financials panel still empty for those until a re-run.
- `entity_master` has at least one confirmed LEI duplicate (Danaher); full
  scope across the table not yet assessed.
- ~5,653 entities still unmatched on CIK; not yet broken down by cause.
- `primary_ticker` unpopulated — ticker-matching fallback is currently dead code.

## Two similarly-named git branches exist upstream — don't mix them up

`corporate-atlas-v4-deploy` (no "-clean") is a **stale branch frozen at the
pre-Sprint-2 state** (identical to `main`, June 21). All July work — Sprint 2,
3, and 4 — is on `corporate-atlas-v4-deploy-clean` only. GitHub Pages is
confirmed (checked July 26) to be building from `corporate-atlas-v4-deploy-clean`.
If a future deploy ever looks stale again, check Settings → Pages → source
branch first, and rule out browser caching (hard refresh) before assuming the
deploy itself is broken.
