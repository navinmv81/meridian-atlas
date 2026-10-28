// meridian-entities-api
// Serves all Corporate Atlas API endpoints.
// All routes read pre-computed tables only — no raw fund_holdings_monthly joins at request time.

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  // MA-OCT-003 R-4: every route left is a GET (/api/entities/*, MA-OCT-007 /api/instruments/*). The write
  // methods and the two extra request headers allowed before served only the retired exception surfaces.
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

function err(msg, status = 400) {
  return json({ error: msg }, status);
}

// GET /api/entities/search?q=
async function handleSearch(env, url) {
  const q = url.searchParams.get('q') ?? '';
  if (q.length < 2) return json({ results: [] });

  const rows = await env.DB.prepare(`
    SELECT
      entity_id,
      name,
      type,
      lei,
      country,
      entity_status,
      hq_city,
      hq_country,
      primary_ticker,
      isin_match_count,
      legal_name,
      gleif_last_updated,
      normalized_name
    FROM entity_master
    WHERE normalized_name LIKE '%' || UPPER(?) || '%'
       OR UPPER(name) LIKE '%' || UPPER(?) || '%'
    ORDER BY
      CASE WHEN type = 'operating' THEN 0 ELSE 1 END,
      isin_match_count DESC,
      etf_holding_count DESC
    LIMIT 20
  `).bind(q, q).all();

  return json({ results: rows.results });
}

// GET /api/entities/:id/graph
async function handleGraph(env, entityId) {
  const id = parseInt(entityId, 10);
  if (!Number.isInteger(id) || id <= 0) return err('Invalid entity_id', 400);

  const entity = await env.DB.prepare(
    `SELECT entity_id, name, type, lei, lei_status, country FROM entity_master WHERE entity_id = ?`
  ).bind(id).first();
  if (!entity) return err('Entity not found', 404);

  // Latest report month for this entity (as issuer or holder)
  const monthRow = await env.DB.prepare(`
    SELECT report_month FROM entity_exposure_monthly
    WHERE entity_id = ? OR holder_entity_id = ?
    ORDER BY report_month DESC
    LIMIT 1
  `).bind(id, id).first();
  const latestMonth = monthRow?.report_month ?? null;

  // Parents
  const parents = await env.DB.prepare(`
    SELECT er.relationship_type, em.entity_id, em.name, em.type, em.lei, em.country
    FROM entity_relationships er
    JOIN entity_master em ON em.entity_id = er.parent_entity_id
    WHERE er.child_entity_id = ?
  `).bind(id).all();

  // Children — MA-SEP-004: added ORDER BY (was previously unordered, so the
  // old LIMIT 20 returned an arbitrary 20, not a meaningful top 20).
  // legal_parent (Subsidiaries) sorts first and alphabetically — no
  // "importance" signal exists for subsidiaries, per Spec Requirement 4.
  // fund_manager (Managed Funds) sorts by etf_holding_count DESC — confirmed
  // live (2026-08-22) to be the meaningfully-populated/varying importance
  // column on entity_master for fund-type entities (isin_match_count was
  // checked too but is low-variance by comparison).
  //
  // LIMIT bumped 20 -> 200 in the same change: real fan-out for
  // BlackRock/iShares Trust (entity_id 273) is 96 fund_manager children,
  // already exceeding the old LIMIT 20 today — the frontend's own
  // per-group display cap (MA-SEP-004, ma-entities.js) needs the TRUE
  // total to show an accurate "+N more", which is impossible if this query
  // silently truncates below that first. 200 is comfortable headroom above
  // the highest real count found (96) while staying a trivial single
  // indexed-lookup read (see MA-SEP-004 three-point check). Not a "shape"
  // change — same columns returned, just a larger, ordered row count.
  const children = await env.DB.prepare(`
    SELECT er.relationship_type, em.entity_id, em.name, em.type, em.lei, em.country
    FROM entity_relationships er
    JOIN entity_master em ON em.entity_id = er.child_entity_id
    WHERE er.parent_entity_id = ?
    ORDER BY
      CASE er.relationship_type WHEN 'legal_parent' THEN 0 ELSE 1 END,
      CASE WHEN er.relationship_type = 'legal_parent' THEN em.name END ASC,
      CASE WHEN er.relationship_type = 'fund_manager' THEN em.etf_holding_count END DESC
    LIMIT 200
  `).bind(id).all();

  // South arc: top holders (if operating/government/holding) or top holdings (if fund)
  let southArc = [];
  if (['operating', 'government', 'holding'].includes(entity.type) && latestMonth) {
    const holders = await env.DB.prepare(`
      SELECT em.entity_id, em.name, em.type, exp.weight_sum
      FROM entity_exposure_monthly exp
      JOIN entity_master em ON em.entity_id = exp.holder_entity_id
      WHERE exp.entity_id = ? AND exp.report_month = ?
      ORDER BY exp.weight_sum DESC
      LIMIT 15
    `).bind(id, latestMonth).all();
    southArc = holders.results;
  } else if (entity.type === 'fund' && latestMonth) {
    const holdings = await env.DB.prepare(`
      SELECT em.entity_id, em.name, em.type, exp.weight_sum
      FROM entity_exposure_monthly exp
      JOIN entity_master em ON em.entity_id = exp.entity_id
      WHERE exp.holder_entity_id = ? AND exp.report_month = ?
      ORDER BY exp.weight_sum DESC
      LIMIT 15
    `).bind(id, latestMonth).all();
    southArc = holdings.results;
  }

  // Coverage stats for fund type
  let coverage = null;
  if (entity.type === 'fund' && latestMonth) {
    coverage = await env.DB.prepare(`
      SELECT total_weight, mapped_weight,
             ROUND(100.0 * mapped_weight / NULLIF(total_weight, 0), 1) AS coverage_pct
      FROM fund_exposure_coverage
      WHERE holder_entity_id = ? AND report_month = ?
    `).bind(id, latestMonth).first();
  }

  return json({
    entity,
    latest_month: latestMonth,
    parents: parents.results,
    children: children.results,
    holdings: entity.type === 'fund' ? southArc : [],
    holders:  entity.type !== 'fund' ? southArc : [],
    coverage: coverage ?? null,
  });
}

