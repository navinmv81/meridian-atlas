#!/usr/bin/env node
// MA-OCT-002a A2 — unit tests for App/Ops/src/lateness.js (spec MA-OCT-002 rev 1.3 §6.2–§6.3, test plan §19.3 step 1).
// Recorded history: the boost's ops_job_run rows from EXPLAIN pack P4 (7 Oct 19:30 UTC,
// claude/MA-OCT-002_Explain_Pack_Results.md 677dd3d0…68b4), cross-checked with the boost run log.
// Synthetic cases: pause, held, lost, frozen (cursor + F4), unobserved, DST (25 Oct), CF day-of-week (KI 22.1).
// Usage: node App/Ops/tests/lateness.test.mjs

import { computeLateness, expectedSlots, parseCfCron, intendedDrift, groupRuns, jobState, slotKey, zonedToUtc } from '../src/lateness.js';

let pass = 0, fail = 0;
const check = (name, ok, got) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + JSON.stringify(got).slice(0, 700)}`); };
const T = s => Date.parse(s);

// The boost as A1 will register it (installer FIRE_HOURS_UTC 10,16 at :50; installed under BST, +01:00).
const BOOST = {
  job_id: 'local.entities-enrich-boost', status: 'active', emitter_id: 'boost-local', expected_max_duration_s: 120,
  intended_schedule: JSON.stringify({ kind: 'launchd_calendar', tz: 'Europe/London', entries: [{ hour: 11, minute: 50 }, { hour: 17, minute: 50 }],
    utc_targets: ['10:50', '16:50'], installed_utc_offset: '+01:00', on_time_tol_s: 540, grace_s: 10800 })
};

// ops_job_run rows for the boost, EXPLAIN pack P4 (19 rows: 4 contract-test + 15 pilot).
const P4 =
[
 {
  "run_id": "28d0dc53-aedc-4033-9145-17fe6a21869a",
  "phase": "start",
  "event_type": "start",
  "started_at": "2026-10-01T05:52:50.492Z",
  "ended_at": null,
  "end_only": 0,
  "trigger": "contract-test",
  "detail": null
 },
 {
  "run_id": "28d0dc53-aedc-4033-9145-17fe6a21869a",
  "phase": "end",
  "event_type": "success",
  "started_at": "2026-10-01T05:52:50.492Z",
  "ended_at": "2026-10-01T05:52:50.757Z",
  "end_only": 0,
  "trigger": "contract-test",
  "detail": "{\"metrics\":{\"selected\":44,\"attempted\":44,\"progressed\":0,\"failed\":0,\"ext_404\":44}}"
 },
 {
  "run_id": "add5bf4a-fef4-448e-9226-fcf91f403aef",
  "phase": "end",
  "event_type": "skipped",
  "started_at": "2026-10-01T05:52:50.981Z",
  "ended_at": "2026-10-01T05:52:50.981Z",
  "end_only": 1,
  "trigger": "contract-test",
  "detail": "{\"reason\":\"budget\",\"headroom\":3200}"
 },
 {
  "run_id": "4e0e7a70-700a-443b-a23c-1cb271502740",
  "phase": "end",
  "event_type": "partial",
  "started_at": "2026-10-01T05:52:51.089Z",
  "ended_at": "2026-10-01T05:52:51.089Z",
  "end_only": 1,
  "trigger": "contract-test",
  "detail": null
 },
 {
  "run_id": "101a6ae5-94c4-4c88-8851-6a0d4f0e1dbc",
  "phase": "start",
  "event_type": "start",
  "started_at": "2026-10-02T16:50:01.789Z",
  "ended_at": null,
  "end_only": 0,
  "trigger": "manual",
  "detail": "{\"slot\":\"2026-10-02T16:50Z\",\"fired_at\":\"2026-10-02T16:50:01.789Z\",\"out_of_window\":false}"
 },
 {
  "run_id": "101a6ae5-94c4-4c88-8851-6a0d4f0e1dbc",
  "phase": "end",
  "event_type": "success",
  "started_at": "2026-10-02T16:50:01.789Z",
  "ended_at": "2026-10-02T16:50:05.135Z",
  "end_only": 0,
  "trigger": "manual",
  "detail": "{\"slot\":\"2026-10-02T16:50Z\",\"fired_at\":\"2026-10-02T16:50:01.789Z\",\"out_of_window\":false,\"http_status\":200}"
 },
 {
  "run_id": "defd7823-fe6d-445f-9735-654b63a7d623",
  "phase": "end",
  "event_type": "failed",
  "started_at": "2026-10-03T10:55:51.021Z",
  "ended_at": "2026-10-03T10:55:53.424Z",
  "end_only": 1,
  "trigger": "manual",
  "detail": "{\"slot\":\"2026-10-03T10:50Z\",\"fired_at\":\"2026-10-03T10:55:51.021Z\",\"out_of_window\":false}"
 },
 {
  "run_id": "207c93ae-1777-46dd-877f-ebab9b89c91a",
  "phase": "start",
  "event_type": "start",
  "started_at": "2026-10-03T16:52:56.204Z",
  "ended_at": null,
  "end_only": 0,
  "trigger": "manual",
  "detail": "{\"slot\":\"2026-10-03T16:50Z\",\"fired_at\":\"2026-10-03T16:52:56.204Z\",\"out_of_window\":false}"
 },
 {
  "run_id": "207c93ae-1777-46dd-877f-ebab9b89c91a",
  "phase": "end",
  "event_type": "success",
  "started_at": "2026-10-03T16:52:56.204Z",
  "ended_at": "2026-10-03T16:53:00.108Z",
  "end_only": 0,
  "trigger": "manual",
  "detail": "{\"slot\":\"2026-10-03T16:50Z\",\"fired_at\":\"2026-10-03T16:52:56.204Z\",\"out_of_window\":false,\"http_status\":200}"
 },
 {
  "run_id": "9c6bc62b-a3ee-4b3d-ba67-94ea15fc4a81",
  "phase": "start",
  "event_type": "start",
  "started_at": "2026-10-04T11:02:31.511Z",
  "ended_at": null,
  "end_only": 0,
  "trigger": "manual",
  "detail": "{\"slot\":\"2026-10-04T10:50Z\",\"fired_at\":\"2026-10-04T11:02:31.511Z\",\"out_of_window\":true}"
 },
 {
  "run_id": "9c6bc62b-a3ee-4b3d-ba67-94ea15fc4a81",
  "phase": "end",
  "event_type": "success",
  "started_at": "2026-10-04T11:02:31.511Z",
  "ended_at": "2026-10-04T11:02:34.987Z",
  "end_only": 0,
  "trigger": "manual",
  "detail": "{\"slot\":\"2026-10-04T10:50Z\",\"fired_at\":\"2026-10-04T11:02:31.511Z\",\"out_of_window\":true,\"http_status\":200}"
 },
 {
  "run_id": "0c460ddb-d071-4603-84ab-d62edb622cbb",
  "phase": "start",
  "event_type": "start",
  "started_at": "2026-10-05T11:02:48.956Z",
  "ended_at": null,
  "end_only": 0,
  "trigger": "manual",
  "detail": "{\"slot\":\"2026-10-05T10:50Z\",\"fired_at\":\"2026-10-05T11:02:48.956Z\",\"out_of_window\":true}"
 },
 {
  "run_id": "0c460ddb-d071-4603-84ab-d62edb622cbb",
  "phase": "end",
  "event_type": "success",
  "started_at": "2026-10-05T11:02:48.956Z",
  "ended_at": "2026-10-05T11:02:56.891Z",
  "end_only": 0,
  "trigger": "manual",
  "detail": "{\"slot\":\"2026-10-05T10:50Z\",\"fired_at\":\"2026-10-05T11:02:48.956Z\",\"out_of_window\":true,\"http_status\":200}"
 },
 {
  "run_id": "8ee2580b-82f0-441e-80c4-79793bdac7ee",
  "phase": "start",
  "event_type": "start",
  "started_at": "2026-10-06T10:55:15.459Z",
  "ended_at": null,
  "end_only": 0,
  "trigger": "manual",
  "detail": "{\"slot\":\"2026-10-06T10:50Z\",\"fired_at\":\"2026-10-06T10:55:15.459Z\",\"out_of_window\":false}"
 },
 {
  "run_id": "8ee2580b-82f0-441e-80c4-79793bdac7ee",
  "phase": "end",
  "event_type": "success",
  "started_at": "2026-10-06T10:55:15.459Z",
  "ended_at": "2026-10-06T10:55:19.444Z",
  "end_only": 0,
  "trigger": "manual",
  "detail": "{\"slot\":\"2026-10-06T10:50Z\",\"fired_at\":\"2026-10-06T10:55:15.459Z\",\"out_of_window\":false,\"http_status\":200}"
 },
 {
  "run_id": "8ff9e8cb-1760-41b6-9512-251a8dab7c7d",
  "phase": "start",
  "event_type": "start",
  "started_at": "2026-10-06T16:50:04.762Z",
  "ended_at": null,
  "end_only": 0,
  "trigger": "manual",
  "detail": "{\"slot\":\"2026-10-06T16:50Z\",\"fired_at\":\"2026-10-06T16:50:04.762Z\",\"out_of_window\":false}"
 },
 {
  "run_id": "8ff9e8cb-1760-41b6-9512-251a8dab7c7d",
  "phase": "end",
  "event_type": "success",
  "started_at": "2026-10-06T16:50:04.762Z",
  "ended_at": "2026-10-06T16:50:08.143Z",
  "end_only": 0,
  "trigger": "manual",
  "detail": "{\"slot\":\"2026-10-06T16:50Z\",\"fired_at\":\"2026-10-06T16:50:04.762Z\",\"out_of_window\":false,\"http_status\":200}"
 },
 {
  "run_id": "157cf734-b68a-4d5b-850b-59ba963c9a3e",
  "phase": "start",
  "event_type": "start",
  "started_at": "2026-10-07T16:53:31.832Z",
  "ended_at": null,
  "end_only": 0,
  "trigger": "manual",
  "detail": "{\"slot\":\"2026-10-07T16:50Z\",\"fired_at\":\"2026-10-07T16:53:31.832Z\",\"out_of_window\":false}"
 },
 {
  "run_id": "157cf734-b68a-4d5b-850b-59ba963c9a3e",
  "phase": "end",
  "event_type": "success",
  "started_at": "2026-10-07T16:53:31.832Z",
  "ended_at": "2026-10-07T16:53:35.369Z",
  "end_only": 0,
  "trigger": "manual",
  "detail": "{\"slot\":\"2026-10-07T16:50Z\",\"fired_at\":\"2026-10-07T16:53:31.832Z\",\"out_of_window\":false,\"http_status\":200}"
 }
];

// ---------------------------------------------------------------------------
// 1. Recorded history 2–7 Oct (AC-a2 cases available so far).
const NOW = T('2026-10-07T20:00:00Z');
const r = computeLateness(BOOST, P4, [], NOW, 6);
const st = Object.fromEntries(r.slots.map(s => [s.slot, s]));
const expect = {
  '2026-10-02T10:50Z': ['missed', null],     // fired, failed, failed event never delivered
  '2026-10-02T16:50Z': ['on_time', 'success'],
  '2026-10-03T10:50Z': ['on_time', 'failed'], // 10:55:51, within the 9-min tolerance; the one delivered failure
  '2026-10-03T16:50Z': ['on_time', 'success'],
  '2026-10-04T10:50Z': ['late', 'success'],   // 11:02 (KI 22.47)
  '2026-10-04T16:50Z': ['missed', null],      // never fired
  '2026-10-05T10:50Z': ['late', 'success'],   // 11:02 (KI 22.47)
  '2026-10-05T16:50Z': ['missed', null],      // fired, failed, undelivered
  '2026-10-06T10:50Z': ['on_time', 'success'],
  '2026-10-06T16:50Z': ['on_time', 'success'],
  '2026-10-07T10:50Z': ['missed', null],      // fired, failed, undelivered
  '2026-10-07T16:50Z': ['on_time', 'success']
};
check('[history] 12 slots generated 2 Oct 10:50 → 7 Oct 16:50 (BST, local 11:50/17:50 → 10:50/16:50 UTC)',
  r.slots.length === 12 && r.slots[0].slot === '2026-10-02T10:50Z' && r.slots[11].slot === '2026-10-07T16:50Z', r.slots.map(s => s.slot));
for (const [k, [state, outcome]] of Object.entries(expect)) {
  check(`[history] ${k} = ${state}${outcome ? ' / ' + outcome : ''}`, st[k] && st[k].state === state && st[k].outcome === outcome, st[k]);
}
check('[history] exactly 4 missed before replay (2 Oct 10:50, 4 Oct 16:50, 5 Oct 16:50, 7 Oct 10:50)', r.slots.filter(s => s.state === 'missed').length === 4, r.slots);
check('[history] contract-test runs (1 Oct 05:52) never matched or listed', !r.runs.some(x => ['28d0dc53', 'add5bf4a', '4e0e7a70'].includes(x.run_id.slice(0, 8))), r.runs);

// Replay (A4 outbox) turns the three undelivered failures into `failed`; only 4 Oct 16:50 stays missed.
const replayed = [['2026-10-02T10:50Z', '2026-10-02T10:50:01.000Z', 'e38fff34-b22b-4e07-a222-4601e5437c18'],
                  ['2026-10-05T16:50Z', '2026-10-05T16:50:02.000Z', 'r-0510-1650'], ['2026-10-07T10:50Z', '2026-10-07T10:50:02.000Z', 'r-0710-1050']]
  .map(([slot, at, id]) => ({ run_id: id, phase: 'end', event_type: 'failed', started_at: at, ended_at: at, end_only: 1, trigger: 'launchd',
                              error_class: 'wrangler_auth_10000', detail: JSON.stringify({ slot, fired_at: at, out_of_window: false }) }));
const r2 = computeLateness(BOOST, [...P4, ...replayed], [], NOW, 6);
const s2 = Object.fromEntries(r2.slots.map(s => [s.slot, s]));
check('[replay] replayed failures → on_time / failed; only 4 Oct 16:50 stays missed',
  ['2026-10-02T10:50Z', '2026-10-05T16:50Z', '2026-10-07T10:50Z'].every(k => s2[k].state === 'on_time' && s2[k].outcome === 'failed')
  && r2.slots.filter(s => s.state === 'missed').map(s => s.slot).join() === '2026-10-04T16:50Z', r2.slots);

// A skipped/out_of_window late fire is `late` + skipped(out_of_window) — counted, not raised.
const oow = [{ run_id: 'oow-1', phase: 'end', event_type: 'skipped', started_at: '2026-10-04T11:02:31.511Z', ended_at: '2026-10-04T11:02:31.600Z', end_only: 1, trigger: 'launchd',
               detail: JSON.stringify({ slot: '2026-10-04T10:50Z', out_of_window: true, reason: 'out_of_window' }) }];
const r3 = computeLateness(BOOST, [...P4.filter(x => !x.started_at.startsWith('2026-10-04T11:02')), ...oow], [], NOW, 6);
const s3 = r3.slots.find(s => s.slot === '2026-10-04T10:50Z');
check('[oow] late fire skipped(out_of_window) → late + skipped, reason out_of_window', s3.state === 'late' && s3.outcome === 'skipped' && s3.reason === 'out_of_window', s3);

// ---------------------------------------------------------------------------
// 2. Planned pause and held.
const pause = [{ job_id: BOOST.job_id, starts_at: '2026-10-04T12:00:00Z', ends_at: '2026-10-05T00:00:00Z', reason: 'test pause' }];
const rp = computeLateness(BOOST, P4, pause, NOW, 6);
check('[pause] a test ops_job_pause row turns 4 Oct 16:50 into paused (not missed)', rp.slots.find(s => s.slot === '2026-10-04T16:50Z').state === 'paused', rp.slots);
check('[pause] slots outside the window are unchanged', rp.slots.find(s => s.slot === '2026-10-04T10:50Z').state === 'late', rp.slots);
const p011 = [{ job_id: BOOST.job_id, starts_at: '2026-10-17T00:00:00Z', ends_at: '2026-10-24T00:00:00Z', reason: 'MA-OCT-011 run window' }];
const r011 = computeLateness(BOOST, [], p011, T('2026-10-24T12:00:00Z'), 8);
check('[pause] 011 week 17–23 Oct: all 14 slots paused (16 Oct 16:50, outside the window, still missed)',
  (w => w.length === 14 && w.every(s => s.state === 'paused'))(r011.slots.filter(s => s.slot >= '2026-10-17' && s.slot < '2026-10-24'))
  && r011.slots.find(s => s.slot === '2026-10-16T16:50Z')?.state === 'missed', r011.slots);
const rh = computeLateness({ ...BOOST, status: 'held' }, [], [], NOW, 2);
check('[held] a held job shows paused, never missed', rh.slots.length > 0 && rh.slots.every(s => s.state === 'paused'), rh.slots);
const pauseRun = [{ run_id: 'pz', phase: 'end', event_type: 'skipped', started_at: '2026-10-06T16:50:01Z', ended_at: '2026-10-06T16:50:01Z', end_only: 1, trigger: 'launchd',
                    detail: JSON.stringify({ slot: '2026-10-06T16:50Z', reason: 'pause' }) }];
const rpz = computeLateness(BOOST, [...P4.filter(x => !x.started_at.startsWith('2026-10-06T16:50')), ...pauseRun], [], NOW, 6);
check('[pause] a run that ended skipped(reason=pause) makes its slot paused', rpz.slots.find(s => s.slot === '2026-10-06T16:50Z').state === 'paused', rpz.slots);

// ---------------------------------------------------------------------------
// 3. Unobserved, pending, lost/running, manual runs outside a slot.
const CRON_NO_EMITTER = { job_id: 'cf.meridian-holdings', status: 'active', emitter_id: null, expected_max_duration_s: 900,
  intended_schedule: { kind: 'cf_cron', exprs: ['0 4 * * sun'], tz: 'UTC', on_time_tol_s: 600, grace_s: 7200 } };
const ru = computeLateness(CRON_NO_EMITTER, [], [], NOW, 14);
check('[unobserved] job without emitter: every slot unobserved, never missed', ru.slots.length === 2 && ru.slots.every(s => s.state === 'unobserved'), ru.slots);
const rpen = computeLateness(BOOST, [], [], T('2026-10-08T11:30:00Z'), 1);
check('[pending] a slot inside its grace with no run is pending', rpen.slots.find(s => s.slot === '2026-10-08T10:50Z').state === 'pending', rpen.slots);
const startOnly = id => [{ run_id: id, phase: 'start', event_type: 'start', started_at: '2026-10-08T10:50:05Z', trigger: 'launchd', detail: JSON.stringify({ slot: '2026-10-08T10:50Z' }) }];
check('[running] start, no end, age ≤ 120 s → running', computeLateness(BOOST, startOnly('a'), [], T('2026-10-08T10:51:00Z'), 1).runs[0].state === 'running', null);
check('[lost] start, no end, age > 120 + 300 s → lost', computeLateness(BOOST, startOnly('b'), [], T('2026-10-08T11:00:00Z'), 1).runs[0].state === 'lost', null);
const manual = [{ run_id: 'm1', phase: 'end', event_type: 'success', started_at: '2026-10-06T14:30:00Z', ended_at: '2026-10-06T14:30:05Z', end_only: 1, trigger: 'manual', detail: null }];
const rm = computeLateness(BOOST, manual, [], T('2026-10-07T00:00:00Z'), 1);
check('[manual] a manual run outside any slot window matches no slot', rm.runs[0].matched_slot === false && rm.slots.every(s => s.run_id === null), rm);

// ---------------------------------------------------------------------------
// 4. Frozen.
const runsAt = (cursor, att, prog) => ['01', '02', '03'].map(d => ({ run_id: `f${d}`, phase: 'end', event_type: 'success', started_at: `2026-10-${d}T06:50:00Z`, ended_at: `2026-10-${d}T06:51:00Z`,
  end_only: 1, trigger: 'cron', cursor_after: cursor, items_attempted: att, items_progressed: prog, detail: null }));
check('[frozen] last 3 success runs with the same cursor_after → frozen', jobState(groupRuns(runsAt('offset=71', null, null))) === 'frozen', null);
check('[frozen] F4 signature (attempted > 0, progressed = 0) → frozen', jobState(groupRuns(runsAt(null, 44, 0))) === 'frozen', null);
check('[frozen] advancing cursor and progress → ok', jobState(groupRuns(runsAt(null, 44, 12))) === 'ok', null);

// ---------------------------------------------------------------------------
// 5. Cloudflare cron semantics (KI 22.1) and DST (25 Oct).
const sun = expectedSlots({ kind: 'cf_cron', exprs: ['0 4 * * 1'] }, T('2026-09-27T00:00:00Z'), T('2026-10-11T23:59:00Z')).map(slotKey);
check('[cf-dow] "0 4 * * 1" (commented "Monday") resolves to SUNDAY 04:00 UTC (27 Sep, 4 Oct, 11 Oct) — KI 22.1',
  sun.join() === '2026-09-27T04:00Z,2026-10-04T04:00Z,2026-10-11T04:00Z', sun);
check('[cf-dow] numeric day-of-week raises numeric_dow (sev3)', intendedDrift({ kind: 'cf_cron', exprs: ['0 4 * * 1'] }, NOW).some(d => d.type === 'numeric_dow' && d.severity === 'sev3'), null);
const mon = expectedSlots({ kind: 'cf_cron', exprs: ['0 4 * * mon'] }, T('2026-09-27T00:00:00Z'), T('2026-10-11T23:59:00Z')).map(slotKey);
check('[cf-dow] "0 4 * * mon" → Mondays 28 Sep and 5 Oct; no numeric_dow', mon.join() === '2026-09-28T04:00Z,2026-10-05T04:00Z' && intendedDrift({ kind: 'cf_cron', exprs: ['0 4 * * mon'] }, NOW).length === 0, mon);
check('[cf-dow] "0 */4 * * *" → 6 slots a day (bootstrap)', expectedSlots({ kind: 'cf_cron', exprs: ['0 */4 * * *'] }, T('2026-10-05T00:00:00Z'), T('2026-10-05T23:59:00Z')).length === 6, null);
check('[cf-dow] "0 6 * * *" + "50 6 * * *" → enrich phase1/phase23 daily', expectedSlots({ kind: 'cf_cron', exprs: ['50 6 * * *'] }, T('2026-10-05T00:00:00Z'), T('2026-10-06T23:59:00Z')).map(slotKey).join() === '2026-10-05T06:50Z,2026-10-06T06:50Z', null);
let threw = false; try { parseCfCron('0 4 * * 0'); } catch { threw = true; }
check('[cf-dow] day-of-week 0 is rejected (Cloudflare rejects it too)', threw, null);
const dst = expectedSlots(JSON.parse(BOOST.intended_schedule), T('2026-10-24T00:00:00Z'), T('2026-10-26T23:59:00Z')).map(slotKey);
check('[dst] boost local 11:50/17:50: 24 Oct at 10:50/16:50 UTC; from Sun 25 Oct (GMT) at 11:50/17:50 UTC (T-D2)',
  dst.join() === '2026-10-24T10:50Z,2026-10-24T16:50Z,2026-10-25T11:50Z,2026-10-25T17:50Z,2026-10-26T11:50Z,2026-10-26T17:50Z', dst);
check('[dst] dst_shift raised from 25 Oct (installed +01:00, now +00:00), not on 20 Oct',
  intendedDrift(JSON.parse(BOOST.intended_schedule), T('2026-10-26T12:00:00Z')).some(d => d.type === 'dst_shift' && d.current_utc_offset === '+00:00')
  && intendedDrift(JSON.parse(BOOST.intended_schedule), T('2026-10-20T12:00:00Z')).length === 0, null);
check('[dst] zonedToUtc: 25 Oct 01:30 London (ambiguous hour) resolves deterministically', Number.isFinite(zonedToUtc('Europe/London', 2026, 10, 25, 1, 30)), null);
const firds = { kind: 'launchd_calendar', tz: 'Europe/London', entries: [{ weekday: 0, hour: 11, minute: 0 }] };
check('[firds] Sun 11:00 local → 4 Oct 10:00Z and 11 Oct 10:00Z (BST)', expectedSlots(firds, T('2026-10-01T00:00:00Z'), T('2026-10-12T00:00:00Z')).map(slotKey).join() === '2026-10-04T10:00Z,2026-10-11T10:00Z', null);

// ---------------------------------------------------------------------------
// 6. Cost guard: a 14-day, 49-job fleet stays cheap in CPU (Workers 10 ms budget is per request; this is a sanity bound).
const t0 = performance.now();
for (let i = 0; i < 49; i++) computeLateness(i % 2 ? BOOST : { ...CRON_NO_EMITTER, intended_schedule: { kind: 'cf_cron', exprs: ['0 */4 * * *'] } }, P4, p011, NOW, 14);
const ms = performance.now() - t0;
check(`[cost] 49 jobs × 14 days computed in ${ms.toFixed(1)} ms (sanity bound 200 ms on this Mac)`, ms < 200, ms);

console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? 'FAILED' : 'ALL PASSED');
process.exit(fail ? 1 : 0);
