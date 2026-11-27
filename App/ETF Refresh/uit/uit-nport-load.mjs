#!/usr/bin/env node
// MA-NOV-UIT.BUILD — one-off N-PORT holdings for series-less 1940-Act UITs (SPY, QQQ, DIA, MDY).
//
// Builds the rows the holdings pipeline would write for ONE period per fund, using the pipeline's own
// storeHoldings() (src/holdings-pipeline.js) run against a recording D1 shim, then turns the recorded
// statements into guarded apply / rollback SQL. Nothing here writes to D1; the SQL is run later by a
// separate, approved packet.
//
//   node "App/ETF Refresh/uit/uit-nport-load.mjs" fetch   # download missing NPORT-P XML into cache/ (SEC GETs)
//   node "App/ETF Refresh/uit/uit-nport-load.mjs" build   # cache → apply/rollback SQL + summary (offline)
//
// Key: a fund whose NPORT-P header carries a real seriesId uses it; otherwise the surrogate
// series_id = 'C' + 10-digit CIK, so every series-keyed table and the exposure route work unchanged.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRecordingD1, inline, sqlLit } from './lib/recording-d1.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PATHS = {
  cache: path.join(HERE, 'cache'),
  apply: path.join(HERE, 'apply'),
  seed: path.join(HERE, 'seed', 'd1-before.json'),
  pipeline: process.env.PIPELINE_SRC || path.join(HERE, '..', 'src', 'holdings-pipeline.js'),
};

const SEC_UA = 'MeridianAtlas contact@meridianatlas.com'; // project contact, same string as the pipeline
export const PACKET = 'MA-NOV-UIT';
export const BATCH_MAX = 100;
// Explicit ids for the inserted holdings rows (D1 max(id) = 798,655 on 2026-11-27). Explicit ids make
// the inserts idempotent (INSERT OR IGNORE on the PK) and let rollback delete exactly these rows.
export const ID_BASE = 2_000_000;
export const ID_BLOCK = 10_000;

// Confirmed from SEC submissions JSON on 2026-11-27 (see report §1). etfMasterCik = value stored in D1.
export const FUNDS = [
  { ticker: 'SPY', cik: '0000884394', etfMasterCik: '0000884394', accession: '0001410368-26-123764', fileDate: '2026-11-25', period: '2026-09-30' },
  { ticker: 'QQQ', cik: '0001067839', etfMasterCik: '0001067839', accession: '0001067839-26-000030', fileDate: '2026-08-28', period: '2026-06-30' },
  { ticker: 'DIA', cik: '0001041130', etfMasterCik: '0001041014', accession: '0001410368-26-095867', fileDate: '2026-09-18', period: '2026-07-31' },
  { ticker: 'MDY', cik: '0000936958', etfMasterCik: '0000916132', accession: '0000940400-26-047939', fileDate: '2026-11-25', period: '2026-09-30' },
];

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const cacheFile = (f) => path.join(PATHS.cache, `${f.ticker}-${f.accession}.xml.gz`);
const xmlUrl = (f) => `https://www.sec.gov/Archives/edgar/data/${parseInt(f.cik, 10)}/${f.accession.replace(/-/g, '')}/primary_doc.xml`;

export function readXml(f) {
  return zlib.gunzipSync(fs.readFileSync(cacheFile(f))).toString('utf8');
}

// ── NPORT header ────────────────────────────────────────────────────────────
const tag = (src, t) => {
  const m = src.match(new RegExp(`<(?:[\\w-]+:)?${t}(?:\\s[^>]*)?>([^<]*)</(?:[\\w-]+:)?${t}>`, 'i'));
  return m ? m[1].trim() : null;
};
export function parseHeader(xml) {
  const gi = (xml.match(/<(?:[\w-]+:)?genInfo>([\s\S]*?)<\/(?:[\w-]+:)?genInfo>/i) || [])[1] || '';
  return {
    regName: tag(gi, 'regName'), regFileNumber: tag(gi, 'regFileNumber'), regCik: tag(gi, 'regCik'),
    seriesName: tag(gi, 'seriesName'), seriesId: tag(gi, 'seriesId'), seriesLei: tag(gi, 'seriesLei'),
    repPdEnd: tag(gi, 'repPdEnd'), repPdDate: tag(gi, 'repPdDate'),
  };
}
export function keyFor(fund, header) {
  if (header.seriesId && /^S\d{9}$/.test(header.seriesId)) return { key: header.seriesId, keyType: 'series' };
  if (!/^\d{10}$/.test(fund.cik)) throw new Error(`bad cik ${fund.cik}`);
  return { key: 'C' + fund.cik, keyType: 'surrogate' };
}

