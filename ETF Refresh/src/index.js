const CACHE_VERSION = "v9";

// RESTORED 9 August 2026 (regression fix — the 5 August MA-AUG-004 stale-route
// cleanup audited ma-*.js files for callers of the removed directUrl passthrough
// but missed index.html's own inline <script> block, where pfetch() — the
// shared helper behind loadNews()/loadChartTab() in ma-market.js, fetchSym()
// in ma-data.js, and fetchFund() in ma-modal.js — builds
// `${MY_WORKER_URL}/?url=...`). Deliberately NOT the old generic open
// passthrough (that was a real SSRF-style concern, correctly removed): any
// hostname outside this list is rejected before proxyText() ever runs, so
// proxyText()'s unrestricted non-Yahoo fallback branch (still used by the
// FMP-backed routes below) is never reachable through this param. Scoped to
// exactly what pfetch()'s callers request today — feeds.finance.yahoo.com
// (RSS news) and query2.finance.yahoo.com (chart/quote data) — narrower than
// proxyText()'s own internal allowedHosts (which also covers query1/finance/
// news.yahoo.com for the /search and /symbol routes further down).
const PFETCH_ALLOWED_HOSTS = ['feeds.finance.yahoo.com', 'query2.finance.yahoo.com'];

/**
 * Builds meta.freshness and meta.coverage for a single ETF.
 * No additional D1 queries — all inputs come from fields already fetched.
 * filing_date is used as asOfDate (fund_snapshot_monthly.filing_date).
 */
