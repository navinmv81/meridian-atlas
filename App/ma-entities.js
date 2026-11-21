// ma-entities.js — Corporate Atlas: Entity Galaxy
// Vanilla JS, no frameworks, no graph libraries.
// Copy to ETF Refresh/ alongside other ma-*.js files before use.

// Set this to the deployed meridian-entities-api Worker URL from Prompt 5
const ENTITIES_API_URL = 'https://meridian-entities-api.navinmv1981.workers.dev';
// WORKER_FILINGS_URL is declared in ma-13f.js, loaded before this file in
// index.html. Classic <script> tags share one global let/const scope, so
// it's already visible here — do NOT redeclare it, that throws a
// duplicate-declaration SyntaxError and breaks the whole page.

const ENTITY_TYPE_COLORS = {
  fund:       '#4A9EFF',
  operating:  '#48BB78',
  manager:    '#ED8936',
  government: '#9F7AEA',
  holding:    '#718096',
  spv:        '#4FD1C5'
};

// ── State ────────────────────────────────────────────────────────────────────

let _breadcrumb = [];       // { entity_id, name } history
let _searchTimer = null;
let _panelInjected = false;

// ── Panel HTML ────────────────────────────────────────────────────────────────

function _injectPanel() {
  if (_panelInjected) return;
  _panelInjected = true;

  const style = document.createElement('style');
  style.textContent = `
    #entities-panel {
      display: none;
      position: fixed;
      top: 64px;
      left: 50%;
      transform: translateX(-50%);
      width: min(1100px, 96vw);
      height: min(820px, calc(100vh - 88px));
      background: var(--bg2);
      border: 1px solid var(--border2);
      border-radius: var(--r);
      z-index: 450;
      overflow: hidden;
      flex-direction: column;
    }
    #entities-panel.show { display: flex; }

    .ent-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
      background: var(--bg3);
      flex-shrink: 0;
    }
    .ent-head-left { display: flex; align-items: center; gap: 12px; }
    .ent-title { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--text); }
    .ent-close { background: none; border: none; color: var(--dim); font-size: 14px; cursor: pointer; padding: 2px 6px; border-radius: var(--r); transition: color .15s; }
    .ent-close:hover { color: var(--text); }

    .ent-search-wrap { position: relative; }
    #ent-search-input {
      width: 220px;
      height: 26px;
      background: var(--bg4);
      border: 1px solid var(--border);
      border-radius: var(--r);
      padding: 0 10px;
      font-family: var(--sans);
      font-size: 11px;
      color: var(--text);
      outline: none;
      transition: border-color .15s;
    }
    #ent-search-input:focus { border-color: var(--blue); }
    #ent-search-input::placeholder { color: var(--muted); }
    #ent-search-results {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      width: 320px;
      background: var(--bg3);
      border: 1px solid var(--border);
      border-radius: var(--r);
      max-height: 240px;
      overflow-y: auto;
      display: none;
      z-index: 500;
    }
    #ent-search-results.show { display: block; }
    .ent-sri {
      padding: 7px 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid var(--border);
      transition: background .1s;
    }
    .ent-sri:last-child { border-bottom: none; }
    .ent-sri:hover { background: var(--bg4); }
    .ent-sri-name { font-size: 11px; color: var(--text); flex: 1; }
    .ent-chip {
      font-size: 8px;
      font-weight: 700;
      letter-spacing: .05em;
      text-transform: uppercase;
      padding: 2px 5px;
      border-radius: 3px;
      border: 1px solid;
      white-space: nowrap;
    }
    .ent-sri-country { font-size: 9px; color: var(--dim); }

    .ent-breadcrumb {
      padding: 5px 14px;
      font-size: 10px;
      color: var(--dim);
      border-bottom: 1px solid var(--border);
      background: var(--bg2);
      flex-shrink: 0;
      min-height: 24px;
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }
    .ent-bc-item { cursor: pointer; color: var(--blue); transition: color .1s; }
    .ent-bc-item:hover { color: var(--text); }
    .ent-bc-current { color: var(--text2); cursor: default; }
    .ent-bc-sep { color: var(--border2); }

    .ent-body { display: flex; flex-direction: column; flex: 1; overflow: hidden; }

    .ent-galaxy-wrap {
      position: relative;
      flex: 1;
      overflow: hidden;
      background: var(--bg2);
    }
    #ent-galaxy-svg {
      width: 100%;
      height: 100%;
      transition: opacity .2s ease;
    }
    .ent-coverage-badge {
      position: absolute;
      top: 10px;
      left: 14px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: .05em;
      padding: 3px 7px;
      border-radius: 3px;
      border: 1px solid;
      pointer-events: none;
    }
    .ent-coverage-green  { background: rgba(45,156,117,.12); color: #2D9C75; border-color: rgba(45,156,117,.3); }
    .ent-coverage-amber  { background: rgba(217,156,61,.10); color: #D99C3D; border-color: rgba(217,156,61,.25); }
    .ent-coverage-red    { background: rgba(200,80,80,.10);  color: #C85050; border-color: rgba(200,80,80,.25); }

    .ent-placeholder {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: var(--muted);
    }
    .ent-placeholder-title { font-size: 13px; font-weight: 600; color: var(--text2); }
    .ent-placeholder-sub   { font-size: 11px; color: var(--dim); }
    .ent-spotlight-btn {
      background: var(--blue-bg);
      border: 1px solid var(--blue-bd);
      color: var(--blue);
      font-size: 11px;
      font-weight: 600;
      padding: 5px 12px;
      border-radius: var(--r);
      cursor: pointer;
      transition: all .15s;
    }
    .ent-spotlight-btn:hover { background: var(--bg4); }

    .ent-strip {
      flex-shrink: 0;
      padding: 8px 14px;
      border-top: 1px solid var(--border);
      background: var(--bg3);
      display: flex;
      align-items: center;
      gap: 16px;
      font-size: 10px;
      color: var(--text2);
      min-height: 34px;
    }
    .ent-strip-label { color: var(--dim); font-size: 9px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; white-space: nowrap; }
    .ent-strip-val   { font-weight: 600; color: var(--text); }
    .ent-strip-lei   { font-family: var(--mono); font-size: 9px; color: var(--dim); margin-left: auto; letter-spacing: .02em; }
    .ent-strip-cov-green { color: #2D9C75; font-weight: 700; }
    .ent-strip-cov-amber { color: #D99C3D; font-weight: 700; }
    .ent-strip-cov-red   { color: #C85050; font-weight: 700; }

    #ent-tooltip {
      position: fixed;
      background: var(--bg4);
      border: 1px solid var(--border2);
      border-radius: var(--r);
      padding: 8px 10px;
      font-size: 10px;
      color: var(--text);
      pointer-events: none;
      z-index: 600;
      display: none;
      max-width: 220px;
      line-height: 1.6;
    }
  `;
  document.head.appendChild(style);

  const panel = document.createElement('section');
  panel.id = 'entities-panel';
  panel.setAttribute('aria-label', 'Corporate Atlas');
  panel.innerHTML = `
    <div class="ent-head">
      <div class="ent-head-left">
        <span class="ent-title">Corporate Atlas</span>
        <div class="ent-search-wrap">
          <input id="ent-search-input" type="text" placeholder="Search entities…" autocomplete="off">
          <div id="ent-search-results"></div>
        </div>
      </div>
      <button class="ent-close" onclick="closeEntities()">✕</button>
    </div>
    <div class="ent-breadcrumb" id="ent-breadcrumb"></div>
    <div class="ent-body">
      <div class="ent-galaxy-wrap" id="ent-galaxy-wrap">
        <svg id="ent-galaxy-svg" xmlns="http://www.w3.org/2000/svg"></svg>
        <div id="ent-coverage-badge" class="ent-coverage-badge" style="display:none"></div>
        <div id="ent-placeholder" class="ent-placeholder">
          <div class="ent-placeholder-title">Entity Galaxy</div>
          <div class="ent-placeholder-sub">Search for a company, fund, or government issuer</div>
          <button class="ent-spotlight-btn" id="ent-spotlight-btn" style="display:none" onclick="entLoadSpotlight()">
            Load top exposure entity
          </button>
        </div>
      </div>
      <div class="ent-strip" id="ent-strip">
        <span class="ent-strip-label">Corporate Atlas</span>
        <span style="color:var(--dim);font-size:10px">Select an entity to explore exposure</span>
      </div>
    </div>
    <div id="ent-tooltip"></div>
  `;
  document.body.appendChild(panel);

  _setupSearch();
  _loadSpotlight();
}

// ── Public API ────────────────────────────────────────────────────────────────

function openEntities(entityId = null) {
  _injectPanel();
  document.getElementById('entities-panel').classList.add('show');
  if (entityId) {
    _loadEntity(entityId);
  }
}

function closeEntities() {
  const panel = document.getElementById('entities-panel');
  if (panel) panel.classList.remove('show');
  _hideSearch();
}

// Alias for index.html button
function openCorporateAtlas() { openEntities(); }

// Called from Prompt 7 spotlight button
function entLoadSpotlight() {
  const btn = document.getElementById('ent-spotlight-btn');
  const eid = btn?.dataset?.entityId;
  if (eid) _loadEntity(parseInt(eid, 10));
}

// ── Search ────────────────────────────────────────────────────────────────────

function _setupSearch() {
  const input = document.getElementById('ent-search-input');
  if (!input) return;
  input.addEventListener('input', () => {
    clearTimeout(_searchTimer);
    const q = input.value.trim();
    if (q.length < 2) { _hideSearch(); return; }
    _searchTimer = setTimeout(() => _doSearch(q), 300);
  });
  input.addEventListener('blur', () => {
    setTimeout(_hideSearch, 200);
  });
}

