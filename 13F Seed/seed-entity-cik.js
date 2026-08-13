#!/usr/bin/env node
// seed-entity-cik.js
// Resolves SEC CIK for entity_master rows by matching name/ticker against
// SEC's company_tickers_exchange.json, then updates the cik column.
//
// Usage:
//   node seed-entity-cik.js --dry-run
//   node seed-entity-cik.js --limit=50 --dry-run
//   node seed-entity-cik.js

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

// ── D1 config (meridian-etf database — same as seed-managermaster.js) ────────
const ACCOUNT_ID = 'ea36070477560935a68ad9110a2fd40b';
const DB_ID      = '43e80149-5333-4917-b678-6a8218ca4f93';
const TOKEN      = process.env.CF_API_TOKEN;
const API_BASE   = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DB_ID}`;
const BATCH_SIZE = 50;

const SEC_TICKERS_URL = 'https://www.sec.gov/files/company_tickers_exchange.json';
const SEC_USER_AGENT  = 'MeridianAtlas Research navinmv1981@gmail.com';

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; })
);
const DRY_RUN = !!args['dry-run'];
const LIMIT   = args.limit ? parseInt(args.limit, 10) : null;

if (!TOKEN) {
  console.error('ERROR: CF_API_TOKEN is not set. Add it to 13F Seed/.env');
  process.exit(1);
}

// ── Helpers (normalizeName/padCik mirror seed-managermaster.js) ─────────────
function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

// FIXED 2026-07-25: the old normalizeName stripped punctuation BEFORE
// handling two SEC-specific naming quirks, so it silently broke the two
// most common causes of match failure:
//   1. SEC often appends a state-of-incorporation tag like "/DE/", "/MD/",
//      "/NV/" to the company name (e.g. "DANAHER CORP /DE/"). Stripping
//      punctuation first turns "/de/" into a bare "de" token that survives
//      into the final normalized string, so it never matches GLEIF's plain
//      "DANAHER CORPORATION".
//   2. SEC commonly abbreviates corporate suffixes ("CORP" vs GLEIF's
//      "CORPORATION", "INC" vs "INCORPORATED", "CO" vs "COMPANY") — an
//      exact-string compare after case-folding never reconciles those.
// Confirmed empirically against SEC's own company_tickers_exchange.json:
// Danaher's real SEC record is "DANAHER CORP /DE/", CIK 313616 — entity_master
// stores GLEIF's "DANAHER CORPORATION", so the un-fixed function produced
// "danaher corp de" vs "danaher corporation": no match, cik left NULL. Only
// 3,182 of 10,705 operating entities had matched (~30%) before this fix.
// V2 (2026-07-25, same day, second pass): the first fix only handled the
// "/DE/"-style two-letter state tag. Spot-checking 30 real unmatched rows
// after that fix turned up several more distinct patterns GLEIF's name
// field uses that SEC's registry doesn't:
//   - Full jurisdiction names, not just 2-3 letter codes: "NU Holdings
//     Ltd/Cayman Islands", "Schrodinger Inc/United States".
//   - No closing slash at all: "Global Partners Lp/ma".
//   - "The" moved to the END instead of the front: "Trade Desk Inc/The"
//     (SEC: "THE TRADE DESK INC").
//   - HTML entities left un-decoded in the name field itself: "Deere
//     &amp; Co" — naive punctuation-stripping turned this into a spurious
//     "amp" token instead of dropping it.
//   - Punctuation deleted instead of spaced: "Amazon.com Inc" collapsed to
//     "amazoncom" while SEC's own "AMAZON COM INC" normalizes to "amazon
//     com" (two words) — never matched purely because of how the period
//     was handled, unrelated to any suffix issue.
const SLASH_TAG_RE   = /\s*\/[^\/]{1,20}\/?\s*$/;         // trailing "/xxx" or "/xxx/" tag capped at 20 chars — long slash-suffixes are usually an embedded alternate name (e.g. "CHS/COMMUNITY HEALTH SYSTEMS, INC."), not a jurisdiction tag, and stripping those caused a real false-positive collision (see 2026-07-25 dry-run review)
const CORP_SUFFIX_RE = /\b(corporation|corp|incorporated|inc|company|co|limited|ltd|llc|l l c|lp|l p|plc|holdings?|group|na)\.?\s*$/i;
const LEADING_THE_RE = /^the\s+/;

function decodeHtmlEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'");
}

function normalizeName(name) {
  if (!name) return '';
  let n = decodeHtmlEntities(name).toLowerCase().trim();

  // Strip a trailing "/xxx" jurisdiction/qualifier tag in ANY form, BEFORE
  // punctuation stripping, or it degrades into an uncomparable bare word.
  n = n.replace(SLASH_TAG_RE, '').trim();

  // GLEIF sometimes moves a leading "The" to a trailing "/The" tag instead
  // (stripped above) — SEC keeps it at the front, so strip it there too.
  n = n.replace(LEADING_THE_RE, '').trim();

  // Strip common corporate-form suffixes repeatedly (e.g. "X Holdings Inc"
  // -> strip "inc" -> "X Holdings" -> strip "holdings" -> "X"), re-checking
  // for a newly-exposed leading "the" each pass.
  let prev;
  do {
    prev = n;
    n = n.replace(CORP_SUFFIX_RE, '').trim();
    n = n.replace(LEADING_THE_RE, '').trim();
  } while (n !== prev);

  // Replace remaining punctuation with a SPACE, not delete it — "Amazon.com"
  // must become "amazon com" (matching SEC's space-separated form), not
  // "amazoncom" (matching nothing).
  return n
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Aggressive suffix-stripping can reduce a legitimate short brand name (e.g.
// "NU Holdings Ltd" -> "nu") to a very short key with real collision risk
// against an unrelated entity that also normalizes to the same short string.
// Flag these so they get eyeballed before the write, not trusted blindly.
const SHORT_MATCH_THRESHOLD = 4;

function padCik(cik) {
  if (!cik) return null;
  return String(cik).trim().replace(/^0+/, '').padStart(10, '0');
}

// ── D1 ────────────────────────────────────────────────────────────────────────
async function d1Raw(sql) {
  const res = await fetch(`${API_BASE}/raw`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ sql }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(`D1 error: ${JSON.stringify(json.errors)}\nSQL preview: ${sql.slice(0, 300)}`);
  }
  return json;
}

async function d1Select(sql) {
  const json = await d1Raw(sql);
  const { columns, rows } = json.result[0].results;
  return rows.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}

async function runBatches(stmts, label) {
  if (stmts.length === 0) { console.log(`  [${label}] nothing to write`); return; }
  let done = 0;
  const t0 = Date.now();
  for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
    const chunk = stmts.slice(i, i + BATCH_SIZE);
    await d1Raw(chunk.join(';\n'));
    done += chunk.length;
    if (done % 500 === 0 || done === stmts.length) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`  [${label}] ${done}/${stmts.length}  (${elapsed}s elapsed)`);
    }
  }
  console.log(`  [${label}] done — ${stmts.length} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

