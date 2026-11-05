#!/usr/bin/env node
// merge-013.mjs — MA-OCT-013 KI 22.41 duplicate-entity merge runner (spec rev 1
// e6dc85677278ef672c47a73c021395c6d1f65146b661d426a411f51cae57f098, §6, §9–§11, §15, §17).
// Always started through scripts/merge-013.sh, which sources ~/MeridianAtlas-work/merge-013/013.env.
//
//   export   --out <dir>                       read-only plan-time export (entity_master keyset + child probes, §5.5)
//   plan     --export <dir> --out <dir> [--signatures <file>] [--r-expected 62|none]
//   build-replica --export <dir> --out <db>    local SQLite replica (dry run, tests)
//   migrate                                    CREATE TABLE IF NOT EXISTS entity_merge_redirect (§6.1)
//   run      --plan <dir> --operator <name> [--pilot-ok <name>] [--until Bnn] [--max-batches n]
//   readback --plan <dir> --batch Bnn
//   restore  --plan <dir> --batch Bnn | --all  (§11 order; same-day per batch)
//   lei      --plan <dir> --operator <name>    step 7, the (iii) LEIs (≤ 3 GLEIF freshness calls first)
//   verify   --plan <dir>                      §10 post-run checks (reads)
//   recon    --date YYYY-MM-DD                 R-4 run-log reconciliation export (reads ops_job_run)
//
// Common: --transport remote | local:<db>. Local-only aids (refused on remote): --clock <ISO>, --assume-account <n>, --no-ops-gates.

import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, linkSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendRunLog, assertReadOnly, D1Error, D1_TODAY_URL, DB_NAME, ensureDir, fetchD1Today, heartbeatFor, lit, loadIngestConfig, readJson,
  readJsonl, redact, sha256, stableStringify, utcDate, WRANGLER_PATH, writeJsonAtomic
} from '../lib/gleif-reconcile-011-core.mjs';
import {
  BOOST_EVENING_FROM, BOOST_JOB_ID, budgetDecision, buildPlan, calendar013, canonicalPlan, checkStatement, classifyReadback, COST,
  DEFAULT_WORK_DIR, EMITTER, EXPECTED_MAX_DURATION_S, INDEX_QUERY, indexPrecondition, JOB_ID, LIMITS_013, loadSeedNormalizeName, mergeCost, NINE,
  PACKET, parseSignatures, PAUSE_FLAG_NAME, remainderOf, renderLei, renderMerge, renderRestore, STOP_FLAG_NAME, writeAllowed
} from '../lib/merge-013-core.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CORP_DIR = path.resolve(SCRIPT_DIR, '..');
const REPO = path.resolve(CORP_DIR, '..', '..');
const FREEZES_PATH = path.join(REPO, 'claude', 'relays', 'FREEZES.json');
const WRANGLER_CONFIG = path.join(CORP_DIR, 'wrangler-entities-enrich.toml');
const SEED_SRC = path.join(CORP_DIR, 'src', 'entities-seed.js');
const MIGRATION = path.join(CORP_DIR, 'migrations', 'ma-oct-013-entity-merge-redirect.sql');
const SPEC1 = path.join(path.dirname(DEFAULT_WORK_DIR), 'ma-oct-013', 'spec1');
const HANDOFF = path.join(path.dirname(DEFAULT_WORK_DIR), 'gleif-011', 'plans', 'release-2026-10-16', 'handoff-013.json');
export const PAUSE_FLAG = path.join(CORP_DIR, PAUSE_FLAG_NAME);
export const STOP_FLAG = path.join(CORP_DIR, STOP_FLAG_NAME);
const CHUNK = 400;   // IN-list size for indexed probes

// ── Env (Ops M-2): the .sh wrapper sources 013.env; the runner re-checks it ──

export function envCheck(env = process.env) {
  const work = env.MERGE013_WORK_DIR, job = env.MERGE013_JOB_ID;
  if (!work || !job) throw new Error('refused: MERGE013_WORK_DIR / MERGE013_JOB_ID not set — start through scripts/merge-013.sh (013.env)');
  if (job !== JOB_ID) throw new Error(`refused: MERGE013_JOB_ID must be ${JOB_ID}`);
  if (/gleif-011|gleif-a2/.test(work)) throw new Error(`refused: work dir ${work} belongs to 011 / A2`);
  return { work, job };
}

export function workPaths(work) {
  const j = (...p) => path.join(work, ...p);
  return { work, runlog: j('runlog.jsonl'), events: j('events.jsonl'), ledger: j('d1-ledger.jsonl'), headroom: j('headroom-state.json'),
    checkpoints: j('checkpoints'), preimages: j('preimages'), readbacks: j('readbacks'), recon: j('recon'), outbox: j('outbox'),
    ingestEnv: j('ops-ingest.env'), pid: j('runner.pid'), heartbeatLog: j('heartbeat.log'), gate: j('gate.jsonl'), remainder: j('remainder.json'),
    leiState: j('lei.json') };
}

export function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x.startsWith('--')) { const k = x.slice(2); const nx = argv[i + 1]; if (nx === undefined || nx.startsWith('--')) a[k] = true; else { a[k] = nx; i++; } }
    else a._.push(x);
  }
  return a;
}

// ── Transports: every statement passes the 013 allow-list (§6.4) ─────────

const READ_RE = /^\s*(SELECT|EXPLAIN|WITH)\b/i;
const sumMeta = (rs, k) => rs.reduce((a, r) => a + (r.meta?.[k] || 0), 0);

