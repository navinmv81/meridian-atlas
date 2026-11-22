// MA-NOV-BOND.FIX2 — builds the guarded apply + rollback SQL and the row diff for U5/U6 (BOND.APPLY). Builds only; never runs SQL.
//
//   node fix2-build.mjs --before=<D1 SELECT * FROM bond_issuance, wrangler --json> --after=<offline 1.3.1 corpus re-parse> --out=<dir> --generated=<ISO time>
//
// Before = D1 today (read-only SELECT). After = the parser 1.3.1 whole-corpus re-parse from state/cache with FWP pairing and the
// runner's linkDrafts over the full set (FIX2 report §4). Only filings already in D1 are touched; nothing new is inserted.
// Assumes BOND-CR1's two nullable columns: status_reason TEXT, superseded_by TEXT (spec v1 §5).
//
// Written columns: status/identity/terms the parser owns + parser_version + status_reason + superseded_by. Never written:
// cik (co-registrant links and R-1 live in D1), filing_date, form_type, source_url, ingested_at (kept from D1).
// Statements: in place → UPDATE … WHERE pk AND filing_status = <old> AND parser_version = <old> AND status_reason IS NULL
//   AND superseded_by IS NULL [AND cusip IS NULL when an identifier is filled]; tranche set changes (seq 0 ↔ 1..n) → guarded
//   INSERT OR IGNORE … SELECT … WHERE EXISTS(old) + DELETE old … AND EXISTS(new) (R-4 pattern, ruling L8-10). Every statement
//   expects exactly 1 change. Batches ≤ 100 statements; a filing's statements are never split; runs ≤ 8,000 estimated writes.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const arg = Object.fromEntries(process.argv.slice(2).map(s => s.match(/^--([a-z-]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2]]));
for (const k of ['before', 'after', 'out', 'generated']) if (!arg[k]) throw new Error(`--${k}= is required`);
const NEW_VERSION = 'bonds-1.3.1';
const RUN_CAP = 8000, BATCH = 100;

const COLS = ['accession_number', 'tranche_seq', 'cik', 'instrument_key', 'isin', 'cusip', 'form_type', 'filing_date', 'filing_status',
  'tranche_label', 'security_class', 'rate_type', 'coupon_rate', 'spread_bps', 'benchmark', 'principal_amount', 'currency', 'maturity_date',
  'seniority', 'source_url', 'parse_confidence', 'parser_version', 'ingested_at'];
const CR1 = ['status_reason', 'superseded_by'];
const WRITABLE = ['filing_status', 'instrument_key', 'isin', 'cusip', 'tranche_label', 'security_class', 'rate_type', 'coupon_rate', 'spread_bps',
  'benchmark', 'principal_amount', 'currency', 'maturity_date', 'seniority', 'parse_confidence'];
const KEEP = ['cik', 'filing_date', 'form_type', 'source_url', 'ingested_at'];

const lit = v => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const eq = (a, b) => (a ?? null) === (b ?? null) || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-9);
const is = (c, v) => (v === null || v === undefined ? `${c} IS NULL` : `${c} = ${lit(v)}`);
const pk = r => `accession_number = ${lit(r.accession_number)} AND tranche_seq = ${r.tranche_seq}`;
const sha = s => createHash('sha256').update(s).digest('hex');

// D1 rows written (table + indexes): PK autoindex on insert/delete; idx_bi_cik_final_key (final rows); idx_bi_instrument (key not null).
const inIdx = r => ({ fin: r.filing_status === 'final', key: r.instrument_key != null });
const insertCost = r => 2 + (inIdx(r).fin ? 1 : 0) + (inIdx(r).key ? 1 : 0);
function updateCost(o, n) {
  let w = 1;
  const a = inIdx(o), b = inIdx(n);
  if (a.fin !== b.fin) w += 1; else if (a.fin && (!eq(o.maturity_date, n.maturity_date))) w += 2;
  if (a.key !== b.key) w += 1; else if (a.key && !eq(o.instrument_key, n.instrument_key)) w += 2;
  return w;
}

