let _samSym = '', _samName = '';

// Batch 4: In-memory quick profile cache (1h TTL matches Worker edge cache)
const _samProfileCache = new Map();
function _samProfileCacheGet(sym) {
  const hit = _samProfileCache.get(sym);
  if (hit && Date.now() < hit.expiresAt) return hit.data;
  if (hit) _samProfileCache.delete(sym);
  return null;
}
function _samProfileCacheSet(sym, data) {
  _samProfileCache.set(sym, { data, expiresAt: Date.now() + 3600 * 1000 });
}

async function fetchQuickProfile(sym) {
  const cached = _samProfileCacheGet(sym);
  if (cached) return cached;
  try {
    const url = `${MY_WORKER_URL}/?quickprofile=${encodeURIComponent(sym)}`;
    const res = await fetchWithTimeout(url, 6000);
    if (res.ok && res.data?.symbol) {
      _samProfileCacheSet(sym, res.data);
      return res.data;
    }
  } catch(e) {
    console.warn('Quick profile fetch failed for', sym, e.message);
  }
  return null;
}

function showSAM(sym, name) {
  _samSym = sym;
  _samName = name;

  // Fill header
  document.getElementById('sam-sym').textContent = sym;
  document.getElementById('sam-name').textContent = name || sym;

  // Pull live price from _mdata if already loaded
  const d = window._mdata?.[sym];
  const priceEl = document.getElementById('sam-price');
  const chgEl = document.getElementById('sam-chg');
  if (d?.price) {
    priceEl.textContent = d.price.toFixed(2);
    const pct = d.pct ?? 0, chg = d.chg ?? 0;
    const sign = pct >= 0 ? '▲' : '▼';
    chgEl.textContent = `${sign} ${Math.abs(pct).toFixed(2)}% (${chg >= 0 ? '+' : ''}${chg.toFixed(2)})`;
    chgEl.className = 'sam-chg ' + (pct >= 0 ? 'up' : 'dn');
  } else {
    priceEl.textContent = '—';
    chgEl.textContent = '';
  }

  // Show/hide DCF button based on whether symbol is supported
  const dcfBtn = document.getElementById('sam-dcf-btn');
  if (dcfBtn) {
    const dcfSupported = typeof DCF_ALLOWED !== 'undefined'
      ? DCF_ALLOWED.has(sym.toUpperCase())
      : true; // show by default if we can't check
    dcfBtn.style.display = dcfSupported ? '' : 'none';
  }

  // Clear any previous enrichment
  const metaEl = document.getElementById('sam-meta');
  const descEl = document.getElementById('sam-desc');
  if (metaEl) metaEl.innerHTML = '<span class="sam-loading-meta"></span>';
  if (descEl) { descEl.style.display = 'none'; descEl.textContent = ''; }

  document.getElementById('sam-overlay').classList.add('show');
  document.getElementById('sam-box').focus?.();

  // Batch 4: async enrichment — fires after modal is visible, updates in place
  fetchQuickProfile(sym).then(p => {
    // Guard: if user already closed or switched symbols, discard
    if (_samSym !== sym) return;

    if (metaEl) {
      const parts = [];
      if (p?.exchange) parts.push(p.exchange);
      if (p?.sector)   parts.push(p.sector);
      if (p?.country && p.country !== 'US') parts.push(p.country);
      metaEl.textContent = parts.join(' · ') || '';
    }

    if (descEl && p?.description) {
      descEl.textContent = p.description;
      descEl.style.display = '';
      descEl.style.webkitLineClamp = '3';
    }

    // If we got a name from FMP and name was just the symbol, upgrade it
    if (p?.name && document.getElementById('sam-name')?.textContent === sym) {
      document.getElementById('sam-name').textContent = p.name;
      _samName = p.name;
    }

    // Upgrade employee count in description sub-row if available
    if (p?.employees && metaEl && p.employees > 0) {
      const emp = p.employees.toLocaleString() + ' employees';
      const existing = metaEl.textContent;
      if (existing && !existing.includes('employee')) {
        metaEl.textContent = existing + ' · ' + emp;
      }
    }
  });
}

function closeSAM() {
  document.getElementById('sam-overlay').classList.remove('show');
  _samSym = '';
  _samName = '';
}

function samOverlayClick(e) {
  if (e.target === document.getElementById('sam-overlay')) closeSAM();
}

// Action handlers — each closes the SAM then fires the existing flow unchanged
function samOpenChart() {
  // Capture current state before closing modal
  const sym = _samSym;
  const name = _samName;
  closeSAM();
  if (sym) {
    openBySymbol(sym, name);
  } else {
    console.warn('samOpenChart: Symbol was lost');
  }
}

function samOpenResearch() {
  closeSAM();
  // Pre-fill the Research panel's Fundamentals input with the symbol and open
  const fundInput = document.getElementById('rd-input-fund');
  if (fundInput) fundInput.value = _samSym;
  openResearch();
  // Auto-trigger the search so the user lands on data immediately
  setTimeout(() => resFundSearch(), 120);
}

function samAddToWatchlist() {
  wlAdd(_samSym, _samName);
  // Give brief visual feedback then close
  const btn = document.getElementById('sam-wl-btn');
  if (btn) {
    const orig = btn.querySelector('span:not(.sam-btn-icon):not(.sam-btn-sub):not(.sam-btn-text)') ||
                 btn.querySelector('.sam-btn-text span:first-child');
    if (orig) {
      const prev = orig.textContent;
      orig.textContent = 'Added ✓';
      setTimeout(() => { orig.textContent = prev; closeSAM(); }, 800);
    } else {
      closeSAM();
    }
  } else {
    closeSAM();
  }
}

function samOpenDCF() {
  closeSAM();
  openDCF();
}

async function handleSearch(query) {
  const resBox = document.getElementById('search-results');
  if (!resBox) return; // Safety check
  const q=query.trim().toLowerCase();
  if (q.length < 2) { resBox.style.display = 'none'; return; }

  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    try {
      const pool=getWatchlistSearchPool();
      const ranked=[...new Map(pool
        .map(x=>({x,score:wlSearchScore(x,q)}))
        .filter(r=>r.score>=0)
        .sort((a,b)=>b.score-a.score)
        .slice(0,12)
        .map(r=>[r.x.s,r.x])
      ).values()];

      if (ranked.length > 0) {
        resBox.innerHTML = ranked.map(s => `
          <div style="padding:12px; cursor:pointer; border-bottom:1px solid var(--border); background:var(--bg2); color:var(--text); transition: background 0.2s;" 
               onmouseover="this.style.background='var(--bg3)'" 
               onmouseout="this.style.background='var(--bg2)'"
               onclick="selectForWatchlist('${s.s}','${(s.n||s.s).replace(/'/g,"\\'")}')">
            <b style="color:var(--blue);">${s.s}</b> - ${s.n || s.s}
          </div>
        `).join('');
        resBox.style.display = 'block';
      } else {
        resBox.style.display = 'none';
      }
    } catch (e) { 
      console.error("Search failed", e); 
      resBox.style.display = 'none';
    }
  }, 300);
}

window.closeSAM = closeSAM;
window.samOverlayClick = samOverlayClick;
window.samOpenChart = samOpenChart;
window.samOpenResearch = samOpenResearch;
window.samAddToWatchlist = samAddToWatchlist;
window.samOpenDCF = samOpenDCF;
window.handleSearch = handleSearch;
