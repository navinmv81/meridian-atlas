// READ BUDGET: SEC EDGAR filing document proxy. Streams XML/HTML from
// data.sec.gov and sec.gov/Archives on demand. No KV, no R2.
// D1 writes begin in S2.10 (filing metadata ingestion). Rate cap: 150ms
// enforced minimum between every SEC request (SEC policy: 10 req/s).
// No scheduled/cron export — this Worker shell is request-driven only.

// Module-level timestamp so the 150ms guard is shared across serial SEC calls
// within a single request.
let _lastSecFetchMs = 0;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*"
};

// Allowlist: only sec.gov domains may be proxied through /api/filing-doc.
// This prevents the endpoint being used as an open proxy for arbitrary URLs.
const SEC_ALLOWED_HOSTS = new Set([
  "www.sec.gov",
  "data.sec.gov",
  "efts.sec.gov"
]);

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
      // ── /api/filing-doc ──────────────────────────────────────────────────
      // Proxies a single SEC document (XML, HTML, text) to the caller with
      // correct CORS headers and SEC User-Agent. Validates that the target
      // URL is a sec.gov domain before fetching.
      if (url.pathname === "/api/filing-doc") {
        const targetParam = (params.get("url") || "").trim();
        if (!targetParam) {
          return json({ error: "url parameter required" }, 400);
        }

        let targetUrl;
        try {
          targetUrl = new URL(targetParam);
        } catch {
          return json({ error: "invalid url parameter" }, 400);
        }

        if (!SEC_ALLOWED_HOSTS.has(targetUrl.hostname)) {
          return json(
            { error: "url must be a sec.gov domain", hostname: targetUrl.hostname },
            403
          );
        }

        const res = await secFetch(targetUrl.toString(), secUa);
        const contentType = res.headers.get("Content-Type") || "application/octet-stream";
        const body = await res.text();

        return new Response(body, {
          status: res.status,
          headers: { ...CORS_HEADERS, "Content-Type": contentType }
        });
      }

      // ── /api/issuer-filings ────────────────────────────────────────────────
      // ADDED 9 August 2026 (regression fix, follow-up to MA-AUG-004): completes
      // the migration that removal was meant to start. meridian-proxy's old
      // /?secfilings= route (ticker -> CIK -> SEC submissions.json -> filings
      // list) was deleted 5 August with the intent that issuer filing lookups
      // move to this Worker, but this Worker never actually grew the
      // replacement route — index.html's fetchSECFilings() (Company Filings
      // tab in the Research drawer) was left pointed at the now-dead
      // meridian-proxy route until this fix.
      if (url.pathname === "/api/issuer-filings") {
        const ticker = (params.get("ticker") || "").trim().toUpperCase();
        if (!ticker) {
          return json({ error: "ticker parameter required" }, 400);
        }

        const filer = await resolveCikForTicker(ticker, secUa, ctx);
        if (!filer) {
          return json({ error: `No SEC filer found for ticker ${ticker}` }, 404);
        }

        const subUrl = `https://data.sec.gov/submissions/CIK${filer.cikPadded}.json`;
        const subRes = await secFetch(subUrl, secUa);
        if (!subRes.ok) {
          const preview = await safeText(subRes);
          return json({ error: "SEC submissions unavailable", status: subRes.status, preview: preview.slice(0, 180) }, 502);
        }

        let submissions;
        try {
          submissions = await subRes.json();
        } catch {
          return json({ error: "SEC submissions response was not valid JSON" }, 502);
        }

        const filings = normalizeIssuerFilings(submissions, filer.cikNum, 30);

        return json({
          cik: filer.cikPadded,
          companyName: submissions.name || filer.name || null,
          filings,
          provider: "SEC-EDGAR",
          lastUpdated: new Date().toISOString()
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

// SEC's static ticker->CIK map (~9k entries, updated a few times a day by
// SEC). Edge-cached for a day — this endpoint is a lookup helper, not a
// source of truth, and re-fetching a multi-MB static file per request would
// blow the 150ms-per-SEC-call budget for no benefit.
const TICKER_MAP_URL = "https://www.sec.gov/files/company_tickers.json";
const TICKER_MAP_TTL_SECONDS = 86400;

async function resolveCikForTicker(ticker, secUa, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(TICKER_MAP_URL, { method: "GET" });
  let res = await cache.match(cacheKey);

  if (!res) {
    res = await secFetch(TICKER_MAP_URL, secUa);
    if (!res.ok) return null;
    res = new Response(res.body, res);
    res.headers.set("Cache-Control", `s-maxage=${TICKER_MAP_TTL_SECONDS}`);
    if (ctx && ctx.waitUntil) ctx.waitUntil(cache.put(cacheKey, res.clone()));
  }

  let mapJson;
  try {
    mapJson = await res.json();
  } catch {
    return null;
  }

  const entries = Array.isArray(mapJson) ? mapJson : Object.values(mapJson || {});
  for (const row of entries) {
    if (!row || typeof row !== "object") continue;
    const rowTicker = String(row.ticker || "").toUpperCase();
    if (rowTicker !== ticker) continue;
    const cikNum = Number(row.cik_str != null ? row.cik_str : row.cik);
    if (!Number.isFinite(cikNum)) continue;
    return {
      cikNum,
      cikPadded: String(cikNum).padStart(10, "0"),
      name: row.title || null
    };
  }
  return null;
}

// Mirrors normalizeRecentFilings() in meridian-proxy's src/index.js (used by
// /api/13f-filings there) — same SEC submissions.json shape, same link-building
// logic — but without the form==='13F-HR' filter, since issuer filings cover
// all form types (10-K, 10-Q, 8-K, etc.), not just institutional-manager 13Fs.
function normalizeIssuerFilings(submissions, cikNum, limit) {
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
  const cap = Math.min(limit || 30, 50);
  const out = [];

  for (let i = 0; i < n && out.length < cap; i++) {
    const acc = accessionNumber[i];
    const frm = form[i] != null ? String(form[i]) : "";
    if (!acc && !frm) continue;

    const accClean = String(acc || "").replace(/-/g, "");
    const prim = primaryDocument[i] ? String(primaryDocument[i]) : "";

    let link = null;
    if (accClean && prim) {
      link = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accClean}/${prim}`;
    } else if (acc) {
      link = `https://www.sec.gov/cgi-bin/viewer?action=view&cik=${encodeURIComponent(
        cikNum
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
          cikNum
        )}&owner=exclude&count=40`
    });
  }

  return out;
}
