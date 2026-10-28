// gleif-reconcile-011-core.mjs — MA-OCT-011 (spec rev 1.9 e09c01b9…2d22).
// Shared by the 011 runner (scripts/gleif-reconcile-011.mjs) and the plan
// generator (scripts/gleif-reconcile-011-plan.mjs). Entities domain only; no
// imports from other domains. Nothing here prints secrets or token literals.
//
// Contents:
//   constants and limits (§4.3, ML-1012-1, N-4)
//   calendar + FREEZES.json gate (§4.4, F-3)
//   headroom gate, fail closed (§4.3, F-1, F-2, F-5)
//   SQL rendering for plan statements, pre-image / read-back, restore (§4.1, §9, §10)
//   D1 transports: wrangler --remote (read-only or read-write) and local SQLite
//   run log (append-only, §7), checkpoints, cursor

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

// ── Constants ────────────────────────────────────────────────────────────

export const JOB_ID = 'manual.gleif-reconcile-011';
export const DB_NAME = 'meridian-etf';
export const WRANGLER_PATH = '/usr/local/bin/wrangler';          // 4.96.0, never npx (Ops N-1)
export const GC_SOURCE = 'GC-20260928-1600';                      // §3 provenance
export const ENRICH_VERSION = 11;
export const MATCH_SOURCE_A = 'gc_name_t1';
export const RUN_TS = '@RUN_TS';                                  // plan placeholder, rendered per batch
export const WORK_DIR = process.env.GLEIF011_WORK_DIR || path.join(homedir(), 'MeridianAtlas-work', 'gleif-011');
export const D1_TODAY_URL = 'https://meridian-ops.navinmv1981.workers.dev/api/ops/cf/d1-today';

export const LIMITS = Object.freeze({
  accountCeiling: 60000,          // ML-1012-1 (F-5 active: d1-today lags 25–30 min); spec default 70,000
  ownDailyCap: 25000,             // N-4 / §4.3
  mondayFirstCheckMax: 45000,     // §4.3: Monday only if account ≤ 45k at the first check
  ownRowWindowMinMs: 45 * 60000,  // ML-1012-1: F-1 window = max(45 min, time since last fetch)
  fetchMaxAgeMs: 120000,          // §4.3 freshness bound on the d1-today fetch
  d1TodayCeilingMs: 2000,
  d1TodayRetryDelayMs: 2000,
  maxStatementsPerBatch: 250,     // §4.1
  writeOverrunFactor: 1.3,        // §6 (iii)
  maxReadsPerExecution: 45000,    // Task limit (spec abort line is 50k; the stricter one wins)
  eventRowWrites: 5,              // ML-0910-1 / ML-1010-3: ≈ 5 row-writes per delivered Ops event
  mismatchAbs: 5,                 // §9 stop: > 5 rows …
  mismatchPct: 0.005,             // … or > 0.5% of a batch
  parentCollisionPct: 0.01,       // §9 stop
  retryDelaysMs: [30000, 120000, 300000], // §8 code 10000: 3 retries
  expectedMaxDurationS: 900       // N-2 (registry row; informational here)
});

// Columns 011 may write on entity_master (§3) plus identity/guard columns.
// Pre-images and read-backs carry exactly these (§9: all §3 columns + updated_at
// + gleif_enrichment_version).
export const EM_COLS = [
  'entity_id', 'name', 'normalized_name', 'type', 'lei', 'lei_status', 'country', 'updated_at',
  'legal_name', 'entity_category', 'entity_status', 'legal_address_country', 'hq_country',
  'legal_jurisdiction', 'legal_form_code', 'lei_registration_status', 'lei_last_updated',
  'lei_next_renewal', 'lei_validation_source',
  'direct_parent_lei', 'direct_parent_name', 'direct_parent_exception',
  'ultimate_parent_lei', 'ultimate_parent_name', 'ultimate_parent_exception',
  'gleif_last_updated', 'gleif_enrichment_version', 'match_source'
];
// Never in any SET list (§3 "never written by 011").
export const EM_NEVER_SET = new Set(['entity_id', 'normalized_name', 'type', 'updated_at']);
export const QUEUE_COLS = ['entity_id', 'status', 'retry_after', 'last_attempt'];
export const EDGE_COLS = ['parent_entity_id', 'child_entity_id', 'relationship_type', 'source'];
// Read-only allow-list; ops_job_run is read only for the R-4 daily reconciliation export.
export const ALLOWED_TABLES = new Set(['entity_master', 'entity_relationships', 'entity_enrichment_queue', 'holdings_pipeline_state', 'ops_job_run']);
export const WRITE_TABLES = new Set(['entity_master', 'entity_relationships', 'entity_enrichment_queue']);