export function remoteTransport({ readOnly = true, ledger = null, timeoutMs = 300000 } = {}) {
  return {
    name: readOnly ? 'remote-ro' : 'remote-rw', readOnly,
    async exec(statements, { label = 'query' } = {}) {
      if (!statements.length) return [];
      for (const s of statements) { if (readOnly) assertReadOnly(s); checkStatement(s); }
      const sqlText = statements.join(';\n') + ';';
      const started = new Date();
      const out = await new Promise((resolve, reject) => {
        execFile(WRANGLER_PATH, ['d1', 'execute', DB_NAME, '--remote', '--json', '-c', WRANGLER_CONFIG, '--command', sqlText],
          { cwd: CORP_DIR, maxBuffer: 1024 * 1024 * 64, timeout: timeoutMs, encoding: 'utf8', detached: true },
          (err, stdout, stderr) => {
            if (err) { const text = `${stdout || ''}\n${stderr || ''}`; reject(new D1Error(`wrangler d1 execute failed (${label}): ${redact(text.replace(/\s+/g, ' ').slice(0, 400))}`, { code: (text.match(/code[:\s]+(\d{4,5})/i) || [])[1] || null })); }
            else resolve(stdout);
          });
      });
      let parsed;
      try { const i = out.search(/[[{]/); parsed = JSON.parse(i >= 0 ? out.slice(i) : out); } catch { throw new D1Error(`wrangler output unparseable (${label})`); }
      if (!Array.isArray(parsed)) parsed = [parsed];
      const results = parsed.map(p => ({ results: p.results || [], meta: p.meta || {} }));
      if (readOnly && sumMeta(results, 'rows_written') > 0) throw new D1Error(`WRITE DETECTED on a read-only call (${label})`, { ambiguous: false });
      if (ledger) ledger({ label, ts: started.toISOString(), statements: statements.length, rows_read: sumMeta(results, 'rows_read'), rows_written: sumMeta(results, 'rows_written'), sql_sha256: sha256(sqlText) });
      return results;
    }
  };
}

// Local replica (dry run, tests). A multi-statement call is one transaction, as a D1 batch is.
export async function localTransport(dbPath, { readOnly = false } = {}) {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(dbPath, { readOnly });
  return {
    name: readOnly ? 'local-ro' : 'local-rw', readOnly, db,
    async exec(statements) {
      for (const s of statements) { if (readOnly) assertReadOnly(s); checkStatement(s); }
      const write = statements.some(s => !READ_RE.test(s));
      if (write) db.exec('BEGIN');
      try {
        const out = statements.map(sql => {
          if (READ_RE.test(sql)) { const rows = db.prepare(sql).all(); return { results: rows.map(r => ({ ...r })), meta: { rows_read: rows.length, rows_written: 0, changes: 0, local: true } }; }
          const r = db.prepare(sql).run();
          return { results: [], meta: { rows_read: 0, rows_written: Number(r.changes), changes: Number(r.changes), local: true } };
        });
        if (write) db.exec('COMMIT');
        return out;
      } catch (e) { if (write) db.exec('ROLLBACK'); throw new D1Error(`local exec failed: ${e.message}`, { ambiguous: false }); }
    },
    close() { db.close(); }
  };
}

// ── Context ──────────────────────────────────────────────────────────────

export async function makeContext(args, overrides = {}) {
  const work = overrides.work || args.work || envCheck(overrides.env || process.env).work;
  const paths = workPaths(work);
  ensureDir(paths.work);
  const tspec = args.transport || 'remote';
  const local = tspec.startsWith('local:');
  for (const k of ['clock', 'assume-account', 'no-ops-gates']) if (args[k] !== undefined && !local) throw new Error(`--${k} is allowed only with a local transport`);
  let d1 = overrides.transport;
  if (!d1) d1 = local ? await localTransport(tspec.slice(6), { readOnly: !overrides.write }) : remoteTransport({ readOnly: !overrides.write, ledger: e => appendJsonl(paths.ledger, e) });
  const t0 = Date.now(), clock0 = args.clock ? Date.parse(args.clock) : null;
  const ctx = {
    args, paths, d1, local,
    now: overrides.now || (clock0 ? () => new Date(clock0 + (Date.now() - t0)) : () => new Date()),
    fetchImpl: overrides.fetchImpl || fetch,
    pauseFlag: overrides.pauseFlag || PAUSE_FLAG, stopFlag: overrides.stopFlag || STOP_FLAG,
    freezesPath: overrides.freezesPath || FREEZES_PATH,
    log: overrides.log || (s => console.log(s)), stopRequested: false, operator: args.operator || null,
    // B-1 (d): backoff between the tries of an idempotent post-execute read (≥ 3 retries)
    retryDelays: overrides.retryDelays || READ_RETRY_DELAYS_MS, sleep: overrides.sleep || (ms => new Promise(r => setTimeout(r, ms)))
  };
  await setupHeartbeats(ctx, overrides);
  return ctx;
}

function appendJsonl(file, obj) { ensureDir(path.dirname(file)); writeFileSync(file, JSON.stringify(obj) + '\n', { flag: 'a' }); }
const gateLog = (ctx, text) => { appendJsonl(ctx.paths.gate, { utc: ctx.now().toISOString(), text }); ctx.log(text); };
const q = async (ctx, sql, label) => (await ctx.d1.exec([sql], { label }))[0].results;
const chunks = (a, n = CHUNK) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const isMissingTable = e => /no such table/i.test(String(e?.message || e));

// ── B-1: write-once rollback inputs, provisional checkpoint, bounded read retry ──

export const READ_RETRY_DELAYS_MS = [2000, 5000, 10000];   // 1 try + 3 retries
export const DO_NOT_RERUN = 'do not re-run: `merge-013.sh status` → `merge-013.sh readback --plan <P> --batch <id>` → Operations Lead (restore works from the checkpoint)';

// Exclusive and atomic: the file appears whole or not at all, and never replaces an existing one (EEXIST).
export function writeOnce(file, text) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp-${process.pid}-${randomUUID().slice(0, 8)}`;
  writeFileSync(tmp, text, { flag: 'wx' });
  try { linkSync(tmp, file); } finally { unlinkSync(tmp); }
}

export function batchFiles(ctx, sha, id) {
  const tag = `${id}-${sha.slice(0, 12)}`;
  return { preimage: path.join(ctx.paths.preimages, `preimage-${tag}.json`), provisional: path.join(ctx.paths.checkpoints, `${tag}.provisional.json`),
           final: path.join(ctx.paths.checkpoints, `${tag}.json`) };
}

// Idempotent reads only. Allow-list refusals are never retried.
export async function retryRead(ctx, label, fn) {
  const delays = ctx.retryDelays || READ_RETRY_DELAYS_MS;
  let last;
  for (let i = 0; i <= delays.length; i++) {
    try { return await fn(); } catch (e) {
      last = e;
      if (/exec_refused/.test(String(e?.message))) throw e;
      if (i < delays.length) { gateLog(ctx, `read ${label} failed (try ${i + 1}/${delays.length + 1}): ${redact(String(e?.message || e)).slice(0, 160)}; retrying in ${delays[i]} ms`); await ctx.sleep(delays[i]); }
    }
  }
  throw last;
}

// ── Heartbeats (Ops M-1): job manual.entity-merge-013, emitter merge-013 ───

async function setupHeartbeats(ctx, overrides) {
  let { cfg, why } = overrides.ingestCfg !== undefined ? { cfg: overrides.ingestCfg, why: overrides.ingestCfg ? null : 'disabled' } : loadIngestConfig(ctx.paths.ingestEnv);
  if (cfg && cfg.emitter !== EMITTER) { why = `ops-ingest.env emitter is ${cfg.emitter}, not ${EMITTER}; not used`; cfg = null; }
  ctx.ingestWhy = why;
  ctx.hbLog = text => appendJsonl(ctx.paths.heartbeatLog, { utc: new Date().toISOString(), text: redact(text) });
  ctx.outbox = null;
  if (!cfg) return;
  try {
    const mod = overrides.outboxModule || await import('../lib/ops-outbox.mjs');
    ctx.outbox = mod.createOpsOutbox({ outboxDir: ctx.paths.outbox, name: EMITTER, cfg, log: ctx.hbLog });
  } catch { ctx.outbox = null; ctx.ingestWhy = 'outbox module absent'; }
}

export function eventFor(ctx, run, event, extra = {}) {
  const now = ctx.now();
  const evt = { v: 1, run_id: run.id, job_id: JOB_ID, event, trigger: 'manual', started_at: run.startedAt.toISOString() };
  if (event !== 'start') { evt.ended_at = now.toISOString(); evt.duration_ms = Math.max(0, now - run.startedAt); }
  for (const k of ['rows_read', 'rows_written', 'items_attempted', 'items_progressed']) if (Number.isInteger(extra[k])) evt[k] = extra[k];
  if (extra.error) evt.error = extra.error;
  evt.detail = { packet: PACKET, emitter: EMITTER, batch: run.batch, expected_max_duration_s: EXPECTED_MAX_DURATION_S, ...(extra.detail || {}) };
  return evt;
}

async function sendEvent(ctx, evt) {
  ctx.hbLog(`${evt.event} ${JSON.stringify(evt)}`);
  if (!ctx.outbox) return { delivered: false };
  try {
    const r = await ctx.outbox.send(evt, { ceilingMs: 2000 });
    if (!r.delivered && r.spoolable) ctx.outbox.spool(evt);
    if (r.delivered) { appendJsonl(ctx.paths.events, { utc: ctx.now().toISOString(), run_id: evt.run_id, event: evt.event, delivered: 1 }); await ctx.outbox.replay({ max: 10, ceilingMs: 2000 }); }
    return { delivered: !!r.delivered };
  } catch { return { delivered: false }; }
}

// Run-log line first (record of truth), then the mapped heartbeat.
async function report(ctx, run, outcome, { rows = 0, writes = 0, reads = null, cursor = null, extra = {}, error = null } = {}) {
  appendRunLog(ctx.paths.runlog, { run_key: run.id, step: 'merge', batch: run.batch, rows, writes, cursor, outcome, utc: ctx.now().toISOString(), operator: ctx.operator, transport: ctx.d1.name, ...extra });
  const hb = heartbeatFor(outcome);
  const ev = { rows_written: writes, rows_read: Number.isInteger(reads) ? reads : undefined, items_attempted: extra.attempted, items_progressed: extra.merged,
               detail: { outcome, ...(hb.reason ? { reason: hb.reason } : {}) } };
  if (hb.event === 'failed' || hb.event === 'killed' || hb.errorClass) ev.error = error || { class: hb.errorClass || outcome, summary: String(extra.reason || outcome).slice(0, 400) };
  return sendEvent(ctx, eventFor(ctx, run, hb.event, ev));
}

// ── export (§5.5): read-only, indexed paths and keyset pages only ─────────

export async function cmdExport(ctx) {
  const out = ctx.args.out; if (!out) throw new Error('export: --out <dir> required');
  ensureDir(out);
  const measured = JSON.parse(readFileSync(ctx.args.measured || path.join(SPEC1, 'plan-rev1.json'), 'utf8'));
  const cand = [...measured.run_default, ...measured.sign_eligible];
  const dups = [...new Set(cand.map(c => Number(c.dup)))];
  const files = {};
  const put = (name, obj) => { const text = typeof obj === 'string' ? obj : JSON.stringify(obj); writeFileSync(path.join(out, name), text); files[name] = sha256(text); };
  // catalog: indexes (precondition) and the DDL of every table the replica needs
  put('indexes.json', await q(ctx, INDEX_QUERY, 'indexes'));
  put('schema.json', await q(ctx, `SELECT type, name, tbl_name, sql FROM sqlite_master WHERE tbl_name IN ('entity_master','entity_enrichment_queue','instrument_entity_map','entity_relationships','entity_isin_map','entity_exposure_monthly','bond_issuer_link','fund_entity_link','managerissuerpositionquarterly','issuereventstream','issuerperiodsummary','financialfact_reported','entity_merge_redirect','holdings_pipeline_state','ops_job_pause','ops_job_run','ops_data_quality_ticket') AND sql IS NOT NULL ORDER BY type DESC, name`, 'schema'));
  // entity_master keyset export (≤ 5,000 rows per page), cik included (§5.5 item 1)
  const em = []; let last = 0;
  for (;;) {
    const page = await q(ctx, `SELECT * FROM entity_master WHERE entity_id > ${lit(last)} ORDER BY entity_id LIMIT 5000`, `em>${last}`);
    em.push(...page); if (page.length < 5000) break; last = page[page.length - 1].entity_id;
    if (ctx.stopRequested) throw new Error('export stopped');
  }
  put('em.jsonl', em.map(r => JSON.stringify(r)).join('\n') + '\n');
  const rows = {};
  const probe = async (key, mk) => { rows[key] = []; for (const c of chunks(dups)) rows[key].push(...await q(ctx, mk(c.map(lit).join(', ')), key)); };
  await probe('iem', ids => `SELECT * FROM instrument_entity_map WHERE entity_id IN (${ids})`);
  await probe('queue', ids => `SELECT * FROM entity_enrichment_queue WHERE entity_id IN (${ids})`);
  await probe('rel_child', ids => `SELECT * FROM entity_relationships WHERE child_entity_id IN (${ids})`);
  await probe('rel_parent', ids => `SELECT * FROM entity_relationships WHERE parent_entity_id IN (${ids})`);
  await probe('isin', ids => `SELECT * FROM entity_isin_map WHERE entity_id IN (${ids})`);
  await probe('exp_entity', ids => `SELECT entity_id, holder_entity_id, report_month FROM entity_exposure_monthly WHERE entity_id IN (${ids})`);
  await probe('exp_holder', ids => `SELECT entity_id, holder_entity_id, report_month FROM entity_exposure_monthly WHERE holder_entity_id IN (${ids})`);
  await probe('bil', ids => `SELECT * FROM bond_issuer_link WHERE entity_id IN (${ids})`);
  await probe('mqp', ids => `SELECT entity_id, COUNT(*) AS n FROM managerissuerpositionquarterly WHERE entity_id IN (${ids}) GROUP BY entity_id`);
  await probe('ies', ids => `SELECT entity_id, COUNT(*) AS n FROM issuereventstream WHERE entity_id IN (${ids}) GROUP BY entity_id`);
  await probe('ips', ids => `SELECT entity_id, COUNT(*) AS n FROM issuerperiodsummary WHERE entity_id IN (${ids}) GROUP BY entity_id`);
  // facts: by the duplicates' cik on idx_financialfact_cik_tag (no entity_id index), bounded per cik
  const emById = new Map(em.map(r => [Number(r.entity_id), r]));
  const dupCiks = [...new Set(dups.map(d => emById.get(d)?.cik).filter(Boolean))];
  rows.facts = [];
  for (const c of chunks(dupCiks, 50)) rows.facts.push(...await q(ctx, `SELECT entity_id, cik, COUNT(*) AS n FROM financialfact_reported WHERE cik IN (${c.map(lit).join(', ')}) AND entity_id IN (${dups.map(lit).join(', ')}) GROUP BY entity_id, cik`, 'facts'));
  rows.fel = await q(ctx, `SELECT entity_id FROM fund_entity_link`, 'fel');          // the declared 264-row scan (§6.3)
  try { rows.redirects = await q(ctx, `SELECT duplicate_id, survivor_id, merged_at, packet FROM entity_merge_redirect`, 'redirects'); }
  catch (e) { if (!isMissingTable(e)) throw e; rows.redirects = []; }
  rows.do_not_merge = await q(ctx, `SELECT case_ref, object_key, object_ref FROM ops_data_quality_ticket WHERE ticket_type = 'entity_merge' AND status <> 'open' AND disposition = 'do_not_merge'`, 'dnm');
  put('children.json', rows);
  const manifest = { packet: PACKET, utc: ctx.now().toISOString(), transport: ctx.d1.name, em_rows: em.length, dups: dups.length,
    counts: Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, v.length])), files };
  writeJsonAtomic(path.join(out, 'manifest.json'), manifest);
  return { out, em_rows: em.length, counts: manifest.counts };
}

// ids in do_not_merge tickets (object_key plus every id in object_ref.source_ref)
export function doNotMergeIds(rows) {
  const ids = new Set();
  for (const r of rows || []) {
    if (/^\d+$/.test(String(r.object_key || ''))) ids.add(Number(r.object_key));
    let ref = r.object_ref; try { ref = typeof ref === 'string' ? JSON.parse(ref) : ref; } catch { ref = null; }
    const s = ref?.source_ref ?? ref; const walk = v => { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') Object.values(v).forEach(walk); else if (/^\d+$/.test(String(v ?? ''))) ids.add(Number(v)); };
    if (s && typeof s === 'object') for (const [k, v] of Object.entries(s)) if (/entity_id/.test(k)) walk(v);
  }
  return ids;
}

// ── plan (§5, §6, §9) ────────────────────────────────────────────────────

export function loadExport(dir) {
  const man = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  for (const [f, h] of Object.entries(man.files)) if (sha256(readFileSync(path.join(dir, f), 'utf8')) !== h) throw new Error(`export file ${f}: SHA mismatch`);
  const em = new Map(readFileSync(path.join(dir, 'em.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => { const r = JSON.parse(l); return [Number(r.entity_id), r]; }));
  return { man, em, ch: JSON.parse(readFileSync(path.join(dir, 'children.json'), 'utf8')), indexes: JSON.parse(readFileSync(path.join(dir, 'indexes.json'), 'utf8')),
           schema: JSON.parse(readFileSync(path.join(dir, 'schema.json'), 'utf8')) };
}

export async function cmdPlan(ctx) {
  const out = ctx.args.out; if (!out || !ctx.args.export) throw new Error('plan: --export <dir> and --out <dir> required');
  const X = loadExport(ctx.args.export);
  const missing = indexPrecondition(X.indexes);
  if (missing.length) throw new Error(`plan refused: index precondition: ${missing.join('; ')}`);
  const measuredText = readFileSync(ctx.args.measured || path.join(SPEC1, 'plan-rev1.json'), 'utf8');
  const coreText = readFileSync(ctx.args.core || path.join(SPEC1, 'core.json'), 'utf8');
  const seedText = readFileSync(SEED_SRC, 'utf8');
  const handoffText = readFileSync(ctx.args.handoff || HANDOFF, 'utf8');
  const freezesText = readFileSync(ctx.freezesPath, 'utf8');
  const sigText = ctx.args.signatures ? readFileSync(ctx.args.signatures, 'utf8') : null;
  const iem = new Map(); for (const r of X.ch.iem) { const d = Number(r.entity_id); if (!iem.has(d)) iem.set(d, []); iem.get(d).push(r.instrument_key); }
  const filingsRefs = new Set([...X.ch.mqp, ...X.ch.ies, ...X.ch.ips, ...X.ch.facts].map(r => Number(r.entity_id)));
  const unexpectedRefs = ['rel_child', 'rel_parent', 'isin', 'exp_entity', 'exp_holder', 'bil'].flatMap(k => X.ch[k].map(r => ({ table: k, ...r })));
  const felIds = new Set(X.ch.fel.map(r => Number(r.entity_id)));
  const handoff = JSON.parse(handoffText);
  const leiIn = handoff.deferred_leis.filter(x => String(x.why).startsWith('iii')).map(x => ({ lei: x.lei, dup: Number(x.entity_id), payload: x.payload }));
  const rExp = ctx.args['r-expected'] === 'none' ? null : Number(ctx.args['r-expected'] || 62);
  const p = buildPlan({
    measured: JSON.parse(measuredText), three: JSON.parse(coreText).three, em: X.em, iem,
    queue: new Map(X.ch.queue.map(r => [Number(r.entity_id), r.status])), filingsRefs,
    doNotMerge: doNotMergeIds(X.ch.do_not_merge), redirects: new Set(X.ch.redirects.map(r => Number(r.duplicate_id))),
    signatures: parseSignatures(sigText ? JSON.parse(sigText) : null), normalizeName: loadSeedNormalizeName(seedText), rExpected: rExp, lei: leiIn
  });
  // A merge whose duplicate has any guard-table row or a fund_entity_link row is dropped and listed (step 1 would miss anyway).
  const refIds = new Set(unexpectedRefs.map(r => Number(r.entity_id ?? r.child_entity_id ?? r.parent_entity_id ?? r.holder_entity_id)));
  const refer = { etf_pl_fund_entity_link: [], guard_reference: [] };
  for (const b of p.batches) b.merges = b.merges.filter(m => {
    if (felIds.has(m.dup)) { refer.etf_pl_fund_entity_link.push({ dup: m.dup, surv: m.surv }); return false; }
    if (refIds.has(m.dup)) { refer.guard_reference.push({ dup: m.dup, surv: m.surv }); return false; }
    return true;
  });
  const merges = p.batches.flatMap(b => b.merges);
  // New pairs at plan time (§5.5): groups on (normalizeName(name), type) not covered by the measured set → November list.
  const nn = loadSeedNormalizeName(seedText); const covered = new Set(JSON.parse(coreText).core.flatMap(x => [x.dup, x.surv]).map(Number));
  for (const t of JSON.parse(coreText).three) for (const id of [...t.twins, t.holder]) covered.add(Number(id));
  const groups = new Map(); for (const r of X.em.values()) { const k = `${nn(r.name)}|${r.type}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(Number(r.entity_id)); }
  const newPairs = [...groups.entries()].filter(([, ids]) => ids.length > 1 && ids.some(i => !covered.has(i))).map(([k, ids]) => ({ key: k, ids }));
  const plan = {
    packet: PACKET, job_id: JOB_ID, spec_sha256: 'e6dc85677278ef672c47a73c021395c6d1f65146b661d426a411f51cae57f098', created_utc: ctx.now().toISOString(),
    inputs: { export_manifest: sha256(readFileSync(path.join(ctx.args.export, 'manifest.json'), 'utf8')), measured: sha256(measuredText), core: sha256(coreText),
              seed_src: sha256(seedText), handoff: sha256(handoffText), freezes: sha256(freezesText), signatures: sigText ? sha256(sigText) : null },
    releasable: !X.man.transport.startsWith('local'),
    batches: p.batches.filter(b => b.merges.length).map((b, i) => ({ ...b, id: `B${String(i + 1).padStart(2, '0')}`, pilot: i === 0,
      declared_writes: b.merges.reduce((a, m) => a + mergeCost(m), 0) + COST.heartbeatsPerBatch })),
    lei: p.lei.filter(l => merges.some(m => m.dup === l.dup)),
    held: p.held, refer, new_pairs_count: newPairs.length
  };
  plan.totals = { merges: merges.length, batches: plan.batches.length, R: merges.reduce((a, m) => a + m.iem_keys.length, 0), cik_fills: merges.filter(m => m.cik_fill).length,
    lei: plan.lei.length, declared_writes: plan.batches.reduce((a, b) => a + b.declared_writes, 0) + plan.lei.length * COST.lei,
    held: Object.fromEntries(Object.entries(p.held).map(([k, v]) => [k, v.length])), refer: { etf: refer.etf_pl_fund_entity_link.length, guard: refer.guard_reference.length } };
  ensureDir(out);
  const { text, sha } = canonicalPlan(plan);
  writeFileSync(path.join(out, 'plan.json'), text);
  writeFileSync(path.join(out, 'plan.sha256'), `${sha}  plan.json\n`);
  writeJsonAtomic(path.join(out, 'new-pairs.json'), newPairs);
  return { plan_sha256: sha, totals: plan.totals, new_pairs: newPairs.length };
}

