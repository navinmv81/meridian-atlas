#!/usr/bin/env node
// MA-OCT-008 — SEC corporate-bond ingestion runner (spec rev 1.2 §7, §9, §12).
//
// Local, manual runner (D7). No cron, no LaunchAgent, no schedule.
//   node bonds-ingest.mjs --mode=initial|incremental [--dry-run] [--cik=0000731766[,…]]
//        [--cache-submissions] [--offline] [--operator=<name>]
//
// Dry run (§9.2): discovery, fetch and parse; writes the would-be SQL to
// state/dryrun-<date>.sql and the parsed filings to state/dryrun-<date>.json;
// 0 D1 calls, 0 heartbeats. Freeze windows are logged, not enforced.
//
// Live run, gates in §9.3 order: FREEZES.json + Tue–Fri (start and before every
// batch) → hold_all_jobs (one PK read) → pause flag → stop flag (before every
// batch) → headroom (d1-today, ML-1012-1 values from config) → declared budget.
// Writes are batched INSERT OR IGNORE through the pinned wrangler 4.96.0, one
// filing's rows always in one batch, ≤ 100 statements per batch (§7.5).

import { randomUUID } from 'node:crypto';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  LIMITS, SecCapError, SecRateError, D1Error, activeFreezes, appendJsonl, calendarGate, d1Transport, ensureDir, fetchD1Today,
  headroomDecision, liveConfigProblems, lit, loadConfig, loadFreezes, loadIngestConfig, ownWrites, pinnedWrangler, readJson,
  readJsonl, redact, secClient, sha256, sha256File, statePaths, utcDate, writeJsonAtomic, FREEZES_PATH, INGEST_ENV_DEFAULT
} from './bonds-lib.mjs';
import { discoverIssuer } from './bonds-discover.mjs';
import { PARSER_VERSION, htmlToText, normName, parseFiling } from './bonds-parse.mjs';

export const COLS = ['accession_number', 'tranche_seq', 'cik', 'instrument_key', 'isin', 'cusip', 'form_type', 'filing_date', 'filing_status',
  'tranche_label', 'security_class', 'rate_type', 'coupon_rate', 'spread_bps', 'benchmark', 'principal_amount', 'currency', 'maturity_date',
  'seniority', 'source_url', 'parse_confidence', 'parser_version', 'ingested_at'];
const METRIC_KEYS = ['final_tranches', 'preliminary', 'skipped_non_debt', 'skipped_structured', 'skipped_other', 'parse_failed', 'sec_requests',
  'sec_errors', 'batches', 'batches_retried', 'issuers_polled', 'links_reverified', 'links_unmatched'];

// §8.2 write cost per row (table + PK autoindex + partial indexes the row enters).
export const writeCost = r => (r.filing_status === 'final' ? (r.instrument_key ? 4 : 3) : 2);

export function insertSql(r) {
  return `INSERT OR IGNORE INTO bond_issuance (${COLS.join(', ')}) VALUES (${COLS.map(c => lit(r[c])).join(', ')})`;
}

// Filings → batches of ≤ max statements; a filing is never split (§7.5).
export function packBatches(filingRows, max = 100) {
  const out = [];
  let cur = { filings: [], rows: [] };
  for (const f of filingRows) {
    if (f.rows.length > max) throw new Error(`filing ${f.accession} has ${f.rows.length} rows (> ${max})`);
    if (cur.rows.length + f.rows.length > max) { out.push(cur); cur = { filings: [], rows: [] }; }
    cur.filings.push(f.accession); cur.rows.push(...f.rows);
  }
  if (cur.rows.length) out.push(cur);
  return out;
}

// FWPs of the same deal (§7.4): same issuer, same registration number, filed
// within `days` before the 424B (or the same day).
export function sameDealFwps(filing, fwps, days = 3) {
  const t = Date.parse(filing.filingDate + 'T00:00:00Z');
  return fwps.filter(x => x.fileNumber && x.fileNumber === filing.fileNumber
    && t - Date.parse(x.filingDate + 'T00:00:00Z') >= 0 && t - Date.parse(x.filingDate + 'T00:00:00Z') <= days * 86400000);
}

function parseArgs(argv) {
  const a = {};
  for (const s of argv) { const m = s.match(/^--([a-z-]+)(?:=(.*))?$/); if (m) a[m[1]] = m[2] === undefined ? true : m[2]; }
  return a;
}

const flag = (P, name) => existsSync(P[name]);

