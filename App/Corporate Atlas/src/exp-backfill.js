// exp-backfill.js — MA-NOV-EXP.BFS.BUILD: scheduled exposure back-fill + recurring refresh (gate3 v2).
// Spec: claude/specs/MA-NOV-EXP_Spec_Addendum_BF.md §2–§6 (approved, NML-1120-3); CR MA-NOV-EXP_BF_Change_Request.md.
//
// Runs ONLY in the 06:00 UTC firing of meridian-entities-enrich, after Phase 1 (scheduled(), never /run).
// Per run day (Tue–Sat UTC): pick holder-months ≥ 2026-04 that have complete holdings and no coverage row; pack them
// into batches (≤ 12,000 snapshot holdings; one fund ≤ 18,000 alone); count each batch exactly; write it in ONE D1
// transaction (batch()) with INSERT OR IGNORE if the projection fits the day's budget B = min(cap, 60,000 − U).
//
// Writes ONLY entity_exposure_monthly and fund_exposure_coverage. Reads (never writes) holdings_pipeline_state
// (hold_all_jobs), ops_job_registry (write_budget_profile) and ops_job_pause. Progress is the data itself: a
// holder-month is done when its fund_exposure_coverage row exists (no cursor, no new table).
//
// Ships OFF (Founder decision 6): with no ops_job_registry row for the job, or no ops_job_pause row for it ever
// written (BFS.OPS not done yet), the job does nothing: `skipped/not_enabled`, 0 writes, 0 heartbeats (ingest would
// reject an unregistered job_id, and `not_enabled` is not an Ops skip reason).
//
// Identity rule: the SQL below is the gate3 v2 template (App/Corporate Atlas/gate3v2/gate3v2-month.sql.tmpl, 4cdd22e)
// with the two BFS changes (§3): `fel` restricted to the batch's holder range minus done holders, and CROSS JOIN so
// the plan is holder-driven (SEARCH idx_holdings_status_series_month). tests/exp-backfill.test.mjs checks the key
// CASE and the j CTE are character-identical to the template, and that results equal the whole-month template.

import { heartbeat, cronTrigger } from './ops-heartbeat.js';

export const EXPBF_JOB_ID = 'cf.meridian-entities-enrich.expbf';
export const MONTH_FLOOR = '2026-04';            // months ≤ 2026-03 are never selected (December decision)
export const H_MAX = 12000;                      // Σ snapshot holdings per batch
export const SOLO_MAX = 18000;                   // a single holder above H_MAX goes alone up to this; above → oversize
export const DEFAULT_CAP = 40000;                // Founder decision 3: default if the profile has no cap
export const HARD_CEILING = 50000;               // Founder D4: never more than this per day, whatever the profile says
export const ANALYTICS_CEILING = 60000;          // F-5 ceiling (ML-1012-1), same as Phase 1
export const MIN_ROOM = 5000;                    // 60,000 − U below this → skip the day
export const ROWS_READ_STOP = 50000;             // any statement reading more → stop, failed/EXPBF_BUDGET_OVERRUN
export const OVERRUN_FACTOR = 1.25;              // a batch writing more than 1.25 × its projection → same
export const MULT_EXPOSURE = 4;                  // table + PK autoindex + idx_exposure_entity + idx_exposure_holder
export const MULT_COVERAGE = 2;                  // table + PK autoindex
export const CANDIDATE_LIMIT = 300;
export const SKIP_UTC_DAYS = [0, 1];             // Sun (holdings 04:00), Mon (entities-seed 04:00). C1 adds Wed (3).