// ── Run storeHoldings through the recording shim ────────────────────────────
export function backingDb(seed) {
  const db = new DatabaseSync(':memory:');
  for (const s of seed.schema.filter((x) => x.type === 'table')) db.exec(s.sql);
  for (const s of seed.schema.filter((x) => x.type === 'index')) db.exec(s.sql);
  const ins = db.prepare(`INSERT INTO etf_master (${Object.keys(seed.etf_master[0]).join(',')}) VALUES (${Object.keys(seed.etf_master[0]).map(() => '?').join(',')})`);
  for (const r of seed.etf_master) ins.run(...Object.values(r));
  return db;
}

export async function recordFund(fund, xml, seed, pipelineSrc = PATHS.pipeline) {
  const { storeHoldings } = await import(pathToFileURL(pipelineSrc).href);
  if (typeof storeHoldings !== 'function') throw new Error('storeHoldings is not exported from holdings-pipeline.js');
  const header = parseHeader(xml);
  const { key, keyType } = keyFor(fund, header);
  const shim = createRecordingD1(backingDb(seed));
  const reportMonth = fund.period.slice(0, 7);
  const res = await storeHoldings(shim, key, fund.ticker, reportMonth, fund.fileDate, xml, 0);
  return { fund, header, key, keyType, reportMonth, res, log: shim.log, backing: shim.backing };
}

// ── Recorded statements → guarded apply / rollback ──────────────────────────
const RULES = [
  { id: 'R1', re: /^SELECT value FROM holdings_pipeline_state WHERE key = \?$/, act: 'drop-read' },
  { id: 'R2', re: /^INSERT INTO holdings_pipeline_state \(key, value\) VALUES \(\?, \?\) ON CONFLICT\(key\) DO UPDATE SET value = excluded\.value$/, act: 'drop-counter' },
  { id: 'R3', re: /^INSERT OR REPLACE INTO fund_snapshot_monthly \(series_id, report_month, ticker, net_assets, total_assets, total_liabilities, holdings_count, monthly_return_1, monthly_return_2, monthly_return_3, derivatives_flag, securities_lending_flag, filing_date, period_end\) VALUES \((\?, ){13}\?\)$/, act: 'snapshot' },
  { id: 'R4', re: /^DELETE FROM fund_holdings_monthly WHERE series_id = \? AND report_month = \?$/, act: 'drop-delete' },
  { id: 'R5', re: /^INSERT INTO fund_holdings_monthly \(series_id, report_month, ticker, security_name, cusip, isin, security_ticker, position_value, weight_pct, shares, asset_cat, issuer_country, is_restricted, snapshot_status\) VALUES \((\?, ){13}NULL\)$/, act: 'holding' },
  { id: 'R6', re: /^UPDATE fund_holdings_monthly SET snapshot_status = 'complete' WHERE series_id = \? AND report_month = \?$/, act: 'complete' },
  { id: 'R7', re: /^UPDATE etf_master SET coverage_status = 'directory' WHERE series_id = \? AND LOWER\(coverage_status\) = 'deep'$/, act: 'refuse' },
  { id: 'R8', re: /^SELECT COUNT\(DISTINCT report_month\) as month_count FROM fund_holdings_monthly WHERE series_id = \?$/, act: 'drop-read' },
  { id: 'R9', re: /^UPDATE etf_master SET coverage_depth = \? WHERE series_id = \?$/, act: 'depth' },
];
const HOLD_COLS = ['series_id', 'report_month', 'ticker', 'security_name', 'cusip', 'isin', 'security_ticker', 'position_value', 'weight_pct', 'shares', 'asset_cat', 'issuer_country', 'is_restricted'];
const SNAP_COLS = ['series_id', 'report_month', 'ticker', 'net_assets', 'total_assets', 'total_liabilities', 'holdings_count', 'monthly_return_1', 'monthly_return_2', 'monthly_return_3', 'derivatives_flag', 'securities_lending_flag', 'filing_date', 'period_end'];
const ETF_COLS = ['cik', 'series_id', 'has_nport', 'coverage_status', 'notes', 'coverage_depth'];

