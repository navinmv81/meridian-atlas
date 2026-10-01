#!/usr/bin/env node
// MA-OCT-001 — ingest contract test (contract v1 + Build Brief A1).
// Reusable by 002 for every new emitter. Exercises POST /api/ops/ingest/run-event.
//
// Usage (key values come from the environment only and are never printed):
//   OPS_INGEST_URL=http://127.0.0.1:8788/api/ops/ingest/run-event \
//   OPS_EMITTER=boost-local OPS_JOB_ID=local.entities-enrich-boost OPS_INGEST_KEY=... \
//   [OPS_OTHER_EMITTER=... OPS_OTHER_KEY=...]   # optional: cross-emitter 403 check
//   node tests/ingest-contract.mjs [auth|idempotency|validation|all]
//
// Every event it records carries trigger='contract-test' so test rows are
// identifiable in ops_job_run. The 'auth' and 'validation' suites write 0 rows;
// 'idempotency' records 6 events (~30 row-writes).

import { randomUUID } from 'node:crypto';

const URL_ = process.env.OPS_INGEST_URL;
const EMITTER = process.env.OPS_EMITTER;
const KEY = process.env.OPS_INGEST_KEY;
const JOB = process.env.OPS_JOB_ID;
const suite = process.argv[2] || 'all';
if (!URL_ || !EMITTER || !KEY || !JOB) {
  console.error('Set OPS_INGEST_URL, OPS_EMITTER, OPS_INGEST_KEY and OPS_JOB_ID.');
  process.exit(2);
}

