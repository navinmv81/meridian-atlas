// sweep-ext.js — MA-OCT-003 sweep extensions (spec rev 1 §9.1–§9.5, 7b8bba9f…80c2).
// Imported by ops-api.js sweep(). Ships in its own commit and deploy (Mon 26), after
// the routes. The R-E raise contract is unchanged: these helpers only add findings,
// re-key condition findings, suppress repeats, and (§9.4) auto-resolve job_missed.
//
//   conditionFindings()  E1 no-progress, E5 local auth failure, E6 blind guard (L2 rows, 0 extra reads)
//   dailyChecks()        E2 stuck in-progress (≤ 50 reads), E4 frozen source (≤ 1 read per held GLEIF job);
//                        once per UTC day, on the first sweep with no earlier health-check end event today
//   rekeyConditions()    §9.1 dedupe keys <type>:<job>:<UTC date> (job_frozen keeps its cursor marker)
//   suppress()           §9.1 S2 per job with a condition finding (UNION ALL on idx_ops_exception_job_cond)
//   autoResolve()        §9.4 F-1: replayed job_missed → resolved/replayed; a human reopen is final
//
// Switches: OPS_SWEEP_GLEIF_CHECKS="false" → E1, E2, E4, E5, E6 off (0 reads).
//           OPS_SWEEP_AUTORESOLVE must be exactly "true" to auto-resolve (absent/anything else = off, 0 reads).

export const GLEIF_JOBS = new Set(['cf.meridian-entities-enrich.phase1', 'cf.meridian-entities-enrich.phase23',
  'local.entities-enrich-boost', 'cf.meridian-entities-delta']);   // manual.gleif-reconcile-011 excluded (REVDIL 003-4, N3-1)
export const CONDITION_TYPES = ['job_frozen', 'gleif_no_progress', 'gleif_stuck_in_progress', 'gleif_frozen_source', 'local_auth_failure', 'blind_guard'];
const AUTH_ERRORS = new Set(['wrangler_auth_10000', 'CF_API_10000']);
const E2_JOB = 'cf.meridian-entities-enrich.phase23';   // the only writer of in_progress (003-1)
const LOCAL_MODES = new Set(['local_schedule', 'manual']);   // BN-7: E5 covers local runners, incl. manual ones (011, bonds)
const AUTORESOLVE_CAP = 20;
const DAY = 86400000;

const parse = d => { if (!d) return {}; if (typeof d === 'object') return d; try { return JSON.parse(d); } catch { return {}; } };
const ends = rows => rows.filter(r => r.phase === 'end').sort((a, b) => (a.started_at < b.started_at ? -1 : a.started_at > b.started_at ? 1 : 0));

// Which branch of lateness.js jobState() made a job frozen.
export function frozenBranches(runRows) {
  const done = ends(runRows).filter(r => r.event_type === 'success' || r.event_type === 'partial');
  const last3 = done.slice(-3), last = done[done.length - 1];
  return {
    cursor: last3.length === 3 && last3[0].cursor_after != null && last3.every(r => r.cursor_after === last3[0].cursor_after),
    f4: !!last && last.items_attempted > 0 && last.items_progressed === 0
  };
}

// E1, E5, E6 for one emitting job from its L2 rows (needs error_class in L2, §9.2). Returns { findings, e1 }.
export function conditionFindings(job, runRows, today) {
  const out = [];
  const t = job.job_id;
  const terminals = ends(runRows);
  const last2 = terminals.slice(-2);
  let e1 = false;
  if (GLEIF_JOBS.has(t) && last2.length === 2 && last2.every(r => (r.event_type === 'success' || r.event_type === 'partial') && r.items_attempted > 0 && r.items_progressed === 0)) {
    e1 = true;
    out.push({ type: 'gleif_no_progress', severity: 'sev2', job_id: t, dedupe_key: `gleif_no_progress:${t}:${today}`,
               title: `GLEIF-E1: ${t} made no progress on its last 2 runs`, summary: 'Last 2 end events success/partial with items_attempted > 0 and items_progressed = 0 (006 §8.3 E1).' });
  }
  if (LOCAL_MODES.has(job.execution_mode) && last2.length === 2 && last2.every(r => AUTH_ERRORS.has(r.error_class))) {
    out.push({ type: 'local_auth_failure', severity: 'sev3', job_id: t, dedupe_key: `local_auth_failure:${t}:${today}`,
               title: `GLEIF-E5: ${t} failed auth twice (${last2.map(r => r.error_class).join(', ')})`, summary: 'Last 2 end events have error_class wrangler_auth_10000 or CF_API_10000 (006 §8.3 E5).' });
  }
  if (terminals.some(r => Number(parse(r.detail)?.metrics?.guard_blind) === 1)) {
    out.push({ type: 'blind_guard', severity: 'sev4', job_id: t, dedupe_key: `blind_guard:${t}:${today}`,
               title: `GLEIF-E6: ${t} reported guard_blind = 1`, summary: 'An end event carries detail.metrics.guard_blind = 1 (006 §8.3 E6; dormant until an emitter sends it).' });
  }
  return { findings: out, e1 };
}

