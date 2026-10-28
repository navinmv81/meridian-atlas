// bonds-lib.mjs — MA-OCT-008 (spec rev 1.2 bcdad9a2…815cd3). Shared by the
// runner (bonds-ingest.mjs) and its tests. Entities domain only; imports
// nothing from other domain files. Never prints secrets.
//
// Contents:
//   paths, config, small file helpers
//   SEC client: User-Agent, ≥ 200 ms spacing, per-run cap, 403/429 stop, request ledger, document cache (§9.2)
//   FREEZES.json + weekday calendar gate (§9.3 gate 1, §12.3, §12.4)
//   headroom gate, fails closed (§9.3 gate 5; ML-1012-1 values from config)
//   SQL literals, wrangler pin check and D1 transport (--file batches, --command reads)
//   run log (append-only), cursor, heartbeat config

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

export const BONDS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const CORP_DIR = path.resolve(BONDS_DIR, '..');
export const REPO = path.resolve(CORP_DIR, '..', '..');
export const FREEZES_PATH = path.join(REPO, 'claude', 'relays', 'FREEZES.json');
export const CONFIG_PATH = path.join(BONDS_DIR, 'bonds-config.json');
export const WRANGLER_CONFIG = path.join(CORP_DIR, 'wrangler-entities-enrich.toml');   // D1 binding for meridian-etf (Entities domain)
export const WRANGLER_CANDIDATES = [path.join(CORP_DIR, 'node_modules', '.bin', 'wrangler'), '/usr/local/bin/wrangler'];
export const WRANGLER_VERSION = '4.96.0';
export const D1_TODAY_URL = 'https://meridian-ops.navinmv1981.workers.dev/api/ops/cf/d1-today';
export const INGEST_ENV_DEFAULT = path.join(homedir(), '.meridian-secrets', 'bonds-ops-ingest.env');

export const LIMITS = Object.freeze({
  fetchMaxAgeMs: 120000,          // §9.3 gate 5: d1-today fetch age ≤ 120 s
  d1TodayCeilingMs: 2000,
  d1TodayRetryDelayMs: 2000,
  cfRetryDelayMs: 5000,           // §9.2: error 10000 → retry the whole batch once after 5 s
  eventRowWrites: 5,              // ≈ 5 row-writes per delivered Ops event (ML-0910-1)
  maxReadsPerExecution: 45000     // standing rule (spec abort line 50k; the stricter one wins)
});

// ── Small helpers ────────────────────────────────────────────────────────

export const sha256 = buf => createHash('sha256').update(buf).digest('hex');
export const sha256File = p => sha256(readFileSync(p));
export const utcDate = d => d.toISOString().slice(0, 10);
export function ensureDir(p, mode = 0o700) { mkdirSync(p, { recursive: true, mode }); return p; }
export function readJson(file, dflt = null) { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return dflt; } }
export function writeJsonAtomic(file, obj) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(obj, null, 1) + '\n');
  renameSync(tmp, file);
}
export function appendJsonl(file, obj) { ensureDir(path.dirname(file)); appendFileSync(file, JSON.stringify(obj) + '\n', 'utf8'); }
export function readJsonl(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
export function redact(s) {
  return String(s).replace(/(bearer|authorization|secret|token|key)\s*[:=]\s*\S+/gi, '$1=[redacted]')
                  .replace(/[A-Za-z0-9_\-]{40,}/g, '[redacted]');
}

export function loadConfig(file = CONFIG_PATH) {
  const cfg = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(cfg.issuers) || !cfg.issuers.length) throw new Error('bonds-config.json: issuers missing');
  for (const i of cfg.issuers) if (!/^\d{10}$/.test(i.cik)) throw new Error(`bonds-config.json: CIK ${i.cik} is not 10 digits`);
  return { ...cfg, sha256: sha256File(file) };
}

