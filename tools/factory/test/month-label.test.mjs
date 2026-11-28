// MA-DEC-FACTORY.LABEL month-label tests (Control §What 4 (a)–(c)). Run: node --test tools/factory/test
// Same harness as pilot.test.mjs: every test builds its own temp repo. Numbering continues month-prefix's: 53–56.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeRepo, envFor, runNode, DISPATCH } from './helpers.mjs';
import { evaluate } from '../lib/eligibility.mjs';
import { project, boardIsGenerated, boardLabels, BOARD_TITLE, BOARD_SECTION, SCOPE_SECTION } from '../project.mjs';

const N = 'MA-NOV-TA';
const D = 'MA-DEC-TA';
const DEC = { board: { label: 'December 2026', prefix: 'MA-DEC-' } };
const P = (repo, ...p) => path.join(repo.root, ...p);
const outcome = (repo, id) => {
  const f = P(repo, 'claude', 'packets', `${id}_Status.json`);
  const s = JSON.parse(fs.readFileSync(f, 'utf8'));
  fs.writeFileSync(f, JSON.stringify({ ...s, kind: 'outcome', requirements: ['r1'] }, null, 2) + '\n');
};

test('53. (a) no config.board → November headings exactly as before, both months listed', () => {
  assert.equal(BOARD_TITLE, '# Status Board — November 2026 (generated — do not edit; run node tools/factory/project.mjs)');
  assert.equal(BOARD_SECTION, '## November 2026 — admitted packets');
  assert.equal(SCOPE_SECTION, '## November scope — outcomes');
  const repo = makeRepo({ packets: [N, D, 'MA-NOV-OUT'], git: false });
  outcome(repo, 'MA-NOV-OUT');
  const { board, html } = project({ root: repo.root });
  const lines = board.split('\n');
  assert.equal(lines[0], BOARD_TITLE);
  assert.ok(lines.includes(BOARD_SECTION) && lines.includes(SCOPE_SECTION));
  assert.ok(board.includes('*Projection of `claude/packets/MA-NOV-*_Status.json` and `claude/packets/MA-DEC-*_Status.json` (the only live state). Hand edits are overwritten. October board archived unchanged at `claude/packets/STATUS_BOARD_October_2026.md`.*'));
  assert.ok(html.includes('<title>November Control Tower</title>'));
  assert.ok(html.includes('<h1>Meridian Atlas — November Control Tower</h1>'));
  assert.ok(html.includes('<h2>November scope'));
  assert.ok(board.includes(`| ${N} — `) && board.includes(`| ${D} — `));
});

test('54. (b) config.board set → December headings, only MA-DEC-* rows on board and Tower', () => {
  const repo = makeRepo({ packets: [N, D, 'MA-DEC-OUT', 'MA-NOV-OUT'], config: DEC, git: false });
  outcome(repo, 'MA-DEC-OUT'); outcome(repo, 'MA-NOV-OUT');
  const { board, html, snap } = project({ root: repo.root });
  const lines = board.split('\n');
  assert.equal(lines[0], '# Status Board — December 2026 (generated — do not edit; run node tools/factory/project.mjs)');
  assert.ok(lines.includes('## December 2026 — admitted packets'));
  assert.ok(lines.includes('## December scope — outcomes'));
  assert.ok(!board.includes('November 2026 —') && !board.includes('November scope'));
  assert.ok(board.includes('*Projection of `claude/packets/MA-DEC-*_Status.json` (the only live state). Hand edits are overwritten. Previous month\'s board archived unchanged at `claude/packets/STATUS_BOARD_November_2026.md`; October board at `claude/packets/STATUS_BOARD_October_2026.md`.*'));
  assert.ok(board.includes(`| ${D} — `) && board.includes('MA-DEC-OUT'));
  assert.ok(!board.includes('MA-NOV-'), 'no November rows or globs on the board');
  assert.ok(html.includes('<title>December 2026 Control Tower</title>'));
  assert.ok(html.includes('<h1>Meridian Atlas — December 2026 Control Tower</h1>'));
  assert.ok(html.includes('<h2>December scope'));
  assert.ok(!html.includes(N) && !html.includes('MA-NOV-OUT') && !html.includes('MA-NOV-*'), 'November packets absent from the Tower');
  assert.deepEqual(snap.packets.map((p) => p.id), ['MA-DEC-OUT', D]);
  // Eligibility and dispatch still see every PACKET_PREFIXES packet.
  assert.deepEqual(evaluate({ root: repo.root }).eligible, [D, N]);
  assert.deepEqual(JSON.parse(runNode(DISPATCH, ['check'], envFor(repo)).stdout).eligible, [D, N]);
  // previous_archive override for later months.
  assert.match(boardLabels({ board: { label: 'January 2027', prefix: 'MA-JAN-', previous_archive: 'claude/packets/STATUS_BOARD_December_2026.md' } }).archives, /STATUS_BOARD_December_2026\.md/);
});

test('55. (c) overwrite guard refuses a hand board and accepts a generated board of another month', () => {
  const repo = makeRepo({ packets: [D], config: DEC, git: false });
  const f = P(repo, 'claude', 'packets', 'STATUS_BOARD.md');
  fs.writeFileSync(f, BOARD_TITLE + '\nold November board\n');
  assert.ok(boardIsGenerated(f));
  project({ root: repo.root });
  assert.match(fs.readFileSync(f, 'utf8'), /^# Status Board — December 2026 \(generated/);
  for (const hand of ['# Status Board — October 2026\nhand-written\n', '# Status Board — December 2026\nhand\n', 'notes\n']) {
    fs.writeFileSync(f, hand);
    assert.equal(boardIsGenerated(f), false, hand);
    assert.throws(() => project({ root: repo.root }), /not a generated board/);
    assert.equal(fs.readFileSync(f, 'utf8'), hand, 'hand board untouched');
  }
});

test('56. (c) a December-generated board is accepted by the November (no board config) generator', () => {
  const repo = makeRepo({ packets: [N], git: false });
  const f = P(repo, 'claude', 'packets', 'STATUS_BOARD.md');
  fs.writeFileSync(f, '# Status Board — December 2026 (generated — do not edit; run node tools/factory/project.mjs)\n');
  project({ root: repo.root });
  assert.equal(fs.readFileSync(f, 'utf8').split('\n', 1)[0], BOARD_TITLE);
});
