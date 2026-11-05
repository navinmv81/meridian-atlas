// ops-heartbeat.js — MA-OCT-002b B2 (spec 002 rev 1.3 §12): Worker → meridian-ops run events
// (001 option A: authenticated ingest, POST OPS_INGEST_URL with X-Ops-Emitter / X-Ops-Ingest-Key).
// Rules (001 §7.5): fire-and-forget through ctx.waitUntil, never awaited in the job's flow; 2 s timeout;
// 0 retries and no outbox (subrequest budget) — a lost event shows as a `missed` slot or `lost` run;
// called from scheduled() only (trigger `cron:<expr>`), never from /run.
// Inert (0 subrequests) until OPS_INGEST_URL + OPS_EMITTER (vars) and OPS_INGEST_KEY (secret) are all set;
// OPS_HEARTBEATS_ENABLED="false" turns it off again without a code change.
// The same file is kept in App/ETF Refresh/src and App/Corporate Atlas/src (no cross-domain import).

const TIMEOUT_MS = 2000;

export const cronTrigger = event => `cron:${(event && event.cron) || 'unknown'}`;

export function heartbeat(env, ctx, { jobId, trigger, endOnly = false, fetchImpl = fetch, now = () => new Date() }) {
  const on = !!(env.OPS_INGEST_URL && env.OPS_EMITTER && env.OPS_INGEST_KEY) && env.OPS_HEARTBEATS_ENABLED !== 'false';
  const runId = crypto.randomUUID();
  const started = now();
  let sent = 0;
  const send = evt => {
    if (!on) return;
    sent++;
    ctx.waitUntil(fetchImpl(env.OPS_INGEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Ops-Emitter': env.OPS_EMITTER, 'X-Ops-Ingest-Key': env.OPS_INGEST_KEY },
      body: JSON.stringify(evt), signal: AbortSignal.timeout(TIMEOUT_MS)
    }).then(r => { if (!r.ok) console.log(`[ops-heartbeat] ${jobId} ${evt.event}: HTTP ${r.status}`); },
            e => console.log(`[ops-heartbeat] ${jobId} ${evt.event}: ${(e && e.name) || 'error'}`)));
  };
  const base = () => ({ v: 1, run_id: runId, job_id: jobId, trigger, started_at: started.toISOString() });
  return {
    runId,
    get sent() { return sent; },
    get enabled() { return on; },
    start() { if (!endOnly) send({ ...base(), event: 'start' }); },
    // event: success | partial | skipped | failed; fields: rows_written, items_attempted, items_progressed, cursor, detail, error.
    end(event, fields = {}) {
      const e = now();
      send({ ...base(), event, ended_at: e.toISOString(), duration_ms: Math.max(0, e - started), ...fields });
    },
    fail(err) { this.end('failed', { error: { class: (err && err.name) || 'Error', summary: String((err && err.message) || err).slice(0, 300) } }); }
  };
}