// Per-invocation budget (CR three-point check 3; MA-NOV-EXP.BFS.FIX M1). Before each batch the run projects the
// batch's D1 calls (1 count + 2 in batch() = 3) and rows read, and stops `partial` (detail.reason `run_limit`) if
// the next batch would pass any of these. D1 calls include the controls read (1) and the candidates statement (1),
// so 1 + 1 + 3 × 3 = 11 ≤ 12. Rows read: before the count, the previous batch's reads are the estimate; after it,
// the INSERT pair is projected at ≈ 1 × the count's reads. The count itself is still capped by ROWS_READ_STOP.
export const EXPBF_MAX_BATCHES_PER_RUN = 3;
export const EXPBF_MAX_D1_CALLS_PER_RUN = 12;
export const EXPBF_MAX_ROWS_READ_PER_RUN = 150000;
export const D1_CALLS_PER_BATCH = 3;              // count + exposure INSERT + coverage INSERT
export const INSERT_PAIR_READ_FACTOR = 1;         // INSERT pair reads ≈ 1 × the count's reads (BFS.REVIEW check 7)

// ── SQL ──────────────────────────────────────────────────────────────────────────────────────────────────────────
// Bound parameters only: ?1 = report_month, ?2 = holder lo, ?3 = holder hi, ?4 = run token.
// Candidates: the EXISTS probe is pinned INDEXED BY idx_holdings_status_series_month. The live plan (B10, 20 Nov) chose
// idx_holdings_series_month, which reads every row of an incomplete series-month (e.g. MBB 2026-08, 11,211 NULL-status
// rows) before failing. Pinned, the probe reads 0–1 rows. If the index is ever dropped the statement errors (fail closed).

const KEY_CASE = `CASE WHEN length(trim(f.isin)) = 12 THEN trim(f.isin)
         WHEN length(trim(f.cusip)) >= 6 AND trim(f.cusip) <> '000000000' THEN 'CUSIP:' || trim(f.cusip)
         WHEN trim(coalesce(f.security_ticker, '')) <> '' THEN 'TICKER:' || upper(trim(f.security_ticker)) END k`;

const J_CTE = `j AS (
  SELECT h.holder, h.w,
    CASE WHEN m.entity_id IS NULL OR rd3.survivor_id IS NOT NULL THEN NULL
         ELSE COALESCE(rd2.survivor_id, rd1.survivor_id, m.entity_id) END eid
  FROM h LEFT JOIN instrument_entity_map m ON m.instrument_key = h.k
         LEFT JOIN entity_merge_redirect rd1 ON rd1.duplicate_id = m.entity_id
         LEFT JOIN entity_merge_redirect rd2 ON rd2.duplicate_id = rd1.survivor_id
         LEFT JOIN entity_merge_redirect rd3 ON rd3.duplicate_id = rd2.survivor_id)`;

const BATCH_CTE = `WITH fel AS (SELECT DISTINCT series_id, entity_id FROM fund_entity_link
             WHERE series_id IS NOT NULL AND ?1 >= '${MONTH_FLOOR}' AND entity_id BETWEEN ?2 AND ?3
               AND entity_id NOT IN (SELECT holder_entity_id FROM fund_exposure_coverage WHERE report_month = ?1)),
h AS (
  SELECT fel.entity_id holder, f.weight_pct w,
    ${KEY_CASE}
  FROM fel CROSS JOIN fund_holdings_monthly f
  WHERE f.snapshot_status = 'complete' AND f.series_id = fel.series_id AND f.report_month = ?1),
${J_CTE}`;