export function loadPlan(dir) {
  const text = readFileSync(path.join(dir, 'plan.json'), 'utf8');
  const pinned = readFileSync(path.join(dir, 'plan.sha256'), 'utf8').split(/\s+/)[0];
  if (sha256(text) !== pinned) throw new Error('plan SHA does not match plan.sha256');
  const plan = JSON.parse(text);
  if (stableStringify(plan) + '\n' !== text) throw new Error('plan.json is not canonical');
  return { plan, sha: pinned, dir };
}

// ── build-replica (dry run, tests) ───────────────────────────────────────

export async function cmdBuildReplica(ctx) {
  const X = loadExport(ctx.args.export), out = ctx.args.out;
  if (!out || existsSync(out)) throw new Error('build-replica: --out <new db path> required (never overwrites)');
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(out);
  for (const s of X.schema.filter(s => s.type === 'table')) db.exec(s.sql);
  for (const s of X.schema.filter(s => s.type === 'index')) db.exec(s.sql);
  if (!X.schema.some(s => s.name === 'entity_merge_redirect')) { /* created by `migrate`, as on D1 */ }
  const ins = (table, rows) => { if (!rows.length) return; const cols = Object.keys(rows[0]); const st = db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`); for (const r of rows) st.run(...cols.map(c => r[c] ?? null)); };
  db.exec('BEGIN');
  ins('entity_master', [...X.em.values()]);
  for (const [k, t] of [['iem', 'instrument_entity_map'], ['queue', 'entity_enrichment_queue'], ['rel_child', 'entity_relationships'], ['isin', 'entity_isin_map'], ['bil', 'bond_issuer_link']]) ins(t, X.ch[k]);
  db.exec('COMMIT');
  db.close();
  return { out, em_rows: X.em.size, iem: X.ch.iem.length, queue: X.ch.queue.length };
}

// ── migrate (§6.1) ───────────────────────────────────────────────────────

export async function cmdMigrate(ctx) {
  const sql = readFileSync(MIGRATION, 'utf8').split('\n').filter(l => !/^\s*--/.test(l)).join('\n').replace(/--[^\n]*/g, '').trim().replace(/;\s*$/, '');
  checkStatement(sql);
  const r = await ctx.d1.exec([sql], { label: 'migrate' });
  appendJsonl(ctx.paths.gate, { utc: ctx.now().toISOString(), text: `migration applied (${ctx.d1.name})`, meta: r[0].meta });
  return { migrated: true, meta: r[0].meta };
}

// ── run gates (§9) ───────────────────────────────────────────────────────

function flagGate(ctx) { if (ctx.stopRequested || existsSync(ctx.stopFlag)) return 'killed'; if (existsSync(ctx.pauseFlag)) return 'paused'; return null; }

function loadFreezes(ctx) {
  try { const raw = readFileSync(ctx.freezesPath, 'utf8'); return { ...JSON.parse(raw), sha256: sha256(raw) }; } catch { return null; }
}

export async function startGates(ctx) {
  const reasons = [];
  // index preconditions: hard stop before any write (T-12)
  const missing = indexPrecondition(await q(ctx, INDEX_QUERY, 'index-precondition'));
  if (missing.length) return { ok: false, outcome: 'failed', reason: `index precondition: ${missing.join('; ')}` };
  try { await q(ctx, `SELECT duplicate_id FROM entity_merge_redirect WHERE duplicate_id = 0`, 'redirect-table'); }
  catch (e) { if (isMissingTable(e)) return { ok: false, outcome: 'failed', reason: 'entity_merge_redirect is missing (run migrate first)' }; throw e; }
  const hold = await q(ctx, `SELECT value FROM holdings_pipeline_state WHERE key = 'hold_all_jobs'`, 'hold');
  if (hold[0] && String(hold[0].value) === 'true') return { ok: false, outcome: 'held', reason: 'hold_all_jobs is true' };
  // T-16 (Ops M-3): boost paused for the run window, and its 17:50 run finished
  if (!ctx.args['no-ops-gates']) {
    const now = ctx.now(), iso = now.toISOString();
    const pause = await q(ctx, `SELECT pause_id, starts_at, ends_at FROM ops_job_pause WHERE job_id = ${lit(BOOST_JOB_ID)} AND ends_at > ${lit(iso)} AND starts_at <= ${lit(iso)}`, 'boost-pause');
    if (!pause.length) reasons.push(`no active ops_job_pause row for ${BOOST_JOB_ID}`);
    const from = `${utcDate(now)}T${BOOST_EVENING_FROM}:00`;
    if (iso >= from) {          // after 17:45 UTC the boost's evening run must have ended before 013 starts
      const end = await q(ctx, `SELECT event_type, started_at FROM ops_job_run WHERE job_id = ${lit(BOOST_JOB_ID)} AND event_type IN ('success','partial','skipped','failed','killed') AND started_at >= ${lit(from)} LIMIT 1`, 'boost-end');
      if (!end.length) reasons.push(`the boost ${BOOST_EVENING_FROM}+ run has no end event yet`);
    }
    if (!existsSync(path.join(CORP_DIR, '.entities-enrich-boost-paused')) && !ctx.local) reasons.push('boost pause flag App/Corporate Atlas/.entities-enrich-boost-paused is absent');
  }
  if (reasons.length) return { ok: false, outcome: 'held', reason: reasons.join('; ') };
  return { ok: true };
}

async function budgetGate(ctx, batchWrites) {
  const now = ctx.now();
  let reading = null, fetchError = null;
  if (ctx.args['assume-account'] !== undefined) reading = { rowsWritten: Number(ctx.args['assume-account']), date: utcDate(now), fetchedAt: now.toISOString() };
  else { try { reading = await fetchD1Today({ url: D1_TODAY_URL, fetchImpl: ctx.fetchImpl, now: ctx.now }); } catch (e) { fetchError = e.message; } }
  const own = ownWrites013(ctx.paths, now);
  const d = budgetDecision({ reading, fetchError, now, state: readJson(ctx.paths.headroom, {}), batchWrites, own });
  writeJsonAtomic(ctx.paths.headroom, d.nextState);
  return d;
}

export function ownWrites013(paths, now) {
  const today = utcDate(now);
  const rl = readJsonl(paths.runlog).filter(r => typeof r.writes === 'number');
  const e = rl.map(r => ({ t: Date.parse(r.utc), w: r.writes }));
  return { todayWrites: e.filter(x => utcDate(new Date(x.t)) === today).reduce((a, x) => a + x.w, 0), rowsSince: ms => e.filter(x => now - x.t <= ms).reduce((a, x) => a + x.w, 0) };
}

// ── run (§6.5, §9, §10) ──────────────────────────────────────────────────

const cursorFile = (ctx, sha) => path.join(ctx.paths.work, `cursor-${sha.slice(0, 16)}.json`);

function writeRemainder(ctx, P, next, reason) {
  const r = remainderOf(P.plan, P.sha, next, reason, ctx.now());
  writeFileSync(ctx.paths.remainder, r.text);
  writeFileSync(ctx.paths.remainder + '.sha256', `${r.sha}  remainder.json\n`);
  gateLog(ctx, `remainder: ${r.body.merges} merges in ${r.body.batches.length} batches → ${ctx.paths.remainder} (${r.sha})`);
  return r;
}

async function readState(ctx, merges) {
  const dups = merges.map(m => m.dup), ids = [...new Set(merges.flatMap(m => [m.dup, m.surv]))];
  const em = new Map((await retryRead(ctx, 'rb-em', () => q(ctx, `SELECT * FROM entity_master WHERE entity_id IN (${ids.map(lit).join(', ')})`, 'rb-em'))).map(r => [Number(r.entity_id), r]));
  const red = new Map((await retryRead(ctx, 'rb-redirect', () => q(ctx, `SELECT duplicate_id, survivor_id, merged_at, packet FROM entity_merge_redirect WHERE duplicate_id IN (${dups.map(lit).join(', ')})`, 'rb-redirect'))).map(r => [Number(r.duplicate_id), r]));
  return { em, red };
}

// Reference probes on merged duplicates (Ops N-3; §10 tables 1–9).
export async function referenceProbes(ctx, dups) {
  if (!dups.length) return {};
  const ids = dups.map(lit).join(', ');
  const probes = {
    iem: `SELECT entity_id FROM instrument_entity_map WHERE entity_id IN (${ids})`,
    queue: `SELECT entity_id FROM entity_enrichment_queue WHERE entity_id IN (${ids})`,
    rel_child: `SELECT child_entity_id AS entity_id FROM entity_relationships WHERE child_entity_id IN (${ids})`,
    rel_parent: `SELECT parent_entity_id AS entity_id FROM entity_relationships WHERE parent_entity_id IN (${ids})`,
    isin: `SELECT entity_id FROM entity_isin_map WHERE entity_id IN (${ids})`,
    exp_entity: `SELECT entity_id FROM entity_exposure_monthly WHERE entity_id IN (${ids}) LIMIT 1`,
    exp_holder: `SELECT holder_entity_id AS entity_id FROM entity_exposure_monthly WHERE holder_entity_id IN (${ids}) LIMIT 1`,
    bil: `SELECT entity_id FROM bond_issuer_link WHERE entity_id IN (${ids})`,
    mqp: `SELECT entity_id FROM managerissuerpositionquarterly WHERE entity_id IN (${ids}) LIMIT 1`,
    ies: `SELECT entity_id FROM issuereventstream WHERE entity_id IN (${ids}) LIMIT 1`,
    ips: `SELECT entity_id FROM issuerperiodsummary WHERE entity_id IN (${ids}) LIMIT 1`,
    fel: `SELECT entity_id FROM fund_entity_link WHERE entity_id IN (${ids})`
  };
  const keys = Object.keys(probes);
  const res = await ctx.d1.exec(keys.map(k => probes[k]), { label: 'ref-probes' });
  return Object.fromEntries(keys.map((k, i) => [k, res[i].results.length]));
}

export async function executeBatch(ctx, P, batch) {
  const run = { id: randomUUID(), startedAt: ctx.now(), batch: batch.id };
  const F = batchFiles(ctx, P.sha, batch.id);
  // B-1 (a): a batch of this plan that already has a pre-image was executed (or attempted) before. Never again:
  // refuse with 0 reads and 0 writes, so its pre-image and token stay the rollback input.
  if (existsSync(F.preimage) || existsSync(F.provisional) || existsSync(F.final)) {
    const why = existsSync(F.final) ? `batch ${batch.id} executed earlier (final checkpoint ${path.basename(F.final)})`
      : `batch ${batch.id} executed earlier and is unclassified (pre-image${existsSync(F.provisional) ? ' + provisional checkpoint' : ''}, no final checkpoint)`;
    const msg = `refused: ${why}; ${DO_NOT_RERUN}`;
    gateLog(ctx, msg);
    await report(ctx, run, 'failed', { extra: { reason: msg, refused: true } });
    return { outcome: 'failed', refused: true, stops: [msg], merged: [], writes: 0 };
  }
  // no write at or after 23:30 (checked before the pre-image, so a clock stop leaves the batch unexecuted and re-runnable)
  if (!writeAllowed(ctx.now())) { await report(ctx, run, 'budget_limit', { extra: { reason: `no write at or after ${LIMITS_013.noWriteFrom}` } }); return { outcome: 'budget_limit', stop: 'clock' }; }
  const tok = ctx.now().toISOString();
  await sendEvent(ctx, eventFor(ctx, run, 'start', { detail: { merges: batch.merges.length, declared_writes: batch.declared_writes } }));
  // §6.3 per-batch probes: fund_entity_link (stop-and-refer, ETF MF-2) and facts by cik (Filings hold)
  const dups = batch.merges.map(m => m.dup);
  const fel = new Set((await q(ctx, `SELECT entity_id FROM fund_entity_link WHERE entity_id IN (${dups.map(lit).join(', ')})`, 'fel')).map(r => Number(r.entity_id)));
  const withCik = batch.merges.filter(m => m.dup_cik);
  const facts = new Set();
  for (const m of withCik) if ((await q(ctx, `SELECT entity_id FROM financialfact_reported WHERE cik = ${lit(m.dup_cik)} AND entity_id = ${lit(m.dup)} LIMIT 1`, 'facts')).length) facts.add(m.dup);
  const referred = batch.merges.filter(m => fel.has(m.dup)).map(m => ({ dup: m.dup, surv: m.surv }));
  const heldF = batch.merges.filter(m => facts.has(m.dup)).map(m => ({ dup: m.dup, surv: m.surv }));
  const live = batch.merges.filter(m => !fel.has(m.dup) && !facts.has(m.dup));
  if (!live.length) { await report(ctx, run, 'success', { extra: { reason: 'every merge referred or held', referred, held: heldF } }); return { outcome: 'success', merged: [], writes: 0 }; }
  // pre-image (§10 step 1): every touched row, every column
  const ids = [...new Set(live.flatMap(m => [m.dup, m.surv]))];
  const pre = {
    em: await q(ctx, `SELECT * FROM entity_master WHERE entity_id IN (${ids.map(lit).join(', ')})`, 'pre-em'),
    queue: await q(ctx, `SELECT * FROM entity_enrichment_queue WHERE entity_id IN (${live.map(m => lit(m.dup)).join(', ')})`, 'pre-queue'),
    iem: await q(ctx, `SELECT * FROM instrument_entity_map WHERE entity_id IN (${live.map(m => lit(m.dup)).join(', ')})`, 'pre-iem')
  };
  const preFile = F.preimage;
  const preText = stableStringify({ batch: batch.id, plan_sha256: P.sha, token: tok, ...pre }) + '\n';
  writeOnce(preFile, preText);                                   // B-1 (a): write-once
  // B-1 (b): provisional checkpoint on disk before the execute call; readback / restore work from it (c)
  const prov = { batch: batch.id, plan_sha256: P.sha, token: tok, preimage: path.basename(preFile), preimage_sha256: sha256(preText),
                 state: 'executing', live: live.map(m => m.dup), transport: ctx.d1.name, utc: ctx.now().toISOString() };
  writeOnce(F.provisional, JSON.stringify(prov, null, 1) + '\n');
  // execute: one call; each merge is all-or-nothing through its token (atomicity of the call is not relied on)
  const sqls = live.flatMap(m => renderMerge(m, tok).map(s => s.sql));
  let res = null, execError = null;
  try { res = await ctx.d1.exec(sqls, { label: `merge-${batch.id}` }); } catch (e) { execError = e; }
  const writes = res ? sumMeta(res, 'rows_written') : 0, reads = res ? sumMeta(res, 'rows_read') : 0;
  // read-back and classes (§6.2); B-1 (d): idempotent reads, retried with backoff
  let st, probes, classes, merged, raced, breach;
  try {
    st = await readState(ctx, live);
    classes = live.map(m => ({ dup: m.dup, surv: m.surv, cls: classifyReadback(m, tok, { redirect: st.red.get(m.dup) || null, dup_row: st.em.get(m.dup) || null, surv_row: st.em.get(m.surv) || null }) }));
    merged = classes.filter(c => c.cls === 'merged'); raced = classes.filter(c => c.cls === 'raced'); breach = classes.filter(c => c.cls.startsWith('breach'));
    probes = await retryRead(ctx, 'ref-probes', () => referenceProbes(ctx, merged.map(c => c.dup)));
  } catch (e) {
    const msg = `executed, unclassified — run \`readback --plan <P> --batch ${batch.id}\`; ${DO_NOT_RERUN} (read-back failed after ${ (ctx.retryDelays || READ_RETRY_DELAYS_MS).length + 1 } tries: ${redact(String(e?.message || e)).slice(0, 160)}${execError ? `; execute error: ${redact(execError.message).slice(0, 120)}` : ''})`;
    gateLog(ctx, `${batch.id}: ${msg}`);
    await report(ctx, run, 'failed', { rows: live.length, writes, reads, extra: { reason: msg, unclassified: true, checkpoint: path.basename(F.provisional) } });
    return { outcome: 'failed', unclassified: true, stops: [msg], merged: [], writes, ckFile: F.provisional };
  }
  const dangling = Object.entries(probes).filter(([, n]) => n > 0);
  const stops = [];
  if (execError) stops.push(`execute error: ${redact(execError.message).slice(0, 200)}`);
  if (breach.length) stops.push(`read-back breach on ${breach.length} merge(s): ${breach.slice(0, 3).map(b => `${b.dup}:${b.cls}`).join(', ')}`);
  if (raced.length > Math.floor(LIMITS_013.racedPct * batch.merges.length)) stops.push(`raced ${raced.length} > 0.5% of ${batch.merges.length}`);
  if (dangling.length) stops.push(`reference probes non-zero: ${JSON.stringify(Object.fromEntries(dangling))}`);
  if (!ctx.local && writes > LIMITS_013.writeOverrunFactor * batch.declared_writes) stops.push(`writes ${writes} > 1.3 × declared ${batch.declared_writes}`);
  const modeled = live.filter(m => merged.some(c => c.dup === m.dup)).reduce((a, m) => a + mergeCost(m), 0);
  const ck = { batch: batch.id, plan_sha256: P.sha, token: tok, preimage: path.basename(preFile), preimage_sha256: sha256(preText),
               merged: merged.map(c => c.dup), raced: raced.map(c => c.dup), breach, referred_etf_pl: referred, held_facts: heldF,
               writes_measured: writes, writes_modeled: modeled, reads_measured: reads, probes, stops, transport: ctx.d1.name, utc: ctx.now().toISOString(), state: 'final' };
  const ckFile = F.final;
  writeOnce(ckFile, JSON.stringify(ck, null, 1) + '\n');        // B-1 (a): write-once
  const outcome = stops.length ? 'failed' : (raced.length || referred.length || heldF.length ? 'partial' : 'success');
  await report(ctx, run, outcome, { rows: live.length, writes: ctx.local ? modeled : writes, reads, cursor: { before: batch.id, after: batch.id },
    extra: { attempted: live.length, merged: merged.length, raced: raced.length, reason: stops.join('; ') || undefined, checkpoint: path.basename(ckFile) } });
  return { outcome, stops, merged: ck.merged, writes, modeled, ckFile };
}

