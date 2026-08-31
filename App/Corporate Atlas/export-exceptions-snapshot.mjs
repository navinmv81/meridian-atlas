#!/usr/bin/env node
// export-exceptions-snapshot.mjs
// MA-SEP-012c — local, read-only export of entity_merge_exceptions (created by
// MA-SEP-012b) into a single self-contained HTML file. No Worker, no cron, no
// network call in the generated page — the data is baked in at generation time.
//
// Re-run any time to refresh: node export-exceptions-snapshot.mjs
// (from App/Corporate Atlas/, or any directory — paths below are absolute).
//
// Replaces the friction the Founder hit with admin-exceptions.html's live-fetch
// approach (locating the gitignored secret, running from the right folder, an
// unresolved "Failed to fetch" under file:// origin) with a page that needs
// none of that: open it, the data is already there.

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_NAME     = 'meridian-etf';
const WRANGLER_TOML = path.join(__dirname, 'wrangler-entities-api.toml');
const OUTPUT_PATH = path.join(__dirname, 'entity-exceptions-snapshot.html');

// Same `wrangler d1 execute --json` transport firds-local-seed.mjs and
// entities-enrich-boost-run.mjs use for real local D1 access (via wrangler's own
// authenticated session — no separate CF_API_TOKEN needed).
function queryExceptions() {
  const sql = `
    SELECT
      em.id, em.lei,
      em.entity_id_a, ea.name AS entity_a_name,
      em.entity_id_b, eb.name AS entity_b_name,
      em.decision, em.reason, em.corporate_action_note,
      em.decided_by, em.decided_at
    FROM entity_merge_exceptions em
    LEFT JOIN entity_master ea ON ea.entity_id = em.entity_id_a
    LEFT JOIN entity_master eb ON eb.entity_id = em.entity_id_b
    ORDER BY em.decided_at DESC
  `.replace(/\s+/g, ' ').trim();

  let out;
  try {
    out = execFileSync(
      'npx',
      ['wrangler', 'd1', 'execute', DB_NAME, '--config', WRANGLER_TOML, '--remote', '--json', '--command', sql],
      { maxBuffer: 1024 * 1024 * 8, timeout: 30000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
  } catch (err) {
    const detail = [
      `message=${err.message}`,
      err.status !== undefined ? `status=${err.status}` : null,
      err.stdout ? `stdout=${err.stdout}` : null,
      err.stderr ? `stderr=${err.stderr}` : null
    ].filter(Boolean).join(' | ');
    throw new Error(`wrangler d1 execute failed: ${detail}`);
  }

  const parsed = JSON.parse(out);
  return parsed?.[0]?.results ?? [];
}

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function buildHtml(rows, generatedAt) {
  const dataJson = JSON.stringify(rows, null, 2);

  const rowsHtml = rows.map(r => `
    <tr>
      <td>${r.id}</td>
      <td>${esc(r.entity_a_name) || '(unknown)'} <span class="id">#${r.entity_id_a}</span>
        &harr;
        ${esc(r.entity_b_name) || '(unknown)'} <span class="id">#${r.entity_id_b}</span></td>
      <td>${esc(r.lei) || '<span class="muted">—</span>'}</td>
      <td><span class="badge ${r.decision === 'do_not_merge' ? 'badge-no' : 'badge-yes'}">${esc(r.decision)}</span></td>
      <td>${esc(r.reason) || '<span class="muted">—</span>'}</td>
      <td>${esc(r.corporate_action_note) || '<span class="muted">—</span>'}</td>
      <td>${esc(r.decided_by)}</td>
      <td>${esc(r.decided_at)}</td>
    </tr>`).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Entity Merge Exceptions — Snapshot</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 2rem auto; max-width: 1100px; padding: 0 1.5rem; line-height: 1.5; }
  h1 { font-size: 1.4rem; margin-bottom: 0.25rem; }
  .meta { color: #666; font-size: 0.9rem; margin-bottom: 1.5rem; }
  .banner { background: #fff8e1; border: 1px solid #e0c46c; border-radius: 6px; padding: 0.75rem 1rem; margin-bottom: 1.5rem; font-size: 0.9rem; }
  table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
  th, td { border: 1px solid #ddd; padding: 0.5rem 0.6rem; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; position: sticky; top: 0; }
  .id { color: #999; font-size: 0.8rem; }
  .muted { color: #aaa; }
  .badge { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600; }
  .badge-no { background: #fde2e2; color: #a12222; }
  .badge-yes { background: #dcf5dc; color: #1c6b1c; }
  @media (prefers-color-scheme: dark) {
    body { background: #16181d; color: #e6e6e6; }
    th { background: #22252c; }
    th, td { border-color: #3a3d44; }
    .meta { color: #999; }
    .banner { background: #3a3320; border-color: #6b5c2e; color: #e6dcc0; }
    .badge-no { background: #4a1f1f; color: #f3a5a5; }
    .badge-yes { background: #1f3a20; color: #a5d6a5; }
  }
</style>
</head>
<body>
  <h1>Entity Merge Exceptions — Snapshot</h1>
  <div class="meta">Snapshot generated at ${esc(generatedAt)} &middot; ${rows.length} row${rows.length === 1 ? '' : 's'}</div>
  <div class="banner">
    This is a static snapshot — the data below was baked in when this file was generated and does not update itself.
    It makes <strong>zero network requests</strong>: no fetch, no API calls, nothing loaded from the internet. Re-run
    <code>node export-exceptions-snapshot.mjs</code> to regenerate with current data. View-only — this page has no
    add/edit capability by design (MA-SEP-012c).
  </div>
  <table>
    <thead>
      <tr>
        <th>ID</th><th>Entities (A &harr; B)</th><th>LEI</th><th>Decision</th>
        <th>Reason</th><th>Corporate Action Note</th><th>Decided By</th><th>Decided At</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="8" class="muted">No exceptions recorded.</td></tr>'}
    </tbody>
  </table>

  <script>
    // Data baked in at generation time — nothing here is fetched at runtime.
    const EXCEPTIONS = ${dataJson};
    const GENERATED_AT = ${JSON.stringify(generatedAt)};
  </script>
</body>
</html>
`;
}

function main() {
  console.log('=== MA-SEP-012c: entity_merge_exceptions snapshot export ===\n');
  console.log(`Querying live D1 (${DB_NAME}) via wrangler d1 execute --remote...`);

  const rows = queryExceptions();
  const generatedAt = new Date().toISOString();

  console.log(`Fetched ${rows.length} row(s) from entity_merge_exceptions.`);
  for (const r of rows) {
    console.log(`  #${r.id}: ${r.entity_a_name} (${r.entity_id_a}) <-> ${r.entity_b_name} (${r.entity_id_b}) — ${r.decision}`);
  }

  const html = buildHtml(rows, generatedAt);
  writeFileSync(OUTPUT_PATH, html, 'utf8');

  console.log(`\nWrote snapshot: ${OUTPUT_PATH}`);
  console.log('Open it directly in a browser (double-click / file://) — no server needed.');
  console.log('Done.');
}

main();
