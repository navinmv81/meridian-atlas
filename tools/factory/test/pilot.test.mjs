// MA-NOV-P1.BUILD pilot tests (Task §7). Run: node --test tools/factory/test
// Every test builds its own temp repo; the dispatcher launches only the stub in fixtures/.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeRepo, envFor, runNode, spawnNode, callCount, status, waitFor, stripGenerated, DISPATCH, FACTORY, REAL_ROOT } from './helpers.mjs';
import { writeStatus, listStatus, OwnershipError, TransitionError, RevConflictError } from '../lib/state.mjs';
import { acquireLease, LeaseError } from '../lib/lease.mjs';
import { evaluate } from '../lib/eligibility.mjs';
import { project, BOARD_TITLE, BOARD_SECTION } from '../project.mjs';

const A = 'MA-NOV-TA';
const B = 'MA-NOV-TB';
const P = (repo, ...p) => path.join(repo.root, ...p);
const statusFile = (repo, id) => P(repo, 'claude', 'packets', `${id}_Status.json`);
const report = (id) => `claude/packets/${id}_Report.md`;

test('1. invalid transition refused (READY -> CLOSED); valid READY -> EXECUTING accepted', () => {
  const repo = makeRepo({ packets: [A], git: false });
  const before = fs.readFileSync(statusFile(repo, A));
  assert.throws(() => writeStatus(A, (s) => { s.state = 'CLOSED'; }, { writer: 'main-lane', expectRev: 1, root: repo.root }), TransitionError);
  assert.deepEqual(fs.readFileSync(statusFile(repo, A)), before, 'file unchanged after refused transition');
  const w = writeStatus(A, (s) => { s.state = 'EXECUTING'; }, { writer: 'dispatcher', expectRev: 1, root: repo.root });
  assert.equal(w.rev, 2);
  assert.throws(() => writeStatus(A, (s) => { s.state = 'READY'; }, { writer: 'main-lane', expectRev: 2, root: repo.root }), TransitionError);
});

test('2. duplicate launch refused (second wx lease fails; two racing dispatchers launch once)', async () => {
  const repo = makeRepo({ packets: [A] });
  const lease = { run_id: 'r-x', pid: process.pid, acquired: 'x', expires: 'x' };
  const tmpRepo = makeRepo({ packets: [A], git: false });
  acquireLease(tmpRepo.root, A, lease);
  assert.throws(() => acquireLease(tmpRepo.root, A, lease), LeaseError);

  const env = envFor(repo, { FAKE_SLEEP_MS: '800', FAKE_REPORT: report(A) });
  const r1 = spawnNode(DISPATCH, ['run', A], env);
  const r2 = spawnNode(DISPATCH, ['run', A], env);
  const [o1, o2] = await Promise.all([r1.done, r2.done]);
  const codes = [o1.code, o2.code].sort();
  assert.deepEqual(codes, [0, 2], `exit codes ${codes}; stderr: ${o1.err} | ${o2.err}`);
  assert.match(o1.code === 2 ? o1.err : o2.err, /refused/);
  assert.equal(callCount(repo), 1, 'stub launched exactly once');
  assert.equal(status(repo, A).state, 'REVIEW_NEEDED');
});

test('3. stale approval (Task edited after approval) refused', () => {
  const repo = makeRepo({ packets: [A] });
  fs.appendFileSync(P(repo, 'claude', 'packets', `${A}_Task_v1.md`), 'edited after approval\n');
  const ev = evaluate({ root: repo.root });
  assert.deepEqual(ev.eligible, []);
  assert.ok(ev.ineligible[0].reasons.some((r) => /Task on disk differs from approval/.test(r)), JSON.stringify(ev.ineligible));
  const r = runNode(DISPATCH, ['run', A], envFor(repo, { FAKE_REPORT: report(A) }));
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /stale approval/);
  assert.equal(callCount(repo), 0);
  assert.equal(status(repo, A).state, 'READY');
});