// GET /api/entities/:id
// MA-OCT-007 R3 (spec rev 1.4 §6.2–§6.3): a PK miss follows entity_merge_redirect
// (≤ 3 hops, cycle guard; missing table = no redirect row). The body keeps its
// existing shape plus a top-level `redirect` (null on a direct hit, 0 extra reads).
async function handleEntity(env, entityId) {
  const id = parseInt(entityId, 10);
  if (!Number.isInteger(id) || id <= 0) return err('Invalid entity_id', 400);

  let payload = await loadEntityPayload(env, id);
  if (payload) return json({ ...payload, redirect: null });

  const r = await navFollowRedirect(env, id);
  if (r.state !== 'resolved') return navUnresolvedResponse(id, r);
  payload = await loadEntityPayload(env, r.resolvedId);
  if (!payload) return navUnresolvedResponse(id, { state: 'gone', chain: r.redirect.chain });
  return json({ ...payload, redirect: r.redirect });
}

async function loadEntityPayload(env, id) {
  const entity = await env.DB.prepare(`
    SELECT
      entity_id,
      name,
      type,
      lei,
      lei_status,
      country,
      normalized_name,
      legal_name,
      other_names,
      entity_category,
      entity_status,
      expiration_date,
      expiration_reason,
      legal_address_line1,
      legal_address_city,
      legal_address_region,
      legal_address_country,
      legal_address_postcode,
      hq_city,
      hq_country,
      legal_jurisdiction,
      legal_form_code,
      legal_form_text,
      business_register_id,
      registration_authority,
      lei_registration_status,
      lei_initial_registration,
      lei_last_updated,
      lei_next_renewal,
      lei_validation_source,
      gleif_last_updated,
      gleif_enrichment_version,
      isin_match_count,
      match_source,
      has_etf_holdings,
      etf_holding_count,
      primary_ticker,
      direct_parent_lei,
      direct_parent_name,
      direct_parent_exception,
      ultimate_parent_lei,
      ultimate_parent_name,
      ultimate_parent_exception,
      created_at,
      updated_at
    FROM entity_master
    WHERE entity_id = ?
  `).bind(id).first();

  if (!entity) return null;

  // Fund-type only: resolve fund_manager from entity_relationships
  let fund_manager = undefined;
  if (entity.type === 'fund') {
    const mgr = await env.DB.prepare(`
      SELECT em.entity_id, em.name, em.lei
      FROM entity_relationships er
      JOIN entity_master em ON er.parent_entity_id = em.entity_id
      WHERE er.child_entity_id = ?
        AND er.relationship_type = 'fund_manager'
      LIMIT 1
    `).bind(id).first();
    fund_manager = mgr ? { entity_id: mgr.entity_id, name: mgr.name, lei: mgr.lei ?? null } : null;
  }

  // MA-SEP-014 (Known Issue 22.25 part 2): FIRDS directory-tier detection.
  // firds.js's ingestRecords() is the ONLY writer that stamps
  // entity_isin_map.match_source = 'firds_direct' (confirmed live —
  // gleif-seed.js/isin-backfill.js both write 'isin_direct' instead) so
  // that value alone is a reliable, exclusive origin marker — no new
  // column needed. Joined to firds_instrument_reference (PK'd on isin, so
  // this is a single indexed lookup, same indexes MA-SEP-003 already
  // created) for the "as of {date}" timestamp; a directory-tier fund can
  // carry more than one FIRDS-sourced ISIN (e.g. accumulating/distributing
  // share classes), so this takes the most recent publication_date rather
  // than an arbitrary row.
  const firdsRow = await env.DB.prepare(`
    SELECT MAX(fir.publication_date) AS as_of
    FROM entity_isin_map eim
    JOIN firds_instrument_reference fir ON fir.isin = eim.isin
    WHERE eim.entity_id = ? AND eim.match_source = 'firds_direct'
  `).bind(id).first();
  const firds_directory_tier = !!firdsRow?.as_of;

  return {
    entity: {
      ...entity,
      ...(entity.type === 'fund' ? { fund_manager } : {}),
      firds_directory_tier,
      firds_as_of: firdsRow?.as_of ?? null,
    }
  };
}

