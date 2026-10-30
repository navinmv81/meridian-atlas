// cases.js — MA-OCT-003 (spec rev 1 §6–§8, 7b8bba9f…80c2). Exception workflow routes
// for meridian-ops, imported by ops-api.js like lateness.js. Domain: Ops. Only writer
// of ops_* tables: meridian-ops. MA-OCT-004 (spec rev 1, 570de1a5…5379) extends it for
// DQ tickets: the DQ engine in C-1/C-2 (§7) and routes D-1, D-2, D-3 (§8).
//
// Routes (all under the Access app "meridian-ops admin"; ops-api.js has already
// re-verified the JWT and applied the service-token allowlist, serviceGate() below):
//   E-1  GET  /api/ops/admin/exceptions               queue (keyset)
//   E-2  POST /api/ops/admin/exceptions               manual create
//   C-1  GET  /api/ops/admin/cases/:case_ref          detail (EXC- or DQ-; DQ adds members, merged_into)
//   C-2  POST /api/ops/admin/cases/:case_ref/action   transitions (EXC- §7.1 of 003; DQ- §7.1 of 004)
//   D-1  GET  /api/ops/admin/dq-tickets               DQ list (keyset; object filter searches members)
//   D-2  POST /api/ops/admin/dq-tickets               DQ create (console, D-3 page, service callers)
//   D-3  GET  /api/ops/admin/dq/new                   007 link-out page (src/dq-page.js; 0 D1)
//
// Order of checks, each before any D1 access: allowlist (403) → OPS_CASES_ENABLED
// (503) → OPS_DQ_ENABLED for D-1/D-2/D-3 and DQ C-2 (503) → CSRF on POSTs (400, A3-5)
// → body and vocabulary validation (400) → caller class (403).
//
// Atomicity (§8.4): one db.batch() per action. Build note BN-1: the event row is
// written FIRST, capturing the case's pre-image in SQL, and the guarded UPDATE runs
// only if that event was just written (same idempotency key and :now). The
// invariant is the spec's: no state change without exactly one ops_case_event row,
// and a reused request_id never changes state (A3-3(a) NOT EXISTS guard). Writing
// the event first lets reopen keep the exact prior resolution (AC-6) and assign keep
// the exact prior owner, even under concurrent requests.
//
// Reads per call (§11.2): E-1 ≤ limit+1 per status; C-1 ≤ 230; C-2 ≤ 6 (+1 for
// duplicate_of); E-2 ≤ 6. Writes: action ≈ 6; manual create ≈ 13.
// 004 (§11.2): D-1 ≤ 3 × (limit+1) ≤ 303 (≤ 153 at the default limit); D-2 ≤ 120;
// DQ C-1 ≤ 405 typical, ≤ 500 with redirects; DQ C-2 ≤ 510 worst (resolve probes).

import { NAV_TYPES, navRef, ENTITY_KEY_RE, INSTRUMENT_KEY_RE, isPlaceholderKey, renderDqPage } from './dq-page.js';

// --- vocabularies (§6) -------------------------------------------------------

export const STATUSES = ['open', 'acknowledged', 'resolved', 'dismissed'];
export const SEVERITIES = ['sev1', 'sev2', 'sev3', 'sev4'];
export const RESOLVED_CODES = ['fixed', 'replayed', 'transient', 'accepted_risk', 'superseded'];
export const DISMISSED_CODES = ['false_positive', 'duplicate', 'not_actionable'];
export const EXCEPTION_TYPES = ['job_missed', 'job_lost', 'job_failed', 'job_frozen', 'hold_active', 'budget_risk', 'schedule_drift', 'sweep_overflow',
  'gleif_no_progress', 'gleif_stuck_in_progress', 'gleif_orphaned_backlog', 'gleif_frozen_source', 'local_auth_failure', 'blind_guard', 'manual'];
