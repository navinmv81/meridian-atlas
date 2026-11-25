#!/usr/bin/env node
// MA-NOV-BOND.UI — API + screen tests (spec MA-NOV-BOND v1 §5, v2 §10; Control v2).
// The REAL src/entities-api.js over in-memory node:sqlite D1 fixtures (migrations 008 + 009 gate + BOND-CR1 + BOND-CR2,
// and a pre-CR1 "legacy" fixture), and the REAL App/ma-entities.js in a vm with a minimal DOM stub (as fi-010).
// No network, no D1.
//   node "App/Corporate Atlas/tests/bond-ui.test.mjs"
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CA = path.resolve(HERE, '..');
const APP = path.resolve(CA, '..');
const SRC = readFileSync(path.join(APP, 'ma-entities.js'), 'utf8');
const worker = (await import(pathToFileURL(path.join(CA, 'src', 'entities-api.js')).href)).default;
const { WITHHELD_FIELDS } = await import(pathToFileURL(path.join(CA, 'bonds', 'bonds-offering.mjs')).href);

let pass = 0, fail = 0;
const check = (name, ok, extra) => { ok ? pass++ : fail++; if (!ok) console.log(`FAIL ${name}${extra !== undefined ? ' — ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 600) : ''}`); };
const tick = () => new Promise(r => setTimeout(r, 0));
const mig = f => readFileSync(path.join(CA, 'migrations', f), 'utf8');

