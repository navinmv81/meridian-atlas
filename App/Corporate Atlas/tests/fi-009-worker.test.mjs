#!/usr/bin/env node
// MA-OCT-009 — Worker tests T-F1 … T-F7 (spec rev 1 §9). Runs the real src/entities-api.js fetch
// handler against an in-memory SQLite D1 shim (node:sqlite) with the 008 schema (migrations/008-bonds.sql)
// and the 009 gate migration (migrations/009-fi-serving-gate.sql). No network, no D1.
//   node "App/Corporate Atlas/tests/fi-009-worker.test.mjs"
//   FI_WORKER=<path to another entities-api.js> … runs the same suite against that file (the pre-009 tree must fail).

import { DatabaseSync } from 'node:sqlite';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CA = path.resolve(HERE, '..');
const REPO = path.resolve(CA, '..', '..');
const WORKER = process.env.FI_WORKER ? path.resolve(process.env.FI_WORKER) : path.join(CA, 'src', 'entities-api.js');
const worker = (await import(pathToFileURL(WORKER).href)).default;
const BASE_COMMIT = 'acfd069';   // the committed 003 retirement entities-api.js (WED28.ENG1), the 009 base

let pass = 0, fail = 0;
const check = (name, ok, got) => { ok ? pass++ : fail++; if (!ok || process.env.VERBOSE) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + JSON.stringify(got).slice(0, 700)}`); };

// --- Cache API mock (caches.default) ------------------------------------------------------
const cacheStore = new Map();
let cachePuts = 0;
globalThis.caches = { default: {
  async match(req) { const r = cacheStore.get(req.url); return r ? r.clone() : undefined; },
  async put(req, res) { cachePuts++; cacheStore.set(req.url, res.clone()); },
} };

// --- D1 shim --------------------------------------------------------------------------------
function makeEnv(db, { failGate = false } = {}) {
  const log = [];
  const run = (sql, params, mode) => {
    log.push(sql.replace(/\s+/g, ' ').trim());
    if (failGate && /FROM fi_serving_gate/.test(sql)) throw new Error('D1_ERROR: internal error; reference = test');
    const st = db.prepare(sql);
    return mode === 'first' ? (st.get(...params) ?? null) : { results: st.all(...params), meta: {} };
  };
  const prep = sql => {
    let params = [];
    const st = { sql, bind(...p) { params = p; st.params = p; return st; }, params,
      async first() { return run(sql, params, 'first'); }, async all() { return run(sql, params, 'all'); } };
    return st;
  };
  return { env: { DB: { prepare: prep, batch: async stmts => stmts.map(s => run(s.sql, s.params || [], 'all')) } }, log };
}
const ctx = { pending: [], waitUntil(p) { this.pending.push(p); } };
async function call(env, p) {
  const r = await worker.fetch(new Request(`https://w.test${p}`), env, ctx);
  await Promise.all(ctx.pending.splice(0));
  const text = await r.text();
  let body = null; try { body = JSON.parse(text); } catch {}
  return { status: r.status, body, text, headers: Object.fromEntries(r.headers.entries()) };
}

// --- fixture ----------------------------------------------------------------------------------
const SCHEMA_008 = readFileSync(path.join(CA, 'migrations', '008-bonds.sql'), 'utf8');
const SCHEMA_009 = readFileSync(path.join(CA, 'migrations', '009-fi-serving-gate.sql'), 'utf8');
const ACC = (n) => `0000000001-26-${String(n).padStart(6, '0')}`;
let accN = 0;

