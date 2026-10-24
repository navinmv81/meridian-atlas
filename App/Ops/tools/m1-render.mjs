#!/usr/bin/env node
// m1-render.mjs — MA-OCT-003 (spec rev 1 §10.2): renders migrations/m1-entity-exceptions-to-ops.sql for the
// Sat 24 run. Fills the 'migrated' event payload with file_sha256 = SHA-256 of the TEMPLATE (as committed)
// and commit = the commit that carries it. Nothing else in the file changes.
//
// Rules (R1C-ARC R1-5 discipline): the exact payload fragment must occur exactly once and is replaced by
// splitting the fixed template, so no other text (comments, data) is ever rewritten; NUL bytes refused;
// commit must be 7–40 lowercase hex. Output mode 600, outside the repo by default.
//   node App/Ops/tools/m1-render.mjs --commit <sha> [--out <file>]
// Prints the template SHA-256, the rendered file's SHA-256 and the path. No D1, no network.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATE = path.join(HERE, '..', 'migrations', 'm1-entity-exceptions-to-ops.sql');
const FRAGMENT = `'file_sha256','__FILE_SHA__','commit','__COMMIT__'`;
const sha = b => createHash('sha256').update(b).digest('hex');

export function render(templateText, commit) {
  if (templateText.includes('\u0000')) throw new Error('template contains a NUL byte');
  if (!/^[0-9a-f]{7,40}$/.test(commit)) throw new Error('commit must be 7–40 lowercase hex characters');
  const parts = templateText.split(FRAGMENT);
  if (parts.length !== 2) throw new Error(`payload fragment must occur exactly once (found ${parts.length - 1})`);
  const fileSha = sha(Buffer.from(templateText, 'utf8'));
  return { fileSha, text: parts[0] + `'file_sha256','${fileSha}','commit','${commit}'` + parts[1] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : null)).filter(Boolean));
  const out = args.out || path.join(homedir(), 'MeridianAtlas-work', 'ma-oct-003', `m1-rendered-${args.commit}.sql`);
  const { fileSha, text } = render(readFileSync(TEMPLATE, 'utf8'), args.commit || '');
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, text, { mode: 0o600 });
  chmodSync(out, 0o600);
  console.log(JSON.stringify({ template: TEMPLATE, template_sha256: fileSha, rendered: out, rendered_sha256: sha(Buffer.from(text, 'utf8')) }, null, 1));
}
