// meridian-control
// MA-OCT-002a A6 (spec claude/MA-OCT-002_Spec.md rev 1.3 §13, CR-1): the
// governance routes of the August Operating Layer, split out of meridian-ops so
// that meridian-ops keeps route headroom for 003/004. SAME PATHS as before, so
// 005 only changes ma-ops.js's base URL. On-request only, no Cron Trigger.
//
// Endpoints (8):
//   GET  /api/ops/sprint-board[?stage=]      GET  /api/ops/release-ledger
//   GET  /api/ops/events[?ticket_id=&release_id=&since=&limit=]
//   GET  /api/ops/drift                       (release drift: worker vs frontend status)
//   POST /api/ops/admin/sprint-board          POST /api/ops/admin/sprint-board/:id/stage
//   POST /api/ops/admin/release-ledger        POST /api/ops/admin/release-ledger/:id/event
// Rule (not an endpoint): the 4 legacy anonymous POST paths are an explicit 401
// deny, copied from meridian-ops (MA-OCT-001 §6).
//
// AUTH: /api/ops/admin/* sits behind the Cloudflare Access app "meridian-control
// admin" (its own AUD, 001 allow list) and the JWT is re-verified here on every
// request (verifyAccessJwt, vendored from ops-api.js — no cross-file imports).
// With CF_ACCESS_TEAM_DOMAIN or CF_ACCESS_AUD unset, every admin route fails
// closed with 401. Public GETs keep Access-Control-Allow-Origin '*'; admin
// responses carry no CORS allowances.
//
// DOMAIN BOUNDARY (§13 decision): sprintboarditems, releaseledger and
// operationalevents stay Ops-domain (owner Operations Lead; business owner of the
// contents the Program Orchestrator). This Worker is their ONLY Worker writer;
// meridian-ops no longer writes them. It never reads or writes the ops_* tables
// (meridian-ops is their only writer). One writer per table holds.
//
// READ/WRITE BUDGET (unchanged from meridian-ops, MA-AUG / 001): every route is a
// handful of indexed point queries or small list scans over tables of at most a
// few thousand rows; each admin POST writes 2 rows (item + event) in one batch,
// except release_closed, which also closes each referenced ticket.
//
// ROLLBACK (§13): redeploy the previous meridian-ops version (its routes come
// back in one step) and leave this Worker deployed but unused.

const STAGE_ORDER = [
  'IDEA', 'PRODUCT_SPEC', 'ARCH_REVIEW', 'UX_REVIEW', 'ENG_DIAGNOSTIC',
  'FOUNDER_APPROVAL', 'ENG_IMPLEMENT', 'OPS_RELEASE_REVIEW', 'RELEASE_READY', 'CLOSED'
];

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

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// --- Sprint Board -----------------------------------------------------

async function listSprintBoard(env, url) {
  const stage = url.searchParams.get('stage');
  const rows = stage
    ? await env.DB.prepare(`SELECT * FROM sprintboarditems WHERE stage = ? ORDER BY updated_at DESC`).bind(stage).all()
    : await env.DB.prepare(`SELECT * FROM sprintboarditems ORDER BY updated_at DESC`).all();
  return json({ ok: true, items: rows.results });
}