export async function cmdRun(ctx) {
  const P = loadPlan(ctx.args.plan);
  if (!P.plan.releasable && !ctx.local) throw new Error('plan is not releasable (built from a local export); refused on a remote transport');
  writeFileSync(ctx.paths.pid, String(process.pid));
  const cur = readJson(cursorFile(ctx, P.sha), { plan_sha256: P.sha, next: 0, done: {} });
  if (cur.next >= P.plan.batches.length) return { done: true };
  const g = await startGates(ctx);
  if (!g.ok) { gateLog(ctx, `refused to start: ${g.reason}`); await report(ctx, { id: randomUUID(), startedAt: ctx.now(), batch: '-' }, g.outcome, { extra: { reason: g.reason } }); return { stopped: g.outcome, reason: g.reason }; }
  const freezes = loadFreezes(ctx);
  const max = Number(ctx.args['max-batches'] || Infinity);
  let ran = 0;
  while (cur.next < P.plan.batches.length && ran < max) {
    const batch = P.plan.batches[cur.next];
    if (ctx.args.until && batch.id === ctx.args.until) { gateLog(ctx, `stopping before ${batch.id}: --until`); return { stopped: 'until', at: batch.id }; }
    const f = flagGate(ctx);
    if (f) { await report(ctx, { id: randomUUID(), startedAt: ctx.now(), batch: batch.id }, f, { extra: { reason: f === 'killed' ? 'kill switch' : 'pause flag' } }); writeRemainder(ctx, P, cur.next, f); return { stopped: f }; }
    const cal = ctx.args['ignore-calendar'] && ctx.local ? { ok: true } : calendar013(ctx.now(), freezes);
    if (!cal.ok) { gateLog(ctx, `stopping before ${batch.id}: ${cal.reason}`); writeRemainder(ctx, P, cur.next, cal.reason); return { stopped: 'calendar', reason: cal.reason }; }
    const b = await budgetGate(ctx, batch.declared_writes);
    if (!b.ok) { gateLog(ctx, `stopping before ${batch.id}: ${b.outcome} ${JSON.stringify(b.detail)}`); await report(ctx, { id: randomUUID(), startedAt: ctx.now(), batch: batch.id }, b.outcome, { extra: { reason: b.detail?.reason || b.detail } });
      if (b.outcome === 'budget_limit') writeRemainder(ctx, P, cur.next, `budget: ${b.detail?.reason}`); return { stopped: b.outcome }; }
    ctx.log(`${batch.id}: ${batch.merges.length} merges, ≈ ${batch.declared_writes} writes …`);
    const r = await executeBatch(ctx, P, batch);
    // B-1 (a): a refused re-run changes nothing — not the cursor, not cur.done, not the remainder of the earlier stop
    if (r.refused) return { stopped: 'failed', refused: true, at: batch.id, stops: r.stops };
    cur.done[batch.id] = { outcome: r.outcome, merged: r.merged?.length || 0, writes: r.writes, checkpoint: r.ckFile ? path.basename(r.ckFile) : null, ...(r.unclassified ? { unclassified: true } : {}) };
    // the cursor never advances past a failed batch (B-1 (d)); the remainder starts after it, since it was executed
    if (r.outcome === 'failed' || r.stop) { writeJsonAtomic(cursorFile(ctx, P.sha), cur); writeRemainder(ctx, P, cur.next + (r.outcome === 'failed' ? 1 : 0), r.stops?.join('; ') || r.stop);
      return { stopped: r.outcome, ...(r.unclassified ? { unclassified: true, at: batch.id } : {}), stops: r.stops }; }
    cur.next++; writeJsonAtomic(cursorFile(ctx, P.sha), cur); ran++;
    ctx.log(`  ${r.outcome}: merged ${r.merged.length}, writes ${ctx.local ? `${r.modeled} modeled` : r.writes}`);
    if (batch.pilot && !ctx.args['pilot-ok']) { gateLog(ctx, `pilot ${batch.id} done: holding for the §10 probes and the Data-Identity 20-row spot check; resume with --pilot-ok <name>`); return { stopped: 'pilot hold', at: batch.id }; }
  }
  if (cur.next >= P.plan.batches.length && existsSync(ctx.paths.remainder)) { /* an earlier remainder is superseded by completion */ }
  return { done: cur.next >= P.plan.batches.length, ran, next: P.plan.batches[cur.next]?.id || null };
}