export const SQL = {
  controls: `SELECT
    (SELECT value FROM holdings_pipeline_state WHERE key = 'hold_all_jobs') hold,
    (SELECT 1 FROM ops_job_registry WHERE job_id = ?1) registered,
    (SELECT write_budget_profile FROM ops_job_registry WHERE job_id = ?1) profile,
    EXISTS (SELECT 1 FROM ops_job_pause WHERE job_id = ?1) pause_ever,
    EXISTS (SELECT 1 FROM ops_job_pause WHERE job_id = ?1 AND ends_at > ?2 AND starts_at <= ?2) paused`,

  candidates: `SELECT s.report_month m, fel.entity_id holder, s.holdings_count n
  FROM fund_snapshot_monthly s
  JOIN (SELECT DISTINCT series_id, entity_id FROM fund_entity_link WHERE series_id IS NOT NULL) fel ON fel.series_id = s.series_id
  LEFT JOIN fund_exposure_coverage c ON c.report_month = s.report_month AND c.holder_entity_id = fel.entity_id
  WHERE s.report_month >= '${MONTH_FLOOR}' AND c.holder_entity_id IS NULL
    AND EXISTS (SELECT 1 FROM fund_holdings_monthly f INDEXED BY idx_holdings_status_series_month
                WHERE f.snapshot_status = 'complete' AND f.series_id = s.series_id AND f.report_month = s.report_month)
  ORDER BY s.report_month, fel.entity_id LIMIT ${CANDIDATE_LIMIT}`,

  count: `${BATCH_CTE}
SELECT COUNT(DISTINCT CASE WHEN eid IS NOT NULL THEN eid || '|' || holder END) exposure_rows,
       COUNT(DISTINCT holder) coverage_rows, COUNT(*) holdings_rows, COALESCE(SUM(eid IS NOT NULL), 0) mapped_rows FROM j`,

  exposureInsert: `${BATCH_CTE}
INSERT OR IGNORE INTO entity_exposure_monthly (report_month, entity_id, holder_entity_id, weight_sum, aum_weighted, computed_at)
SELECT ?1, eid, holder, COALESCE(SUM(w), 0), NULL, ?4
FROM j WHERE eid IS NOT NULL GROUP BY eid, holder`,

  coverageInsert: `${BATCH_CTE}
INSERT OR IGNORE INTO fund_exposure_coverage (report_month, holder_entity_id, total_weight, mapped_weight, computed_at)
SELECT ?1, holder, COALESCE(SUM(w), 0), COALESCE(SUM(CASE WHEN eid IS NOT NULL THEN w END), 0), ?4
FROM j GROUP BY holder`,
};
export const _TEMPLATE_PARTS = { KEY_CASE, J_CTE };   // for the drift test only

// ── Pure helpers ─────────────────────────────────────────────────────────────────────────────────────────────────

export const isSkipDay = (now, skipDays = SKIP_UTC_DAYS) => skipDays.includes(now.getUTCDay());

export function runToken(now, n) {
  const d = now.toISOString().slice(0, 10).replaceAll('-', '');
  return `g3v2s-${d}-${String(n).padStart(2, '0')}`;
}

// Cap from ops_job_registry.write_budget_profile ({"daily_rows_written_cap":N}); absent/unreadable → 40,000;
// clamped to the 50,000 hard ceiling.
export function capFromProfile(profile) {
  let cap = DEFAULT_CAP;
  try {
    const p = typeof profile === 'string' ? JSON.parse(profile) : null;
    const v = p && p.daily_rows_written_cap;
    if (Number.isInteger(v) && v >= 0) cap = v;
  } catch { /* default */ }
  return Math.min(cap, HARD_CEILING);
}

// B = min(cap, 60,000 − U); null when the day must be skipped (U unknown, or 60,000 − U < 5,000).
export function dayBudget(cap, U) {
  if (!Number.isInteger(U)) return null;
  const room = ANALYTICS_CEILING - U;
  if (room < MIN_ROOM) return null;
  return Math.max(0, Math.min(cap, room));
}

// Candidates (ordered by month, holder) → batches { m, lo, hi, holders, n }. Batches never mix months; Σn ≤ H_MAX
// except a solo batch (one holder, H_MAX < n ≤ SOLO_MAX); a holder above SOLO_MAX is skipped and returned in
// `oversize`. A holder appearing twice in one month (two series) is summed first.
export function packBatches(candidates) {
  const merged = [];
  for (const c of candidates) {
    const last = merged[merged.length - 1];
    const n = Number(c.n) || 0;
    if (last && last.m === c.m && last.holder === c.holder) last.n += n;
    else merged.push({ m: c.m, holder: Number(c.holder), n });
  }
  const batches = [], oversize = [];
  let cur = null;
  const close = () => { if (cur) batches.push(cur); cur = null; };
  for (const c of merged) {
    if (c.n > SOLO_MAX) { close(); oversize.push(c); continue; }
    if (c.n > H_MAX) { close(); batches.push({ m: c.m, lo: c.holder, hi: c.holder, holders: [c.holder], n: c.n, solo: true }); continue; }
    if (cur && (cur.m !== c.m || cur.n + c.n > H_MAX)) close();
    if (!cur) cur = { m: c.m, lo: c.holder, hi: c.holder, holders: [], n: 0, solo: false };
    cur.hi = c.holder; cur.holders.push(c.holder); cur.n += c.n;
  }
  close();
  return { batches, oversize, holderMonths: merged.length };
}