// entity_master indexes (live D0 catalog, 006 ledger day 1): 9 full + partial phase3.
const IDX_SINGLE = { direct_parent_lei: 1, legal_jurisdiction: 1, lei: 1, match_source: 1, entity_status: 1, ultimate_parent_lei: 1 };
const PHASE3_COLS = ['lei', 'type', 'lei_status', 'direct_parent_lei', 'ultimate_parent_lei', 'direct_parent_exception'];

// ECA = E-C edges whose parent row is created by A (finding F-2: a parent LEI that
// is also an A target is not inserted by P; its edge runs after A instead).
export const STEP_ORDER = ['P', 'B', 'C', 'CR', 'RC15', 'EC', 'A', 'ECA', 'EA', 'Q'];
export const RESTORE_ORDER = ['Q', 'EA', 'ECA', 'A', 'EC', 'CR', 'RC15', 'C', 'B', 'P'];   // §10 (+ ECA before A)

// ── Small utilities ──────────────────────────────────────────────────────

export const sha256 = buf => createHash('sha256').update(buf).digest('hex');
// Streams in 8 MB chunks (gleif_006.db is 3.6 GB, above readFileSync's 2 GiB limit).
export function sha256File(p) {
  const h = createHash('sha256');
  const fd = openSync(p, 'r');
  try {
    const buf = Buffer.allocUnsafe(8 * 1024 * 1024);
    for (let n; (n = readSync(fd, buf, 0, buf.length, null)) > 0;) h.update(buf.subarray(0, n));
  } finally { closeSync(fd); }
  return h.digest('hex');
}
export const isNull = v => v === null || v === undefined;
export const utcDate = d => d.toISOString().slice(0, 10);

export function stableStringify(v) {
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}

export function ensureDir(p, mode = 0o700) { mkdirSync(p, { recursive: true, mode }); return p; }

export function writeJsonAtomic(file, obj) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(obj, null, 1) + '\n', 'utf8');
  renameSync(tmp, file);
}

export function readJson(file, dflt = null) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return dflt; }
}

export function redact(s) {
  return String(s).replace(/(bearer|authorization|secret|token|key)\s*[:=]\s*\S+/gi, '$1=[redacted]')
                  .replace(/[A-Za-z0-9_\-]{32,}/g, '[redacted]');
}

// ── Calendar and FREEZES.json gate (§4.4, F-3) ───────────────────────────

const RUN_WINDOWS = [['07:15', '10:40'], ['11:20', '16:40'], ['17:20', '21:00']];
// The dated "011 run window" freeze applies to the OTHER Entities writers, not
// to 011 itself; every other window (recurring or dated) blocks a batch start.
const OWN_FREEZE_PREFIX = '011 run window';

const hm = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function inWindow(minute, start, end) {
  const a = hm(start), b = hm(end);
  return a <= b ? (minute >= a && minute < b) : (minute >= a || minute < b);   // wraps midnight
}

export function loadFreezes(file) {
  const raw = readFileSync(file, 'utf8');
  const j = JSON.parse(raw);
  if (!Array.isArray(j.recurring) || !Array.isArray(j.dated)) throw new Error('FREEZES.json: recurring/dated arrays missing');
  return { ...j, sha256: sha256(raw) };
}

