// lateness.js — MA-OCT-002a A2 (spec MA-OCT-002 rev 1.3 §6.2–§6.3).
// Read-time lateness for meridian-ops: expected slots from a job's intended
// schedule, runs matched to slots, per-slot / per-run / per-job states, and the
// intended-only drift flags (numeric_dow, dst_shift). Pure functions, no I/O —
// the Worker passes in registry rows, runs (L2) and pauses (L3).
//
// Detection is driven by the schedule, not by received events (OB-2): a slot
// with no matching run becomes `missed` after its grace whatever arrived.
//
// Semantics that are modelled, not assumed:
//  - Cloudflare cron day-of-week: numeric 1 = Sunday … 7 = Saturday (KI 22.1);
//    named days (sun…sat) preferred. Any numeric day-of-week raises numeric_dow.
//  - launchd StartCalendarInterval fires in LOCAL wall-clock time (tz, DST);
//    a fire missed while asleep runs once on wake (→ `late`, not `missed`).

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const DOW_NAMES = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const MON_NAMES = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

export const DEFAULT_ON_TIME_TOL_S = 600;     // 10 min
export const DEFAULT_GRACE_S = 3600;          // 1 h
export const LOST_EXTRA_S = 300;              // lost = age > expected_max_duration_s + 300 s
export const MATCH_EARLY_MS = 5 * MIN;        // a run may start up to 5 min before its slot
export const MAX_LOOKBACK_DAYS = 14;

// --- cron (Cloudflare semantics) --------------------------------------------

function parseField(field, lo, hi, names, { dow = false } = {}) {
  const out = new Set();
  let numeric = false;
  for (const part of field.toLowerCase().split(',')) {
    const [rangePart, stepPart] = part.split('/');
    const step = stepPart ? parseInt(stepPart, 10) : 1;
    if (!Number.isInteger(step) || step < 1) throw new Error(`bad step in "${field}"`);
    const val = v => {
      if (names && v in names) return names[v];
      if (!/^\d+$/.test(v)) throw new Error(`bad value "${v}" in "${field}"`);
      numeric = true;
      const n = parseInt(v, 10);
      return dow ? n - 1 : n;   // CF day-of-week: 1 = Sunday → JS 0
    };
    let a, b;
    if (rangePart === '*') { a = dow ? 0 : lo; b = dow ? 6 : hi; }
    else if (rangePart.includes('-')) { const [x, y] = rangePart.split('-'); a = val(x); b = val(y); }
    else { a = val(rangePart); b = stepPart ? (dow ? 6 : hi) : a; }
    const [minV, maxV] = dow ? [0, 6] : [lo, hi];
    if (a < minV || b > maxV || a > b) throw new Error(`out of range "${field}"`);
    for (let v = a; v <= b; v += step) out.add(v);
  }
  return { set: out, star: field === '*', numeric };
}

export function parseCfCron(expr) {
  const f = expr.trim().split(/\s+/);
  if (f.length !== 5) throw new Error(`cron must have 5 fields: "${expr}"`);
  const minute = parseField(f[0], 0, 59);
  const hour = parseField(f[1], 0, 23);
  const dom = parseField(f[2], 1, 31);
  const month = parseField(f[3], 1, 12, MON_NAMES);
  const dow = parseField(f[4], 0, 6, DOW_NAMES, { dow: true });
  return { minute, hour, dom, month, dow, numericDow: !dow.star && dow.numeric };
}

function cronDayMatches(c, d) {
  if (!c.month.set.has(d.getUTCMonth() + 1)) return false;
  const domOk = c.dom.set.has(d.getUTCDate()), dowOk = c.dow.set.has(d.getUTCDay());
  if (!c.dom.star && !c.dow.star) return domOk || dowOk;   // standard cron OR rule
  return domOk && dowOk;
}