export const ROLES = ['Founder', 'Program Orchestrator', 'Architect', 'Operations Lead', 'Engineering Lead', 'UX Lead', 'Data-Identity Lead', 'ETF Product Lead'];
// R1C-ARC R1-1: one X-Ops-Client vocabulary for 003 and 004.
export const OPS_CLIENTS = ['console', 'script', 'service', 'dq-page'];
export const OBJECT_DOMAINS = { // 001 §5.3 key formats
  entity: /^\d{1,12}$/,
  instrument: /^(?:[A-Z]{2}[A-Z0-9]{9}\d|CUSIP:[0-9A-Z]{9}|[A-Za-z0-9:._-]{1,64})$/,
  etf: /^[A-Za-z0-9._:-]{1,64}$/,
  filing: /^\d{10}-\d{2}-\d{6}$/,
  bond: /^(?:\d{10}-\d{2}-\d{6}#\d{1,3}|[A-Z]{2}[A-Z0-9]{9}\d|CUSIP:[0-9A-Z]{9})$/,
  source_record: /^[a-z0-9_]{2,32}:\S{1,120}$/
};
const TRIAGE_TARGET_H = { sev1: 4, sev2: 24, sev3: 72, sev4: null };   // §7.2, display only

// --- 004 vocabularies (004 §6, §7.2, §7.3) ------------------------------------

export const DQ_STATUSES = ['open', 'triaged', 'fix_pending', 'resolved', 'dismissed'];
const DQ_OPEN = ['open', 'triaged', 'fix_pending'];
export const DQ_RESOLVED_CODES = ['fixed', 'source_absence', 'valid_exception', 'pipeline_omission', 'job_failure'];
export const DQ_DISMISSED_CODES = ['duplicate', 'not_a_problem', 'wont_fix'];
export const DQ_TYPES = [...NAV_TYPES, 'missing_entity', 'wrong_lei', 'no_link_marker', 'wrong_identifier', 'entity_merge',
  'bad_relationship_edge', 'isin_duplicate', 'gleif_handoff', 'data_error'];
// §7.5: every type except data_error is Entities data (resolve authority rules apply).
const ENTITIES_DATA_TYPES = new Set(DQ_TYPES.filter(t => t !== 'data_error'));
export const MEMBER_ACTIONS = ['replace_lei_t1', 'review', 'null_and_offline_match', 'dedupe', 'delete_edge', 'create_entity',
  'confirm_and_assign_lei', 'merge_then_assign_lei', 'merge_013', 'none'];
export const MEMBER_STATUSES = ['open', 'fixed', 'wont_fix', 'not_a_problem'];
// §6 key rules. instrument: E8 (bare ISIN keys, see dq-page.js); placeholders refused separately.
// bond: the spec's set plus '#', the accession#tranche_seq form 003's OBJECT_DOMAINS already uses.
export const DQ_OBJECT_DOMAINS = {
  entity: ENTITY_KEY_RE,
  instrument: INSTRUMENT_KEY_RE,
  bond: /^[A-Za-z0-9:._#-]{1,128}$/,
  etf: OBJECT_DOMAINS.etf,
  filing: OBJECT_DOMAINS.filing,
  source_record: /^[a-z][a-z0-9_.-]{1,40}:\S{1,120}$/
};
const DQ_TRIAGE_TARGET_H = { sev1: 4, sev2: 48, sev3: 168, sev4: null };   // 004 §7.4, display only
const DQ_D2_CLIENTS = ['console', 'dq-page', 'service'];                    // §8.4
const DQ_MAX_BODY_BYTES = 128 * 1024;                                         // members[] ≤ 100 × ≤ 1 KB
const MEMBER_CAP = 500;
const DQ_DEFAULT_DAILY_CREATE_CAP = 100;
const FIX_REF_RE = /^(?:MA-[A-Z]{3}-[A-Z0-9][A-Z0-9.-]{0,30}|[A-Za-z0-9-]{0,20}CR[A-Za-z0-9.-]{0,30})(?: .{1,100})?$/;

export function dqKeyOk(od, ok) {
  return typeof od === 'string' && typeof ok === 'string' && !!DQ_OBJECT_DOMAINS[od] && DQ_OBJECT_DOMAINS[od].test(ok)
    && !(od === 'instrument' && isPlaceholderKey(ok));
}
const jsonBytes = v => new TextEncoder().encode(JSON.stringify(v)).length;
const defaultSeverity = t => (t === 'wrong_lei' ? 'sev2' : t === 'low_confidence_mapping' ? 'sev4' : 'sev3');
const defaultOwner = t => (t === 'data_error' ? 'Operations Lead' : 'Data-Identity Lead');

// §7.1. `to: null` keeps the status. `set` names the columns the action may write.
export const ACTIONS = {
  acknowledge:  { from: ['open'], to: 'acknowledged', event: 'acknowledged' },
  assign:       { from: ['open', 'acknowledged'], to: null, event: 'assigned' },
  comment:      { from: STATUSES, to: null, event: 'commented' },
  set_severity: { from: ['open', 'acknowledged'], to: null, event: 'severity_changed' },
  resolve:      { from: ['open', 'acknowledged'], to: 'resolved', event: 'resolved' },
  dismiss:      { from: ['open', 'acknowledged'], to: 'dismissed', event: 'dismissed' },
  reopen:       { from: ['resolved', 'dismissed'], to: 'open', event: 'reopened' }
};

const CASE_REF_RE = /^(EXC|DQ)-(S-[0-9A-F]{12,16}|M-\d{6}|\d{6})$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const SERVICE_RE = /^service:[a-z0-9][a-z0-9._-]{0,63}$/;
const JOB_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_BODY_BYTES = 8 * 1024;

// --- small helpers (vendored from ops-api.js; no import back into it) --------

function jsonPrivate(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
export function redact(s) {
  return String(s).replace(/(bearer|authorization|secret|token|key)\s*[:=]\s*\S+/gi, '$1=[redacted]')
                  .replace(/[A-Za-z0-9_\-]{32,}/g, '[redacted]');
}
const err = (status, error, extra = {}) => jsonPrivate({ ok: false, error, ...extra }, status);
const nowIso = () => new Date().toISOString();
const rr = r => r?.meta?.rows_read ?? 0;

// --- §8.5 service-token allowlist --------------------------------------------

// Route id of an admin path, or 'other' (jobs, governance) — never allowed to a service token.
export function adminRouteId(path, method) {
  if (path === '/api/ops/admin/exceptions') return method === 'GET' ? 'E-1' : method === 'POST' ? 'E-2' : 'other';
  if (/^\/api\/ops\/admin\/cases\/[^/]+$/.test(path) && method === 'GET') return 'C-1';
  if (/^\/api\/ops\/admin\/cases\/[^/]+\/action$/.test(path) && method === 'POST') return 'C-2';
  if (path === '/api/ops/admin/dq-tickets') return method === 'GET' ? 'D-1' : method === 'POST' ? 'D-2' : 'other';
  if (path === '/api/ops/admin/dq/new' && method === 'GET') return 'D-3';
  return 'other';
}

// The only route ids a service-token entry may list (BREVA N-1); 004 adds D-1, D-2, D-3.
export const SERVICE_ROUTE_IDS = ['E-1', 'E-2', 'C-1', 'C-2', 'D-1', 'D-2', 'D-3'];

// OPS_SERVICE_ACTORS ([vars] JSON, identifiers only):
//   { "<Access common_name>": { "label": "ops-script", "routes": ["E-1",…], "actions": { "EXC": […], "DQ": […] } } }
// Returns { who } (possibly re-labelled) or { response } (403, before any D1 access).
export function serviceGate(env, auth, routeId) {
  const who = { actor: auth.actor, actor_source: auth.actor_source };
  if (auth.actor_source !== 'access_service_token') return { who };
  const commonName = String(auth.actor).replace(/^service:/, '');
  let map = {};
  try { map = env.OPS_SERVICE_ACTORS ? JSON.parse(env.OPS_SERVICE_ACTORS) : {}; } catch { map = {}; }   // unparseable → nobody (fail closed)
  const entry = map && typeof map === 'object' ? map[commonName] : null;
  if (!entry || typeof entry.label !== 'string' || !Array.isArray(entry.routes)) return { response: err(403, 'service_not_allowed') };
  // An entry listing any route outside the four case routes (e.g. 'other') is refused whole (fail closed).
  if (!entry.routes.every(r => SERVICE_ROUTE_IDS.includes(r))) return { response: err(403, 'service_not_allowed') };
  if (!entry.routes.includes(routeId)) return { response: err(403, 'service_route_not_allowed') };
  return { who: { actor: `service:${entry.label}`, actor_source: 'access_service_token', common_name: commonName, entry } };
}

function serviceActionAllowed(who, kind, action) {
  if (who.actor_source !== 'access_service_token') return true;
  const list = who.entry?.actions?.[kind];
  return Array.isArray(list) && list.includes(action);
}

// --- request guards (§8.3) ---------------------------------------------------

function csrfOk(request) {
  const ct = (request.headers.get('Content-Type') || '').toLowerCase();
  const client = request.headers.get('X-Ops-Client') || '';
  return /^application\/json(\s*;.*)?$/.test(ct) && OPS_CLIENTS.includes(client);
}

async function readBody(request, max = MAX_BODY_BYTES) {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > max) return { error: `body exceeds ${max / 1024} KB` };
  try { const b = JSON.parse(text); return b && typeof b === 'object' && !Array.isArray(b) ? { body: b } : { error: 'body must be a JSON object' }; }
  catch { return { error: 'invalid JSON' }; }
}

function optStr(v, max) { return v === undefined || v === null ? null : (typeof v === 'string' && v.length <= max ? v : undefined); }

// --- entry point ---------------------------------------------------------------

// Returns a Response for the 7 case and DQ routes, or null (not one of them).
export async function handleCases(request, env, url, path, method, who) {
  const routeId = adminRouteId(path, method);
  if (routeId === 'other') return null;
  if (env.OPS_CASES_ENABLED === 'false') return err(503, 'cases_disabled');
  let ref = null;
  if (routeId === 'C-1' || routeId === 'C-2') {
    try { ref = decodeURIComponent(path.split('/')[5] || ''); } catch { return err(400, 'invalid case_ref'); }
  }
  const dq = routeId.startsWith('D-') || (routeId === 'C-2' && ref.startsWith('DQ-'));
  if (dq && env.OPS_DQ_ENABLED === 'false') return err(503, 'dq_disabled');
  if ((routeId === 'E-2' || routeId === 'C-2' || routeId === 'D-2') && !csrfOk(request)) {
    return err(400, 'csrf: Content-Type application/json and X-Ops-Client (console|script|service|dq-page) are required');
  }
  if (routeId === 'E-1') return listExceptions(env, url);
  if (routeId === 'E-2') return createException(request, env, who);
  if (routeId === 'D-1') return listDqTickets(env, url);
  if (routeId === 'D-2') return createDqTicket(request, env, who);
  if (routeId === 'D-3') return renderDqPage(url, env.OPS_DQ_CONSUMER_ENABLED !== 'false');
  if (!CASE_REF_RE.test(ref)) return err(400, 'invalid case_ref');
  if (routeId === 'C-1') return caseDetail(env, ref, url);
  return caseAction(request, env, ref, who);
}

// --- E-1 queue -----------------------------------------------------------------

const LIST_COLS = `exception_id, case_ref, exception_type, severity, status, title, summary, job_id, run_id, object_domain, object_key,
                   owner_role, assignee, resolution, resolved_by, resolved_at, raised_by, raised_via, opened_at, updated_at`;

function decodeCursor(c) {
  if (!c) return null;
  try {
    const j = JSON.parse(atob(c.replace(/-/g, '+').replace(/_/g, '/')));
    if (SEVERITIES.includes(j.s) && typeof j.o === 'string' && Number.isInteger(j.i)) return j;
  } catch { /* fall through */ }
  return undefined;
}
const encodeCursor = r => btoa(JSON.stringify({ s: r.severity, o: r.opened_at, i: r.exception_id })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sortKey = (a, b) => (a.severity < b.severity ? -1 : a.severity > b.severity ? 1 : a.opened_at < b.opened_at ? -1 : a.opened_at > b.opened_at ? 1 : a.exception_id - b.exception_id);

export async function listExceptions(env, url) {
  const q = url.searchParams;
  const statuses = (q.get('status') || 'open,acknowledged').split(',').map(s => s.trim()).filter(Boolean);
  if (!statuses.length || statuses.some(s => !STATUSES.includes(s)) || new Set(statuses).size !== statuses.length) return err(400, 'invalid status');
  const severity = q.get('severity');
  if (severity && !SEVERITIES.includes(severity)) return err(400, 'invalid severity');
  const type = q.get('type');
  if (type && !EXCEPTION_TYPES.includes(type)) return err(400, 'invalid type');
  const jobId = q.get('job_id');
  if (jobId && !JOB_ID_RE.test(jobId)) return err(400, 'invalid job_id');
  const limit = Math.min(Math.max(parseInt(q.get('limit') || '50', 10) || 50, 1), 100);
  const cur = decodeCursor(q.get('cursor'));
  if (cur === undefined) return err(400, 'invalid cursor');

  // One keyset statement per status on idx_ops_exception_queue (status, severity, opened_at, rowid),
  // or on idx_ops_exception_job (job_id, opened_at) when job_id is given; merged here.
  const stmts = statuses.map(st => {
    const where = ['status = ?'], args = [st];
    if (jobId) { where.push('job_id = ?'); args.push(jobId); }
    if (severity) { where.push('severity = ?'); args.push(severity); }
    if (type) { where.push('exception_type = ?'); args.push(type); }
    if (cur) { where.push('(severity, opened_at, exception_id) > (?, ?, ?)'); args.push(cur.s, cur.o, cur.i); }
    const idx = jobId ? 'idx_ops_exception_job' : 'idx_ops_exception_queue';
    return env.DB.prepare(`SELECT ${LIST_COLS} FROM ops_exception INDEXED BY ${idx} WHERE ${where.join(' AND ')}
                           ORDER BY severity, opened_at, exception_id LIMIT ?`).bind(...args, limit + 1);
  });
  const res = await env.DB.batch(stmts);
  const rows = res.flatMap(r => r.results).sort(sortKey);
  const page = rows.slice(0, limit);
  const now = Date.now();
  const items = page.map(r => {
    const ageH = Math.max(0, (now - Date.parse(r.opened_at)) / 3600000);
    const target = TRIAGE_TARGET_H[r.severity];
    return { ...r, age_h: Math.round(ageH * 10) / 10, overdue: r.status === 'open' && target != null && ageH > target };
  });
  return jsonPrivate({ ok: true, statuses, items, next_cursor: rows.length > limit ? encodeCursor(page[page.length - 1]) : null,
                       rows_read: res.reduce((a, r) => a + rr(r), 0) });
}

// --- E-2 manual create -------------------------------------------------------

export async function createException(request, env, who) {
  const { body: b, error } = await readBody(request);
  if (error) return err(400, error);
  if (typeof b.request_id !== 'string' || !UUID_RE.test(b.request_id)) return err(400, 'request_id (UUID) is required');
  if (!EXCEPTION_TYPES.includes(b.exception_type)) return err(400, 'invalid exception_type');
  if (!SEVERITIES.includes(b.severity)) return err(400, 'invalid severity');
  if (typeof b.title !== 'string' || !b.title.trim() || b.title.length > 200) return err(400, 'title (1–200 chars) is required');
  if (typeof b.summary !== 'string' || !b.summary.trim() || b.summary.length > 500) return err(400, 'summary (1–500 chars) is required');
  if (!ROLES.includes(b.owner_role)) return err(400, 'invalid owner_role');
  const jobId = optStr(b.job_id, 128), runId = optStr(b.run_id, 128);
  if (jobId === undefined || (jobId && !JOB_ID_RE.test(jobId))) return err(400, 'invalid job_id');
  if (runId === undefined || (runId && !JOB_ID_RE.test(runId))) return err(400, 'invalid run_id');
  const od = optStr(b.object_domain, 32), ok = optStr(b.object_key, 160);
  if (od === undefined || ok === undefined || (od === null) !== (ok === null)) return err(400, 'object_domain and object_key go together');
  if (od && (!OBJECT_DOMAINS[od] || !OBJECT_DOMAINS[od].test(ok))) return err(400, 'invalid object_domain / object_key format');
  const actorRole = optStr(b.actor_role, 60);
  if (actorRole === undefined) return err(400, 'invalid actor_role');
  const rid = b.request_id.toLowerCase();
  let reads = 0;

  // Replay / reuse (A3-3(a)).
  const prior = await env.DB.prepare(`SELECT event_type, subject_type, subject_id FROM ops_case_event WHERE idempotency_key = ?`).bind(`act:${rid}`).all();
  reads += rr(prior);
  if (prior.results.length) {
    const p = prior.results[0];
    if (p.event_type !== 'created' || p.subject_type !== 'exception') return err(409, 'request_id_reused');
    const row = await env.DB.prepare(`SELECT * FROM ops_exception WHERE exception_id = ?`).bind(Number(p.subject_id)).all();
    return jsonPrivate({ ok: true, replay: true, case: row.results[0] || null, rows_read: reads + rr(row) });
  }
  if (jobId) {
    const j = await env.DB.prepare(`SELECT job_id FROM ops_job_registry WHERE job_id = ?`).bind(jobId).all();
    reads += rr(j);
    if (!j.results.length) return err(422, 'unknown job_id');
  }
  let snapshot = null;
  if (runId) {
    const r = await env.DB.prepare(`SELECT run_id, phase, event_type, job_id, started_at, ended_at, error_class, error_summary, items_attempted, items_progressed
                                    FROM ops_job_run WHERE run_id = ?`).bind(runId).all();
    reads += rr(r);
    if (!r.results.length) return err(422, 'unknown run_id (not in the run ledger)');
    if (jobId && r.results.some(x => x.job_id !== jobId)) return err(422, 'run_id belongs to another job');
    snapshot = JSON.stringify(r.results).slice(0, 2000);
  }
  const now = nowIso();
  const pending = `EXC-PENDING-${rid}`, dedupe = `manual:${rid}`;
  const res = await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO ops_exception (case_ref, exception_type, severity, status, title, summary, job_id, run_id, run_snapshot,
                      object_domain, object_key, owner_role, raised_by, raised_via, dedupe_key, opened_at, updated_at)
                    VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ops_console', ?, ?, ?)`)
      .bind(pending, b.exception_type, b.severity, redact(b.title), redact(b.summary), jobId, runId, snapshot, od, ok, b.owner_role, who.actor, dedupe, now, now),
    env.DB.prepare(`UPDATE ops_exception SET case_ref = 'EXC-' || printf('%06d', exception_id) WHERE case_ref = ?`).bind(pending),
    env.DB.prepare(`INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, to_value, payload, actor, actor_source, actor_role, occurred_at, idempotency_key)
                    SELECT 'exception', CAST(exception_id AS TEXT), 'created', 'open', ?, ?, ?, ?, ?, ? FROM ops_exception WHERE dedupe_key = ?`)
      .bind(JSON.stringify({ case_ref_pending: pending, ...(who.common_name ? { common_name: who.common_name } : {}) }), who.actor, who.actor_source, actorRole, now, `act:${rid}`, dedupe)
  ]);
  reads += res.reduce((a, r) => a + rr(r), 0);
  const row = await env.DB.prepare(`SELECT * FROM ops_exception WHERE dedupe_key = ?`).bind(dedupe).all();
  reads += rr(row);
  return jsonPrivate({ ok: true, case: row.results[0] || null, rows_read: reads }, (res[0].meta?.changes ?? 0) > 0 ? 201 : 200);
}

// --- C-1 detail ------------------------------------------------------------------

export async function caseDetail(env, ref, url) {
  let reads = 0;
  if (ref.startsWith('EXC-')) {
    const c = await env.DB.prepare(`SELECT * FROM ops_exception WHERE case_ref = ?`).bind(ref).all();
    reads += rr(c);
    const row = c.results[0];
    if (!row) return err(404, 'not found');
    const stmts = [
      env.DB.prepare(`SELECT event_id, event_type, from_value, to_value, body, payload, actor, actor_source, actor_role, occurred_at, recorded_at
                      FROM ops_case_event WHERE subject_type = 'exception' AND subject_id = ? ORDER BY occurred_at LIMIT 200`).bind(String(row.exception_id)),
      env.DB.prepare(`SELECT case_ref, ticket_type, severity, status, title, object_domain, object_key, opened_at
                      FROM ops_data_quality_ticket WHERE linked_exception_ref = ? LIMIT 20`).bind(ref)
    ];
    if (row.job_id) stmts.push(env.DB.prepare(`SELECT * FROM ops_job_registry WHERE job_id = ?`).bind(row.job_id));
    if (row.run_id) stmts.push(env.DB.prepare(`SELECT run_id, phase, event_type, started_at, ended_at, rows_read, rows_written, items_attempted, items_progressed,
                                                      error_class, error_summary, detail FROM ops_job_run WHERE run_id = ?`).bind(row.run_id));
    const r = await env.DB.batch(stmts);
    reads += r.reduce((a, x) => a + rr(x), 0);
    let i = 2;
    const registry = row.job_id ? (r[i++].results[0] || null) : null;
    const runs = row.run_id ? r[i++].results : [];
    return jsonPrivate({ ok: true, kind: 'exception', case: row, events: r[0].results, linked_dq_tickets: r[1].results, registry, runs, rows_read: reads });
  }
  // 004 §8.2: members in UNIQUE-autoindex order (object_domain, object_key), ≤ 200 a page, keyset
  // ?members_after=<domain>|<key> (N4-2); merged_into for every entity key (§7.6, A4-4).
  const after = url ? url.searchParams.get('members_after') : null;
  let afterKey = null;
  if (after) {
    const cut = after.indexOf('|');
    afterKey = cut > 0 ? [after.slice(0, cut), after.slice(cut + 1)] : null;
    if (!afterKey || !dqKeyOk(afterKey[0], afterKey[1])) return err(400, 'invalid members_after');
  }
  const c = await env.DB.prepare(`SELECT * FROM ops_data_quality_ticket WHERE case_ref = ?`).bind(ref).all();
  reads += rr(c);
  const row = c.results[0];
  if (!row) return err(404, 'not found');
  const stmts = [
    env.DB.prepare(`SELECT event_id, event_type, from_value, to_value, body, payload, actor, actor_source, actor_role, occurred_at, recorded_at
                    FROM ops_case_event WHERE subject_type = 'dq_ticket' AND subject_id = ? ORDER BY occurred_at LIMIT 200`).bind(String(row.ticket_id)),
    afterKey
      ? env.DB.prepare(`SELECT ${MEMBER_COLS} FROM ops_dq_ticket_member WHERE ticket_id = ? AND (object_domain, object_key) > (?, ?)
                        ORDER BY object_domain, object_key LIMIT 201`).bind(row.ticket_id, afterKey[0], afterKey[1])
      : env.DB.prepare(`SELECT ${MEMBER_COLS} FROM ops_dq_ticket_member WHERE ticket_id = ? ORDER BY object_domain, object_key LIMIT 201`).bind(row.ticket_id)
  ];
  if (row.linked_exception_ref) stmts.push(env.DB.prepare(`SELECT case_ref, exception_type, severity, status, title, job_id, opened_at FROM ops_exception WHERE case_ref = ?`).bind(row.linked_exception_ref));
  if (row.job_id) stmts.push(env.DB.prepare(`SELECT * FROM ops_job_registry WHERE job_id = ?`).bind(row.job_id));
  const r = await env.DB.batch(stmts);
  reads += r.reduce((a, x) => a + rr(x), 0);
  let i = 2;
  const linked = row.linked_exception_ref ? (r[i++].results[0] || null) : null;
  const registry = row.job_id ? (r[i++].results[0] || null) : null;
  const members = r[1].results.slice(0, 200);
  const last = members[members.length - 1];
  const entityIds = [...new Set([...(row.object_domain === 'entity' ? [row.object_key] : []),
                                 ...members.filter(m => m.object_domain === 'entity').map(m => m.object_key)])];
  const merged = await mergedInto(env, entityIds, x => { reads += rr(x); });
  for (const m of members) if (m.object_domain === 'entity' && merged[m.object_key]) m.merged_into = merged[m.object_key];
  const ticket = row.object_domain === 'entity' && merged[row.object_key] ? { ...row, merged_into: merged[row.object_key] } : row;
  return jsonPrivate({ ok: true, kind: 'dq_ticket', case: ticket, events: r[0].results, members,
                       members_cursor: r[1].results.length > 200 ? `${last.object_domain}|${last.object_key}` : null,
                       linked_exception: linked, registry, rows_read: reads });
}

const MEMBER_COLS = 'member_id, object_domain, object_key, object_ref, proposed_action, member_status, note, updated_at';

// §7.6 (A4-4): entity_id → survivor through entity_merge_redirect (013, Entities domain; read-only here).
// PK probes, one IN statement per hop level, ≤ 5 hops, cycle-guarded; a missing table means "no redirects"
// (the 007 R3 pattern). Keys are never rewritten. Returns { "<id>": <survivor id> }.
async function mergedInto(env, ids, count) {
  const out = {};
  let frontier = ids.filter(id => ENTITY_KEY_RE.test(String(id))).map(id => ({ id: String(id), cur: Number(id), seen: [Number(id)] }));
  for (let hop = 0; hop < 5 && frontier.length; hop++) {
    let res;
    try {
      res = await env.DB.prepare(`SELECT duplicate_id, survivor_id FROM entity_merge_redirect WHERE duplicate_id IN (${frontier.map(() => '?').join(', ')})`)
        .bind(...frontier.map(f => f.cur)).all();
    } catch (e) {
      if (/no such table/i.test(String(e && e.message || e))) return out;   // 013 has not created it yet
      throw e;
    }
    count(res);
    const next = new Map(res.results.map(x => [Number(x.duplicate_id), Number(x.survivor_id)]));
    frontier = frontier.flatMap(f => {
      const s = next.get(f.cur);
      if (s === undefined || f.seen.includes(s)) return [];
      out[f.id] = s;
      return [{ ...f, cur: s, seen: [...f.seen, s] }];
    });
  }
  return out;
}

// --- C-2 transitions -----------------------------------------------------------

// Validates the action body before any D1 access. Returns { plan } or { error }.
export function validateAction(b) {
  const spec = ACTIONS[b.action];
  if (!spec) return { error: 'unknown action' };
  if (!STATUSES.includes(b.expected_status)) return { error: 'expected_status is required' };
  if (typeof b.request_id !== 'string' || !UUID_RE.test(b.request_id)) return { error: 'request_id (UUID) is required' };
  const note = optStr(b.note, 2000);
  if (note === undefined) return { error: 'note must be a string of at most 2,000 characters' };
  const actorRole = optStr(b.actor_role, 60);
  if (actorRole === undefined) return { error: 'invalid actor_role' };
  const plan = { action: b.action, spec, expected: b.expected_status, rid: b.request_id.toLowerCase(), note: note ? redact(note) : null, actorRole, set: {} };
  switch (b.action) {
    case 'assign': {
      const role = optStr(b.owner_role, 60), asg = optStr(b.assignee, 255);
      if (role === undefined || asg === undefined || (role === null && asg === null)) return { error: 'owner_role and/or assignee is required' };
      if (role !== null && !ROLES.includes(role)) return { error: 'invalid owner_role' };
      if (asg !== null && !EMAIL_RE.test(asg) && !SERVICE_RE.test(asg)) return { error: 'assignee must be an email or service:<name>' };
      if (role !== null) plan.set.owner_role = role;
      if (asg !== null) plan.set.assignee = asg;
      break;
    }
    case 'comment':
      if (!plan.note || !plan.note.trim()) return { error: 'note is required' };
      break;
    case 'set_severity':
      if (!SEVERITIES.includes(b.severity)) return { error: 'invalid severity' };
      if (!plan.note) return { error: 'note is required' };
      plan.set.severity = b.severity;
      break;
    case 'resolve':
      if (!RESOLVED_CODES.includes(b.resolution)) return { error: `resolution must be one of ${RESOLVED_CODES.join(', ')}` };
      if (!plan.note) return { error: 'note is required' };
      plan.set.resolution = b.resolution;
      break;
    case 'dismiss':
      if (!DISMISSED_CODES.includes(b.resolution)) return { error: `resolution must be one of ${DISMISSED_CODES.join(', ')}` };
      if (!plan.note) return { error: 'note is required' };
      if (b.resolution === 'duplicate') {
        if (typeof b.duplicate_of !== 'string' || !CASE_REF_RE.test(b.duplicate_of) || !b.duplicate_of.startsWith('EXC-')) return { error: 'duplicate_of (an EXC- case_ref) is required' };
        plan.duplicateOf = b.duplicate_of;
      }
      plan.set.resolution = b.resolution;
      break;
    case 'reopen':
      if (!plan.note) return { error: 'note is required' };
      break;
    default:
      break;
  }
  return { plan };
}

// SET clause per action (§8.4: chosen per action, never one generic statement).
function setClause(plan, actor, now) {
  const cols = [], args = [];
  const add = (c, v) => { cols.push(`${c} = ?`); args.push(v); };
  if (plan.spec.to) add('status', plan.spec.to);
  for (const [c, v] of Object.entries(plan.set)) add(c, v);
  if (plan.action === 'resolve' || plan.action === 'dismiss') { add('resolved_by', actor); add('resolved_at', now); }
  if (plan.action === 'reopen') { cols.push('resolution = NULL', 'resolved_by = NULL', 'resolved_at = NULL'); }
  add('updated_at', now);
  return { sql: cols.join(', '), args };
}

const PRE_IMAGE = `json_object('status', status, 'severity', severity, 'owner_role', owner_role, 'assignee', assignee,
                               'resolution', resolution, 'resolved_by', resolved_by, 'resolved_at', resolved_at)`;

export async function caseAction(request, env, ref, who) {
  const kind = ref.startsWith('EXC-') ? 'EXC' : 'DQ';
  const { body: b, error } = await readBody(request, kind === 'DQ' ? DQ_MAX_BODY_BYTES : MAX_BODY_BYTES);
  if (error) return err(400, error);
  if (!serviceActionAllowed(who, kind, b.action)) return err(403, 'service_action_not_allowed');
  if (kind === 'DQ') return dqAction(env, ref, who, b);
  const { plan, error: verr } = validateAction(b);
  if (verr) return err(400, verr);
  const key = `act:${plan.rid}`;
  let reads = 0;
  const current = async () => {
    const r = await env.DB.prepare(`SELECT * FROM ops_exception WHERE case_ref = ?`).bind(ref).all();
    reads += rr(r);
    return r.results[0] || null;
  };

  // 1. Replay / reuse of the request_id (A3-3(a)).
  const prior = await env.DB.prepare(`SELECT event_type, subject_type, subject_id FROM ops_case_event WHERE idempotency_key = ?`).bind(key).all();
  reads += rr(prior);
  const row = await current();
  if (!row) return err(404, 'not found');
  const replayOrReuse = p => (p.subject_type === 'exception' && p.subject_id === String(row.exception_id) && p.event_type === plan.spec.event
    ? jsonPrivate({ ok: true, replay: true, case: row, rows_read: reads })
    : err(409, 'request_id_reused', { current: row, rows_read: reads }));
  if (prior.results.length) return replayOrReuse(prior.results[0]);

  // 2. Stale expected_status, then the transition table.
  if (row.status !== plan.expected) return err(409, 'stale_expected_status', { current: row, rows_read: reads });
  if (!plan.spec.from.includes(row.status)) return err(409, 'illegal_transition', { current: row, rows_read: reads });
  if (plan.duplicateOf) {
    if (plan.duplicateOf === ref) return err(400, 'duplicate_of cannot be the case itself');
    const d = await env.DB.prepare(`SELECT case_ref FROM ops_exception WHERE case_ref = ?`).bind(plan.duplicateOf).all();
    reads += rr(d);
    if (!d.results.length) return err(422, 'duplicate_of not found');
  }

  // 3. One batch: event first (pre-image captured in SQL), then the guarded UPDATE (BN-1).
  const now = nowIso();
  const to = plan.spec.to || plan.expected;
  const payloadExtra = { action: plan.action, ...plan.set, ...(plan.duplicateOf ? { duplicate_of: plan.duplicateOf } : {}),
                         ...(who.common_name ? { common_name: who.common_name } : {}) };
  const set = setClause(plan, who.actor, now);
  const res = await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, from_value, to_value, body, payload, actor, actor_source, actor_role, occurred_at, idempotency_key)
                    SELECT 'exception', CAST(exception_id AS TEXT), ?, status, ?, ?, json_object('before', json(${PRE_IMAGE}), 'request', json(?)), ?, ?, ?, ?, ?
                      FROM ops_exception
                     WHERE case_ref = ? AND status = ? AND NOT EXISTS (SELECT 1 FROM ops_case_event WHERE idempotency_key = ?)`)
      .bind(plan.spec.event, to, plan.note, JSON.stringify(payloadExtra), who.actor, who.actor_source, plan.actorRole, now, key, ref, plan.expected, key),
    env.DB.prepare(`UPDATE ops_exception SET ${set.sql}
                     WHERE case_ref = ? AND status = ?
                       AND EXISTS (SELECT 1 FROM ops_case_event WHERE idempotency_key = ? AND occurred_at = ? AND subject_type = 'exception'
                                                                 AND subject_id = CAST(ops_exception.exception_id AS TEXT))`)
      .bind(...set.args, ref, plan.expected, key, now)
  ]);
  reads += res.reduce((a, r) => a + rr(r), 0);
  const applied = (res[1].meta?.changes ?? 0) > 0;
  const after = await current();
  if (applied) return jsonPrivate({ ok: true, case: after, event: plan.spec.event, rows_read: reads });
  // Lost a race: replay of the same request, or a stale expected_status.
  const p2 = await env.DB.prepare(`SELECT event_type, subject_type, subject_id FROM ops_case_event WHERE idempotency_key = ?`).bind(key).all();
  reads += rr(p2);
  if (p2.results.length) return replayOrReuse(p2.results[0]);
  return err(409, after && after.status !== plan.expected ? 'stale_expected_status' : 'not_applied', { current: after, rows_read: reads });
}

// =============================================================================
// MA-OCT-004 — DQ tickets (spec rev 1 §7, §8; A4-2, A4-3, A4-4; 004-6, 004-9)
// =============================================================================

// --- C-2 on DQ- refs (§7.1). `member: true` = a member-level action (A4-3 pattern). ---

export const DQ_ACTIONS = {
  triage:         { from: ['open'], to: 'triaged', event: 'triaged' },
  schedule_fix:   { from: ['open', 'triaged'], to: 'fix_pending', event: 'fix_scheduled' },
  assign:         { from: DQ_OPEN, to: null, event: 'assigned' },
  comment:        { from: DQ_STATUSES, to: null, event: 'commented' },
  set_severity:   { from: DQ_OPEN, to: null, event: 'severity_changed' },
  link_exception: { from: DQ_OPEN, to: null, event: 'linked' },
  resolve:        { from: DQ_OPEN, to: 'resolved', event: 'resolved' },
  dismiss:        { from: DQ_OPEN, to: 'dismissed', event: 'dismissed' },
  reopen:         { from: ['resolved', 'dismissed'], to: 'open', event: 'reopened' },
  add_members:    { from: DQ_OPEN, to: null, event: 'members_added', member: true },
  member_update:  { from: DQ_OPEN, to: null, event: 'member_updated', member: true }
};
// §7.5: a service token never resolves, dismisses or reopens a DQ ticket, nor marks a member fixed,
// whatever OPS_SERVICE_ACTORS lists (checked before D1, after the allowlist).
const SERVICE_NEVER = new Set(['resolve', 'dismiss', 'reopen']);

function validateMember(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) return 'each member must be an object';
  if (!dqKeyOk(m.object_domain, m.object_key)) return 'invalid member object_domain / object_key';
  if (m.proposed_action != null && !MEMBER_ACTIONS.includes(m.proposed_action)) return 'invalid member proposed_action';
  if (m.object_ref != null && (typeof m.object_ref !== 'object' || Array.isArray(m.object_ref) || jsonBytes(m.object_ref) > 1024)) return 'member object_ref must be a JSON object of at most 1 KB';
  return null;
}
function validateMembers(list, max) {
  if (!Array.isArray(list) || list.length > max) return { error: `members must be an array of at most ${max}` };
  const seen = new Set();
  for (const m of list) {
    const e = validateMember(m);
    if (e) return { error: e };
    const k = `${m.object_domain}|${m.object_key}`;
    if (seen.has(k)) return { error: 'duplicate member in the request' };
    seen.add(k);
  }
  return { rows: list.map(m => ({ object_domain: m.object_domain, object_key: m.object_key,
                                   object_ref: m.object_ref ? JSON.stringify(m.object_ref) : null, proposed_action: m.proposed_action ?? null })) };
}

// Validates a DQ action body before any D1 access. Returns { plan } or { error }.
export function validateDqAction(b) {
  const spec = DQ_ACTIONS[b.action];
  if (!spec) return { error: 'unknown action' };
  if (!DQ_STATUSES.includes(b.expected_status)) return { error: 'expected_status is required' };
  if (typeof b.request_id !== 'string' || !UUID_RE.test(b.request_id)) return { error: 'request_id (UUID) is required' };
  const note = optStr(b.note, 2000);
  if (note === undefined) return { error: 'note must be a string of at most 2,000 characters' };
  const actorRole = optStr(b.actor_role, 60);
  if (actorRole === undefined) return { error: 'invalid actor_role' };
  const plan = { action: b.action, spec, expected: b.expected_status, rid: b.request_id.toLowerCase(), note: note && note.trim() ? redact(note) : null,
                 actorRole, set: {}, top: {} };
  const noteRequired = !['triage', 'assign', 'link_exception', 'add_members', 'member_update'].includes(b.action);
  if (noteRequired && !plan.note) return { error: 'note is required' };
  switch (b.action) {
    case 'triage':
      if (!ROLES.includes(b.owner_role)) return { error: 'owner_role is required' };
      plan.set.owner_role = b.owner_role;
      if (b.severity !== undefined) {
        if (!SEVERITIES.includes(b.severity)) return { error: 'invalid severity' };
        plan.set.severity = b.severity;
      }
      break;
    case 'schedule_fix':
      if (typeof b.fix_ref !== 'string' || !FIX_REF_RE.test(b.fix_ref)) return { error: 'fix_ref (an MA-… packet or a CR id) is required' };
      plan.top.fix_ref = b.fix_ref;     // N4-4: lives only in the event payload; proposed_resolution is never rewritten
      break;
    case 'assign': {
      const role = optStr(b.owner_role, 60), asg = optStr(b.assignee, 255);
      if (role === undefined || asg === undefined || (role === null && asg === null)) return { error: 'owner_role and/or assignee is required' };
      if (role !== null && !ROLES.includes(role)) return { error: 'invalid owner_role' };
      if (asg !== null && !EMAIL_RE.test(asg) && !SERVICE_RE.test(asg)) return { error: 'assignee must be an email or service:<name>' };
      if (role !== null) plan.set.owner_role = role;
      if (asg !== null) plan.set.assignee = asg;
      break;
    }
    case 'set_severity':
      if (!SEVERITIES.includes(b.severity)) return { error: 'invalid severity' };
      plan.set.severity = b.severity;
      break;
    case 'link_exception':
      if (typeof b.exception_ref !== 'string' || !CASE_REF_RE.test(b.exception_ref) || !b.exception_ref.startsWith('EXC-')) return { error: 'exception_ref (an EXC- case_ref) is required' };
      plan.set.linked_exception_ref = b.exception_ref;
      break;
    case 'resolve':
      if (!DQ_RESOLVED_CODES.includes(b.disposition)) return { error: `disposition must be one of ${DQ_RESOLVED_CODES.join(', ')}` };
      if (b.force !== undefined && typeof b.force !== 'boolean') return { error: 'force must be a boolean' };
      plan.force = b.force === true;
      plan.set.disposition = b.disposition;
      break;
    case 'dismiss':
      if (!DQ_DISMISSED_CODES.includes(b.disposition)) return { error: `disposition must be one of ${DQ_DISMISSED_CODES.join(', ')}` };
      if (b.disposition === 'duplicate') {
        if (typeof b.duplicate_of !== 'string' || !CASE_REF_RE.test(b.duplicate_of) || !b.duplicate_of.startsWith('DQ-')) return { error: 'duplicate_of (a DQ- case_ref) is required' };
        plan.duplicateOf = b.duplicate_of;
      }
      plan.set.disposition = b.disposition;
      break;
    case 'reopen': {
      const fs = b.founder_supersession;
      if (fs !== undefined) {
        if (!fs || typeof fs !== 'object' || typeof fs.reference !== 'string' || !fs.reference.trim() || fs.reference.length > 200
            || typeof fs.decided_at !== 'string' || !/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?$/.test(fs.decided_at)) {
          return { error: 'founder_supersession must be {reference, decided_at}' };
        }
        plan.top.founder_supersession = { reference: redact(fs.reference), decided_at: fs.decided_at };
      }
      break;
    }
    case 'add_members': {
      if (!Array.isArray(b.members) || !b.members.length) return { error: 'members (1–100) is required' };
      const v = validateMembers(b.members, 100);
      if (v.error) return { error: v.error };
      plan.members = v.rows;
      break;
    }
    case 'member_update': {
      const m = b.member;
      if (!m || typeof m !== 'object' || !dqKeyOk(m.object_domain, m.object_key)) return { error: 'member {object_domain, object_key} is required' };
      if (!MEMBER_STATUSES.includes(b.member_status) || !MEMBER_STATUSES.includes(b.expected_member_status)) return { error: 'member_status and expected_member_status are required' };
      if (b.member_status === b.expected_member_status) return { error: 'member_status must differ from expected_member_status' };
      if (plan.note && plan.note.length > 500) return { error: 'a member note is at most 500 characters' };
      if (b.member_status === 'fixed' && !plan.note) return { error: 'note naming the applied fix packet is required' };
      plan.member = { od: m.object_domain, ok: m.object_key, from: b.expected_member_status, to: b.member_status };
      break;
    }
    default:
      break;
  }
  return { plan };
}

function dqSetClause(plan, actor, now) {
  const cols = [], args = [];
  const add = (c, v) => { cols.push(`${c} = ?`); args.push(v); };
  if (plan.spec.to) add('status', plan.spec.to);
  for (const [c, v] of Object.entries(plan.set)) add(c, v);
  if (plan.action === 'resolve' || plan.action === 'dismiss') { add('resolution_note', plan.note); add('resolved_by', actor); add('resolved_at', now); }
  if (plan.action === 'reopen') cols.push('disposition = NULL', 'resolution_note = NULL', 'resolved_by = NULL', 'resolved_at = NULL');
  add('updated_at', now);
  return { sql: cols.join(', '), args };
}

const DQ_PRE_IMAGE = `json_object('status', status, 'severity', severity, 'owner_role', owner_role, 'assignee', assignee, 'disposition', disposition,
                                  'resolution_note', resolution_note, 'resolved_by', resolved_by, 'resolved_at', resolved_at,
                                  'linked_exception_ref', linked_exception_ref)`;
const NO_OPEN_MEMBER = `NOT EXISTS (SELECT 1 FROM ops_dq_ticket_member m WHERE m.ticket_id = ops_data_quality_ticket.ticket_id AND m.member_status = 'open')`;

export async function dqAction(env, ref, who, b) {
  const { plan, error } = validateDqAction(b);
  if (error) return err(400, error);
  if (who.actor_source === 'access_service_token'
      && (SERVICE_NEVER.has(plan.action) || (plan.action === 'member_update' && plan.member.to === 'fixed'))) return err(403, 'service_action_not_allowed');
  const key = `act:${plan.rid}`;
  let reads = 0;
  const q = async s => { const r = await s.all(); reads += rr(r); return r.results; };
  const load = async () => (await q(env.DB.prepare(`SELECT * FROM ops_data_quality_ticket WHERE case_ref = ?`).bind(ref)))[0] || null;
  const priorOf = () => q(env.DB.prepare(`SELECT event_type, subject_type, subject_id, payload FROM ops_case_event WHERE idempotency_key = ?`).bind(key));

  // 1. Replay / reuse of the request_id (A3-3(a)); for member_update the member must match too (AC-9.3).
  const prior = await priorOf();
  const row = await load();
  if (!row) return err(404, 'not found');
  const sameMember = p => {
    if (plan.action !== 'member_update') return true;
    try { const j = JSON.parse(p.payload || '{}'); return j.object_domain === plan.member.od && j.object_key === plan.member.ok; } catch { return false; }
  };
  const replayOrReuse = p => (p.subject_type === 'dq_ticket' && p.subject_id === String(row.ticket_id) && p.event_type === plan.spec.event && sameMember(p)
    ? jsonPrivate({ ok: true, replay: true, case: row, rows_read: reads })
    : err(409, 'request_id_reused', { current: row, rows_read: reads }));
  if (prior.length) return replayOrReuse(prior[0]);

  // 2. Stale expected_status, the transition table, then the per-action preconditions.
  if (row.status !== plan.expected) return err(409, 'stale_expected_status', { current: row, rows_read: reads });
  if (!plan.spec.from.includes(row.status)) return err(409, 'illegal_transition', { current: row, rows_read: reads });
  const entities = ENTITIES_DATA_TYPES.has(row.ticket_type);
  if (plan.action === 'reopen' && row.disposition === 'do_not_merge' && !plan.top.founder_supersession) {
    return err(409, 'protected_decision', { detail: 'reopening a do_not_merge decision needs founder_supersession {reference, decided_at} (004-6)', current: row, rows_read: reads });
  }
  if (plan.action === 'link_exception') {
    if (row.linked_exception_ref === plan.set.linked_exception_ref) return err(409, 'already_linked', { current: row, rows_read: reads });
    if (!(await q(env.DB.prepare(`SELECT case_ref FROM ops_exception WHERE case_ref = ?`).bind(plan.set.linked_exception_ref))).length) return err(422, 'exception_ref not found');
  }
  if (plan.duplicateOf) {
    if (plan.duplicateOf === ref) return err(400, 'duplicate_of cannot be the ticket itself');
    if (!(await q(env.DB.prepare(`SELECT case_ref FROM ops_data_quality_ticket WHERE case_ref = ?`).bind(plan.duplicateOf))).length) return err(422, 'duplicate_of not found');
  }
  if (plan.action === 'resolve' && !plan.force) {
    const open = await q(env.DB.prepare(`SELECT 1 AS x FROM ops_dq_ticket_member WHERE ticket_id = ? AND member_status = 'open' LIMIT 1`).bind(row.ticket_id));
    if (open.length) return err(409, 'members_open', { detail: 'resolve with force: true and a note naming why', rows_read: reads });
  }
  if (plan.action === 'resolve' && plan.force) plan.top.force = true;
  const needsFix = (plan.action === 'resolve' && plan.set.disposition === 'fixed') || (plan.action === 'member_update' && plan.member.to === 'fixed');
  if (needsFix && entities) {   // §7.5: one probe on idx_ops_case_event_subject
    const f = await q(env.DB.prepare(`SELECT 1 AS x FROM ops_case_event WHERE subject_type = 'dq_ticket' AND subject_id = ? AND event_type = 'fix_scheduled' LIMIT 1`).bind(String(row.ticket_id)));
    if (!f.length) return err(409, 'fix_not_scheduled', { detail: 'schedule_fix with the Data-Identity Lead fix_ref first (§7.5)', rows_read: reads });
  }

  const now = nowIso();
  const request = { action: plan.action, ...plan.set, ...(plan.duplicateOf ? { duplicate_of: plan.duplicateOf } : {}), ...(who.common_name ? { common_name: who.common_name } : {}) };
  if (plan.spec.member) return dqMemberAction(env, row, plan, who, key, now, request, reads, priorOf, load, replayOrReuse);

  // 3. Ticket-level: one batch, event first with the pre-image (BN-1), then the UPDATE only if that event was written.
  const to = plan.spec.to || plan.expected;
  const set = dqSetClause(plan, who.actor, now);
  const guard = plan.action === 'link_exception' ? ' AND linked_exception_ref IS NOT ?' : plan.action === 'resolve' && !plan.force ? ` AND ${NO_OPEN_MEMBER}` : '';
  const guardArgs = plan.action === 'link_exception' ? [plan.set.linked_exception_ref] : [];
  const res = await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, from_value, to_value, body, payload, actor, actor_source, actor_role, occurred_at, idempotency_key)
                    SELECT 'dq_ticket', CAST(ticket_id AS TEXT), ?, status, ?, ?, json_patch(json(?), json_object('before', json(${DQ_PRE_IMAGE}), 'request', json(?))), ?, ?, ?, ?, ?
                      FROM ops_data_quality_ticket
                     WHERE case_ref = ? AND status = ?${guard} AND NOT EXISTS (SELECT 1 FROM ops_case_event WHERE idempotency_key = ?)`)
      .bind(plan.spec.event, to, plan.note, JSON.stringify(plan.top), JSON.stringify(request), who.actor, who.actor_source, plan.actorRole, now, key,
            ref, plan.expected, ...guardArgs, key),
    env.DB.prepare(`UPDATE ops_data_quality_ticket SET ${set.sql}
                     WHERE case_ref = ? AND status = ?
                       AND EXISTS (SELECT 1 FROM ops_case_event WHERE idempotency_key = ? AND occurred_at = ? AND subject_type = 'dq_ticket'
                                                                 AND subject_id = CAST(ops_data_quality_ticket.ticket_id AS TEXT))`)
      .bind(...set.args, ref, plan.expected, key, now)
  ]);
  reads += res.reduce((a, r) => a + rr(r), 0);
  const after = await load();
  if ((res[1].meta?.changes ?? 0) > 0) return jsonPrivate({ ok: true, case: after, event: plan.spec.event, rows_read: reads });
  const p2 = await priorOf();
  if (p2.length) return replayOrReuse(p2[0]);
  return err(409, after && after.status !== plan.expected ? 'stale_expected_status' : plan.action === 'resolve' ? 'members_open' : 'not_applied', { current: after, rows_read: reads });
}

