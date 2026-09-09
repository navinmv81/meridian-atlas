/* ============================================================
   ma-market.js — Meridian Atlas
   Complete market module: clock, badges, compact/dark mode,
   watchlist, indices, yields, sections, ticker, news, calendar,
   equity sectors, market movers, yield curve, credit snapshot,
   IPO calendar, chart tab, and sym-name map.
   ============================================================ */

// ── CLOCK ─────────────────────────────────────────────────────────────────────
const p2 = n => String(n).padStart(2, '0');
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function tickClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  const n = new Date();
  el.textContent = `${p2(n.getUTCDate())} ${MON[n.getUTCMonth()]} ${n.getUTCFullYear()}  ${p2(n.getUTCHours())}:${p2(n.getUTCMinutes())}:${p2(n.getUTCSeconds())} GMT`;
}
document.addEventListener('DOMContentLoaded', () => {
  setInterval(tickClock, 1000);
  tickClock();
});

// ── MARKET SESSION BADGES ─────────────────────────────────────────────────────
function updateBadges() {
  const n = new Date(), d = n.getUTCDay(), m = n.getUTCHours() * 60 + n.getUTCMinutes();
  const us = () => {
    if (d === 0 || d === 6) return { t: 'Closed', c: 'bCL' };
    if (m >= 780 && m < 870) return { t: 'Pre-Mkt', c: 'bPR' };
    if (m >= 870 && m < 1260) return { t: 'Open', c: 'bOP' };
    if (m >= 1260) return { t: 'After-Hrs', c: 'bAH' };
    return { t: 'Closed', c: 'bCL' };
  };
  const eu = () => {
    if (d === 0 || d === 6) return { t: 'Closed', c: 'bCL' };
    return m >= 480 && m < 960 ? { t: 'Open', c: 'bOP' } : { t: 'Closed', c: 'bCL' };
  };
  [['b-us', us()], ['b-fut', us()], ['b-eu', eu()]].forEach(([id, b]) => {
    const el = document.getElementById(id); if (!el) return;
    el.textContent = b.t; el.className = 'cbadge ' + b.c;
  });
}

// ── COMPACT MODE ──────────────────────────────────────────────────────────────
let isCompact = localStorage.getItem('ma_compact') === '1';
function applyCompact() {
  document.body.classList.toggle('compact', isCompact);
  const b = document.getElementById('cmpbtn');
  if (b) { b.textContent = isCompact ? '⊞ Normal' : '⊟ Compact'; b.className = isCompact ? 'btn on' : 'btn'; }
}
function toggleCompact() {
  isCompact = !isCompact;
  localStorage.setItem('ma_compact', isCompact ? '1' : '0');
  applyCompact();
}
document.addEventListener('DOMContentLoaded', applyCompact);

// ── DARK MODE ─────────────────────────────────────────────────────────────────
let isDark = localStorage.getItem('ma_dark') === '1';
function applyDark() {
  document.body.classList.toggle('dark', isDark);
  const b = document.getElementById('darkbtn');
  if (b) { b.textContent = isDark ? '◑ Light' : '◑ Dark'; b.className = isDark ? 'btn on' : 'btn'; }
}
function toggleDark() {
  isDark = !isDark;
  localStorage.setItem('ma_dark', isDark ? '1' : '0');
  applyDark();
}
document.addEventListener('DOMContentLoaded', applyDark);

// ── STATUS BAR ────────────────────────────────────────────────────────────────
const setS = (m, c = '') => {
  const el = document.getElementById('sbar');
  if (el) { el.textContent = m; el.className = c; }
};

// ── SYM-NAME MAP ──────────────────────────────────────────────────────────────
function buildSymNames() {
  const m = {};
  if (typeof SECTIONS !== 'undefined') SECTIONS.forEach(s => s.syms.forEach(x => { m[x.s] = x.n; }));
  if (typeof IDX_ALL !== 'undefined') IDX_ALL.forEach(x => { m[x.s] = x.n; });
  const extras = {
    'GC=F':'Gold','CL=F':'WTI Oil','BZ=F':'Brent','SI=F':'Silver',
    'LQD':'US IG Corp','HYG':'US HY Corp','SPY':'S&P 500 ETF','QQQ':'Nasdaq ETF',
    'GLD':'Gold ETF','BTC-USD':'Bitcoin','ETH-USD':'Ethereum',
    'XLK':'Technology','XLE':'Energy','XLF':'Financials','IGV':'Software',
    'XLC':'Communication Services','XLI':'Industrials','XLU':'Utilities',
    'XLRE':'Real Estate','XLV':'Healthcare'
  };
  Object.assign(m, extras);
  window._allSymNames = m;
}

// ── WATCHLIST ─────────────────────────────────────────────────────────────────
let wlItems = JSON.parse(localStorage.getItem('ma_wl') || '[]');
function wlSave() { localStorage.setItem('ma_wl', JSON.stringify(wlItems)); }

async function wlAdd(overrideSym, overrideName) {
  const inp = document.getElementById('wl-input');
  const sym = (overrideSym || inp.value).trim().toUpperCase();
  inp.value = '';
  const res = document.getElementById('search-results');
  if (res) res.style.display = 'none';
  if (!sym || wlItems.find(x => x.s === sym)) return;
  wlItems.push({ s: sym, n: (overrideName || sym) });
  wlSave();
  renderWatchlist();
  const d = await fetchSym(sym);
  if (d) { window._mdata = window._mdata || {}; window._mdata[sym] = d; }
  renderWatchlist();
}

function selectForWatchlist(symbol, name) { wlAdd(symbol, name); }

document.addEventListener('DOMContentLoaded', () => {
  const wlInput = document.getElementById('wl-input');
  if (wlInput) wlInput.addEventListener('keydown', e => { if (e.key === 'Enter') wlAdd(); });
});

function wlRemove(sym) { wlItems = wlItems.filter(x => x.s !== sym); wlSave(); renderWatchlist(); }