// True when this is the first sweep of the UTC day: no earlier local.health-check end event today (from L2).
export function firstSweepToday(sweepRows, today) {
  return !sweepRows.some(r => r.phase === 'end' && String(r.started_at).startsWith(today));
}

// E2 + E4 (once a day). `meta` adds rows_read. Returns { findings, e2, e4 }.
export async function dailyChecks(env, reg, nowMs, today, meta) {
  const findings = [];
  const cutoff = new Date(nowMs - DAY).toISOString().replace('T', ' ').slice(0, 19);   // last_attempt is 'YYYY-MM-DD HH:MM:SS'
  const q = meta(await env.DB.prepare(`SELECT entity_id, last_attempt FROM entity_enrichment_queue WHERE status = 'in_progress' AND last_attempt < ? LIMIT 50`).bind(cutoff).all());
  const stuck = q.results;
  if (stuck.length) {
    const oldest = stuck.map(r => r.last_attempt).sort()[0];
    findings.push({ type: 'gleif_stuck_in_progress', severity: 'sev3', job_id: E2_JOB, dedupe_key: `gleif_stuck_in_progress:${E2_JOB}:${today}`,
                    title: `GLEIF-E2: ${stuck.length}${stuck.length === 50 ? '+' : ''} enrichment queue row(s) stuck in_progress > 24 h`,
                    summary: `Oldest last_attempt ${oldest}. Resetting the rows is an Entities write (Data-Identity Lead packet; H-3); 003 never resets them.` });
  }
  const held = reg.filter(j => GLEIF_JOBS.has(j.job_id) && j.status === 'held');
  let e4 = 0;
  for (const j of held) {
    const r = meta(await env.DB.prepare(`SELECT MAX(started_at) AS last FROM ops_job_run WHERE job_id = ? AND event_type = 'success'`).bind(j.job_id).all()).results[0];
    e4++;
    const last = r?.last ? Date.parse(r.last) : null;
    const since = last ?? (j.created_at ? Date.parse(j.created_at) : nowMs);
    if (nowMs - since > 35 * DAY) {
      findings.push({ type: 'gleif_frozen_source', severity: 'sev3', job_id: j.job_id, dedupe_key: `gleif_frozen_source:${j.job_id}:${today}`,
                      title: `GLEIF-E4: ${j.job_id} is held and has ${last ? 'not succeeded for > 35 days' : 'never succeeded (registered > 35 days ago)'}`,
                      summary: `Last success: ${r?.last ?? 'none'}. 006 §8.3 E4 frozen source.` });
    }
  }
  return { findings, e2: stuck.length, e4 };
}

// §9.1: condition findings get one key per UTC day; job_frozen keeps its cursor marker.
export function rekeyConditions(findings, today) {
  for (const f of findings) {
    if (!CONDITION_TYPES.includes(f.type) || !f.job_id) continue;
    if (f.type === 'job_frozen') {
      if (!f.dedupe_key.endsWith(`:${today}`)) f.dedupe_key = `${f.dedupe_key}:${today}`;   // job_frozen:<job>:<cursor>:<date>
    } else f.dedupe_key = `${f.type}:${f.job_id}:${today}`;
  }
  return findings;
}

// §9.1 S2 — written as UNION ALL (the OR form uses only the 2-column index prefix).
export const S2_SQL = `SELECT exception_type FROM ops_exception
   WHERE job_id = ?1 AND exception_type IN ('job_frozen','gleif_no_progress','gleif_stuck_in_progress','gleif_frozen_source','local_auth_failure','blind_guard')
     AND status IN ('open','acknowledged')
  UNION ALL
  SELECT exception_type FROM ops_exception
   WHERE job_id = ?1 AND exception_type IN ('job_frozen','gleif_no_progress','gleif_stuck_in_progress','gleif_frozen_source','local_auth_failure','blind_guard')
     AND status = 'resolved' AND resolved_at >= ?2 AND resolution = 'accepted_risk'`;

