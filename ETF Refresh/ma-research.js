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
    await loadFilingsForCIK(result.cik, result.name);
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
