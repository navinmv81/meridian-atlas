// READ BUDGET: SEC EDGAR EFTS + submissions endpoints, plus D1 reads for the
// manager routes below (managermaster, manageraliases, filing13f,
// holding13f_normalized, instrument_master, instrument_entity_map). No KV, no R2.
// Rate cap: 150ms enforced minimum between every SEC request (SEC policy:
// 10 req/s per User-Agent).
// No scheduled/cron export — this Worker shell is request-driven only.
//
// KNOWN GAP (2026-07-05): filing13f has no index on `cik` yet — the
// /api/13f-manager route's filing-history query full-scans filing13f
// (~32K rows) until idx_filing13f_cik is created. Functionally correct,
// just not yet indexed. holding13f_normalized is NOT scanned by cik —
// /api/13f-manager-holdings looks up by accession_number instead, which
// is indexed (leading column of the table's only autoindex).

// Module-level timestamp so the 150ms guard is shared across serial SEC calls
// within a single request. Each invocation gets its own isolate, so this resets
// per request — exactly the right scope for a per-request rate limiter.
let _lastSecFetchMs = 0;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*"
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const params = url.searchParams;

    const secUa =
      (env && env.SEC_USER_AGENT) ||
      "MeridianAtlas contact@meridianatlas.com";

    try {
      // ── /api/13f-search ──────────────────────────────────────────────────
      if (url.pathname === "/api/13f-search") {
        const manager = (params.get("manager") || "").trim();
        if (!manager) return json({ error: "manager required" }, 400);

        const searchUrl =
          `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(manager)}%22&forms=13F-HR`;

        let eftsRes;
        try {
          eftsRes = await secFetch(searchUrl, secUa);
        } catch (e) {
          return json({ error: "SEC EFTS search failed", detail: e.message }, 502);
        }

        if (!eftsRes.ok) {
          const preview = await safeText(eftsRes);
          return json(
            { error: "SEC EFTS search unavailable", status: eftsRes.status, preview: preview.slice(0, 180) },
            502
          );
        }

        const eftsData = await eftsRes.json();
        const hits = eftsData?.hits?.hits || [];

        if (!hits.length) {
          return json({ error: "manager_not_found", manager }, 404);
        }

        const seen = new Set();
        const candidates = [];
        for (const hit of hits) {
          const src = hit?._source || {};
          const rawCik = (Array.isArray(src.ciks) ? src.ciks[0] : null) || "";
          const cikNum = parseInt(rawCik, 10);
          if (!cikNum || !Number.isFinite(cikNum) || seen.has(cikNum)) continue;
          seen.add(cikNum);
          const rawName = (Array.isArray(src.display_names) ? src.display_names[0] : "") || manager;
          const cleanName = rawName.replace(/\s*\(CIK\s+\d+\)\s*$/i, "").trim() || manager;
          candidates.push({
            cik: String(cikNum).padStart(10, "0"),
            name: cleanName
          });
        }

        if (!candidates.length) {
          return json({ error: "manager_not_found", manager }, 404);
        }

        const top = candidates[0];
        return json({
          manager_query: manager,
          cik: top.cik,
          name: top.name,
          ticker: null,
          alternatives: candidates.slice(1, 5)
        }, 200);
      }

      // ── /api/13f-filings ─────────────────────────────────────────────────
      if (url.pathname === "/api/13f-filings") {
        const raw = (params.get("cik") || "").trim();
        if (!/^[0-9]{1,10}$/.test(raw)) return json({ error: "invalid_cik" }, 400);
        const cik10 = String(Math.trunc(Number(raw))).padStart(10, "0");

        const subUrl = `https://data.sec.gov/submissions/CIK${cik10}.json`;
        const res = await secFetch(subUrl, secUa);
        if (!res.ok) {
          const preview = await safeText(res);
          return json(
            { error: "SEC submissions unavailable", status: res.status, preview: preview.slice(0, 180) },
            502
          );
        }

        const submissions = await res.json();
        const allFilings = normalizeRecentFilings(submissions, String(Math.trunc(Number(raw))), 50);
        const filings = allFilings.filter(f => f.form === "13F-HR");
        return json({
          cik: cik10,
          name: submissions.name || null,
          filings,
          provider: "SEC-EDGAR",
          lastUpdated: new Date().toISOString()
        }, 200);
      }

      // ── /api/13f-manager ─────────────────────────────────────────────────
      if (url.pathname === "/api/13f-manager") {
        const raw = (params.get("cik") || "").trim();
        if (!/^[0-9]{1,10}$/.test(raw)) return json({ error: "invalid_cik" }, 400);
        const cik10 = String(Math.trunc(Number(raw))).padStart(10, "0");

        if (!env.DB) return json({ error: "D1 binding not configured" }, 500);

        const identityRow = await env.DB.prepare(
          "SELECT cik, manager_name, normalized_name FROM managermaster WHERE cik = ?"
        ).bind(cik10).first();

        const aliasesRes = await env.DB.prepare(
          "SELECT alias, source FROM manageraliases WHERE cik = ?"
        ).bind(cik10).all();

        const filingsRes = await env.DB.prepare(
          "SELECT accession_number, report_period, filing_date, amendment_type, entry_total, value_total FROM filing13f WHERE cik = ? ORDER BY report_period DESC LIMIT 4"
        ).bind(cik10).all();

        const filings = filingsRes.results || [];

        return json({
          cik: cik10,
          manager_name: identityRow ? identityRow.manager_name : null,
          normalized_name: identityRow ? identityRow.normalized_name : null,
          aliases: (aliasesRes.results || []).map(a => ({ alias: a.alias, source: a.source })),
          filings,
          latest_filing: filings[0] || null
        }, 200);
      }

      // ── /api/13f-manager-holdings ────────────────────────────────────────
      if (url.pathname === "/api/13f-manager-holdings") {
        const rawCik = (params.get("cik") || "").trim();
        const accessionNumber = (params.get("accession_number") || "").trim();
        if (!/^[0-9]{1,10}$/.test(rawCik)) return json({ error: "invalid_cik" }, 400);
        if (!accessionNumber) return json({ error: "accession_number required" }, 400);

        if (!env.DB) return json({ error: "D1 binding not configured" }, 500);

        const cik10 = String(Math.trunc(Number(rawCik))).padStart(10, "0");

        const holdingsRes = await env.DB.prepare(`
          SELECT h.issuer_name, h.cusip, h.value, h.shares, h.put_call, iem.entity_id
          FROM holding13f_normalized h
          LEFT JOIN instrument_master im
            ON im.cusip_issuer_6 = substr(h.cusip, 1, 6) AND im.cusip = h.cusip
          LEFT JOIN instrument_entity_map iem ON im.instrument_key = iem.instrument_key
          WHERE h.accession_number = ? AND h.cik = ?
          ORDER BY h.value DESC
        `).bind(accessionNumber, cik10).all();

        return json({
          cik: cik10,
          accession_number: accessionNumber,
          holdings: holdingsRes.results || []
        }, 200);
      }

      return new Response("Not Found", { status: 404, headers: CORS_HEADERS });

    } catch (err) {
      return new Response(
        JSON.stringify({ error: err.message || "Internal error" }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
  }
};

// ── helpers ──────────────────────────────────────────────────────────────────

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}

// Enforces a 150ms minimum gap between SEC fetches to stay within the
// SEC EDGAR 10 req/s rate limit. Uses a module-level timestamp so serial
// calls within the same request are paced correctly.
async function secFetch(url, userAgent) {
  const ua = userAgent || "MeridianAtlas contact@meridianatlas.com";
  const now = Date.now();
  const elapsed = now - _lastSecFetchMs;
  if (elapsed < 150) {
    await new Promise(r => setTimeout(r, 150 - elapsed));
  }
  _lastSecFetchMs = Date.now();
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