test('4. scope violation -> BLOCKED (write outside allowed_write_paths detected by git diff)', () => {
  const repo = makeRepo({ packets: [A] });
  const r = runNode(DISPATCH, ['run', A], envFor(repo, { FAKE_REPORT: report(A), FAKE_WRITE_OUTSIDE: 'App/evil.js' }));
  assert.equal(r.status, 3, r.stderr + r.stdout);
  const s = status(repo, A);
  assert.equal(s.state, 'BLOCKED');
  assert.match(s.run.blocked_reason, /scope violation: App\/evil\.js/);
  assert.equal(s.lease, null);
  assert.ok(fs.existsSync(P(repo, 'claude', 'factory', 'runs', s.run.run_id, 'lease.json')), 'lease moved to run folder');
  assert.ok(!fs.existsSync(P(repo, 'claude', 'factory', 'leases', `${A}.lease`)));
  assert.match(fs.readFileSync(P(repo, 'claude', 'packets', 'STATUS_BOARD.md'), 'utf8'), /scope violation: App\/evil\.js/);
});

test('4c. worker raw-editing another packet\'s Status (rev unchanged) -> scope violation', () => {
  const repo = makeRepo({ packets: [A, B] });
  const r = runNode(DISPATCH, ['run', A], envFor(repo, { FAKE_REPORT: report(A), FAKE_WRITE_OUTSIDE: `claude/packets/${B}_Status.json` }));
  assert.equal(r.status, 3, r.stderr + r.stdout);
  assert.match(status(repo, A).run.blocked_reason, new RegExp(`scope violation: claude/packets/${B}_Status\\.json`));
});

test('4b. clean run -> REVIEW_NEEDED with report hash, exact launch flags and prompt', () => {
  const repo = makeRepo({ packets: [A] });
  const r = runNode(DISPATCH, ['run', A], envFor(repo, { FAKE_REPORT: report(A) }));
  assert.equal(r.status, 0, r.stderr);
  const s = status(repo, A);
  assert.equal(s.state, 'REVIEW_NEEDED');
  assert.match(s.run.report_sha256, /^[0-9a-f]{64}$/);
  assert.equal(s.updated_by, 'dispatcher');
  const call = JSON.parse(fs.readFileSync(repo.calls, 'utf8').trim());
  const a = call.argv;
  const flag = (f) => a[a.indexOf(f) + 1];
  assert.equal(a[0], '-p');
  assert.equal(flag('--model'), 'test-model');
  assert.equal(flag('--session-id'), s.run.session_id);
  assert.equal(flag('--output-format'), 'stream-json');
  assert.ok(a.includes('--verbose'));
  assert.equal(flag('--permission-mode'), 'acceptEdits');
  assert.equal(flag('--permission-prompts'), 'none');
  assert.equal(flag('--allowedTools'), 'Read,Write');
  assert.equal(flag('--setting-sources'), 'project');
  assert.equal(fs.realpathSync(call.cwd), fs.realpathSync(repo.root));
  assert.match(call.prompt, new RegExp(`Execute claude/packets/${A}_Task_v1.md under claude/packets/${A}_Control_v1.md \\(Control sha256 ${s.control.sha256}, Task sha256 ${s.task.sha256}\\)`));
  assert.ok(fs.existsSync(P(repo, s.run.log)), 'worker.jsonl written');
  const run = JSON.parse(fs.readFileSync(P(repo, 'claude', 'factory', 'runs', s.run.run_id, 'run.json'), 'utf8'));
  assert.equal(run.outcome, 'REVIEW_NEEDED');
  assert.match(fs.readFileSync(P(repo, 'claude', 'factory', 'control-tower.html'), 'utf8'), new RegExp(s.run.run_id));
  // its own report now exists → no longer eligible, never rerun
  assert.equal(runNode(DISPATCH, ['run', A], envFor(repo)).status, 2);
  assert.equal(callCount(repo), 1);
});

