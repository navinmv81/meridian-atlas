// meridian-ops
// Backend for the Ops control plane: D1 budget-risk check, OpenFIGI coverage
// status, live Cloudflare metrics, run-event ingest, the alerting sweep and the
// Access-only job fleet view. On-request only, no Cron Trigger.
//
// MA-OCT-002a A6 (spec 002 rev 1.3 §13, CR-1): the governance routes (Sprint
// Board, Release Ledger, operational events, release drift — 4 public GETs and
// 4 admin POSTs) moved to the meridian-control Worker (src/control-api.js), same
// paths. This Worker now serves 7 endpoints plus 2 rules:
//   GET /api/ops/budget-risk, /api/ops/openfigi-status, /api/ops/cf/invocations,
//       /api/ops/cf/d1-today; GET /api/ops/admin/jobs;
//   POST /api/ops/ingest/run-event, /api/ops/ingest/sweep;
//   rule 1: the 4 legacy anonymous POST paths → 401 (MA-OCT-001 §6, unchanged);
//   rule 2: the 4 moved public GETs → 302 to the same path on meridian-control,
//           with Access-Control-Allow-Origin '*' so cross-origin fetch follows it.
//           302, never 301 (a cached 301 would outlive a rollback and 005's
//           cut-over). 005 points ma-ops.js at meridian-control and deletes it.
//
// READ/WRITE BUDGET: every route is a single-digit number of indexed point
// queries or small list scans against sprintboarditems/releaseledger/
// operationalevents, all of which will hold, at most, a few thousand rows
// for the foreseeable life of this project. /api/ops/openfigi-status is the
// only route touching a high-volume table, and it only ever runs COUNT(*)
// against indexed/PK columns (instrument_entity_map.instrument_key,
// openfigicache.instrument_key) — no full scans.
//
// MA-OCT-001 (Ops backend foundation, Oct 2026) READ/WRITE BUDGET for the new
// ops_* routes — spec claude/MA-OCT-001_Spec.md §8, every query EXPLAINed:
//   POST /api/ops/ingest/run-event  — hard switch / auth / validation exit with
//     0 D1 reads. Then Q1 registry lookup (2 rows, PK), Q2 daily-cap COUNT on
//     covering idx_ops_job_run_received (rows so far today: ~4-31 typical,
//     <= OPS_INGEST_DAILY_EVENT_CAP = 1000 worst), Q3 INSERT OR IGNORE (unique
//     probe on (run_id, phase), ~1 read). ~35 reads typical, ~1,005 worst;
//     ~5 row-writes (1 row + 4 index entries) per recorded event.
//   GET /api/ops/admin/jobs            — Q4 fleet: SCAN ops_job_registry
//     (<= 60 rows, Ops-owned, bounded) + 4 correlated covering-index SEARCHes
//     per row on ops_job_run: ~300 reads.
//   GET /api/ops/admin/jobs?job_id=    — Q5 run history, idx_ops_job_run_job_at,
//     LIMIT <= 100: <= 101 reads.
//   Daily projection: pilot ~20 row-writes/day; all jobs wired ~150-210/day;
//   hard ceiling 1000 events x 5 = 5,000 row-writes/day (5% of 100k).
//   Kill switches (fastest first): OPS_INGEST_ENABLED="false" var (0 reads);
//   ops_job_registry.ingest_enabled=0 on 'ops.ingest' (global) or on a job_id;
//   OPS_INGEST_DAILY_EVENT_CAP. Ops ingest deliberately ignores hold_all_jobs.
//   This Worker never writes writes_today_* keys.
//
// AUTH (MA-OCT-001 §6): every mutation is behind either Cloudflare Access with
// the JWT re-verified here (/api/ops/admin/*) or a hashed per-emitter key
// (/api/ops/ingest/*). The 4 legacy anonymous POST paths are an explicit 401
// deny. Neither prefix sends Access-Control-Allow-Origin; legacy GETs keep '*'.
//
// DOMAIN BOUNDARY: this Worker no longer reads or writes sprintboarditems,
// releaseledger or operationalevents (Ops domain; their only Worker writer is
// meridian-control since A6). It is the ONLY writer of the ops_* control-plane tables
// (ops_job_registry, ops_job_run, ops_exception, ops_data_quality_ticket,
// ops_case_event — migrations/002-ops-control-plane.sql). It reads (never
// writes) openfigicache, instrument_master, instrument_entity_map,
// entity_master, and holdings_pipeline_state.

import { computeLateness, intendedDrift, MAX_LOOKBACK_DAYS } from './lateness.js';

const DAILY_WRITE_LIMIT = 80000; // matches holdings-pipeline.js's shared guard

// FIXED 30 July 2026 (caught before the first browser preview, curl testing
// doesn't enforce CORS so this gap was invisible until now): meridian-proxy
// already sets these same headers for its routes — this Worker needs them
// too, or every fetch() from ma-ops.js's new tabs would be blocked by the
// browser, and every POST route would fail its preflight OPTIONS request
// entirely (unlike meridian-proxy, this Worker needs POST, not just GET).
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*'
};

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
  });
}

