// meridian-entities-api
// Serves all Corporate Atlas API endpoints.
// All routes read pre-computed tables only — no raw fund_holdings_monthly joins at request time.

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  // GET/POST/PUT added for MA-SEP-012b's secret-gated /admin/exceptions routes
  // (pending retirement) and MA-SEP-015b's Cloudflare-Access-gated /exceptions
  // routes below. Neither is exposed anywhere in the terminal UI (no navigation
  // entry in index.html or any ma-*.js file — verified); every request still
  // requires the shared secret or a valid Access JWT regardless of CORS — this
  // only affects browser preflight for direct/manual calls.
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Exceptions-Secret, Cf-Access-Jwt-Assertion',
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

// ── MA-SEP-012b: entity_merge_exceptions admin surface — RETIRED (MA-SEP-016) ──
// entity_merge_exceptions was dropped from D1 during MA-SEP-015c (verified backup:
// App/Corporate Atlas/logs/ma-sep-015b-pre-migration-backup-20260905-081359.json).
// Fully superseded by entity_exceptions / the Cloudflare-Access-protected
// /exceptions routes below (MA-SEP-015b). Two prior attempts to delete this block
// and its route-dispatch entries outright were blocked by this session's safety
// classifier (MA-SEP-015c); per MA-SEP-016's Build Brief, the narrower fix is to
// leave the function, handlers, and route dispatch in place but make auth
// unconditionally fail — every /admin/exceptions call now gets exactly the same
// `err('Unauthorized', 401)` the dispatch code below already returns whenever this
// returns false, regardless of any secret header presented (old, current, or none).
function checkAdminExceptionsAuth(request, env) {
  return false;
}

// GET /admin/exceptions — list all rows
async function handleListExceptions(env) {
  const rows = await env.DB.prepare(
    `SELECT id, lei, entity_id_a, entity_id_b, decision, reason, corporate_action_note, decided_by, decided_at
     FROM entity_merge_exceptions ORDER BY id`
  ).all();
  return json({ results: rows.results });
}

