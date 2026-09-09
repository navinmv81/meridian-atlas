#!/usr/bin/env node
// generate-docs.mjs — MA-SEP-013
//
// Adapts the previously-manual "flatten and copy" release step (App/'s 11
// frontend files -> a flat-root checkout of the separate
// corporate-atlas-v4-deploy-clean branch) into a repeatable script that
// writes a flattened mirror into /docs at repo root, on September-2026
// itself. No script for the old process existed anywhere in this repo or on
// corporate-atlas-v4-deploy-clean's own tree (confirmed by search before
// writing this) — the old step was genuinely manual. This is new tooling
// implementing the same process for the new target, not a literal edit of
// prior code.
//
// GitHub Pages supports serving directly from a /docs folder at repo root on
// any branch — this is what lets September-2026 become the Pages source
// directly, collapsing the two-branch deploy model (see
// claude/MA-SEP-013_Change_Request.md).
//
// Touches ONLY the 11 named frontend files, reading from App/ and writing to
// docs/ (or a dry-run scratch dir). Does NOT touch App/Corporate Atlas/,
// App/ETF Refresh/, App/Ops/, or 13F Seed/ — those are backend/Worker source,
// entirely out of scope for this script.
//
// Manual-trigger only, per MA-SEP-013's Change Request and CLAUDE.md's
// standing "Recurring/automated components stay inside Cloudflare" rule —
// this is neither, but is deliberately NOT wired into any cron, git hook, or
// CI step. Run it by hand, review, commit, push — same discipline as the
// process it replaces.
//
// Usage:
//   node generate-docs.mjs             — write the real docs/ folder
//   node generate-docs.mjs --dry-run   — write to .docs-dry-run/ instead,
//                                         for diffing before ever touching
//                                         the real docs/ folder (MA-SEP-013
//                                         Step 3)

import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = __dirname; // this script lives at repo root, next to App/ and docs/
const APP_DIR = join(REPO_ROOT, 'App');
const DOCS_DIR = join(REPO_ROOT, 'docs');

// The 11 frontend files, and only these — the exact list from
// claude/MA-SEP-013_Change_Request.md and CLAUDE.md's Environment Truth
// section. Do not add to this list without updating both docs.
const FRONTEND_FILES = [
  'index.html',
  'ma-etf.js',
  'ma-entities.js',
  'ma-13f.js',
  'ma-research.js',
  'ma-ops.js',
  'ma-modal.js',
  'ma-dcf.js',
  'ma-market.js',
  'ma-data.js',
  'ma-search.js',
];

const dryRun = process.argv.includes('--dry-run');
const targetDir = dryRun ? join(REPO_ROOT, '.docs-dry-run') : DOCS_DIR;

if (!existsSync(APP_DIR)) {
  console.error(`[generate-docs] App/ not found at ${APP_DIR} — aborting, nothing written.`);
  process.exit(1);
}

if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });

// Fail closed: if any source file is missing, abort before writing anything,
// rather than publish a partial flatten (this is exactly the "New /docs-
// generation script is untested code... a bug could push a broken or partial
// flatten" risk the Change Request's Risk Assessment names — refuse to be
// that bug).
const missing = FRONTEND_FILES.filter(f => !existsSync(join(APP_DIR, f)));
if (missing.length) {
  console.error(`[generate-docs] Missing source file(s) in App/, aborting before any write: ${missing.join(', ')}`);
  process.exit(1);
}

let copied = 0;
for (const file of FRONTEND_FILES) {
  copyFileSync(join(APP_DIR, file), join(targetDir, file));
  copied++;
}

console.log(`[generate-docs] ${dryRun ? 'DRY RUN — ' : ''}Copied ${copied}/${FRONTEND_FILES.length} frontend files from App/ to ${targetDir}`);
if (dryRun) {
  console.log(`[generate-docs] Dry-run output is at ${targetDir} for diffing (not written to docs/). Re-run without --dry-run to publish for real.`);
}
