// ma-ops.js — Meridian Atlas Ops Visibility Panel
// Pure vanilla JS + inline SVG/CSS. No external dependencies.

const OPS_API_URL = 'https://meridian-proxy.navinmv1981.workers.dev/api/ops-health';
const OPS_POLL_MS = 10 * 60 * 1000; // 10 minutes

const OPS_COLORS = {
  teal: '#4DC8C8',
  amber: '#D4A843',
  red: '#C85050',
  green: '#4CC880',
  grey: '#5a6068',
  bg: '#0a0c10',
  bg2: 'var(--bg2, #0f1117)',
  text: '#e8eaed',
  textDim: '#9aa0a8'
};

// Static worker status table — updated manually when status changes
const OPS_WORKERS = [
  { name: 'meridian-holdings',        schedule: 'Every 2h',     status: 'active' },
  { name: 'meridian-bootstrap',       schedule: 'Every 4h',     status: 'active' },
  { name: 'meridian-entities-enrich', schedule: 'Every 30m',    status: 'frozen' },
  { name: 'meridian-entities-seed',   schedule: 'Daily 03:00',  status: 'frozen' }
];

let _opsPollTimer = null;

function _timeAgo(isoTimestamp) {
  if (!isoTimestamp) return 'unknown';
  const then = new Date(isoTimestamp).getTime();
  if (Number.isNaN(then)) return 'unknown';
  const diffMs = Date.now() - then;
  if (diffMs < 0) return 'just now';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function _parseStatus(statusStr) {
  if (!statusStr) return 'No status recorded';

  let m = statusStr.match(/^running:(\d+)\/(\d+):partial:(\d+)$/);
  if (m) {
    const errCount = parseInt(m[3], 10);
    return `In progress — ${errCount} error${errCount === 1 ? '' : 's'} in last batch`;
  }

  m = statusStr.match(/^complete:(\d+)ok:(\d+)err$/);
  if (m) {
    return `Completed — ${m[1]} ETFs processed, ${m[2]} errors`;
  }

  return statusStr;
}

function _escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// Circular arc gauge — returns inline SVG markup string.
// value/max define the fill fraction; guardAt (optional) draws a marker line.
function _svgGauge(value, max, guardAt, opts) {
  opts = opts || {};
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = 70;
  const strokeWidth = 14;

  // Arc spans 270 degrees, starting at 135deg (bottom-left) going clockwise
  const startAngle = 135;
  const sweepAngle = 270;

  function polarToXY(angleDeg) {
    const rad = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arcPath(fromDeg, toDeg) {
    const p1 = polarToXY(fromDeg);
    const p2 = polarToXY(toDeg);
    const largeArc = (toDeg - fromDeg) > 180 ? 1 : 0;
    return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const fillEndAngle = startAngle + sweepAngle * pct;

  let fillColor = opts.color;
  if (!fillColor) {
    if (max > 0) {
      const ratio = value / max;
      fillColor = ratio > 0.7 ? OPS_COLORS.red : ratio > 0.4 ? OPS_COLORS.amber : OPS_COLORS.green;
    } else {
      fillColor = OPS_COLORS.grey;
    }
  }

  let guardMarker = '';
  if (guardAt != null && max > 0) {
    const guardAngle = startAngle + sweepAngle * Math.min(guardAt / max, 1);
    const gp1 = polarToXY(guardAngle - 1.5);
    const gp2 = polarToXY(guardAngle + 1.5);
    guardMarker = `<path d="M ${gp1.x.toFixed(2)} ${gp1.y.toFixed(2)} L ${gp2.x.toFixed(2)} ${gp2.y.toFixed(2)}"
      stroke="${OPS_COLORS.red}" stroke-width="${strokeWidth + 6}" stroke-linecap="butt" opacity="0.85"/>`;
  }

  return `
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <path d="${arcPath(startAngle, startAngle + sweepAngle)}"
        fill="none" stroke="#1c2028" stroke-width="${strokeWidth}" stroke-linecap="round"/>
      ${guardMarker}
      <path d="${arcPath(startAngle, fillEndAngle)}"
        fill="none" stroke="${fillColor}" stroke-width="${strokeWidth}" stroke-linecap="round"/>
    </svg>`;
}

function _pipelineColor(pct) {
  if (pct > 80) return OPS_COLORS.green;
  if (pct > 50) return OPS_COLORS.amber;
  return OPS_COLORS.teal;
}

function _coverageBar(value, total, color) {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0;
  return `
    <div style="height:8px;width:100%;background:#1c2028;border-radius:4px;overflow:hidden;margin-top:6px;">
      <div style="height:100%;width:${pct.toFixed(1)}%;background:${color};border-radius:4px;"></div>
    </div>`;
}

function _renderOpsPanel(data) {
  const panel = document.getElementById('ops-panel');
  if (!panel) return;

  const pipeline = data.pipeline || {};
  const coverage = data.coverage || {};
  const bootstrap = data.bootstrap || {};
  const enrichment = data.enrichment || {};

  const pipelinePct = pipeline.total > 0
    ? (pipeline.offset / pipeline.total) * 100
    : 0;
  const pipelineColor = _pipelineColor(pipelinePct);
  const lastRunAgo = _timeAgo(pipeline.last_run);
  const statusHuman = _parseStatus(pipeline.last_status);

  const writesGaugeSvg = _svgGauge(
    pipeline.writes_today || 0,
    pipeline.writes_limit || 100000,
    pipeline.writes_guard || 80000
  );

  const readsGaugeSvg = _svgGauge(0, 1, null, { color: OPS_COLORS.grey });

  const coverageTotal = coverage.total_deep || 244;
  const enrichmentTotal = enrichment.total || (enrichment.version_1_pending + enrichment.version_2_complete) || 1;
  const enrichedPct = (enrichment.version_2_complete / enrichmentTotal) * 100;
  const pendingPct = (enrichment.version_1_pending / enrichmentTotal) * 100;

  const bootstrapPct = bootstrap.discovery_threshold > 0
    ? Math.min((bootstrap.current_cik / bootstrap.discovery_threshold) * 100, 100)
    : 0;

  const workerRows = OPS_WORKERS.map(w => {
    const dot = w.status === 'active' ? '🟢 Active' : '🔴 Frozen';
    return `
      <tr>
        <td style="padding:10px 16px;color:${OPS_COLORS.text};">${_escapeHtml(w.name)}</td>
        <td style="padding:10px 16px;color:${OPS_COLORS.textDim};font-family:var(--mono, monospace);">${_escapeHtml(w.schedule)}</td>
        <td style="padding:10px 16px;">${dot}</td>
      </tr>`;
  }).join('');

  // CHANGED 30 July 2026 (August Operating Layer): this used to target
  // `panel` (the whole #ops-panel element) directly. Now targets the
  // #ops-tab-health sub-container instead, since #ops-panel now also hosts
  // the persistent tab bar and the 4 new tab containers (Sprint Board,
  // Release Ledger, Events, Drift) — see ops_renderTabBar() below. Nothing
  // about the rendered health-tab content or logic below changed, only
  // where it gets written to.
  const healthContainer = document.getElementById('ops-tab-health') || panel;

  healthContainer.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;">
      <div style="font-size:20px;font-weight:700;letter-spacing:0.05em;color:${OPS_COLORS.teal};">
        MERIDIAN ATLAS — OPS
      </div>
      <button id="ops-close-btn" style="background:none;border:none;color:${OPS_COLORS.textDim};
        font-size:28px;line-height:1;cursor:pointer;padding:4px 12px;" title="Close">&times;</button>
    </div>

    <!-- SECTION 1 — PIPELINE HEALTH -->
    <div style="background:${OPS_COLORS.bg2};border-radius:10px;padding:24px;margin-bottom:24px;">
      <div style="font-size:13px;color:${OPS_COLORS.textDim};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">
        Pipeline Health
      </div>
      <div style="height:18px;width:100%;background:#1c2028;border-radius:9px;overflow:hidden;">
        <div style="height:100%;width:${pipelinePct.toFixed(1)}%;background:${pipelineColor};border-radius:9px;
          transition:width 0.4s ease;"></div>
      </div>
      <div style="margin-top:10px;font-family:var(--mono, monospace);font-size:15px;color:${OPS_COLORS.text};">
        ETF Second Pass — ${pipeline.offset} of ${pipeline.total} complete (${pipelinePct.toFixed(1)}%)
      </div>
      <div style="margin-top:6px;font-size:13px;color:${OPS_COLORS.textDim};">
        Last run: ${_escapeHtml(lastRunAgo)}
      </div>
      <div style="margin-top:2px;font-size:13px;color:${OPS_COLORS.text};">
        ${_escapeHtml(statusHuman)}
      </div>
    </div>

    <!-- SECTION 2 — D1 BUDGET GAUGES -->
    <div style="display:flex;gap:24px;margin-bottom:24px;">
      <div style="flex:1;background:${OPS_COLORS.bg2};border-radius:10px;padding:24px;text-align:center;">
        <div style="font-size:13px;color:${OPS_COLORS.textDim};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">
          Writes Today
        </div>
        <div style="position:relative;display:inline-block;">
          ${writesGaugeSvg}
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-40%);text-align:center;">
            <div style="font-family:var(--mono, monospace);font-size:24px;font-weight:700;color:${OPS_COLORS.text};">
              ${(pipeline.writes_today || 0).toLocaleString()}
            </div>
            <div style="font-size:12px;color:${OPS_COLORS.textDim};">
              of ${(pipeline.writes_limit || 100000).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
      <div style="flex:1;background:${OPS_COLORS.bg2};border-radius:10px;padding:24px;text-align:center;">
        <div style="font-size:13px;color:${OPS_COLORS.textDim};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">
          Reads Today
        </div>
        <div style="position:relative;display:inline-block;">
          ${readsGaugeSvg}
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-40%);text-align:center;">
            <div style="font-family:var(--mono, monospace);font-size:16px;font-weight:700;color:${OPS_COLORS.textDim};">
              CHECK_DASHBOARD
            </div>
            <div style="font-size:11px;color:${OPS_COLORS.textDim};max-width:140px;margin:4px auto 0;">
              Read metrics via Cloudflare dashboard
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- SECTION 3 — COVERAGE DEPTH -->
    <div style="background:${OPS_COLORS.bg2};border-radius:10px;padding:24px;margin-bottom:24px;">
      <div style="font-size:13px;color:${OPS_COLORS.textDim};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:16px;">
        Coverage Depth (${coverageTotal} ETFs)
      </div>
      <div style="display:flex;gap:24px;">
        <div style="flex:1;">
          <div style="font-family:var(--mono, monospace);font-size:22px;color:${OPS_COLORS.text};">${coverage.null_depth ?? 0}</div>
          <div style="font-size:12px;color:${OPS_COLORS.textDim};">No data</div>
          ${_coverageBar(coverage.null_depth ?? 0, coverageTotal, OPS_COLORS.grey)}
        </div>
        <div style="flex:1;">
          <div style="font-family:var(--mono, monospace);font-size:22px;color:${OPS_COLORS.text};">${coverage.depth_1 ?? 0}</div>
          <div style="font-size:12px;color:${OPS_COLORS.textDim};">1 month</div>
          ${_coverageBar(coverage.depth_1 ?? 0, coverageTotal, OPS_COLORS.teal)}
        </div>
        <div style="flex:1;">
          <div style="font-family:var(--mono, monospace);font-size:22px;color:${OPS_COLORS.text};">${coverage.depth_2_plus ?? 0}</div>
          <div style="font-size:12px;color:${OPS_COLORS.textDim};">2+ months</div>
          ${_coverageBar(coverage.depth_2_plus ?? 0, coverageTotal, '#7CF0F0')}
        </div>
      </div>
    </div>

    <!-- SECTION 4 — ENTITY ENRICHMENT -->
    <div style="background:${OPS_COLORS.bg2};border-radius:10px;padding:24px;margin-bottom:24px;">
      <div style="font-size:13px;color:${OPS_COLORS.textDim};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:16px;">
        Entity Enrichment Status
      </div>
      <div style="height:18px;width:100%;border-radius:9px;overflow:hidden;display:flex;">
        <div style="height:100%;width:${enrichedPct.toFixed(1)}%;background:${OPS_COLORS.teal};"></div>
        <div style="height:100%;width:${pendingPct.toFixed(1)}%;background:${OPS_COLORS.amber};"></div>
      </div>
      <div style="margin-top:10px;font-family:var(--mono, monospace);font-size:14px;color:${OPS_COLORS.text};">
        ${(enrichment.version_2_complete || 0).toLocaleString()} enriched · ${(enrichment.version_1_pending || 0).toLocaleString()} pending enrichment
      </div>
      <div style="margin-top:4px;font-size:12px;color:${OPS_COLORS.textDim};">
        Enrichment resumes after ETF Phase 3 gate
      </div>
    </div>

    <!-- SECTION 5 — BOOTSTRAP PROGRESS -->
    <div style="background:${OPS_COLORS.bg2};border-radius:10px;padding:24px;margin-bottom:24px;">
      <div style="font-size:13px;color:${OPS_COLORS.textDim};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">
        Bootstrap Progress
      </div>
      <div style="height:14px;width:100%;background:#1c2028;border-radius:7px;overflow:hidden;">
        <div style="height:100%;width:${bootstrapPct.toFixed(1)}%;background:${OPS_COLORS.teal};border-radius:7px;"></div>
      </div>
      <div style="margin-top:10px;font-family:var(--mono, monospace);font-size:14px;color:${OPS_COLORS.text};">
        Bootstrap CIK: ${bootstrap.current_cik != null ? bootstrap.current_cik.toLocaleString() : 'unknown'} — next ETF discovery at CIK ${(bootstrap.discovery_threshold || 0).toLocaleString()}
      </div>
    </div>

    <!-- SECTION 6 — WORKER STATUS -->
    <div style="background:${OPS_COLORS.bg2};border-radius:10px;padding:24px;margin-bottom:24px;">
      <div style="font-size:13px;color:${OPS_COLORS.textDim};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:16px;">
        Worker Status
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="border-bottom:1px solid #1c2028;">
            <th style="text-align:left;padding:8px 16px;color:${OPS_COLORS.textDim};font-weight:500;">Worker</th>
            <th style="text-align:left;padding:8px 16px;color:${OPS_COLORS.textDim};font-weight:500;">Schedule</th>
            <th style="text-align:left;padding:8px 16px;color:${OPS_COLORS.textDim};font-weight:500;">Status</th>
          </tr>
        </thead>
        <tbody>${workerRows}</tbody>
      </table>
    </div>

    <!-- FOOTER -->
    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 0 40px;
      color:${OPS_COLORS.textDim};font-size:12px;">
      <div>
        Last refreshed: ${new Date(data.snapshot_at || Date.now()).toLocaleTimeString()}<br/>
        Auto-refresh every 10 minutes
      </div>
      <button id="ops-refresh-btn" style="background:${OPS_COLORS.teal};color:#0a0c10;border:none;
        border-radius:6px;padding:10px 20px;font-size:13px;font-weight:600;cursor:pointer;">
        Refresh Now
      </button>
    </div>
  `;

  const closeBtn = panel.querySelector('#ops-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeOps);

  const refreshBtn = panel.querySelector('#ops-refresh-btn');
  if (refreshBtn) refreshBtn.addEventListener('click', () => openOps({ skipCreate: true }));
}

async function openOps(opts) {
  opts = opts || {};
  let panel = document.getElementById('ops-panel');

  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'ops-panel';
    panel.style.cssText = `position:fixed;top:0;left:0;width:100vw;
      height:100vh;background:#0a0c10;z-index:3000;overflow-y:auto;
      padding:32px 40px;font-family:system-ui,-apple-system,sans-serif;color:${OPS_COLORS.text};`;
    document.body.appendChild(panel);

    // ADDED 30 July 2026 (August Operating Layer): persistent tab chrome —
    // built once at panel creation, survives every _renderOpsPanel() refresh
    // because that function now only touches #ops-tab-health's innerHTML.
    ops_renderTabBar();

    if (!_opsPollTimer) {
      _opsPollTimer = setInterval(() => openOps({ skipCreate: true }), OPS_POLL_MS);
    }
  }

  try {
    const res = await fetch(OPS_API_URL);
    if (!res.ok) throw new Error(`ops-health HTTP ${res.status}`);
    const data = await res.json();
    _renderOpsPanel(data);
  } catch (err) {
    const healthContainer = document.getElementById('ops-tab-health') || panel;
    healthContainer.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;">
        <div style="font-size:20px;font-weight:700;color:${OPS_COLORS.teal};">MERIDIAN ATLAS — OPS</div>
        <button id="ops-close-btn" style="background:none;border:none;color:${OPS_COLORS.textDim};
          font-size:28px;cursor:pointer;">&times;</button>
      </div>
      <div style="color:${OPS_COLORS.red};">Failed to load ops health: ${_escapeHtml(err.message)}</div>
    `;
    const closeBtn = panel.querySelector('#ops-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeOps);
  }
}

function closeOps() {
  const panel = document.getElementById('ops-panel');
  if (panel) panel.remove();
  if (_opsPollTimer) {
    clearInterval(_opsPollTimer);
    _opsPollTimer = null;
  }
}

// ============================================================
// August Operating Layer — Sprint Board / Release Ledger / Events / Drift
// Added 30 July 2026. All new top-level functions below are ops_-prefixed
// (unlike this file's original, unprefixed functions) per the naming
// convention adopted after the _freshnessBadge collision incident
// (Current State v11, Section 7.4) — new code follows the safer pattern,
// existing code is left untouched.
//
// All network calls route through ma-data.js's data_opsGet/data_opsPost,
// per the August Operating Layer Blueprint's decision to actually enforce
// the "no inline fetch() in modules" rule for new dashboard code (the
// existing openOps() above still calls fetch() directly against
// OPS_API_URL — that's left alone, not retrofitted).
// ============================================================

const OPS_TABS = [
  { id: 'health', label: 'System Health' },
  { id: 'sprint', label: 'Sprint Board' },
  { id: 'release', label: 'Release Ledger' },
  { id: 'events', label: 'Events' },
  { id: 'drift', label: 'Drift & Budget' }
];

const OPS_STAGE_COLORS = {
  IDEA: OPS_COLORS.grey, PRODUCT_SPEC: OPS_COLORS.teal, ARCH_REVIEW: OPS_COLORS.amber,
  UX_REVIEW: OPS_COLORS.amber, ENG_DIAGNOSTIC: OPS_COLORS.amber, FOUNDER_APPROVAL: OPS_COLORS.amber,
  ENG_IMPLEMENT: OPS_COLORS.teal, OPS_RELEASE_REVIEW: OPS_COLORS.amber, RELEASE_READY: OPS_COLORS.green,
  CLOSED: OPS_COLORS.green, BLOCKED: OPS_COLORS.red
};

function ops_renderTabBar() {
  const panel = document.getElementById('ops-panel');
  if (!panel || document.getElementById('ops-tab-bar')) return; // idempotent — build once

  const bar = document.createElement('div');
  bar.id = 'ops-tab-bar';
  bar.style.cssText = 'display:flex;gap:4px;margin-bottom:20px;border-bottom:1px solid #1c2028;padding-bottom:0;';
  bar.innerHTML = OPS_TABS.map(t => `
    <button class="ops-tab-btn" data-ops-tab="${t.id}" style="background:none;border:none;
      color:${OPS_COLORS.textDim};font-size:13px;font-weight:600;padding:10px 16px;cursor:pointer;
      border-bottom:2px solid transparent;">${_escapeHtml(t.label)}</button>
  `).join('');

  const contentWrap = document.createElement('div');
  contentWrap.id = 'ops-tab-content';
  OPS_TABS.forEach(t => {
    const div = document.createElement('div');
    div.id = `ops-tab-${t.id}`;
    div.style.display = 'none';
    contentWrap.appendChild(div);
  });

  panel.insertBefore(contentWrap, panel.firstChild);
  panel.insertBefore(bar, panel.firstChild);

  bar.querySelectorAll('.ops-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => ops_switchTab(btn.dataset.opsTab));
  });

  const lastTab = localStorage.getItem('ops_last_tab') || 'health';
  ops_switchTab(lastTab);
}

function ops_switchTab(tabName) {
  OPS_TABS.forEach(t => {
    const el = document.getElementById(`ops-tab-${t.id}`);
    if (el) el.style.display = t.id === tabName ? 'block' : 'none';
  });
  document.querySelectorAll('.ops-tab-btn').forEach(btn => {
    const active = btn.dataset.opsTab === tabName;
    btn.style.color = active ? OPS_COLORS.teal : OPS_COLORS.textDim;
    btn.style.borderBottomColor = active ? OPS_COLORS.teal : 'transparent';
  });
  localStorage.setItem('ops_last_tab', tabName);

  if (tabName === 'sprint') ops_loadSprintBoard();
  else if (tabName === 'release') ops_loadReleaseLedger();
  else if (tabName === 'events') ops_loadEventTimeline();
  else if (tabName === 'drift') ops_loadDriftTab();
}

// --- Sprint Board --------------------------------------------------------

async function ops_loadSprintBoard() {
  const container = document.getElementById('ops-tab-sprint');
  if (!container) return;
  container.innerHTML = `<div style="color:${OPS_COLORS.textDim};padding:20px;">Loading sprint board…</div>`;

  const res = await data_opsGet('/api/ops/sprint-board');
  if (!res.ok) {
    container.innerHTML = `<div style="color:${OPS_COLORS.red};padding:20px;">Failed to load sprint board: ${_escapeHtml(res.error || res.status)}</div>`;
    return;
  }
  ops_renderSprintBoard(res.data.items || []);
}

function ops_renderSprintBoard(items) {
  const container = document.getElementById('ops-tab-sprint');
  if (!container) return;

  const cards = items.map(t => {
    const stageColor = OPS_STAGE_COLORS[t.stage] || OPS_COLORS.grey;
    return `
      <div style="background:${OPS_COLORS.bg2};border-radius:10px;padding:18px 20px;margin-bottom:12px;border-left:3px solid ${stageColor};">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
          <div>
            <div style="font-family:var(--mono, monospace);font-size:11px;color:${OPS_COLORS.textDim};">${_escapeHtml(t.ticket_id)} · ${_escapeHtml(t.domain)} · ${_escapeHtml(t.owner_role)}</div>
            <div style="font-size:15px;font-weight:600;margin-top:4px;">${_escapeHtml(t.title)}</div>
          </div>
          <span style="font-size:11px;font-weight:700;color:${stageColor};white-space:nowrap;">${_escapeHtml(t.stage)}</span>
        </div>
        ${t.next_step ? `<div style="margin-top:8px;font-size:13px;color:${OPS_COLORS.text};">Next: ${_escapeHtml(t.next_step)}</div>` : ''}
        ${t.blocker ? `<div style="margin-top:4px;font-size:13px;color:${OPS_COLORS.red};">Blocker: ${_escapeHtml(t.blocker)}</div>` : ''}
        ${t.approval_needed ? `<div style="margin-top:4px;font-size:12px;color:${OPS_COLORS.amber};">Approval needed: ${_escapeHtml(t.approval_needed)}</div>` : ''}
        <div style="margin-top:10px;">
          <button onclick="ops_changeTicketStage('${_escapeHtml(t.ticket_id)}')" style="background:none;border:1px solid #2a3038;
            color:${OPS_COLORS.textDim};border-radius:6px;padding:6px 14px;font-size:12px;cursor:pointer;">Change stage</button>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="font-size:13px;color:${OPS_COLORS.textDim};text-transform:uppercase;letter-spacing:0.08em;">Sprint Board — ${items.length} tickets</div>
      <button onclick="ops_loadSprintBoard()" style="background:${OPS_COLORS.teal};color:#0a0c10;border:none;
        border-radius:6px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;">Refresh</button>
    </div>
    ${cards || `<div style="color:${OPS_COLORS.textDim};padding:20px;">No tickets yet.</div>`}
  `;
}

async function ops_changeTicketStage(ticketId) {
  const validStages = ['IDEA', 'PRODUCT_SPEC', 'ARCH_REVIEW', 'UX_REVIEW', 'ENG_DIAGNOSTIC',
    'FOUNDER_APPROVAL', 'ENG_IMPLEMENT', 'OPS_RELEASE_REVIEW', 'RELEASE_READY', 'CLOSED', 'BLOCKED'];
  const newStage = prompt(`New stage for ${ticketId}?\nValid values: ${validStages.join(', ')}`);
  if (!newStage) return;
  if (!validStages.includes(newStage.toUpperCase())) {
    alert('Not a valid stage value — no change made.');
    return;
  }
  const nextStep = prompt('Next step (optional):') || undefined;
  const blocker = newStage.toUpperCase() === 'BLOCKED' ? (prompt('Blocker reason:') || undefined) : undefined;

  const res = await data_opsPost(`/api/ops/sprint-board/${encodeURIComponent(ticketId)}/stage`, {
    stage: newStage.toUpperCase(),
    actor_role: 'Founder',
    next_step: nextStep,
    blocker: blocker
  });

  if (!res.ok) {
    alert(`Failed to change stage: ${res.data?.error || res.status}`);
    return;
  }
  ops_loadSprintBoard();
}

// --- Release Ledger -------------------------------------------------------

async function ops_loadReleaseLedger() {
  const container = document.getElementById('ops-tab-release');
  if (!container) return;
  container.innerHTML = `<div style="color:${OPS_COLORS.textDim};padding:20px;">Loading release ledger…</div>`;

  const res = await data_opsGet('/api/ops/release-ledger');
  if (!res.ok) {
    container.innerHTML = `<div style="color:${OPS_COLORS.red};padding:20px;">Failed to load release ledger: ${_escapeHtml(res.error || res.status)}</div>`;
    return;
  }
  ops_renderReleaseLedger(res.data.items || []);
}

function ops_renderReleaseLedger(items) {
  const container = document.getElementById('ops-tab-release');
  if (!container) return;

  const statusColor = s => ({
    NOT_READY: OPS_COLORS.grey, READY: OPS_COLORS.teal, DEPLOYING: OPS_COLORS.amber,
    DEPLOYED: OPS_COLORS.teal, VERIFIED: OPS_COLORS.green, ROLLED_BACK: OPS_COLORS.red
  }[s] || OPS_COLORS.grey);

  const rows = items.map(r => `
    <tr>
      <td style="padding:10px 14px;font-family:var(--mono, monospace);font-size:12px;">${_escapeHtml(r.release_id)}</td>
      <td style="padding:10px 14px;font-size:13px;">${_escapeHtml(r.change_summary)}</td>
      <td style="padding:10px 14px;font-size:11px;">D1: ${_escapeHtml(r.d1_migration_status)}<br/>Worker: ${_escapeHtml(r.worker_deploy_status)}<br/>Frontend: ${_escapeHtml(r.frontend_push_status)}</td>
      <td style="padding:10px 14px;"><span style="color:${statusColor(r.status)};font-weight:700;font-size:12px;">${_escapeHtml(r.status)}</span></td>
      <td style="padding:10px 14px;">
        <button onclick="ops_recordReleaseEvent('${_escapeHtml(r.release_id)}')" style="background:none;border:1px solid #2a3038;
          color:${OPS_COLORS.textDim};border-radius:6px;padding:6px 12px;font-size:11px;cursor:pointer;">Record event</button>
      </td>
    </tr>`).join('');

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="font-size:13px;color:${OPS_COLORS.textDim};text-transform:uppercase;letter-spacing:0.08em;">Release Ledger — ${items.length} releases</div>
      <button onclick="ops_loadReleaseLedger()" style="background:${OPS_COLORS.teal};color:#0a0c10;border:none;
        border-radius:6px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;">Refresh</button>
    </div>
    <table style="width:100%;border-collapse:collapse;background:${OPS_COLORS.bg2};border-radius:10px;overflow:hidden;">
      <thead><tr style="border-bottom:1px solid #1c2028;">
        <th style="text-align:left;padding:8px 14px;color:${OPS_COLORS.textDim};font-size:10px;text-transform:uppercase;">Release</th>
        <th style="text-align:left;padding:8px 14px;color:${OPS_COLORS.textDim};font-size:10px;text-transform:uppercase;">Summary</th>
        <th style="text-align:left;padding:8px 14px;color:${OPS_COLORS.textDim};font-size:10px;text-transform:uppercase;">Deploy status</th>
        <th style="text-align:left;padding:8px 14px;color:${OPS_COLORS.textDim};font-size:10px;text-transform:uppercase;">Status</th>
        <th></th>
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="5" style="padding:20px;color:${OPS_COLORS.textDim};">No releases yet.</td></tr>`}</tbody>
    </table>
  `;
}

async function ops_recordReleaseEvent(releaseId) {
  const validEvents = ['build_started', 'build_completed', 'worker_deployed', 'frontend_pushed',
    'migration_applied', 'verification_passed', 'verification_failed', 'release_closed', 'release_rolled_back'];
  const eventType = prompt(`Event type for ${releaseId}?\nValid values: ${validEvents.join(', ')}`);
  if (!eventType) return;
  if (!validEvents.includes(eventType)) {
    alert('Not a valid event type — no change made.');
    return;
  }
  const payload = {};
  if (eventType === 'build_started') {
    payload.target = prompt('Target — "worker" or "frontend"?') || 'worker';
  }
  if (eventType === 'release_rolled_back') {
    payload.reason = prompt('Rollback reason (required):') || 'no reason given';
  }

  const res = await data_opsPost(`/api/ops/release-ledger/${encodeURIComponent(releaseId)}/event`, {
    event_type: eventType,
    actor_role: 'Founder',
    payload
  });

  if (!res.ok) {
    alert(`Failed to record event: ${res.data?.error || res.status}`);
    return;
  }
  ops_loadReleaseLedger();
}

// --- Event Timeline --------------------------------------------------------

async function ops_loadEventTimeline() {
  const container = document.getElementById('ops-tab-events');
  if (!container) return;
  container.innerHTML = `<div style="color:${OPS_COLORS.textDim};padding:20px;">Loading events…</div>`;

  const res = await data_opsGet('/api/ops/events?limit=100');
  if (!res.ok) {
    container.innerHTML = `<div style="color:${OPS_COLORS.red};padding:20px;">Failed to load events: ${_escapeHtml(res.error || res.status)}</div>`;
    return;
  }
  ops_renderEventTimeline(res.data.events || []);
}

function ops_renderEventTimeline(events) {
  const container = document.getElementById('ops-tab-events');
  if (!container) return;

  const rows = events.map(e => `
    <div style="display:flex;gap:16px;padding:10px 0;border-bottom:1px solid #1c2028;">
      <div style="font-family:var(--mono, monospace);font-size:11px;color:${OPS_COLORS.textDim};white-space:nowrap;">${_escapeHtml(_timeAgo(e.created_at))}</div>
      <div style="font-size:12px;font-weight:700;color:${OPS_COLORS.teal};white-space:nowrap;">${_escapeHtml(e.event_type)}</div>
      <div style="font-size:12px;color:${OPS_COLORS.textDim};white-space:nowrap;">${_escapeHtml(e.ticket_id || e.release_id || '—')}</div>
      <div style="font-size:12px;color:${OPS_COLORS.text};flex:1;">${_escapeHtml(e.actor_role)}</div>
    </div>`).join('');

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="font-size:13px;color:${OPS_COLORS.textDim};text-transform:uppercase;letter-spacing:0.08em;">Event Timeline — last ${events.length}</div>
      <button onclick="ops_loadEventTimeline()" style="background:${OPS_COLORS.teal};color:#0a0c10;border:none;
        border-radius:6px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;">Refresh</button>
    </div>
    <div style="background:${OPS_COLORS.bg2};border-radius:10px;padding:8px 20px;">
      ${rows || `<div style="color:${OPS_COLORS.textDim};padding:20px 0;">No events recorded yet.</div>`}
    </div>
  `;
}

// --- Drift, Budget Risk, OpenFIGI Status (one combined tab) ---------------

async function ops_loadDriftTab() {
  const container = document.getElementById('ops-tab-drift');
  if (!container) return;
  container.innerHTML = `<div style="color:${OPS_COLORS.textDim};padding:20px;">Loading…</div>`;

  const [driftRes, budgetRes, figiRes] = await Promise.all([
    data_opsGet('/api/ops/drift'),
    data_opsGet('/api/ops/budget-risk'),
    data_opsGet('/api/ops/openfigi-status')
  ]);

  const driftHtml = ops_renderDriftPanel(driftRes.ok ? driftRes.data : null);
  const budgetHtml = ops_renderBudgetRisk(budgetRes.ok ? budgetRes.data : null);
  const figiHtml = ops_renderOpenFigiStatus(figiRes.ok ? figiRes.data : null);

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="font-size:13px;color:${OPS_COLORS.textDim};text-transform:uppercase;letter-spacing:0.08em;">Drift & Budget</div>
      <button onclick="ops_loadDriftTab()" style="background:${OPS_COLORS.teal};color:#0a0c10;border:none;
        border-radius:6px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;">Refresh</button>
    </div>
    ${budgetHtml}
    ${driftHtml}
    ${figiHtml}
  `;
}

function ops_renderDriftPanel(data) {
  if (!data) return `<div style="background:${OPS_COLORS.bg2};border-radius:10px;padding:20px;margin-bottom:16px;color:${OPS_COLORS.red};">Failed to load drift check.</div>`;
  const rows = (data.drift || []).map(d => `
    <div style="padding:10px 0;border-bottom:1px solid #1c2028;font-size:13px;">
      <strong>${_escapeHtml(d.release_id)}</strong> — ${_escapeHtml(d.change_summary)}<br/>
      <span style="color:${OPS_COLORS.textDim};font-size:11px;">Worker: ${_escapeHtml(d.worker_deploy_status)} · Frontend: ${_escapeHtml(d.frontend_push_status)}</span>
    </div>`).join('');

  return `
    <div style="background:${OPS_COLORS.bg2};border-radius:10px;padding:20px;margin-bottom:16px;">
      <div style="font-size:13px;color:${OPS_COLORS.textDim};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">
        Deployment Drift ${data.has_drift ? `<span style="color:${OPS_COLORS.red};">— ${data.drift.length} found</span>` : `<span style="color:${OPS_COLORS.green};">— none</span>`}
      </div>
      ${rows || `<div style="color:${OPS_COLORS.textDim};font-size:13px;">Worker deploys and frontend pushes are in sync across every tracked release.</div>`}
    </div>`;
}

function ops_renderBudgetRisk(data) {
  if (!data) return `<div style="background:${OPS_COLORS.bg2};border-radius:10px;padding:20px;margin-bottom:16px;color:${OPS_COLORS.red};">Failed to load budget risk.</div>`;
  const gaugeSvg = _svgGauge(data.writes_today, data.daily_limit, data.daily_limit * 0.9);
  return `
    <div style="background:${OPS_COLORS.bg2};border-radius:10px;padding:20px;margin-bottom:16px;display:flex;align-items:center;gap:24px;">
      <div>${gaugeSvg}</div>
      <div>
        <div style="font-size:13px;color:${OPS_COLORS.textDim};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">Shared D1 Write Budget Today</div>
        <div style="font-family:var(--mono, monospace);font-size:22px;font-weight:700;">${data.writes_today.toLocaleString()} <span style="font-size:13px;color:${OPS_COLORS.textDim};">of ${data.daily_limit.toLocaleString()} (${data.pct}%)</span></div>
      </div>
    </div>`;
}

function ops_renderOpenFigiStatus(data) {
  if (!data) return `<div style="background:${OPS_COLORS.bg2};border-radius:10px;padding:20px;margin-bottom:16px;color:${OPS_COLORS.red};">Failed to load OpenFIGI status.</div>`;
  return `
    <div style="background:${OPS_COLORS.bg2};border-radius:10px;padding:20px;">
      <div style="font-size:13px;color:${OPS_COLORS.textDim};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">Instrument → Entity Resolution</div>
      <div style="display:flex;gap:32px;flex-wrap:wrap;">
        <div><div style="font-family:var(--mono, monospace);font-size:20px;">${data.coverage_pct}%</div><div style="font-size:11px;color:${OPS_COLORS.textDim};">Coverage (${data.instrument_entity_map_total.toLocaleString()} / ${data.instrument_master_total.toLocaleString()})</div></div>
        <div><div style="font-family:var(--mono, monospace);font-size:20px;">${data.openfigicache_total.toLocaleString()}</div><div style="font-size:11px;color:${OPS_COLORS.textDim};">Instruments checked (cached)</div></div>
        <div><div style="font-family:var(--mono, monospace);font-size:20px;">${data.openfigi_matched_no_entity.toLocaleString()}</div><div style="font-size:11px;color:${OPS_COLORS.textDim};">Matched, no entity yet — cheap re-match candidates</div></div>
      </div>
    </div>`;
}