export function classify(log) {
  const out = { snapshot: null, holdings: [], complete: null, depth: null, dropped: {} };
  for (const e of log) {
    const rule = RULES.find((r) => r.re.test(e.sql));
    if (!rule) throw new Error(`unrecognised statement from storeHoldings: ${e.sql}`);
    if (rule.act === 'refuse') throw new Error(`storeHoldings issued a coverage downgrade (${rule.id}); refusing`);
    if (rule.act.startsWith('drop')) { out.dropped[rule.id] = (out.dropped[rule.id] || 0) + 1; continue; }
    if (rule.act === 'snapshot') { if (out.snapshot) throw new Error('two snapshot writes'); out.snapshot = e.params; }
    if (rule.act === 'holding') { if (e.kind !== 'batch') throw new Error('holding insert outside batch'); out.holdings.push(e.params); }
    if (rule.act === 'complete') out.complete = e.params;
    if (rule.act === 'depth') out.depth = e.params;
  }
  if (!out.snapshot || !out.complete || !out.holdings.length) throw new Error('storeHoldings did not finish (no snapshot / complete / holdings)');
  return out;
}

export function noteFor(r) {
  return r.keyType === 'surrogate'
    ? `1940-Act UIT, files NPORT-P, no series id; surrogate key ${r.key}; loaded one-off by ${PACKET}`
    : `1940-Act fund, files NPORT-P under series id ${r.key}; loaded one-off by ${PACKET}`;
}

const isEq = (col, v) => `${col} IS ${sqlLit(v)}`;

// Builds the statements for one fund. Returns { apply: [{sql, expect}], rollback: [{sql, expect}], meta }.
export function planFund(r, idx, seed) {
  const c = classify(r.log);
  const [key, month] = c.complete;
  if (key !== r.key || month !== r.reportMonth) throw new Error('complete params mismatch');
  const prior = seed.etf_master.find((x) => x.ticker === r.fund.ticker);
  if (!prior) throw new Error(`no etf_master row for ${r.fund.ticker}`);
  if (prior.cik !== r.fund.etfMasterCik) throw new Error(`${r.fund.ticker}: etf_master cik ${prior.cik} ≠ expected ${r.fund.etfMasterCik}`);
  const idLo = ID_BASE + idx * ID_BLOCK + 1;
  const idHi = idLo + c.holdings.length - 1;
  if (c.holdings.length >= ID_BLOCK) throw new Error('id block too small');
  const snapGuard = `NOT EXISTS (SELECT 1 FROM fund_snapshot_monthly WHERE series_id = ${sqlLit(key)} AND report_month = ${sqlLit(month)})`;

  const apply = c.holdings.map((p, i) => {
    if (p[0] !== key || p[1] !== month) throw new Error('holding key mismatch');
    return {
      sql: `INSERT OR IGNORE INTO fund_holdings_monthly (id, ${HOLD_COLS.join(', ')}, snapshot_status) SELECT ${idLo + i}, ${p.map(sqlLit).join(', ')}, NULL WHERE ${snapGuard};`,
      expect: 1,
    };
  });
  apply.push({ sql: `UPDATE fund_holdings_monthly SET snapshot_status = 'complete' WHERE series_id = ${sqlLit(key)} AND report_month = ${sqlLit(month)} AND id BETWEEN ${idLo} AND ${idHi} AND snapshot_status IS NULL;`, expect: c.holdings.length });
  apply.push({ sql: `INSERT OR IGNORE INTO fund_snapshot_monthly (${SNAP_COLS.join(', ')}) VALUES (${c.snapshot.map(sqlLit).join(', ')});`, expect: 1 });

  const next = {
    cik: r.fund.cik, series_id: key, has_nport: 1, coverage_status: 'deep', notes: noteFor(r),
    coverage_depth: c.depth ? c.depth[0] : prior.coverage_depth,
  };
  const was = Object.fromEntries(ETF_COLS.map((k) => [k, prior[k]]));
  const guardWas = [`ticker = ${sqlLit(prior.ticker)}`, ...ETF_COLS.map((k) => isEq(k, was[k])), isEq('updated_at', prior.updated_at)].join(' AND ');
  const guardNext = [`ticker = ${sqlLit(prior.ticker)}`, ...ETF_COLS.map((k) => isEq(k, next[k])), isEq('updated_at', prior.updated_at)].join(' AND ');
  apply.push({ sql: `UPDATE etf_master SET ${ETF_COLS.map((k) => `${k} = ${sqlLit(next[k])}`).join(', ')} WHERE ${guardWas};`, expect: 1 });

  const rollback = [
    { sql: `UPDATE etf_master SET ${ETF_COLS.map((k) => `${k} = ${sqlLit(was[k])}`).join(', ')} WHERE ${guardNext};`, expect: 1 },
    { sql: `DELETE FROM fund_snapshot_monthly WHERE series_id = ${sqlLit(key)} AND report_month = ${sqlLit(month)} AND filing_date = ${sqlLit(c.snapshot[12])} AND holdings_count = ${c.holdings.length};`, expect: 1 },
    { sql: `DELETE FROM fund_holdings_monthly WHERE series_id = ${sqlLit(key)} AND report_month = ${sqlLit(month)} AND id BETWEEN ${idLo} AND ${idHi};`, expect: c.holdings.length },
  ];
  return {
    apply, rollback,
    meta: {
      ticker: r.fund.ticker, cik: r.fund.cik, etf_master_cik_before: prior.cik, key, key_type: r.keyType,
      accession: r.fund.accession, report_month: month, file_date: r.fund.fileDate,
      header: r.header, holdings: c.holdings.length, id_range: [idLo, idHi],
      net_assets: c.snapshot[3], coverage_depth: next.coverage_depth, dropped: c.dropped,
      etf_master_before: was, etf_master_after: next,
    },
  };
}