// POST /admin/exceptions — add a new exception
async function handleAddException(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return err('Invalid JSON body', 400);
  }

  const { lei, entity_id_a, entity_id_b, decision, reason, corporate_action_note, decided_by } = body;

  const idA = parseInt(entity_id_a, 10);
  const idB = parseInt(entity_id_b, 10);
  if (!Number.isInteger(idA) || idA <= 0) return err('entity_id_a must be a positive integer', 400);
  if (!Number.isInteger(idB) || idB <= 0) return err('entity_id_b must be a positive integer', 400);
  if (decision !== 'do_not_merge' && decision !== 'always_merge') {
    return err(`decision must be 'do_not_merge' or 'always_merge'`, 400);
  }
  if (!decided_by || typeof decided_by !== 'string' || !decided_by.trim()) {
    return err('decided_by is required', 400);
  }

  // Confirm both entity_ids are real, live entity_master rows — same "do not guess/
  // assume" discipline this project applies everywhere else to entity_id references.
  const entityCheck = await env.DB.prepare(
    `SELECT COUNT(*) as n FROM entity_master WHERE entity_id IN (?, ?)`
  ).bind(idA, idB).first();
  if ((entityCheck?.n ?? 0) < (idA === idB ? 1 : 2)) {
    return err('entity_id_a and/or entity_id_b do not exist in entity_master', 400);
  }

  const result = await env.DB.prepare(
    `INSERT INTO entity_merge_exceptions
       (lei, entity_id_a, entity_id_b, decision, reason, corporate_action_note, decided_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    lei || null, idA, idB, decision,
    reason || null, corporate_action_note || null, decided_by.trim()
  ).run();

  const created = await env.DB.prepare(
    `SELECT id, lei, entity_id_a, entity_id_b, decision, reason, corporate_action_note, decided_by, decided_at
     FROM entity_merge_exceptions WHERE id = ?`
  ).bind(result.meta.last_row_id).first();

  return json({ result: created }, 201);
}

// PUT /admin/exceptions/:id — edit an existing exception
async function handleEditException(request, env, idParam) {
  const id = parseInt(idParam, 10);
  if (!Number.isInteger(id) || id <= 0) return err('Invalid exception id', 400);

  const existing = await env.DB.prepare(
    `SELECT id FROM entity_merge_exceptions WHERE id = ?`
  ).bind(id).first();
  if (!existing) return err('Exception not found', 404);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return err('Invalid JSON body', 400);
  }

  const editable = ['lei', 'entity_id_a', 'entity_id_b', 'decision', 'reason', 'corporate_action_note', 'decided_by'];
  const sets = [];
  const params = [];

  for (const col of editable) {
    if (!(col in body)) continue;
    if (col === 'entity_id_a' || col === 'entity_id_b') {
      const v = parseInt(body[col], 10);
      if (!Number.isInteger(v) || v <= 0) return err(`${col} must be a positive integer`, 400);
      sets.push(`${col} = ?`);
      params.push(v);
    } else if (col === 'decision') {
      if (body.decision !== 'do_not_merge' && body.decision !== 'always_merge') {
        return err(`decision must be 'do_not_merge' or 'always_merge'`, 400);
      }
      sets.push('decision = ?');
      params.push(body.decision);
    } else {
      sets.push(`${col} = ?`);
      params.push(body[col] === '' ? null : body[col]);
    }
  }

  if (sets.length === 0) return err('No editable fields provided', 400);

  params.push(id);
  await env.DB.prepare(
    `UPDATE entity_merge_exceptions SET ${sets.join(', ')} WHERE id = ?`
  ).bind(...params).run();

  const updated = await env.DB.prepare(
    `SELECT id, lei, entity_id_a, entity_id_b, decision, reason, corporate_action_note, decided_by, decided_at
     FROM entity_merge_exceptions WHERE id = ?`
  ).bind(id).first();

  return json({ result: updated });
}

// ── MA-SEP-015b: entity_exceptions live ops surface (generic, cross-domain-ready) ──
// Generalizes the block above per the approved MA-SEP-015a design: a typed,
// reusable exception queue (first populated case: 'entity_merge', migrated from
// entity_merge_exceptions — see migrations/ma-sep-015b-entity-exceptions.sql),
// gated by Cloudflare Access rather than a shared secret (OQ2). The Worker
// validates the Cf-Access-Jwt-Assertion header itself — it never owns or stores
// any credential — and pulls a verified `email` claim for `decided_by`, rather
// than trusting client-supplied free text (a real improvement over MA-SEP-012b's
// free-text decided_by, called out in the close-out report).

// JWKS is small and rotates rarely; cache it in module scope for the life of the
// isolate rather than re-fetching on every request.
let _accessJwksCache = null;
let _accessJwksCacheAt = 0;
const ACCESS_JWKS_TTL_MS = 60 * 60 * 1000; // 1 hour

function base64UrlToUint8Array(b64url) {
  const pad = (4 - (b64url.length % 4)) % 4;
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function base64UrlDecodeJson(b64url) {
  return JSON.parse(new TextDecoder().decode(base64UrlToUint8Array(b64url)));
}

async function getAccessJwks(env) {
  const now = Date.now();
  if (_accessJwksCache && (now - _accessJwksCacheAt) < ACCESS_JWKS_TTL_MS) return _accessJwksCache;
  const res = await fetch(`https://${env.CF_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`Failed to fetch Access JWKS: ${res.status}`);
  const data = await res.json();
  _accessJwksCache = data.keys || [];
  _accessJwksCacheAt = now;
  return _accessJwksCache;
}