function renderWatchlist() {
  const list = document.getElementById('wl-list');
  if (!list) return;
  document.getElementById('wl-count').textContent = wlItems.length ? wlItems.length + ' symbols' : '';
  if (!wlItems.length) { list.innerHTML = '<div class="wl-empty">No symbols yet. Type a ticker above and press Enter.</div>'; return; }
  list.innerHTML = wlItems.map(({ s, n }) => {
    const d = window._mdata?.[s];
    const price = d ? fp(d.price, s.includes('=X'), false) : '—';
    const cls = d ? (d.pct >= 0 ? 'up' : 'dn') : 'nc';
    const pct = d ? `${d.pct >= 0 ? '▲' : '▼'}${Math.abs(d.pct).toFixed(2)}%` : '—';
    return `<div class="wli" onclick="openBySymbol('${s}','${n}')">
      <span class="wl-sym">${s}</span><span class="wl-name">${n}</span>
      <span class="wl-price">${price}</span><span class="wl-pct ${cls}">${pct}</span>
      <button class="wl-del" onclick="event.stopPropagation();wlRemove('${s}')" title="Remove">×</button>
    </div>`;
  }).join('');
}

function updateWatchlistData(data) {
  wlItems.forEach(item => { if (data[item.s]) { window._mdata = window._mdata || {}; window._mdata[item.s] = data[item.s]; } });
  const missing = wlItems.map(x => x.s).filter(s => !data[s]);
  if (missing.length) fetchAll(missing).then(extra => { Object.assign(window._mdata, extra); renderWatchlist(); });
}

