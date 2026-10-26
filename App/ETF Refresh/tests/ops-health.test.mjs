#!/usr/bin/env node
// MA-OCT-MON26.ENG1 (ML-1025-3) — GET /api/ops-health on meridian-proxy must never scan entity_master.
// Runs the real src/index.js fetch handler against a recording D1 stub (no network, no D1).
// Usage: node "App/ETF Refresh/tests/ops-health.test.mjs"
//   PROXY_SRC=<path to another index.js> runs the same checks against that copy (mutation check).
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = process.env.PROXY_SRC || path.join(HERE, '../src/index.js');
const { default: worker } = await import(pathToFileURL(SRC).href);

let pass = 0, fail = 0;
const check = (name, ok, got) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + String(JSON.stringify(got)).slice(0, 400)}`); };

// Recording D1 stub: every prepared SQL string is kept; canned rows by table.
const seen = [];
function rowsFor(sql) {
  if (/FROM\s+holdings_pipeline_state/i.test(sql) && /writes_today/i.test(sql) && !/IN\s*\(/i.test(sql)) return [{ key: 'writes_today_2026-10-26', value: '31' }];
  if (/FROM\s+holdings_pipeline_state/i.test(sql)) return [{ key: 'etf_offset', value: '71' }, { key: 'last_full_run', value: '2026-10-25T07:00:00Z' }, { key: 'last_run_status', value: 'ok' }];
  if (/FROM\s+etf_master/i.test(sql)) return [{ coverage_depth: 1, cnt: 200 }, { coverage_depth: 2, cnt: 44 }];
  if (/FROM\s+edgar_bootstrap_state/i.test(sql)) return [{ key: 'cik_offset', value: '12345' }];
  if (/FROM\s+entity_master/i.test(sql)) return [{ gleif_enrichment_version: 1, cnt: 1000 }, { gleif_enrichment_version: 2, cnt: 87800 }];
  return [];
}
function stmt(sql, args = []) {
  return {
    bind: (...a) => stmt(sql, a),
    async all() { seen.push(sql); const results = rowsFor(sql); return { results, meta: { rows_read: results.length } }; },
    async first() { seen.push(sql); return rowsFor(sql)[0] ?? null; },
    async run() { seen.push(sql); return { results: [], meta: { changes: 0 } }; },
  };
}
const env = { DB: { prepare: sql => stmt(sql) } };

const resp = await worker.fetch(new Request('https://meridian-proxy.test/api/ops-health'), env, { waitUntil() {} });
const body = await resp.json();

// --- the fix ---------------------------------------------------------------------
check('ops-health issues NO query containing FROM entity_master', !seen.some(s => /FROM\s+entity_master/i.test(s)), seen.filter(s => /entity_master/i.test(s)));
check('ops-health issues no LIKE on holdings_pipeline_state (PK range instead)', !seen.some(s => /holdings_pipeline_state/i.test(s) && /\bLIKE\b/i.test(s)), seen.filter(s => /LIKE/i.test(s)));
check('ops-health issues no write', !seen.some(s => /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(s)), seen);
check('at most 4 queries per call', seen.length <= 4, seen.length);

// --- backward-compatible shape for the live Ops console (September-2026 docs/ma-ops.js) ---
check('200 with JSON + CORS', resp.status === 200 && resp.headers.get('access-control-allow-origin') === '*', { status: resp.status, acao: resp.headers.get('access-control-allow-origin') });
for (const k of ['pipeline', 'coverage', 'bootstrap', 'enrichment', 'snapshot_at']) check(`top-level key "${k}" kept`, k in body, Object.keys(body));
for (const k of ['offset', 'total', 'last_run', 'last_status', 'writes_today', 'writes_limit', 'writes_guard']) check(`pipeline.${k} kept`, k in body.pipeline, body.pipeline);
check('pipeline values unchanged in kind (offset 71, writes_today 31)', body.pipeline.offset === 71 && body.pipeline.writes_today === 31, body.pipeline);
check('coverage computed as before (depth_1 200, depth_2_plus 44)', body.coverage.depth_1 === 200 && body.coverage.depth_2_plus === 44, body.coverage);
check('bootstrap.current_cik kept', body.bootstrap.current_cik === 12345, body.bootstrap);
for (const k of ['version_1_pending', 'version_2_complete', 'total']) check(`enrichment.${k} key kept (null = removed)`, k in body.enrichment && body.enrichment[k] === null, body.enrichment);
check('enrichment_source = removed-ML-1025-3, by_version {}', body.enrichment.enrichment_source === 'removed-ML-1025-3' && JSON.stringify(body.enrichment.by_version) === '{}', body.enrichment);
check('rows_read reported (sum of meta.rows_read)', Number.isInteger(body.rows_read) && body.rows_read >= 0, body.rows_read);

// The live console's own arithmetic on these values renders without NaN or a thrown error (ma-ops.js l.164–166, 290).
const e = body.enrichment;
let ok = true, txt = '';
try {
  const enrichmentTotal = e.total || (e.version_1_pending + e.version_2_complete) || 1;
  const enrichedPct = (e.version_2_complete / enrichmentTotal) * 100;
  const pendingPct = (e.version_1_pending / enrichmentTotal) * 100;
  txt = `${enrichedPct.toFixed(1)}% ${pendingPct.toFixed(1)}% ${(e.version_2_complete || 0).toLocaleString()} ${(e.version_1_pending || 0).toLocaleString()}`;
  ok = Number.isFinite(enrichedPct) && Number.isFinite(pendingPct);
} catch (err) { ok = false; txt = String(err); }
check('live console enrichment math: finite, no throw', ok, txt);

console.log(`\nops-health (MON26): ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
