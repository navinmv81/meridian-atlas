// meridian-firds — ESMA FIRDS European fund/ETF reference data (MA-SEP-003)
//
// Fetches the current week's FULINS_C (CFI category C — Collective Investment
// Vehicles) file from ESMA FIRDS, parses it, and upserts into
// firds_instrument_reference. Links resolvable ISINs into the existing
// entity/instrument graph — entity_isin_map, instrument_master,
// entity_master — reusing those bridges exactly as-is, no new resolver.
//
// CHUNKED/RESUMABLE BY DESIGN, not as a fallback: a 2026-08-19 diagnostic
// session found the real FULINS_C file is ~86.6MiB uncompressed / 150,558
// records / 18,353 unique ISINs — too large for a single Worker invocation
// (close to the 128MB isolate memory ceiling, and ~1,800-2,600 D1 batch
// calls at the project's ~7-10 rows/call ceiling). See firds-parse.js for
// the streaming ZIP+XML reader and claude/MA-SEP-003_Spec.md for the full
// diagnostic writeup.
//
// CRON: not enabled. Per the Build Brief's New Prerequisite section, no cron
// change (for this Worker or entities-enrich) happens until the account's
// plan tier and entities-enrich's real observed subrequest counts are
// confirmed safe. Until then this Worker is invoked manually via /run, same
// diagnostic-testing pattern as the other Workers in this codebase.
//
// PROGRESS STATE: tracked in this Worker's own FIRDS_PROGRESS KV namespace,
// not a new D1 table (the Build Brief's "Do not do" section caps schema
// changes at the single firds_instrument_reference table) and not
// holdings_pipeline_state (ETF-domain, off-limits to this packet under any
// circumstance). One consequence: unlike entities-seed.js/entities-enrich.js,
// this Worker does NOT participate in the shared cross-Worker
// holdings_pipeline_state daily-write-budget guard — it relies on bounded
// per-invocation batch sizes instead. Flagged as a deliberate trade-off, not
// an oversight — see Required Outputs in the Build Brief.
//
// WRITE PATTERN: always INSERT OR IGNORE / ON CONFLICT DO NOTHING, batched
// via db.batch(), batch sizes sized to the D1 REST ~100-bound-parameter
// ceiling (13F-build precedent) for each table's column count. Never a
// per-row loop.

import { normalizeName } from './entities-seed.js';
import { decompressFirdsZip, scanFirdsChunk } from './firds-parse.js';

const ESMA_SOLR_BASE = 'https://registers.esma.europa.eu/solr/esma_registers_firds_files/select';

// Records processed (field-extracted + written) per invocation. This is the
// real tuning knob for staying under Workers CPU-time limits — start
// conservative and adjust based on observed /run behavior (see Build
// Brief's Required Outputs for where the calibrated figure gets recorded).
const RECORD_CHUNK_SIZE = 500;

// D1 REST caps requests at ~100 bound parameters; batch sizes below are
// sized per-table to stay safely under that (13F-build precedent, same
// ceiling entities-seed.js/entities-enrich.js already respect).
const BATCH_FIRDS_REF = 9;        // 10 params/row (isin..source_file)
const BATCH_ENTITY_MASTER = 15;   // 4 params/row (name, normalized_name, type, lei)
const BATCH_ISIN_MAP = 15;        // 5 params/row
const BATCH_INSTRUMENT_MASTER = 9; // 9 params/row

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ── KV progress state ───────────────────────────────────────────────────

async function getState(env) {
  const raw = await env.FIRDS_PROGRESS.get('firds:state', 'json');
  return raw || {
    status: 'complete', // no run in progress -> next /run starts a fresh cycle
    currentFile: null,
    pendingFiles: [],
    nextIndex: 0,
    publicationDate: null,
    stats: { invocations: 0, records_scanned: 0, firds_ref_written: 0, entity_master_created: 0, entity_isin_map_written: 0, instrument_master_written: 0 }
  };
}

async function putState(env, state) {
  await env.FIRDS_PROGRESS.put('firds:state', JSON.stringify(state));
}