async function _doSearch(q) {
  if (!ENTITIES_API_URL) return;
  try {
    const res = await fetch(`${ENTITIES_API_URL}/api/entities/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    _renderSearchResults(data.results ?? []);
  } catch (e) {
    console.error('[ma-entities] search error', e);
  }
}

function _renderSearchResults(results) {
  const box = document.getElementById('ent-search-results');
  if (!box) return;
  if (!results.length) { _hideSearch(); return; }

  box.innerHTML = results.map(r => {
    const color = ENTITY_TYPE_COLORS[r.type] ?? '#718096';

    // entity_status badge
    const statusBadge = _entityStatusBadge(r.entity_status);
    const freshnessBadge = _freshnessBadge(r.gleif_last_updated ?? null);

    // hq city + country
    const hqParts = [r.hq_city, r.hq_country].filter(Boolean);
    const hqLabel = hqParts.length
      ? `<span class="ent-sri-country">${_esc(hqParts.join(', '))}</span>`
      : (r.country ? `<span class="ent-sri-country">${_esc(r.country)}</span>` : '');

    // primary_ticker
    const tickerLabel = r.primary_ticker
      ? `<span style="font-family:var(--mono);font-size:9px;color:var(--text2);white-space:nowrap">${_esc(r.primary_ticker)}</span>`
      : '';

    // isin_match_count
    const isinLabel = r.isin_match_count > 0
      ? `<span style="font-size:9px;color:var(--muted);white-space:nowrap">${r.isin_match_count} ISINs</span>`
      : '';

    return `
      <div class="ent-sri" onclick="showEntityDetail(${r.entity_id});_hideSearch();document.getElementById('ent-search-input')&&(document.getElementById('ent-search-input').value='')">
        <span class="ent-chip" style="color:${color};border-color:${color}40;background:${color}18">${_esc(r.type)}</span>
        <span class="ent-sri-name">${_esc(r.name)}</span>
        ${statusBadge}
        ${freshnessBadge}
        ${tickerLabel}
        ${hqLabel}
        ${isinLabel}
      </div>`;
  }).join('');
  box.classList.add('show');
}

function entSelectResult(entityId) {
  _hideSearch();
  const input = document.getElementById('ent-search-input');
  if (input) input.value = '';
  _loadEntity(entityId);
}

function _hideSearch() {
  const box = document.getElementById('ent-search-results');
  if (box) { box.classList.remove('show'); box.innerHTML = ''; }
}

// ── Spotlight ─────────────────────────────────────────────────────────────────

async function _loadSpotlight() {
  if (!ENTITIES_API_URL) return;
  try {
    const res = await fetch(`${ENTITIES_API_URL}/api/entities/search?q=ishares`);
    const data = await res.json();
    const top = (data.results ?? []).find(r => r.total_exposure > 0);
    if (top) {
      const btn = document.getElementById('ent-spotlight-btn');
      if (btn) {
        btn.dataset.entityId = top.entity_id;
        btn.textContent = `Explore: ${top.name}`;
        btn.style.display = '';
      }
    }
  } catch (e) { /* spotlight is best-effort */ }
}

// ── Entity loading ────────────────────────────────────────────────────────────

async function _loadEntity(entityId) {
  if (!ENTITIES_API_URL) {
    console.warn('[ma-entities] ENTITIES_API_URL not set');
    return;
  }
  const svg = document.getElementById('ent-galaxy-svg');
  if (svg) svg.style.opacity = '0.4';

  try {
    const res = await fetch(`${ENTITIES_API_URL}/api/entities/${entityId}/graph`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    _pushBreadcrumb({ entity_id: data.entity.entity_id, name: data.entity.name });
    _renderBreadcrumb();
    _renderGalaxy(data);
    _renderStrip(data);

    document.getElementById('ent-placeholder').style.display = 'none';
  } catch (e) {
    console.error('[ma-entities] load entity error', e);
  } finally {
    if (svg) svg.style.opacity = '1';
  }
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────

function _pushBreadcrumb(entity) {
  const last = _breadcrumb[_breadcrumb.length - 1];
  if (last?.entity_id === entity.entity_id) return;
  _breadcrumb.push(entity);
}

function _renderBreadcrumb() {
  const el = document.getElementById('ent-breadcrumb');
  if (!el) return;
  if (_breadcrumb.length <= 1) { el.innerHTML = ''; return; }

  el.innerHTML = _breadcrumb.map((b, i) => {
    const isLast = i === _breadcrumb.length - 1;
    const sep = i > 0 ? `<span class="ent-bc-sep">›</span>` : '';
    if (isLast) return `${sep}<span class="ent-bc-current">${_esc(b.name)}</span>`;
    return `${sep}<span class="ent-bc-item" onclick="entBcNavigate(${i})">${_esc(b.name)}</span>`;
  }).join('');
}

function entBcNavigate(index) {
  _breadcrumb = _breadcrumb.slice(0, index + 1);
  const target = _breadcrumb[index];
  _breadcrumb = _breadcrumb.slice(0, index); // _loadEntity will re-push
  _renderBreadcrumb();
  _loadEntity(target.entity_id);
}

// ── Galaxy SVG ────────────────────────────────────────────────────────────────

function _renderGalaxy(data) {
  const wrap = document.getElementById('ent-galaxy-wrap');
  const svg = document.getElementById('ent-galaxy-svg');
  if (!wrap || !svg) return;

  const W = wrap.clientWidth || 820;
  const H = wrap.clientHeight || 460;
  const cx = W / 2;
  const cy = H * 0.46;

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = _buildSvgContent(data, W, H, cx, cy);

  // Coverage badge
  const badge = document.getElementById('ent-coverage-badge');
  if (badge) {
    if (data.coverage?.coverage_pct != null) {
      const pct = data.coverage.coverage_pct;
      badge.textContent = `Mapped: ${pct}%`;
      badge.className = 'ent-coverage-badge ' +
        (pct >= 70 ? 'ent-coverage-green' : pct >= 40 ? 'ent-coverage-amber' : 'ent-coverage-red');
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }

  _attachNodeEvents();
}

function _buildSvgContent(data, W, H, cx, cy) {
  const entity = data.entity;
  const parents = data.parents ?? [];
  const southData = entity.type === 'fund' ? (data.holdings ?? []) : (data.holders ?? []);
  const isFund = entity.type === 'fund';

  const northNodes = parents.slice(0, 3);
  const southNodes = southData.slice(0, 12);
  const southOverflow = Math.max(0, southData.length - 12);

  const northPositions = _arcPositions(northNodes.length, cx, cy, 170, -150, -30);
  const southPositions = _arcPositions(southNodes.length, cx, cy, 200, 20, 160);

  let svgParts = [];

  // ── Defs: glow filter
  svgParts.push(`
    <defs>
      <filter id="ent-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
  `);

  // ── Section labels
  if (northNodes.length) {
    svgParts.push(_svgText(cx, 22, 'PARENTS & MANAGERS', 'var(--dim)', 8, 'middle', '700', '.08em'));
  }
  const southLabel = isFund ? 'TOP HOLDINGS' : 'HELD BY';
  if (southNodes.length) {
    svgParts.push(_svgText(cx, H - 14, southLabel, 'var(--dim)', 8, 'middle', '700', '.08em'));
  }

  // ── Edges — north (behind nodes)
  northPositions.forEach((pos, i) => {
    const rel = northNodes[i]?.relationship_type ?? '';
    const dash = rel === 'fund_manager' ? '4,3' : 'none';
    const color = rel === 'legal_parent' ? 'rgba(90,155,200,0.45)' : 'rgba(237,137,54,0.40)';
    svgParts.push(`<line x1="${cx}" y1="${cy}" x2="${pos.x}" y2="${pos.y}" stroke="${color}" stroke-width="1.5" stroke-dasharray="${dash}" opacity="0.7"/>`);
  });

  // ── Edges — south
  southPositions.forEach(pos => {
    svgParts.push(`<line x1="${cx}" y1="${cy}" x2="${pos.x}" y2="${pos.y}" stroke="rgba(160,184,214,0.15)" stroke-width="1"/>`);
  });

  // ── North nodes
  northPositions.forEach((pos, i) => {
    const node = northNodes[i];
    svgParts.push(_nodeGroup(node.entity_id, node.name, node.type, pos.x, pos.y, 18, null, node.relationship_type, node.entity_status, node.hq_city, node.gleif_last_updated));
  });

  // ── South nodes
  southPositions.forEach((pos, i) => {
    const node = southNodes[i];
    const r = Math.max(16, Math.min(48, Math.sqrt((node.weight_sum ?? 0.01) * 800) + 14));
    svgParts.push(_nodeGroup(node.entity_id, node.name, node.type, pos.x, pos.y, r, node.weight_sum, null, node.entity_status, node.hq_city, node.gleif_last_updated));
  });

  // ── Overflow text
  if (southOverflow > 0) {
    const lastPos = southPositions[southPositions.length - 1] ?? { y: cy + 200 };
    svgParts.push(_svgText(cx, lastPos.y + 28, `+${southOverflow} more`, 'var(--muted)', 9, 'middle', '400'));
  }

  // ── Center node (drawn last = on top)
  const centerColor = ENTITY_TYPE_COLORS[entity.type] ?? '#718096';
  const centerData = JSON.stringify({ entity_id: entity.entity_id, name: entity.name, type: entity.type, weight: null, relType: null }).replace(/"/g, '&quot;');
  svgParts.push(`
    <g class="ent-node" data-entity="${centerData}" style="cursor:default" onclick="entNodeClick(${entity.entity_id})">
      <circle cx="${cx}" cy="${cy}" r="38" fill="${centerColor}22" stroke="${centerColor}" stroke-width="2.5" filter="url(#ent-glow)"/>
      ${_svgText(cx, cy + 2, _truncate(entity.name, 22), 'var(--text)', 10, 'middle', '600')}
      ${_svgText(cx, cy + 16, entity.type, centerColor, 8, 'middle', '600', '.06em')}
    </g>
  `);

  return svgParts.join('');
}

function _nodeGroup(entityId, name, type, x, y, r, weight, relType, entityStatus = null, hqCity = null, gleifLastUpdated = null) {
  const color = ENTITY_TYPE_COLORS[type] ?? '#718096';
  const label = _truncate(name, 16);
  const weightLabel = weight != null ? `${weight.toFixed(2)}%` : '';
  const data = JSON.stringify({ entity_id: entityId, name, type, weight, relType }).replace(/"/g, '&quot;');

  return `
    <g class="ent-node" data-entity="${data}" data-entity-id="${entityId}" data-entity-status="${_esc(entityStatus ?? '')}" data-hq-city="${_esc(hqCity ?? '')}" data-gleif-last-updated="${_esc(gleifLastUpdated ?? '')}" style="cursor:pointer" onclick="entNodeClick(${entityId})">
      <circle cx="${x}" cy="${y}" r="${r}" fill="${color}22" stroke="${color}" stroke-width="1.5" opacity="0.85" class="ent-node-circle"/>
      ${_svgText(x, y + r + 11, label, 'var(--text2)', 9, 'middle', '500')}
      ${weightLabel ? _svgText(x, y + r + 21, weightLabel, color, 8, 'middle', '600') : ''}
    </g>`;
}

function _arcPositions(count, cx, cy, radius, startDeg, endDeg) {
  if (count === 0) return [];
  if (count === 1) {
    const mid = (startDeg + endDeg) / 2;
    const rad = mid * Math.PI / 180;
    return [{ x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }];
  }
  return Array.from({ length: count }, (_, i) => {
    const deg = startDeg + (i / (count - 1)) * (endDeg - startDeg);
    const rad = deg * Math.PI / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  });
}

function _svgText(x, y, text, fill, size, anchor, weight = '400', spacing = '0') {
  return `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" text-anchor="${anchor}" font-weight="${weight}" letter-spacing="${spacing}" font-family="Inter,sans-serif">${_esc(String(text))}</text>`;
}

function _attachNodeEvents() {
  const tooltip = document.getElementById('ent-tooltip');
  if (!tooltip) return;

  document.querySelectorAll('.ent-node').forEach(node => {
    node.addEventListener('mouseenter', e => {
      const raw = node.dataset.entity;
      if (!raw) return;
      const d = JSON.parse(raw.replace(/&quot;/g, '"'));
      const color = ENTITY_TYPE_COLORS[d.type] ?? '#718096';
      const nodeStatus = node.dataset.entityStatus || '';
      const nodeHqCity = node.dataset.hqCity || '';
      const nodeGleif = node.dataset.gleifLastUpdated || null;
      const statusDot = nodeStatus === 'ACTIVE'   ? '<span style="color:#2D9C75">●</span>' :
                        nodeStatus === 'INACTIVE' ? '<span style="color:#C85050">●</span>' :
                        nodeStatus === 'LAPSED'   ? '<span style="color:#D99C3D">●</span>' :
                        nodeStatus               ? '<span style="color:#718096">●</span>' : '';
      const freshnessHtml = _freshnessBadge(nodeGleif);
      tooltip.innerHTML = `
        <div style="font-weight:700;color:var(--text);margin-bottom:4px">${statusDot ? statusDot + ' ' : ''}${_esc(d.name)}${freshnessHtml}</div>
        <div style="display:flex;gap:6px;margin-bottom:3px">
          <span class="ent-chip" style="color:${color};border-color:${color}40;background:${color}18">${d.type}</span>
          ${nodeStatus ? `<span style="font-size:9px;color:var(--dim)">${_esc(nodeStatus)}</span>` : ''}
        </div>
        ${nodeHqCity ? `<div style="color:var(--dim)">HQ: <span style="color:var(--text2)">${_esc(nodeHqCity)}</span></div>` : ''}
        ${d.weight != null ? `<div style="color:var(--dim)">Weight: <span style="color:var(--text)">${Number(d.weight).toFixed(3)}%</span></div>` : ''}
        ${d.relType ? `<div style="color:var(--dim)">Rel: <span style="color:var(--text2)">${d.relType}</span></div>` : ''}
        <div style="color:var(--dim);font-size:9px;margin-top:3px">Click to explore →</div>
      `;
      tooltip.style.display = 'block';
      _positionTooltip(e);
    });
    node.addEventListener('mousemove', e => _positionTooltip(e));
    node.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
  });
}

function _positionTooltip(e) {
  const tooltip = document.getElementById('ent-tooltip');
  if (!tooltip) return;
  const pad = 12;
  let left = e.clientX + pad;
  let top = e.clientY + pad;
  if (left + 230 > window.innerWidth) left = e.clientX - 230 - pad;
  if (top + 120 > window.innerHeight) top = e.clientY - 120 - pad;
  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
}

function entNodeClick(entityId) {
  if (!entityId) return;
  showEntityDetail(entityId);
}

// ── Exposure strip ────────────────────────────────────────────────────────────

function _renderStrip(data) {
  const strip = document.getElementById('ent-strip');
  if (!strip) return;

  const e = data.entity;
  const southData = e.type === 'fund' ? (data.holdings ?? []) : (data.holders ?? []);
  const coverage = data.coverage;

  let parts = [];

  if (e.type === 'fund') {
    const topN = southData.slice(0, 5);
    const topSum = topN.reduce((s, n) => s + (n.weight_sum ?? 0), 0);
    if (topN.length) {
      parts.push(`<span class="ent-strip-label">Top ${topN.length} issuers</span>`);
      parts.push(`<span class="ent-strip-val">${topSum.toFixed(2)}% of holdings</span>`);
    }
    if (coverage?.coverage_pct != null) {
      const pct = coverage.coverage_pct;
      const cls = pct >= 70 ? 'ent-strip-cov-green' : pct >= 40 ? 'ent-strip-cov-amber' : 'ent-strip-cov-red';
      parts.push(`<span class="ent-strip-label">Coverage</span>`);
      parts.push(`<span class="${cls}">${pct}%</span>`);
    }
  } else {
    const holderCount = southData.length;
    const totalExp = southData.reduce((s, n) => s + (n.weight_sum ?? 0), 0);
    if (holderCount) {
      parts.push(`<span class="ent-strip-label">ETF exposure</span>`);
      parts.push(`<span class="ent-strip-val">${totalExp.toFixed(2)}% across ${holderCount} ETF${holderCount !== 1 ? 's' : ''}</span>`);
    }
  }

  if (e.lei) {
    parts.push(`<span class="ent-strip-lei">LEI: ${_esc(e.lei)}</span>`);
  }

  strip.innerHTML = parts.length
    ? parts.join('')
    : `<span class="ent-strip-label">Corporate Atlas</span><span style="color:var(--dim);font-size:10px">${_esc(e.name)}</span>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _truncate(s, max) {
  return s && s.length > max ? s.slice(0, max - 1) + '…' : (s ?? '');
}

// ── Entity Detail Page ────────────────────────────────────────────────────────

let _previousView = null;

function _buildEntityDetailHTML(entity, backLabel, backHandler, parents, children) {
  backLabel   = backLabel   || 'Galaxy';
  backHandler = backHandler || 'restoreEntityPreviousView()';
  parents     = parents  ?? [];
  children    = children ?? [];

  // MA-SEP-004: this template is shared by two entry points with different
  // containers — showEntityDetail (main entities-panel) and showEntityOverlay
  // (a fixed full-screen overlay div). A click-through needs to navigate
  // within whichever one is actually on screen; calling showEntityDetail
  // from inside the overlay would render into the panel underneath instead
  // of updating the overlay, leaving the old overlay stuck on top. backHandler
  // already tells us which context this render is for, so reuse that signal
  // rather than adding a new parameter.
  // MA-OCT-007: navigation layers pass 'navBack()' (history-backed overlay stack).
  const navFn = (backHandler === 'closeEntityOverlay()' || backHandler === 'navBack()') ? 'showEntityOverlay' : 'showEntityDetail';

  function _statusBadge(status) {
    if (!status) return '';
    const col = status === 'ACTIVE' ? '#2D9C75' : status === 'INACTIVE' ? '#C85050' : '#D99C3D';
    return `<span style="border:1px solid ${col}40;background:${col}18;color:${col};border-radius:3px;padding:2px 7px;font-size:10px;font-weight:700;letter-spacing:.05em">● ${_esc(status)}</span>`;
  }

  function _leiBadge(leiStatus) {
    if (!leiStatus) return '';
    const col = leiStatus === 'ISSUED' ? '#4A9EFF' : leiStatus === 'LAPSED' ? '#D99C3D' : '#C85050';
    return `<span style="border:1px solid ${col}40;background:${col}18;color:${col};border-radius:3px;padding:2px 7px;font-size:10px;font-weight:700;letter-spacing:.05em">${_esc(leiStatus)}</span>`;
  }

  // MA-SEP-004 Requirement 1: entity_master's direct_parent_lei/
  // ultimate_parent_lei are name/LEI text only (no entity_id column) — the
  // only place that resolves them to a real entity_id is /graph's `parents`
  // array (joined through entity_relationships). Match on LEI against
  // whatever /graph returned for this entity; a parent whose LEI isn't
  // findable there (e.g. an un-enriched GLEIF exception, or a parent that
  // simply isn't itself in entity_master) stays plain, non-clickable text —
  // per Requirement 1's acceptance criteria, do not invent a fake link.
  function _resolveParentEntityId(lei) {
    if (!lei) return null;
    const match = parents.find(p => p.lei === lei);
    return match ? match.entity_id : null;
  }

  function _ownershipRow(name, lei, exception) {
    if (name) {
      const resolvedId = _resolveParentEntityId(lei);
      const nameHtml = resolvedId
        ? `<span class="ent-bc-item" style="font-weight:700" onclick="${navFn}(${resolvedId})">${_esc(name)}</span>`
        : `<strong>${_esc(name)}</strong>`;
      return `${nameHtml}${lei ? `<br><span style="font-family:var(--mono);font-size:9px;color:var(--dim)">${_esc(lei)}</span>` : ''}`;
    }
    if (exception) return `<span style="color:var(--dim)">None reported</span><br><span style="color:var(--muted);font-size:10px">Reason: ${_esc(exception)}</span>`;
    return '<span style="color:var(--dim)">Not reported</span>';
  }

  // MA-SEP-004 Requirement 2/3: one group of clickable rows (Subsidiaries or
  // Managed Funds), capped with an accurate "+N more" — N is the group's
  // true remaining count, not a guess, since /graph's children query
  // (entities-api.js) now returns up to 200 real rows instead of an
  // arbitrary/truncated 20 (see that query's own comment for why).
  function _childGroup(label, rows, cap) {
    if (!rows.length) return '';
    const shown = rows.slice(0, cap);
    const overflow = rows.length - shown.length;
    const rowsHtml = shown.map(r => `
      <div class="ent-bc-item" style="display:block;padding:5px 0;border-bottom:1px solid var(--border)" onclick="${navFn}(${r.entity_id})">
        <div style="font-weight:600;color:var(--text)">${_esc(r.name)}</div>
        ${r.country ? `<div style="font-size:9px;color:var(--dim)">${_esc(r.country)}</div>` : ''}
      </div>
    `).join('');
    return `
      <div style="margin-bottom:12px">
        <div style="font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--dim);margin-bottom:6px">${_esc(label)} (${rows.length})</div>
        ${rowsHtml}
        ${overflow > 0 ? `<div style="font-size:10px;color:var(--muted);padding:6px 0 2px">+${overflow} more</div>` : ''}
      </div>
    `;
  }

  // Cap of 12 per group: pending real fan-out data (MA-SEP-004 First Step 1,
  // confirmed live 2026-08-22) — highest real case is 96 fund_manager
  // children (BlackRock/iShares Trust), well within the Spec's recommended
  // 10-15 starting range; legal_parent counts are currently far lower (0-2
  // per entity across all of entity_master today).
  const CHILD_GROUP_CAP = 12;
  const subsidiaries = children.filter(c => c.relationship_type === 'legal_parent');
  const managedFunds  = children.filter(c => c.relationship_type === 'fund_manager');
  const childrenSectionHtml = (subsidiaries.length || managedFunds.length)
    ? `
      <div style="margin:0 16px 16px;padding:14px 16px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);font-size:11px;color:var(--text2);line-height:1.5">
        <div style="font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--dim);margin-bottom:10px">Children</div>
        ${_childGroup('Subsidiaries', subsidiaries, CHILD_GROUP_CAP)}
        ${_childGroup('Managed Funds', managedFunds, CHILD_GROUP_CAP)}
      </div>`
    : '';

  const gleifUrl = entity.lei ? `https://search.gleif.org/#/record/${entity.lei}` : null;
  const edgarSearchUrl = entity.legal_name
    ? `https://efts.sec.gov/LATEST/search-index?q="${encodeURIComponent(entity.legal_name)}"&dateRange=custom&startdt=2020-01-01`
    : null;
  const edgar13fUrl = entity.legal_name
    ? `https://efts.sec.gov/LATEST/search-index?q="${encodeURIComponent(entity.legal_name)}"&forms=13F-HR`
    : null;

  return `
    <div style="display:flex;flex-direction:column;height:100%;overflow-y:auto;background:var(--bg2)">

      <!-- Breadcrumb -->
      <div class="entity-breadcrumb" style="position:relative;padding:8px 16px;border-bottom:1px solid var(--border);background:var(--bg3);flex-shrink:0">
        <button class="entity-overlay-back" onclick="${backHandler}" style="background:none;border:none;color:var(--blue);font-size:11px;cursor:pointer;padding:2px 0">← Back to ${backLabel}</button>
        <button onclick="closeEntityDetail()"
          style="position:absolute;top:16px;right:16px;background:none;
border:none;color:#888;font-size:1.2em;cursor:pointer;
line-height:1;" title="Close">×</button>
      </div>

      <!-- Header card -->
      <div style="margin:16px;padding:18px 20px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r)">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px">
          <h2 style="margin:0;font-size:17px;font-weight:700;color:var(--text);flex:1">${_esc(entity.legal_name ?? entity.name ?? '—')}</h2>
          <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
            ${_entityStatusBadge(entity.entity_status)}
            ${_leiBadge(entity.lei_registration_status)}
          </div>
        </div>
        ${_firdsDirectoryTierBadge(entity.firds_directory_tier, entity.firds_as_of)}
        ${entity.entity_status && entity.entity_status !== 'ACTIVE' ? `
        <div style="margin:8px 0;padding:8px 12px;border-radius:4px;
background:#3a1a1a;color:#C85050;font-size:0.85em;">
⚠ This entity is ${entity.entity_status}.
${entity.expiration_reason ? `Reason: ${entity.expiration_reason}.` : ''}
${entity.expiration_date ? `Effective: ${entity.expiration_date.slice(0,10)}.` : ''}
</div>` : ''}

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;font-size:11px;color:var(--text2);line-height:1.8">
          ${entity.lei ? `<div><span style="color:var(--dim)">LEI</span> <span style="font-family:var(--mono)">${_esc(entity.lei)}</span></div>` : ''}
          ${entity.primary_ticker ? `<div><span style="color:var(--dim)">Ticker</span> <strong>${_esc(entity.primary_ticker)}</strong></div>` : ''}
          ${entity.legal_jurisdiction ? `<div><span style="color:var(--dim)">Incorporated in</span> ${_esc(entity.legal_jurisdiction)}</div>` : ''}
          ${entity.legal_form_text ? `<div><span style="color:var(--dim)">Legal form</span> ${_esc(entity.legal_form_text)}</div>` : ''}
          ${(entity.hq_city || entity.hq_country) ? `<div><span style="color:var(--dim)">HQ</span> ${_esc([entity.hq_city, entity.hq_country].filter(Boolean).join(', '))}</div>` : ''}
          ${(entity.legal_address_line1 || entity.legal_address_city) ? `<div><span style="color:var(--dim)">Registered address</span> ${_esc([entity.legal_address_line1, entity.legal_address_city, entity.legal_address_country].filter(Boolean).join(', '))}</div>` : ''}
          ${entity.lei_validation_source ? `<div><span style="color:var(--dim)">Validation</span> ${_esc(entity.lei_validation_source)}</div>` : ''}
          <div>${_freshnessBadge(entity.gleif_last_updated)}</div>
        </div>

        <div style="margin-top:12px;display:flex;gap:14px;flex-wrap:wrap">
          ${gleifUrl ? `<a href="${_esc(gleifUrl)}" target="_blank" rel="noopener" style="font-size:11px;color:var(--blue)">View on search.gleif.org →</a>` : ''}
          ${edgarSearchUrl ? `<a href="${_esc(edgarSearchUrl)}" target="_blank" rel="noopener" style="font-size:11px;color:var(--blue)">Search SEC EDGAR →</a>` : ''}
        </div>
      </div>

      <!-- Ownership + Identifiers row -->
      <div style="margin:0 16px 16px;display:grid;grid-template-columns:1fr 1fr;gap:14px">

        <!-- Ownership panel — Ownership Chain for operating entities; Fund Manager for funds -->
        ${entity.type === 'fund'
          ? `<div style="padding:14px 16px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);font-size:11px;color:var(--text2);line-height:1.8">
          <div style="font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--dim);margin-bottom:10px">Fund Manager</div>
          ${entity.fund_manager
            ? `<div style="margin-top:8px;">
                 <div style="color:var(--dim);font-size:10px;margin-bottom:2px">Manager</div>
                 <div style="font-size:1em;font-weight:600;">${_esc(entity.fund_manager.name)}</div>
                 ${entity.fund_manager.lei
                   ? `<div style="color:var(--dim);font-size:0.75em;margin-top:2px;">LEI: ${_esc(entity.fund_manager.lei)}</div>`
                   : ''}
               </div>`
            : `<div style="margin-top:8px;color:var(--dim)">Not reported</div>`
          }
        </div>`
          : `<div style="padding:14px 16px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);font-size:11px;color:var(--text2);line-height:1.8">
          <div style="font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--dim);margin-bottom:10px">Ownership Chain</div>
          <div style="margin-bottom:10px">
            <div style="color:var(--dim);font-size:10px;margin-bottom:2px">Direct parent</div>
            <div>${_ownershipRow(entity.direct_parent_name, entity.direct_parent_lei, entity.direct_parent_exception)}</div>
          </div>
          <div>
            <div style="color:var(--dim);font-size:10px;margin-bottom:2px">Ultimate parent</div>
            <div>${_ownershipRow(entity.ultimate_parent_name, entity.ultimate_parent_lei, entity.ultimate_parent_exception)}</div>
          </div>
        </div>`
        }

        <!-- Identifiers panel -->
        <div style="padding:14px 16px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);font-size:11px;color:var(--text2);line-height:1.8">
          <div style="font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--dim);margin-bottom:10px">Identifiers</div>
          <table style="border-collapse:collapse;width:100%">
            ${entity.lei ? `<tr><td style="color:var(--dim);padding-right:12px;padding-bottom:3px;white-space:nowrap">LEI</td><td style="font-family:var(--mono);font-size:9px">${_esc(entity.lei)}</td></tr>` : ''}
            ${entity.primary_ticker ? `<tr><td style="color:var(--dim);padding-right:12px;padding-bottom:3px">Ticker</td><td><strong>${_esc(entity.primary_ticker)}</strong></td></tr>` : ''}
            ${entity.business_register_id ? `<tr><td style="color:var(--dim);padding-right:12px;padding-bottom:3px">Reg ID</td><td>${_esc(entity.business_register_id)}</td></tr>` : ''}
            ${entity.registration_authority ? `<tr><td style="color:var(--dim);padding-right:12px;padding-bottom:3px">Authority</td><td>${_esc(entity.registration_authority)}</td></tr>` : ''}
            ${entity.isin_match_count ? `<tr><td style="color:var(--dim);padding-right:12px;padding-bottom:3px">ISINs</td><td>Matched via ${entity.isin_match_count} ISIN${entity.isin_match_count !== 1 ? 's' : ''}</td></tr>` : ''}
            ${entity.match_source ? `<tr><td style="color:var(--dim);padding-right:12px">Source</td><td>${_esc(entity.match_source)}</td></tr>` : ''}
          </table>
        </div>
      </div>

      <!-- Children (Subsidiaries / Managed Funds) — MA-SEP-004, hidden entirely when empty -->
      ${childrenSectionHtml}

      <!-- ETF Exposure strip -->
      <div style="margin:0 16px 16px;padding:14px 16px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r)" id="etf-exposure-section-${entity.entity_id}">
        <div style="font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--dim);margin-bottom:10px">ETF Exposure</div>
        <div style="color:var(--dim);font-size:11px">Loading exposure data…</div>
      </div>

      <!-- Linked Instruments strip -->
      <div style="margin:0 16px 16px;padding:14px 16px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r)" id="linked-instruments-section-${entity.entity_id}">
        <div style="font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--dim);margin-bottom:10px">Linked Instruments</div>
        <div style="color:var(--dim);font-size:11px">Loading linked instruments…</div>
      </div>

      <!-- Bonds (MA-OCT-010): hidden unless the issuer has a linked SEC filer CIK -->
      <div style="display:none;margin:0 16px 16px;padding:14px 16px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r)" id="issuer-bonds-section-${entity.entity_id}"></div>

      <!-- Issuer panels: 13F ownership / financials / 8-K events / filing timeline -->
      <!-- Populated by ent_injectIssuerPanels() — called from both showEntityDetail
           (Galaxy/Search entry points) and showEntityOverlay (ETF Holdings entry point) -->
      <div id="issuer-panels-section-${entity.entity_id}"></div>

      <!-- 13F section -->
      <div style="margin:0 16px 24px;padding:14px 16px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r)">
        <div style="font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--dim);margin-bottom:8px">13F Institutional Filings</div>
        ${edgar13fUrl
          ? `<a href="${_esc(edgar13fUrl)}" target="_blank" rel="noopener" style="font-size:11px;color:var(--blue)">Search SEC EDGAR for ${_esc(entity.legal_name ?? entity.name ?? 'this entity')} 13F filings →</a>
             <div style="font-size:10px;color:var(--muted);margin-top:4px">Opens in new tab — live SEC lookup</div>`
          : '<span style="color:var(--dim);font-size:11px">No entity name available for EDGAR search.</span>'
        }
      </div>

    </div>
  `;
}

function _freshnessBadge(gleifLastUpdated) {
  if (!gleifLastUpdated) {
    return '<span style="font-size:0.7em;padding:2px 6px;border-radius:3px;background:#2a2a2a;color:#666;margin-left:6px;">NO DATA</span>';
  }
  const days = Math.floor(
    (Date.now() - new Date(gleifLastUpdated).getTime()) / 86400000
  );
  if (days <= 90) {
    return `<span style="font-size:0.7em;padding:2px 6px;border-radius:3px;background:#1a3a2a;color:#4DC8A0;margin-left:6px;">● CURRENT</span>`;
  } else if (days <= 180) {
    return `<span style="font-size:0.7em;padding:2px 6px;border-radius:3px;background:#3a3010;color:#D4A843;margin-left:6px;">● AGEING</span>`;
  } else {
    return `<span style="font-size:0.7em;padding:2px 6px;border-radius:3px;background:#3a1a1a;color:#C85050;margin-left:6px;">● STALE</span>`;
  }
}

// MA-SEP-014 (Known Issue 22.25 part 2): small, factual indicator for
// entities sourced from FIRDS. `firds_directory_tier`/`firds_as_of` come
// from entities-api.js's handleEntity (a join against entity_isin_map's
// match_source = 'firds_direct' marker — the only writer that stamps that
// value) — this function just renders what the API already decided, it
// does not re-derive origin from any other field, so it never renders for
// a non-FIRDS entity (a false positive here would be worse than no label
// at all, per the Build Brief).
function _firdsDirectoryTierBadge(isFirdsDirectoryTier, asOf) {
  if (!isFirdsDirectoryTier) return '';
  const dateText = asOf ? _esc(asOf.slice(0, 10)) : 'unknown date';
  return `<div style="margin-top:8px"><span style="font-size:0.7em;padding:2px 8px;border-radius:3px;background:#1a2a3a;color:#4A9EFF;font-weight:600;">Directory-tier (ESMA FIRDS), as of ${dateText}</span></div>`;
}

function _entityStatusBadge(status) {
  if (!status) return '';
  const colours = {
    'ACTIVE':   { bg: '#1a3a2a', color: '#4DC8A0' },
    'INACTIVE': { bg: '#3a1a1a', color: '#C85050' },
    'LAPSED':   { bg: '#3a3010', color: '#D4A843' }
  };
  const c = colours[status] || { bg: '#2a2a2a', color: '#666' };
  return `<span style="font-size:0.7em;padding:2px 8px;border-radius:3px;
background:${c.bg};color:${c.color};margin-left:6px;font-weight:600;">
● ${status}</span>`;
}

async function showEntityDetail(entityId, breadcrumbLabel) {
  breadcrumbLabel = breadcrumbLabel || 'Galaxy';
  const main = document.getElementById('entities-panel') ?? document.body;

  _previousView = main.innerHTML;
  main.innerHTML = '<div class="entity-detail-loading" style="padding:40px;text-align:center;color:var(--dim);font-size:13px">Loading entity…</div>';

  let entity, redirect = null;
  try {
    const res = await fetch(`${ENTITIES_API_URL}/api/entities/${entityId}`);
    if (res.status === 404) {
      main.innerHTML = _detailError('This entity is no longer in Meridian Atlas. It may have been merged into another record.', breadcrumbLabel, 'restoreEntityPreviousView()');
      return;
    }
    if (res.status === 409) {
      const body = await res.json().catch(() => ({}));
      console.warn('[ma-entities] merge history unresolved', body.state, body.chain);
      main.innerHTML = _detailError("This record's merge history couldn't be resolved.", breadcrumbLabel, 'restoreEntityPreviousView()');
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    entity = data.entity ?? data;
    // MA-OCT-007 R3: a merged id lands on its survivor; sub-routes use the resolved id.
    redirect = data.redirect || null;
    if (entity && entity.entity_id) entityId = entity.entity_id;
  } catch (e) {
    console.error('[ma-entities] showEntityDetail fetch error', e);
    // BR-1 (§5.3): any failure here is an outage (5xx or network), shown with Retry.
    main.innerHTML = _detailError("Couldn't reach Corporate Atlas.", breadcrumbLabel, 'restoreEntityPreviousView()')
      .replace('</button>', `</button> <button onclick="restoreEntityPreviousView();showEntityDetail(${Number(entityId)}, ${_esc(JSON.stringify(breadcrumbLabel))})" style="background:none;border:1px solid var(--border);color:var(--blue);font-size:11px;padding:5px 14px;border-radius:var(--r);cursor:pointer">↻ Retry</button>`);
    return;
  }

  // MA-SEP-004: /graph is the only endpoint that resolves parent/child
  // relationships to entity_ids (entity.direct_parent_lei/ultimate_parent_lei
  // are name/LEI text only — no entity_id on entity_master itself). Fetched
  // separately from the entity itself, non-fatally: a /graph hiccup should
  // degrade to plain-text ownership rows and no Children section, not break
  // the page (same resilience posture as the exposure/instruments/issuer
  // strips below, which already load independently).
  let parents = [], children = [];
  try {
    const graphRes = await fetch(`${ENTITIES_API_URL}/api/entities/${entityId}/graph`);
    if (graphRes.ok) {
      const graphData = await graphRes.json();
      parents = graphData.parents ?? [];
      children = graphData.children ?? [];
    }
  } catch (e) {
    console.error('[ma-entities] showEntityDetail /graph fetch error (non-fatal)', e);
  }

  main.innerHTML = _buildEntityDetailHTML(entity, breadcrumbLabel, 'restoreEntityPreviousView()', parents, children);
  if (redirect) _navInsertAfterBreadcrumb(main, _navRedirectNoticeHtml(redirect, entity));
  _loadEntityExposureStrip(entityId, entity);
  _loadLinkedInstruments(entityId);
  _loadIssuerBonds(entityId);

  // Load Issuer page panels (13F ownership / financials / events / filings).
  // Previously only wired into showEntityOverlay (the ETF-holdings click
  // path) — Galaxy/Search entry points shared the same template placeholder
  // but never called this, so the panels silently never populated for them.
  ent_injectIssuerPanels(entityId);
}

// `root` (MA-OCT-007): the overlay layer to search, so two stacked layers for the
// same entity never pick up each other's sections. Defaults to the document.
async function _loadEntityExposureStrip(entityId, entity, root) {
  const section = _navFind(root, `etf-exposure-section-${entityId}`);
  if (!section) return;

  let exposureData = [];
  try {
    const res = await fetch(`${ENTITIES_API_URL}/api/entities/${entityId}/etf-exposure`);
    if (res.ok) {
      const data = await res.json();
      exposureData = data.exposures ?? data.results ?? data ?? [];
    }
  } catch (e) {
    console.error('[ma-entities] etf-exposure fetch error', e);
  }

  if (!exposureData.length) {
    section.innerHTML = `
      <div style="font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--dim);margin-bottom:8px">ETF Exposure</div>
      <div style="color:var(--dim);font-size:11px">No ETF exposure data available</div>
      <div style="margin-top:8px;font-size:10px;color:var(--muted)">⚠ N-PORT filings carry a 60-day reporting lag</div>
    `;
    return;
  }

  const total = exposureData.length;
  const top5 = exposureData.slice(0, 5);
  const maxWeight = Math.max(...top5.map(r => r.weight_sum ?? 0), 0.0001);

  const rows = top5.map(r => {
    const barWidth = Math.round(((r.weight_sum ?? 0) / maxWeight) * 140);
    const monthLabel = r.report_month ? r.report_month.replace(/^(\d{4})-(\d{2}).*$/, (_, y, m) => {
      const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${mon[parseInt(m, 10) - 1]} ${y}`;
    }) : '';
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:4px 0;border-bottom:1px solid var(--border)">
        <span style="font-family:var(--mono);font-size:10px;font-weight:700;color:var(--text);width:40px;flex-shrink:0">${_esc(r.etf_ticker ?? r.ticker ?? '—')}</span>
        <span style="font-size:10px;color:var(--text2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(r.etf_name ?? r.name ?? '—')}</span>
        <span style="display:inline-block;height:8px;background:var(--blue);border-radius:2px;width:${barWidth}px;flex-shrink:0;opacity:.7"></span>
        <span style="font-size:10px;font-weight:700;color:var(--text);width:42px;text-align:right;flex-shrink:0">${(r.weight_sum ?? 0).toFixed(2)}%</span>
        <span style="font-size:9px;color:var(--dim);width:52px;flex-shrink:0">${monthLabel}</span>
      </div>`;
  }).join('');

  const showAllBtn = total > 5
    ? `<button onclick="_showAllEtfExposure(${entityId}, this)" style="margin-top:10px;background:none;border:1px solid var(--border);color:var(--blue);font-size:10px;padding:4px 10px;border-radius:var(--r);cursor:pointer">Show all ${total} ETFs ↓</button>`
    : '';

  section.innerHTML = `
    <div style="font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--dim);margin-bottom:6px">
      ETF Exposure · <span style="font-weight:400;text-transform:none;letter-spacing:0">${total} ETF${total !== 1 ? 's' : ''} in your universe hold this entity</span>
    </div>
    <div style="border-top:1px solid var(--border);padding-top:8px">${rows}</div>
    ${showAllBtn}
    <div style="margin-top:10px;font-size:10px;color:var(--muted)">⚠ N-PORT filings carry a 60-day reporting lag</div>
  `;

  // Stash full list for "Show all" expansion
  section._allExposures = exposureData;
}

function _showAllEtfExposure(entityId, btn) {
  const section = (btn && btn.closest(`#etf-exposure-section-${entityId}`)) || document.getElementById(`etf-exposure-section-${entityId}`);
  if (!section || !section._allExposures) return;

  const exposureData = section._allExposures;
  const maxWeight = Math.max(...exposureData.map(r => r.weight_sum ?? 0), 0.0001);

  const rows = exposureData.map(r => {
    const barWidth = Math.round(((r.weight_sum ?? 0) / maxWeight) * 140);
    const monthLabel = r.report_month ? r.report_month.replace(/^(\d{4})-(\d{2}).*$/, (_, y, m) => {
      const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${mon[parseInt(m, 10) - 1]} ${y}`;
    }) : '';
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:4px 0;border-bottom:1px solid var(--border)">
        <span style="font-family:var(--mono);font-size:10px;font-weight:700;color:var(--text);width:40px;flex-shrink:0">${_esc(r.etf_ticker ?? r.ticker ?? '—')}</span>
        <span style="font-size:10px;color:var(--text2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(r.etf_name ?? r.name ?? '—')}</span>
        <span style="display:inline-block;height:8px;background:var(--blue);border-radius:2px;width:${barWidth}px;flex-shrink:0;opacity:.7"></span>
        <span style="font-size:10px;font-weight:700;color:var(--text);width:42px;text-align:right;flex-shrink:0">${(r.weight_sum ?? 0).toFixed(2)}%</span>
        <span style="font-size:9px;color:var(--dim);width:52px;flex-shrink:0">${monthLabel}</span>
      </div>`;
  }).join('');

  const header = section.querySelector('div:first-child');
  const headerHtml = header ? header.outerHTML : '';
  section.innerHTML = `
    ${headerHtml}
    <div style="border-top:1px solid var(--border);padding-top:8px">${rows}</div>
    <div style="margin-top:10px;font-size:10px;color:var(--muted)">⚠ N-PORT filings carry a 60-day reporting lag</div>
  `;
}

// Source badge for a mapping source (instrument_entity_map.source and the
// entity_isin_map / bond sources). Labels are the user-facing names of spec
// rev 1.4 §5.4 (AC7); the raw code is never shown.
const _NAV_SOURCE_LABELS = {
  openfigi_tier1: { label: 'OpenFIGI', color: '#4A9EFF' },
  cusip_tier1:    { label: 'CUSIP',    color: '#2D9C75' },
  isin_tier1:     { label: 'ISIN',     color: '#2D9C75' },
  heuristic:      { label: 'Name match (heuristic)', color: '#D99C3D' },
  isin_direct:    { label: 'GLEIF ISIN', color: '#2D9C75' },
  firds_direct:   { label: 'ESMA FIRDS', color: '#2D9C75' },
  sec_bond:       { label: 'SEC filing', color: '#2D9C75' }
};
function _navSourceLabel(source) {
  return (_NAV_SOURCE_LABELS[source] || { label: 'Other source' }).label;
}
function _instrumentSourceBadge(source) {
  const c = _NAV_SOURCE_LABELS[source] || { label: 'Other source', color: '#666' };
  return `<span style="border:1px solid ${c.color}40;background:${c.color}18;color:${c.color};border-radius:3px;padding:1px 6px;font-size:9px;font-weight:700;letter-spacing:.03em;flex-shrink:0">${_esc(c.label)}</span>`;
}

// Confidence band chip (§5.2): the raw number always sits next to the band.
function _navBandChip(band, confidence) {
  const col = band === 'high' ? '#2D9C75' : band === 'medium' ? '#4A9EFF' : '#D99C3D';
  const label = band === 'high' ? 'High' : band === 'medium' ? 'Medium' : 'Low';
  return `<span style="border:1px solid ${col}40;color:${col};border-radius:3px;padding:1px 6px;font-size:9px;font-weight:700;flex-shrink:0;white-space:nowrap">${label} · ${_esc(confidence ?? '—')}</span>`;
}

// One R2 row (a NavLink-shaped mapping row). Clicking opens its Instrument card,
// with from = entity:{id}:{page} so the issuer page and its loaded pages survive.
function _instrumentRowHtml(r, entityId, page, showAssetBadge) {
  // Distinguishing identifier — this is the whole point of the row.
  // Same-name entries (e.g. dozens of Microsoft bond issuances) are only
  // ever told apart by their actual ISIN/CUSIP value, not by name or source.
  const ids = _navDisplayIds(r.identifiers);
  const identifier = ids.isin
    ? `ISIN ${_esc(ids.isin)}`
    : (ids.cusip ? `CUSIP ${_esc(ids.cusip)}` : 'No identifier on file');
  const c = (r.candidates && r.candidates[0]) || {};
  const assetTag = (showAssetBadge && r.asset_type)
    ? `<span style="font-family:var(--mono);font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:.03em;flex-shrink:0;white-space:nowrap">${_esc(r.asset_type)}</span>`
    : '';
  return `
    <div class="nav-li-row" role="button" tabindex="0" data-key="${_esc(r.instrument_key)}" data-entity="${entityId}" data-page="${page}"
      onclick="_navOpenInstrumentFromRow(this)" onkeydown="if(event.key==='Enter')_navOpenInstrumentFromRow(this)"
      style="display:flex;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid var(--border);cursor:pointer">
      <div style="flex:1;min-width:0">
        <div style="font-size:10px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(r.name ?? '—')}${ids.ticker ? ` <span style="font-family:var(--mono);color:var(--dim)">(${_esc(ids.ticker)})</span>` : ''}</div>
        <div style="font-family:var(--mono);font-size:9px;color:var(--muted);margin-top:1px">${identifier}</div>
      </div>
      ${assetTag}
      ${_instrumentSourceBadge(c.source)}
      ${_navBandChip(c.confidence_band, c.confidence)}
    </div>`;
}

// R2 + R4 (spec §4.2, R7-4): pages of 25 via keyset; "Linked instruments · N"
// (exact up to 1,000, else "1,000+"). Single-page issuers are sorted by asset type
// then name with group headers; multi-page issuers stay in key order with an
// asset-type badge on every row and a "Sorted by identifier" label.
async function _loadLinkedInstruments(entityId, root) {
  const section = _navFind(root, `linked-instruments-section-${entityId}`);
  if (!section) return;
  section._nav = { entityId, rows: [], cursor: '', total: null, capped: false, pages: 0, multi: false, error: false };
  await _linkedLoadPage(section);
}

async function _linkedLoadPage(section) {
  const st = section._nav;
  st.error = false;
  const btn = section.querySelector('.nav-li-more');
  if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }
  const q = `?limit=25${st.cursor ? `&cursor=${encodeURIComponent(st.cursor)}` : ''}`;
  const r = await data_entitiesGet(`/api/entities/${st.entityId}/instruments${q}`);
  if (!section.isConnected) return;
  if (!r.ok || !r.data || !Array.isArray(r.data.instruments)) {
    st.error = _navIsOutage(r) ? 'outage' : 'unavailable';
    console.error('[ma-entities] instruments page fetch error', r.status, r.type || '');
    _linkedRender(section);
    return;
  }
  const d = r.data;
  if (st.pages === 0) { st.total = d.total; st.capped = !!d.total_capped; st.multi = d.next_cursor !== null; }
  d.instruments.forEach(x => st.rows.push({ ...x, _page: st.pages + 1 }));
  st.cursor = d.next_cursor;
  st.pages++;
  _linkedRender(section);
}

function _linkedRender(section) {
  const st = section._nav;
  const title = `<div style="font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--dim);margin-bottom:6px">Linked instruments${st.pages ? ` · <span style="font-weight:400;text-transform:none;letter-spacing:0">${st.capped ? '1,000+' : Number(st.total ?? st.rows.length).toLocaleString()}</span>` : ''}</div>`;
  if (st.pages === 0) {
    section.innerHTML = `${title}<div style="color:var(--dim);font-size:11px">${st.error
      ? `${st.error === 'outage' ? "Couldn't reach Corporate Atlas." : 'Linked instruments unavailable.'} <button onclick="_linkedLoadPage(this.closest('[id^=linked-instruments-section-]'))" style="background:none;border:1px solid var(--border);color:var(--blue);font-size:10px;padding:2px 8px;border-radius:var(--r);cursor:pointer">Retry</button>`
      : 'Loading linked instruments…'}</div>`;
    return;
  }
  if (!st.rows.length) {
    section.innerHTML = `${title}<div style="color:var(--dim);font-size:11px">No linked instruments in Meridian Atlas</div>`;
    return;
  }
  let body;
  if (!st.multi) {
    const sorted = [...st.rows].sort((a, b) =>
      String(a.asset_type ?? '').localeCompare(String(b.asset_type ?? '')) || String(a.name ?? '').localeCompare(String(b.name ?? '')));
    let group = null;
    body = sorted.map(r => {
      const head = (r.asset_type ?? '') !== group
        ? `<div style="font-size:9px;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:.05em;padding:8px 0 2px">${_esc(r.asset_type || 'Other')}</div>`
        : '';
      group = r.asset_type ?? '';
      return head + _instrumentRowHtml(r, st.entityId, r._page, false);
    }).join('');
  } else {
    body = `<div style="font-size:9px;color:var(--muted);margin-bottom:4px">Sorted by identifier</div>` +
      st.rows.map(r => _instrumentRowHtml(r, st.entityId, r._page, true)).join('');
  }
  const more = st.cursor
    ? `<button class="nav-li-more" onclick="_linkedLoadPage(this.closest('[id^=linked-instruments-section-]'))" style="margin-top:10px;background:none;border:1px solid var(--border);color:var(--blue);font-size:10px;padding:4px 10px;border-radius:var(--r);cursor:pointer">${st.error ? "Couldn't load more · Retry" : 'Show 25 more ↓'}</button>`
    : '';
  section.innerHTML = `${title}<div style="border-top:1px solid var(--border);padding-top:4px">${body}</div>${more}`;
}

function _detailError(message, backLabel, backHandler) {
  backLabel   = backLabel   || 'Galaxy';
  backHandler = backHandler || 'restoreEntityPreviousView()';
  return `
    <div style="padding:40px;text-align:center">
      <div style="color:var(--text2);font-size:13px;margin-bottom:16px">${_esc(message)}</div>
      <button onclick="${backHandler}" style="background:none;border:1px solid var(--border);color:var(--blue);font-size:11px;padding:5px 14px;border-radius:var(--r);cursor:pointer">← Back to ${backLabel}</button>
    </div>`;
}

function restoreEntityPreviousView() {
  if (_navStack.length) { navBack(); return; }
  const panel = document.getElementById('entities-panel');
  if (!panel) {
    openCorporateAtlas();
    return;
  }
  if (_previousView) {
    panel.innerHTML = _previousView;
    _previousView = null;
    if (typeof _setupSearch === 'function') _setupSearch();
  } else {
    openCorporateAtlas();
  }
}

// ── Entity overlay — shown on top of ETF Holdings panel ──────────────────────
// MA-OCT-007: the overlay is now one layer of a history-backed stack (see the
// navigation section below). Existing callers (ma-etf.js, ma-13f.js, ownership
// click-throughs) keep this signature; each call opens a new layer and pushes one
// history entry, so in-app Back and browser Back both close exactly that layer.
async function showEntityOverlay(entityId, backLabel) {
  return _navOpen('entity', Number(entityId), { history: 'push', backLabel: backLabel || 'ETF Holdings' });
}

// Closes every navigation layer without touching the panel underneath (ma-etf.js
// calls this when the user switches ETF), and unwinds the history entries the
// layers pushed, so a later Back never resurrects them.
function closeEntityOverlay() {
  const depth = history.state && Number.isInteger(history.state.maNav) ? history.state.maNav : 0;
  while (_navStack.length) _navStack.pop().el.remove();
  if (depth > 0) history.go(-depth);
}

function closeEntityDetail() {
  // Path 1: called from a navigation layer (over ETF Holdings or any panel):
  // the × closes all layers — the panel underneath stays as it was.
  if (_navStack.length) {
    closeEntityOverlay();
    if (typeof _setupSearch === 'function') _setupSearch();
    return;
  }

  // Path 2: called from Corporate Atlas entity detail page (X button)
  // Clear saved state and close Corporate Atlas entirely
  _previousView = null;
  if (typeof closeEntities === 'function') closeEntities();
}

// ── Issuer page panels: 13F ownership / financials / 8-K events / filings ────
// Wired into showEntityOverlay only (not showEntityDetail) for this iteration
// — pending UX review before extending to the Corporate Atlas galaxy path.

function _issuerPanelSection(title, innerHtml) {
  return `
    <div style="margin:0 16px 16px;padding:14px 16px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r)">
      <div style="font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--dim);margin-bottom:10px">${_esc(title)}</div>
      ${innerHtml}
    </div>`;
}

function _issuerPanelEmpty(message) {
  return `<div style="color:var(--dim);font-size:11px">${_esc(message)}</div>`;
}

// unit is always one of 'USD' | 'USD/shares' | 'shares' in issuerperiodsummary
function _fmtFinancialValue(value, unit) {
  if (value == null) return '—';
  if (unit === 'USD/shares') return '$' + value.toFixed(2);
  if (unit === 'shares') {
    const abs = Math.abs(value);
    if (abs >= 1e9) return (value / 1e9).toFixed(2) + 'B sh';
    if (abs >= 1e6) return (value / 1e6).toFixed(2) + 'M sh';
    return value.toLocaleString();
  }
  const abs = Math.abs(value);
  if (abs >= 1e9) return '$' + (value / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return '$' + (value / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return '$' + (value / 1e3).toFixed(2) + 'K';
  return '$' + value.toFixed(2);
}

function _issuerDocUrl(cik, accessionNumber, primaryDocument) {
  const cikNum = parseInt(cik, 10);
  const accNoDash = String(accessionNumber || '').replace(/-/g, '');
  if (!cikNum || !accNoDash || !primaryDocument) return null;
  return `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accNoDash}/${primaryDocument}`;
}

// No primary_document on hand (e.g. issuereventstream rows) — link straight to
// SEC's own filing index page. This must NOT go through the meridian-filings
// proxy: that proxy fetches a single document body, and pointed at a bare
// accession folder it returns SEC's raw directory listing instead of a filing.
function _issuerFilingIndexUrl(cik, accessionNumber) {
  const cikNum = parseInt(cik, 10);
  const accNoDash = String(accessionNumber || '').replace(/-/g, '');
  if (!cikNum || !accNoDash) return null;
  const accWithDash = accNoDash.length === 18
    ? `${accNoDash.slice(0, 10)}-${accNoDash.slice(10, 12)}-${accNoDash.slice(12)}`
    : accNoDash;
  return `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accNoDash}/${accWithDash}-index.htm`;
}

async function ent_loadIssuerPanels(entityId) {
  if (!ENTITIES_API_URL || !entityId) return null;
  try {
    const res = await fetch(`${ENTITIES_API_URL}/api/entities/${entityId}/issuer-panels`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error('[ma-entities] issuer-panels fetch error', e);
    return null;
  }
}

function ent_renderOwnership(data) {
  const rows = data?.ownership ?? [];
  if (!rows.length) {
    return _issuerPanelSection('13F Ownership', _issuerPanelEmpty('No 13F institutional holders found for this issuer'));
  }

  const reportLabel = rows[0].report_period ? _esc(rows[0].report_period) : '';
  const body = rows.map(r => {
    const change = r.value_change;
    const changeColor = change > 0 ? 'var(--green)' : change < 0 ? 'var(--red)' : 'var(--dim)';
    const changeLabel = change != null
      ? `${change > 0 ? '+' : ''}${_fmtFinancialValue(change, 'USD')}`
      : '—';
    const trackLabel = r.track ? _esc(r.track) : '';
    // Same clickable-row pattern as mgr_renderHoldingsSection in ma-13f.js
    const clickable = r.cik != null;
    const trOpen = clickable
      ? `<tr style="border-bottom:1px solid var(--border);cursor:pointer" onclick="mgr_openManagerPage('${_esc(r.cik)}')">`
      : `<tr style="border-bottom:1px solid var(--border)">`;
    const managerCell = clickable
      ? `<span style="color:var(--blue)">${_esc(r.manager_name ?? r.cik ?? '—')}</span>`
      : _esc(r.manager_name ?? r.cik ?? '—');
    return `
      ${trOpen}
        <td style="padding:5px 8px;font-family:var(--mono);font-size:10px;color:var(--text2)">${managerCell}</td>
        <td style="padding:5px 8px;font-size:11px;color:var(--text)">${_esc(r.issuer_name ?? '—')}</td>
        <td style="padding:5px 8px;font-family:var(--mono);font-size:11px;font-weight:600;color:var(--text);text-align:right">${_fmtFinancialValue(r.market_value, 'USD')}</td>
        <td style="padding:5px 8px;font-family:var(--mono);font-size:10px;color:${changeColor};text-align:right">${changeLabel}</td>
        <td style="padding:5px 8px;text-align:right">${trackLabel ? `<span class="ent-chip" style="color:var(--text2);border-color:var(--border2);background:var(--bg4)">${trackLabel}</span>` : ''}</td>
      </tr>`;
  }).join('');

  const freshnessLine = reportLabel
    ? `<div style="font-size:9px;color:var(--muted);margin-bottom:8px">Holdings as of ${reportLabel}, sourced from SEC 13F filings</div>`
    : '';

  const inner = `
    ${freshnessLine}
    <table style="border-collapse:collapse;width:100%">
      <thead>
        <tr style="border-bottom:1px solid var(--border)">
          <th style="padding:4px 8px;text-align:left;font-size:9px;color:var(--dim);text-transform:uppercase">Manager</th>
          <th style="padding:4px 8px;text-align:left;font-size:9px;color:var(--dim);text-transform:uppercase">Issuer</th>
          <th style="padding:4px 8px;text-align:right;font-size:9px;color:var(--dim);text-transform:uppercase">Market Value</th>
          <th style="padding:4px 8px;text-align:right;font-size:9px;color:var(--dim);text-transform:uppercase">QoQ Change</th>
          <th style="padding:4px 8px;text-align:right;font-size:9px;color:var(--dim);text-transform:uppercase">Track</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`;

  return _issuerPanelSection('13F Ownership', inner);
}

// Scoped to ent_renderFinancials only — ent_renderOwnership keeps using
// _fmtFinancialValue, which formats sub-million USD differently (K-scaled).
// unit accepts 'USD' | 'USD/shares' | 'shares' | 'net_margin'.
function formatValue(value, unit) {
  if (value == null) return '—';
  // net_margin is stored as a decimal fraction (0.05 == 5%), confirmed against live data
  if (unit === 'net_margin') return (value * 100).toFixed(1) + '%';
  if (unit === 'USD/shares') return '$' + value.toFixed(2);
  if (unit === 'shares') {
    const abs = Math.abs(value);
    if (abs >= 1e6) return (value / 1e6).toFixed(2) + 'M shares';
    return value.toLocaleString() + ' shares';
  }
  // USD (default)
  const abs = Math.abs(value);
  if (abs >= 1e9) return '$' + (value / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return '$' + (value / 1e6).toFixed(2) + 'M';
  return '$' + value.toLocaleString();
}

function ent_renderFinancials(data) {
  const rows = data?.financials ?? [];
  if (!rows.length) {
    return _issuerPanelSection('Financials', _issuerPanelEmpty('Financial data not yet available for this issuer'));
  }

  // Pivot: one row per xbrl_tag with an annual and a quarterly column
  // (issuerperiodsummary retains exactly one row per (cik, xbrl_tag, period_type))
  const byTag = new Map();
  rows.forEach(r => {
    if (!byTag.has(r.xbrl_tag)) byTag.set(r.xbrl_tag, {});
    byTag.get(r.xbrl_tag)[r.period_type] = r;
  });

  const body = Array.from(byTag.entries()).map(([tag, periods]) => {
    const annual = periods.annual;
    const quarterly = periods.quarterly;
    const unit = (annual ?? quarterly)?.unit;
    const annualVal = formatValue(annual?.value, unit);
    const quarterlyVal = formatValue(quarterly?.value, unit);
    const marginRaw = annual?.net_margin ?? quarterly?.net_margin ?? null;
    const margin = marginRaw != null ? formatValue(marginRaw, 'net_margin') : null;
    return `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:5px 8px;font-size:11px;color:var(--text2)">${_esc(tag)}${margin ? `<div style="font-size:9px;color:var(--dim)">Net margin: ${margin}</div>` : ''}</td>
        <td style="padding:5px 8px;font-family:var(--mono);font-size:11px;font-weight:600;color:var(--text);text-align:right">${annualVal}${annual?.period_end ? `<div style="font-size:9px;color:var(--dim);font-weight:400">${_esc(annual.period_end)}</div>` : ''}</td>
        <td style="padding:5px 8px;font-family:var(--mono);font-size:11px;font-weight:600;color:var(--text);text-align:right">${quarterlyVal}${quarterly?.period_end ? `<div style="font-size:9px;color:var(--dim);font-weight:400">${_esc(quarterly.period_end)}</div>` : ''}</td>
      </tr>`;
  }).join('');

  const latestPeriodEnd = rows.reduce((max, r) => (r.period_end && (!max || r.period_end > max)) ? r.period_end : max, null);
  const freshnessLine = latestPeriodEnd
    ? `<div style="font-size:9px;color:var(--muted);margin-bottom:8px">Financials as of ${_esc(latestPeriodEnd)}, sourced from SEC XBRL</div>`
    : '';

  const inner = `
    ${freshnessLine}
    <table style="border-collapse:collapse;width:100%">
      <thead>
        <tr style="border-bottom:1px solid var(--border)">
          <th style="padding:4px 8px;text-align:left;font-size:9px;color:var(--dim);text-transform:uppercase">Metric</th>
          <th style="padding:4px 8px;text-align:right;font-size:9px;color:var(--dim);text-transform:uppercase">Annual</th>
          <th style="padding:4px 8px;text-align:right;font-size:9px;color:var(--dim);text-transform:uppercase">Quarterly</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`;

  return _issuerPanelSection('Financials', inner);
}

function ent_renderEvents(data) {
  const rows = data?.events ?? [];
  const cutoff = Date.now() - 365 * 86400000;
  const hasRecent = rows.some(r => r.filed_date && new Date(r.filed_date).getTime() >= cutoff);

  if (!rows.length || !hasRecent) {
    return _issuerPanelSection('8-K Events', _issuerPanelEmpty('No material 8-K events in the last 12 months'));
  }

  const body = rows.map(r => {
    // issuereventstream has no primary_document, so we can't link to the
    // specific filing document — link to this issuer's 8-K filing list instead.
    const url = r.cik
      ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(r.cik)}&type=8-K&dateb=&owner=include&count=10`
      : null;
    return `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">
        <span style="font-family:var(--mono);font-size:9px;color:var(--dim);min-width:66px;flex-shrink:0;margin-top:1px">${_esc(r.filed_date ?? '—')}</span>
        <span class="ent-chip" style="color:var(--blue);border-color:var(--blue-bd,var(--border2));background:var(--blue-bg,var(--bg4));flex-shrink:0">${_esc(r.item_code ?? '—')}</span>
        <span style="font-size:11px;color:var(--text2);flex:1">${_esc(r.item_label ?? '—')}</span>
        ${url ? `<a href="${_esc(url)}" target="_blank" rel="noopener" style="font-size:10px;color:var(--blue);flex-shrink:0">View filings →</a>` : ''}
      </div>`;
  }).join('');

  const freshnessLine = `<div style="font-size:9px;color:var(--muted);margin-bottom:8px">Events from the last 12 months, sourced from SEC 8-K filings</div>`;

  return _issuerPanelSection('8-K Events', freshnessLine + body);
}

function ent_renderFilings(data) {
  const rows = data?.filings ?? [];
  if (!rows.length) {
    return _issuerPanelSection('Filing Timeline', _issuerPanelEmpty('No SEC filings found for this issuer'));
  }

  const body = rows.map(r => {
    const directUrl = _issuerDocUrl(r.cik, r.accession_number, r.primary_document);
    const linkUrl = directUrl
      ? `${WORKER_FILINGS_URL}/api/filing-doc?url=${encodeURIComponent(directUrl)}`
      : _issuerFilingIndexUrl(r.cik, r.accession_number);
    return `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:6px 0;border-bottom:1px solid var(--border)">
        <span class="ent-chip" style="color:var(--text2);border-color:var(--border2);background:var(--bg4);flex-shrink:0">${_esc(r.form_type ?? '—')}</span>
        <span style="font-family:var(--mono);font-size:9px;color:var(--dim);min-width:66px;flex-shrink:0;margin-top:1px">${_esc(r.filed_date ?? '—')}</span>
        <span style="font-size:10px;color:var(--muted);flex:1">${r.period_of_report ? `Period: ${_esc(r.period_of_report)}` : ''}</span>
        ${linkUrl ? `<a href="${_esc(linkUrl)}" target="_blank" rel="noopener" style="font-size:10px;color:var(--blue);flex-shrink:0">View document →</a>` : ''}
      </div>`;
  }).join('');

  const freshnessLine = `<div style="font-size:9px;color:var(--muted);margin-bottom:8px">Filing history sourced from SEC EDGAR</div>`;

  return _issuerPanelSection('Filing Timeline', freshnessLine + body);
}

function _fmtReportMonth(reportMonth) {
  if (!reportMonth) return null;
  const m = reportMonth.match(/^(\d{4})-(\d{2})/);
  if (!m) return reportMonth;
  const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${mon[parseInt(m[2], 10) - 1]} ${m[1]}`;
}

// NOTE: manager_count here is issuer-wide (total distinct 13F filers holding
// this issuer at the latest report_period) — not a true per-ETF intersection.
// There's no data linking specific managers to specific ETF share holdings,
// so the same figure appears on every ETF row (see entities-api.js comment).
function ent_renderOverlap(data) {
  const overlap = data?.overlap ?? {};
  const etfs = overlap.etfs ?? [];
  const etfCount = overlap.etf_count ?? 0;
  const managerCount = overlap.manager_count ?? 0;

  if (!etfCount && !managerCount) {
    return _issuerPanelSection('ETF & 13F Overlap', _issuerPanelEmpty('No ETF or institutional overlap data available for this issuer'));
  }

  const monthLabel = _fmtReportMonth(overlap.latest_report_month);
  const periodLabel = overlap.latest_report_period ? _esc(overlap.latest_report_period) : null;
  const freshness = (monthLabel || periodLabel)
    ? `<div style="font-size:9px;color:var(--muted);margin-bottom:8px">${monthLabel ? `ETF data as of ${_esc(monthLabel)}` : ''}${monthLabel && periodLabel ? ', ' : ''}${periodLabel ? `13F data as of ${periodLabel}` : ''}</div>`
    : '';

  const rows = etfs.map(r => `
    <tr style="border-bottom:1px solid var(--border)">
      <td style="padding:5px 8px;font-family:var(--mono);font-size:10px;font-weight:700;color:var(--blue)">${_esc(r.ticker ?? '—')}</td>
      <td style="padding:5px 8px;font-size:11px;color:var(--text2)">${_esc(r.fund_name ?? '—')}</td>
      <td style="padding:5px 8px;font-family:var(--mono);font-size:11px;font-weight:600;color:var(--text);text-align:right">${r.weight_pct != null ? r.weight_pct.toFixed(2) + '%' : '—'}</td>
      <td style="padding:5px 8px;font-family:var(--mono);font-size:11px;color:var(--text);text-align:right">${r.manager_count ?? 0}</td>
    </tr>`).join('');

  const inner = `
    ${freshness}
    <div style="font-size:11px;color:var(--text);margin-bottom:8px">Held by <strong>${etfCount}</strong> ETF${etfCount !== 1 ? 's' : ''} and <strong>${managerCount}</strong> institutional manager${managerCount !== 1 ? 's' : ''}</div>
    ${etfs.length ? `
    <table style="border-collapse:collapse;width:100%">
      <thead>
        <tr style="border-bottom:1px solid var(--border)">
          <th style="padding:4px 8px;text-align:left;font-size:9px;color:var(--dim);text-transform:uppercase">ETF</th>
          <th style="padding:4px 8px;text-align:left;font-size:9px;color:var(--dim);text-transform:uppercase">Fund</th>
          <th style="padding:4px 8px;text-align:right;font-size:9px;color:var(--dim);text-transform:uppercase">Weight</th>
          <th style="padding:4px 8px;text-align:right;font-size:9px;color:var(--dim);text-transform:uppercase">13F Managers</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>` : `<div style="color:var(--dim);font-size:11px">No ETF exposure data available</div>`}`;

  return _issuerPanelSection('ETF & 13F Overlap', inner);
}

async function ent_injectIssuerPanels(entityId, root) {
  if (!entityId) return; // backward-compatible: no entity_id, no panels, overlay renders as before
  const container = _navFind(root, `issuer-panels-section-${entityId}`);
  if (!container) return;

  container.innerHTML = `<div style="padding:14px 16px;color:var(--dim);font-size:11px">Loading issuer data...</div>`;

  const data = await ent_loadIssuerPanels(entityId);
  if (!data) {
    container.innerHTML = `<div style="padding:14px 16px;color:var(--dim);font-size:11px">Unable to load issuer data — please try again.</div>`;
    return;
  }

  container.innerHTML = [
    ent_renderOwnership(data),
    ent_renderFinancials(data),
    ent_renderEvents(data),
    ent_renderFilings(data),
    ent_renderOverlap(data)
  ].join('');
}

// ── MA-OCT-007 Phase 1: navigation layers, Instrument card, states ───────────
// Spec rev 1.4 §3.3–§6. Every overlay layer is one history entry (state
// { maNav: depth }; the base panel is depth 0). The router in index.html only
// parses the hash and dispatches `ma:route`; this module owns the layers.
// Back = history.back() always, so the in-app and browser Back never diverge.
// A popstate closes layers down to its depth and never re-renders the base panel.
// Reads go through data_entitiesGet (ma-data.js); nothing here writes (D4).

const _navStack = [];   // index 0 = depth 1: { el, kind, id, from, title }

function _navFind(root, id) {
  return root && root.querySelector ? root.querySelector(`#${CSS.escape(id)}`) : document.getElementById(id);
}

// BR-1 (§5.3): a network failure, timeout or any 5xx is an outage, never a
// mapping or link state — it always shows "Couldn't reach Corporate Atlas" + Retry.
function _navIsOutage(r) {
  return !r || r.status === 0 || r.status >= 500;
}

// BR-2: placeholder identifier values (N/A, NA, NONE, '-', all zeros) are not
// identifiers and are never displayed as one. Keys are unaffected (R1 guards them).
function _navRealId(v) {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  if (!t || /^(N\/?A|NONE|NULL|-+|—)$/i.test(t) || /^0+$/.test(t)) return null;
  return t;
}
function _navDisplayIds(ids) {
  ids = ids || {};
  return { isin: _navRealId(ids.isin), cusip: _navRealId(ids.cusip), ticker: _navRealId(ids.ticker) };
}

function _navHash(kind, id, from) {
  const base = kind === 'entity' ? `#/entity/${id}`
    : kind === 'fi' ? '#/fi'
    : kind === 'fi_cik' ? `#/fi/cik/${id}`
    : kind === 'bond' ? `#/bond/${id}`
    : kind === 'exposure' ? exp_hashFor(id)   // MA-NOV-EXP.W3: inputs live in the hash only
    : `#/instrument/${encodeURIComponent(id)}`;
  return from ? `${base}?from=${encodeURIComponent(from)}` : base;
}

// R7-10: the type ends at the FIRST ':'; etf/entity payloads split on the LAST ':'.
function _navParseFrom(from) {
  if (!from) return { type: 'direct' };
  const i = from.indexOf(':');
  if (i < 0) return { type: 'direct' };
  const type = from.slice(0, i), rest = from.slice(i + 1);
  if (type === 'etf' || type === 'entity') {
    const j = rest.lastIndexOf(':');
    return j < 0 ? { type: 'direct' } : { type, key: rest.slice(0, j), sub: rest.slice(j + 1) };
  }
  if (type === 'instrument' || type === 'bond') return { type, key: rest };
  if (type === 'exposure') return { type, key: rest };   // MA-NOV-EXP.W3: key = the serialised inputs
  return { type: 'direct' };
}

function navBack() {
  if (_navStack.length) history.back();
}

// opts: { history: 'push'|'replace'|'none', from, backLabel, navlink, isin, prefetched, lastName }
async function _navOpen(kind, id, opts = {}) {
  const el = document.createElement('div');
  el.className = 'entity-overlay ma-nav-layer';
  el.dataset.navKind = kind;
  el.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:var(--bg, #0f1117);overflow-y:auto;padding:0;';
  el.style.zIndex = typeof _nextAtlasOverlayZ === 'function' ? _nextAtlasOverlayZ() : 1600;
  const layer = { el, kind, id, from: opts.from || null, title: null,
    backLabel: opts.backLabel || (_navParseFrom(opts.from).type === 'etf' ? 'ETF Holdings' : 'Home') };
  _navStack.push(layer);
  el.dataset.navDepth = String(_navStack.length);
  document.body.appendChild(el);
  const hash = _navHash(kind, id, opts.from);
  if (opts.history === 'push') history.pushState({ maNav: _navStack.length }, '', hash);
  else if (opts.history === 'replace') history.replaceState({ maNav: _navStack.length }, '', hash);
  await _navRender(layer, opts);
  return layer;
}

// One renderer per layer kind (007: entity, instrument; MA-OCT-010: fi, fi_cik, bond).
function _navRender(layer, opts) {
  switch (layer.kind) {
    case 'entity': return _navRenderEntity(layer, opts);
    case 'fi': return _navRenderFiDirectory(layer, opts);
    case 'fi_cik': return _navRenderFiCik(layer, opts);
    case 'bond': return _navRenderBond(layer, opts);
    case 'exposure': return _navRenderExposure(layer, opts);   // MA-NOV-EXP.W3
    default: return _navRenderInstrument(layer, opts);
  }
}

function _navIsTop(layer) {
  return _navStack[_navStack.length - 1] === layer && layer.el.isConnected;
}

function _navShell(layer, inner) {
  return `
    <div style="display:flex;flex-direction:column;min-height:100%;background:var(--bg2)">
      <div class="entity-breadcrumb" style="position:relative;padding:8px 16px;border-bottom:1px solid var(--border);background:var(--bg3);flex-shrink:0">
        <button class="entity-overlay-back" onclick="navBack()" style="background:none;border:none;color:var(--blue);font-size:11px;cursor:pointer;padding:2px 0">← Back to ${_esc(_navBackLabel(layer))}</button>
        <button onclick="closeEntityDetail()" style="position:absolute;top:8px;right:16px;background:none;border:none;color:#888;font-size:1.2em;cursor:pointer;line-height:1" title="Close">×</button>
      </div>
      <div style="padding:16px">${inner}</div>
    </div>`;
}

function _navInsertAfterBreadcrumb(root, html) {
  const bc = root.querySelector('.entity-breadcrumb');
  if (bc && html) bc.insertAdjacentHTML('afterend', html);
}

function _navFmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? String(iso).slice(0, 10) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// §6.4 notice. A chain of more than one hop names the intermediate ids.
function _navRedirectNoticeHtml(redirect, entity) {
  if (!redirect) return '';
  const via = (redirect.chain || []).slice(1, -1);
  const viaTxt = via.length ? ` (via ${via.map(v => `#${_esc(v)}`).join(', ')})` : '';
  const when = redirect.merged_at ? ` on ${_esc(_navFmtDate(redirect.merged_at))}` : '';
  const pkt = redirect.packet ? ` (${_esc(redirect.packet)})` : '';
  return `<div role="note" style="margin:16px 16px 0;padding:10px 14px;border:1px solid #D99C3D60;background:#D99C3D14;border-radius:var(--r);font-size:11px;color:var(--text2)">
    <strong>Merged record.</strong> Entity #${_esc(redirect.requested_id)} was merged${viaTxt} into <strong>${_esc(entity.legal_name ?? entity.name ?? '')} (#${_esc(redirect.resolved_id)})</strong>${when}${pkt}. You are viewing the surviving record.</div>`;
}

// §4.1 step 3: "Reached from NAME · ISIN … · OpenFIGI · confidence 70 (medium) · View instrument".
function _navProvenanceHtml(nl) {
  if (!nl) return '';
  const c = (nl.candidates || [])[0] || {};
  const ids = _navDisplayIds(nl.identifiers);
  const idTxt = ids.isin ? `ISIN ${_esc(ids.isin)}${nl.isin_source === 'holding' ? ' (ISIN from the ETF holding)' : ''}`
    : ids.cusip ? `CUSIP ${_esc(ids.cusip)}` : ids.ticker ? `Ticker ${_esc(ids.ticker)}` : _esc(nl.instrument_key);
  return `<div style="margin:16px 16px 0;padding:8px 14px;border:1px solid var(--border);background:var(--bg3);border-radius:var(--r);font-size:11px;color:var(--text2)">
    Reached from <strong>${_esc(nl.name || nl.instrument_key)}</strong> · ${idTxt} · ${_esc(_navSourceLabel(c.source))} · confidence ${_esc(c.confidence ?? '—')} (${_esc(c.confidence_band || '—')}) ·
    <a href="${_esc(_navHash('instrument', nl.instrument_key, null))}" onclick="event.preventDefault();_navOpen('instrument', ${_esc(JSON.stringify(nl.instrument_key))}, { history: 'push' })" style="color:var(--blue)">View instrument</a></div>`;
}

async function _navRenderEntity(layer, opts) {
  const el = layer.el;
  el.innerHTML = _navShell(layer, `<div style="color:var(--dim);font-size:12px;padding:16px">Loading entity…</div>`);
  const r = await data_entitiesGet(`/api/entities/${layer.id}`);
  if (!el.isConnected) return;
  if (_navIsOutage(r)) { _navRenderNetworkError(layer, opts); return; }
  if (r.status === 404 || r.status === 409) { _navRenderGone(layer, opts, r.data || {}); return; }
  if (!r.ok || !r.data || !r.data.entity) {
    el.innerHTML = _navShell(layer, `<div style="color:#888">Entity data unavailable.</div>`);
    return;
  }
  const entity = r.data.entity;
  const redirect = r.data.redirect || null;
  const eid = entity.entity_id;
  layer.title = entity.legal_name ?? entity.name ?? `#${eid}`;
  if (redirect) {
    // §6.4: canonical hash for the survivor; breadcrumbs that held the old id are rewritten.
    layer.id = eid;
    if (_navIsTop(layer) && history.state && history.state.maNav === _navStack.length) {
      history.replaceState(history.state, '', _navHash('entity', eid, layer.from));
    }
    _breadcrumb.forEach(b => { if (b.entity_id === redirect.requested_id) { b.entity_id = eid; b.name = layer.title; } });
  }

  let parents = [], children = [];
  const g = await data_entitiesGet(`/api/entities/${eid}/graph`);
  if (g.ok && g.data) { parents = g.data.parents ?? []; children = g.data.children ?? []; }
  else console.error('[ma-entities] layer /graph fetch error (non-fatal)', g.status);
  if (!el.isConnected) return;

  el.innerHTML = _buildEntityDetailHTML(entity, _esc(_navBackLabel(layer)), 'navBack()', parents, children);
  _navInsertAfterBreadcrumb(el, _navRedirectNoticeHtml(redirect, entity) + _navProvenanceHtml(opts.navlink));
  _loadEntityExposureStrip(eid, entity, el);
  _loadLinkedInstruments(eid, el);
  _loadIssuerBonds(eid, el);
  ent_injectIssuerPanels(eid, el);
}

// §6.5 fallback (gone, and merge history that couldn't be resolved): a search box
// prefilled with the last known name. No guessing of a survivor.
function _navRenderGone(layer, opts, body) {
  const unresolved = body.state === 'redirect_too_deep' || body.state === 'redirect_cycle';
  if (unresolved) console.warn('[ma-entities] merge history unresolved', body.state, body.chain);
  layer.title = 'Entity not found';
  const msg = unresolved
    ? "This record's merge history couldn't be resolved."
    : 'This entity is no longer in Meridian Atlas. It may have been merged into another record.';
  layer.el.innerHTML = _navShell(layer, `
    <div style="color:var(--text2);font-size:13px;margin-bottom:12px">${_esc(msg)}</div>
    <input class="nav-gone-search" type="search" aria-label="Search Corporate Atlas" placeholder="Search Corporate Atlas…" value="${_esc(opts.lastName || '')}"
      style="width:100%;max-width:420px;box-sizing:border-box;padding:7px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);color:var(--text);font-size:12px">
    <div class="nav-gone-results" style="margin-top:10px"></div>`);
  const input = layer.el.querySelector('.nav-gone-search');
  const out = layer.el.querySelector('.nav-gone-results');
  let t = null;
  const run = async () => {
    const q = input.value.trim();
    if (q.length < 2) { out.innerHTML = ''; return; }
    const s = await data_entitiesGet(`/api/entities/search?q=${encodeURIComponent(q)}`);
    if (!out.isConnected) return;
    const rows = (s.ok && s.data && s.data.results) || [];
    out.innerHTML = _navIsOutage(s) ? `<div style="color:var(--dim);font-size:11px">Couldn't reach Corporate Atlas.</div>`
      : rows.length ? rows.map(x => `<div class="ent-bc-item" style="display:block;padding:6px 0;border-bottom:1px solid var(--border);font-size:11px" onclick="_navOpen('entity', ${Number(x.entity_id)}, { history: 'push' })">
          <strong>${_esc(x.name)}</strong> <span style="color:var(--dim)">${_esc(x.country || '')}</span></div>`).join('')
      : `<div style="color:var(--dim);font-size:11px">No matches.</div>`;
  };
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 300); });
  if (input.value) run();
}

function _navRenderNetworkError(layer, opts) {
  layer.title = layer.title || 'Corporate Atlas';
  const depth = _navStack.indexOf(layer) + 1;
  layer.el.innerHTML = _navShell(layer, `
    <div style="color:var(--text2);font-size:13px;margin-bottom:12px">Couldn't reach Corporate Atlas.</div>
    <button onclick="_navRetry(${depth})" style="background:none;border:1px solid var(--border);color:var(--blue);font-size:11px;padding:5px 14px;border-radius:var(--r);cursor:pointer">↻ Retry</button>`);
  layer.retryOpts = opts;
}

function _navRetry(depth) {
  const layer = _navStack[depth - 1];
  if (!layer) return;
  const opts = { ...(layer.retryOpts || {}), prefetched: null };
  _navRender(layer, opts);
}

// ── Instrument card (§4.1, §5.3, §5.4) ──────────────────────────────────────

const _NAV_STATE_STYLE = {
  matched:        { label: 'Matched', color: '#4DC8C8', glyph: '' },
  low_confidence: { label: 'Low confidence', color: '#D99C3D', glyph: '' },
  ambiguous:      { label: 'Ambiguous', color: '#E07B39', glyph: '' },
  unmatched:      { label: 'No issuer', color: '#888888', glyph: '? ' }
};

function _navStateBadge(state) {
  const s = _NAV_STATE_STYLE[state] || _NAV_STATE_STYLE.unmatched;
  return `<span style="border:1px solid ${s.color}60;background:${s.color}18;color:${s.color};border-radius:3px;padding:2px 8px;font-size:10px;font-weight:700;letter-spacing:.04em">${s.glyph}${_esc(s.label)}</span>`;
}

// §5.4 one-line explanation; machine codes are never shown raw (AC7).
function _navExplain(nl) {
  const c = (nl.candidates || [])[0] || {};
  switch (nl.state) {
    case 'matched': return `Issuer linked by ${_navSourceLabel(c.source)}, score ${c.confidence}.`;
    case 'low_confidence': return c.source === 'heuristic'
      ? `Name-based match (heuristic), score ${c.confidence} — not verified by an identifier.`
      : `Linked by ${_navSourceLabel(c.source)} with a low score (${c.confidence}).`;
    // M9-3: "Choose one" only when there are at least 2 candidates to choose from (a key filed
    // under 2 CIKs is source_conflict with 0–1 candidates, MA-OCT-009 §4.3).
    case 'ambiguous': {
      const choose = (nl.candidates || []).length >= 2 ? ' Choose one.' : '';
      return nl.reason === 'source_conflict'
        ? `Our sources disagree about the issuer.${choose}`
        : `Several issuers share this ISIN.${choose}`;
    }
    default:
      if (nl.placeholder_key) return 'No unique identifier for this holding (for example cash or a derivative).';
      if (nl.reason === 'lei_only') return `The issuer's LEI (${nl.lei || '—'}) is known, but the issuer isn't in Meridian Atlas yet.`;
      if (nl.reason === 'not_in_universe') return "This instrument isn't in Meridian Atlas's instrument list yet.";
      if (nl.reason === 'redirect_unresolved') return "The linked issuer record was merged, and its merge history couldn't be resolved.";
      return 'No issuer linked — no mapping exists for this instrument yet.';
  }
}

function _navCandidateHtml(c, nl, showButton) {
  const merged = c.redirect ? `<span style="border:1px solid #D99C3D60;color:#D99C3D;border-radius:3px;padding:1px 6px;font-size:9px;font-weight:700">Merged</span>` : '';
  const btn = showButton
    ? `<button data-entity="${Number(c.entity_id)}" data-key="${_esc(nl.instrument_key)}" data-name="${_esc(c.name || '')}" onclick="_navOpenCandidate(this)"
        style="background:none;border:1px solid var(--border);color:var(--blue);font-size:10px;padding:4px 10px;border-radius:var(--r);cursor:pointer;white-space:nowrap">Open issuer →</button>`
    : '';
  return `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 0;border-bottom:1px solid var(--border)">
    <div style="flex:1;min-width:180px">
      <div style="font-size:12px;font-weight:600;color:var(--text)">${_esc(c.name || `#${c.entity_id}`)} ${merged}</div>
      <div style="font-family:var(--mono);font-size:9px;color:var(--muted);margin-top:2px">${c.lei ? `LEI ${_esc(c.lei)}` : 'No LEI on file'} · #${_esc(c.entity_id)}${c.as_of ? ` · as of ${_esc(String(c.as_of).slice(0, 10))}` : ''}</div>
    </div>
    ${_instrumentSourceBadge(c.source)}
    ${_navBandChip(c.confidence_band, c.confidence)}
    ${btn}
  </div>`;
}

function _navEmitState(nl) {
  const c = (nl.candidates || [])[0];
  document.dispatchEvent(new CustomEvent('ma:instrument-state', { detail: {
    instrument_key: nl.instrument_key, state: nl.state, confidence_band: nl.state === 'matched' || nl.state === 'low_confidence' ? (c && c.confidence_band) : null } }));
}

function _navInstrumentPath(key, isin) {
  const q = isin && !/^[A-Z0-9]{12}$/.test(key) ? `?isin=${encodeURIComponent(isin)}` : '';
  return `/api/instruments/${encodeURIComponent(key)}${q}`;
}

async function _navRenderInstrument(layer, opts) {
  const el = layer.el;
  layer.title = layer.title || String(layer.id);
  el.innerHTML = _navShell(layer, `<div style="color:var(--dim);font-size:12px;padding:16px">Loading instrument…</div>`);
  const r = opts.prefetched || await data_entitiesGet(_navInstrumentPath(layer.id, opts.isin));
  if (!el.isConnected) return;
  if (_navIsOutage(r)) {
    document.dispatchEvent(new CustomEvent('ma:instrument-state', { detail: { instrument_key: layer.id, state: null, error: 'network' } }));
    _navRenderNetworkError(layer, opts);
    return;
  }
  if (!r.ok || !r.data || !r.data.state) {
    el.innerHTML = _navShell(layer, `<div style="color:var(--text2);font-size:13px">That link isn't valid.</div>`);
    return;
  }
  const nl = r.data;
  layer.title = nl.name || nl.instrument_key;
  _navEmitState(nl);
  const ids = _navDisplayIds(nl.identifiers);
  const idRows = [
    ids.isin ? `<div><span style="color:var(--dim)">ISIN</span> <span style="font-family:var(--mono)">${_esc(ids.isin)}</span>${nl.isin_source === 'holding' ? ' <span style="color:var(--muted);font-size:10px">(ISIN from the ETF holding)</span>' : ''}</div>` : '',
    ids.cusip ? `<div><span style="color:var(--dim)">CUSIP</span> <span style="font-family:var(--mono)">${_esc(ids.cusip)}</span></div>` : '',
    ids.ticker ? `<div><span style="color:var(--dim)">Ticker</span> <strong>${_esc(ids.ticker)}</strong></div>` : '',
    nl.asset_type ? `<div><span style="color:var(--dim)">Asset type</span> ${_esc(nl.asset_type)}</div>` : '',
    `<div><span style="color:var(--dim)">Key</span> <span style="font-family:var(--mono);font-size:10px">${_esc(nl.instrument_key)}</span></div>`
  ].join('');
  const cands = nl.candidates || [];
  let body;
  if (nl.state === 'matched' || nl.state === 'low_confidence') body = _navCandidateHtml(cands[0], nl, true);
  else if (nl.state === 'ambiguous') {
    body = (cands.length >= 2 ? `<div style="font-size:10px;color:var(--dim);margin-bottom:4px">${cands.length} candidate issuers — none is selected for you</div>` : '') +
      cands.map(c => _navCandidateHtml(c, nl, true)).join('') +
      (nl.candidates_truncated ? `<div style="font-size:10px;color:var(--muted);padding-top:6px">More candidates exist than are shown.</div>` : '');
  } else body = '';
  const primary = cands[0];
  el.innerHTML = _navShell(layer, `
    <div style="padding:18px 20px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r)">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <h2 style="margin:0;font-size:16px;font-weight:700;color:var(--text);flex:1;min-width:200px">${_esc(nl.name || nl.instrument_key)}</h2>
        ${_navStateBadge(nl.state)}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:4px 20px;font-size:11px;color:var(--text2);line-height:1.8;margin-bottom:12px">${idRows}</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:6px">${_esc(_navExplain(nl))}</div>
      ${primary && nl.state !== 'ambiguous' ? `<div style="font-size:10px;color:var(--muted);margin-bottom:8px">Source: ${_esc(_navSourceLabel(primary.source))} · confidence ${_esc(primary.confidence)} (${_esc(primary.confidence_band)})${nl.as_of ? ` · as of ${_esc(String(nl.as_of).slice(0, 10))}` : ''}</div>` : ''}
      ${body}
    </div>`);
}

function _navOpenCandidate(btn) {
  _navOpen('entity', Number(btn.dataset.entity), { history: 'push', from: `instrument:${btn.dataset.key}`, lastName: btn.dataset.name || '' });
}

// "← Back to …" names the layer underneath (its title once loaded), else the origin.
function _navBackLabel(layer) {
  const i = _navStack.indexOf(layer);
  const prev = i > 0 ? _navStack[i - 1] : null;
  return prev ? (prev.title || 'previous page') : layer.backLabel;
}

// J2 → J1: a linked-instrument row opens its card, from = entity:{id}:{page}.
function _navOpenInstrumentFromRow(rowEl) {
  const key = rowEl.dataset.key;
  if (!key) return;
  _navOpen('instrument', key, { history: 'push', from: `entity:${rowEl.dataset.entity}:${rowEl.dataset.page}` });
}

// §3.4 ma:open-instrument (ETF holding rows in Phase 2; any surface). One click: a
// single matched candidate opens the issuer directly with the provenance strip;
// any other state (or an outage) opens the Instrument card.
document.addEventListener('ma:open-instrument', async e => {
  const d = e.detail || {};
  const key = d.instrument_key || (typeof data_instrumentKey === 'function' ? data_instrumentKey(d) : null);
  if (!key) return;
  const r = await data_entitiesGet(_navInstrumentPath(key, d.isin));
  const nl = r.ok ? r.data : null;
  if (nl && nl.state === 'matched' && (nl.candidates || []).length === 1) {
    _navEmitState(nl);
    _navOpen('entity', nl.candidates[0].entity_id, { history: 'push', from: d.from || null, navlink: nl, lastName: nl.candidates[0].name });
  } else {
    _navOpen('instrument', key, { history: 'push', from: d.from || null, isin: d.isin, prefetched: r });
  }
});

// ── MA-OCT-010: Fixed Income (spec 009/010 rev 1 §7) ─────────────────────────
// Bonds section on the issuer layer, and three 007 layers: bond detail (#/bond/{accession}/{seq}),
// the directory (#/fi) and an unlinked filer (#/fi/cik/{cik}). Reads only, via data_entitiesGet
// (009's /api/fi/* routes). The bond route names a filing-tranche record, never an instrument_key.
// With the serving gate closed every surface shows only the quality-check notice and the disclosure.

const _FI_DISCLOSURE = 'Issuance and reference data from SEC filings. Not live prices or yields.';
const _FI_CLOSED = "Bond data is being quality-checked and isn't shown yet.";
const _FI_MISSING = "Fixed Income data isn't available yet.";
const _FI_OUTAGE = "Couldn't reach Corporate Atlas.";
const _FI_CCY = { USD: '$', EUR: '€', GBP: '£', JPY: '¥' };

function _fiStyleOnce() {
  if (typeof document === 'undefined' || !document.head || document.getElementById('fi-style')) return;
  const st = document.createElement('style');
  st.id = 'fi-style';
  st.textContent = `.fi-row{display:grid;grid-template-columns:92px 1.4fr 1fr 1.2fr 1.2fr 1.4fr 84px 110px;gap:4px 10px;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:11px;color:var(--text2);cursor:pointer}
.fi-row:hover{background:var(--bg2)}.fi-head{cursor:default;font-size:9px;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:.05em}.fi-head:hover{background:none}
@media (max-width:640px){.fi-row{grid-template-columns:1fr 1fr}.fi-head{display:none}.fi-row>.fi-opt{display:none}}
.fi-ladder{display:flex;align-items:flex-end;gap:6px;overflow-x:auto;padding:4px 0 2px;max-width:100%}
.fi-bar{flex:0 0 auto;min-width:44px;text-align:center;font-size:9px;color:var(--muted)}`;
  document.head.appendChild(st);
}

function _fiDisclosureHtml() {
  return `<div role="note" style="font-size:10px;color:var(--muted);margin:6px 0">${_esc(_FI_DISCLOSURE)}</div>`;
}
function _fiNoticeHtml(msg) {
  return `<div style="color:var(--text2);font-size:12px;margin:6px 0">${_esc(msg)}</div>`;
}
function _fiRetryHtml(fn) {
  return `<div style="color:var(--text2);font-size:12px;margin:6px 0">${_esc(_FI_OUTAGE)} <button onclick="${fn}" style="background:none;border:1px solid var(--border);color:var(--blue);font-size:10px;padding:2px 8px;border-radius:var(--r);cursor:pointer">↻ Retry</button></div>`;
}

// §7.4 honest labels.
function _fiCoupon(b) {
  if (b.rate_type === 'floating' || b.rate_type === 'fixed_to_floating') {
    const bench = b.benchmark || null;
    if (b.spread_bps == null) return `${bench || 'Floating'} · spread not parsed — see filing`;
    // AC12 re-adjudication: spread_bps is an INTEGER rounded to the nearest bp, so never shown as exact.
    return `${bench || 'Floating'} + ≈${Number(b.spread_bps)} bp`;
  }
  return b.coupon_rate == null ? '—' : `${Number(b.coupon_rate).toFixed(3)}%`;
}
function _fiRateLabel(b) {
  return b.rate_label || ({ fixed: 'Fixed coupon', floating: 'Floating', fixed_to_floating: 'Fixed-to-floating' })[b.rate_type] || '—';
}
function _fiMoney(amount, ccy) {
  if (amount == null) return '—';
  const n = Math.round(Number(amount)).toLocaleString('en-US');
  const sym = _FI_CCY[ccy];
  return sym ? `${sym}${n}` : `${ccy || ''} ${n}`.trim();
}
function _fiSeniority(b) {
  return b.seniority ? b.seniority : 'Not parsed — see filing';
}
function _fiChip(conf) {
  const c = Number(conf);
  const check = c < 80;
  const col = check ? '#D99C3D' : '#2D9C75';
  return `<span style="border:1px solid ${col}60;background:${col}18;color:${col};border-radius:3px;padding:1px 6px;font-size:9px;font-weight:700;white-space:nowrap">${check ? 'Check source' : 'High'} · ${_esc(c)}</span>`;
}
// §7.3 (DIL N-5): boilerplate or over-long tranche labels give way to a generated title.
function _fiTitle(b) {
  const label = (b.tranche_label || '').trim();
  if (label && label.length <= 120 && !/PROSPECTUS|SUPPLEMENT|Dated/i.test(label)) return label;
  const type = b.rate_type === 'floating' ? 'Floating Rate Notes' : b.rate_type === 'fixed_to_floating' ? 'Fixed-to-Floating Notes' : 'Notes';
  const cpn = b.rate_type === 'fixed' && b.coupon_rate != null ? `${Number(b.coupon_rate).toFixed(3)}% ` : '';
  return `${cpn}${type} due ${_navFmtDate(b.maturity_date)}`;
}
function _fiBondId(b) { return `${b.accession_number}/${Number(b.tranche_seq)}`; }

// M9-4: F1's freshness.latest_filing_date covers one response only, so it is never shown as the
// issuer's latest filing. The page shows the latest filing among the rows on screen, labelled so.
function _fiShownLatest(rows) {
  return (rows || []).reduce((m, b) => (b.filing_date && (!m || b.filing_date > m) ? b.filing_date : m), null);
}
function _fiFreshnessHtml(f, rows) {
  const shown = _fiShownLatest(rows);
  return `<div style="font-size:10px;color:var(--muted);margin-bottom:2px" title="Updated within the last hour">Last checked with SEC ${_esc(_navFmtDate(f && f.last_polled_at) || '—')}${shown ? ` · latest filing among the bonds shown ${_esc(_navFmtDate(shown))}` : ''}</div>`;
}

function _fiTableHtml(st) {
  const multi = st.ciks.length > 1;
  const head = `<div class="fi-row fi-head"><div>Maturity</div><div>Coupon / spread</div><div class="fi-opt">Type</div><div>Principal</div><div class="fi-opt">Seniority</div><div class="fi-opt">Tranche</div><div class="fi-opt">Filed</div><div>Confidence</div></div>`;
  const rows = st.rows.map(b => `<div class="fi-row" role="link" tabindex="0" data-bond="${_esc(_fiBondId(b))}" data-page="${Number(b._page)}" onclick="_fiOpenBondRow(this)" onkeydown="if(event.key==='Enter')_fiOpenBondRow(this)">
      <div><strong>${_esc(_navFmtDate(b.maturity_date))}</strong></div>
      <div>${_esc(_fiCoupon(b))}</div>
      <div class="fi-opt">${_esc(_fiRateLabel(b))}</div>
      <div>${_esc(_fiMoney(b.principal_amount, b.currency))}</div>
      <div class="fi-opt">${_esc(_fiSeniority(b))}</div>
      <div class="fi-opt" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(_fiTitle(b))}${multi ? `<div style="font-size:9px;color:var(--muted)">Filed by ${_esc(st.cikName[b.cik] || b.cik)}</div>` : ''}</div>
      <div class="fi-opt">${_esc(_navFmtDate(b.filing_date))}</div>
      <div>${_fiChip(b.parse_confidence)}</div>
    </div>`).join('');
  return head + rows;
}

function _fiLadderHtml(years) {
  if (!years || !years.length) return '';
  const max = Math.max(...years.map(y => y.securities), 1);
  const bars = years.map(y => {
    const other = Object.entries(y.other_currencies || {}).map(([c, n]) => `${_esc(c)} ${Number(n)}`).join(' · ');
    return `<div class="fi-bar" title="${_esc(y.year)}">
      <div style="font-size:9px;color:var(--text2)">${Number(y.securities)} ${y.securities === 1 ? 'security' : 'securities'}</div>
      <div style="height:${Math.max(4, Math.round(60 * y.securities / max))}px;background:var(--blue);opacity:.7;border-radius:2px 2px 0 0;margin:2px auto 0;width:28px"></div>
      <div style="font-weight:700;color:var(--text2)">${_esc(y.year)}</div>
      ${y.principal_usd ? `<div>USD ${_esc(_fiMoney(y.principal_usd, 'USD').slice(1))}<br><span style="font-size:8px">(single-filing securities)</span></div>` : ''}
      ${y.reopened ? `<div>${Number(y.reopened)} reopened</div>` : ''}
      ${other ? `<div>${other}</div>` : ''}
    </div>`;
  }).join('');
  return `<div style="font-size:9px;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:.05em;margin:8px 0 2px">Maturity ladder · outstanding</div><div class="fi-ladder">${bars}</div>`;
}

// §7.2 Bonds section on the issuer layer (same shape as _loadLinkedInstruments).
async function _loadIssuerBonds(entityId, root) {
  const section = _navFind(root, `issuer-bonds-section-${entityId}`);
  if (!section) return;
  _fiStyleOnce();
  section._fi = { entityId, rows: [], cursor: null, pages: 0, matured: false, ciks: [], cikName: {}, gate: null, freshness: null, years: null, error: null };
  await _fiBondsLoadPage(section, true);
}

async function _fiBondsLoadPage(section, first) {
  const st = section._fi;
  st.error = null;
  if (first) { st.rows = []; st.cursor = null; st.pages = 0; }
  const btn = section.querySelector('.fi-more');
  if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }
  const q = `?limit=25&include_matured=${st.matured ? 1 : 0}${st.cursor ? `&cursor=${encodeURIComponent(st.cursor)}` : ''}`;
  const [r, l] = await Promise.all([
    data_entitiesGet(`/api/fi/issuers/${st.entityId}/bonds${q}`),
    first && st.years === null ? data_entitiesGet(`/api/fi/issuers/${st.entityId}/ladder`) : Promise.resolve(null)
  ]);
  if (!section.isConnected) return;
  if (_navIsOutage(r)) { st.error = 'outage'; _fiBondsRender(section); return; }
  if (r.status === 422) { st.error = 'too_many'; _fiBondsRender(section); return; }
  const d = r.ok && r.data ? r.data : null;
  if (!d || !d.has_bond_link) { section.style.display = 'none'; return; }   // most entities: no section at all
  st.gate = d.gate;
  if (d.coverage && d.coverage.available === false) st.error = 'missing';
  st.ciks = d.ciks || [];
  st.ciks.forEach(c => { st.cikName[c.cik] = c.issuer_name; });
  st.freshness = d.freshness || st.freshness;
  (d.bonds || []).forEach(b => st.rows.push({ ...b, _page: st.pages + 1 }));
  st.cursor = d.next_cursor || null;
  st.pages++;
  if (l && l.ok && l.data && l.data.gate === 'open') st.years = l.data.years || [];
  _fiBondsRender(section);
}

function _fiToggleMatured(section) {
  section._fi.matured = !section._fi.matured;
  _fiBondsLoadPage(section, true);
}

function _fiBondsRender(section) {
  const st = section._fi;
  section.style.display = '';
  const sel = "this.closest('[id^=issuer-bonds-section-]')";
  const title = `<div style="font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--dim);margin-bottom:4px">Bonds · <span style="font-weight:400;text-transform:none;letter-spacing:0">SEC issuance data</span></div>`;
  if (st.error === 'outage' && !st.pages) { section.innerHTML = title + _fiRetryHtml(`_fiBondsLoadPage(${sel}, true)`); return; }
  if (st.error === 'too_many') { section.innerHTML = title + _fiNoticeHtml('Bond data unavailable for this issuer.') + _fiDisclosureHtml(); return; }
  if (st.error === 'missing') { section.innerHTML = title + _fiNoticeHtml(_FI_MISSING); return; }
  if (st.gate !== 'open') { section.innerHTML = title + _fiNoticeHtml(_FI_CLOSED) + _fiDisclosureHtml(); return; }
  const f = st.freshness || {};
  const fresh = _fiFreshnessHtml(f, st.rows);
  const toggle = `<button onclick="_fiToggleMatured(${sel})" style="background:none;border:none;color:var(--blue);font-size:10px;cursor:pointer;padding:0">${st.matured ? 'Hide matured' : 'Show matured'}</button>`;
  let body;
  if (!st.rows.length && !st.cursor) {
    body = `<div style="color:var(--dim);font-size:11px;margin:6px 0">${st.matured ? 'No bonds in Meridian Atlas for this issuer.' : 'No outstanding bonds in Meridian Atlas for this issuer.'} ${toggle}</div>`;
  } else {
    const more = st.cursor
      ? `<button class="fi-more" onclick="_fiBondsLoadPage(${sel}, false)" style="margin-top:10px;background:none;border:1px solid var(--border);color:var(--blue);font-size:10px;padding:4px 10px;border-radius:var(--r);cursor:pointer">${st.error === 'outage' ? "Couldn't load more · Retry" : 'Show 25 more ↓'}</button>`
      : '';
    body = `<div style="text-align:right">${toggle}</div><div style="border-top:1px solid var(--border)">${_fiTableHtml(st)}</div>${more}`;
  }
  section.innerHTML = title + fresh + _fiDisclosureHtml() + (st.matured ? '' : _fiLadderHtml(st.years)) + body;
}

function _fiOpenBondRow(rowEl) {
  const section = rowEl.closest ? rowEl.closest('[id^=issuer-bonds-section-]') : null;
  const eid = section && section._fi ? section._fi.entityId : null;
  // Issuer-layer rows carry from = entity:{id}:{page}; CIK-layer rows have no entity.
  _navOpen('bond', rowEl.dataset.bond, { history: 'push', from: eid ? `entity:${eid}:${rowEl.dataset.page}` : null });
}

function openFixedIncome() {
  _navOpen('fi', null, { history: 'push' });
}

function _fiTermRow(label, value, mono) {
  return value == null || value === '' ? '' : `<div><span style="color:var(--dim)">${_esc(label)}</span> <span${mono ? ' style="font-family:var(--mono);font-size:10px"' : ''}>${_esc(value)}</span></div>`;
}

// §7.3 Bond detail layer. The filer CIK shown is the bond's own (bond_issuer_link.cik), never
// entity_master.cik; an unmatched filer shows no LEI; no guarantor in v1 (DIL M-8, N-6).
async function _navRenderBond(layer, opts) {
  const el = layer.el;
  _fiStyleOnce();
  layer.title = layer.title || 'Bond';
  el.innerHTML = _navShell(layer, `<div style="color:var(--dim);font-size:12px;padding:16px">Loading bond…</div>`);
  const [acc, seq] = String(layer.id).split('/');
  const r = await data_entitiesGet(`/api/fi/bonds/${encodeURIComponent(acc)}/${encodeURIComponent(seq)}`);
  if (!el.isConnected) return;
  if (_navIsOutage(r)) { _navRenderNetworkError(layer, opts); return; }
  if (r.status === 400) { el.innerHTML = _navShell(layer, `<div style="color:var(--text2);font-size:13px">That link isn't valid.</div>`); return; }
  if (r.status === 404 || !r.ok || !r.data) { el.innerHTML = _navShell(layer, _fiNoticeHtml("This bond isn't available.") + _fiDisclosureHtml()); return; }
  const d = r.data;
  if (d.coverage && d.coverage.available === false) { el.innerHTML = _navShell(layer, _fiNoticeHtml(_FI_MISSING)); return; }
  if (d.gate !== 'open' || !d.bond) { el.innerHTML = _navShell(layer, _fiNoticeHtml(_FI_CLOSED) + _fiDisclosureHtml()); return; }
  const b = d.bond, nl = d.issuer || {}, filer = d.filer || {};
  layer.title = _fiTitle(b);
  const ids = _navDisplayIds({ isin: b.isin, cusip: b.cusip });
  const rate = b.rate_type === 'fixed' ? _fiTermRow('Coupon', _fiCoupon(b))
    : _fiTermRow('Benchmark + spread', `${_fiCoupon(b)}${b.spread_bps != null ? ' (spread rounded to the nearest basis point)' : ''}`);
  const terms = [
    _fiTermRow('Principal', `${_fiMoney(b.principal_amount, b.currency)}${b.principal_amount != null && b.currency ? ` ${b.currency}` : ''}`),
    rate, _fiTermRow('Rate type', _fiRateLabel(b)), _fiTermRow('Maturity', _navFmtDate(b.maturity_date)), _fiTermRow('Seniority', _fiSeniority(b)),
    _fiTermRow('Security class', b.security_class), _fiTermRow('Form', b.form_type), _fiTermRow('Filed', _navFmtDate(b.filing_date)),
    _fiTermRow('Accession', b.accession_number, true), ids.isin ? _fiTermRow('ISIN', ids.isin, true) : '', ids.cusip ? _fiTermRow('CUSIP', ids.cusip, true) : ''
  ].join('');
  const quality = `<div style="font-size:11px;color:var(--text2);margin:10px 0 2px">Parse confidence ${_esc(b.parse_confidence)} ${_fiChip(b.parse_confidence)}</div>
    ${b.check_source ? `<div style="font-size:11px;color:#D99C3D">Check the filing: some terms were parsed with lower confidence.</div>` : ''}
    <div style="font-size:9px;color:var(--muted)">Parser ${_esc(b.parser_version || '—')} · ingested ${_esc(_navFmtDate(b.ingested_at) || '—')}</div>`;
  const c = (nl.candidates || [])[0];
  let issuer;
  if (c) {
    issuer = _navCandidateHtml(c, nl, false) +
      `<button data-entity="${Number(c.entity_id)}" data-name="${_esc(c.name || '')}" data-bond="${_esc(layer.id)}" onclick="_fiOpenIssuer(this)" style="margin-top:8px;background:none;border:1px solid var(--border);color:var(--blue);font-size:10px;padding:4px 10px;border-radius:var(--r);cursor:pointer">Open issuer →</button>` +
      (nl.state === 'ambiguous' ? `<div style="font-size:10px;color:var(--muted);margin-top:6px">This security also appears in a filing by another filer.</div>` : '');
  } else {
    issuer = `<div style="font-size:12px;color:var(--text2)">Issuer not linked to Corporate Atlas yet · ${_esc(filer.issuer_name || '')} (CIK ${_esc(filer.cik || b.cik)})</div>
      <a href="#/fi/cik/${_esc(filer.cik || b.cik)}" onclick="event.preventDefault();_navOpen('fi_cik', ${_esc(JSON.stringify(filer.cik || b.cik))}, { history: 'push' })" style="color:var(--blue);font-size:11px">All bonds from this filer →</a>`;
  }
  const others = b.other_filings > 0 ? `<div style="font-size:11px;color:var(--text2);margin:6px 0">Also filed in ${Number(b.other_filings)} other filing${b.other_filings === 1 ? '' : 's'}.</div>` : '';
  const viewInstr = b.instrument_key
    ? `<a href="${_esc(_navHash('instrument', b.instrument_key, null))}" onclick="event.preventDefault();_navOpen('instrument', ${_esc(JSON.stringify(b.instrument_key))}, { history: 'push', from: ${_esc(JSON.stringify(`bond:${layer.id}`))} })" style="color:var(--blue);font-size:11px">View instrument</a>`
    : '';
  el.innerHTML = _navShell(layer, `
    <div style="padding:18px 20px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r)">
      <h2 style="margin:0 0 4px;font-size:16px;font-weight:700;color:var(--text)">${_esc(layer.title)}</h2>
      ${_fiDisclosureHtml()}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:4px 20px;font-size:11px;color:var(--text2);line-height:1.8;margin:8px 0">${terms}</div>
      ${others}
      <div style="margin:8px 0"><a href="${_esc(b.source_url)}" target="_blank" rel="noopener noreferrer" style="color:var(--blue);font-size:11px">View filing on SEC.gov ↗</a>${viewInstr ? ' · ' + viewInstr : ''}</div>
      ${quality}
      <div style="font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--dim);margin:16px 0 4px">Filer · CIK ${_esc(filer.cik || b.cik)}</div>
      ${issuer}
    </div>`);
}

function _fiOpenIssuer(btn) {
  _navOpen('entity', Number(btn.dataset.entity), { history: 'push', from: `bond:${btn.dataset.bond}`, lastName: btn.dataset.name || '' });
}

// §7.6 Directory (#/fi). CIK shown = bond_issuer_link.cik (DIL M-8).
async function _navRenderFiDirectory(layer, opts) {
  const el = layer.el;
  layer.title = 'Fixed Income';
  el.innerHTML = _navShell(layer, `<div style="color:var(--dim);font-size:12px;padding:16px">Loading Fixed Income…</div>`);
  const r = await data_entitiesGet('/api/fi/coverage');
  if (!el.isConnected) return;
  if (_navIsOutage(r)) { _navRenderNetworkError(layer, opts); return; }
  const d = r.ok ? r.data : null;
  const head = `<h2 style="margin:0 0 4px;font-size:16px;font-weight:700;color:var(--text)">Fixed Income</h2>`;
  if (!d || (d.coverage && d.coverage.available === false)) { el.innerHTML = _navShell(layer, head + _fiNoticeHtml(_FI_MISSING)); return; }
  if (d.gate !== 'open') { el.innerHTML = _navShell(layer, head + _fiNoticeHtml(_FI_CLOSED) + _fiDisclosureHtml()); return; }
  const t = d.totals || {};
  layer._fiIssuers = d.issuers || [];
  const depth = _navStack.indexOf(layer) + 1;
  el.innerHTML = _navShell(layer, `${head}
    <div style="font-size:11px;color:var(--text2)">${Number(t.issuers || 0)} issuers · ${Number(t.finals || 0).toLocaleString()} bonds · ${Number(t.unmatched || 0)} not linked yet</div>
    <div style="font-size:10px;color:var(--muted)" title="Updated within the last hour">Last checked with SEC ${_esc(_navFmtDate(d.as_of) || '—')}</div>
    ${_fiDisclosureHtml()}
    <input class="fi-filter" type="search" aria-label="Filter issuers" placeholder="Filter by name or CIK…" oninput="_fiFilterDirectory(${depth}, this.value)"
      style="width:100%;max-width:420px;box-sizing:border-box;margin:8px 0;padding:7px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);color:var(--text);font-size:12px">
    <div class="fi-dir-rows">${_fiDirectoryRowsHtml(layer._fiIssuers)}</div>`);
}

function _fiDirectoryRowsHtml(list) {
  if (!list.length) return `<div style="color:var(--dim);font-size:11px">No matches.</div>`;
  return list.map(i => {
    const linked = i.entity_id != null;
    const chip = linked ? `<span style="border:1px solid #2D9C7560;color:#2D9C75;border-radius:3px;padding:1px 6px;font-size:9px;font-weight:700">Linked</span>`
      : `<span style="border:1px solid #88888860;color:#888;border-radius:3px;padding:1px 6px;font-size:9px;font-weight:700">Not linked yet</span>`;
    const open = linked ? `_navOpen('entity', ${Number(i.entity_id)}, { history: 'push', lastName: ${_esc(JSON.stringify(i.issuer_name || ''))} })`
      : `_navOpen('fi_cik', ${_esc(JSON.stringify(i.cik))}, { history: 'push' })`;
    return `<div class="fi-dir-row" role="link" tabindex="0" onclick="${open}" onkeydown="if(event.key==='Enter'){${open}}" style="display:flex;flex-wrap:wrap;gap:4px 12px;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);font-size:11px;color:var(--text2);cursor:pointer">
      <div style="flex:1 1 220px;min-width:0"><strong style="color:var(--text)">${_esc(i.issuer_name)}</strong> <span style="font-family:var(--mono);font-size:9px;color:var(--muted)">CIK ${_esc(i.cik)}</span></div>
      ${chip}
      <div style="flex:0 0 auto">${Number(i.finals)} bonds</div>
      <div style="flex:0 0 auto;color:var(--dim)">latest filing ${_esc(_navFmtDate(i.latest_filing) || '—')}</div>
      <div style="flex:0 0 auto;color:var(--dim)">checked ${_esc(_navFmtDate(i.last_polled_at) || '—')}</div>
    </div>`;
  }).join('');
}

function _fiFilterDirectory(depth, value) {
  const layer = _navStack[depth - 1];
  if (!layer) return;
  const q = String(value || '').trim().toUpperCase();
  const list = (layer._fiIssuers || []).filter(i => !q || String(i.issuer_name).toUpperCase().includes(q) || String(i.cik).includes(q));
  const out = layer.el.querySelector('.fi-dir-rows');
  if (out) out.innerHTML = _fiDirectoryRowsHtml(list);
}

// §7.1 Unlinked filer layer (#/fi/cik/{cik}) — F1b.
async function _navRenderFiCik(layer, opts) {
  const el = layer.el;
  _fiStyleOnce();
  layer.title = layer.title || `CIK ${layer.id}`;
  el.innerHTML = _navShell(layer, `<div style="color:var(--dim);font-size:12px;padding:16px">Loading filer…</div>`);
  layer._fi = { cik: String(layer.id), rows: [], cursor: null, pages: 0, ciks: [], cikName: {} };
  await _fiCikLoadPage(layer, opts, true);
}

async function _fiCikLoadPage(layer, opts, first) {
  const el = layer.el, st = layer._fi;
  const q = `?limit=25${!first && st.cursor ? `&cursor=${encodeURIComponent(st.cursor)}` : ''}`;
  if (first) { st.rows = []; st.cursor = null; st.pages = 0; }
  const r = await data_entitiesGet(`/api/fi/ciks/${encodeURIComponent(st.cik)}/bonds${q}`);
  if (!el.isConnected) return;
  if (_navIsOutage(r)) { _navRenderNetworkError(layer, opts); return; }
  if (r.status === 400) { el.innerHTML = _navShell(layer, `<div style="color:var(--text2);font-size:13px">That link isn't valid.</div>`); return; }
  const d = r.ok ? r.data : null;
  if (!d || (d.coverage && d.coverage.available === false)) { el.innerHTML = _navShell(layer, _fiNoticeHtml(_FI_MISSING)); return; }
  if (d.gate !== 'open') { el.innerHTML = _navShell(layer, _fiNoticeHtml(_FI_CLOSED) + _fiDisclosureHtml()); return; }
  if (!d.has_bond_link) { el.innerHTML = _navShell(layer, _fiNoticeHtml('No bonds in Meridian Atlas for this filer.') + _fiDisclosureHtml()); return; }
  st.ciks = d.ciks || [];
  const link = st.ciks[0] || {};
  layer.title = link.issuer_name || layer.title;
  (d.bonds || []).forEach(b => st.rows.push({ ...b, _page: st.pages + 1 }));
  st.cursor = d.next_cursor || null;
  st.pages++;
  const f = d.freshness || {};
  const more = st.cursor ? `<button class="fi-more" onclick="_fiCikMore(${_navStack.indexOf(layer) + 1})" style="margin-top:10px;background:none;border:1px solid var(--border);color:var(--blue);font-size:10px;padding:4px 10px;border-radius:var(--r);cursor:pointer">Show 25 more ↓</button>` : '';
  const table = st.rows.length || st.cursor ? `<div style="border-top:1px solid var(--border);margin-top:8px">${_fiTableHtml(st)}</div>${more}`
    : `<div style="color:var(--dim);font-size:11px;margin:6px 0">No outstanding bonds in Meridian Atlas for this filer.</div>`;
  el.innerHTML = _navShell(layer, `
    <h2 style="margin:0 0 4px;font-size:16px;font-weight:700;color:var(--text)">${_esc(link.issuer_name || '')} <span style="font-family:var(--mono);font-size:10px;color:var(--muted)">CIK ${_esc(link.cik || st.cik)}</span></h2>
    <div style="font-size:12px;color:var(--text2)">Issuer not linked to Corporate Atlas yet.</div>
    ${_fiFreshnessHtml(f, st.rows)}
    ${_fiDisclosureHtml()}
    ${table}`);
}

function _fiCikMore(depth) {
  const layer = _navStack[depth - 1];
  if (layer) _fiCikLoadPage(layer, layer.retryOpts || {}, false);
}

// §3.3 routes (the router in index.html dispatches; see its header comment).
document.addEventListener('ma:route', e => {
  const d = e.detail || {};
  if (d.mode === 'pop') {
    const depth = Number.isInteger(d.depth) ? d.depth : 0;
    while (_navStack.length > depth) _navStack.pop().el.remove();
    // Forward into a layer that was closed: reopen it on its existing entry.
    if (d.type && depth === _navStack.length + 1) _navOpen(d.type, d.id, { history: 'none', from: d.from });
    return;
  }
  if (!d.type) return;
  if (d.mode === 'cold') {
    // N7-13: the deep link's own entry becomes Home (depth 0), so Back never leaves the site.
    history.replaceState({ maNav: 0 }, '', location.pathname + location.search);
    const origin = _navParseFrom(d.from);
    // An entity/instrument origin is rebuilt underneath; ETF and bond origins go Home in
    // Phase 1 (ma-etf.js wiring is Phase 2).
    if (origin.type === 'entity' && /^\d+$/.test(origin.key)) _navOpen('entity', Number(origin.key), { history: 'push' });
    else if (origin.type === 'instrument' && origin.key) _navOpen('instrument', origin.key, { history: 'push' });
    else if (origin.type === 'exposure') _navOpen('exposure', origin.key || '', { history: 'push' });   // MA-NOV-EXP.W3
    _navOpen(d.type, d.id, { history: 'push', from: d.from });
    return;
  }
  // 'typed': the browser already made a new entry for the hand-typed hash; stamp it.
  _navOpen(d.type, d.id, { history: 'replace', from: d.from });
});

// ===== EXP (MA-NOV-EXP.W2) =====
// Exposure-to-company calculation: pure functions only (spec claude/specs/MA-NOV-EXP_Spec.md §3.1–3.3, §5.1).
// No DOM, no fetch, no storage. The UI (W3) fetches R-EXP1 bodies and passes them in here.
//   exp_validate(inputs)                         → validation result (§3.1)
//   exp_combine(inputs, indices)                 → new inputs with the duplicate rows merged into the first
//   exp_compute(inputs, lookthroughs, opts)      → full result (§3.3, §5.1)
// An input is { type: 'etf', symbol, allocation } or { type: 'eq', entity_id, resolved_id?, name, allocation }.
// `lookthroughs` (and `opts.previous`) map ETF symbol → response { status, data } (the shape the existing
// entities GET helper returns; `body` is accepted for `data`). Missing entry = still loading. status 0 / 5xx = not loaded.
// Values keep full double precision; display rounds to 2 dp; reconciliation tolerance 0.01 pp (never forced).
const _EXP_MAX_INPUTS = 10;
const _EXP_TOL = 0.01;
const _EXP_CONTRACT = 'exp-1';
const _EXP_ALLOC_MSG = 'Allocation must be between 0.01 and 100';
const _EXP_STALE_MONTHS = 3;
const _EXP_MAPPED_TIERS = ['isin_tier1', 'openfigi_tier1', 'cusip_tier1', 'heuristic'];
const _EXP_BAND_RANK = { low: 0, medium: 1, high: 2 };
const _EXP_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function _expNum(x) {
  if (typeof x === 'number') return x;
  if (typeof x === 'string' && /^\s*[+-]?(\d+(\.\d*)?|\.\d+)\s*$/.test(x)) return Number(x);
  return NaN;
}
function _expCents(x) { return Math.round(x * 100) / 100; }
// "110" / "10.01" / "99.5": at most 2 dp, no trailing zeros (T3 wording).
function _expPctText(x) { const s = String(Number(_expCents(x).toFixed(2))); return s === '-0' ? '0' : s; }
function _expIs2dp(a) { return Math.abs(a * 100 - Math.round(a * 100)) < 1e-7; }
function _expType(inp) { const t = String(inp && inp.type || '').toLowerCase(); return t === 'etf' ? 'etf' : (t === 'eq' || t === 'equity') ? 'eq' : ''; }
function _expSymbol(inp) { return String(inp && inp.symbol || '').trim().toUpperCase(); }
function _expEntityId(inp) { const v = inp && (inp.resolved_id ?? inp.entity_id); return v == null || v === '' ? null : Number(v); }
// Duplicate key (§3.1): same ETF ticker; same entity after redirect. An ETF and a direct holding never collide.
function _expInputKey(inp) {
  const t = _expType(inp);
  if (t === 'etf') return 'ETF:' + _expSymbol(inp);
  if (t === 'eq') return 'EQ:' + _expEntityId(inp);
  return null;
}
function _expLabel(inp) {
  const t = _expType(inp);
  if (t === 'etf') return _expSymbol(inp);
  if (t === 'eq') return String(inp.name || ('Entity ' + _expEntityId(inp)));
  return '';
}
function _expMonthIndex(m) { const x = /^(\d{4})-(\d{2})$/.exec(String(m || '')); return x ? Number(x[1]) * 12 + Number(x[2]) - 1 : null; }
function exp_monthLabel(m) { const i = _expMonthIndex(m); return i == null ? String(m || '') : `${_EXP_MONTHS[i % 12]} ${Math.floor(i / 12)}`; }
function _expGet(map, key) { if (!map) return undefined; return typeof map.get === 'function' ? map.get(key) : map[key]; }

// §3.1. Returns { ok, empty, count, total, unallocated, show_unallocated, total_status, rows[{errors}], errors, duplicates }.
function exp_validate(inputs) {
  const list = Array.isArray(inputs) ? inputs : [];
  const rows = list.map(() => ({ errors: [] }));
  const errors = [];
  if (list.length > _EXP_MAX_INPUTS) {
    errors.push({ code: 'too_many_inputs', message: `At most ${_EXP_MAX_INPUTS} inputs (this list has ${list.length})` });
  }
  let total = 0;
  list.forEach((inp, i) => {
    const t = _expType(inp);
    if (!t) rows[i].errors.push({ code: 'type', message: 'Unknown input type' });
    else if (t === 'etf' && !_expSymbol(inp)) rows[i].errors.push({ code: 'symbol', message: 'Choose an ETF' });
    else if (t === 'eq' && !Number.isFinite(_expEntityId(inp))) rows[i].errors.push({ code: 'entity', message: 'Choose a company' });
    const a = _expNum(inp && inp.allocation);
    if (!(Number.isFinite(a) && a > 0 && a <= 100 && _expIs2dp(a))) rows[i].errors.push({ code: 'allocation', message: _EXP_ALLOC_MSG });
    else total += a;
  });
  total = _expCents(total);   // every counted value has ≤ 2 dp, so this only removes float drift
  if (total > 100.005) {
    errors.push({ code: 'over_allocated', message: `Allocations total ${_expPctText(total)}% — reduce by ${_expPctText(total - 100)}%`, total, excess: _expCents(total - 100) });
  }
  // Duplicates: blocked until the user removes one or presses Combine.
  const groups = new Map();
  list.forEach((inp, i) => {
    const k = _expInputKey(inp);
    if (k && !/^(ETF:|EQ:null|EQ:NaN)$/.test(k)) { if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); }
  });
  const duplicates = [];
  for (const [key, idx] of groups) {
    if (idx.length < 2) continue;
    const parts = idx.map(i => _expNum(list[i].allocation)).filter(Number.isFinite);
    const combined = _expCents(parts.reduce((s, a) => s + a, 0));
    const label = _expLabel(list[idx[0]]);
    duplicates.push({ key, indices: idx, label, combined_allocation: combined,
      combine_label: `Combine into one row (${parts.map(_expPctText).join('+')}%)` });
    idx.forEach(i => rows[i].errors.push({ code: 'duplicate', message: `${label} is entered more than once — remove one or combine` }));
    errors.push({ code: 'duplicate', message: `${label} is entered more than once — remove one or combine`, indices: idx });
  }
  const empty = list.length === 0;
  const total_status = empty ? 'empty' : total > 100.005 ? 'over' : total < 99.995 ? 'under' : 'ok';
  const ok = !empty && errors.length === 0 && rows.every(r => r.errors.length === 0);
  return { ok, empty, count: list.length, total, unallocated: _expCents(100 - total), show_unallocated: total < 99.995,
    total_status, rows, errors, duplicates };
}

// Merge rows `indices` into the first of them (allocations summed to 2 dp). Does not mutate `inputs`.
function exp_combine(inputs, indices) {
  const list = Array.isArray(inputs) ? inputs : [];
  const idx = [...new Set((indices || []).map(Number))].filter(i => i >= 0 && i < list.length).sort((a, b) => a - b);
  if (idx.length < 2) return list.slice();
  const sum = _expCents(idx.reduce((s, i) => s + (_expNum(list[i].allocation) || 0), 0));
  const drop = new Set(idx.slice(1));
  return list.map((inp, i) => (i === idx[0] ? { ...inp, allocation: sum } : inp)).filter((_, i) => !drop.has(i));
}

// One R-EXP1 response → outcome (spec §4.2 errors; W1R4 live contract incl. 422 limit "rows" | "size").
function _expOutcome(res) {
  if (res == null) return { status: 'pending', message: 'loading' };
  const code = Number(res.status);
  const body = res.data !== undefined ? res.data : res.body;
  const err = body && typeof body === 'object' ? body.error : undefined;
  if (code === 200) {
    if (body && typeof body === 'object' && Array.isArray(body.entities) && (body.contract === undefined || body.contract === _EXP_CONTRACT)) {
      return { status: 'computed', body };
    }
    return { status: 'not_loaded', reason: 'bad_body', message: 'not loaded – retry' };
  }
  if (code === 404 && err === 'no_holdings') return { status: 'unsupported', reason: 'no_holdings', detail: body.reason || null, message: 'not supported: no stored holdings' };
  if (code === 404 && err === 'etf_not_found') return { status: 'unsupported', reason: 'etf_not_found', message: 'not supported: unknown ETF symbol' };
  if (code === 404 && err === 'month_not_stored') return { status: 'unsupported', reason: 'month_not_stored', message: 'not supported: month not stored' };
  if (code === 422 && err === 'too_large') {
    return { status: 'unsupported', reason: 'too_large', limit: body.limit || null, message: 'not supported: too large for live look-through',
      holdings_count: body.holdings_count ?? null, report_month: body.report_month ?? null,
      max_holdings: body.max_holdings ?? null, body_bytes: body.body_bytes ?? null, max_body_bytes: body.max_body_bytes ?? null };
  }
  if (code === 400) return { status: 'invalid', reason: err || 'bad_request', message: `invalid input (${err || 'bad request'})` };
  return { status: 'not_loaded', reason: code ? `http_${code}` : 'network', message: 'not loaded – retry' };
}

// Lowest band of one entity row: heuristic tier or confidence < 70 (or unknown) → low; 70–89 medium; ≥ 90 high.
// minconf is MIN(confidence) with heuristic counted as 0 (route §4.2), so this equals the lowest navBand of its rows.
function _expBand(tiers, minconf) {
  const c = minconf == null || minconf === '' ? NaN : Number(minconf);
  if (String(tiers || '').split(',').includes('heuristic') || !Number.isFinite(c) || c < 70) return 'low';
  return c >= 90 ? 'high' : 'medium';
}
function _expMinBand(a, b) { if (!a) return b; if (!b) return a; return _EXP_BAND_RANK[a] <= _EXP_BAND_RANK[b] ? a : b; }

// Per-ETF fund figures (§3.3): T reported total, M mapped, U unmapped, N no identifier, X redirect unresolved,
// R = 100 − T residual; f: entity_id → fund weight row.
function _expFund(body) {
  const tiers = body.tiers && typeof body.tiers === 'object' ? body.tiers : {};
  const tw = t => { const v = tiers[t]; return Array.isArray(v) ? (Number(v[1]) || 0) : 0; };
  let T = 0;
  for (const k of Object.keys(tiers)) T += tw(k);
  const f = new Map();
  let M = 0;
  for (const r of body.entities) {
    if (!Array.isArray(r) || r[0] == null) continue;
    const id = Number(r[0]);
    const w = Number(r[2]) || 0;
    const prev = f.get(id);
    const row = { entity_id: id, name: r[1] == null ? null : String(r[1]), w: (prev ? prev.w : 0) + w, n: (prev ? prev.n : 0) + (Number(r[3]) || 0),
      tiers: [prev && prev.tiers, r[4]].filter(Boolean).join(','), band: _expMinBand(prev && prev.band, _expBand(r[4], r[5])),
      merged: Boolean(prev && prev.merged) || Number(r[6]) === 1 };
    f.set(id, row);
    M += w;
  }
  const mappedTiers = _EXP_MAPPED_TIERS.reduce((s, t) => s + tw(t), 0);
  return { T, M, U: tw('unmapped'), N: tw('no_identifier'), X: tw('redirect_unresolved'), R: 100 - T, f, mapped_tiers: mappedTiers };
}

function _expCompanySort(a, b) {
  if (b.combined !== a.combined) return b.combined - a.combined;
  const na = String(a.name || ''), nb = String(b.name || '');
  if (na !== nb) return na < nb ? -1 : 1;
  return a.entity_id - b.entity_id;
}

// §3.3 + §5.1. opts: { previous: symbol → previous-month response (Compare on), newest_stored_month: 'YYYY-MM' }.
function exp_compute(inputs, lookthroughs, opts) {
  opts = opts || {};
  const validation = exp_validate(inputs);
  if (!validation.ok) {
    return { state: validation.empty ? 'empty' : 'invalid', validation, inputs: null, companies: null, shared: null, overlap: null,
      low_confidence: null, reconciliation: null, months: null, gaps: null, delta: null };
  }
  const list = inputs;
  const outInputs = [];
  const funds = [];                       // computed ETFs: { index, symbol, a, fund, body }
  const companies = new Map();
  const company = (id, name) => {
    let c = companies.get(id);
    if (!c) { c = { entity_id: id, name: name || null, direct: 0, indirect: 0, combined: 0, k: 0, band: null, merged: false, notes: [], contributions: [] }; companies.set(id, c); }
    if (!c.name && name) c.name = name;
    return c;
  };
  const lines = { unmapped: 0, no_identifier: 0, redirect_unresolved: 0, residual: 0, unsupported: 0, not_loaded: 0 };

  list.forEach((inp, index) => {
    const a = _expNum(inp.allocation);
    const type = _expType(inp);
    if (type === 'eq') {
      const id = _expEntityId(inp);
      outInputs.push({ index, type, label: _expLabel(inp), allocation: a, status: 'direct', entity_id: id });
      const c = company(id, inp.name ? String(inp.name) : null);
      c.direct += a;
      c.k += 1;
      c.contributions.push({ input: index, kind: 'direct', label: _expLabel(inp), allocation: a, contribution: a });
      return;
    }
    const symbol = _expSymbol(inp);
    const oc = _expOutcome(_expGet(lookthroughs, symbol));
    const row = { index, type, label: symbol, symbol, allocation: a, status: oc.status };
    if (oc.status !== 'computed') {
      Object.assign(row, { reason: oc.reason || null, message: oc.message });
      if (oc.reason === 'too_large') Object.assign(row, { limit: oc.limit, holdings_count: oc.holdings_count, report_month: oc.report_month,
        max_holdings: oc.max_holdings, body_bytes: oc.body_bytes, max_body_bytes: oc.max_body_bytes });
      if (oc.status === 'unsupported' || oc.status === 'invalid') lines.unsupported += a;
      else lines.not_loaded += a;       // not_loaded and pending: own line, never spread
      outInputs.push(row);
      return;
    }
    const body = oc.body;
    const fund = _expFund(body);
    Object.assign(row, { report_month: body.report_month ?? null, previous_month: body.previous_month ?? null,
      filing_date: body.filing_date ?? null, period_end: body.period_end ?? null, holdings_count: body.holdings_count ?? null,
      computed_at: body.computed_at ?? null, name: body.name ?? null,
      fund: { reported_total: fund.T, mapped: fund.M, unmapped: fund.U, no_identifier: fund.N, redirect_unresolved: fund.X, residual: fund.R },
      lines: { mapped: a * fund.M / 100, unmapped: a * fund.U / 100, no_identifier: a * fund.N / 100,
        redirect_unresolved: a * fund.X / 100, residual: a * fund.R / 100 } });
    outInputs.push(row);
    lines.unmapped += a * fund.U / 100;
    lines.no_identifier += a * fund.N / 100;
    lines.redirect_unresolved += a * fund.X / 100;
    lines.residual += a * fund.R / 100;
    funds.push({ index, symbol, a, fund, body });
    for (const fr of fund.f.values()) {
      const cval = a * fr.w / 100;
      const c = company(fr.entity_id, fr.name);
      c.indirect += cval;
      if (cval !== 0) c.k += 1;
      c.band = _expMinBand(c.band, fr.band);
      c.merged = c.merged || fr.merged;
      c.contributions.push({ input: index, kind: 'etf', label: symbol, symbol, allocation: a, fund_weight: fr.w, contribution: cval,
        holdings: fr.n, tiers: fr.tiers ? fr.tiers.split(',') : [], band: fr.band, merged: fr.merged, report_month: body.report_month ?? null });
    }
  });

  const list2 = [...companies.values()];
  for (const c of list2) {
    c.combined = c.direct + c.indirect;
    if (!c.name) c.name = `Entity ${c.entity_id}`;
    if (c.merged) c.notes.push('merged record');
    if (c.combined < 0) c.notes.push('net short / derivative');
  }
  list2.sort(_expCompanySort);
  const shared = list2.filter(c => c.k >= 2);

  // Pairwise ETF overlap at company level (fund-weight basis), entities with both weights > 0.
  const overlap = [];
  for (let x = 0; x < funds.length; x++) {
    for (let y = x + 1; y < funds.length; y++) {
      let o = 0, n = 0;
      for (const [id, r] of funds[x].fund.f) {
        const s = funds[y].fund.f.get(id);
        if (s && r.w > 0 && s.w > 0) { o += Math.min(r.w, s.w); n += 1; }
      }
      overlap.push({ a: funds[x].symbol, b: funds[y].symbol, inputs: [funds[x].index, funds[y].index], overlap: o, companies: n, basis: 'by company' });
    }
  }

  // Low-confidence share of ETF-derived exposure. Direct inputs carry no band.
  let lowI = 0, allI = 0;
  for (const c of list2) { allI += c.indirect; if (c.band === 'low') lowI += c.indirect; }
  const low_confidence = { low_indirect: lowI, total_indirect: allI, share_pct: allI !== 0 ? lowI / allI * 100 : null };

  // Reconciliation (§3.3): reported, checked, never forced.
  const companiesSum = list2.reduce((s, c) => s + c.combined, 0);
  const unallocated = 100 - validation.total;
  const total = companiesSum + lines.unmapped + lines.no_identifier + lines.redirect_unresolved + lines.residual
    + lines.unsupported + lines.not_loaded + unallocated;
  const reconciliation = { companies: companiesSum, unmapped: lines.unmapped, no_identifier: lines.no_identifier,
    redirect_unresolved: lines.redirect_unresolved, residual: lines.residual, unsupported: lines.unsupported,
    not_loaded: lines.not_loaded, unallocated, total, difference: total - 100, ok: Math.abs(total - 100) <= _EXP_TOL };

  // Months (§5.1): one per ETF; mixed when they differ; stale when > 3 months older than the newest stored month.
  const etfMonths = funds.map(f => ({ symbol: f.symbol, input: f.index, report_month: f.body.report_month ?? null,
    label: exp_monthLabel(f.body.report_month), filing_date: f.body.filing_date ?? null, previous_month: f.body.previous_month ?? null }));
  const distinct = [...new Set(etfMonths.map(m => m.report_month).filter(Boolean))];
  // W1R5: the reference month is the newest stored month across ALL ETFs, taken from the R-EXP1 bodies'
  // `newest_stored_month` (max over loaded inputs; an older cached body without it simply contributes nothing).
  // opts.newest_stored_month still overrides. Neither available → the W2 rule: newest month in this portfolio.
  let newest = _expMonthIndex(opts.newest_stored_month) != null ? opts.newest_stored_month : null;
  let newestSource = newest ? 'option' : null;
  if (!newest) {
    for (const f of funds) {
      const m = f.body.newest_stored_month;
      if (_expMonthIndex(m) != null && (newest == null || _expMonthIndex(m) > _expMonthIndex(newest))) newest = m;
    }
    if (newest) newestSource = 'route';
  }
  if (!newest) { for (const m of distinct) if (newest == null || _expMonthIndex(m) > _expMonthIndex(newest)) newest = m; if (newest) newestSource = 'portfolio'; }
  const ni = _expMonthIndex(newest);
  for (const m of etfMonths) {
    const mi = _expMonthIndex(m.report_month);
    m.months_behind = ni == null || mi == null ? null : ni - mi;
    m.stale = m.months_behind != null && m.months_behind > _EXP_STALE_MONTHS;
  }
  const months = { etfs: etfMonths, mixed: distinct.length > 1, newest_stored_month: newest, newest_source: newestSource,
    stale: etfMonths.filter(m => m.stale).map(m => m.symbol) };

  // Gaps: largest unmapped holdings (route sends each fund's top 25), unsupported inputs, load errors.
  const unmappedTop = [];
  for (const f of funds) {
    for (const u of Array.isArray(f.body.unmapped_top) ? f.body.unmapped_top : []) {
      if (!Array.isArray(u)) continue;
      const w = Number(u[2]) || 0;
      unmappedTop.push({ input: f.index, symbol: f.symbol, name: u[0] ?? null, key: u[1] ?? null, fund_weight: w, contribution: f.a * w / 100 });
    }
  }
  unmappedTop.sort((p, q) => (q.contribution - p.contribution) || String(p.name || '').localeCompare(String(q.name || '')));
  const gaps = { unmapped_top: unmappedTop,
    unsupported: outInputs.filter(r => r.status === 'unsupported' || r.status === 'invalid'),
    not_loaded: outInputs.filter(r => r.status === 'not_loaded' || r.status === 'pending') };

  const etfRows = outInputs.filter(r => r.type === 'etf');
  const state = etfRows.some(r => r.status === 'pending') ? 'loading'
    : etfRows.length > 0 && etfRows.every(r => r.status === 'not_loaded') ? 'total_failure'
    : etfRows.some(r => r.status === 'not_loaded') ? 'partial_failure' : 'ok';

  const delta = opts.previous ? _expDelta(funds, opts.previous) : null;

  return { state, validation, inputs: outInputs, companies: list2, shared, overlap, low_confidence, reconciliation, months, gaps, delta };
}

// §5.1 period comparison: Δc_{i,e} = a_i (f_{i,e}(m) − f_{i,e}(m′)) / 100; ΔE_e = Σ_i Δc_{i,e}; direct inputs have no Δ.
function _expDelta(funds, previous) {
  const etfs = [];
  const acc = new Map();
  for (const f of funds) {
    const cur = f.body.report_month ?? null;
    const prevMonth = f.body.previous_month ?? null;
    const base = { symbol: f.symbol, input: f.index, current: cur, previous: prevMonth };
    if (!prevMonth) { etfs.push({ ...base, status: 'no_previous', message: 'no earlier stored month' }); continue; }
    const oc = _expOutcome(_expGet(previous, f.symbol));
    if (oc.status !== 'computed') { etfs.push({ ...base, status: oc.status, reason: oc.reason || null, message: oc.message }); continue; }
    const pm = oc.body.report_month ?? prevMonth;
    etfs.push({ ...base, previous: pm, status: 'compared', label: `${exp_monthLabel(cur)} vs ${exp_monthLabel(pm)}` });
    const pf = _expFund(oc.body).f;
    const ids = new Set([...f.fund.f.keys(), ...pf.keys()]);
    for (const id of ids) {
      const c = f.fund.f.get(id), p = pf.get(id);
      let d = acc.get(id);
      if (!d) { d = { entity_id: id, name: null, current: 0, previous: 0, delta: 0, in_current: false, in_previous: false }; acc.set(id, d); }
      if (!d.name) d.name = (c && c.name) || (p && p.name) || null;
      if (c) { d.in_current = true; d.current += f.a * c.w / 100; }
      if (p) { d.in_previous = true; d.previous += f.a * p.w / 100; }
      d.delta += f.a * ((c ? c.w : 0) - (p ? p.w : 0)) / 100;
    }
  }
  const companies = [...acc.values()].map(d => ({ ...d, name: d.name || `Entity ${d.entity_id}`,
    status: d.in_current && !d.in_previous ? 'new' : !d.in_current && d.in_previous ? 'exited' : 'changed' }));
  companies.sort((a, b) => (Math.abs(b.delta) - Math.abs(a.delta)) || (String(a.name) < String(b.name) ? -1 : String(a.name) > String(b.name) ? 1 : a.entity_id - b.entity_id));
  return { etfs, companies };
}
// ===== end EXP (MA-NOV-EXP.W2) =====

// ===== EXP UI (MA-NOV-EXP.W3) =====
// Exposure-to-company screen, nav layer kind 'exposure' (spec claude/specs/MA-NOV-EXP_Spec.md §2, §5.1, §6, §7 UI states).
// Hash: #/exposure?i=ETF:EEM:50,EQ:2191:15 — the inputs live in the URL hash only (no storage). Calculation is the
// W2 block above (exp_validate / exp_combine / exp_compute); this block only fetches, renders and wires events.
// Reads: R-EXP1 /api/exposure/etf/{symbol}[?month=] once per ETF per session (in-memory maps; failed calls may be
// retried, settled 200/4xx answers are never requested again), /api/entities/search, /api/entities/{id} (names),
// /api/etf-list (proxy) for the picker; on expanding a company, /etf-exposure and /issuer-panels for evidence labels.
// Routing: the index.html router parses #/exposure and dispatches `ma:route` (MA-NOV-EXP.W3R2); the shared handler
// above opens the layer. This block only restores focus after Back from a company page.

const _EXP_SYM_RE = /^[A-Z0-9][A-Z0-9.\-]{0,14}$/;
const _EXP_EID_RE = /^[1-9]\d{0,9}$/;
const _EXP_ALLOC_RE = /^\d{0,3}(?:\.\d{0,2})?$/;
const _EXP_PAGE = 50;
const _EXP_BANNED = ['current ownership', 'all holders', 'complete', 'real-time'];   // §6 — never shown

// ── hash (pure) ─────────────────────────────────────────────────────────────
function _expAllocText(a) {
  if (a == null) return '';
  const t = typeof a === 'number' ? (Number.isFinite(a) ? String(_expCents(a)) : '') : String(a).trim();
  return _EXP_ALLOC_RE.test(t) ? t : '';
}
// inputs → "ETF:EEM:50,EQ:2191:15". Rows with no identity are left out (they cannot be restored).
function exp_hashSerialize(inputs) {
  return (Array.isArray(inputs) ? inputs : []).map(inp => {
    const t = _expType(inp);
    if (t === 'etf' && _EXP_SYM_RE.test(_expSymbol(inp))) return `ETF:${_expSymbol(inp)}:${_expAllocText(inp.allocation)}`;
    if (t === 'eq' && _EXP_EID_RE.test(String(inp.entity_id))) return `EQ:${Number(inp.entity_id)}:${_expAllocText(inp.allocation)}`;
    return null;
  }).filter(Boolean).join(',');
}
// "ETF:EEM:50,EQ:2191:15" → { inputs, rejected[] }. Allocations stay text so validation reports them as typed.
function exp_hashParse(str) {
  const inputs = [], rejected = [];
  for (const raw of String(str || '').split(',')) {
    const tok = raw.trim();
    if (!tok) continue;
    const m = /^(ETF|EQ):([^:]+):([^:]*)$/i.exec(tok);
    if (!m || !_EXP_ALLOC_RE.test(m[3])) { rejected.push(tok); continue; }
    const kind = m[1].toUpperCase();
    if (kind === 'ETF') {
      const sym = m[2].trim().toUpperCase();
      if (!_EXP_SYM_RE.test(sym)) { rejected.push(tok); continue; }
      inputs.push({ type: 'etf', symbol: sym, allocation: m[3] });
    } else {
      if (!_EXP_EID_RE.test(m[2])) { rejected.push(tok); continue; }
      inputs.push({ type: 'eq', entity_id: Number(m[2]), name: null, allocation: m[3] });
    }
  }
  return { inputs, rejected };
}
function exp_hashFor(id) { const s = String(id || ''); return s ? `#/exposure?i=${s}` : '#/exposure'; }
// location.hash → the i= string, or null when the hash is not an exposure hash.
function exp_hashOf(hash) {
  const m = /^#\/exposure(?:\?(.*))?$/.exec(String(hash || ''));
  if (!m) return null;
  const q = /(?:^|&)i=([^&]*)/.exec(m[1] || '');
  if (!q) return '';
  try { return decodeURIComponent(q[1]); } catch (e) { return ''; }
}

// ── state selection (pure) ─────────────────────────────────────────────────
// What the results area shows for an exp_compute result (§2 states). Partial failure still shows numbers.
function exp_viewState(res) {
  const s = res && res.state;
  return s === 'empty' || s === 'invalid' || s === 'loading' || s === 'total_failure' || s === 'partial_failure' ? s : (s === 'ok' ? 'results' : 'empty');
}
// UI.POLISH §3.3: plain wording for a failed or too-large look-through wherever the screen shows it (row badge,
// header chip, compare line). _expOutcome's messages are data-layer values tested by exp-compute and stay as they are.
function _expMsgUI(o) {
  if (o && o.status === 'not_loaded') return "couldn't load – try again";
  if (o && o.reason === 'too_large') return 'not supported: too large to look through here';
  return o ? o.message : '';
}
// Row badge for one input, from its look-through response alone (works while the list is still invalid).
function exp_rowStatus(inp, res) {
  if (_expType(inp) === 'eq') return { status: 'direct', cls: 'ok', text: 'direct holding · your stated allocation' };
  const oc = _expOutcome(res);
  if (oc.status === 'pending') return { status: 'pending', cls: 'wait', text: 'loading stored holdings…' };
  if (oc.status === 'computed') return { status: 'computed', cls: 'ok', text: `holdings available (${exp_monthLabel(oc.body.report_month)})` };
  if (oc.status === 'not_loaded') return { status: 'not_loaded', cls: 'err', text: _expMsgUI(oc), retry: true };
  return { status: oc.status, cls: 'warn', text: _expMsgUI(oc), reason: oc.reason || null };
}
// Chips/warnings shown above the numbers (§2 Screen B §1 and the state table).
function exp_viewFlags(res) {
  const m = res && res.months;
  const rows = (res && res.inputs) || [];
  return { mixed: Boolean(m && m.mixed), stale: m ? m.stale.slice() : [],
    unsupported: rows.filter(r => r.status === 'unsupported' || r.status === 'invalid').map(r => r.label),
    not_loaded: rows.filter(r => r.status === 'not_loaded').map(r => r.label) };
}

// ── session caches (memory only) ───────────────────────────────────────────
const _expLT = new Map();        // SYMBOL → settled R-EXP1 response (200 exp-1 or 4xx): never requested again
const _expLTFail = new Map();    // SYMBOL → last failed response (status 0 / 5xx / bad body): Retry allowed
const _expLTFlight = new Map();  // SYMBOL → in-flight promise
const _expPrev = new Map();      // 'SYMBOL|YYYY-MM' → previous-month response (Compare only)
const _expPrevFlight = new Map();
const _expEnt = new Map();       // entity_id → { name, resolved_id } | { error }
const _expEvid = new Map();      // entity_id → { etf, panels } evidence label data
let _expEtfList = null, _expEtfListP = null, _expEtfListErr = false;
let _expLTRequests = 0;          // look-through calls sent this session (diagnostic)

function _expuiGet(path) {
  if (typeof data_entitiesGet === 'function') return data_entitiesGet(path);
  return fetch(`${ENTITIES_API_URL}${path}`).then(async r => ({ ok: r.ok, status: r.status, data: await r.json().catch(() => null) }))
    .catch(e => ({ ok: false, status: 0, data: null, error: e && e.message }));
}
function _expSettled(res) { return _expOutcome(res).status !== 'not_loaded'; }
function _expLookthrough(sym) {
  if (_expLT.has(sym)) return Promise.resolve(_expLT.get(sym));
  if (_expLTFlight.has(sym)) return _expLTFlight.get(sym);
  _expLTRequests++;
  const p = _expuiGet(`/api/exposure/etf/${encodeURIComponent(sym)}`).then(r => {
    _expLTFlight.delete(sym);
    if (_expSettled(r)) { _expLT.set(sym, r); _expLTFail.delete(sym); } else _expLTFail.set(sym, r);
    return r;
  });
  _expLTFlight.set(sym, p);
  return p;
}
function _expPrevious(sym, month) {
  const k = `${sym}|${month}`;
  if (_expPrev.has(k)) return Promise.resolve(_expPrev.get(k));
  if (_expPrevFlight.has(k)) return _expPrevFlight.get(k);
  _expLTRequests++;
  const p = _expuiGet(`/api/exposure/etf/${encodeURIComponent(sym)}?month=${encodeURIComponent(month)}`).then(r => {
    _expPrevFlight.delete(k);
    _expPrev.set(k, r);   // failures are kept too and shown; Retry deletes the entry
    return r;
  });
  _expPrevFlight.set(k, p);
  return p;
}
function _expLoadEtfList() {
  if (_expEtfList || _expEtfListP) return _expEtfListP || Promise.resolve(_expEtfList);
  const base = typeof MY_WORKER_URL !== 'undefined' ? MY_WORKER_URL : null;
  if (!base) { _expEtfListErr = true; return Promise.resolve(null); }
  _expEtfListP = fetch(`${base}/api/etf-list?meta=fc`).then(r => (r.ok ? r.json() : null)).catch(() => null).then(list => {
    _expEtfListP = null;
    if (Array.isArray(list) && list.length) _expEtfList = list.filter(e => e && e.ticker).map(e => ({ ticker: String(e.ticker).toUpperCase(), name: e.name || '', hasNport: e.hasNport }));
    else _expEtfListErr = true;
    return _expEtfList;
  });
  return _expEtfListP;
}

// ── formatting ─────────────────────────────────────────────────────────────
function _expF(x) { const v = Number(x); if (!Number.isFinite(v)) return '—'; const s = (Math.abs(v) < 0.005 ? 0 : v).toFixed(2); return s; }
function _expPct(x) { return `${_expF(x)}%`; }
function _expBandLabel(b) { return b === 'high' ? 'High' : b === 'medium' ? 'Medium' : b === 'low' ? 'Low' : '—'; }
function _expToday() { return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
function _expDepth(layer) { return _navStack.indexOf(layer) + 1; }
function _expEntityHash(layer, id) { return _navHash('entity', Number(id), `exposure:${layer.id || ''}`); }

function _expStyleOnce() {
  if (typeof document === 'undefined' || !document.head || document.getElementById('exp-style')) return;
  const st = document.createElement('style');
  st.id = 'exp-style';
  st.textContent = `.exp-root{max-width:1100px;margin:0 auto;color:var(--text);font-size:12px}
.exp-root h2{font-size:15px;margin:0 0 4px;font-weight:700}.exp-root h3{font-size:11px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.05em;margin:18px 0 8px}
.exp-note{color:var(--text2);font-size:11px;line-height:1.5}.exp-root ul{list-style:disc;padding-left:18px;margin:4px 0}.exp-dim{color:var(--muted)}
.exp-card{border:1px solid var(--border);background:var(--bg3);border-radius:var(--r);padding:12px;margin-top:12px}
.exp-pickers{display:flex;gap:12px;flex-wrap:wrap}.exp-picker{position:relative;flex:1 1 280px;min-width:0}
.exp-picker label{display:block;font-size:10px;font-weight:700;color:var(--text2);margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em}
.exp-in{width:100%;box-sizing:border-box;padding:7px 10px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);color:var(--text);font-size:12px}
.exp-in:focus,.exp-alloc input:focus,.exp-btn:focus-visible,.exp-link:focus-visible,.exp-th:focus-visible{outline:2px solid var(--blue);outline-offset:1px}
.exp-dd{position:absolute;left:0;right:0;top:100%;z-index:5;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);max-height:280px;overflow-y:auto;display:none}
.exp-dd.open{display:block}.exp-opt{padding:6px 10px;cursor:pointer;display:flex;gap:8px;align-items:baseline;border-bottom:1px solid var(--border)}
.exp-opt[aria-selected=true],.exp-opt:hover{background:var(--blue-bg)}.exp-opt b{font-family:var(--mono);min-width:56px}
.exp-badge{display:inline-block;font-size:9px;font-weight:600;padding:1px 6px;border-radius:var(--r);border:1px solid var(--border);white-space:nowrap}
.exp-badge.ok{color:var(--green);border-color:var(--green-bd);background:var(--green-bg)}.exp-badge.warn{color:var(--amber);border-color:var(--amber-bd);background:var(--amber-bg)}
.exp-badge.err{color:var(--red);border-color:var(--red-bd);background:var(--red-bg)}.exp-badge.wait{color:var(--blue);border-color:var(--blue-bd);background:var(--blue-bg)}
.exp-row{display:grid;grid-template-columns:60px minmax(0,1fr) auto 104px auto;gap:6px 10px;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)}
.exp-row-type{font-size:9px;font-weight:700;color:var(--text2);text-transform:uppercase}.exp-row-label{min-width:0;overflow:hidden;text-overflow:ellipsis}
.exp-row-err{grid-column:2/-1;color:var(--red);font-size:11px}.exp-row-err:empty{display:none}
.exp-alloc{display:flex;align-items:center;gap:4px}.exp-alloc input{width:72px;padding:5px 6px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);color:var(--text);font-size:12px;text-align:right}
.exp-alloc input[aria-invalid=true]{border-color:var(--red)}
.exp-btn{background:none;border:1px solid var(--border);border-radius:var(--r);color:var(--text2);font-size:11px;padding:4px 9px;cursor:pointer}
.exp-btn:hover{border-color:var(--blue);color:var(--blue)}.exp-btn.primary{border-color:var(--blue-bd);color:var(--blue)}
.exp-link{color:var(--blue);text-decoration:none;cursor:pointer;background:none;border:none;padding:0;font-size:inherit;text-align:left}.exp-link:hover{text-decoration:underline}
.exp-total{margin-top:8px;font-size:12px}.exp-msgs div{margin-top:6px;color:var(--red);font-size:11px}
.exp-spin{display:inline-block;width:9px;height:9px;border:2px solid var(--blue-bd);border-top-color:var(--blue);border-radius:50%;animation:expspin .8s linear infinite;vertical-align:-1px;margin-right:4px}
@keyframes expspin{to{transform:rotate(360deg)}}
.exp-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.exp-chip{font-size:10px;padding:2px 8px;border:1px solid var(--border);border-radius:var(--r);background:var(--bg2);color:var(--text2)}
.exp-chip.warn{color:var(--amber);border-color:var(--amber-bd);background:var(--amber-bg)}
.exp-bar{display:flex;height:14px;border-radius:var(--r);overflow:hidden;background:var(--bg2);border:1px solid var(--border);margin:8px 0}
.exp-bar span{display:block;height:100%}.exp-leg{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:4px 16px}
.exp-leg div{display:flex;justify-content:space-between;gap:8px;font-size:11px;color:var(--text2);padding:2px 0;border-bottom:1px dotted var(--border)}
.exp-leg i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px;vertical-align:-1px}
.exp-tr{display:grid;grid-template-columns:minmax(0,2.4fr) 78px 70px 78px 72px 104px;gap:4px 10px;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:11px}
.exp-tr.head{font-size:9px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.05em}.exp-num{text-align:right;font-family:var(--mono)}
.exp-th{background:none;border:none;color:inherit;font:inherit;text-transform:inherit;letter-spacing:inherit;cursor:pointer;padding:0;width:100%;text-align:inherit}
.exp-detail{grid-column:1/-1;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:8px 10px;margin:2px 0 6px;font-size:11px;color:var(--text2)}
.exp-detail .exp-mob{display:none}.exp-detail ul{margin:4px 0;padding-left:16px}.exp-detail li{margin:2px 0}
.exp-tbl2{width:100%;border-collapse:collapse;font-size:11px}.exp-tbl2 td,.exp-tbl2 th{padding:4px 6px;border-bottom:1px solid var(--border);text-align:left}
.exp-tbl2 th{font-size:9px;color:var(--text2);text-transform:uppercase}.exp-tbl2 td.n{text-align:right;font-family:var(--mono)}
.exp-err-panel{border:1px solid var(--red-bd);background:var(--red-bg);border-radius:var(--r);padding:12px;margin-top:12px}
@media (max-width:600px){.exp-row{grid-template-columns:minmax(0,1fr) 96px auto}.exp-row-type{display:none}.exp-row-status{grid-column:1/-1;order:5}
.exp-row-err{grid-column:1/-1}.exp-tr{grid-template-columns:minmax(0,1fr) 72px 30px}.exp-tr .exp-opt-col{display:none}.exp-detail .exp-mob{display:block}
.exp-pickers{flex-direction:column}.exp-picker{flex:0 0 auto}.exp-tbl2 .exp-opt-col{display:none}}`;
  document.head.appendChild(st);
}

// ── layer ──────────────────────────────────────────────────────────────────
async function _navRenderExposure(layer, opts) {
  layer.title = 'Exposure';
  if (!layer.exp) {
    const p = exp_hashParse(layer.id || '');
    layer.exp = { inputs: p.inputs, rejected: p.rejected, sort: { key: 'combined', dir: -1 }, hideLow: false, compare: false,
      open: new Set(), limit: _EXP_PAGE };
  }
  _expStyleOnce();
  const d = _expDepth(layer);
  layer.el.innerHTML = _navShell(layer, `<div class="exp-root">
    <h2>Exposure to companies</h2>
    <div class="exp-note">Add the ETFs and shares you hold, each with its % of your portfolio. Meridian looks through each ETF's stored
      holdings and shows the companies you reach, directly and via ETFs. Inputs stay in this page's link; nothing is saved.</div>
    <section class="exp-card" aria-label="Inputs">
      <div class="exp-pickers">
        <div class="exp-picker"><label for="exp-etf-${d}">Add ETF</label>
          <input id="exp-etf-${d}" class="exp-in" data-exp-picker="etf" type="search" autocomplete="off" placeholder="Ticker or fund name (e.g. EEM)"
            role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="exp-etf-dd-${d}">
          <div class="exp-dd" id="exp-etf-dd-${d}" role="listbox" aria-label="ETFs"></div></div>
        <div class="exp-picker"><label for="exp-eq-${d}">Add company (direct holding)</label>
          <input id="exp-eq-${d}" class="exp-in" data-exp-picker="eq" type="search" autocomplete="off" placeholder="Company name"
            role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="exp-eq-dd-${d}">
          <div class="exp-dd" id="exp-eq-dd-${d}" role="listbox" aria-label="Companies"></div></div>
      </div>
      <div class="exp-picker-note exp-note exp-dim" style="margin-top:6px"></div>
      <div class="exp-rows" role="list" aria-label="Your inputs"></div>
      <div class="exp-total" aria-live="polite"></div>
      <div class="exp-msgs" role="alert"></div>
    </section>
    <section class="exp-results" aria-label="Results"></section>
  </div>`);
  _expWire(layer);
  _expLoadEtfList().then(() => { if (layer.el.isConnected) _expRefresh(layer, { rows: false }); });
  _expRefresh(layer);
}

function _expInputsKey(inputs) { return exp_hashSerialize(inputs); }

// Model changed or a fetch settled: sync the hash, start missing fetches, re-render.
function _expRefresh(layer, what) {
  if (!layer.el.isConnected) return;
  const st = layer.exp;
  const id = _expInputsKey(st.inputs);
  if (id !== layer.id) {
    layer.id = id;
    if (_navIsTop(layer) && history.state && history.state.maNav === _expDepth(layer)) history.replaceState(history.state, '', exp_hashFor(id));
  }
  _expEnsureFetches(layer);
  if (!what || what.rows !== false) _expRenderRows(layer);
  _expRenderResults(layer);
}

function _expEnsureFetches(layer) {
  const st = layer.exp;
  if (st.inputs.length > _EXP_MAX_INPUTS) return;   // over the limit: nothing is sent (budget §4.5)
  const again = () => _expRefresh(layer, { rows: true });
  for (const inp of st.inputs) {
    if (_expType(inp) === 'etf') {
      const s = _expSymbol(inp);
      if (s && !_expLT.has(s) && !_expLTFail.has(s) && !_expLTFlight.has(s)) _expLookthrough(s).then(again);
    } else if (_expType(inp) === 'eq' && !inp.name && !_expEnt.has(inp.entity_id)) {
      _expEnt.set(inp.entity_id, { pending: true });
      _expuiGet(`/api/entities/${Number(inp.entity_id)}`).then(r => {
        const e = r && r.ok && r.data && r.data.entity;
        _expEnt.set(inp.entity_id, e ? { name: e.legal_name || e.name || null, resolved_id: r.data.redirect ? Number(e.entity_id) : null } : { error: r ? r.status : 0 });
        again();
      });
    }
  }
  for (const inp of st.inputs) {   // apply known names / merge redirects to hash-loaded company rows
    if (_expType(inp) !== 'eq') continue;
    const k = _expEnt.get(inp.entity_id);
    if (k && k.name && !inp.name) inp.name = k.name;
    if (k && k.resolved_id && k.resolved_id !== Number(inp.entity_id)) inp.resolved_id = k.resolved_id;
  }
  if (st.compare) {
    for (const inp of st.inputs) {
      if (_expType(inp) !== 'etf') continue;
      const s = _expSymbol(inp), r = _expLT.get(s);
      const pm = r && r.status === 200 && r.data && r.data.previous_month;
      if (pm && !_expPrev.has(`${s}|${pm}`) && !_expPrevFlight.has(`${s}|${pm}`)) _expPrevious(s, pm).then(() => _expRefresh(layer, { rows: false }));
    }
  }
}

function _expLookthroughMap(inputs) {
  const m = new Map();
  for (const inp of inputs) {
    if (_expType(inp) !== 'etf') continue;
    const s = _expSymbol(inp);
    const r = _expLT.get(s) || (_expLTFlight.has(s) ? undefined : _expLTFail.get(s));
    if (r !== undefined) m.set(s, r);
  }
  return m;
}
function _expPreviousMap(inputs) {
  const m = new Map();
  for (const inp of inputs) {
    if (_expType(inp) !== 'etf') continue;
    const s = _expSymbol(inp), r = _expLT.get(s);
    const pm = r && r.status === 200 && r.data && r.data.previous_month;
    if (pm && _expPrev.has(`${s}|${pm}`)) m.set(s, _expPrev.get(`${s}|${pm}`));
  }
  return m;
}

// ── Screen A: rows, total, messages ─────────────────────────────────────────
function _expRenderRows(layer) {
  const root = layer.el, st = layer.exp;
  const rowsEl = root.querySelector('.exp-rows');
  if (!rowsEl) return;
  const v = exp_validate(st.inputs);
  const act = document.activeElement;
  const focusKey = act && root.contains(act) && act.dataset ? act.dataset.expFocus : null;
  const sel = focusKey && typeof act.selectionStart === 'number' ? [act.selectionStart, act.selectionEnd] : null;
  const d = _expDepth(layer);
  rowsEl.innerHTML = st.inputs.map((inp, i) => {
    const t = _expType(inp);
    const label = _expLabel(inp);
    const name = t === 'eq' ? (inp.name ? '' : (_expEnt.get(inp.entity_id) || {}).error ? 'name unavailable' : 'loading name…')
      : ((_expEtfList || []).find(e => e.ticker === _expSymbol(inp)) || {}).name || '';
    const s = exp_rowStatus(inp, _expLT.get(_expSymbol(inp)) || (_expLTFlight.has(_expSymbol(inp)) ? undefined : _expLTFail.get(_expSymbol(inp))));
    const errs = (v.rows[i] || { errors: [] }).errors.filter(e => e.code !== 'duplicate').map(e => e.message);
    const merged = t === 'eq' && inp.resolved_id ? ` <span class="exp-badge warn">merged record → #${_esc(inp.resolved_id)}</span>` : '';
    const lr = s.reason === 'too_large' ? _expOutcome(_expLT.get(_expSymbol(inp))) : null;
    const reason = lr && lr.holdings_count != null ? ` (${Number(lr.holdings_count).toLocaleString('en-US')} holdings)` : '';
    return `<div class="exp-row" role="listitem" aria-label="${_esc(label)}">
      <span class="exp-row-type">${t === 'etf' ? 'ETF' : 'Company'}</span>
      <span class="exp-row-label"><strong>${_esc(label)}</strong> <span class="exp-dim">${_esc(name)}</span>${merged}</span>
      <span class="exp-row-status"><span class="exp-badge ${s.cls}">${s.status === 'pending' ? '<span class="exp-spin" aria-hidden="true"></span>' : ''}${_esc(s.text)}${_esc(reason)}</span>${s.retry ? ` <button class="exp-btn" data-exp-act="retry" data-sym="${_esc(_expSymbol(inp))}">Retry</button>` : ''}</span>
      <label class="exp-alloc"><input data-exp-alloc="${i}" data-exp-focus="alloc-${i}" inputmode="decimal" value="${_esc(inp.allocation == null ? '' : String(inp.allocation))}"
        aria-label="Edit allocation % for ${_esc(label)}" aria-invalid="${errs.length ? 'true' : 'false'}" aria-describedby="exp-err-${d}-${i}">%</label>
      <button class="exp-btn" data-exp-act="remove" data-i="${i}" data-exp-focus="rm-${i}" aria-label="Remove ${_esc(label)}">Remove</button>
      <div class="exp-row-err" id="exp-err-${d}-${i}">${errs.map(_esc).join(' · ')}</div>
    </div>`;
  }).join('');
  const tot = root.querySelector('.exp-total');
  const statusTxt = v.total_status === 'ok' ? 'OK (100%)' : v.total_status === 'under' ? `under (${_expF(v.unallocated)}% unallocated)`
    : v.total_status === 'over' ? 'over: fix before results' : '';
  tot.innerHTML = v.empty ? '' : `Total <strong>${_expF(v.total)}%</strong> · <span class="exp-badge ${v.total_status === 'over' ? 'err' : v.total_status === 'ok' ? 'ok' : 'warn'}">${_esc(statusTxt)}</span>
    <span class="exp-dim"> · ${v.count} of ${_EXP_MAX_INPUTS} inputs</span>`;
  const msgs = [];
  if (st.rejected.length) msgs.push(`<div>Some inputs in the link could not be read and were left out: ${_esc(st.rejected.join(', '))}</div>`);
  for (const e of v.errors) {
    if (e.code === 'duplicate') {
      const dup = v.duplicates.find(x => x.indices.join() === (e.indices || []).join());
      msgs.push(`<div>${_esc(e.message)} <button class="exp-btn primary" data-exp-act="combine" data-idx="${_esc((e.indices || []).join(','))}">${_esc(dup ? dup.combine_label : 'Combine')}</button></div>`);
    } else msgs.push(`<div>${_esc(e.message)}</div>`);
  }
  root.querySelector('.exp-msgs').innerHTML = msgs.join('');
  const full = st.inputs.length >= _EXP_MAX_INPUTS;
  root.querySelectorAll('[data-exp-picker]').forEach(p => { p.disabled = full; });
  const pn = root.querySelector('.exp-picker-note');
  if (pn) pn.textContent = full ? `At most ${_EXP_MAX_INPUTS} inputs.` : (_expEtfListErr ? "Couldn't load the ETF list; type a ticker and press Enter." : '');
  if (focusKey) {
    const el = rowsEl.querySelector(`[data-exp-focus="${focusKey}"]`) || root.querySelector(`[data-exp-focus="${focusKey}"]`);
    if (el) { el.focus(); if (sel && el.setSelectionRange) try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* ignore */ } }
  }
}

function _expAdd(layer, inp) {
  const st = layer.exp;
  if (st.inputs.length >= _EXP_MAX_INPUTS) return;
  const v = exp_validate(st.inputs);
  const rest = _expCents(100 - (v.total || 0));
  inp.allocation = rest > 0 && rest <= 100 ? String(rest) : '';
  st.inputs.push(inp);
  st.limit = _EXP_PAGE;
  _expRefresh(layer);
  const el = layer.el.querySelector(`[data-exp-focus="alloc-${st.inputs.length - 1}"]`);
  if (el) { el.focus(); el.select && el.select(); }
}

// ── pickers ────────────────────────────────────────────────────────────────
function _expEtfOptions(q) {
  const s = String(q || '').trim().toUpperCase();
  if (!s) return [];
  const list = _expEtfList || [];
  const starts = list.filter(e => e.ticker.startsWith(s));
  const has = list.filter(e => !e.ticker.startsWith(s) && (e.ticker.includes(s) || e.name.toUpperCase().includes(s)));
  const out = [...starts, ...has].slice(0, 30);
  if (_EXP_SYM_RE.test(s) && !out.length) out.push({ ticker: s, name: 'not in the ETF list', hasNport: null, typed: true });
  return out;
}
function _expEtfBadge(e) {
  const r = _expLT.get(e.ticker);
  if (r) { const s = exp_rowStatus({ type: 'etf', symbol: e.ticker }, r); return `<span class="exp-badge ${s.cls}">${_esc(s.text)}</span>`; }
  if (e.hasNport === 0 || e.hasNport === false) return '<span class="exp-badge warn">not supported: no stored holdings</span>';
  if (e.typed) return '<span class="exp-badge">checked when added</span>';
  return '<span class="exp-badge ok">holdings available</span>';
}
function _expOpenDd(input, dd, html) {
  dd.innerHTML = html;
  const open = Boolean(html);
  dd.classList.toggle('open', open);
  input.setAttribute('aria-expanded', open ? 'true' : 'false');
  input.removeAttribute('aria-activedescendant');
}
function _expMoveSel(input, dd, step) {
  const opts = [...dd.querySelectorAll('.exp-opt')];
  if (!opts.length) return;
  let i = opts.findIndex(o => o.getAttribute('aria-selected') === 'true');
  opts.forEach(o => o.setAttribute('aria-selected', 'false'));
  i = i < 0 ? (step > 0 ? 0 : opts.length - 1) : (i + step + opts.length) % opts.length;
  opts[i].setAttribute('aria-selected', 'true');
  input.setAttribute('aria-activedescendant', opts[i].id);
  opts[i].scrollIntoView && opts[i].scrollIntoView({ block: 'nearest' });
}

function _expWire(layer) {
  const root = layer.el, st = layer.exp, d = _expDepth(layer);
  let eqTimer = null, eqSeq = 0;
  const etfIn = root.querySelector('[data-exp-picker="etf"]'), etfDd = root.querySelector(`#exp-etf-dd-${d}`);
  const eqIn = root.querySelector('[data-exp-picker="eq"]'), eqDd = root.querySelector(`#exp-eq-dd-${d}`);
  const renderEtf = () => {
    const opts = _expEtfOptions(etfIn.value);
    _expOpenDd(etfIn, etfDd, opts.map((e, i) => `<div class="exp-opt" role="option" id="exp-etf-o-${d}-${i}" aria-selected="false" data-sym="${_esc(e.ticker)}">
      <b>${_esc(e.ticker)}</b><span class="exp-dim" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${_esc(e.name)}</span>${_expEtfBadge(e)}</div>`).join(''));
  };
  const pickEtf = sym => { etfIn.value = ''; _expOpenDd(etfIn, etfDd, ''); _expAdd(layer, { type: 'etf', symbol: sym, allocation: '' }); };
  const pickEq = o => { eqIn.value = ''; _expOpenDd(eqIn, eqDd, ''); _expAdd(layer, { type: 'eq', entity_id: Number(o.dataset.id), name: o.dataset.name || null, allocation: '' }); };
  etfIn.addEventListener('input', () => { if (!_expEtfList && !_expEtfListErr) _expLoadEtfList().then(renderEtf); renderEtf(); });
  eqIn.addEventListener('input', () => {
    clearTimeout(eqTimer);
    const q = eqIn.value.trim();
    if (q.length < 2) { _expOpenDd(eqIn, eqDd, ''); return; }
    eqTimer = setTimeout(async () => {
      const seq = ++eqSeq;
      _expOpenDd(eqIn, eqDd, '<div class="exp-opt exp-dim" role="option" aria-disabled="true"><span class="exp-spin"></span>Searching…</div>');
      const r = await _expuiGet(`/api/entities/search?q=${encodeURIComponent(q)}`);
      if (seq !== eqSeq || !root.isConnected) return;
      const rows = (r.ok && r.data && r.data.results) || [];
      _expOpenDd(eqIn, eqDd, !r.ok ? `<div class="exp-opt exp-dim" role="option" aria-disabled="true">Couldn't reach Corporate Atlas — try again</div>`
        : !rows.length ? '<div class="exp-opt exp-dim" role="option" aria-disabled="true">No companies found</div>'
        : rows.slice(0, 20).map((x, i) => `<div class="exp-opt" role="option" id="exp-eq-o-${d}-${i}" aria-selected="false" data-id="${Number(x.entity_id)}" data-name="${_esc(x.legal_name || x.name || '')}">
            <span style="flex:1;min-width:0">${_esc(x.legal_name || x.name || '#' + x.entity_id)}</span><span class="exp-dim">${_esc([x.country, x.type].filter(Boolean).join(' · '))} · #${Number(x.entity_id)}</span></div>`).join(''));
    }, 250);
  });
  const keys = (input, dd, pick) => e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!dd.classList.contains('open') && input === etfIn) renderEtf(); _expMoveSel(input, dd, e.key === 'ArrowDown' ? 1 : -1); }
    else if (e.key === 'Enter') {
      const o = dd.querySelector('.exp-opt[aria-selected="true"]') || dd.querySelector('.exp-opt[data-sym],.exp-opt[data-id]');
      if (o && (o.dataset.sym || o.dataset.id)) { e.preventDefault(); pick(o); }
    } else if (e.key === 'Escape') { _expOpenDd(input, dd, ''); }
  };
  etfIn.addEventListener('keydown', keys(etfIn, etfDd, o => pickEtf(o.dataset.sym)));
  eqIn.addEventListener('keydown', keys(eqIn, eqDd, pickEq));
  etfDd.addEventListener('mousedown', e => { const o = e.target.closest('.exp-opt[data-sym]'); if (o) { e.preventDefault(); pickEtf(o.dataset.sym); } });
  eqDd.addEventListener('mousedown', e => { const o = e.target.closest('.exp-opt[data-id]'); if (o) { e.preventDefault(); pickEq(o); } });
  etfIn.addEventListener('blur', () => setTimeout(() => _expOpenDd(etfIn, etfDd, ''), 120));
  eqIn.addEventListener('blur', () => setTimeout(() => _expOpenDd(eqIn, eqDd, ''), 120));

  root.addEventListener('input', e => {
    const i = e.target && e.target.dataset ? e.target.dataset.expAlloc : undefined;
    if (i === undefined) return;
    const inp = st.inputs[Number(i)];
    if (!inp) return;
    inp.allocation = e.target.value.trim();
    _expRefresh(layer);
  });
  root.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.expToggle === 'hideLow') { st.hideLow = t.checked; _expRenderResults(layer); }
    else if (t.dataset.expToggle === 'compare') { st.compare = t.checked; _expRefresh(layer, { rows: false }); }
  });
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-exp-act]');
    if (!b || !root.contains(b)) return;
    const a = b.dataset.expAct;
    if (a === 'remove') { st.inputs.splice(Number(b.dataset.i), 1); _expRefresh(layer); const nx = root.querySelector(`[data-exp-focus="rm-${Math.min(Number(b.dataset.i), st.inputs.length - 1)}"]`) || etfIn; nx.focus(); }
    else if (a === 'combine') { st.inputs = exp_combine(st.inputs, b.dataset.idx.split(',').map(Number)); _expRefresh(layer); }
    else if (a === 'retry') { const s = b.dataset.sym; _expLTFail.delete(s); _expRefresh(layer); }
    else if (a === 'retry-all') { for (const inp of st.inputs) if (_expType(inp) === 'etf') _expLTFail.delete(_expSymbol(inp)); _expRefresh(layer); }
    else if (a === 'retry-prev') { _expPrev.delete(b.dataset.key); _expRefresh(layer, { rows: false }); }
    else if (a === 'sort') {
      const k = b.dataset.key;
      st.sort = st.sort.key === k ? { key: k, dir: -st.sort.dir } : { key: k, dir: k === 'name' ? 1 : -1 };
      _expRenderResults(layer);
      const h = root.querySelector(`[data-exp-act="sort"][data-key="${k}"]`); if (h) h.focus();
    }
    else if (a === 'more') { st.limit += _EXP_PAGE; _expRenderResults(layer); }
    else if (a === 'recon-details' || a === 'hide-low') {   // MA-NOV-EXP.W3R3 panel toggles (display only)
      if (a === 'recon-details') st.reconOpen = !st.reconOpen; else st.hideLow = !st.hideLow;
      _expRenderResults(layer);
      const h = root.querySelector(`[data-exp-act="${a}"]`); if (h) h.focus();
    }
    else if (a === 'expand') {
      const id = Number(b.dataset.id);
      if (st.open.has(id)) st.open.delete(id); else { st.open.add(id); _expLoadEvidence(layer, id); }
      _expRenderResults(layer);
      const h = root.querySelector(`[data-exp-act="expand"][data-id="${id}"]`); if (h) h.focus();
    }
    else if (a === 'entity') { e.preventDefault(); _expRememberLink(layer, b); _navOpen('entity', Number(b.dataset.id), { history: 'push', from: `exposure:${layer.id || ''}`, lastName: b.dataset.name || '' }); }
    else if (a === 'instrument') { e.preventDefault(); _navOpen('instrument', b.dataset.key, { history: 'push', from: `exposure:${layer.id || ''}` }); }
    else if (a === 'etf') {
      e.preventDefault();
      if (typeof openEtfDetailView === 'function') openEtfDetailView(b.dataset.sym);   // ma-etf.js global, if loaded (no import)
    }
  });
}