function buildFcMeta(asOfDate, coverageStatus, coverageDepth) {
  let freshnessStatus = 'unknown';
  if (asOfDate) {
    const daysDiff = Math.floor(
      (Date.now() - new Date(asOfDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    freshnessStatus = daysDiff <= 90 ? 'current'
      : daysDiff <= 180 ? 'aging'
      : 'stale';
  }

  const depthLabel = coverageDepth === 0 ? 'directory_only'
    : coverageDepth === 1 ? 'single_month'
    : coverageDepth === 2 ? 'multi_month'
    : coverageDepth === 3 ? 'seasoned'
    : null;

  return {
    freshness: {
      status: freshnessStatus,
      asOfDate: asOfDate ?? null
    },
    coverage: {
      status: coverageStatus ?? null,
      depth: depthLabel
    }
  };
}

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const params = url.searchParams;

    const symbol = params.get("symbol");
    const search = params.get("search");
    const fundsymbol = params.get("fundsymbol");
    const dcf = params.get("dcf");
    const etflist = params.get("etflist") || url.pathname === "/api/etf-list";
    const etfholdings = params.get("etfholdings") || (url.pathname === "/api/etf-holdings" ? params.get("symbol") : null);
    const etfprospectus = params.get("etfprospectus") || (url.pathname === "/api/etf-prospectus" ? params.get("symbol") : null);

    // SEC User-Agent — set SEC_USER_AGENT in Cloudflare Worker env vars, or uses default
    const secUa =
      (env && env.SEC_USER_AGENT) ||
      "MeridianAtlas contact@meridianatlas.com";

    try {

      if (url.pathname === '/api/ops-health' && request.method === 'GET') {
        const todayKey = `writes_today_${new Date().toISOString().slice(0, 10)}`;

        const [pipelineRows, coverageRows, bootstrapRows, enrichmentRows, writesRow] = await Promise.all([
          env.DB.prepare(
            `SELECT key, value FROM holdings_pipeline_state
             WHERE key IN ('etf_offset', 'last_full_run', 'last_run_status', ?)`
          ).bind(todayKey).all(),
          env.DB.prepare(
            `SELECT coverage_depth, COUNT(*) as cnt
             FROM etf_master
             WHERE coverage_status = 'deep'
             GROUP BY coverage_depth
             ORDER BY coverage_depth`
          ).all(),
          env.DB.prepare(`SELECT key, value FROM edgar_bootstrap_state ORDER BY key`).all(),
          env.DB.prepare(
            `SELECT gleif_enrichment_version, COUNT(*) as cnt
             FROM entity_master
             GROUP BY gleif_enrichment_version
             ORDER BY gleif_enrichment_version`
          ).all(),
          env.DB.prepare(
            `SELECT key, value FROM holdings_pipeline_state
             WHERE key LIKE 'writes_today_%'
             ORDER BY key DESC LIMIT 1`
          ).first()
        ]);

        const pipelineMap = Object.fromEntries(
          (pipelineRows.results || []).map(r => [r.key, r.value])
        );

        const coverageMap = Object.fromEntries(
          (coverageRows.results || []).map(r => [r.coverage_depth, r.cnt])
        );

        const bootstrapMap = Object.fromEntries(
          (bootstrapRows.results || []).map(r => [r.key, r.value])
        );

        const enrichmentByVersion = Object.fromEntries(
          (enrichmentRows.results || []).map(r => [r.gleif_enrichment_version, r.cnt])
        );
        const enrichmentTotal = (enrichmentRows.results || []).reduce((s, r) => s + (r.cnt || 0), 0);

        const writesToday = writesRow ? parseInt(writesRow.value, 10) || 0 : 0;

        return new Response(JSON.stringify({
          pipeline: {
            offset: parseInt(pipelineMap.etf_offset || '0', 10),
            total: 244,
            last_run: pipelineMap.last_full_run || null,
            last_status: pipelineMap.last_run_status || null,
            writes_today: writesToday,
            writes_limit: 100000,
            writes_guard: 80000
          },
          coverage: {
            null_depth: coverageMap[null] ?? coverageMap['null'] ?? 0,
            depth_1: coverageMap[1] ?? 0,
            depth_2_plus: Object.entries(coverageMap)
              .filter(([k]) => k !== 'null' && k !== null && parseInt(k, 10) >= 2)
              .reduce((s, [, v]) => s + v, 0),
            total_deep: 244
          },
          bootstrap: {
            current_cik: bootstrapMap.cik_offset ? parseInt(bootstrapMap.cik_offset, 10) : null,
            discovery_threshold: 36405
          },
          enrichment: {
            version_1_pending: enrichmentByVersion[1] ?? 0,
            version_2_complete: enrichmentByVersion[2] ?? 0,
            total: enrichmentTotal
          },
          snapshot_at: new Date().toISOString()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // REMOVED 5 August 2026 (stale-route cleanup, MA-AUG-004): /api/etf-bootstrap-status
      // handler removed — confirmed via repo-wide search to have no caller anywhere
      // (frontend or otherwise), and confirmed with the Founder that it isn't used
      // manually either. edgar_bootstrap_state/etf_master are untouched; only this
      // dead route was removed.

      if (etflist) {
        try {
          const wantFcMeta = params.get('meta') === 'fc';

          // A4: join with latest snapshot filing date for freshness badge
          const { results } = await env.DB.prepare(
            `SELECT em.ticker, em.name, em.issuer, em.asset_class, em.index_name,
                    em.net_assets, em.coverage_status, em.has_nport,
                    em.series_id, em.coverage_depth,
                    fsm.filing_date as latest_filing_date
             FROM etf_master em
             LEFT JOIN (
               SELECT series_id, filing_date,
                      ROW_NUMBER() OVER (PARTITION BY series_id ORDER BY report_month DESC) as rn
               FROM fund_snapshot_monthly
             ) fsm ON fsm.series_id = em.series_id AND fsm.rn = 1
             ORDER BY em.ticker ASC`
          ).all();

          // v2: single JOIN for meta=fc freshness+coverage across all ETFs
          let fcMetaMap = null;
          if (wantFcMeta) {
            const { results: fcRows } = await env.DB.prepare(`
              SELECT e.series_id, e.coverage_status, e.coverage_depth,
                     s.filing_date as as_of_date
              FROM etf_master e
              LEFT JOIN (
                SELECT series_id, MAX(filing_date) as filing_date
                FROM fund_snapshot_monthly
                GROUP BY series_id
              ) s ON e.series_id = s.series_id
              WHERE e.coverage_status = 'deep'
            `).all();
            fcMetaMap = new Map((fcRows || []).map(r => [r.series_id, r]));
          }

          const etfs = results.map(row => {
            const etf = {
              ticker:         row.ticker,
              name:           row.name,
              issuer:         row.issuer,
              assetClass:     row.asset_class,
              index:          row.index_name,
              netAssets:      row.net_assets,
              coverageStatus: (row.coverage_status || '').toLowerCase(),
              hasNport:       row.has_nport,
              dataFreshness:  _dataFreshness(row.latest_filing_date)  // A4
            };
            if (wantFcMeta && fcMetaMap) {
              const fc = fcMetaMap.get(row.series_id);
              etf.meta = buildFcMeta(
                fc?.as_of_date ?? row.latest_filing_date ?? null,
                row.coverage_status,
                row.coverage_depth ?? null
              );
            }
            return etf;
          });

          return new Response(JSON.stringify(etfs), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: 'Failed to load ETF list' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      }

      if (url.pathname === '/api/etf-snapshot') {
        const sym = params.get('symbol')?.toUpperCase().trim();
        if (!sym) return json({ error: 'symbol required' }, 400, corsHeaders);

        const etfRow = await env.DB.prepare(
          `SELECT series_id, name, coverage_status, coverage_depth FROM etf_master WHERE ticker = ?`
        ).bind(sym).first();

        if (!etfRow) return json({ error: 'ETF not found' }, 404, corsHeaders);

        const { results } = await env.DB.prepare(`
          SELECT * FROM fund_snapshot_monthly
          WHERE series_id = ?
          ORDER BY report_month DESC
          LIMIT 3
        `).bind(etfRow.series_id).all();

        // A4: data quality signals on latest snapshot
        const latest = results[0] || null;
        const holdingsAsOf = latest?.filing_date || null;
        const dataFreshness = _dataFreshness(holdingsAsOf);

        const responseBody = {
          ticker: sym,
          snapshots: results,
          holdings_as_of: holdingsAsOf,               // A4
          holdings_count: latest?.holdings_count || 0, // A4
          data_freshness: dataFreshness               // A4
        };

        if (params.get('meta') === 'fc') {
          responseBody.meta = buildFcMeta(holdingsAsOf, etfRow.coverage_status, etfRow.coverage_depth ?? null);
        }

        return new Response(JSON.stringify(responseBody), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (url.pathname === '/api/etf-holdings-stored') {
        const sym   = params.get('symbol')?.toUpperCase().trim();
        const month = params.get('month'); // optional YYYY-MM
        if (!sym) return json({ error: 'symbol required' }, 400, corsHeaders);

        const etfRow = await env.DB.prepare(
          `SELECT series_id, name, coverage_status, coverage_depth FROM etf_master WHERE ticker = ?`
        ).bind(sym).first();

        if (!etfRow) return json({ error: 'ETF not found' }, 404, corsHeaders);

        // A1: latest month filtered to snapshot_status = 'complete'
        let targetMonth = month;
        if (!targetMonth) {
          const latest = await env.DB.prepare(`
            SELECT report_month FROM fund_holdings_monthly
            WHERE series_id = ? AND snapshot_status = 'complete'
            ORDER BY report_month DESC LIMIT 1
          `).bind(etfRow.series_id).first();
          if (!latest) return json({ error: 'No stored holdings yet', ticker: sym }, 404, corsHeaders);
          targetMonth = latest.report_month;
        }

        // A1: no LIMIT — full set. A2: include asset_cat for bond detection.
        const { results: holdings } = await env.DB.prepare(`
          SELECT security_name, cusip, isin, security_ticker,
                 position_value, weight_pct, shares, asset_cat,
                 issuer_country, is_restricted
          FROM fund_holdings_monthly
          WHERE series_id = ? AND report_month = ?
          ORDER BY weight_pct DESC
        `).bind(etfRow.series_id, targetMonth).all();

        const snapshot = await env.DB.prepare(`
          SELECT net_assets, total_assets, holdings_count,
                 monthly_return_1, filing_date, period_end
          FROM fund_snapshot_monthly
          WHERE series_id = ? AND report_month = ?
        `).bind(etfRow.series_id, targetMonth).first();

        // A4: data freshness based on filing date
        const holdingsAsOf = snapshot?.filing_date || null;
        const dataFreshness = _dataFreshness(holdingsAsOf);

        // A2: expose alias fields; issuer_name / security_description / coupon / maturity_date
        //     are NOT in the D1 schema — returned as null (flagged in implementation notes)
        const holdingsOut = holdings.map(h => ({
          ...h,
          asset_type:           h.asset_cat,   // A2: alias
          percentage_value:     h.weight_pct,  // A2: alias
          issuer_name:          null,           // A2: not in D1 — flagged
          security_description: null,           // A2: not in D1 — flagged
          coupon:               null,           // A2: not in D1 — flagged
          maturity_date:        null            // A2: not in D1 — flagged
        }));

        const holdingsResponseBody = {
          ticker: sym,
          name: etfRow.name,
          report_month:   targetMonth,
          holdings_count: holdingsOut.length,   // A1: from array, not snapshot
          holdings_as_of: holdingsAsOf,         // A4
          data_freshness: dataFreshness,        // A4
          snapshot: snapshot || null,
          holdings: holdingsOut
        };

        if (params.get('meta') === 'fc') {
          holdingsResponseBody.meta = buildFcMeta(holdingsAsOf, etfRow.coverage_status, etfRow.coverage_depth ?? null);
        }

        return new Response(JSON.stringify(holdingsResponseBody), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (url.pathname === '/api/etf-changes') {
        const sym = params.get('symbol')?.toUpperCase().trim();
        if (!sym) return json({ error: 'symbol required' }, 400, corsHeaders);

        const etfRow = await env.DB.prepare(
          `SELECT series_id, name, coverage_status, coverage_depth FROM etf_master WHERE ticker = ?`
        ).bind(sym).first();

        if (!etfRow) return json({ error: 'ETF not found' }, 404, corsHeaders);

        const months = await env.DB.prepare(`
          SELECT DISTINCT report_month
          FROM fund_holdings_monthly
          WHERE series_id = ?
          ORDER BY report_month DESC
          LIMIT 2
        `).bind(etfRow.series_id).all();

        const monthList = (months.results || []).map(r => r.report_month);
        if (monthList.length < 2) {
          return new Response(JSON.stringify({
            ticker: sym,
            error: 'insufficient_data',
            message: 'Need at least 2 months of holdings data to compute changes.',
            months_available: monthList.length
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const currentMonth  = monthList[0];
        const previousMonth = monthList[1];

        const newPositions = await env.DB.prepare(`
          SELECT c.security_name, c.cusip, c.security_ticker,
                 c.weight_pct, c.position_value, c.asset_cat
          FROM fund_holdings_monthly c
          WHERE c.series_id = ? AND c.report_month = ?
            AND NOT EXISTS (
              SELECT 1 FROM fund_holdings_monthly p
              WHERE p.series_id = c.series_id
                AND p.report_month = ?
                AND (p.cusip = c.cusip OR (p.cusip IS NULL AND p.security_name = c.security_name))
            )
          ORDER BY c.weight_pct DESC
          LIMIT 50
        `).bind(etfRow.series_id, currentMonth, previousMonth).all();

        const exitedPositions = await env.DB.prepare(`
          SELECT p.security_name, p.cusip, p.security_ticker,
                 p.weight_pct as prev_weight, p.position_value, p.asset_cat
          FROM fund_holdings_monthly p
          WHERE p.series_id = ? AND p.report_month = ?
            AND NOT EXISTS (
              SELECT 1 FROM fund_holdings_monthly c
              WHERE c.series_id = p.series_id
                AND c.report_month = ?
                AND (c.cusip = p.cusip OR (c.cusip IS NULL AND c.security_name = p.security_name))
            )
          ORDER BY p.weight_pct DESC
          LIMIT 50
        `).bind(etfRow.series_id, previousMonth, currentMonth).all();

        const weightChanges = await env.DB.prepare(`
          SELECT
            c.security_name,
            MAX(c.cusip) as cusip,
            c.security_ticker,
            c.weight_pct as current_weight,
            p.weight_pct as prev_weight,
            (c.weight_pct - p.weight_pct) as weight_change,
            c.asset_cat
          FROM fund_holdings_monthly c
          JOIN fund_holdings_monthly p
            ON p.series_id = c.series_id
            AND p.report_month = ?
            AND (
              (c.cusip = p.cusip AND c.cusip != '000000000' AND c.cusip IS NOT NULL)
              OR (c.security_name = p.security_name AND (c.cusip = '000000000' OR c.cusip IS NULL))
            )
          WHERE c.series_id = ? AND c.report_month = ?
            AND ABS(c.weight_pct - p.weight_pct) > 0.01
          GROUP BY c.security_name
          ORDER BY ABS(MAX(c.weight_pct) - MAX(p.weight_pct)) DESC
          LIMIT 20
        `).bind(previousMonth, etfRow.series_id, currentMonth).all();

        const changesResponseBody = {
          ticker: sym,
          name: etfRow.name,
          current_month:    currentMonth,
          previous_month:   previousMonth,
          new_positions:    newPositions.results    || [],
          exited_positions: exitedPositions.results || [],
          weight_changes:   weightChanges.results   || []
        };

        if (params.get('meta') === 'fc') {
          // Use the most recent filing month's date as asOfDate
          const latestSnap = await env.DB.prepare(
            `SELECT filing_date FROM fund_snapshot_monthly WHERE series_id = ? ORDER BY report_month DESC LIMIT 1`
          ).bind(etfRow.series_id).first();
          changesResponseBody.meta = buildFcMeta(
            latestSnap?.filing_date ?? null,
            etfRow.coverage_status,
            etfRow.coverage_depth ?? null
          );
        }

        return new Response(JSON.stringify(changesResponseBody), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (url.pathname === '/api/etf-overlap') {
        const symA = params.get('a')?.toUpperCase().trim();
        const symB = params.get('b')?.toUpperCase().trim();
        if (!symA || !symB) {
          return json({ error: 'Two symbols required: ?a=SPY&b=IVV' }, 400, corsHeaders);
        }
        if (symA === symB) {
          return json({ error: 'Symbols must be different' }, 400, corsHeaders);
        }

        const [etfA, etfB] = await Promise.all([
          env.DB.prepare(`SELECT ticker, name, series_id, coverage_status, coverage_depth FROM etf_master WHERE ticker = ?`).bind(symA).first(),
          env.DB.prepare(`SELECT ticker, name, series_id, coverage_status, coverage_depth FROM etf_master WHERE ticker = ?`).bind(symB).first(),
        ]);

        if (!etfA) return json({ error: `ETF not found: ${symA}` }, 404, corsHeaders);
        if (!etfB) return json({ error: `ETF not found: ${symB}` }, 404, corsHeaders);
        if (!etfA.series_id) return json({ error: `${symA} has no N-PORT data` }, 400, corsHeaders);
        if (!etfB.series_id) return json({ error: `${symB} has no N-PORT data` }, 400, corsHeaders);

        const [monthA, monthB] = await Promise.all([
          env.DB.prepare(`SELECT report_month FROM fund_holdings_monthly WHERE series_id = ? ORDER BY report_month DESC LIMIT 1`).bind(etfA.series_id).first(),
          env.DB.prepare(`SELECT report_month FROM fund_holdings_monthly WHERE series_id = ? ORDER BY report_month DESC LIMIT 1`).bind(etfB.series_id).first(),
        ]);

        if (!monthA) return json({ error: `No stored holdings for ${symA} yet` }, 404, corsHeaders);
        if (!monthB) return json({ error: `No stored holdings for ${symB} yet` }, 404, corsHeaders);

        const shared = await env.DB.prepare(`
          SELECT
            a.security_name,
            a.cusip,
            a.security_ticker,
            a.weight_pct  as weight_a,
            b.weight_pct  as weight_b,
            MIN(a.weight_pct, b.weight_pct) as overlap_weight,
            a.asset_cat,
            a.issuer_country
          FROM fund_holdings_monthly a
          JOIN fund_holdings_monthly b
            ON b.series_id = ?
            AND b.report_month = ?
            AND (
              (a.cusip = b.cusip AND a.cusip != '000000000' AND a.cusip IS NOT NULL AND a.cusip != '')
              OR (a.security_name = b.security_name AND (a.cusip IS NULL OR a.cusip = '000000000' OR a.cusip = ''))
            )
          WHERE a.series_id = ?
            AND a.report_month = ?
            AND a.weight_pct > 0
            AND b.weight_pct > 0
          GROUP BY a.security_name
          ORDER BY overlap_weight DESC
          LIMIT 100
        `).bind(etfB.series_id, monthB.report_month, etfA.series_id, monthA.report_month).all();

        const sharedRows = shared.results || [];
        const overlapPct = sharedRows.reduce((s, r) => s + (r.overlap_weight || 0), 0);

        const [totalA, totalB] = await Promise.all([
          env.DB.prepare(`SELECT SUM(weight_pct) as total FROM fund_holdings_monthly WHERE series_id = ? AND report_month = ? AND weight_pct > 0`).bind(etfA.series_id, monthA.report_month).first(),
          env.DB.prepare(`SELECT SUM(weight_pct) as total FROM fund_holdings_monthly WHERE series_id = ? AND report_month = ? AND weight_pct > 0`).bind(etfB.series_id, monthB.report_month).first(),
        ]);

        const countryOverlap = await env.DB.prepare(`
          SELECT a.issuer_country,
                 SUM(a.weight_pct) as weight_a,
                 SUM(b.weight_pct) as weight_b
          FROM fund_holdings_monthly a
          JOIN fund_holdings_monthly b
            ON b.series_id = ? AND b.report_month = ?
            AND b.issuer_country = a.issuer_country
          WHERE a.series_id = ? AND a.report_month = ?
            AND a.issuer_country IS NOT NULL
          GROUP BY a.issuer_country
          ORDER BY (SUM(a.weight_pct) + SUM(b.weight_pct)) DESC
          LIMIT 10
        `).bind(etfB.series_id, monthB.report_month, etfA.series_id, monthA.report_month).all();

        const wantFcMetaOverlap = params.get('meta') === 'fc';
        let snapA = null, snapB = null;
        if (wantFcMetaOverlap) {
          [snapA, snapB] = await Promise.all([
            env.DB.prepare(`SELECT filing_date FROM fund_snapshot_monthly WHERE series_id = ? ORDER BY report_month DESC LIMIT 1`).bind(etfA.series_id).first(),
            env.DB.prepare(`SELECT filing_date FROM fund_snapshot_monthly WHERE series_id = ? ORDER BY report_month DESC LIMIT 1`).bind(etfB.series_id).first(),
          ]);
        }

        const etfAOut = { ticker: symA, name: etfA.name, report_month: monthA.report_month };
        const etfBOut = { ticker: symB, name: etfB.name, report_month: monthB.report_month };
        if (wantFcMetaOverlap) {
          etfAOut.meta = buildFcMeta(snapA?.filing_date ?? null, etfA.coverage_status, etfA.coverage_depth ?? null);
          etfBOut.meta = buildFcMeta(snapB?.filing_date ?? null, etfB.coverage_status, etfB.coverage_depth ?? null);
        }

        return new Response(JSON.stringify({
          etf_a: etfAOut,
          etf_b: etfBOut,
          overlap_pct:     parseFloat(overlapPct.toFixed(2)),
          shared_count:    sharedRows.length,
          total_weight_a:  parseFloat((totalA?.total || 0).toFixed(2)),
          total_weight_b:  parseFloat((totalB?.total || 0).toFixed(2)),
          shared_holdings: sharedRows,
          country_overlap: countryOverlap.results || []
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (url.pathname === '/api/etf-compare') {
        const symbolsParam = params.get('symbols') || '';
        const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 3);

        if (symbols.length < 2) {
          return json({ error: 'At least 2 symbols required: ?symbols=SPY,IVV' }, 400, corsHeaders);
        }

        const results = await Promise.all(symbols.map(async sym => {
          const etf = await env.DB.prepare(
            `SELECT ticker, name, issuer, asset_class, index_name, series_id, net_assets, coverage_status, coverage_depth
             FROM etf_master WHERE ticker = ?`
          ).bind(sym).first();

          if (!etf) return { ticker: sym, error: 'not_found' };

          const snapshot = await env.DB.prepare(
            `SELECT net_assets, total_assets, holdings_count, monthly_return_1,
                    monthly_return_2, monthly_return_3, derivatives_flag,
                    securities_lending_flag, filing_date, period_end, report_month
             FROM fund_snapshot_monthly WHERE series_id = ?
             ORDER BY report_month DESC LIMIT 1`
          ).bind(etf.series_id || '').first();

          const top10 = await env.DB.prepare(
            `SELECT security_name, security_ticker, cusip, weight_pct, asset_cat
             FROM fund_holdings_monthly
             WHERE series_id = ?
               AND report_month = (
                 SELECT report_month FROM fund_holdings_monthly
                 WHERE series_id = ? ORDER BY report_month DESC LIMIT 1
               )
             ORDER BY weight_pct DESC LIMIT 10`
          ).bind(etf.series_id || '', etf.series_id || '').all();

          const countries = await env.DB.prepare(
            `SELECT issuer_country, SUM(weight_pct) as total_weight
             FROM fund_holdings_monthly
             WHERE series_id = ?
               AND report_month = (
                 SELECT report_month FROM fund_holdings_monthly
                 WHERE series_id = ? ORDER BY report_month DESC LIMIT 1
               )
               AND issuer_country IS NOT NULL
             GROUP BY issuer_country
             ORDER BY total_weight DESC LIMIT 5`
          ).bind(etf.series_id || '', etf.series_id || '').all();

          const concentration = await env.DB.prepare(
            `SELECT
               SUM(CASE WHEN rn <= 10 THEN weight_pct ELSE 0 END) as top10_conc,
               MAX(weight_pct) as largest_weight,
               COUNT(*) as holdings_count
             FROM (
               SELECT weight_pct, ROW_NUMBER() OVER (ORDER BY weight_pct DESC) as rn
               FROM fund_holdings_monthly
               WHERE series_id = ?
                 AND report_month = (
                   SELECT report_month FROM fund_holdings_monthly
                   WHERE series_id = ? ORDER BY report_month DESC LIMIT 1
                 )
                 AND weight_pct > 0
             )`
          ).bind(etf.series_id || '', etf.series_id || '').first();

          const etfOut = {
            ticker:          etf.ticker,
            name:            etf.name,
            issuer:          etf.issuer,
            asset_class:     etf.asset_class,
            index_name:      etf.index_name,
            coverage_status: (etf.coverage_status || '').toLowerCase(),
            snapshot:        snapshot || null,
            top10:           top10.results || [],
            countries:       countries.results || [],
            concentration:   concentration || null
          };
          if (params.get('meta') === 'fc') {
            etfOut.meta = buildFcMeta(snapshot?.filing_date ?? null, etf.coverage_status, etf.coverage_depth ?? null);
          }
          return etfOut;
        }));

        // Compute pairwise overlap scores
        const overlapScores = [];
        for (let i = 0; i < symbols.length; i++) {
          for (let j = i + 1; j < symbols.length; j++) {
            const a = results[i];
            const b = results[j];
            if (a.error || b.error || !a.snapshot || !b.snapshot) continue;

            const etfA = await env.DB.prepare(`SELECT series_id FROM etf_master WHERE ticker = ?`).bind(a.ticker).first();
            const etfB = await env.DB.prepare(`SELECT series_id FROM etf_master WHERE ticker = ?`).bind(b.ticker).first();
            if (!etfA?.series_id || !etfB?.series_id) continue;

            const monthA = a.snapshot.report_month;
            const monthB = b.snapshot.report_month;

            const overlap = await env.DB.prepare(`
              SELECT SUM(MIN(aa.weight_pct, bb.weight_pct)) as overlap_pct
              FROM fund_holdings_monthly aa
              JOIN fund_holdings_monthly bb
                ON bb.series_id = ? AND bb.report_month = ?
                AND (
                  (aa.cusip = bb.cusip AND aa.cusip != '000000000' AND aa.cusip IS NOT NULL AND aa.cusip != '')
                  OR (aa.security_name = bb.security_name AND (aa.cusip IS NULL OR aa.cusip = '000000000' OR aa.cusip = ''))
                )
              WHERE aa.series_id = ? AND aa.report_month = ?
                AND aa.weight_pct > 0 AND bb.weight_pct > 0
            `).bind(etfB.series_id, monthB, etfA.series_id, monthA).first();

            overlapScores.push({
              ticker_a:    a.ticker,
              ticker_b:    b.ticker,
              overlap_pct: parseFloat((overlap?.overlap_pct || 0).toFixed(2))
            });
          }
        }

        return new Response(JSON.stringify({
          symbols,
          etfs:           results,
          overlap_scores: overlapScores
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (url.pathname === '/api/etf-exposure') {
        const stockTicker = params.get('stock')?.toUpperCase().trim();
        const country     = params.get('country')?.toUpperCase().trim();
        const topN        = Math.min(parseInt(params.get('limit') || '50', 10), 100);

        if (!stockTicker && !country) {
          return json({ error: 'Provide ?stock=NVDA or ?country=US' }, 400, corsHeaders);
        }

        // Check that any holdings data exists at all
        const anyHoldings = await env.DB.prepare(
          `SELECT 1 FROM fund_holdings_monthly WHERE snapshot_status = 'complete' LIMIT 1`
        ).first();

        if (!anyHoldings) {
          return json({ error: 'No holdings data available yet' }, 404, corsHeaders);
        }

        let exposureRows, totalFundsExposed, totalAssetsExposed;

        if (stockTicker) {
          // A3: alias lookup — resolve company-name aliases before searching holdings
          let searchTerm = stockTicker;
          let aliasUsed = false;
          let resolvedTo = null;
          try {
            const aliasRow = await env.DB.prepare(
              `SELECT canonical_name FROM etf_aliases WHERE UPPER(TRIM(alias)) = UPPER(TRIM(?))`
            ).bind(stockTicker).first();
            if (aliasRow) {
              searchTerm = aliasRow.canonical_name;
              aliasUsed = true;
              resolvedTo = aliasRow.canonical_name;
            }
          } catch (_) { /* etf_aliases table may not exist yet — fall back to original */ }

          const rows = await env.DB.prepare(`
            SELECT
              h.ticker        as etf_ticker,
              m.name          as etf_name,
              m.net_assets,
              m.issuer,
              m.asset_class,
              h.weight_pct,
              h.position_value,
              h.security_name,
              h.cusip,
              h.report_month
            FROM fund_holdings_monthly h
            JOIN etf_master m ON m.ticker = h.ticker
            WHERE h.report_month = (
                SELECT MAX(report_month)
                FROM fund_holdings_monthly
                WHERE series_id = h.series_id
                AND snapshot_status = 'complete'
              )
              AND (
                UPPER(h.security_ticker) = ?
                OR UPPER(h.security_name) LIKE ?
              )
              AND h.weight_pct > 0
            ORDER BY h.weight_pct DESC
            LIMIT ?
          `).bind(searchTerm, `%${searchTerm}%`, topN).all();

          exposureRows = rows.results || [];

          const agg = await env.DB.prepare(`
            SELECT
              COUNT(DISTINCT h.ticker) as fund_count,
              SUM(m.net_assets)        as total_assets
            FROM fund_holdings_monthly h
            JOIN etf_master m ON m.ticker = h.ticker
            WHERE h.report_month = (
                SELECT MAX(report_month)
                FROM fund_holdings_monthly
                WHERE series_id = h.series_id
                AND snapshot_status = 'complete'
              )
              AND (
                UPPER(h.security_ticker) = ?
                OR UPPER(h.security_name) LIKE ?
              )
              AND h.weight_pct > 0
          `).bind(searchTerm, `%${searchTerm}%`).first();

          totalFundsExposed  = agg?.fund_count || 0;
          totalAssetsExposed = agg?.total_assets || 0;

          const trend = await env.DB.prepare(`
            SELECT
              h.report_month,
              COUNT(DISTINCT h.ticker) as fund_count,
              AVG(h.weight_pct)        as avg_weight
            FROM fund_holdings_monthly h
            WHERE (
                UPPER(h.security_ticker) = ?
                OR UPPER(h.security_name) LIKE ?
              )
              AND h.weight_pct > 0
            GROUP BY h.report_month
            ORDER BY h.report_month DESC
            LIMIT 3
          `).bind(searchTerm, `%${searchTerm}%`).all();

          const stockResponseBody = {
            search_type:          'stock',
            query:                stockTicker,
            alias_used:           aliasUsed,    // A3
            resolved_to:          resolvedTo,   // A3
            total_funds_exposed:  totalFundsExposed,
            total_assets_exposed: totalAssetsExposed,
            etfs:                 exposureRows,
            trend:                trend.results || []
          };
          if (params.get('meta') === 'fc') {
            // Attach freshness context: most recent snapshot date across all exposed ETFs
            const latestSnap = await env.DB.prepare(`
              SELECT MAX(filing_date) as filing_date FROM fund_snapshot_monthly
              WHERE series_id IN (
                SELECT DISTINCT series_id FROM fund_holdings_monthly
                WHERE (UPPER(security_ticker) = ? OR UPPER(security_name) LIKE ?)
                  AND weight_pct > 0
              )
            `).bind(searchTerm, `%${searchTerm}%`).first();
            stockResponseBody.meta = buildFcMeta(latestSnap?.filing_date ?? null, null, null);
          }
          return new Response(JSON.stringify(stockResponseBody), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

        } else {
          const rows = await env.DB.prepare(`
            SELECT
              h.ticker        as etf_ticker,
              m.name          as etf_name,
              m.net_assets,
              m.issuer,
              m.asset_class,
              SUM(h.weight_pct)     as country_weight,
              COUNT(*)              as holding_count,
              h.report_month
            FROM fund_holdings_monthly h
            JOIN etf_master m ON m.ticker = h.ticker
            WHERE h.report_month = (
                SELECT MAX(report_month)
                FROM fund_holdings_monthly
                WHERE series_id = h.series_id
                AND snapshot_status = 'complete'
              )
              AND UPPER(h.issuer_country) = ?
              AND h.weight_pct > 0
            GROUP BY h.ticker
            ORDER BY country_weight DESC
            LIMIT ?
          `).bind(country, topN).all();

          exposureRows = rows.results || [];

          const agg = await env.DB.prepare(`
            SELECT
              COUNT(DISTINCT h.ticker) as fund_count,
              SUM(m.net_assets)        as total_assets
            FROM fund_holdings_monthly h
            JOIN etf_master m ON m.ticker = h.ticker
            WHERE h.report_month = (
                SELECT MAX(report_month)
                FROM fund_holdings_monthly
                WHERE series_id = h.series_id
                AND snapshot_status = 'complete'
              )
              AND UPPER(h.issuer_country) = ?
              AND h.weight_pct > 0
            GROUP BY h.ticker
          `).bind(country).first();

          totalFundsExposed  = exposureRows.length;
          totalAssetsExposed = agg?.total_assets || 0;

          const countryResponseBody = {
            search_type:          'country',
            query:                country,
            total_funds_exposed:  totalFundsExposed,
            total_assets_exposed: totalAssetsExposed,
            etfs:                 exposureRows,
            trend:                []
          };
          if (params.get('meta') === 'fc') {
            const latestCountrySnap = await env.DB.prepare(`
              SELECT MAX(filing_date) as filing_date FROM fund_snapshot_monthly
              WHERE series_id IN (
                SELECT DISTINCT series_id FROM fund_holdings_monthly
                WHERE UPPER(issuer_country) = ? AND weight_pct > 0
              )
            `).bind(country).first();
            countryResponseBody.meta = buildFcMeta(latestCountrySnap?.filing_date ?? null, null, null);
          }
          return new Response(JSON.stringify(countryResponseBody), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      if (url.pathname === '/api/universe-changes') {
        const scope  = params.get('scope')  || 'universe';
        const issuer = params.get('issuer') || null;
        const limit  = Math.min(
          parseInt(params.get('limit') || '20', 10), 50
        );

        // Get most recent computed month pair
        const latest = await env.DB.prepare(`
          SELECT current_month, previous_month, computed_at
          FROM universe_changes_monthly
          ORDER BY computed_at DESC
          LIMIT 1
        `).first();

        if (!latest) {
          return new Response(JSON.stringify({
            error: 'insufficient_data',
            message: 'Universe changes not yet computed. ' +
              'Pipeline must complete at least 2 months of ' +
              'holdings data before this feature is available.',
            new_positions:    [],
            exited_positions: [],
            top_increases:    [],
            top_decreases:    [],
            universe_stats:   null
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { current_month, previous_month } = latest;

        // Four cheap indexed lookups — no heavy computation at request time
        const [newPos, exited, increases, decreases, stats] =
          await Promise.all([
            env.DB.prepare(`
              SELECT security_name, cusip, security_ticker,
                asset_cat, fund_count, total_weight,
                avg_weight, total_change
              FROM universe_changes_monthly
              WHERE current_month = ? AND change_type = ?
              ORDER BY fund_count DESC, total_weight DESC
              LIMIT ?
            `).bind(current_month, 'new_position', limit).all(),

            env.DB.prepare(`
              SELECT security_name, cusip, security_ticker,
                asset_cat, fund_count, total_weight,
                avg_weight, total_change
              FROM universe_changes_monthly
              WHERE current_month = ? AND change_type = ?
              ORDER BY fund_count DESC, total_weight DESC
              LIMIT ?
            `).bind(current_month, 'exited', limit).all(),

            env.DB.prepare(`
              SELECT security_name, cusip, security_ticker,
                asset_cat, fund_count, total_weight,
                avg_weight, total_change
              FROM universe_changes_monthly
              WHERE current_month = ? AND change_type = ?
              ORDER BY total_change DESC
              LIMIT ?
            `).bind(current_month, 'increased', limit).all(),

            env.DB.prepare(`
              SELECT security_name, cusip, security_ticker,
                asset_cat, fund_count, total_weight,
                avg_weight, total_change
              FROM universe_changes_monthly
              WHERE current_month = ? AND change_type = ?
              ORDER BY total_change ASC
              LIMIT ?
            `).bind(current_month, 'decreased', limit).all(),

            env.DB.prepare(`
              SELECT
                COUNT(DISTINCT series_id) as etf_count,
                COUNT(*)                  as total_holdings
              FROM fund_holdings_monthly
              WHERE report_month = ?
                AND snapshot_status = 'complete'
            `).bind(current_month).first()
          ]);

        const universeResponseBody = {
          scope,
          current_month,
          previous_month,
          computed_at:      latest.computed_at,
          universe_stats:   stats,
          new_positions:    newPos.results      || [],
          exited_positions: exited.results      || [],
          top_increases:    increases.results   || [],
          top_decreases:    decreases.results   || []
        };

        if (params.get('meta') === 'fc') {
          const latestUniverseSnap = await env.DB.prepare(
            `SELECT MAX(filing_date) as filing_date FROM fund_snapshot_monthly WHERE report_month = ?`
          ).bind(current_month).first();
          universeResponseBody.meta = buildFcMeta(latestUniverseSnap?.filing_date ?? null, null, null);
        }

        return new Response(JSON.stringify(universeResponseBody), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // REMOVED 5 August 2026 (stale-route cleanup, MA-AUG-004): /api/phase-readiness
      // handler removed — confirmed no caller anywhere in the codebase, and confirmed
      // with the Founder it isn't used manually either. holdings-pipeline.js still
      // writes phase_readiness_cache into holdings_pipeline_state — that write logic
      // is untouched, deliberately out of scope here; it's just no longer readable
      // via this dead API route.

      if (url.pathname === '/api/13f-search') {
        const manager = (params.get('manager') || '').trim();
        if (!manager) return json({ error: 'manager required' }, 400, corsHeaders);

        // company_tickers.json only lists exchange-listed stocks — private hedge funds
        // (Coatue, Citadel, etc.) are not there. Use EDGAR EFTS which covers all 13F filers.
        const searchUrl =
          `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(manager)}%22&forms=13F-HR`;

        let eftsRes;
        try {
          eftsRes = await secFetch(searchUrl, secUa);
        } catch (e) {
          return json({ error: 'SEC EFTS search failed', detail: e.message }, 502, corsHeaders);
        }

        if (!eftsRes.ok) {
          const preview = await safeText(eftsRes);
          return json({ error: 'SEC EFTS search unavailable', status: eftsRes.status, preview: preview.slice(0, 180) }, 502, corsHeaders);
        }

        const eftsData = await eftsRes.json();
        const hits = (eftsData?.hits?.hits) || [];

        if (!hits.length) {
          return json({ error: 'manager_not_found', manager }, 404, corsHeaders);
        }

        // Deduplicate by CIK — return the first distinct filer.
        // EFTS _source shape: { ciks: ["0001135730"], display_names: ["COATUE MANAGEMENT LLC  (CIK ...)"] }
        const seen = new Set();
        const candidates = [];
        for (const hit of hits) {
          const src = hit?._source || {};
          const rawCik = (Array.isArray(src.ciks) ? src.ciks[0] : null) || '';
          const cikNum = parseInt(rawCik, 10);
          if (!cikNum || !Number.isFinite(cikNum) || seen.has(cikNum)) continue;
          seen.add(cikNum);
          // strip the " (CIK XXXXXXXXXX)" suffix from display_names if present
          const rawName = (Array.isArray(src.display_names) ? src.display_names[0] : '') || manager;
          const cleanName = rawName.replace(/\s*\(CIK\s+\d+\)\s*$/i, '').trim() || manager;
          candidates.push({
            cik:  String(cikNum).padStart(10, '0'),
            name: cleanName
          });
        }

        if (!candidates.length) {
          return json({ error: 'manager_not_found', manager }, 404, corsHeaders);
        }

        const top = candidates[0];
        return json({
          manager_query: manager,
          cik:           top.cik,
          name:          top.name,
          ticker:        null,
          alternatives:  candidates.slice(1, 5)
        }, 200, corsHeaders);
      }

      if (url.pathname === '/api/13f-filings') {
        const raw = (params.get('cik') || '').trim();
        if (!/^[0-9]{1,10}$/.test(raw)) return json({ error: 'invalid_cik' }, 400, corsHeaders);
        const cik10 = String(Math.trunc(Number(raw))).padStart(10, '0');
        const subUrl = `https://data.sec.gov/submissions/CIK${cik10}.json`;
        const res = await secFetch(subUrl, secUa);
        if (!res.ok) {
          const preview = await safeText(res);
          return json({ error: 'SEC submissions unavailable', status: res.status, preview: preview.slice(0, 180) }, 502, corsHeaders);
        }
        const submissions = await res.json();
        const allFilings = normalizeRecentFilings(submissions, String(Math.trunc(Number(raw))), 50);
        const filings = allFilings.filter(f => f.form === '13F-HR');
        return json({
          cik: cik10,
          name: submissions.name || null,
          filings,
          provider: 'SEC-EDGAR',
          lastUpdated: new Date().toISOString()
        }, 200, corsHeaders);
      }

      if (etfholdings) {
        return await handleEtfHoldings(etfholdings, env, ctx, corsHeaders);
      }

      if (etfprospectus) {
        return await handleEtfProspectus(etfprospectus, env, ctx, corsHeaders);
      }

      // REMOVED 5 August 2026 (stale-route cleanup, MA-AUG-004): the secfilings
      // param/handler removed — SEC filing fetching now goes through the dedicated
      // meridian-filings Worker (ma-13f.js/ma-entities.js's WORKER_FILINGS_URL), not
      // this one. Confirmed no caller anywhere in the codebase, and confirmed with
      // the Founder it isn't used manually either. handleSecFilings() and
      // fetchSecTickerRegistry() below are removed too since this was their only
      // caller.

      if (dcf) {
        if (!env.FMP_API_KEY) {
          return json({ error: "FMP_API_KEY not configured" }, 500, corsHeaders);
        }

        const allowedSymbols = new Set([
          "AAPL","TSLA","AMZN","MSFT","NVDA","GOOGL","META","NFLX","JPM","V","BAC","PYPL","DIS","T","PFE","COST",
          "INTC","KO","TGT","NKE","SPY","BA","BABA","XOM","WMT","GE","CSCO","VZ","JNJ","CVX","PLTR","SQ","SHOP",
          "SBUX","SOFI","HOOD","RBLX","SNAP","AMD","UBER","FDX","ABBV","ETSY","MRNA","LMT","GM","F","LCID","CCL",
          "DAL","UAL","AAL","TSM","SONY","ET","MRO","COIN","RIVN","RIOT","CPRX","VWO","SPYG","NOK","ROKU","VIAC",
          "ATVI","BIDU","DOCU","ZM","PINS","TLRY","WBA","MGM","NIO","C","GS","WFC","ADBE","PEP","UNH","CARR","HCA",
          "TWTR","BILI","SIRI","FUBO","RKT"
        ]);

        const sym = dcf.toUpperCase().trim();
        if (!allowedSymbols.has(sym)) {
          return json({ error: "Symbol not supported on current FMP plan", symbol: sym }, 400, corsHeaders);
        }

        const apiKey = env.FMP_API_KEY;

        // Batch 5: Check edge cache before firing 8 FMP calls
        const _dcfCkRead = new Request(`https://meridian-cache/dcf/${CACHE_VERSION}/${sym}`, { method: 'GET' });
        const _dcfCkReadResult = await caches.default.match(_dcfCkRead);
        if (_dcfCkReadResult) {
          const cachedBody = await _dcfCkReadResult.text();
          return new Response(cachedBody, { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const profileUrl = `https://financialmodelingprep.com/stable/profile?symbol=${encodeURIComponent(sym)}&apikey=${encodeURIComponent(apiKey)}`;
        const quoteUrl = `https://financialmodelingprep.com/stable/quote?symbol=${encodeURIComponent(sym)}&apikey=${encodeURIComponent(apiKey)}`;
        const incomeUrl = `https://financialmodelingprep.com/stable/income-statement?symbol=${encodeURIComponent(sym)}&apikey=${encodeURIComponent(apiKey)}`;
        const balanceUrl = `https://financialmodelingprep.com/stable/balance-sheet-statement?symbol=${encodeURIComponent(sym)}&apikey=${encodeURIComponent(apiKey)}`;
        const cashFlowUrl = `https://financialmodelingprep.com/stable/cash-flow-statement?symbol=${encodeURIComponent(sym)}&apikey=${encodeURIComponent(apiKey)}`;
        const dcfUrl = `https://financialmodelingprep.com/api/v3/discounted-cash-flow/${encodeURIComponent(sym)}?apikey=${encodeURIComponent(apiKey)}`;
        const keyMetricsTtmUrl = `https://financialmodelingprep.com/stable/key-metrics-ttm?symbol=${encodeURIComponent(sym)}&apikey=${encodeURIComponent(apiKey)}`;
        const sharesFloatUrl = `https://financialmodelingprep.com/stable/shares-float-all?symbol=${encodeURIComponent(sym)}&apikey=${encodeURIComponent(apiKey)}`;

        const responses = await Promise.all([
          fetch(profileUrl),
          fetch(quoteUrl),
          fetch(incomeUrl),
          fetch(balanceUrl),
          fetch(cashFlowUrl),
          fetch(dcfUrl),
          fetch(keyMetricsTtmUrl),
          fetch(sharesFloatUrl)
        ]);

        const [
          profileJson,
          quoteJson,
          incomeJson,
          balanceJson,
          cashFlowJson,
          dcfJson,
          keyMetricsTtmJson,
          sharesFloatJson,
        ] = await Promise.all(responses.map(r => safeJson(r)));

        const p = first(profileJson);
        const q = first(quoteJson);
        const i = first(incomeJson);
        const b = first(balanceJson);
        const c = first(cashFlowJson);
        const d = first(dcfJson);
        const kt = first(keyMetricsTtmJson);

        const sfa = Array.isArray(sharesFloatJson)
          ? sharesFloatJson.find(row => String(row?.symbol || "").toUpperCase() === sym)
          : null;

        const allEmpty =
          !p && !q && !i && !b && !c && !d && !kt && !sfa;

        if (allEmpty) {
          return json({
            error: "Upstream FMP returned no usable data. Daily API quota may be exceeded.",
            symbol: sym
          }, 503, corsHeaders);
        }

        const currentPrice = pickNum(q?.price, d?.price);

        const sfaOutstanding = pickNum(
          sfa?.outstandingShares,
          sfa?.sharesOutstanding
        );

        const sharesOutstanding = pickNum(
          sfaOutstanding,
          q?.sharesOutstanding,
          p?.sharesOutstanding,
          kt?.sharesOutstandingTTM,
          kt?.sharesOutstanding,
          d?.sharesOutstanding
        );

        let marketCap = null;
        if (currentPrice && sharesOutstanding) {
          marketCap = currentPrice * sharesOutstanding;
        } else {
          marketCap = pickNum(q?.marketCap, p?.mktCap);
        }

        let revenue = pickNum(
          i?.revenue,
          kt?.revenueTTM,
          kt?.totalRevenueTTM
        );

        if (revenue === null) {
          const evToRev = pickNum(
            kt?.enterpriseValueOverRevenueTTM,
            kt?.evToRevenueTTM,
            d?.enterpriseValueOverRevenue
          );
          const enterpriseValue = pickNum(
            kt?.enterpriseValue,
            marketCap
          );
          if (evToRev && enterpriseValue) {
            revenue = enterpriseValue / evToRev;
          }
        }

        const ebitda = num(i?.ebitda);
        const ebit = num(i?.operatingIncome);
        const depreciation = num(c?.depreciationAndAmortization);
        const capex = Math.abs(num(c?.capitalExpenditure) || 0);
        const operatingCashFlow = num(c?.operatingCashFlow);

        const cashAndShortTermInvestments = pickNum(
          b?.cashAndShortTermInvestments,
          b?.cashAndCashEquivalents,
          b?.cash
        );
        const receivables = pickNum(
          b?.netReceivables,
          b?.accountsReceivables,
          b?.receivables
        );
        const inventories = pickNum(b?.inventory, b?.inventories);
        const payables = pickNum(b?.accountPayables, b?.payables);
        const totalDebt = pickNum(b?.totalDebt, b?.longTermDebt);

        const out = {
          symbol: sym,
          name: pick(p?.companyName, p?.name, sym),
          currentPrice,
          marketCap,
          sharesOutstanding,
          sharesSource: sfa ? `shares-float-all:${sfa.symbol}` : "quote/profile/metrics",
          sharesDate: sfa?.date || null,
          revenue,
          fmpDCF: pickNum(d?.dcf, d?.DCF),
          assumptions: {
            revenueGrowthPct: 10.94,
            ebitdaPct: revenue ? ((ebitda / revenue) * 100) : null,
            depreciationAndAmortizationPct: revenue ? ((depreciation / revenue) * 100) : null,
            cashAndShortTermInvestmentsPct: revenue ? ((cashAndShortTermInvestments / revenue) * 100) : null,
            receivablesPct: revenue ? ((receivables / revenue) * 100) : null,
            inventoriesPct: revenue ? ((inventories / revenue) * 100) : null,
            payablePct: revenue ? ((payables / revenue) * 100) : null,
            ebitPct: revenue ? ((ebit / revenue) * 100) : null,
            capitalExpenditurePct: revenue ? ((capex / revenue) * 100) : null,
            operatingCashFlowPct: revenue ? ((operatingCashFlow / revenue) * 100) : null,
            taxRate: 15.00,
            longTermGrowthRate: 2.5,
            costOfDebt: 3.64,
            costOfEquity: 9.51,
            marketRiskPremium: 4.72,
            beta: pickNum(q?.beta, p?.beta, 1),
            riskFreeRate: 3.64,
            totalDebt: totalDebt || 0,
            cash: cashAndShortTermInvestments || 0
          },
          provider: "FMP",
          lastUpdated: new Date().toISOString()
        };
        // Batch 5: cache DCF data for 30 minutes (financial statements rarely change intraday)
        const dcfResponse = new Response(JSON.stringify(out), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "s-maxage=1800" }
        });
        const dcfCacheKey = new Request(`https://meridian-cache/dcf/${CACHE_VERSION}/${sym}`, { method: 'GET' });
        if (ctx && ctx.waitUntil) ctx.waitUntil(caches.default.put(dcfCacheKey, dcfResponse.clone()));
        return dcfResponse;
      }

      if (fundsymbol) {
        if (!env.FMP_API_KEY) {
          return json({ error: "FMP_API_KEY not configured" }, 500, corsHeaders);
        }

        const sym = fundsymbol.toUpperCase().trim();
        const apiKey = env.FMP_API_KEY;

        // Batch 5: Check edge cache before firing 10 FMP calls
        const _fundCkRead = new Request(`https://meridian-cache/fundsymbol/${sym}`, { method: 'GET' });
        const _fundCkReadResult = await caches.default.match(_fundCkRead);
        if (_fundCkReadResult) {
          const cachedBody = await _fundCkReadResult.text();
          return new Response(cachedBody, { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const profileUrl = `https://financialmodelingprep.com/stable/profile?symbol=${encodeURIComponent(sym)}&apikey=${encodeURIComponent(apiKey)}`;
        const quoteUrl = `https://financialmodelingprep.com/stable/quote?symbol=${encodeURIComponent(sym)}&apikey=${encodeURIComponent(apiKey)}`;
        const ratiosTtmUrl = `https://financialmodelingprep.com/stable/ratios-ttm?symbol=${encodeURIComponent(sym)}&apikey=${encodeURIComponent(apiKey)}`;
        const keyMetricsTtmUrl = `https://financialmodelingprep.com/stable/key-metrics-ttm?symbol=${encodeURIComponent(sym)}&apikey=${encodeURIComponent(apiKey)}`;
        const ratiosUrl = `https://financialmodelingprep.com/stable/ratios?symbol=${encodeURIComponent(sym)}&apikey=${encodeURIComponent(apiKey)}`;
        const incomeUrl = `https://financialmodelingprep.com/stable/income-statement?symbol=${encodeURIComponent(sym)}&apikey=${encodeURIComponent(apiKey)}`;
        const balanceUrl = `https://financialmodelingprep.com/stable/balance-sheet-statement?symbol=${encodeURIComponent(sym)}&apikey=${encodeURIComponent(apiKey)}`;
        const priceTargetSummaryUrl = `https://financialmodelingprep.com/stable/price-target-summary?symbol=${encodeURIComponent(sym)}&apikey=${encodeURIComponent(apiKey)}`;
        const priceTargetConsensusUrl = `https://financialmodelingprep.com/stable/price-target-consensus?symbol=${encodeURIComponent(sym)}&apikey=${encodeURIComponent(apiKey)}`;
        const gradesUrl = `https://financialmodelingprep.com/stable/grades?symbol=${encodeURIComponent(sym)}&apikey=${encodeURIComponent(apiKey)}`;

        const responses = await Promise.all([
          fetch(profileUrl),
          fetch(quoteUrl),
          fetch(ratiosTtmUrl),
          fetch(keyMetricsTtmUrl),
          fetch(ratiosUrl),
          fetch(incomeUrl),
          fetch(balanceUrl),
          fetch(priceTargetSummaryUrl),
          fetch(priceTargetConsensusUrl),
          fetch(gradesUrl)
        ]);

        const [
          profileJson,
          quoteJson,
          ratiosTtmJson,
          keyMetricsTtmJson,
          ratiosJson,
          incomeJson,
          balanceJson,
          priceTargetSummaryJson,
          priceTargetConsensusJson,
          gradesJson
        ] = await Promise.all(responses.map(r => safeJson(r)));

        const p = first(profileJson);
        const q = first(quoteJson);
        const rt = first(ratiosTtmJson);
        const kt = first(keyMetricsTtmJson);
        const r = first(ratiosJson);
        const i = first(incomeJson);
        const b = first(balanceJson);
        const ts = first(priceTargetSummaryJson);
        const tc = first(priceTargetConsensusJson);
        const grades = Array.isArray(gradesJson) ? gradesJson : (gradesJson ? [gradesJson] : []);

        if (!p && !q && !rt && !kt && !r && !i && !b && !ts && !tc && !grades.length) {
          return json({ error: "No data returned from FMP", symbol: sym }, 404, corsHeaders);
        }

        const gradeBuckets = bucketGrades(grades.slice(0, 50));
        const derivedRec = deriveRecommendation(gradeBuckets);

        const out = {
          symbol: pick(p?.symbol, q?.symbol, i?.symbol, sym),
          name: pick(p?.companyName, p?.name, q?.name, sym),
          currency: pick(q?.currency, p?.currency, i?.reportedCurrency, "USD"),
          exchange: pick(q?.exchange, p?.exchangeShortName, p?.exchange, null),

          sector: pick(p?.sector, null),
          industry: pick(p?.industry, null),
          description: pick(p?.description, null),
          employees: num(p?.fullTimeEmployees),
          website: pick(p?.website, null),
          ceo: pick(p?.ceo, null),

          price: num(q?.price),
          pct: num(q?.changesPercentage),
          chg: num(q?.change),
          marketCap: pickNum(q?.marketCap, p?.mktCap),

          peTrailing: pickNum(
            rt?.priceToEarningsRatioTTM,
            rt?.priceToEarningsRatio,
            kt?.peRatioTTM,
            kt?.priceToEarningsRatioTTM,
            q?.pe,
            r?.priceToEarningsRatio
          ),
          peForward: pickNum(
            q?.forwardPE,
            q?.forwardPe,
            kt?.forwardPE,
            kt?.forwardPe,
            kt?.forwardPeRatio,
            rt?.forwardPE,
            rt?.forwardPe,
            rt?.forwardPeRatio,
            rt?.forwardPriceToEarningsRatio,
            rt?.priceToEarningsRatioTTM,
            q?.pe
          ),
          eps: pickNum(
            rt?.netIncomePerShareTTM,
            rt?.netIncomePerShare,
            kt?.netIncomePerShareTTM,
            kt?.netIncomePerShare,
            q?.eps
          ),
          epsForward: pickNum(
            q?.epsFuture,
            q?.epsForward,
            kt?.epsForward,
            kt?.forwardEps,
            rt?.epsForward,
            rt?.forwardEps
          ),
          priceToBook: pickNum(
            rt?.priceToBookRatioTTM,
            rt?.priceToBookRatio,
            kt?.priceToBookRatioTTM,
            kt?.pbRatioTTM,
            kt?.priceToBookRatio,
            r?.priceToBookRatio
          ),
          evToRevenue: pickNum(
            kt?.enterpriseValueOverRevenueTTM,
            rt?.evToRevenueTTM,
            (function() {
              const mCap = pickNum(q?.marketCap, p?.mktCap);
              const rev = pickNum(kt?.revenueTTM, i?.revenue);
              return (mCap && rev && rev !== 0) ? (mCap / rev).toFixed(2) : null;
            })()
          ),
          evToEbitda: pickNum(
            rt?.enterpriseValueOverEBITDATTM,
            rt?.evToEbitdaTTM,
            rt?.enterpriseValueMultipleTTM,
            rt?.enterpriseValueMultiple,
            kt?.enterpriseValueOverEBITDATTM,
            kt?.evToEbitdaTTM,
            kt?.enterpriseValueMultipleTTM,
            kt?.enterpriseValueMultiple,
            r?.enterpriseValueMultiple,
            r?.evToEbitdaTTM
          ),

          totalRevenue: pickNum(
            kt?.revenueTTM,
            kt?.totalRevenueTTM,
            i?.revenue
          ),
          revenueGrowth: pickNum(
            kt?.revenueGrowthTTM,
            rt?.revenueGrowthTTM,
            i?.revenueGrowth,
            kt?.revenuePerShareGrowthTTM,
            kt?.growthRevenueTTM,
            (p?.lastDiv > 0 ? 0 : null)
          ),
          grossMargins: pickNum(
            rt?.grossProfitMarginTTM,
            rt?.grossProfitMargin,
            r?.grossProfitMargin
          ),
          ebitdaMargins: pickNum(
            rt?.ebitdaMarginTTM,
            rt?.ebitdaMargin,
            r?.ebitdaMargin
          ),
          profitMargin: pickNum(
            rt?.netProfitMarginTTM,
            rt?.netProfitMargin,
            r?.netProfitMargin
          ),
          operatingMargins: pickNum(
            rt?.operatingProfitMarginTTM,
            rt?.operatingProfitMargin,
            r?.operatingProfitMargin,
            r?.ebitMargin
          ),

          roe: pickNum(
            kt?.roeTTM,
            kt?.returnOnEquityTTM,
            rt?.returnOnEquityTTM,
            r?.returnOnEquity,
            r?.returnOnEquityRatio
          ),
          roa: pickNum(
            kt?.roaTTM,
            kt?.returnOnAssetsTTM,
            rt?.returnOnAssetsTTM,
            r?.returnOnAssets,
            r?.returnOnAssetsRatio
          ),

          ebitda: pickNum(
            i?.ebitda,
            kt?.ebitdaTTM
          ),
          totalCash: pickNum(
            b?.cashAndCashEquivalents,
            b?.cash,
            b?.cashAndShortTermInvestments
          ),
          totalDebt: pickNum(
            b?.totalDebt,
            b?.netDebt,
            b?.longTermDebt
          ),

          debtToEquity: pickNum(
            rt?.debtToEquityRatioTTM,
            rt?.debtToEquityRatio,
            kt?.debtToEquityTTM,
            r?.debtToEquityRatio
          ),
          currentRatio: pickNum(
            rt?.currentRatioTTM,
            rt?.currentRatio,
            kt?.currentRatioTTM,
            r?.currentRatio
          ),
          quickRatio: pickNum(
            rt?.quickRatioTTM,
            rt?.quickRatio,
            kt?.quickRatioTTM,
            r?.quickRatio
          ),

          targetMean: (function() {
            const primary = pickNum(ts?.targetMean, tc?.targetMean, ts?.priceTargetAverage, tc?.priceTargetAverage);
            if (primary) return primary;
            if (Array.isArray(grades) && grades.length > 0) {
              const validGrades = grades.filter(g => num(g.priceTarget) > 0).slice(0, 10);
              if (validGrades.length > 0) {
                const sum = validGrades.reduce((acc, g) => acc + num(g.priceTarget), 0);
                return Number((sum / validGrades.length).toFixed(2));
              }
            }
            return null;
          })(),

          targetHigh: pickNum(ts?.targetHigh, tc?.targetHigh, ts?.priceTargetHigh),
          targetLow: pickNum(ts?.targetLow, tc?.targetLow, ts?.priceTargetLow),

          targetUpside: (function() {
            const mean = pickNum(ts?.targetMean, tc?.targetMean, ts?.priceTargetAverage);
            const recoveryMean = (Array.isArray(grades) && grades.length > 0)
              ? grades.filter(g => num(g.priceTarget) > 0)[0]?.priceTarget
              : null;
            const finalMean = mean || recoveryMean;
            const currentPrice = num(q?.price);
            return (finalMean && currentPrice) ? (finalMean / currentPrice) - 1 : null;
          })(),
          recommendation: pick(
            tc?.consensusRating,
            ts?.consensusRating,
            tc?.rating,
            ts?.rating,
            derivedRec
          ),
          analystCount: pickNum(
            tc?.numberOfAnalysts,
            tc?.analystCount,
            tc?.analysts,
            ts?.numberOfAnalysts,
            ts?.analystCount,
            grades.length || null
          ),

          strongBuy: gradeBuckets.strongBuy,
          buy: gradeBuckets.buy,
          hold: gradeBuckets.hold,
          sell: gradeBuckets.sell,
          strongSell: gradeBuckets.strongSell,

          week52High: pickNum(q?.yearHigh, q?.fiftyTwoWeekHigh),
          week52Low: pickNum(q?.yearLow, q?.fiftyTwoWeekLow),
          beta: pickNum(
            rt?.betaTTM,
            rt?.beta,
            kt?.beta,
            p?.beta
          ),
          dividend: pickNum(
            rt?.dividendYieldTTM,
            rt?.dividendYield,
            r?.dividendYield,
            q?.lastDividend,
            p?.lastDiv
          ),

          upgradeHistory: grades.slice(0, 20).map(g => ({
            epochGradeDate: g?.gradingDate
              ? new Date(g.gradingDate).getTime()
              : (g?.date ? new Date(g.date).getTime() : null),
            firm: pick(g?.gradingCompany, g?.company, g?.analystCompany, "Unknown"),
            toGrade: pick(g?.newGrade, g?.grade, g?.rating, ""),
            fromGrade: pick(g?.previousGrade, g?.oldGrade, ""),
            action: mapAction(g?.action, g?.newGrade, g?.previousGrade)
          })),

          provider: "FMP",
          lastUpdated: new Date().toISOString()
        };

        // Batch 5: cache fundsymbol response 30 min before returning
        const fundResponse = new Response(JSON.stringify(out), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 's-maxage=1800' }
        });
        const fundCacheKey = new Request('https://meridian-cache/fundsymbol/' + sym, { method: 'GET' });
        if (ctx && ctx.waitUntil) ctx.waitUntil(caches.default.put(fundCacheKey, fundResponse.clone()));
        return fundResponse;
      }

      // Batch 4: Quick profile route — 1 FMP call, cached 1 hour at edge
      const quickprofile = params.get("quickprofile");
      if (quickprofile) {
        if (!env.FMP_API_KEY) {
          return json({ error: "FMP_API_KEY not configured" }, 500, corsHeaders);
        }
        const qSym = quickprofile.toUpperCase().trim();
        if (!qSym || !/^[A-Z0-9.-]{1,12}$/.test(qSym)) {
          return json({ error: "Invalid symbol" }, 400, corsHeaders);
        }
        // Check edge cache first (keyed by symbol)
        const qpCacheKey = new Request(`https://meridian-cache/quickprofile/${qSym}`, { method: 'GET' });
        const qpCached = await caches.default.match(qpCacheKey);
        if (qpCached) {
          const body = await qpCached.text();
          return new Response(body, { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        // Fire single FMP profile call
        const profileUrl = `https://financialmodelingprep.com/stable/profile?symbol=${encodeURIComponent(qSym)}&apikey=${encodeURIComponent(env.FMP_API_KEY)}`;
        const profRes = await fetch(profileUrl);
        const profData = await safeJson(profRes);
        const p = Array.isArray(profData) ? profData[0] : (profData || null);
        const out = {
          symbol: qSym,
          name: p?.companyName || p?.name || null,
          sector: p?.sector || null,
          industry: p?.industry || null,
          exchange: p?.exchangeShortName || p?.exchange || null,
          description: p?.description || null,
          employees: p?.fullTimeEmployees ? Number(p.fullTimeEmployees) : null,
          website: p?.website || null,
          ceo: p?.ceo || null,
          country: p?.country || null,
          ipoDate: p?.ipoDate || null,
          provider: "FMP"
        };
        const qpResponse = new Response(JSON.stringify(out), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "s-maxage=3600" }
        });
        if (ctx && ctx.waitUntil) ctx.waitUntil(caches.default.put(qpCacheKey, qpResponse.clone()));
        return qpResponse;
      }

      // Batch 2: Dividend calendar route — 1 FMP call, cached 24h at edge
      const ipos = params.get("ipos");
      if (ipos) {
        const apiKey = (env.FMP_API_KEY || "").trim();
        if (!apiKey || apiKey === "undefined") {
          return json({ error: "FMP_API_KEY not configured" }, 500, corsHeaders);
        }
        // Hits the stable endpoint requested by user
        const ipoUrl = `https://financialmodelingprep.com/stable/ipos-calendar?apikey=${apiKey}`;
        const res = await cachedFmpJson(ipoUrl, ctx, 86400); // 24h cache
        const data = await safeJson(res);
        return json(Array.isArray(data) ? data : [], res.status, corsHeaders);
      }

      if (search) {
        const targetUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(search)}&lang=en-US&region=US`;
        return await proxyText(targetUrl, corsHeaders, ctx);
      }

      if (symbol) {
        const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=5m`;
        return await proxyText(targetUrl, corsHeaders, ctx);
      }

      // REMOVED 5 August 2026 (stale-route cleanup, MA-AUG-004): the directUrl
      // generic passthrough (params.get("url")) removed — confirmed no caller
      // anywhere in the codebase (the frontend's equivalent generic-URL passthrough
      // now goes through the dedicated meridian-filings Worker's /api/filing-doc,
      // not this one), and confirmed with the Founder it isn't used manually
      // either. proxyText()/secProxyText() are untouched — still used by the
      // search/symbol routes above.
      //
      // RESTORED 9 August 2026 (regression fix — see PFETCH_ALLOWED_HOSTS comment
      // at top of file): the "confirmed no caller anywhere in the codebase" check
      // above missed pfetch() in index.html's inline <script> block. Re-added as a
      // hostname-gated route, not the old open passthrough.
      const directUrl = params.get("url");
      if (directUrl) {
        let parsedDirectUrl;
        try {
          parsedDirectUrl = new URL(directUrl);
        } catch (e) {
          return new Response("Invalid URL", { status: 400, headers: corsHeaders });
        }
        if (!PFETCH_ALLOWED_HOSTS.includes(parsedDirectUrl.hostname)) {
          return new Response(JSON.stringify({ error: true, status: 403, type: 'hostname_not_allowed' }), {
            status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
        return await proxyText(directUrl, corsHeaders, ctx);
      }

      return new Response("Not Found", { status: 404, headers: corsHeaders });

    } catch (err) {
      return new Response(err.message, { status: 500, headers: corsHeaders });
    }
  }
};

// ── SEC-specific proxyText — always sends correct SEC User-Agent ──
async function secProxyText(targetUrl, secUa, corsHeaders) {
  const response = await secFetch(targetUrl, secUa);
  const data = await response.text();
  const contentType = response.headers.get("Content-Type") || "application/json";
  return new Response(data, {
    status: response.status,
    headers: { ...corsHeaders, "Content-Type": contentType }
  });
}

// REMOVED 5 August 2026 (stale-route cleanup, MA-AUG-004): handleSecFilings(),
// fetchSecTickerRegistry(), and findCikFromTickerMap() removed — all three were
// only reachable via the now-removed secfilings route (see above). secFetch(),
// normalizeRecentFilings(), and safeText() below are untouched — still shared
// by the active /api/13f-search and /api/13f-filings routes.

async function secFetch(url, userAgent) {
  const ua = userAgent || "MeridianAtlas contact@meridianatlas.com";
  return fetch(url, {
    headers: {
      "User-Agent": ua,
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache"
    }
  });
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function findCikFromTickerMapByName(mapJson, managerUpper) {
  if (!mapJson || typeof mapJson !== 'object') return null;
  const entries = Array.isArray(mapJson) ? mapJson : Object.values(mapJson);
  for (const row of entries) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    if (String(row.title || row.name || '').toUpperCase().includes(managerUpper)) {
      const cik = Number(row.cik_str != null ? row.cik_str : row.cik);
      if (!Number.isFinite(cik)) continue;
      return { cik, name: String(row.title || row.name || ''), ticker: row.ticker || null };
    }
  }
  return null;
}

function normalizeRecentFilings(submissions, numericCikStr, limit) {
  const recent = submissions && submissions.filings && submissions.filings.recent;
  if (!recent || typeof recent !== "object") return [];

  const accessionNumber = Array.isArray(recent.accessionNumber) ? recent.accessionNumber : [];
  const form = Array.isArray(recent.form) ? recent.form : [];
  const filingDate = Array.isArray(recent.filingDate) ? recent.filingDate : [];
  const reportDate = Array.isArray(recent.reportDate) ? recent.reportDate : [];
  const primaryDocument = Array.isArray(recent.primaryDocument) ? recent.primaryDocument : [];
  const primaryDocDescription = Array.isArray(recent.primaryDocDescription)
    ? recent.primaryDocDescription
    : [];

  const n = Math.max(accessionNumber.length, form.length);
  const out = [];
  const cap = Math.min(limit || 30, 50);

  for (let i = 0; i < n && out.length < cap; i++) {
    const acc = accessionNumber[i];
    const frm = form[i] != null ? String(form[i]) : "";
    if (!acc && !frm) continue;

    const accClean = String(acc || "").replace(/-/g, "");
    const prim = primaryDocument[i] ? String(primaryDocument[i]) : "";

    let link = null;
    if (accClean && prim) {
      link = `https://www.sec.gov/Archives/edgar/data/${numericCikStr}/${accClean}/${prim}`;
    } else if (acc) {
      link = `https://www.sec.gov/cgi-bin/viewer?action=view&cik=${encodeURIComponent(
        numericCikStr
      )}&accession_number=${encodeURIComponent(String(acc))}&xbrl_type=v`;
    }

    out.push({
      form: frm || "—",
      filingDate: filingDate[i] != null ? String(filingDate[i]) : "",
      reportDate: reportDate[i] != null ? String(reportDate[i]) : "",
      accessionNumber: acc != null ? String(acc) : "",
      primaryDocument: prim,
      primaryDocDescription:
        primaryDocDescription[i] != null ? String(primaryDocDescription[i]) : "",
      link:
        link ||
        `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(
          numericCikStr
        )}&owner=exclude&count=40`
    });
  }

  return out;
}

async function proxyText(targetUrl, corsHeaders, ctx) {
  const isYahoo = targetUrl.includes("yahoo.com");

  let parsedUrl;
  try { 
    parsedUrl = new URL(targetUrl); 
  } catch(e) { 
    return new Response("Invalid URL", {status:400, headers:corsHeaders}); 
  }

  if (isYahoo) {
    const allowedHosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com', 'finance.yahoo.com', 'feeds.finance.yahoo.com', 'news.yahoo.com'];
    if (!allowedHosts.includes(parsedUrl.hostname)) {
      return new Response(JSON.stringify({ error: true, status: 403, type: 'hostname_not_allowed' }), { 
        status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }

    const cache = caches.default;
    const cacheKey = new Request(parsedUrl.toString(), { method: 'GET' });
    let response = await cache.match(cacheKey);

    if (!response) {
      try {
        const headers = {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/json"
        };
        // Intentionally omitting Origin and Referer for Yahoo to avoid rate-limit tracking
        response = await fetch(parsedUrl, { headers });

        if (!response.ok) {
          return new Response(JSON.stringify({ error: true, status: response.status }), {
            status: response.status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        response = new Response(response.body, response);
        response.headers.set('Cache-Control', 's-maxage=60'); // 60-second edge cache
        for (const [k, v] of Object.entries(corsHeaders)) {
          response.headers.set(k, v);
        }
        
        if (ctx && ctx.waitUntil) {
          ctx.waitUntil(cache.put(cacheKey, response.clone()));
        }
      } catch (err) {
        return new Response(JSON.stringify({ error: true, status: 502, type: 'proxy_fetch_failed' }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    } else {
      // Return cached response with CORS headers
      response = new Response(response.body, response);
      for (const [k, v] of Object.entries(corsHeaders)) {
        response.headers.set(k, v);
      }
    }

    return response;
  }

  // FMP or other non-Yahoo URLs
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Accept": "text/html,application/json"
  };

  const response = await fetch(targetUrl, { headers });
  const data = await response.text();
  const contentType = response.headers.get("Content-Type") || "text/plain";

  return new Response(data, {
    status: response.status,
    headers: { ...corsHeaders, "Content-Type": contentType }
  });
}

// Batch 5: Reusable edge-cache wrapper for FMP routes
async function cachedFmpJson(url, ctx, ttlSeconds = 1800) {
  const cache = caches.default;
  const cacheKey = new Request(url, { method: 'GET' });
  let cached = await cache.match(cacheKey);
  if (cached) return cached;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "application/json"
    }
  });
  if (!res.ok) return res; // pass through errors uncached

  const response = new Response(res.body, res);
  response.headers.set('Cache-Control', `s-maxage=${ttlSeconds}`);
  if (ctx && ctx.waitUntil) ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

async function safeJson(resp) {
  try {
    return await resp.json();
  } catch {
    return null;
  }
}

function first(v) {
  if (Array.isArray(v)) return v[0] || null;
  return v || null;
}

function json(obj, status, corsHeaders) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

// A4: data freshness — current (≤90d), aging (91–180d), stale (181d+)
function _dataFreshness(filingDateStr) {
  if (!filingDateStr) return 'stale';
  const diff = Math.floor((Date.now() - new Date(filingDateStr).getTime()) / 86400000);
  if (diff <= 90)  return 'current';
  if (diff <= 180) return 'aging';
  return 'stale';
}

function num(v) {
  if (v === null || v === undefined || v === "" || v === "None") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pick(...vals) {
  for (const v of vals) {
    if (v !== null && v !== undefined && v !== "") return v;
  }
  return null;
}

function pickNum(...vals) {
  for (const v of vals) {
    const n = num(v);
    if (n !== null) return n;
  }
  return null;
}

function normalizeGradeText(v) {
  return String(v || "").trim().toLowerCase();
}

function classifyGrade(v) {
  const s = normalizeGradeText(v);
  if (!s) return "hold";
  if (s.includes("strong buy")) return "strongBuy";
  if (s === "buy" || s.includes("overweight") || s.includes("outperform") || s.includes("accumulate")) return "buy";
  if (s.includes("hold") || s.includes("neutral") || s.includes("market perform") || s.includes("equal weight") || s.includes("sector perform")) return "hold";
  if (s.includes("underperform") || s === "sell" || s.includes("underweight") || s.includes("reduce")) return "sell";
  if (s.includes("strong sell")) return "strongSell";
  return "hold";
}

function bucketGrades(grades) {
  const out = { strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 0 };
  for (const g of grades) {
    const key = classifyGrade(g?.newGrade || g?.grade || g?.rating);
    out[key] += 1;
  }
  return out;
}

function deriveRecommendation(b) {
  const total = (b.strongBuy || 0) + (b.buy || 0) + (b.hold || 0) + (b.sell || 0) + (b.strongSell || 0);
  if (!total) return null;

  const score =
    ((b.strongBuy || 0) * 1 +
     (b.buy || 0) * 2 +
     (b.hold || 0) * 3 +
     (b.sell || 0) * 4 +
     (b.strongSell || 0) * 5) / total;

  if (score < 1.5) return "STRONG BUY";
  if (score < 2.5) return "BUY";
  if (score < 3.5) return "HOLD";
  if (score < 4.5) return "SELL";
  return "STRONG SELL";
}

function mapAction(action, newGrade, previousGrade) {
  const a = normalizeGradeText(action);
  const ng = normalizeGradeText(newGrade);
  const pg = normalizeGradeText(previousGrade);

  if (a.includes("upgrade")) return "UP";
  if (a.includes("downgrade")) return "DOWN";
  if (a.includes("init")) return "INIT";
  if (a.includes("reiterate") || a.includes("maintain")) return "MAIN";

  if (pg && ng) {
    const order = {
      "strong buy": 1,
      "buy": 2,
      "overweight": 2,
      "outperform": 2,
      "accumulate": 2,
      "hold": 3,
      "neutral": 3,
      "market perform": 3,
      "equal weight": 3,
      "sell": 4,
      "underperform": 4,
      "underweight": 4,
      "strong sell": 5
    };

    const pScore = order[pg] ?? 3;
    const nScore = order[ng] ?? 3;

    if (nScore < pScore) return "UP";
    if (nScore > pScore) return "DOWN";
    return "MAIN";
  }

  return "MAIN";
}

// ── NEW: ETF Holdings Integration Helpers ──

// handleEtfList removed — /api/etf-list now queries D1 directly (Phase 0 migration)

async function handleEtfHoldings(ticker, env, ctx, corsHeaders) {
  const symbol = ticker.toUpperCase().trim();

  const etfRow = await env.DB.prepare(
    `SELECT ticker, name, cik, series_id, has_nport FROM etf_master WHERE ticker = ?`
  ).bind(symbol).first();

  if (!etfRow) {
    return json({ error: "UNKNOWN_ETF", message: "ETF not found." }, 404, corsHeaders);
  }

  if (!etfRow.has_nport || etfRow.series_id === null) {
    return json({ error: "NO_NPORT", message: "This ETF does not file Form N-PORT." }, 400, corsHeaders);
  }

  const cache = caches.default;
  const cacheKey = new Request(`https://meridian-cache/etf-holdings/${CACHE_VERSION}/${symbol}`, { method: 'GET' });
  let cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    return new Response(cachedResponse.body, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const secUa = (env && env.SEC_USER_AGENT) || "MeridianAtlas contact@meridianatlas.com";

  try {
    // Step 1 — Discover the latest NPORT-P filing via EFTS full-text search
    const eftsUrl = `https://efts.sec.gov/LATEST/search-index?q=%22${etfRow.series_id}%22&forms=NPORT-P&dateRange=custom&startdt=2020-01-01`;
    const searchRes = await fetch(eftsUrl, {
      headers: {
        "User-Agent": secUa,
        "Accept": "application/json"
      }
    });

    if (!searchRes.ok) {
      return json({
        error: "FETCH_ERROR",
        message: `SEC EFTS search failed with HTTP ${searchRes.status}`,
        details: `series_id: ${etfRow.series_id}`
      }, 502, corsHeaders);
    }

    const searchData = await searchRes.json();
    const hits = searchData?.hits?.hits;
    if (!hits || hits.length === 0) {
      return json({
        error: "FETCH_ERROR",
        message: "No N-PORT filings found for this ETF.",
        details: `EFTS returned zero hits for series_id ${etfRow.series_id}`
      }, 502, corsHeaders);
    }

    hits.sort((a, b) => new Date(b._source.file_date) - new Date(a._source.file_date));

    const latest = hits[0];
    const adsh = latest._source.adsh;
    const periodEnding = latest._source.period_ending || latest._source.period || "Unknown";
    const fileDate = latest._source.file_date || "Unknown";

    if (!adsh) {
      return json({
        error: "FETCH_ERROR",
        message: "Latest NPORT-P hit is missing accession number.",
        details: `series_id: ${etfRow.series_id}`
      }, 502, corsHeaders);
    }

    const strippedAdsh = adsh.replace(/-/g, "");

    // Step 2 — Fetch primary_doc.xml for this accession.
    // Use the registrant CIK from the EFTS response — always matches the EDGAR archive directory.
    const filerCik = parseInt(latest._source.ciks[0], 10).toString();
    const xmlUrl = `https://www.sec.gov/Archives/edgar/data/${filerCik}/${strippedAdsh}/primary_doc.xml`;
    const xmlRes = await fetch(xmlUrl, {
      headers: { "User-Agent": secUa, "Accept": "application/xml, text/xml" }
    });

    if (!xmlRes.ok) {
      return json({
        error: "FETCH_ERROR",
        message: `SEC XML fetch failed with HTTP ${xmlRes.status}`,
        details: `URL: ${xmlUrl}`
      }, 502, corsHeaders);
    }

    const xmlText = await xmlRes.text();
    const { holdings, fundInfo, sectorBreakdown } = parseNPortXML(xmlText, symbol);

    if (holdings.length === 0) {
      return json({
        error: "FETCH_ERROR",
        message: "Parsed 0 holdings from N-PORT XML.",
        details: "XML parsing succeeded but no <invstOrSec> elements were extracted."
      }, 502, corsHeaders);
    }

    holdings.sort((a, b) => b.weight_pct - a.weight_pct);

    const resultObj = {
      ticker: symbol,
      name: etfRow.name,
      period_ending: periodEnding,
      file_date: fileDate,
      holdings,
      fundInfo,
      sectorBreakdown
    };

    const outResponse = new Response(JSON.stringify(resultObj), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "s-maxage=86400"
      }
    });

    if (ctx && ctx.waitUntil) {
      ctx.waitUntil(cache.put(cacheKey, outResponse.clone()));
    }

    return outResponse;
  } catch (err) {
    return json({
      error: "FETCH_ERROR",
      message: "An unexpected error occurred while fetching holdings.",
      details: err.message
    }, 502, corsHeaders);
  }
}

async function handleEtfProspectus(ticker, env, ctx, corsHeaders) {
  const symbol = ticker.toUpperCase().trim();

  const etfRow = await env.DB.prepare(
    `SELECT ticker, cik FROM etf_master WHERE ticker = ?`
  ).bind(symbol).first();

  if (!etfRow || !etfRow.cik) {
    return json({ url: null }, 200, corsHeaders);
  }

  const cache = caches.default;
  const cacheKey = new Request(`https://meridian-cache/etf-prospectus/${CACHE_VERSION}/${symbol}`, { method: 'GET' });
  let cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    return new Response(cachedResponse.body, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const secUa = (env && env.SEC_USER_AGENT) || "MeridianAtlas contact@meridianatlas.com";

  try {
    const cik = etfRow.cik;
    const paddedCik = cik.replace(/^0+/, "").padStart(10, "0");
    const subUrl = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;
    
    const searchRes = await fetch(subUrl, {
      headers: {
        "User-Agent": secUa,
        "Accept": "application/json"
      }
    });

    if (!searchRes.ok) {
      return json({ url: null }, 200, corsHeaders);
    }

    const searchData = await searchRes.json();
    const recent = searchData?.filings?.recent;
    if (!recent || !Array.isArray(recent.form)) {
      return json({ url: null }, 200, corsHeaders);
    }

    const idx = recent.form.indexOf("485BPOS");
    if (idx === -1) {
      return json({ url: null }, 200, corsHeaders);
    }

    const accessionNumber = recent.accessionNumber[idx];
    const primaryDocument = recent.primaryDocument[idx];

    if (!accessionNumber || !primaryDocument) {
      return json({ url: null }, 200, corsHeaders);
    }

    const accessionNoDashes = accessionNumber.replace(/-/g, "");
    const strippedCik = cik.replace(/^0+/, "");
    const url = `https://www.sec.gov/Archives/edgar/data/${strippedCik}/${accessionNoDashes}/${primaryDocument}`;

    const resultObj = { url };
    const outResponse = new Response(JSON.stringify(resultObj), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=604800"
      }
    });

    if (ctx && ctx.waitUntil) {
      ctx.waitUntil(cache.put(cacheKey, outResponse.clone()));
    }

    return outResponse;
  } catch (err) {
    return json({ url: null }, 200, corsHeaders);
  }
}

function parseNPortXML(xmlText, symbol) {
  const holdings = [];
  const regexInvstOrSec = /<(?:\w+:)?invstOrSec(?:\s+[^>]*)?>([\s\S]*?)<\/ Maryland-Port \/? invstOrSec>|<(?:\w+:)?invstOrSec(?:\s+[^>]*)?>([\s\S]*?)<\/(?:\w+:)?invstOrSec>/gi;
  const regexInvstOrSecClean = /<(?:\w+:)?invstOrSec(?:\s+[^>]*)?>([\s\S]*?)<\/(?:\w+:)?invstOrSec>/gi;

  const getTagValue = (block, tagName) => {
    // Highly robust backslash-free regex constructors to prevent transpiler/minification escaping issues.
    // [a-zA-Z0-9_-] matches word characters and hyphens for optional namespace prefixes like "nport:"
    // [ \t\r\n] matches tag whitespaces
    // [^] matches any character including newlines (safer replacement for [\s\S])
    const rx = new RegExp("<(?:[a-zA-Z0-9_-]+:)?" + tagName + "([ \\t\\r\\n]+[^>]*)?>([^]*?)</(?:[a-zA-Z0-9_-]+:)?" + tagName + ">", "i");
    const m = block.match(rx);
    if (m) {
      const inner = m[2].trim();
      if (inner) return inner;
      const attrMatch = m[1] && m[1].match(/value\s*=\s*["']([^"']+)["']/i);
      if (attrMatch) return attrMatch[1];
      return "";
    }

    const rxSelf = new RegExp("<(?:[a-zA-Z0-9_-]+:)?" + tagName + "([ \\t\\r\\n]+[^>]*?)/?>", "i");
    const mSelf = block.match(rxSelf);
    if (mSelf && mSelf[1]) {
      const attrMatch = mSelf[1].match(/value\s*=\s*["']([^"']+)["']/i);
      if (attrMatch) return attrMatch[1];
    }

    return null;
  };

  const decodeHTMLEntities = (str) => {
    if (!str) return "";
    return str
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#039;/g, "'");
  };

  // Feature 1: Extract fundInfo from <genInfo> block (supporting namespace prefixes and optional attributes)
  const genInfoMatch = xmlText.match(/<(?:\w+:)?genInfo(?:\s+[^>]*)?>([\s\S]*?)<\/(?:\w+:)?genInfo>/i);
  const genInfoBlock = genInfoMatch ? genInfoMatch[1] : xmlText;

  // fundInfo block contains netAssets, navPerShr, shrOutstanding in real N-PORT XML
  const fundInfoMatch = xmlText.match(/<(?:\w+:)?fundInfo(?:\s+[^>]*)?>([\s\S]*?)<\/(?:\w+:)?fundInfo>/i);
  const fundInfoBlock = fundInfoMatch ? fundInfoMatch[1] : '';

  // Extract seriesLevelInfo block for lookup priority chain
  const seriesLevelInfoMatch = xmlText.match(/<(?:\w+:)?seriesLevelInfo(?:\s+[^>]*)?>([\s\S]*?)<\/(?:\w+:)?seriesLevelInfo>/i);
  const seriesLevelInfoBlock = seriesLevelInfoMatch ? seriesLevelInfoMatch[1] : '';

  // Extract all <classInfo> blocks from the XML
  const classInfoRegex = /<(?:\w+:)?classInfo(?:\s+[^>]*)?>([\s\S]*?)<\/(?:\w+:)?classInfo>/gi;
  const classInfoBlocks = [];
  let classMatch;
  while ((classMatch = classInfoRegex.exec(xmlText)) !== null) {
    classInfoBlocks.push(classMatch[1]);
  }

  // Find matching class block by ticker symbol, otherwise fallback to first classInfo block
  let matchedClassBlock = null;
  const firstClassBlock = classInfoBlocks[0] || null;

  if (symbol && classInfoBlocks.length > 0) {
    const upperSymbol = symbol.toUpperCase().trim();
    for (const block of classInfoBlocks) {
      const classTicker = getTagValue(block, "ticker");
      if (classTicker && classTicker.toUpperCase().trim() === upperSymbol) {
        matchedClassBlock = block;
        break;
      }
    }
  }

  const chosenClassBlock = matchedClassBlock || firstClassBlock;

  // Extract classId or classDesig to identify which class it is
  let classId = null;
  let classDesig = null;
  if (chosenClassBlock) {
    classId = getTagValue(chosenClassBlock, "classId");
    classDesig = getTagValue(chosenClassBlock, "classDesig");
  }

  const regName = decodeHTMLEntities(getTagValue(genInfoBlock, "regName") || "");
  const totAssetsStr = (fundInfoBlock ? getTagValue(fundInfoBlock, "totAssets") : null)
    ?? getTagValue(genInfoBlock, "totAssets");
  const totAssets = totAssetsStr ? parseFloat(totAssetsStr) : null;
  const netAssetsStr = (fundInfoBlock ? getTagValue(fundInfoBlock, "netAssets") : null)
    ?? getTagValue(genInfoBlock, "netAssets");
  const netAssets = netAssetsStr ? parseFloat(netAssetsStr) : null;

  // Helper search priority chain function for navPerShr and shrOutstanding
  const getFieldWithFallback = (fieldName) => {
    // 1. seriesLevelInfo block
    if (seriesLevelInfoBlock) {
      const val = getTagValue(seriesLevelInfoBlock, fieldName);
      if (val !== null && val !== "") return val;
    }
    // 2. Matching classInfo block by ticker symbol
    if (matchedClassBlock) {
      const val = getTagValue(matchedClassBlock, fieldName);
      if (val !== null && val !== "") return val;
    }
    // 3. First classInfo block (fallback for multi-class funds)
    if (firstClassBlock) {
      const val = getTagValue(firstClassBlock, fieldName);
      if (val !== null && val !== "") return val;
    }
    // 4. fundInfo block
    if (fundInfoBlock) {
      const val = getTagValue(fundInfoBlock, fieldName);
      if (val !== null && val !== "") return val;
    }
    // 5. genInfo block
    if (genInfoBlock) {
      const val = getTagValue(genInfoBlock, fieldName);
      if (val !== null && val !== "") return val;
    }
    // 6. Full XML document scan
    const fullXmlVal = getTagValue(xmlText, fieldName);
    if (fullXmlVal !== null && fullXmlVal !== "") return fullXmlVal;

    return null;
  };

  const navPerShrStr = getFieldWithFallback("navPerShr");
  const shrOutstandingStr = getFieldWithFallback("shrOutstanding");

  let navPerShr = (navPerShrStr !== null && !isNaN(parseFloat(navPerShrStr))) ? parseFloat(navPerShrStr) : null;
  let shrOutstanding = (shrOutstandingStr !== null && !isNaN(parseFloat(shrOutstandingStr))) ? parseFloat(shrOutstandingStr) : null;

  // Step 2 — Derive the missing value if only one is present and netAssets is available
  if (navPerShr && netAssets && !shrOutstanding) {
    shrOutstanding = netAssets / navPerShr;
  }
  if (shrOutstanding && netAssets && !navPerShr) {
    navPerShr = netAssets / shrOutstanding;
  }

  const repPdEnd = getTagValue(genInfoBlock, "repPdEnd") || "";

  const fundInfo = {
    regName,
    repPdEnd
  };
  if (totAssets !== null && !isNaN(totAssets)) {
    fundInfo.totAssets = totAssets;
  }
  if (netAssets !== null && !isNaN(netAssets)) {
    fundInfo.netAssets = netAssets;
  }
  if (navPerShr !== null && !isNaN(navPerShr)) {
    fundInfo.navPerShr = navPerShr;
  }
  if (shrOutstanding !== null && !isNaN(shrOutstanding)) {
    fundInfo.shrOutstanding = shrOutstanding;
  }

  let match;
  while ((match = regexInvstOrSecClean.exec(xmlText)) !== null) {
    const block = match[1];

    const rawName = getTagValue(block, "name") || getTagValue(block, "title");
    const name = decodeHTMLEntities(rawName || "Unknown Security");

    // Identifiers are nested inside <identifiers> block
    // ticker may not exist — many filers only provide ISIN or CUSIP
    const identifiersMatch = block.match(/<(?:[a-zA-Z0-9_-]+:)?identifiers(?:\s+[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?identifiers>/i);
    const identBlock = identifiersMatch ? identifiersMatch[1] : block;

    const ticker = getTagValue(identBlock, "ticker");
    const cusip = getTagValue(identBlock, "cusip") || getTagValue(block, "cusip");
    const isin = getTagValue(identBlock, "isin");

    const balanceStr = getTagValue(block, "balance");
    const valUSDStr = getTagValue(block, "valUSD");
    const pctValStr = getTagValue(block, "pctVal");

    const shares = balanceStr ? parseFloat(balanceStr) : null;
    const value_usd = valUSDStr ? parseFloat(valUSDStr) : null;
    const weight_pct = pctValStr ? parseFloat(pctValStr) : null;

    // Use ticker if present; otherwise null (bond/no-ticker holdings stay null)
    let finalSymbol = null;
    if (ticker) {
      finalSymbol = decodeHTMLEntities(ticker).toUpperCase();
    }

    // Feature 3: Extract assetCat — may appear as attribute or child tag
    const assetCondMatch = block.match(/<(?:[a-zA-Z0-9_-]+:)?assetConditional[^>]*assetCat="([^"]+)"/i);
    const assetCatRaw = assetCondMatch ? assetCondMatch[1] : getTagValue(block, "assetCat");
    const assetCat = assetCatRaw ? assetCatRaw.trim().toUpperCase() : "";

    // Feature 4: Bond holdings enrichment
    let couponKind = null;
    let annualizedRte = null;
    let maturityDat = null;
    let yieldVal = null;

    if (assetCat !== "EC") {
      const ck = getTagValue(block, "couponKind");
      if (ck) {
        couponKind = decodeHTMLEntities(ck).trim() || null;
      }
      const ar = getTagValue(block, "annualizedRte");
      if (ar !== null && ar !== "") {
        annualizedRte = parseFloat(ar);
      }
      const md = getTagValue(block, "maturityDat");
      if (md) {
        maturityDat = decodeHTMLEntities(md).trim() || null;
      }
      const yv = getTagValue(block, "yieldVal");
      if (yv !== null && yv !== "") {
        yieldVal = parseFloat(yv);
      }
    }

    holdings.push({
      symbol: finalSymbol,
      name,
      cusip: cusip ? decodeHTMLEntities(cusip) : null,
      isin: isin ? decodeHTMLEntities(isin) : null,
      shares: Number.isFinite(shares) ? shares : 0,
      value_usd: Number.isFinite(value_usd) ? value_usd : 0,
      weight_pct: Number.isFinite(weight_pct) ? weight_pct : 0,
      assetCat: assetCat || null,
      couponKind,
      annualizedRte: Number.isFinite(annualizedRte) ? annualizedRte : null,
      maturityDat,
      yieldVal: Number.isFinite(yieldVal) ? yieldVal : null
    });
  }

  // Feature 3: Aggregate sector breakdown
  const buckets = {
    "Equity": { weight: 0, count: 0 },
    "US Govt": { weight: 0, count: 0 },
    "Corp Bond": { weight: 0, count: 0 },
    "MBS": { weight: 0, count: 0 },
    "Cash": { weight: 0, count: 0 },
    "Other": { weight: 0, count: 0 }
  };

  let totalWeight = 0;
  for (const h of holdings) {
    const cat = h.assetCat || "";
    let label = "Other";
    if (cat === "EC") {
      label = "Equity";
    } else if (cat === "UST" || cat === "USTB") {
      label = "US Govt";
    } else if (cat === "DBT" || cat === "CORP") {
      label = "Corp Bond";
    } else if (cat === "MBS" || cat === "ABS") {
      label = "MBS";
    } else if (cat === "CASH" || cat === "MM") {
      label = "Cash";
    }
    buckets[label].weight += h.weight_pct;
    buckets[label].count += 1;
    totalWeight += h.weight_pct;
  }

  const sectorBreakdown = [];
  const labels = ["Equity", "US Govt", "Corp Bond", "MBS", "Cash", "Other"];
  let sumPct = 0;

  labels.forEach(label => {
    const b = buckets[label];
    let pct = 0;
    if (totalWeight > 0) {
      pct = (b.weight / totalWeight) * 100;
    }
    sectorBreakdown.push({
      label,
      pct: parseFloat(pct.toFixed(4)),
      count: b.count
    });
    sumPct += pct;
  });

  if (sumPct > 0) {
    let diff = 100 - sumPct;
    let maxIdx = 0;
    for (let i = 1; i < sectorBreakdown.length; i++) {
      if (sectorBreakdown[i].pct > sectorBreakdown[maxIdx].pct) {
        maxIdx = i;
      }
    }
    sectorBreakdown[maxIdx].pct = parseFloat((sectorBreakdown[maxIdx].pct + diff).toFixed(4));
  } else {
    const otherBucket = sectorBreakdown.find(b => b.label === "Other");
    if (otherBucket) {
      otherBucket.pct = 100;
    }
  }

  return { holdings, fundInfo, sectorBreakdown };
}

const etfMap = {
  "_meta": {
    "description": "Top 200 most-traded US ETFs with SEC EDGAR identifiers for N-PORT querying",
    "fields": {
      "ticker": "Market ticker symbol",
      "cik": "SEC EDGAR Central Index Key (10-digit, zero-padded) — the parent registrant/trust",
      "series_id": "SEC EDGAR Series ID for the specific fund (used in NPORT-P queries). Null for grantor trusts and commodity ETPs that file under the 1934 Act, not the 1940 Act, and therefore do not have series IDs or file N-PORT."
    },
    "notes": [
      "Grantor trusts (GLD, IAU, SLV, GDX, PDBC, USO, UNG, DBO, etc.) are registered under the Securities Act of 1933, not the Investment Company Act of 1940. They do NOT file N-PORT and have no series_id. Their CIK points directly to the trust entity.",
      "All other ETFs are registered investment companies under the 1940 Act. Their CIK is the parent trust/fund complex; series_id identifies the individual fund series within that complex.",
      "N-PORT EDGAR query pattern: https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}&type=NPORT-P&dateb=&owner=include&count=40",
      "Series-level N-PORT query: https://efts.sec.gov/LATEST/search-index?q=%22{series_id}%22&forms=NPORT-P",
      "Sources: SEC EDGAR company_tickers_mf.json, EDGAR filing index pages, N-CSRS/NPORT-P filing headers (verified May 2026)"
    ],
    "generated": "2026-05-17",
    "source_verified_via": "SEC EDGAR EDGAR company_tickers_mf.json + filing index pages"
  },
  "etfs": [
    {
      "ticker": "SPY",
      "name": "SPDR S&P 500 ETF Trust",
      "issuer": "State Street",
      "cik": "0000884394",
      "series_id": null,
      "notes": "Grantor trust (Unit Investment Trust), not a 1940 Act fund. No N-PORT. Files annual report on Form 10-K. CIK is the trust itself."
    },
    {
      "ticker": "IVV",
      "name": "iShares Core S&P 500 ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004310"
    },
    {
      "ticker": "VOO",
      "name": "Vanguard S&P 500 ETF",
      "issuer": "Vanguard / Vanguard Index Funds",
      "cik": "0000036405",
      "series_id": "S000002839"
    },
    {
      "ticker": "QQQ",
      "name": "Invesco QQQ Trust Series 1",
      "issuer": "Invesco",
      "cik": "0001067839",
      "series_id": null,
      "notes": "Unit Investment Trust under the 1940 Act (UIT). Files annual reports but does NOT file N-PORT. CIK is the trust itself."
    },
    {
      "ticker": "VTI",
      "name": "Vanguard Total Stock Market ETF",
      "issuer": "Vanguard / Vanguard Index Funds",
      "cik": "0000036405",
      "series_id": "S000002848"
    },
    {
      "ticker": "IWM",
      "name": "iShares Russell 2000 ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004344"
    },
    {
      "ticker": "GLD",
      "name": "SPDR Gold Shares",
      "issuer": "World Gold Council / State Street",
      "cik": "0001222333",
      "series_id": null,
      "notes": "Grantor trust under the 1933 Act. No N-PORT filing. CIK is the trust itself."
    },
    {
      "ticker": "TLT",
      "name": "iShares 20+ Year Treasury Bond ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004360"
    },
    {
      "ticker": "LQD",
      "name": "iShares iBoxx $ Investment Grade Corporate Bond ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004361"
    },
    {
      "ticker": "HYG",
      "name": "iShares iBoxx $ High Yield Corporate Bond ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000016772"
    },
    {
      "ticker": "EEM",
      "name": "iShares MSCI Emerging Markets ETF",
      "issuer": "BlackRock / iShares, Inc.",
      "cik": "0000930667",
      "series_id": "S000004266"
    },
    {
      "ticker": "EFA",
      "name": "iShares MSCI EAFE ETF",
      "issuer": "BlackRock / iShares, Inc.",
      "cik": "0001100663",
      "series_id": "S000004351"
    },
    {
      "ticker": "XLF",
      "name": "Financial Select Sector SPDR Fund",
      "issuer": "State Street / Select Sector SPDR Trust",
      "cik": "0001064641",
      "series_id": "S000006411"
    },
    {
      "ticker": "XLE",
      "name": "Energy Select Sector SPDR Fund",
      "issuer": "State Street / Select Sector SPDR Trust",
      "cik": "0001064641",
      "series_id": "S000006410"
    },
    {
      "ticker": "XLK",
      "name": "Technology Select Sector SPDR Fund",
      "issuer": "State Street / Select Sector SPDR Trust",
      "cik": "0001064641",
      "series_id": "S000006415"
    },
    {
      "ticker": "XLV",
      "name": "Health Care Select Sector SPDR Fund",
      "issuer": "State Street / Select Sector SPDR Trust",
      "cik": "0001064641",
      "series_id": "S000006412"
    },
    {
      "ticker": "XLU",
      "name": "Utilities Select Sector SPDR Fund",
      "issuer": "State Street / Select Sector SPDR Trust",
      "cik": "0001064641",
      "series_id": "S000006416"
    },
    {
      "ticker": "XLI",
      "name": "Industrial Select Sector SPDR Fund",
      "issuer": "State Street / Select Sector SPDR Trust",
      "cik": "0001064641",
      "series_id": "S000006413"
    },
    {
      "ticker": "XLP",
      "name": "Consumer Staples Select Sector SPDR Fund",
      "issuer": "State Street / Select Sector SPDR Trust",
      "cik": "0001064641",
      "series_id": "S000006409"
    },
    {
      "ticker": "XLY",
      "name": "Consumer Discretionary Select Sector SPDR Fund",
      "issuer": "State Street / Select Sector SPDR Trust",
      "cik": "0001064641",
      "series_id": "S000006408"
    },
    {
      "ticker": "XLB",
      "name": "Materials Select Sector SPDR Fund",
      "issuer": "State Street / Select Sector SPDR Trust",
      "cik": "0001064641",
      "series_id": "S000006414"
    },
    {
      "ticker": "XLRE",
      "name": "Real Estate Select Sector SPDR Fund",
      "issuer": "State Street / Select Sector SPDR Trust",
      "cik": "0001064641",
      "series_id": "S000051152"
    },
    {
      "ticker": "XLC",
      "name": "Communication Services Select Sector SPDR Fund",
      "issuer": "State Street / Select Sector SPDR Trust",
      "cik": "0001064641",
      "series_id": "S000062095"
    },
    {
      "ticker": "VUG",
      "name": "Vanguard Growth ETF",
      "issuer": "Vanguard / Vanguard Index Funds",
      "cik": "0000036405",
      "series_id": "S000002842"
    },
    {
      "ticker": "VTV",
      "name": "Vanguard Value ETF",
      "issuer": "Vanguard / Vanguard Index Funds",
      "cik": "0000036405",
      "series_id": "S000002840"
    },
    {
      "ticker": "VB",
      "name": "Vanguard Small-Cap ETF",
      "issuer": "Vanguard / Vanguard Index Funds",
      "cik": "0000036405",
      "series_id": "S000002845"
    },
    {
      "ticker": "VO",
      "name": "Vanguard Mid-Cap ETF",
      "issuer": "Vanguard / Vanguard Index Funds",
      "cik": "0000036405",
      "series_id": "S000002844"
    },
    {
      "ticker": "VXF",
      "name": "Vanguard Extended Market ETF",
      "issuer": "Vanguard / Vanguard Index Funds",
      "cik": "0000036405",
      "series_id": "S000002841"
    },
    {
      "ticker": "VBR",
      "name": "Vanguard Small-Cap Value ETF",
      "issuer": "Vanguard / Vanguard Index Funds",
      "cik": "0000036405",
      "series_id": "S000002847"
    },
    {
      "ticker": "VBK",
      "name": "Vanguard Small-Cap Growth ETF",
      "issuer": "Vanguard / Vanguard Index Funds",
      "cik": "0000036405",
      "series_id": "S000002846"
    },
    {
      "ticker": "VV",
      "name": "Vanguard Large-Cap ETF",
      "issuer": "Vanguard / Vanguard Index Funds",
      "cik": "0000036405",
      "series_id": "S000002843"
    },
    {
      "ticker": "VOT",
      "name": "Vanguard Mid-Cap Growth ETF",
      "issuer": "Vanguard / Vanguard Index Funds",
      "cik": "0000036405",
      "series_id": "S000012756"
    },
    {
      "ticker": "VOE",
      "name": "Vanguard Mid-Cap Value ETF",
      "issuer": "Vanguard / Vanguard Index Funds",
      "cik": "0000036405",
      "series_id": "S000012757"
    },
    {
      "ticker": "IBB",
      "name": "iShares Biotechnology ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004350"
    },
    {
      "ticker": "SOXX",
      "name": "iShares Semiconductor ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004354"
    },
    {
      "ticker": "ITOT",
      "name": "iShares Core S&P Total U.S. Stock Market ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004317"
    },
    {
      "ticker": "IWR",
      "name": "iShares Russell Mid-Cap ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004338"
    },
    {
      "ticker": "IWP",
      "name": "iShares Russell Mid-Cap Growth ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004336"
    },
    {
      "ticker": "IWN",
      "name": "iShares Russell 2000 Value ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004342"
    },
    {
      "ticker": "IWO",
      "name": "iShares Russell 2000 Growth ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004343"
    },
    {
      "ticker": "IJH",
      "name": "iShares Core S&P Mid-Cap ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004307"
    },
    {
      "ticker": "IJR",
      "name": "iShares Core S&P Small-Cap ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004313"
    },
    {
      "ticker": "IJK",
      "name": "iShares S&P Mid-Cap 400 Growth ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004308"
    },
    {
      "ticker": "IJJ",
      "name": "iShares S&P Mid-Cap 400 Value ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004309"
    },
    {
      "ticker": "IJT",
      "name": "iShares S&P Small-Cap 600 Growth ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004314"
    },
    {
      "ticker": "IGV",
      "name": "iShares Expanded Tech-Software Sector ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004355"
    },
    {
      "ticker": "IGM",
      "name": "iShares Expanded Tech Sector ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004352"
    },
    {
      "ticker": "IWC",
      "name": "iShares Micro-Cap ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004439"
    },
    {
      "ticker": "SMMD",
      "name": "iShares Russell 2500 ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000057567"
    },
    {
      "ticker": "MCHI",
      "name": "iShares MSCI China ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000031717"
    },
    {
      "ticker": "INDA",
      "name": "iShares MSCI India ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000034702"
    },
    {
      "ticker": "EWU",
      "name": "iShares MSCI United Kingdom ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000046586"
    },
    {
      "ticker": "EPU",
      "name": "iShares MSCI Peru and Global Exposure ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000024426"
    },
    {
      "ticker": "EIDO",
      "name": "iShares MSCI Indonesia ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000028553"
    },
    {
      "ticker": "ENZL",
      "name": "iShares MSCI New Zealand ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000028554"
    },
    {
      "ticker": "EPOL",
      "name": "iShares MSCI Poland ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000028556"
    },
    {
      "ticker": "EWZS",
      "name": "iShares MSCI Brazil Small-Cap ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000028677"
    },
    {
      "ticker": "EPHE",
      "name": "iShares MSCI Philippines ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000028735"
    },
    {
      "ticker": "ESGD",
      "name": "iShares ESG Aware MSCI EAFE ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000054185"
    },
    {
      "ticker": "QAT",
      "name": "iShares MSCI Qatar ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000045074"
    },
    {
      "ticker": "EWJ",
      "name": "iShares MSCI Japan ETF",
      "issuer": "BlackRock / iShares, Inc.",
      "cik": "0000930667",
      "series_id": "S000004249"
    },
    {
      "ticker": "EWZ",
      "name": "iShares MSCI Brazil ETF",
      "issuer": "BlackRock / iShares, Inc.",
      "cik": "0000930667",
      "series_id": "S000004264"
    },
    {
      "ticker": "EWG",
      "name": "iShares MSCI Germany ETF",
      "issuer": "BlackRock / iShares, Inc.",
      "cik": "0000930667",
      "series_id": "S000004269"
    },
    {
      "ticker": "EWC",
      "name": "iShares MSCI Canada ETF",
      "issuer": "BlackRock / iShares, Inc.",
      "cik": "0000930667",
      "series_id": "S000004265"
    },
    {
      "ticker": "EWT",
      "name": "iShares MSCI Taiwan ETF",
      "issuer": "BlackRock / iShares, Inc.",
      "cik": "0000930667",
      "series_id": "S000004261"
    },
    {
      "ticker": "EWH",
      "name": "iShares MSCI Hong Kong ETF",
      "issuer": "BlackRock / iShares, Inc.",
      "cik": "0000930667",
      "series_id": "S000004247"
    },
    {
      "ticker": "EWA",
      "name": "iShares MSCI Australia ETF",
      "issuer": "BlackRock / iShares, Inc.",
      "cik": "0000930667",
      "series_id": "S000004246"
    },
    {
      "ticker": "EWY",
      "name": "iShares MSCI South Korea ETF",
      "issuer": "BlackRock / iShares, Inc.",
      "cik": "0000930667",
      "series_id": "S000004258"
    },
    {
      "ticker": "EWQ",
      "name": "iShares MSCI France ETF",
      "issuer": "BlackRock / iShares, Inc.",
      "cik": "0000930667",
      "series_id": "S000004267"
    },
    {
      "ticker": "EWP",
      "name": "iShares MSCI Spain ETF",
      "issuer": "BlackRock / iShares, Inc.",
      "cik": "0000930667",
      "series_id": "S000004256"
    },
    {
      "ticker": "EWI",
      "name": "iShares MSCI Italy ETF",
      "issuer": "BlackRock / iShares, Inc.",
      "cik": "0000930667",
      "series_id": "S000004248"
    },
    {
      "ticker": "ACWI",
      "name": "iShares MSCI ACWI ETF",
      "issuer": "BlackRock / iShares, Inc.",
      "cik": "0001100663",
      "series_id": "S000021461"
    },
    {
      "ticker": "IEMG",
      "name": "iShares Core MSCI Emerging Markets ETF",
      "issuer": "BlackRock / iShares, Inc.",
      "cik": "0000930667",
      "series_id": "S000038923"
    },
    {
      "ticker": "IAU",
      "name": "iShares Gold Trust",
      "issuer": "BlackRock / iShares Delaware Trust Sponsor LLC",
      "cik": "0001278028",
      "series_id": null,
      "notes": "Grantor trust under the 1933 Act. No N-PORT. CIK is the trust itself."
    },
    {
      "ticker": "SLV",
      "name": "iShares Silver Trust",
      "issuer": "BlackRock / iShares Delaware Trust Sponsor LLC",
      "cik": "0001330568",
      "series_id": null,
      "notes": "Grantor trust under the 1933 Act. No N-PORT. CIK is the trust itself."
    },
    {
      "ticker": "AGG",
      "name": "iShares Core U.S. Aggregate Bond ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004362"
    },
    {
      "ticker": "SHY",
      "name": "iShares 1-3 Year Treasury Bond ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004357"
    },
    {
      "ticker": "IEF",
      "name": "iShares 7-10 Year Treasury Bond ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004358"
    },
    {
      "ticker": "SHV",
      "name": "iShares Short Treasury Bond ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000013694"
    },
    {
      "ticker": "MUB",
      "name": "iShares National Muni Bond ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000018861"
    },
    {
      "ticker": "MBB",
      "name": "iShares MBS ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000013702"
    },
    {
      "ticker": "PFF",
      "name": "iShares Preferred Stock & Income Securities ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000013499"
    },
    {
      "ticker": "IGSB",
      "name": "iShares 1-5 Year Investment Grade Corporate Bond ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000013697"
    },
    {
      "ticker": "IGIB",
      "name": "iShares 5-10 Year Investment Grade Corporate Bond ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000013698"
    },
    {
      "ticker": "IGLB",
      "name": "iShares 10+ Year Investment Grade Corporate Bond ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000026651"
    },
    {
      "ticker": "SRLN",
      "name": "SPDR Blackstone Senior Loan ETF",
      "issuer": "State Street / SPDR Series Trust",
      "cik": "0001516212",
      "series_id": "S000033064"
    },
    {
      "ticker": "SPYD",
      "name": "SPDR Portfolio S&P 500 High Dividend ETF",
      "issuer": "State Street / SPDR Series Trust",
      "cik": "0001064642",
      "series_id": "S000050968"
    },
    {
      "ticker": "SPTL",
      "name": "SPDR Portfolio Long Term Treasury ETF",
      "issuer": "State Street / SPDR Series Trust",
      "cik": "0001064642",
      "series_id": "S000017329"
    },
    {
      "ticker": "SPYV",
      "name": "SPDR Portfolio S&P 500 Value ETF",
      "issuer": "State Street / SPDR Series Trust",
      "cik": "0001064642",
      "series_id": "S000006985"
    },
    {
      "ticker": "SPYX",
      "name": "SPDR S&P 500 Fossil Fuel Reserves Free ETF",
      "issuer": "State Street / SPDR Series Trust",
      "cik": "0001064642",
      "series_id": "S000051701"
    },
    {
      "ticker": "MDY",
      "name": "SPDR S&P MidCap 400 ETF Trust",
      "issuer": "State Street",
      "cik": "0000916132",
      "series_id": null,
      "notes": "Unit Investment Trust (UIT). No N-PORT. CIK is the trust itself."
    },
    {
      "ticker": "DIA",
      "name": "SPDR Dow Jones Industrial Average ETF Trust",
      "issuer": "State Street",
      "cik": "0001041014",
      "series_id": null,
      "notes": "Unit Investment Trust (UIT). No N-PORT. CIK is the trust itself."
    },
    {
      "ticker": "VNQ",
      "name": "Vanguard Real Estate ETF",
      "issuer": "Vanguard / Vanguard Specialized Funds",
      "cik": "0000734383",
      "series_id": "S000002924"
    },
    {
      "ticker": "VWO",
      "name": "Vanguard FTSE Emerging Markets ETF",
      "issuer": "Vanguard / Vanguard International Equity Index Funds",
      "cik": "0000857489",
      "series_id": "S000005786"
    },
    {
      "ticker": "VXUS",
      "name": "Vanguard Total International Stock ETF",
      "issuer": "Vanguard / Vanguard Total International Stock Index Fund",
      "cik": "0000736054",
      "series_id": "S000002932"
    },
    {
      "ticker": "VEA",
      "name": "Vanguard FTSE Developed Markets ETF",
      "issuer": "Vanguard / Vanguard Tax-Managed Funds",
      "cik": "0000923202",
      "series_id": "S000004386"
    },
    {
      "ticker": "BND",
      "name": "Vanguard Total Bond Market ETF",
      "issuer": "Vanguard / Vanguard Bond Index Funds",
      "cik": "0000794105",
      "series_id": "S000002564"
    },
    {
      "ticker": "BNDX",
      "name": "Vanguard Total International Bond ETF",
      "issuer": "Vanguard / Vanguard Bond Index Funds",
      "cik": "0001532203",
      "series_id": "S000035729"
    },
    {
      "ticker": "BSV",
      "name": "Vanguard Short-Term Bond ETF",
      "issuer": "Vanguard / Vanguard Bond Index Funds",
      "cik": "0000794105",
      "series_id": "S000002563"
    },
    {
      "ticker": "BIV",
      "name": "Vanguard Intermediate-Term Bond ETF",
      "issuer": "Vanguard / Vanguard Bond Index Funds",
      "cik": "0000794105",
      "series_id": "S000002561"
    },
    {
      "ticker": "BLV",
      "name": "Vanguard Long-Term Bond ETF",
      "issuer": "Vanguard / Vanguard Bond Index Funds",
      "cik": "0000794105",
      "series_id": "S000002562"
    },
    {
      "ticker": "VCIT",
      "name": "Vanguard Intermediate-Term Corporate Bond ETF",
      "issuer": "Vanguard / Vanguard Bond Index Funds",
      "cik": "0001021882",
      "series_id": "S000026863"
    },
    {
      "ticker": "VCSH",
      "name": "Vanguard Short-Term Corporate Bond ETF",
      "issuer": "Vanguard / Vanguard Bond Index Funds",
      "cik": "0001021882",
      "series_id": "S000026862"
    },
    {
      "ticker": "VGSH",
      "name": "Vanguard Short-Term Treasury ETF",
      "issuer": "Vanguard / Vanguard Bond Index Funds",
      "cik": "0001021882",
      "series_id": "S000026859"
    },
    {
      "ticker": "VGIT",
      "name": "Vanguard Intermediate-Term Treasury ETF",
      "issuer": "Vanguard / Vanguard Bond Index Funds",
      "cik": "0001021882",
      "series_id": "S000026860"
    },
    {
      "ticker": "VGLT",
      "name": "Vanguard Long-Term Treasury ETF",
      "issuer": "Vanguard / Vanguard Bond Index Funds",
      "cik": "0001021882",
      "series_id": "S000026861"
    },
    {
      "ticker": "VTIP",
      "name": "Vanguard Short-Term Inflation-Protected Securities ETF",
      "issuer": "Vanguard / Vanguard Bond Index Funds",
      "cik": "0000836906",
      "series_id": "S000038501"
    },
    {
      "ticker": "VNQI",
      "name": "Vanguard Global ex-U.S. Real Estate ETF",
      "issuer": "Vanguard / Vanguard Specialized Funds",
      "cik": "0000857489",
      "series_id": "S000030007"
    },
    {
      "ticker": "VIG",
      "name": "Vanguard Dividend Appreciation ETF",
      "issuer": "Vanguard / Vanguard Whitehall Funds",
      "cik": "0000734383",
      "series_id": "S000011322"
    },
    {
      "ticker": "VYD",
      "name": "Vanguard High Dividend Yield ETF",
      "issuer": "Vanguard / Vanguard Whitehall Funds",
      "cik": "0000052848",
      "series_id": "S000015197"
    },
    {
      "ticker": "MGK",
      "name": "Vanguard Mega Cap Growth ETF",
      "issuer": "Vanguard / Vanguard Index Funds",
      "cik": "0000052848",
      "series_id": "S000019700"
    },
    {
      "ticker": "MGV",
      "name": "Vanguard Mega Cap Value ETF",
      "issuer": "Vanguard / Vanguard Index Funds",
      "cik": "0000052848",
      "series_id": "S000019699"
    },
    {
      "ticker": "SCHB",
      "name": "Schwab U.S. Broad Market ETF",
      "issuer": "Charles Schwab / Schwab Strategic Trust",
      "cik": "0001454889",
      "series_id": "S000026631"
    },
    {
      "ticker": "SCHX",
      "name": "Schwab U.S. Large-Cap ETF",
      "issuer": "Charles Schwab / Schwab Strategic Trust",
      "cik": "0001454889",
      "series_id": "S000026632"
    },
    {
      "ticker": "SCHF",
      "name": "Schwab International Equity ETF",
      "issuer": "Charles Schwab / Schwab Strategic Trust",
      "cik": "0001454889",
      "series_id": "S000026637"
    },
    {
      "ticker": "SCHE",
      "name": "Schwab Emerging Markets Equity ETF",
      "issuer": "Charles Schwab / Schwab Strategic Trust",
      "cik": "0001454889",
      "series_id": "S000026639"
    },
    {
      "ticker": "SCHD",
      "name": "Schwab U.S. Dividend Equity ETF",
      "issuer": "Charles Schwab / Schwab Strategic Trust",
      "cik": "0001454889",
      "series_id": "S000034163"
    },
    {
      "ticker": "SCHG",
      "name": "Schwab U.S. Large-Cap Growth ETF",
      "issuer": "Charles Schwab / Schwab Strategic Trust",
      "cik": "0001454889",
      "series_id": "S000026633"
    },
    {
      "ticker": "SCHV",
      "name": "Schwab U.S. Large-Cap Value ETF",
      "issuer": "Charles Schwab / Schwab Strategic Trust",
      "cik": "0001454889",
      "series_id": "S000026634"
    },
    {
      "ticker": "SCHA",
      "name": "Schwab U.S. Small-Cap ETF",
      "issuer": "Charles Schwab / Schwab Strategic Trust",
      "cik": "0001454889",
      "series_id": "S000026636"
    },
    {
      "ticker": "SCHM",
      "name": "Schwab U.S. Mid-Cap ETF",
      "issuer": "Charles Schwab / Schwab Strategic Trust",
      "cik": "0001454889",
      "series_id": "S000026635"
    },
    {
      "ticker": "SCHP",
      "name": "Schwab U.S. TIPS ETF",
      "issuer": "Charles Schwab / Schwab Strategic Trust",
      "cik": "0001454889",
      "series_id": "S000029407"
    },
    {
      "ticker": "SCHI",
      "name": "Schwab 5-10 Year Corporate Bond ETF",
      "issuer": "Charles Schwab / Schwab Strategic Trust",
      "cik": "0001454889",
      "series_id": "S000066661"
    },
    {
      "ticker": "GDX",
      "name": "VanEck Gold Miners ETF",
      "issuer": "VanEck / VanEck ETF Trust",
      "cik": "0001137360",
      "series_id": "S000009191"
    },
    {
      "ticker": "GDXJ",
      "name": "VanEck Junior Gold Miners ETF",
      "issuer": "VanEck / VanEck ETF Trust",
      "cik": "0001137360",
      "series_id": "S000026955"
    },
    {
      "ticker": "SMH",
      "name": "VanEck Semiconductor ETF",
      "issuer": "VanEck / VanEck ETF Trust",
      "cik": "0001137360",
      "series_id": "S000034411"
    },
    {
      "ticker": "OIH",
      "name": "VanEck Oil Services ETF",
      "issuer": "VanEck / VanEck ETF Trust",
      "cik": "0001137360",
      "series_id": "S000034408"
    },
    {
      "ticker": "MSOS",
      "name": "AdvisorShares Pure US Cannabis ETF",
      "issuer": "AdvisorShares / AdvisorShares Trust",
      "cik": "0001408970",
      "series_id": "S000066948"
    },
    {
      "ticker": "ARKK",
      "name": "ARK Innovation ETF",
      "issuer": "ARK / ARK ETF Trust",
      "cik": "0001579982",
      "series_id": "S000042977"
    },
    {
      "ticker": "ARKG",
      "name": "ARK Genomic Revolution ETF",
      "issuer": "ARK / ARK ETF Trust",
      "cik": "0001579982",
      "series_id": "S000042975"
    },
    {
      "ticker": "ARKW",
      "name": "ARK Next Generation Internet ETF",
      "issuer": "ARK / ARK ETF Trust",
      "cik": "0001579982",
      "series_id": "S000042978"
    },
    {
      "ticker": "ARKF",
      "name": "ARK Fintech Innovation ETF",
      "issuer": "ARK / ARK ETF Trust",
      "cik": "0001579982",
      "series_id": "S000064752"
    },
    {
      "ticker": "ARKQ",
      "name": "ARK Autonomous Technology & Robotics ETF",
      "issuer": "ARK / ARK ETF Trust",
      "cik": "0001579982",
      "series_id": "S000042976"
    },
    {
      "ticker": "TQQQ",
      "name": "ProShares UltraPro QQQ",
      "issuer": "ProShares / ProShares Trust",
      "cik": "0001174610",
      "series_id": "S000024908"
    },
    {
      "ticker": "SQQQ",
      "name": "ProShares UltraPro Short QQQ",
      "issuer": "ProShares / ProShares Trust",
      "cik": "0001174610",
      "series_id": "S000024909"
    },
    {
      "ticker": "UPRO",
      "name": "ProShares UltraPro S&P 500",
      "issuer": "ProShares / ProShares Trust",
      "cik": "0001174610",
      "series_id": "S000024919"
    },
    {
      "ticker": "SPXS",
      "name": "Direxion Daily S&P 500 Bear 3X Shares",
      "issuer": "Direxion / Direxion Shares ETF Trust",
      "cik": "0001424958",
      "series_id": "S000022765"
    },
    {
      "ticker": "SPXL",
      "name": "Direxion Daily S&P 500 Bull 3X Shares",
      "issuer": "Direxion / Direxion Shares ETF Trust",
      "cik": "0001424958",
      "series_id": "S000022767"
    },
    {
      "ticker": "SOXL",
      "name": "Direxion Daily Semiconductor Bull 3X Shares",
      "issuer": "Direxion / Direxion Shares ETF Trust",
      "cik": "0001424958",
      "series_id": "S000027920"
    },
    {
      "ticker": "SOXS",
      "name": "Direxion Daily Semiconductor Bear 3X Shares",
      "issuer": "Direxion / Direxion Shares ETF Trust",
      "cik": "0001424958",
      "series_id": "S000027921"
    },
    {
      "ticker": "TNA",
      "name": "Direxion Daily Small Cap Bull 3X Shares",
      "issuer": "Direxion / Direxion Shares ETF Trust",
      "cik": "0001424958",
      "series_id": "S000022786"
    },
    {
      "ticker": "TZA",
      "name": "Direxion Daily Small Cap Bear 3X Shares",
      "issuer": "Direxion / Direxion Shares ETF Trust",
      "cik": "0001424958",
      "series_id": "S000022770"
    },
    {
      "ticker": "FAS",
      "name": "Direxion Daily Financial Bull 3X Shares",
      "issuer": "Direxion / Direxion Shares ETF Trust",
      "cik": "0001424958",
      "series_id": "S000022761"
    },
    {
      "ticker": "FAZ",
      "name": "Direxion Daily Financial Bear 3X Shares",
      "issuer": "Direxion / Direxion Shares ETF Trust",
      "cik": "0001424958",
      "series_id": "S000022781"
    },
    {
      "ticker": "LABU",
      "name": "Direxion Daily S&P Biotech Bull 3X Shares",
      "issuer": "Direxion / Direxion Shares ETF Trust",
      "cik": "0001424958",
      "series_id": "S000049373"
    },
    {
      "ticker": "LABD",
      "name": "Direxion Daily S&P Biotech Bear 3X Shares",
      "issuer": "Direxion / Direxion Shares ETF Trust",
      "cik": "0001424958",
      "series_id": "S000049374"
    },
    {
      "ticker": "UVXY",
      "name": "ProShares Ultra VIX Short-Term Futures ETF",
      "issuer": "ProShares / ProShares Trust",
      "cik": "0001174922",
      "series_id": "S000033198"
    },
    {
      "ticker": "SVXY",
      "name": "ProShares Short VIX Short-Term Futures ETF",
      "issuer": "ProShares / ProShares Trust",
      "cik": "0001174922",
      "series_id": "S000033197"
    },
    {
      "ticker": "USO",
      "name": "United States Oil Fund LP",
      "issuer": "USCF Investments",
      "cik": "0001327977",
      "series_id": null,
      "notes": "Commodity partnership (LP), not a 1940 Act fund. No N-PORT. CIK is the LP itself."
    },
    {
      "ticker": "UNG",
      "name": "United States Natural Gas Fund LP",
      "issuer": "USCF Investments",
      "cik": "0001359838",
      "series_id": null,
      "notes": "Commodity partnership (LP), not a 1940 Act fund. No N-PORT. CIK is the LP itself."
    },
    {
      "ticker": "PDBC",
      "name": "Invesco Optimum Yield Diversified Commodity Strategy No K-1 ETF",
      "issuer": "Invesco / Invesco Exchange-Traded Fund Trust II",
      "cik": "0001595386",
      "series_id": "S000044509"
    },
    {
      "ticker": "DBO",
      "name": "Invesco DB Oil Fund",
      "issuer": "Invesco / DB Commodity Services LLC",
      "cik": "0001383312",
      "series_id": null,
      "notes": "Commodity limited partnership. No N-PORT. CIK is the fund entity."
    },
    {
      "ticker": "IBIT",
      "name": "iShares Bitcoin Trust ETF",
      "issuer": "BlackRock / iShares Bitcoin Trust ETF",
      "cik": "0001980994",
      "series_id": null,
      "notes": "Commodity trust (Bitcoin ETP) under the 1933 Act. No N-PORT. CIK is the trust itself."
    },
    {
      "ticker": "FBTC",
      "name": "Fidelity Wise Origin Bitcoin Fund",
      "issuer": "Fidelity",
      "cik": "0001980176",
      "series_id": null,
      "notes": "Commodity trust (Bitcoin ETP) under the 1933 Act. No N-PORT. CIK is the trust itself."
    },
    {
      "ticker": "BITB",
      "name": "Bitwise Bitcoin ETF",
      "issuer": "Bitwise",
      "cik": "0001980245",
      "series_id": null,
      "notes": "Commodity trust (Bitcoin ETP) under the 1933 Act. No N-PORT. CIK is the trust itself."
    },
    {
      "ticker": "EZBC",
      "name": "Franklin Bitcoin ETF",
      "issuer": "Franklin Templeton",
      "cik": "0001980242",
      "series_id": null,
      "notes": "Commodity trust (Bitcoin ETP) under the 1933 Act. No N-PORT. CIK is the trust itself."
    },
    {
      "ticker": "ETHA",
      "name": "iShares Ethereum Trust ETF",
      "issuer": "BlackRock",
      "cik": "0002027633",
      "series_id": null,
      "notes": "Commodity trust (Ethereum ETP) under the 1933 Act. No N-PORT. CIK is the trust itself."
    },
    {
      "ticker": "FETH",
      "name": "Fidelity Ethereum Fund",
      "issuer": "Fidelity",
      "cik": "0002024173",
      "series_id": null,
      "notes": "Commodity trust (Ethereum ETP) under the 1933 Act. No N-PORT. CIK is the trust itself."
    },
    {
      "ticker": "CIBR",
      "name": "First Trust NASDAQ Cybersecurity ETF",
      "issuer": "First Trust / First Trust Exchange-Traded Fund VI",
      "cik": "0001364608",
      "series_id": "S000050385"
    },
    {
      "ticker": "FDN",
      "name": "First Trust Dow Jones Internet Index Fund",
      "issuer": "First Trust / First Trust Exchange-Traded Fund II",
      "cik": "0001329377",
      "series_id": "S000012479"
    },
    {
      "ticker": "FTEC",
      "name": "Fidelity MSCI Information Technology Index ETF",
      "issuer": "Fidelity / Fidelity Covington Trust",
      "cik": "0000945908",
      "series_id": "S000042577"
    },
    {
      "ticker": "FHLC",
      "name": "Fidelity MSCI Health Care Index ETF",
      "issuer": "Fidelity / Fidelity Covington Trust",
      "cik": "0000945908",
      "series_id": "S000042575"
    },
    {
      "ticker": "FIDU",
      "name": "Fidelity MSCI Industrials Index ETF",
      "issuer": "Fidelity / Fidelity Covington Trust",
      "cik": "0000945908",
      "series_id": "S000042576"
    },
    {
      "ticker": "FNCL",
      "name": "Fidelity MSCI Financials Index ETF",
      "issuer": "Fidelity / Fidelity Covington Trust",
      "cik": "0000945908",
      "series_id": "S000042574"
    },
    {
      "ticker": "FENY",
      "name": "Fidelity MSCI Energy Index ETF",
      "issuer": "Fidelity / Fidelity Covington Trust",
      "cik": "0000945908",
      "series_id": "S000042573"
    },
    {
      "ticker": "ONEQ",
      "name": "Fidelity Nasdaq Composite Index ETF",
      "issuer": "Fidelity / Fidelity Commonwealth Trust",
      "cik": "0000205323",
      "series_id": "S000006011"
    },
    {
      "ticker": "IVW",
      "name": "iShares S&P 500 Growth ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004311"
    },
    {
      "ticker": "IVE",
      "name": "iShares S&P 500 Value ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004312"
    },
    {
      "ticker": "QUAL",
      "name": "iShares MSCI USA Quality Factor ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000041444"
    },
    {
      "ticker": "SIZE",
      "name": "iShares MSCI USA Size Factor ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000040204"
    },
    {
      "ticker": "MTUM",
      "name": "iShares MSCI USA Momentum Factor ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000040316"
    },
    {
      "ticker": "VLUE",
      "name": "iShares MSCI USA Value Factor ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000040205"
    },
    {
      "ticker": "USMV",
      "name": "iShares MSCI USA Min Vol Factor ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000031838"
    },
    {
      "ticker": "DGRO",
      "name": "iShares Core Dividend Growth ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000045648"
    },
    {
      "ticker": "HDV",
      "name": "iShares Core High Dividend ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000031844"
    },
    {
      "ticker": "DVY",
      "name": "iShares Select Dividend ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004334"
    },
    {
      "ticker": "SDY",
      "name": "SPDR S&P Dividend ETF",
      "issuer": "State Street / SPDR Series Trust",
      "cik": "0001064642",
      "series_id": "S000006981"
    },
    {
      "ticker": "DGRW",
      "name": "WisdomTree U.S. Quality Dividend Growth Fund",
      "issuer": "WisdomTree / WisdomTree Trust",
      "cik": "0001350487",
      "series_id": "S000040816"
    },
    {
      "ticker": "DLN",
      "name": "WisdomTree U.S. LargeCap Dividend Fund",
      "issuer": "WisdomTree / WisdomTree Trust",
      "cik": "0001350487",
      "series_id": "S000012392"
    },
    {
      "ticker": "EZU",
      "name": "iShares MSCI Eurozone ETF",
      "issuer": "BlackRock / iShares, Inc.",
      "cik": "0000930667",
      "series_id": "S000004268"
    },
    {
      "ticker": "VGK",
      "name": "Vanguard FTSE Europe ETF",
      "issuer": "Vanguard / Vanguard International Equity Index Funds",
      "cik": "0000857489",
      "series_id": "S000005787"
    },
    {
      "ticker": "VPL",
      "name": "Vanguard FTSE Pacific ETF",
      "issuer": "Vanguard / Vanguard International Equity Index Funds",
      "cik": "0000857489",
      "series_id": "S000005788"
    },
    {
      "ticker": "VSS",
      "name": "Vanguard FTSE All-World ex-US Small-Cap ETF",
      "issuer": "Vanguard / Vanguard International Equity Index Funds",
      "cik": "0000857489",
      "series_id": "S000025074"
    },
    {
      "ticker": "TIP",
      "name": "iShares TIPS Bond ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004363"
    },
    {
      "ticker": "GOVT",
      "name": "iShares U.S. Treasury Bond ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000035919"
    },
    {
      "ticker": "EMB",
      "name": "iShares JP Morgan USD Emerging Markets Bond ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000019798"
    },
    {
      "ticker": "JNK",
      "name": "SPDR Bloomberg High Yield Bond ETF",
      "issuer": "State Street / SPDR Series Trust",
      "cik": "0001064642",
      "series_id": "S000019669"
    },
    {
      "ticker": "XAR",
      "name": "SPDR S&P Aerospace & Defense ETF",
      "issuer": "State Street / SPDR Series Trust",
      "cik": "0001064642",
      "series_id": "S000012318"
    },
    {
      "ticker": "XME",
      "name": "SPDR S&P Metals & Mining ETF",
      "issuer": "State Street / SPDR Series Trust",
      "cik": "0001064642",
      "series_id": "S000012333"
    },
    {
      "ticker": "XOP",
      "name": "SPDR S&P Oil & Gas Exploration & Production ETF",
      "issuer": "State Street / SPDR Series Trust",
      "cik": "0001064642",
      "series_id": "S000012319"
    },
    {
      "ticker": "XRT",
      "name": "SPDR S&P Retail ETF",
      "issuer": "State Street / SPDR Series Trust",
      "cik": "0001064642",
      "series_id": "S000012322"
    },
    {
      "ticker": "XHB",
      "name": "SPDR S&P Homebuilders ETF",
      "issuer": "State Street / SPDR Series Trust",
      "cik": "0001064642",
      "series_id": "S000010019"
    },
    {
      "ticker": "KRE",
      "name": "SPDR S&P Regional Banking ETF",
      "issuer": "State Street / SPDR Series Trust",
      "cik": "0001064642",
      "series_id": "S000012325"
    },
    {
      "ticker": "KBE",
      "name": "SPDR S&P Bank ETF",
      "issuer": "State Street / SPDR Series Trust",
      "cik": "0001064642",
      "series_id": "S000006977"
    },
    {
      "ticker": "XES",
      "name": "SPDR S&P Oil & Gas Equipment & Services ETF",
      "issuer": "State Street / SPDR Series Trust",
      "cik": "0001064642",
      "series_id": "S000012334"
    },
    {
      "ticker": "SPEM",
      "name": "SPDR Portfolio Emerging Markets ETF",
      "issuer": "State Street / SPDR Series Trust",
      "cik": "0001168164",
      "series_id": "S000014048"
    },
    {
      "ticker": "SPDW",
      "name": "SPDR Portfolio Developed World ex-US ETF",
      "issuer": "State Street / SPDR Series Trust",
      "cik": "0001168164",
      "series_id": "S000014038"
    },
    {
      "ticker": "BIL",
      "name": "SPDR Bloomberg 1-3 Month T-Bill ETF",
      "issuer": "State Street / SPDR Series Trust",
      "cik": "0001064642",
      "series_id": "S000017326"
    },
    {
      "ticker": "SGOV",
      "name": "iShares 0-3 Month Treasury Bond ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000068768"
    },
    {
      "ticker": "BOXX",
      "name": "Alpha Architect 1-3 Month Box ETF",
      "issuer": "Alpha Architect / Empowered Funds LLC",
      "cik": "0001592900",
      "series_id": "S000077497"
    },
    {
      "ticker": "CALF",
      "name": "Pacer US Small Cap Cash Cows 100 ETF",
      "issuer": "Pacer / Pacer Funds Trust",
      "cik": "0001616668",
      "series_id": "S000055468"
    },
    {
      "ticker": "COWZ",
      "name": "Pacer US Cash Cows 100 ETF",
      "issuer": "Pacer / Pacer Funds Trust",
      "cik": "0001616668",
      "series_id": "S000055466"
    },
    {
      "ticker": "AVUV",
      "name": "Avantis U.S. Small Cap Value ETF",
      "issuer": "Avantis / American Century ETF Trust",
      "cik": "0001710607",
      "series_id": "S000066459"
    },
    {
      "ticker": "AVDV",
      "name": "Avantis International Small Cap Value ETF",
      "issuer": "Avantis / American Century ETF Trust",
      "cik": "0001710607",
      "series_id": "S000066457"
    },
    {
      "ticker": "AVEM",
      "name": "Avantis Emerging Markets Equity ETF",
      "issuer": "Avantis / American Century ETF Trust",
      "cik": "0001710607",
      "series_id": "S000066454"
    },
    {
      "ticker": "DFAC",
      "name": "Dimensional U.S. Core Equity 2 ETF",
      "issuer": "Dimensional / Dimensional ETF Trust",
      "cik": "0001816125",
      "series_id": "S000070903"
    },
    {
      "ticker": "DFAU",
      "name": "Dimensional US Equity ETF",
      "issuer": "Dimensional / Dimensional ETF Trust",
      "cik": "0001816125",
      "series_id": "S000069432"
    },
    {
      "ticker": "DFAI",
      "name": "Dimensional International Core Equity Market ETF",
      "issuer": "Dimensional / Dimensional ETF Trust",
      "cik": "0001816125",
      "series_id": "S000069433"
    },
    {
      "ticker": "DFAE",
      "name": "Dimensional Emerging Core Equity Market ETF",
      "issuer": "Dimensional / Dimensional ETF Trust",
      "cik": "0001816125",
      "series_id": "S000069434"
    },
    {
      "ticker": "PAVE",
      "name": "Global X U.S. Infrastructure Development ETF",
      "issuer": "Global X / Global X Funds",
      "cik": "0001432353",
      "series_id": "S000056509"
    },
    {
      "ticker": "CLOU",
      "name": "Global X Cloud Computing ETF",
      "issuer": "Global X / Global X Funds",
      "cik": "0001432353",
      "series_id": "S000065121"
    },
    {
      "ticker": "BOTZ",
      "name": "Global X Robotics & Artificial Intelligence ETF",
      "issuer": "Global X / Global X Funds",
      "cik": "0001432353",
      "series_id": "S000054693"
    },
    {
      "ticker": "AMLP",
      "name": "Alerian MLP ETF",
      "issuer": "SS&C ALPS / ALPS ETF Trust",
      "cik": "0001414040",
      "series_id": "S000029786"
    },
    {
      "ticker": "IYR",
      "name": "iShares U.S. Real Estate ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004328"
    },
    {
      "ticker": "IYW",
      "name": "iShares U.S. Technology ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004329"
    },
    {
      "ticker": "IYH",
      "name": "iShares U.S. Healthcare ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004324"
    },
    {
      "ticker": "IYF",
      "name": "iShares U.S. Financials ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004323"
    },
    {
      "ticker": "IYE",
      "name": "iShares U.S. Energy ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004321"
    },
    {
      "ticker": "JEPI",
      "name": "JPMorgan Equity Premium Income ETF",
      "issuer": "J.P. Morgan / JPMorgan Exchange-Traded Fund Trust",
      "cik": "0001485894",
      "series_id": "S000068402"
    },
    {
      "ticker": "JEPQ",
      "name": "JPMorgan Nasdaq Equity Premium Income ETF",
      "issuer": "J.P. Morgan / JPMorgan Exchange-Traded Fund Trust",
      "cik": "0001485894",
      "series_id": "S000076132"
    },
    {
      "ticker": "JPST",
      "name": "JPMorgan Ultra-Short Income ETF",
      "issuer": "J.P. Morgan / JPMorgan Exchange-Traded Fund Trust",
      "cik": "0001485894",
      "series_id": "S000054790"
    },
    {
      "ticker": "JMST",
      "name": "JPMorgan Ultra-Short Municipal Income ETF",
      "issuer": "J.P. Morgan / JPMorgan Exchange-Traded Fund Trust",
      "cik": "0001485894",
      "series_id": "S000063269"
    },
    {
      "ticker": "MINT",
      "name": "PIMCO Enhanced Short Maturity Active ETF",
      "issuer": "PIMCO / PIMCO ETF Trust",
      "cik": "0001450011",
      "series_id": "S000026751"
    },
    {
      "ticker": "HYD",
      "name": "VanEck High Yield Muni ETF",
      "issuer": "VanEck / VanEck ETF Trust",
      "cik": "0001137360",
      "series_id": "S000019193"
    },
    {
      "ticker": "MUB",
      "name": "iShares National Muni Bond ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000018861"
    },
    {
      "ticker": "SHYG",
      "name": "iShares 0-5 Year High Yield Corporate Bond ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000042353"
    },
    {
      "ticker": "SJNK",
      "name": "SPDR Bloomberg Short Term High Yield Bond ETF",
      "issuer": "State Street / SPDR Series Trust",
      "cik": "0001064642",
      "series_id": "S000036414"
    },
    {
      "ticker": "NEAR",
      "name": "BlackRock Short Maturity Bond ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001524513",
      "series_id": "S000037042"
    },
    {
      "ticker": "SLQD",
      "name": "iShares 0-5 Year Investment Grade Corporate Bond ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000042354"
    },
    {
      "ticker": "STIP",
      "name": "iShares 0-5 Year TIPS Bond ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000030481"
    },
    {
      "ticker": "FLOT",
      "name": "iShares Floating Rate Bond ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000033136"
    },
    {
      "ticker": "IGOV",
      "name": "iShares International Treasury Bond ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000023614"
    },
    {
      "ticker": "BKLN",
      "name": "Invesco Senior Loan ETF",
      "issuer": "Invesco / Invesco Exchange-Traded Fund Trust",
      "cik": "0001378872",
      "series_id": "S000031053"
    },
    {
      "ticker": "EEMV",
      "name": "iShares MSCI Emerging Markets Min Vol Factor ETF",
      "issuer": "BlackRock / iShares, Inc.",
      "cik": "0000930667",
      "series_id": "S000032497"
    },
    {
      "ticker": "EFAV",
      "name": "iShares MSCI EAFE Min Vol Factor ETF",
      "issuer": "BlackRock / iShares, Inc.",
      "cik": "0001100663",
      "series_id": "S000031837"
    },
    {
      "ticker": "IYT",
      "name": "iShares Transportation Average ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000004331"
    },
    {
      "ticker": "IAI",
      "name": "iShares U.S. Broker-Dealers & Securities Exchanges ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000009420"
    },
    {
      "ticker": "IAK",
      "name": "iShares U.S. Insurance ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000009421"
    },
    {
      "ticker": "IHI",
      "name": "iShares U.S. Medical Devices ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000009419"
    },
    {
      "ticker": "IHF",
      "name": "iShares U.S. Healthcare Providers ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000009418"
    },
    {
      "ticker": "PPH",
      "name": "VanEck Pharmaceutical ETF",
      "issuer": "VanEck / VanEck ETF Trust",
      "cik": "0001137360",
      "series_id": "S000034409"
    },
    {
      "ticker": "PEJ",
      "name": "Invesco Dynamic Leisure and Entertainment ETF",
      "issuer": "Invesco / Invesco Exchange-Traded Fund Trust",
      "cik": "0001209466",
      "series_id": "S000003028"
    },
    {
      "ticker": "QQQM",
      "name": "Invesco NASDAQ 100 ETF",
      "issuer": "Invesco / Invesco Exchange-Traded Fund Trust II",
      "cik": "0001378872",
      "series_id": "S000069448"
    },
    {
      "ticker": "RSP",
      "name": "Invesco S&P 500 Equal Weight ETF",
      "issuer": "Invesco / Invesco Exchange-Traded Fund Trust II",
      "cik": "0001209466",
      "series_id": "S000060812"
    },
    {
      "ticker": "RYT",
      "name": "Invesco S&P 500 Equal Weight Technology ETF",
      "issuer": "Invesco / Invesco Exchange-Traded Fund Trust II",
      "cik": "0001482921",
      "series_id": "S000009076"
    },
    {
      "ticker": "RYF",
      "name": "Invesco S&P 500 Equal Weight Financials ETF",
      "issuer": "Invesco / Invesco Exchange-Traded Fund Trust II",
      "cik": "0001482921",
      "series_id": "S000009072"
    },
    {
      "ticker": "RYH",
      "name": "Invesco S&P 500 Equal Weight Health Care ETF",
      "issuer": "Invesco / Invesco Exchange-Traded Fund Trust II",
      "cik": "0001482921",
      "series_id": "S000009075"
    },
    {
      "ticker": "SPLG",
      "name": "SPDR Portfolio S&P 500 ETF",
      "issuer": "State Street / SPDR Series Trust",
      "cik": "0001064642",
      "series_id": "S000006987"
    },
    {
      "ticker": "SPAB",
      "name": "SPDR Portfolio Aggregate Bond ETF",
      "issuer": "State Street / SPDR Series Trust",
      "cik": "0001064642",
      "series_id": "S000017334"
    },
    {
      "ticker": "SPSB",
      "name": "SPDR Portfolio Short Term Corporate Bond ETF",
      "issuer": "State Street / SPDR Series Trust",
      "cik": "0001064642",
      "series_id": "S000019666"
    },
    {
      "ticker": "SPIB",
      "name": "SPDR Portfolio Intermediate Term Corporate Bond ETF",
      "issuer": "State Street / SPDR Series Trust",
      "cik": "0001064642",
      "series_id": "S000022923"
    },
    {
      "ticker": "SPTS",
      "name": "SPDR Portfolio Short Term Treasury ETF",
      "issuer": "State Street / SPDR Series Trust",
      "cik": "0001064642",
      "series_id": "S000019665"
    },
    {
      "ticker": "SPTI",
      "name": "SPDR Portfolio Intermediate Term Treasury ETF",
      "issuer": "State Street / SPDR Series Trust",
      "cik": "0001064642",
      "series_id": "S000017328"
    },
    {
      "ticker": "GNR",
      "name": "SPDR S&P Global Natural Resources ETF",
      "issuer": "State Street / SPDR Series Trust",
      "cik": "0001168164",
      "series_id": "S000030037"
    },
    {
      "ticker": "ICLN",
      "name": "iShares Global Clean Energy ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000022498"
    },
    {
      "ticker": "TAN",
      "name": "Invesco Solar ETF",
      "issuer": "Invesco / Invesco Exchange-Traded Fund Trust",
      "cik": "0001378872",
      "series_id": "S000060822"
    },
    {
      "ticker": "FAN",
      "name": "First Trust Global Wind Energy ETF",
      "issuer": "First Trust / First Trust Exchange-Traded Fund IV",
      "cik": "0001364608",
      "series_id": "S000022933"
    },
    {
      "ticker": "CNRG",
      "name": "SPDR S&P Kensho Clean Power ETF",
      "issuer": "State Street / SPDR Series Trust",
      "cik": "0001064642",
      "series_id": "S000063360"
    },
    {
      "ticker": "LIT",
      "name": "Global X Lithium & Battery Tech ETF",
      "issuer": "Global X / Global X Funds",
      "cik": "0001432353",
      "series_id": "S000029441"
    },
    {
      "ticker": "REMX",
      "name": "VanEck Rare Earth and Strategic Metals ETF",
      "issuer": "VanEck / VanEck ETF Trust",
      "cik": "0001137360",
      "series_id": "S000030045"
    },
    {
      "ticker": "IYLD",
      "name": "iShares Morningstar Multi-Asset Income ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000036830"
    },
    {
      "ticker": "AOA",
      "name": "iShares Core Aggressive Allocation ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000023588"
    },
    {
      "ticker": "AOM",
      "name": "iShares Core Moderate Allocation ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000023586"
    },
    {
      "ticker": "AOK",
      "name": "iShares Core Conservative Allocation ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000023585"
    },
    {
      "ticker": "AOR",
      "name": "iShares Core Growth Allocation ETF",
      "issuer": "BlackRock / iShares Trust",
      "cik": "0001100663",
      "series_id": "S000023587"
    }
  ]
};