// ── readback / restore (§10, §11) ────────────────────────────────────────

// B-1 (c): the final checkpoint if there is one, otherwise the provisional one (written before the execute call).
function loadBatchArtifacts(ctx, P, id) {
  const batch = P.plan.batches.find(b => b.id === id); if (!batch) throw new Error(`no batch ${id}`);
  const F = batchFiles(ctx, P.sha, id);
  const ck = readJson(F.final) || readJson(F.provisional); if (!ck) throw new Error(`no checkpoint for ${id} (neither final nor provisional)`);
  if (ck.plan_sha256 !== P.sha || ck.batch !== id) throw new Error(`checkpoint for ${id} belongs to another plan or batch`);
  const preText = readFileSync(path.join(ctx.paths.preimages, ck.preimage), 'utf8');
  if (sha256(preText) !== ck.preimage_sha256) throw new Error(`pre-image ${ck.preimage}: SHA mismatch`);
  const pre = JSON.parse(preText);
  if (pre.token !== ck.token) throw new Error(`pre-image ${ck.preimage}: token differs from the checkpoint's`);
  return { batch, ck, pre, provisional: ck.state === 'executing' };
}

// Classify every planned merge of the batch now, with the checkpoint's token.
async function classifyNow(ctx, batch, tok) {
  const st = await readState(ctx, batch.merges);
  return batch.merges.map(m => ({ dup: m.dup, surv: m.surv, cls: classifyReadback(m, tok, { redirect: st.red.get(m.dup) || null, dup_row: st.em.get(m.dup) || null, surv_row: st.em.get(m.surv) || null }) }));
}

