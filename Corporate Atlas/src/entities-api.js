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
async function handleEtfExposure(env, entityId) {
  const id = parseInt(entityId, 10);
  if (!Number.isInteger(id) || id <= 0) return err('Invalid entity_id', 400);

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
    WHERE eem.entity_id = ?
    ORDER BY eem.weight_sum DESC
    LIMIT 50
  `).bind(id).all();

  return json({ exposures: rows.results ?? [] });
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

      const exposureMatch = path.match(/^\/api\/entities\/(\d+)\/exposure$/);
      if (exposureMatch) return await handleExposure(env, exposureMatch[1]);

      return err('Not found', 404);

    } catch (e) {
      console.error('[entities-api] Error:', e.message);
      return json({ error: 'Internal error' }, 500);
    }
  }
};
