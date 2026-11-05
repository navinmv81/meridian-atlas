// schedules.js — MA-OCT-002b B1 (spec 002 rev 1.3 §6.2, §19.2 AC-b1, §19.5 R-4). Effective schedules
// from the Cloudflare API and the drift rule. Imported by ops-api.js only (no route of its own).
//
// Effective side: GET /accounts/{CF_ACCOUNT_TAG}/workers/scripts/{name}/schedules with the Founder's
// read-only token CF_WORKERS_READ_TOKEN (Account > Workers Scripts > Read), for the 4 cron Workers
// (5 expressions) plus delta and figi so `unexpected_trigger` is detectable (R-4): 6 subrequests, once a
// UTC day (the first sweep), 0 D1 reads beyond the registry the sweep already holds. `effective_schedule`
// is written only when it changes: one guarded UPDATE + one ops_control audit row per job (the
// registry-sync convention); about 0 writes on a normal day.
//
// Drift (worker level, attributed to each registry job of that Worker; enrich has two jobs):
//   expr_mismatch      both sets exist and differ (after normalising names ↔ CF numbers)   sev2
//   missing_trigger    intended cron, no effective trigger                                  sev2
//   unexpected_trigger effective trigger on a job whose intended kind is none, or held      sev2
//   not_deployed       an active cron job's Worker is missing from the account (404)        sev2
// numeric_dow and dst_shift are intended-only and stay in lateness.js (002a).
//
// Cloudflare day-of-week: 1 = Sunday … 7 = Saturday (KI 22.1). Names are mapped to those numbers.

export const SCHEDULE_WORKERS = ['meridian-holdings', 'meridian-entities-seed', 'meridian-entities-enrich', 'meridian-bootstrap',
  'meridian-entities-delta', 'meridian-entities-figi'];
const DOW = { sun: '1', mon: '2', tue: '3', wed: '4', thu: '5', fri: '6', sat: '7' };
const MON = { jan: '1', feb: '2', mar: '3', apr: '4', may: '5', jun: '6', jul: '7', aug: '8', sep: '9', oct: '10', nov: '11', dec: '12' };
const API = 'https://api.cloudflare.com/client/v4';
const TIMEOUT_MS = 5000;

// One cron expression in canonical form: lowercase, single spaces, month and day names as CF numbers.
export function normExpr(expr) {
  const f = String(expr).trim().toLowerCase().split(/\s+/);
  if (f.length !== 5) return f.join(' ');
  f[3] = f[3].replace(/[a-z]{3}/g, m => MON[m] ?? m);
  f[4] = f[4].replace(/[a-z]{3}/g, m => DOW[m] ?? m);
  return f.join(' ');
}
const normSet = exprs => new Set((exprs || []).map(normExpr));
const parse = s => { try { return s ? JSON.parse(s) : null; } catch { return null; } };

// The effective_schedule JSON for a Worker (stored on each of its jobs). Sorted, raw CF strings.
export function effectiveJson(fetched) {
  if (fetched.deployed === false) return JSON.stringify({ kind: 'not_deployed', source: 'cf_api' });
  const exprs = [...new Set(fetched.crons)].sort();
  return JSON.stringify(exprs.length ? { kind: 'cf_cron', exprs, source: 'cf_api' } : { kind: 'none', source: 'cf_api' });
}

// Drift for the jobs of one Worker. `jobs`: registry rows; `effective`: parsed effective_schedule.
export function workerDrift(jobs, effective) {
  if (!effective) return [];
  const out = [];
  const eff = effective.kind === 'cf_cron' ? normSet(effective.exprs) : new Set();
  const intended = jobs.map(j => ({ j, i: parse(j.intended_schedule) || { kind: 'none' } }));
  const union = new Set(intended.flatMap(x => (x.i.kind === 'cf_cron' ? [...normSet(x.i.exprs)] : [])));
  const extra = [...eff].filter(e => !union.has(e));
  for (const { j, i } of intended) {
    if (j.status === 'retired') continue;
    const own = i.kind === 'cf_cron' ? normSet(i.exprs) : new Set();
    const base = { job_id: j.job_id, worker: j.worker_name, intended: [...own], effective: [...eff] };
    if (effective.kind === 'not_deployed') {
      if (own.size && j.status === 'active') out.push({ ...base, type: 'not_deployed', severity: 'sev2' });
      continue;
    }
    if (eff.size && (!own.size || j.status === 'held')) {
      // Held / no-schedule job on a Worker that has triggers. Shared Worker: only when this job has no
      // schedule of its own and some trigger is not claimed by a sibling (enrich phase1 + phase23).
      if (j.status === 'held' || extra.length) out.push({ ...base, type: 'unexpected_trigger', severity: 'sev2', extra: j.status === 'held' ? [...eff] : extra });
      continue;
    }
    if (!own.size) continue;
    if (!eff.size) { out.push({ ...base, type: 'missing_trigger', severity: 'sev2' }); continue; }
    const missing = [...own].filter(e => !eff.has(e));
    if (missing.length || extra.length) out.push({ ...base, type: 'expr_mismatch', severity: 'sev2', missing, extra });
  }
  return out;
}

