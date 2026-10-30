// MA-OCT-007 Phase 1 — Worker tests T2, T3, T4, T5, T9 (spec rev 1.4 §14.1).
// Runs the real src/entities-api.js fetch handler against an in-memory SQLite
// D1 shim (node:sqlite). No network, no D1. Run: node tests/nav-007-worker.test.mjs
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const worker = (await import(pathToFileURL(path.join(HERE, '../src/entities-api.js')).href)).default;

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; } else { fail++; console.log(`FAIL ${name}${extra !== undefined ? ' — ' + JSON.stringify(extra) : ''}`); }
}

// --- D1 shim -----------------------------------------------------------------
function makeEnv(db) {
  const log = [];
  const prep = sql => {
    let params = [];
    const st = {
      bind(...p) { params = p; return st; },
      async first() { log.push(sql); return db.prepare(sql).get(...params) ?? null; },
      async all() { log.push(sql); return { results: db.prepare(sql).all(...params), meta: {} }; },
    };
    return st;
  };
  return { env: { DB: { prepare: prep } }, log };
}

const ENTITY_COLS = ['name', 'type', 'lei', 'lei_status', 'country', 'normalized_name', 'legal_name', 'other_names', 'entity_category',
  'entity_status', 'expiration_date', 'expiration_reason', 'legal_address_line1', 'legal_address_city', 'legal_address_region',
  'legal_address_country', 'legal_address_postcode', 'hq_city', 'hq_country', 'legal_jurisdiction', 'legal_form_code', 'legal_form_text',
  'business_register_id', 'registration_authority', 'lei_registration_status', 'lei_initial_registration', 'lei_last_updated',
  'lei_next_renewal', 'lei_validation_source', 'gleif_last_updated', 'gleif_enrichment_version', 'isin_match_count', 'match_source',
  'has_etf_holdings', 'etf_holding_count', 'primary_ticker', 'direct_parent_lei', 'direct_parent_name', 'direct_parent_exception',
  'ultimate_parent_lei', 'ultimate_parent_name', 'ultimate_parent_exception', 'created_at', 'updated_at'];