// Verifies the Cf-Access-Jwt-Assertion header Cloudflare Access attaches once a
// request has already passed the Access edge policy for this app. Re-verifying
// here (signature, aud, exp, iss) rather than just trusting the header's presence
// is standard Cloudflare guidance and is what lets us safely read `email` back out.
async function verifyAccessJwt(request, env) {
  if (!env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) {
    // Fails closed if either binding is missing — same discipline as
    // checkAdminExceptionsAuth above (no undefined-equals-undefined bypass).
    return { ok: false, error: 'Access is not configured on this Worker' };
  }

  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return { ok: false, error: 'Missing Cf-Access-Jwt-Assertion header' };

  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, error: 'Malformed JWT' };
  const [headerB64, payloadB64, sigB64] = parts;

  let header, payload;
  try {
    header = base64UrlDecodeJson(headerB64);
    payload = base64UrlDecodeJson(payloadB64);
  } catch (e) {
    return { ok: false, error: 'Malformed JWT segments' };
  }

  const audOk = Array.isArray(payload.aud)
    ? payload.aud.includes(env.CF_ACCESS_AUD)
    : payload.aud === env.CF_ACCESS_AUD;
  if (!audOk) return { ok: false, error: 'aud mismatch' };

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < nowSec) {
    return { ok: false, error: 'Token expired' };
  }

  const expectedIss = `https://${env.CF_ACCESS_TEAM_DOMAIN}`;
  if (payload.iss !== expectedIss) return { ok: false, error: 'iss mismatch' };

  let keys;
  try {
    keys = await getAccessJwks(env);
  } catch (e) {
    return { ok: false, error: 'Could not fetch Access public keys' };
  }
  const jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) return { ok: false, error: 'Unknown signing key (kid)' };

  let cryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
    );
  } catch (e) {
    return { ok: false, error: 'Failed to import signing key' };
  }

  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlToUint8Array(sigB64);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, signedData);
  if (!valid) return { ok: false, error: 'Invalid signature' };

  if (!payload.email || typeof payload.email !== 'string') {
    return { ok: false, error: 'Token missing email claim' };
  }

  return { ok: true, email: payload.email };
}

const ENTITY_EXCEPTIONS_COLUMNS = `id, exception_type, source_table, source_ref, flagged_reason,
       evidence, proposed_resolution, decision, corporate_action_note, decided_by, decided_at, created_at`;

// GET /exceptions — list all rows, newest schema, any exception_type/source_table
async function handleListEntityExceptions(env) {
  const rows = await env.DB.prepare(
    `SELECT ${ENTITY_EXCEPTIONS_COLUMNS} FROM entity_exceptions ORDER BY id`
  ).all();
  return json({ results: rows.results });
}

function normalizeSourceRef(source_ref) {
  if (source_ref === undefined || source_ref === null) return { error: 'source_ref is required' };
  if (typeof source_ref === 'string') {
    try { JSON.parse(source_ref); } catch (e) { return { error: 'source_ref must be valid JSON' }; }
    return { text: source_ref };
  }
  if (typeof source_ref === 'object') return { text: JSON.stringify(source_ref) };
  return { error: 'source_ref must be a JSON object or JSON string' };
}

function nowSqlTimestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