// MA-OCT-001: /api/ops/admin/* and /api/ops/ingest/* responses carry no CORS
// allowances — same-origin or non-browser callers only until 005 names the
// console's origin.
function jsonPrivate(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

function badRequest(message) {
  return json({ ok: false, error: message }, 400);
}

// --- Budget risk and OpenFIGI status -----------------------------------

async function budgetRisk(env) {
  const today = new Date().toISOString().slice(0, 10);
  const row = await env.DB.prepare(
    `SELECT value FROM holdings_pipeline_state WHERE key = ?`
  ).bind(`writes_today_${today}`).first();
  const writesToday = parseInt(row?.value ?? '0', 10);
  return json({
    ok: true,
    writes_today: writesToday,
    daily_limit: DAILY_WRITE_LIMIT,
    pct: DAILY_WRITE_LIMIT > 0 ? Math.round((writesToday / DAILY_WRITE_LIMIT) * 1000) / 10 : 0
  });
}

async function openFigiStatus(env) {
  const totalInstruments = await env.DB.prepare(`SELECT COUNT(*) AS c FROM instrument_master`).first();
  const mapped = await env.DB.prepare(`SELECT COUNT(*) AS c FROM instrument_entity_map`).first();
  const cached = await env.DB.prepare(`SELECT COUNT(*) AS c FROM openfigicache`).first();
  const cachedUnmatched = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM openfigicache WHERE has_warning = 0 AND matched_entity_id IS NULL`
  ).first();

  const total = totalInstruments?.c ?? 0;
  const mappedCount = mapped?.c ?? 0;
  return json({
    ok: true,
    instrument_master_total: total,
    instrument_entity_map_total: mappedCount,
    coverage_pct: total > 0 ? Math.round((mappedCount / total) * 1000) / 10 : 0,
    openfigicache_total: cached?.c ?? 0,
    openfigi_matched_no_entity: cachedUnmatched?.c ?? 0
  });
}

// --- Live Cloudflare metrics (MA-AUG-006, 2 August 2026) -----------------
// Productionizes the manual GraphQL Analytics queries run by hand throughout
// today's cron-anomaly incident (see Sprint_Board_August.html, MA-AUG-002)
// into on-demand dashboard routes. Pure reads against Cloudflare's own API —
// zero D1 write-budget impact, no new cron trigger (account-wide 5-cron
// ceiling is already at 4/5 from meridian-holdings + entities-seed +
// entities-enrich's two triggers).
//
// Requires a new secret, CF_ANALYTICS_TOKEN — a Cloudflare API token scoped
// to Account > Account Analytics > Read (NOT the same as the D1 binding,
// which is a separate credential entirely). Also requires CF_ACCOUNT_TAG as
// a plain var (not secret — it's an identifier, not a credential): the
// account tag used throughout today's incident diagnostics.
//
// cfD1WritesToday()'s field names (d1AnalyticsAdaptiveGroups /
// readQueries/writeQueries/rowsRead/rowsWritten) were a best-effort guess
// at build time, 2 August — correct on the first live try. Verified twice
// since: 2 August, rowsWritten (97,611) matched the manually-tracked
// incident figure (97,594-97,607); 4 August, batch 6 of the financialfact
// backfill (11,912 logical rows) produced a rowsWritten jump of ~34,214,
// a ~2.87x multiplier consistent with the previously observed 2.56x-3.69x
// range for this table. Trust this route's numbers. (This comment used to
// say "unverified, best-effort guess" — that was stale; the sprint board's
// MA-AUG-006 Risks list had the same drift, fixed the same day this was.)
async function queryCloudflareGraphQL(env, query, variables) {
  const resp = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.CF_ANALYTICS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });
  const data = await resp.json();
  if (data.errors && data.errors.length) {
    throw new Error(`Cloudflare GraphQL error: ${data.errors.map(e => e.message).join('; ')}`);
  }
  return data.data;
}

const TRACKED_SCRIPTS = [
  'meridian-holdings', 'meridian-entities-seed', 'meridian-entities-enrich',
  'meridian-entities-figi', 'meridian-entities-api', 'meridian-entities-delta', 'meridian-ops',
  'meridian-control'   // A6
];

// GET /api/ops/cf/invocations?script=<name>&date=YYYY-MM-DD (date optional, defaults today)
// Same query shape verified live during the 2 August incident: cron-only
// invocations cross-checked against all-trigger-types invocations for the
// same script/day, so a mismatch (more all-triggers than cron-only) is a
// real signal of a manual/fetch-triggered run outside the schedule.
async function cfInvocations(env, url) {
  const script = url.searchParams.get('script');
  if (!script) return badRequest('script query param is required');
  if (!TRACKED_SCRIPTS.includes(script)) {
    return badRequest(`script must be one of: ${TRACKED_SCRIPTS.join(', ')}`);
  }
  const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const dateStart = `${date}T00:00:00Z`;
  const dateEnd = `${date}T23:59:59Z`;

  const query = `
    query($accountTag: string!, $script: string!, $dateStart: string!, $dateEnd: string!) {
      viewer {
        accounts(filter: {accountTag: $accountTag}) {
          workersInvocationsScheduled(
            limit: 100,
            filter: { scriptName: $script, datetime_geq: $dateStart, datetime_leq: $dateEnd },
            orderBy: [datetime_ASC]
          ) {
            datetime
            cron
            scheduledDatetime
            status
            environmentName
          }
          workersInvocationsAdaptive(
            limit: 100,
            filter: { scriptName: $script, datetime_geq: $dateStart, datetime_leq: $dateEnd },
            orderBy: [datetimeMinute_ASC]
          ) {
            dimensions { datetimeMinute status }
            sum { requests }
          }
        }
      }
    }
  `;
  const data = await queryCloudflareGraphQL(env, query, {
    accountTag: env.CF_ACCOUNT_TAG, script, dateStart, dateEnd
  });
  const account = data?.viewer?.accounts?.[0] ?? {};
  const cronInvocations = account.workersInvocationsScheduled ?? [];
  const allInvocations = account.workersInvocationsAdaptive ?? [];
  const totalAllTriggers = allInvocations.reduce((sum, r) => sum + (r.sum?.requests ?? 0), 0);

  return json({
    ok: true,
    script,
    date,
    cron_invocation_count: cronInvocations.length,
    cron_invocations: cronInvocations,
    all_trigger_invocation_count: totalAllTriggers,
    // If this is true, every invocation was cron-triggered — no manual/fetch
    // runs happened outside the schedule. If false, something else fired it.
    matches_cron_only: totalAllTriggers === cronInvocations.length
  });
}

// GET /api/ops/cf/d1-today — account-wide D1 write/read totals for today.
// Field names verified live, 2 and 4 August — see file-header note above.
async function cfD1WritesToday(env) {
  const t = await d1Totals(env);
  return json({ ok: true, ...t, pct_of_cap: Math.round((t.rowsWritten / 100000) * 1000) / 10 });
}

// Account-wide D1 totals for today from Cloudflare analytics (1 subrequest, 0 D1
// reads). Lags 25–30 min behind real writes (measured 12–13 Oct; ML-1012-1).
async function d1Totals(env) {
  const today = new Date().toISOString().slice(0, 10);
  const query = `
    query($accountTag: string!, $date: Date!) {
      viewer {
        accounts(filter: {accountTag: $accountTag}) {
          d1AnalyticsAdaptiveGroups(
            limit: 1000,
            filter: { date: $date }
          ) {
            sum { readQueries writeQueries rowsRead rowsWritten }
          }
        }
      }
    }
  `;
  const data = await queryCloudflareGraphQL(env, query, { accountTag: env.CF_ACCOUNT_TAG, date: today });
  const groups = data?.viewer?.accounts?.[0]?.d1AnalyticsAdaptiveGroups ?? [];
  const totals = groups.reduce((acc, g) => ({
    readQueries: acc.readQueries + (g.sum?.readQueries ?? 0),
    writeQueries: acc.writeQueries + (g.sum?.writeQueries ?? 0),
    rowsRead: acc.rowsRead + (g.sum?.rowsRead ?? 0),
    rowsWritten: acc.rowsWritten + (g.sum?.rowsWritten ?? 0)
  }), { readQueries: 0, writeQueries: 0, rowsRead: 0, rowsWritten: 0 });
  return { date: today, ...totals, daily_cap: 100000 };
}

// --- MA-OCT-001: Cloudflare Access verification (admin prefix) ------------
// Vendored from App/Corporate Atlas/src/entities-api.js verifyAccessJwt()
// (MA-SEP-015b) — no cross-folder imports. Re-verifies the
// Cf-Access-Jwt-Assertion header (RS256 signature against the team JWKS, aud,
// iss, exp) on EVERY /api/ops/admin/* request. Fails closed when
// CF_ACCESS_TEAM_DOMAIN or CF_ACCESS_AUD is missing. This app has its own AUD.

let _accessJwksCache = null;
let _accessJwksCacheAt = 0;
const ACCESS_JWKS_TTL_MS = 60 * 60 * 1000; // 1 hour

function base64UrlToUint8Array(b64url) {
  const pad = (4 - (b64url.length % 4)) % 4;
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function base64UrlDecodeJson(b64url) {
  return JSON.parse(new TextDecoder().decode(base64UrlToUint8Array(b64url)));
}

async function getAccessJwks(env) {
  const now = Date.now();
  if (_accessJwksCache && (now - _accessJwksCacheAt) < ACCESS_JWKS_TTL_MS) return _accessJwksCache;
  const res = await fetch(`https://${env.CF_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`Failed to fetch Access JWKS: ${res.status}`);
  const data = await res.json();
  _accessJwksCache = data.keys || [];
  _accessJwksCacheAt = now;
  return _accessJwksCache;
}

// Returns { ok: true, actor, actor_source } — actor is the verified `email`
// claim ('access_jwt'), or 'service:<common_name>' for an Access service
// token ('access_service_token', P1). Identity always comes from the JWT,
// never from the request body.
async function verifyAccessJwt(request, env) {
  if (!env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) {
    return { ok: false, error: 'Access is not configured on this Worker' };
  }

  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return { ok: false, error: 'Missing Cf-Access-Jwt-Assertion header' };

  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, error: 'Malformed JWT' };
  const [headerB64, payloadB64, sigB64] = parts;

  let header, payload;
  try {
    header = base64UrlDecodeJson(headerB64);
    payload = base64UrlDecodeJson(payloadB64);
  } catch (e) {
    return { ok: false, error: 'Malformed JWT segments' };
  }

  const audOk = Array.isArray(payload.aud)
    ? payload.aud.includes(env.CF_ACCESS_AUD)
    : payload.aud === env.CF_ACCESS_AUD;
  if (!audOk) return { ok: false, error: 'aud mismatch' };

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < nowSec) {
    return { ok: false, error: 'Token expired' };
  }

  const expectedIss = `https://${env.CF_ACCESS_TEAM_DOMAIN}`;
  if (payload.iss !== expectedIss) return { ok: false, error: 'iss mismatch' };

  let keys;
  try {
    keys = await getAccessJwks(env);
  } catch (e) {
    return { ok: false, error: 'Could not fetch Access public keys' };
  }
  const jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) return { ok: false, error: 'Unknown signing key (kid)' };

  let cryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
    );
  } catch (e) {
    return { ok: false, error: 'Failed to import signing key' };
  }

  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlToUint8Array(sigB64);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, signedData);
  if (!valid) return { ok: false, error: 'Invalid signature' };

  if (payload.email && typeof payload.email === 'string') {
    return { ok: true, actor: payload.email, actor_source: 'access_jwt' };
  }
  if (payload.common_name && typeof payload.common_name === 'string') {
    return { ok: true, actor: `service:${payload.common_name}`, actor_source: 'access_service_token' };
  }
  return { ok: false, error: 'Token missing email / common_name claim' };
}

