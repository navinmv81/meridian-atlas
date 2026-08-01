// meridian-entities-figi
// Resolves instrument_master rows lacking an entity mapping via OpenFIGI,
// matching results against EXISTING entity_master rows only — this Worker
// never creates new entity_master rows from OpenFIGI results (approved
// decision, MA-AUG-001 ENG_DIAGNOSTIC, 28 July 2026). On-request only, no
// Cron Trigger by design (Free plan's 5-per-account cron ceiling — see
// MA-AUG-001 ARCH_REVIEW decision).
//
// PREREQUISITE: run migrations/002-instrument-entity-map-openfigi-source.sql
// against production BEFORE the first /run call. instrument_entity_map's
// CHECK constraint must allow 'openfigi_tier1' or every insert here fails.
//
// PREREQUISITE (added 29 July 2026): run App/Ops/migrations/001-ops-schema.sql
// (creates openfigicache, among other Ops tables) BEFORE deploying this
// version. See the FIXED note below for why.
//
// FIXED 29 July 2026 (found via a 40-call batch loop that got stuck): the
// unmapped-instruments query below only excluded instrument_keys that had a
// SUCCESSFUL instrument_entity_map row. It had no way to record "we asked
// OpenFIGI about this one and it didn't resolve" — so once the easy matches
// near the top of the scan were used up, the query permanently returned the
// same ~1000-row window of unresolvable instruments on every subsequent
// call (calls 8-40 of that run: considered 1000, matched 0, every time),
// silently blocking the ~28,000 other unmapped instruments further down
// that had never even been tried. Fixed by writing an openfigicache row for
// EVERY instrument considered (matched or not) and excluding anything
// already cached from the unmapped-instruments query — each instrument is
// now asked about at most once per code version, regardless of outcome.
//
// PREREQUISITE: set the OpenFIGI API key secret before first use:
//   npx wrangler secret put OPENFIGI_API_KEY --config wrangler-entities-figi.toml
//
// READ/WRITE BUDGET (three-point check, MA-AUG-001, 29 July 2026):
// Reads/invocation: one SELECT of up to BATCH_SIZE unmapped instruments
//   (isin path is index-covered via idx_instrument_isin; the cusip-only
//   fallback path is NOT formally indexed — instrument_master only indexes
//   cusip_issuer_6, not full cusip. Low risk today at 54,562 total rows;
//   flag for an index if this table grows meaningfully) + chunked bulk
//   SELECTs on entity_master.normalized_name for matching (100 names/query,
//   well under SQLite's bound-parameter ceiling).
// Writes/invocation: bounded by BATCH_SIZE=1000 instruments per /run call —
//   up to 1000 instrument_entity_map rows (only on a match) PLUS up to 1000
//   openfigicache rows (one per instrument considered, regardless of
//   outcome, added 29 July 2026) — at most ~2000 rows written, still
//   comfortably under the "under 50k per execution" guideline that
//   entities-seed's cron re-enable failed. Batched via env.DB.batch() at
//   WRITE_BATCH_SIZE=100 (up to ~20 batch() calls total). Guarded by the
//   same shared checkWriteBudget()/checkHold() pattern as every other
//   pipeline.
// OpenFIGI calls/invocation: ceil(BATCH_SIZE / OPENFIGI_CHUNK) = 10 POSTs of
//   100 identifiers each, paced 250ms apart — comfortably inside OpenFIGI's
//   25 req/6sec with-key limit.
//
// Response is synchronous (no ctx.waitUntil) — the /run response always
// reflects the real outcome of this invocation, deliberately avoiding the
// "ok:true regardless of what happened" ambiguity that cost several days on
// entities-seed.

import { normalizeName } from './entities-seed.js';