test('5. global pause blocks a new launch; the active run finishes', async () => {
  const repo = makeRepo({ packets: [A, B] });
  const run = spawnNode(DISPATCH, ['run', A], envFor(repo, { FAKE_SLEEP_MS: '1200', FAKE_REPORT: report(A) }));
  await waitFor(() => status(repo, A).state === 'EXECUTING');
  fs.writeFileSync(P(repo, 'claude', 'factory', 'PAUSE.json'), JSON.stringify({ set_by: 'Founder', at: '2026-11-07T10:00Z', reason: 'test pause' }));
  // a Main Lane write to another packet during the run (state library, rev bumped) is not a worker scope violation
  writeStatus(B, (x) => { x.next_gate = 'after pause'; }, { writer: 'main-lane', expectRev: 1, root: repo.root });
  const o = await run.done;
  assert.equal(o.code, 0, o.err + o.out);
  assert.equal(status(repo, A).state, 'REVIEW_NEEDED', 'active run finished normally');
  const r = runNode(DISPATCH, ['run', B], envFor(repo, { FAKE_REPORT: report(B) }));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /global pause/);
  assert.equal(status(repo, B).state, 'READY');
  assert.equal(callCount(repo), 1);
  project({ root: repo.root });
  assert.match(fs.readFileSync(P(repo, 'claude', 'factory', 'control-tower.html'), 'utf8'), /Global pause is ON/);
});

test('6. interrupted worker (killed + expired lease) -> BLOCKED, no rerun', async () => {
  const repo = makeRepo({ packets: [A], config: { lease_ttl_s: 1 } });
  const pidfile = P(repo, '.stub', 'worker.pid');
  const run = spawnNode(DISPATCH, ['run', A], envFor(repo, { FAKE_SLEEP_MS: '30000', FAKE_PIDFILE: pidfile, FAKE_REPORT: report(A) }));
  await waitFor(() => status(repo, A).state === 'EXECUTING' && fs.existsSync(pidfile));
  run.child.kill('SIGKILL');
  await run.done;
  process.kill(Number(fs.readFileSync(pidfile, 'utf8')), 'SIGKILL');
  const runId = status(repo, A).run.run_id;
  await new Promise((r) => setTimeout(r, 1300)); // lease_ttl_s = 1
  const c = runNode(DISPATCH, ['check'], envFor(repo));
  assert.equal(c.status, 0, c.stderr);
  const out = JSON.parse(c.stdout);
  assert.equal(out.stale_handled.length, 1);
  const s = status(repo, A);
  assert.equal(s.state, 'BLOCKED');
  assert.equal(s.run.blocked_reason, 'interrupted run — no automatic rerun');
  assert.equal(s.lease, null);
  assert.ok(fs.existsSync(P(repo, 'claude', 'factory', 'runs', runId, 'lease.json')));
  const again = runNode(DISPATCH, ['run', A], envFor(repo, { FAKE_REPORT: report(A) }));
  assert.equal(again.status, 2);
  assert.equal(callCount(repo), 1, 'never relaunched');
});

test('7. capacity hold blocks launch and shows on the Tower (automatic and manual)', () => {
  const repo = makeRepo({ packets: [A, B] });
  const r = runNode(DISPATCH, ['run', A], envFor(repo, { FAKE_QUOTA: '1' }));
  assert.equal(r.status, 3, r.stderr);
  const s = status(repo, A);
  assert.equal(s.state, 'BLOCKED');
  assert.equal(s.hold.type, 'CAPACITY_HOLD');
  assert.equal(s.hold.set_by, 'dispatcher');
  assert.match(s.hold.reason, /usage limit/);
  const rb = runNode(DISPATCH, ['run', B], envFor(repo, { FAKE_REPORT: report(B) }));
  assert.equal(rb.status, 2);
  assert.match(rb.stderr, /capacity hold/);
  assert.equal(callCount(repo), 1);
  const html = fs.readFileSync(P(repo, 'claude', 'factory', 'control-tower.html'), 'utf8');
  assert.match(html, /CAPACITY_HOLD/);
  assert.match(html, /set automatically from a worker quota error/);

  const repo2 = makeRepo({ packets: [A, B], git: false });
  writeStatus(A, (x) => { x.hold = { type: 'CAPACITY_HOLD', set_by: 'Founder', at: '2026-11-07T10:00Z', reason: 'weekly limit near' }; }, { writer: 'main-lane', expectRev: 1, root: repo2.root });
  assert.deepEqual(evaluate({ root: repo2.root }).eligible, []);
  const { html: h2 } = project({ root: repo2.root });
  assert.match(h2, /manual entry, not telemetry/);
});