async function createSprintTicket(env, body, who) {
  if (!body || !body.ticket_id || !body.title || !body.domain || !body.lane || !body.owner_role) {
    return badRequest('ticket_id, title, domain, lane, owner_role are required');
  }
  const stage = body.stage || 'IDEA';
  const actorRole = body.actor_role || 'Program Orchestrator';

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO sprintboarditems (ticket_id, title, domain, lane, stage, owner_role, status, blocker, next_step, approval_needed, notes)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?)
      ON CONFLICT(ticket_id) DO NOTHING
    `).bind(body.ticket_id, body.title, body.domain, body.lane, stage, body.owner_role,
      body.blocker || null, body.next_step || null, body.approval_needed || null, body.notes || null),
    env.DB.prepare(`
      INSERT INTO operationalevents (event_type, ticket_id, actor_role, payload)
      VALUES ('packet_created', ?, ?, ?)
    `).bind(body.ticket_id, actorRole, JSON.stringify({ packet_type: 'ticket', stage, ...who }))
  ]);

  return json({ ok: true, ticket_id: body.ticket_id });
}

async function changeTicketStage(env, ticketId, body, who) {
  if (!body || !body.stage || !body.actor_role) {
    return badRequest('stage and actor_role are required');
  }
  const current = await env.DB.prepare(`SELECT * FROM sprintboarditems WHERE ticket_id = ?`).bind(ticketId).first();
  if (!current) return json({ ok: false, error: 'ticket not found' }, 404);

  const newStage = body.stage;
  const validStages = STAGE_ORDER.concat(['BLOCKED']);
  if (!validStages.includes(newStage)) return badRequest('invalid stage value');

  // Rule (refined during build, 30 July 2026, from the blueprint's stricter
  // "forward one step only" draft): allow moving into/out of BLOCKED freely,
  // and allow moving forward to any later stage (not just +1) — a ticket may
  // legitimately skip UX_REVIEW if no UI work is involved, for example.
  // Reject strictly backward moves (except via BLOCKED) since this is a
  // human-operated dashboard for one founder, not a multi-person process
  // gate, and a hard reject with a clear message is safer than silently
  // allowing any jump.
  if (newStage !== 'BLOCKED' && current.stage !== 'BLOCKED' && newStage !== current.stage) {
    const fromIdx = STAGE_ORDER.indexOf(current.stage);
    const toIdx = STAGE_ORDER.indexOf(newStage);
    if (fromIdx !== -1 && toIdx !== -1 && toIdx < fromIdx) {
      return badRequest(`cannot move backward from ${current.stage} to ${newStage} — use BLOCKED first if this ticket needs to be reopened`);
    }
  }

  const newStatus = newStage === 'BLOCKED' ? 'BLOCKED' : (newStage === 'CLOSED' ? 'CLOSED' : 'ACTIVE');
  const eventType = body.gate_result === 'failed' ? 'gate_failed' : (body.gate_result === 'passed' ? 'gate_passed' : 'ticket_state_changed');

  await env.DB.batch([
    env.DB.prepare(`
      UPDATE sprintboarditems
      SET stage = ?, status = ?, blocker = ?, next_step = ?, approval_needed = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE ticket_id = ?
    `).bind(newStage, newStatus, body.blocker ?? current.blocker, body.next_step ?? current.next_step,
      body.approval_needed ?? current.approval_needed, body.notes ?? current.notes, ticketId),
    env.DB.prepare(`
      INSERT INTO operationalevents (event_type, ticket_id, actor_role, payload)
      VALUES (?, ?, ?, ?)
    `).bind(eventType, ticketId, body.actor_role, JSON.stringify({ from_stage: current.stage, to_stage: newStage, gate: body.gate || null, ...who }))
  ]);

  return json({ ok: true, ticket_id: ticketId, from_stage: current.stage, to_stage: newStage });
}

// --- Release Ledger -----------------------------------------------------

async function listReleaseLedger(env) {
  const rows = await env.DB.prepare(`SELECT * FROM releaseledger ORDER BY updated_at DESC`).all();
  return json({ ok: true, items: rows.results });
}

async function createRelease(env, body, who) {
  if (!body || !body.release_id || !body.ticket_ids || !body.change_summary) {
    return badRequest('release_id, ticket_ids (array), change_summary are required');
  }
  const actorRole = body.actor_role || 'Program Orchestrator';

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO releaseledger (release_id, ticket_ids, change_summary, frontend_files, worker_files)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(release_id) DO NOTHING
    `).bind(body.release_id, JSON.stringify(body.ticket_ids), body.change_summary,
      body.frontend_files || null, body.worker_files || null),
    env.DB.prepare(`
      INSERT INTO operationalevents (event_type, release_id, actor_role, payload)
      VALUES ('packet_created', ?, ?, ?)
    `).bind(body.release_id, actorRole, JSON.stringify({ packet_type: 'release', ...who }))
  ]);

  return json({ ok: true, release_id: body.release_id });
}

const RELEASE_EVENT_TYPES = new Set([
  'build_started', 'build_completed', 'worker_deployed', 'frontend_pushed',
  'migration_applied', 'verification_passed', 'verification_failed',
  'release_closed', 'release_rolled_back'
]);