let failures = 0;
async function post(body, headers = { 'X-Ops-Emitter': EMITTER, 'X-Ops-Ingest-Key': KEY }) {
  const resp = await fetch(URL_, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(10000)
  });
  let json = null;
  try { json = await resp.json(); } catch { /* non-JSON */ }
  return { status: resp.status, json, acao: resp.headers.get('access-control-allow-origin') };
}
function check(name, cond, got) {
  if (!cond) failures++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}  → ${JSON.stringify(got)}`);
}
const now = () => new Date().toISOString();
const base = (over = {}) => ({ v: 1, run_id: randomUUID(), job_id: JOB, trigger: 'contract-test', started_at: now(), ...over });

async function authSuite() {
  const evt = base({ event: 'start' });
  let r = await post(evt, {});
  check('AUTH no key → 401', r.status === 401, r);
  r = await post(evt, { 'X-Ops-Emitter': EMITTER, 'X-Ops-Ingest-Key': 'wrong-' + randomUUID() });
  check('AUTH wrong key → 401', r.status === 401, r);
  r = await post(evt, { 'X-Ops-Emitter': 'no-such-emitter', 'X-Ops-Ingest-Key': KEY });
  check('AUTH key presented under another emitter id → 401', r.status === 401, r);
  if (process.env.OPS_OTHER_EMITTER && process.env.OPS_OTHER_KEY) {
    r = await post(evt, { 'X-Ops-Emitter': process.env.OPS_OTHER_EMITTER, 'X-Ops-Ingest-Key': process.env.OPS_OTHER_KEY });
    check(`AUTH emitter ${process.env.OPS_OTHER_EMITTER} key for ${JOB} → 403`, r.status === 403, r);
  }
  check('CORS no Access-Control-Allow-Origin on ingest', r.acao === null, { acao: r.acao });
}

async function validationSuite() {
  const cases = [
    ['v=2 rejected', base({ v: 2, event: 'start' })],
    ['items_processed rejected (A1)', base({ event: 'success', duration_ms: 1, items_processed: 4 })],
    ['skipped without reason', base({ event: 'skipped', ended_at: now(), duration_ms: 1 })],
    ['skipped with non-enum reason (A1)', base({ event: 'skipped', ended_at: now(), duration_ms: 1, detail: { reason: 'headroom' } })],
    ['failed without error', base({ event: 'failed', ended_at: now(), duration_ms: 1 })],
    ['success without duration_ms', base({ event: 'success', ended_at: now() })],
    ['started_at older than 7 days', base({ event: 'start', started_at: '2020-01-01T00:00:00Z' })],
    ['unknown event', base({ event: 'finished' })],
    ['negative items_attempted', base({ event: 'success', duration_ms: 1, items_attempted: -1 })],
    ['metrics with 17 keys (A1)', base({ event: 'success', duration_ms: 1, detail: { metrics: Object.fromEntries([...Array(17)].map((_, i) => ['k' + i, i])) } })],
    ['metrics key > 32 chars (A1)', base({ event: 'success', duration_ms: 1, detail: { metrics: { ['x'.repeat(33)]: 1 } } })],
    ['detail > 2 KB', base({ event: 'success', duration_ms: 1, detail: { pad: 'x'.repeat(2100) } })],
    ['body > 8 KB', JSON.stringify(base({ event: 'start', pad: 'x'.repeat(9000) }))],
    ['invalid JSON', '{not json']
  ];
  for (const [name, body] of cases) {
    const r = await post(body);
    check(`VALIDATION ${name} → 400`, r.status === 400, r);
  }
  const r = await post(base({ job_id: 'local.no-such-job', event: 'start' }));
  check('VALIDATION unregistered job_id → 422 unknown_job', r.status === 422 && r.json?.error === 'unknown_job', r);
}

async function idempotencySuite() {
  // AC6 (a,b): same start twice → 1 row; same end twice → 1 row.
  const runA = randomUUID(); const startedA = now();
  const startA = { v: 1, run_id: runA, job_id: JOB, trigger: 'contract-test', event: 'start', started_at: startedA };
  let r = await post(startA); check('AC6 start #1 → 201 recorded', r.status === 201 && r.json?.recorded === true, r);
  r = await post(startA);     check('AC6 start #2 (retry) → 200 duplicate', r.status === 200 && r.json?.reason === 'duplicate', r);
  // A1 / F4 signature: items_attempted > 0, items_progressed = 0, with metrics (non-integer dropped).
  const endA = { ...startA, event: 'success', ended_at: now(), duration_ms: 1234, rows_read: 10, rows_written: 0,
    items_attempted: 44, items_progressed: 0,
    detail: { metrics: { selected: 44, attempted: 44, progressed: 0, failed: 0, ext_404: 44, bogus: 'x', frac: 1.5 } } };
  r = await post(endA); check('AC6 end #1 (items_attempted=44, items_progressed=0) → 201', r.status === 201, r);
  r = await post(endA); check('AC6 end #2 (retry) → 200 duplicate', r.status === 200 && r.json?.reason === 'duplicate', r);
  // AC6 (c): success then failed for the same run_id → first wins.
  r = await post({ ...endA, event: 'failed', error: { class: 'X', summary: 'conflicting terminal' } });
  check('AC6 conflicting failed after success → 200 duplicate (first wins)', r.status === 200 && r.json?.reason === 'duplicate', r);
  // AC6 (d): end-only event → 1 row with end_only=1 (verified in D1 by the caller).
  const runB = randomUUID();
  r = await post({ v: 1, run_id: runB, job_id: JOB, trigger: 'contract-test', event: 'skipped', started_at: now(),
    ended_at: now(), duration_ms: 5, detail: { reason: 'budget', headroom: 3200 } });
  check('AC6 end-only skipped(reason=budget) → 201', r.status === 201, r);
  // A1: emitter that can't tell attempted from progressed → items_progressed omitted (NULL).
  const runC = randomUUID();
  r = await post({ v: 1, run_id: runC, job_id: JOB, trigger: 'contract-test', event: 'partial', started_at: now(),
    ended_at: now(), duration_ms: 9, items_attempted: 12, cursor: { before: 'offset=0', after: 'offset=12' } });
  check('A1 partial with items_attempted only → 201 (items_progressed NULL)', r.status === 201, r);
  console.log(`RUN_IDS ${JSON.stringify({ runA, runB, runC })}`);
}

if (suite === 'auth' || suite === 'all') await authSuite();
if (suite === 'validation' || suite === 'all') await validationSuite();
if (suite === 'idempotency' || suite === 'all') await idempotencySuite();
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