test('8. record-update interruption (crash between temp write and rename) leaves the original intact', () => {
  const repo = makeRepo({ packets: [A], git: false });
  const before = fs.readFileSync(statusFile(repo, A));
  const code = `import { writeStatus } from ${JSON.stringify(path.join(FACTORY, 'lib', 'state.mjs'))};
writeStatus(${JSON.stringify(A)}, (s) => { s.note = 'never lands'; }, { writer: 'main-lane', expectRev: 1, root: ${JSON.stringify(repo.root)}, _crashBeforeRename: true });`;
  const c = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
  assert.equal(c.signal, 'SIGKILL', 'child crashed mid-write');
  assert.deepEqual(fs.readFileSync(statusFile(repo, A)), before, 'original intact');
  const leftovers = fs.readdirSync(P(repo, 'claude', 'packets')).filter((f) => f.endsWith('.tmp'));
  assert.equal(leftovers.length, 1, 'temp file left behind');
  assert.equal(listStatus('MA-NOV-', { root: repo.root }).length, 1, 'temp file ignored by listStatus');
  const w = writeStatus(A, (s) => { s.note = 'lands'; }, { writer: 'main-lane', expectRev: 1, root: repo.root });
  assert.equal(w.rev, 2);
  assert.equal(status(repo, A).note, 'lands');
  const g1 = project({ root: repo.root }); const g2 = project({ root: repo.root });
  assert.equal(stripGenerated(g1.board), stripGenerated(g2.board));
});

test('9. stale/offline display: old generated_at -> OFFLINE in the HTML logic', () => {
  const repo = makeRepo({ packets: [A], git: false });
  const old = new Date(Date.now() - 10 * 60 * 1000);
  const { html, snap } = project({ root: repo.root, now: old });
  assert.match(html, /<meta http-equiv="refresh" content="30">/);
  const src = html.match(/<script id="tower-logic">([\s\S]*?)<\/script>/)[1];
  const { towerState, heartbeatClass } = new Function(`${src}\nreturn { towerState, heartbeatClass };`)();
  assert.equal(towerState(snap.generated_at, Date.now(), 30).offline, true, 'old snapshot shows OFFLINE');
  const g = Date.parse(snap.generated_at);
  assert.equal(towerState(snap.generated_at, g + 30000, 30).offline, false);
  assert.equal(towerState(snap.generated_at, g + 61000, 30).offline, true);
  assert.equal(heartbeatClass(new Date(g).toISOString(), new Date(g + 7200e3).toISOString(), g + 10e3, 300), 'ok');
  assert.equal(heartbeatClass(new Date(g).toISOString(), new Date(g + 7200e3).toISOString(), g + 400e3, 300), 'amber');
  assert.equal(heartbeatClass(new Date(g).toISOString(), new Date(g + 7200e3).toISOString(), g + 7300e3, 300), 'red');
  assert.match(html, /dispatcher idle \(no lease\)/, 'idle shows as idle');
});

test('10. ownership: dispatcher writing start_approval (or any non-dispatcher field) throws', () => {
  const repo = makeRepo({ packets: [A], git: false });
  const before = fs.readFileSync(statusFile(repo, A));
  const opts = (writer, expectRev = 1) => ({ writer, expectRev, root: repo.root });
  assert.throws(() => writeStatus(A, (s) => { s.start_approval = { by: 'Founder' }; }, opts('dispatcher')), OwnershipError);
  assert.throws(() => writeStatus(A, (s) => { s.blocker = 'x'; }, opts('dispatcher')), OwnershipError);
  assert.throws(() => writeStatus(A, (s) => { s.state = 'BLOCKED'; }, opts('dispatcher')), OwnershipError, 'READY->BLOCKED is not a dispatcher transition');
  assert.throws(() => writeStatus(A, (s) => { s.state = 'EXECUTING'; }, opts('dispatcher-hold')), OwnershipError);
  assert.throws(() => writeStatus(A, (s) => { s.lease = {}; }, opts('worker')), OwnershipError);
  assert.throws(() => writeStatus(A, (s) => { s.lease = {}; }, opts('dispatcher', 7)), RevConflictError);
  assert.deepEqual(fs.readFileSync(statusFile(repo, A)), before, 'nothing written');
  assert.equal(writeStatus(A, (s) => { s.hold = { type: 'CAPACITY_HOLD' }; }, opts('dispatcher-hold')).rev, 2);
  assert.equal(writeStatus(A, (s) => { s.start_approval = null; }, opts('main-lane', 2)).rev, 3);
});

