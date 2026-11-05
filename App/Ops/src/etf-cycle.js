// etf-cycle.js — MA-OCT-002b B3 (spec 002 rev 1.3 §9 (b)(c), AC-b3). ETF items from the holdings Worker's own
// B2 end events (Ops never reads ETF tables beyond 002a's holdings_pipeline_state point lookups). Imported by
// ops-api.js's sweep only.
//   One read: the last 20 holdings end events (≥ one ~12-week pass), SEARCH idx_ops_job_run_job_at (job_id=?).
//   (c) pass-cycle: weeks since the last `complete:` end event; `frozen` when the latest non-skipped run did not
//       move etf_offset (cursor_before = cursor_after, not a completion).
//   (b) next-batch cost: Σ last observed cost of each ticker in the latest event's `detail.next`; tickers never
//       seen use the mean observed cost. Warn (budget_risk sev3) when the prediction leaves < 5,000 under the
//       holdings 80k guard (reading of §9's "prediction + baseline headroom < 5,000").

export const HOLDINGS_JOB = 'cf.meridian-holdings';
const GUARD = 80000, MARGIN = 5000, WEEK = 7 * 86400000;
const parse = s => { try { return s ? JSON.parse(s) : null; } catch { return null; } };

export function cycleFrom(rows, nowMs) {
  const ends = rows.map(r => ({ ...r, d: parse(r.detail) || {} })).sort((a, b) => (a.started_at < b.started_at ? 1 : -1));   // newest first
  if (!ends.length) return { metrics: null, findings: [] };
  const lastComplete = ends.find(r => String(r.cursor_after || '').startsWith('complete:'));
  const latestRun = ends.find(r => r.event_type === 'success' || r.event_type === 'partial');
  const frozen = !!latestRun && latestRun.cursor_before != null && latestRun.cursor_before === latestRun.cursor_after;
  const cost = new Map();                                      // newest observation wins
  for (const r of [...ends].reverse()) for (const x of r.d.per_etf || []) if (Number.isInteger(x.w) && x.w >= 0) cost.set(x.t, x.w);
  const mean = cost.size ? Math.round([...cost.values()].reduce((a, b) => a + b, 0) / cost.size) : null;
  const next = (ends.find(r => Array.isArray(r.d.next))?.d.next) || [];
  const unknown = next.filter(t => !cost.has(t)).length;
  const predicted = next.length && mean !== null ? next.reduce((a, t) => a + (cost.has(t) ? cost.get(t) : mean), 0) : null;
  const metrics = { last_complete_at: lastComplete?.started_at ?? null,
    weeks_since_complete: lastComplete ? Math.floor((nowMs - Date.parse(lastComplete.started_at)) / WEEK) : null,
    frozen, predicted_next_batch: predicted, predicted_unknown: unknown, next_batch_size: next.length,
    headroom_after: predicted === null ? null : GUARD - predicted };
  const findings = [];
  if (predicted !== null && GUARD - predicted < MARGIN) findings.push({ type: 'budget_risk', severity: 'sev3',
    dedupe_key: `budget_risk:holdings_next_batch:${latestRun?.started_at?.slice(0, 10) ?? 'na'}`,
    title: `Holdings next batch predicted ${predicted} writes (< ${MARGIN} under the ${GUARD} guard)`,
    summary: `ETF item (b): Σ last observed per-ETF cost of the next ${next.length} ETFs (${unknown} unseen, at the mean ${mean}).` });
  return { metrics, findings };
}

export async function holdingsCycle(env, nowMs, meta) {
  const rows = meta(await env.DB.prepare(`SELECT started_at, event_type, cursor_before, cursor_after, detail FROM ops_job_run
    WHERE job_id = ? AND phase = 'end' ORDER BY started_at DESC LIMIT 20`).bind(HOLDINGS_JOB).all()).results;
  return cycleFrom(rows, nowMs);
}