// AC15 / L8-8: the A-1 / F-5 values are explicit config, never defaulted. A live run refuses without them.
export function liveConfigProblems(cfg) {
  const out = [];
  if (!Number.isInteger(cfg.account_ceiling) || cfg.account_ceiling <= 0) out.push('account_ceiling missing');
  if (!Number.isInteger(cfg.unpolled_window_min) || cfg.unpolled_window_min <= 0) out.push('unpolled_window_min missing');
  if (!cfg.lag_source) out.push('lag_source (Decisions Log row) missing');
  return out;
}

// State folder (gitignored): flags, run log, cursor, cache, batch files, outbox.
export function statePaths(stateDir = process.env.BONDS_STATE_DIR || path.join(BONDS_DIR, 'state')) {
  return {
    state: stateDir,
    pause: path.join(stateDir, 'PAUSE'),
    stop: path.join(stateDir, 'STOP'),
    pid: path.join(stateDir, 'runner.pid'),
    runlog: path.join(stateDir, 'runlog.jsonl'),
    secLedger: path.join(stateDir, 'sec-requests.jsonl'),
    d1Ledger: path.join(stateDir, 'd1-ledger.jsonl'),
    events: path.join(stateDir, 'events.jsonl'),
    heartbeatLog: path.join(stateDir, 'heartbeat.log'),
    headroom: path.join(stateDir, 'headroom-state.json'),
    cursor: path.join(stateDir, 'cursor.json'),
    cache: path.join(stateDir, 'cache'),
    batches: path.join(stateDir, 'batches'),
    outbox: path.join(stateDir, 'outbox')
  };
}

// ── SEC client (§9.2) ────────────────────────────────────────────────────

export class SecRateError extends Error { constructor(m) { super(m); this.name = 'SecRateError'; } }
export class SecCapError extends Error { constructor(m) { super(m); this.name = 'SecCapError'; } }

// Archive documents are immutable per accession, so they are cached (gzip) and a
// cache hit makes no request. Submissions JSON is cached only when asked (tests,
// re-running a dry run the same day); live runs always fetch it fresh.
export function secClient({ userAgent, minIntervalMs = 200, maxRequests = 1500, ledgerFile, cacheDir, fetchImpl = fetch,
                           sleep = ms => new Promise(r => setTimeout(r, ms)), now = () => new Date(), cacheSubmissions = false, offline = false }) {
  if (!userAgent || !/@/.test(userAgent)) throw new Error('SEC User-Agent missing: set SEC_USER_AGENT (name + contact e-mail, §9.2)');
  let last = 0, count = 0, errors = 0;
  const cachePath = url => path.join(cacheDir, sha256(url).slice(0, 32) + '.gz');
  async function get(url, { kind = 'doc' } = {}) {
    const cacheable = kind === 'doc' || cacheSubmissions;
    const cp = cachePath(url);
    if (cacheable && cacheDir && existsSync(cp)) return { status: 200, text: gunzipSync(readFileSync(cp)).toString('utf8'), cached: true };
    if (offline) return { status: null, text: null, cached: false, offline: true };
    if (count >= maxRequests) throw new SecCapError(`SEC request cap ${maxRequests} reached`);
    const wait = last + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    count++;
    const t0 = Date.now();
    let status = null, text = null, err = null;
    try {
      const resp = await fetchImpl(url, { headers: { 'User-Agent': userAgent, 'Accept-Encoding': 'gzip, deflate' }, signal: AbortSignal.timeout(30000) });
      status = resp.status;
      text = await resp.text();
    } catch (e) { err = e.name === 'TimeoutError' ? 'TimeoutError' : (e.cause?.code || e.name); }
    if (ledgerFile) appendJsonl(ledgerFile, { utc: now().toISOString(), started: new Date(t0).toISOString(), n: count, status, url, bytes: text ? Buffer.byteLength(text) : 0, ms: Date.now() - t0, ...(err ? { error: err } : {}) });
    if (status === 403 || status === 429) throw new SecRateError(`SEC returned ${status} for ${url}`);
    if (status !== 200) { errors++; return { status, text: null, cached: false, error: err || `HTTP ${status}` }; }
    if (cacheable && cacheDir) { ensureDir(cacheDir); writeFileSync(cp, gzipSync(text)); }
    return { status, text, cached: false };
  }
  return { get, get count() { return count; }, get errors() { return errors; } };
}