// --- fixtures ---------------------------------------------------------------------------------------
const URL_A = 'https://www.sec.gov/Archives/edgar/data/1/a.htm';
const ACC = { deal: '0000000001-26-000010', draft: '0000000001-26-000009', open: '0000000001-26-000011', struct: '0000000001-26-000012', failed: '0000000001-26-000013', partial: '0000000001-26-000014' };
function buildDb({ cr1 = true, cr2 = true, gate = 'open' } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE entity_master (entity_id INTEGER PRIMARY KEY, name TEXT, legal_name TEXT, lei TEXT, type TEXT, entity_status TEXT);
    CREATE TABLE entity_merge_redirect (duplicate_id INTEGER PRIMARY KEY, survivor_id INTEGER NOT NULL, merged_at TEXT, packet TEXT);
    INSERT INTO entity_master VALUES (1,'ISSUER A','Issuer A Inc.','LEIAAAAAAAAAAAAAAA01','operating','ACTIVE');`);
  db.exec(mig('008-bonds.sql'));
  db.exec(mig('009-fi-serving-gate.sql'));
  if (gate === 'open') db.exec(`UPDATE fi_serving_gate SET state='open', changed_at='2026-10-29T08:00:00Z' WHERE id=1`);
  if (cr1) db.exec(mig('ma-nov-bond-cr1.sql'));
  if (cr2) db.exec(mig('ma-nov-bond-cr2.sql'));
  const L = db.prepare(`INSERT INTO bond_issuer_link (cik, entity_id, link_method, confidence, issuer_name, status, linked_at, last_polled_at) VALUES (?,?,?,?,?,?,'2026-10-15T00:00:00Z','2026-10-20T06:00:00Z')`);
  L.run('0000000001', 1, 'cik', 95, 'ISSUER A INC', 'active');
  L.run('0000000002', null, 'unmatched', 1, 'PAGER CO', 'active');
  const cols = `accession_number, tranche_seq, cik, instrument_key, isin, cusip, form_type, filing_date, filing_status, tranche_label, security_class, rate_type, coupon_rate,
    spread_bps, benchmark, principal_amount, currency, maturity_date, seniority, source_url, parse_confidence, parser_version, ingested_at`;
  const B = db.prepare(`INSERT INTO bond_issuance (${cols}) VALUES (?,?,?,?,?,?,?,?,?,?,'notes',?,?,NULL,NULL,?,?,?,'senior',?,?,'bonds-1.3.1','2026-11-25T00:00:00Z')`);
  // a 2-tranche final deal, one partial final (no CUSIP/ISIN), a draft replaced by the deal, an open draft, a structured skip, a failed filing
  B.run(ACC.deal, 1, '0000000001', 'US111111AA11', 'US111111AA11', '111111AA1', '424B5', '2026-03-02', 'final', '4.400% Notes due 2028', 'fixed', 4.4, 5e8, 'USD', '2028-06-15', URL_A, 95);
  B.run(ACC.deal, 2, '0000000001', 'US111111AB93', 'US111111AB93', '111111AB9', '424B5', '2026-03-02', 'final', '5.000% Notes due 2030', 'fixed', 5.0, 7.5e8, 'USD', '2030-06-15', URL_A, 95);
  B.run(ACC.partial, 1, '0000000001', null, null, null, '424B2', '2026-04-01', 'final', '3.000% Notes due 2031', 'fixed', null, 1e8, 'USD', '2031-01-01', URL_A, 90);
  B.run(ACC.draft, 1, '0000000001', null, null, null, '424B5', '2026-03-01', 'preliminary', 'notes due 20__', 'fixed', null, null, 'USD', null, 'https://www.sec.gov/d.htm', 40);
  B.run(ACC.open, 1, '0000000001', null, null, null, '424B5', '2026-05-01', 'preliminary', 'notes due 20__', 'fixed', null, null, 'USD', null, 'https://www.sec.gov/o.htm', 40);
  B.run(ACC.struct, 1, '0000000001', null, null, null, '424B2', '2026-05-02', 'skipped_structured', 'Market-Linked Notes', 'fixed', null, null, 'USD', null, 'https://www.sec.gov/s.htm', 40);
  B.run(ACC.failed, 1, '0000000001', null, null, null, '424B2', '2026-05-03', 'parse_failed', 'Notes', 'fixed', null, null, 'USD', null, 'https://www.sec.gov/f.htm', 30);
  for (let i = 0; i < 30; i++) B.run(`0000000002-26-${String(100 + i).padStart(6, '0')}`, 1, '0000000002', null, null, null, '424B3', `2026-01-${String(1 + (i % 28)).padStart(2, '0')}`, 'skipped_other', 'Demand notes', 'fixed', null, null, 'USD', null, 'https://www.sec.gov/p.htm', 40);
  if (cr1) {
    const R = db.prepare(`UPDATE bond_issuance SET status_reason = ?, superseded_by = ? WHERE accession_number = ?`);
    R.run('superseded', ACC.deal, ACC.draft); R.run('draft_no_final', null, ACC.open); R.run('structured', null, ACC.struct); R.run('no_maturity', null, ACC.failed);
    db.exec(`UPDATE bond_issuance SET status_reason = 'demand_note' WHERE cik = '0000000002'`);
  }
  if (cr2) {
    const F = db.prepare(`INSERT INTO bond_offering_fact (accession_number, tranche_seq, field, state, value_text, value_num, value_date, source_doc, source_url, source_part,
      source_heading, source_anchor, source_page, char_offset, parser_version, ingested_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,'bonds-offering-1.2.0','2026-11-25T00:00:00Z')`);
    const f = (seq, field, state, vt, vn, vd, part = 'cover', heading = 'Cover page', anchor = null, page = 'cover', doc = '424b', url = URL_A) => F.run(ACC.deal, seq, field, state, vt, vn, vd, doc, url, part, heading, anchor, page);
    f(0, 'document_date', 'disclosed', null, null, '2026-03-01');
    f(0, 'issue_date', 'disclosed', 'on or about', null, '2026-03-04');
    f(0, 'priced_on', 'not_disclosed', null, null, null);                                   // show where found → left out
    f(0, 'use_of_proceeds', 'disclosed', '["general corporate purposes"]', null, null);    // withheld 'row' → never served
    f(0, 'proceeds_total', 'disclosed', 'USD', 1.24e9, null);                                // withheld 'row'
    f(0, 'selling_restrictions', 'disclosed', 'EEA, UK', null, null, 'underwriting', 'Selling Restrictions', 'sell1', 'S-23');   // place list withheld
    f(0, 'risk_factors', 'disclosed', null, null, null, 'risk factors', 'RISK FACTORS', 'rf', 'S-3');
    f(0, 'listing', 'disclosed', 'Not listed', null, null, 'description of the notes', null, null, 'S-12');
    f(0, 'parties.bookrunner', 'disclosed', null, 2, null);
    f(0, 'parties.co_manager', 'disclosed', null, 1, null);
    f(0, 'parties.trustee', 'not_disclosed', null, null, null);
    f(0, 'parties.agent', 'not_applicable', null, null, null);
    // (no parties.underwriter row → "Not read yet")
    for (const [seq, price, from] of [[1, 99.954, '2028-05-15'], [2, 99.5, '2030-03-15']]) {
      f(seq, 'issue_price_pct', 'disclosed', null, price, null, 'cover table');
      f(seq, 'early_repayment', 'disclosed', JSON.stringify({ can: 'yes', from, price: 'make-whole, then par' }), null, from, 'optional redemption', 'Optional Redemption', 'redm', 'S-9');
      f(seq, 'interest_paid', 'disclosed', JSON.stringify({ f: 'semi-annual', on: ['06-15', '12-15'], first: '2026-12-15' }), null, '2026-12-15');
      f(seq, 'day_count', 'not_disclosed', null, null, null);
      f(seq, 'ranking', 'disclosed', 'Senior', null, null);
      f(seq, 'secured', 'disclosed', 'unsecured', null, null);
      f(seq, 'bank_fee_pct', 'disclosed', null, 0.25, null, 'cover table');
      f(seq, 'proceeds_pct', 'disclosed', null, 99.704, null, 'cover table');
      f(seq, 'identifier', 'disclosed', `CUSIP 11111${seq === 1 ? '1AA1' : '1AB9'}`, null, null, 'term sheet', 'CUSIP / ISIN', null, null, 'fwp', 'javascript:alert(1)');
    }
    f(1, 'document_date', 'disclosed', null, null, '2026-02-27');   // a tranche value wins over the offering value
    const P = db.prepare(`INSERT INTO bond_offering_party (accession_number, party_seq, tranche_seq, party_name, role, role_printed, source_doc, source_url, source_part, source_page, parser_version, ingested_at)
      VALUES (?,?,?,?,?,?,'424b',?,'cover','cover','bonds-offering-1.2.0','2026-11-25T00:00:00Z')`);
    P.run(ACC.deal, 1, 0, 'Bank One', 'bookrunner', 'Joint Book-Running Managers', URL_A);
    P.run(ACC.deal, 2, 2, 'Bank Two <img src=x onerror=alert(1)>', 'bookrunner', 'Joint Book-Running Managers (2030 Notes)', URL_A);
    P.run(ACC.deal, 3, 1, 'Bank Only For 2028', 'co_manager', 'Co-Managers (2028 Notes)', URL_A);
  }
  return db;
}
function workerEnv(db) {
  const log = [];
  const run = (sql, p, mode) => { log.push(sql); const st = db.prepare(sql); return mode === 'first' ? (st.get(...p) ?? null) : { results: st.all(...p) }; };
  const prep = sql => { const st = { sql, params: [], bind(...p) { st.params = p; return st; }, async first() { return run(sql, st.params, 'first'); }, async all() { return run(sql, st.params, 'all'); } }; return st; };
  return { env: { DB: { prepare: prep, batch: async s => s.map(x => run(x.sql, x.params, 'all')) } }, log };
}
globalThis.caches = undefined;
async function call(env, p) {
  const r = await worker.fetch(new Request(`https://w.test${p}`), env, { waitUntil() {} });
  let body = null; try { body = await r.json(); } catch {}
  return { status: r.status, body };
}