const ym = m => (m ? Number(m.slice(0, 4)) * 100 + Number(m.slice(5, 7)) : 0);
const rowsRead = r => Number(r && r.meta && r.meta.rows_read) || 0;
const rowsWritten = r => Number(r && r.meta && r.meta.rows_written) || 0;

// ── Controls ─────────────────────────────────────────────────────────────────────────────────────────────────────

export async function readControls(env, now) {
  const r = await env.DB.prepare(SQL.controls).bind(EXPBF_JOB_ID, now.toISOString()).first();
  return {
    hold: r?.hold === 'true',
    enabled: !!(r && r.registered && r.pause_ever),
    paused: !!(r && r.paused),
    cap: capFromProfile(r?.profile ?? null),
  };
}

// ── The run ──────────────────────────────────────────────────────────────────────────────────────────────────────
// Returns { event, reason?, error?, metrics, rows_written, rows_read, items_attempted, items_progressed }.
// event: success | partial | skipped | failed. Never throws for a guard; a D1 error inside a batch → failed.

export async function runExpBackfill(env, { U = null, now = new Date(), controls, log = console.log, skipDays = SKIP_UTC_DAYS } = {}) {
  const ctl = controls || await readControls(env, now);
  const metrics = { batches: 0, holders_done: 0, rows_written: 0, rows_read_max_stmt: 0, rows_read_total: 0, exposure_rows: 0,
                    remaining_holder_months: 0, oldest_open_month: 0, budget_B: 0, analytics_U: Number.isInteger(U) ? U : 0,
                    oversize_skipped: 0, d1_calls: 1 /* controls read, here or in the step */ };
  const out = (event, extra = {}) => ({ event, metrics, rows_written: metrics.rows_written, rows_read: metrics.rows_read_total,
                                       items_attempted: extra.attempted ?? 0, items_progressed: metrics.holders_done, ...extra });
  if (!ctl.enabled) return out('skipped', { reason: 'not_enabled' });
  if (ctl.hold) return out('skipped', { reason: 'hold' });
  if (ctl.paused) return out('skipped', { reason: 'pause' });
  if (isSkipDay(now, skipDays)) return out('skipped', { reason: 'out_of_window' });
  const B = dayBudget(ctl.cap, U);
  if (B === null) {
    log(`[entities-enrich][expbf] skipped: budget (analytics U=${U === null ? 'unavailable' : U}, ceiling ${ANALYTICS_CEILING})`);
    return out('skipped', { reason: 'budget' });
  }
  metrics.budget_B = B;

  const cand = await env.DB.prepare(SQL.candidates).all();
  metrics.d1_calls++;
  const cr = rowsRead(cand);
  metrics.rows_read_total += cr; metrics.rows_read_max_stmt = Math.max(metrics.rows_read_max_stmt, cr);
  const { batches, oversize, holderMonths } = packBatches(cand.results || []);
  metrics.oversize_skipped = oversize.length;
  for (const o of oversize) log(`[entities-enrich][expbf] oversize m=${o.m} holder=${o.holder} n=${o.n} (> ${SOLO_MAX}) skipped`);
  let remaining = holderMonths - oversize.length;
  const finish = (event, extra) => {
    metrics.remaining_holder_months = Math.max(0, remaining);
    const open = batches.find(b => !b.done);   // oversize holders are reported in oversize_skipped, not here
    metrics.oldest_open_month = open ? ym(open.m) : 0;
    return out(event, extra);
  };
  if (!batches.length) return finish('skipped', { reason: 'empty_input' });
  if (cr > ROWS_READ_STOP) return finish('failed', { error: overrun(`candidates rows_read ${cr} > ${ROWS_READ_STOP}`) });

  let left = B, attempted = 0, lastBatchReads = 0;
  const runLimit = (b, why) => {
    log(`[entities-enrich][expbf] stop: run_limit (${why}) before m=${b.m} holders=${b.lo}..${b.hi}`);
    return finish('partial', { attempted, reason: 'run_limit' });
  };
  for (const b of batches) {
    if (metrics.batches + 1 > EXPBF_MAX_BATCHES_PER_RUN) return runLimit(b, `batches ${metrics.batches} of ${EXPBF_MAX_BATCHES_PER_RUN}`);
    if (metrics.d1_calls + D1_CALLS_PER_BATCH > EXPBF_MAX_D1_CALLS_PER_RUN) return runLimit(b, `d1_calls ${metrics.d1_calls} + ${D1_CALLS_PER_BATCH} > ${EXPBF_MAX_D1_CALLS_PER_RUN}`);
    if (metrics.rows_read_total + lastBatchReads > EXPBF_MAX_ROWS_READ_PER_RUN) return runLimit(b, `rows_read ${metrics.rows_read_total} + ~${lastBatchReads} > ${EXPBF_MAX_ROWS_READ_PER_RUN}`);
    const cnt = await env.DB.prepare(SQL.count).bind(b.m, b.lo, b.hi).all();
    metrics.d1_calls++;
    const r0 = rowsRead(cnt);
    metrics.rows_read_total += r0; metrics.rows_read_max_stmt = Math.max(metrics.rows_read_max_stmt, r0);
    const c = (cnt.results && cnt.results[0]) || {};
    const exp = Number(c.exposure_rows) || 0, cov = Number(c.coverage_rows) || 0;
    if (r0 > ROWS_READ_STOP) return finish('failed', { attempted, error: overrun(`count m=${b.m} holders=${b.lo}..${b.hi} rows_read ${r0} > ${ROWS_READ_STOP}`) });
    const projection = exp * MULT_EXPOSURE + cov * MULT_COVERAGE;
    if (cov === 0) { b.done = true; remaining -= b.holders.length; lastBatchReads = r0; continue; }   // nothing complete any more: no write
    const pairReads = Math.ceil(r0 * INSERT_PAIR_READ_FACTOR);
    if (metrics.rows_read_total + pairReads > EXPBF_MAX_ROWS_READ_PER_RUN) return runLimit(b, `rows_read ${metrics.rows_read_total} + ~${pairReads} > ${EXPBF_MAX_ROWS_READ_PER_RUN}`);
    if (projection > left) {
      log(`[entities-enrich][expbf] stop: m=${b.m} holders=${b.lo}..${b.hi} projection=${projection} > remaining=${left}`);
      return finish('partial', { attempted });
    }
    const token = runToken(now, metrics.batches + 1);
    attempted += cov;
    let res;
    try {
      res = await env.DB.batch([
        env.DB.prepare(SQL.exposureInsert).bind(b.m, b.lo, b.hi, token),
        env.DB.prepare(SQL.coverageInsert).bind(b.m, b.lo, b.hi, token),
      ]);
    } catch (err) {
      metrics.d1_calls += 2;
      log(`[entities-enrich][expbf] batch failed m=${b.m} holders=${b.lo}..${b.hi} token=${token}: ${(err && err.message) || err}`);
      return finish('failed', { attempted, error: { class: 'EXPBF_D1_ERROR', summary: String((err && err.message) || err).slice(0, 300) } });
    }
    metrics.d1_calls += 2;
    const written = res.reduce((s, r) => s + rowsWritten(r), 0);
    const readMax = Math.max(...res.map(rowsRead));
    const readSum = res.reduce((s, r) => s + rowsRead(r), 0);
    metrics.batches++; metrics.rows_written += written; metrics.rows_read_total += readSum;
    metrics.rows_read_max_stmt = Math.max(metrics.rows_read_max_stmt, readMax);
    metrics.exposure_rows += exp; metrics.holders_done += cov;
    // M2: the hard ceiling holds whatever the projection — writing more than was left (before subtracting) is an overrun.
    const overBudget = written > left;
    const leftBefore = left;
    b.done = true; remaining -= b.holders.length; left -= written; lastBatchReads = r0 + readSum;
    log(`[entities-enrich][expbf] m=${b.m} holders=${b.lo}..${b.hi} n=${b.holders.length} exp_rows=${exp} rows_read=${r0} rows_written=${written} projection=${projection} token=${token}`);
    if (readMax > ROWS_READ_STOP || written > OVERRUN_FACTOR * projection || overBudget) {
      return finish('failed', { attempted, error: overrun(`m=${b.m} holders=${b.lo}..${b.hi} rows_written ${written} (projection ${projection}, left ${leftBefore}), rows_read max ${readMax}`) });
    }
  }
  return finish(remaining > 0 ? 'partial' : 'success', { attempted });
}