// Returns { ok: true } or { ok: false, reason }. `now` is a Date.
export function calendarCheck(now, freezes) {
  const dow = DOW[now.getUTCDay()];
  const minute = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (dow === 'Sun') return { ok: false, reason: 'calendar: no batches on Sunday (N-4)' };
  if (dow === 'Mon' && minute < hm('08:00')) return { ok: false, reason: 'calendar: Monday before 08:00 UTC (N-4)' };
  if (minute >= hm('23:50') || minute < hm('00:10')) return { ok: false, reason: 'calendar: UTC midnight guard 23:50–00:10 (F-3)' };
  if (!RUN_WINDOWS.some(([a, b]) => inWindow(minute, a, b))) {
    return { ok: false, reason: `calendar: outside the run windows ${RUN_WINDOWS.map(w => w.join('–')).join(', ')} UTC (§4.4)` };
  }
  if (!freezes) return { ok: false, reason: 'freezes: FREEZES.json not loaded (fail closed)' };
  for (const f of freezes.recurring) {
    const days = f.days || [];
    if ((days.includes('*') || days.includes(dow)) && inWindow(minute, f.start, f.end)) {
      return { ok: false, reason: `freeze: ${f.name} ${f.start}–${f.end} UTC` };
    }
  }
  for (const f of freezes.dated) {
    if (String(f.name).startsWith(OWN_FREEZE_PREFIX)) continue;
    const s = Date.parse(f.start), e = Date.parse(f.end);
    if (Number.isFinite(s) && Number.isFinite(e) && now >= s && now < e) return { ok: false, reason: `freeze: ${f.name} ${f.start}→${f.end}` };
    if (f.fallback) {
      const [fs, fe] = String(f.fallback).split('/').map(Date.parse);
      if (Number.isFinite(fs) && Number.isFinite(fe) && now >= fs && now < fe) return { ok: false, reason: `freeze: ${f.name} (fallback) ${f.fallback}` };
    }
  }
  return { ok: true };
}

// ── Headroom gate (§4.3; fails closed) ───────────────────────────────────
//
// fetchD1Today(): 2 s ceiling, one retry after 2 s. Any non-200, ok:false,
// unparseable body, missing rowsWritten, or wrong UTC date → throws.
// The gate state (last reading per UTC day, first-check-of-day flag) lives in
// <work>/headroom-state.json so the F-2 monotonic check survives restarts.