function _expLoadEvidence(layer, id) {
  if (_expEvid.has(id)) return;
  const ev = { etf: null, panels: null };
  _expEvid.set(id, ev);
  _expuiGet(`/api/entities/${id}/etf-exposure`).then(r => { ev.etf = r.ok && r.data ? r.data : { error: true }; if (layer.el.isConnected) _expRenderResults(layer); });
  _expuiGet(`/api/entities/${id}/issuer-panels`).then(r => { ev.panels = r.ok && r.data ? r.data : { error: true }; if (layer.el.isConnected) _expRenderResults(layer); });
}

// ── Screen B ───────────────────────────────────────────────────────────────
function _expRenderResults(layer) {
  const root = layer.el, st = layer.exp;
  const out = root.querySelector('.exp-results');
  if (!out) return;
  const lts = _expLookthroughMap(st.inputs);
  const res = exp_compute(st.inputs, lts, st.compare ? { previous: _expPreviousMap(st.inputs) } : undefined);
  layer.expResult = res;
  const view = exp_viewState(res);
  out.dataset.expView = view;
  if (view === 'empty') {
    out.innerHTML = `<div class="exp-card exp-note">No inputs yet. Add an ETF or a company above, then give each one its % of your portfolio.
      Allocations may total less than 100%; the rest is shown as unallocated. Over 100% is blocked.</div>`;
    return;
  }
  if (view === 'invalid') {
    const rules = [...new Set([...res.validation.errors.map(e => e.message), ...res.validation.rows.flatMap(r => r.errors.map(e => e.message))])];
    out.innerHTML = `<div class="exp-card"><strong>Results are hidden until the inputs are fixed.</strong><ul class="exp-note">${rules.map(m => `<li>${_esc(m)}</li>`).join('')}</ul></div>`;
    return;
  }
  if (view === 'loading') {
    const pend = res.inputs.filter(r => r.status === 'pending').map(r => r.label);
    out.innerHTML = `<div class="exp-card" aria-busy="true"><span class="exp-spin" aria-hidden="true"></span>Loading stored holdings for ${_esc(pend.join(', '))}… Results appear once every input has loaded.</div>`;
    return;
  }
  if (view === 'total_failure') {
    out.innerHTML = `<div class="exp-err-panel" role="alert"><strong>Couldn't load holdings for any ETF input.</strong>
      <div class="exp-note">Corporate Atlas could not be reached, or no fund's holdings could be loaded. No numbers are shown.</div>
      <button class="exp-btn primary" style="margin-top:8px" data-exp-act="retry-all">Retry</button></div>`;
    return;
  }
  out.innerHTML = [_expHeaderHtml(res), _expReconHtml(res, layer), _expTableHtml(layer, res), _expSharedHtml(layer, res),
    _expGapsHtml(layer, res), _expCompareHtml(layer, res)].join('');
}

