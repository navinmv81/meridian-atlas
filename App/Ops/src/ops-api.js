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
// DOMAIN BOUNDARY: this Worker owns sprintboarditems, releaseledger, and
// operationalevents (Ops domain — no ETF/Entities/13F/Filings pipeline may
// write to them). It reads (never writes) openfigicache, instrument_master,
// instrument_entity_map, entity_master, and holdings_pipeline_state.

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

async function createSprintTicket(env, body) {
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
    `).bind(body.ticket_id, actorRole, JSON.stringify({ packet_type: 'ticket', stage }))
  ]);

  return json({ ok: true, ticket_id: body.ticket_id });
}

async function changeTicketStage(env, ticketId, body) {
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
    `).bind(eventType, ticketId, body.actor_role, JSON.stringify({ from_stage: current.stage, to_stage: newStage, gate: body.gate || null }))
  ]);

  return json({ ok: true, ticket_id: ticketId, from_stage: current.stage, to_stage: newStage });
}

// --- Release Ledger -----------------------------------------------------

async function listReleaseLedger(env) {
  const rows = await env.DB.prepare(`SELECT * FROM releaseledger ORDER BY updated_at DESC`).all();
  return json({ ok: true, items: rows.results });
}

async function createRelease(env, body) {
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
    `).bind(body.release_id, actorRole, JSON.stringify({ packet_type: 'release' }))
  ]);

  return json({ ok: true, release_id: body.release_id });
}

const RELEASE_EVENT_TYPES = new Set([
  'build_started', 'build_completed', 'worker_deployed', 'frontend_pushed',
  'migration_applied', 'verification_passed', 'verification_failed',
  'release_closed', 'release_rolled_back'
]);

async function recordReleaseEvent(env, releaseId, body) {
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
    `).bind(body.event_type, releaseId, body.actor_role, JSON.stringify(payload))
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

// --- Router --------------------------------------------------------------

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
      if (path === '/api/ops/sprint-board' && method === 'GET') return await listSprintBoard(env, url);
      if (path === '/api/ops/sprint-board' && method === 'POST') return await createSprintTicket(env, await readJson(request));

      const stageMatch = path.match(/^\/api\/ops\/sprint-board\/([^/]+)\/stage$/);
      if (stageMatch && method === 'POST') return await changeTicketStage(env, stageMatch[1], await readJson(request));

      if (path === '/api/ops/release-ledger' && method === 'GET') return await listReleaseLedger(env);
      if (path === '/api/ops/release-ledger' && method === 'POST') return await createRelease(env, await readJson(request));

      const eventMatch = path.match(/^\/api\/ops\/release-ledger\/([^/]+)\/event$/);
      if (eventMatch && method === 'POST') return await recordReleaseEvent(env, eventMatch[1], await readJson(request));

      if (path === '/api/ops/events' && method === 'GET') return await listEvents(env, url);
      if (path === '/api/ops/drift' && method === 'GET') return await driftCheck(env);
      if (path === '/api/ops/budget-risk' && method === 'GET') return await budgetRisk(env);
      if (path === '/api/ops/openfigi-status' && method === 'GET') return await openFigiStatus(env);

      if (path === '/api/ops/cf/invocations' && method === 'GET') return await cfInvocations(env, url);
      if (path === '/api/ops/cf/d1-today' && method === 'GET') return await cfD1WritesToday(env);

      return json({ ok: false, error: 'not found' }, 404);
    } catch (err) {
      return json({ ok: false, error: err.message }, 500);
    }
  }
};