// POST /exceptions — add a new exception. decided_by/decided_at are only ever
// set from the verified Access identity (never client-supplied), and only when
// a real decision (anything other than 'pending') is being recorded.
async function handleAddEntityException(request, env, decidedByEmail) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return err('Invalid JSON body', 400);
  }

  const { exception_type, source_table, source_ref, flagged_reason, evidence,
          proposed_resolution, decision, corporate_action_note } = body;

  if (typeof exception_type !== 'string' || !exception_type.trim()) {
    return err('exception_type is required', 400);
  }
  if (typeof source_table !== 'string' || !source_table.trim()) {
    return err('source_table is required', 400);
  }
  const refResult = normalizeSourceRef(source_ref);
  if (refResult.error) return err(refResult.error, 400);

  const decisionValue = (typeof decision === 'string' && decision.trim()) ? decision.trim() : 'pending';
  const isDecided = decisionValue !== 'pending';

  const result = await env.DB.prepare(
    `INSERT INTO entity_exceptions
       (exception_type, source_table, source_ref, flagged_reason, evidence, proposed_resolution,
        decision, corporate_action_note, decided_by, decided_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    exception_type.trim(), source_table.trim(), refResult.text,
    flagged_reason || null, evidence || null, proposed_resolution || null,
    decisionValue, corporate_action_note || null,
    isDecided ? decidedByEmail : null,
    isDecided ? nowSqlTimestamp() : null
  ).run();

  const created = await env.DB.prepare(
    `SELECT ${ENTITY_EXCEPTIONS_COLUMNS} FROM entity_exceptions WHERE id = ?`
  ).bind(result.meta.last_row_id).first();

  return json({ result: created }, 201);
}

// PUT /exceptions/:id — edit an existing exception / record a decision.
async function handleEditEntityException(request, env, idParam, decidedByEmail) {
  const id = parseInt(idParam, 10);
  if (!Number.isInteger(id) || id <= 0) return err('Invalid exception id', 400);

  const existing = await env.DB.prepare(`SELECT id FROM entity_exceptions WHERE id = ?`).bind(id).first();
  if (!existing) return err('Exception not found', 404);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return err('Invalid JSON body', 400);
  }

  const editable = ['exception_type', 'source_table', 'source_ref', 'flagged_reason',
                     'evidence', 'proposed_resolution', 'decision', 'corporate_action_note'];
  const sets = [];
  const params = [];

  for (const col of editable) {
    if (!(col in body)) continue;
    if (col === 'source_ref') {
      const refResult = normalizeSourceRef(body.source_ref);
      if (refResult.error) return err(refResult.error, 400);
      sets.push('source_ref = ?');
      params.push(refResult.text);
    } else if (col === 'exception_type' || col === 'source_table') {
      if (typeof body[col] !== 'string' || !body[col].trim()) return err(`${col} must be a non-empty string`, 400);
      sets.push(`${col} = ?`);
      params.push(body[col].trim());
    } else {
      sets.push(`${col} = ?`);
      params.push(body[col] === '' ? null : body[col]);
    }
  }

  // decided_by/decided_at always come from the verified Access identity, never the
  // request body, and only get (re-)set when a real decision is being recorded here.
  if ('decision' in body && body.decision !== 'pending') {
    sets.push('decided_by = ?');
    params.push(decidedByEmail);
    sets.push('decided_at = ?');
    params.push(nowSqlTimestamp());
  }

  if (sets.length === 0) return err('No editable fields provided', 400);

  params.push(id);
  await env.DB.prepare(
    `UPDATE entity_exceptions SET ${sets.join(', ')} WHERE id = ?`
  ).bind(...params).run();

  const updated = await env.DB.prepare(
    `SELECT ${ENTITY_EXCEPTIONS_COLUMNS} FROM entity_exceptions WHERE id = ?`
  ).bind(id).first();

  return json({ result: updated });
}

// GET /exceptions/ui — the live ops page itself. Served by this same Worker (no
// new Worker, no static file, no `file://` origin — the direct fix for Known
// Issue 22.23's root cause). Sits under the same Access-protected path prefix as
// the API routes above (Access app domain: "…workers.dev/exceptions"), so a
// browser visiting this page is gated exactly the same way as the API calls it
// makes. Not linked from index.html or any ma-*.js file — operations tool only,
// per the Design's Non-Goals.
function entityExceptionsUiHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Meridian Atlas — Entity Exceptions</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
:root {
  --bg:#07111F; --bg2:#0B1730; --bg3:#0F1B34; --bg4:#13213D;
  --border:rgba(160, 184, 214, 0.14); --border2:rgba(160, 184, 214, 0.25);
  --text:#E6EEF8; --text2:#93A4BD; --muted:#7D8D9F; --dim:#68788D;
  --green:#2D9C75; --green-bg:rgba(45, 156, 117, 0.10); --green-bd:rgba(45, 156, 117, 0.25);
  --red:#D9534F; --red-bg:rgba(217, 83, 79, 0.10); --red-bd:rgba(217, 83, 79, 0.25);
  --blue:#5A9BC8; --blue-bg:rgba(90, 155, 200, 0.12); --blue-bd:rgba(90, 155, 200, 0.30);
  --amber:#D99C3D; --amber-bg:rgba(217, 156, 61, 0.10); --amber-bd:rgba(217, 156, 61, 0.25);
  --mono:'Inter',sans-serif; --sans:'Inter',sans-serif; --r:2px;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:13px}
body{background:var(--bg);color:var(--text);font-family:var(--sans);min-height:100vh}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:var(--bg3)}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:var(--r)}