const before = JSON.parse(readFileSync(arg.before, 'utf8'))[0].results;
const after = JSON.parse(readFileSync(arg.after, 'utf8'));
const D = new Map();
for (const r of before) { if (!D.has(r.accession_number)) D.set(r.accession_number, []); D.get(r.accession_number).push(r); }
const A = new Map(after.filings.map(f => [f.accession, f]));
// A draft may name a final that this same apply turns final (e.g. a parse_failed today); it must be a D1 filing either way.
const finalsAfter = new Set([...before.filter(r => r.filing_status === 'final').map(r => r.accession_number),
  ...after.filings.filter(f => D.has(f.accession) && f.rows.some(r => r.filing_status === 'final')).map(f => f.accession)]);

const groups = [];      // per filing: { accession, apply: [stmt], rollback: [stmt], writes, rbWrites }
const diff = [];        // one line per changed row
const counts = {};
const bump = k => { counts[k] = (counts[k] || 0) + 1; };
const notInCorpus = [...D.keys()].filter(k => !A.has(k));
const notInD1 = [...A.keys()].filter(k => !D.has(k));
const problems = [];

for (const [acc, oldRows] of [...D.entries()].sort()) {
  const f = A.get(acc);
  if (!f) continue;
  const base = oldRows[0];
  const newRows = f.rows.map(r => {
    const n = { ...r };
    for (const k of KEEP) n[k] = base[k];                                   // D1 keeps cik / dates / url / ingested_at
    n.parser_version = NEW_VERSION;
    n.status_reason = r.filing_status === 'final' ? null : (r.status_reason ?? null);   // spec v1 §5: finals stay NULL; partial is derived
    n.superseded_by = r.superseded_by ?? null;
    if (n.superseded_by && !finalsAfter.has(n.superseded_by)) problems.push(`${acc}: superseded_by ${n.superseded_by} is not a final D1 filing after apply`);
    if (n.filing_status !== 'final') n.instrument_key = null;
    return n;
  });
  const g = { accession: acc, apply: [], rollback: [], writes: 0, rbWrites: 0 };
  const sameSet = oldRows.map(r => r.tranche_seq).sort().join() === newRows.map(r => r.tranche_seq).sort().join();
  if (sameSet) {
    for (const o of oldRows) {
      const n = newRows.find(x => x.tranche_seq === o.tranche_seq);
      const changed = WRITABLE.filter(c => !eq(o[c], n[c]));
      const sets = [...changed.map(c => `${c} = ${lit(n[c])}`), `parser_version = ${lit(NEW_VERSION)}`, `status_reason = ${lit(n.status_reason)}`, `superseded_by = ${lit(n.superseded_by)}`];
      const fill = changed.includes('cusip') && o.cusip == null;
      g.apply.push({ sql: `UPDATE bond_issuance SET ${sets.join(', ')} WHERE ${pk(o)} AND ${is('filing_status', o.filing_status)} AND ${is('parser_version', o.parser_version)} AND status_reason IS NULL AND superseded_by IS NULL${fill ? ' AND cusip IS NULL' : ''};`, expect: 1 });
      const back = [...changed.map(c => `${c} = ${lit(o[c])}`), `parser_version = ${lit(o.parser_version)}`, 'status_reason = NULL', 'superseded_by = NULL'];
      g.rollback.push({ sql: `UPDATE bond_issuance SET ${back.join(', ')} WHERE ${pk(o)} AND ${is('filing_status', n.filing_status)} AND parser_version = ${lit(NEW_VERSION)};`, expect: 1 });
      g.writes += updateCost(o, n); g.rbWrites += updateCost(n, o);
      const type = o.filing_status !== n.filing_status ? `status ${o.filing_status}→${n.filing_status}`
        : changed.length ? `values (${changed.join(',')})` : n.status_reason || n.superseded_by ? 'reason only' : 'version only';
      bump(type.startsWith('values') ? `values: ${changed.filter(c => c !== 'parse_confidence').join('+') || 'parse_confidence'}` : type);
      if (type !== 'version only') diff.push([acc, o.tranche_seq, type, changed.map(c => `${c}: ${JSON.stringify(o[c] ?? null)} → ${JSON.stringify(n[c] ?? null)}`).join('; '),
        n.status_reason || '', n.superseded_by || '', (f.rows.find(x => x.tranche_seq === o.tranche_seq) || {}).status_note || '',
        (f.rows.find(x => x.tranche_seq === o.tranche_seq) || {}).id_source || '', f.rule || '', o.parser_version, base.source_url]);
    }
  } else {
    // Tranche set changes (seq 0 ↔ 1..n): guarded INSERT OR IGNORE of the new rows, then guarded DELETE of the old ones.
    const oldGuard = oldRows.map(o => `EXISTS (SELECT 1 FROM bond_issuance WHERE ${pk(o)} AND ${is('filing_status', o.filing_status)} AND ${is('parser_version', o.parser_version)})`).join(' AND ');
    const newGuard = newRows.map(n => `EXISTS (SELECT 1 FROM bond_issuance WHERE ${pk(n)} AND ${is('filing_status', n.filing_status)} AND parser_version = ${lit(NEW_VERSION)})`).join(' AND ');
    const cols = [...COLS, ...CR1];
    for (const n of newRows) {
      const row = { ...n, ingested_at: arg.generated };
      g.apply.push({ sql: `INSERT OR IGNORE INTO bond_issuance (${cols.join(', ')}) SELECT ${cols.map(c => lit(row[c])).join(', ')} WHERE ${oldGuard};`, expect: 1 });
      g.writes += insertCost(row);
    }
    for (const o of oldRows) { g.apply.push({ sql: `DELETE FROM bond_issuance WHERE ${pk(o)} AND ${is('filing_status', o.filing_status)} AND ${is('parser_version', o.parser_version)} AND ${newGuard};`, expect: 1 }); g.writes += insertCost(o); }
    // Rollback: restore the exact old rows (status_reason / superseded_by NULL), then remove the new ones.
    const restored = oldRows.map(o => `EXISTS (SELECT 1 FROM bond_issuance WHERE ${pk(o)} AND ${is('filing_status', o.filing_status)} AND ${is('parser_version', o.parser_version)})`).join(' AND ');
    for (const o of oldRows) { g.rollback.push({ sql: `INSERT OR IGNORE INTO bond_issuance (${cols.join(', ')}) SELECT ${cols.map(c => lit(c in o ? o[c] : null)).join(', ')} WHERE ${newGuard};`, expect: 1 }); g.rbWrites += insertCost(o); }
    for (const n of newRows) { g.rollback.push({ sql: `DELETE FROM bond_issuance WHERE ${pk(n)} AND ${is('filing_status', n.filing_status)} AND parser_version = ${lit(NEW_VERSION)} AND ${restored};`, expect: 1 }); g.rbWrites += insertCost(n); }
    const type = `set ${oldRows.map(o => `${o.tranche_seq}:${o.filing_status}`).join(',')} → ${newRows.map(n => `${n.tranche_seq}:${n.filing_status}`).join(',')}`;
    bump('tranche set change');
    diff.push([acc, '*', type, '', newRows.map(n => n.status_reason || '').join(','), '', '', '', f.rule || '', oldRows.map(o => o.parser_version).join(','), base.source_url]);
  }
  groups.push(g);
}
if (problems.length) throw new Error('problems:\n' + problems.join('\n'));