async function recordReleaseEvent(env, releaseId, body, who) {
  if (!body || !body.event_type || !body.actor_role) {
    return badRequest('event_type and actor_role are required');
  }
  if (!RELEASE_EVENT_TYPES.has(body.event_type)) {
    return badRequest(`event_type must be one of: ${[...RELEASE_EVENT_TYPES].join(', ')}`);
  }
  const current = await env.DB.prepare(`SELECT * FROM releaseledger WHERE release_id = ?`).bind(releaseId).first();
  if (!current) return json({ ok: false, error: 'release not found' }, 404);

  const payload = body.payload || {};
  const statements = [];
  let d1 = current.d1_migration_status, worker = current.worker_deploy_status,
      frontend = current.frontend_push_status, verify = current.verification_status,
      status = current.status, rollbackNote = current.rollback_note, closedAt = null;

  switch (body.event_type) {
    case 'build_started':
      if (payload.target === 'worker') worker = 'in_progress';
      else if (payload.target === 'frontend') frontend = 'in_progress';
      break;
    case 'build_completed':
      break; // informational only — doesn't map to a single ledger column
    case 'worker_deployed':
      worker = 'deployed';
      break;
    case 'frontend_pushed':
      frontend = 'pushed';
      break;
    case 'migration_applied':
      d1 = 'applied';
      break;
    case 'verification_passed':
      verify = 'passed';
      if (worker === 'deployed' && (frontend === 'pushed' || frontend === 'not_started') && d1 !== 'pending' && d1 !== 'failed') {
        status = 'VERIFIED';
      }
      break;
    case 'verification_failed':
      verify = 'failed';
      status = 'NOT_READY';
      break;
    case 'release_closed':
      status = status === 'VERIFIED' ? 'VERIFIED' : 'DEPLOYED';
      closedAt = new Date().toISOString();
      break;
    case 'release_rolled_back':
      if (!payload.reason) return badRequest('release_rolled_back requires payload.reason');
      status = 'ROLLED_BACK';
      rollbackNote = payload.reason;
      break;
  }

  statements.push(
    env.DB.prepare(`
      UPDATE releaseledger
      SET d1_migration_status = ?, worker_deploy_status = ?, frontend_push_status = ?,
          verification_status = ?, status = ?, rollback_note = ?, updated_at = CURRENT_TIMESTAMP,
          closed_at = COALESCE(?, closed_at)
      WHERE release_id = ?
    `).bind(d1, worker, frontend, verify, status, rollbackNote, closedAt, releaseId)
  );

  statements.push(
    env.DB.prepare(`
      INSERT INTO operationalevents (event_type, release_id, actor_role, payload)
      VALUES (?, ?, ?, ?)
    `).bind(body.event_type, releaseId, body.actor_role, JSON.stringify({ ...payload, ...who }))
  );

  // Cascade: release_closed moves every referenced ticket to CLOSED
  if (body.event_type === 'release_closed') {
    let ticketIds = [];
    try { ticketIds = JSON.parse(current.ticket_ids); } catch { /* leave empty */ }
    for (const tid of ticketIds) {
      statements.push(
        env.DB.prepare(`
          UPDATE sprintboarditems SET stage = 'CLOSED', status = 'CLOSED', updated_at = CURRENT_TIMESTAMP
          WHERE ticket_id = ? AND stage != 'CLOSED'
        `).bind(tid)
      );
    }
  }

  await env.DB.batch(statements);
  return json({ ok: true, release_id: releaseId, status });
}

// --- Events and release drift -----------------------------------------

async function listEvents(env, url) {
  const ticketId = url.searchParams.get('ticket_id');
  const releaseId = url.searchParams.get('release_id');
  const since = url.searchParams.get('since');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);

  let query = `SELECT * FROM operationalevents WHERE 1=1`;
  const binds = [];
  if (ticketId) { query += ` AND ticket_id = ?`; binds.push(ticketId); }
  if (releaseId) { query += ` AND release_id = ?`; binds.push(releaseId); }
  if (since) { query += ` AND created_at >= ?`; binds.push(since); }
  query += ` ORDER BY created_at DESC LIMIT ?`;
  binds.push(limit);

  const rows = await env.DB.prepare(query).bind(...binds).all();
  return json({ ok: true, events: rows.results });
}