#header{position:sticky;top:0;z-index:200;background:var(--bg2);border-bottom:1px solid var(--border);padding:0 16px;height:42px;display:flex;align-items:center;gap:10px}
.logo{display:flex;align-items:center;gap:8px;flex-shrink:0;text-decoration:none}
.logo svg{width:24px;height:24px}
.logo-name{font-size:13px;font-weight:600;color:var(--text);letter-spacing:-.01em}
.logo-name span{color:var(--blue)}
.logo-sub{font-size:8px;color:var(--dim);margin-top:0px;letter-spacing:.02em}
.hsp{flex:1}
.live-pill{display:flex;align-items:center;gap:4px;background:var(--blue-bg);border:1px solid var(--blue-bd);border-radius:var(--r);padding:2px 6px}
.live-dot{width:4px;height:4px;border-radius:50%;background:var(--blue)}
.live-txt{font-size:8.5px;font-weight:600;color:var(--blue);letter-spacing:.05em}

#sbar{background:var(--bg3);border-bottom:1px solid var(--border);padding:2px 16px;font-family:var(--mono);font-size:8.5px;color:var(--dim);letter-spacing:.04em;min-height:16px}

.wrap{max-width:1400px;margin:0 auto;padding:16px}
h1{font-size:15px;font-weight:600;color:var(--text);margin-bottom:2px}
h2{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);margin:22px 0 8px}
.meta{color:var(--muted);font-size:10.5px;margin-bottom:12px}
.banner{background:var(--amber-bg);border:1px solid var(--amber-bd);color:var(--text2);border-radius:var(--r);padding:8px 12px;margin-bottom:14px;font-size:10.5px;line-height:1.5}
.banner code{font-family:var(--mono);color:var(--amber)}
.error{background:var(--red-bg);border:1px solid var(--red-bd);color:var(--red);border-radius:var(--r);padding:8px 12px;margin-bottom:12px;font-size:10.5px;display:none}

table{width:100%;border-collapse:collapse;font-size:10.5px}
th{padding:5px 8px;font-size:8px;font-weight:700;letter-spacing:.08em;color:var(--dim);text-transform:uppercase;text-align:left;border-bottom:1px solid var(--border);background:var(--bg3);white-space:nowrap}
td{padding:6px 8px;border-bottom:1px solid var(--border);vertical-align:top;color:var(--text2)}
tr:hover td{background:rgba(160, 184, 214, 0.05)}
tr:last-child td{border-bottom:none}
.id-col{color:var(--dim);font-family:var(--mono)}
.muted{color:var(--dim)}
.mono{font-family:var(--mono);font-size:9.5px;white-space:pre-wrap;word-break:break-word;color:var(--text2)}

.badge{display:inline-block;padding:1px 8px;border-radius:var(--r);font-size:9.5px;font-weight:700;letter-spacing:.02em;white-space:nowrap}
.badge-pending{background:var(--amber-bg);color:var(--amber);border:1px solid var(--amber-bd)}
.badge-reject{background:var(--red-bg);color:var(--red);border:1px solid var(--red-bd)}
.badge-approve{background:var(--green-bg);color:var(--green);border:1px solid var(--green-bd)}
.badge-neutral{background:var(--blue-bg);color:var(--blue);border:1px solid var(--blue-bd)}

button{font:inherit;cursor:pointer;background:var(--bg3);border:1px solid var(--border);color:var(--text2);font-size:10.5px;font-weight:500;padding:4px 10px;border-radius:var(--r);transition:all .15s ease}
button:hover{background:var(--bg4);border-color:var(--border2);color:var(--text)}
button[type="submit"]{background:var(--blue-bg);color:var(--blue);border-color:var(--blue-bd)}
button[type="submit"]:hover{background:var(--blue-bd)}