const overrun = summary => ({ class: 'EXPBF_BUDGET_OVERRUN', summary });

// Heartbeat end fields for a run result (≤ 16 flat integer metrics; skip reasons are Ops SKIPPED_REASONS).
export function expbfEventFields(r) {
  const f = { rows_written: r.rows_written, rows_read: r.rows_read, items_attempted: r.items_attempted,
              items_progressed: r.items_progressed, detail: { metrics: { ...r.metrics } } };
  if (r.reason) f.detail.reason = r.reason;
  if (r.error) f.error = r.error;
  return f;
}

// ── The step, as scheduled() calls it (06:00 firing, after Phase 1) ──────────────────────────────────────────────
// Isolated: never throws, so it can never change Phase 1's outcome or heartbeat. `forced` = 'hold' | 'budget' when
// Phase 1 itself stopped early (the job still reports the day, if it is enabled). 0 fetches when not enabled,
// otherwise 2 (own start + end); it reuses Phase 1's analytics figure U (no fetch of its own).
export async function runExpBackfillStep(env, ctx, event, { U = null, forced = null, now = () => new Date(), log = console.log, fetchImpl } = {}) {
  let hb = null;
  try {
    const t = now();
    const controls = await readControls(env, t);
    if (!controls.enabled) { log('[entities-enrich][expbf] not enabled (no registry or pause row yet) — nothing done'); return { event: 'skipped', reason: 'not_enabled' }; }
    hb = heartbeat(env, ctx, { jobId: EXPBF_JOB_ID, trigger: cronTrigger(event), ...(fetchImpl ? { fetchImpl } : {}) });
    hb.start();
    // forced 'hold' → the hold guard fires; forced 'budget' → U treated as unknown, so after hold / pause /
    // out_of_window the budget guard fires (fail closed). Neither path reaches a D1 write.
    const r = await runExpBackfill(env, { U: forced === 'budget' ? null : U, now: t, log,
                                          controls: forced === 'hold' ? { ...controls, hold: true } : controls });
    hb.end(r.event, expbfEventFields(r));
    log(`[entities-enrich][expbf] ${r.event}${r.reason ? '/' + r.reason : ''} batches=${r.metrics.batches} rows_written=${r.metrics.rows_written} B=${r.metrics.budget_B}`);
    return r;
  } catch (err) {
    log(`[entities-enrich][expbf] error: ${(err && err.message) || err}`);
    try { if (hb) hb.fail(err); } catch { /* never surfaces */ }
    return { event: 'failed', error: { class: (err && err.name) || 'Error', summary: String((err && err.message) || err).slice(0, 300) } };
  }
}