function cronSlots(exprs, fromMs, toMs) {
  const out = [];
  for (const expr of exprs) {
    const c = parseCfCron(expr);
    for (let day = Math.floor(fromMs / DAY) * DAY; day <= toMs; day += DAY) {
      const d = new Date(day);
      if (!cronDayMatches(c, d)) continue;
      for (const h of c.hour.set) for (const m of c.minute.set) {
        const t = day + h * 60 * MIN + m * MIN;
        if (t >= fromMs && t <= toMs) out.push(t);
      }
    }
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

// --- time zones (launchd local wall-clock) ------------------------------------

// Offset (ms) of `tz` at UTC instant `ms`: local wall time − UTC.
export function tzOffsetMs(tz, ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

// UTC instant of local wall time y-m-d h:mi in `tz` (DST-correct; two-pass).
export function zonedToUtc(tz, y, mo, d, h, mi) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let t = guess - tzOffsetMs(tz, guess);
  t = guess - tzOffsetMs(tz, t);
  return t;
}

function launchdSlots(s, fromMs, toMs) {
  const tz = s.tz || 'UTC';
  const out = [];
  for (let day = Math.floor(fromMs / DAY) * DAY - DAY; day <= toMs + DAY; day += DAY) {
    const d = new Date(day);
    for (const e of s.entries || []) {
      if (e.weekday !== undefined && e.weekday !== null) {
        // launchd Weekday: 0 or 7 = Sunday; matched against the LOCAL date.
        const wd = e.weekday % 7;
        const localNoon = zonedToUtc(tz, d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), 12, 0);
        const localDow = new Date(localNoon + tzOffsetMs(tz, localNoon)).getUTCDay();
        if (localDow !== wd) continue;
      }
      const t = zonedToUtc(tz, d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), e.hour, e.minute || 0);
      if (t >= fromMs && t <= toMs) out.push(t);
    }
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

// Expected slot times (ms, UTC) for an intended schedule in [fromMs, toMs].
export function expectedSlots(intended, fromMs, toMs) {
  if (!intended || intended.kind === 'none') return [];
  if (intended.kind === 'cf_cron') return cronSlots(intended.exprs || [], fromMs, toMs);
  if (intended.kind === 'launchd_calendar') return launchdSlots(intended, fromMs, toMs);
  throw new Error(`unknown schedule kind "${intended.kind}"`);
}

export const slotKey = ms => new Date(ms).toISOString().slice(0, 16) + 'Z';   // e.g. 2026-10-04T16:50Z

// --- runs ------------------------------------------------------------------

function parseDetail(d) {
  if (!d) return {};
  if (typeof d === 'object') return d;
  try { return JSON.parse(d); } catch { return {}; }
}

// Groups ops_job_run rows (L2) into runs keyed by run_id.
export function groupRuns(rows) {
  const runs = new Map();
  for (const r of rows || []) {
    const run = runs.get(r.run_id) || { run_id: r.run_id, start: null, end: null };
    if (r.phase === 'start') run.start = r; else run.end = r;
    runs.set(r.run_id, run);
  }
  return [...runs.values()].map(run => {
    const any = run.end || run.start;
    const detail = parseDetail((run.end && run.end.detail) || (run.start && run.start.detail));
    return {
      run_id: run.run_id,
      trigger: any.trigger || null,
      started_at: any.started_at,
      startedMs: Date.parse(any.started_at),
      ended_at: run.end ? run.end.ended_at : null,
      outcome: run.end ? run.end.event_type : null,
      end_only: run.end ? !!run.end.end_only : false,
      reason: detail.reason || null,
      slot: detail.slot || null,
      cursor_after: run.end ? run.end.cursor_after ?? null : null,
      items_attempted: run.end ? run.end.items_attempted ?? null : null,
      items_progressed: run.end ? run.end.items_progressed ?? null : null,
      error_class: run.end ? run.end.error_class ?? null : null
    };
  }).sort((a, b) => a.startedMs - b.startedMs);
}

// Per-run state: running / lost / <terminal event>.
export function runState(run, nowMs, expectedMaxS) {
  if (run.outcome) return run.outcome;
  const ageS = (nowMs - run.startedMs) / 1000;
  if (expectedMaxS && ageS > expectedMaxS + LOST_EXTRA_S) return 'lost';
  return 'running';
}

// Per-job state: frozen when the last 3 ended success/partial runs share the same
// non-null cursor_after, or the latest one attempted > 0 and progressed = 0 (F4).
export function jobState(runs) {
  const done = runs.filter(r => r.outcome === 'success' || r.outcome === 'partial');
  const last3 = done.slice(-3);
  if (last3.length === 3 && last3[0].cursor_after !== null && last3.every(r => r.cursor_after === last3[0].cursor_after)) return 'frozen';
  const last = done[done.length - 1];
  if (last && last.items_attempted > 0 && last.items_progressed === 0) return 'frozen';
  return 'ok';
}

// --- slot states -----------------------------------------------------------

function inPause(pauses, jobId, ms) {
  return (pauses || []).some(p => p.job_id === jobId && ms >= Date.parse(p.starts_at) && ms < Date.parse(p.ends_at));
}

/**
 * Lateness for one job.
 * @param job   registry row: { job_id, status, emitter_id, intended_schedule (JSON text|object), expected_max_duration_s }
 * @param rows  ops_job_run rows for this job inside the lookback (L2)
 * @param pauses ops_job_pause rows (L3)
 * @returns { slots: [{ slot, state, run_id, outcome, started_at }], job_state, runs: [{ run_id, state, … }] }
 */
export function computeLateness(job, rows, pauses, nowMs, lookbackDays = 7) {
  const days = Math.min(Math.max(lookbackDays | 0 || 7, 1), MAX_LOOKBACK_DAYS);
  const fromMs = nowMs - days * DAY;
  const intended = typeof job.intended_schedule === 'string' ? JSON.parse(job.intended_schedule || '{"kind":"none"}') : (job.intended_schedule || { kind: 'none' });
  const tolMs = (intended.on_time_tol_s ?? DEFAULT_ON_TIME_TOL_S) * 1000;
  const graceMs = (intended.grace_s ?? DEFAULT_GRACE_S) * 1000;

  // Contract-test runs are never matched to a slot (or counted).
  const runs = groupRuns(rows).filter(r => r.trigger !== 'contract-test');
  const used = new Set();
  const slots = [];
  for (const s of expectedSlots(intended, fromMs, nowMs)) {
    const key = slotKey(s);
    let run = runs.find(r => !used.has(r.run_id) && r.slot === key);
    if (!run) run = runs.find(r => !used.has(r.run_id) && !r.slot && r.startedMs >= s - MATCH_EARLY_MS && r.startedMs <= s + graceMs);
    if (run) used.add(run.run_id);

    let state;
    if (!job.emitter_id) state = 'unobserved';                     // cannot report → never missed
    else if (job.status === 'held' || inPause(pauses, job.job_id, s) || (run && run.outcome === 'skipped' && run.reason === 'pause')) state = 'paused';
    else if (run) state = run.startedMs <= s + tolMs ? 'on_time' : 'late';
    else state = nowMs > s + graceMs ? 'missed' : 'pending';

    slots.push({ slot: key, state, run_id: run ? run.run_id : null,
                 outcome: run ? runState(run, nowMs, job.expected_max_duration_s) : null,
                 reason: run ? run.reason : null, started_at: run ? run.started_at : null });
  }
  return {
    slots,
    job_state: jobState(runs),
    runs: runs.map(r => ({ run_id: r.run_id, state: runState(r, nowMs, job.expected_max_duration_s), started_at: r.started_at,
                           end_only: r.end_only, matched_slot: used.has(r.run_id) }))
  };
}

// --- intended-only drift flags (live effective comparison is B1) --------------

export function intendedDrift(intended, nowMs) {
  const out = [];
  if (!intended) return out;
  if (intended.kind === 'cf_cron') {
    for (const e of intended.exprs || []) if (parseCfCron(e).numericDow) out.push({ type: 'numeric_dow', severity: 'sev3', expr: e });
  }
  if (intended.kind === 'launchd_calendar' && intended.installed_utc_offset && intended.tz) {
    const off = tzOffsetMs(intended.tz, nowMs) / MIN;
    const sign = off < 0 ? '-' : '+', a = Math.abs(off);
    const now = `${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
    if (now !== intended.installed_utc_offset) {
      out.push({ type: 'dst_shift', severity: intended.dst_severity || 'sev3', installed_utc_offset: intended.installed_utc_offset, current_utc_offset: now });
    }
  }
  return out;
}
