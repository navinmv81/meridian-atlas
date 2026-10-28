#!/usr/bin/env node
// MA-OCT-003 test 4 (spec rev 1 §15 step 4; §10.5 R-1 … R-5, R-9; AC-14 part 3, A3-2, A3-7).
//  1. R-9 static greps across App/ and docs/ — only SQL history and the R-3 rule may remain.
//  2. Every retired path × method → 410 {"error":"gone",…} with 0 D1 calls, at Worker level.
//  3. Differential: the ORIGINAL Worker (git 0dd7ef0, the retirement base) and the EDITED Worker answer the same
//     non-exception requests (/api/entities/*, MA-OCT-007 /api/instruments/*, R2 paging) with identical status
//     and body, on the same fixture DB.
//  4. tests/nav-007-worker.test.mjs passes 58/58 against the edited Worker.
// No network, no D1.   Usage: node "App/Corporate Atlas/tests/entities-api-retirement.mjs"

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CA = path.resolve(HERE, '..');
const REPO = path.resolve(CA, '..', '..');
const BASE_COMMIT = '0dd7ef0';
let pass = 0, fail = 0;
const check = (name, ok, got) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + JSON.stringify(got).slice(0, 900)}`); };

// --- 1. R-9 static greps ----------------------------------------------------------------
const NEEDLES = ['entity_merge_exceptions', 'X-Admin-Exceptions-Secret', 'entityExceptionsUi', 'checkAdminExceptionsAuth', '/admin/exceptions', 'handleListEntityExceptions'];
function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.wrangler' || e === 'state' || e.startsWith('.')) continue;
    const p = path.join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out); else if (/\.(js|mjs|html|toml|json|sql|md|sh|css)$/.test(e) && st.size < 5e6) out.push(p);
  }
  return out;
}
const R3_MARK = 'MA-OCT-003 R-3';
const hits = [];
for (const f of [...walk(path.join(REPO, 'App')), ...walk(path.join(REPO, 'docs'))]) {
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    for (const nd of NEEDLES) {
      if (!l.includes(nd)) continue;
      // 003's new meridian-ops route /api/ops/admin/exceptions contains the needle '/admin/exceptions' — not a residue.
      if (nd === '/admin/exceptions' && l.split('/api/ops/admin/exceptions').join('').indexOf('/admin/exceptions') < 0) continue;
      hits.push({ f: path.relative(REPO, f), line: i + 1, nd, text: l.trim().slice(0, 120) });
    }
  });
}
const ra = path.relative(REPO, path.join(CA, 'src', 'entities-api.js'));
const r3Lines = (() => { const L = readFileSync(path.join(CA, 'src', 'entities-api.js'), 'utf8').split('\n'); const i = L.findIndex(l => l.includes(R3_MARK)); return new Set([i + 1, i + 2, i + 3, i + 4].filter(x => x > 0)); })();
const self = path.relative(REPO, fileURLToPath(import.meta.url));   // this test names the needles itself
const allowed = h => h.f === self || h.f.endsWith('.sql') || (h.f === ra && r3Lines.has(h.line));
const bad = hits.filter(h => !allowed(h));
check('[R-9] grep App/ + docs/: only SQL history and the R-3 rule remain (A3-2)', bad.length === 0, bad);
check('[R-9] docs/ (the served front end) has no hit at all', !hits.some(h => h.f.startsWith('docs/')), hits.filter(h => h.f.startsWith('docs/')));
const src = readFileSync(path.join(CA, 'src', 'entities-api.js'), 'utf8');
for (const sym of ['handleListExceptions', 'handleAddException', 'handleEditException', 'handleAddEntityException', 'handleEditEntityException',
                   'handleEntityExceptionsUi', 'ENTITY_EXCEPTIONS_COLUMNS', 'verifyAccessJwt', 'getAccessJwks', '_accessJwksCache', 'entity_exceptions']) {
  check(`[R-1/R-2] symbol ${sym} is gone from entities-api.js`, !src.includes(sym), null);
}
check('[R-4] CORS: GET and OPTIONS kept; POST, PUT and the two exception headers dropped',
  /'Access-Control-Allow-Methods': 'GET, OPTIONS'/.test(src) && /'Access-Control-Allow-Headers': 'Content-Type'/.test(src) && !/X-Admin|Cf-Access-Jwt/.test(src), null);
const toml = readFileSync(path.join(CA, 'wrangler-entities-api.toml'), 'utf8');
check('[R-5] wrangler-entities-api.toml has no CF_ACCESS_TEAM_DOMAIN / CF_ACCESS_AUD var', !/^\s*CF_ACCESS_(TEAM_DOMAIN|AUD)\s*=/m.test(toml) && !/^\[vars\]/m.test(toml), null);
check('[R-4] no write handler remains (no request.method check for POST or PUT)', !/request\.method === '(POST|PUT|DELETE)'/.test(src), null);

// --- fixture DB (schema as tests/nav-007-worker.test.mjs) --------------------------------
const ENTITY_COLS = ['name', 'type', 'lei', 'lei_status', 'country', 'normalized_name', 'legal_name', 'other_names', 'entity_category', 'entity_status',
  'expiration_date', 'expiration_reason', 'legal_address_line1', 'legal_address_city', 'legal_address_region', 'legal_address_country', 'legal_address_postcode',
  'hq_city', 'hq_country', 'legal_jurisdiction', 'legal_form_code', 'legal_form_text', 'business_register_id', 'registration_authority', 'lei_registration_status',
  'lei_initial_registration', 'lei_last_updated', 'lei_next_renewal', 'lei_validation_source', 'gleif_last_updated', 'gleif_enrichment_version', 'isin_match_count',
  'match_source', 'has_etf_holdings', 'etf_holding_count', 'primary_ticker', 'direct_parent_lei', 'direct_parent_name', 'direct_parent_exception',
  'ultimate_parent_lei', 'ultimate_parent_name', 'ultimate_parent_exception', 'created_at', 'updated_at'];
function buildDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE entity_master (entity_id INTEGER PRIMARY KEY, ${ENTITY_COLS.map(c => `${c} TEXT`).join(', ')});
    CREATE TABLE instrument_master (instrument_key TEXT PRIMARY KEY, security_name TEXT, security_ticker TEXT, isin TEXT, cusip TEXT, asset_cat TEXT, country TEXT);
    CREATE TABLE instrument_entity_map (instrument_key TEXT PRIMARY KEY, entity_id INTEGER NOT NULL, source TEXT NOT NULL, confidence INTEGER, created_at TEXT);
    CREATE INDEX idx_iem_entity_key ON instrument_entity_map(entity_id, instrument_key);
    CREATE TABLE entity_isin_map (isin TEXT NOT NULL, lei TEXT NOT NULL, entity_id INTEGER, match_source TEXT DEFAULT 'isin_direct', confidence INTEGER DEFAULT 100,
      mapped_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (isin, lei));
    CREATE TABLE firds_instrument_reference (isin TEXT PRIMARY KEY, publication_date TEXT);
    CREATE TABLE entity_relationships (parent_entity_id INTEGER, child_entity_id INTEGER, relationship_type TEXT);
    CREATE TABLE entity_merge_redirect (duplicate_id INTEGER PRIMARY KEY, survivor_id INTEGER NOT NULL, merged_at TEXT, packet TEXT);
    CREATE TABLE bond_issuer_link (cik TEXT PRIMARY KEY, entity_id INTEGER NULL, link_method TEXT NOT NULL, confidence INTEGER NOT NULL, issuer_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', linked_at TEXT NOT NULL, verified_at TEXT NULL);
    CREATE TABLE bond_issuance (accession_number TEXT NOT NULL, tranche_seq INTEGER NOT NULL, cik TEXT NOT NULL, instrument_key TEXT NULL, filing_status TEXT NOT NULL,
      maturity_date TEXT NULL, PRIMARY KEY (accession_number, tranche_seq));
    CREATE TABLE entity_exceptions (id INTEGER PRIMARY KEY, exception_type TEXT, source_table TEXT, source_ref TEXT, decision TEXT DEFAULT 'pending', created_at TEXT);`);
  const ins = db.prepare(`INSERT INTO entity_master (entity_id, name, type, lei, country, normalized_name, entity_status, isin_match_count, etf_holding_count, legal_name)
                          VALUES (?, ?, 'operating', ?, 'US', ?, 'ACTIVE', ?, 0, ?)`);
  ins.run(5, 'Apple Inc', 'HWUPKR0MPOU8FGXBT394', 'APPLE', '3', 'Apple Inc.');
  ins.run(6, 'Apple Hospitality REIT', '549300BBBBBBBBBBBB01', 'APPLE HOSPITALITY REIT', '1', 'Apple Hospitality REIT, Inc.');
  db.exec(`INSERT INTO instrument_master VALUES ('US0378331005','APPLE INC','AAPL','US0378331005','037833100','EC','US'),
                                                  ('US0378331006','APPLE BOND','','US0378331006','','DBT','US');
           INSERT INTO instrument_entity_map VALUES ('US0378331005', 5, 'isin_tier1', 95, '2026-01-01'), ('US0378331006', 5, 'openfigi_tier1', 80, '2026-01-01');
           INSERT INTO entity_isin_map (isin, lei, entity_id) VALUES ('US0378331005','HWUPKR0MPOU8FGXBT394',5);
           INSERT INTO entity_merge_redirect VALUES (99, 5, '2026-10-01', 'MA-OCT-013');
           INSERT INTO entity_exceptions VALUES (1, 'entity_merge', 'entity_master', '{"entity_id_a":931}', 'do_not_merge', '2026-08-30 19:30:36');`);
  return db;
}
function shim(db) {
  const counter = { n: 0 };
  const prep = sql => {
    let params = [];
    const st = { bind(...p) { params = p; return st; },
                 async first() { counter.n++; return db.prepare(sql).get(...params) ?? null; },
                 async all() { counter.n++; return { results: db.prepare(sql).all(...params), meta: {} }; },
                 async run() { counter.n++; const r = db.prepare(sql).run(...params); return { meta: { changes: Number(r.changes) } }; } };
    return st;
  };
  return { env: { DB: { prepare: sql => { counter.n++; return prep(sql); }, batch: async () => { counter.n++; return []; } } }, counter };
}