// A4-3: the member change first (guarded by expected state and request idempotency); the ticket bump and
// the event only if that change applied — a no-op never leaves an orphan event, a change never lacks one.
async function dqMemberAction(env, row, plan, who, key, now, request, reads, priorOf, load, replayOrReuse) {
  const tid = row.ticket_id;
  const memberChanged = `SELECT 1 FROM ops_dq_ticket_member WHERE ticket_id = ? AND updated_at = ?`;
  let stmts;
  if (plan.action === 'member_update') {
    const { od, ok, from, to } = plan.member;
    const m = await env.DB.prepare(`SELECT member_status FROM ops_dq_ticket_member WHERE ticket_id = ? AND object_domain = ? AND object_key = ?`).bind(tid, od, ok).all();
    reads += rr(m);
    if (!m.results.length) return err(404, 'member_not_found', { rows_read: reads });
    if (m.results[0].member_status !== from) return err(409, 'stale_member_status', { current_member_status: m.results[0].member_status, rows_read: reads });
    const changed = `SELECT 1 FROM ops_dq_ticket_member WHERE ticket_id = ? AND object_domain = ? AND object_key = ? AND member_status = ? AND updated_at = ?`;
    stmts = [
      env.DB.prepare(`UPDATE ops_dq_ticket_member SET member_status = ?, note = COALESCE(?, note), updated_at = ?
                       WHERE ticket_id = ? AND object_domain = ? AND object_key = ? AND member_status = ?
                         AND EXISTS (SELECT 1 FROM ops_data_quality_ticket WHERE ticket_id = ? AND status = ?)
                         AND NOT EXISTS (SELECT 1 FROM ops_case_event WHERE idempotency_key = ?)`)
        .bind(to, plan.note, now, tid, od, ok, from, tid, plan.expected, key),
      env.DB.prepare(`UPDATE ops_data_quality_ticket SET updated_at = ? WHERE ticket_id = ? AND EXISTS (${changed})`).bind(now, tid, tid, od, ok, to, now),
      env.DB.prepare(`INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, body, payload, actor, actor_source, actor_role, occurred_at, idempotency_key)
                      SELECT 'dq_ticket', ?, 'member_updated', ?,
                             json_object('object_domain', ?, 'object_key', ?, 'from', ?, 'to', ?, 'request', json(?)), ?, ?, ?, ?, ?
                       WHERE EXISTS (${changed})`)
        .bind(String(tid), plan.note, od, ok, from, to, JSON.stringify(request), who.actor, who.actor_source, plan.actorRole, now, key, tid, od, ok, to, now)
    ];
  } else {
    const c = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ops_dq_ticket_member WHERE ticket_id = ?`).bind(tid).all();
    reads += rr(c);
    if ((c.results[0]?.n ?? 0) + plan.members.length > MEMBER_CAP) return err(409, 'member_cap', { detail: `a ticket holds at most ${MEMBER_CAP} members`, rows_read: reads });
    stmts = [
      env.DB.prepare(`INSERT OR IGNORE INTO ops_dq_ticket_member (ticket_id, object_domain, object_key, object_ref, proposed_action, updated_at)
                      SELECT ?, json_extract(m.value, '$.object_domain'), json_extract(m.value, '$.object_key'), json_extract(m.value, '$.object_ref'),
                             json_extract(m.value, '$.proposed_action'), ?
                        FROM json_each(?) m
                       WHERE EXISTS (SELECT 1 FROM ops_data_quality_ticket WHERE ticket_id = ? AND status = ?)
                         AND NOT EXISTS (SELECT 1 FROM ops_case_event WHERE idempotency_key = ?)`)
        .bind(tid, now, JSON.stringify(plan.members), tid, plan.expected, key),
      env.DB.prepare(`UPDATE ops_data_quality_ticket SET updated_at = ? WHERE ticket_id = ? AND EXISTS (${memberChanged})`).bind(now, tid, tid, now),
      env.DB.prepare(`INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, body, payload, actor, actor_source, actor_role, occurred_at, idempotency_key)
                      SELECT 'dq_ticket', ?, 'members_added', ?,
                             json_object('count', (SELECT COUNT(*) FROM ops_dq_ticket_member WHERE ticket_id = ? AND updated_at = ?), 'request', json(?)), ?, ?, ?, ?, ?
                       WHERE EXISTS (${memberChanged})`)
        .bind(String(tid), plan.note, tid, now, JSON.stringify({ ...request, requested: plan.members.length }), who.actor, who.actor_source, plan.actorRole, now, key, tid, now)
    ];
  }
  const res = await env.DB.batch(stmts);
  reads += res.reduce((a, r) => a + rr(r), 0);
  const changes = res[0].meta?.changes ?? 0;
  const after = await load();
  if (changes > 0) return jsonPrivate({ ok: true, case: after, event: plan.spec.event, ...(plan.action === 'add_members' ? { added: changes } : {}), rows_read: reads });
  const p2 = await priorOf();
  if (p2.length) return replayOrReuse(p2[0]);
  if (plan.action === 'add_members' && after && after.status === plan.expected) return jsonPrivate({ ok: true, case: after, added: 0, rows_read: reads });
  return err(409, after && after.status !== plan.expected ? 'stale_expected_status' : 'stale_member_status', { current: after, rows_read: reads });
}

// --- D-1 list (§8.2) ---------------------------------------------------------------

const DQ_LIST_COLS = `ticket_id, case_ref, ticket_type, severity, status, title, summary, object_domain, object_key, owner_role, assignee, disposition,
                      resolved_by, resolved_at, linked_exception_ref, raised_by, raised_via, legacy_source, opened_at, updated_at`;
const dqSortKey = (a, b) => (a.severity < b.severity ? -1 : a.severity > b.severity ? 1 : a.opened_at < b.opened_at ? -1 : a.opened_at > b.opened_at ? 1 : a.ticket_id - b.ticket_id);
const encodeDqCursor = r => btoa(JSON.stringify({ s: r.severity, o: r.opened_at, i: r.ticket_id })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const afterCursor = (r, c) => !c || dqSortKey(r, { severity: c.s, opened_at: c.o, ticket_id: c.i }) > 0;

export async function listDqTickets(env, url) {
  const q = url.searchParams;
  const statuses = (q.get('status') || DQ_OPEN.join(',')).split(',').map(s => s.trim()).filter(Boolean);
  if (!statuses.length || statuses.some(s => !DQ_STATUSES.includes(s)) || new Set(statuses).size !== statuses.length) return err(400, 'invalid status');
  const severity = q.get('severity');
  if (severity && !SEVERITIES.includes(severity)) return err(400, 'invalid severity');
  const type = q.get('type');
  if (type && !DQ_TYPES.includes(type)) return err(400, 'invalid type');
  const od = q.get('object_domain'), ok = q.get('object_key');
  if ((od === null) !== (ok === null)) return err(400, 'object_domain and object_key go together');
  if (od !== null && !dqKeyOk(od, ok)) return err(400, 'invalid object_domain / object_key');
  const limit = Math.min(Math.max(parseInt(q.get('limit') || '50', 10) || 50, 1), 100);
  const cur = decodeCursor(q.get('cursor'));
  if (cur === undefined) return err(400, 'invalid cursor');
  let reads = 0, rows;

  if (od !== null) {
    // Tickets anchored on the object (idx_ops_dq_object) plus aggregates listing it as a member (idx_ops_dq_member_object → PK).
    const res = await env.DB.batch([
      env.DB.prepare(`SELECT ${DQ_LIST_COLS} FROM ops_data_quality_ticket INDEXED BY idx_ops_dq_object WHERE object_domain = ? AND object_key = ? LIMIT 50`).bind(od, ok),
      env.DB.prepare(`SELECT ${DQ_LIST_COLS} FROM ops_data_quality_ticket WHERE ticket_id IN
                        (SELECT ticket_id FROM ops_dq_ticket_member INDEXED BY idx_ops_dq_member_object WHERE object_domain = ? AND object_key = ? LIMIT 50)`).bind(od, ok)
    ]);
    reads += res.reduce((a, r) => a + rr(r), 0);
    rows = [...new Map([...res[0].results, ...res[1].results].map(r => [r.ticket_id, r])).values()]
      .filter(r => statuses.includes(r.status) && (!severity || r.severity === severity) && (!type || r.ticket_type === type) && afterCursor(r, cur));
  } else {
    // One keyset statement per status on idx_ops_dq_queue (status, severity, opened_at, rowid), or idx_ops_dq_type with ?type=.
    const res = await env.DB.batch(statuses.map(st => {
      const where = [type ? 'ticket_type = ? AND status = ?' : 'status = ?'], args = type ? [type, st] : [st];
      if (severity) { where.push('severity = ?'); args.push(severity); }
      if (cur) { where.push('(severity, opened_at, ticket_id) > (?, ?, ?)'); args.push(cur.s, cur.o, cur.i); }
      return env.DB.prepare(`SELECT ${DQ_LIST_COLS} FROM ops_data_quality_ticket INDEXED BY ${type ? 'idx_ops_dq_type' : 'idx_ops_dq_queue'}
                             WHERE ${where.join(' AND ')} ORDER BY severity, opened_at, ticket_id LIMIT ?`).bind(...args, limit + 1);
    }));
    reads += res.reduce((a, r) => a + rr(r), 0);
    rows = res.flatMap(r => r.results);
  }
  rows.sort(dqSortKey);
  const page = rows.slice(0, limit);
  const merged = await mergedInto(env, page.filter(r => r.object_domain === 'entity').map(r => r.object_key), x => { reads += rr(x); });
  // §7.5: the role recorded on the resolve/dismiss event, for the terminal rows on this page only.
  const done = page.filter(r => r.status === 'resolved' || r.status === 'dismissed').map(r => String(r.ticket_id));
  const roles = {};
  if (done.length) {
    const r = await env.DB.prepare(`SELECT subject_id, actor_role FROM ops_case_event WHERE subject_type = 'dq_ticket' AND subject_id IN (${done.map(() => '?').join(', ')})
                                    AND event_type IN ('resolved', 'dismissed', 'decision_recorded') ORDER BY occurred_at`).bind(...done).all();
    reads += rr(r);
    for (const e of r.results) roles[e.subject_id] = e.actor_role;
  }
  const now = Date.now();
  const items = page.map(r => {
    const ageH = Math.max(0, (now - Date.parse(r.opened_at)) / 3600000);
    const target = DQ_TRIAGE_TARGET_H[r.severity];
    return { ...r, age_h: Math.round(ageH * 10) / 10, overdue: r.status === 'open' && target != null && ageH > target,
             ...(merged[r.object_key] && r.object_domain === 'entity' ? { merged_into: merged[r.object_key] } : {}),
             ...(done.includes(String(r.ticket_id)) ? { resolver_role: roles[String(r.ticket_id)] ?? null } : {}) };
  });
  return jsonPrivate({ ok: true, statuses, items, next_cursor: rows.length > limit ? encodeDqCursor(page[page.length - 1]) : null, rows_read: reads });
}

// --- D-2 create (§8.3, §9.3, §11.1) ---------------------------------------------------

const typeLabel = t => t.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

export async function createDqTicket(request, env, who) {
  if (!DQ_D2_CLIENTS.includes(request.headers.get('X-Ops-Client'))) return err(400, 'csrf: X-Ops-Client must be console, dq-page or service on D-2');
  const { body: b, error } = await readBody(request, DQ_MAX_BODY_BYTES);
  if (error) return err(400, error);
  if (typeof b.request_id !== 'string' || !UUID_RE.test(b.request_id)) return err(400, 'request_id (UUID) is required');
  if (!DQ_TYPES.includes(b.ticket_type)) return err(400, 'invalid ticket_type');
  if (!dqKeyOk(b.object_domain, b.object_key)) return err(400, 'invalid object_domain / object_key');
  if (b.severity !== undefined && !SEVERITIES.includes(b.severity)) return err(400, 'invalid severity');
  if (b.via !== undefined && b.via !== 'nav-007') return err(400, "via must be 'nav-007' when present");
  const lim = { title: 200, summary: 500, note: 1000, source_system: 64, source_record_ref: 200, field_name: 64, observed_value: 500,
                expected_value: 500, evidence: 2048, proposed_resolution: 1000, actor_role: 60 };
  const f = {};
  for (const [k, max] of Object.entries(lim)) {
    f[k] = optStr(b[k], max);
    if (f[k] === undefined) return err(400, `${k} must be a string of at most ${max} characters`);
  }
  if (b.object_ref != null && (typeof b.object_ref !== 'object' || Array.isArray(b.object_ref) || jsonBytes(b.object_ref) > 1536)) return err(400, 'object_ref must be a JSON object of at most 1.5 kB');
  if (b.owner_role !== undefined && !ROLES.includes(b.owner_role)) return err(400, 'invalid owner_role');
  if (b.linked_exception_ref !== undefined && (typeof b.linked_exception_ref !== 'string' || !CASE_REF_RE.test(b.linked_exception_ref) || !b.linked_exception_ref.startsWith('EXC-'))) {
    return err(400, 'linked_exception_ref must be an EXC- case_ref');
  }
  const mv = validateMembers(b.members ?? [], 100);
  if (mv.error) return err(400, mv.error);

  // Caller classes (§8.3), before any D1 access.
  const isService = who.actor_source === 'access_service_token';
  const nav = b.via === 'nav-007';
  if (isService) {
    const types = who.entry?.types;
    if (nav || !Array.isArray(types) || !types.includes(b.ticket_type)) return err(403, 'service_type_not_allowed');
  } else if (nav) {
    if (env.OPS_DQ_CONSUMER_ENABLED === 'false') return err(503, 'consumer_reporting_paused');
    if (!NAV_TYPES.includes(b.ticket_type)) return err(403, 'type_not_allowed_for_nav_007');
    if (b.object_domain !== 'entity' && b.object_domain !== 'instrument') return err(400, 'nav-007 reports name an entity or an instrument');
  }
  const objectRef = nav ? { ...navRef(b.object_ref), via: 'nav-007' } : (b.object_ref ?? null);
  const raisedVia = isService ? 'ingest_auto' : nav ? 'consumer_screen' : 'ops_console';
  const sourceSystem = nav ? 'ma-ui' : f.source_system;
  const t = b.ticket_type, od = b.object_domain, ok = b.object_key;
  const title = redact(f.title || `${typeLabel(t)}: ${ok}`).slice(0, 200);
  const rid = b.request_id.toLowerCase();
  const note = f.note ? redact(f.note) : null;
  let reads = 0;
  const q = async s => { const r = await s.all(); reads += rr(r); return r.results; };

  // 1. Replay / reuse of the request_id.
  const prior = await q(env.DB.prepare(`SELECT event_type, subject_type, subject_id FROM ops_case_event WHERE idempotency_key = ?`).bind(`act:${rid}`));
  if (prior.length) {
    const p = prior[0];
    if (p.event_type !== 'created' || p.subject_type !== 'dq_ticket') return err(409, 'request_id_reused');
    const r = await q(env.DB.prepare(`SELECT * FROM ops_data_quality_ticket WHERE ticket_id = ?`).bind(Number(p.subject_id)));
    return jsonPrivate({ ok: true, replay: true, case: r[0] || null, rows_read: reads });
  }
  // 2. Object-scoped dedupe (§9.3): an open ticket of this type on this object takes the report.
  const OPEN_SAME = `SELECT ticket_id, case_ref, status FROM ops_data_quality_ticket
                      WHERE object_domain = ? AND object_key = ? AND ticket_type = ? AND status IN ('open', 'triaged', 'fix_pending') LIMIT 1`;
  const again = async ex => {
    const day = new Date().toISOString().slice(0, 10);
    const r = await env.DB.prepare(`INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, body, payload, actor, actor_source, actor_role, occurred_at, idempotency_key)
                                    VALUES ('dq_ticket', ?, 'reported_again', ?, ?, ?, ?, ?, ?, ?)`)
      .bind(String(ex.ticket_id), note, JSON.stringify({ request_id: rid, raised_via: raisedVia, ...(who.common_name ? { common_name: who.common_name } : {}) }),
            who.actor, who.actor_source, f.actor_role, nowIso(), `again:${ex.ticket_id}:${who.actor}:${day}`).run();
    return jsonPrivate({ ok: true, deduplicated: true, case_ref: ex.case_ref, status: ex.status, reported_again: (r.meta?.changes ?? 0) > 0, rows_read: reads });
  };
  const existing = await q(env.DB.prepare(OPEN_SAME).bind(od, ok, t));
  if (existing.length) return again(existing[0]);
  if (b.linked_exception_ref && !(await q(env.DB.prepare(`SELECT case_ref FROM ops_exception WHERE case_ref = ?`).bind(b.linked_exception_ref))).length) {
    return err(422, 'linked_exception_ref not found');
  }
  // 3. Daily create cap across all five statuses (N4-1): covering idx_ops_dq_queue seeks, today's rows only.
  const today = new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z';
  const cap = parseInt(env.OPS_DQ_DAILY_CREATE_CAP || '', 10) || DQ_DEFAULT_DAILY_CREATE_CAP;
  const cnt = await q(env.DB.prepare(`SELECT COUNT(*) AS n FROM ops_data_quality_ticket
                                      WHERE status IN ('open', 'triaged', 'fix_pending', 'resolved', 'dismissed')
                                        AND severity IN ('sev1', 'sev2', 'sev3', 'sev4') AND opened_at >= ?`).bind(today));
  if ((cnt[0]?.n ?? 0) >= cap) return err(429, 'daily_create_cap', { cap, rows_read: reads });

  // 4. One batch: guarded insert with a pending case_ref, its event and members, then the final case_ref (003 §8.2).
  const now = nowIso();
  const pending = `DQ-PENDING-${rid}`;
  const res = await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO ops_data_quality_ticket (case_ref, ticket_type, severity, status, title, summary, object_domain, object_key, object_ref,
                      source_system, source_record_ref, field_name, observed_value, expected_value, evidence, proposed_resolution, owner_role,
                      linked_exception_ref, raised_by, raised_via, opened_at, updated_at)
                    SELECT ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                     WHERE NOT EXISTS (SELECT 1 FROM ops_data_quality_ticket WHERE object_domain = ? AND object_key = ? AND ticket_type = ?
                                                                          AND status IN ('open', 'triaged', 'fix_pending'))
                       AND NOT EXISTS (SELECT 1 FROM ops_case_event WHERE idempotency_key = ?)`)
      .bind(pending, t, b.severity || defaultSeverity(t), title, f.summary ? redact(f.summary) : null, od, ok, objectRef ? JSON.stringify(objectRef) : null,
            sourceSystem, f.source_record_ref, f.field_name, f.observed_value, f.expected_value, f.evidence ? redact(f.evidence) : null,
            f.proposed_resolution ? redact(f.proposed_resolution) : null, b.owner_role || defaultOwner(t), b.linked_exception_ref ?? null,
            who.actor, raisedVia, now, now, od, ok, t, `act:${rid}`),
    env.DB.prepare(`INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, to_value, body, payload, actor, actor_source, actor_role, occurred_at, idempotency_key)
                    SELECT 'dq_ticket', CAST(ticket_id AS TEXT), 'created', 'open', ?, ?, ?, ?, ?, ?, ? FROM ops_data_quality_ticket WHERE case_ref = ?`)
      .bind(note, JSON.stringify({ case_ref_pending: pending, raised_via: raisedVia, members: mv.rows.length, ...(who.common_name ? { common_name: who.common_name } : {}) }),
            who.actor, who.actor_source, f.actor_role, now, `act:${rid}`, pending),
    env.DB.prepare(`INSERT OR IGNORE INTO ops_dq_ticket_member (ticket_id, object_domain, object_key, object_ref, proposed_action, updated_at)
                    SELECT t.ticket_id, json_extract(m.value, '$.object_domain'), json_extract(m.value, '$.object_key'), json_extract(m.value, '$.object_ref'),
                           json_extract(m.value, '$.proposed_action'), ?
                      FROM ops_data_quality_ticket t, json_each(?) m WHERE t.case_ref = ?`).bind(now, JSON.stringify(mv.rows), pending),
    env.DB.prepare(`UPDATE ops_data_quality_ticket SET case_ref = 'DQ-' || printf('%06d', ticket_id) WHERE case_ref = ?`).bind(pending)
  ]);
  reads += res.reduce((a, r) => a + rr(r), 0);
  if ((res[0].meta?.changes ?? 0) > 0) {
    const r = await q(env.DB.prepare(`SELECT * FROM ops_data_quality_ticket WHERE ticket_id = (SELECT CAST(subject_id AS INTEGER) FROM ops_case_event WHERE idempotency_key = ?)`).bind(`act:${rid}`));
    return jsonPrivate({ ok: true, case: r[0] || null, members: mv.rows.length, rows_read: reads }, 201);
  }
  // Lost a race to another report on the same object (D1 runs one statement at a time).
  const raced = await q(env.DB.prepare(OPEN_SAME).bind(od, ok, t));
  if (raced.length) return again(raced[0]);
  return err(409, 'not_applied', { rows_read: reads });
}