export const submissionsUrl = cik => `https://data.sec.gov/submissions/CIK${cik}.json`;
export const archiveUrl = (cik, accession, doc) => `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replace(/-/g, '')}/${doc}`;

// ── Calendar and FREEZES.json (§9.3 gate 1, §12.3, §12.4) ────────────────

const hm = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function inWindow(minute, start, end) {
  const a = hm(start), b = hm(end);
  return a <= b ? (minute >= a && minute < b) : (minute >= a || minute < b);   // wraps midnight
}

export function loadFreezes(file = FREEZES_PATH) {
  const raw = readFileSync(file, 'utf8');
  const j = JSON.parse(raw);
  if (!Array.isArray(j.recurring) || !Array.isArray(j.dated)) throw new Error('FREEZES.json: recurring/dated arrays missing');
  return { ...j, sha256: sha256(raw) };
}

// Every window that covers `now` (recurring or dated, incl. a dated fallback).
// For 008 the "011 run window" is a real freeze: 008 is one of the other writers.
export function activeFreezes(now, freezes) {
  const dow = DOW[now.getUTCDay()];
  const minute = now.getUTCHours() * 60 + now.getUTCMinutes();
  const hits = [];
  for (const f of freezes.recurring) {
    const days = f.days || [];
    if ((days.includes('*') || days.includes(dow)) && inWindow(minute, f.start, f.end)) hits.push(`${f.name} ${f.start}–${f.end} UTC`);
  }
  for (const f of freezes.dated) {
    const s = Date.parse(f.start), e = Date.parse(f.end);
    if (Number.isFinite(s) && Number.isFinite(e) && now >= s && now < e) hits.push(`${f.name} ${f.start}→${f.end}`);
    if (f.fallback) {
      const [fs, fe] = String(f.fallback).split('/').map(Date.parse);
      if (Number.isFinite(fs) && Number.isFinite(fe) && now >= fs && now < fe) hits.push(`${f.name} (fallback) ${f.fallback}`);
    }
  }
  return hits;
}

// Gate 1 for a live batch. Returns { ok } or { ok:false, reason:'out_of_window', detail }.
// Task: live writes Tue–Fri only. Missing / unparseable FREEZES.json fails closed.
export function calendarGate(now, freezesPath = FREEZES_PATH) {
  let freezes;
  try { freezes = loadFreezes(freezesPath); }
  catch (e) { return { ok: false, reason: 'out_of_window', detail: 'freezes_unavailable', why: e.message }; }
  const dow = DOW[now.getUTCDay()];
  if (!['Tue', 'Wed', 'Thu', 'Fri'].includes(dow)) return { ok: false, reason: 'out_of_window', detail: `weekday ${dow}: live writes Tue–Fri only`, freezes_sha256: freezes.sha256 };
  const hits = activeFreezes(now, freezes);
  if (hits.length) return { ok: false, reason: 'out_of_window', detail: hits.join('; '), freezes_sha256: freezes.sha256 };
  return { ok: true, freezes_sha256: freezes.sha256 };
}

// ── Headroom gate (§9.3 gate 5; fails closed) ────────────────────────────

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
      return { rowsWritten: body.rowsWritten, date: body.date, fetchedAt: now().toISOString() };
    } catch (err) { lastErr = err; }
  }
  throw new Error(`d1-today unavailable: ${lastErr && (lastErr.name === 'TimeoutError' ? 'TimeoutError' : (lastErr.cause?.code || lastErr.message))}`);
}

