// MA-NOV-BOND.OFFER2 — builds the guarded offering apply + rollback SQL (BOND-CR2 tables) and the row diff for U8 (BOND.VERIFY).
// Builds only; never runs SQL.
//
//   node offer-build.mjs --run=<offer-dryrun.mjs output> --out=<dir> --generated=<ISO time>
//
// Statements (one per line): INSERT OR IGNORE INTO bond_offering_fact|party (cols) SELECT * FROM (VALUES (…), …) WHERE <guard>.
//   Guard: the filing's reliability apply is final in D1 — its final rows are exactly the offering's tranche set, all at bonds-1.3.1
//   (spec v2 §9: "only filings whose reliability apply is final"). If not, the statement changes 0 rows and the run stops (vector).
//   ≤ 40 rows per statement (D1 statement-size limit), a filing's statements never split across batches, ≤ 100 statements per batch,
//   runs ≤ 8,000 row-writes (WITHOUT ROWID, PK only: one write per row). INSERT OR IGNORE on the PKs: a re-run changes 0 rows.
// Rollback per run: DELETE … WHERE parser_version = <offering version> AND accession_number IN (…) per batch, expected = rows.
// MA-NOV-BOND.FIX3: the fields in WITHHELD_FIELDS (spec v2 §6.3 gate) are taken out by applyWithheld() before anything is written:
// no use_of_proceeds or proceeds_total row; selling_restrictions keeps its link + heading without the place list.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { FACT_COLS, PARTY_COLS, WITHHELD_FIELDS, applyWithheld } from '../bonds-offering.mjs';

const arg = Object.fromEntries(process.argv.slice(2).map(s => s.match(/^--([a-z-]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2]]));
for (const k of ['run', 'out', 'generated']) if (!arg[k]) throw new Error(`--${k}= is required`);
const RELIABILITY_VERSION = 'bonds-1.3.1';
const RUN_CAP = 8000, BATCH = 100, CHUNK = 40;
const sha = s => createHash('sha256').update(s).digest('hex');
const lit = v => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

const runText = readFileSync(arg.run, 'utf8');
const run = JSON.parse(runText);
const version = run.offering_version;
const filings = run.filings.filter(f => f.status === 'debt').sort((a, b) => (a.accession < b.accession ? -1 : 1))
  .map(f => ({ ...f, facts: applyWithheld(f.facts) }));
for (const f of filings) for (const x of f.facts) {
  if (WITHHELD_FIELDS[x.field] === 'row') throw new Error(`${f.accession}: withheld field ${x.field} in the apply`);
  if (WITHHELD_FIELDS[x.field] === 'value_text' && x.value_text != null) throw new Error(`${f.accession}: withheld value of ${x.field} in the apply`);
}

const groups = filings.map(f => {
  const seqs = f.rows.map(r => r.tranche_seq).sort((a, b) => a - b);
  const guard = `(SELECT COUNT(*) FROM bond_issuance WHERE accession_number = ${lit(f.accession)} AND filing_status = 'final' AND parser_version = '${RELIABILITY_VERSION}') = ${seqs.length}`
    + ` AND (SELECT COUNT(*) FROM bond_issuance WHERE accession_number = ${lit(f.accession)} AND filing_status = 'final' AND tranche_seq IN (${seqs.join(',')})) = ${seqs.length}`;
  const stmts = [];
  for (const [table, cols, rows] of [['bond_offering_fact', FACT_COLS, f.facts], ['bond_offering_party', PARTY_COLS, f.parties]]) {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const part = rows.slice(i, i + CHUNK);
      stmts.push({ sql: `INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) SELECT * FROM (VALUES ${part.map(r => `(${cols.map(c => lit(r[c])).join(', ')})`).join(', ')}) WHERE ${guard};`, n: part.length, table });
    }
  }
  return { accession: f.accession, stmts, writes: f.facts.length + f.parties.length, facts: f.facts.length, parties: f.parties.length };
});

// Pack: filings → batches (≤ 100 statements) → runs (≤ 8,000 writes).
const runs = [];
let cur = null, bat = null;
for (const g of groups) {
  if (g.writes > RUN_CAP || g.stmts.length > BATCH) throw new Error(`${g.accession}: one filing exceeds a run or a batch`);
  if (!cur || cur.writes + g.writes > RUN_CAP) { cur = { batches: [], writes: 0 }; runs.push(cur); bat = null; }
  if (!bat || bat.stmts.length + g.stmts.length > BATCH) { bat = { stmts: [], filings: [], writes: 0 }; cur.batches.push(bat); }
  bat.stmts.push(...g.stmts); bat.filings.push(g); bat.writes += g.writes; cur.writes += g.writes;
}

