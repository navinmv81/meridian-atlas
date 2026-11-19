#!/usr/bin/env node
// gate3 v2 generator: node gen.mjs <run-token> <YYYY-MM> [<YYYY-MM> ...]
// Writes gate3v2-<month>.sql (write) and gate3v2-<month>.dryrun.sql (read-only) next to this file.
// Months <= 2026-03 are refused: re-computing them with the new identity rule is December's (D5).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = dirname(fileURLToPath(import.meta.url));
const [token, ...months] = process.argv.slice(2);
if (!token || !/^[A-Za-z0-9._-]+$/.test(token) || months.length === 0) {
  console.error('usage: node gen.mjs <run-token> <YYYY-MM> [...]'); process.exit(2);
}
for (const m of months) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) { console.error(`bad month ${m}`); process.exit(2); }
  if (m <= '2026-03') { console.error(`refused: ${m} <= 2026-03 (D5, December)`); process.exit(2); }
}
for (const [tmpl, suffix] of [['gate3v2-month.sql.tmpl', '.sql'], ['gate3v2-dryrun.sql.tmpl', '.dryrun.sql']]) {
  const src = readFileSync(join(dir, tmpl), 'utf8');
  for (const m of months) {
    const out = src.replaceAll('__MONTH__', m).replaceAll('__TOKEN__', token);
    writeFileSync(join(dir, `gate3v2-${m}${suffix}`), out);
    console.log(`wrote gate3v2-${m}${suffix}`);
  }
}