// GET /api/entities/:id/etf-exposure
// Scoped to the latest report_month for this entity — same cross-section the
// issuer-panels overlap query (below) uses for its etf_count. Without this
// filter the query returned one row per (fund, month) it had ever appeared
// in, so a fund held across multiple N-PORT periods was counted more than
// once and inflated the "N ETFs hold this entity" total past the overlap
// panel's distinct count for the same entity.
async function handleEtfExposure(env, entityId) {
  const id = parseInt(entityId, 10);
  if (!Number.isInteger(id) || id <= 0) return err('Invalid entity_id', 400);

  const monthRow = await env.DB.prepare(
    `SELECT MAX(report_month) m FROM entity_exposure_monthly WHERE entity_id = ?`
  ).bind(id).first();
  const latestMonth = monthRow?.m ?? null;
  if (!latestMonth) return json({ exposures: [] });

  const rows = await env.DB.prepare(`
    SELECT
      fel.etf_symbol,
      em_fund.name AS etf_name,
      eem.weight_sum,
      eem.report_month,
      eem.holder_entity_id
    FROM entity_exposure_monthly eem
    JOIN fund_entity_link fel ON eem.holder_entity_id = fel.entity_id
    LEFT JOIN entity_master em_fund ON fel.entity_id = em_fund.entity_id
    WHERE eem.entity_id = ? AND eem.report_month = ?
    ORDER BY eem.weight_sum DESC
    LIMIT 50
  `).bind(id, latestMonth).all();

  return json({ exposures: rows.results ?? [] });
}

// GET /api/entities/:id/instruments
// Read-only: instrument identifiers matched to this entity via
// instrument_entity_map (OpenFIGI / CUSIP tier-1 / ISIN tier-1 / heuristic),
// joined to instrument_master on instrument_key for name/ticker display.
// MA-OCT-007: with ?limit= or ?cursor= the route switches to the paged R2/R4
// form (handleInstrumentsPaged); without either it is the unchanged legacy
// 75-row body (§7.1, T5), so today's front end keeps working.
async function handleInstruments(env, entityId, url) {
  const id = parseInt(entityId, 10);
  if (!Number.isInteger(id) || id <= 0) return err('Invalid entity_id', 400);
  if (url && (url.searchParams.has('limit') || url.searchParams.has('cursor'))) {
    return handleInstrumentsPaged(env, id, url);
  }

  const rows = await env.DB.prepare(`
    SELECT
      im.instrument_key,
      im.security_name,
      im.security_ticker,
      im.isin,
      im.cusip,
      im.asset_cat,
      im.country,
      iem.source,
      iem.confidence
    FROM instrument_entity_map iem
    JOIN instrument_master im ON im.instrument_key = iem.instrument_key
    WHERE iem.entity_id = ?
    ORDER BY im.asset_cat, im.security_name, iem.source
    LIMIT 75
  `).bind(id).all();

  return json({ instruments: rows.results ?? [] });
}

// GET /api/entities/isin/:isin
async function handleIsinLookup(env, isin) {
  if (!isin || isin.length < 6) return err('Invalid ISIN', 400);

  const entity = await env.DB.prepare(`
    SELECT em.*
    FROM entity_isin_map eim
    JOIN entity_master em ON eim.entity_id = em.entity_id
    WHERE eim.isin = ?
    LIMIT 1
  `).bind(isin).first();

  if (!entity) return json({ error: 'Not found' }, 404);
  return json({ entity });
}

// --- MA-OCT-007 Phase 1: navigation contract (spec rev 1.4 §3.2, §5–§7) ------
// R1 GET /api/instruments/:key[?isin=]  NavLink for one instrument
// R2 GET /api/entities/:id/instruments?limit=&cursor=  keyset page (idx_iem_entity_key)
// R4 first-page count, capped at 1,001
// R3 merge redirect for every entity_id (entity_merge_redirect is created by 013;
//    until then "no such table" means "no redirect row").
// All GET, 0 writes. Plans: spec Appendix A.3 (P1–P8, P10).

const NAV_MAX_HOPS = 3;            // A→B→C→D is the most followed (§6.2)
const NAV_CANDIDATE_CAP = 10;      // + 1 to detect truncation
const NAV_PAGE_DEFAULT = 25;
const NAV_PAGE_MAX = 100;
const NAV_COUNT_CAP = 1000;        // R4 counts to 1,001; 1,001 = "1,000+"
const NAV_NAME_PLACEHOLDERS = new Set(['NAME:N/A', 'NAME:NA', 'NAME:NONE']);
const NAV_SOURCE_RANK = { instrument_entity_map: 0, entity_isin_map: 1, bond_issuer_link: 2 };

// R7-2: keys that every identifier-less holding derives to (§3.1).
function navIsPlaceholderKey(key) {
  return /^CUSIP:0{6,9}$/.test(key) || NAV_NAME_PLACEHOLDERS.has(key);
}

// §5.2: low = below 70 or heuristic (by source, whatever the number); medium 70–89; high 90+.
function navBand(source, confidence) {
  const c = Number(confidence);
  if (source === 'heuristic' || !Number.isFinite(c) || c < 70) return 'low';
  return c >= 90 ? 'high' : 'medium';
}