test('11. model null -> run refused, nothing launched or written', () => {
  const repo = makeRepo({ packets: [A], config: { model: null } });
  const before = fs.readFileSync(statusFile(repo, A));
  const r = runNode(DISPATCH, ['run', A], envFor(repo, { FAKE_REPORT: report(A) }));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Founder has not recorded the model \(choice 2b\)/);
  assert.equal(callCount(repo), 0);
  assert.ok(!fs.existsSync(P(repo, 'claude', 'factory', 'leases', `${A}.lease`)));
  assert.deepEqual(fs.readFileSync(statusFile(repo, A)), before);
});

// LANE_OPENER.md step 3, implemented independently of project.mjs.
function laneOpenerReadyRows(board) {
  const lines = board.split('\n');
  const start = lines.findIndex((l) => l.includes('November 2026 — admitted packets'));
  assert.ok(start >= 0, 'section heading present');
  const rows = [];
  let header = null;
  for (const l of lines.slice(start + 1)) {
    if (!l.startsWith('|')) { if (header) break; continue; }
    const cells = l.slice(1, -1).split(/(?<!\\)\|/).map((c) => c.trim());
    if (!header) { header = cells; continue; }
    if (/^-+$/.test(cells[0])) continue;
    rows.push(Object.fromEntries(header.map((h, i) => [h, cells[i]])));
  }
  return { header, rows, ready: rows.filter((r) => r.State === 'READY').map((r) => r.Packet.split(' — ')[0]) };
}

test('12. generated board parses with LANE_OPENER step 3 and preserves every Control hash (real Status files)', () => {
  const repo = makeRepo({ packets: [A, { id: B, state: 'DRAFT', approved: false }], git: false });
  const real = fs.readdirSync(path.join(REAL_ROOT, 'claude', 'packets')).filter((f) => /^MA-NOV-.*_Status\.json$/.test(f));
  assert.ok(real.length >= 3, 'real November Status files found');
  for (const f of real) fs.copyFileSync(path.join(REAL_ROOT, 'claude', 'packets', f), P(repo, 'claude', 'packets', f)); // read-only copy
  const { board } = project({ root: repo.root });
  assert.equal(board.split('\n')[0], BOARD_TITLE);
  assert.ok(board.includes(`\n${BOARD_SECTION}\n`));
  const parsed = laneOpenerReadyRows(board);
  assert.deepEqual(parsed.header, ['Packet', 'State', 'Control (SHA-256)', 'Lane / tool', 'Write owner', 'Next gate', 'Blocker', 'Usage']);
  const all = listStatus('MA-NOV-', { root: repo.root });
  assert.equal(parsed.rows.length, all.length, 'no packet lost');
  for (const { id, status: s } of all) {
    const row = parsed.rows.find((r) => r.Packet.split(' — ')[0] === id);
    assert.ok(row, `row for ${id}`);
    assert.equal(row.State, s.state);
    assert.ok(row['Control (SHA-256)'].includes(`\`${s.control.sha256}\``), `Control hash preserved for ${id}`);
  }
  assert.deepEqual(parsed.ready.sort(), all.filter((x) => x.status.state === 'READY').map((x) => x.id).sort());
});

test('13. generator is idempotent (two runs differ only in generated_at); refuses to overwrite a hand board', () => {
  const repo = makeRepo({ packets: [A, B], git: false });
  const g1 = project({ root: repo.root, now: new Date('2026-11-07T10:00:00Z') });
  const g2 = project({ root: repo.root, now: new Date('2026-11-07T10:05:00Z') });
  assert.notEqual(g1.board, g2.board);
  assert.equal(stripGenerated(g1.board), stripGenerated(g2.board));
  assert.equal(stripGenerated(g1.html), stripGenerated(g2.html));
  const diff = g1.board.split('\n').filter((l, i) => l !== g2.board.split('\n')[i]);
  assert.deepEqual(diff, ['generated_at: 2026-11-07T10:00:00Z']);
  fs.writeFileSync(P(repo, 'claude', 'packets', 'STATUS_BOARD.md'), '# Status Board — October 2026\nhand-written\n');
  assert.throws(() => project({ root: repo.root }), /not a generated board/);
});
