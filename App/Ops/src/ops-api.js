// meridian-ops
// Backend for the August Operating Layer: Sprint Board, Release Ledger,
// operational event log, deployment-drift check, D1 budget-risk check, and
// OpenFIGI coverage status. Per August_Operating_Layer_Blueprint.md Sections
// 4-7. On-request only, no Cron Trigger — this is a human-driven dashboard
// backend, not a pipeline.
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
// DOMAIN BOUNDARY: this Worker owns sprintboarditems, releaseledger, and
// operationalevents (Ops domain — no ETF/Entities/13F/Filings pipeline may
// write to them), and is the ONLY writer of the ops_* control-plane tables
// (ops_job_registry, ops_job_run, ops_exception, ops_data_quality_ticket,
// ops_case_event — migrations/002-ops-control-plane.sql). It reads (never
// writes) openfigicache, instrument_master, instrument_entity_map,
// entity_master, and holdings_pipeline_state.

const STAGE_ORDER = [
  'IDEA', 'PRODUCT_SPEC', 'ARCH_REVIEW', 'UX_REVIEW', 'ENG_DIAGNOSTIC',
  'FOUNDER_APPROVAL', 'ENG_IMPLEMENT', 'OPS_RELEASE_REVIEW', 'RELEASE_READY', 'CLOSED'
];

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

// --- Events, Drift, Budget, OpenFIGI status -----------------------------

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
  'meridian-entities-figi', 'meridian-entities-api', 'meridian-entities-delta', 'meridian-ops'
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

  return json({
    ok: true,
    date: today,
    ...totals,
    daily_cap: 100000,
    pct_of_cap: Math.round((totals.rowsWritten / 100000) * 1000) / 10
  });
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
// Raw state only; health, lateness and drift are 002.

async function listJobs(env, url) {
  const jobId = url.searchParams.get('job_id');
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
    return jsonPrivate({ ok: true, job_id: jobId, runs: rows.results, rows_read: rows.meta?.rows_read ?? null });
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
  return jsonPrivate({ ok: true, jobs: rows.results, rows_read: rows.meta?.rows_read ?? null });
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

  if (path === '/api/ops/admin/jobs' && method === 'GET') return await listJobs(env, url);
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
        return jsonPrivate({ ok: false, error: 'not found' }, 404);
      }

      if (method === 'POST' && LEGACY_POST_RE.test(path)) {
        return json({ ok: false, error: 'moved to /api/ops/admin/…; authentication required' }, 401);
      }

      if (path === '/api/ops/sprint-board' && method === 'GET') return await listSprintBoard(env, url);
      if (path === '/api/ops/release-ledger' && method === 'GET') return await listReleaseLedger(env);
      if (path === '/api/ops/events' && method === 'GET') return await listEvents(env, url);
      if (path === '/api/ops/drift' && method === 'GET') return await driftCheck(env);
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