function navIsMissingTable(e) {
  return /no such table/i.test(String(e && e.message || e));
}

async function navEntityRow(env, id) {
  return env.DB.prepare(
    `SELECT entity_id, name, lei, type, entity_status FROM entity_master WHERE entity_id = ?`
  ).bind(id).first();
}

async function navRedirectRow(env, id) {
  try {
    return await env.DB.prepare(
      `SELECT survivor_id, merged_at, packet FROM entity_merge_redirect WHERE duplicate_id = ?`
    ).bind(id).first();
  } catch (e) {
    if (navIsMissingTable(e)) return null;   // §6.2 step 6: R3 ships before 013
    throw e;
  }
}

// Called after a PK miss on requestedId (§6.2 steps 2–5). Returns
// { state: 'resolved', resolvedId, entity, redirect } or
// { state: 'gone' | 'redirect_too_deep' | 'redirect_cycle', chain }.
// Worst case: 3 redirect + 3 entity PK reads after the caller's miss (≤ 7 in all).
async function navFollowRedirect(env, requestedId) {
  const chain = [requestedId];
  let id = requestedId;
  let first = null;
  for (let hop = 0; ; hop++) {
    const row = await navRedirectRow(env, id);
    if (!row) return { state: 'gone', chain };
    const next = Number(row.survivor_id);
    if (chain.includes(next)) { chain.push(next); return { state: 'redirect_cycle', chain }; }
    if (hop >= NAV_MAX_HOPS) { chain.push(next); return { state: 'redirect_too_deep', chain }; }
    chain.push(next);
    if (!first) first = row;
    id = next;
    const entity = await navEntityRow(env, id);
    if (entity) {
      return {
        state: 'resolved', resolvedId: id, entity,
        redirect: { requested_id: requestedId, resolved_id: id, chain, merged_at: first.merged_at ?? null, packet: first.packet ?? null }
      };
    }
  }
}

// §6.3 failure bodies.
function navUnresolvedResponse(requestedId, r) {
  if (r.state === 'gone') {
    return json({ error: 'not_found', state: 'gone', requested_id: requestedId, ...(r.chain && r.chain.length > 1 ? { chain: r.chain } : {}) }, 404);
  }
  return json({ error: 'redirect_unresolved', state: r.state, requested_id: requestedId, chain: r.chain }, 409);
}

// R3 for an id-scoped sub-route: the entity row (for NavLink names) plus redirect.
async function navResolveEntity(env, id) {
  const entity = await navEntityRow(env, id);
  if (entity) return { state: 'resolved', resolvedId: id, entity, redirect: null };
  return navFollowRedirect(env, id);
}

function navCandidate(entity, row, redirect) {
  return {
    entity_id: entity.entity_id,
    name: entity.name ?? null,
    lei: entity.lei ?? null,
    source: row.source,
    source_table: row.source_table,
    confidence: row.confidence,
    confidence_band: navBand(row.source, row.confidence),
    redirect: redirect ?? null,
    as_of: row.as_of ?? null,
  };
}