form.add-form,form.edit-form{border:1px solid var(--border);background:var(--bg2);border-radius:var(--r);padding:14px;margin-top:6px;max-width:680px}
form.add-form label,form.edit-form label{display:block;font-size:9.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--dim);margin:10px 0 4px}
form.add-form input,form.add-form textarea,form.add-form select,
form.edit-form input,form.edit-form textarea,form.edit-form select{
  width:100%;box-sizing:border-box;font:inherit;font-size:11px;padding:6px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);color:var(--text);outline:none
}
form.add-form input:focus,form.add-form textarea:focus,form.edit-form input:focus,form.edit-form textarea:focus{border-color:var(--blue)}
form.add-form textarea,form.edit-form textarea{font-family:var(--mono);font-size:10px;min-height:4rem}
.row-actions{margin-top:12px;display:flex;gap:8px}
</style>
</head>
<body>

<header id="header">
  <a class="logo" href="#">
    <svg viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="30" height="30" rx="6" fill="#eef4fc"/>
      <rect x="3"  y="19" width="5" height="8"  rx="1" fill="#93c2e8"/>
      <rect x="10" y="13" width="5" height="14" rx="1" fill="#4a90d9"/>
      <rect x="17" y="7"  width="5" height="20" rx="1" fill="#1a56a0"/>
      <polyline points="3,21 12,14 19,8 27,4" stroke="#0e7490" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="27" cy="4" r="2" fill="#0e7490"/>
    </svg>
    <div>
      <div class="logo-name"><span>Meridian</span> Atlas</div>
      <div class="logo-sub">Entity Exceptions · Ops</div>
    </div>
  </a>
  <div class="hsp"></div>
  <div class="live-pill"><span class="live-dot"></span><span class="live-txt">ACCESS-AUTHENTICATED</span></div>
</header>
<div id="sbar">entity_exceptions · Entities domain · live D1 read/write, no cache</div>