async function checkHold(env) {
  const v = await env.FIRDS_PROGRESS.get('firds:hold');
  return v === 'true';
}

// ── ESMA Solr file discovery ────────────────────────────────────────────

export async function findLatestFulinsCFiles(env) {
  const latestUrl = `${ESMA_SOLR_BASE}?q=file_name:FULINS_C_*&sort=publication_date+desc&rows=1&wt=json`;
  const latestResp = await fetch(latestUrl);
  if (!latestResp.ok) throw new Error(`ESMA Solr latest-date query failed: HTTP ${latestResp.status}`);
  const latestData = await latestResp.json();
  const latestDoc = latestData.response?.docs?.[0];
  if (!latestDoc) throw new Error('ESMA Solr returned no FULINS_C files');

  const pubDate = latestDoc.publication_date.slice(0, 10); // "2026-08-15T00:00:00Z" -> "2026-08-15"
  const partsUrl = `${ESMA_SOLR_BASE}?q=file_name:FULINS_C_${pubDate.replace(/-/g, '')}_*&sort=file_name+asc&rows=20&wt=json`;
  const partsResp = await fetch(partsUrl);
  if (!partsResp.ok) throw new Error(`ESMA Solr parts query failed: HTTP ${partsResp.status}`);
  const partsData = await partsResp.json();
  const docs = partsData.response?.docs ?? [];
  if (!docs.length) throw new Error(`ESMA Solr returned no parts for publication_date ${pubDate}`);

  return docs.map(d => ({ fileName: d.file_name, downloadLink: d.download_link, publicationDate: pubDate }));
}

// ── Entity linkage ──────────────────────────────────────────────────────
//
// FIRDS gives us the issuer LEI directly (no need to search for it via
// GLEIF the way entities-enrich.js's Phase 2 does — that's a different
// problem, finding an unknown LEI). What this Worker needs is the reverse:
// given a known LEI, find or create the entity_master row.

// D1's real bound-parameter ceiling bit an unbatched `WHERE lei IN (...)`
// lookup during first live testing (500-record chunk -> 300+ unique LEIs in
// one query -> "too many SQL variables at offset 255"). Batched like every
// other multi-row query in this file, same BATCH_ENTITY_MASTER chunk size.
async function selectEntityIdsByLei(env, leis, batchSize = BATCH_ENTITY_MASTER) {
  const leiToEntityId = new Map();
  for (const batch of chunkArray(leis, batchSize)) {
    const placeholders = batch.map(() => '?').join(',');
    const rows = await env.DB.prepare(
      `SELECT entity_id, lei FROM entity_master WHERE lei IN (${placeholders})`
    ).bind(...batch).all();
    for (const r of rows.results) leiToEntityId.set(r.lei, r.entity_id);
  }
  return leiToEntityId;
}