// Pack statements into batches ≤ BATCH_MAX without splitting a fund's closing trio
// (complete → snapshot → etf_master), which must run in order after that fund's inserts.
export function toBatches(stmts) {
  const batches = [];
  for (let i = 0; i < stmts.length; i += BATCH_MAX) batches.push(stmts.slice(i, i + BATCH_MAX));
  return batches;
}

export function renderFile(title, lines, batches) {
  const nStmts = batches.reduce((a, b) => a + b.length, 0);
  const out = [...title.map((t) => `-- ${t}`), `-- ${batches.length} batches, ${nStmts} statements. Stop on the first batch whose per-statement changes differ from its expected vector.`, ''];
  batches.forEach((b, i) => {
    out.push(`-- batch ${i + 1}: ${lines[i]}, ${b.length} statements, expected [${b.map((s) => s.expect).join(',')}]`);
    for (const s of b) out.push(s.sql);
    out.push('');
  });
  return out.join('\n');
}

export async function buildAll({ seed = JSON.parse(fs.readFileSync(PATHS.seed, 'utf8')), pipelineSrc = PATHS.pipeline, readXmlFn = readXml } = {}) {
  if (seed.c_prefix_series_ids.length) throw new Error('a C-prefixed series_id already exists in D1 — surrogate would collide');
  if (seed.fund_holdings_monthly_max_id >= ID_BASE) throw new Error('ID_BASE is not above D1 max(id)');
  const plans = [];
  for (const [i, f] of FUNDS.entries()) {
    const r = await recordFund(f, readXmlFn(f), seed, pipelineSrc);
    if (r.header.regCik && parseInt(r.header.regCik, 10) !== parseInt(f.cik, 10)) throw new Error(`${f.ticker}: header regCik ${r.header.regCik} ≠ ${f.cik}`);
    if (r.header.repPdDate && r.header.repPdDate !== f.period) throw new Error(`${f.ticker}: header repPdDate ${r.header.repPdDate} ≠ ${f.period}`);
    plans.push(planFund(r, i, seed));
  }
  const keys = plans.map((p) => p.meta.key);
  if (new Set(keys).size !== keys.length) throw new Error('duplicate keys');

  // Apply: per fund, inserts then closing trio; batches never mix funds.
  const applyBatches = [], applyLines = [];
  for (const p of plans) {
    const bs = toBatches(p.apply);
    bs.forEach((b, j) => { applyBatches.push(b); applyLines.push(`${p.meta.ticker} ${p.meta.key} ${p.meta.report_month} part ${j + 1}/${bs.length}`); });
  }
  // Rollback: etf_master first (route stops resolving), then snapshots, then holdings; then sqlite_sequence.
  const maxId = Math.max(...plans.map((p) => p.meta.id_range[1]));
  const rb = [
    ...plans.map((p) => p.rollback[0]),
    ...plans.map((p) => p.rollback[1]),
    ...plans.map((p) => p.rollback[2]),
  ];
  const rollbackBatches = [rb, [{ sql: `UPDATE sqlite_sequence SET seq = MAX((SELECT MAX(id) FROM fund_holdings_monthly), ${seed.sqlite_sequence_fund_holdings_monthly}) WHERE name = 'fund_holdings_monthly' AND seq = ${maxId};`, expect: 1 }]];
  const rollbackLines = ['etf_master restore ×4, snapshot delete ×4, holdings delete ×4', 'AUTOINCREMENT counter restore (optional: skip if D1 refuses writes to sqlite_sequence; no data effect)'];
  return { plans, applyBatches, applyLines, rollbackBatches, rollbackLines, maxId };
}