// Runs (≤ RUN_CAP writes) → batches (≤ BATCH statements); a filing never splits.
function pack(key, wkey) {
  const runs = [];
  let run = null, batch = null;
  for (const g of groups) {
    const stmts = g[key], w = g[wkey];
    if (!run || run.writes + w > RUN_CAP) { run = { writes: 0, batches: [] }; runs.push(run); batch = null; }
    if (!batch || batch.stmts.length + stmts.length > BATCH) { batch = { stmts: [], filings: 0 }; run.batches.push(batch); }
    batch.stmts.push(...stmts); batch.filings++; run.writes += w;
  }
  return runs;
}
mkdirSync(arg.out, { recursive: true });
const files = {};
const write = (name, text) => { writeFileSync(path.join(arg.out, name), text); files[name] = { sha256: sha(text), bytes: Buffer.byteLength(text) }; };
const head = (kind, i, n, run) => [
  `-- MA-NOV-BOND.FIX2 ${kind} — run ${i + 1} of ${n}. NOT RUN by FIX2; for U5 BOND.APPLY after BOND-CR1 and the Founder's write approval.`,
  `-- Parser ${NEW_VERSION}; before = D1 SELECT ${arg.generated}; ${run.batches.length} batches, ${run.batches.reduce((a, b) => a + b.stmts.length, 0)} statements, est. ${run.writes} rows written.`,
  '-- Every statement expects exactly 1 change; stop on the first mismatch (expected vector per batch below). Assumes CR1 columns status_reason, superseded_by.', ''];