// Short stable signature, so the same mismatch dedupes to one case and a new mismatch raises a new one.
export function sig(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}

export function driftFinding(d) {
  const detail = d.type === 'expr_mismatch' ? ` missing ${JSON.stringify(d.missing)} extra ${JSON.stringify(d.extra)}`
    : d.type === 'unexpected_trigger' ? ` trigger(s) ${JSON.stringify(d.extra)}` : '';
  return { type: 'schedule_drift', severity: d.severity, job_id: d.job_id,
    dedupe_key: `schedule_drift:${d.job_id}:${d.type}:${sig(JSON.stringify([d.intended.sort(), d.effective.sort()]))}`,
    title: `${d.job_id}: schedule drift (${d.type}) on ${d.worker}`,
    summary: `Intended ${JSON.stringify(d.intended)} vs effective ${JSON.stringify(d.effective)} (Cloudflare API).${detail}` };
}

// GET the Worker's triggers. { deployed:true, crons:[…] } | { deployed:false } (404) | { error }.
export async function fetchSchedules(env, name, fetchImpl = fetch) {
  let resp;
  try {
    resp = await fetchImpl(`${API}/accounts/${env.CF_ACCOUNT_TAG}/workers/scripts/${encodeURIComponent(name)}/schedules`,
      { headers: { Authorization: `Bearer ${env.CF_WORKERS_READ_TOKEN}` }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) { return { error: (err && err.name) || 'fetch_error' }; }
  if (resp.status === 404) return { deployed: false };
  let body = null;
  try { body = await resp.json(); } catch { /* not JSON */ }
  if (!resp.ok || !body || body.success === false) {
    const code = body?.errors?.[0]?.code;
    if (code === 10007) return { deployed: false };              // "workers.api.error.script_not_found"
    return { error: `http_${resp.status}${code ? `:${code}` : ''}` };
  }
  const list = Array.isArray(body.result) ? body.result : (body.result?.schedules || []);
  return { deployed: true, crons: list.map(s => s.cron).filter(Boolean) };
}

// Once-a-day refresh from the sweep. `reg`: the registry rows the sweep already read.
export async function refreshSchedules(env, reg, now, meta, fetchImpl = fetch) {
  if (env.OPS_SCHEDULES_ENABLED === 'false') return { skipped: 'disabled', findings: [] };
  if (!env.CF_WORKERS_READ_TOKEN || !env.CF_ACCOUNT_TAG) return { skipped: 'no_token', findings: [] };
  const nowIso = new Date(now).toISOString();
  const day = nowIso.slice(0, 10);
  const stmts = [], findings = [], errors = {};
  let checked = 0, updated = 0;
  for (const w of SCHEDULE_WORKERS) {
    const jobs = reg.filter(j => j.worker_name === w && j.status !== 'retired');
    if (!jobs.length) continue;
    const f = await fetchSchedules(env, w, fetchImpl);
    checked++;
    if (f.error) { errors[w] = f.error; continue; }                // fail soft: no write, no drift
    const nv = effectiveJson(f);
    for (const j of jobs) {
      if (j.effective_schedule === nv) continue;
      updated++;
      stmts.push(env.DB.prepare(`UPDATE ops_job_registry SET effective_schedule = ?, updated_at = ? WHERE job_id = ? AND effective_schedule IS NOT ?`)
        .bind(nv, nowIso, j.job_id, nv));
      stmts.push(env.DB.prepare(`INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, from_value, to_value, payload, actor, actor_source, actor_role, occurred_at, idempotency_key)
        VALUES ('ops_control', ?, 'registry_updated', ?, ?, ?, 'service:health-check-local', 'ingest_key', 'Operations Lead', ?, ?)`)
        .bind(j.job_id, j.effective_schedule == null ? null : String(j.effective_schedule).slice(0, 500), nv.slice(0, 500),
              JSON.stringify({ field: 'effective_schedule', source: 'cf_api', worker: w }), nowIso, `registry:${j.job_id}:effective_schedule:${sig(nv)}:${day}`));
    }
    findings.push(...workerDrift(jobs, JSON.parse(nv)).map(driftFinding));
  }
  if (stmts.length) (await env.DB.batch(stmts)).forEach(meta);
  return { checked, updated, errors, findings };
}

// Read-time drift for GET /api/ops/admin/jobs (stored effective_schedule; 0 subrequests, 0 extra reads).
export function storedDrift(job, reg) {
  if (!job.worker_name || !SCHEDULE_WORKERS.includes(job.worker_name)) return [];
  const eff = parse(job.effective_schedule);
  if (!eff) return [];
  const siblings = reg.filter(j => j.worker_name === job.worker_name && j.status !== 'retired');
  return workerDrift(siblings, eff).filter(d => d.job_id === job.job_id)
    .map(({ type, severity, intended, effective, missing, extra }) => ({ type, severity, intended, effective, ...(missing ? { missing } : {}), ...(extra ? { extra } : {}) }));
}