// ── WORLD INDICES ─────────────────────────────────────────────────────────────
let idxFilter = 'all';
function setIdxFilter(f, btn) {
  idxFilter = f;
  document.querySelectorAll('#idx-seg .seg-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderIndices(window._mdata || {});
}

function renderIndices(data) {
  const tb = document.getElementById('tb-global');
  if (!tb) return;
  const filtered = idxFilter === 'all' ? IDX_ALL : IDX_ALL.filter(x => x.mkt === idxFilter);
  const regions = [...new Set(filtered.map(x => x.region))];
  let html = '';
  regions.forEach(reg => {
    html += `<tr class="region-hdr"><td colspan="6">${reg}</td></tr>`;
    filtered.filter(x => x.region === reg).forEach(({ s, n }) => {
      const d = data[s];
      html += `<tr>
        <td><div class="sn">${n}</div><div class="st">${s}</div></td>
        <td class="sp">${d ? spark(d.closes, d.pct) : '—'}</td>
        <td class="pr">${d ? fp(d.price) : '—'}</td>
        <td class="ch">${d ? fc(d.chg) : '<span class="nc">—</span>'}</td>
        <td class="pc">${d ? fpc(d.pct) : '<span class="nc">—</span>'}</td>
        <td class="hl">${d ? fhl(d.high, d.low) : '—'}</td>
      </tr>`;
    });
  });
  tb.innerHTML = html || '<tr class="lrow"><td colspan="6">No data</td></tr>';
}

// ── SOVEREIGN YIELDS ─────────────────────────────────────────────────────────
function renderYields(data) {
  const set = (id, sym, yld = true) => {
    const el = document.getElementById(id); if (!el) return;
    const d = data[sym];
    el.textContent = d ? fp(d.price, false, yld) : '—';
    if (d) el.className = d.pct >= 0 ? 'up' : 'dn';
  };
  set('y-us2', '^IRX'); set('y-us5', '^FVX'); set('y-us10', '^TNX'); set('y-us30', '^TYX');
  set('y-uk10', 'GB10YT=RR'); set('y-de10', 'GB10YT=RR'); set('y-jp10', 'JP10YT=RR');
  const corpBondMap = [
    { sym: 'LQD', priceId: 'y-lqd-price', chgId: 'y-lqd-chg' },
    { sym: 'HYG', priceId: 'y-hyg-price', chgId: 'y-hyg-chg' },
    { sym: 'IEAC.L', priceId: 'y-ieac-price', chgId: 'y-ieac-chg' },
  ];
  corpBondMap.forEach(({ sym, priceId, chgId }) => {
    const d = data[sym];
    const pel = document.getElementById(priceId), cel = document.getElementById(chgId);
    if (pel && d) pel.textContent = fp(d.price);
    if (cel && d) cel.innerHTML = fpc(d.pct);
  });
  const us2 = data['^IRX']?.price, us10 = data['^TNX']?.price;
  const lbl = document.getElementById('curve-lbl');
  if (us2 != null && us10 != null && lbl) {
    const spread = us10 - us2;
    let label, cls;
    if (spread > 0.5) { label = 'STEEP'; cls = 'curve-STEEP'; }
    else if (spread > -0.1) { label = 'FLAT'; cls = 'curve-FLAT'; }
    else { label = 'INVERTED'; cls = 'curve-INVERTED'; }
    lbl.textContent = label; lbl.className = 'curve-lbl ' + cls;
  }
}

// ── SECTIONS ─────────────────────────────────────────────────────────────────
function renderSection(sec, data) {
  const tb = document.getElementById('tb-' + sec.id); if (!tb) return;
  tb.innerHTML = sec.syms.map(({ s, n }) => {
    const d = data[s];
    let r = `<td><div class="sn">${n}</div><div class="st">${s}</div></td>`;
    r += `<td class="sp">${d ? spark(d.closes, d.pct) : '<span class="nc">—</span>'}</td>`;
    r += `<td class="pr">${d ? fp(d.price, sec.fx, sec.yld) : '—'}</td>`;
    r += `<td class="ch">${d ? fc(d.chg, sec.fx) : '<span class="nc">—</span>'}</td>`;
    r += `<td class="pc">${d ? fpc(d.pct) : '<span class="nc">—</span>'}</td>`;
    if (sec.vol) {
      const emph = sec.id === 'us' || sec.id === 'eu';
      r += `<td class="vo">${d ? fv(d.vol, emph) : '—'}</td>`;
    } else {
      r += `<td class="hl">${d ? fhl(d.high, d.low, sec.fx) : '—'}</td>`;
    }
    if (sec.expand) {
      return `<tr class="xp" data-sym="${s}" data-name="${n.replace(/"/g, '&quot;')}" onclick="openModal(this)">${r}</tr>`;
    }
    return `<tr>${r}</tr>`;
  }).join('');
}

// ── INTELLIGENCE BANNER ───────────────────────────────────────────────────────
const INTEL_MAP = [
  { id: 'ms-spx',  s: '^GSPC',     fx: false },
  { id: 'ms-ndx',  s: '^IXIC',     fx: false },
  { id: 'ms-stx',  s: '^STOXX50E', fx: false },
  { id: 'ms-n225', s: '^N225',      fx: false },
  { id: 'ms-hsi',  s: '^HSI',       fx: false },
  { id: 'ms-us2y', s: '^IRX',       fx: false, yld: true },
  { id: 'ms-us10', s: '^TNX',       fx: false, yld: true },
  { id: 'ms-de10', s: '^TNX',       fx: false, yld: true },
  { id: 'ms-vix',  s: '^VIX',       fx: false },
  { id: 'ms-gold', s: 'GC=F',       fx: false },
  { id: 'ms-oil',  s: 'CL=F',       fx: false },
  { id: 'ms-eur',  s: 'EURUSD=X',   fx: true },
  { id: 'ms-jpy',  s: 'USDJPY=X',   fx: true },
];

function updateIntelBanner(data) {
  INTEL_MAP.forEach(({ id, s, fx, yld }) => {
    const el = document.getElementById(id); if (!el) return;
    const d = data[s]; if (!d) return;
    el.children[1].textContent = fp(d.price, fx, yld);
    const c = d.pct >= 0 ? 'up' : 'dn', a = d.pct >= 0 ? '▲' : '▼';
    el.children[2].className = 'ms-c ' + c;
    el.children[2].textContent = `${a} ${Math.abs(d.pct).toFixed(2)}%`;
  });
  const spx = data['^GSPC'], vix = data['^VIX'], tnx = data['^TNX'];
  const ftse = data['^FTSE'], nky = data['^N225'], stoxx = data['^STOXX50E'];
  const eurusd = data['EURUSD=X'], usdjpy = data['USDJPY=X'];
  const gold = data['GC=F'], oil = data['CL=F'];
  const lbl = document.getElementById('risk-label');
  const narr = document.getElementById('market-narrative');
  const drivers = document.getElementById('regime-drivers');
  if (!spx || !vix) { if (narr) narr.textContent = 'Market data loading…'; return; }
  const eqSignals = [spx.pct, ftse?.pct ?? 0, nky?.pct ?? 0, stoxx?.pct ?? 0];
  const eqUpCount = eqSignals.filter(p => p > 0.2).length;
  const eqDnCount = eqSignals.filter(p => p < -0.2).length;
  const eqDir = eqUpCount >= 3 ? 'up' : eqDnCount >= 3 ? 'dn' : 'flat';
  const vixHigh = vix.price > 22, vixLow = vix.price < 15, vixRising = vix.pct > 5, vixFalling = vix.pct < -5;
  const yieldsRising = tnx ? (tnx.pct > 1) : false;
  const yieldsFalling = tnx ? (tnx.pct < -1) : false;
  const usdStrong = eurusd ? (eurusd.pct < -0.3 && (usdjpy?.pct ?? 0) > 0.2) : false;
  const usdWeak = eurusd ? (eurusd.pct > 0.3) : false;
  let score = 0;
  if (eqDir === 'up') score += 2; else if (eqDir === 'dn') score -= 2;
  if (vixLow || vixFalling) score += 1; else if (vixHigh || vixRising) score -= 2;
  if (usdWeak) score += 1; else if (usdStrong) score -= 1;
  if (yieldsFalling && eqDir === 'up') score += 1;
  if (yieldsRising && eqDir === 'dn') score -= 1;
  let regime, regimeCls, regimeIcon;
  if (score >= 2) { regime = 'RISK ON'; regimeCls = 'risk-on'; regimeIcon = '▲'; }
  else if (score <= -2) { regime = 'RISK OFF'; regimeCls = 'risk-off'; regimeIcon = '▼'; }
  else { regime = 'NEUTRAL'; regimeCls = 'risk-neu'; regimeIcon = '◆'; }
  if (lbl) { lbl.className = 'risk-label ' + regimeCls; lbl.textContent = regimeIcon + ' ' + regime; }
  if (drivers) {
    const driverArr = (v, label, inv) => {
      if (v == null) return `<span class="driver-item"><span class="driver-label">${label}</span><span class="driver-arrow nc">—</span></span>`;
      const dir = inv ? (v.pct < -0.15 ? '▲' : v.pct > 0.15 ? '▼' : '—') : (v.pct > 0.15 ? '▲' : v.pct < -0.15 ? '▼' : '—');
      const cls = dir === '▲' ? 'up' : dir === '▼' ? 'dn' : 'nc';
      return `<span class="driver-item"><span class="driver-label">${label}</span><span class="driver-arrow ${cls}">${dir}</span></span>`;
    };
    const usdProxy = eurusd ? { pct: -eurusd.pct } : null;
    drivers.innerHTML = driverArr(spx, 'EQUITIES', false) + driverArr(tnx, 'YIELDS', false) + driverArr(usdProxy, 'USD', false) + driverArr(vix, 'VOL', false) + driverArr(gold, 'GOLD', false) + driverArr(oil, 'OIL', false);
  }
  if (narr) {
    const eqTxt = eqDir === 'up' ? 'advancing' : eqDir === 'dn' ? 'under pressure' : 'mixed';
    const spxTxt = spx ? ` (S&P ${spx.pct >= 0 ? '+' : ''}${spx.pct.toFixed(1)}%)` : '';
    const yldTxt = tnx ? (yieldsRising ? 'rising yields' : yieldsFalling ? 'softer yields' : 'stable yields') : '';
    const usdTxt = usdStrong ? 'a stronger dollar' : usdWeak ? 'a weaker dollar' : 'a steady dollar';
    const volTxt = vixHigh ? `elevated volatility (VIX ${vix.price.toFixed(0)})` : vixLow ? `subdued volatility (VIX ${vix.price.toFixed(0)})` : `moderate volatility (VIX ${vix.price.toFixed(0)})`;
    const goldTxt = gold ? (gold.pct > 0.3 ? 'gold bid' : 'gold offered') : '';
    let s1 = '';
    if (eqDir === 'up' && (yieldsFalling || usdWeak)) s1 = `Equities are ${eqTxt}${spxTxt} alongside ${[yldTxt, usdTxt].filter(Boolean).join(' and ')}, pointing to improving risk appetite.`;
    else if (eqDir === 'dn' && (yieldsRising || usdStrong)) s1 = `Markets are ${eqTxt}${spxTxt} as ${[yldTxt, usdTxt].filter(Boolean).join(' and ')} apply pressure, signalling a risk-off tone.`;
    else if (eqDir === 'up') s1 = `Equities are ${eqTxt}${spxTxt} with ${yldTxt || 'yields steady'} and ${usdTxt}.`;
    else if (eqDir === 'dn') s1 = `Equities are ${eqTxt}${spxTxt} with ${yldTxt || 'yields steady'} and ${usdTxt}.`;
    else s1 = `Markets are mixed${spxTxt} with ${yldTxt || 'yields steady'}, ${usdTxt}, and ${volTxt}.`;
    let s2 = '';
    if (vixHigh && eqDir === 'dn') s2 = `${volTxt.charAt(0).toUpperCase() + volTxt.slice(1)} is amplifying the defensive tone${goldTxt ? '; ' + goldTxt + ' as a safe-haven' : '.'}.`;
    else if (vixLow && eqDir === 'up') s2 = `${volTxt.charAt(0).toUpperCase() + volTxt.slice(1)} supports the constructive backdrop${goldTxt ? '; ' + goldTxt + '.' : '.'}`;
    else s2 = `Cross-asset signals show ${volTxt}${goldTxt ? ', with ' + goldTxt : ''}.`;
    narr.textContent = s1 + ' ' + s2;
  }
}

// ── TICKER TAPE ───────────────────────────────────────────────────────────────
function renderTicker(data) {
  let h = TICK_SYMS.map(({ s, n, fx }) => {
    const d = data[s], price = d ? fp(d.price, fx) : '—', cls = d ? (d.pct >= 0 ? 'up' : 'dn') : 'nc';
    const pct = d ? `${d.pct >= 0 ? '▲' : '▼'}${Math.abs(d.pct).toFixed(2)}%` : '';
    return `<div class="ti"><span class="tn">${n}</span><span class="tp">${price}</span><span class="tc ${cls}">${pct}</span></div>`;
  }).join('');
  const el = document.getElementById('tkinner');
  if (el) el.innerHTML = h + h;
}

// ── NEWS ─────────────────────────────────────────────────────────────────────
const RSS = [
  'https://feeds.finance.yahoo.com/rss/2.0/headline?s=%5EGSPC,%5EFTSE,AAPL,MSFT,NVDA,AMZN,GOOGL&region=US&lang=en-US',
  'https://feeds.finance.yahoo.com/rss/2.0/headline?s=BTC-USD,GC=F,CL=F,EURUSD=X,GBPUSD=X&region=US&lang=en-US',
];
const NKW = {
  CRYPTO: ['bitcoin','btc','ethereum','eth','crypto','blockchain','solana'],
  EARNINGS: ['earnings','revenue','profit','eps','quarterly','results','beat','miss'],
  FX: ['dollar','euro','yen','sterling','forex','currency','fomc','ecb','boe','fed rate'],
  COMMODITIES: ['oil','gold','silver','copper','gas','wheat','corn','opec'],
  MACRO: ['gdp','inflation','cpi','ppi','unemployment','jobs','recession','rate cut','rate hike'],
  GEOPOLITICS: ['war','conflict','sanctions','tariff','trade war','nato','ukraine','russia','china','middle east','iran','israel','taiwan','north korea','missile','troops','military'],
  TECH: ['artificial intelligence',' ai ','chip','semiconductor','nvidia','apple','microsoft','google'],
};
const CCLS = { CRYPTO:'cCR', EARNINGS:'cER', FX:'cFX', COMMODITIES:'cCO', MACRO:'cMA', GEOPOLITICS:'cGE', TECH:'cTE', EQUITIES:'cEQ', MARKETS:'cMK' };
function catN(t) { const s = t.toLowerCase(); for (const [c, ws] of Object.entries(NKW)) if (ws.some(w => s.includes(w))) return c; return 'MARKETS'; }
function ago(d) { const s = (Date.now() - new Date(d)) / 1000; if (s < 60) return Math.round(s) + 's ago'; if (s < 3600) return Math.round(s / 60) + 'm ago'; if (s < 86400) return Math.round(s / 3600) + 'h ago'; return Math.round(s / 86400) + 'd ago'; }
function dh(s) { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; }

function makeNewsHTML(items) {
  return items.map(a => {
    const cat = catN(a.title), cls = CCLS[cat] || 'cMK', t = a.pub ? ago(a.pub) : '';
    return `<div class="ni" onclick="window.open('${a.link}','_blank')">
      <div class="nm"><span class="ncat ${cls}">${cat}</span><span class="ntime">${t}</span></div>
      <div class="ntitle">${a.title}</div>
      ${a.desc ? `<div class="nsum">${a.desc.slice(0, 120)}</div>` : ''}
    </div>`;
  }).join('');
}

async function loadNews() {
  const items = [], seen = new Set();
  for (const feed of RSS) {
    try {
      const r = await pfetch(feed), txt = await r.text();
      const xml = new DOMParser().parseFromString(txt, 'text/xml');
      xml.querySelectorAll('item').forEach(el => {
        const title = dh(el.querySelector('title')?.textContent || '').trim();
        const desc = dh(el.querySelector('description')?.textContent || '').replace(/<[^>]*>/g, '').trim();
        const link = el.querySelector('link')?.textContent || '#';
        const pub = el.querySelector('pubDate')?.textContent || '';
        if (title && !seen.has(title)) { seen.add(title); items.push({ title, desc, link, pub }); }
      });
    } catch (e) { console.warn('RSS', e); }
  }
  items.sort((a, b) => new Date(b.pub) - new Date(a.pub));
  const geo = items.filter(a => catN(a.title) === 'GEOPOLITICS');
  const mkt = items.filter(a => catN(a.title) !== 'GEOPOLITICS').slice(0, 30);
  const nc = document.getElementById('nc'); if (nc) nc.textContent = mkt.length + ' articles';
  const nlist = document.getElementById('nlist'); if (nlist) nlist.innerHTML = mkt.length ? makeNewsHTML(mkt) : '<div class="lrow" style="padding:16px;text-align:center">No market news loaded</div>';
  const ncg = document.getElementById('nc-geo'); if (ncg) ncg.textContent = geo.length + ' articles';
  const glist = document.getElementById('glist'); if (glist) glist.innerHTML = geo.length ? makeNewsHTML(geo) : '<div class="lrow" style="padding:16px;text-align:center;color:var(--muted)">No geopolitics stories</div>';
}

async function doNews() { try { await loadNews(); } catch (e) { console.warn(e); } }

// ── CALENDAR ─────────────────────────────────────────────────────────────────
let calFilter = 'week';
function setCalFilter(f, btn) {
  calFilter = f;
  document.querySelectorAll('#cal-seg .seg-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderCalendar();
}

function renderCalendar() {
  const events = [
    { day:1, time:'13:30', event:'US CPI (Consumer Price Index)', country:'🇺🇸 United States', impact:'high' },
    { day:1, time:'09:00', event:'EU PMI Composite Flash', country:'🇪🇺 Eurozone', impact:'med' },
    { day:2, time:'09:30', event:'UK CPI Inflation', country:'🇬🇧 United Kingdom', impact:'high' },
    { day:2, time:'13:30', event:'US PPI (Producer Price Index)', country:'🇺🇸 United States', impact:'high' },
    { day:3, time:'12:00', event:'US MBA Mortgage Applications', country:'🇺🇸 United States', impact:'low' },
    { day:3, time:'14:00', event:'FOMC Meeting Minutes', country:'🇺🇸 United States', impact:'high' },
    { day:3, time:'09:30', event:'UK GDP Monthly Estimate', country:'🇬🇧 United Kingdom', impact:'high' },
    { day:4, time:'13:30', event:'US Initial Jobless Claims', country:'🇺🇸 United States', impact:'med' },
    { day:4, time:'13:30', event:'US Retail Sales (MoM)', country:'🇺🇸 United States', impact:'high' },
    { day:4, time:'08:00', event:'ECB Meeting Accounts', country:'🇪🇺 Eurozone', impact:'med' },
    { day:5, time:'13:30', event:'US Non-Farm Payrolls', country:'🇺🇸 United States', impact:'high' },
    { day:5, time:'13:30', event:'US Unemployment Rate', country:'🇺🇸 United States', impact:'high' },
    { day:5, time:'15:00', event:'UMich Consumer Sentiment', country:'🇺🇸 United States', impact:'med' },
    { day:1, time:'23:50', event:'Japan Trade Balance', country:'🇯🇵 Japan', impact:'low' },
    { day:2, time:'02:00', event:'China Industrial Output YoY', country:'🇨🇳 China', impact:'med' },
  ];
  const now = new Date(), curDay = now.getUTCDay();
  const mon = new Date(now); mon.setUTCDate(now.getUTCDate() - ((now.getUTCDay() || 7) - 1));
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let filtered = [...events].sort((a, b) => a.day - b.day || (a.time > b.time ? 1 : -1));
  if (calFilter === 'today') filtered = filtered.filter(e => e.day === curDay);
  else if (calFilter === 'next') filtered = filtered.filter(e => e.day > 5 || e.day === 0);
  filtered = filtered.sort((a, b) => { const o = { high:0, med:1, low:2 }; return (o[a.impact] ?? 1) - (o[b.impact] ?? 1) || a.day - b.day; }).slice(0, 10);
  function calCountdown(evDate, timeStr) {
    const now = new Date();
    const [hh, mm] = timeStr.split(':').map(Number);
    const evFull = new Date(Date.UTC(evDate.getUTCFullYear(), evDate.getUTCMonth(), evDate.getUTCDate(), hh, mm));
    const diffMs = evFull - now;
    if (diffMs < 0) return 'completed';
    const diffH = Math.floor(diffMs / 3600000), diffM = Math.floor((diffMs % 3600000) / 60000);
    if (diffH < 1) return `in ${diffM}m`;
    if (diffH < 24) return `in ${diffH}h ${diffM}m`;
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1) return 'tomorrow';
    if (diffD <= 7) return `in ${diffD} days`;
    return `${p2(evDate.getUTCDate())}/${p2(evDate.getUTCMonth() + 1)}`;
  }
  const cls = { high:'ih', med:'im', low:'il' };
  const calList = document.getElementById('cal-list');
  if (!calList) return;
  calList.innerHTML = filtered.length ? filtered.map(e => {
    const evD = new Date(mon); evD.setUTCDate(mon.getUTCDate() + e.day - 1);
    const past = e.day < curDay;
    const countdown = calCountdown(evD, e.time);
    const isNow = countdown === 'completed';
    return `<div class="ci" style="${past && isNow ? 'opacity:.35' : ''}">
      <div class="ct">${days[e.day]}<br>${p2(evD.getUTCDate())}/${p2(evD.getUTCMonth() + 1)}<br>${e.time} GMT
        <div class="cal-countdown">${isNow ? '<span style="color:var(--dim)">done</span>' : countdown}</div>
      </div>
      <div class="cb"><div class="ce">${e.event}</div><div class="cc">${e.country}</div></div>
      <span class="cimp ${cls[e.impact]}">${e.impact.toUpperCase()}</span>
    </div>`;
  }).join('') : '<div class="lrow" style="padding:14px;text-align:center">No events for this period</div>';
}

// ── EQUITY SECTORS ────────────────────────────────────────────────────────────
function renderEquitySectors(data = window._mdata || {}) {
  const box = document.getElementById('sector-list');
  if (!box) return;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  box.innerHTML = SECTOR_ETFS.map(({ name, s }) => {
    const d = data?.[s], pct = d?.pct;
    const cls = pct == null ? 'nc' : pct >= 0 ? 'up' : 'dn';
    const arr = pct == null ? '•' : pct >= 0 ? '▲' : '▼';
    const pctTxt = pct == null ? 'Live…' : `${arr} ${Math.abs(pct).toFixed(2)}%`;
    const barW = pct == null ? 16 : clamp(Math.abs(pct) * 12, 6, 100);
    const barCol = pct == null ? 'var(--dim)' : pct >= 0 ? 'var(--green)' : 'var(--red)';
    return `<div class="sec-row" onclick="openBySymbol('${s}','${name}')">
      <span class="sec-name">${name}</span>
      <span class="sec-sym">${s}</span>
      <span class="sec-bar-wrap"><span class="sec-bar" style="width:${barW.toFixed(1)}%;background:${barCol}"></span></span>
      <span class="sec-pct ${cls}">${pctTxt}</span>
    </div>`;
  }).join('');
}

// ── MARKET MOVERS ─────────────────────────────────────────────────────────────
const MV_UNIVERSE = [
  'AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','JPM','V','UNH',
  'ASML','MC.PA','SAP','TTE.PA','SIE.DE','SU.PA','AIR.PA','SAN.PA','ALV.DE','BNP.PA',
  'GC=F','CL=F','BZ=F','SI=F','LQD','HYG','SPY','QQQ','GLD',
  '^GSPC','^IXIC','^FTSE','^N225','^HSI','000300.SS','^BSESN',
  'EURUSD=X','GBPUSD=X','USDJPY=X','BTC-USD','ETH-USD',
];

let mvFilter = 'gainers';
function setMvTab(tab, btn) {
  mvFilter = tab;
  document.querySelectorAll('.mv-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderMovers();
}

function renderMovers() {
  const data = window._mdata || {};
  const grid = document.getElementById('mv-grid');
  if (!grid) return;
  let items = MV_UNIVERSE
    .filter(s => data[s] && data[s].price != null)
    .map(s => {
      const d = data[s];
      const allSecs = window._allSymNames || {};
      const name = allSecs[s] || s;
      return { s, name, price: d.price, pct: d.pct, vol: d.vol || 0, chg: d.chg };
    });
  if (!items.length) { grid.innerHTML = '<div class="mv-none" style="padding:20px 0">Data unavailable — refresh to load</div>'; return; }
  const gainers = items.filter(x => x.pct > 0).sort((a, b) => b.pct - a.pct).slice(0, 10);
  const losers  = items.filter(x => x.pct < 0).sort((a, b) => a.pct - b.pct).slice(0, 10);
  const active  = items.slice().sort((a, b) => b.vol - a.vol).slice(0, 10);
  const isFX = s => s.includes('=X');
  function rowHtml(arr) {
    if (!arr.length) return `<tr><td colspan="4" class="mv-none">No data</td></tr>`;
    return arr.map(({ s, name, price, pct, vol }) => {
      const pCls = pct >= 0 ? 'up' : 'dn', pArr = pct >= 0 ? '▲' : '▼';
      const priceStr = isFX(s) ? price.toFixed(4) : price >= 1000 ? price.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 }) : price.toFixed(2);
      const volStr = vol >= 1e9 ? (vol/1e9).toFixed(1)+'B' : vol >= 1e6 ? (vol/1e6).toFixed(1)+'M' : vol >= 1e3 ? (vol/1e3).toFixed(0)+'K' : vol ? String(vol) : '—';
      const safeN = name.replace(/'/g, '');
      return `<tr onclick="openBySymbol('${s}','${safeN}')">
        <td><span class="mv-sym">${s}</span><span class="mv-name">${name !== s ? name : ''}</span></td>
        <td class="mv-price">${priceStr}</td>
        <td class="mv-pct ${pCls}">${pArr} ${Math.abs(pct).toFixed(2)}%</td>
        <td class="mv-vol">${volStr}</td>
      </tr>`;
    }).join('');
  }
  grid.innerHTML = `
    <div><div class="mv-group-title">▲ Gainers</div>
      <table class="mv-table mv-subtable"><thead><tr><th>Ticker</th><th>Price</th><th>% Chg</th><th>Volume</th></tr></thead><tbody>${rowHtml(gainers)}</tbody></table>
    </div>
    <div><div class="mv-group-title">▼ Losers</div>
      <table class="mv-table mv-subtable"><thead><tr><th>Ticker</th><th>Price</th><th>% Chg</th><th>Volume</th></tr></thead><tbody>${rowHtml(losers)}</tbody></table>
    </div>
    <div><div class="mv-group-title">⚡ Most Active</div>
      <table class="mv-table mv-subtable"><thead><tr><th>Ticker</th><th>Price</th><th>% Chg</th><th>Volume</th></tr></thead><tbody>${rowHtml(active)}</tbody></table>
    </div>`;
  const upd = document.getElementById('mv-updated');
  if (upd) { const n = new Date(); upd.textContent = `${String(n.getUTCHours()).padStart(2,'0')}:${String(n.getUTCMinutes()).padStart(2,'0')} GMT`; }
}

// ── MAIN REFRESH ──────────────────────────────────────────────────────────────
let autoOn = true, qT = null, nT = null;

async function doRefresh() {
  const ic = document.getElementById('ricon'); if (ic) ic.className = 'spin';
  setS('Fetching market data…', 'info');
  const allS = [...new Set([
    ...IDX_ALL.map(x => x.s),
    ...Object.values(YIELD_SYMS),
    ...SECTIONS.flatMap(s => s.syms.map(x => x.s)),
    ...SECTOR_ETFS.map(x => x.s),
    ...TICK_SYMS.map(x => x.s),
    '^GSPC','^IXIC','^STOXX50E','^HSI','^N225','^VIX','GC=F','CL=F','EURUSD=X','USDJPY=X',
    'BTC-USD','ETH-USD','^IRX','^FVX','^TNX','^TYX','LQD','HYG','IEAC.L',
  ])];
  try {
    const data = await fetchAll(allS);
    window._mdata = data;
    const n = Object.keys(data).length;
    renderIndices(data);
    renderYields(data);
    SECTIONS.forEach(s => renderSection(s, data));
    updateIntelBanner(data);
    renderTicker(data);
    updateBadges();
    updateWatchlistData(data);
    renderWatchlist();
    buildSymNames();
    renderMovers();
    renderYieldCurve(data);
    renderCreditSnapshot(data);
    renderEquitySectors(data);
    const now = new Date();
    setS(`Meridian Atlas — ${n}/${allS.length} symbols loaded — ${p2(now.getUTCHours())}:${p2(now.getUTCMinutes())} GMT — next refresh in 60s`, 'ok');
  } catch (e) {
    setS('Error fetching data — check connection', 'err');
    console.error(e);
  }
  if (ic) ic.className = '';
}

function toggleAuto() {
  autoOn = !autoOn;
  const b = document.getElementById('abtn');
  if (b) { b.textContent = autoOn ? 'Auto' : 'Manual'; b.className = autoOn ? 'btn on' : 'btn'; }
  clearInterval(qT); clearInterval(nT);
  if (autoOn) { qT = setInterval(doRefresh, 60000); nT = setInterval(doNews, 120000); }
}

// ── YIELD CURVE SVG ───────────────────────────────────────────────────────────
function renderYieldCurve(data) {
  const svgEl = document.getElementById('yc-svg');
  const shapeLbl = document.getElementById('yc-shape-lbl');
  if (!svgEl) return;
  const tenors = [{ sym:'^IRX', label:'2Y' }, { sym:'^FVX', label:'5Y' }, { sym:'^TNX', label:'10Y' }, { sym:'^TYX', label:'30Y' }];
  const vals = tenors.map(t => data[t.sym]?.price ?? null);
  const valid = vals.filter(v => v != null);
  if (valid.length < 2) { svgEl.innerHTML = '<text x="140" y="28" text-anchor="middle" fill="var(--dim)" font-size="10" font-family="var(--sans)">Yield data loading…</text>'; return; }
  const us2 = data['^IRX']?.price, us10 = data['^TNX']?.price;
  let shape = '—', shapeColor = 'var(--dim)';
  if (us2 != null && us10 != null) {
    const spread = us10 - us2;
    if (spread > 0.5) { shape = 'STEEP'; shapeColor = 'var(--green)'; }
    else if (spread > -0.1) { shape = 'FLAT'; shapeColor = 'var(--amber)'; }
    else { shape = 'INVERTED'; shapeColor = 'var(--red)'; }
  }
  if (shapeLbl) { shapeLbl.textContent = shape; shapeLbl.style.color = shapeColor; }
  const W = 280, H = 44;
  const filledVals = vals.map((v, i) => {
    if (v != null) return v;
    const prev = vals.slice(0, i).filter(x => x != null).pop();
    const next = vals.slice(i + 1).find(x => x != null);
    return prev != null && next != null ? (prev + next) / 2 : prev ?? next ?? 0;
  });
  const mn = Math.min(...filledVals) * 0.98, mx = Math.max(...filledVals) * 1.02, rng = mx - mn || 0.1;
  const col = shape === 'INVERTED' ? 'var(--red)' : (shape === 'STEEP' ? 'var(--green)' : 'var(--amber)');
  const gid = 'ycg' + Math.random().toString(36).slice(2, 7);
  const pts = filledVals.map((v, i) => { const x = (i / (filledVals.length - 1)) * W; const y = H - ((v - mn) / rng) * (H - 6) - 3; return [x.toFixed(1), y.toFixed(1)]; });
  const ptsStr = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const dots = pts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="3" fill="${col}"/><text x="${x}" y="${parseFloat(y) - 6}" text-anchor="middle" fill="var(--text2)" font-size="8" font-family="var(--mono)" font-weight="600">${filledVals[i].toFixed(2)}%</text>`).join('');
  svgEl.innerHTML = `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${col}" stop-opacity=".15"/><stop offset="100%" stop-color="${col}" stop-opacity=".01"/></linearGradient></defs>
    <polygon points="0,${pts[0][1]} ${ptsStr} ${pts[pts.length-1][0]},${pts[pts.length-1][1]} ${W},${H} 0,${H}" fill="url(#${gid})"/>
    <polyline points="${ptsStr}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}`;
}

// ── CREDIT SNAPSHOT ───────────────────────────────────────────────────────────
function renderCreditSnapshot(data) {
  const lqd = data['LQD'], hyg = data['HYG'];
  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };
  if (lqd) { setEl('cr-lqd-price', lqd.price.toFixed(2)); setEl('cr-lqd-chg', `<span class="${lqd.pct >= 0 ? 'up' : 'dn'}">${lqd.pct >= 0 ? '▲' : '▼'} ${Math.abs(lqd.pct).toFixed(2)}%</span>`); }
  if (hyg) { setEl('cr-hyg-price', hyg.price.toFixed(2)); setEl('cr-hyg-chg', `<span class="${hyg.pct >= 0 ? 'up' : 'dn'}">${hyg.pct >= 0 ? '▲' : '▼'} ${Math.abs(hyg.pct).toFixed(2)}%</span>`); }
  if (lqd && hyg) { setEl('cr-spread', '$' + (lqd.price - hyg.price).toFixed(2)); setEl('cr-spread-lbl', 'LQD−HYG proxy'); }
}