function buildDb({ gate = 'migrate', bondTables = true, redirect = true } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE entity_master (entity_id INTEGER PRIMARY KEY, name TEXT, legal_name TEXT, lei TEXT, type TEXT, entity_status TEXT, cik TEXT);
    CREATE TABLE instrument_master (instrument_key TEXT PRIMARY KEY, security_name TEXT, security_ticker TEXT, isin TEXT, cusip TEXT, asset_cat TEXT, country TEXT);
    CREATE TABLE instrument_entity_map (instrument_key TEXT PRIMARY KEY, entity_id INTEGER NOT NULL, source TEXT NOT NULL, confidence INTEGER, created_at TEXT);
    CREATE INDEX idx_iem_entity_key ON instrument_entity_map(entity_id, instrument_key);
    CREATE TABLE entity_isin_map (isin TEXT NOT NULL, lei TEXT NOT NULL, entity_id INTEGER, match_source TEXT DEFAULT 'isin_direct',
      confidence INTEGER DEFAULT 100, mapped_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (isin, lei));`);
  if (redirect) db.exec(`CREATE TABLE entity_merge_redirect (duplicate_id INTEGER PRIMARY KEY, survivor_id INTEGER NOT NULL, merged_at TEXT, packet TEXT);
    INSERT INTO entity_merge_redirect VALUES (20, 1, '2026-10-27T10:00:00Z', 'MA-OCT-013');`);
  const ent = db.prepare(`INSERT INTO entity_master (entity_id, name, legal_name, lei, type, entity_status) VALUES (?, ?, ?, ?, 'operating', 'ACTIVE')`);
  [[1, 'ISSUER A', 'Issuer A Inc.', 'LEIAAAAAAAAAAAAAAA01'], [2, 'ISSUER B', 'Issuer B plc', 'LEIBBBBBBBBBBBBBBB02'], [3, 'WIDE CO', null, null],
   [4, 'DROPPY CO', null, null], [7, 'NO BONDS CO', null, 'LEI77777777777777777'], [8, 'TEN CO', null, null]].forEach(r => ent.run(...r));
  db.exec(`INSERT INTO instrument_master VALUES ('US5949181045','MICROSOFT CORP','MSFT','US5949181045','594918104','EC','US');
           INSERT INTO instrument_entity_map VALUES ('US5949181045', 1, 'openfigi_tier1', 70, '2026-08-31T00:00:00Z');`);
  if (bondTables) {
    db.exec(SCHEMA_008);
    const link = db.prepare(`INSERT INTO bond_issuer_link (cik, entity_id, link_method, confidence, issuer_name, status, linked_at, verified_at, last_polled_at)
                             VALUES (?, ?, ?, ?, ?, ?, '2026-10-15T00:00:00Z', NULL, ?)`);
    link.run('0000000001', 1, 'cik', 95, 'ISSUER A INC', 'active', '2026-10-20T06:00:00Z');
    link.run('0000000002', 2, 'cik', 95, 'ISSUER B PLC', 'active', '2026-10-21T06:00:00Z');
    link.run('0000000003', 2, 'lei', 85, 'ISSUER B FUNDING', 'active', '2026-10-22T06:00:00Z');
    link.run('0000000004', 2, 'manual', 100, 'ISSUER B CAPITAL', 'active', '2026-10-19T06:00:00Z');
    for (let i = 0; i < 11; i++) link.run(`00000001${String(i).padStart(2, '0')}`, 3, 'cik', 95, `WIDE ${i}`, 'active', null);
    for (let i = 0; i < 10; i++) link.run(`00000002${String(i).padStart(2, '0')}`, 8, 'cik', 95, `TEN ${i}`, 'active', null);
    link.run('0000000040', 4, 'cik', 95, 'DROPPY CO', 'active', '2026-10-20T06:00:00Z');
    link.run('0002007029', null, 'unmatched', 1, 'PEPSICO SINGAPORE FINANCING I PTE LTD', 'paused', '2026-10-28T06:00:00Z');
    link.run('0000000099', 20, 'cik', 95, 'MERGED FILER', 'active', null);
  }
  if (gate === 'migrate' || gate === 'open' || gate === 'garbage') db.exec(SCHEMA_009);
  if (gate === 'open') db.exec(`UPDATE fi_serving_gate SET state='open', changed_at='2026-10-29T08:00:00Z', changed_by='Data-Identity Lead' WHERE id=1 AND state='closed'`);
  if (gate === 'garbage') { db.exec(`DROP TABLE fi_serving_gate; CREATE TABLE fi_serving_gate (id INTEGER PRIMARY KEY, state TEXT, changed_at TEXT, changed_by TEXT, evidence TEXT);
                                     INSERT INTO fi_serving_gate VALUES (1, 'OPEN ', 'x', 'x', 'x');`); }
  if (gate === 'norow') { db.exec(SCHEMA_009); db.exec(`DELETE FROM fi_serving_gate`); }
  return db;
}

// Bond rows. ins(cik, maturity, conf, extra) → [accession, seq].
function bondInserter(db) {
  const st = db.prepare(`INSERT INTO bond_issuance (accession_number, tranche_seq, cik, instrument_key, isin, cusip, form_type, filing_date, filing_status,
      tranche_label, security_class, rate_type, coupon_rate, spread_bps, benchmark, principal_amount, currency, maturity_date, seniority, source_url,
      parse_confidence, parser_version, ingested_at)
    VALUES (?, ?, ?, ?, NULL, ?, '424B2', ?, ?, ?, 'Senior Notes', ?, ?, ?, ?, ?, ?, ?, ?, 'https://www.sec.gov/Archives/edgar/data/x', ?, 'bonds-p1', '2026-10-16T00:00:00Z')`);
  return (cik, maturity, conf, o = {}) => {
    const acc = o.acc ?? ACC(++accN), seq = o.seq ?? 1;
    st.run(acc, seq, cik, o.key ?? null, o.cusip ?? null, o.filed ?? '2025-01-15', o.status ?? 'final', o.label ?? `${maturity} notes`,
      o.rate ?? 'fixed', o.coupon ?? 5.85, o.spread ?? null, o.bench ?? null, o.principal ?? 1e9, o.ccy ?? 'USD', maturity, o.seniority ?? 'senior unsecured', conf);
    return [acc, seq];
  };
}

function seed(db) {
  const ins = bondInserter(db);
  // Issuer A: one CIK, 3 outstanding + 1 matured + 1 under 60 + 1 preliminary.
  const a1 = ins('0000000001', '2030-03-01', 95, { key: 'CUSIP:111111AA1', cusip: '111111AA1', filed: '2025-03-01' });
  ins('0000000001', '2030-03-01', 95, { key: 'CUSIP:111111AA1', cusip: '111111AA1', filed: '2026-02-01', principal: 5e8 });   // reopening, same key
  const a75 = ins('0000000001', '2034-06-15', 75, { rate: 'floating', coupon: null, spread: null, bench: 'SOFR' });
  ins('0000000001', '2019-01-01', 95);                                     // matured
  const a50 = ins('0000000001', '2040-01-01', 50);                         // under 60: never served
  const aPre = ins('0000000001', '2041-01-01', 95, { status: 'preliminary' });
  ins('0000000001', '2045-05-05', 90, { ccy: 'EUR', principal: 75e7 });
  // Issuer B: 3 CIKs, interleaved maturities, some under 60, one key spanning 2 CIKs.
  const yrs = n => `${2027 + (n % 33)}-${String(1 + (n % 12)).padStart(2, '0')}-${String(1 + (n % 27)).padStart(2, '0')}`;
  for (let i = 0; i < 30; i++) ins('0000000002', yrs(i * 7), i % 9 === 4 ? 50 : 95);
  for (let i = 0; i < 5; i++) ins('0000000003', yrs(i * 11 + 3), 85);
  for (let i = 0; i < 12; i++) ins('0000000004', yrs(i * 5 + 1), i % 4 === 1 ? 55 : 100);
  ins('0000000002', '2050-01-01', 95, { key: 'CUSIP:222222BB2' });
  const multi = ins('0000000003', '2050-01-01', 85, { key: 'CUSIP:222222BB2' });
  ins('0000000002', '2051-01-01', 95, { key: 'CUSIP:333333CC3' });          // single CIK, served
  ins('0000000003', '2052-01-01', 50, { key: 'CUSIP:444444DD4' });          // only an under-60 row
  // DROPPY: 5 under-60 rows first, then 5 served rows.
  for (let i = 0; i < 5; i++) ins('0000000040', `2030-01-0${i + 1}`, 50);
  for (let i = 0; i < 5; i++) ins('0000000040', `2031-01-0${i + 1}`, 90);
  // PepsiCo Singapore after R-1: under the unmatched, paused CIK.
  const pep = ins('0002007029', '2029-02-20', 90, { acc: '0001104659-24-022370', seq: 1, ccy: 'SGD', principal: 4.5e8 });
  ins('0000000099', '2035-01-01', 95);
  return { a1, a75, a50, aPre, multi, pep };
}

const TODAY = new Date().toISOString().slice(0, 10);
const tup = r => [r.maturity_date, r.accession_number, Number(r.tranche_seq)];
const cmpT = (a, b) => { for (let i = 0; i < 3; i++) { if (a[i] < b[i]) return -1; if (a[i] > b[i]) return 1; } return 0; };
const FORBIDDEN = ['cik', 'issuer_name', 'finals', 'totals', 'maturity_date', 'accession_number', 'principal_amount', 'issuers', 'securities', 'multi_cik_keys', 'freshness'];
function leaks(body) {
  const found = [];
  const walk = (o, p) => {
    if (Array.isArray(o)) { if (o.length) found.push(`${p}[${o.length}]`); o.forEach((v, i) => walk(v, `${p}[${i}]`)); return; }
    if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) {
      if (FORBIDDEN.includes(k) && v !== null && !(Array.isArray(v) && !v.length)) found.push(`${p}.${k}`);
      walk(v, `${p}.${k}`);
    }
  };
  walk(body, '$');
  return found;
}

// ================================ T-F1 gate ================================
const ROUTES = ids => [`/api/fi/issuers/1/bonds`, `/api/fi/ciks/0000000001/bonds`, `/api/fi/bonds/${ids.a1[0]}/${ids.a1[1]}`, `/api/fi/coverage`, `/api/fi/issuers/1/ladder`];
for (const g of ['nomigration', 'norow', 'migrate', 'garbage']) {
  accN = 0;
  const db = buildDb({ gate: g }); const ids = seed(db); const { env } = makeEnv(db);
  for (const p of ROUTES(ids)) {
    const r = await call(env, p);
    check(`[T-F1] gate=${g} ${p}: 200 closed, no withheld field, no-store`, r.status === 200 && r.body.gate === 'closed' && r.body.data_type === 'issuance_reference'
      && leaks(r.body).length === 0 && r.headers['cache-control'] === 'no-store', { status: r.status, body: r.body, leaks: leaks(r.body), cc: r.headers['cache-control'] });
  }
  const f1 = await call(env, '/api/fi/issuers/1/bonds');
  check(`[T-F1] gate=${g} F1 closed body is exactly {data_type, gate, has_bond_link:true, ciks:[], bonds:[]}`,
    JSON.stringify(Object.keys(f1.body).sort()) === JSON.stringify(['bonds', 'ciks', 'data_type', 'gate', 'has_bond_link']) && f1.body.has_bond_link === true, f1.body);
  check(`[T-F1] gate=${g} F1 for an entity with no link → has_bond_link false`, (await call(env, '/api/fi/issuers/7/bonds')).body.has_bond_link === false);
  check(`[T-F1] gate=${g} F1b closed: unlinked PepsiCo CIK → has_bond_link true only`, (b => b.has_bond_link === true && leaks(b).length === 0)((await call(env, '/api/fi/ciks/0002007029/bonds')).body));
  check(`[T-F1] gate=${g} F1 closed with 11 CIKs → still the closed body (no 422 leak of the CIK count)`, (await call(env, '/api/fi/issuers/3/bonds')).status === 200);
}
{
  accN = 0; const db = buildDb({ gate: 'open' }); seed(db);
  const { env } = makeEnv(db, { failGate: true });
  for (const p of ['/api/fi/issuers/1/bonds', '/api/fi/coverage', '/api/fi/bonds/0000000001-26-000001/1', '/api/instruments/CUSIP%3A333333CC3']) {
    const r = await call(env, p);
    check(`[T-F1] gate read D1 error (not a missing table) → 500 JSON, no data: ${p}`, r.status === 500 && leaks(r.body).length === 0 && r.body.error, r);
  }
}
{
  accN = 0; const db = buildDb({ gate: 'migrate' }); seed(db);
  check('[T-F1] migration seeds exactly one row, closed', JSON.stringify(db.prepare('SELECT id, state, changed_by FROM fi_serving_gate').all()) === JSON.stringify([{ id: 1, state: 'closed', changed_by: 'Engineering Lead' }]));
  db.exec(SCHEMA_009);
  check('[T-F1] migration is idempotent (INSERT OR IGNORE; re-run leaves 1 row, closed)', db.prepare('SELECT COUNT(*) n FROM fi_serving_gate').get().n === 1 && db.prepare('SELECT state FROM fi_serving_gate').get().state === 'closed');
  let threw = false; try { db.exec(`INSERT INTO fi_serving_gate VALUES (2,'open','x','x','x')`); } catch { threw = true; }
  check('[T-F1] CHECK (id = 1): a second row is refused', threw);
  threw = false; try { db.exec(`UPDATE fi_serving_gate SET state='opened' WHERE id=1`); } catch { threw = true; }
  check('[T-F1] CHECK state IN (closed, open)', threw);
  const open = db.prepare(`UPDATE fi_serving_gate SET state='open', changed_at=strftime('%Y-%m-%dT%H:%M:%SZ','now'), changed_by='Data-Identity Lead', evidence='e' WHERE id=1 AND state='closed'`).run();
  const again = db.prepare(`UPDATE fi_serving_gate SET state='open', changed_at='x', changed_by='x', evidence='x' WHERE id=1 AND state='closed'`).run();
  check('[T-F1] §4.1 open statement: changes = 1 once, 0 when already open (guard)', Number(open.changes) === 1 && Number(again.changes) === 0);
}

// ================================ open-gate fixture ================================
accN = 0;
const DB = buildDb({ gate: 'open' }); const IDS = seed(DB);
const { env: ENV, log: LOG } = makeEnv(DB);
const servedFor = ciks => DB.prepare(`SELECT * FROM bond_issuance WHERE cik IN (${ciks.map(() => '?').join(',')}) AND filing_status='final' AND parse_confidence >= 60 AND maturity_date >= ?`)
  .all(...ciks, TODAY).sort((a, b) => cmpT(tup(a), tup(b)));
async function allPages(base, limit) {
  const seen = []; let cursor = null, pages = 0, shortWithCursor = false, maxRows = 0;
  do {
    const r = await call(ENV, `${base}${base.includes('?') ? '&' : '?'}limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`);
    if (r.status !== 200) return { error: r };
    seen.push(...r.body.bonds); cursor = r.body.next_cursor; pages++;
    maxRows = Math.max(maxRows, r.body.bonds.length);
    if (cursor && r.body.bonds.length < limit) shortWithCursor = true;
  } while (cursor && pages < 500);
  return { seen, pages, shortWithCursor, maxRows };
}

// ================================ T-F2 F1 merge + cursor ================================
{
  const exp = servedFor(['0000000002', '0000000003', '0000000004']).map(r => `${r.accession_number}#${r.tranche_seq}`);
  for (const L of [1, 2, 3, 7, 25, 100]) {
    const p = await allPages('/api/fi/issuers/2/bonds', L);
    const got = (p.seen || []).map(r => `${r.accession_number}#${r.tranche_seq}`);
    check(`[T-F2] 3 CIKs, limit ${L}: every served outstanding row once, in (maturity, accession, seq) order — no gaps, no repeats`,
      JSON.stringify(got) === JSON.stringify(exp) && p.maxRows <= L, { L, got: got.length, exp: exp.length, pages: p.pages, err: p.error });
  }
  // Architect M-7: a CIK's fetched tail past the page cut is fetched again, not skipped.
  const r1 = await call(ENV, '/api/fi/issuers/2/bonds?limit=2');
  const fetchedBeyond = servedFor(['0000000002', '0000000003', '0000000004']);
  const lastShown = r1.body.bonds[r1.body.bonds.length - 1];
  const decoded = JSON.parse(Buffer.from(r1.body.next_cursor.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
  check('[T-F2 M-7] next_cursor = the last row consumed (here the last returned), not the largest tuple fetched',
    JSON.stringify(decoded) === JSON.stringify(tup(lastShown)), { decoded, lastShown: tup(lastShown) });
  const r2 = await call(ENV, `/api/fi/issuers/2/bonds?limit=2&cursor=${r1.body.next_cursor}`);
  check('[T-F2 M-7] page 2 starts at the 3rd row of the merged order (rows fetched but not consumed come back)',
    `${r2.body.bonds[0].accession_number}#${r2.body.bonds[0].tranche_seq}` === `${fetchedBeyond[2].accession_number}#${fetchedBeyond[2].tranche_seq}`, r2.body.bonds[0]);
  check('[T-F2] every row carries its own cik (DIL M-6) and the merged ciks list has 3 entries', r1.body.bonds.every(b => /^\d{10}$/.test(b.cik)) && r1.body.ciks.length === 3, r1.body.ciks);
  // Dropped rows: DROPPY's first 5 rows are under 60.
  const d1 = await call(ENV, '/api/fi/issuers/4/bonds?limit=3');
  check('[T-F2] a page short of limit (all fetched rows dropped) still has next_cursor (DIL N-2)', d1.body.bonds.length === 0 && d1.body.next_cursor !== null, d1.body);
  const dAll = await allPages('/api/fi/issuers/4/bonds', 3);
  check('[T-F2] DROPPY: paging through dropped rows reaches all 5 served rows', dAll.seen.length === 5 && dAll.seen.every(b => b.parse_confidence >= 60) && dAll.shortWithCursor, dAll);
  check('[T-F2] no row under 60 is ever served (issuer B)', (await allPages('/api/fi/issuers/2/bonds', 25)).seen.every(b => b.parse_confidence >= 60));
  // include_matured
  const out0 = await call(ENV, '/api/fi/issuers/1/bonds?limit=100');
  const out1 = await call(ENV, '/api/fi/issuers/1/bonds?limit=100&include_matured=1');
  check('[T-F2] include_matured=0 (default) excludes the 2019 tranche; =1 includes it first', !out0.body.bonds.some(b => b.maturity_date < TODAY) && out1.body.bonds[0].maturity_date === '2019-01-01', [out0.body.bonds.length, out1.body.bonds.map(b => b.maturity_date)]);
  check('[T-F2] last page: next_cursor null', out0.body.next_cursor === null && out1.body.next_cursor === null);
  for (const [q, why] of [['limit=abc', 'limit'], ['limit=2.5', 'limit'], ['cursor=%%%', 'cursor'], ['cursor=bm90anNvbg', 'cursor'], [`cursor=${Buffer.from('[1,2,3]').toString('base64url')}`, 'cursor shape'], ['include_matured=2', 'include_matured']]) {
    check(`[T-F2] bad ${why} (${q}) → 400`, (await call(ENV, `/api/fi/issuers/2/bonds?${q}`)).status === 400);
  }
  check('[T-F2] 11 CIKs → 422 too_many_ciks', (r => r.status === 422 && r.body.error === 'too_many_ciks')(await call(ENV, '/api/fi/issuers/3/bonds')));
  check('[T-F2] 10 CIKs → 200 (cap is inclusive)', (await call(ENV, '/api/fi/issuers/8/bonds')).status === 200);
  check('[T-F2] limit clamps to [1, 100]', (await call(ENV, '/api/fi/issuers/2/bonds?limit=0')).body.limit === 1 && (await call(ENV, '/api/fi/issuers/2/bonds?limit=500')).body.limit === 100);
  check('[T-F2] F1 for an entity with no CIK → has_bond_link false, bonds []', (b => b.has_bond_link === false && b.bonds.length === 0)((await call(ENV, '/api/fi/issuers/7/bonds')).body));
  const bad = await call(ENV, '/api/fi/issuers/12abc/bonds');
  check('[T-F2] non-numeric entity id → 400', bad.status === 400, bad.status);
  // Plan shape: the step-2 statement keeps the literal 'final' (partial index) and binds limit + 1.
  const before = LOG.length; await call(ENV, '/api/fi/issuers/2/bonds?limit=25');
  const step2 = LOG.slice(before).filter(s => /FROM bond_issuance/.test(s));
  check('[T-F2] step 2 = one statement per CIK (3), each with the literal filing_status = \'final\' and the row-value keyset',
    step2.length === 3 && step2.every(s => /filing_status = 'final'/.test(s) && /\(maturity_date, accession_number, tranche_seq\) > \(\?, \?, \?\)/.test(s)), step2);
  check('[T-F2 §6] one-CIK issuer view ≤ 4 statements (gate, R3 PK, step 1, step 2)', await (async () => { const b = LOG.length; await call(ENV, '/api/fi/issuers/1/bonds'); return LOG.length - b; })() <= 4);
  // F1b
  const pb = await call(ENV, '/api/fi/ciks/0002007029/bonds?include_matured=1');
  check('[T-F1b] unlinked CIK: entity_id null, its own rows, has_bond_link true', pb.body.entity_id === null && pb.body.has_bond_link && pb.body.bonds.length === 1 && pb.body.bonds[0].cik === '0002007029', pb.body);
  check('[T-F1b] unknown CIK → has_bond_link false', (await call(ENV, '/api/fi/ciks/0000009999/bonds')).body.has_bond_link === false);
  check('[T-F1b] CIK not 10 digits → 400', (await call(ENV, '/api/fi/ciks/12345/bonds')).status === 400);
  check('[T-F2] freshness: last_polled_at = max over the issuer\'s CIKs', (await call(ENV, '/api/fi/issuers/2/bonds')).body.freshness.last_polled_at === '2026-10-22T06:00:00Z');
}

// ================================ T-F3 R3 ================================
{
  const r = await call(ENV, '/api/fi/issuers/20/bonds');
  check('[T-F3] merged id 20 → survivor 1 with redirect, its bonds', r.status === 200 && r.body.entity_id === 1 && r.body.redirect?.resolved_id === 1 && r.body.bonds.length > 0, r.body);
  check('[T-F3] gone id → 404 gone (F1 and F4)', (await call(ENV, '/api/fi/issuers/999/bonds')).status === 404 && (await call(ENV, '/api/fi/issuers/999/ladder')).status === 404);
}

// ================================ T-F4 F2 ================================
{
  const r = await call(ENV, `/api/fi/bonds/${IDS.a1[0]}/${IDS.a1[1]}`);
  check('[T-F4] PK hit: bond terms, filer = the bond\'s own CIK, issuer NavLink sec_bond / bond_issuer_link / DBT / high, LEI from entity_master',
    r.status === 200 && r.body.bond.accession_number === IDS.a1[0] && r.body.filer.cik === '0000000001' && r.body.issuer.asset_type === 'DBT'
    && r.body.issuer.candidates[0].source === 'sec_bond' && r.body.issuer.candidates[0].source_table === 'bond_issuer_link'
    && r.body.issuer.candidates[0].confidence_band === 'high' && r.body.issuer.candidates[0].lei === 'LEIAAAAAAAAAAAAAAA01' && r.body.issuer.state === 'matched', r.body);
  check('[T-F4] other_filings = 1 for the reopened key; parser_version and ingested_at present', r.body.bond.other_filings === 1 && r.body.bond.parser_version === 'bonds-p1' && r.body.bond.ingested_at, r.body.bond);
  const r75 = await call(ENV, `/api/fi/bonds/${IDS.a75[0]}/${IDS.a75[1]}`);
  check('[T-F4] parse_confidence 75 → check_source true; floating rate_label', r75.body.bond.check_source === true && r75.body.bond.rate_label === 'Floating' && r.body.bond.check_source === false && r.body.bond.rate_label === 'Fixed coupon');
  check('[T-F4] under 60 → 404 not_found', (x => x.status === 404 && x.body.error === 'not_found')(await call(ENV, `/api/fi/bonds/${IDS.a50[0]}/${IDS.a50[1]}`)));
  check('[T-F4] preliminary → 404', (await call(ENV, `/api/fi/bonds/${IDS.aPre[0]}/${IDS.aPre[1]}`)).status === 404);
  check('[T-F4] absent → 404', (await call(ENV, '/api/fi/bonds/0000000009-26-000001/1')).status === 404);
  const pep = await call(ENV, `/api/fi/bonds/${IDS.pep[0]}/${IDS.pep[1]}`);
  check('[T-F4] unmatched filer (PepsiCo Singapore): state unmatched, no candidate, no LEI anywhere, filer CIK 0002007029',
    pep.body.issuer.state === 'unmatched' && pep.body.issuer.candidates.length === 0 && !/LEI/.test(JSON.stringify(pep.body)) && pep.body.filer.cik === '0002007029', pep.body);
  const m = await call(ENV, `/api/fi/bonds/${IDS.multi[0]}/${IDS.multi[1]}`);
  check('[T-F4] key under 2 CIKs → issuer state ambiguous (source_conflict); filer is still the row\'s own CIK', m.body.issuer.state === 'ambiguous' && m.body.issuer.reason === 'source_conflict' && m.body.filer.cik === '0000000003', m.body.issuer);
  check('[T-F4] bad accession / seq → 400', (await call(ENV, '/api/fi/bonds/123/1')).status === 400 && (await call(ENV, `/api/fi/bonds/${IDS.a1[0]}/0`)).status === 400);
  const viaMerge = await call(ENV, `/api/fi/bonds/${DB.prepare(`SELECT accession_number a FROM bond_issuance WHERE cik='0000000099'`).get().a}/1`);
  check('[T-F4] filer linked to a merged id → issuer candidate is the survivor with redirect (R3)', viaMerge.body.issuer.candidates[0]?.entity_id === 1 && viaMerge.body.issuer.candidates[0]?.redirect?.requested_id === 20, viaMerge.body.issuer);
}

// ================================ T-F5 F3 + F4 + cache ================================
{
  cacheStore.clear(); cachePuts = 0;
  const c1 = await call(ENV, '/api/fi/coverage');
  const exp = DB.prepare(`SELECT COUNT(*) n FROM bond_issuance WHERE filing_status='final' AND parse_confidence >= 60`).get().n;
  const a = c1.body.issuers.find(i => i.cik === '0000000001');
  check('[T-F5] F3: finals use the ≥ 60 rule; totals add up; PepsiCo listed unmatched', c1.body.totals.finals === exp && a.finals === 5
    && c1.body.issuers.find(i => i.cik === '0002007029').band === 'unmatched' && c1.body.totals.issuers === c1.body.issuers.length
    && c1.body.totals.linked + c1.body.totals.unmatched === c1.body.totals.issuers, { totals: c1.body.totals, a });
  check('[T-F5] F3: multi_cik_keys counts only served rows (222222BB2 yes; 444444DD4 under 60 no) = 1', c1.body.multi_cik_keys === 1, c1.body.multi_cik_keys);
  check('[T-F5] F3: as_of = MAX(last_polled_at)', c1.body.as_of === '2026-10-28T06:00:00Z', c1.body.as_of);
  check('[T-F5] F3 first call x-fi-cache miss; browser Cache-Control public, max-age=60', c1.headers['x-fi-cache'] === 'miss' && c1.headers['cache-control'] === 'public, max-age=60' && cachePuts === 1, c1.headers);
  const c2 = await call(ENV, '/api/fi/coverage');
  check('[T-F5] F3 second call: hit, identical body, 0 D1 statements beyond the gate read', c2.headers['x-fi-cache'] === 'hit' && c2.text === c1.text && c2.headers['cache-control'] === 'public, max-age=60');
  // Close → reopen: the pre-close body never comes back.
  DB.exec(`UPDATE fi_serving_gate SET state='closed', changed_at='2026-10-29T09:00:00Z' WHERE id=1 AND state='open'`);
  const cc = await call(ENV, '/api/fi/coverage');
  check('[T-F5] closed after an open body was cached → closed body, no-store, nothing cached', cc.body.gate === 'closed' && cc.headers['cache-control'] === 'no-store' && cachePuts === 1 && leaks(cc.body).length === 0);
  DB.exec(`UPDATE bond_issuance SET parse_confidence = 40 WHERE cik = '0000000001'`);   // the "incident" fix lands while closed
  DB.exec(`UPDATE fi_serving_gate SET state='open', changed_at='2026-10-29T10:00:00Z' WHERE id=1 AND state='closed'`);
  const c3 = await call(ENV, '/api/fi/coverage');
  check('[T-F5 M-5] reopen with a new changed_at → miss and the corrected counts, never the pre-close cached body',
    c3.headers['x-fi-cache'] === 'miss' && c3.body.issuers.find(i => i.cik === '0000000001').finals === 0 && c3.text !== c1.text, c3.headers);
  DB.exec(`UPDATE bond_issuance SET parse_confidence = 95 WHERE cik = '0000000001' AND maturity_date IN ('2030-03-01','2019-01-01','2041-01-01')`);
  DB.exec(`UPDATE bond_issuance SET parse_confidence = 75 WHERE cik = '0000000001' AND maturity_date = '2034-06-15'`);
  DB.exec(`UPDATE bond_issuance SET parse_confidence = 50 WHERE cik = '0000000001' AND maturity_date = '2040-01-01'`);
  DB.exec(`UPDATE bond_issuance SET parse_confidence = 90 WHERE cik = '0000000001' AND maturity_date = '2045-05-05'`);
  const keys = [...cacheStore.keys()];
  check('[T-F5 M-5] cache keys carry gate state + changed_at', keys.length === 2 && keys.every(k => /__fi_gate=open%7C2026-10-29T/.test(k)), keys);

  // F4 ladder
  const l = await call(ENV, '/api/fi/issuers/1/ladder');
  const y2030 = l.body.years.find(y => y.year === '2030'), y2034 = l.body.years.find(y => y.year === '2034'), y2045 = l.body.years.find(y => y.year === '2045');
  check('[T-F5] F4: reopened key counts once as a security, in reopened, principal left out', y2030.securities === 1 && y2030.reopened === 1 && y2030.principal_usd === 0, y2030);
  check('[T-F5] F4: single-filing USD principal summed; EUR counted under other_currencies, not in principal_usd',
    y2034.securities === 1 && y2034.principal_usd === 1e9 && y2045.other_currencies.EUR === 1 && y2045.principal_usd === 0, [y2034, y2045]);
  check('[T-F5] F4: no matured year, no under-60 year (2040), no preliminary (2041)', !l.body.years.some(y => ['2019', '2040', '2041'].includes(y.year)), l.body.years.map(y => y.year));
  check('[T-F5] F4: cached like F3 (miss then hit)', l.headers['x-fi-cache'] === 'miss' && (await call(ENV, '/api/fi/issuers/1/ladder')).headers['x-fi-cache'] === 'hit');
  {
    accN = 600; const db = buildDb({ gate: 'open' }); const ins = bondInserter(db);
    ins('0000000001', '2033-01-01', 95, { key: 'CUSIP:14913UAP5' }); ins('0000000001', '2033-01-01', 95, { key: 'CUSIP:14913UAP5' });
    cacheStore.clear();
    const d = await call(makeEnv(db).env, '/api/fi/issuers/1/ladder');
    check('[T-F5] F4: D-3 duplicate CUSIP 14913UAP5 → 1 security, 1 reopened', d.body.years.length === 1 && d.body.years[0].securities === 1 && d.body.years[0].reopened === 1, d.body);
  }
  check('[T-F5] F4: 11 CIKs → 422', (await call(ENV, '/api/fi/issuers/3/ladder')).status === 422);
}

// ================================ T-F6 R1f gated ================================
{
  const R1 = async (env, key) => call(env, `/api/instruments/${encodeURIComponent(key)}`);
  const hasBond = b => (b.candidates || []).some(c => c.source === 'sec_bond' || (c.also_sources || []).some(s => s.source === 'sec_bond'));
  for (const g of ['nomigration', 'migrate', 'garbage']) {
    accN = 0; const db = buildDb({ gate: g }); seed(db); const { env } = makeEnv(db);
    const r = await R1(env, 'CUSIP:333333CC3');
    check(`[T-F6] gate=${g}: R1 for a served single-CIK bond key → no sec_bond candidate`, r.status === 200 && !hasBond(r.body) && r.body.state === 'unmatched', r.body);
  }
  const one = await R1(ENV, 'CUSIP:333333CC3');
  check('[T-F6] open + 1 CIK → sec_bond candidate (entity 2, high)', one.body.candidates.length === 1 && one.body.candidates[0].source === 'sec_bond' && one.body.candidates[0].entity_id === 2 && one.body.state === 'matched', one.body);
  const two = await R1(ENV, 'CUSIP:222222BB2');
  check('[T-F6] open + 2 CIKs → no sec_bond candidate, ambiguous / source_conflict', !hasBond(two.body) && two.body.state === 'ambiguous' && two.body.reason === 'source_conflict', two.body);
  const low = await R1(ENV, 'CUSIP:444444DD4');
  check('[T-F6] open, key only on an under-60 row → no candidate', !hasBond(low.body) && low.body.state === 'unmatched', low.body);
  const b = LOG.length; await R1(ENV, 'CUSIP:333333CC3');
  const probe = LOG.slice(b).find(s => /SELECT DISTINCT cik FROM bond_issuance/.test(s));
  check('[T-F6] probe is SELECT DISTINCT cik … parse_confidence >= 60 LIMIT 2', /filing_status = 'final' AND parse_confidence >= 60 LIMIT 2/.test(probe || ''), probe);
  {
    const db = buildDb({ gate: 'open', bondTables: false }); const { env } = makeEnv(db);
    check('[T-F6] open gate, bond tables missing → R1 still resolves (no candidate, no error)', (r => r.status === 200 && r.body.state === 'matched')(await R1(env, 'US5949181045')));
    check('[T-F6] open gate, bond tables missing → FI routes say coverage.available = false', (r => r.status === 200 && r.body.coverage?.available === false)(await call(env, '/api/fi/issuers/1/bonds')));
  }
  const nav = spawnSync(process.execPath, ['--no-warnings', path.join(HERE, 'nav-007-worker.test.mjs')], { encoding: 'utf8' });
  check('[T-F6] tests/nav-007-worker.test.mjs 58/58', nav.status === 0 && /nav-007-worker: 58\/58 passed/.test(nav.stdout), nav.stdout.slice(-300));
}

// ================================ T-F7 data_type, no-store, R1–R4 headers ================================
{
  const succ = ['/api/fi/issuers/1/bonds', '/api/fi/ciks/0002007029/bonds', `/api/fi/bonds/${IDS.a1[0]}/1`, '/api/fi/coverage', '/api/fi/issuers/1/ladder', '/api/fi/issuers/7/bonds'];
  for (const p of succ) { const r = await call(ENV, p); check(`[T-F7] ${p}: data_type issuance_reference + gate`, r.status === 200 && r.body.data_type === 'issuance_reference' && r.body.gate === 'open', r.body); }
  check('[T-F7] open F1 / F2: Cache-Control public, max-age=60', (await call(ENV, '/api/fi/issuers/1/bonds')).headers['cache-control'] === 'public, max-age=60' && (await call(ENV, `/api/fi/bonds/${IDS.a1[0]}/1`)).headers['cache-control'] === 'public, max-age=60');
  check('[T-F7] CORS on FI responses = the retirement CORS (GET, OPTIONS)', (await call(ENV, '/api/fi/coverage')).headers['access-control-allow-methods'] === 'GET, OPTIONS');

  // Differential against the 009 base (the committed retirement file): R1–R4 + the other GET routes answer
  // with identical status, body and headers. R1 keys here have no served multi-CIK or gated difference.
  if (!process.env.FI_WORKER) {
    const tmp = mkdtempSync(path.join(tmpdir(), 'fi009-'));
    const baseFile = path.join(tmp, 'entities-api.base.mjs');
    writeFileSync(baseFile, execFileSync('git', ['--no-optional-locks', 'show', `${BASE_COMMIT}:App/Corporate Atlas/src/entities-api.js`], { cwd: REPO, encoding: 'utf8' }));
    const base = (await import(pathToFileURL(baseFile).href)).default;
    const SAME = ['/api/instruments/US5949181045', '/api/instruments/CUSIP%3A333333CC3', '/api/instruments/CUSIP%3A000000000', '/api/instruments/NOPE',
      '/api/entities/1/instruments?limit=1', '/api/entities/1/instruments', '/api/entities/20/instruments', '/api/entities/999/instruments', '/api/entities/1/instruments?limit=x',
      '/api/entities/isin/US5949181045', '/nope', '/'];
    for (const p of SAME) {
      const ra = await base.fetch(new Request(`https://w.test${p}`), makeEnv(DB).env, ctx), rb = await worker.fetch(new Request(`https://w.test${p}`), makeEnv(DB).env, ctx);
      const ha = JSON.stringify([...ra.headers.entries()]), hb = JSON.stringify([...rb.headers.entries()]);
      const ta = await ra.text(), tb = await rb.text();
      check(`[T-F7] differential vs ${BASE_COMMIT} (gate open): GET ${p} — status, body and headers byte-identical`, ra.status === rb.status && ta === tb && ha === hb, { a: [ra.status, ta.slice(0, 160), ha], b: [rb.status, tb.slice(0, 160), hb] });
    }
    const pa = await base.fetch(new Request('https://w.test/api/fi/coverage', { method: 'OPTIONS' }), makeEnv(DB).env, ctx), pb = await worker.fetch(new Request('https://w.test/api/fi/coverage', { method: 'OPTIONS' }), makeEnv(DB).env, ctx);
    check('[T-F7] OPTIONS preflight unchanged', pa.status === pb.status && JSON.stringify([...pa.headers]) === JSON.stringify([...pb.headers]));
  }
}

console.log(`\nfi-009-worker: ${pass}/${pass + fail} passed${fail ? ` (${fail} FAILED)` : ''}`);
process.exit(fail ? 1 : 0);
