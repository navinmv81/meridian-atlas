#!/usr/bin/env node
// MA-OCT-002b B-2 measurement: GET /api/ops/cf/invocations?script=…&subrequests=1 (spec 002 §19.5 B-2). Opt-in,
// fail-soft, no new route. Real ops-api.js, fake Cloudflare GraphQL. 0 network.   node App/Ops/tests/invocations-subrequests.mjs
let pass = 0, fail = 0;
const check = (name, ok, got) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + JSON.stringify(got).slice(0, 600)}`); };
let mode = 'ok', queries = [];
globalThis.fetch = async (u, init) => {
  const q = JSON.parse(init.body).query; queries.push(q);
  if (/subrequests/.test(q) && mode === 'schema_error') return new Response(JSON.stringify({ errors: [{ message: 'unknown field subrequests' }] }), { status: 200 });
  const adaptive = /subrequests/.test(q) ? [{ dimensions: { datetimeMinute: '2026-11-02T12:00:00Z', status: 'success' }, sum: { requests: 1, subrequests: 37 } }]
    : [{ dimensions: { datetimeMinute: '2026-11-02T12:00:00Z', status: 'success' }, sum: { requests: 1 } }];
  return new Response(JSON.stringify({ data: { viewer: { accounts: [{ workersInvocationsScheduled: [{ cron: '0 */4 * * *', datetime: '2026-11-02T12:00:03Z', status: 'success' }], workersInvocationsAdaptive: adaptive }] } } }), { status: 200 });
};
const { default: worker } = await import('../src/ops-api.js');
const env = { CF_ACCOUNT_TAG: 'acct', CF_ANALYTICS_TOKEN: 'x' };
const get = async qs => { const r = await worker.fetch(new Request(`https://meridian-ops.test/api/ops/cf/invocations?${qs}`), env, { waitUntil() {} }); return { status: r.status, body: await r.json() }; };
queries = [];
let r = await get('script=meridian-bootstrap&date=2026-11-02');
check('[B-2] meridian-bootstrap is now a tracked script; without ?subrequests the response is unchanged (1 query, no subrequests key)',
  r.status === 200 && r.body.ok && r.body.cron_invocation_count === 1 && !('subrequests' in r.body) && queries.length === 1, r);
queries = [];
r = await get('script=meridian-bootstrap&date=2026-11-02&subrequests=1');
check('[B-2] ?subrequests=1 → per-minute { minute, status, requests, subrequests } from a second query', r.body.ok && r.body.subrequests?.[0]?.subrequests === 37 && queries.length === 2, r.body);
mode = 'schema_error';
r = await get('script=meridian-holdings&date=2026-11-01&subrequests=1');
check('[B-2] GraphQL rejects the field → base response still ok, subrequests.error carries the message', r.status === 200 && r.body.ok && r.body.cron_invocation_count === 1 && /unknown field/.test(r.body.subrequests?.error), r.body);
r = await get('script=meridian-nope&subrequests=1');
check('[B-2] untracked script still rejected (allowlist unchanged)', r.body.ok === false, r.body);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
