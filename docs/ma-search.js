let searchTimer;
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

// ─── MA-NOV-UI.HOME.BUILD: homepage company search (spec MA-NOV-UI §2.5, §2.7) ─────────────
// Search domain only: it reads the shared helper data_entitiesGet (ma-data.js) and moves to
// #/entity/{id} by setting the hash; the router in index.html opens the company layer. It imports
// nothing from ma-entities.js and keeps nothing in the browser between visits (and pushes no history state).
const HS_MIN = 2;            // shorter queries show nothing
const HS_DEBOUNCE_MS = 350;  // typing settles before a request
const HS_MAX = 8;            // at most 8 result rows
const HS_TEXT = {
  loading: 'Searching…',
  empty: 'No companies found. Try the legal name, for example "Apple Inc".',
  error: "Couldn't reach company search. Try again.",
  retry: 'Try again',
};

// Pure: what the result area shows for query q and route answer res
// (undefined = request pending; otherwise data_entitiesGet's { ok, status, data }).
function hsView(q, res) {
  const query = String(q == null ? '' : q).trim();
  if (query.length < HS_MIN) return { state: 'short', rows: [] };
  if (res === undefined || res === null) return { state: 'loading', rows: [] };
  if (!res.ok) return { state: 'error', rows: [] };
  const list = res.data && Array.isArray(res.data.results) ? res.data.results : [];
  const rows = [];
  for (const x of list) {
    const id = Number(x && x.entity_id);
    if (!Number.isInteger(id) || id <= 0) continue;
    rows.push({
      id,
      name: String(x.legal_name || x.name || '#' + id),
      meta: [x.country, x.type].filter(Boolean).map(String).concat('#' + id).join(' · '),
    });
    if (rows.length >= HS_MAX) break;
  }
  return { state: rows.length ? 'results' : 'empty', rows };
}

// Pure: result rows as HTML. Every server string goes through escapeRdHtml (ma-data.js); ids are integers.
function hsRowsHtml(rows) {
  const esc = typeof escapeRdHtml === 'function' ? escapeRdHtml
    : s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return rows.map((r, i) => `<li><a class="hr-res" id="hr-r-${i}" href="#/entity/${Number(r.id)}">`
    + `<span class="hr-res-n">${esc(r.name)}</span><span class="hr-res-m">${esc(r.meta)}</span></a></li>`).join('');
}

function hsInit() {
  const form = document.getElementById('hr-form');
  const input = document.getElementById('hr-q');
  const status = document.getElementById('hr-status');
  const list = document.getElementById('hr-results');
  if (!form || !input || !status || !list || form.dataset.hsReady) return;
  form.dataset.hsReady = '1';
  let timer = null, seq = 0, shownQ = null;

  function paint(v) {
    status.textContent = '';
    if (v.state === 'loading') status.textContent = HS_TEXT.loading;
    else if (v.state === 'empty') status.textContent = HS_TEXT.empty;
    else if (v.state === 'error') {
      const msg = document.createElement('span');
      msg.textContent = HS_TEXT.error;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn'; b.id = 'hr-retry'; b.textContent = HS_TEXT.retry;
      b.addEventListener('click', () => { run(input.value, true); input.focus(); });
      status.append(msg, b);
    }
    list.innerHTML = v.state === 'results' ? hsRowsHtml(v.rows) : '';
    list.hidden = v.state !== 'results';
  }

  // One GET per settled query; an answer to an older query is ignored once a newer one starts.
  async function run(raw, force) {
    clearTimeout(timer);
    const q = String(raw || '').trim();
    if (q.length < HS_MIN) { seq++; shownQ = null; paint(hsView(q)); return; }
    if (!force && q === shownQ) return;
    const my = ++seq;
    shownQ = q;
    paint(hsView(q));
    let res;
    try {
      res = typeof data_entitiesGet === 'function'
        ? await data_entitiesGet(`/api/entities/search?q=${encodeURIComponent(q)}`)
        : { ok: false, status: 0 };
    } catch (e) { res = { ok: false, status: 0 }; }
    if (my !== seq) return;
    if (!res || !res.ok) shownQ = null;   // Search / Enter / Try again ask again after a failure
    paint(hsView(q, res || { ok: false }));
  }

  function clearAll() { clearTimeout(timer); seq++; shownQ = null; input.value = ''; paint(hsView('')); input.focus(); }
  const links = () => Array.from(list.querySelectorAll('a.hr-res'));

  input.addEventListener('input', () => {
    clearTimeout(timer);
    if (input.value.trim().length < HS_MIN) { run(input.value); return; }
    timer = setTimeout(() => run(input.value), HS_DEBOUNCE_MS);
  });
  form.addEventListener('submit', e => { e.preventDefault(); run(input.value); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { const l = links(); if (l.length) { e.preventDefault(); l[0].focus(); } }
    else if (e.key === 'Escape') { e.preventDefault(); clearAll(); }
  });
  // ↑/↓ move between results (↑ from the first returns to the input); Enter opens (native link); Escape clears.
  list.addEventListener('keydown', e => {
    const l = links(), i = l.indexOf(document.activeElement);
    if (i < 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); (l[i + 1] || l[i]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (i === 0 ? input : l[i - 1]).focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); clearAll(); }
  });
}

if (typeof document !== 'undefined' && document.addEventListener) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hsInit);
  else hsInit();
}
window.hsView = hsView;
window.hsRowsHtml = hsRowsHtml;