// ── IPO CALENDAR ──────────────────────────────────────────────────────────────
function renderIPOCalendar(data) {
  const el = document.getElementById('ipo-list'); if (!el) return;
  if (!data || !Array.isArray(data) || !data.length) { el.innerHTML = '<div style="padding:14px 12px;text-align:center;font-size:11px;color:var(--dim)">No upcoming IPOs found.</div>'; return; }
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  el.innerHTML = data.slice(0, 12).map(d => {
    const dt = new Date(d.date || '');
    const dayStr = !isNaN(dt) ? days[dt.getUTCDay()] + ' ' + String(dt.getUTCDate()).padStart(2,'0') + '/' + String(dt.getUTCMonth()+1).padStart(2,'0') : 'TBD';
    const sym = (d.symbol || '').toUpperCase(), name = d.company || sym;
    return `<div class="earn-item" onclick="openBySymbol('${sym}','${name.replace(/'/g,'')}')">
      <span class="earn-date">${dayStr}</span><span class="earn-ticker">${sym||'IPO'}</span>
      <span class="earn-co" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</span>
      <span class="earn-time earn-unk" style="font-size:10px;color:var(--dim)">${d.priceRange||'—'}</span>
    </div>`;
  }).join('');
}

async function fetchIPOCalendar() {
  const el = document.getElementById('ipo-list');
  try {
    const url = `${MY_WORKER_URL}/?ipos=1`;
    const res = await fetchWithTimeout(url, 8000);
    if (res.ok && Array.isArray(res.data)) { renderIPOCalendar(res.data); }
    else { if (el) el.innerHTML = '<div style="padding:14px 12px;text-align:center;font-size:11px;color:var(--dim)">IPO data unavailable.</div>'; }
  } catch (e) {
    console.warn('IPO calendar fetch failed:', e.message);
    if (el) el.innerHTML = '<div style="padding:14px 12px;text-align:center;font-size:11px;color:var(--dim)">IPO data unavailable.</div>';
  }
}