export async function cmdReadback(ctx) {
  const P = loadPlan(ctx.args.plan); const { batch, ck, provisional } = loadBatchArtifacts(ctx, P, ctx.args.batch);
  const classes = await classifyNow(ctx, batch, ck.token);
  const count = {}; for (const c of classes) count[c.cls] = (count[c.cls] || 0) + 1;
  const out = { batch: batch.id, checkpoint: provisional ? 'provisional' : 'final', token: ck.token, counts: count, classes };
  appendJsonl(path.join(ctx.paths.readbacks, `${batch.id}-${P.sha.slice(0, 12)}.jsonl`), { utc: ctx.now().toISOString(), ...out });
  return out;
}

export async function restoreBatch(ctx, P, id) {
  const { batch, ck: ck0, pre, provisional } = loadBatchArtifacts(ctx, P, id);
  // From a provisional checkpoint the merged set is classified now; only 'merged' is restored, the rest is listed.
  let ck = ck0, notRestored = [];
  if (provisional) {
    const classes = await classifyNow(ctx, batch, ck0.token);
    ck = { ...ck0, merged: classes.filter(c => c.cls === 'merged').map(c => c.dup) };
    notRestored = classes.filter(c => c.cls !== 'merged').map(c => ({ dup: c.dup, cls: c.cls }));
  }
  const emPre = new Map(pre.em.map(r => [Number(r.entity_id), r]));
  const qPre = new Map(pre.queue.map(r => [Number(r.entity_id), r]));
  const leiState = readJson(ctx.paths.leiState, { applied: [] });
  const merged = batch.merges.filter(m => ck.merged.includes(m.dup));
  const sqls = [];
  for (const m of merged) {
    const lei = leiState.applied.find(l => l.dup === m.dup) || null;
    const leiPre = lei ? { ...emPre.get(m.surv), ...(lei.pre_surv_row || {}) } : null;
    sqls.push(...renderRestore(m, { dup_row: emPre.get(m.dup), surv_row: leiPre || emPre.get(m.surv), queue_row: qPre.get(m.dup), iem_rows: pre.iem.filter(r => Number(r.entity_id) === m.dup) }, ck.token, lei).map(s => s.sql));
  }
  const from = provisional ? 'provisional' : 'final';
  if (!sqls.length) return { batch: id, from, restored: 0, not_restored: notRestored };
  const res = await ctx.d1.exec(sqls, { label: `restore-${id}` });
  // verify: every restored row equals its pre-image, the redirect is gone
  const st = await readState(ctx, merged);
  const iemNow = await retryRead(ctx, 'restore-iem', () => q(ctx, `SELECT * FROM instrument_entity_map WHERE entity_id IN (${merged.map(m => lit(m.dup)).join(', ')})`, 'restore-iem'));
  const qNow = new Map((await retryRead(ctx, 'restore-queue', () => q(ctx, `SELECT * FROM entity_enrichment_queue WHERE entity_id IN (${merged.map(m => lit(m.dup)).join(', ')})`, 'restore-queue'))).map(r => [Number(r.entity_id), r]));
  const bad = [];
  for (const m of merged) {
    if (stableStringify(st.em.get(m.dup)) !== stableStringify(emPre.get(m.dup))) bad.push(`${m.dup}: duplicate row differs`);
    if (stableStringify(st.em.get(m.surv)) !== stableStringify(emPre.get(m.surv))) bad.push(`${m.surv}: survivor row differs`);
    if (stableStringify(qNow.get(m.dup)) !== stableStringify(qPre.get(m.dup))) bad.push(`${m.dup}: queue row differs`);
    if (st.red.get(m.dup)) bad.push(`${m.dup}: redirect still present`);
  }
  const iemPreS = stableStringify(pre.iem.slice().sort((a, b) => a.instrument_key < b.instrument_key ? -1 : 1));
  const iemNowS = stableStringify(iemNow.slice().sort((a, b) => a.instrument_key < b.instrument_key ? -1 : 1));
  if (iemPreS !== iemNowS) bad.push('instrument_entity_map rows differ from the pre-image');
  const out = { batch: id, from, restored: merged.length, writes: sumMeta(res, 'rows_written'), byte_identical: bad.length === 0, differences: bad.slice(0, 10), not_restored: notRestored };
  appendJsonl(path.join(ctx.paths.work, 'restores.jsonl'), { utc: ctx.now().toISOString(), ...out });
  return out;
}