// ── Run ──────────────────────────────────────────────────────────────────

export async function run(args, deps = {}) {
  const P = deps.paths || statePaths();
  ensureDir(P.state);
  const cfg = deps.config || loadConfig();
  const now = deps.now || (() => new Date());
  const log = deps.log || (s => console.log(s));
  const dry = !!args['dry-run'];
  const mode = args.mode;
  if (!['initial', 'incremental'].includes(mode)) throw new Error('--mode=initial|incremental is required');
  const runId = randomUUID();
  const startedAt = now();
  const day = utcDate(startedAt);
  const metrics = Object.fromEntries(METRIC_KEYS.map(k => [k, 0]));
  const runLog = (kind, obj) => appendJsonl(P.runlog, { utc: now().toISOString(), run_id: runId, kind, mode, dry_run: dry, ...obj });

  // Freezes: hash always logged; a dry run lists the windows that would apply.
  let freezesSha = null, freezeNote = null;
  try { const fz = loadFreezes(deps.freezesPath || FREEZES_PATH); freezesSha = fz.sha256; freezeNote = activeFreezes(startedAt, fz); }
  catch (e) { freezeNote = `FREEZES.json unavailable: ${e.message}`; }
  runLog('run_start', { config_sha256: cfg.sha256, freezes_sha256: freezesSha, would_apply: freezeNote, parser_version: PARSER_VERSION, operator: args.operator || null, cik_filter: args.cik || null });

  // ── Live-only startup gates (§9.3 1–4, AC14, AC15) ──
  let d1 = null, hb = null, wranglerPin = null;
  const terminal = async (event, extra = {}) => {
    const evt = { v: 1, run_id: runId, job_id: cfg.job_id, event, trigger: 'manual', started_at: startedAt.toISOString(), ended_at: now().toISOString(),
      duration_ms: Math.max(0, now() - startedAt), ...extra, detail: { ...(extra.detail || {}), metrics } };
    runLog('run_end', { event, ...extra, metrics });
    if (hb) await hb.send(evt);
    return { event, ...extra, metrics, runId };
  };
  if (!dry) {
    const probs = liveConfigProblems(cfg);
    if (probs.length) { runLog('refused', { reason: `AC15: ${probs.join(', ')}` }); return { event: 'refused', reason: probs.join(', ') }; }
    hb = await heartbeats(cfg, P, deps, log);
    const cal = deps.calendarGate ? deps.calendarGate(startedAt) : calendarGate(startedAt, deps.freezesPath);
    if (!cal.ok) return terminal('skipped', { detail: { reason: 'out_of_window', ...(cal.detail === 'freezes_unavailable' ? { reason_detail: 'freezes_unavailable' } : { window: cal.detail }) } });
    wranglerPin = deps.d1 ? { path: 'injected', version: 'n/a' } : await pinnedWrangler();
    d1 = deps.d1 || d1Transport({ wrangler: wranglerPin.path, dbName: cfg.db_name, ledgerFile: P.d1Ledger });
    let hold = null;
    try {
      const [r] = await d1.query(`SELECT value FROM holdings_pipeline_state WHERE key = 'hold_all_jobs'`, 'hold_all_jobs');
      hold = r.results.length ? String(r.results[0].value) : null;
    } catch { hold = null; }
    if (hold === null || !['true', 'false'].includes(hold)) return terminal('skipped', { detail: { reason: 'hold', hold: 'unavailable' } });
    if (hold === 'true') return terminal('skipped', { detail: { reason: 'hold' } });
    if (flag(P, 'pause')) return terminal('skipped', { detail: { reason: 'pause' } });
    if (flag(P, 'stop')) return terminal('killed', { error: { class: 'operator_stop', summary: 'stop flag present at start' }, detail: { reason: 'operator_stop' } });
    if (hb) await hb.send({ v: 1, run_id: runId, job_id: cfg.job_id, event: 'start', trigger: 'manual', started_at: startedAt.toISOString(), detail: { mode } });
  }
  writeFileSync(P.pid, String(process.pid));

  // ── Issuers ──
  let issuers = cfg.issuers;
  if (args.cik) { const set = new Set(String(args.cik).split(',')); issuers = issuers.filter(i => set.has(i.cik)); }
  if (!dry) {
    // Active issuers from bond_issuer_link (PK reads); a paused issuer is not polled (A8-5).
    const ciks = issuers.map(i => lit(i.cik)).join(', ');
    const [r] = await d1.query(`SELECT cik, entity_id, link_method, status FROM bond_issuer_link WHERE cik IN (${ciks})`, 'issuers');
    const active = new Set(r.results.filter(x => x.status === 'active').map(x => x.cik));
    const missing = issuers.filter(i => !r.results.some(x => x.cik === i.cik)).map(i => i.cik);
    if (missing.length) return terminal('failed', { error: { class: 'link_missing', summary: `no bond_issuer_link row for ${missing.join(',')}` } });
    issuers = issuers.filter(i => active.has(i.cik));
  }

  const sec = deps.sec || secClient({ userAgent: process.env[cfg.sec.user_agent_env], minIntervalMs: cfg.sec.min_interval_ms,
    maxRequests: cfg.sec.max_requests_per_run, ledgerFile: P.secLedger, cacheDir: P.cache, cacheSubmissions: !!args['cache-submissions'], offline: !!args.offline });
  const ingestedAt = now().toISOString();
  const filingsOut = [];
  const coRegs = new Map();         // L8-12: normalised cover name → { name, cik, parent_cik, accessions, finals }
  let stopReason = null;
  const lookbackFor = () => cfg.lookback;   // incremental: same window; discovery skips stored accessions

  try {
    for (const iss of issuers) {
      const d = await discoverIssuer(sec, iss, { forms: cfg.forms, lookback: lookbackFor(iss), fwpWindowDays: cfg.fwp_window_days });
      metrics.issuers_polled++;
      if (!d.ok) { metrics.sec_errors++; runLog('issuer_error', { cik: iss.cik, error: d.error }); continue; }
      let known = new Set();
      if (!dry && d.filings.length) known = await knownAccessions(d1, d.filings.map(f => f.accessionNumber));
      const todo = d.filings.filter(f => !known.has(f.accessionNumber));
      runLog('discovery', { cik: iss.cik, sec_name: d.secName, pages: d.pages, oldest_recent: d.oldestRecent, filings: d.filings.length, new: todo.length, fwps: d.fwps.length });
      for (const f of [...todo].reverse()) {                                // oldest first, so the cursor moves forward in time
        const r = await sec.get(f.url);
        if (r.status !== 200 || !r.text) { metrics.sec_errors++; runLog('fetch_error', { accession: f.accessionNumber, status: r.status, error: r.error || null }); continue; }
        let res = parseFiling(f, r.text, { ingestedAt });
        const fwpUsed = [];
        if (res.fwpNeeded) {
          const fw = [];
          for (const x of sameDealFwps(f, d.fwps, cfg.fwp_window_days)) {
            const fr = await sec.get(x.url);
            if (fr.status === 200 && fr.text) { fw.push({ accessionNumber: x.accessionNumber, html: fr.text }); fwpUsed.push(x.accessionNumber); }
            else metrics.sec_errors++;
          }
          if (fw.length) res = parseFiling(f, r.text, { fwps: fw, ingestedAt });
        }
        // L8-12: tranches belong to the legal issuer on the cover, under its own CIK.
        let held = null, coCik = null;
        if (res.status === 'debt' && (res.coIssuers.length || res.guaranteed)) {
          const co = await resolveCoRegistrant(sec, f, res, coRegs, { dry, d1, maxIndex: cfg.co_registrant_index_max ?? 3 });
          if (co.held) held = co.held;
          else if (co.cik) { coCik = co.cik; for (const row of res.rows) row.cik = co.cik; }
        }
        if (!held) for (const row of res.rows) {
          if (row.filing_status === 'final') metrics.final_tranches++;
          else if (metrics[row.filing_status] !== undefined) metrics[row.filing_status]++;
        }
        const paths = {};
        for (const row of res.rows) if (row.filing_status === 'final') paths[row.path] = (paths[row.path] || 0) + 1;
        runLog('filing', { accession: f.accessionNumber, cik: iss.cik, row_cik: coCik || iss.cik, status: res.status, rule: res.rule, reason: res.reason || null,
          rows: res.rows.length, final_paths: paths, held });                // B-3 condition 4: the path of every final row
        filingsOut.push({ accession: f.accessionNumber, cik: iss.cik, issuer: iss.name, form: f.form, filing_date: f.filingDate, file_number: f.fileNumber,
          url: f.url, status: res.status, rule: res.rule, reason: res.reason || null, title: res.title, notes: res.notes, fwps: fwpUsed,
          co_issuers: res.coIssuers || [], row_cik: coCik, held, rows: res.rows });
      }
    }
  } catch (e) {
    if (e instanceof SecRateError) stopReason = { event: 'failed', error: { class: 'SEC_RATE', summary: e.message } };
    else if (e instanceof SecCapError) stopReason = { event: 'partial', detail: { reason: 'sec_request_cap' } };
    else throw e;
  }
  metrics.sec_requests = sec.count;

  const heldFilings = filingsOut.filter(f => f.held);
  const filingRows = filingsOut.filter(f => f.rows.length && !f.held).map(f => ({ accession: f.accession, rows: f.rows }));
  const batches = packBatches(filingRows, cfg.batch_max_statements);
  const estWrites = batches.reduce((a, b) => a + b.rows.reduce((x, r) => x + writeCost(r), 0), 0);

  // ── Dry run: write the would-be SQL and the parse record; no D1 ──
  if (dry) {
    const sqlFile = path.join(P.state, `dryrun-${day}.sql`);
    const jsonFile = path.join(P.state, `dryrun-${day}.json`);
    const parts = [`-- MA-OCT-008 dry run ${runId} ${startedAt.toISOString()} parser ${PARSER_VERSION}`,
      `-- ${batches.length} batches, ${filingRows.reduce((a, f) => a + f.rows.length, 0)} statements, est. writes ${estWrites} (§8.2 cost model). NOT EXECUTED.`];
    batches.forEach((b, i) => parts.push(`-- batch ${i + 1}: ${b.rows.length} statements, filings ${b.filings.join(' ')}, est. writes ${b.rows.reduce((x, r) => x + writeCost(r), 0)}`, ...b.rows.map(r => insertSql(r) + ';')));
    writeFileSync(sqlFile, parts.join('\n') + '\n');
    writeJsonAtomic(jsonFile, { run_id: runId, started_at: startedAt.toISOString(), mode, parser_version: PARSER_VERSION, config_sha256: cfg.sha256,
      freezes_sha256: freezesSha, would_apply: freezeNote, metrics, est_writes: estWrites, batches: batches.length,
      co_registrants: [...coRegs.values()], held: heldFilings.map(f => ({ accession: f.accession, cik: f.cik, reason: f.held, rows: f.rows.length })), filings: filingsOut });
    metrics.batches = batches.length;
    const out = await terminal(stopReason?.event || 'success', { ...(stopReason || {}), detail: { ...(stopReason?.detail || {}), dry_run: true, est_writes: estWrites, held_filings: heldFilings.length,
      sql_file: sqlFile, sql_sha256: sha256File(sqlFile), json_file: jsonFile, json_sha256: sha256File(jsonFile) },
      items_attempted: filingsOut.length, items_progressed: 0, rows_written: 0 });
    cleanupPid(P);
    return { ...out, sqlFile, jsonFile, filings: filingsOut, estWrites };
  }
  if (stopReason?.event === 'failed') { cleanupPid(P); return terminal('failed', stopReason); }

  // ── Live batches ──
  const declared = mode === 'initial' ? cfg.declared_writes.initial : Math.max(estWrites + 2 * issuers.length, 1);
  let written = 0, read = 0, progressed = 0;
  let cursor = readJson(P.cursor, { last_accession: null });
  const cursorBefore = cursor.last_accession;
  const limits = { accountCeiling: cfg.account_ceiling, unpolledWindowMs: cfg.unpolled_window_min * 60000, runCap: cfg.run_cap_writes };
  const end = (event, extra) => { cleanupPid(P); return terminal(event, { rows_written: written, rows_read: read, items_attempted: filingsOut.length,
    items_progressed: progressed, cursor: { before: String(cursorBefore || ''), after: String(cursor.last_accession || '') }, ...extra }); };

  for (const [i, b] of batches.entries()) {
    const bWrites = b.rows.reduce((x, r) => x + writeCost(r), 0);
    const cal = deps.calendarGate ? deps.calendarGate(now()) : calendarGate(now(), deps.freezesPath);
    if (!cal.ok) return end('partial', { detail: { reason: 'out_of_window', window: cal.detail } });
    if (flag(P, 'pause')) return end('partial', { detail: { reason: 'pause' } });
    if (flag(P, 'stop')) return end('killed', { error: { class: 'operator_stop', summary: 'stop flag' }, detail: { reason: 'operator_stop' } });
    let reading = null, fetchError = null;
    try { reading = await (deps.fetchD1Today || fetchD1Today)({ now }); } catch (e) { fetchError = e.message; }
    const st = readJson(P.headroom, {});
    const dec = headroomDecision({ reading, fetchError, now: now(), state: st, batchWrites: bWrites + LIMITS.eventRowWrites, own: ownWrites(P, now()), limits });
    writeJsonAtomic(P.headroom, dec.nextState);
    runLog('headroom', { batch: i + 1, ok: dec.ok, reason: dec.reason || null, detail: dec.detail, reading });
    if (!dec.ok) return end('partial', { detail: { reason: dec.reason, why: dec.detail } });
    if (written + bWrites > cfg.budget_overrun_factor * declared) return end('partial', { detail: { reason: 'budget', declared, written } });

    const file = path.join(P.batches, `${day}-${runId.slice(0, 8)}-b${String(i + 1).padStart(3, '0')}.sql`);
    ensureDir(P.batches);
    writeFileSync(file, `-- run ${runId} batch ${i + 1}/${batches.length}: ${b.rows.length} statements, declared writes ${bWrites}\n` + b.rows.map(r => insertSql(r) + ';').join('\n') + '\n');
    let res, attempts = 0;
    for (;;) {
      attempts++;
      try { res = await d1.execFile(file, `batch ${i + 1}`); break; }
      catch (e) {
        if (attempts === 1 && e instanceof D1Error && e.code === '10000') { metrics.batches_retried++; await (deps.sleep || (ms => new Promise(r => setTimeout(r, ms))))(LIMITS.cfRetryDelayMs); continue; }
        runLog('batch', { batch: i + 1, file, file_sha256: sha256File(file), writes: 0, outcome: 'failed', error: redact(e.message).slice(0, 300) });
        return end('failed', { error: { class: e.code === '10000' ? 'CF_API_10000' : 'D1_ERROR', summary: redact(e.message).slice(0, 300) } });
      }
    }
    // N8-2: wrangler --file may not report rows_written per batch; then the declared count is used and flagged.
    const measured = res.reduce((a, r) => a + (Number.isInteger(r.meta?.rows_written) ? r.meta.rows_written : 0), 0);
    const hasMeta = res.some(r => Number.isInteger(r.meta?.rows_written));
    const w = hasMeta ? measured : bWrites;
    written += w; read += res.reduce((a, r) => a + (r.meta?.rows_read || 0), 0);
    progressed += b.filings.length;
    metrics.batches++;
    cursor = { last_accession: b.filings[b.filings.length - 1], run_id: runId, utc: now().toISOString() };
    writeJsonAtomic(P.cursor, cursor);
    runLog('batch', { batch: i + 1, file, file_sha256: sha256File(file), statements: b.rows.length, declared_writes: bWrites, writes: w,
      writes_basis: hasMeta ? 'wrangler meta.rows_written' : 'declared (N8-2: no per-batch meta)', attempts, filings: b.filings });
  }

  // last_polled_at for every issuer polled (L8-3, P1).
  if (issuers.length) {
    const ts = lit(now().toISOString());
    const upd = issuers.map(i => `UPDATE bond_issuer_link SET last_polled_at = ${ts} WHERE cik = ${lit(i.cik)}`);
    const file = path.join(P.batches, `${day}-${runId.slice(0, 8)}-polled.sql`);
    writeFileSync(file, upd.map(s => s + ';').join('\n') + '\n');
    try { const res = await d1.execFile(file, 'last_polled_at'); written += res.reduce((a, r) => a + (r.meta?.rows_written || 0), 0); }
    catch (e) { runLog('polled_error', { error: redact(e.message).slice(0, 300) }); }
  }
  return end(stopReason?.event || 'success', stopReason || {});
}