// ── SEC company_tickers_exchange.json ────────────────────────────────────────
async function fetchSecLookups() {
  const res = await fetch(SEC_TICKERS_URL, {
    headers: { 'User-Agent': SEC_USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`SEC fetch failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  const { fields, data } = json;
  const ciCol = fields.indexOf('cik');
  const nameCol   = fields.indexOf('name');
  const tickerCol = fields.indexOf('ticker');

  const nameMap   = new Map(); // normalized name → padded cik
  const tickerMap = new Map(); // uppercased ticker → padded cik

  for (const row of data) {
    const cik    = padCik(row[ciCol]);
    const name   = row[nameCol];
    const ticker = row[tickerCol];
    if (!cik) continue;

    const normName = normalizeName(name);
    if (normName && !nameMap.has(normName)) nameMap.set(normName, cik);

    if (ticker) {
      const tk = String(ticker).trim().toUpperCase();
      if (tk && !tickerMap.has(tk)) tickerMap.set(tk, cik);
    }
  }

  return { nameMap, tickerMap, totalRows: data.length };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n=== seed-entity-cik  dry-run=${DRY_RUN}  limit=${LIMIT ?? 'none'} ===\n`);

  console.log('Step 1: Fetching SEC company_tickers_exchange.json...');
  const { nameMap, tickerMap, totalRows } = await fetchSecLookups();
  console.log(`  SEC rows: ${totalRows}  |  unique names: ${nameMap.size}  |  unique tickers: ${tickerMap.size}`);

  console.log('\nStep 2: Fetching resolution target list from entity_master...');
  const limitClause = LIMIT ? ` LIMIT ${LIMIT}` : '';
  const targets = await d1Select(
    `SELECT entity_id, name, primary_ticker FROM entity_master ` +
    `WHERE type = 'operating' AND cik IS NULL ORDER BY entity_id${limitClause}`
  );
  console.log(`  Target entities: ${targets.length}`);

  console.log('\nStep 3: Matching...');
  const updates = []; // { entity_id, cik }
  const unmatched = [];
  let nameMatches = 0;
  let tickerMatches = 0;
  const t0 = Date.now();

  for (let i = 0; i < targets.length; i++) {
    const entity = targets[i];
    let cik = nameMap.get(normalizeName(entity.name));
    if (cik) {
      nameMatches++;
    } else if (entity.primary_ticker) {
      cik = tickerMap.get(String(entity.primary_ticker).trim().toUpperCase());
      if (cik) tickerMatches++;
    }

    if (cik) {
      updates.push({ entity_id: entity.entity_id, cik });
    } else {
      unmatched.push(entity.entity_id);
    }

    const processed = i + 1;
    if (processed % 100 === 0 || processed === targets.length) {
      console.log(
        `  [${new Date().toISOString()}] processed=${processed}  ` +
        `matched=${nameMatches + tickerMatches}  unmatched=${unmatched.length}`
      );
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n  Matching complete in ${elapsed}s`);
  console.log(`  Name matches:   ${nameMatches}`);
  console.log(`  Ticker matches: ${tickerMatches}`);
  console.log(`  Total matched:  ${updates.length}`);
  console.log(`  Unmatched:      ${unmatched.length}`);

  // Surface short-normalized-name matches for manual review — these carry
  // the highest false-positive risk from suffix-stripping (see comment on
  // SHORT_MATCH_THRESHOLD above).
  const shortMatches = updates.filter(u => {
    const t = targets.find(x => x.entity_id === u.entity_id);
    return t && normalizeName(t.name).length <= SHORT_MATCH_THRESHOLD;
  });
  if (shortMatches.length > 0) {
    console.log(`\n  ${shortMatches.length} match(es) reduced to a short (<=${SHORT_MATCH_THRESHOLD}-char) normalized name — review before trusting:`);
    for (const u of shortMatches) {
      const t = targets.find(x => x.entity_id === u.entity_id);
      console.log(`    entity_id=${u.entity_id}  name=${JSON.stringify(t.name)}  normalized=${JSON.stringify(normalizeName(t.name))}  cik=${u.cik}`);
    }
  }

  if (DRY_RUN) {
    console.log('\n--- DRY RUN: no writes to D1 ---');
    return;
  }

  console.log('\nStep 4: Writing cik updates...');
  const stmts = updates.map(u =>
    `UPDATE entity_master SET cik = ${esc(u.cik)} WHERE entity_id = ${u.entity_id}`
  );
  await runBatches(stmts, 'UPDATE entity_master.cik');

  console.log('\n=== seed-entity-cik complete ===');
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
