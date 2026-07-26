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

function _buildEntityDetailHTML(entity, backLabel, backHandler) {
  backLabel   = backLabel   || 'Galaxy';
  backHandler = backHandler || 'restoreEntityPreviousView()';

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

  function _ownershipRow(name, lei, exception) {
    if (name) return `<strong>${_esc(name)}</strong>${lei ? `<br><span style="font-family:var(--mono);font-size:9px;color:var(--dim)">${_esc(lei)}</span>` : ''}`;
    if (exception) return `<span style="color:var(--dim)">None reported</span><br><span style="color:var(--muted);font-size:10px">Reason: ${_esc(exception)}</span>`;
    return '<span style="color:var(--dim)">Not reported</span>';
  }

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

      <!-- ETF Exposure strip -->
      <div style="margin:0 16px 16px;padding:14px 16px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r)" id="etf-exposure-section-${entity.entity_id}">
        <div style="font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--dim);margin-bottom:10px">ETF Exposure</div>
        <div style="color:var(--dim);font-size:11px">Loading exposure data…</div>
      </div>

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

  let entity;
  try {
    const res = await fetch(`${ENTITIES_API_URL}/api/entities/${entityId}`);
    if (res.status === 404) {
      main.innerHTML = _detailError('Entity not found.', breadcrumbLabel, 'restoreEntityPreviousView()');
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    entity = data.entity ?? data;
  } catch (e) {
    console.error('[ma-entities] showEntityDetail fetch error', e);
    main.innerHTML = _detailError('Unable to load entity. Please try again.', breadcrumbLabel, 'restoreEntityPreviousView()');
    return;
  }

  main.innerHTML = _buildEntityDetailHTML(entity, breadcrumbLabel, 'restoreEntityPreviousView()');
  _loadEntityExposureStrip(entityId, entity);

  // Load Issuer page panels (13F ownership / financials / events / filings).
  // Previously only wired into showEntityOverlay (the ETF-holdings click
  // path) — Galaxy/Search entry points shared the same template placeholder
  // but never called this, so the panels silently never populated for them.
  ent_injectIssuerPanels(entityId);
}

async function _loadEntityExposureStrip(entityId, entity) {
  const section = document.getElementById(`etf-exposure-section-${entityId}`);
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
    ? `<button onclick="_showAllEtfExposure(${entityId})" style="margin-top:10px;background:none;border:1px solid var(--border);color:var(--blue);font-size:10px;padding:4px 10px;border-radius:var(--r);cursor:pointer">Show all ${total} ETFs ↓</button>`
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

function _showAllEtfExposure(entityId) {
  const section = document.getElementById(`etf-exposure-section-${entityId}`);
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
  const overlay = document.getElementById('entity-overlay');
  if (overlay) {
    overlay.remove();
    return;
  }
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

async function showEntityOverlay(entityId, backLabel) {
  backLabel = backLabel || 'ETF Holdings';

  // Remove any existing overlay first
  const existing = document.getElementById('entity-overlay');
  if (existing) existing.remove();

  // Create overlay on top of ETF panel (and possibly on top of an already-open
  // Manager Page — mgr_openManagerPage() in ma-13f.js shares this same
  // _nextAtlasOverlayZ() counter so whichever overlay opened most recently
  // wins the stacking order, in either navigation direction).
  const overlay = document.createElement('div');
  overlay.id = 'entity-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0;
    width: 100vw; height: 100vh;
    background: var(--bg, #0f1117);
    overflow-y: auto;
    padding: 0;
  `;
  overlay.style.zIndex = _nextAtlasOverlayZ();

  // Loading state
  overlay.innerHTML = `
    <div style="padding:32px;">
      <button onclick="closeEntityOverlay()"
        style="background:none;border:none;color:#4DC8C8;
               cursor:pointer;font-size:0.9em;margin-bottom:24px;
               display:block;">
        ← Back to ${backLabel}
      </button>
      <div style="color:#888;padding:32px;">Loading entity...</div>
    </div>`;
  document.body.appendChild(overlay);

  try {
    const res = await fetch(`${ENTITIES_API_URL}/api/entities/${entityId}`);
    if (!res.ok) throw new Error('not_found');
    const data = await res.json();
    const entity = data.entity || data;

    overlay.innerHTML = _buildEntityDetailHTML(entity, backLabel, 'closeEntityOverlay()');

    const backBtn = overlay.querySelector('.entity-overlay-back');
    if (backBtn) {
      backBtn.addEventListener('click', closeEntityOverlay);
    }

    // Load ETF exposure strip asynchronously
    _loadEntityExposureStrip(entityId, entity);

    // Load Issuer page panels (13F ownership / financials / events / filings)
    ent_injectIssuerPanels(entityId);
  } catch (e) {
    overlay.innerHTML = `
      <div style="padding:32px;">
        <button onclick="closeEntityOverlay()"
          style="background:none;border:none;color:#4DC8C8;
                 cursor:pointer;font-size:0.9em;margin-bottom:24px;
                 display:block;">
          ← Back to ${backLabel}
        </button>
        <div style="color:#888;">Entity data unavailable.</div>
      </div>`;
  }
}

function closeEntityOverlay() {
  const overlay = document.getElementById('entity-overlay');
  if (overlay) overlay.remove();
}

function closeEntityDetail() {
  // Path 1: called from entity-overlay (over ETF Holdings panel)
  // Just remove the overlay — ETF Holdings panel stays underneath
  const overlay = document.getElementById('entity-overlay');
  if (overlay) {
    overlay.remove();
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

async function ent_injectIssuerPanels(entityId) {
  if (!entityId) return; // backward-compatible: no entity_id, no panels, overlay renders as before
  const container = document.getElementById(`issuer-panels-section-${entityId}`);
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
