// cases.js — MA-OCT-003 (spec rev 1 §6–§8, 7b8bba9f…80c2). Exception workflow routes
// for meridian-ops, imported by ops-api.js like lateness.js. Domain: Ops. Only writer
// of ops_* tables: meridian-ops. 004 extends this module for DQ tickets.
//
// Routes (all under the Access app "meridian-ops admin"; ops-api.js has already
// re-verified the JWT and applied the service-token allowlist, serviceGate() below):
//   E-1  GET  /api/ops/admin/exceptions               queue (keyset)
//   E-2  POST /api/ops/admin/exceptions               manual create
//   C-1  GET  /api/ops/admin/cases/:case_ref          detail (EXC- or DQ-)
//   C-2  POST /api/ops/admin/cases/:case_ref/action   transitions (EXC- only until 004)
//
// Order of checks, each before any D1 access: allowlist (403) → OPS_CASES_ENABLED
// (503) → CSRF on POSTs (400, A3-5) → body and vocabulary validation (400).
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
  return 'other';
}

// The only route ids a service-token entry may list (BREVA N-1). 004 adds its D-routes here.
export const SERVICE_ROUTE_IDS = ['E-1', 'E-2', 'C-1', 'C-2'];

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

async function readBody(request) {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return { error: 'body exceeds 8 KB' };
  try { const b = JSON.parse(text); return b && typeof b === 'object' && !Array.isArray(b) ? { body: b } : { error: 'body must be a JSON object' }; }
  catch { return { error: 'invalid JSON' }; }
}

function optStr(v, max) { return v === undefined || v === null ? null : (typeof v === 'string' && v.length <= max ? v : undefined); }

// --- entry point ---------------------------------------------------------------

// Returns a Response for the 4 case routes, or null (not a case route).
export async function handleCases(request, env, url, path, method, who) {
  const routeId = adminRouteId(path, method);
  if (routeId === 'other') return null;
  if (env.OPS_CASES_ENABLED === 'false') return err(503, 'cases_disabled');
  if ((routeId === 'E-2' || routeId === 'C-2') && !csrfOk(request)) {
    return err(400, 'csrf: Content-Type application/json and X-Ops-Client (console|script|service|dq-page) are required');
  }
  if (routeId === 'E-1') return listExceptions(env, url);
  if (routeId === 'E-2') return createException(request, env, who);
  const ref = decodeURIComponent(path.split('/')[5] || '');
  if (!CASE_REF_RE.test(ref)) return err(400, 'invalid case_ref');
  if (routeId === 'C-1') return caseDetail(env, ref);
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

export async function caseDetail(env, ref) {
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
  const c = await env.DB.prepare(`SELECT * FROM ops_data_quality_ticket WHERE case_ref = ?`).bind(ref).all();
  reads += rr(c);
  const row = c.results[0];
  if (!row) return err(404, 'not found');
  const stmts = [env.DB.prepare(`SELECT event_id, event_type, from_value, to_value, body, payload, actor, actor_source, actor_role, occurred_at, recorded_at
                                 FROM ops_case_event WHERE subject_type = 'dq_ticket' AND subject_id = ? ORDER BY occurred_at LIMIT 200`).bind(String(row.ticket_id))];
  if (row.linked_exception_ref) stmts.push(env.DB.prepare(`SELECT case_ref, exception_type, severity, status, title, job_id, opened_at FROM ops_exception WHERE case_ref = ?`).bind(row.linked_exception_ref));
  if (row.job_id) stmts.push(env.DB.prepare(`SELECT * FROM ops_job_registry WHERE job_id = ?`).bind(row.job_id));
  const r = await env.DB.batch(stmts);
  reads += r.reduce((a, x) => a + rr(x), 0);
  let i = 1;
  const linked = row.linked_exception_ref ? (r[i++].results[0] || null) : null;
  const registry = row.job_id ? (r[i++].results[0] || null) : null;
  return jsonPrivate({ ok: true, kind: 'dq_ticket', case: row, events: r[0].results, linked_exception: linked, registry, rows_read: reads });
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
  const { body: b, error } = await readBody(request);
  if (error) return err(400, error);
  const kind = ref.startsWith('EXC-') ? 'EXC' : 'DQ';
  if (!serviceActionAllowed(who, kind, b.action)) return err(403, 'service_action_not_allowed');
  if (kind === 'DQ') return err(409, 'dq_actions_arrive_with_ma_oct_004');
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