export async function fetchD1Today({ url = D1_TODAY_URL, fetchImpl = fetch, now = () => new Date(), sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await sleep(LIMITS.d1TodayRetryDelayMs);
    try {
      const resp = await fetchImpl(url, { signal: AbortSignal.timeout(LIMITS.d1TodayCeilingMs) });
      let body;
      try { body = await resp.json(); } catch { throw new Error(`d1-today unparseable (HTTP ${resp.status})`); }
      if (!resp.ok || body?.ok !== true) throw new Error(`d1-today not ok (HTTP ${resp.status})`);
      if (!Number.isFinite(body.rowsWritten)) throw new Error('d1-today: rowsWritten missing');
      const fetchedAt = now();
      return { rowsWritten: body.rowsWritten, date: body.date, fetchedAt: fetchedAt.toISOString() };
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`d1-today unavailable: ${lastErr && (lastErr.name === 'TimeoutError' ? 'TimeoutError' : (lastErr.cause?.code || lastErr.message))}`);
}

// Pure decision function (unit-tested). Inputs:
//   reading       { rowsWritten, date, fetchedAt } or null (fetch failed)
//   fetchError    string when reading is null
//   now           Date at which the batch would start
//   state         { date, lastRowsWritten, lastFetchAt, mondayChecked }
//   batchWrites   declared writes of the batch (+ its event writes)
//   own           { todayWrites, rowsSince(msWindow) → number }
// Returns { ok, outcome?, detail, nextState }
export function headroomDecision({ reading, fetchError, now, state = {}, batchWrites, own, limits = LIMITS }) {
  const today = utcDate(now);
  const st = state && state.date === today ? { ...state } : { date: today, lastRowsWritten: null, lastFetchAt: null, mondayChecked: false };
  const fail = (detail) => ({ ok: false, outcome: 'headroom_unavailable', detail, nextState: st });
  if (!reading) return fail(fetchError || 'd1-today unavailable');
  if (reading.date !== today) return fail(`d1-today date ${reading.date} is not the current UTC date ${today}`);
  const age = now - Date.parse(reading.fetchedAt);
  if (!(age >= 0 && age <= limits.fetchMaxAgeMs)) return fail(`d1-today fetch age ${age} ms exceeds ${limits.fetchMaxAgeMs} ms`);
  if (st.lastRowsWritten !== null && reading.rowsWritten < st.lastRowsWritten) {
    return fail(`F-2: rowsWritten fell from ${st.lastRowsWritten} to ${reading.rowsWritten} within ${today} (stale reading)`);
  }
  // F-1: own rows written in max(45 min, time since the previous fetch) are counted as unpolled.
  const sincePrev = st.lastFetchAt ? now - Date.parse(st.lastFetchAt) : 0;
  const windowMs = Math.max(limits.ownRowWindowMinMs, sincePrev);
  const unpolled = own.rowsSince(windowMs);
  const next = { ...st, lastRowsWritten: reading.rowsWritten, lastFetchAt: reading.fetchedAt };
  const detail = { account_rows_written: reading.rowsWritten, unpolled_own_rows: unpolled, f1_window_ms: windowMs,
                   batch_writes: batchWrites, own_today: own.todayWrites, ceiling: limits.accountCeiling, own_cap: limits.ownDailyCap };
  if (now.getUTCDay() === 1 && !st.mondayChecked) {
    next.mondayChecked = true;
    next.mondayBlocked = reading.rowsWritten > limits.mondayFirstCheckMax;
  }
  if (next.mondayBlocked) return { ok: false, outcome: 'budget_limit', detail: { ...detail, reason: `Monday first check: account ${reading.rowsWritten} > ${limits.mondayFirstCheckMax}` }, nextState: next };
  if (reading.rowsWritten + unpolled + batchWrites > limits.accountCeiling) {
    return { ok: false, outcome: 'budget_limit', detail: { ...detail, reason: 'account ceiling' }, nextState: next };
  }
  if (own.todayWrites + batchWrites > limits.ownDailyCap) {
    return { ok: false, outcome: 'budget_limit', detail: { ...detail, reason: '011 daily cap' }, nextState: next };
  }
  return { ok: true, detail, nextState: next };
}

// ── SQL rendering ────────────────────────────────────────────────────────

export function lit(v) {
  if (isNull(v)) return 'NULL';
  if (typeof v === 'number') { if (!Number.isFinite(v)) throw new Error('non-finite number'); return String(v); }
  if (typeof v === 'boolean') return v ? '1' : '0';
  return `'${String(v).replace(/'/g, "''")}'`;
}
const ident = c => { if (!/^[a-z_][a-z0-9_]*$/.test(c)) throw new Error(`bad identifier ${c}`); return c; };
const isClause = (c, v) => `${ident(c)} IS ${lit(v)}`;
export const renderValue = (v, runTs) => (v === RUN_TS ? runTs : v);
const renderObj = (o, runTs) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, renderValue(v, runTs)]));

// One plan statement → one SQL string. Statement kinds (all idempotent):
//   em_update   CAS UPDATE entity_master … WHERE entity_id=? AND <pre-image predicate> [AND lei-free]
//   em_insert   INSERT OR IGNORE INTO entity_master (holding parent row, step P)
//   edge_insert INSERT OR IGNORE INTO entity_relationships … SELECT parent by LEI (E-1: LEI only, held by exactly one row)
//   q_update    UPDATE entity_enrichment_queue SET status='complete' … WHERE status IN ('pending','failed')
export function renderStatement(s, runTs) {
  switch (s.kind) {
    case 'em_update': {
      const set = renderObj(s.set, runTs);
      const cols = Object.keys(set);
      if (!cols.length) throw new Error(`em_update ${s.entity_id}: empty SET`);
      for (const c of cols) if (EM_NEVER_SET.has(c)) throw new Error(`em_update ${s.entity_id}: ${c} may never be written`);
      const where = [`entity_id = ${lit(s.entity_id)}`, ...Object.entries(s.pre).map(([c, v]) => isClause(c, v))];
      if (s.lei_free) where.push(`NOT EXISTS (SELECT 1 FROM entity_master o WHERE o.lei = ${lit(s.lei_free)})`);
      return `UPDATE entity_master SET ${cols.map(c => `${ident(c)} = ${lit(set[c])}`).join(', ')} WHERE ${where.join(' AND ')}`;
    }
    case 'em_insert': {
      const v = renderObj(s.values, runTs);
      const cols = Object.keys(v);
      return `INSERT OR IGNORE INTO entity_master (${cols.map(ident).join(', ')}) VALUES (${cols.map(c => lit(v[c])).join(', ')})`;
    }
    case 'edge_insert':
      return `INSERT OR IGNORE INTO entity_relationships (parent_entity_id, child_entity_id, relationship_type, source) ` +
             `SELECT p.entity_id, c.entity_id, 'legal_parent', 'gleif' FROM entity_master p, entity_master c ` +
             `WHERE p.lei = ${lit(s.parent_lei)} AND c.entity_id = ${lit(s.child_entity_id)} AND c.lei = ${lit(s.child_lei)} ` +
             `AND (SELECT COUNT(*) FROM entity_master x WHERE x.lei = ${lit(s.parent_lei)}) = 1`;
    case 'q_update':
      return `UPDATE entity_enrichment_queue SET status = 'complete', last_attempt = ${lit(runTs)} ` +
             `WHERE entity_id = ${lit(s.entity_id)} AND status IN ('pending', 'failed')`;
    default: throw new Error(`unknown statement kind ${s.kind}`);
  }
}

