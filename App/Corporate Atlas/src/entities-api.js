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
  // MA-OCT-009 §4.3: only when fi_serving_gate is open, only served rows, and a key
  // filed under 2 CIKs is a source_conflict (never an arbitrary pick).
  let bond = null, bondConflict = false;
  const gate = await fiGate(env);
  if (gate.open) {
    try {
      const bi = await env.DB.prepare(
        `SELECT DISTINCT cik FROM bond_issuance WHERE instrument_key = ? AND filing_status = 'final' AND parse_confidence >= ${FI_MIN_CONFIDENCE} LIMIT 2`
      ).bind(key).all();
      const ciks = bi.results ?? [];
      if (ciks.length === 1) {
        bond = await env.DB.prepare(
          `SELECT entity_id, link_method, confidence, linked_at, verified_at FROM bond_issuer_link WHERE cik = ?`
        ).bind(ciks[0].cik).first();
      } else if (ciks.length > 1) bondConflict = true;
    } catch (e) {
      if (!navIsMissingTable(e)) throw e;
    }
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
  if (bondConflict) {
    state = 'ambiguous';
    reason = 'source_conflict';
  } else if (candidates.length === 0) {
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

// --- MA-OCT-009: Fixed Income routes (spec rev 1 §4–§6) ---------------------------
// F1  GET /api/fi/issuers/:entity_id/bonds?limit=&cursor=&include_matured=
// F1b GET /api/fi/ciks/:cik/bonds?…
// F2  GET /api/fi/bonds/:accession_number/:tranche_seq
// F3  GET /api/fi/coverage
// F4  GET /api/fi/issuers/:entity_id/ladder
// Every request reads fi_serving_gate first. Closed (or missing) → bodies with no CIK,
// issuer name, count or bond row; F1/F1b keep only has_bond_link (§4.2). Reads only,
// 0 writes. Responses go through fi_json() so json() and the R1–R4 headers stay as 007 shipped.

const FI_DATA_TYPE = 'issuance_reference';
const FI_MIN_CONFIDENCE = 60;         // served-row rule (§5.1); minimum final today is 70
const FI_CHECK_SOURCE_BELOW = 80;
const FI_MAX_CIKS = 10;               // > 10 linked CIKs → 422 (Architect N-5)
const FI_CACHE_TTL = 3600;            // F3/F4 Worker cache (§5.7)
const FI_BROWSER_CC = 'public, max-age=60';
const FI_BOND_COLS = `accession_number, tranche_seq, cik, instrument_key, isin, cusip, tranche_label, security_class,
       rate_type, coupon_rate, spread_bps, benchmark, principal_amount, currency, maturity_date,
       seniority, form_type, filing_date, source_url, parse_confidence`;
const FI_RATE_LABEL = { fixed: 'Fixed coupon', floating: 'Floating', fixed_to_floating: 'Fixed-to-floating' };

function fi_json(data, status = 200, cacheControl = 'no-store', extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Cache-Control': cacheControl, ...extra } });
}

function fiErr(msg, status) {
  return fi_json({ error: msg }, status);
}

// §4.1 read. Missing table or row, or any state other than 'open' → closed.
// Any other D1 error propagates → 500 from the router (outage, still no data).
async function fiGate(env) {
  let row;
  try {
    row = await env.DB.prepare(`SELECT state, changed_at FROM fi_serving_gate WHERE id = 1`).first();
  } catch (e) {
    if (navIsMissingTable(e)) return { open: false, state: 'closed', changed_at: null };
    throw e;
  }
  const open = !!row && row.state === 'open';
  return { open, state: open ? 'open' : 'closed', changed_at: row?.changed_at ?? null };
}

function fiUnavailable(extra) {
  return fi_json({ data_type: FI_DATA_TYPE, gate: 'open', ...extra, coverage: { available: false } });
}

function fiBondRow(r) {
  return {
    ...r,
    check_source: Number(r.parse_confidence) < FI_CHECK_SOURCE_BELOW,
    rate_label: FI_RATE_LABEL[r.rate_type] ?? null,
  };
}

const fiServed = r => Number(r.parse_confidence) >= FI_MIN_CONFIDENCE;
const fiTuple = r => [r.maturity_date, r.accession_number, Number(r.tranche_seq)];
function fiCmp(a, b) {
  for (let i = 0; i < 3; i++) { if (a[i] < b[i]) return -1; if (a[i] > b[i]) return 1; }
  return 0;
}

function fiEncodeCursor(t) {
  return btoa(JSON.stringify(t)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fiDecodeCursor(s) {
  if (s.length > 200 || !/^[A-Za-z0-9_-]+$/.test(s)) return null;
  let t;
  try { t = JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/'))); } catch { return null; }
  if (!Array.isArray(t) || t.length !== 3 || typeof t[0] !== 'string' || typeof t[1] !== 'string' || !Number.isInteger(t[2])) return null;
  return t;
}

function fiTodayUtc() {
  return new Date().toISOString().slice(0, 10);
}

// F1/F1b paging parameters (§5.2 steps 6–7). Returns { error } or { limit, start }.
function fiPageParams(url) {
  const rawLimit = url.searchParams.get('limit');
  let limit = NAV_PAGE_DEFAULT;
  if (rawLimit !== null && rawLimit !== '') {
    if (!/^\d+$/.test(rawLimit)) return { error: 'limit must be an integer' };
    limit = Math.min(Math.max(parseInt(rawLimit, 10), 1), NAV_PAGE_MAX);
  }
  const im = url.searchParams.get('include_matured') ?? '0';
  if (im !== '0' && im !== '1') return { error: 'include_matured must be 0 or 1' };
  const base = im === '1' ? ['', '', -1] : [fiTodayUtc(), '', -1];
  const rawCursor = url.searchParams.get('cursor') ?? '';
  let start = base;
  if (rawCursor !== '') {
    const t = fiDecodeCursor(rawCursor);
    if (!t) return { error: 'Invalid cursor' };
    if (fiCmp(t, base) > 0) start = t;
  }
  return { limit, start };
}

// §5.2 step 4 + 5: one keyset statement per CIK in one batch (limit + 1 rows each), then the
// merge. A consumed row is returned (≥ 60) or dropped (< 60). Stop at `limit` returned rows,
// or once a CIK that still had more rows has had its buffer fully consumed (the merge order
// past that point is unknown). next_cursor = the last row consumed, never the largest fetched.
async function fiBondPage(env, ciks, limit, start) {
  const stmt = `SELECT ${FI_BOND_COLS}
    FROM bond_issuance
    WHERE cik = ? AND filing_status = 'final'
      AND (maturity_date, accession_number, tranche_seq) > (?, ?, ?)
    ORDER BY maturity_date, accession_number, tranche_seq
    LIMIT ?`;
  const res = await env.DB.batch(ciks.map(c => env.DB.prepare(stmt).bind(c, start[0], start[1], start[2], limit + 1)));
  const lists = res.map(r => r.results ?? []);
  const more = lists.map(l => l.length > limit);
  const pos = lists.map(() => 0);
  const bonds = [];
  let last = null, latestFiling = null;
  for (const l of lists) for (const r of l) if (!latestFiling || r.filing_date > latestFiling) latestFiling = r.filing_date;
  while (bonds.length < limit) {
    if (lists.some((l, i) => more[i] && pos[i] >= l.length)) break;
    let best = -1;
    for (let i = 0; i < lists.length; i++) {
      if (pos[i] >= lists[i].length) continue;
      if (best < 0 || fiCmp(fiTuple(lists[i][pos[i]]), fiTuple(lists[best][pos[best]])) < 0) best = i;
    }
    if (best < 0) break;
    const row = lists[best][pos[best]++];
    last = row;
    if (fiServed(row)) bonds.push(fiBondRow(row));
  }
  const exhausted = lists.every((l, i) => !more[i] && pos[i] >= l.length);
  return { bonds, next_cursor: exhausted || !last ? null : fiEncodeCursor(fiTuple(last)), latest_filing_date: latestFiling };
}

function fiLinkOut(l) {
  return { cik: l.cik, issuer_name: l.issuer_name, link_method: l.link_method, confidence: l.confidence, last_polled_at: l.last_polled_at ?? null };
}

function fiMaxPolled(links) {
  return links.reduce((m, l) => (l.last_polled_at && (!m || l.last_polled_at > m) ? l.last_polled_at : m), null);
}

// Linked CIKs of an entity (§5.2 step 3; idx_bil_entity). The identity rule (DIL M-6):
// these are always the entity's own filer CIKs, never a subsidiary's or guarantor's.
async function fiEntityLinks(env, eid) {
  const r = await env.DB.prepare(
    `SELECT cik, issuer_name, link_method, confidence, last_polled_at FROM bond_issuer_link WHERE entity_id = ?`
  ).bind(eid).all();
  return r.results ?? [];
}

// F1
async function handleFiIssuerBonds(env, entityId, url) {
  if (!/^[1-9]\d{0,9}$/.test(entityId)) return fiErr('Invalid entity_id', 400);
  const id = parseInt(entityId, 10);
  const p = fiPageParams(url);
  if (p.error) return fiErr(p.error, 400);
  const gate = await fiGate(env);
  const r = await navResolveEntity(env, id);
  if (r.state !== 'resolved') return navUnresolvedResponse(id, r);
  const closed = { data_type: FI_DATA_TYPE, gate: 'closed', ciks: [], bonds: [] };
  let links;
  try { links = await fiEntityLinks(env, r.resolvedId); } catch (e) {
    if (!navIsMissingTable(e)) throw e;
    return gate.open ? fiUnavailable({ has_bond_link: false, ciks: [], bonds: [] }) : fi_json({ ...closed, has_bond_link: false, coverage: { available: false } });
  }
  if (!gate.open) return fi_json({ ...closed, has_bond_link: links.length > 0 });
  if (links.length > FI_MAX_CIKS) return fiErr('too_many_ciks', 422);
  const head = { data_type: FI_DATA_TYPE, gate: 'open', entity_id: r.resolvedId, redirect: r.redirect };
  if (!links.length) return fi_json({ ...head, has_bond_link: false, ciks: [], bonds: [], next_cursor: null }, 200, FI_BROWSER_CC);
  let page;
  try { page = await fiBondPage(env, links.map(l => l.cik), p.limit, p.start); } catch (e) {
    if (!navIsMissingTable(e)) throw e;
    return fiUnavailable({ has_bond_link: true, ciks: [], bonds: [] });
  }
  return fi_json({
    ...head, has_bond_link: true, ciks: links.map(fiLinkOut), bonds: page.bonds, next_cursor: page.next_cursor, limit: p.limit,
    freshness: { last_polled_at: fiMaxPolled(links), latest_filing_date: page.latest_filing_date },
  }, 200, FI_BROWSER_CC);
}

// F1b: one CIK, for filers with no entity link (§5.3).
async function handleFiCikBonds(env, cik, url) {
  if (!/^\d{10}$/.test(cik)) return fiErr('Invalid cik', 400);
  const p = fiPageParams(url);
  if (p.error) return fiErr(p.error, 400);
  const gate = await fiGate(env);
  const closed = { data_type: FI_DATA_TYPE, gate: 'closed', ciks: [], bonds: [] };
  let link;
  try {
    link = await env.DB.prepare(
      `SELECT cik, issuer_name, link_method, confidence, last_polled_at FROM bond_issuer_link WHERE cik = ?`
    ).bind(cik).first();
  } catch (e) {
    if (!navIsMissingTable(e)) throw e;
    return gate.open ? fiUnavailable({ has_bond_link: false, ciks: [], bonds: [] }) : fi_json({ ...closed, has_bond_link: false, coverage: { available: false } });
  }
  if (!gate.open) return fi_json({ ...closed, has_bond_link: !!link });
  const head = { data_type: FI_DATA_TYPE, gate: 'open', entity_id: null };
  if (!link) return fi_json({ ...head, has_bond_link: false, ciks: [], bonds: [], next_cursor: null }, 200, FI_BROWSER_CC);
  let page;
  try { page = await fiBondPage(env, [link.cik], p.limit, p.start); } catch (e) {
    if (!navIsMissingTable(e)) throw e;
    return fiUnavailable({ has_bond_link: true, ciks: [], bonds: [] });
  }
  return fi_json({
    ...head, has_bond_link: true, ciks: [fiLinkOut(link)], bonds: page.bonds, next_cursor: page.next_cursor, limit: p.limit,
    freshness: { last_polled_at: link.last_polled_at ?? null, latest_filing_date: page.latest_filing_date },
  }, 200, FI_BROWSER_CC);
}

// F2 (§5.4). The issuer is the bond's own filer (its cik → bond_issuer_link); the LEI is
// only the linked entity's entity_master.lei (DIL M-8). No guarantor in v1.
async function handleFiBond(env, accession, rawSeq) {
  if (!/^\d{10}-\d{2}-\d{6}$/.test(accession) || !/^[1-9]\d{0,5}$/.test(rawSeq)) return fiErr('Invalid bond id', 400);
  const seq = parseInt(rawSeq, 10);
  const gate = await fiGate(env);
  if (!gate.open) return fi_json({ data_type: FI_DATA_TYPE, gate: 'closed', bond: null, issuer: null });
  let row;
  try {
    row = await env.DB.prepare(
      `SELECT ${FI_BOND_COLS}, filing_status, parser_version, ingested_at FROM bond_issuance WHERE accession_number = ? AND tranche_seq = ?`
    ).bind(accession, seq).first();
  } catch (e) {
    if (!navIsMissingTable(e)) throw e;
    return fiUnavailable({ bond: null, issuer: null });
  }
  if (!row || row.filing_status !== 'final' || !fiServed(row)) return fiErr('not_found', 404);
  const link = await env.DB.prepare(
    `SELECT cik, entity_id, link_method, confidence, issuer_name, linked_at, verified_at FROM bond_issuer_link WHERE cik = ?`
  ).bind(row.cik).first();

  let other_filings = 0, multiCik = false;
  if (row.instrument_key) {
    const c = await env.DB.prepare(
      `SELECT COUNT(*) AS n, COUNT(DISTINCT cik) AS ciks FROM bond_issuance
       WHERE instrument_key = ? AND filing_status = 'final' AND parse_confidence >= ${FI_MIN_CONFIDENCE}`
    ).bind(row.instrument_key).first();
    other_filings = Math.max(Number(c?.n ?? 1) - 1, 0);
    multiCik = Number(c?.ciks ?? 1) > 1;
  }

  let candidates = [], state = 'unmatched', reason = 'no_mapping';
  if (link && link.entity_id != null) {
    const r = await navResolveEntity(env, Number(link.entity_id));
    if (r.state === 'resolved') {
      const mrow = { source: 'sec_bond', source_table: 'bond_issuer_link', confidence: link.confidence, as_of: link.verified_at || link.linked_at };
      candidates = [{ ...navCandidate(r.entity, mrow, r.redirect), also_sources: [] }];
      state = candidates[0].confidence_band === 'low' ? 'low_confidence' : 'matched';
      reason = null;
    } else reason = 'redirect_unresolved';
  }
  if (multiCik) { state = 'ambiguous'; reason = 'source_conflict'; }

  const { filing_status, parser_version, ingested_at, ...terms } = row;
  return fi_json({
    data_type: FI_DATA_TYPE, gate: 'open',
    bond: { ...fiBondRow(terms), parser_version, ingested_at, other_filings },
    filer: { cik: row.cik, issuer_name: link?.issuer_name ?? null },
    issuer: {
      instrument_key: row.instrument_key ?? null,
      identifiers: { isin: row.isin ?? null, cusip: row.cusip ?? null, ticker: null },
      asset_type: 'DBT',
      name: row.tranche_label ?? null,
      state, reason, candidates,
      as_of: candidates[0]?.as_of ?? null,
    },
  }, 200, FI_BROWSER_CC);
}

// §5.7: F3/F4 Worker cache, key = URL + gate state + gate changed_at, so a body cached
// before a close can never come back after a reopen. Closed / missing-table bodies are
// never cached. On workers.dev the Cache API may be a no-op (M-6): x-fi-cache says which.
function fiCacheKey(url, gate) {
  const u = new URL(url.toString());
  u.searchParams.set('__fi_gate', `${gate.state}|${gate.changed_at ?? ''}`);
  return new Request(u.toString(), { method: 'GET' });
}
function fiCache() {
  return typeof caches !== 'undefined' && caches && caches.default ? caches.default : null;
}
async function fiCached(url, gate, ctx, build) {
  const cache = fiCache();
  const key = fiCacheKey(url, gate);
  if (cache) {
    const hit = await cache.match(key);
    if (hit) {
      const h = new Headers(hit.headers);
      h.set('Cache-Control', FI_BROWSER_CC);
      h.set('x-fi-cache', 'hit');
      return new Response(hit.body, { status: hit.status, headers: h });
    }
  }
  const { body, cacheable } = await build();
  const res = fi_json(body, 200, cacheable ? FI_BROWSER_CC : 'no-store', { 'x-fi-cache': 'miss' });
  if (cache && cacheable) {
    const stored = fi_json(body, 200, `public, max-age=${FI_CACHE_TTL}`, { 'x-fi-cache': 'miss' });
    const put = cache.put(key, stored);
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(put); else await put;
  }
  return res;
}

const fiLinkBand = l => (l.link_method === 'unmatched' || l.entity_id == null ? 'unmatched' : navBand('sec_bond', l.confidence));

// F3 (§5.5). Open gate only; ≈ 2.4k reads uncached.
async function handleFiCoverage(env, url, ctx) {
  const gate = await fiGate(env);
  if (!gate.open) return fi_json({ data_type: FI_DATA_TYPE, gate: 'closed', issuers: [], totals: null });
  return fiCached(url, gate, ctx, async () => {
    let res;
    try {
      res = await env.DB.batch([
        env.DB.prepare(`SELECT cik, issuer_name, entity_id, link_method, confidence, last_polled_at FROM bond_issuer_link`),
        env.DB.prepare(`SELECT cik, COUNT(*) AS finals, MAX(filing_date) AS latest_filing
          FROM bond_issuance WHERE filing_status = 'final' AND parse_confidence >= ${FI_MIN_CONFIDENCE} GROUP BY cik`),
        env.DB.prepare(`SELECT COUNT(*) AS n FROM (SELECT instrument_key FROM bond_issuance
          WHERE filing_status = 'final' AND parse_confidence >= ${FI_MIN_CONFIDENCE} AND instrument_key IS NOT NULL
          GROUP BY instrument_key HAVING COUNT(DISTINCT cik) > 1)`),
      ]);
    } catch (e) {
      if (!navIsMissingTable(e)) throw e;
      return { body: { data_type: FI_DATA_TYPE, gate: 'open', issuers: [], totals: null, coverage: { available: false } }, cacheable: false };
    }
    const links = res[0].results ?? [];
    const counts = new Map((res[1].results ?? []).map(c => [c.cik, c]));
    const issuers = links.map(l => ({
      cik: l.cik, issuer_name: l.issuer_name, entity_id: l.entity_id ?? null, link_method: l.link_method, band: fiLinkBand(l),
      finals: Number(counts.get(l.cik)?.finals ?? 0), latest_filing: counts.get(l.cik)?.latest_filing ?? null, last_polled_at: l.last_polled_at ?? null,
    })).sort((a, b) => String(a.issuer_name).localeCompare(String(b.issuer_name)) || a.cik.localeCompare(b.cik));
    const linked = issuers.filter(i => i.entity_id != null).length;
    return {
      body: {
        data_type: FI_DATA_TYPE, gate: 'open', issuers,
        totals: { issuers: issuers.length, linked, unmatched: issuers.length - linked, finals: issuers.reduce((s, i) => s + i.finals, 0) },
        multi_cik_keys: Number(res[2].results?.[0]?.n ?? 0),
        as_of: fiMaxPolled(links),
      },
      cacheable: true,
    };
  });
}

// F4 (§5.6). Distinct securities per maturity year (instrument_key, else accession+tranche);
// principal_usd only for USD securities filed once; reopened = securities filed more than once.
async function handleFiLadder(env, entityId, url, ctx) {
  if (!/^[1-9]\d{0,9}$/.test(entityId)) return fiErr('Invalid entity_id', 400);
  const id = parseInt(entityId, 10);
  const gate = await fiGate(env);
  const r = await navResolveEntity(env, id);
  if (r.state !== 'resolved') return navUnresolvedResponse(id, r);
  if (!gate.open) return fi_json({ data_type: FI_DATA_TYPE, gate: 'closed', years: [] });
  let links;
  try { links = await fiEntityLinks(env, r.resolvedId); } catch (e) {
    if (!navIsMissingTable(e)) throw e;
    return fiUnavailable({ years: [] });
  }
  if (links.length > FI_MAX_CIKS) return fiErr('too_many_ciks', 422);
  const ladderUrl = new URL(url.toString());          // requested id: the body carries its redirect
  ladderUrl.searchParams.set('__d', fiTodayUtc());   // the outstanding cut-off is part of the key
  const head = { data_type: FI_DATA_TYPE, gate: 'open', entity_id: r.resolvedId, redirect: r.redirect };
  if (!links.length) return fi_json({ ...head, years: [] }, 200, FI_BROWSER_CC);
  const res = await fiCached(ladderUrl, gate, ctx, async () => {
    const stmt = `SELECT substr(maturity_date, 1, 4) AS y, currency, instrument_key, accession_number, tranche_seq, principal_amount, parse_confidence
      FROM bond_issuance
      WHERE cik = ? AND filing_status = 'final' AND maturity_date >= ?
      ORDER BY maturity_date, accession_number, tranche_seq`;
    const out = await env.DB.batch(links.map(l => env.DB.prepare(stmt).bind(l.cik, fiTodayUtc())));
    const secs = new Map();
    for (const rs of out) for (const x of rs.results ?? []) {
      if (!fiServed(x)) continue;
      const k = x.instrument_key || `${x.accession_number}#${x.tranche_seq}`;
      if (!secs.has(k)) secs.set(k, { y: x.y, currency: x.currency, principal: x.principal_amount, filings: new Set() });
      secs.get(k).filings.add(x.accession_number);
    }
    const years = new Map();
    for (const s of secs.values()) {
      if (!years.has(s.y)) years.set(s.y, { year: s.y, securities: 0, principal_usd: 0, reopened: 0, other_currencies: {} });
      const yr = years.get(s.y);
      yr.securities++;
      if (s.filings.size > 1) yr.reopened++;
      else if (s.currency === 'USD' && s.principal != null) yr.principal_usd += Number(s.principal);
      if (s.currency !== 'USD') yr.other_currencies[s.currency] = (yr.other_currencies[s.currency] ?? 0) + 1;
    }
    return { body: { ...head, years: [...years.values()].sort((a, b) => a.year.localeCompare(b.year)) }, cacheable: true };
  });
  return res;
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

      // MA-OCT-009 Fixed Income (F1, F1b, F2, F3, F4). GET only.
      if (path.startsWith('/api/fi/') && request.method === 'GET') {
        if (path === '/api/fi/coverage') return await handleFiCoverage(env, url, ctx);
        const fiIssuer = path.match(/^\/api\/fi\/issuers\/([^/]+)\/(bonds|ladder)$/);
        if (fiIssuer) return fiIssuer[2] === 'bonds' ? await handleFiIssuerBonds(env, fiIssuer[1], url) : await handleFiLadder(env, fiIssuer[1], url, ctx);
        const fiCik = path.match(/^\/api\/fi\/ciks\/([^/]+)\/bonds$/);
        if (fiCik) return await handleFiCikBonds(env, fiCik[1], url);
        const fiBond = path.match(/^\/api\/fi\/bonds\/([^/]+)\/([^/]+)$/);
        if (fiBond) return await handleFiBond(env, fiBond[1], fiBond[2]);
      }

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
