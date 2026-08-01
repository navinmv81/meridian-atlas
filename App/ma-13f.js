// Dependencies this module needs from the global scope: escapeRdHtml
// MY_WORKER_URL is intentionally NOT used here — 13F routes now have dedicated Workers.
const WORKER_13F_URL = "https://meridian-13f.navinmv1981.workers.dev";
const WORKER_FILINGS_URL = "https://meridian-filings.navinmv1981.workers.dev";

let _holdingsData = [];

// Shared stacking order for the Manager Page (ma-13f.js) and Entity overlay
// (ma-entities.js). Navigation between them can go either direction — issuer
// -> manager -> issuer -> ... — so whichever was opened most recently must
// render on top regardless of type. A static z-index split only satisfies
// one direction and buries the overlay on the reverse hop.
let _atlasOverlayZ = 1500;
function _nextAtlasOverlayZ() { return ++_atlasOverlayZ; }

async function searchManager(name) {
  const resp = await fetch(`${WORKER_13F_URL}/api/13f-search?manager=${encodeURIComponent(name)}`);
  const data = await resp.json();
  if (!resp.ok) return { ok: false, error: data.error || 'Search failed' };
  return { ok: true, cik: data.cik, name: data.name, ticker: data.ticker };
}

async function load13FFilings(cik) {
  const resp = await fetch(`${WORKER_13F_URL}/api/13f-filings?cik=${encodeURIComponent(cik)}`);
  const data = await resp.json();
  if (!resp.ok) return { ok: false, error: data.error || 'Failed to load 13F filings' };
  return { ok: true, cik: data.cik, name: data.name, filings: data.filings };
}

// 1. Standalone fetcher (OUTSIDE of toggleHoldings)
async function fetch13FHoldings(filingId) {
  try {
    // STEP 1 — Build URLs from the accession number
    const [cikInt, accNoDash] = filingId.split('_');
    const accWithDash = accNoDash.slice(0,10) + '-' + accNoDash.slice(10,12) + '-' + accNoDash.slice(12);
    const baseFolder = `https://www.sec.gov/Archives/edgar/data/${cikInt}/${accNoDash}/`;
    const indexUrl = `${baseFolder}${accWithDash}-index.htm`;

    // STEP 2 — Fetch index.htm and parse it to find the InfoTable XML filename
    const proxyIndexUrl = `${WORKER_FILINGS_URL}/api/filing-doc?url=${encodeURIComponent(indexUrl)}`;
    const hRes = await fetch(proxyIndexUrl);
    if (!hRes.ok) throw new Error("Could not fetch filing index");
    
    const htmlText = await hRes.text();
    const hDoc = new DOMParser().parseFromString(htmlText, 'text/html');
    const links = Array.from(hDoc.querySelectorAll('a[href]')).map(a => a.getAttribute('href'));
    
    let bestHref = null;
    let priority = 99;
    
    for (const href of links) {
      if (!href) continue;
      const lower = href.toLowerCase();
      // a. href contains "infotable" (case-insensitive) AND does NOT contain "xslForm13F"
      if (lower.includes('infotable') && !lower.includes('xslform13f')) {
        if (priority > 1) { bestHref = href; priority = 1; }
      } 
      // b. href ends in ".xml" AND does NOT contain "primary_doc" AND does NOT contain "xslForm13F"
      //    AND does NOT end in "-index.htm" AND does NOT end in ".txt"
      else if (lower.endsWith('.xml') && !lower.includes('primary_doc') && !lower.includes('xslform13f') && !lower.endsWith('-index.htm') && !lower.endsWith('.txt')) {
        if (priority > 2) { bestHref = href; priority = 2; }
      }
    }
    
    if (!bestHref) {
      console.error("Could not locate InfoTable in filing index");
      return [];
    }
    
    let docUrl = null;
    if (bestHref.startsWith('/Archives')) {
      docUrl = `https://www.sec.gov${bestHref}`;
    } else if (!bestHref.startsWith('http')) {
      // relative path
      docUrl = `${baseFolder}${bestHref}`;
    } else {
      docUrl = bestHref;
    }

    // STEP 3 — Fetch the InfoTable XML and parse holdings
    const proxyDocUrl = `${WORKER_FILINGS_URL}/api/filing-doc?url=${encodeURIComponent(docUrl)}`;
    const xmlRes = await fetch(proxyDocUrl);
    if (!xmlRes.ok) throw new Error("Could not fetch InfoTable XML");
    
    const xmlTextBody = await xmlRes.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlTextBody, 'text/xml');
    
    const entries = Array.from(xmlDoc.getElementsByTagName('infoTable'))
      .concat(Array.from(xmlDoc.getElementsByTagName('ns1:infoTable')));
      
    if (entries.length === 0) return [];
    
    const getVal = (el, tag) => {
      const found = el.getElementsByTagName(tag)[0] || el.getElementsByTagName('ns1:' + tag)[0];
      return found ? found.textContent.trim() : '';
    };
    
    const rows = [];
    for (const e of entries) {
      const issuer = getVal(e, 'nameOfIssuer');
      const cls = getVal(e, 'titleOfClass');
      const cusip = getVal(e, 'cusip');
      const value = parseInt(getVal(e, 'value') || '0', 10) * 1000;
      const shares = parseInt(getVal(e, 'sshPrnamt') || '0', 10);
      const type = getVal(e, 'sshPrnamtType') || 'SH';
      const disc = getVal(e, 'investmentDiscretion') || 'SOLE';
      const vote = parseInt(getVal(e, 'Sole') || getVal(e, 'sole') || '0', 10) || shares;
      
      rows.push({
        issuer: issuer || '-',
        class: cls || '-',
        cusip: cusip || '-',
        val: value,
        shs: shares,
        type: type,
        disc: disc,
        vote: vote
      });
    }
    
    rows.sort((a, b) => b.val - a.val);
    return rows;
  } catch (e) {
    console.error('Holdings Error:', e);
    return [];
  }
}