// ================= API =================
{
  const { env, log } = workerEnv(buildDb());
  // F1 / F1b: documents only on request, on a first page
  const plain = await call(env, '/api/fi/issuers/1/bonds');
  check('[F1] no documents param → no `documents` key (009 contract unchanged)', plain.status === 200 && !('documents' in plain.body), plain.body);
  const b0 = log.length; await call(env, '/api/fi/issuers/1/bonds');
  check('[F1] without documents=1: ≤ 4 statements as 009', log.length - b0 <= 4, log.length - b0);
  const withDocs = await call(env, '/api/fi/issuers/1/bonds?documents=1');
  check('[F1] documents=1 → counts by class (v1 §5)', JSON.stringify(withDocs.body.documents) === JSON.stringify({ filings: 6, shown: 3, drafts_replaced: 1, drafts_open: 1, could_not_read: 1, not_covered: 1, unknown_reason: 0 }), withDocs.body.documents);
  const b1 = log.length; await call(env, '/api/fi/issuers/1/bonds?documents=1');
  check('[F1] documents=1 adds exactly one statement', log.length - b1 <= 5, log.length - b1);
  check('[F1] drafts are never bonds: every F1 row is final', withDocs.body.bonds.every(b => ![ACC.draft, ACC.open, ACC.struct, ACC.failed].includes(b.accession_number)));
  const cur = await call(env, `/api/fi/issuers/1/bonds?documents=1&limit=1`);
  const p2 = await call(env, `/api/fi/issuers/1/bonds?documents=1&limit=1&cursor=${cur.body.next_cursor}`);
  check('[F1] cursor page → no documents (first page only)', p2.status === 200 && !('documents' in p2.body), p2.body);
  const f1b = await call(env, '/api/fi/ciks/0000000002/bonds?documents=1');
  check('[F1b] documents=1 on a filer page', f1b.body.documents && f1b.body.documents.not_covered === 30 && f1b.body.documents.shown === 0, f1b.body.documents);
  const partialRow = withDocs.body.bonds.find(b => b.accession_number === ACC.partial);
  check('[F1] partial row carries missing [cusip_isin, coupon]', partialRow && JSON.stringify(partialRow.missing) === '["cusip_isin","coupon"]', partialRow);

  // F2
  const d = (await call(env, `/api/fi/bonds/${ACC.deal}/1`)).body;
  check('[F2] status fields present (CR1)', d.bond.status_reason === null && d.bond.superseded_by === null && d.bond.status_note === null && Array.isArray(d.bond.missing) && d.bond.missing.length === 0, d.bond);
  const o = d.offering;
  const fields = o.facts.map(f => f.field);
  check('[F2] offering: withheld "row" fields never served', !fields.includes('use_of_proceeds') && !fields.includes('proceeds_total'), fields);
  const sr = o.facts.find(f => f.field === 'selling_restrictions');
  check('[F2] offering: selling_restrictions row kept, place list (value_text) withheld', sr && sr.value_text === null && sr.source.heading === 'Selling Restrictions' && sr.source.page === 'S-23', sr);
  check('[F2] offering.withheld = WITHHELD_FIELDS (one list)', JSON.stringify(o.withheld) === JSON.stringify(WITHHELD_FIELDS), o.withheld);
  check('[F2] offering: tranche value wins over the offering value', o.facts.find(f => f.field === 'document_date').value_date === '2026-02-27');
  check('[F2] offering: this tranche only (price 99.954, not tranche 2)', o.facts.find(f => f.field === 'issue_price_pct').value_num === 99.954);
  check('[F2] offering: no char_offset served', !JSON.stringify(o).includes('char_offset'));
  check('[F2] offering: states from parties.<role> rows', JSON.stringify(o.states) === JSON.stringify({ agent: 'not_applicable', bookrunner: 'disclosed', co_manager: 'disclosed', trustee: 'not_disclosed' }), o.states);
  check('[F2] offering: parties for tranche 0 and this tranche only', o.parties.map(p => p.name).join('|') === 'Bank One|Bank Only For 2028', o.parties);
  check('[F2] offering: document kind from family states', o.document === 'prospectus supplement', o.document);
  const d2 = (await call(env, `/api/fi/bonds/${ACC.deal}/2`)).body;
  check('[F2] tranche 2: its own price and its own tranche-specific bank', d2.offering.facts.find(f => f.field === 'issue_price_pct').value_num === 99.5 && d2.offering.parties.some(p => p.tranche_specific && p.role === 'bookrunner'));
  const b2 = log.length; await call(env, `/api/fi/bonds/${ACC.deal}/1`);
  check('[F2] offering adds one PK-range read per CR2 table', log.slice(b2).filter(s => /bond_offering_fact WHERE accession_number = \? AND tranche_seq IN/.test(s)).length === 1 && log.slice(b2).filter(s => /bond_offering_party WHERE accession_number = \?/.test(s)).length === 1);
  check('[F2] a draft is not served as a bond', (await call(env, `/api/fi/bonds/${ACC.draft}/1`)).status === 404);

  // F5
  const l1 = await call(env, '/api/fi/ciks/0000000001/documents');
  check('[F5] non-final documents only, newest first', l1.status === 200 && l1.body.documents.map(x => x.accession_number).join(',') === [ACC.failed, ACC.struct, ACC.open, ACC.draft].join(','), l1.body);
  const sup = l1.body.documents.find(x => x.accession_number === ACC.draft);
  check('[F5] superseded draft names the final (date + URL)', sup.status_reason === 'superseded' && sup.superseded_by.accession_number === ACC.deal && sup.superseded_by.filing_date === '2026-03-02' && sup.superseded_by.source_url === URL_A, sup);
  check('[F5] one page → next_cursor null', l1.body.next_cursor === null);
  const pg1 = await call(env, '/api/fi/ciks/0000000002/documents');
  const pg2 = await call(env, `/api/fi/ciks/0000000002/documents?cursor=${pg1.body.next_cursor}`);
  const all = [...pg1.body.documents, ...pg2.body.documents].map(x => x.accession_number);
  check('[F5] 25 per page, cursor reaches all 30 once', pg1.body.documents.length === 25 && pg2.body.documents.length === 5 && new Set(all).size === 30 && pg2.body.next_cursor === null, [pg1.body.documents.length, pg2.body.documents.length]);
  check('[F5] bad cursor → 400', (await call(env, '/api/fi/ciks/0000000001/documents?cursor=%%%')).status === 400);
  check('[F5] bad cik → 400', (await call(env, '/api/fi/ciks/123/documents')).status === 400);
  check('[F5] unknown cik → has_bond_link false', (await call(env, '/api/fi/ciks/0000009999/documents')).body.has_bond_link === false);
  const closed = workerEnv(buildDb({ gate: 'closed' })).env;
  const cl = await call(closed, '/api/fi/ciks/0000000001/documents');
  check('[F5] gate closed → no documents, no names', cl.body.gate === 'closed' && cl.body.documents.length === 0 && !JSON.stringify(cl.body).includes('ISSUER'), cl.body);
}
{
  // Missing CR2 tables (CR2 rollback) → offering not available, nothing breaks
  const { env } = workerEnv(buildDb({ cr2: false }));
  const r = await call(env, `/api/fi/bonds/${ACC.deal}/1`);
  check('[F2] no CR2 tables → 200, offering.available false, no facts', r.status === 200 && r.body.offering.available === false && r.body.offering.facts.length === 0, r.body.offering);
}
{
  // Pre-CR1 schema (or CR1 rollback): the CR1 columns are absent; every FI route still answers
  const { env } = workerEnv(buildDb({ cr1: false, cr2: false }));
  const r = await call(env, `/api/fi/bonds/${ACC.deal}/1`);
  check('[CR1 absent] F2 → 200 with NULL status fields', r.status === 200 && r.body.bond.status_reason === null && r.body.bond.superseded_by === null, r);
  const f = await call(env, '/api/fi/issuers/1/bonds?documents=1');
  check('[CR1 absent] F1 documents=1 → counts, reasons unknown', f.status === 200 && f.body.documents.filings === 6 && f.body.documents.unknown_reason === 4, f.body.documents);
  const l = await call(env, '/api/fi/ciks/0000000001/documents');
  check('[CR1 absent] F5 → 200 with NULL reasons', l.status === 200 && l.body.documents.length === 4 && l.body.documents.every(x => x.status_reason === null && x.superseded_by === null), l.body);
}