function _expHeaderHtml(res) {
  const f = exp_viewFlags(res);
  const ins = res.inputs.map(r => `<span class="exp-chip">${_esc(r.label)} ${_expF(r.allocation)}%${r.type === 'eq' ? ' · direct' : ''}</span>`).join('');
  const dates = res.inputs.map(r => {
    if (r.type === 'eq') return `<span class="exp-chip">${_esc(r.label)} · your stated allocation</span>`;
    if (r.status !== 'computed') return `<span class="exp-chip warn">${_esc(r.label)} · ${_esc(_expMsgUI(r))}</span>`;
    const stale = f.stale.includes(r.symbol);
    return `<span class="exp-chip${stale ? ' warn' : ''}">${_esc(r.symbol)} · ${_esc(exp_monthLabel(r.report_month))} · filed ${_esc(_navFmtDate(r.filing_date) || '—')} · from SEC N-PORT${stale ? ' · older data' : ''}</span>`;
  }).join('');
  const etfMonths = res.months.etfs;
  const warn = [];
  if (f.mixed) warn.push(`<span class="exp-chip warn">Mixed months: ${_esc([...new Set(etfMonths.map(m => m.label))].join(', '))}. Each ETF uses its own latest stored month.</span>`);
  if (f.stale.length && res.months.newest_source === 'portfolio') {
    // W2 wording, used only when no look-through body carries newest_stored_month (older cached bodies).
    warn.push(`<span class="exp-chip warn">Older data: ${_esc(f.stale.join(', '))} — more than 3 months older than the newest holdings we store here (${_esc(exp_monthLabel(res.months.newest_stored_month))})</span>`);
  } else if (f.stale.length) {
    // W1R5: reference month is the newest stored month across all ETFs (R-EXP1 newest_stored_month).
    // UI.POLISH §3.3: one chip; the newest stored month is named inside it (was a separate "newest stored" chip).
    warn.push(`<span class="exp-chip warn">Older data: ${_esc(f.stale.join(', '))} — more than 3 months older than the newest holdings we store (${_esc(exp_monthLabel(res.months.newest_stored_month))})</span>`);
  }
  if (f.not_loaded.length) warn.push(`<span class="exp-chip warn">Partial result: ${_esc(f.not_loaded.join(', '))} couldn't load — see What we couldn't analyse</span>`);
  const comp = res.inputs.map(r => r.computed_at).filter(Boolean).sort()[0];
  return `<div class="exp-card">
    <div class="exp-note">Computed in your browser on ${_esc(_expToday())} from stored holdings; not live positions.${comp ? ` Company mappings as of ${_esc(_navFmtDate(comp))}.` : ''}</div>
    <div class="exp-chips" aria-label="Inputs">${ins}</div>
    <div class="exp-chips" aria-label="Holdings dates"><span style="font-size:10px;align-self:center;color:var(--text2)">Holdings dates:</span>${dates}</div>
    ${warn.length ? `<div class="exp-chips" role="note">${warn.join('')}</div>` : ''}</div>`;
}