async function loadFilingsForCIK(cik, name) {
  const body = document.getElementById('rd-body-13f');
  const disp = (name && String(name).trim()) ? String(name).trim() : ('CIK ' + cik);
  body.innerHTML = '<div class="rd-loading" style="margin-top:30px"><div class="rd-spinner"></div><br>Loading 13F-HR filings for <strong>' + escapeRdHtml(disp) + '</strong>…</div>';
  try {
    const result = await load13FFilings(cik);
    if (!result.ok) {
      body.innerHTML = '<div class="rd-none" style="margin-top:30px">' + escapeRdHtml(result.error) + '</div>';
      return;
    }
    const resolvedName = result.name || disp;
    const subLine = escapeRdHtml(resolvedName) + ' — CIK ' + escapeRdHtml(String(cik));
    const filings = result.filings || [];
    if (!filings.length) {
      body.innerHTML = '<div style="padding:16px 18px"><div style="font-size:11px;color:var(--dim);margin-bottom:10px">' + subLine + '</div><div class="rd-none">No 13F-HR filings found in SEC submissions for this CIK.</div></div>';
      return;
    }
    let html = '<div style="padding:16px 18px"><div style="font-size:13px;font-weight:700;margin-bottom:12px">' + escapeRdHtml(resolvedName) + '</div><div style="font-size:11px;color:var(--dim);margin-bottom:12px">' + subLine + '</div><table class="res-table"><thead><tr><th>Form</th><th>Filed Date</th><th>Period End</th><th style="text-align:center">Action</th><th style="text-align:right">Link</th></tr></thead><tbody>';
    filings.forEach(f => {
      const cleanName = resolvedName.replace(/'/g, "\\'");
      const accNoDash = (f.accessionNumber || '').replace(/-/g, '');
      const cikInt = String(parseInt(cik, 10));
      const id = cikInt + '_' + accNoDash;
      const rd = new Date(String(f.reportDate || '') + 'T12:00:00Z');
      const qtr = isNaN(rd.getTime()) ? f.reportDate || '' : 'Q' + (Math.floor(rd.getUTCMonth() / 3) + 1) + ' ' + rd.getUTCFullYear();
      const fDate = qtr + ' · Filed ' + (f.filingDate || '');
      html += '<tr><td><span class="res-badge bPR">' + escapeRdHtml(f.form) + '</span></td><td style="color:var(--dim)">' + escapeRdHtml(f.filingDate || '') + '</td><td><strong>' + escapeRdHtml(qtr) + '</strong></td><td style="text-align:center"><button class="h-btn" onclick="toggleHoldings(this, \'' + id + '\', \'' + cleanName + '\', \'' + fDate + '\')">View Holdings</button></td><td style="text-align:right"><a class="res-link" href="' + escapeRdHtml(f.link || '') + '" target="_blank">Open filing ↗</a></td></tr>';
    });
    html += '</tbody></table></div>';
    body.innerHTML = html;
  } catch (e) {
    body.innerHTML = '<div class="rd-none" style="margin-top:30px">Error fetching 13F for ' + escapeRdHtml(disp) + '.</div>';
  }
}

// 2. The UI Toggle Logic
async function toggleHoldings(btn, filingId, entityName, filingDate) {
    const oldText = btn.textContent;
    btn.textContent = 'Loading...';
    try {
        const data = await fetch13FHoldings(filingId);
        btn.textContent = oldText;
        if (!data || data.length === 0) {
            alert('No holdings found for this filing.');
            return;
        }
        
        const mappedData = data.map(d => ({
            name: d.issuer,
            cusip: d.cusip,
            value: d.val,
            shares: d.shs,
            type: d.type || 'SH'
        }));
        
        openHoldingsModal(entityName, filingDate, mappedData);
    } catch (e) {
        console.error(e);
        btn.textContent = oldText;
        alert('Failed to load holdings.');
    }
}

function openHoldingsModal(title, meta, holdings) {
  _holdingsData = holdings;
  document.getElementById('holdingsModalTitle').textContent = title;
  document.getElementById('holdingsModalMeta').textContent = meta;
  document.getElementById('holdingsSearch').value = '';
  document.getElementById('holdingsSortSelect').value = 'value';
  renderHoldingsTable(_holdingsData);
  const modal = document.getElementById('holdingsModal');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeHoldingsModal() {
  document.getElementById('holdingsModal').style.display = 'none';
  document.body.style.overflow = '';
}

function renderHoldingsTable(data) {
  const sortBy = document.getElementById('holdingsSortSelect').value;
  const filter = (document.getElementById('holdingsSearch').value || '').toLowerCase();

  let filtered = data.filter(h =>
    !filter ||
    (h.name || '').toLowerCase().includes(filter) ||
    (h.cusip || '').toLowerCase().includes(filter)
  );

  if (sortBy === 'value') filtered.sort((a,b) => (b.value||0) - (a.value||0));
  else if (sortBy === 'shares') filtered.sort((a,b) => (b.shares||0) - (a.shares||0));
  else if (sortBy === 'name') filtered.sort((a,b) => (a.name||'').localeCompare(b.name||''));

  const fmt = n => n ? '$' + Math.round(n).toLocaleString() : '—';
  const fmtN = n => n ? Math.round(n).toLocaleString() : '—';

  const tbody = document.getElementById('holdingsTableBody');
  tbody.innerHTML = filtered.map((h, i) => `
    <tr style="border-bottom:1px solid var(--border); ${i%2===0?'background:var(--bg2);':'background:var(--bg3);'}">
      <td style="padding:8px; text-align:right; color:var(--dim);">${i+1}</td>
      <td style="padding:8px; color:var(--text); font-weight:600; font-family:var(--sans);">${h.name || '—'}</td>
      <td style="padding:8px; color:var(--dim); font-family:var(--mono); font-size:0.8rem;">${h.cusip || '—'}</td>
      <td style="padding:8px; text-align:right; color:var(--text2); font-weight:600;">${fmt(h.value)}</td>
      <td style="padding:8px; text-align:right; color:var(--text2);">${fmtN(h.shares)}</td>
      <td style="padding:8px; text-align:center; color:var(--dim); font-size:0.75rem;">${h.type || 'SH'}</td>
    </tr>
  `).join('');

  document.getElementById('holdingsModalMeta').textContent =
    `${filtered.length.toLocaleString()} positions${filter ? ' (filtered)' : ''}`;
}

document.addEventListener('DOMContentLoaded', () => {
  const s = document.getElementById('holdingsSearch');
  const o = document.getElementById('holdingsSortSelect');
  if (s) s.addEventListener('input', () => renderHoldingsTable(_holdingsData));
  if (o) o.addEventListener('change', () => renderHoldingsTable(_holdingsData));
  
  const hModal = document.getElementById('holdingsModal');
  if (hModal) {
    hModal.addEventListener('click', function(e) {
      if (e.target === this) closeHoldingsModal();
    });
  }
});

// Explicit window bindings
window.toggleHoldings = toggleHoldings;
window.loadFilingsForCIK = loadFilingsForCIK;
window.closeHoldingsModal = closeHoldingsModal;
window.searchManager = searchManager;
window.load13FFilings = load13FFilings;

// ── Manager Page (S2.19) ─────────────────────────────────────────────────────
// Sections: identity header, filing history (last 4 quarters), latest
// holdings (top 25 + show-all), navigation into entity pages via
// showEntityOverlay() from ma-entities.js.

let _mgrHoldingsData = [];
let _mgrHoldingsShowAll = false;
let _mgrHoldingsMeta = { reportPeriod: '', filedDate: '' };
let _mgrAliasesData = [];
let _mgrAliasesShowAll = false;

function mgr_qtrLabel(reportPeriod) {
  const d = new Date(String(reportPeriod || '') + 'T12:00:00Z');
  if (isNaN(d.getTime())) return reportPeriod || '';
  return 'Q' + (Math.floor(d.getUTCMonth() / 3) + 1) + ' ' + d.getUTCFullYear();
}

async function mgr_fetchManagerData(cik) {
  const resp = await fetch(`${WORKER_13F_URL}/api/13f-manager?cik=${encodeURIComponent(cik)}`);
  const data = await resp.json();
  if (!resp.ok) return { ok: false, error: data.error || 'Failed to load manager data' };
  return { ok: true, ...data };
}

async function mgr_fetchHoldings(cik, accessionNumber) {
  const resp = await fetch(`${WORKER_13F_URL}/api/13f-manager-holdings?cik=${encodeURIComponent(cik)}&accession_number=${encodeURIComponent(accessionNumber)}`);
  const data = await resp.json();
  if (!resp.ok) return { ok: false, error: data.error || 'Failed to load holdings' };
  return { ok: true, ...data };
}

function mgr_injectPanel() {
  if (document.getElementById('mgr-page-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'mgr-page-overlay';
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: var(--bg, #0f1117); overflow-y: auto; display: none;
  `;
  document.body.appendChild(overlay);
}

function mgr_renderShell(bodyHtml) {
  return `
    <div style="padding:32px; max-width:1000px; margin:0 auto;">
      <button onclick="mgr_closeManagerPage()" style="background:none;border:none;color:var(--blue);cursor:pointer;font-size:0.9em;margin-bottom:24px;display:block;">← Close</button>
      ${bodyHtml}
    </div>`;
}

function mgr_openManagerPage(cik) {
  mgr_injectPanel();
  const overlay = document.getElementById('mgr-page-overlay');
  overlay.style.zIndex = _nextAtlasOverlayZ();
  overlay.style.display = 'block';
  overlay.innerHTML = mgr_renderShell('<div class="rd-loading"><div class="rd-spinner"></div><br>Loading manager…</div>');
  document.body.style.overflow = 'hidden';
  mgr_loadManager(cik);
}

function mgr_closeManagerPage() {
  const overlay = document.getElementById('mgr-page-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
}

async function mgr_loadManager(cik) {
  const overlay = document.getElementById('mgr-page-overlay');
  if (!overlay) return;

  const result = await mgr_fetchManagerData(cik);
  if (!result.ok) {
    overlay.innerHTML = mgr_renderShell(`<div class="rd-none" style="margin-top:30px">${escapeRdHtml(result.error)}</div>`);
    return;
  }

  const filings = result.filings || [];
  if (!filings.length) {
    overlay.innerHTML = mgr_renderShell(
      mgr_renderIdentityHeader(result) +
      '<div class="rd-none" style="margin-top:20px">No 13F filings found for this manager</div>'
    );
    return;
  }

  const latest = result.latest_filing || filings[0];
  const isNT = String(latest.amendment_type || '').startsWith('13F-NT');

  let html = mgr_renderIdentityHeader(result) + mgr_renderFilingHistory(filings);

  if (isNT) {
    html += '<div class="rd-none" style="margin-top:20px">This manager filed 13F-NT — no holdings reported for this period</div>';
    overlay.innerHTML = mgr_renderShell(html);
    return;
  }

  // Position-level holdings are only tracked for a scoped manager set (see
  // has_holdings_data comment in worker-13f.js). Rather than fetch
  // /api/13f-manager-holdings and render a silently-empty table for managers
  // outside that scope, say so plainly and link straight to the SEC filing.
  if (!result.has_holdings_data) {
    const filingUrl = mgr_secFilingIndexUrl(result.cik, latest.accession_number);
    html += `
      <div class="rd-none" style="margin-top:20px">
        Position-level holdings aren't tracked for this manager. Meridian Atlas
        currently tracks full holdings for the top ~150 managers by AUM plus a
        set of named mega-filers — not the full 13F universe.
        ${filingUrl ? `<div style="margin-top:8px"><a class="res-link" href="${escapeRdHtml(filingUrl)}" target="_blank" rel="noopener">View this filing on SEC EDGAR →</a></div>` : ''}
      </div>`;
    overlay.innerHTML = mgr_renderShell(html);
    return;
  }

  html += '<div id="mgr-holdings-section" style="margin-top:20px"><div class="rd-loading"><div class="rd-spinner"></div><br>Loading holdings…</div></div>';
  overlay.innerHTML = mgr_renderShell(html);

  mgr_loadHoldings(result.cik, latest.accession_number, latest.report_period, latest.filing_date);
}

// Direct SEC EDGAR filing-index URL — deliberately not routed through the
// meridian-filings proxy, matching the Bug 1 fix in ma-entities.js
// (_issuerFilingIndexUrl): the proxy is for fetching a single document body,
// and pointed at a bare accession folder it returns SEC's raw directory
// listing rather than the filing itself.
function mgr_secFilingIndexUrl(cik, accessionNumber) {
  const cikNum = parseInt(cik, 10);
  const accNoDash = String(accessionNumber || '').replace(/-/g, '');
  if (!cikNum || !accNoDash) return null;
  const accWithDash = accNoDash.length === 18
    ? `${accNoDash.slice(0, 10)}-${accNoDash.slice(10, 12)}-${accNoDash.slice(12)}`
    : accNoDash;
  return `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accNoDash}/${accWithDash}-index.htm`;
}

function mgr_renderIdentityHeader(data) {
  const name = data.manager_name || ('CIK ' + data.cik);
  _mgrAliasesData = data.aliases || [];
  _mgrAliasesShowAll = false;
  const aliasBlock = _mgrAliasesData.length
    ? `<div id="mgr-aliases-line" style="margin-top:8px;font-size:11px;color:var(--dim)">${mgr_renderAliasesLine()}</div>`
    : '';
  return `
    <div style="padding:18px 20px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);margin-bottom:16px">
      <h2 style="margin:0 0 6px;font-size:17px;font-weight:700;color:var(--text)">${escapeRdHtml(name)}</h2>
      <div style="font-size:11px;color:var(--text2)">CIK ${escapeRdHtml(String(data.cik))}${data.normalized_name ? ' · ' + escapeRdHtml(data.normalized_name) : ''}</div>
      ${aliasBlock}
    </div>`;
}

function mgr_renderAliasesLine() {
  const visible = _mgrAliasesShowAll ? _mgrAliasesData : _mgrAliasesData.slice(0, 5);
  const remaining = _mgrAliasesData.length - visible.length;
  const moreLink = remaining > 0
    ? ` <span style="cursor:pointer;color:var(--blue)" onclick="mgr_showAllAliases()">+${remaining} more</span>`
    : '';
  return `Also known as: ${visible.map(a => escapeRdHtml(a.alias)).join(', ')}${moreLink}`;
}

function mgr_showAllAliases() {
  _mgrAliasesShowAll = true;
  const el = document.getElementById('mgr-aliases-line');
  if (el) el.innerHTML = mgr_renderAliasesLine();
}

function mgr_renderFilingHistory(filings) {
  const mostRecentFiled = (filings[0] && filings[0].filing_date) || '';
  const rows = filings.map(f => `
    <tr>
      <td>${escapeRdHtml(mgr_qtrLabel(f.report_period))}</td>
      <td style="color:var(--dim)">${escapeRdHtml(f.filing_date || '')}</td>
      <td><span class="res-badge">${escapeRdHtml(f.amendment_type || '')}</span></td>
      <td style="text-align:right">${f.entry_total != null ? Number(f.entry_total).toLocaleString() : '—'}</td>
      <td style="text-align:right">${f.value_total != null ? '$' + Number(f.value_total).toLocaleString() : '—'}</td>
    </tr>`).join('');

  return `
    <div style="margin-bottom:8px;font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--dim)">Filing History</div>
    <div style="font-size:10px;color:var(--muted);margin-bottom:8px">Filing data as of ${escapeRdHtml(mostRecentFiled)}</div>
    <table class="res-table">
      <thead><tr><th>Period</th><th>Filed</th><th>Type</th><th style="text-align:right">Entries</th><th style="text-align:right">Value</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

async function mgr_loadHoldings(cik, accessionNumber, reportPeriod, filedDate) {
  const section = document.getElementById('mgr-holdings-section');
  if (!section) return;

  const result = await mgr_fetchHoldings(cik, accessionNumber);
  if (!result.ok) {
    section.innerHTML = `<div class="rd-none">${escapeRdHtml(result.error)}</div>`;
    return;
  }

  _mgrHoldingsData = (result.holdings || []).slice().sort((a, b) => (b.value || 0) - (a.value || 0));
  _mgrHoldingsShowAll = false;
  _mgrHoldingsMeta = { reportPeriod, filedDate };
  section.innerHTML = mgr_renderHoldingsSection();
}

function mgr_renderHoldingsSection() {
  const { reportPeriod, filedDate } = _mgrHoldingsMeta;
  const total = _mgrHoldingsData.length;
  const visible = _mgrHoldingsShowAll ? _mgrHoldingsData : _mgrHoldingsData.slice(0, 25);

  const rows = visible.map(h => {
    const clickable = h.entity_id != null;
    const trOpen = clickable
      ? `<tr style="cursor:pointer" onclick="mgr_openEntity(${h.entity_id})">`
      : `<tr>`;
    const nameCell = clickable
      ? `<span style="color:var(--blue)">${escapeRdHtml(h.issuer_name || '—')}</span>`
      : `<span>${escapeRdHtml(h.issuer_name || '—')}</span>`;
    return `
      ${trOpen}
        <td>${nameCell}</td>
        <td style="font-family:var(--mono);font-size:0.8rem;color:var(--dim)">${escapeRdHtml(h.cusip || '—')}</td>
        <td style="text-align:right">${h.value != null ? '$' + Number(h.value).toLocaleString() : '—'}</td>
        <td style="text-align:right">${h.shares != null ? Number(h.shares).toLocaleString() : '—'}</td>
        <td style="text-align:center">${escapeRdHtml(h.put_call || '—')}</td>
      </tr>`;
  }).join('');

  const showAllBtn = (!_mgrHoldingsShowAll && total > 25)
    ? `<button class="h-btn" onclick="mgr_showAllHoldings()" style="margin-top:10px">Show all ${total} holdings</button>`
    : '';

  return `
    <div style="margin-bottom:8px;font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--dim)">Latest Holdings</div>
    <div style="font-size:10px;color:var(--muted);margin-bottom:8px">Holdings as of ${escapeRdHtml(mgr_qtrLabel(reportPeriod))}, filed ${escapeRdHtml(filedDate || '')}</div>
    <table class="res-table">
      <thead><tr><th>Issuer</th><th>CUSIP</th><th style="text-align:right">Value</th><th style="text-align:right">Shares</th><th style="text-align:center">Type</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${showAllBtn}`;
}

function mgr_showAllHoldings() {
  _mgrHoldingsShowAll = true;
  const section = document.getElementById('mgr-holdings-section');
  if (!section) return;
  section.innerHTML = mgr_renderHoldingsSection();
}

function mgr_openEntity(entityId) {
  if (entityId == null) return;
  if (typeof showEntityOverlay === 'function') showEntityOverlay(entityId, 'Manager');
}

// Explicit window bindings — Manager page
window.mgr_openManagerPage = mgr_openManagerPage;
window.mgr_closeManagerPage = mgr_closeManagerPage;
window.mgr_showAllHoldings = mgr_showAllHoldings;
window.mgr_openEntity = mgr_openEntity;
window.mgr_showAllAliases = mgr_showAllAliases;
