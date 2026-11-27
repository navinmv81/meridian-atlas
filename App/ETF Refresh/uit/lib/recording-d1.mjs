// MA-NOV-UIT.BUILD — recording D1 shim.
// Implements the subset of the Cloudflare D1 binding that holdings-pipeline.js's storeHoldings() uses
// (prepare → bind → run/first/all, and batch), records every statement as SQL text + params, and
// executes it on a backing node:sqlite database so reads (e.g. the coverage_depth month count) get
// real answers. Nothing here talks to Cloudflare.
import { DatabaseSync } from 'node:sqlite';

const norm = (sql) => sql.replace(/\s+/g, ' ').trim();
const toSqlite = (v) => (v === undefined ? null : v);

export function sqlLit(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`non-finite number ${v}`);
    return String(v);
  }
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
  throw new Error(`unsupported literal type ${typeof v}`);
}

// Substitute ? placeholders (none of the recorded SQL has '?' inside string literals).
export function inline(sql, params) {
  let i = 0;
  const out = sql.replace(/\?/g, () => {
    if (i >= params.length) throw new Error(`too few params for: ${sql}`);
    return sqlLit(params[i++]);
  });
  if (i !== params.length) throw new Error(`too many params (${params.length}) for: ${sql}`);
  return out;
}

export function createRecordingD1(backing = new DatabaseSync(':memory:')) {
  const log = [];
  let batchNo = 0;

  const exec = (sql, params, mode) => {
    const st = backing.prepare(sql);
    if (mode === 'run') {
      const r = st.run(...params.map(toSqlite));
      return { success: true, meta: { changes: Number(r.changes), rows_written: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
    }
    if (mode === 'first') return st.get(...params.map(toSqlite)) ?? null;
    return { results: st.all(...params.map(toSqlite)), success: true, meta: {} };
  };

  class Stmt {
    constructor(sql, params = []) { this.sql = sql; this.params = params; }
    bind(...p) { return new Stmt(this.sql, p); }
    _rec(kind, batch = null) { log.push({ seq: log.length, kind, batch, sql: norm(this.sql), params: this.params }); }
    async run() { this._rec('run'); return exec(this.sql, this.params, 'run'); }
    async first(col) { this._rec('first'); const r = exec(this.sql, this.params, 'first'); return col && r ? r[col] : r; }
    async all() { this._rec('all'); return exec(this.sql, this.params, 'all'); }
  }

  return {
    log,
    backing,
    prepare: (sql) => new Stmt(sql),
    async batch(stmts) {
      const b = ++batchNo;
      backing.exec('BEGIN');
      try {
        const out = stmts.map((s) => { s._rec('batch', b); return exec(s.sql, s.params, 'run'); });
        backing.exec('COMMIT');
        return out;
      } catch (e) { backing.exec('ROLLBACK'); throw e; }
    },
  };
}