// MA-NOV-EXP.W3R3: plain-language panel "What your portfolio is made of" (Founder-approved wording, Task v1).
// Grouping only; every value comes from exp_compute's reconciliation, nothing is recalculated or forced.
const _EXP_RECON_GROUPS = [
  ['companies', 'Companies we could identify', 'var(--blue)'],
  ['unmatched', "Holdings we couldn't match to a company", 'var(--amber)'],
  ['residual', 'Fund cash, derivatives and other items', 'var(--dim)'],
  ['unsupported', 'Not analysed', 'var(--red)'],
  ['not_loaded', "Couldn't load", 'var(--red-bd)'],
  ['unallocated', 'Not allocated', 'var(--border)'],
];
const _EXP_RECON_DETAILS = [
  ['unmapped', 'Not linked to a company in our data'],
  ['no_identifier', "No identifier in the fund's filing"],
  ['redirect_unresolved', "Linked to a merged record we couldn't resolve"],
];
const _EXP_RESIDUAL_TIP = 'What the funds report outside their listed holdings, such as cash, derivatives and borrowings. It can be slightly negative.';
const _EXP_RECON_NOTE = "We don't guess. Anything we can't match to a company is shown separately, never spread across other companies.";
// One plain sentence per unsupported input, by route outcome (422 too large / 404 no holdings / unknown, month, invalid).
function exp_unsupportedSentence(r) {
  if (r && r.reason === 'too_large') return 'This fund is too large to look through here.';
  if (r && r.reason === 'no_holdings') return "We don't have this fund's holdings.";
  return "We don't recognise this fund.";
}
// Panel model (pure): lines in display order with 0.00% lines hidden (except the first), the sum line and the confidence share.
function exp_reconModel(res) {
  const rc = res.reconciliation;
  const z = v => _expF(v) === '0.00';
  const unmatched = rc.unmapped + rc.no_identifier + rc.redirect_unresolved;
  const lines = [{ key: 'companies', label: _EXP_RECON_GROUPS[0][1], value: rc.companies }];
  if (!z(unmatched)) lines.push({ key: 'unmatched', label: _EXP_RECON_GROUPS[1][1], value: unmatched,
    details: _EXP_RECON_DETAILS.filter(([k]) => !z(rc[k])).map(([k, l]) => ({ key: k, label: l, value: rc[k] })) });
  if (!z(rc.residual)) lines.push({ key: 'residual', label: _EXP_RECON_GROUPS[2][1], value: rc.residual, tip: _EXP_RESIDUAL_TIP });
  for (const r of (res.gaps && res.gaps.unsupported) || []) if (!z(r.allocation))
    lines.push({ key: 'unsupported', label: `Not analysed: ${r.label} (${_expF(r.allocation)}%)`, value: r.allocation, symbol: r.label, sentence: exp_unsupportedSentence(r) });
  for (const r of (res.gaps && res.gaps.not_loaded) || []) if (!z(r.allocation))
    lines.push({ key: 'not_loaded', label: `Couldn't load: ${r.label} (${_expF(r.allocation)}%)`, value: r.allocation, symbol: r.symbol || r.label, retry: true });
  if (!z(rc.unallocated)) lines.push({ key: 'unallocated', label: _EXP_RECON_GROUPS[5][1], value: rc.unallocated });
  const sum = rc.ok ? '✓ Adds up to 100%' : `⚠ Doesn't add up to 100% (${_expF(rc.total)}%). Please report this.`;
  const lc = res.low_confidence;
  const n = lc && lc.share_pct != null && Number.isFinite(lc.share_pct) ? Math.round(lc.share_pct) : 0;
  const confidence = n === 0 ? null : `About ${n}% of the company exposure from your ETFs relies on lower-confidence matching. Treat those companies as indicative.`;
  // Bar: one segment per group (same grouping as the lines); negative and zero segments are not drawn.
  const groups = { companies: rc.companies, unmatched, residual: rc.residual, unsupported: rc.unsupported, not_loaded: rc.not_loaded, unallocated: rc.unallocated };
  const bar = _EXP_RECON_GROUPS.filter(([k]) => groups[k] > 0 && !z(groups[k])).map(([k, l, c]) => ({ key: k, label: l, color: c, value: groups[k] }));
  return { lines, sum, ok: rc.ok, total: rc.total, confidence, confidence_pct: n, bar };
}
function _expReconHtml(res, layer) {
  const st = (layer && layer.exp) || {};
  const m = exp_reconModel(res);
  const pos = m.bar.reduce((s, g) => s + g.value, 0) || 1;
  const bar = m.bar.map(g => `<span style="width:${(g.value / pos * 100).toFixed(3)}%;background:${g.color}" title="${_esc(g.label)} ${_expPct(g.value)}"></span>`).join('');
  const color = k => (_EXP_RECON_GROUPS.find(([g]) => g === k) || [])[2] || 'var(--border)';
  const leg = m.lines.map(l => {
    const extra = l.details ? ` <button class="exp-btn" style="padding:0 6px" data-exp-act="recon-details" aria-expanded="${st.reconOpen ? 'true' : 'false'}">${st.reconOpen ? '▾' : '▸'} details</button>`
      : l.tip ? ` <span tabindex="0" title="${_esc(l.tip)}" aria-label="${_esc(l.tip)}" style="cursor:help">ⓘ</span>`
      : l.retry ? ` <button class="exp-btn" style="padding:0 6px" data-exp-act="retry" data-sym="${_esc(l.symbol)}">Retry</button>` : '';
    const row = `<div><span><i style="background:${color(l.key)}"></i>${_esc(l.label)}${extra}</span>${l.key === 'unsupported' || l.key === 'not_loaded' ? '' : `<span class="exp-num">${_expPct(l.value)}</span>`}</div>`;
    const sent = l.sentence ? `<div><span class="exp-dim" style="padding-left:15px">${_esc(l.sentence)}</span></div>` : '';
    const det = l.details && st.reconOpen ? l.details.map(d => `<div><span style="padding-left:15px">${_esc(d.label)}</span><span class="exp-num">${_expPct(d.value)}</span></div>`).join('') : '';
    return row + sent + det;
  }).join('');
  const conf = m.confidence ? `<div class="exp-note" style="margin-top:6px">${_esc(m.confidence)}
      <button class="exp-btn" style="padding:0 6px" data-exp-act="hide-low" aria-pressed="${st.hideLow ? 'true' : 'false'}">${st.hideLow ? 'Show them' : 'Hide them'}</button></div>` : '';
  return `<div class="exp-card"><h3 style="margin-top:0">What your portfolio is made of</h3>
    <div class="exp-bar" role="img" aria-label="What your portfolio is made of; the parts add to ${_expF(m.total)}%">${bar}</div>
    <div class="exp-leg" style="grid-template-columns:1fr;max-width:620px">${leg}</div>
    <div style="margin-top:6px"><strong>${_esc(m.sum)}</strong></div>
    <div class="exp-note" style="margin-top:4px;font-size:10px">${_esc(_EXP_RECON_NOTE)}</div>
    ${conf}</div>`;
}