const BATCH_SIZE = 1000;      // instruments considered per /run call
const OPENFIGI_CHUNK = 100;   // identifiers per OpenFIGI POST (with API key)
const WRITE_BATCH_SIZE = 100; // statements per env.DB.batch() call
const OPENFIGI_PACING_MS = 250;
// Confidence is fixed, not yet scored — this Worker matches OpenFIGI's
// returned name against an existing entity_master row by normalized name,
// which is weaker than a hard CUSIP/ISIN join (cusip_tier1/isin_tier1 use
// higher values). Flagging as a starting point, not a modeled score.
const MATCH_CONFIDENCE = 70;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function checkWriteBudget(env) {
  // Shared daily counter with every other pipeline (holdings-pipeline.js,
  // entities-seed.js, entities-enrich.js) — same key format (dashes kept).
  const today = new Date().toISOString().slice(0, 10);
  const key = `writes_today_${today}`;
  const row = await env.DB.prepare(
    `SELECT value FROM holdings_pipeline_state WHERE key = ?`
  ).bind(key).first();
  const writesToday = parseInt(row?.value ?? '0', 10);
  if (writesToday >= 60000) {
    console.log(`[entities-figi] Write budget reached (${writesToday} today). Skipping.`);
    return false;
  }
  return true;
}

async function checkHold(env) {
  const row = await env.DB.prepare(
    `SELECT value FROM holdings_pipeline_state WHERE key = 'hold_all_jobs'`
  ).first();
  return row?.value === 'true';
}

async function runInBatches(env, statements) {
  for (let i = 0; i < statements.length; i += WRITE_BATCH_SIZE) {
    const batch = statements.slice(i, i + WRITE_BATCH_SIZE);
    await env.DB.batch(batch);
  }
}