mkdirSync(arg.out, { recursive: true });
const summary = { generated: arg.generated, offering_version: version, reliability_version: RELIABILITY_VERSION, run_cap_writes: RUN_CAP,
  input: { file: path.basename(arg.run), sha256: sha(runText), parser_version: run.parser_version, ingested_at: run.ingested_at },
  withheld: WITHHELD_FIELDS,
  filings: groups.length, fact_rows: groups.reduce((a, g) => a + g.facts, 0), party_rows: groups.reduce((a, g) => a + g.parties, 0), runs: [] };
runs.forEach((r, k) => {
  const n = k + 1, N = runs.length;
  const head = (what, extra) => [`-- MA-NOV-BOND offering ${what} — run ${n} of ${N}. Built by offer-build.mjs (OFFER2, rebuilt by FIX3); NOT RUN — for U8 BOND.VERIFY after BOND-CR2 and write approval 2.`,
    `-- Offering ${version}; reliability ${RELIABILITY_VERSION} must be applied first (BOND.APPLY1). Generated ${arg.generated} from ${path.basename(arg.run)} (${sha(runText).slice(0, 16)}…).`,
    `-- ${r.batches.length} batches, ${r.batches.reduce((a, b) => a + b.stmts.length, 0)} statements, ${r.writes} rows (${extra}). Stop on the first mismatch against the batch vector.`, ''];
  const ap = head('apply', `est. ${r.writes} row-writes; one per row, PK only`);
  const rb = head('rollback', `deletes exactly the rows this run inserted; a row never inserted is not counted`);
  r.batches.forEach((b, i) => {
    ap.push(`-- batch ${i + 1}: ${b.filings.length} filings, ${b.stmts.length} statements, expected [${b.stmts.map(s => s.n).join(',')}]`);
    b.stmts.forEach(s => ap.push(s.sql));
    ap.push('');
    const ids = b.filings.map(g => lit(g.accession)).join(', ');
    const nf = b.filings.reduce((a, g) => a + g.facts, 0), np = b.filings.reduce((a, g) => a + g.parties, 0);
    rb.push(`-- batch ${i + 1}: ${b.filings.length} filings, 2 statements, expected [${nf},${np}]`);
    rb.push(`DELETE FROM bond_offering_fact WHERE parser_version = ${lit(version)} AND accession_number IN (${ids});`);
    rb.push(`DELETE FROM bond_offering_party WHERE parser_version = ${lit(version)} AND accession_number IN (${ids});`);
    rb.push('');
  });
  const apText = ap.join('\n'), rbText = rb.join('\n');
  writeFileSync(path.join(arg.out, `offer-apply-run${n}.sql`), apText);
  writeFileSync(path.join(arg.out, `offer-rollback-run${n}.sql`), rbText);
  summary.runs.push({ run: n, file: `offer-apply-run${n}.sql`, sha256: sha(apText), rollback: `offer-rollback-run${n}.sql`, rollback_sha256: sha(rbText),
    filings: r.batches.reduce((a, b) => a + b.filings.length, 0), batches: r.batches.length, statements: r.batches.reduce((a, b) => a + b.stmts.length, 0),
    fact_rows: r.batches.reduce((a, b) => a + b.filings.reduce((x, g) => x + g.facts, 0), 0), party_rows: r.batches.reduce((a, b) => a + b.filings.reduce((x, g) => x + g.parties, 0), 0),
    est_writes: r.writes, first: r.batches[0].filings[0].accession, last: r.batches.at(-1).filings.at(-1).accession });
});

// Diff: one line per new row (the tables are empty before the apply).
const tsv = ['table\taccession_number\ttranche_seq\tkey\tstate_or_role\tvalue\tsource'];
for (const f of filings) {
  for (const x of f.facts) tsv.push(['fact', x.accession_number, x.tranche_seq, x.field, x.state, x.value_text ?? x.value_num ?? x.value_date ?? '', `${x.source_doc}:${x.source_part}${x.source_page ? ' ' + x.source_page : ''}`].join('\t'));
  for (const p of f.parties) tsv.push(['party', p.accession_number, p.tranche_seq, p.party_seq, p.role, p.party_name, `${p.source_doc}:${p.source_part}${p.source_page ? ' ' + p.source_page : ''}`].join('\t'));
}
const diffText = tsv.join('\n') + '\n';
writeFileSync(path.join(arg.out, 'offer-diff.tsv'), diffText);
summary.diff = { file: 'offer-diff.tsv', lines: tsv.length - 1, sha256: sha(diffText) };
writeFileSync(path.join(arg.out, 'offer-summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ runs: summary.runs.map(r => ({ run: r.run, filings: r.filings, statements: r.statements, writes: r.est_writes })), fact_rows: summary.fact_rows, party_rows: summary.party_rows }));