const edited = (await import(pathToFileURL(path.join(CA, 'src', 'entities-api.js')).href)).default;
const tmp = mkdtempSync(path.join(tmpdir(), 'ret-'));
const origFile = path.join(tmp, 'entities-api.orig.mjs');
writeFileSync(origFile, execFileSync('git', ['--no-optional-locks', 'show', `${BASE_COMMIT}:App/Corporate Atlas/src/entities-api.js`], { cwd: REPO, encoding: 'utf8' }));
const original = (await import(pathToFileURL(origFile).href)).default;
const call = async (w, env, method, p, body) => {
  const r = await w.fetch(new Request(`https://w.test${p}`, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body }), env, {});
  return { status: r.status, body: await r.text(), cors: r.headers.get('access-control-allow-methods') };
};

// --- 2. Worker-level 410 for every retired path (A3-7) ----------------------------------------
const RETIRED = ['/exceptions', '/exceptions/', '/exceptions/ui', '/exceptions/1', '/exceptions/123/extra', '/admin/exceptions', '/admin/exceptions/1', '/admin/exceptions/x/y'];
const EXPECT = JSON.stringify({ error: 'gone', moved_to: 'meridian-ops /api/ops/admin/cases (MA-OCT-003)' });
const dbX = buildDb();
const before = JSON.stringify(dbX.prepare('SELECT * FROM entity_exceptions').all());
for (const p of RETIRED) for (const m of ['GET', 'POST', 'PUT', 'DELETE']) {
  const { env, counter } = shim(dbX);
  const r = await call(edited, env, m, p, m === 'GET' || m === 'DELETE' ? undefined : '{"decision":"always_merge"}');
  check(`[AC-14 3] ${m} ${p} → 410 gone, 0 D1 calls`, r.status === 410 && r.body === EXPECT && counter.n === 0, { r, d1: counter.n });
}
check('[AC-14 3] entity_exceptions unchanged after every retired call (0 writes)', JSON.stringify(dbX.prepare('SELECT * FROM entity_exceptions').all()) === before, null);
for (const p of ['/exceptionsfoo', '/admin/exceptionsx', '/api/exceptions']) {
  const { env } = shim(buildDb());
  const r = await call(edited, env, 'GET', p);
  check(`[R-3] ${p} is not under the retired prefixes → 404 as before`, r.status === 404, r);
}