async function callOpenFigi(jobs, apiKey) {
  const res = await fetch('https://api.openfigi.com/v3/mapping', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'X-OPENFIGI-APIKEY': apiKey } : {})
    },
    body: JSON.stringify(jobs)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenFIGI ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function resolveInstruments(env) {
  const apiKey = env.OPENFIGI_API_KEY || null;

  const unmapped = await env.DB.prepare(`
    SELECT im.instrument_key, im.isin, im.cusip, im.security_name
    FROM instrument_master im
    WHERE NOT EXISTS (
      SELECT 1 FROM instrument_entity_map iem WHERE iem.instrument_key = im.instrument_key
    )
    AND NOT EXISTS (
      SELECT 1 FROM openfigicache ofc WHERE ofc.instrument_key = im.instrument_key
    )
    AND (im.isin IS NOT NULL OR im.cusip IS NOT NULL)
    LIMIT ?
  `).bind(BATCH_SIZE).all();

  const rows = unmapped.results;
  if (rows.length === 0) {
    console.log('[entities-figi] No unmapped instruments with an ISIN/CUSIP remain.');
    return { considered: 0, matched: 0, noOpenFigiMatch: 0, noExistingEntity: 0 };
  }

  const jobs = rows.map(r =>
    r.isin ? { idType: 'ID_ISIN', idValue: r.isin } : { idType: 'ID_CUSIP', idValue: r.cusip }
  );
  const jobChunks = chunk(jobs, OPENFIGI_CHUNK);

  const figiResults = [];
  for (let i = 0; i < jobChunks.length; i++) {
    if (i > 0) await sleep(OPENFIGI_PACING_MS);
    const results = await callOpenFigi(jobChunks[i], apiKey);
    figiResults.push(...results);
  }

  // Collect candidate names, then do ONE bulk entity_master lookup instead
  // of a per-instrument SELECT — same N+1 fix already applied in
  // entities-seed.js, applied here from the start.
  const candidateNames = new Set();
  const perInstrumentName = new Map();
  const perInstrumentFigi = new Map(); // instrument_key -> {figi_name, figi_ticker, has_warning}
  let noOpenFigiMatch = 0;

  for (let i = 0; i < rows.length; i++) {
    const result = figiResults[i];
    const key = rows[i].instrument_key;
    // v3 uses "warning" (not "error") for no-match line items.
    if (!result || result.warning || !Array.isArray(result.data) || result.data.length === 0) {
      noOpenFigiMatch++;
      perInstrumentFigi.set(key, { figi_name: null, figi_ticker: null, has_warning: 1 });
      continue;
    }
    const best = result.data[0];
    const name = best.name || null;
    const ticker = best.ticker || null;
    perInstrumentFigi.set(key, { figi_name: name, figi_ticker: ticker, has_warning: 0 });
    const matchName = name || ticker;
    if (!matchName) { noOpenFigiMatch++; continue; }
    const normalized = normalizeName(matchName);
    candidateNames.add(normalized);
    perInstrumentName.set(key, normalized);
  }

  let entityIdByName = new Map();
  if (candidateNames.size > 0) {
    for (const names of chunk([...candidateNames], 100)) {
      const placeholders = names.map(() => '?').join(',');
      const found = await env.DB.prepare(
        `SELECT entity_id, normalized_name FROM entity_master WHERE normalized_name IN (${placeholders})`
      ).bind(...names).all();
      for (const r of found.results) entityIdByName.set(r.normalized_name, r.entity_id);
    }
  }

  const inserts = [];
  const cacheUpserts = [];
  let matched = 0;
  let noExistingEntity = 0;
  for (const row of rows) {
    const normalized = perInstrumentName.get(row.instrument_key);
    const figi = perInstrumentFigi.get(row.instrument_key) || { figi_name: null, figi_ticker: null, has_warning: 1 };
    const entityId = normalized ? entityIdByName.get(normalized) : null;

    if (entityId) matched++;
    else if (normalized) noExistingEntity++;
    // FIXED 29 July 2026: cache every considered instrument, matched or not —
    // this is what lets the unmapped-instruments query above skip past
    // permanently-unresolvable rows on the next /run instead of re-asking
    // OpenFIGI about them forever. INSERT OR IGNORE — never overwrite a
    // previous check for the same instrument_key.
    cacheUpserts.push(
      env.DB.prepare(`
        INSERT INTO openfigicache (instrument_key, figi_name, figi_ticker, has_warning, normalized_name, matched_entity_id)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(instrument_key) DO NOTHING
      `).bind(row.instrument_key, figi.figi_name, figi.figi_ticker, figi.has_warning, normalized || null, entityId || null)
    );

    if (!normalized || !entityId) continue;
    inserts.push(
      env.DB.prepare(`
        INSERT INTO instrument_entity_map (instrument_key, entity_id, source, confidence)
        VALUES (?, ?, 'openfigi_tier1', ?)
        ON CONFLICT(instrument_key) DO NOTHING
      `).bind(row.instrument_key, entityId, MATCH_CONFIDENCE)
    );
  }

  await runInBatches(env, inserts);
  await runInBatches(env, cacheUpserts);

  const openFigiMatched = rows.length - noOpenFigiMatch;
  console.log(`[entities-figi] Considered ${rows.length} · OpenFIGI matched ${openFigiMatched} · resolved to existing entity ${matched} · no OpenFIGI match ${noOpenFigiMatch} · matched name not in entity_master ${noExistingEntity}`);

  // FIXED 29 July 2026 (first live run feedback): the /run response previously
  // omitted openFigiMatched, so the JSON and the tail log told two slightly
  // different stories for the same run (JSON: matched/noOpenFigiMatch/
  // noExistingEntity; log: also included the raw OpenFigi-hit count). Not a
  // bug — 968 openFigiMatched = 611 matched + 357 noExistingEntity, they
  // reconcile — but the response should surface the same numbers the log
  // does without needing to cross-reference both.
  return { considered: rows.length, openFigiMatched, matched, noOpenFigiMatch, noExistingEntity };
}

export default {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname !== '/run') {
      return new Response('Not found', { status: 404 });
    }
    if (await checkHold(env)) {
      return new Response(JSON.stringify({ ok: false, message: 'Held — hold_all_jobs is set' }), {
        status: 423,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (!(await checkWriteBudget(env))) {
      return new Response(JSON.stringify({ ok: false, message: 'Daily write budget reached' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (!env.OPENFIGI_API_KEY) {
      console.log('[entities-figi] Warning: OPENFIGI_API_KEY not set — calls will run unauthenticated (OpenFIGI docs suggest 5-10 jobs/request without a key, not the 100/request this Worker is sized for). Set it via wrangler secret put before relying on this.');
    }
    try {
      const summary = await resolveInstruments(env);
      return new Response(JSON.stringify({ ok: true, ...summary }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      console.log(`[entities-figi] ERROR: ${err.message}`);
      return new Response(JSON.stringify({ ok: false, error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