<div class="wrap">
  <h1>Entity Exceptions</h1>
  <div class="meta" id="meta">Loading…</div>
  <div class="banner">
    Live, authenticated view of <code>entity_exceptions</code> (Entities domain). Reads and writes go straight to
    D1 through this Worker — nothing here is a cached snapshot. Access is enforced by Cloudflare Access in front
    of this path; this is still an operations tool, not a terminal-facing product surface.
  </div>
  <div class="error" id="error"></div>

  <table>
    <thead>
      <tr>
        <th>ID</th><th>Type</th><th>Source</th><th>Source Ref</th><th>Flagged Reason</th>
        <th>Evidence</th><th>Proposed Resolution</th><th>Decision</th><th>Corp. Action Note</th>
        <th>Decided By</th><th>Decided At</th><th>Created At</th><th></th>
      </tr>
    </thead>
    <tbody id="rows"></tbody>
  </table>

  <h2>Add exception</h2>
  <form class="add-form" id="addForm">
    <label>Exception type *</label>
    <input name="exception_type" required placeholder="e.g. entity_merge">
    <label>Source table *</label>
    <input name="source_table" required placeholder="e.g. entity_master">
    <label>Source ref (JSON) *</label>
    <textarea name="source_ref" required placeholder='{"entity_id_a":1,"entity_id_b":2}'></textarea>
    <label>Flagged reason</label>
    <textarea name="flagged_reason"></textarea>
    <label>Evidence</label>
    <textarea name="evidence"></textarea>
    <label>Proposed resolution</label>
    <textarea name="proposed_resolution"></textarea>
    <label>Decision (leave blank for "pending")</label>
    <input name="decision" placeholder="pending">
    <label>Corporate action note</label>
    <input name="corporate_action_note">
    <div class="row-actions">
      <button type="submit">Add exception</button>
    </div>
  </form>

  <script>
    const rowsEl = document.getElementById('rows');
    const metaEl = document.getElementById('meta');
    const errorEl = document.getElementById('error');

    function showError(msg) {
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
    }
    function clearError() {
      errorEl.style.display = 'none';
      errorEl.textContent = '';
    }
    function esc(s) {
      if (s === null || s === undefined) return '<span class="muted">—</span>';
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    function badge(decision) {
      const d = (decision || '').toLowerCase();
      let cls = 'badge-neutral';
      if (d === 'pending') cls = 'badge-pending';
      else if (d.includes('do_not') || d.includes('reject') || d.includes('deny')) cls = 'badge-reject';
      else if (d.includes('always') || d.includes('approve') || d.includes('accept')) cls = 'badge-approve';
      return '<span class="badge ' + cls + '">' + esc(decision) + '</span>';
    }

    async function api(path, opts) {
      const res = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || {}));
      let data;
      try { data = await res.json(); } catch (e) { data = null; }
      if (!res.ok) {
        throw new Error((data && data.error) ? data.error : ('Request failed: ' + res.status));
      }
      return data;
    }

    function renderRow(row) {
      const tr = document.createElement('tr');
      tr.innerHTML =
        '<td class="id-col">' + row.id + '</td>' +
        '<td>' + esc(row.exception_type) + '</td>' +
        '<td>' + esc(row.source_table) + '</td>' +
        '<td class="mono">' + esc(row.source_ref) + '</td>' +
        '<td>' + esc(row.flagged_reason) + '</td>' +
        '<td>' + esc(row.evidence) + '</td>' +
        '<td>' + esc(row.proposed_resolution) + '</td>' +
        '<td>' + badge(row.decision) + '</td>' +
        '<td>' + esc(row.corporate_action_note) + '</td>' +
        '<td>' + esc(row.decided_by) + '</td>' +
        '<td>' + esc(row.decided_at) + '</td>' +
        '<td>' + esc(row.created_at) + '</td>' +
        '<td><button data-edit="' + row.id + '">Edit</button></td>';
      return tr;
    }

    function openEditForm(row, tr) {
      const existing = tr.nextElementSibling;
      if (existing && existing.classList && existing.classList.contains('edit-row')) {
        existing.remove();
        return;
      }
      const editTr = document.createElement('tr');
      editTr.className = 'edit-row';
      const td = document.createElement('td');
      td.colSpan = 13;
      td.innerHTML =
        '<form class="edit-form">' +
        '<label>Decision</label><input name="decision" value="' + (row.decision || '') + '">' +
        '<label>Flagged reason</label><textarea name="flagged_reason">' + (row.flagged_reason || '') + '</textarea>' +
        '<label>Evidence</label><textarea name="evidence">' + (row.evidence || '') + '</textarea>' +
        '<label>Proposed resolution</label><textarea name="proposed_resolution">' + (row.proposed_resolution || '') + '</textarea>' +
        '<label>Corporate action note</label><input name="corporate_action_note" value="' + (row.corporate_action_note || '') + '">' +
        '<div class="row-actions"><button type="submit">Save</button> <button type="button" data-cancel="1">Cancel</button></div>' +
        '</form>';
      editTr.appendChild(td);
      tr.after(editTr);

      const form = td.querySelector('form');
      form.querySelector('[data-cancel]').addEventListener('click', () => editTr.remove());
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearError();
        const fd = new FormData(form);
        const body = {
          decision: fd.get('decision'),
          flagged_reason: fd.get('flagged_reason'),
          evidence: fd.get('evidence'),
          proposed_resolution: fd.get('proposed_resolution'),
          corporate_action_note: fd.get('corporate_action_note'),
        };
        try {
          await api('/exceptions/' + row.id, { method: 'PUT', body: JSON.stringify(body) });
          await loadRows();
        } catch (err) {
          showError('Save failed: ' + err.message);
        }
      });
    }

    async function loadRows() {
      clearError();
      metaEl.textContent = 'Loading…';
      try {
        const data = await api('/exceptions');
        const results = data.results || [];
        rowsEl.innerHTML = '';
        const byRow = new Map();
        results.forEach((row) => {
          const tr = renderRow(row);
          byRow.set(row.id, row);
          rowsEl.appendChild(tr);
        });
        rowsEl.querySelectorAll('[data-edit]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const id = Number(btn.getAttribute('data-edit'));
            openEditForm(byRow.get(id), btn.closest('tr'));
          });
        });
        metaEl.textContent = results.length + ' row' + (results.length === 1 ? '' : 's') + ' · loaded ' + new Date().toLocaleString();
      } catch (err) {
        metaEl.textContent = '';
        showError('Load failed: ' + err.message);
      }
    }

    document.getElementById('addForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      clearError();
      const fd = new FormData(e.target);
      let source_ref = fd.get('source_ref');
      try {
        source_ref = JSON.parse(source_ref);
      } catch (err) {
        showError('Source ref must be valid JSON');
        return;
      }
      const body = {
        exception_type: fd.get('exception_type'),
        source_table: fd.get('source_table'),
        source_ref: source_ref,
        flagged_reason: fd.get('flagged_reason'),
        evidence: fd.get('evidence'),
        proposed_resolution: fd.get('proposed_resolution'),
        decision: fd.get('decision'),
        corporate_action_note: fd.get('corporate_action_note'),
      };
      try {
        await api('/exceptions', { method: 'POST', body: JSON.stringify(body) });
        e.target.reset();
        await loadRows();
      } catch (err) {
        showError('Add failed: ' + err.message);
      }
    });

    loadRows();
  </script>