function buildDb({ redirectTable = true, bondTables = true } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE entity_master (entity_id INTEGER PRIMARY KEY, ${ENTITY_COLS.map(c => `${c} TEXT`).join(', ')});
    CREATE TABLE instrument_master (instrument_key TEXT PRIMARY KEY, security_name TEXT, security_ticker TEXT, isin TEXT, cusip TEXT, asset_cat TEXT, country TEXT);
    CREATE TABLE instrument_entity_map (instrument_key TEXT PRIMARY KEY, entity_id INTEGER NOT NULL, source TEXT NOT NULL, confidence INTEGER, created_at TEXT);
    CREATE INDEX idx_iem_entity_key ON instrument_entity_map(entity_id, instrument_key);
    CREATE TABLE entity_isin_map (isin TEXT NOT NULL, lei TEXT NOT NULL, entity_id INTEGER, match_source TEXT DEFAULT 'isin_direct',
      confidence INTEGER DEFAULT 100, mapped_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (isin, lei));
    CREATE INDEX idx_entity_isin_map_isin ON entity_isin_map(isin);
    CREATE TABLE firds_instrument_reference (isin TEXT PRIMARY KEY, publication_date TEXT);
    CREATE TABLE entity_relationships (parent_entity_id INTEGER, child_entity_id INTEGER, relationship_type TEXT);
  `);
  if (redirectTable) db.exec(`CREATE TABLE entity_merge_redirect (duplicate_id INTEGER PRIMARY KEY, survivor_id INTEGER NOT NULL, merged_at TEXT, packet TEXT);`);
  if (bondTables) db.exec(`
    CREATE TABLE bond_issuer_link (cik TEXT PRIMARY KEY, entity_id INTEGER NULL, link_method TEXT NOT NULL, confidence INTEGER NOT NULL,
      issuer_name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', linked_at TEXT NOT NULL, verified_at TEXT NULL);
    CREATE TABLE bond_issuance (accession_number TEXT NOT NULL, tranche_seq INTEGER NOT NULL, cik TEXT NOT NULL, instrument_key TEXT NULL,
      filing_status TEXT NOT NULL, maturity_date TEXT NULL, parse_confidence INTEGER NOT NULL DEFAULT 95, PRIMARY KEY (accession_number, tranche_seq));
    CREATE INDEX idx_bi_instrument ON bond_issuance(instrument_key) WHERE instrument_key IS NOT NULL;
    -- MA-OCT-009 §4.3: R1f reads bonds only through an open fi_serving_gate; T9 runs with the gate open.
    CREATE TABLE fi_serving_gate (id INTEGER PRIMARY KEY, state TEXT NOT NULL, changed_at TEXT NOT NULL, changed_by TEXT NOT NULL, evidence TEXT NOT NULL);
    INSERT INTO fi_serving_gate VALUES (1, 'open', '2026-10-29T00:00:00Z', 'test', 'fixture');
  `);

  const ent = db.prepare(`INSERT INTO entity_master (entity_id, name, lei, type, entity_status) VALUES (?, ?, ?, ?, 'ACTIVE')`);
  [[1, 'MICROSOFT CORPORATION', 'LEI00000000000000001', 'operating'], [2, 'OTHER CO', 'LEI00000000000000002', 'operating'],
   [3, 'TWIN A', 'LEI00000000000000003', 'operating'], [4, 'TWIN B', 'LEI00000000000000004', 'operating'],
   [5, 'BIG ISSUER', 'LEI00000000000000005', 'operating'], [6, 'HUGE ISSUER', null, 'operating'],
   [10, 'SURVIVOR AG', 'LEI00000000000000010', 'operating']].forEach(r => ent.run(...r));
  if (redirectTable) {
    const rd = db.prepare(`INSERT INTO entity_merge_redirect VALUES (?, ?, ?, 'MA-OCT-013')`);
    [[20, 10, '2026-10-27T10:00:00Z'],                                                  // 1 hop
     [30, 31, '2026-10-27T10:00:00Z'], [31, 32, '2026-10-27T10:00:00Z'], [32, 10, '2026-10-27T10:00:00Z'],   // 3 hops
     [40, 41, 'x'], [41, 42, 'x'], [42, 43, 'x'], [43, 10, 'x'],                        // 4 hops
     [50, 51, 'x'], [51, 50, 'x'],                                                      // cycle
     [60, 99, 'x']                                                                      // survivor missing
    ].forEach(r => rd.run(...r));
  }
  const im = db.prepare(`INSERT INTO instrument_master VALUES (?, ?, ?, ?, ?, ?, 'US')`);
  const iem = db.prepare(`INSERT INTO instrument_entity_map VALUES (?, ?, ?, ?, '2026-08-31T00:00:00Z')`);
  const eim = db.prepare(`INSERT INTO entity_isin_map (isin, lei, entity_id, match_source, confidence, mapped_at) VALUES (?, ?, ?, ?, ?, '2026-09-20T00:00:00Z')`);
  // matched (OpenFIGI 70 → medium)
  im.run('US5949181045', 'MICROSOFT CORP', 'MSFT', 'US5949181045', '594918104', 'EC'); iem.run('US5949181045', 1, 'openfigi_tier1', 70);
  // low_confidence (heuristic 75)
  im.run('US0000000001', 'HEUR CO', 'HEU', 'US0000000001', null, 'EC'); iem.run('US0000000001', 2, 'heuristic', 75);
  // corroboration: heuristic 75 + isin_direct 100 on the same entity
  im.run('US1111111111', 'CORROB CO', null, 'US1111111111', null, 'EC'); iem.run('US1111111111', 2, 'heuristic', 75);
  eim.run('US1111111111', 'LEI00000000000000002', 2, 'isin_direct', 100);
  // isin_duplicate (KI 22.17)
  im.run('US2222222222', 'TWIN SHARE', null, 'US2222222222', null, 'EC');
  eim.run('US2222222222', 'LEI00000000000000003', 3, 'isin_direct', 100); eim.run('US2222222222', 'LEI00000000000000004', 4, 'firds_direct', 100);
  // both ambiguous conditions → isin_duplicate (N7-11)
  im.run('US3333333333', 'BOTH CO', null, 'US3333333333', null, 'EC'); iem.run('US3333333333', 1, 'isin_tier1', 100);
  eim.run('US3333333333', 'LEI00000000000000003', 3, 'isin_direct', 100); eim.run('US3333333333', 'LEI00000000000000004', 4, 'isin_direct', 100);
  // source_conflict
  im.run('US4444444444', 'CONFLICT CO', null, 'US4444444444', null, 'EC'); iem.run('US4444444444', 1, 'cusip_tier1', 90);
  eim.run('US4444444444', 'LEI00000000000000002', 2, 'isin_direct', 100);
  // lei_only
  im.run('US5555555555', 'LEI ONLY CO', null, 'US5555555555', null, 'EC'); eim.run('US5555555555', 'LEIONLY0000000000099', null, 'isin_direct', 100);
  // no_mapping
  im.run('TICKER:FOO', 'FOO INC', 'FOO', null, null, 'EC');
  // redirect_unresolved (mapped entity 60 → 99 gone)
  im.run('US6666666666', 'GONE CO', null, 'US6666666666', null, 'EC'); iem.run('US6666666666', 60, 'isin_tier1', 100);
  // merged twin collapses: eim rows on 20 (→ 10) and 10
  im.run('US7777777777', 'MERGED CO', null, 'US7777777777', null, 'EC');
  eim.run('US7777777777', 'LEI00000000000000020', 20, 'isin_direct', 100); eim.run('US7777777777', 'LEI00000000000000010', 10, 'isin_direct', 100);
  // instrument with no ISIN; ISIN comes from the holding (?isin=)
  im.run('CUSIP:594918AB0', 'MICROSOFT BOND', null, null, '594918AB0', 'DBT');
  // bond (R1f)
  if (bondTables) {
    db.prepare(`INSERT INTO bond_issuance VALUES ('0000001-26-000001', 1, '0000789019', 'CUSIP:594918BX1', 'final', '2036-01-01', 95)`).run();
    db.prepare(`INSERT INTO bond_issuer_link VALUES ('0000789019', 1, 'cik', 95, 'MICROSOFT CORP', 'active', '2026-10-15T00:00:00Z', NULL)`).run();
  }
  // paging: entity 5 has 60 instruments; entity 6 has 1,005
  for (let i = 0; i < 60; i++) {
    const k = i % 3 === 0 ? `CUSIP:5${String(i).padStart(8, '0')}` : i % 3 === 1 ? `US5${String(i).padStart(9, '0')}X` : `NAME:BIG_${i}`;
    im.run(k, `BIG ${i}`, null, null, null, i % 2 ? 'DBT' : 'EC'); iem.run(k, 5, 'isin_tier1', 100);
  }
  for (let i = 0; i < 1005; i++) { const k = `CUSIP:6${String(i).padStart(8, '0')}`; im.run(k, `H ${i}`, null, null, null, 'DBT'); iem.run(k, 6, 'cusip_tier1', 90); }
  return db;
}

async function call(env, p) {
  const res = await worker.fetch(new Request('https://w.test' + p), env, {});
  let body = null; try { body = await res.json(); } catch {}
  return { status: res.status, body };
}
const R1 = (env, key, q = '') => call(env, `/api/instruments/${encodeURIComponent(key)}${q}`);

// --- T9: NavLink conformance --------------------------------------------------
const STATES = new Set(['matched', 'low_confidence', 'ambiguous', 'unmatched']);
const REASONS = new Set([null, 'isin_duplicate', 'source_conflict', 'no_mapping', 'lei_only', 'not_in_universe', 'redirect_unresolved']);
const BANDS = new Set(['high', 'medium', 'low']);
function navLinkErrors(n) {
  const e = [];
  if (typeof n.instrument_key !== 'string') e.push('instrument_key');
  if (!n.identifiers || !['isin', 'cusip', 'ticker'].every(k => k in n.identifiers)) e.push('identifiers');
  if (!('asset_type' in n) || !('name' in n)) e.push('asset_type/name');
  if (!STATES.has(n.state)) e.push('state');
  if (!REASONS.has(n.reason)) e.push('reason');
  if (!Array.isArray(n.candidates) || n.candidates.length > 10) e.push('candidates');
  if (typeof n.placeholder_key !== 'boolean') e.push('placeholder_key');
  if (!('as_of' in n)) e.push('as_of');
  for (const c of n.candidates || []) {
    if (!Number.isInteger(c.entity_id)) e.push('c.entity_id');
    for (const f of ['name', 'lei', 'source', 'source_table', 'confidence', 'redirect']) if (!(f in c)) e.push('c.' + f);
    if (!BANDS.has(c.confidence_band)) e.push('c.band');
    if (!Array.isArray(c.also_sources)) e.push('c.also_sources');
  }
  if (n.state === 'matched' || n.state === 'low_confidence') { if (n.candidates.length !== 1 || n.reason !== null) e.push('single'); }
  if (n.state === 'ambiguous' && n.candidates.length < 2) e.push('ambiguous<2');
  if (n.state === 'unmatched' && n.candidates.length) e.push('unmatched+cands');
  return e;
}

// ================================ T2: R1 states ================================
{
  const db = buildDb(); const { env, log } = makeEnv(db);
  let r = await R1(env, 'US5949181045');
  check('T2 matched', r.status === 200 && r.body.state === 'matched' && r.body.candidates[0].entity_id === 1 &&
    r.body.candidates[0].confidence_band === 'medium' && r.body.candidates[0].source === 'openfigi_tier1', r.body);
  check('T9 matched conforms', navLinkErrors(r.body).length === 0, navLinkErrors(r.body));

  r = await R1(env, 'US0000000001');
  check('T2 low_confidence heuristic 75', r.body.state === 'low_confidence' && r.body.candidates[0].confidence_band === 'low' && r.body.candidates[0].confidence === 75, r.body);

  r = await R1(env, 'US1111111111');
  const c = r.body.candidates;
  check('T2 corroboration (R7-3)', r.body.state === 'matched' && c.length === 1 && c[0].source === 'isin_direct' &&
    c[0].confidence_band === 'high' && c[0].also_sources.length === 1 && c[0].also_sources[0].source === 'heuristic', r.body);

  r = await R1(env, 'US2222222222');
  check('T2 isin_duplicate', r.body.state === 'ambiguous' && r.body.reason === 'isin_duplicate' && r.body.candidates.length === 2, r.body);
  check('T9 ambiguous conforms', navLinkErrors(r.body).length === 0, navLinkErrors(r.body));

  r = await R1(env, 'US3333333333');
  check('T2 precedence N7-11', r.body.state === 'ambiguous' && r.body.reason === 'isin_duplicate' && r.body.candidates.length === 3, r.body);

  r = await R1(env, 'US4444444444');
  check('T2 source_conflict', r.body.state === 'ambiguous' && r.body.reason === 'source_conflict' && r.body.candidates.length === 2, r.body);
  check('T2 candidate order (confidence, then id)', r.body.candidates[0].entity_id === 2 && r.body.candidates[1].entity_id === 1, r.body.candidates);

  r = await R1(env, 'US5555555555');
  check('T2 lei_only (R7-8)', r.body.state === 'unmatched' && r.body.reason === 'lei_only' && r.body.lei === 'LEIONLY0000000000099' && r.body.candidates.length === 0, r.body);

  r = await R1(env, 'CUSIP:123456789');
  check('T2 not_in_universe', r.body.state === 'unmatched' && r.body.reason === 'not_in_universe' && r.body.identifiers.cusip === '123456789', r.body);

  r = await R1(env, 'TICKER:FOO');
  check('T2 no_mapping', r.body.state === 'unmatched' && r.body.reason === 'no_mapping', r.body);

  r = await R1(env, 'US6666666666');
  check('T2 redirect_unresolved', r.body.state === 'unmatched' && r.body.reason === 'redirect_unresolved', r.body);

  r = await R1(env, 'US7777777777');
  check('T2 merged twins collapse to survivor', r.body.state === 'matched' && r.body.candidates.length === 1 && r.body.candidates[0].entity_id === 10 &&
    r.body.candidates[0].redirect && r.body.candidates[0].redirect.requested_id === 20 && r.body.candidates[0].also_sources.length === 1, r.body);

  r = await R1(env, 'CUSIP:594918AB0', '?isin=US2222222222');
  check('T2 ISIN from holding (N7-10)', r.body.state === 'ambiguous' && r.body.isin_source === 'holding' && r.body.identifiers.isin === 'US2222222222', r.body);
  r = await R1(env, 'CUSIP:594918AB0', '?isin=BAD');
  check('T2 bad ?isin= → 400', r.status === 400, r);

  // placeholders: no D1 read at all (R7-2)
  for (const k of ['CUSIP:000000000', 'CUSIP:000000', 'NAME:N/A', 'NAME:NA', 'NAME:NONE']) {
    const before = log.length;
    r = await R1(env, k);
    check(`T2 placeholder ${k}`, r.body.state === 'unmatched' && r.body.reason === 'no_mapping' && r.body.placeholder_key === true &&
      r.body.candidates.length === 0 && log.length === before, { body: r.body, reads: log.length - before });
    check(`T9 placeholder ${k} conforms`, navLinkErrors(r.body).length === 0, navLinkErrors(r.body));
  }
  check('T2 non-placeholder CUSIP with zeros', !(await R1(env, 'CUSIP:000000001')).body.placeholder_key);

  // R1f + T9 sec_bond fixture
  r = await R1(env, 'CUSIP:594918BX1');
  check('T9 sec_bond candidate', r.body.state === 'matched' && r.body.candidates[0].source === 'sec_bond' &&
    r.body.candidates[0].source_table === 'bond_issuer_link' && r.body.candidates[0].confidence_band === 'high' &&
    r.body.reason === null, r.body);
  check('T9 sec_bond conforms', navLinkErrors(r.body).length === 0, navLinkErrors(r.body));

  // typical read count: matched instrument = R1a + R1b + R1c + R1f(1) + R1d
  const before = log.length; await R1(env, 'US5949181045');
  check('T2 matched uses ≤ 6 statements', log.length - before <= 6, log.length - before);
}
// Missing 008 / 013 tables are tolerated.
{
  const db = buildDb({ redirectTable: false, bondTables: false }); const { env } = makeEnv(db);
  let r = await R1(env, 'US5949181045');
  check('T2 no bond/redirect tables: still resolves', r.status === 200 && r.body.state === 'matched', r);
  r = await R1(env, 'US6666666666');
  check('T2 no redirect table: mapped id gone → redirect_unresolved', r.body.reason === 'redirect_unresolved', r.body);
}

// ================================ T3 + T5: R2 ================================
{
  const db = buildDb(); const { env } = makeEnv(db);
  let seen = [], cursor = '', pages = 0, r;
  do {
    r = await call(env, `/api/entities/5/instruments?limit=25${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
    pages++;
    if (pages === 1) check('T3 first page total', r.body.total === 60 && r.body.total_capped === false, r.body.total);
    else check('T3 later page has no total', r.body.total === null, r.body.total);
    seen.push(...r.body.instruments.map(x => x.instrument_key));
    r.body.instruments.forEach(x => { if (navLinkErrors(x).length) check('T9 R2 row conforms', false, navLinkErrors(x)); });
    cursor = r.body.next_cursor;
  } while (cursor && pages < 10);
  const expected = db.prepare(`SELECT instrument_key FROM instrument_entity_map WHERE entity_id = 5 ORDER BY instrument_key`).all().map(x => x.instrument_key);
  check('T3 3 pages', pages === 3, pages);
  check('T3 no gaps, no duplicates, key order', JSON.stringify(seen) === JSON.stringify(expected), { seen: seen.length });
  check('T3 last page next_cursor null', r.body.next_cursor === null);

  r = await call(env, '/api/entities/5/instruments?limit=500');
  check('T3 clamp to 100', r.status === 200 && r.body.limit === 100 && r.body.instruments.length === 60, r.body.limit);
  r = await call(env, '/api/entities/5/instruments?limit=abc');
  check('T3 limit=abc → 400', r.status === 400);
  r = await call(env, '/api/entities/5/instruments?limit=-3');
  check('T3 limit=-3 → 400', r.status === 400);
  r = await call(env, '/api/entities/5/instruments?limit=0');
  check('T3 limit=0 clamps to 1', r.body.limit === 1 && r.body.instruments.length === 1);
  r = await call(env, '/api/entities/5/instruments?cursor=');
  check('T3 cursor only → default 25', r.body.limit === 25 && r.body.instruments.length === 25);
  r = await call(env, '/api/entities/6/instruments?limit=25');
  check('T3 R4 count capped (1,000+)', r.body.total === 1000 && r.body.total_capped === true, r.body);
  r = await call(env, '/api/entities/2/instruments?limit=25');
  check('T3 heuristic row state low_confidence', r.body.instruments.some(x => x.state === 'low_confidence'));
  r = await call(env, '/api/entities/20/instruments?limit=25');
  check('T3 redirected id: survivor + redirect', r.status === 200 && r.body.entity_id === 10 && r.body.redirect?.resolved_id === 10, r.body);
  r = await call(env, '/api/entities/999/instruments?limit=25');
  check('T3 gone id → 404 gone', r.status === 404 && r.body.state === 'gone', r);

  // T5: legacy body unchanged (no params)
  r = await call(env, '/api/entities/5/instruments');
  const legacy = db.prepare(`
    SELECT im.instrument_key, im.security_name, im.security_ticker, im.isin, im.cusip, im.asset_cat, im.country, iem.source, iem.confidence
    FROM instrument_entity_map iem JOIN instrument_master im ON im.instrument_key = iem.instrument_key
    WHERE iem.entity_id = ? ORDER BY im.asset_cat, im.security_name, iem.source LIMIT 75`).all(5).map(x => ({ ...x }));
  check('T5 legacy /instruments unchanged', r.status === 200 && Object.keys(r.body).join() === 'instruments' &&
    JSON.stringify(r.body.instruments) === JSON.stringify(legacy), Object.keys(r.body));
  r = await call(env, '/api/entities/6/instruments');
  check('T5 legacy still caps at 75', r.body.instruments.length === 75);
}

// ================================ T4: R3 ================================
{
  const db = buildDb(); const { env } = makeEnv(db);
  let r = await call(env, '/api/entities/1');
  check('T4 hit: redirect null, body kept', r.status === 200 && r.body.redirect === null && r.body.entity.entity_id === 1 && 'firds_directory_tier' in r.body.entity, r.body);
  r = await call(env, '/api/entities/20');
  check('T4 1-hop', r.status === 200 && r.body.entity.entity_id === 10 && JSON.stringify(r.body.redirect.chain) === '[20,10]' &&
    r.body.redirect.requested_id === 20 && r.body.redirect.packet === 'MA-OCT-013', r.body.redirect);
  r = await call(env, '/api/entities/30');
  check('T4 3-hop', r.status === 200 && r.body.entity.entity_id === 10 && JSON.stringify(r.body.redirect.chain) === '[30,31,32,10]', r.body.redirect);
  r = await call(env, '/api/entities/40');
  check('T4 4-hop → 409 redirect_too_deep', r.status === 409 && r.body.state === 'redirect_too_deep' && r.body.error === 'redirect_unresolved', r.body);
  r = await call(env, '/api/entities/50');
  check('T4 cycle → 409 redirect_cycle', r.status === 409 && r.body.state === 'redirect_cycle', r.body);
  r = await call(env, '/api/entities/60');
  check('T4 survivor missing → 404 gone with chain', r.status === 404 && r.body.state === 'gone' && JSON.stringify(r.body.chain) === '[60,99]', r.body);
  r = await call(env, '/api/entities/25782');
  check('T4 never-existed → 404 gone', r.status === 404 && r.body.state === 'gone' && r.body.requested_id === 25782 && !('chain' in r.body), r.body);
}
{
  const db = buildDb({ redirectTable: false }); const { env } = makeEnv(db);
  let r = await call(env, '/api/entities/1');
  check('T4 table missing: hit', r.status === 200 && r.body.redirect === null);
  r = await call(env, '/api/entities/20');
  check('T4 table missing: unknown id → 404 gone, no 500', r.status === 404 && r.body.state === 'gone', r);
}

console.log(`nav-007-worker: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