export async function cmdRestore(ctx) {
  const P = loadPlan(ctx.args.plan);
  if (ctx.args.all) {
    const ids = P.plan.batches.map(b => b.id).filter(id => { const F = batchFiles(ctx, P.sha, id); return existsSync(F.final) || existsSync(F.provisional); }).reverse();
    const out = []; for (const id of ids) out.push(await restoreBatch(ctx, P, id));
    return { batches: out.length, restored: out.reduce((a, r) => a + r.restored, 0), all_identical: out.every(r => r.byte_identical !== false), failures: out.filter(r => r.byte_identical === false) };
  }
  if (!ctx.args.batch) throw new Error('restore: --batch Bnn or --all');
  return restoreBatch(ctx, P, ctx.args.batch);
}

// ── lei: step 7 (§6.2) ───────────────────────────────────────────────────

export async function cmdLei(ctx) {
  const P = loadPlan(ctx.args.plan);
  const leiState = readJson(ctx.paths.leiState, { applied: [], skipped: [] });
  const out = [];
  const calls = { n: 0 };
  for (const it of P.plan.lei) {
    if (leiState.applied.some(a => a.lei === it.lei)) { out.push({ lei: it.lei, state: 'already applied' }); continue; }
    // freshness: ≤ 3 GLEIF lei-records calls in all
    let fresh = true, why = null;
    if (!ctx.args['skip-gleif'] || !ctx.local) {
      if (++calls.n > 3) throw new Error('more than 3 GLEIF calls');
      try {
        const r = await ctx.fetchImpl(`https://api.gleif.org/api/v1/lei-records/${it.lei}`, { headers: { Accept: 'application/vnd.api+json' }, signal: AbortSignal.timeout(10000) });
        const j = await r.json(); const a = j?.data?.attributes;
        if (!r.ok || a?.entity?.status !== 'ACTIVE' || a?.registration?.status !== 'ISSUED') { fresh = false; why = `GLEIF: ${r.status} ${a?.entity?.status}/${a?.registration?.status}`; }
      } catch (e) { fresh = false; why = `GLEIF unavailable: ${e.name}`; }
    }
    if (!fresh) { leiState.skipped.push({ lei: it.lei, why }); out.push({ lei: it.lei, state: 'skipped', why }); continue; }
    const tok = ctx.now().toISOString();
    const preSurv = (await q(ctx, `SELECT * FROM entity_master WHERE entity_id = ${lit(it.surv)}`, 'lei-pre'))[0];
    const r = await ctx.d1.exec([renderLei(it, tok)], { label: `lei-${it.surv}` });
    const changes = r[0].meta.changes ?? r[0].meta.rows_written;
    const after = (await q(ctx, `SELECT lei FROM entity_master WHERE entity_id = ${lit(it.surv)}`, 'lei-rb'))[0];
    if (after?.lei === it.lei) { leiState.applied.push({ lei: it.lei, surv: it.surv, dup: it.dup, token: tok, set: it.set, pre_surv_row: preSurv }); out.push({ lei: it.lei, surv: it.surv, state: 'applied', changes }); }
    else { leiState.skipped.push({ lei: it.lei, why: 'CAS miss (W1-A or state)' }); out.push({ lei: it.lei, state: 'cas_miss' }); }
    writeJsonAtomic(ctx.paths.leiState, leiState);
  }
  writeJsonAtomic(ctx.paths.leiState, leiState);
  return { lei: out };
}