// --- MA-OCT-001: run-event ingest (contract v1 + Build Brief A1) ----------
// POST /api/ops/ingest/run-event. Check order, each exits early (spec §7.3):
// hard switch (0 D1 reads) → emitter key → schema → Q1 registry (global +
// per-job switch + emitter match) → Q2 daily cap → Q3 INSERT OR IGNORE.
// ops_job_run is append-only: one row per (run_id, phase); a retry or a
// conflicting second terminal is a no-op ("first terminal wins").

const INGEST_MAX_BODY_BYTES = 8 * 1024;
const INGEST_MAX_DETAIL_BYTES = 2 * 1024;
const INGEST_DEFAULT_DAILY_EVENT_CAP = 1000;
const RUN_EVENT_TYPES = new Set(['start', 'success', 'partial', 'skipped', 'failed', 'killed']);
const SKIPPED_REASONS = new Set(['hold', 'pause', 'budget', 'auth', 'out_of_window', 'empty_input']); // A1
const METRICS_MAX_KEYS = 16;   // A1
const METRICS_MAX_KEY_LEN = 32; // A1
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function redact(s) {
  return s.replace(/(bearer|authorization|secret|token|key)\s*[:=]\s*\S+/gi, '$1=[redacted]')
          .replace(/[A-Za-z0-9_\-]{32,}/g, '[redacted]');
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// OPS_INGEST_KEYS (secret) = JSON {emitter_id: sha256_hex(key)} — hashes only.
async function authenticateEmitter(request, env) {
  const emitter = request.headers.get('X-Ops-Emitter');
  const key = request.headers.get('X-Ops-Ingest-Key');
  if (!emitter || !key || !env.OPS_INGEST_KEYS) return null;
  let map;
  try { map = JSON.parse(env.OPS_INGEST_KEYS); } catch { return null; }
  const expected = Object.prototype.hasOwnProperty.call(map, emitter) ? String(map[emitter]) : '0'.repeat(64);
  const presented = await sha256Hex(key);
  return constantTimeEqual(presented, expected) && expected !== '0'.repeat(64) ? emitter : null;
}

function isIsoTimestamp(v) {
  return typeof v === 'string' && v.length <= 40 && /^\d{4}-\d{2}-\d{2}T/.test(v) && !Number.isNaN(Date.parse(v));
}

function optCount(evt, field) {
  const v = evt[field];
  if (v === undefined || v === null) return { value: null };
  if (!Number.isInteger(v) || v < 0) return { error: `${field} must be a non-negative integer or null` };
  return { value: v };
}

function optText(v, field, max) {
  if (v === undefined || v === null) return { value: null };
  if (typeof v !== 'string' || v.length > max) return { error: `${field} must be a string of <= ${max} chars` };
  return { value: v };
}

// Returns { row } ready for Q3, or { error } for a 400.
function validateRunEvent(evt) {
  if (!evt || typeof evt !== 'object' || Array.isArray(evt)) return { error: 'body must be a JSON object' };
  if (evt.v !== 1) return { error: 'unsupported contract version (expected v=1)' };
  if ('items_processed' in evt) return { error: 'items_processed is not in contract v1; send items_attempted / items_progressed' };
  if (typeof evt.run_id !== 'string' || !ID_RE.test(evt.run_id)) return { error: 'run_id is required (UUID)' };
  if (typeof evt.job_id !== 'string' || !ID_RE.test(evt.job_id)) return { error: 'job_id is required' };
  if (!RUN_EVENT_TYPES.has(evt.event)) return { error: `event must be one of: ${[...RUN_EVENT_TYPES].join(', ')}` };
  const terminal = evt.event !== 'start';

  if (!isIsoTimestamp(evt.started_at)) return { error: 'started_at is required (ISO-8601 UTC)' };
  const startedMs = Date.parse(evt.started_at);
  const nowMs = Date.now();
  if (startedMs < nowMs - 7 * 86400000 || startedMs > nowMs + 5 * 60000) {
    return { error: 'started_at must be within now-7d .. now+5min' };
  }

  const trigger = optText(evt.trigger, 'trigger', 64);
  if (trigger.error) return trigger;

  let endedAt = null, durationMs = null;
  if (terminal) {
    if (evt.ended_at !== undefined && evt.ended_at !== null) {
      if (!isIsoTimestamp(evt.ended_at)) return { error: 'ended_at must be ISO-8601 UTC' };
      endedAt = evt.ended_at;
    }
    if (evt.duration_ms !== undefined && evt.duration_ms !== null) {
      if (!Number.isInteger(evt.duration_ms) || evt.duration_ms < 0) return { error: 'duration_ms must be a non-negative integer' };
      durationMs = evt.duration_ms;
    }
    if (evt.event === 'success' && durationMs === null) return { error: 'success requires duration_ms' };
  }

  const counts = {};
  for (const f of ['rows_read', 'rows_written', 'items_attempted', 'items_progressed']) {
    const c = optCount(evt, f);
    if (c.error) return c;
    counts[f] = c.value;
  }

  let cursorBefore = null, cursorAfter = null;
  if (evt.cursor !== undefined && evt.cursor !== null) {
    if (typeof evt.cursor !== 'object' || Array.isArray(evt.cursor)) return { error: 'cursor must be an object' };
    const b = optText(evt.cursor.before, 'cursor.before', 256); if (b.error) return b;
    const a = optText(evt.cursor.after, 'cursor.after', 256); if (a.error) return a;
    cursorBefore = b.value; cursorAfter = a.value;
  }

  let errorClass = null, errorSummary = null;
  if (evt.error !== undefined && evt.error !== null) {
    if (typeof evt.error !== 'object' || Array.isArray(evt.error)) return { error: 'error must be an object' };
    errorClass = String(evt.error.class || 'ERROR').slice(0, 64);
    errorSummary = redact(String(evt.error.summary || '')).slice(0, 500);
  }
  if (evt.event === 'failed' && (!errorClass || !evt.error.summary)) return { error: 'failed requires error.class and error.summary' };

  let detail = null;
  if (evt.detail !== undefined && evt.detail !== null) {
    if (typeof evt.detail !== 'object' || Array.isArray(evt.detail)) return { error: 'detail must be an object' };
    detail = { ...evt.detail };
    if (detail.metrics !== undefined) {
      const m = detail.metrics;
      if (!m || typeof m !== 'object' || Array.isArray(m)) return { error: 'detail.metrics must be a flat object' };
      const keys = Object.keys(m);
      if (keys.length > METRICS_MAX_KEYS) return { error: `detail.metrics allows at most ${METRICS_MAX_KEYS} keys` };
      if (keys.some(k => k.length > METRICS_MAX_KEY_LEN)) return { error: `detail.metrics keys must be <= ${METRICS_MAX_KEY_LEN} chars` };
      // Server drops any value that isn't an integer (A1).
      detail.metrics = Object.fromEntries(keys.filter(k => Number.isInteger(m[k])).map(k => [k, m[k]]));
    }
  }
  if (evt.event === 'skipped' && !(detail && SKIPPED_REASONS.has(detail.reason))) {
    return { error: `skipped requires detail.reason in: ${[...SKIPPED_REASONS].join(', ')}` };
  }
  if (evt.event === 'killed' && !errorClass && !(detail && detail.reason)) {
    return { error: 'killed requires error.class or detail.reason' };
  }
  const detailJson = detail ? JSON.stringify(detail) : null;
  if (detailJson && new TextEncoder().encode(detailJson).length > INGEST_MAX_DETAIL_BYTES) {
    return { error: 'detail exceeds 2 KB' };
  }

  return {
    row: {
      run_id: evt.run_id,
      phase: terminal ? 'end' : 'start',
      event_type: evt.event,
      job_id: evt.job_id,
      trigger: trigger.value,
      started_at: evt.started_at,
      ended_at: endedAt,
      duration_ms: durationMs,
      ...counts,
      cursor_before: cursorBefore,
      cursor_after: cursorAfter,
      error_class: errorClass,
      error_summary: errorSummary,
      detail: detailJson
    }
  };
}

async function ingestRunEvent(request, env) {
  // 1. Hard switch — before any D1 access.
  if (env.OPS_INGEST_ENABLED === 'false') {
    console.log('[ops-ingest] hard switch OPS_INGEST_ENABLED=false: 202, 0 D1 reads');
    return jsonPrivate({ ok: true, recorded: false, reason: 'ingest_disabled' }, 202);
  }

  // 2. Emitter authentication.
  const emitter = await authenticateEmitter(request, env);
  if (!emitter) return jsonPrivate({ ok: false, error: 'unauthorized' }, 401);

  // 3. Schema validation (body <= 8 KB).
  const declared = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (declared > INGEST_MAX_BODY_BYTES) return jsonPrivate({ ok: false, error: 'body exceeds 8 KB' }, 400);
  const text = await request.text();
  if (new TextEncoder().encode(text).length > INGEST_MAX_BODY_BYTES) {
    return jsonPrivate({ ok: false, error: 'body exceeds 8 KB' }, 400);
  }
  let evt;
  try { evt = JSON.parse(text); } catch { return jsonPrivate({ ok: false, error: 'invalid JSON' }, 400); }
  const v = validateRunEvent(evt);
  if (v.error) return jsonPrivate({ ok: false, error: v.error }, 400);
  const row = v.row;

  // 4. Q1 — registry lookup: job row + the 'ops.ingest' control row (PK, 2 rows).
  const reg = await env.DB.prepare(
    `SELECT job_id, emitter_id, ingest_enabled, status FROM ops_job_registry WHERE job_id IN (?, 'ops.ingest')`
  ).bind(row.job_id).all();
  const control = reg.results.find(r => r.job_id === 'ops.ingest');
  const job = row.job_id === 'ops.ingest' ? null : reg.results.find(r => r.job_id === row.job_id);
  if (control && control.ingest_enabled === 0) {
    return jsonPrivate({ ok: true, recorded: false, reason: 'ingest_disabled' }, 202);
  }
  if (!job) return jsonPrivate({ ok: false, error: 'unknown_job' }, 422);
  if (job.emitter_id !== emitter) return jsonPrivate({ ok: false, error: 'emitter not allowed for this job_id' }, 403);
  if (job.ingest_enabled === 0) {
    return jsonPrivate({ ok: true, recorded: false, reason: 'job_ingest_disabled' }, 202);
  }

  // 5. Q2 — daily event cap (covering index on received_at).
  const cap = parseInt(env.OPS_INGEST_DAILY_EVENT_CAP || '', 10) || INGEST_DEFAULT_DAILY_EVENT_CAP;
  const utcMidnight = new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z';
  const today = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM ops_job_run WHERE received_at >= ?`
  ).bind(utcMidnight).first();
  if ((today?.c ?? 0) >= cap) {
    console.log(`[ops-ingest] daily cap reached (${today.c}/${cap}): 202`);
    return jsonPrivate({ ok: true, recorded: false, reason: 'daily_cap' }, 202);
  }

  // 6. Q3 — INSERT OR IGNORE; end_only=1 when a terminal arrives with no start row.
  const res = await env.DB.prepare(`
    INSERT OR IGNORE INTO ops_job_run
      (run_id, phase, event_type, job_id, emitter_id, trigger, started_at, ended_at, duration_ms,
       rows_read, rows_written, items_attempted, items_progressed, cursor_before, cursor_after,
       error_class, error_summary, detail, end_only, contract_version)
    SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18,
           CASE WHEN ?2 = 'end' AND NOT EXISTS
                  (SELECT 1 FROM ops_job_run WHERE run_id = ?1 AND phase = 'start') THEN 1 ELSE 0 END,
           1
  `).bind(row.run_id, row.phase, row.event_type, row.job_id, emitter, row.trigger, row.started_at,
    row.ended_at, row.duration_ms, row.rows_read, row.rows_written, row.items_attempted,
    row.items_progressed, row.cursor_before, row.cursor_after, row.error_class, row.error_summary,
    row.detail).run();

  if ((res.meta?.changes ?? 0) === 0) {
    console.log(`[ops-ingest] duplicate (run_id=${row.run_id}, phase=${row.phase}, event=${row.event_type}) ignored — first event wins`);
    return jsonPrivate({ ok: true, recorded: false, reason: 'duplicate' }, 200);
  }
  return jsonPrivate({ ok: true, recorded: true }, 201);
}

// --- MA-OCT-001: fleet and run-history reads (Access-only) ----------------
// MA-OCT-002a A2: additive read-time lateness (spec 002 rev 1.3 §6.3) — per job
// `slots`, `job_state`, `drift` (intended-only flags; live drift is B1), plus
// `lookback_days` (default 7, max 14). Queries (all index-backed or declared):
//   L2  SELECT … FROM ops_job_run WHERE job_id = ? AND started_at >= ? ORDER BY started_at
//       → SEARCH idx_ops_job_run_job_at (job_id=? AND started_at>?); only for jobs with an emitter
//   L3  SELECT … FROM ops_job_pause WHERE ends_at >= ?            → declared SCAN (≤ 100 rows)
//       SELECT … FROM ops_job_pause WHERE job_id = ? AND ends_at >= ? → SEARCH idx_ops_job_pause_job_end
//   R1  SELECT * FROM ops_job_registry WHERE job_id = ?           → PK
// Jobs without an emitter read nothing extra (their slots are `unobserved`).

const L2_SQL = `SELECT run_id, phase, event_type, trigger, started_at, ended_at, cursor_after,
                       items_attempted, items_progressed, detail, end_only
                FROM ops_job_run WHERE job_id = ? AND started_at >= ? ORDER BY started_at`;

function lookbackWindow(url) {
  const days = Math.min(Math.max(parseInt(url.searchParams.get('lookback_days') || '7', 10) || 7, 1), MAX_LOOKBACK_DAYS);
  const now = Date.now();
  // Runs may start up to 5 min before their slot (§6.3): read from 10 min before the window.
  return { days, now, sinceIso: new Date(now - days * 86400000 - 10 * 60000).toISOString(),
           pauseSinceIso: new Date(now - days * 86400000).toISOString() };
}

function withLateness(job, runRows, pauses, w) {
  const out = { slots: [], job_state: null, drift: [] };
  try {
    const intended = job.intended_schedule ? JSON.parse(job.intended_schedule) : { kind: 'none' };
    const l = computeLateness(job, runRows, pauses, w.now, w.days);
    out.slots = l.slots; out.job_state = l.job_state; out.run_states = l.runs;
    out.drift = intendedDrift(intended, w.now);
  } catch (err) {
    out.lateness_error = String(err && err.message || err).slice(0, 200);
  }
  return out;
}

async function listJobs(env, url) {
  const jobId = url.searchParams.get('job_id');
  const w = lookbackWindow(url);
  if (jobId) {
    // Q5 — run history for one job, idx_ops_job_run_job_at.
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1), 100);
    const rows = await env.DB.prepare(`
      SELECT event_id, run_id, phase, event_type, job_id, emitter_id, trigger, started_at, ended_at,
             duration_ms, rows_read, rows_written, items_attempted, items_progressed,
             cursor_before, cursor_after, error_class, error_summary, detail, end_only,
             contract_version, received_at
      FROM ops_job_run WHERE job_id = ? ORDER BY started_at DESC, phase LIMIT ?
    `).bind(jobId, limit).all();
    const [reg, l2, l3] = await env.DB.batch([
      env.DB.prepare(`SELECT * FROM ops_job_registry WHERE job_id = ?`).bind(jobId),
      env.DB.prepare(L2_SQL).bind(jobId, w.sinceIso),
      env.DB.prepare(`SELECT job_id, starts_at, ends_at, reason FROM ops_job_pause WHERE job_id = ? AND ends_at >= ?`).bind(jobId, w.pauseSinceIso)
    ]);
    const job = reg.results[0] || null;
    const lateness = job ? withLateness(job, job.emitter_id ? l2.results : [], l3.results, w) : {};
    const rowsRead = [rows, reg, l2, l3].reduce((a, r) => a + (r.meta?.rows_read ?? 0), 0);
    return jsonPrivate({ ok: true, job_id: jobId, lookback_days: w.days, runs: rows.results, registered: !!job, ...lateness, rows_read: rowsRead });
  }
  // Q4 — fleet: bounded SCAN of ops_job_registry (<= 60 rows) + 4 index lookups per job.
  // last_end_at walks idx_ops_job_run_job_at backwards to the newest end row (~2
  // reads); `event_type <> 'start'` would read every row of the job instead.
  // phase='end' is equivalent by the table's CHECK.
  const rows = await env.DB.prepare(`
    SELECT r.*,
      (SELECT MAX(started_at) FROM ops_job_run WHERE job_id = r.job_id AND event_type = 'start')   AS last_start_at,
      (SELECT MAX(started_at) FROM ops_job_run WHERE job_id = r.job_id AND event_type = 'success') AS last_success_at,
      (SELECT MAX(started_at) FROM ops_job_run WHERE job_id = r.job_id AND event_type = 'failed')  AS last_failed_at,
      (SELECT started_at FROM ops_job_run WHERE job_id = r.job_id AND phase = 'end'
         ORDER BY started_at DESC LIMIT 1)                                                         AS last_end_at
    FROM ops_job_registry r ORDER BY r.domain, r.job_id
  `).all();
  const emitting = rows.results.filter(j => j.emitter_id);
  const stmts = [env.DB.prepare(`SELECT job_id, starts_at, ends_at, reason FROM ops_job_pause WHERE ends_at >= ?`).bind(w.pauseSinceIso),
                 ...emitting.map(j => env.DB.prepare(L2_SQL).bind(j.job_id, w.sinceIso))];
  const res = await env.DB.batch(stmts);
  const pauses = res[0].results;
  const runsByJob = new Map(emitting.map((j, i) => [j.job_id, res[i + 1].results]));
  const jobs = rows.results.map(j => ({ ...j, ...withLateness(j, runsByJob.get(j.job_id) || [], pauses, w) }));
  const rowsRead = (rows.meta?.rows_read ?? 0) + res.reduce((a, r) => a + (r.meta?.rows_read ?? 0), 0);
  return jsonPrivate({ ok: true, lookback_days: w.days, jobs, rows_read: rowsRead });
}

// --- MA-OCT-002a A3: alerting sweep (spec 002 rev 1.3 §7.2–§7.3; R-E; B-1) --------
// POST /api/ops/ingest/sweep, called by the revived local health-check LaunchAgent
// (emitter health-check-local). It only reads and raises: it never updates or
// closes a case (003 owns transitions) and ignores hold_all_jobs (a hold is itself
// a finding). Kill switches: OPS_SWEEP_ENABLED="false" (0 reads); ingest_enabled=0
// on local.health-check or ops.ingest; the local pause flag; health-check-uninstall.sh.
// Budget per call: reads ≤ 1,000 (registry SCAN ≤ 60 + L2/L3 + ≤ 5 PK reads + a
// dedupe pre-check of ≤ ~40 unique-index probes + open counts); writes ≤ 20 raises
// × ≈ 11 ≈ 220. Daily raise cap OPS_SWEEP_DAILY_RAISE_CAP (default 100) is counted
// from today's local.health-check end events (detail.metrics.raised), which L2
// already reads — 0 extra reads.

const SWEEP_JOB_ID = 'local.health-check';
const SWEEP_RAISE_CAP = 20;
const SWEEP_DEFAULT_DAILY_RAISE_CAP = 100;
const WEEKLY_JOBS = new Set(['cf.meridian-holdings', 'cf.meridian-entities-seed', 'local.firds-weekly-seed']);
const SEV_ORDER = { sev1: 1, sev2: 2, sev3: 3, sev4: 4 };

async function sweepCaseRef(dedupeKey, n = 12) {
  return 'EXC-S-' + (await sha256Hex(dedupeKey)).slice(0, n).toUpperCase();
}

function lastSundayUtc(now) {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

// Findings for one emitting job from its lateness and run rows.
function jobFindings(job, lat, runRows) {
  const out = [];
  const t = job.job_id;
  for (const s of lat.slots || []) {
    if (s.state !== 'missed') continue;
    out.push({ type: 'job_missed', severity: WEEKLY_JOBS.has(t) ? 'sev2' : 'sev3', job_id: t, dedupe_key: `job_missed:${t}:${s.slot}`,
               title: `${t} missed its ${s.slot} slot`, summary: `No run matched the scheduled slot ${s.slot} within its grace window.` });
  }
  const byRun = new Map();
  for (const r of runRows) { const x = byRun.get(r.run_id) || {}; x[r.phase] = r; byRun.set(r.run_id, x); }
  for (const rs of lat.run_states || []) {
    if (rs.state === 'lost') out.push({ type: 'job_lost', severity: 'sev2', job_id: t, run_id: rs.run_id, dedupe_key: `job_lost:${rs.run_id}`,
      title: `${t} run ${rs.run_id.slice(0, 8)} lost (started ${rs.started_at}, never ended)`, summary: 'Start event with no end event beyond expected_max_duration_s + 300 s.',
      snapshot: byRun.get(rs.run_id) });
  }
  const terminals = runRows.filter(r => r.phase === 'end').sort((a, b) => (a.started_at < b.started_at ? -1 : 1));
  for (let i = 0; i < terminals.length; i++) {
    const r = terminals[i];
    if (r.event_type !== 'failed' && r.event_type !== 'killed') continue;
    const last3 = terminals.slice(Math.max(0, i - 2), i + 1);
    const streak = last3.length === 3 && last3.every(x => x.event_type === 'failed' || x.event_type === 'killed');
    out.push({ type: 'job_failed', severity: streak ? 'sev2' : 'sev3', job_id: t, run_id: r.run_id, dedupe_key: `job_failed:${r.run_id}`,
               title: `${t} run ${r.run_id.slice(0, 8)} ${r.event_type} (${r.started_at})`, summary: `Terminal ${r.event_type} event.`, snapshot: byRun.get(r.run_id) });
  }
  if (lat.job_state === 'frozen') {
    const lastDone = terminals.filter(x => x.event_type === 'success' || x.event_type === 'partial').pop();
    const marker = lastDone?.cursor_after || 'f4';
    out.push({ type: 'job_frozen', severity: 'sev3', job_id: t, dedupe_key: `job_frozen:${t}:${marker}`,
               title: `${t} is frozen (no progress)`, summary: 'Same cursor_after on the last 3 productive runs, or items_attempted > 0 with items_progressed = 0 (F4).' });
  }
  return out;
}

async function sweep(request, env) {
  // 1. Hard switch — before any D1 access.
  if (env.OPS_SWEEP_ENABLED === 'false') {
    console.log('[ops-sweep] hard switch OPS_SWEEP_ENABLED=false: 202, 0 D1 reads');
    return jsonPrivate({ ok: true, swept: false, reason: 'sweep_disabled' }, 202);
  }
  // 2. Emitter authentication (001 key map), then body.
  const emitter = await authenticateEmitter(request, env);
  if (!emitter) return jsonPrivate({ ok: false, error: 'unauthorized' }, 401);
  const text = await request.text();
  if (new TextEncoder().encode(text).length > INGEST_MAX_BODY_BYTES) return jsonPrivate({ ok: false, error: 'body exceeds 8 KB' }, 400);
  let body;
  try { body = JSON.parse(text); } catch { return jsonPrivate({ ok: false, error: 'invalid JSON' }, 400); }
  if (!body || body.v !== 1) return jsonPrivate({ ok: false, error: 'unsupported contract version (expected v=1)' }, 400);
  if (typeof body.run_id !== 'string' || !ID_RE.test(body.run_id)) return jsonPrivate({ ok: false, error: 'run_id is required' }, 400);
  const days = Math.min(Math.max(parseInt(body.lookback_days ?? 7, 10) || 7, 1), MAX_LOOKBACK_DAYS);
  const now = Date.now();
  const w = { days, now, sinceIso: new Date(now - days * 86400000 - 10 * 60000).toISOString(), pauseSinceIso: new Date(now - days * 86400000).toISOString() };
  let rowsRead = 0;
  const meta = r => { rowsRead += r?.meta?.rows_read ?? 0; return r; };

  // 3. Registry (declared SCAN ≤ 60) and its switches.
  const reg = meta(await env.DB.prepare(`SELECT * FROM ops_job_registry`).all()).results;
  const control = reg.find(r => r.job_id === 'ops.ingest');
  const self = reg.find(r => r.job_id === SWEEP_JOB_ID);
  if (control && control.ingest_enabled === 0) return jsonPrivate({ ok: true, swept: false, reason: 'ingest_disabled' }, 202);
  if (!self) return jsonPrivate({ ok: false, error: 'unknown_job' }, 422);
  if (self.emitter_id !== emitter) return jsonPrivate({ ok: false, error: 'emitter not allowed for the sweep' }, 403);
  if (self.ingest_enabled === 0) return jsonPrivate({ ok: true, swept: false, reason: 'job_ingest_disabled' }, 202);

  // 4. Fleet lateness (L2 per emitting job, L3) + platform keys (PK IN on holdings_pipeline_state).
  const emitting = reg.filter(j => j.emitter_id && j.status !== 'retired');
  const today = new Date(now).toISOString().slice(0, 10);
  const dow = new Date(now).getUTCDay();
  const sunday = lastSundayUtc(now);
  const keys = ['hold_all_jobs', 'etf_offset', 'last_run_status'].concat(dow === 0 || dow === 1 ? [`writes_today_${sunday}`] : []);
  const res = await env.DB.batch([
    env.DB.prepare(`SELECT job_id, starts_at, ends_at, reason FROM ops_job_pause WHERE ends_at >= ?`).bind(w.pauseSinceIso),
    env.DB.prepare(`SELECT key, value FROM holdings_pipeline_state WHERE key IN (${keys.map(() => '?').join(', ')})`).bind(...keys),
    ...emitting.map(j => env.DB.prepare(L2_SQL).bind(j.job_id, w.sinceIso))
  ]);
  res.forEach(meta);
  const pauses = res[0].results;
  const state = Object.fromEntries(res[1].results.map(r => [r.key, r.value]));
  const findings = [];
  let raisedToday = 0;
  emitting.forEach((j, i) => {
    const runRows = res[i + 2].results;
    if (j.job_id === SWEEP_JOB_ID) {
      for (const r of runRows) {
        if (r.phase !== 'end' || !String(r.started_at).startsWith(today)) continue;
        try { raisedToday += Number(JSON.parse(r.detail || '{}')?.metrics?.raised) || 0; } catch { /* ignore */ }
      }
    }
    try {
      findings.push(...jobFindings(j, computeLateness(j, runRows, pauses, now, days), runRows));
    } catch (err) { console.log(`[ops-sweep] lateness error for ${j.job_id}: ${err && err.message}`); }
  });

  const hold = state.hold_all_jobs === 'true';
  if (hold) findings.push({ type: 'hold_active', severity: 'sev2', dedupe_key: `hold_active:${today}`, title: 'hold_all_jobs is TRUE', summary: 'All D1-writing pipelines are halted (shared kill switch).' });
  let headroom = null, d1 = null;
  try {
    d1 = await d1Totals(env);
    headroom = d1.daily_cap - d1.rowsWritten;
    if (headroom < 5000) findings.push({ type: 'budget_risk', severity: 'sev1', dedupe_key: `budget_risk:headroom:${today}`,
      title: `D1 headroom low: ${headroom} of ${d1.daily_cap} left today`, summary: 'Account rowsWritten from Cloudflare analytics (lags 25–30 min).' });
  } catch (err) { console.log(`[ops-sweep] d1Totals failed: ${err && err.message}`); }
  const sundayWrites = state[`writes_today_${sunday}`] != null ? parseInt(state[`writes_today_${sunday}`], 10) : null;
  if (sundayWrites !== null && sundayWrites >= 80000) findings.push({ type: 'budget_risk', severity: 'sev2', dedupe_key: `budget_risk:holdings_guard:${sunday}`,
      title: `Holdings Sunday ${sunday} reached the 80k guard (${sundayWrites})`, summary: 'ETF item (a): writes_today ≥ 80,000.' });
  else if (sundayWrites !== null && sundayWrites >= 75000) findings.push({ type: 'budget_risk', severity: 'sev3', dedupe_key: `budget_risk:holdings_sunday:${sunday}`,
      title: `Holdings Sunday ${sunday} writes ${sundayWrites} ≥ 75k`, summary: 'ETF item (a): baseline 70,672; warn ≥ 75,000.' });
  const total = parseInt(String(state.last_run_status || '').match(/:(\d+)\/(\d+)/)?.[2] ?? '', 10);
  const offset = parseInt(state.etf_offset ?? '', 10);
  const etf = { offset: Number.isFinite(offset) ? offset : null, total: Number.isFinite(total) ? total : null,
                weeks_to_complete: Number.isFinite(total) && Number.isFinite(offset) ? Math.ceil((total - offset) / 20) : null,
                last_run_status: state.last_run_status ?? null, sunday, sunday_writes: sundayWrites };

  // 5. Raise only NEW findings: dedupe pre-check (unique-index probes), then cap.
  const uniq = [...new Map(findings.map(f => [f.dedupe_key, f])).values()];
  let existing = new Set();
  for (let i = 0; i < uniq.length; i += 50) {
    const chunk = uniq.slice(i, i + 50).map(f => f.dedupe_key);
    const r = meta(await env.DB.prepare(`SELECT dedupe_key FROM ops_exception WHERE dedupe_key IN (${chunk.map(() => '?').join(', ')})`).bind(...chunk).all());
    r.results.forEach(x => existing.add(x.dedupe_key));
  }
  const fresh = uniq.filter(f => !existing.has(f.dedupe_key)).sort((a, b) => (SEV_ORDER[a.severity] - SEV_ORDER[b.severity]) || (a.dedupe_key < b.dedupe_key ? -1 : 1));
  const dailyCap = parseInt(env.OPS_SWEEP_DAILY_RAISE_CAP || '', 10) || SWEEP_DEFAULT_DAILY_RAISE_CAP;
  const allowed = Math.max(0, Math.min(SWEEP_RAISE_CAP, dailyCap - raisedToday));
  let toRaise = fresh.slice(0, allowed);
  let overflow = 0;
  if (fresh.length > allowed && allowed > 0) {
    overflow = fresh.length - (allowed - 1);
    toRaise = fresh.slice(0, allowed - 1);
    toRaise.push({ type: 'sweep_overflow', severity: 'sev2', dedupe_key: `sweep_overflow:${body.run_id}`,
                   title: `Sweep found ${overflow} more new findings than its per-call cap`, summary: `Per-call cap ${SWEEP_RAISE_CAP}; daily cap ${dailyCap} (raised today before this call: ${raisedToday}).` });
  }

  const nowIso = new Date(now).toISOString();
  const roleOf = new Map(reg.map(r => [r.job_id, r.owner_role]));
  async function raiseStmts(f, n) {
    const ref = await sweepCaseRef(f.dedupe_key, n);
    return [
      env.DB.prepare(`INSERT OR IGNORE INTO ops_exception (case_ref, exception_type, severity, status, title, summary, job_id, run_id, run_snapshot,
                        owner_role, raised_by, raised_via, dedupe_key) VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, 'ingest_auto', ?)`)
        .bind(ref, f.type, f.severity, f.title.slice(0, 200), (f.summary || '').slice(0, 500), f.job_id || null, f.run_id || null,
              f.snapshot ? JSON.stringify(f.snapshot).slice(0, 2000) : null, f.job_id ? roleOf.get(f.job_id) || null : null, `service:${emitter}`, f.dedupe_key),
      env.DB.prepare(`INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, actor, actor_source, occurred_at, idempotency_key)
                      SELECT 'exception', CAST(exception_id AS TEXT), 'raised', ?, 'ingest_key', ?, ? FROM ops_exception WHERE dedupe_key = ?`)
        .bind(`service:${emitter}`, nowIso, `raised:${f.dedupe_key}`, f.dedupe_key),
      ref
    ];
  }
  const raised = [];
  if (toRaise.length) {
    const built = await Promise.all(toRaise.map(f => raiseStmts(f, 12)));
    const out = await env.DB.batch(built.flatMap(([a, b]) => [a, b]));
    for (let i = 0; i < toRaise.length; i++) {
      const f = toRaise[i];
      if ((out[i * 2].meta?.changes ?? 0) > 0) { raised.push({ case_ref: built[i][2], type: f.type, severity: f.severity, title: f.title }); continue; }
      // Collision guard (R-E): changes = 0 for a finding pre-checked as absent.
      const hit = meta(await env.DB.prepare(`SELECT case_ref FROM ops_exception WHERE dedupe_key = ?`).bind(f.dedupe_key).all()).results[0];
      if (hit) continue;   // raised concurrently by another call — not new here
      console.log(`[ops-sweep] case_ref collision for ${f.dedupe_key}; retrying with 16 hex chars`);
      const [a, b, ref16] = await raiseStmts(f, 16);
      const r2 = await env.DB.batch([a, b]);
      if ((r2[0].meta?.changes ?? 0) > 0) raised.push({ case_ref: ref16, type: f.type, severity: f.severity, title: f.title });
    }
  }

  // 6. Open counts (covering idx_ops_exception_queue).
  const oc = meta(await env.DB.prepare(`SELECT severity, COUNT(*) AS n FROM ops_exception WHERE status = 'open' GROUP BY severity`).all()).results;
  return jsonPrivate({
    ok: true, run_id: body.run_id, lookback_days: days, hold_all_jobs: hold,
    headroom: d1 ? { rows_written: d1.rowsWritten, daily_cap: d1.daily_cap, headroom } : null,
    etf, findings: uniq.length, already_open: existing.size, new: raised, raised: raised.length,
    overflow, raised_today_before: raisedToday, daily_cap: dailyCap,
    open_counts: Object.fromEntries(oc.map(r => [r.severity, r.n])), rows_read: rowsRead
  });
}

async function handleAdmin(request, env, url, path, method) {
  const auth = await verifyAccessJwt(request, env);
  if (!auth.ok) return jsonPrivate({ ok: false, error: `unauthorized: ${auth.error}` }, 401);
  const who = { actor: auth.actor, actor_source: auth.actor_source };

  if (path === '/api/ops/admin/jobs' && method === 'GET') return await listJobs(env, url);
  return jsonPrivate({ ok: false, error: 'not found' }, 404);
}

// A6 rule 2: the governance GETs that moved to meridian-control (§13). A 302 (not
// 301) to the same path and query, carrying ACAO '*' so a cross-origin fetch from
// ma-ops.js follows it; 0 D1 reads. CONTROL_BASE_URL may override the target.
const MOVED_GET_PATHS = new Set(['/api/ops/sprint-board', '/api/ops/release-ledger', '/api/ops/events', '/api/ops/drift']);
const CONTROL_BASE_URL = 'https://meridian-control.navinmv1981.workers.dev';

function movedToControl(env, url) {
  const base = String(env.CONTROL_BASE_URL || CONTROL_BASE_URL).replace(/\/+$/, '');
  return new Response(null, {
    status: 302,
    headers: { Location: `${base}${url.pathname}${url.search}`, 'Cache-Control': 'no-store', ...CORS_HEADERS }
  });
}

// The 4 pre-001 anonymous POST paths: explicit deny, nothing is written.
const LEGACY_POST_RE = /^\/api\/ops\/(sprint-board(\/[^/]+\/stage)?|release-ledger(\/[^/]+\/event)?)$/;

// --- Router --------------------------------------------------------------

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const isPrivate = path.startsWith('/api/ops/admin/') || path.startsWith('/api/ops/ingest/');

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: isPrivate ? {} : CORS_HEADERS });
    }

    try {
      if (path.startsWith('/api/ops/admin/')) return await handleAdmin(request, env, url, path, method);
      if (path.startsWith('/api/ops/ingest/')) {
        if (path === '/api/ops/ingest/run-event' && method === 'POST') return await ingestRunEvent(request, env);
        if (path === '/api/ops/ingest/sweep' && method === 'POST') return await sweep(request, env);
        return jsonPrivate({ ok: false, error: 'not found' }, 404);
      }

      if (method === 'POST' && LEGACY_POST_RE.test(path)) {
        return json({ ok: false, error: 'moved to /api/ops/admin/…; authentication required' }, 401);
      }

      // Rule 2 (A6): the moved public GETs answer with a 302 to meridian-control.
      if ((method === 'GET' || method === 'HEAD') && MOVED_GET_PATHS.has(path)) return movedToControl(env, url);
      if (path === '/api/ops/budget-risk' && method === 'GET') return await budgetRisk(env);
      if (path === '/api/ops/openfigi-status' && method === 'GET') return await openFigiStatus(env);

      if (path === '/api/ops/cf/invocations' && method === 'GET') return await cfInvocations(env, url);
      if (path === '/api/ops/cf/d1-today' && method === 'GET') return await cfD1WritesToday(env);

      return json({ ok: false, error: 'not found' }, 404);
    } catch (err) {
      console.error('[meridian-ops] unhandled error:', err && err.message);
      return isPrivate
        ? jsonPrivate({ ok: false, error: 'internal error' }, 500)
        : json({ ok: false, error: err.message }, 500);
    }
  }
};