// batchSize override exists so Phase 1's local seed script (called directly,
// outside a Worker, with no D1-REST bound-parameter ceiling to respect since
// it writes via literal-inlined SQL rather than the bound `.bind()` path) can
// use much larger chunks and finish in a reasonable number of round trips.
// Default is unchanged from the original single-constant behavior, so the
// Worker path (this file's own processOneChunk -> ingestRecords call) is
// unaffected.
export async function resolveEntitiesForLeis(env, leis, batchSize = BATCH_ENTITY_MASTER) {
  const uniqueLeis = [...new Set(leis.filter(Boolean))];
  if (!uniqueLeis.length) return { leiToEntityId: new Map(), created: 0 };

  const leiToEntityId = await selectEntityIdsByLei(env, uniqueLeis, batchSize);
  const missingLeis = uniqueLeis.filter(l => !leiToEntityId.has(l));

  let created = 0;
  if (missingLeis.length) {
    // Per project decision (2026-08-20): create with the raw LEI as a
    // placeholder name — same fallback the codebase already uses for
    // GLEIF-discovered parent entities with no name in the API response
    // (entities-enrich.js runPhase3, `parentName ?? parentLei`). Phase 3
    // will pick these up next run (lei_status IS NULL) and hydrate
    // lei_status/country, but nothing currently overwrites `name` after
    // creation — the LEI stays as the display name until a future packet
    // closes that gap. Flagged, not silently accepted.
    //
    // MA-SEP-003 Phase 1 (2026-08-21): confirmed with the Founder that this
    // is the intended behavior for FIRDS-sourced LEIs specifically — FIRDS
    // is a regulatory-submission source, so an LEI it publishes is treated
    // as legitimate and resolvable on sight, not routed through
    // entity_enrichment_queue's GLEIF-name-search path (which exists for
    // the different problem of an *unknown* LEI). Direct entity_master
    // creation here is deliberate, not a gap to fix.
    const insertStmts = missingLeis.map(lei => {
      const norm = normalizeName(lei);
      return env.DB.prepare(`
        INSERT INTO entity_master (name, normalized_name, type, lei)
        VALUES (?, ?, 'holding', ?)
        ON CONFLICT(normalized_name, type) DO UPDATE SET lei = excluded.lei, updated_at = CURRENT_TIMESTAMP
      `).bind(lei, norm, lei);
    });
    for (const batch of chunkArray(insertStmts, batchSize)) {
      const results = await env.DB.batch(batch);
      created += results.reduce((s, r) => s + (r?.meta?.changes || 0), 0);
    }

    const newlyExisting = await selectEntityIdsByLei(env, missingLeis, batchSize);
    for (const [lei, entityId] of newlyExisting) leiToEntityId.set(lei, entityId);
  }

  return { leiToEntityId, created };
}