</body>
</html>`;
}

function handleEntityExceptionsUi() {
  return new Response(entityExceptionsUiHtml(), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
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

      // MA-SEP-012b: /admin/exceptions — secret checked before any query, for all
      // three routes and both HTTP verbs, per the Build Brief's explicit requirement.
      if (path === '/admin/exceptions') {
        if (!checkAdminExceptionsAuth(request, env)) return err('Unauthorized', 401);
        if (request.method === 'GET')  return await handleListExceptions(env);
        if (request.method === 'POST') return await handleAddException(request, env);
        return err('Method not allowed', 405);
      }
      const exceptionEditMatch = path.match(/^\/admin\/exceptions\/(\d+)$/);
      if (exceptionEditMatch) {
        if (!checkAdminExceptionsAuth(request, env)) return err('Unauthorized', 401);
        if (request.method === 'PUT') return await handleEditException(request, env, exceptionEditMatch[1]);
        return err('Method not allowed', 405);
      }

      // MA-SEP-015b: /exceptions — generic entity_exceptions surface, gated by
      // Cloudflare Access (verifyAccessJwt above) rather than a shared secret.
      // The live ops page lives at /exceptions/ui, under the same Access-protected
      // path prefix as the API routes it calls.
      if (path === '/exceptions/ui') {
        const auth = await verifyAccessJwt(request, env);
        if (!auth.ok) return err('Unauthorized', 401);
        if (request.method === 'GET') return handleEntityExceptionsUi();
        return err('Method not allowed', 405);
      }
      if (path === '/exceptions') {
        const auth = await verifyAccessJwt(request, env);
        if (!auth.ok) return err('Unauthorized', 401);
        if (request.method === 'GET')  return await handleListEntityExceptions(env);
        if (request.method === 'POST') return await handleAddEntityException(request, env, auth.email);
        return err('Method not allowed', 405);
      }
      const entityExceptionEditMatch = path.match(/^\/exceptions\/(\d+)$/);
      if (entityExceptionEditMatch) {
        const auth = await verifyAccessJwt(request, env);
        if (!auth.ok) return err('Unauthorized', 401);
        if (request.method === 'PUT') return await handleEditEntityException(request, env, entityExceptionEditMatch[1], auth.email);
        return err('Method not allowed', 405);
      }

      return err('Not found', 404);

    } catch (e) {
      console.error('[entities-api] Error:', e.message);
      return json({ error: 'Internal error' }, 500);
    }
  }
};
