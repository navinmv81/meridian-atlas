// Dependencies this module needs from the global scope: MY_WORKER_URL, escapeRdHtml

let _holdingsData = [];

async function searchManager(name) {
  const resp = await fetch(`${MY_WORKER_URL}/api/13f-search?manager=${encodeURIComponent(name)}`);
  const data = await resp.json();
  if (!resp.ok) return { ok: false, error: data.error || 'Search failed' };
  return { ok: true, cik: data.cik, name: data.name, ticker: data.ticker };
}

async function load13FFilings(cik) {
  const resp = await fetch(`${MY_WORKER_URL}/api/13f-filings?cik=${encodeURIComponent(cik)}`);
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
    const proxyIndexUrl = `${MY_WORKER_URL}/?url=${encodeURIComponent(indexUrl)}`;
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
    const proxyDocUrl = `${MY_WORKER_URL}/?url=${encodeURIComponent(docUrl)}`;
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