// ── CHART TAB ─────────────────────────────────────────────────────────────────
const chartCache = {};
const CHART_INTERVALS = { '1d':'5m', '5d':'15m', '1mo':'1d', '6mo':'1wk', '1y':'1wk' };

async function loadChartTab(sym, range, btnEl) {
  if (typeof DEAD_SYMS !== 'undefined' && DEAD_SYMS.has(sym)) {
    const wrap = document.getElementById('chart-tab-svg-wrap');
    if (wrap) wrap.innerHTML = '<div style="padding:24px;text-align:center;color:var(--dim);font-size:11px">Market data for this instrument is currently unavailable from Yahoo.</div>';
    return;
  }
  if (btnEl) { document.querySelectorAll('.chart-range-btn').forEach(b => b.classList.remove('active')); btnEl.classList.add('active'); }
  else { setTimeout(() => { const btns = document.querySelectorAll('.chart-range-btn'); btns.forEach(b => b.classList.remove('active')); const mo = [...btns].find(b => b.dataset.range === range); if (mo) mo.classList.add('active'); }, 50); }
  const wrap = document.getElementById('chart-tab-svg-wrap');
  const statsRow = document.getElementById('chart-stats-row');
  if (!wrap) return;
  const cKey = sym + '_' + range;
  if (chartCache[cKey]) { drawChartSVG(wrap, statsRow, chartCache[cKey]); return; }
  wrap.innerHTML = '<div class="chart-tab-loading"><span class="chart-tab-spinner"></span>Loading…</div>';
  const interval = CHART_INTERVALS[range] || '1d';
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(decodeURIComponent(sym))}?interval=${interval}&range=${range}`;
  try {
    const r = await pfetch(url), j = await r.json();
    const res = j?.chart?.result?.[0];
    if (!res || !res.indicators?.quote?.[0]?.close) { wrap.innerHTML = '<div style="padding:24px;text-align:center;color:var(--dim);font-size:11px">No chart data available for this range</div>'; return; }
    const timestamps = res.timestamp || [], quotes = res.indicators.quote[0];
    const pts = timestamps.map((t, i) => ({ t, c: quotes.close[i], h: quotes.high[i], l: quotes.low[i], v: quotes.volume[i] })).filter(p => p.c != null);
    if (pts.length < 2) { wrap.innerHTML = '<div style="padding:24px;text-align:center;color:var(--dim);font-size:11px">Insufficient data for this range</div>'; return; }
    const chartData = { pts, range, sym };
    chartCache[cKey] = chartData;
    drawChartSVG(wrap, statsRow, chartData);
  } catch (e) {
    wrap.innerHTML = '<div style="padding:24px;text-align:center;color:var(--dim);font-size:11px">Failed to load chart — check connection</div>';
    console.warn('Chart error', sym, range, e);
  }
}

function drawChartSVG(wrap, statsRow, { pts, range }) {
  const W = 600, H = 100;
  const closes = pts.map(p => p.c);
  const mn = Math.min(...closes), mx = Math.max(...closes), rng = mx - mn || 1;
  const isUp = closes[closes.length - 1] >= closes[0];
  const col = isUp ? (document.body.classList.contains('dark') ? '#38A17B' : '#2D9C75') : (document.body.classList.contains('dark') ? '#DF5E5A' : '#D9534F');
  const gid = 'cg' + Math.random().toString(36).slice(2, 7);
  const xy = closes.map((v, i) => [(i / (closes.length - 1)) * W, H - ((v - mn) / rng) * (H - 8) - 4]);
  const ptsStr = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const labelCount = Math.min(6, pts.length), labelStep = Math.floor(pts.length / labelCount);
  const xLabels = [];
  for (let i = 0; i < pts.length; i += labelStep) {
    const p = pts[i], dt = new Date(p.t * 1000);
    let label;
    if (range === '1d') label = `${String(dt.getUTCHours()).padStart(2,'0')}:${String(dt.getUTCMinutes()).padStart(2,'0')}`;
    else if (range === '5d') label = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getUTCDay()];
    else label = `${dt.getUTCDate()}/${dt.getUTCMonth()+1}`;
    xLabels.push(`<text x="${((i/(pts.length-1))*W).toFixed(0)}" y="${H+14}" text-anchor="middle" fill="var(--dim)" font-size="9" font-family="var(--mono)">${label}</text>`);
  }
  wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H+20}" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${col}" stop-opacity=".22"/><stop offset="100%" stop-color="${col}" stop-opacity=".01"/></linearGradient></defs>
    <polygon points="0,${xy[0][1].toFixed(1)} ${ptsStr} ${xy[xy.length-1][0].toFixed(1)},${xy[xy.length-1][1].toFixed(1)} ${W},${H} 0,${H}" fill="url(#${gid})"/>
    <polyline points="${ptsStr}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
    ${xLabels.join('')}
  </svg>`;
  if (statsRow) {
    const first = closes[0], last = closes[closes.length-1], chg = last-first, pct = (chg/first)*100;
    const hi = Math.max(...closes), lo = Math.min(...closes);
    const fmtP = v => v >= 1000 ? v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : v.toFixed(2);
    const chgCls = chg >= 0 ? 'up' : 'dn';
    statsRow.innerHTML = `
      <div class="chart-stat"><div class="chart-stat-l">Open</div><div class="chart-stat-v">${fmtP(first)}</div></div>
      <div class="chart-stat"><div class="chart-stat-l">Close</div><div class="chart-stat-v">${fmtP(last)}</div></div>
      <div class="chart-stat"><div class="chart-stat-l">Change</div><div class="chart-stat-v ${chgCls}">${chg>=0?'+':''}${fmtP(chg)} (${pct>=0?'+':''}${pct.toFixed(2)}%)</div></div>
      <div class="chart-stat"><div class="chart-stat-l">High</div><div class="chart-stat-v up">${fmtP(hi)}</div></div>
      <div class="chart-stat"><div class="chart-stat-l">Low</div><div class="chart-stat-v dn">${fmtP(lo)}</div></div>
      <div class="chart-stat"><div class="chart-stat-l">Points</div><div class="chart-stat-v">${pts.length}</div></div>`;
  }
}