// Pure decision (unit-tested).
//   reading  { rowsWritten, date, fetchedAt } | null     state { date, lastRowsWritten, lastFetchAt }
//   own      { todayWrites, rowsSince(ms) }              batchWrites: declared writes of the batch (+ its events)
//   limits   { accountCeiling, unpolledWindowMs, runCap }  (from config; never defaulted)
// Returns { ok, reason?, detail, nextState }. reason ∈ headroom_unavailable | headroom | out_of_window.
export function headroomDecision({ reading, fetchError, now, state = {}, batchWrites, own, limits }) {
  const today = utcDate(now);
  const st = state && state.date === today ? { ...state } : { date: today, lastRowsWritten: null, lastFetchAt: null };
  const minute = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (minute >= hm('23:50') || minute < hm('00:10')) return { ok: false, reason: 'out_of_window', detail: 'F-3: no batch starts 23:50–00:10 UTC', nextState: st };
  const fail = detail => ({ ok: false, reason: 'headroom_unavailable', detail, nextState: st });
  if (!reading) return fail(fetchError || 'd1-today unavailable');
  if (reading.date !== today) return fail(`d1-today date ${reading.date} is not the current UTC date ${today}`);
  const age = now - Date.parse(reading.fetchedAt);
  if (!(age >= 0 && age <= LIMITS.fetchMaxAgeMs)) return fail(`d1-today fetch age ${age} ms exceeds ${LIMITS.fetchMaxAgeMs} ms`);
  if (st.lastRowsWritten !== null && reading.rowsWritten < st.lastRowsWritten) return fail(`F-2: rowsWritten fell from ${st.lastRowsWritten} to ${reading.rowsWritten} within ${today}`);
  const sincePrev = st.lastFetchAt ? now - Date.parse(st.lastFetchAt) : 0;
  const windowMs = Math.max(limits.unpolledWindowMs, sincePrev);
  const unpolled = own.rowsSince(windowMs);
  const nextState = { ...st, lastRowsWritten: reading.rowsWritten, lastFetchAt: reading.fetchedAt };
  const detail = { account_rows_written: reading.rowsWritten, unpolled_own_rows: unpolled, f1_window_ms: windowMs, batch_writes: batchWrites,
                   own_today: own.todayWrites, ceiling: limits.accountCeiling, run_cap: limits.runCap };
  if (reading.rowsWritten + unpolled + batchWrites > limits.accountCeiling) return { ok: false, reason: 'headroom', detail: { ...detail, why: 'account ceiling (F-1)' }, nextState };
  if (own.todayWrites + batchWrites > limits.runCap) return { ok: false, reason: 'headroom', detail: { ...detail, why: 'run cap' }, nextState };
  return { ok: true, detail, nextState };
}

// Own writes from the run log (measured per batch) plus ≈ 5 per delivered Ops event.
export function ownWrites(paths, now = new Date()) {
  const today = utcDate(now);
  const entries = [...readJsonl(paths.runlog).filter(r => r.kind === 'batch' && Number.isInteger(r.writes)).map(r => ({ t: Date.parse(r.utc), w: r.writes })),
                   ...readJsonl(paths.events).map(e => ({ t: Date.parse(e.utc), w: (e.delivered || 0) * LIMITS.eventRowWrites }))];
  return {
    todayWrites: entries.filter(e => utcDate(new Date(e.t)) === today).reduce((a, e) => a + e.w, 0),
    rowsSince: ms => entries.filter(e => now - e.t <= ms).reduce((a, e) => a + e.w, 0)
  };
}

// ── SQL literals ─────────────────────────────────────────────────────────

export function lit(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') { if (!Number.isFinite(v)) throw new Error('non-finite number'); return String(v); }
  if (typeof v === 'boolean') return v ? '1' : '0';
  return `'${String(v).replace(/'/g, "''")}'`;     // EP-1: literal values, single quotes doubled
}

// ── Wrangler (§9.2, A8-1): pinned 4.96.0, never npx ──────────────────────

export function runFile(file, args, { cwd = CORP_DIR, timeoutMs = 300000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { cwd, maxBuffer: 1024 * 1024 * 64, timeout: timeoutMs, encoding: 'utf8', detached: true },
      (err, stdout, stderr) => err ? reject(Object.assign(err, { stdout, stderr })) : resolve({ stdout, stderr }));
  });
}