// Static table check (§9 "unexpected table" stop): every table named in a
// write statement must be one 011 may write.
export function assertTables(sql, { write }) {
  const bare = sql.replace(/'(?:[^']|'')*'/g, "''");                 // string literals (names like "Away From Home") are data
  const names = [...bare.matchAll(/\b(?:FROM|INTO|UPDATE|JOIN)\s+([A-Za-z_][A-Za-z0-9_]*)/gi)].map(m => m[1]);
  const allowed = write ? WRITE_TABLES : ALLOWED_TABLES;
  for (const n of names) if (!allowed.has(n) && n !== 'sqlite_master') throw new Error(`unexpected table ${n} in SQL`);
  return names;
}

// Pre-image / read-back statements for one batch (V1, V2 and the edge/queue
// equivalents; all PK or index lookups — see the EXPLAIN set).
export function imageQueries(batch) {
  const q = [];
  const ids = [...new Set(batch.statements.filter(s => s.kind === 'em_update').map(s => s.entity_id))];
  if (ids.length) q.push({ key: 'em', sql: `SELECT ${EM_COLS.join(', ')} FROM entity_master WHERE entity_id IN (${ids.map(lit).join(', ')})` });
  const leis = [...new Set(batch.statements.filter(s => s.kind === 'em_insert').map(s => s.values.lei))];
  // INDEXED BY pins §6's V2 plan (unpinned, the planner may pick the partial phase3
  // index, which also leads with lei); it fails closed if the index is ever missing.
  if (leis.length) q.push({ key: 'em_lei', sql: `SELECT ${EM_COLS.join(', ')} FROM entity_master INDEXED BY idx_entity_master_lei WHERE lei IN (${leis.map(lit).join(', ')})` });
  const children = [...new Set(batch.statements.filter(s => s.kind === 'edge_insert').map(s => s.child_entity_id))];
  if (children.length) {
    q.push({ key: 'edge', sql: `SELECT ${EDGE_COLS.join(', ')} FROM entity_relationships WHERE child_entity_id IN (${children.map(lit).join(', ')})` });
    const pleis = [...new Set(batch.statements.filter(s => s.kind === 'edge_insert').map(s => s.parent_lei))];
    q.push({ key: 'edge_parent', sql: `SELECT entity_id, lei FROM entity_master INDEXED BY idx_entity_master_lei WHERE lei IN (${pleis.map(lit).join(', ')})` });
  }
  const qids = [...new Set(batch.statements.filter(s => s.kind === 'q_update').map(s => s.entity_id))];
  if (qids.length) q.push({ key: 'queue', sql: `SELECT ${QUEUE_COLS.join(', ')} FROM entity_enrichment_queue WHERE entity_id IN (${qids.map(lit).join(', ')})` });
  return q;
}

// ── Cost model (§4.2 counting basis) ─────────────────────────────────────

// UPDATE = 1 row + 1 per index whose key changes. `pre` is the row before.
export function updateCost(pre, set) {
  const changed = k => k in set && set[k] !== pre[k];
  let n = 1;
  for (const k of Object.keys(IDX_SINGLE)) if (changed(k)) n++;
  const leiAfter = 'lei' in set ? set.lei : pre.lei;
  if ((!isNull(pre.lei) || !isNull(leiAfter)) && PHASE3_COLS.some(changed)) n++;   // partial index (lei NOT NULL)
  return n;
}
export const INSERT_EM_COST = 11;   // 1 + 9 full indexes + phase3 (lei NOT NULL)
export const EDGE_COST = 4;         // 1 + PK autoindex + child idx + parent idx
export const QUEUE_COST = 2;        // 1 + idx_enrich_queue_status