// ── WINDOW BINDINGS ───────────────────────────────────────────────────────────
window.setS                 = setS;
window.updateBadges         = updateBadges;
window.applyCompact         = applyCompact;
window.toggleCompact        = toggleCompact;
window.applyDark            = applyDark;
window.toggleDark           = toggleDark;
window.buildSymNames        = buildSymNames;
window.wlAdd                = wlAdd;
window.wlRemove             = wlRemove;
window.renderWatchlist      = renderWatchlist;
window.updateWatchlistData  = updateWatchlistData;
window.selectForWatchlist   = selectForWatchlist;
window.setIdxFilter         = setIdxFilter;
window.renderIndices        = renderIndices;
window.renderYields         = renderYields;
window.renderSection        = renderSection;
window.updateIntelBanner    = updateIntelBanner;
window.renderTicker         = renderTicker;
window.doNews               = doNews;
window.setCalFilter         = setCalFilter;
window.renderCalendar       = renderCalendar;
window.renderEquitySectors  = renderEquitySectors;
window.setMvTab             = setMvTab;
window.renderMovers         = renderMovers;
window.doRefresh            = doRefresh;
window.toggleAuto           = toggleAuto;
window.renderYieldCurve     = renderYieldCurve;
window.renderCreditSnapshot = renderCreditSnapshot;
window.renderIPOCalendar    = renderIPOCalendar;
window.fetchIPOCalendar     = fetchIPOCalendar;
window.loadChartTab         = loadChartTab;
window.drawChartSVG         = drawChartSVG;