// --- 3. Differential: original vs edited on the routes that stay (A3-2) ---------------------------------
const SAME = ['/api/entities/search?q=apple', '/api/entities/search?q=a', '/api/entities/5', '/api/entities/6', '/api/entities/999',
  '/api/entities/isin/US0378331005', '/api/entities/isin/us0378331005', '/api/entities/isin/XX0000000000',
  `/api/instruments/${encodeURIComponent('US0378331005')}`, `/api/instruments/${encodeURIComponent('US0378331006')}`, `/api/instruments/${encodeURIComponent('CUSIP:037833100')}`,
  `/api/instruments/${encodeURIComponent('NOPE')}`, '/api/entities/5/instruments?limit=1', '/api/entities/99/instruments?limit=25', '/api/entities/5/instruments?limit=abc',
  '/api/entities/5/graph', '/api/entities/5/etf-exposure', '/api/entities/5/exposure', '/api/entities/5/issuer-panels', '/nope', '/'];
for (const p of SAME) {
  const a = await call(original, shim(buildDb()).env, 'GET', p), b = await call(edited, shim(buildDb()).env, 'GET', p);
  check(`[A3-2] GET ${p}: original and edited answer identically (${a.status})`, a.status === b.status && a.body === b.body, { a: [a.status, a.body.slice(0, 200)], b: [b.status, b.body.slice(0, 200)] });
}
const o1 = await call(original, shim(buildDb()).env, 'OPTIONS', '/api/entities/search'), o2 = await call(edited, shim(buildDb()).env, 'OPTIONS', '/api/entities/search');
check('[R-4] OPTIONS preflight: still 204; Allow-Methods now GET, OPTIONS (was GET, POST, PUT, OPTIONS)', o1.status === 204 && o2.status === 204 && o1.cors === 'GET, POST, PUT, OPTIONS' && o2.cors === 'GET, OPTIONS', { o1, o2 });
const rOrig = await call(original, shim(buildDb()).env, 'GET', '/exceptions/ui'), rEd = await call(edited, shim(buildDb()).env, 'GET', '/exceptions/ui');
check('[baseline] /exceptions/ui: the original answers 401 without Access (Worker reached), the edited 410', rOrig.status === 401 && rEd.status === 410, { rOrig: rOrig.status, rEd: rEd.status });

// --- 4. 007's Worker suite against the edited file ---------------------------------------------
const nav = spawnSync(process.execPath, ['--no-warnings', path.join(HERE, 'nav-007-worker.test.mjs')], { encoding: 'utf8' });
check('[R-9 / AC-14] tests/nav-007-worker.test.mjs passes 58/58 against the edited Worker', nav.status === 0 && /nav-007-worker: 58\/58 passed/.test(nav.stdout), nav.stdout.slice(-300));
const key = spawnSync(process.execPath, ['--no-warnings', path.join(HERE, 'nav-007-key.test.mjs')], { encoding: 'utf8' });
check('[regression] tests/nav-007-key.test.mjs still 34/34', key.status === 0 && /34\/34 passed/.test(key.stdout), key.stdout.slice(-200));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
