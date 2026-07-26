function openResearch(){
  document.getElementById('research-panel').classList.add('show');
  const rdInput = document.getElementById('rd-input');
  if (rdInput) rdInput.focus();
}
function closeResearch(){
  document.getElementById('research-panel').classList.remove('show');
}
function rpClick(e){if(e.target===document.getElementById('research-panel'))closeResearch();}

async function resFundSearch(){
  const inp=document.getElementById('rd-input-fund');
  const sym=inp.value.trim().toUpperCase();
  if(!sym)return;
  const body=document.getElementById('rd-body-fund');
  body.innerHTML=`<div class="rd-loading"><div class="rd-spinner"></div><br>Loading fundamentals for <strong>${sym}</strong>…</div>`;
  const d=await fetchResearch(sym);
  if(!d){
    body.innerHTML=`<div class="rd-none">No data available for <strong>${sym}</strong>.<br><span style="font-size:10px;color:var(--dim)">Check the ticker symbol and try again.</span></div>`;
    return;
  }
  renderResearch(sym,d,body);
}

function setResTab(tab) {
  document.querySelectorAll('.rd-mode-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById('tab-btn-' + tab).classList.add('active');
  document.querySelectorAll('.res-tab').forEach(t => t.classList.remove('show'));
  document.getElementById('tab-' + tab).classList.add('show');
}

async function res13FSearch() {
  const inp = document.getElementById('rd-input-13f');
  const mgr = inp.value.trim();
  if (!mgr) return;
  const body = document.getElementById('rd-body-13f');
  body.innerHTML = `<div class="rd-loading" style="margin-top:30px"><div class="rd-spinner"></div><br>Searching institutional filings for <strong>${escapeRdHtml(mgr)}</strong>…</div>`;
  try {
    const result = await searchManager(mgr);
    if (!result.ok) {
      body.innerHTML = '<div class="rd-none" style="margin-top:30px">No institutional filer found for ' + escapeRdHtml(mgr) + '.</div>';
      return;
    }
    // Route into the entity-linked Manager Page (ma-13f.js) rather than the
    // old raw-SEC-XML holdings modal. The Manager Page's identity + filing
    // history come from D1 (managermaster/filing13f), which covers the full
    // 13F filer universe, so this works for any manager search resolves —
    // only the holdings section itself is scope-limited, and it says so
    // honestly when it is (see has_holdings_data in worker-13f.js).
    body.innerHTML = `<div style="padding:16px 18px;font-size:11px;color:var(--dim)">Opened ${escapeRdHtml(result.name || mgr)} in Manager Page.</div>`;
    mgr_openManagerPage(result.cik);
  } catch (e) {
    body.innerHTML = `<div class="rd-none" style="margin-top:30px">Error fetching 13F for ${escapeRdHtml(mgr)}.</div>`;
  }
}

window.openResearch = openResearch;
window.closeResearch = closeResearch;
window.rpClick = rpClick;
window.setResTab = setResTab;
window.resFundSearch = resFundSearch;
window.res13FSearch = res13FSearch;
// (Note: window.resFilingsSearch is omitted as the function was not found in the original file)