async function cmdFetch() {
  fs.mkdirSync(PATHS.cache, { recursive: true });
  const manifestPath = path.join(PATHS.cache, 'manifest.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  for (const f of FUNDS) {
    if (fs.existsSync(cacheFile(f))) { console.log(`cached  ${f.ticker} ${f.accession}`); continue; }
    const res = await fetch(xmlUrl(f), { headers: { 'User-Agent': SEC_UA } });
    if (!res.ok) throw new Error(`${f.ticker}: GET ${xmlUrl(f)} → ${res.status}`);
    const raw = Buffer.from(await res.arrayBuffer());
    if (!raw.subarray(0, 200).toString('utf8').includes('<?xml')) throw new Error(`${f.ticker}: response is not XML`);
    const gz = zlib.gzipSync(raw, { level: 9, mtime: 0 });
    fs.writeFileSync(cacheFile(f), gz);
    manifest[f.ticker] = { accession: f.accession, url: xmlUrl(f), fetched: new Date().toISOString(), bytes: raw.length, sha256_xml: sha256(raw), file: path.basename(cacheFile(f)), sha256_gz: sha256(gz) };
    console.log(`fetched ${f.ticker} ${f.accession} ${raw.length} bytes`);
    await new Promise((r) => setTimeout(r, 300));
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');
}

async function cmdBuild() {
  const manifest = JSON.parse(fs.readFileSync(path.join(PATHS.cache, 'manifest.json'), 'utf8'));
  for (const f of FUNDS) {
    const gz = fs.readFileSync(cacheFile(f));
    if (sha256(gz) !== manifest[f.ticker].sha256_gz) throw new Error(`${f.ticker}: cache sha256 mismatch`);
  }
  const b = await buildAll();
  fs.mkdirSync(PATHS.apply, { recursive: true });
  const applyPath = path.join(PATHS.apply, 'uit-apply-run1.sql');
  const rbPath = path.join(PATHS.apply, 'uit-rollback-run1.sql');
  const nHold = b.plans.reduce((a, p) => a + p.meta.holdings, 0);
  fs.writeFileSync(applyPath, renderFile([
    `${PACKET}.BUILD apply — run 1 of 1. NOT RUN by BUILD; for the release/apply packet after MA-NOV-UIT.REVIEW and the Founder's write approval.`,
    `Built by uit-nport-load.mjs from holdings-pipeline.js storeHoldings() via a recording D1 shim; before = D1 SELECTs 2026-11-27 (uit/seed/d1-before.json).`,
    `Writes: fund_holdings_monthly ${nHold} rows (explicit ids ${ID_BASE + 1}…${b.maxId}), fund_snapshot_monthly ${b.plans.length} rows, etf_master ${b.plans.length} rows updated. No holdings_pipeline_state writes.`,
    `Guards: inserts are INSERT OR IGNORE on the id PK and skip if the fund-month snapshot exists; mark-complete only touches NULL rows in the id range; etf_master update matches only the exact prior row. Re-apply = 0 changes.`,
  ], b.applyLines, b.applyBatches));
  fs.writeFileSync(rbPath, renderFile([
    `${PACKET}.BUILD rollback for uit-apply-run1.sql. Restores the exact prior etf_master values and deletes exactly the inserted rows (by id range).`,
  ], b.rollbackLines, b.rollbackBatches));
  const files = Object.fromEntries([applyPath, rbPath].map((p) => [path.basename(p), { bytes: fs.statSync(p).size, sha256: sha256(fs.readFileSync(p)) }]));
  const summary = {
    packet: `${PACKET}.BUILD`, built: new Date().toISOString(), pipeline_sha256: sha256(fs.readFileSync(PATHS.pipeline)),
    seed_sha256: sha256(fs.readFileSync(PATHS.seed)), cache_manifest: manifest,
    funds: b.plans.map((p) => p.meta),
    totals: { fund_holdings_monthly: nHold, fund_snapshot_monthly: b.plans.length, etf_master_updates: b.plans.length, apply_batches: b.applyBatches.length, apply_statements: b.applyBatches.reduce((a, x) => a + x.length, 0), rollback_batches: b.rollbackBatches.length, rollback_statements: b.rollbackBatches.reduce((a, x) => a + x.length, 0) },
    files,
  };
  fs.writeFileSync(path.join(PATHS.apply, 'uit-summary.json'), JSON.stringify(summary, null, 1) + '\n');
  console.log(JSON.stringify({ totals: summary.totals, funds: summary.funds.map((f) => [f.ticker, f.key, f.key_type, f.report_month, f.holdings, f.id_range.join('-')]), files }, null, 1));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const cmd = process.argv[2];
  if (cmd === 'fetch') await cmdFetch();
  else if (cmd === 'build') await cmdBuild();
  else { console.error('usage: uit-nport-load.mjs fetch|build'); process.exit(2); }
}
