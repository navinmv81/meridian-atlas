// MA-NOV-P1.BUILD pilot tests (Task §7). Run: node --test tools/factory/test
// Every test builds its own temp repo; the dispatcher launches only the stub in fixtures/.
// Numbering: 1–13 (+4b, 4c) BUILD, 16–22 FIX, 23–32 FIX2. Ids 14–15 are deliberately unused: BUILD skipped them and
// the FIX/REVIEW reports cite 16–22 by number, so renumbering would break those references.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import { makeRepo, envFor, runNode, spawnNode, callCount, status, waitFor, stripGenerated, gitIn, DISPATCH, FACTORY, REAL_ROOT } from './helpers.mjs';
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

test('9. stale/offline display: old idle snapshot -> SNAPSHOT (not OFFLINE); fresh -> LIVE (rule replaced by F3)', () => {
  const repo = makeRepo({ packets: [A], git: false });
  const old = new Date(Date.now() - 10 * 60 * 1000);
  const { html, snap } = project({ root: repo.root, now: old });
  assert.match(html, /<meta http-equiv="refresh" content="30">/);
  const src = html.match(/<script id="tower-logic">([\s\S]*?)<\/script>/)[1];
  const { towerStatus, heartbeatClass } = new Function(`${src}\nreturn { towerStatus, heartbeatClass };`)();
  assert.equal(towerStatus(snap.generated_at, Date.now(), 30, []).state, 'SNAPSHOT', 'old idle snapshot is SNAPSHOT, not OFFLINE');
  const g = Date.parse(snap.generated_at);
  assert.equal(towerStatus(snap.generated_at, g + 30000, 30, []).state, 'LIVE');
  assert.equal(towerStatus(snap.generated_at, g + 61000, 30, []).state, 'SNAPSHOT');
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

// ---- MA-NOV-P1.FIX: interactive mode (begin/end), --tools, sign-in failure ----
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const writeReport = (repo, id) => fs.writeFileSync(P(repo, 'claude', 'packets', `${id}_Report.md`), `# ${id} report (interactive)\n`);
const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

test('16. begin -> EXECUTING + interactive lease + before.json; second begin refused; shown as running', () => {
  const repo = makeRepo({ packets: [{ id: A, extra: { run_profile: { allowed_write_paths: [report(A)] } } }, B] });
  const r = runNode(DISPATCH, ['begin', A], envFor(repo));
  assert.equal(r.status, 0, r.stderr);
  const m = r.stdout.trim().match(new RegExp(`^BEGIN ${A} run (r-\\S+) — work now; finish with: node tools/factory/dispatch\\.mjs end ${A}$`));
  assert.ok(m, r.stdout);
  const s = status(repo, A);
  assert.equal(s.state, 'EXECUTING');
  assert.equal(s.lease.mode, 'interactive');
  assert.equal(s.lease.holder, 'interactive');
  assert.equal(s.run.mode, 'interactive');
  assert.equal(s.run.run_id, m[1]);
  assert.equal(s.heartbeat, null);
  assert.equal(s.updated_by, 'dispatcher');
  assert.ok(fs.existsSync(P(repo, 'claude', 'factory', 'leases', `${A}.lease`)));
  const before = JSON.parse(fs.readFileSync(P(repo, 'claude', 'factory', 'runs', m[1], 'before.json'), 'utf8'));
  assert.equal(before.status_rev, s.rev);
  assert.equal(typeof before.entries, 'object');
  const again = runNode(DISPATCH, ['begin', A], envFor(repo));
  assert.equal(again.status, 2);
  assert.match(again.stderr, /refused: .*running: live interactive lease/);
  const other = runNode(DISPATCH, ['begin', B], envFor(repo));
  assert.equal(other.status, 2);
  assert.match(other.stderr, /one at a time/);
  assert.equal(runNode(DISPATCH, ['run', A], envFor(repo)).status, 2, 'headless run refused while interactive lease live');
  const c = JSON.parse(runNode(DISPATCH, ['check'], envFor(repo)).stdout);
  assert.deepEqual(c.running.map((x) => [x.id, x.mode, x.lease_state]), [[A, 'interactive', 'live']]);
  assert.deepEqual(c.stale_handled, []);
  assert.match(runNode(DISPATCH, ['status'], envFor(repo)).stdout, new RegExp(`${A}\\s+EXECUTING\\s+running:interactive ${m[1]} holder:interactive expires:`));
  const board = fs.readFileSync(P(repo, 'claude', 'packets', 'STATUS_BOARD.md'), 'utf8');
  assert.match(board, new RegExp(`\\*\\*Running:\\*\\* ${A} — interactive, holder interactive, run \`${m[1]}\`, started \\S+, lease expires \\S+`));
  const html = fs.readFileSync(P(repo, 'claude', 'factory', 'control-tower.html'), 'utf8');
  assert.match(html, /mode-interactive">interactive</);
  assert.match(html, /no heartbeat expected/);
  assert.ok(!/class="hb"/.test(html), 'no heartbeat indicator for an interactive run');
  assert.match(html, /How to start a run/);
});

test('17. end with report -> REVIEW_NEEDED + report hash (Main Lane write and PAUSE.json during the run ignored)', () => {
  const repo = makeRepo({ packets: [A, B] });
  const b = runNode(DISPATCH, ['begin', A], envFor(repo));
  assert.equal(b.status, 0, b.stderr);
  writeReport(repo, A);
  writeStatus(B, (x) => { x.next_gate = 'Main Lane note during run'; }, { writer: 'main-lane', expectRev: 1, root: repo.root });
  fs.writeFileSync(P(repo, 'claude', 'factory', 'PAUSE.json'), JSON.stringify({ set_by: 'Founder', reason: 'pause during run' }));
  const e = runNode(DISPATCH, ['end', A], envFor(repo));
  assert.equal(e.status, 0, e.stderr + e.stdout);
  const reportSha = sha(P(repo, 'claude', 'packets', `${A}_Report.md`));
  assert.match(e.stdout.trim(), new RegExp(`^END ${A} run r-\\S+: REVIEW_NEEDED · report ${reportSha}$`));
  const s = status(repo, A);
  assert.equal(s.state, 'REVIEW_NEEDED');
  assert.equal(s.run.report_sha256, reportSha);
  assert.equal(s.run.mode, 'interactive');
  assert.ok(s.run.ended);
  assert.equal(s.lease, null);
  assert.ok(fs.existsSync(P(repo, 'claude', 'factory', 'runs', s.run.run_id, 'lease.json')));
  assert.ok(!fs.existsSync(P(repo, 'claude', 'factory', 'leases', `${A}.lease`)));
  const run = JSON.parse(fs.readFileSync(P(repo, 'claude', 'factory', 'runs', s.run.run_id, 'run.json'), 'utf8'));
  assert.equal(run.mode, 'interactive');
  assert.deepEqual(run.scope_violations, []);
  assert.match(fs.readFileSync(P(repo, 'claude', 'factory', 'control-tower.html'), 'utf8'), new RegExp(`${s.run.run_id}</code> ${A} · interactive · REVIEW_NEEDED`));
  assert.equal(runNode(DISPATCH, ['end', A], envFor(repo)).status, 2, 'second end refused (no lease)');
});

test('18. end with an out-of-scope write -> BLOCKED (scope violation)', () => {
  const repo = makeRepo({ packets: [A] });
  assert.equal(runNode(DISPATCH, ['begin', A], envFor(repo)).status, 0);
  writeReport(repo, A);
  fs.writeFileSync(P(repo, 'App', 'evil.js'), 'outside scope\n');
  fs.appendFileSync(P(repo, 'App', 'keep.txt'), 'tracked file edited\n');
  const e = runNode(DISPATCH, ['end', A], envFor(repo));
  assert.equal(e.status, 3, e.stderr);
  const s = status(repo, A);
  assert.equal(s.state, 'BLOCKED');
  assert.equal(s.run.blocked_reason, 'scope violation: App/evil.js, App/keep.txt');
  assert.match(e.stdout, /^END .*: BLOCKED — scope violation: App\/evil\.js, App\/keep\.txt/);
});

test('19. end without report -> BLOCKED "no report"', () => {
  const repo = makeRepo({ packets: [A] });
  assert.equal(runNode(DISPATCH, ['begin', A], envFor(repo)).status, 0);
  const e = runNode(DISPATCH, ['end', A], envFor(repo));
  assert.equal(e.status, 3);
  const s = status(repo, A);
  assert.equal(s.state, 'BLOCKED');
  assert.match(s.run.blocked_reason, new RegExp(`^no report \\(expected claude/packets/${A}_Report\\.md\\)$`));
});

test('20. end after lease expiry -> BLOCKED "lease expired before end", no rerun', async () => {
  const repo = makeRepo({ packets: [A], config: { lease_ttl_s: 1 } });
  assert.equal(runNode(DISPATCH, ['begin', A], envFor(repo)).status, 0);
  await sleepMs(1300);
  writeReport(repo, A);
  assert.match(runNode(DISPATCH, ['status'], envFor(repo)).stdout, /\(EXPIRED\)/);
  const c = JSON.parse(runNode(DISPATCH, ['check'], envFor(repo)).stdout);
  assert.deepEqual(c.stale_handled, [], 'holder still alive: not treated as interrupted');
  const e = runNode(DISPATCH, ['end', A], envFor(repo));
  assert.equal(e.status, 3, e.stderr);
  const s = status(repo, A);
  assert.equal(s.state, 'BLOCKED');
  assert.equal(s.run.blocked_reason, 'lease expired before end — Main Lane to confirm');
  assert.equal(s.run.report_sha256, undefined);
  assert.equal(runNode(DISPATCH, ['begin', A], envFor(repo)).status, 2, 'never auto-rerun');
  assert.equal(runNode(DISPATCH, ['end', A], envFor(repo)).status, 2);
});

test('21. headless argv contains --tools (and still --allowedTools)', () => {
  const repo = makeRepo({ packets: [A] });
  const r = runNode(DISPATCH, ['run', A], envFor(repo, { FAKE_REPORT: report(A) }));
  assert.equal(r.status, 0, r.stderr);
  const a = JSON.parse(fs.readFileSync(repo.calls, 'utf8').trim()).argv;
  assert.equal(a[a.indexOf('--tools') + 1], 'Read,Write');
  assert.equal(a[a.indexOf('--allowedTools') + 1], 'Read,Write');
  assert.equal(status(repo, A).run.mode, 'headless');
  const d = runNode(DISPATCH, ['run', 'MA-NOV-TB', '--dry-run'], envFor(repo));
  assert.equal(d.status, 2, 'unknown packet refused');
});

test('22. sign-in failure -> BLOCKED "worker not signed in" (no hold, no retry)', () => {
  const repo = makeRepo({ packets: [A, B] });
  const r = runNode(DISPATCH, ['run', A], envFor(repo, { FAKE_SIGNIN_FAIL: '1' }));
  assert.equal(r.status, 3, r.stderr);
  const s = status(repo, A);
  assert.equal(s.state, 'BLOCKED');
  assert.equal(s.run.blocked_reason, 'worker not signed in');
  assert.equal(s.run.exit_code, 1);
  assert.equal(s.hold, undefined, 'no capacity hold');
  assert.equal(callCount(repo), 1);
  assert.equal(runNode(DISPATCH, ['run', A], envFor(repo)).status, 2, 'no retry');
  assert.deepEqual(evaluate({ root: repo.root }).eligible, [B], 'other packets unaffected (no hold)');
});

// ---- MA-NOV-P1.FIX2: review must-fix (F1–F7, F9, F10) ----
const committer = (repo) => (...files) => { gitIn(repo.root, 'add', '--', ...files); gitIn(repo.root, 'commit', '-q', '-m', 'run commit'); };
const withCommits = (id, allow = true) => ({ id, extra: { run_profile: { allowed_write_paths: [report(id)], ...(allow ? { allow_commits: true } : {}) } } });
const runJson = (repo, id) => JSON.parse(fs.readFileSync(P(repo, 'claude', 'factory', 'runs', status(repo, id).run.run_id, 'run.json'), 'utf8'));

test('23. committed out-of-scope files -> BLOCKED (F1: new file, tracked edit, pre-dirty file changed then committed)', () => {
  const repo = makeRepo({ packets: [withCommits(A)] });
  fs.writeFileSync(P(repo, 'claude', 'packets', 'ML_note.md'), 'main lane, dirty before the run\n');
  assert.equal(runNode(DISPATCH, ['begin', A], envFor(repo)).status, 0);
  writeReport(repo, A);
  fs.writeFileSync(P(repo, 'App', 'new.js'), 'committed outside scope\n');
  fs.appendFileSync(P(repo, 'App', 'keep.txt'), 'tracked edit\n');
  fs.appendFileSync(P(repo, 'claude', 'packets', 'ML_note.md'), 'changed by the worker\n');
  committer(repo)('App/new.js', 'App/keep.txt', 'claude/packets/ML_note.md', report(A));
  const e = runNode(DISPATCH, ['end', A], envFor(repo));
  assert.equal(e.status, 3, e.stderr + e.stdout);
  assert.equal(status(repo, A).run.blocked_reason, 'scope violation: App/keep.txt, App/new.js, claude/packets/ML_note.md');
  assert.equal(runJson(repo, A).commit_check, 'commits checked');
});

test('24. allowed commit with allow_commits -> REVIEW_NEEDED (report + pre-dirty file committed unchanged)', () => {
  const repo = makeRepo({ packets: [withCommits(A)] });
  fs.writeFileSync(P(repo, 'claude', 'packets', 'ML_note.md'), 'pinned Main Lane file\n');
  assert.equal(runNode(DISPATCH, ['begin', A], envFor(repo)).status, 0);
  writeReport(repo, A);
  committer(repo)(report(A), 'claude/packets/ML_note.md');
  const e = runNode(DISPATCH, ['end', A], envFor(repo));
  assert.equal(e.status, 0, e.stderr + e.stdout);
  assert.equal(status(repo, A).state, 'REVIEW_NEEDED');
  const r = runJson(repo, A);
  assert.deepEqual(r.scope_violations, []);
  assert.deepEqual(r.committed_paths.sort(), ['claude/packets/ML_note.md', report(A)].sort());
  assert.deepEqual(r.committed_preexisting_unchanged, ['claude/packets/ML_note.md']);
  assert.notEqual(r.start_head, r.end_head);
});

test('25. commit without allow_commits -> BLOCKED; rewritten history (not a descendant) -> BLOCKED', () => {
  const repo = makeRepo({ packets: [withCommits(A, false)] });
  assert.equal(runNode(DISPATCH, ['begin', A], envFor(repo)).status, 0);
  writeReport(repo, A);
  committer(repo)(report(A));
  const e = runNode(DISPATCH, ['end', A], envFor(repo));
  assert.equal(e.status, 3, e.stderr + e.stdout);
  assert.equal(status(repo, A).run.blocked_reason, 'commits not allowed for this packet');

  const repo2 = makeRepo({ packets: [withCommits(A)] });
  assert.equal(runNode(DISPATCH, ['begin', A], envFor(repo2)).status, 0);
  writeReport(repo2, A);
  gitIn(repo2.root, 'add', '--', report(A));
  gitIn(repo2.root, 'commit', '-q', '--amend', '-m', 'rewritten start commit');
  const e2 = runNode(DISPATCH, ['end', A], envFor(repo2));
  assert.equal(e2.status, 3, e2.stderr + e2.stdout);
  assert.equal(status(repo2, A).run.blocked_reason, 'HEAD is not a descendant of the start commit');
});

test('26. concurrent begin of two different packets (15 trials) -> exactly one succeeds each time (F2 global lock)', async () => {
  for (let i = 0; i < 15; i++) {
    const repo = makeRepo({ packets: [A, B] });
    const env = envFor(repo);
    const [o1, o2] = await Promise.all([spawnNode(DISPATCH, ['begin', A], env).done, spawnNode(DISPATCH, ['begin', B], env).done]);
    const codes = [o1.code, o2.code].sort();
    assert.deepEqual(codes, [0, 2], `trial ${i}: exit codes ${codes}; ${o1.err} | ${o2.err}`);
    assert.match(o1.code === 2 ? o1.err : o2.err, /one at a time/, `trial ${i}`);
    const leases = fs.readdirSync(P(repo, 'claude', 'factory', 'leases'));
    assert.equal(leases.filter((f) => f.endsWith('.lease')).length, 1, `trial ${i}: one packet lease`);
    assert.ok(leases.includes('.global.lock'), `trial ${i}: global lock held`);
    assert.equal([status(repo, A).state, status(repo, B).state].filter((x) => x === 'EXECUTING').length, 1, `trial ${i}`);
    if (i === 0) { // released at end (renamed into the run folder), then the other packet can begin
      const [win, lose] = o1.code === 0 ? [A, B] : [B, A];
      writeReport(repo, win);
      assert.equal(runNode(DISPATCH, ['end', win], env).status, 0);
      assert.ok(!fs.existsSync(P(repo, 'claude', 'factory', 'leases', '.global.lock')));
      assert.ok(fs.existsSync(P(repo, 'claude', 'factory', 'runs', status(repo, win).run.run_id, 'global.lock.json')));
      assert.equal(runNode(DISPATCH, ['begin', lose], env).status, 0);
    }
  }
});

test('27. Tower fixed line = the v2 opener and its computed hash (config default; config.opener honoured)', () => {
  const repo = makeRepo({ packets: [A], git: false });
  const v2 = P(repo, 'claude', 'packets', 'LANE_OPENER_v2.md');
  fs.copyFileSync(path.join(REAL_ROOT, 'claude', 'packets', 'LANE_OPENER_v2.md'), v2); // read-only copy of the real opener
  const h = sha(v2);
  const { html, snap } = project({ root: repo.root });
  const line = `Follow claude/packets/LANE_OPENER_v2.md (sha256 ${h}) and run the Founder-approved packet.`;
  assert.equal(snap.fixed_line, line);
  assert.deepEqual(snap.opener, { file: 'claude/packets/LANE_OPENER_v2.md', sha256: h });
  assert.ok(html.includes(line));
  assert.ok(!html.includes('LANE_OPENER.md (sha256'), 'superseded v1 line not shown');
  const cfgFile = P(repo, 'claude', 'factory', 'config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
  fs.writeFileSync(cfgFile, JSON.stringify({ ...cfg, opener: 'claude/packets/LANE_OPENER.md' }));
  const v1 = project({ root: repo.root }).snap;
  assert.equal(v1.fixed_line, `Follow claude/packets/LANE_OPENER.md (sha256 ${sha(P(repo, 'claude', 'packets', 'LANE_OPENER.md'))}) and run the Founder-approved packet.`);
  fs.writeFileSync(cfgFile, JSON.stringify({ ...cfg, opener: null }));
  assert.equal(project({ root: repo.root }).snap.fixed_line, line, 'null opener -> v2 default');
});

test('28. session id recorded at begin; end from another session refused (nothing written); same session ends', () => {
  const repo = makeRepo({ packets: [A] });
  const as = (sid) => envFor(repo, { CLAUDE_CODE_SESSION_ID: sid });
  assert.equal(runNode(DISPATCH, ['begin', A], as('sess-A')).status, 0);
  const s = status(repo, A);
  assert.equal(s.lease.session_id, 'sess-A');
  assert.equal(s.run.session_id, 'sess-A');
  assert.equal(JSON.parse(fs.readFileSync(P(repo, 'claude', 'factory', 'runs', s.run.run_id, 'before.json'), 'utf8')).session_id, 'sess-A');
  writeReport(repo, A);
  const bytes = fs.readFileSync(statusFile(repo, A));
  const x = runNode(DISPATCH, ['end', A], as('sess-B'));
  assert.equal(x.status, 2, x.stderr + x.stdout);
  assert.match(x.stderr, /this run was begun by another session/);
  assert.deepEqual(fs.readFileSync(statusFile(repo, A)), bytes, 'Status unchanged');
  assert.ok(fs.existsSync(P(repo, 'claude', 'factory', 'leases', `${A}.lease`)), 'lease kept');
  assert.ok(!fs.existsSync(P(repo, 'claude', 'factory', 'runs', s.run.run_id, 'run.json')), 'no run.json');
  assert.equal(runNode(DISPATCH, ['end', A], as('sess-A')).status, 0);
  assert.equal(status(repo, A).run.ended_by_session, 'sess-A');
  assert.equal(runJson(repo, A).ended_by_session, 'sess-A');
  assert.equal(runJson(repo, A).session_id, 'sess-A');

  const repo2 = makeRepo({ packets: [A] });
  assert.equal(runNode(DISPATCH, ['begin', A], envFor(repo2, { CLAUDE_CODE_SESSION_ID: '' })).status, 0);
  assert.equal(status(repo2, A).run.session_id, null, 'absent variable -> null');
  writeReport(repo2, A);
  assert.equal(runNode(DISPATCH, ['end', A], envFor(repo2, { CLAUDE_CODE_SESSION_ID: 'sess-X' })).status, 0, 'one id unknown -> not refused');
});

test('29. own-Status edit during an interactive run (even via the state library) -> BLOCKED; other rev bumps listed', () => {
  const repo = makeRepo({ packets: [A, B] });
  assert.equal(runNode(DISPATCH, ['begin', A], envFor(repo)).status, 0);
  writeReport(repo, A);
  const r0 = status(repo, A).rev;
  writeStatus(A, (x) => { x.next_gate = 'edited mid-run'; }, { writer: 'main-lane', expectRev: r0, root: repo.root });
  writeStatus(B, (x) => { x.next_gate = 'other packet'; }, { writer: 'main-lane', expectRev: 1, root: repo.root });
  const e = runNode(DISPATCH, ['end', A], envFor(repo));
  assert.equal(e.status, 3, e.stderr + e.stdout);
  assert.equal(status(repo, A).run.blocked_reason, `own Status changed during run (rev ${r0}→${r0 + 1})`);
  assert.deepEqual(runJson(repo, A).other_status_changes, [{ path: `claude/packets/${B}_Status.json`, rev_from: 1, rev_to: 2 }]);
});

test('30. temp-file ignore rule: only temp files of existing Status/board/Tower files are ignored (F7)', () => {
  const repo = makeRepo({ packets: [A, B] });
  assert.equal(runNode(DISPATCH, ['begin', A], envFor(repo)).status, 0);
  writeReport(repo, A);
  const accepted = [`claude/packets/.${B}_Status.json.123.abcd1234.tmp`, 'claude/packets/.STATUS_BOARD.md.77.tmp', 'claude/factory/.control-tower.html.77.tmp'];
  const rejected = ['claude/packets/.payload.123.tmp', 'claude/packets/.MA-NOV-ZZ_Status.json.1.ab.tmp', 'claude/factory/.STATUS_BOARD.md.5.tmp'];
  for (const p of [...accepted, ...rejected]) fs.writeFileSync(P(repo, ...p.split('/')), 'tmp\n');
  const e = runNode(DISPATCH, ['end', A], envFor(repo));
  assert.equal(e.status, 3, e.stderr + e.stdout);
  assert.equal(status(repo, A).run.blocked_reason, `scope violation: ${[...rejected].sort().join(', ')}`);
  assert.deepEqual(runJson(repo, A).ignored_temp_files, [...accepted].sort());
});

test('31. transitions.jsonl: one row per successful Status write, none for a refused one; ignored by the scope check', () => {
  const repo = makeRepo({ packets: [A] });
  assert.equal(runNode(DISPATCH, ['begin', A], envFor(repo)).status, 0);
  writeReport(repo, A);
  assert.equal(runNode(DISPATCH, ['end', A], envFor(repo)).status, 0);
  const file = P(repo, 'claude', 'factory', 'transitions.jsonl');
  const rows = () => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  assert.deepEqual(rows().map((r) => [r.id, r.writer, r.from, r.to, r.rev]), [[A, 'dispatcher', 'READY', 'EXECUTING', 2], [A, 'dispatcher', 'EXECUTING', 'REVIEW_NEEDED', 3]]);
  for (const r of rows()) assert.match(r.at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  assert.deepEqual(runJson(repo, A).scope_violations, []);
  assert.throws(() => writeStatus(A, (x) => { x.state = 'CLOSED'; }, { writer: 'main-lane', expectRev: 3, root: repo.root }), TransitionError);
  assert.equal(rows().length, 2, 'refused write not logged');
  writeStatus(A, (x) => { x.state = 'APPROVED'; }, { writer: 'main-lane', expectRev: 3, root: repo.root });
  assert.deepEqual(rows().slice(-1).map((r) => [r.writer, r.from, r.to, r.rev]), [['main-lane', 'REVIEW_NEEDED', 'APPROVED', 4]]);
});

test('32. Tower states: LIVE / SNAPSHOT / RUNNING (snapshot) / STALE RUN; no OFFLINE for idle (F3 option b)', () => {
  const repo = makeRepo({ packets: [A] });
  assert.equal(runNode(DISPATCH, ['begin', A], envFor(repo)).status, 0);
  const { html, snap } = project({ root: repo.root });
  assert.ok(!/OFFLINE/.test(html), 'no OFFLINE label anywhere');
  const src = html.match(/<script id="tower-logic">([\s\S]*?)<\/script>/)[1];
  const { towerStatus } = new Function(`${src}\nreturn { towerStatus };`)();
  const g = Date.parse(snap.generated_at);
  const leases = snap.packets.filter((p) => p.lease).map((p) => ({ id: p.id, run_id: p.lease.run_id, expires: p.lease.expires }));
  assert.equal(leases.length, 1);
  const live = towerStatus(snap.generated_at, g + 10e3, 30, leases);
  assert.equal(live.state, 'LIVE');
  const run = towerStatus(snap.generated_at, g + 600e3, 30, leases);
  assert.equal(run.state, 'RUNNING_SNAPSHOT');
  assert.equal(run.label, `RUNNING (snapshot) — ${A} run ${leases[0].run_id} · snapshot 10 min old`);
  const stale = towerStatus(snap.generated_at, Date.parse(leases[0].expires) + 1000, 30, leases);
  assert.equal(stale.state, 'STALE_RUN');
  assert.equal(stale.cls, 'red');
  const idle = towerStatus(snap.generated_at, g + 600e3, 30, []);
  assert.equal(idle.state, 'SNAPSHOT');
  assert.equal(idle.label, `Idle — snapshot from ${snap.generated_at} (10 min ago); regenerated on every begin/end and Main Lane update`);
  assert.equal(towerStatus(snap.generated_at, g + 10e3, 30, []).state, 'LIVE');
});