// EDGAR filing index: every filer on the accession, as { name, cik }.
export function parseFilingIndex(html) {
  const out = [];
  // EDGAR markup: <span class="companyName">NAME (Filer) <acronym>CIK</acronym>: <a …>0000794447 …</a>
  for (const m of String(html).matchAll(/class="companyName"[^>]*>\s*([^<(]+?)\s*\((?:Filer|Subject|Filed by)\)[\s\S]{0,300}?(\d{10})/g)) {
    const name = htmlToText(m[1]).trim();
    if (!out.some(x => x.cik === m[2])) out.push({ name, cik: m[2] });
  }
  return out;
}
export const indexUrl = (cik, acc) => `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${acc.replace(/-/g, '')}/${acc}-index.htm`;

// L8-12. Returns { cik } for a single named co-registrant whose CIK is on the
// filing's own EDGAR index, or { held } with the reason (never the parent's CIK):
//   mixed cover (≥ 2 issuer names) · guarantee without a named issuer · name not on
//   the index · index unavailable or the ≤ 3-request budget spent · (live) no
//   bond_issuer_link row for that CIK yet.
async function resolveCoRegistrant(sec, f, res, coRegs, { dry, d1, maxIndex }) {
  if (res.coIssuers.length > 1) return { held: `mixed cover: ${res.coIssuers.join(' / ')}` };
  if (!res.coIssuers.length) return { held: 'guaranteed by the parent but no co-registrant issuer named on the cover' };
  const name = res.coIssuers[0];
  const key = normName(name);
  let e = coRegs.get(key);
  if (!e) {
    e = { name, cik: null, parent_cik: f.cik, accessions: [], finals: 0, index_from: null, status: 'paused' };
    coRegs.set(key, e);
    const fetched = [...coRegs.values()].filter(x => x.index_from).length;
    if (fetched >= maxIndex) return { held: `co-registrant CIK unknown (index budget ${maxIndex} spent)` };
    const r = await sec.get(indexUrl(f.cik, f.accessionNumber));
    e.index_from = f.accessionNumber;
    if (r.status === 200 && r.text) {
      const filers = parseFilingIndex(r.text);
      const hit = filers.filter(x => x.cik !== f.cik && normName(x.name) === key);
      if (hit.length === 1) { e.cik = hit[0].cik; e.sec_name = hit[0].name; }
      e.filers = filers;
    }
  }
  if (!e.cik) return { held: `co-registrant CIK not established for "${name}" (EDGAR index of ${e.index_from})` };
  if (!dry) {
    const [r] = await d1.query(`SELECT cik, status FROM bond_issuer_link WHERE cik = ${lit(e.cik)}`, 'co-registrant link');
    if (!r.results.length) return { held: `no bond_issuer_link row for co-registrant ${e.cik} (${name})` };
  }
  e.accessions.push(f.accessionNumber);
  e.finals += res.rows.filter(x => x.filing_status === 'final').length;
  return { cik: e.cik };
}

async function knownAccessions(d1, accessions) {
  const known = new Set();
  for (let i = 0; i < accessions.length; i += 100) {
    const list = accessions.slice(i, i + 100).map(lit).join(', ');
    const [r] = await d1.query(`SELECT DISTINCT accession_number FROM bond_issuance WHERE accession_number IN (${list})`, 'accession probe');
    for (const x of r.results) known.add(x.accession_number);
  }
  return known;
}

async function heartbeats(cfg, P, deps, log) {
  if (deps.heartbeats !== undefined) return deps.heartbeats;
  const { cfg: ic, why } = loadIngestConfig(process.env.BONDS_INGEST_ENV || INGEST_ENV_DEFAULT);
  if (!ic) { log(`heartbeats off: ${why}; the run log is the record (Ops reconciles, §9.4)`); return null; }
  const { createOpsOutbox } = await import('../lib/ops-outbox.mjs');
  const ob = createOpsOutbox({ outboxDir: P.outbox, name: 'bonds-ingest', cfg: ic, log: t => appendJsonl(P.heartbeatLog, { utc: new Date().toISOString(), text: redact(t) }) });
  return {
    async send(evt) {
      const r = await ob.send(evt, { ceilingMs: 2000 });
      let replayed = 0;
      if (r.delivered) replayed = (await ob.replay({ max: 10, ceilingMs: 2000 })).replayed || 0;
      else if (r.spoolable) ob.spool(r.body);
      const delivered = (r.delivered ? 1 : 0) + replayed;
      if (delivered) appendJsonl(P.events, { utc: new Date().toISOString(), run_id: evt.run_id, event: evt.event, delivered });
    }
  };
}

function cleanupPid(P) { try { if (existsSync(P.pid)) unlinkSync(P.pid); } catch { /* ignore */ } }

// ── CLI ──────────────────────────────────────────────────────────────────

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const args = parseArgs(process.argv.slice(2));
  let stopping = false;
  process.on('SIGTERM', () => { stopping = true; try { writeFileSync(statePaths().stop, `SIGTERM ${new Date().toISOString()}\n`); } catch { /* ignore */ } });
  run(args).then(r => {
    const { filings, ...rest } = r;
    console.log(JSON.stringify(rest, null, 1));
    process.exit(['success', 'partial', 'skipped'].includes(r.event) ? 0 : 1);
  }).catch(e => { console.error(redact(e.stack || e.message)); process.exit(2); });
}