// Returns the first candidate whose --version prints exactly 4.96.0, else throws (the run is refused).
export async function pinnedWrangler(candidates = WRANGLER_CANDIDATES) {
  const seen = [];
  for (const c of candidates) {
    if (!existsSync(c)) { seen.push(`${c}: absent`); continue; }
    try {
      const { stdout } = await runFile(c, ['--version'], { timeoutMs: 30000 });
      const v = (stdout.match(/\d+\.\d+\.\d+/) || [])[0];
      if (v === WRANGLER_VERSION) return { path: c, version: v };
      seen.push(`${c}: ${v || 'unknown'}`);
    } catch (e) { seen.push(`${c}: ${e.code || e.name}`); }
  }
  throw new Error(`no wrangler ${WRANGLER_VERSION} found (${seen.join('; ')}); run refused (A8-1)`);
}

export class D1Error extends Error { constructor(m, { code = null } = {}) { super(m); this.name = 'D1Error'; this.code = code; } }

const parseWranglerJson = out => { const i = out.search(/[[{]/); const p = JSON.parse(i >= 0 ? out.slice(i) : out); return Array.isArray(p) ? p : [p]; };
const errCode = text => (text.match(/code[:\s"]+(\d{4,5})/i) || [])[1] || null;

// D1 over the pinned wrangler. `query` runs one read with --command; `execFile`
// runs one batch file with --file. Both return per-statement { results, meta }.
export function d1Transport({ wrangler, dbName = 'meridian-etf', config = WRANGLER_CONFIG, ledgerFile = null }) {
  const call = async (args, label) => {
    let out;
    try { ({ stdout: out } = await runFile(wrangler, ['d1', 'execute', dbName, '--remote', '--json', '-c', config, ...args])); }
    catch (e) {
      const text = `${e.stdout || ''}\n${e.stderr || ''}`;
      throw new D1Error(`wrangler d1 execute failed (${label}): ${redact(text.replace(/\s+/g, ' ').slice(0, 400))}`, { code: errCode(text) });
    }
    let parsed;
    try { parsed = parseWranglerJson(out); } catch { throw new D1Error(`wrangler output unparseable (${label})`); }
    const res = parsed.map(p => ({ results: p.results || [], meta: p.meta || {} }));
    if (ledgerFile) appendJsonl(ledgerFile, { utc: new Date().toISOString(), label, rows_read: res.reduce((a, r) => a + (r.meta.rows_read || 0), 0), rows_written: res.reduce((a, r) => a + (r.meta.rows_written || 0), 0), raw_meta: res.map(r => r.meta) });
    return res;
  };
  return {
    name: 'remote',
    query: (sql, label = 'query') => {
      if (!/^\s*(SELECT|EXPLAIN)\b/i.test(sql)) throw new Error(`query() is read-only: ${sql.slice(0, 60)}`);
      return call(['--command', sql], label);
    },
    execFile: (file, label = 'batch') => call(['--file', file, '--yes'], label)
  };
}

// ── Heartbeat config (key read by path, mode 600; never printed) ─────────

export function loadIngestConfig(file) {
  try {
    if (!file || !existsSync(file)) return { cfg: null, why: `ingest env ${file} absent` };
    const mode = statSync(file).mode & 0o777;
    if (mode !== 0o600) return { cfg: null, why: `ingest env mode ${mode.toString(8)} is not 600; not used` };
    const env = Object.fromEntries(readFileSync(file, 'utf8').split('\n').filter(l => /^[A-Z_]+=/.test(l))
      .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
    if (!env.OPS_INGEST_URL || !env.OPS_EMITTER || !env.OPS_INGEST_KEY) return { cfg: null, why: 'ingest env incomplete' };
    if (env.OPS_EMITTER !== 'local-bonds') return { cfg: null, why: `ingest env emitter is not local-bonds` };
    return { cfg: { url: env.OPS_INGEST_URL, emitter: env.OPS_EMITTER, key: env.OPS_INGEST_KEY }, why: null };
  } catch (e) { return { cfg: null, why: `ingest env unreadable (${e.name})` }; }
}