// ================= Screen =================
function makeEl(tag = 'div') {
  return { tagName: tag, innerHTML: '', className: '', id: '', dataset: {}, style: { cssText: '', display: '' }, isConnected: false, textContent: '',
    remove() { this.isConnected = false; }, querySelector() { return null; }, querySelectorAll() { return []; }, insertAdjacentHTML(_, h) { this.innerHTML += h; },
    addEventListener() {}, closest() { return null; } };
}
function makeCtx(db = buildDb()) {
  const { env } = workerEnv(db);
  const calls = [];
  const head = { appendChild(e) { head.kids.push(e); }, kids: [] };
  const body = { ...makeEl('body'), isConnected: true, appendChild(e) { e.isConnected = true; } };
  const ctx = {
    console: { ...console, error() {}, warn() {}, log() {} }, CSS: { escape: s => s }, URLSearchParams, setTimeout, clearTimeout,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    location: { pathname: '/', search: '', hash: '' },
    history: { state: null, entries: [], pushState(s, _, h) { this.state = s; this.entries.push(h); }, replaceState(s) { this.state = s; }, back() {}, go() {} },
    document: { body, head, createElement: makeEl, addEventListener() {}, dispatchEvent() {}, getElementById(id) { return head.kids.find(k => k.id === id) || null; }, querySelector() { return null; }, querySelectorAll() { return []; } },
    _nextAtlasOverlayZ: () => 1600,
    data_entitiesGet: async p => {
      calls.push(p);
      const r = await worker.fetch(new Request(`https://w.test${p}`), env, { waitUntil() {} });
      let data = null; try { data = await r.json(); } catch {}
      return { ok: r.ok, status: r.status, data };
    },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'ma-entities.js' });
  return { ctx, calls, run: code => vm.runInContext(code, ctx) };
}
const has = (h, t) => h.includes(t) || h.includes(t.replace(/'/g, '&#39;'));
const kv = (h, label, value) => new RegExp(`<div class="fi-k">${label.replace(/[()]/g, '\\$&')}</div><div class="fi-v">(?:<span[^>]*>)?${value.replace(/[()]/g, '\\$&')}`).test(h);

{
  const c = makeCtx();
  // spec v1 §5 footer wording, verbatim
  const t = c.run(`_fiDocsCountsHtml({ filings: 45, shown: 31, drafts_replaced: 3, drafts_open: 1, could_not_read: 1, not_covered: 9 }).text`);
  check('[UI v1 §5] footer verbatim', t === "From 45 SEC filings: 31 bonds shown · 4 draft documents · 1 filing we couldn't read · 9 not covered", t);
  const t1 = c.run(`_fiDocsCountsHtml({ filings: 1, shown: 1, drafts_replaced: 0, drafts_open: 0, could_not_read: 0, not_covered: 0 })`);
  check('[UI v1 §5] singular, zero classes left out, nothing to list', t1.text === 'From 1 SEC filing: 1 bond shown' && t1.listed === 0, t1);
  // reasons, verbatim (spec v1 §5 table)
  const R = code => c.run(`_fiReasonHtml(${JSON.stringify({ status_reason: code, filing_status: 'skipped_other' })})`);
  const want = {
    draft_no_final: 'Draft offering document — no final terms found', draft_not_debt: 'Draft for shares or units — not covered',
    draft_structured: 'Draft for notes linked to an index or stock — not covered', structured: 'Notes linked to an index, stock or basket — not covered',
    equity: 'Shares, units or preferred stock — not covered', stock_plan: 'Share purchase plan — not covered', exchange_offer: 'Exchange offer for existing bonds — not covered',
    merger_document: 'Merger or consent document — not covered', demand_note: 'Demand notes (not bonds) — not covered', remarketing: 'Resale of existing notes — not covered',
    resale: 'Resale by holders — not covered', program_supplement: 'Notes programme document — no specific notes offered — not covered',
    no_maturity: "We couldn't read this filing's terms: maturity date not stated in a form we read", no_principal: "We couldn't read this filing's terms: amount not found",
    fwp_conflict: "We couldn't read this filing's terms: details didn't agree with the term sheet", no_tranche: "We couldn't read this filing's terms: no bond terms found",
  };
  for (const [code, text] of Object.entries(want)) check(`[UI v1 §5] reason ${code}`, has(R(code), text), R(code));
  const sup = c.run(`_fiReasonHtml({ status_reason: 'superseded', filing_status: 'preliminary', superseded_by: { filing_date: '2026-03-02', source_url: '${URL_A}' } })`);
  check('[UI v1 §5] superseded → "replaced by the final terms filed {date}" with a link', sup.startsWith('Draft offering document — replaced by <a href="' + URL_A + '"') && sup.includes('the final terms filed 2 Mar 2026'), sup);
  const bad = c.run(`_fiReasonHtml({ status_reason: 'superseded', filing_status: 'preliminary', superseded_by: { filing_date: '2026-03-02', source_url: 'javascript:alert(1)' } })`);
  check('[UI] a non-SEC URL is never a link', !bad.includes('href') && !bad.includes('javascript'), bad);
}
{
  // Issuer Bonds section: footer + list, row links, partial line
  const c = makeCtx();
  const section = { ...makeEl(), id: 'issuer-bonds-section-1', isConnected: true, style: { display: 'none' } };
  section.closest = () => section;
  c.ctx.__root = { querySelector: s => (s === '#issuer-bonds-section-1' ? section : null) };
  await c.run('_loadIssuerBonds(1, __root)'); await tick();
  check('[UI] first page asks for documents=1', c.calls.some(p => /\/api\/fi\/issuers\/1\/bonds\?.*documents=1/.test(p)), c.calls);
  const h = section.innerHTML;
  check('[UI] footer on the issuer section', has(h, "From 6 SEC filings: 3 bonds shown · 2 draft documents · 1 filing we couldn't read · 1 not covered"), h.slice(-900));
  check('[UI] "show list" is a keyboard button with aria-expanded', /<button class="fi-docs-toggle" aria-expanded="false"[^>]*>show list<\/button>/.test(h));
  check('[UI] each bond row has an "Offering details" link to the bond (keyboard-safe)', (h.match(/>Offering details<\/a>/g) || []).length === 3 && h.includes(`href="#/bond/${ACC.deal}/1"`) && h.includes('onkeydown="event.stopPropagation()"'));
  check('[UI] partial bond row: "Some details not found in the filing"', (h.match(/Some details not found in the filing/g) || []).length === 1);
  // open the list (toggle via the owner state)
  const st = section._fi;
  const btn = { closest: s => (s === '.fi-docs-wrap' ? wrap : section), dataset: {} };
  const wrap = { innerHTML: '', querySelector: () => null };
  c.ctx.__btn = btn;
  await c.run('_fiDocsToggle(__btn)'); await tick();
  check('[UI] show list → F5 for the CIK, the four documents with reasons', c.calls.some(p => p === '/api/fi/ciks/0000000001/documents') && st.docs.open && has(wrap.innerHTML, 'Draft offering document — replaced by') && has(wrap.innerHTML, "We couldn't read this filing's terms: maturity date not stated in a form we read") && wrap.innerHTML.includes('hide list') && wrap.innerHTML.includes('aria-expanded="true"'), wrap.innerHTML);
  check('[UI] list rows link to SEC.gov only', (wrap.innerHTML.match(/href="([^"]+)"/g) || []).every(x => x.startsWith('href="https://www.sec.gov/')));
}
{
  // Bond page: Offering details + Who's involved (spec v2 §10)
  const c = makeCtx();
  await c.run(`_navOpen('bond', '${ACC.deal}/1', { history: 'push' })`); await tick(); await tick();
  const h = c.run('_navStack[_navStack.length - 1].el.innerHTML');
  for (const g of ['Offering details', "Who's involved", 'The deal', 'This bond', 'Money and fees', 'To read in the filing', 'Who issued and protects the bonds', 'Banks that sold the bonds'])
    check(`[UI v2 §10] heading "${g}"`, has(h, `>${g}<`), g);
  for (const l of ['Issuer', 'Date of this document', 'Issue date', 'Amount', 'Interest', 'Interest paid', 'How interest is counted', 'Price to investors', 'Matures', 'Ranking', 'CUSIP / ISIN', 'Early repayment',
    'What the money is for', 'Bank fee', 'Proceeds to the issuer before expenses', 'Risks', 'Where the notes may not be sold', 'Listing', 'Trustee', 'Lead banks (bookrunners)', 'Other managing banks', 'Underwriters', 'Selling agents'])
    check(`[UI v2 §10] label "${l}"`, h.includes(`<div class="fi-k">${l}</div>`), l);
  check('[UI] values: amount, interest, price, ranking, interest paid', kv(h, 'Amount', '\\$500m') && kv(h, 'Interest', '4.400% a year') && kv(h, 'Price to investors', '99.954%') && kv(h, 'Ranking', 'Senior, unsecured') && kv(h, 'Interest paid', 'Twice a year, 15 Jun and 15 Dec; first on 15 Dec 2026'), h);
  check('[UI] early repayment (struct)', kv(h, 'Early repayment', 'Yes, from 15 May 2028 at par; before that at the greater of par and a make-whole amount'));
  check('[UI] issue date "on or about"', kv(h, 'Issue date', 'on or about 4 Mar 2026'));
  check('[UI] "Not stated in the filing" (day count, trustee)', kv(h, 'How interest is counted', 'Not stated in the filing') && kv(h, 'Trustee', 'Not stated in the filing'));
  check('[UI] "Not applicable" (selling agents)', kv(h, 'Selling agents', 'Not applicable'));
  check('[UI] "Not read yet" (no row: underwriters; withheld: what the money is for)', kv(h, 'Underwriters', 'Not read yet') && kv(h, 'What the money is for', 'Not read yet'));
  check('[UI] show-where-found left out when absent (priced on, guarantor, conflicts, buy-back)', !h.includes('>Priced on<') && !h.includes('>Guaranteed by<') && !h.includes('>Conflicts of interest<') && !h.includes('>Buy-back if control changes<'));
  check('[UI] withheld place list never shown; section link + heading + page shown', !h.includes('EEA') && h.includes('href="' + URL_A + '#sell1"') && h.includes('Selling Restrictions, page S-23'), h);
  check('[UI] proceeds total withheld (no whole-deal figure)', !h.includes('1.24bn') && kv(h, 'Proceeds to the issuer before expenses', '99.704%'));
  check('[UI] all-caps heading in sentence case for the risks link', h.includes('Risk factors, page S-3'));
  check('[UI] source link wording "Prospectus supplement — Optional Redemption, page S-9" at its anchor', h.includes(`href="${URL_A}#redm"`) && h.includes('Prospectus supplement — Optional Redemption, page S-9'));
  check('[UI] term-sheet label quoted, and its non-SEC URL is not a link', h.includes("Term sheet — 'CUSIP / ISIN'") && !h.includes('javascript:'), h);
  check('[UI] escaping: party names are text, never markup', !h.includes('<img') && !/onerror=alert/.test(h.replace(/&lt;img src=x onerror=alert\(1\)&gt;/g, '')));
  check('[UI] tranche 1 shows its tranche-specific bank "for the 2028 notes", not tranche 2\'s', h.includes('Bank Only For 2028') && h.includes('Co-Managers · for the 2028 notes') && !h.includes('Bank Two'));
  check('[UI] printed role in small text after the name', h.includes('Bank One <span style="font-size:9px;color:var(--muted)">Joint Book-Running Managers</span>'));
  check('[UI v2 §8] footer verbatim', has(h, "Facts copied from the SEC filing, with a link to where each one appears. We don't summarise or interpret the filing."));
  await c.run(`_navOpen('bond', '${ACC.deal}/2', { history: 'push' })`); await tick(); await tick();
  const h2 = c.run('_navStack[_navStack.length - 1].el.innerHTML');
  check('[UI] tranche 2: own price, own call date, own bank for the 2030 notes (escaped)', kv(h2, 'Price to investors', '99.500%') && h2.includes('from 15 Mar 2030') && h2.includes('Bank Two &lt;img src=x onerror=alert(1)&gt;') && h2.includes('· for the 2030 notes'), h2);
  await c.run(`_navOpen('bond', '${ACC.partial}/1', { history: 'push' })`); await tick(); await tick();
  const h3 = c.run('_navStack[_navStack.length - 1].el.innerHTML');
  check('[UI v1 §5] partial bond: "Not found in the filing: CUSIP/ISIN, coupon"', h3.includes('Not found in the filing: CUSIP/ISIN, coupon'), h3);
  check('[UI] no offering rows: Required fields "Not read yet", columns 5–8 from the bond row', kv(h3, 'Date of this document', 'Not read yet') && kv(h3, 'Matures', '1 Jan 2031') && kv(h3, 'Amount', '\\$100m'), h3);
}
{
  // CR2 tables missing: the bond page still renders, offering rows "Not read yet"
  const c = makeCtx(buildDb({ cr2: false }));
  await c.run(`_navOpen('bond', '${ACC.deal}/1', { history: 'push' })`); await tick(); await tick();
  const h = c.run('_navStack[_navStack.length - 1].el.innerHTML');
  check('[UI] CR2 missing → panels render with "Not read yet"', kv(h, 'Price to investors', 'Not read yet') && kv(h, 'Trustee', 'Not read yet') && kv(h, 'Lead banks (bookrunners)', 'Not read yet'), h);
}
{
  // phone width + banned words
  const c = makeCtx();
  c.run('_fiStyleOnce()');
  const css = c.ctx.document.head.kids.find(k => k.id === 'fi-style').textContent;
  check('[UI] phone width: .fi-kv stacks to one column under 640px', /@media \(max-width:640px\)\{\.fi-kv\{grid-template-columns:minmax\(0,1fr\)/.test(css), css);
  check('[UI] long values wrap (no sideways scroll)', css.includes('.fi-v{min-width:0;overflow-wrap:anywhere}'));
  const block = SRC.slice(SRC.indexOf('// ── MA-NOV-BOND.UI'), SRC.indexOf('// M9-4: F1'));
  check('[UI] new block located', block.length > 5000, block.length);
  for (const w of ['real-time', 'realtime', 'live data', 'complete', 'all holders', 'current ownership']) check(`[UI] banned word "${w}" absent from the new block`, !block.toLowerCase().includes(w));
}

console.log(`bond-ui: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
