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
