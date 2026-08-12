// meridian-entities-api
// Serves all Corporate Atlas API endpoints.
// All routes read pre-computed tables only — no raw fund_holdings_monthly joins at request time.

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
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

  // Children (limit 20)
  const children = await env.DB.prepare(`
    SELECT er.relationship_type, em.entity_id, em.name, em.type, em.lei, em.country
    FROM entity_relationships er
    JOIN entity_master em ON em.entity_id = er.child_entity_id
    WHERE er.parent_entity_id = ?
    LIMIT 20
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
async function handleEntity(env, entityId) {
  const id = parseInt(entityId, 10);
  if (!Number.isInteger(id) || id <= 0) return err('Invalid entity_id', 400);

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

  if (!entity) return json({ error: 'Not found' }, 404);

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

  return json({ entity: { ...entity, ...(entity.type === 'fund' ? { fund_manager } : {}) } });
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
async function handleInstruments(env, entityId) {
  const id = parseInt(entityId, 10);
  if (!Number.isInteger(id) || id <= 0) return err('Invalid entity_id', 400);

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
      if (instrumentsMatch) return await handleInstruments(env, instrumentsMatch[1]);

      const issuerPanelsMatch = path.match(/^\/api\/entities\/(\d+)\/issuer-panels$/);
      if (issuerPanelsMatch) return await handleIssuerPanels(env, issuerPanelsMatch[1]);

      const exposureMatch = path.match(/^\/api\/entities\/(\d+)\/exposure$/);
      if (exposureMatch) return await handleExposure(env, exposureMatch[1]);

      return err('Not found', 404);

    } catch (e) {
      console.error('[entities-api] Error:', e.message);
      return json({ error: 'Internal error' }, 500);
    }
  }
};