// ── verify (§10) ─────────────────────────────────────────────────────────

export async function cmdVerify(ctx) {
  const P = loadPlan(ctx.args.plan);
  const red = await q(ctx, `SELECT duplicate_id, survivor_id FROM entity_merge_redirect WHERE packet = ${lit(PACKET)}`, 'v-redirect');
  const dups = red.map(r => Number(r.duplicate_id)), survs = [...new Set(red.map(r => Number(r.survivor_id)))];
  const live = new Set(); for (const c of chunks([...dups, ...survs])) for (const r of await q(ctx, `SELECT entity_id FROM entity_master WHERE entity_id IN (${c.map(lit).join(', ')})`, 'v-em')) live.add(Number(r.entity_id));
  const probes = {}; for (const c of chunks(dups)) for (const [k, n] of Object.entries(await referenceProbes(ctx, c))) probes[k] = (probes[k] || 0) + n;
  const dupSet = new Set(dups);
  const checks = {
    redirect_rows: red.length,
    duplicates_still_live: dups.filter(d => live.has(d)).length,
    survivors_missing: survs.filter(s => !live.has(s)).length,
    survivor_is_a_duplicate: survs.filter(s => dupSet.has(s)).length,
    reference_rows_on_duplicates: probes,
    held_ids_merged: Object.values(P.plan.held).flat().filter(h => dupSet.has(Number(h.dup))).length
  };
  checks.ok = checks.duplicates_still_live === 0 && checks.survivors_missing === 0 && checks.survivor_is_a_duplicate === 0 && Object.values(probes).every(n => n === 0) && checks.held_ids_merged === 0;
  return checks;
}

// ── recon: R-4 run-log reconciliation export ─────────────────────────────

export async function cmdRecon(ctx) {
  const date = ctx.args.date || utcDate(ctx.now()); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('recon --date YYYY-MM-DD');
  const next = new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  const rows = await q(ctx, `SELECT run_id, phase, event_type, started_at, ended_at, rows_written, items_attempted, items_progressed FROM ops_job_run WHERE job_id = ${lit(JOB_ID)} AND started_at >= ${lit(date + 'T00:00:00')} AND started_at < ${lit(next + 'T00:00:00')} ORDER BY started_at LIMIT 300`, 'recon');
  const runlog = readJsonl(ctx.paths.runlog).filter(r => String(r.utc).startsWith(date));
  const out = { date, ops_events: rows.length, runlog_lines: runlog.length, runlog_writes: runlog.reduce((a, r) => a + (r.writes || 0), 0) };
  ensureDir(ctx.paths.recon); writeJsonAtomic(path.join(ctx.paths.recon, `recon-${date}.json`), { ...out, rows, runlog });
  return out;
}

// ── CLI ──────────────────────────────────────────────────────────────────

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  const writeCmds = new Set(['run', 'restore', 'migrate', 'lei']);
  const all = { export: cmdExport, plan: cmdPlan, 'build-replica': cmdBuildReplica, migrate: cmdMigrate, run: cmdRun, readback: cmdReadback, restore: cmdRestore, lei: cmdLei, verify: cmdVerify, recon: cmdRecon };
  if (!all[cmd]) { console.error('usage: merge-013.mjs export|plan|build-replica|migrate|run|readback|restore|lei|verify|recon [--transport remote|local:<db>] …'); process.exit(2); }
  if (writeCmds.has(cmd) && (process.ppid === 1 || !args.operator) && !(args.transport || '').startsWith('local:')) {
    console.error('refused: write commands are interactive only; start from an attended session with --operator <name>, never from launchd'); process.exit(2);
  }
  let ctx, code = 0;
  const onSignal = sig => { if (ctx) { ctx.stopRequested = true; console.error(`${sig}: kill switch — finishing the in-flight call, then checkpoint and exit 'killed'`); } };
  process.on('SIGTERM', () => onSignal('SIGTERM')); process.on('SIGINT', () => onSignal('SIGINT'));
  try {
    ctx = await makeContext(args, { write: writeCmds.has(cmd) });
    if (ctx.ingestWhy && cmd === 'run') console.log(`heartbeats: ${ctx.ingestWhy} — runlog.jsonl is the record of truth (R-4 reconciliation)`);
    const r = await all[cmd](ctx);
    console.log(JSON.stringify(r));
    if (r && ['failed', 'headroom_unavailable', 'killed'].includes(r.stopped)) code = 1;
    if (r && (r.ok === false || r.all_identical === false || r.byte_identical === false)) code = 1;
  } catch (e) { console.error('RUNNER ERROR:', redact(e.message)); if (writeCmds.has(cmd)) console.error(`RUNNER ERROR: ${DO_NOT_RERUN}`); code = 1; }
  try { if (ctx) { const pid = ctx.paths.pid; if (existsSync(pid) && readFileSync(pid, 'utf8') === String(process.pid)) unlinkSync(pid); } } catch { /* ignore */ }
  process.exit(code);
}