// ── Filter + write pass ─────────────────────────────────────────────────
//
// Extracted from processOneChunk (2026-08-21, MA-SEP-003 Phase 1) so the
// local one-time seed script can call the exact same CFI-C filter / ISIN
// dedup / entity-linkage / write logic directly, without going through the
// Worker's chunked/resumable loop. The Worker's own processOneChunk below
// calls this with default batch sizes (unchanged behavior); the local
// script passes larger batchSizes for firds_ref/isin_map/instrument_master
// (see firds-local-seed.mjs) since it isn't bound by the D1 REST ~100
// bound-parameter ceiling that sized the Worker-context defaults.
export async function ingestRecords(env, rawRecords, publicationDate, sourceFile, batchSizes = {}) {
  const {
    firdsRef = BATCH_FIRDS_REF,
    entityMaster = BATCH_ENTITY_MASTER,
    isinMap = BATCH_ISIN_MAP,
    instrumentMaster = BATCH_INSTRUMENT_MASTER
  } = batchSizes;

  // Sanity check: this file should be 100% CFI category C. Log (don't
  // silently drop data-quality surprises) if that ever stops being true.
  const nonC = rawRecords.filter(r => !r.cfi || r.cfi[0] !== 'C');
  if (nonC.length) {
    console.error(`[meridian-firds] WARNING: ${nonC.length} of ${rawRecords.length} records in this pass have non-C CFI codes — investigate before trusting this run's output.`);
  }
  const records = rawRecords.filter(r => r.cfi && r.cfi[0] === 'C' && r.isin && r.isin.length === 12);

  // 1) firds_instrument_reference
  const refStmts = records.map(r => env.DB.prepare(`
    INSERT OR IGNORE INTO firds_instrument_reference
      (isin, lei, cfi_code, full_name, short_name, notional_currency, trading_venue_mic, first_trade_date, publication_date, source_file)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(r.isin, r.lei, r.cfi, r.fullName, r.shortName, r.currency, r.mic, r.firstTradeDate, publicationDate, sourceFile));
  let firdsRefWritten = 0;
  for (const batch of chunkArray(refStmts, firdsRef)) {
    const results = await env.DB.batch(batch);
    firdsRefWritten += results.reduce((s, r) => s + (r?.meta?.changes || 0), 0);
  }

  // 1b) firds_instrument_reference refresh pass — Known Issue 22.8 fix (MA-SEP-007,
  // 2026-08-28). INSERT OR IGNORE above is a no-op for any ISIN already on file, so an
  // issuer LEI change (or any other field change) between weekly files was never applied
  // to the existing row — only entity_isin_map got a *new* row for the new LEI, producing
  // a second live mapping for the same ISIN. See MA-SEP-003_Spec.md's "Retention" section,
  // which specced exactly this refresh path but never had it built (confirmed missing
  // 2026-08-22 when the 2026-08-15/2026-08-22 file pair produced this symptom for 3 real
  // ISINs — US77926X2962, US92189L1035, US92647X7562).
  //
  // Deliberately compares the row's own stored publication_date to the incoming
  // publication_date — NOT last_updated_at, as the Spec's prose literally said.
  // last_updated_at is a full 'YYYY-MM-DD HH:MM:SS' timestamp and publication_date is a
  // bare 'YYYY-MM-DD' date; SQLite text comparison treats a same-day date string as "less
  // than" its own timestamp extension, so `last_updated_at < publication_date` as literally
  // specced would evaluate on a type mismatch, not the intended condition. publication_date
  // vs publication_date is apples-to-apples and directly answers "does this row reflect an
  // older FIRDS file than the one being ingested right now?" INSERT OR IGNORE above already
  // guarantees the row exists before this UPDATE runs. Does not touch first_seen_at, so
  // history is preserved exactly as the Spec intended.
  //
  // Content-diff guard added 2026-08-29, after this fix's first live-test (run against the
  // real 2026-08-29 FULINS_C file, 18,404 records) surfaced a real problem with the
  // publication_date-only WHERE above: it rewrote 18,371 of 18,404 rows — virtually the
  // entire previously-seen table — because publication_date always advances week over week
  // regardless of whether any instrument's actual reference data changed. That's "touch
  // every previously-seen row every week," not "refresh only stale rows" — the distinction
  // the original Known Issue 22.8 symptom (a silently-unapplied LEI change) actually needed.
  // Added an explicit content-diff clause so the UPDATE only fires when at least one tracked
  // field genuinely differs from what's stored; publication_date/source_file/last_updated_at
  // (the "last confirmed in" columns, per their own schema comment) still only advance on a
  // real change. Uses IS NOT rather than != so nullable fields (trading_venue_mic,
  // first_trade_date) compare correctly — != against NULL is neither true nor false in
  // SQLite and would silently skip rows where only a NULL-valued field changed.
  const refreshStmts = records.map(r => env.DB.prepare(`
    UPDATE firds_instrument_reference
    SET lei = ?, cfi_code = ?, full_name = ?, short_name = ?, notional_currency = ?,
        trading_venue_mic = ?, first_trade_date = ?, publication_date = ?, source_file = ?,
        last_updated_at = datetime('now')
    WHERE isin = ?
      AND publication_date < ?
      AND (lei IS NOT ? OR cfi_code IS NOT ? OR full_name IS NOT ? OR short_name IS NOT ?
           OR notional_currency IS NOT ? OR trading_venue_mic IS NOT ? OR first_trade_date IS NOT ?)
  `).bind(
    r.lei, r.cfi, r.fullName, r.shortName, r.currency, r.mic, r.firstTradeDate, publicationDate, sourceFile,
    r.isin, publicationDate,
    r.lei, r.cfi, r.fullName, r.shortName, r.currency, r.mic, r.firstTradeDate
  ));
  // Real refresh count, take 2 — meta.changes is not trustworthy here (this project's own
  // "meta.changes lesson"; see the local-seed script's D1 shim, which always returns
  // changes:0 by design). The first fix (this same spot, commit a994844) counted rows
  // matching this run's source_file + publication_date + first_seen_at != last_updated_at
  // — live-tested 2026-08-29 and found broken in a new way: source_file/publication_date
  // identify a *file*, not a *run*, so re-processing an already-ingested file (a no-op,
  // correctly 0 real writes) still echoed that file's full historical refresh count
  // (18,371) forever, because those columns' values persist unchanged from whichever past
  // run actually wrote them. Fixed by scoping to an actual run boundary instead: capture
  // D1's own clock (not the local machine's — avoids any clock-skew risk between this
  // script's host and Cloudflare's edge) immediately before the UPDATE pass runs, then
  // count only rows whose last_updated_at is at or after that marker. first_seen_at !=
  // last_updated_at still excludes fresh INSERTs (see the reasoning above — INSERT-created
  // and UPDATE-refreshed rows are mutually exclusive within one ingest call, since the
  // UPDATE's own WHERE requires publication_date < the incoming value). Re-running the same
  // file now correctly reports 0 refreshed, because nothing gets a new last_updated_at when
  // nothing actually changed.
  const { results: nowResults } = await env.DB.prepare(`SELECT datetime('now') as now`).all();
  const refreshRunStartedAt = nowResults?.[0]?.now;

  for (const batch of chunkArray(refreshStmts, firdsRef)) {
    await env.DB.batch(batch);
  }

  const { results: refreshCountResults } = await env.DB.prepare(`
    SELECT COUNT(*) as n FROM firds_instrument_reference
    WHERE last_updated_at >= ? AND first_seen_at != last_updated_at
  `).bind(refreshRunStartedAt).all();
  const firdsRefRefreshed = refreshCountResults?.[0]?.n ?? 0;

  // 2) Entity linkage — resolve/create entity_master rows for issuer LEIs
  const { leiToEntityId, created: entityMasterCreated } = await resolveEntitiesForLeis(env, records.map(r => r.lei), entityMaster);

  // 3) entity_isin_map — only for records with a resolvable LEI
  const isinMapStmts = records
    .filter(r => r.lei && leiToEntityId.has(r.lei))
    .map(r => env.DB.prepare(`
      INSERT OR IGNORE INTO entity_isin_map (isin, lei, entity_id, match_source, confidence)
      VALUES (?, ?, ?, 'firds_direct', 100)
    `).bind(r.isin, r.lei, leiToEntityId.get(r.lei)));
  let isinMapWritten = 0;
  for (const batch of chunkArray(isinMapStmts, isinMap)) {
    const results = await env.DB.batch(batch);
    isinMapWritten += results.reduce((s, r) => s + (r?.meta?.changes || 0), 0);
  }

  // 4) instrument_master — instrument_key = ISIN directly (same
  // ISIN-fallback rule as deriveInstrumentKey() in
  // task_6a_instrument_normalization.mjs: a 12-char ISIN is used as the key
  // as-is, no prefix). asset_cat intentionally left NULL — the existing
  // values (DBT/EC/ABS-MBS/...) are an N-PORT vocabulary that has no
  // "collective investment vehicle" code; forcing a fit would misclassify
  // these rows rather than just leaving the field honestly unset.
  const instrStmts = records.map(r => env.DB.prepare(`
    INSERT OR IGNORE INTO instrument_master
      (instrument_key, security_name, security_ticker, isin, cusip, cusip_issuer_6, asset_cat, country, first_seen_date)
    VALUES (?, ?, NULL, ?, NULL, NULL, NULL, NULL, ?)
  `).bind(r.isin, r.fullName ?? r.shortName ?? r.isin, r.isin, r.firstTradeDate ?? publicationDate));
  let instrumentWritten = 0;
  for (const batch of chunkArray(instrStmts, instrumentMaster)) {
    const results = await env.DB.batch(batch);
    instrumentWritten += results.reduce((s, r) => s + (r?.meta?.changes || 0), 0);
  }

  return {
    recordsFiltered: records.length,
    nonCSkipped: nonC.length,
    firdsRefWritten,
    firdsRefRefreshed,
    entityMasterCreated,
    isinMapWritten,
    instrumentWritten
  };
}

// ── Main chunk-processing pass ──────────────────────────────────────────

async function processOneChunk(env) {
  let state = await getState(env);

  if (state.status === 'complete' || !state.currentFile) {
    const files = await findLatestFulinsCFiles(env);
    state = {
      status: 'in_progress',
      currentFile: files[0].fileName,
      currentFileUrl: files[0].downloadLink,
      pendingFiles: files.slice(1).map(f => ({ fileName: f.fileName, downloadLink: f.downloadLink })),
      nextIndex: 0,
      publicationDate: files[0].publicationDate,
      stats: state.stats ?? { invocations: 0, records_scanned: 0, firds_ref_written: 0, entity_master_created: 0, entity_isin_map_written: 0, instrument_master_written: 0 }
    };
    console.log(`[meridian-firds] Starting new cycle: ${state.currentFile} (+${state.pendingFiles.length} more parts)`);
  }

  const zipResp = await fetch(state.currentFileUrl);
  if (!zipResp.ok) throw new Error(`Fetch failed for ${state.currentFile}: HTTP ${zipResp.status}`);
  const zipBytes = await zipResp.arrayBuffer(); // ~3.6MB compressed for the real file — cheap to buffer whole; lets us read the real Central Directory (see firds-parse.js)

  // Hard integrity check: a 2026-08-20 live test hit one anomalous run where
  // scanFirdsChunk() reported `done` after only ~12% of the file's true
  // record count — not reproduced across 6 immediate follow-up runs, so most
  // likely a one-off truncated fetch rather than a logic bug, but a
  // truncated fetch that silently marks a file "complete" having ingested a
  // fraction of it would be a real, hard-to-notice data-loss bug. Fail loud
  // instead — caller can just retry the /run.
  const contentLength = zipResp.headers.get('content-length');
  if (contentLength && zipBytes.byteLength !== parseInt(contentLength, 10)) {
    throw new Error(`Truncated fetch for ${state.currentFile}: got ${zipBytes.byteLength} bytes, Content-Length said ${contentLength}`);
  }

  const textStream = decompressFirdsZip(zipBytes);
  const result = await scanFirdsChunk(textStream, { startIndex: state.nextIndex, limit: RECORD_CHUNK_SIZE });

  const publicationDate = state.publicationDate || result.publicationDate;
  const sourceFile = state.currentFile;

  const { firdsRefWritten, entityMasterCreated, isinMapWritten, instrumentWritten, recordsFiltered } =
    await ingestRecords(env, result.records, publicationDate, sourceFile);

  // ── Advance / persist state ─────────────────────────────────────────
  state.nextIndex = result.nextIndex;
  state.publicationDate = publicationDate;
  state.stats.invocations += 1;
  state.stats.records_scanned = result.nextIndex;
  state.stats.firds_ref_written += firdsRefWritten;
  state.stats.entity_master_created += entityMasterCreated;
  state.stats.entity_isin_map_written += isinMapWritten;
  state.stats.instrument_master_written += instrumentWritten;

  let fileComplete = result.done;
  if (fileComplete) {
    if (state.pendingFiles.length) {
      const next = state.pendingFiles[0];
      state.currentFile = next.fileName;
      state.currentFileUrl = next.downloadLink;
      state.pendingFiles = state.pendingFiles.slice(1);
      state.nextIndex = 0;
      state.status = 'in_progress';
    } else {
      state.status = 'complete';
    }
  }

  await putState(env, state);

  return {
    file: sourceFile,
    chunkRecordsExtracted: recordsFiltered,
    fileComplete,
    overallStatus: state.status,
    firdsRefWritten,
    entityMasterCreated,
    isinMapWritten,
    instrumentWritten,
    cumulativeStats: state.stats
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname !== '/run') {
      return new Response('Not found', { status: 404 });
    }
    if (await checkHold(env)) {
      return new Response(JSON.stringify({ ok: false, message: 'firds:hold is active' }), {
        status: 423,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    try {
      const result = await processOneChunk(env);
      return new Response(JSON.stringify({ ok: true, ...result }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      console.error('[meridian-firds] /run error:', err.message, err.stack);
      return new Response(JSON.stringify({ ok: false, error: err.message }, null, 2), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // No scheduled() handler yet — cron is not enabled for this Worker (see
  // file header). Add scheduled() (delegating to processOneChunk, same as
  // fetch()'s /run path) once the Build Brief's New Prerequisite section
  // clears and wrangler-firds.toml's [triggers] block is uncommented.
};