function _expSorted(list, sort) {
  const k = sort.key, dir = sort.dir;
  const val = c => k === 'name' ? String(c.name || '').toLowerCase() : k === 'band' ? (c.band ? _EXP_BAND_RANK[c.band] : -1) : c[k];
  return list.slice().sort((a, b) => { const x = val(a), y = val(b); if (x < y) return -dir; if (x > y) return dir; return _expCompanySort(a, b); });
}

function _expTableHtml(layer, res) {
  const st = layer.exp;
  const all = _expSorted(res.companies, st.sort);
  const hidden = st.hideLow ? all.filter(c => c.band === 'low') : [];
  const list = st.hideLow ? all.filter(c => c.band !== 'low') : all;
  const shown = list.slice(0, st.limit);
  const th = (k, l, cls) => {
    const on = st.sort.key === k;
    return `<span class="${cls || ''}" role="columnheader" aria-sort="${on ? (st.sort.dir > 0 ? 'ascending' : 'descending') : 'none'}">
      <button class="exp-th" data-exp-act="sort" data-key="${k}">${l}${on ? (st.sort.dir > 0 ? ' ▲' : ' ▼') : ''}</button></span>`;
  };
  const rows = shown.map(c => {
    const open = st.open.has(c.entity_id);
    const conf = c.band ? `<span class="exp-badge ${c.band === 'low' ? 'warn' : 'ok'}">${_expBandLabel(c.band)}${c.contributions.some(x => (x.tiers || []).includes('heuristic')) ? ' (name match)' : ''}</span>` : '<span class="exp-dim">— direct</span>';
    const notes = c.notes.length ? ` <span class="exp-badge warn">${_esc(c.notes.join(' · '))}</span>` : '';
    return `<div class="exp-tr" role="row">
      <span role="cell" style="min-width:0;overflow:hidden;text-overflow:ellipsis"><a class="exp-link" href="${_esc(_expEntityHash(layer, c.entity_id))}" data-exp-act="entity" data-id="${c.entity_id}" data-name="${_esc(c.name)}">${_esc(c.name)}</a>${notes}</span>
      <span role="cell" class="exp-num"><strong>${_expPct(c.combined)}</strong></span>
      <span role="cell" class="exp-num exp-opt-col">${_expF(c.direct)}</span>
      <span role="cell" class="exp-num exp-opt-col">${_expF(c.indirect)}</span>
      <span role="cell" class="exp-num"><button class="exp-btn" style="padding:2px 6px" data-exp-act="expand" data-id="${c.entity_id}" aria-expanded="${open}" aria-label="${c.k} inputs reach ${_esc(c.name)}; ${open ? 'hide' : 'show'} contributions">${c.k} ${open ? '▾' : '▸'}</button></span>
      <span role="cell" class="exp-opt-col">${conf}</span>
      ${open ? _expDetailHtml(layer, res, c, conf) : ''}
    </div>`;
  }).join('');
  const hiddenSum = hidden.reduce((s, c) => s + c.combined, 0);
  return `<div class="exp-card"><h3 style="margin-top:0">Companies (${res.companies.length})</h3>
    <label class="exp-note" style="display:inline-flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" data-exp-toggle="hideLow" ${st.hideLow ? 'checked' : ''}>
      Hide low-confidence (display only; numbers above are unchanged)</label>
    ${hidden.length ? `<div class="exp-chip warn" style="margin-top:6px;display:inline-block">Low-confidence (hidden): ${hidden.length} companies · ${_expPct(hiddenSum)} combined — still counted in every total</div>` : ''}
    <div role="table" aria-label="Companies by combined exposure" style="margin-top:8px">
      <div class="exp-tr head" role="row">${th('name', 'Company')}${th('combined', 'Combined %', 'exp-num')}${th('direct', 'Direct %', 'exp-num exp-opt-col')}${th('indirect', 'Via ETFs %', 'exp-num exp-opt-col')}${th('k', 'Inputs', 'exp-num')}${th('band', 'Mapping confidence', 'exp-opt-col')}</div>
      ${rows || '<div class="exp-note" style="padding:8px 0">No companies to show.</div>'}
    </div>
    ${list.length > shown.length ? `<button class="exp-btn" style="margin-top:8px" data-exp-act="more">Show ${Math.min(_EXP_PAGE, list.length - shown.length)} more (${list.length - shown.length} not shown)</button>` : ''}
  </div>`;
}

