// MA-DEC-BOOT month-prefix tests (Control success condition 3 (a)–(d)). Run: node --test tools/factory/test
// Same harness as pilot.test.mjs: every test builds its own temp repo. Numbering continues pilot's: 49–52.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeRepo, envFor, runNode, status, DISPATCH } from './helpers.mjs';
import { writeStatus, listStatus, OwnershipError } from '../lib/state.mjs';
import { evaluate } from '../lib/eligibility.mjs';
import { PACKET_PREFIXES, isFactoryPacket } from '../lib/util.mjs';
import { project, BOARD_SECTION } from '../project.mjs';

const N = 'MA-NOV-TA';
const D = 'MA-DEC-TA';
const OTHER = 'MA-OCT-TA'; // a month not in PACKET_PREFIXES
const report = (id) => `claude/packets/${id}_Report.md`;
const P = (repo, ...p) => path.join(repo.root, ...p);

test('49. (a) MA-DEC-* READY packet with a valid Founder approval is eligible for check and begin', () => {
  assert.deepEqual(PACKET_PREFIXES, ['MA-NOV-', 'MA-DEC-']);
  assert.ok(isFactoryPacket(D) && isFactoryPacket(N) && !isFactoryPacket(OTHER) && !isFactoryPacket(null));
  const repo = makeRepo({ packets: [{ id: D, extra: { run_profile: { allowed_write_paths: [report(D)] } } }] });
  assert.deepEqual(evaluate({ root: repo.root }).eligible, [D]);
  const c = runNode(DISPATCH, ['check'], envFor(repo));
  assert.equal(c.status, 0, c.stderr);
  assert.deepEqual(JSON.parse(c.stdout).eligible, [D]);
  const b = runNode(DISPATCH, ['begin', D], envFor(repo));
  assert.equal(b.status, 0, b.stderr);
  assert.match(b.stdout, new RegExp(`^BEGIN ${D} run r-\\S+ — work now`));
  const s = status(repo, D);
  assert.equal(s.state, 'EXECUTING');
  assert.equal(s.lease.mode, 'interactive');
  const after = JSON.parse(runNode(DISPATCH, ['check'], envFor(repo)).stdout);
  assert.deepEqual(after.running.map((x) => [x.id, x.mode]), [[D, 'interactive']], 'running() lists MA-DEC-*');
  assert.match(runNode(DISPATCH, ['status'], envFor(repo)).stdout, new RegExp(`${D}\\s+EXECUTING\\s+running:interactive`));
});

test('50. (b) dispatcher field-ownership guard applies to MA-DEC-* (and still not to other months)', () => {
  const repo = makeRepo({ packets: [D, OTHER], git: false });
  const before = fs.readFileSync(P(repo, 'claude', 'packets', `${D}_Status.json`));
  const opts = (writer, expectRev = 1) => ({ writer, expectRev, root: repo.root });
  assert.throws(() => writeStatus(D, (s) => { s.start_approval = { by: 'Founder' }; }, opts('dispatcher')), OwnershipError);
  assert.throws(() => writeStatus(D, (s) => { s.blocker = 'x'; }, opts('dispatcher')), OwnershipError);
  assert.throws(() => writeStatus(D, (s) => { s.state = 'BLOCKED'; }, opts('dispatcher')), OwnershipError);
  assert.throws(() => writeStatus(D, (s) => { s.state = 'EXECUTING'; }, opts('dispatcher-hold')), OwnershipError);
  assert.throws(() => writeStatus(D, (s) => { s.lease = {}; }, opts('worker')), OwnershipError);
  assert.deepEqual(fs.readFileSync(P(repo, 'claude', 'packets', `${D}_Status.json`)), before, 'nothing written');
  assert.equal(writeStatus(D, (s) => { s.hold = { type: 'CAPACITY_HOLD' }; }, opts('dispatcher-hold')).rev, 2);
  assert.equal(writeStatus(D, (s) => { s.start_approval = null; }, opts('main-lane', 2)).rev, 3);
  // Unchanged behaviour outside the list: no field-ownership guard.
  assert.equal(writeStatus(OTHER, (s) => { s.blocker = 'x'; }, opts('dispatcher')).rev, 2);
});

test('51. (c) project.mjs lists both months on the board and the Tower; other months are not listed', () => {
  const repo = makeRepo({ packets: [N, D, OTHER], git: false });
  const { board, html } = project({ root: repo.root });
  const work = board.slice(board.indexOf(BOARD_SECTION));
  assert.ok(work.includes(`| ${N} — `), 'November row');
  assert.ok(work.includes(`| ${D} — `), 'December row');
  assert.ok(!board.includes(OTHER), 'other month not on the board');
  assert.ok(board.includes('*Projection of `claude/packets/MA-NOV-*_Status.json` and `claude/packets/MA-DEC-*_Status.json` (the only live state).'));
  assert.ok(html.includes(N) && html.includes(D) && !html.includes(OTHER));
  assert.ok(html.includes('claude/packets/MA-NOV-*_Status.json, claude/packets/MA-DEC-*_Status.json'));
  assert.deepEqual(listStatus(PACKET_PREFIXES, { root: repo.root }).map((x) => x.id), [D, N], 'sorted, both months, nothing else');
});

test('52. (d) MA-NOV-* behaviour unchanged (eligibility, string prefix, ownership) alongside MA-DEC-*', () => {
  const repo = makeRepo({ packets: [N, { id: D, approved: false }], git: false });
  const ev = evaluate({ root: repo.root });
  assert.deepEqual(ev.eligible, [N]);
  assert.ok(ev.ineligible.find((x) => x.id === D).reasons.includes('no Founder start approval'));
  assert.deepEqual(evaluate({ root: repo.root, prefix: 'MA-NOV-' }).eligible, [N], 'string prefix still works');
  assert.deepEqual(evaluate({ root: repo.root, prefix: 'MA-NOV-' }).ineligible, [], 'string prefix sees November only');
  assert.deepEqual(listStatus('MA-NOV-', { root: repo.root }).map((x) => x.id), [N]);
  assert.deepEqual(listStatus('', { root: repo.root }).map((x) => x.id), [D, N], 'default prefix "" still lists all');
  assert.throws(() => writeStatus(N, (s) => { s.blocker = 'x'; }, { writer: 'dispatcher', expectRev: 1, root: repo.root }), OwnershipError);
});
