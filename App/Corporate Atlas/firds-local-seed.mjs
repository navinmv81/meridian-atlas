#!/usr/bin/env node
// MA-SEP-003 — recurring local FIRDS seed (weekly, via LaunchAgent).
//
// Originally built as a one-time Phase 1 bootstrap; promoted 2026-08-21 v2
// into the recurring payload for a weekly macOS LaunchAgent
// (com.meridianatlas.firds-weekly-seed, installed by
// scripts/firds-seed-install.sh) after the daily-delta-Worker approach was
// diagnosed and rejected (claude/MA-SEP-003_Escalation_Delta_File_Size.md).
// No architecture change to the ingest logic itself — same parsing
// (decompressFirdsZip/scanFirdsChunk in src/firds-parse.js), CFI-C
// filtering, ISIN dedup, and entity-linkage logic
// (findLatestFulinsCFiles/resolveEntitiesForLeis/ingestRecords in
// src/firds.js), unchanged in substance. What's new here: a pause-flag
// check at the very top (before any network call or D1 write — see
// scripts/firds-seed-pause.sh / firds-seed-resume.sh) and a one-line-per-run
// append to logs/firds-seed.log (read by scripts/firds-seed-status.sh).
// Full control-surface design: claude/MA-SEP-003_Change_Request_Local_
// Weekly_Job.md. Kill switch: scripts/firds-seed-uninstall.sh.
//
// D1 ACCESS: via `wrangler d1 execute --remote --command`, same class of
// local access already used by this project's other local seed scripts
// (gate1-instrument-seed.js, isin-backfill.js) — literal-escaped SQL
// (esc()), not the Worker's bound-parameter `.bind()` path, so this script
// isn't limited by the D1 REST ~100-bound-parameter ceiling that sized
// firds.js's Worker-context batch constants. Larger batchSizes are passed
// into ingestRecords() below so this finishes in dozens of `wrangler d1
// execute` calls rather than thousands — see firds.js's ingestRecords/
// resolveEntitiesForLeis comments for why the override is safe.
//
// Per this project's own "meta.changes lesson" (Build Brief line 14): D1's
// self-reported write/change counts are not trustworthy for INSERT OR
// IGNORE dedup counting, especially through a multi-statement raw-SQL path
// like this one. This script does NOT rely on them for the numbers that
// matter — it takes a real `SELECT COUNT(*)` snapshot of all five affected
// tables before the run and another after, and reports the true deltas.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { decompressFirdsZip, scanFirdsChunk } from './src/firds-parse.js';
import { findLatestFulinsCFiles, ingestRecords } from './src/firds.js';

// Resolved relative to this file's own location (not process.cwd()) so the
// pause flag / log file are found correctly regardless of what directory
// invokes the script — matters once this runs unattended from launchd,
// which doesn't necessarily start with the same cwd a manual run would.
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PAUSE_FLAG_PATH = path.join(SCRIPT_DIR, '.firds-seed-paused');
const LOG_DIR = path.join(SCRIPT_DIR, 'logs');
const LOG_PATH = path.join(LOG_DIR, 'firds-seed.log');

function appendRunLog(outcome, detail) {
  mkdirSync(LOG_DIR, { recursive: true });
  const line = `${new Date().toISOString()} | ${outcome} | ${detail}\n`;
  appendFileSync(LOG_PATH, line, 'utf8');
}

const DB_NAME = 'meridian-etf'; // matches wrangler-firds.toml's [[d1_databases]] database_name

const TABLES = [
  'firds_instrument_reference',
  'entity_isin_map',
  'instrument_master',
  'entity_enrichment_queue',
  'entity_master'
];

// ── Minimal D1 client shim over `wrangler d1 execute` ──────────────────
//
// Implements just enough of the Workers D1 binding surface
// (env.DB.prepare(sql).bind(...args), .all(), env.DB.batch([...])) for
// firds.js's findLatestFulinsCFiles/resolveEntitiesForLeis/ingestRecords to
// run completely unmodified in logic — only the transport differs.

