// MA-NOV-UIT.BUILD — local node:sqlite dry-run helpers (seed, run an apply/rollback file batch by batch, dump).
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const DATA_TABLES = ['etf_master', 'fund_snapshot_monthly', 'fund_holdings_monthly', 'holdings_pipeline_state'];

export function seedDb(seed, file = ':memory:') {
  const db = new DatabaseSync(file);
  for (const s of seed.schema.filter((x) => x.type === 'table')) db.exec(s.sql);
  for (const s of seed.schema.filter((x) => x.type === 'index')) db.exec(s.sql);
  const load = (table, rows) => {
    if (!rows.length) return;
    const cols = Object.keys(rows[0]);
    const st = db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`);
    db.exec('BEGIN');
    for (const r of rows) st.run(...cols.map((c) => r[c]));
    db.exec('COMMIT');
  };
  load('etf_master', seed.etf_master);
  load('fund_snapshot_monthly', seed.fund_snapshot_monthly);
  load('fund_holdings_monthly', seed.fund_holdings_monthly);
  // Match D1's AUTOINCREMENT counter.
  db.prepare(`UPDATE sqlite_sequence SET seq = ? WHERE name = 'fund_holdings_monthly'`).run(seed.sqlite_sequence_fund_holdings_monthly);
  return db;
}

// Parse a generated apply/rollback file: "-- batch N: …, expected [..]" headers, then one statement per line.
export function parseSqlFile(text) {
  const batches = [];
  let cur = null;
  for (const line of text.split('\n')) {
    const h = line.match(/^-- batch (\d+): (.*), (\d+) statements, expected \[([\d,]*)\]$/);
    if (h) { cur = { n: +h[1], label: h[2], expect: h[4].split(',').map(Number), stmts: [] }; batches.push(cur); continue; }
    if (!line.trim() || line.startsWith('--')) continue;
    if (!cur) throw new Error('statement before first batch header');
    cur.stmts.push(line);
  }
  for (const b of batches) if (b.expect.length !== b.stmts.length) throw new Error(`batch ${b.n}: ${b.stmts.length} statements vs ${b.expect.length} expected`);
  return batches;
}

// Runs each batch in its own transaction (as D1 batch does). Returns per-batch changes; stops on mismatch if strict.
export function runBatches(db, batches, { strict = true } = {}) {
  const out = [];
  for (const b of batches) {
    db.exec('BEGIN');
    const got = b.stmts.map((s) => Number(db.prepare(s).run().changes));
    db.exec('COMMIT');
    const ok = got.every((g, i) => g === b.expect[i]);
    out.push({ n: b.n, label: b.label, got, ok, total: got.reduce((a, x) => a + x, 0) });
    if (strict && !ok) throw Object.assign(new Error(`batch ${b.n} changes ${JSON.stringify(got)} ≠ expected ${JSON.stringify(b.expect)}`), { results: out });
  }
  return out;
}

export function dump(db) {
  const out = {};
  for (const t of [...DATA_TABLES, 'sqlite_sequence']) {
    const cols = db.prepare(`SELECT name FROM pragma_table_info('${t}')`).all().map((r) => r.name);
    const rows = db.prepare(`SELECT * FROM ${t} ORDER BY ${cols.map((_, i) => i + 1).join(',')}`).all();
    const json = JSON.stringify(rows);
    out[t] = { rows: rows.length, sha256: crypto.createHash('sha256').update(json).digest('hex') };
  }
  return out;
}
