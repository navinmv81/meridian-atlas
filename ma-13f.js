// Dependencies this module needs from the global scope: MY_WORKER_URL, escapeRdHtml

let _holdingsData = [];

// SEC data requests use MY_WORKER_URL; the Cloudflare Worker must send this header to SEC: User-Agent: "MeridianAtlas contact@youremail.com" (cannot be set from index.html for proxied SEC hosts — configure the Worker).
async function resolveCIK(name) {
  const raw = String(name || '').trim();
  if (!raw) return [];
  const norm = (s) => String(s || '').toLowerCase();
  const q = norm(raw);
  const digitsOnly = raw.replace(/\D/g, '');
  if (/^\d{7,12}$/.test(digitsOnly)) {
    const c10 = digitsOnly.length > 10 ? digitsOnly.slice(-10) : digitsOnly.padStart(10, '0');
    return [{ cik: c10, name: 'CIK ' + c10 }];
  }
  const out = [];
  const seen = new Set();
  const add = (cikVal, dispName) => {
    const d = String(cikVal == null ? '' : cikVal).replace(/\D/g, '');
    if (!d) return;
    const c10 = d.length > 10 ? d.slice(-10) : d.padStart(10, '0');
    if (seen.has(c10)) return;
    seen.add(c10);
    out.push({ cik: c10, name: dispName || raw });
  };
  try {
    const ctUrl = 'https://www.sec.gov/files/company_tickers.json';
    const ctRes = await fetch(`${MY_WORKER_URL}/?sec13f=${encodeURIComponent(ctUrl)}`);
    if (ctRes.ok) {
      const ctData = await ctRes.json();
      const rows = Array.isArray(ctData) ? ctData : Object.values(ctData);
      for (const row of rows) {
        if (norm(row.ticker) === q) add(row.cik_str != null ? row.cik_str : row.cik, row.title || row.ticker);
      }
      if (out.length < 5) {
        for (const row of rows) {
          if (out.length >= 5) break;
          const title = norm(row.title || '');
          if (q.length >= 2 && title.includes(q)) add(row.cik_str != null ? row.cik_str : row.cik, row.title || row.ticker);
        }
      }
    }
  } catch (e) {
    console.error('resolveCIK company_tickers:', e);
  }
  if (out.length) return out.slice(0, 5);
  try {
    const quoted = '"' + raw.replace(/"/g, '') + '"';
    const eftsUrl = 'https://efts.sec.gov/LATEST/search-index?q=' + encodeURIComponent(quoted) + '&forms=' + encodeURIComponent('13F-HR') + '&size=50';
    const eftsRes = await fetch(`${MY_WORKER_URL}/?sec13f=${encodeURIComponent(eftsUrl)}`);
    if (!eftsRes.ok) return [];
    const eftsData = await eftsRes.json();
    const hits = (eftsData.hits && eftsData.hits.hits) || [];
    const byAcc = new Set();
    for (const hit of hits) {
      if (out.length >= 5) break;
      const id = hit._id || '';
      const accPart = id.split(':')[0];
      if (!accPart || byAcc.has(accPart)) continue;
      byAcc.add(accPart);
      const src = hit._source || {};
      const entity = src.entity_name || (Array.isArray(src.display_names) ? src.display_names[0] : src.display_names) || accPart;
      const dnJoin = Array.isArray(src.display_names) ? src.display_names.join(' ') : String(src.display_names || '');
      let cik = null;
      const m = dnJoin.match(/\(CIK[:\s]*(\d{7,10})\)/i) || String(entity).match(/\(CIK[:\s]*(\d{7,10})\)/i);
      if (m) cik = m[1].padStart(10, '0').slice(-10);
      else {
        const parts = accPart.split('-');
        if (parts[0] && /^\d{10}$/.test(parts[0])) cik = parts[0];
      }
      if (cik) add(cik, entity);
    }
  } catch (e) {
    console.error('resolveCIK EFTS:', e);
  }
  return out.slice(0, 5);
}

async function fetch13F(cik) {
  const d = String(cik == null ? '' : cik).replace(/\D/g, '');
  if (!d) return [];
  const cik10 = d.length > 10 ? d.slice(-10) : d.padStart(10, '0');
  const url = `https://data.sec.gov/submissions/CIK${cik10}.json`;
  const proxyUrl = `${MY_WORKER_URL}/?url=${encodeURIComponent(url)}`;
  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) return [];
    const j = await response.json();
    const recent = j.filings && j.filings.recent;
    if (!recent || !recent.form) return [];
    const cikInt = String(parseInt(cik10, 10));
    const list = [];
    for (let i = 0; i < recent.form.length; i++) {
      if (recent.form[i] !== '13F-HR') continue;
      const accession = recent.accessionNumber[i];
      const accNoDash = accession.replace(/-/g, '');
      const id = cikInt + '_' + accNoDash;
      const filingDate = recent.filingDate[i];
      const reportDate = recent.reportDate[i];
      const rd = new Date(String(reportDate) + 'T12:00:00Z');
      const qtr = isNaN(rd.getTime()) ? '' : 'Q' + (Math.floor(rd.getUTCMonth() / 3) + 1) + ' ' + rd.getUTCFullYear();
      const link = 'https://www.sec.gov/cgi-bin/viewer?action=view&cik=' + encodeURIComponent(cikInt) + '&accession_number=' + encodeURIComponent(accession) + '&xbrl_type=v';
      list.push({ id, cik: cik10, accession, form: '13F-HR', date: filingDate, period: reportDate, qtr, link });
    }
    return list;
  } catch (e) {
    console.error('13F Error:', e);
    return [];
  }
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
    const proxyIndexUrl = `${MY_WORKER_URL}/?sec13f=${encodeURIComponent(indexUrl)}`;
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
    const proxyDocUrl = `${MY_WORKER_URL}/?sec13f=${encodeURIComponent(docUrl)}`;
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
    const filings = await fetch13F(cik);
    const subLine = ((name && String(name).trim()) ? escapeRdHtml(String(name).trim()) + ' — ' : '') + 'CIK ' + escapeRdHtml(String(cik));
    if (!filings.length) {
      body.innerHTML = '<div style="padding:16px 18px"><div style="font-size:11px;color:var(--dim);margin-bottom:10px">' + subLine + '</div><div class="rd-none">No 13F-HR filings found in SEC submissions for this CIK.</div></div>';
      return;
    }
    let html = '<div style="padding:16px 18px">\n      <div style="font-size:13px;font-weight:700;margin-bottom:12px">' + escapeRdHtml(disp) + '</div>\n      <div style="font-size:11px;color:var(--dim);margin-bottom:12px">' + subLine + '</div>\n      <table class="res-table">\n        <thead><tr><th>Form</th><th>Filed Date</th><th>Period End</th><th style="text-align:center">Action</th><th style="text-align:right">Link</th></tr></thead>\n        <tbody>';
    filings.forEach(f => {
      const cleanName = disp.replace(/'/g, "\\'");
      const fDate = f.qtr + ' · Filed ' + f.date;
      html += '<tr>\n        <td><span class="res-badge bPR">' + f.form + '</span></td>\n        <td style="color:var(--dim)">' + f.date + '</td>\n        <td><strong>' + f.qtr + '</strong></td>\n        <td style="text-align:center"><button class="h-btn" onclick="toggleHoldings(this, \'' + f.id + '\', \'' + cleanName + '\', \'' + fDate + '\')">View Holdings</button></td>\n        <td style="text-align:right"><a class="res-link" href="' + f.link + '" target="_blank">Open filing ↗</a></td>\n      </tr>';
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
window.resolveCIK = resolveCIK;