function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

// IMPORTANT: `wrangler d1 execute --file` was tried first and rejected —
// live-tested this session and found it routes through a bulk-import path
// that returns only an execution *summary* ("Total queries executed" /
// "Rows read" / "Rows written"), never actual result rows, even for a plain
// SELECT. `--command` (single argv string, no shell involved via
// execFileSync) was verified this session to return real per-statement
// `results` arrays for both single and multi-statement SQL, and to handle
// a 1000-statement / ~330KB command reliably (~1.7s). That's what this uses.
function execWrangler(sqlText, { timeoutMs = 300000, label = 'query' } = {}) {
  try {
    const out = execFileSync(
      'npx',
      ['wrangler', 'd1', 'execute', DB_NAME, '--remote', '--json', '--command', sqlText],
      { maxBuffer: 1024 * 1024 * 64, timeout: timeoutMs, encoding: 'utf8' }
    );
    const jsonStart = out.search(/[[{]/);
    const parsed = JSON.parse(jsonStart >= 0 ? out.slice(jsonStart) : out);
    return parsed;
  } catch (err) {
    throw new Error(`wrangler d1 execute failed (${label}): ${err.message}\nSQL (first 500 chars): ${sqlText.slice(0, 500)}`);
  }
}

class Stmt {
  constructor(sql) { this.sql = sql; this.params = []; }
  bind(...args) { this.params = args; return this; }
  toLiteralSql() {
    let i = 0;
    return this.sql.trim().replace(/\?/g, () => esc(this.params[i++]));
  }
  async all() {
    const parsed = execWrangler(this.toLiteralSql(), { label: 'select' });
    const results = parsed?.[0]?.results ?? [];
    return { results };
  }
}

class D1 {
  prepare(sql) { return new Stmt(sql); }
  async batch(stmts) {
    if (!stmts.length) return [];
    const sqlText = stmts.map(s => s.toLiteralSql()).join('; ') + ';';
    execWrangler(sqlText, { label: `batch of ${stmts.length}` });
    // Real write counts come from the before/after COUNT(*) pass at the end
    // of main(), not from here — see file header re: the meta.changes lesson.
    return stmts.map(() => ({ meta: { changes: 0 } }));
  }
}

const env = { DB: new D1() };

// ── Row-count snapshot ──────────────────────────────────────────────────

async function getCounts() {
  const out = {};
  for (const t of TABLES) {
    const { results } = await env.DB.prepare(`SELECT COUNT(*) as n FROM ${t}`).all();
    out[t] = results[0].n;
  }
  return out;
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== MA-SEP-003: FIRDS local weekly seed ===\n');

  // Pause check MUST be the very first thing — before any network call or
  // D1 write (Spec Requirement 6 / Build Brief "2026-08-21 update v2").
  // A paused run costs nothing: no fetch, no getCounts() D1 read, nothing.
  if (existsSync(PAUSE_FLAG_PATH)) {
    console.log(`Pause flag present at ${PAUSE_FLAG_PATH} — paused, skipping this run.`);
    appendRunLog('paused', 'skipped run — pause flag set, no network/D1 activity');
    return;
  }

  console.log('Taking BEFORE row-count snapshot...');
  const before = await getCounts();
  for (const t of TABLES) console.log(`  ${t}: ${before[t].toLocaleString()}`);

  console.log('\nQuerying ESMA Solr for latest FULINS_C file(s)...');
  const files = await findLatestFulinsCFiles(env);
  console.log(`Found ${files.length} part(s) for publication_date ${files[0].publicationDate}:`);
  for (const f of files) console.log(`  ${f.fileName}`);

  const totals = { recordsFiltered: 0, nonCSkipped: 0, firdsRefWritten: 0, firdsRefRefreshed: 0, entityMasterCreated: 0, isinMapWritten: 0, instrumentWritten: 0 };

  for (const file of files) {
    console.log(`\n--- ${file.fileName} ---`);
    console.log('  Fetching zip...');
    const zipResp = await fetch(file.downloadLink);
    if (!zipResp.ok) throw new Error(`Fetch failed for ${file.fileName}: HTTP ${zipResp.status}`);
    const zipBytes = await zipResp.arrayBuffer();
    console.log(`  Compressed: ${zipBytes.byteLength.toLocaleString()} bytes`);

    const contentLength = zipResp.headers.get('content-length');
    if (contentLength && zipBytes.byteLength !== parseInt(contentLength, 10)) {
      throw new Error(`Truncated fetch for ${file.fileName}: got ${zipBytes.byteLength} bytes, Content-Length said ${contentLength}`);
    }

    console.log('  Decompressing + scanning full file (no chunk/record limit — local run)...');
    const textStream = decompressFirdsZip(zipBytes);
    const result = await scanFirdsChunk(textStream, { startIndex: 0, limit: 1_000_000, maxWallMs: 30 * 60 * 1000 });
    console.log(`  Raw <RefData> records scanned: ${result.nextIndex.toLocaleString()}`);
    console.log(`  Unique-ISIN records extracted: ${result.records.length.toLocaleString()}`);
    console.log(`  Stream fully consumed (done): ${result.done}`);
    console.log(`  publication_date (from file): ${result.publicationDate}`);
    if (!result.done) {
      throw new Error(
        `scanFirdsChunk did not finish ${file.fileName} within the local safety limits ` +
        `(1,000,000 record cap / 30min wall clock) — refusing to trust partial output. ` +
        `Increase the limits in this script and retry rather than proceeding.`
      );
    }

    console.log('  Writing to D1 (large batches via wrangler d1 execute — this is the slow part)...');
    const stats = await ingestRecords(env, result.records, file.publicationDate, file.fileName, {
      // Sized to keep each `wrangler d1 execute --command` argv comfortably
      // under macOS's ~1MB ARG_MAX (live-tested this session: 1000
      // firds_ref-shaped statements ≈ 330KB, ~1.7s) — not the Worker's D1
      // REST bound-parameter ceiling, which doesn't apply to this literal-
      // inlined SQL path. See firds.js's ingestRecords/resolveEntitiesForLeis.
      firdsRef: 1000,
      isinMap: 1500,
      instrumentMaster: 1000,
      entityMaster: 300
    });
    console.log(`  ingestRecords stats:`, stats);

    for (const k of Object.keys(totals)) totals[k] += stats[k] ?? 0;
  }

  console.log('\n=== Ingest pass complete. Taking AFTER row-count snapshot... ===');
  const after = await getCounts();

  console.log('\n=== Results — real before/after COUNT(*) deltas ===');
  console.log('(not self-reported write counts — see file header)\n');
  const deltaParts = [];
  for (const t of TABLES) {
    const delta = after[t] - before[t];
    console.log(`  ${t.padEnd(28)} ${String(before[t]).padStart(8)} -> ${String(after[t]).padStart(8)}   (Δ ${delta >= 0 ? '+' : ''}${delta})`);
    deltaParts.push(`${t}:${delta >= 0 ? '+' : ''}${delta}`);
  }

  // Known Issue 22.8 fix (MA-SEP-007): refresh count doesn't show up in the
  // COUNT(*) deltas above (an UPDATE never changes row count) so it needs its
  // own explicit log line or a fixed LEI-change would silently vanish from the
  // run record the same way the original gap did.
  console.log(`\n  firds_instrument_reference rows refreshed (existing ISIN, changed data): ${totals.firdsRefRefreshed}`);
  appendRunLog('success', deltaParts.join(' ') + ` firds_ref_refreshed:${totals.firdsRefRefreshed}`);
  console.log('\nDone.');
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  console.error(err.stack);
  try {
    appendRunLog('error', err.message.replace(/\n/g, ' ').slice(0, 500));
  } catch (logErr) {
    console.error('(also failed to write run log:', logErr.message, ')');
  }
  process.exit(1);
});
