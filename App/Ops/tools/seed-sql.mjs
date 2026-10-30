#!/usr/bin/env node
// seed-sql.mjs — MA-OCT-004 (spec rev 1 §10.2, §10.4): renders the fixed seed template (seeds/seed-template.sql)
// over one reviewed JSON file. Re-serialises the JSON compactly, doubles single quotes, and replaces __SEEDS__ and
// __FILE_SHA__ (the SHA-256 of the JSON file's bytes) on the template's SQL lines only; comment lines are never
// rewritten (R1C-ARC R1-5 discipline). NUL bytes refused; every seed must carry the template's required keys.
//
// --unmatched maps 008's bonds/state/unmatched-issuers.json ([{cik, sec_name, lei|null, co_registrant_of|null}])
// to one `missing_entity` seed per CIK (dedupe 'sec_cik:'||cik, 0 members); its SHA-256 is recorded (N4-3).
//   node App/Ops/tools/seed-sql.mjs --in seeds/m3-seeds.json --out migrations/m3-seeds.sql
//   node App/Ops/tools/seed-sql.mjs --unmatched <unmatched-issuers.json> --out migrations/m4-unmatched.sql
// Prints the input SHA-256, the rendered file's SHA-256 and the seed/member counts. No D1, no network.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATE = path.join(HERE, '..', 'seeds', 'seed-template.sql');
const REQUIRED = ['dedupe', 'type', 'sev', 'status', 'title', 'od', 'ok', 'owner', 'members'];
const sha = b => createHash('sha256').update(b).digest('hex');

export function unmatchedToSeeds(rows) {
  if (!Array.isArray(rows)) throw new Error('unmatched-issuers.json must be an array');
  return rows.map(r => {
    if (!/^\d{10}$/.test(String(r.cik))) throw new Error(`bad cik ${JSON.stringify(r.cik)}`);
    if (typeof r.sec_name !== 'string' || !r.sec_name.trim()) throw new Error(`cik ${r.cik}: sec_name required`);
    return {
      dedupe: `sec_cik:${r.cik}`, type: 'missing_entity', sev: 'sev3', status: 'open',
      title: `SEC issuer ${r.sec_name.slice(0, 120)} (CIK ${r.cik}) has no entity`.slice(0, 200),
      summary: r.co_registrant_of ? `Co-registrant of ${r.co_registrant_of}; never link to the parent or guarantor.` : 'Unmatched in 008 linkage (Pack C).',
      od: 'source_record', ok: `sec_cik:${r.cik}`,
      ref: { cik: r.cik, sec_name: r.sec_name, lei: r.lei ?? null, co_registrant_of: r.co_registrant_of ?? null },
      src: 'ma-oct-008', evidence: 'MA-OCT-008 bonds/state/unmatched-issuers.json (SHA-256 in the created event payload).',
      proposal: 'Data-Identity Lead: find or create the entity, then a manual link (008 §11.1: never automatic).',
      owner: 'Data-Identity Lead', members: []
    };
  });
}

// Returns { fileSha, text, seeds, members } for the template text, the JSON file's raw bytes and its parsed seeds.
export function renderSeeds(templateText, rawBytes, seeds) {
  if (templateText.includes('\u0000') || rawBytes.includes(0)) throw new Error('NUL byte in input');
  if (!Array.isArray(seeds) || !seeds.length) throw new Error('seed file must be a non-empty array');
  const dedupes = new Set();
  for (const s of seeds) {
    for (const k of REQUIRED) if (s[k] === undefined) throw new Error(`seed ${s.dedupe ?? '?'}: missing ${k}`);
    if (!Array.isArray(s.members) || s.members.length > 500) throw new Error(`seed ${s.dedupe}: members must be an array of ≤ 500`);
    if (dedupes.has(s.dedupe)) throw new Error(`duplicate dedupe ${s.dedupe}`);
    dedupes.add(s.dedupe);
  }
  const fileSha = sha(rawBytes);
  const literal = JSON.stringify(seeds).replace(/'/g, "''");
  let n = 0;
  const text = templateText.split('\n').map(line => {
    if (/^\s*--/.test(line)) return line;
    n += (line.match(/__SEEDS__/g) || []).length;
    return line.split('__SEEDS__').join(literal).split('__FILE_SHA__').join(fileSha);
  }).join('\n');
  if (n !== 4) throw new Error(`template must use __SEEDS__ exactly 4 times on SQL lines (found ${n})`);
  return { fileSha, text, seeds: seeds.length, members: seeds.reduce((a, s) => a + s.members.length, 0) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : null)).filter(Boolean));
  const input = args.in || args.unmatched;
  if (!input || !args.out) { console.error('usage: seed-sql.mjs (--in <seeds.json> | --unmatched <unmatched-issuers.json>) --out <file.sql>'); process.exit(2); }
  const raw = readFileSync(input);
  const parsed = JSON.parse(raw.toString('utf8'));
  const r = renderSeeds(readFileSync(TEMPLATE, 'utf8'), raw, args.unmatched ? unmatchedToSeeds(parsed) : parsed);
  writeFileSync(args.out, r.text);
  console.log(JSON.stringify({ input, input_sha256: r.fileSha, rendered: args.out, rendered_sha256: sha(Buffer.from(r.text, 'utf8')), seeds: r.seeds, members: r.members }, null, 1));
}