// Returns { kept, suppressed, s2: { job_id: rows_read } }.
export async function suppress(env, findings, nowMs, meta) {
  const jobs = [...new Set(findings.filter(f => CONDITION_TYPES.includes(f.type) && f.job_id).map(f => f.job_id))];
  if (!jobs.length) return { kept: findings, suppressed: 0, s2: {} };
  const since = new Date(nowMs - 30 * DAY).toISOString();
  const res = await env.DB.batch(jobs.map(j => env.DB.prepare(S2_SQL).bind(j, since)));
  const s2 = {}, active = new Map();
  jobs.forEach((j, i) => { meta(res[i]); s2[j] = res[i].meta?.rows_read ?? 0; active.set(j, new Set(res[i].results.map(r => r.exception_type))); });
  const kept = findings.filter(f => !(CONDITION_TYPES.includes(f.type) && f.job_id && active.get(f.job_id)?.has(f.type)));
  return { kept, suppressed: findings.length - kept.length, s2 };
}

// §9.4 (F-1). latByJob: job_id → computeLateness() result for this sweep's window.
// Returns { auto_resolved: [case_ref], skipped_reopened, writes_batches }.
export async function autoResolve(env, latByJob, emitter, nowMs, meta) {
  const out = { auto_resolved: [], skipped_reopened: 0 };
  const cand = meta(await env.DB.prepare(`SELECT exception_id, case_ref, job_id, dedupe_key, status FROM ops_exception
                                            WHERE status IN ('open','acknowledged') AND exception_type = 'job_missed' LIMIT 100`).all()).results;
  const matched = [];
  for (const c of cand) {
    const prefix = `job_missed:${c.job_id}:`;
    if (!c.job_id || !c.dedupe_key?.startsWith(prefix)) continue;
    const slot = c.dedupe_key.slice(prefix.length);
    const s = (latByJob.get(c.job_id)?.slots || []).find(x => x.slot === slot);   // outside the window → never auto-resolved
    if (s && (s.state === 'on_time' || s.state === 'late') && s.run_id) matched.push({ ...c, slot, run_id: s.run_id, slot_state: s.state });
  }
  const actor = `service:${emitter}`;
  for (const c of matched) {
    if (out.auto_resolved.length >= AUTORESOLVE_CAP) break;
    const ro = meta(await env.DB.prepare(`SELECT 1 AS x FROM ops_case_event WHERE subject_type = 'exception' AND subject_id = ? AND event_type = 'reopened' LIMIT 1`)
      .bind(String(c.exception_id)).all());
    if (ro.results.length) { out.skipped_reopened++; continue; }      // a human reopen is final (A3-3(b))
    const now = new Date(Date.now()).toISOString();
    const key = `autoresolve:${c.case_ref}:${now}`;
    const res = await env.DB.batch([
      env.DB.prepare(`INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, from_value, to_value, body, payload, actor, actor_source, occurred_at, idempotency_key)
                      SELECT 'exception', CAST(exception_id AS TEXT), 'auto_resolved', status, 'resolved', ?, json_object('run_id', ?, 'slot', ?, 'slot_state', ?), ?, 'ingest_key', ?, ?
                        FROM ops_exception
                       WHERE case_ref = ? AND status IN ('open','acknowledged') AND exception_type = 'job_missed'
                         AND NOT EXISTS (SELECT 1 FROM ops_case_event WHERE idempotency_key = ?)
                         AND NOT EXISTS (SELECT 1 FROM ops_case_event WHERE subject_type = 'exception' AND subject_id = CAST(ops_exception.exception_id AS TEXT) AND event_type = 'reopened')`)
        .bind(`Replayed run ${c.run_id} matched slot ${c.slot} (${c.slot_state}).`, c.run_id, c.slot, c.slot_state, actor, now, key, c.case_ref, key),
      env.DB.prepare(`UPDATE ops_exception SET status = 'resolved', resolution = 'replayed', resolved_by = ?, resolved_at = ?, updated_at = ?
                       WHERE case_ref = ? AND status IN ('open','acknowledged')
                         AND EXISTS (SELECT 1 FROM ops_case_event WHERE idempotency_key = ? AND occurred_at = ?)`)
        .bind(actor, now, now, c.case_ref, key, now)
    ]);
    res.forEach(meta);
    if ((res[1].meta?.changes ?? 0) > 0) out.auto_resolved.push(c.case_ref);
  }
  return out;
}
