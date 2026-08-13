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
      // BUG FIX (2026-08-12, Nav): searching "Appaloosa" resolved to CIK
      // 0001713936 ("Epstein & White Financial LLC") — a totally unrelated
      // filer — while the real Appaloosa entities (0001656456 "Appaloosa LP",
      // 0001006438 "Appaloosa Management LP") sat unused in the SEC response's
      // own alternatives list. Root cause: this route resolved names purely
      // via SEC's EFTS *full-text* search (efts.sec.gov/LATEST/search-index),
      // which ranks by document-text relevance, not company-name match — any
      // 13F-HR that merely *mentions* "Appaloosa" in its text can outrank the
      // actual Appaloosa filings. Confirmed systemic, not a one-off: a spot
      // check of 8 well-known managers found EFTS also mis-resolved
      // "Bridgewater" (top hit: unrelated "Harding Loevner LP", real filer
      // not even in the top-5 alternatives) and "Point72" (top hit: a foreign
      // subsidiary "Point72 Italy, S.r.l." instead of the primary US filer).
      //
      // Fix: managermaster/manageraliases (13F Seed/seed-managermaster.js) is
      // seeded as a comprehensive filer *registry* (every SUBMISSIONTYPE, not
      // a holdings filter), so it's checked FIRST via ranked name matching —
      // cheaper and far more reliable than round-tripping to SEC for data we
      // already hold. SEC EFTS is now only a fallback for names genuinely
      // absent from our registry.
      if (url.pathname === "/api/13f-search") {
        const manager = (params.get("manager") || "").trim();
        if (!manager) return json({ error: "manager required" }, 400);

        if (env.DB) {
          const localMatch = await searchLocalManagerRegistry(env.DB, manager);
          if (localMatch) {
            return json({
              manager_query: manager,
              cik: localMatch.top.cik,
              name: localMatch.top.name,
              ticker: null,
              alternatives: localMatch.alternatives,
              source: "meridian_registry"
            }, 200);
          }
        }

        // Fallback: SEC EFTS full-text search. Kept only for names with zero
        // match in our own registry — see the fix comment above for why this
        // endpoint alone is unreliable for name→CIK resolution.
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
          alternatives: candidates.slice(1, 5),
          source: "sec_efts_fallback"
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
        const latestFiling = filings[0] || null;

        // Position-level holdings are only seeded for the scoped manager set
        // (Track A top 150 by AUM + Track B/C mega-filers + always-include —
        // see Section 16.3 of the current-state doc), not the full 13F filer
        // universe managermaster/filing13f cover. Scoped to the SPECIFIC
        // latest accession_number, not just "any row ever for this cik" —
        // a manager can be in-scope generally but not yet have this quarter's
        // holdings backfilled (holding13f_normalized ingestion can lag behind
        // filing13f, which is seeded from SEC submissions metadata directly).
        // Checking cik alone would report has_holdings_data: true off an old
        // quarter while the actual /api/13f-manager-holdings call for the
        // latest accession_number returns nothing — an empty table with no
        // explanation, worse than the gap this flag exists to close.
        const holdingsScopeRow = latestFiling
          ? await env.DB.prepare(
              "SELECT 1 AS present FROM holding13f_normalized WHERE cik = ? AND accession_number = ? LIMIT 1"
            ).bind(cik10, latestFiling.accession_number).first()
          : null;

        return json({
          cik: cik10,
          manager_name: identityRow ? identityRow.manager_name : null,
          normalized_name: identityRow ? identityRow.normalized_name : null,
          aliases: (aliasesRes.results || []).map(a => ({ alias: a.alias, source: a.source })),
          filings,
          latest_filing: latestFiling,
          has_holdings_data: !!holdingsScopeRow
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

// Mirrors normalizeName() in 13F Seed/seed-managermaster.js exactly — same
// lowercase/strip-punctuation/collapse-whitespace transform used to build
// managermaster.normalized_name and manageraliases.alias_normalized, so a
// query normalized here lines up with what's actually stored.
function normalizeManagerName(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Escapes LIKE wildcard characters in user input so a literal "%" or "_" in
// a searched manager name can't widen the match beyond intent.
function escapeLikeInput(s) {
  return s.replace(/[\\%_]/g, ch => "\\" + ch);
}

// Ranked name lookup against Meridian's own manager registry
// (managermaster + manageraliases) — checked before ever calling out to SEC.
// That registry is seeded as a comprehensive 13F filer list (every
// SUBMISSIONTYPE, not a holdings filter — see 13F Seed/seed-managermaster.js),
// so a name search here is resolving against actual company names, unlike
// SEC EFTS's full-text document search (see the /api/13f-search fix comment).
//
// Ranking: exact normalized-name match first, then prefix match, then
// substring match — same tiering applied to alias matches, so an alias hit
// never outranks a better primary-name hit for a different manager.
//
// Ties within a tier are broken by reported AUM (filing13f.value_total,
// latest report_period), NOT by name length. An earlier version of this fix
// used shortest-name-wins, which looked reasonable on "Appaloosa" but broke
// on manager families with many name-alike entities: "Bridgewater" resolved
// to "Bridgewater Advisors Inc." ($1.5B AUM) over the actual firm everyone
// means, "Bridgewater Associates, LP" ($27B AUM) — shorter name, wrong
// company. Same failure on "Point72": tiny shell subsidiaries like
// "Point72 (DIFC) Ltd" (no reported holdings) out-ranked the real US filer,
// "Point72 Asset Management, L.P." ($89B AUM), for having a shorter name.
// AUM is a direct, already-seeded signal of which same-named entity is the
// one a manager-name search actually means; name length isn't.
async function searchLocalManagerRegistry(db, rawQuery) {
  const norm = normalizeManagerName(rawQuery);
  if (!norm) return null;
  const escaped = escapeLikeInput(norm);
  const likePattern = `%${escaped}%`;

  const [nameRows, aliasRows] = await Promise.all([
    db.prepare(`
      SELECT cik, manager_name,
        CASE
          WHEN normalized_name = ?1 THEN 0
          WHEN normalized_name LIKE ?2 || '%' ESCAPE '\\' THEN 1
          ELSE 2
        END AS match_rank
      FROM managermaster
      WHERE normalized_name LIKE ?3 ESCAPE '\\'
      ORDER BY match_rank ASC, length(normalized_name) ASC
      LIMIT 15
    `).bind(norm, escaped, likePattern).all(),
    db.prepare(`
      SELECT m.cik, m.manager_name,
        CASE
          WHEN a.alias_normalized = ?1 THEN 0
          WHEN a.alias_normalized LIKE ?2 || '%' ESCAPE '\\' THEN 1
          ELSE 2
        END AS match_rank
      FROM manageraliases a
      JOIN managermaster m ON m.cik = a.cik
      WHERE a.alias_normalized LIKE ?3 ESCAPE '\\'
      ORDER BY match_rank ASC, length(a.alias_normalized) ASC
      LIMIT 15
    `).bind(norm, escaped, likePattern).all()
  ]);

  const byCik = new Map();
  for (const r of [...(nameRows.results || []), ...(aliasRows.results || [])]) {
    const existing = byCik.get(r.cik);
    if (!existing || r.match_rank < existing.match_rank) {
      byCik.set(r.cik, { cik: r.cik, name: r.manager_name, match_rank: r.match_rank });
    }
  }
  if (!byCik.size) return null;

  const aumByCik = await latestValueTotalsByCik(db, Array.from(byCik.keys()));

  const ranked = Array.from(byCik.values()).sort((a, b) =>
    a.match_rank - b.match_rank ||
    (aumByCik.get(b.cik) || -1) - (aumByCik.get(a.cik) || -1) ||
    (a.name || "").length - (b.name || "").length
  );
  const top = ranked[0];
  return {
    top: { cik: top.cik, name: top.name },
    alternatives: ranked.slice(1, 5).map(r => ({ cik: r.cik, name: r.name }))
  };
}

// Latest reported value_total (AUM, in filing13f) per CIK, for a bounded set
// of candidate CIKs — one flat query rather than a per-cik correlated
// subquery, since filing13f has no index on cik yet (see the KNOWN GAP note
// at the top of this file); grouping the "pick latest report_period's value"
// logic in JS avoids re-scanning filing13f once per candidate.
async function latestValueTotalsByCik(db, ciks) {
  const out = new Map();
  if (!ciks.length) return out;

  const placeholders = ciks.map((_, i) => `?${i + 1}`).join(",");
  const rows = await db.prepare(`
    SELECT cik, report_period, value_total
    FROM filing13f
    WHERE cik IN (${placeholders})
  `).bind(...ciks).all();

  const latestPeriodByCik = new Map();
  for (const r of rows.results || []) {
    const prevPeriod = latestPeriodByCik.get(r.cik);
    if (!prevPeriod || (r.report_period || "") > prevPeriod) {
      latestPeriodByCik.set(r.cik, r.report_period || "");
      out.set(r.cik, typeof r.value_total === "number" ? r.value_total : -1);
    }
  }
  return out;
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