// ── D1 transports ────────────────────────────────────────────────────────
//
// exec(statements[]) → array of { results, meta } (one per statement), or throws.
// The remote transport is the firds-local-seed.mjs shim (precedent §4.1) with
// /usr/local/bin/wrangler instead of npx, async so the kill switch can be
// observed between calls. `readOnly` refuses anything but SELECT/EXPLAIN.

const READ_RE = /^\s*(SELECT|EXPLAIN|WITH)\b/i;
const WRITE_KW = /\b(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|PRAGMA|ATTACH)\b/i;

export function assertReadOnly(sql) {
  if (!READ_RE.test(sql) || (WRITE_KW.test(sql.replace(/'(?:[^']|'')*'/g, "''")) && !/^\s*EXPLAIN\s+QUERY\s+PLAN\b/i.test(sql))) {
    throw new Error(`read-only transport refused a non-read statement: ${sql.slice(0, 80)}`);
  }
}

export class D1Error extends Error {
  constructor(message, { code = null, ambiguous = true } = {}) { super(message); this.name = 'D1Error'; this.code = code; this.ambiguous = ambiguous; }
}

export function wranglerTransport({ cwd, config, readOnly = true, wranglerPath = WRANGLER_PATH, timeoutMs = 300000, ledger = null } = {}) {
  if (!cwd || !config) throw new Error('wranglerTransport needs cwd and config');
  return {
    name: readOnly ? 'remote-ro' : 'remote-rw',
    readOnly,
    async exec(statements, { label = 'query' } = {}) {
      if (!statements.length) return [];
      for (const s of statements) { if (readOnly) assertReadOnly(s); assertTables(s, { write: !READ_RE.test(s) }); }
      const sqlText = statements.join(';\n') + ';';
      const started = new Date();
      const out = await new Promise((resolve, reject) => {
        execFile(wranglerPath, ['d1', 'execute', DB_NAME, '--remote', '--json', '-c', config, '--command', sqlText],
          { cwd, maxBuffer: 1024 * 1024 * 64, timeout: timeoutMs, encoding: 'utf8', detached: true },   // own process group: a terminal Ctrl-C does not kill the in-flight call
          (err, stdout, stderr) => {
            if (err) {
              const text = `${stdout || ''}\n${stderr || ''}`;
              const code = (text.match(/code[:\s]+(\d{4,5})/i) || [])[1] || null;
              reject(new D1Error(`wrangler d1 execute failed (${label}): ${redact(text.replace(/\s+/g, ' ').slice(0, 400))}`, { code }));
            } else resolve(stdout);
          });
      });
      let parsed;
      try { const i = out.search(/[[{]/); parsed = JSON.parse(i >= 0 ? out.slice(i) : out); }
      catch { throw new D1Error(`wrangler output unparseable (${label})`); }
      if (!Array.isArray(parsed)) parsed = [parsed];
      const results = parsed.map(p => ({ results: p.results || [], meta: p.meta || {} }));
      if (readOnly && results.some(r => (r.meta.rows_written || 0) > 0)) throw new D1Error(`WRITE DETECTED on a read-only call (${label})`, { ambiguous: false });
      if (ledger) ledger({ label, ts: started.toISOString(), statements: statements.length, rows_read: sum(results, 'rows_read'), rows_written: sum(results, 'rows_written'), sql_sha256: sha256(sqlText) });
      return results;
    }
  };
}
const sum = (rs, k) => rs.reduce((a, r) => a + (r.meta?.[k] || 0), 0);

// Local SQLite transport over a replica built from an export (dry run, tests).
// meta.rows_written is the SQLite change count (no index accounting) and is
// marked local:true so it is never mistaken for a D1 measurement.
export async function localTransport(dbPath, { readOnly = false } = {}) {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(dbPath, { readOnly });
  return {
    name: readOnly ? 'local-ro' : 'local-rw',
    readOnly,
    db,
    async exec(statements) {
      return statements.map(sql => {
        if (readOnly) assertReadOnly(sql);
        assertTables(sql, { write: !READ_RE.test(sql) });
        if (READ_RE.test(sql)) {
          const rows = db.prepare(sql).all();
          return { results: rows.map(r => ({ ...r })), meta: { rows_read: rows.length, rows_written: 0, changes: 0, local: true } };
        }
        const r = db.prepare(sql).run();
        return { results: [], meta: { rows_read: 0, rows_written: Number(r.changes), changes: Number(r.changes), local: true } };
      });
    },
    close() { db.close(); }
  };
}

// ── Run log, events ledger, checkpoints, cursor ──────────────────────────

export function workPaths(work = WORK_DIR) {
  return {
    work,
    runlog: path.join(work, 'runlog.jsonl'),
    events: path.join(work, 'events.jsonl'),
    ledger: path.join(work, 'd1-ledger.jsonl'),
    headroom: path.join(work, 'headroom-state.json'),
    cursor: path.join(work, 'cursor.json'),
    checkpoints: path.join(work, 'checkpoints'),
    preimages: path.join(work, 'preimages'),
    readbacks: path.join(work, 'readbacks'),
    holds: path.join(work, 'holds'),
    outbox: path.join(work, 'outbox'),
    ingestEnv: path.join(work, 'ops-ingest.env'),
    pid: path.join(work, 'runner.pid'),
    heartbeatLog: path.join(work, 'heartbeat.log')
  };
}

// §7: one JSON line per batch, spec fields first, written BEFORE the heartbeat.
export function appendRunLog(file, { run_key, step, batch, rows, writes, cursor, outcome, utc = new Date().toISOString(), ...extra }) {
  const OUTCOMES = new Set(['success', 'partial', 'failed', 'killed', 'paused', 'budget_limit', 'headroom_unavailable', 'held']);
  if (!OUTCOMES.has(outcome)) throw new Error(`run log: unknown outcome ${outcome}`);
  ensureDir(path.dirname(file));
  const line = JSON.stringify({ run_key, step, batch, rows, writes, cursor, outcome, utc, ...extra });
  appendFileSync(file, line + '\n', 'utf8');
  return line;
}

export function readJsonl(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

// Own writes for the budget (ML-0910-1): measured batch writes from the run
// log plus ≈ 5 row-writes per delivered Ops event (events.jsonl).
export function ownWrites(paths, now = new Date()) {
  const today = utcDate(now);
  const rl = readJsonl(paths.runlog).filter(r => typeof r.writes === 'number');
  const ev = readJsonl(paths.events);
  const entries = [...rl.map(r => ({ t: Date.parse(r.utc), w: r.writes })),
                   ...ev.map(e => ({ t: Date.parse(e.utc), w: (e.delivered || 0) * LIMITS.eventRowWrites }))];
  return {
    todayWrites: entries.filter(e => utcDate(new Date(e.t)) === today).reduce((a, e) => a + e.w, 0),
    rowsSince: ms => entries.filter(e => now - e.t <= ms).reduce((a, e) => a + e.w, 0)
  };
}

// Run outcome → heartbeat (§7 table). Same mapping with or without the outbox.
export function heartbeatFor(outcome) {
  switch (outcome) {
    case 'success': return { event: 'success' };
    case 'partial': return { event: 'partial' };
    case 'failed': return { event: 'failed' };
    case 'killed': return { event: 'killed' };
    case 'paused': return { event: 'skipped', reason: 'pause' };
    case 'budget_limit': return { event: 'skipped', reason: 'budget' };
    case 'headroom_unavailable': return { event: 'failed', errorClass: 'headroom_unavailable' };
    case 'held': return { event: 'skipped', reason: 'hold' };
    default: throw new Error(`no heartbeat mapping for ${outcome}`);
  }
}

// Ingest key: read by path, file must be mode 600 (K-2). Never printed.
export function loadIngestConfig(file) {
  try {
    if (!existsSync(file)) return { cfg: null, why: 'ops-ingest.env absent (run-log fallback)' };
    const mode = statSync(file).mode & 0o777;
    if (mode !== 0o600) return { cfg: null, why: `ops-ingest.env mode ${mode.toString(8)} is not 600 (K-2); not used` };
    const env = Object.fromEntries(readFileSync(file, 'utf8').split('\n').filter(l => /^[A-Z_]+=/.test(l))
      .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
    if (!env.OPS_INGEST_URL || !env.OPS_EMITTER || !env.OPS_INGEST_KEY) return { cfg: null, why: 'ops-ingest.env incomplete' };
    return { cfg: { url: env.OPS_INGEST_URL, emitter: env.OPS_EMITTER, key: env.OPS_INGEST_KEY }, why: null };
  } catch (e) { return { cfg: null, why: `ops-ingest.env unreadable (${e.name})` }; }
}

// R-4 daily reconciliation: that UTC day's ops_job_run rows for this job, by the
// indexed history pattern (001 Q5: idx_ops_job_run_job_at), bounded at 150 rows.
export function reconQuery(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('recon date must be YYYY-MM-DD');
  const next = new Date(Date.parse(date + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
  return `SELECT event_id, run_id, phase, event_type, job_id, emitter_id, trigger, started_at, ended_at, duration_ms, rows_read, rows_written, ` +
         `items_attempted, items_progressed, cursor_before, cursor_after, error_class, error_summary, detail, end_only, received_at ` +
         `FROM ops_job_run WHERE job_id = '${JOB_ID}' AND started_at >= '${date}T00:00:00' AND started_at < '${next}T00:00:00' ` +
         `ORDER BY started_at, phase LIMIT 150`;
}

// ── R9-1 (OPS-R9): cumulative 011 read ceiling ───────────────────────────
//
// The ceiling record <work>/read-ceiling.json is written once, from the R9-3
// re-projection after Friday's export: { ceiling: 350000 | 450000, since: <export
// start, ISO>, outcome, per_day_max: 200000 }. The cumulative total is the sum of
// meta.rows_read over every remote D1 call in <work>/d1-ledger.jsonl since `since`
// (runner and plan export both write that ledger). A step is refused BEFORE it runs
// if cumulative + its estimated reads would exceed the ceiling, or 011's reads that
// UTC day would exceed per_day_max. Every execution stays ≤ LIMITS.maxReadsPerExecution.
export const READ_DAY_MAX = 200000;          // OPS-R9: ≤ 200k/day by 011 (4% of 5M)

export function readCeilingFile(paths) { return path.join(paths.work, 'read-ceiling.json'); }

export function readTotals(paths, now = new Date()) {
  let cfg = null;
  try { cfg = JSON.parse(readFileSync(readCeilingFile(paths), 'utf8')); } catch { /* absent */ }
  const since = cfg ? Date.parse(cfg.since) : NaN;
  const today = utcDate(now);
  let cumulative = 0, todayReads = 0;
  for (const e of readJsonl(paths.ledger)) {
    const t = Date.parse(e.ts); const r = e.rows_read || 0;
    if (Number.isFinite(since) && t >= since) cumulative += r;
    if (utcDate(new Date(t)) === today) todayReads += r;
  }
  return { cfg, cumulative, today: todayReads, ceiling: cfg?.ceiling ?? null, day_max: cfg?.per_day_max ?? READ_DAY_MAX };
}

// Pure decision (unit-tested): { ok } or { ok:false, outcome:'budget_limit', reason }.
export function readCeilingDecision(tot, estReads) {
  if (!tot.cfg || !Number.isFinite(tot.ceiling)) return { ok: false, outcome: 'budget_limit', reason: 'R9-1: read-ceiling.json missing (fail closed)' };
  if (tot.cumulative + estReads > tot.ceiling) return { ok: false, outcome: 'budget_limit', reason: `R9-1: 011 reads ${tot.cumulative} + step ${estReads} > ceiling ${tot.ceiling}` };
  if (tot.today + estReads > tot.day_max) return { ok: false, outcome: 'budget_limit', reason: `R9-1: 011 reads today ${tot.today} + step ${estReads} > ${tot.day_max}/day` };
  return { ok: true };
}

// Estimated reads of one batch (measured Thu 15: 2 reads per row on the IN-list
// pre-image / read-back, 1 per CAS statement; + edge-parent / queue images).
export const estBatchReads = n => 6 * n + 10;