async function driftCheck(env) {
  const rows = await env.DB.prepare(`
    SELECT release_id, change_summary, worker_deploy_status, frontend_push_status, status
    FROM releaseledger
    WHERE (worker_deploy_status = 'deployed' AND frontend_push_status NOT IN ('pushed', 'not_started'))
       OR (frontend_push_status = 'pushed' AND worker_deploy_status NOT IN ('deployed', 'not_started'))
  `).all();
  return json({ ok: true, drift: rows.results, has_drift: rows.results.length > 0 });
}

// --- Cloudflare Access verification (admin prefix) -----------------------
// Vendored verbatim from App/Ops/src/ops-api.js verifyAccessJwt() (MA-OCT-001,
// itself vendored from entities-api.js, MA-SEP-015b) — no cross-file imports. Re-verifies the
// Cf-Access-Jwt-Assertion header (RS256 signature against the team JWKS, aud,
// iss, exp) on EVERY /api/ops/admin/* request. Fails closed when
// CF_ACCESS_TEAM_DOMAIN or CF_ACCESS_AUD is missing. The Access app
// "meridian-control admin" has its own AUD (not meridian-ops's).

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

// Copies a legacy handler's response without its CORS allowances (admin prefix).
function withoutCors(resp) {
  const headers = new Headers(resp.headers);
  for (const h of [...headers.keys()]) if (h.toLowerCase().startsWith('access-control-')) headers.delete(h);
  headers.set('Cache-Control', 'no-store');
  return new Response(resp.body, { status: resp.status, headers });
}

async function handleAdmin(request, env, url, path, method) {
  const auth = await verifyAccessJwt(request, env);
  if (!auth.ok) return jsonPrivate({ ok: false, error: `unauthorized: ${auth.error}` }, 401);
  const who = { actor: auth.actor, actor_source: auth.actor_source };

  if (path === '/api/ops/admin/sprint-board' && method === 'POST') {
    return withoutCors(await createSprintTicket(env, await readJson(request), who));
  }
  const stageMatch = path.match(/^\/api\/ops\/admin\/sprint-board\/([^/]+)\/stage$/);
  if (stageMatch && method === 'POST') {
    return withoutCors(await changeTicketStage(env, decodeURIComponent(stageMatch[1]), await readJson(request), who));
  }
  if (path === '/api/ops/admin/release-ledger' && method === 'POST') {
    return withoutCors(await createRelease(env, await readJson(request), who));
  }
  const eventMatch = path.match(/^\/api\/ops\/admin\/release-ledger\/([^/]+)\/event$/);
  if (eventMatch && method === 'POST') {
    return withoutCors(await recordReleaseEvent(env, decodeURIComponent(eventMatch[1]), await readJson(request), who));
  }
  return jsonPrivate({ ok: false, error: 'not found' }, 404);
}

// The 4 pre-001 anonymous POST paths: explicit deny, nothing is written (copied from meridian-ops).
const LEGACY_POST_RE = /^\/api\/ops\/(sprint-board(\/[^/]+\/stage)?|release-ledger(\/[^/]+\/event)?)$/;

// --- Router --------------------------------------------------------------

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const isPrivate = path.startsWith('/api/ops/admin/');

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: isPrivate ? {} : CORS_HEADERS });
    }

    try {
      if (isPrivate) return await handleAdmin(request, env, url, path, method);

      if (method === 'POST' && LEGACY_POST_RE.test(path)) {
        return json({ ok: false, error: 'moved to /api/ops/admin/…; authentication required' }, 401);
      }

      if (path === '/api/ops/sprint-board' && method === 'GET') return await listSprintBoard(env, url);
      if (path === '/api/ops/release-ledger' && method === 'GET') return await listReleaseLedger(env);
      if (path === '/api/ops/events' && method === 'GET') return await listEvents(env, url);
      if (path === '/api/ops/drift' && method === 'GET') return await driftCheck(env);

      return json({ ok: false, error: 'not found' }, 404);
    } catch (err) {
      console.error('[meridian-control] unhandled error:', err && err.message);
      return isPrivate
        ? jsonPrivate({ ok: false, error: 'internal error' }, 500)
        : json({ ok: false, error: err.message }, 500);
    }
  }
};