// R2 (+ R4 on the first page). Keyset on instrument_key in binary order, limit + 1
// rows to detect the next page; no OFFSET. 400 on a non-integer limit; clamp to [1, 100].
async function handleInstrumentsPaged(env, id, url) {
  const rawLimit = url.searchParams.get('limit');
  let limit = NAV_PAGE_DEFAULT;
  if (rawLimit !== null && rawLimit !== '') {
    if (!/^\d+$/.test(rawLimit)) return err('limit must be an integer', 400);
    limit = Math.min(Math.max(parseInt(rawLimit, 10), 1), NAV_PAGE_MAX);
  }
  const cursor = url.searchParams.get('cursor') ?? '';
  if (cursor.length > 200) return err('cursor too long', 400);

  const r = await navResolveEntity(env, id);
  if (r.state !== 'resolved') return navUnresolvedResponse(id, r);
  const eid = r.resolvedId;

  const page = await env.DB.prepare(`
    SELECT iem.instrument_key, iem.source, iem.confidence, iem.created_at,
           im.security_name, im.security_ticker, im.isin, im.cusip, im.asset_cat, im.country
    FROM instrument_entity_map iem
    JOIN instrument_master im ON im.instrument_key = iem.instrument_key
    WHERE iem.entity_id = ? AND iem.instrument_key > ?
    ORDER BY iem.instrument_key
    LIMIT ?
  `).bind(eid, cursor, limit + 1).all();
  const rows = page.results ?? [];
  const more = rows.length > limit;
  const shown = more ? rows.slice(0, limit) : rows;

  let total = null, total_capped = false;
  if (cursor === '') {
    const c = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM (SELECT 1 FROM instrument_entity_map WHERE entity_id = ? LIMIT ${NAV_COUNT_CAP + 1})`
    ).bind(eid).first();
    const n = Number(c?.n ?? 0);
    total_capped = n > NAV_COUNT_CAP;
    total = total_capped ? NAV_COUNT_CAP : n;
  }

  // Each row is the issuer's own mapping row, NavLink-shaped (§3.2). Its state comes
  // from that row's band only; R1 (the Instrument card) is the authoritative resolver.
  const instruments = shown.map(x => {
    const mrow = { source: x.source, source_table: 'instrument_entity_map', confidence: x.confidence, as_of: x.created_at };
    const band = navBand(x.source, x.confidence);
    return {
      instrument_key: x.instrument_key,
      identifiers: { isin: x.isin ?? null, cusip: x.cusip ?? null, ticker: x.security_ticker ?? null },
      asset_type: x.asset_cat ?? null,
      name: x.security_name ?? null,
      country: x.country ?? null,
      state: band === 'low' ? 'low_confidence' : 'matched',
      reason: null,
      candidates: [{ ...navCandidate(r.entity, mrow, null), also_sources: [] }],
      as_of: x.created_at ?? null,
      placeholder_key: navIsPlaceholderKey(x.instrument_key),
    };
  });

  return json({
    entity_id: eid,
    instruments,
    next_cursor: more ? shown[shown.length - 1].instrument_key : null,
    total,
    total_capped,
    limit,
    redirect: r.redirect,
  });
}

// Identifiers implied by the key itself when instrument_master has no row (E8).
function navIdentifiersFromKey(key, isinParam) {
  const ids = { isin: null, cusip: null, ticker: null };
  if (/^[A-Z0-9]{12}$/.test(key)) ids.isin = key;
  else if (key.startsWith('CUSIP:')) ids.cusip = key.slice(6);
  else if (key.startsWith('TICKER:')) ids.ticker = key.slice(7);
  if (!ids.isin && isinParam) ids.isin = isinParam;
  return ids;
}

// R1: GET /api/instruments/:key[?isin=] (§5.1). ≈ 6–8 reads typical; ≤ ≈ 110 worst.
async function handleInstrument(env, rawKey, url) {
  let key;
  try { key = decodeURIComponent(rawKey); } catch { return err('Invalid instrument_key', 400); }
  if (!key || key.length > 100) return err('Invalid instrument_key', 400);
  let isinParam = url.searchParams.get('isin');
  if (isinParam !== null && isinParam !== '') {
    if (!/^[A-Za-z0-9]{12}$/.test(isinParam)) return err('Invalid isin', 400);
    isinParam = isinParam.toUpperCase();
  } else isinParam = null;

  const base = { instrument_key: key, placeholder_key: false };

  // Step 0 (R7-2): placeholder keys answer before any D1 read.
  if (navIsPlaceholderKey(key)) {
    return json({
      ...base, identifiers: navIdentifiersFromKey(key, isinParam), asset_type: null, name: null,
      state: 'unmatched', reason: 'no_mapping', candidates: [], as_of: null,
      placeholder_key: true,
    });
  }

  // Steps 1–2: R1a, R1b (PK).
  const im = await env.DB.prepare(`
    SELECT instrument_key, security_name, security_ticker, isin, cusip, asset_cat, country
    FROM instrument_master WHERE instrument_key = ?
  `).bind(key).first();
  const iem = await env.DB.prepare(
    `SELECT entity_id, source, confidence, created_at FROM instrument_entity_map WHERE instrument_key = ?`
  ).bind(key).first();

  // Step 3: R1c. ISIN = R1a.isin, else ?isin=, else the key if it is a 12-char ISIN.
  let isin = im?.isin || null;
  let isinFromHolding = false;
  if (!isin && isinParam) { isin = isinParam; isinFromHolding = true; }
  if (!isin && /^[A-Z0-9]{12}$/.test(key)) isin = key;
  let eimRows = [];
  if (isin) {
    const e = await env.DB.prepare(
      `SELECT entity_id, lei, match_source, confidence, mapped_at FROM entity_isin_map WHERE isin = ? LIMIT ${NAV_CANDIDATE_CAP + 1}`
    ).bind(isin).all();
    eimRows = e.results ?? [];
  }

  // Step 3a: R1f bond candidate (008's tables; missing table = no candidate).
  let bond = null;
  try {
    const bi = await env.DB.prepare(
      `SELECT cik FROM bond_issuance WHERE instrument_key = ? AND filing_status = 'final' LIMIT 1`
    ).bind(key).first();
    if (bi) {
      bond = await env.DB.prepare(
        `SELECT entity_id, link_method, confidence, linked_at, verified_at FROM bond_issuer_link WHERE cik = ?`
      ).bind(bi.cik).first();
    }
  } catch (e) {
    if (!navIsMissingTable(e)) throw e;
  }

  // Mapping rows that can become candidates.
  const rows = [];
  if (iem && iem.entity_id != null) {
    rows.push({ raw_id: Number(iem.entity_id), source: iem.source, source_table: 'instrument_entity_map', confidence: iem.confidence, as_of: iem.created_at });
  }
  let leiOnly = null;
  for (const e of eimRows) {
    if (e.entity_id == null) { if (!leiOnly) leiOnly = e.lei; continue; }
    rows.push({ raw_id: Number(e.entity_id), source: e.match_source || 'isin_direct', source_table: 'entity_isin_map', confidence: e.confidence ?? 100, as_of: e.mapped_at, lei: e.lei });
  }
  if (bond && bond.entity_id != null) {
    rows.push({ raw_id: Number(bond.entity_id), source: 'sec_bond', source_table: 'bond_issuer_link', confidence: bond.confidence, as_of: bond.verified_at || bond.linked_at });
  }

  // Step 4: resolve every raw entity_id (R1d in one PK IN-list; misses → R3).
  const rawIds = [...new Set(rows.map(x => x.raw_id))];
  const byRaw = new Map();
  if (rawIds.length) {
    const found = await env.DB.prepare(
      `SELECT entity_id, name, lei, type, entity_status FROM entity_master WHERE entity_id IN (${rawIds.map(() => '?').join(', ')})`
    ).bind(...rawIds).all();
    for (const e of found.results ?? []) byRaw.set(Number(e.entity_id), { entity: e, redirect: null });
    for (const rid of rawIds) {
      if (byRaw.has(rid)) continue;
      const r = await navFollowRedirect(env, rid);
      byRaw.set(rid, r.state === 'resolved' ? { entity: r.entity, redirect: r.redirect } : { unresolved: r.state });
    }
  }

  // Step 5 (R7-3): dedupe by resolved entity_id; the primary row is the single
  // highest-confidence row (ties: non-heuristic first, then instrument_entity_map).
  const groups = new Map();
  let anyUnresolved = false;
  for (const x of rows) {
    const res = byRaw.get(x.raw_id);
    if (!res || res.unresolved) { anyUnresolved = true; continue; }
    const eid = Number(res.entity.entity_id);
    if (!groups.has(eid)) groups.set(eid, { entity: res.entity, redirect: res.redirect, rows: [] });
    const g = groups.get(eid);
    if (!g.redirect && res.redirect) g.redirect = res.redirect;
    g.rows.push(x);
  }
  const rank = (a, b) =>
    (Number(b.confidence) - Number(a.confidence)) ||
    ((a.source === 'heuristic') - (b.source === 'heuristic')) ||
    (NAV_SOURCE_RANK[a.source_table] - NAV_SOURCE_RANK[b.source_table]);
  let candidates = [...groups.values()].map(g => {
    g.rows.sort(rank);
    const [primary, ...rest] = g.rows;
    return {
      ...navCandidate(g.entity, primary, g.redirect),
      also_sources: rest.map(o => ({ source: o.source, source_table: o.source_table, confidence: o.confidence })),
      _tables: new Set(g.rows.map(o => o.source_table)),
    };
  });
  candidates.sort((a, b) => (Number(b.confidence) - Number(a.confidence)) || (a.entity_id - b.entity_id));

  // Step 6: state and reason (N7-11: isin_duplicate wins when both hold).
  let state, reason = null;
  if (candidates.length === 0) {
    state = 'unmatched';
    reason = anyUnresolved ? 'redirect_unresolved' : leiOnly ? 'lei_only' : !im ? 'not_in_universe' : 'no_mapping';
  } else if (candidates.length === 1) {
    state = candidates[0].confidence_band === 'low' ? 'low_confidence' : 'matched';
  } else {
    state = 'ambiguous';
    const eimEntities = candidates.filter(c => c._tables.has('entity_isin_map')).length;
    reason = eimEntities >= 2 ? 'isin_duplicate' : 'source_conflict';
  }
  const truncated = candidates.length > NAV_CANDIDATE_CAP || eimRows.length > NAV_CANDIDATE_CAP;
  candidates = candidates.slice(0, NAV_CANDIDATE_CAP).map(({ _tables, ...c }) => c);

  const ids = im
    ? { isin: im.isin ?? (isinFromHolding ? isinParam : null), cusip: im.cusip ?? null, ticker: im.security_ticker ?? null }
    : navIdentifiersFromKey(key, isinParam);
  return json({
    ...base,
    identifiers: ids,
    asset_type: im?.asset_cat ?? null,
    name: im?.security_name ?? null,
    country: im?.country ?? null,
    state,
    reason,
    candidates,
    ...(truncated ? { candidates_truncated: true } : {}),
    ...(state === 'unmatched' && reason === 'lei_only' ? { lei: leiOnly } : {}),
    ...(isinFromHolding ? { isin_source: 'holding' } : {}),
    as_of: candidates[0]?.as_of ?? null,
  });
}

// GET /api/entities/:id/exposure
async function handleExposure(env, entityId) {
  const id = parseInt(entityId, 10);
  if (!Number.isInteger(id) || id <= 0) return err('Invalid entity_id', 400);

  const rows = await env.DB.prepare(`
    SELECT
      exp.report_month,
      exp.weight_sum,
      exp.aum_weighted,
      exp.computed_at,
      holder.entity_id AS holder_entity_id,
      holder.name      AS holder_name,
      holder.type      AS holder_type
    FROM entity_exposure_monthly exp
    JOIN entity_master holder ON holder.entity_id = exp.holder_entity_id
    WHERE exp.entity_id = ?
    ORDER BY exp.report_month DESC, exp.weight_sum DESC
    LIMIT 100
  `).bind(id).all();

  return json({ exposure: rows.results });
}

// GET /api/entities/:id/issuer-panels
// Serves the 4 Issuer-page panels (13F ownership, financials, 8-K events,
// filing timeline) in one call. Each sub-query is isolated in its own
// try/catch so a problem with one panel degrades to an empty array
// instead of failing the whole request.
//
// issuerfilingmaster has no entity_id column, so there is no direct join
// from entity_id to issuerfilingmaster — resolve via entity_master.cik
// (added Sprint 2, populated for 3,182 operating entities by name-match
// against SEC's company_tickers_exchange.json).
//
// FIXED July 24, 2026: this previously only resolved cik via
// issuereventstream/issuerperiodsummary — a chicken-and-egg gap, since
// those are the two Filings-domain tables that don't cover every issuer
// (issuereventstream: 2,884 issuers; issuerperiodsummary is derived from
// financialfact_reported's 500-issuer Phase 1 set). Any issuer with zero
// rows in both — despite having real, broader-coverage data in
// issuerfilingmaster (3,182 issuers) sitting right there under its cik —
// silently got an empty Filing Timeline. Confirmed on Danaher Corporation:
// identity/ownership resolved fine, but Filing Timeline reported "No SEC
// filings found" despite decades of real 10-K/10-Q/8-K history. The old
// chain is kept as a fallback for any entity whose entity_master.cik
// hasn't been backfilled yet but already has a resolvable cik in the
// Filings-domain tables some other way.
async function resolveIssuerCik(env, id) {
  const direct = await env.DB.prepare(
    `SELECT cik FROM entity_master WHERE entity_id = ? AND cik IS NOT NULL`
  ).bind(id).first();
  if (direct && direct.cik) return direct.cik;

  const viaFilings = await env.DB.prepare(`
    SELECT cik FROM issuereventstream WHERE entity_id = ?
    UNION
    SELECT cik FROM issuerperiodsummary WHERE entity_id = ?
    LIMIT 1
  `).bind(id, id).first();
  return viaFilings ? viaFilings.cik : null;
}

async function handleIssuerPanels(env, entityId) {
  const id = parseInt(entityId, 10);
  if (!Number.isInteger(id) || id <= 0) return err('Invalid entity_id', 400);

  let ownership = [];
  try {
    const res = await env.DB.prepare(`
      SELECT q.cik, q.cusip, q.issuer_name, q.report_period, q.market_value, q.share_count,
             q.prev_market_value, q.value_change, q.track, m.manager_name
      FROM managerissuerpositionquarterly q
      LEFT JOIN managermaster m ON m.cik = q.cik
      WHERE q.entity_id = ?
        AND q.report_period = (
          SELECT MAX(report_period) FROM managerissuerpositionquarterly WHERE entity_id = ?
        )
      ORDER BY q.market_value DESC
      LIMIT 25
    `).bind(id, id).all();
    ownership = res.results ?? [];
  } catch (e) {
    console.error('[entities-api] issuer-panels ownership error:', e.message);
  }

  let financials = [];
  try {
    const res = await env.DB.prepare(`
      SELECT xbrl_tag, period_type, period_end, value, unit, net_margin
      FROM issuerperiodsummary
      WHERE entity_id = ?
      ORDER BY period_type, xbrl_tag
    `).bind(id).all();
    financials = res.results ?? [];
  } catch (e) {
    console.error('[entities-api] issuer-panels financials error:', e.message);
  }

  let events = [];
  try {
    const res = await env.DB.prepare(`
      SELECT cik, item_code, item_label, filed_date, accession_number
      FROM issuereventstream
      WHERE entity_id = ?
      ORDER BY filed_date DESC
      LIMIT 20
    `).bind(id).all();
    events = res.results ?? [];
  } catch (e) {
    console.error('[entities-api] issuer-panels events error:', e.message);
  }

  let filings = [];
  try {
    const issuerCik = await resolveIssuerCik(env, id);
    if (issuerCik) {
      const res = await env.DB.prepare(`
        SELECT cik, form_type, filed_date, period_of_report, accession_number, primary_document
        FROM issuerfilingmaster
        WHERE cik = ? AND form_type IN ('10-K','10-Q','8-K')
        ORDER BY filed_date DESC
        LIMIT 20
      `).bind(issuerCik).all();
      filings = res.results ?? [];
    }
  } catch (e) {
    console.error('[entities-api] issuer-panels filings error:', e.message);
  }

  // overlap: ETF exposure + 13F institutional ownership shown side by side.
  // NOTE: manager_count is issuer-wide (distinct 13F filers holding this
  // issuer's stock at the latest report_period), NOT a per-ETF intersection —
  // there's no data linking specific managers to specific ETF share holdings,
  // so the same figure is attached to every ETF row, matching the panel spec's
  // "manager count alongside each ETF" as a co-display, not a true join.
  //
  // entity_exposure_monthly has no fund_name/ticker/weight_pct/position_value
  // columns (confirmed against live schema) — fund identity comes via
  // fund_entity_link + entity_master, the same path handleEtfExposure already
  // uses. weight_sum is already percentage-scaled (e.g. 13.9, not 0.139).
  // There's no reliable dollar position value in this schema; aum_weighted is
  // frequently NULL, so it's passed through as-is rather than backfilled.
  let overlap = {
    etfs: [],
    etf_count: 0,
    manager_count: 0,
    latest_report_month: null,
    latest_report_period: null
  };
  try {
    const monthRow = await env.DB.prepare(
      `SELECT MAX(report_month) m FROM entity_exposure_monthly WHERE entity_id = ?`
    ).bind(id).first();
    const latestMonth = monthRow?.m ?? null;

    const periodRow = await env.DB.prepare(
      `SELECT MAX(report_period) p FROM managerissuerpositionquarterly WHERE entity_id = ?`
    ).bind(id).first();
    const latestPeriod = periodRow?.p ?? null;

    let etfs = [];
    let etfCount = 0;
    if (latestMonth) {
      const etfRes = await env.DB.prepare(`
        SELECT fel.etf_symbol AS ticker, em_fund.name AS fund_name,
               eem.weight_sum AS weight_pct, eem.aum_weighted
        FROM entity_exposure_monthly eem
        JOIN fund_entity_link fel ON eem.holder_entity_id = fel.entity_id
        LEFT JOIN entity_master em_fund ON fel.entity_id = em_fund.entity_id
        WHERE eem.entity_id = ? AND eem.report_month = ?
        ORDER BY eem.weight_sum DESC
        LIMIT 10
      `).bind(id, latestMonth).all();
      etfs = etfRes.results ?? [];

      const etfCountRow = await env.DB.prepare(
        `SELECT COUNT(DISTINCT holder_entity_id) c FROM entity_exposure_monthly WHERE entity_id = ? AND report_month = ?`
      ).bind(id, latestMonth).first();
      etfCount = etfCountRow?.c ?? 0;
    }

    let managerCount = 0;
    if (latestPeriod) {
      const mgrCountRow = await env.DB.prepare(
        `SELECT COUNT(DISTINCT cik) c FROM managerissuerpositionquarterly WHERE entity_id = ? AND report_period = ?`
      ).bind(id, latestPeriod).first();
      managerCount = mgrCountRow?.c ?? 0;
    }

    overlap = {
      etfs: etfs.map(r => ({ ...r, manager_count: managerCount })),
      etf_count: etfCount,
      manager_count: managerCount,
      latest_report_month: latestMonth,
      latest_report_period: latestPeriod
    };
  } catch (e) {
    console.error('[entities-api] issuer-panels overlap error:', e.message);
  }

  return json({ ownership, financials, events, filings, overlap });
}

export default {
  async fetch(request, env, ctx) {
    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // /api/entities/search?q=
      if (path === '/api/entities/search') {
        return await handleSearch(env, url);
      }

      // /api/entities/isin/:isin  — must be before numeric :id patterns
      const isinMatch = path.match(/^\/api\/entities\/isin\/([A-Z0-9]+)$/i);
      if (isinMatch) return await handleIsinLookup(env, isinMatch[1].toUpperCase());

      // /api/entities/:id  (exact — no sub-path)
      const entityMatch = path.match(/^\/api\/entities\/(\d+)$/);
      if (entityMatch) return await handleEntity(env, entityMatch[1]);

      // /api/entities/:id/graph or /api/entities/:id/exposure or /api/entities/:id/etf-exposure
      const graphMatch = path.match(/^\/api\/entities\/(\d+)\/graph$/);
      if (graphMatch) return await handleGraph(env, graphMatch[1]);

      const etfExposureMatch = path.match(/^\/api\/entities\/(\d+)\/etf-exposure$/);
      if (etfExposureMatch) return await handleEtfExposure(env, etfExposureMatch[1]);

      const instrumentsMatch = path.match(/^\/api\/entities\/(\d+)\/instruments$/);
      if (instrumentsMatch) return await handleInstruments(env, instrumentsMatch[1], url);

      // MA-OCT-007 R1: /api/instruments/:key (key percent-encoded; ':' and '/' arrive encoded)
      const instrumentMatch = path.match(/^\/api\/instruments\/([^/]+)$/);
      if (instrumentMatch && request.method === 'GET') return await handleInstrument(env, instrumentMatch[1], url);

      const issuerPanelsMatch = path.match(/^\/api\/entities\/(\d+)\/issuer-panels$/);
      if (issuerPanelsMatch) return await handleIssuerPanels(env, issuerPanelsMatch[1]);

      const exposureMatch = path.match(/^\/api\/entities\/(\d+)\/exposure$/);
      if (exposureMatch) return await handleExposure(env, exposureMatch[1]);

      // MA-OCT-003 R-3: the legacy exception surfaces (MA-SEP-012b /admin/exceptions, MA-SEP-015b /exceptions,
      // /exceptions/ui, /exceptions/:id) moved to meridian-ops /api/ops/admin/cases. Any path equal to or under
      // /exceptions or /admin/exceptions answers 410 and touches nothing (no D1). This rule is removed in November.
      if (/^\/(admin\/)?exceptions(\/|$)/.test(path)) {
        return json({ error: 'gone', moved_to: 'meridian-ops /api/ops/admin/cases (MA-OCT-003)' }, 410);
      }

      return err('Not found', 404);

    } catch (e) {
      console.error('[entities-api] Error:', e.message);
      return json({ error: 'Internal error' }, 500);
    }
  }
};