const applyRuns = pack('apply', 'writes'), rbRuns = pack('rollback', 'rbWrites').reverse();
const summaryRuns = [];
applyRuns.forEach((run, i) => {
  const lines = head('apply', i, applyRuns.length, run);
  run.batches.forEach((b, j) => { lines.push(`-- batch ${j + 1}: ${b.filings} filings, ${b.stmts.length} statements, expected [${b.stmts.map(s => s.expect).join(',')}]`); lines.push(...b.stmts.map(s => s.sql), ''); });
  write(`fix2-apply-run${i + 1}.sql`, lines.join('\n'));
  summaryRuns.push({ file: `fix2-apply-run${i + 1}.sql`, batches: run.batches.length, statements: run.batches.reduce((a, b) => a + b.stmts.length, 0), est_writes: run.writes });
});
rbRuns.forEach((run, i) => {
  // Roll back in reverse order, last batch first; within a filing the old rows are restored before the new ones are removed.
  const lines = head('rollback', i, rbRuns.length, run);
  [...run.batches].reverse().forEach((b, j) => { lines.push(`-- batch ${j + 1}: ${b.filings} filings, ${b.stmts.length} statements, expected [${b.stmts.map(s => s.expect).join(',')}]`); lines.push(...b.stmts.map(s => s.sql), ''); });
  write(`fix2-rollback-run${i + 1}.sql`, lines.join('\n'));
  summaryRuns.push({ file: `fix2-rollback-run${i + 1}.sql`, batches: run.batches.length, statements: run.batches.reduce((a, b) => a + b.stmts.length, 0), est_writes: run.writes });
});
write('fix2-diff.tsv', ['accession\tseq\tchange\tcolumns (before → after)\tstatus_reason\tsuperseded_by\tnote\tid_source\trule\told_parser_version\tsource_url',
  ...diff.map(r => r.join('\t'))].join('\n') + '\n');

// After-apply state of D1 (the same transform, for T1–T5).
const post = [];
for (const [acc, oldRows] of D) {
  const f = A.get(acc);
  if (!f) { post.push(...oldRows.map(r => ({ ...r, status_reason: null, superseded_by: null }))); continue; }
  post.push(...f.rows.map(r => ({ ...r, cik: oldRows[0].cik, status_reason: r.filing_status === 'final' ? null : r.status_reason ?? null, superseded_by: r.superseded_by ?? null, missing: r.missing })));
}
const by = rs => rs.reduce((o, r) => { const k = `${r.filing_status}${r.filing_status === 'final' ? (r.cusip || r.isin ? ' · with id' : ' · no id') : ' · ' + (r.status_reason ?? '(none)')}`; o[k] = (o[k] || 0) + 1; return o; }, {});
const fin = post.filter(r => r.filing_status === 'final');
const summary = {
  packet: 'MA-NOV-BOND.FIX2', generated: arg.generated, parser: NEW_VERSION, run: 'NOT RUN',
  inputs: { before: { file: path.basename(arg.before), sha256: sha(readFileSync(arg.before)) , rows: before.length, filings: D.size },
            after: { file: path.basename(arg.after), sha256: sha(readFileSync(arg.after)), filings: A.size } },
  scope: { filings_touched: groups.length, d1_filings_not_in_corpus: notInCorpus, corpus_filings_not_in_d1: notInD1.length },
  changes: counts, diff_rows: diff.length, runs: summaryRuns, files,
  before_classes: by(before), after_classes: by(post),
  final_rows: { before: before.filter(r => r.filing_status === 'final').length, after: fin.length,
                with_id_before: before.filter(r => r.filing_status === 'final' && (r.cusip || r.isin)).length, with_id_after: fin.filter(r => r.cusip || r.isin).length }
};
writeFileSync(path.join(arg.out, 'fix2-summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