// §2 Screen B §5 (drill-down) + §6 evidence labels. Mobile shows the hidden columns here too.
function _expDetailHtml(layer, res, c, conf) {
  const lines = c.contributions.map(x => {
    if (x.kind === 'direct') return `<li>${_esc(x.label)} — direct holding: your stated allocation <strong>${_expPct(x.contribution)}</strong></li>`;
    const inp = res.inputs.find(r => r.index === x.input) || {};
    const ev = `<a class="exp-link" href="#" data-exp-act="etf" data-sym="${_esc(x.symbol)}" title="Opens ETF Holdings, which closes this result; the browser's Forward button returns to it">Holdings ${_esc(exp_monthLabel(inp.report_month))}, filed ${_esc(_navFmtDate(inp.filing_date) || '—')}</a>`;
    return `<li><strong>${_esc(x.symbol)}</strong>: ${_expPct(x.allocation)} allocation × ${_expPct(x.fund_weight)} fund weight = <strong>${_expPct(x.contribution)}</strong>
      · ${x.holdings} holding row${x.holdings === 1 ? '' : 's'} · tier ${_esc((x.tiers || []).map(_navSourceLabel).join(', ') || '—')} · ${_esc(_expBandLabel(x.band))}${x.merged ? ' · merged record' : ''} · ${ev}</li>`;
  }).join('');
  const href = _esc(_expEntityHash(layer, c.entity_id));
  const evd = _expEvid.get(c.entity_id) || {};
  const months = !evd.etf ? 'months loading…' : evd.etf.error ? 'months unavailable'
    : evd.etf.months_min ? `months ${exp_monthLabel(evd.etf.months_min)}–${exp_monthLabel(evd.etf.months_max)}` : 'no months recorded for this company';
  const own = evd.panels && !evd.panels.error && Array.isArray(evd.panels.ownership) && evd.panels.ownership[0] ? evd.panels.ownership[0].report_period : null;
  const period = !evd.panels ? 'quarter loading…' : own ? `quarter ending ${own}` : 'no 13F rows stored for this company';
  const link = l => `<li><a class="exp-link" href="${href}" data-exp-act="entity" data-id="${c.entity_id}" data-name="${_esc(c.name)}">${_esc(l)}</a></li>`;
  return `<div class="exp-detail" role="cell">
    <div class="exp-mob">Direct ${_expPct(c.direct)} · via ETFs ${_expPct(c.indirect)} · ${conf}</div>
    <strong>Contributions</strong> <span class="exp-dim">(allocation × fund weight = contribution)</span><ul>${lines}</ul>
    <strong>Evidence on the company page</strong><ul>
      ${link('Instruments mapped to this issuer; mapping tier shown')}
      ${link(_expEtfList ? `Funds in Meridian's N-PORT set (${_expEtfList.filter(e => e.hasNport === 1 || e.hasNport === true).length} of ${_expEtfList.length} listed ETFs have stored holdings); ${months}; not all ETFs` : `Funds in Meridian's N-PORT set; ${months}; not all ETFs`)}
      ${link(`13F-HR filers in Meridian's set, ${period}; US-listed long positions only; not total ownership`)}
      ${link('SEC-registered offerings parsed for 30 configured issuers since 2024-01-01; final records only')}
    </ul></div>`;
}

function _expSharedHtml(layer, res) {
  const sh = res.shared.slice(0, 15).map(c => `<tr><td><a class="exp-link" href="${_esc(_expEntityHash(layer, c.entity_id))}" data-exp-act="entity" data-id="${c.entity_id}" data-name="${_esc(c.name)}">${_esc(c.name)}</a></td>
    <td class="n">${c.k}</td><td class="n">${_expPct(c.combined)}</td></tr>`).join('');
  const ov = res.overlap.map(o => `<tr><td>${_esc(o.a)} × ${_esc(o.b)}</td><td class="n">${_expPct(o.overlap)}</td><td class="n">${o.companies}</td></tr>`).join('');
  return `<div class="exp-card"><h3 style="margin-top:0">Shared exposure</h3>
    <div class="exp-note">${res.shared.length} compan${res.shared.length === 1 ? 'y is' : 'ies are'} reached by 2 or more inputs.${res.shared.length > 15 ? ' Top 15 shown.' : ''}</div>
    ${sh ? `<table class="exp-tbl2"><thead><tr><th>Company</th><th>Inputs</th><th>Combined</th></tr></thead><tbody>${sh}</tbody></table>` : ''}
    ${ov ? `<div class="exp-note" style="margin-top:10px"><strong>ETF overlap by company</strong> — for each company both funds hold, the smaller of its two fund weights, added up. The ETF page's overlap is by security, so the numbers differ.</div>
      <table class="exp-tbl2"><thead><tr><th>ETF pair</th><th>Overlap by company</th><th>Companies</th></tr></thead><tbody>${ov}</tbody></table>` : ''}</div>`;
}

function _expGapsHtml(layer, res) {
  const g = res.gaps;
  const top = g.unmapped_top.slice(0, 25).map(u => `<tr><td>${_esc(u.name || '—')}</td><td>${_esc(u.symbol)}</td>
    <td class="exp-opt-col" style="font-family:var(--mono)">${_esc(u.key || 'no identifier')}</td><td class="n">${_expPct(u.fund_weight)}</td><td class="n">${_expPct(u.contribution)}</td>
    <td>${u.key ? `<a class="exp-link" href="${_esc(_navHash('instrument', u.key, `exposure:${layer.id || ''}`))}" data-exp-act="instrument" data-key="${_esc(u.key)}">Not mapped to a company</a>` : '<span class="exp-dim">Not mapped to a company</span>'}</td></tr>`).join('');
  // UI.POLISH §3.1: one plain sentence per input (exp_unsupportedSentence); too large also names the holdings count.
  const why = r => r.reason === 'too_large' && r.holdings_count != null
    ? exp_unsupportedSentence(r).replace(/\.$/, ` (${Number(r.holdings_count).toLocaleString('en-US')} holdings).`)
    : exp_unsupportedSentence(r);
  const uns = g.unsupported.map(r => `<li><strong>${_esc(r.label)}</strong> ${_expPct(r.allocation)} — ${_esc(why(r))}</li>`).join('');
  const nl = g.not_loaded.map(r => `<li><strong>${_esc(r.label)}</strong> ${_expPct(r.allocation)} — the request failed. <button class="exp-btn" data-exp-act="retry" data-sym="${_esc(r.symbol)}">Try again</button></li>`).join('');
  return `<div class="exp-card"><h3 style="margin-top:0">What we couldn't analyse</h3>
    ${top ? `<div class="exp-note">The largest holdings we couldn't match to a company, by their share of your portfolio (up to 25 per fund).</div>
      <table class="exp-tbl2"><thead><tr><th>Holding</th><th>ETF</th><th class="exp-opt-col">Identifier</th><th>Share of fund</th><th>Share of your portfolio</th><th></th></tr></thead><tbody>${top}</tbody></table>`
      : '<div class="exp-note">Every holding in these funds was matched to a company.</div>'}
    ${uns ? `<div class="exp-note" style="margin-top:10px"><strong>Not analysed</strong> (shown as "Not analysed" in What your portfolio is made of)</div><ul class="exp-note">${uns}</ul>` : ''}
    ${nl ? `<div class="exp-note" style="margin-top:10px"><strong>Couldn't load</strong> (shown as "Couldn't load" in What your portfolio is made of)</div><ul class="exp-note">${nl}</ul>` : ''}</div>`;
}

function _expCompareHtml(layer, res) {
  const st = layer.exp;
  const hasEtf = res.inputs.some(r => r.status === 'computed');
  if (!hasEtf) return '';
  let body = '';
  if (st.compare && res.delta) {
    const etfs = res.delta.etfs.map(e => {
      if (e.status === 'compared') return `<li><strong>${_esc(e.symbol)}</strong>: ${_esc(e.label)}</li>`;
      if (e.status === 'no_previous') return `<li><strong>${_esc(e.symbol)}</strong>: ${_esc(exp_monthLabel(e.current))} — no earlier stored month</li>`;
      if (e.status === 'pending') return `<li><strong>${_esc(e.symbol)}</strong>: <span class="exp-spin" aria-hidden="true"></span>loading ${_esc(exp_monthLabel(e.previous))}…</li>`;
      return `<li><strong>${_esc(e.symbol)}</strong>: ${_esc(exp_monthLabel(e.previous))} ${_esc(_expMsgUI(e))} ${e.status === 'not_loaded' ? `<button class="exp-btn" data-exp-act="retry-prev" data-key="${_esc(`${e.symbol}|${e.previous}`)}">Retry</button>` : ''}</li>`;
    }).join('');
    const rows = res.delta.companies.slice(0, 25).map(c => `<tr><td><a class="exp-link" href="${_esc(_expEntityHash(layer, c.entity_id))}" data-exp-act="entity" data-id="${c.entity_id}" data-name="${_esc(c.name)}">${_esc(c.name)}</a>${c.status !== 'changed' ? ` <span class="exp-badge warn">${c.status}</span>` : ''}</td>
      <td class="n exp-opt-col">${_expF(c.previous)}</td><td class="n exp-opt-col">${_expF(c.current)}</td><td class="n"><strong>${c.delta > 0 ? '+' : ''}${_expF(c.delta)}</strong></td></tr>`).join('');
    body = `<ul class="exp-note">${etfs}</ul>${rows ? `<div class="exp-note">Largest changes in via-ETF exposure (percentage points of your portfolio; direct holdings have no change). Top 25 by size.</div>
      <table class="exp-tbl2"><thead><tr><th>Company</th><th class="exp-opt-col">Previous</th><th class="exp-opt-col">Latest</th><th>Δ</th></tr></thead><tbody>${rows}</tbody></table>` : ''}`;
  }
  return `<div class="exp-card"><h3 style="margin-top:0">Period comparison</h3>
    <label class="exp-note" style="display:inline-flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" data-exp-toggle="compare" ${st.compare ? 'checked' : ''}>
      Compare with previous stored month</label>${body}</div>`;
}

// ── focus after Back (MA-NOV-EXP.W3R2, N-3) ────────────────────────────────────────────────────
// Remember the company link that opened a page; when Back returns to this layer, focus it again. Results may have
// re-rendered meanwhile, so fall back to the same company's link in the same card, then any card, then the results heading.
function _expRememberLink(layer, a) {
  const cards = [...layer.el.querySelectorAll('.exp-results .exp-card')];
  layer.exp.returnTo = { el: a, id: Number(a.dataset.id), card: cards.indexOf(a.closest('.exp-card')) };
}
function _expRestoreFocus(layer) {
  const r = layer.exp && layer.exp.returnTo, root = layer.el;
  let el = null;
  if (r) {
    layer.exp.returnTo = null;
    const sel = `[data-exp-act="entity"][data-id="${Number(r.id)}"]`;
    el = r.el && r.el.isConnected && root.contains(r.el) ? r.el : null;
    if (!el && r.card >= 0) { const c = root.querySelectorAll('.exp-results .exp-card')[r.card]; el = c ? c.querySelector(sel) : null; }
    if (!el) el = root.querySelector(`.exp-results ${sel}`);
  }
  if (el) { el.focus({ preventScroll: true }); return el; }
  const h = root.querySelector('.exp-results h3') || root.querySelector('h2');
  if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
  return h;
}
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  // Registered after the shared `ma:route` handler, so the layers above have already been closed.
  document.addEventListener('ma:route', e => {
    const d = e.detail || {};
    if (d.mode !== 'pop') return;
    const top = _navStack[_navStack.length - 1];
    if (top && top.kind === 'exposure' && top.el.isConnected) _expRestoreFocus(top);
  });
}
// ===== end EXP UI (MA-NOV-EXP.W3) =====
