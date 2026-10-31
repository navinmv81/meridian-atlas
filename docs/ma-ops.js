// ma-ops.js — Meridian Atlas Ops Visibility Panel
// Pure vanilla JS + inline SVG/CSS. No external dependencies.
//
// MA-OCT-OPS.A (Founder "Ops option A", ML-1031-4): this file runs only inside the signed-in
// operator console (GET /api/ops/admin/console on meridian-ops, which loads it from GitHub Pages).
// The public terminal no longer loads it: its OPS button is a link to the console, so there is no
// anonymous Ops panel. The console holds all seven views: System Health, Cases, DQ Tickets,
// Drift & Budget, Events, Sprint Board (read-only) and Release Ledger (read-only).

const OPS_HEALTH_PATH = '/api/ops-health';   // on meridian-proxy, through data_proxyGet (ma-data.js)
const OPS_POLL_MS = 10 * 60 * 1000; // 10 minutes

// MA-OCT-005 (spec rev 0 §4.2, Option B): true when this file runs inside the operator
// console shell served by meridian-ops (/api/ops/admin/console). The shell sets the flag
// before loading this file. The shell checks OPS_CONSOLE_SUPPORTED so an older ma-ops.js shows
// "arrives with the 2 Nov release" (M-6). Loaded anywhere else, openOps() opens the console instead.
const OPS_CONSOLE_MODE = window.MA_OPS_CONSOLE === true;
window.OPS_CONSOLE_SUPPORTED = true;

// localStorage holds only ops_acting_role, as a convenience, never authority (§6.2, AC-12).
function _opsPref(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch { /* private mode, blocked storage */ }
  return null;
}

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
let _opsActiveTab = null;

// MA-OCT-MON26.ENG1 (ML-1025-3): poll /api/ops-health only while the tab is visible. A hidden tab
// stops the 10-min interval; becoming visible again refreshes once at once and restarts it. Closing
// the panel clears it as before. (A background tab left open all day was the 144-polls/day case.)
// MA-OCT-005 M-3: the poll also runs only while Health is the active tab, so the default Cases tab
// (and every admin tab) never reads /api/ops-health (491 reads a call).
function _opsHealthWanted() {
  return !document.hidden && _opsActiveTab === 'health';
}
function _opsStartPoll() {
  if (!_opsPollTimer && _opsHealthWanted()) _opsPollTimer = setInterval(() => openOps({ skipCreate: true }), OPS_POLL_MS);
}
function _opsStopPoll() {
  if (_opsPollTimer) {
    clearInterval(_opsPollTimer);
    _opsPollTimer = null;
  }
}
document.addEventListener('visibilitychange', () => {
  if (!document.getElementById('ops-panel')) return;   // panel closed: nothing to do
  if (document.hidden) {
    _opsStopPoll();
  } else if (_opsHealthWanted()) {
    openOps({ skipCreate: true });   // one immediate refresh
    _opsStartPoll();
  }
});

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
  // MA-OCT-MON26 / ML-1026-1 note: since 26 Oct /api/ops-health returns null enrichment counts with
  // enrichment_source 'removed-ML-1025-3' (the entity_master full scan was removed). Say so instead
  // of rendering "0 enriched · 0 pending".
  const enrichmentRemoved = enrichment.enrichment_source != null
    || (enrichment.version_2_complete == null && enrichment.version_1_pending == null);
  const enrichmentTotal = enrichment.total || (enrichment.version_1_pending + enrichment.version_2_complete) || 1;
  const enrichedPct = enrichmentRemoved ? 0 : (enrichment.version_2_complete / enrichmentTotal) * 100;
  const pendingPct = enrichmentRemoved ? 0 : (enrichment.version_1_pending / enrichmentTotal) * 100;

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
      ${enrichmentRemoved ? `
      <div style="margin-top:10px;font-size:14px;color:${OPS_COLORS.text};">
        Enrichment counts removed (ML-1025-3) — not shown since 26 Oct
      </div>
      <div style="margin-top:4px;font-size:12px;color:${OPS_COLORS.textDim};">
        The count read the whole entity table on every refresh, so it was taken out to save D1 reads.
      </div>` : `
      <div style="margin-top:10px;font-family:var(--mono, monospace);font-size:14px;color:${OPS_COLORS.text};">
        ${(enrichment.version_2_complete || 0).toLocaleString()} enriched · ${(enrichment.version_1_pending || 0).toLocaleString()} pending enrichment
      </div>
      <div style="margin-top:4px;font-size:12px;color:${OPS_COLORS.textDim};">
        Enrichment resumes after ETF Phase 3 gate
      </div>`}
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

  const refreshBtn = panel.querySelector('#ops-refresh-btn');
  if (refreshBtn) refreshBtn.addEventListener('click', () => openOps({ skipCreate: true }));
}

async function openOps(opts) {
  opts = opts || {};
  // MA-OCT-OPS.A: no anonymous Ops panel outside the console shell; open the console instead.
  if (!OPS_CONSOLE_MODE) {
    window.open(OPSC_CONSOLE_URL, '_blank', 'noopener');
    return;
  }
  let panel = document.getElementById('ops-panel');

  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'ops-panel';
    // MA-OCT-OPS.A: border-box, so the 40px side padding sits inside 100vw (it was 80px wider and clipped right).
    panel.style.cssText = `position:fixed;top:0;left:0;width:100vw;box-sizing:border-box;
      height:100vh;background:#0a0c10;z-index:3000;overflow-y:auto;
      padding:32px 40px;font-family:system-ui,-apple-system,sans-serif;color:${OPS_COLORS.text};`;
    document.body.appendChild(panel);

    // ADDED 30 July 2026 (August Operating Layer): persistent tab chrome —
    // built once at panel creation, survives every _renderOpsPanel() refresh
    // because that function now only touches #ops-tab-health's innerHTML.
    // MA-OCT-005: ops_switchTab() loads Health (and starts its poll) only when Health is the active tab.
    ops_renderTabBar();
    return;
  }
  if (!_opsHealthWanted()) return;   // M-3: ops-health is read only on the visible Health tab

  const res = await data_proxyGet(OPS_HEALTH_PATH);
  if (res.ok && res.data) {
    _renderOpsPanel(res.data);
  } else {
    const healthContainer = document.getElementById('ops-tab-health') || panel;
    const why = res.status ? `HTTP ${res.status}` : (res.type || 'network error');
    healthContainer.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;">
        <div style="font-size:20px;font-weight:700;color:${OPS_COLORS.teal};">MERIDIAN ATLAS — OPS</div>
      </div>
      <div style="color:${OPS_COLORS.red};">Failed to load ops health: ${_escapeHtml(why)}</div>
    `;
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
// All network calls route through ma-data.js (data_opsGet here; data_opsAdmin
// for the 005 console views; data_proxyGet for openOps()'s Health read, moved
// out of its inline fetch() by MA-OCT-005 §5.6). Sprint Board and Release
// Ledger are read-only since MA-OCT-005 (Founder Q2): their actions posted to
// paths closed since 001.
// ============================================================

// MA-OCT-005 (§5): Cases and DQ Tickets are the console section at the end of this file (ops_loadCases / ops_loadDq).
// Fleet (§5.5) and the "New case" form are pre-cut (Ops review M-6; Founder Q3 order).
const OPS_TABS = [
  { id: 'health', label: 'System Health' },
  { id: 'cases', label: 'Cases' },
  { id: 'dq', label: 'DQ Tickets' },
  { id: 'drift', label: 'Drift & Budget' },
  { id: 'events', label: 'Events' },
  { id: 'sprint', label: 'Sprint Board' },
  { id: 'release', label: 'Release Ledger' }
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

  // §6.5: role tablist/tab/tabpanel; Left/Right/Home/End move between tabs.
  const bar = document.createElement('div');
  bar.id = 'ops-tab-bar';
  bar.setAttribute('role', 'tablist');
  bar.setAttribute('aria-label', 'Ops views');
  bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:20px;border-bottom:1px solid #1c2028;padding-bottom:0;';
  bar.innerHTML = OPS_TABS.map(t => `
    <button class="ops-tab-btn" role="tab" id="ops-tabbtn-${t.id}" aria-controls="ops-tab-${t.id}" aria-selected="false" tabindex="-1"
      data-ops-tab="${t.id}" style="background:none;border:none;
      color:${OPS_COLORS.textDim};font-size:13px;font-weight:600;padding:10px 16px;cursor:pointer;
      border-bottom:2px solid transparent;">${_escapeHtml(t.label)}</button>
  `).join('');

  const contentWrap = document.createElement('div');
  contentWrap.id = 'ops-tab-content';
  OPS_TABS.forEach(t => {
    const div = document.createElement('div');
    div.id = `ops-tab-${t.id}`;
    div.setAttribute('role', 'tabpanel');
    div.setAttribute('aria-labelledby', `ops-tabbtn-${t.id}`);
    div.style.display = 'none';
    contentWrap.appendChild(div);
  });

  panel.insertBefore(contentWrap, panel.firstChild);
  panel.insertBefore(bar, panel.firstChild);

  bar.querySelectorAll('.ops-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => ops_switchTab(btn.dataset.opsTab));
    btn.addEventListener('keydown', ev => {
      const i = OPS_TABS.findIndex(t => t.id === btn.dataset.opsTab);
      const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: OPS_TABS.length - 1 }[ev.key];
      if (j === undefined) return;
      ev.preventDefault();
      const next = OPS_TABS[(j + OPS_TABS.length) % OPS_TABS.length].id;
      ops_switchTab(next);
      const nb = document.getElementById(`ops-tabbtn-${next}`);
      if (nb) nb.focus();
    });
  });

  ops_switchTab('cases');   // the console opens on Cases (§5)
}

function ops_switchTab(tabName) {
  _opsActiveTab = tabName;
  OPS_TABS.forEach(t => {
    const el = document.getElementById(`ops-tab-${t.id}`);
    if (el) el.style.display = t.id === tabName ? 'block' : 'none';
  });
  document.querySelectorAll('.ops-tab-btn').forEach(btn => {
    const active = btn.dataset.opsTab === tabName;
    btn.style.color = active ? OPS_COLORS.teal : OPS_COLORS.textDim;
    btn.style.borderBottomColor = active ? OPS_COLORS.teal : 'transparent';
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
    btn.setAttribute('tabindex', active ? '0' : '-1');
  });

  // M-3: Health reads and polls only while it is the visible tab.
  if (tabName === 'health') { openOps({ skipCreate: true }); _opsStartPoll(); }
  else _opsStopPoll();
  if (tabName === 'cases') ops_loadCases();
  else if (tabName === 'dq') ops_loadDq();
  else if (tabName === 'sprint') ops_loadSprintBoard();
  else if (tabName === 'release') ops_loadReleaseLedger();
  else if (tabName === 'events') ops_loadEventTimeline();
  else if (tabName === 'drift') ops_loadDriftTab();
}

// The views draw their Refresh buttons as data-ops-refresh="<tab>"; one delegated listener per
// container wires them, so no inline on*= handler is ever emitted (Ops review M-1).
function _opsWireRefresh(container, load) {
  const btn = container.querySelector('[data-ops-refresh]');
  if (btn) btn.addEventListener('click', load);
}
const OPS_READ_ONLY_NOTE = 'Read-only. Changes are made by the Main Lane.';

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
      </div>`;
  }).join('');

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="font-size:13px;color:${OPS_COLORS.textDim};text-transform:uppercase;letter-spacing:0.08em;">Sprint Board — ${items.length} tickets</div>
      <button type="button" data-ops-refresh="sprint" style="background:${OPS_COLORS.teal};color:#0a0c10;border:none;
        border-radius:6px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;">Refresh</button>
    </div>
    ${cards || `<div style="color:${OPS_COLORS.textDim};padding:20px;">No tickets yet.</div>`}
    <div style="margin-top:12px;font-size:12px;color:${OPS_COLORS.textDim};">${OPS_READ_ONLY_NOTE}</div>
  `;
  _opsWireRefresh(container, ops_loadSprintBoard);
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
    </tr>`).join('');

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="font-size:13px;color:${OPS_COLORS.textDim};text-transform:uppercase;letter-spacing:0.08em;">Release Ledger — ${items.length} releases</div>
      <button type="button" data-ops-refresh="release" style="background:${OPS_COLORS.teal};color:#0a0c10;border:none;
        border-radius:6px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;">Refresh</button>
    </div>
    <table style="width:100%;border-collapse:collapse;background:${OPS_COLORS.bg2};border-radius:10px;overflow:hidden;">
      <thead><tr style="border-bottom:1px solid #1c2028;">
        <th style="text-align:left;padding:8px 14px;color:${OPS_COLORS.textDim};font-size:10px;text-transform:uppercase;">Release</th>
        <th style="text-align:left;padding:8px 14px;color:${OPS_COLORS.textDim};font-size:10px;text-transform:uppercase;">Summary</th>
        <th style="text-align:left;padding:8px 14px;color:${OPS_COLORS.textDim};font-size:10px;text-transform:uppercase;">Deploy status</th>
        <th style="text-align:left;padding:8px 14px;color:${OPS_COLORS.textDim};font-size:10px;text-transform:uppercase;">Status</th>
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="4" style="padding:20px;color:${OPS_COLORS.textDim};">No releases yet.</td></tr>`}</tbody>
    </table>
    <div style="margin-top:12px;font-size:12px;color:${OPS_COLORS.textDim};">${OPS_READ_ONLY_NOTE}</div>
  `;
  _opsWireRefresh(container, ops_loadReleaseLedger);
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
      <button type="button" data-ops-refresh="events" style="background:${OPS_COLORS.teal};color:#0a0c10;border:none;
        border-radius:6px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;">Refresh</button>
    </div>
    <div style="background:${OPS_COLORS.bg2};border-radius:10px;padding:8px 20px;">
      ${rows || `<div style="color:${OPS_COLORS.textDim};padding:20px 0;">No events recorded yet.</div>`}
    </div>
  `;
  _opsWireRefresh(container, ops_loadEventTimeline);
}

// --- Drift, Budget Risk, OpenFIGI Status (one combined tab) ---------------

// MA-AUG-006, 2 August 2026 — Workers whose cron firing history is worth a
// live glance. Kept short and explicit rather than deriving from anywhere
// else, since this list controls real API calls against Cloudflare's GraphQL
// Analytics — see ops-api.js's TRACKED_SCRIPTS for the enforced allowlist.
const OPS_CRON_SCRIPTS = ['meridian-holdings', 'meridian-entities-seed', 'meridian-entities-enrich'];

async function ops_loadDriftTab() {
  const container = document.getElementById('ops-tab-drift');
  if (!container) return;
  container.innerHTML = `<div style="color:${OPS_COLORS.textDim};padding:20px;">Loading…</div>`;

  const [driftRes, budgetRes, figiRes, cfD1Res, ...cfInvocationResults] = await Promise.all([
    data_opsGet('/api/ops/drift'),
    data_opsGet('/api/ops/budget-risk'),
    data_opsGet('/api/ops/openfigi-status'),
    data_opsGet('/api/ops/cf/d1-today'),
    ...OPS_CRON_SCRIPTS.map(s => data_opsGet(`/api/ops/cf/invocations?script=${encodeURIComponent(s)}`))
  ]);

  const driftHtml = ops_renderDriftPanel(driftRes.ok ? driftRes.data : null);
  const budgetHtml = ops_renderBudgetRisk(budgetRes.ok ? budgetRes.data : null);
  const figiHtml = ops_renderOpenFigiStatus(figiRes.ok ? figiRes.data : null);
  const cfHtml = ops_renderLiveCfMetrics(
    cfD1Res.ok ? cfD1Res.data : null,
    OPS_CRON_SCRIPTS.map((s, i) => ({ script: s, data: cfInvocationResults[i].ok ? cfInvocationResults[i].data : null }))
  );

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div style="font-size:13px;color:${OPS_COLORS.textDim};text-transform:uppercase;letter-spacing:0.08em;">Drift & Budget</div>
      <button type="button" data-ops-refresh="drift" style="background:${OPS_COLORS.teal};color:#0a0c10;border:none;
        border-radius:6px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;">Refresh</button>
    </div>
    ${budgetHtml}
    ${cfHtml}
    ${driftHtml}
    ${figiHtml}
  `;
  _opsWireRefresh(container, ops_loadDriftTab);
}

// MA-AUG-006: live Cloudflare-metered numbers (real, authoritative) shown
// alongside the app's own self-reported writes_today_ counter above — the 2
// August incident showed these two can diverge (real per-run multiplier
// ranged 2.56x-3.69x against assumptions), so surfacing both side by side,
// not replacing one with the other, is deliberate.
function ops_renderLiveCfMetrics(d1Data, invocations) {
  const d1Html = d1Data
    ? `<div style="font-family:var(--mono, monospace);font-size:22px;font-weight:700;">${d1Data.rowsWritten.toLocaleString()} <span style="font-size:13px;color:${OPS_COLORS.textDim};">of ${d1Data.daily_cap.toLocaleString()} rows written today (${d1Data.pct_of_cap}%) — Cloudflare-metered, account-wide</span></div>
       <div style="font-size:11px;color:${OPS_COLORS.textDim};margin-top:4px;">${d1Data.rowsRead.toLocaleString()} rows read · ${d1Data.writeQueries.toLocaleString()} write queries · ${d1Data.readQueries.toLocaleString()} read queries</div>`
    : `<div style="color:${OPS_COLORS.red};font-size:13px;">Live D1 metrics unavailable — check CF_ANALYTICS_TOKEN is set and the query's field names are verified (see ops-api.js).</div>`;

  const rows = invocations.map(({ script, data }) => {
    if (!data) return `<div style="padding:8px 0;border-bottom:1px solid #1c2028;font-size:12px;color:${OPS_COLORS.red};">${_escapeHtml(script)} — failed to load</div>`;
    const last = data.cron_invocations[data.cron_invocations.length - 1];
    const flag = data.matches_cron_only
      ? `<span style="color:${OPS_COLORS.green};">cron-only ✓</span>`
      : `<span style="color:${OPS_COLORS.red};">mismatch — ${data.all_trigger_invocation_count} total vs ${data.cron_invocation_count} cron-only</span>`;
    return `
      <div style="padding:8px 0;border-bottom:1px solid #1c2028;font-size:12px;">
        <strong>${_escapeHtml(script)}</strong> — ${data.cron_invocation_count} invocation(s) today, ${flag}
        ${last ? `<br/><span style="color:${OPS_COLORS.textDim};">last: ${_escapeHtml(last.datetime)} · cron "${_escapeHtml(last.cron)}" · ${_escapeHtml(last.status)}</span>` : ''}
      </div>`;
  }).join('');

  return `
    <div style="background:${OPS_COLORS.bg2};border-radius:10px;padding:20px;margin-bottom:16px;">
      <div style="font-size:13px;color:${OPS_COLORS.textDim};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">Live Cloudflare Metrics (MA-AUG-006)</div>
      ${d1Html}
      <div style="margin-top:16px;">${rows}</div>
    </div>`;
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
    <div style="background:${OPS_COLORS.bg2};border-radius:10px;padding:20px;margin-bottom:16px;display:flex;flex-wrap:wrap;align-items:center;gap:24px;">
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

// ============================================================
// MA-OCT-005 operator console: Cases (003) and DQ Tickets (004).
// Spec claude/MA-OCT-005_Spec.md rev 0 (e5fffec6…e6de6) with the Operations Lead review's
// MUST-FIX items M-1…M-6 (39b707ff…c496c). Founder: Option B (console in its own tab on
// meridian-ops), Sprint Board / Release Ledger read-only, cut order Fleet → New case → member
// edits. Fleet and New case are pre-cut (M-6); member status edits are in.
//
// Kept in this file rather than split into ma-ops-cases.js (spec §9 option): a 12th front-end
// file would change generate-docs.mjs's fixed list (MA-SEP-013 CR + CLAUDE.md), and the console
// shell loads exactly ma-data.js + ma-ops.js (§4.2). Network only through ma-data.js's
// data_opsAdmin. No inline on*= handlers (M-1): every control carries data-opsc-*
// attributes and one delegated listener per container handles them.
//
// The backend owns all state (D4): every view re-reads after an action; nothing is cached across
// sessions except ops_acting_role (§6.2). Server strings always pass _escapeHtml.
// Reads per call stay the 003/004 figures (lists limit=50, never 100 — N-3); nothing polls.

const OPSC_CONSOLE_URL = 'https://meridian-ops.navinmv1981.workers.dev/api/ops/admin/console';
const OPSC_LIMIT = 50;
const OPSC_ROLES = ['Founder', 'Program Orchestrator', 'Architect', 'Operations Lead', 'Engineering Lead', 'UX Lead', 'Data-Identity Lead', 'ETF Product Lead'];
const OPSC_SEVERITIES = ['sev1', 'sev2', 'sev3', 'sev4'];
const OPSC_CASE_STATUSES = ['open', 'acknowledged', 'resolved', 'dismissed'];
const OPSC_DQ_STATUSES = ['open', 'triaged', 'fix_pending', 'resolved', 'dismissed'];
const OPSC_DQ_OPEN = ['open', 'triaged', 'fix_pending'];
const OPSC_MEMBER_STATUSES = ['open', 'fixed', 'wont_fix', 'not_a_problem'];

// §7 labels. Unknown codes render raw, never dropped.
const OPSC_EXC_LABELS = {
  job_missed: 'Missed run', job_lost: 'Lost run', job_failed: 'Failed run', job_frozen: 'No progress', hold_active: 'Global hold on',
  budget_risk: 'D1 budget risk', schedule_drift: 'Schedule drift', sweep_overflow: 'Too many findings', gleif_no_progress: 'GLEIF-E1 no progress',
  gleif_stuck_in_progress: 'GLEIF-E2 stuck row', gleif_orphaned_backlog: 'GLEIF-E3 orphaned backlog', gleif_frozen_source: 'GLEIF-E4 frozen source',
  local_auth_failure: 'Local auth failure', blind_guard: 'Blind write guard', manual: 'Manual'
};
const OPSC_DQ_LABELS = {
  missing_mapping: 'No issuer mapping', ambiguous_mapping: 'Ambiguous issuer', low_confidence_mapping: 'Low-confidence mapping',
  merged_link_unresolved: 'Merged link unresolved', missing_entity: 'Issuer has no entity', wrong_lei: 'Wrong LEI', wrong_identifier: 'Wrong identifier',
  no_link_marker: 'Wrong "no link" marker', entity_merge: 'Entity merge', bad_relationship_edge: 'Bad parent link', isin_duplicate: 'Duplicate ISIN',
  gleif_handoff: 'GLEIF hand-off', data_error: 'Data error'
};
const OPSC_STATUS_LABELS = { open: 'Open', acknowledged: 'Acknowledged', triaged: 'Triaged', fix_pending: 'Fix pending', resolved: 'Resolved', dismissed: 'Dismissed',
  fixed: 'Fixed', wont_fix: "Won't fix", not_a_problem: 'Not a problem' };
// 004 §7.5: every DQ type except data_error is Entities data (resolve/dismiss for the Data-Identity Lead or Founder).
const OPSC_ENTITIES_TYPES = new Set(Object.keys(OPSC_DQ_LABELS).filter(t => t !== 'data_error'));

// 003 §7.1 / 004 §7.1. `fields` drive the form and the body; a trailing '?' marks optional.
const OPSC_ACTIONS = {
  EXC: {
    acknowledge:  { label: 'Acknowledge', from: ['open'], fields: ['note?'] },
    assign:       { label: 'Assign', from: ['open', 'acknowledged'], fields: ['owner_role?', 'assignee?'] },
    comment:      { label: 'Comment', from: OPSC_CASE_STATUSES, fields: ['note'] },
    set_severity: { label: 'Set severity', from: ['open', 'acknowledged'], fields: ['severity', 'note'] },
    resolve:      { label: 'Resolve', from: ['open', 'acknowledged'], fields: ['resolution', 'note'], codes: ['fixed', 'replayed', 'transient', 'accepted_risk', 'superseded'] },
    dismiss:      { label: 'Dismiss', from: ['open', 'acknowledged'], fields: ['resolution', 'duplicate_of?', 'note'], codes: ['false_positive', 'duplicate', 'not_actionable'] },
    reopen:       { label: 'Reopen', from: ['resolved', 'dismissed'], fields: ['note'] }
  },
  DQ: {
    triage:         { label: 'Triage', from: ['open'], fields: ['owner_role', 'severity?'] },
    schedule_fix:   { label: 'Schedule fix', from: ['open', 'triaged'], fields: ['fix_ref', 'note'] },
    assign:         { label: 'Assign', from: OPSC_DQ_OPEN, fields: ['owner_role?', 'assignee?'] },
    comment:        { label: 'Comment', from: OPSC_DQ_STATUSES, fields: ['note'] },
    set_severity:   { label: 'Set severity', from: OPSC_DQ_OPEN, fields: ['severity', 'note'] },
    link_exception: { label: 'Link exception', from: OPSC_DQ_OPEN, fields: ['exception_ref', 'note?'] },
    resolve:        { label: 'Resolve', from: OPSC_DQ_OPEN, fields: ['disposition', 'force?', 'note'], codes: ['fixed', 'source_absence', 'valid_exception', 'pipeline_omission', 'job_failure'] },
    dismiss:        { label: 'Dismiss', from: OPSC_DQ_OPEN, fields: ['disposition', 'duplicate_of?', 'note'], codes: ['duplicate', 'not_a_problem', 'wont_fix'] },
    reopen:         { label: 'Reopen', from: ['resolved', 'dismissed'], fields: ['note', 'founder_supersession?'] }
  }
};
const OPSC_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPSC_EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const OPSC_SERVICE_RE = /^service:[a-z0-9][a-z0-9._-]{0,63}$/;
const OPSC_FIX_REF_RE = /^(?:MA-[A-Z]{3}-[A-Z0-9][A-Z0-9.-]{0,30}|[A-Za-z0-9-]{0,20}CR[A-Za-z0-9.-]{0,30})(?: .{1,100})?$/;
const OPSC_REF_RE = { EXC: /^EXC-(S-[0-9A-F]{12,16}|M-\d{6}|\d{6})$/, DQ: /^DQ-(M-\d{6}|\d{6})$/ };

const opscEsc = s => _escapeHtml(s);
const opscLabel = (map, code) => (code == null ? '—' : map[code] || String(code));
const opscSentence = code => (code == null ? '—' : String(code).replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()));
const opscKind = ref => (String(ref).startsWith('DQ-') ? 'DQ' : 'EXC');

// --- pure: what the operator may do now -------------------------------------------------

// Returns the action buttons for a case or ticket, with the server's gates mirrored (the server still enforces).
function opsc_legalActions(kind, row, events) {
  const fixScheduled = (events || []).some(e => e.event_type === 'fix_scheduled');
  return Object.entries(OPSC_ACTIONS[kind]).filter(([, a]) => a.from.includes(row.status))
    .map(([action, a]) => ({ action, label: a.label, fixScheduled }));
}

function opsc_isProtected(row) { return row && row.disposition === 'do_not_merge'; }

// --- pure: request bodies (Ops review M-4) ----------------------------------------------------

// form: plain object of field values. ctx: { row, requestId, actingRole, fixScheduled, membersOpen }.
// Returns { body } or { error, field } — an error blocks the submit; nothing is sent.
function opsc_buildActionBody(kind, action, form, ctx) {
  const spec = OPSC_ACTIONS[kind] && OPSC_ACTIONS[kind][action];
  if (!spec) return { error: 'Unknown action.' };
  const f = form || {};
  const note = typeof f.note === 'string' ? f.note.trim() : '';
  const body = { action, request_id: ctx.requestId, expected_status: ctx.row.status };
  if (ctx.actingRole) body.actor_role = ctx.actingRole;
  const need = name => spec.fields.includes(name);
  if (need('note')) {
    if (!note) return { error: 'Add a note.', field: 'note' };
  }
  if (note) {
    if (note.length > 2000) return { error: 'A note is at most 2,000 characters.', field: 'note' };
    body.note = note;
  }
  const codeField = kind === 'EXC' ? 'resolution' : 'disposition';
  switch (action) {
    case 'assign': {
      const role = f.owner_role || '', asg = (f.assignee || '').trim();
      if (!role && !asg) return { error: 'Choose an owner role or enter an assignee.', field: 'owner_role' };
      if (role && !OPSC_ROLES.includes(role)) return { error: 'Choose an owner role from the list.', field: 'owner_role' };
      if (asg && !OPSC_EMAIL_RE.test(asg) && !OPSC_SERVICE_RE.test(asg)) return { error: 'The assignee is an email address or service:<name>.', field: 'assignee' };
      if (role) body.owner_role = role;
      if (asg) body.assignee = asg;
      break;
    }
    case 'triage':
      if (!OPSC_ROLES.includes(f.owner_role)) return { error: 'Choose an owner role.', field: 'owner_role' };
      body.owner_role = f.owner_role;
      if (f.severity) {
        if (!OPSC_SEVERITIES.includes(f.severity)) return { error: 'Choose a severity.', field: 'severity' };
        body.severity = f.severity;
      }
      break;
    case 'set_severity':
      if (!OPSC_SEVERITIES.includes(f.severity)) return { error: 'Choose a severity.', field: 'severity' };
      body.severity = f.severity;
      break;
    case 'schedule_fix': {
      const ref = (f.fix_ref || '').trim();
      if (!OPSC_FIX_REF_RE.test(ref)) return { error: 'The fix ref is a packet (MA-OCT-…) or a CR id.', field: 'fix_ref' };
      body.fix_ref = ref;
      break;
    }
    case 'link_exception': {
      const ref = (f.exception_ref || '').trim();
      if (!OPSC_REF_RE.EXC.test(ref)) return { error: 'Enter an exception ref (EXC-…).', field: 'exception_ref' };
      body.exception_ref = ref;
      break;
    }
    case 'resolve':
    case 'dismiss': {
      const code = f[codeField];
      if (!spec.codes.includes(code)) return { error: 'Choose a resolution.', field: codeField };
      if (kind === 'DQ' && action === 'resolve' && code === 'fixed' && !ctx.fixScheduled) {
        return { error: 'Schedule the fix first (Schedule fix), then resolve as Fixed.', field: codeField };
      }
      body[codeField] = code;
      if (code === 'duplicate') {
        const dup = (f.duplicate_of || '').trim();
        if (!OPSC_REF_RE[kind].test(dup)) return { error: `Enter the ${kind === 'EXC' ? 'EXC-' : 'DQ-'} ref it duplicates.`, field: 'duplicate_of' };
        if (dup === ctx.row.case_ref) return { error: 'A case cannot duplicate itself.', field: 'duplicate_of' };
        body.duplicate_of = dup;
      }
      if (kind === 'DQ' && action === 'resolve' && f.force) {
        if (!ctx.membersOpen) return { error: 'Force is only for a ticket with open members.', field: 'force' };
        if (!f.confirm) return { error: 'Tick the confirmation to force-resolve with open members.', field: 'confirm' };
        body.force = true;
      }
      break;
    }
    case 'reopen':
      if (kind === 'DQ' && opsc_isProtected(ctx.row)) {
        const reference = (f.supersession_reference || '').trim(), decidedAt = (f.supersession_decided_at || '').trim();
        if (!reference) return { error: 'A protected decision needs the Founder supersession reference.', field: 'supersession_reference' };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(decidedAt)) return { error: 'Enter the date the Founder decided (YYYY-MM-DD).', field: 'supersession_decided_at' };
        if (!f.confirm) return { error: 'Tick the confirmation to reopen a protected Founder decision.', field: 'confirm' };
        body.founder_supersession = { reference, decided_at: decidedAt };
      }
      break;
    default:
      break;
  }
  return { body };
}

// 004 §7.1 member_update. member: the row as last read (its status is the expected one, AC-9).
function opsc_buildMemberBody(member, form, ctx) {
  const to = form.member_status, note = (form.note || '').trim();
  if (!OPSC_MEMBER_STATUSES.includes(to) || to === member.member_status) return { error: 'Choose a new member status.', field: 'member_status' };
  if (note.length > 500) return { error: 'A member note is at most 500 characters.', field: 'note' };
  if (to === 'fixed') {
    if (!note) return { error: 'Name the applied fix packet in the note.', field: 'note' };
    if (!form.confirm) return { error: 'Tick the confirmation to mark the member Fixed.', field: 'confirm' };
  }
  const body = { action: 'member_update', request_id: ctx.requestId, expected_status: ctx.row.status,
                 member: { object_domain: member.object_domain, object_key: member.object_key },
                 expected_member_status: member.member_status, member_status: to };
  if (note) body.note = note;
  if (ctx.actingRole) body.actor_role = ctx.actingRole;
  return { body };
}

// --- pure: response → copy (§6.3 + Ops review M-5) ------------------------------------------

const OPSC_CHANGED = 'This changed since you opened it. It has been refreshed — check it and try again.';
const OPSC_400 = {
  'note is required': 'Add a note.', 'invalid severity': 'Choose a severity.', 'expected_status is required': 'Console error — reload the page.',
  'owner_role is required': 'Choose an owner role.', 'invalid owner_role': 'Choose an owner role from the list.'
};
// Returns { tone: 'ok' | 'warn' | 'error', text, reread, retrySame, signedOut }.
function opsc_mapResponse(res) {
  const out = (tone, text, extra = {}) => ({ tone, text, reread: false, retrySame: false, signedOut: false, ...extra });
  if (!res || res.kind === 'network' || res.kind === 'timeout') return out('error', "Couldn't reach Ops. Retry sends the same request.", { retrySame: true });
  if (res.kind === 'signed_out') return out('error', 'Your sign-in has expired. Sign in again — what you typed is kept.', { signedOut: true });
  const d = res.data || {}, code = typeof d.error === 'string' ? d.error : '';
  if (res.kind === 'non_json' || res.status >= 500 && res.status !== 503) {
    return out('error', `Ops is unavailable (HTTP ${res.status}). Nothing was changed unless the list shows it; Refresh.`, { reread: true });
  }
  if (res.ok) {
    if (d.replay) return out('ok', 'Already saved.', { reread: true });
    if (d.deduplicated) return out('ok', `Already reported as ${d.case_ref}.`, { reread: true });
    return out('ok', 'Saved.', { reread: true });
  }
  switch (res.status) {
    case 400:
      if (code.startsWith('csrf')) return out('error', 'Console error — reload the page.');
      return out('error', OPSC_400[code] || `The server rejected this request: ${code || 'unknown error'}.`);
    case 403: return out('error', "This action isn't allowed for your sign-in.");
    case 404: return out('error', 'Not found — it may have changed. Refresh.', { reread: true });
    case 409:
      if (['illegal_transition', 'stale_expected_status', 'not_applied', 'stale_member_status', 'already_linked'].includes(code)) return out('warn', OPSC_CHANGED, { reread: true });
      if (code === 'request_id_reused') return out('warn', 'That request was already sent.', { reread: true });
      if (code === 'members_open') return out('warn', 'Some members are still open. Tick Force and say why, or update the members first.');
      if (code === 'fix_not_scheduled') return out('warn', 'Schedule the fix first (Schedule fix), then resolve as Fixed.');
      if (code === 'protected_decision') return out('warn', 'This is a protected Founder decision. Reopening needs a Founder supersession reference.');
      if (code === 'member_cap') return out('warn', 'This ticket already holds the maximum of 500 members.');
      if (code === 'dq_actions_arrive_with_ma_oct_004') return out('warn', 'DQ actions are not live yet.');
      return out('warn', `${OPSC_CHANGED} (${code || 'conflict'})`, { reread: true });
    case 422: return out('error', `The server could not find that reference: ${code}.`);
    case 429: return out('error', 'Daily ticket limit reached. Try again tomorrow.');
    case 503: return out('error', 'Case management is switched off right now.');
    default: return out('error', `The server rejected this request (HTTP ${res.status}).`);
  }
}

// --- pure: rendering ----------------------------------------------------------------------------

const OPSC_SEV_COLOR = { sev1: OPS_COLORS.red, sev2: OPS_COLORS.amber, sev3: OPS_COLORS.teal, sev4: OPS_COLORS.grey };
function opsc_sevBadge(sev) {
  const c = OPSC_SEV_COLOR[sev] || OPS_COLORS.grey;
  const label = /^sev[1-4]$/.test(sev || '') ? `Sev ${sev.slice(3)}` : (sev || '—');
  return `<span style="display:inline-block;border:1px solid ${c};color:${c};border-radius:4px;padding:1px 6px;font-size:11px;font-weight:700;white-space:nowrap;">${opscEsc(label)}</span>`;
}
const OPSC_TH = `style="text-align:left;padding:8px 10px;color:${OPS_COLORS.textDim};font-size:10px;text-transform:uppercase;font-weight:600;"`;
const OPSC_TD = 'style="padding:9px 10px;font-size:13px;vertical-align:top;"';
const opscBtn = (extra = '') => `style="background:none;border:1px solid #2a3038;color:${OPS_COLORS.text};border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;${extra}"`;
const OPSC_BTN = opscBtn();
const OPSC_BTN_PRIMARY = `style="background:${OPS_COLORS.teal};color:#0a0c10;border:none;border-radius:6px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;"`;

function opsc_statusChips(view, statuses, active) {
  return `<div role="group" aria-label="Status filter" style="display:flex;gap:6px;flex-wrap:wrap;">${statuses.map(s => {
    const on = active.includes(s);
    return `<button type="button" data-opsc-chip="${s}" aria-pressed="${on}" style="border-radius:12px;padding:4px 10px;font-size:12px;cursor:pointer;
      border:1px solid ${on ? OPS_COLORS.teal : '#2a3038'};background:${on ? 'rgba(77,200,200,0.12)' : 'none'};color:${on ? OPS_COLORS.teal : OPS_COLORS.textDim};">${opscEsc(OPSC_STATUS_LABELS[s] || s)}${on ? ' ✓' : ''}</button>`;
  }).join('')}</div>`;
}

// state: { items, statuses, next_cursor, loading, error, rows_read }
function opsc_renderList(kind, state) {
  const isDq = kind === 'DQ';
  const title = isDq ? 'DQ Tickets' : 'Cases';
  const items = state.items || [];
  const counts = OPSC_SEVERITIES.map(s => [s, items.filter(i => i.severity === s).length]).filter(([, n]) => n);
  const countLine = counts.length ? counts.map(([s, n]) => `${opscEsc(`Sev ${s.slice(3)}`)}: ${n}`).join(' · ') + (state.next_cursor ? ' (on this page)' : '') : '';
  const head = isDq
    ? ['Sev', 'Ref', 'Type', 'Title', 'Object', 'Owner', 'Status', 'Age']
    : ['Sev', 'Ref', 'Type', 'Title', 'Job', 'Opened', 'Owner', 'Status'];
  const rows = items.map(i => {
    const overdue = i.overdue ? ` <span style="color:${OPS_COLORS.red};font-size:11px;font-weight:700;">Overdue</span>` : '';
    const prot = isDq && opsc_isProtected(i) ? ` <span style="color:${OPS_COLORS.amber};font-size:11px;font-weight:700;">Protected decision</span>` : '';
    const opened = `<span title="${opscEsc(i.opened_at)}">${opscEsc(_timeAgo(i.opened_at))}</span>`;
    const cells = isDq
      ? [opsc_sevBadge(i.severity), `<span style="font-family:var(--mono, monospace);">${opscEsc(i.case_ref)}</span>`, opscEsc(opscLabel(OPSC_DQ_LABELS, i.ticket_type)),
         opscEsc(i.title) + prot, `<span style="font-family:var(--mono, monospace);font-size:12px;">${opscEsc(i.object_domain)}:${opscEsc(i.object_key)}</span>`
           + (i.merged_into ? `<br/><span style="font-size:11px;color:${OPS_COLORS.textDim};">merged into ${opscEsc(i.merged_into)}</span>` : ''),
         opscEsc(i.owner_role || '—'), opscEsc(OPSC_STATUS_LABELS[i.status] || i.status), `${opened}${overdue}`]
      : [opsc_sevBadge(i.severity), `<span style="font-family:var(--mono, monospace);">${opscEsc(i.case_ref)}</span>`, opscEsc(opscLabel(OPSC_EXC_LABELS, i.exception_type)),
         opscEsc(i.title), opscEsc(i.job_id || '—'), `${opened}${overdue}`, opscEsc(i.owner_role || '—'), opscEsc(OPSC_STATUS_LABELS[i.status] || i.status)];
    return `<tr tabindex="0" data-opsc-open="${opscEsc(i.case_ref)}" aria-label="${opscEsc(i.case_ref)} ${opscEsc(i.title)}" style="border-bottom:1px solid #1c2028;cursor:pointer;">
      ${cells.map(c => `<td ${OPSC_TD}>${c}</td>`).join('')}</tr>`;
  }).join('');
  const empty = isDq ? 'No tickets with these statuses.' : 'No open cases. The last sweep raised nothing new.';
  const body = state.loading && !items.length
    ? `<tr><td colspan="${head.length}" ${OPSC_TD}><span style="color:${OPS_COLORS.textDim};">Loading…</span></td></tr>`
    : rows || `<tr><td colspan="${head.length}" ${OPSC_TD}><span style="color:${OPS_COLORS.textDim};">${empty}</span></td></tr>`;
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
      <div>
        <div style="font-size:13px;color:${OPS_COLORS.textDim};text-transform:uppercase;letter-spacing:0.08em;">${title}</div>
        <div style="font-size:12px;color:${OPS_COLORS.textDim};margin-top:4px;" aria-live="polite">${countLine}</div>
      </div>
      <button type="button" data-opsc-refresh="1" ${OPSC_BTN_PRIMARY}>Refresh</button>
    </div>
    ${opsc_statusChips(kind, isDq ? OPSC_DQ_STATUSES : OPSC_CASE_STATUSES, state.statuses)}
    ${state.error ? `<div role="alert" style="margin-top:12px;color:${OPS_COLORS.red};font-size:13px;">${opscEsc(state.error)}</div>` : ''}
    <table style="width:100%;border-collapse:collapse;margin-top:12px;background:${OPS_COLORS.bg2};border-radius:10px;overflow:hidden;">
      <thead><tr style="border-bottom:1px solid #1c2028;">${head.map(h => `<th ${OPSC_TH} scope="col">${h}</th>`).join('')}</tr></thead>
      <tbody>${body}</tbody>
    </table>
    ${state.next_cursor ? `<div style="margin-top:10px;font-size:12px;color:${OPS_COLORS.textDim};">Showing ${items.length} · <button type="button" data-opsc-more="1" ${OPSC_BTN}>Load more</button></div>` : ''}`;
}

function opsc_kv(rows) {
  return `<table style="border-collapse:collapse;font-size:12px;">${rows.filter(([, v]) => v != null && v !== '').map(([k, v]) =>
    `<tr><th scope="row" style="text-align:left;padding:3px 12px 3px 0;color:${OPS_COLORS.textDim};font-weight:500;vertical-align:top;">${opscEsc(k)}</th>
     <td style="padding:3px 0;word-break:break-word;">${opscEsc(typeof v === 'object' ? JSON.stringify(v) : v)}</td></tr>`).join('')}</table>`;
}
function opsc_section(title, inner) {
  return `<section style="margin-top:18px;"><h3 style="font-size:12px;color:${OPS_COLORS.textDim};text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px;">${opscEsc(title)}</h3>${inner}</section>`;
}

function opsc_renderHistory(events) {
  const list = events || [];
  const rows = list.map(e => `
    <li style="padding:8px 0;border-bottom:1px solid #1c2028;font-size:12px;">
      <div><strong>${opscEsc(opscSentence(e.event_type))}</strong>
        ${e.from_value || e.to_value ? `<span style="color:${OPS_COLORS.textDim};">${opscEsc(e.from_value || '—')} → ${opscEsc(e.to_value || '—')}</span>` : ''}
        <span style="color:${OPS_COLORS.textDim};" title="${opscEsc(e.occurred_at)}">· ${opscEsc(_timeAgo(e.occurred_at))}</span></div>
      <div style="color:${OPS_COLORS.textDim};">${opscEsc(e.actor)}${e.actor_role ? ` (${opscEsc(e.actor_role)})` : ''}</div>
      ${e.body ? `<div style="margin-top:4px;white-space:pre-wrap;">${opscEsc(e.body)}</div>` : ''}
    </li>`).join('');
  const cap = list.length >= 200 ? `<div style="font-size:11px;color:${OPS_COLORS.textDim};margin-top:6px;">Showing the first 200 events.</div>` : '';
  return `<ol style="list-style:none;margin:0;padding:0;">${rows || `<li style="font-size:12px;color:${OPS_COLORS.textDim};">No events.</li>`}</ol>${cap}`;
}

function opsc_select(name, label, options, value, extra = '') {
  return `<label style="display:block;margin-top:10px;font-size:12px;" for="opsc-f-${name}">${opscEsc(label)}</label>
    <select id="opsc-f-${name}" name="${name}" ${extra} style="margin-top:4px;background:#0a0c10;color:${OPS_COLORS.text};border:1px solid #2a3038;border-radius:6px;padding:6px;">
      ${options.map(o => {
        const [v, l, dis] = Array.isArray(o) ? o : [o, o];
        return `<option value="${opscEsc(v)}"${v === value ? ' selected' : ''}${dis ? ' disabled' : ''}>${opscEsc(l)}</option>`;
      }).join('')}</select>`;
}
function opsc_input(name, label, value, extra = '') {
  return `<label style="display:block;margin-top:10px;font-size:12px;" for="opsc-f-${name}">${opscEsc(label)}</label>
    <input id="opsc-f-${name}" name="${name}" value="${opscEsc(value || '')}" ${extra} style="margin-top:4px;width:100%;box-sizing:border-box;background:#0a0c10;color:${OPS_COLORS.text};border:1px solid #2a3038;border-radius:6px;padding:6px;">`;
}
function opsc_check(name, label) {
  return `<label style="display:flex;gap:8px;align-items:flex-start;margin-top:10px;font-size:12px;"><input type="checkbox" name="${name}" id="opsc-f-${name}"> <span>${opscEsc(label)}</span></label>`;
}

// ctx: { row, events, membersOpen, actingRole, draft, error, errorField }
function opsc_renderForm(kind, action, ctx) {
  const spec = OPSC_ACTIONS[kind][action];
  const d = ctx.draft || {};
  const has = n => spec.fields.includes(n) || spec.fields.includes(`${n}?`);
  const req = n => spec.fields.includes(n);
  const fixScheduled = (ctx.events || []).some(e => e.event_type === 'fix_scheduled');
  let html = '';
  if (has('owner_role')) html += opsc_select('owner_role', `Owner role${req('owner_role') ? ' (required)' : ''}`, [['', '—']].concat(OPSC_ROLES.map(r => [r, r])), d.owner_role || '');
  if (has('assignee')) html += opsc_input('assignee', 'Assignee (email or service:<name>, optional)', d.assignee);
  if (has('severity')) {
    html += opsc_select('severity', `Severity${req('severity') ? ' (required)' : ''}`, [['', '—']].concat(OPSC_SEVERITIES.map(s => [s, `Sev ${s.slice(3)}`])), d.severity || '');
    html += `<div style="font-size:11px;color:${OPS_COLORS.textDim};margin-top:4px;">Sev 1 and Sev 2 notify the Founder at the next health check.</div>`;
  }
  if (has('fix_ref')) html += opsc_input('fix_ref', 'Fix ref — the packet or CR doing the fix (required)', d.fix_ref, 'placeholder="MA-OCT-019"');
  if (has('exception_ref')) html += opsc_input('exception_ref', 'Exception ref (EXC-…, required)', d.exception_ref);
  const codeField = kind === 'EXC' ? 'resolution' : 'disposition';
  if (has(codeField)) {
    const gated = kind === 'DQ' && action === 'resolve' && !fixScheduled;
    html += opsc_select(codeField, 'Resolution (required)', [['', 'Choose…']].concat(spec.codes.map(c => [c, opscSentence(c) + (gated && c === 'fixed' ? ' — schedule the fix first' : ''), gated && c === 'fixed'])), d[codeField] || '');
    if (gated) html += `<div style="font-size:11px;color:${OPS_COLORS.textDim};margin-top:4px;">"Fixed" is available after a Schedule fix event.</div>`;
  }
  if (has('duplicate_of')) html += opsc_input('duplicate_of', `Duplicate of (${kind === 'EXC' ? 'EXC-' : 'DQ-'}…; only for "Duplicate")`, d.duplicate_of);
  if (kind === 'DQ' && action === 'resolve' && ctx.membersOpen) {
    html += opsc_check('force', 'Force: resolve although some members are still open (say why in the note)');
    html += opsc_check('confirm', 'I confirm: force-resolve with open members');
  }
  if (kind === 'DQ' && action === 'reopen' && opsc_isProtected(ctx.row)) {
    html += `<div style="margin-top:10px;font-size:12px;color:${OPS_COLORS.amber};">Protected Founder decision (do not merge). Reopening needs the Founder's supersession.</div>`;
    html += opsc_input('supersession_reference', 'Founder supersession reference (required)', d.supersession_reference);
    html += opsc_input('supersession_decided_at', 'Decided at (YYYY-MM-DD, required)', d.supersession_decided_at, 'placeholder="2026-10-31"');
    html += opsc_check('confirm', 'I confirm: reopen a protected Founder decision');
  }
  if (kind === 'DQ' && (action === 'resolve' || action === 'dismiss') && OPSC_ENTITIES_TYPES.has(ctx.row.ticket_type)) {
    html += `<div style="margin-top:10px;font-size:12px;color:${OPS_COLORS.textDim};">Resolve and dismiss are for the Data-Identity Lead or the Founder.</div>`;
  }
  if (has('note')) {
    html += `<label style="display:block;margin-top:10px;font-size:12px;" for="opsc-f-note">Note${req('note') ? ' (required)' : ' (optional)'}</label>
      <textarea id="opsc-f-note" name="note" maxlength="2000" rows="3" style="margin-top:4px;width:100%;box-sizing:border-box;background:#0a0c10;color:${OPS_COLORS.text};border:1px solid #2a3038;border-radius:6px;padding:6px;">${opscEsc(d.note || '')}</textarea>`;
  }
  html += opsc_select('actor_role', 'Acting as (recorded as your role; your identity comes from sign-in)', OPSC_ROLES.map(r => [r, r]), ctx.actingRole || 'Founder');
  const err = ctx.error ? `<div id="opsc-form-error" role="alert" style="margin-top:10px;color:${OPS_COLORS.red};font-size:12px;">${opscEsc(ctx.error)}</div>` : '';
  return `<form data-opsc-form="${action}" aria-describedby="${ctx.error ? 'opsc-form-error' : ''}" style="margin-top:12px;padding:14px;border:1px solid #2a3038;border-radius:8px;">
      <div style="font-weight:700;font-size:13px;">${opscEsc(spec.label)}</div>${html}${err}
      <div style="display:flex;gap:8px;margin-top:12px;"><button type="submit" ${OPSC_BTN_PRIMARY}>${opscEsc(spec.label)}</button>
      <button type="button" data-opsc-cancel="1" ${OPSC_BTN}>Cancel</button></div></form>`;
}

function opsc_renderMembers(row, members, cursor, ui) {
  if (!members || !members.length) return '';
  const editable = OPSC_DQ_OPEN.includes(row.status);
  const rows = members.map((m, i) => {
    const ref = (() => { try { return m.object_ref ? JSON.parse(m.object_ref) : null; } catch { return m.object_ref; } })();
    const editing = ui && ui.memberIndex === i;
    const form = editing ? `
      <form data-opsc-member-form="${i}" style="margin-top:8px;">
        ${opsc_select('member_status', 'New status', OPSC_MEMBER_STATUSES.filter(s => s !== m.member_status).map(s => [s, OPSC_STATUS_LABELS[s]]), (ui.draft || {}).member_status || '')}
        <label style="display:block;margin-top:8px;font-size:12px;" for="opsc-f-mnote">Note (required for Fixed: name the applied fix packet)</label>
        <textarea id="opsc-f-mnote" name="note" maxlength="500" rows="2" style="width:100%;box-sizing:border-box;background:#0a0c10;color:${OPS_COLORS.text};border:1px solid #2a3038;border-radius:6px;padding:6px;">${opscEsc((ui.draft || {}).note || '')}</textarea>
        ${opsc_check('confirm', 'I confirm: mark Fixed (only after the fix packet was applied)')}
        ${ui.error ? `<div role="alert" style="margin-top:6px;color:${OPS_COLORS.red};font-size:12px;">${opscEsc(ui.error)}</div>` : ''}
        <div style="display:flex;gap:8px;margin-top:8px;"><button type="submit" ${OPSC_BTN_PRIMARY}>Save member</button><button type="button" data-opsc-cancel="1" ${OPSC_BTN}>Cancel</button></div>
      </form>` : '';
    return `<tr style="border-bottom:1px solid #1c2028;">
      <td ${OPSC_TD}><span style="font-family:var(--mono, monospace);font-size:12px;">${opscEsc(m.object_domain)}:${opscEsc(m.object_key)}</span>
        ${m.merged_into ? `<br/><span style="font-size:11px;color:${OPS_COLORS.textDim};">merged into ${opscEsc(m.merged_into)}</span>` : ''}
        ${ref && ref.name ? `<br/><span style="font-size:11px;color:${OPS_COLORS.textDim};">${opscEsc(ref.name)}</span>` : ''}</td>
      <td ${OPSC_TD}>${opscEsc(opscSentence(m.proposed_action))}</td>
      <td ${OPSC_TD}>${opscEsc(OPSC_STATUS_LABELS[m.member_status] || m.member_status)}</td>
      <td ${OPSC_TD}>${opscEsc(m.note || '')}${form}</td>
      <td ${OPSC_TD}>${editable && !editing ? `<button type="button" data-opsc-member="${i}" ${OPSC_BTN}>Change status</button>` : ''}</td></tr>`;
  }).join('');
  return opsc_section(`Members (${members.length}${cursor ? '+' : ''})`, `
    <table style="width:100%;border-collapse:collapse;"><thead><tr>${['Object', 'Proposed action', 'Status', 'Note', ''].map(h => `<th ${OPSC_TH} scope="col">${h}</th>`).join('')}</tr></thead>
    <tbody>${rows}</tbody></table>
    ${cursor ? `<button type="button" data-opsc-members-more="1" ${opscBtn('margin-top:8px;')}>Load more members</button>` : ''}`);
}

// detail: the C-1 response. ui: { form, draft, error, status, memberIndex, members, membersCursor, loading }
function opsc_renderDrawer(kind, detail, ui) {
  const row = detail.case;
  const isDq = kind === 'DQ';
  const actions = opsc_legalActions(kind, row, detail.events);
  const status = ui.status ? `<div role="status" aria-live="polite" style="margin-top:10px;font-size:13px;color:${ui.status.tone === 'ok' ? OPS_COLORS.green : ui.status.tone === 'warn' ? OPS_COLORS.amber : OPS_COLORS.red};">
      ${opscEsc(ui.status.text)}${ui.status.signedOut ? ` <button type="button" data-opsc-signin="1" ${OPSC_BTN}>Sign in again</button>` : ''}${ui.status.retrySame ? ` <button type="button" data-opsc-retry="1" ${OPSC_BTN}>Retry</button>` : ''}</div>`
    : `<div role="status" aria-live="polite"></div>`;
  let sections = '';
  if (isDq) {
    sections += opsc_section('Problem', opsc_kv([['Summary', row.summary], ['Object', `${row.object_domain}:${row.object_key}`], ['Merged into', row.merged_into],
      ['Field', row.field_name], ['Observed → expected', row.observed_value || row.expected_value ? `${row.observed_value || '—'} → ${row.expected_value || '—'}` : null],
      ['Evidence', row.evidence], ['Proposed resolution', row.proposed_resolution], ['Owner', row.owner_role], ['Assignee', row.assignee],
      ['Disposition', row.disposition ? opscSentence(row.disposition) : null], ['Resolution note', row.resolution_note], ['Raised by', `${row.raised_by} (${row.raised_via})`]]));
    sections += opsc_renderMembers(row, ui.members || detail.members, ui.membersCursor !== undefined ? ui.membersCursor : detail.members_cursor, ui);
    if (detail.linked_exception) {
      const x = detail.linked_exception;
      sections += opsc_section('Linked exception', `<button type="button" data-opsc-open="${opscEsc(x.case_ref)}" ${OPSC_BTN}>${opscEsc(x.case_ref)} — ${opscEsc(x.title)} (${opscEsc(OPSC_STATUS_LABELS[x.status] || x.status)})</button>`);
    }
  } else {
    sections += opsc_section('Summary', `<div style="font-size:13px;white-space:pre-wrap;">${opscEsc(row.summary || '—')}</div>`
      + opsc_kv([['Owner', row.owner_role], ['Assignee', row.assignee], ['Resolution', row.resolution ? opscSentence(row.resolution) : null], ['Resolved by', row.resolved_by], ['Raised by', `${row.raised_by} (${row.raised_via})`]]));
    let snap = null;
    try { snap = row.run_snapshot ? JSON.parse(row.run_snapshot) : null; } catch { snap = row.run_snapshot; }
    if (detail.registry || snap || (detail.runs || []).length) {
      sections += opsc_section('Job and run', opsc_kv([['Job', row.job_id], ['Run', row.run_id], ['Mode', detail.registry && detail.registry.execution_mode],
        ['Registry status', detail.registry && detail.registry.status]])
        + (snap ? `<div style="margin-top:6px;">${opsc_kv(Object.entries(Array.isArray(snap) ? (snap[0] || {}) : snap))}</div>` : ''));
    }
    if ((detail.linked_dq_tickets || []).length) {
      sections += opsc_section('Linked DQ tickets', detail.linked_dq_tickets.map(t =>
        `<button type="button" data-opsc-open="${opscEsc(t.case_ref)}" ${opscBtn('margin:0 6px 6px 0;')}>${opscEsc(t.case_ref)} — ${opscEsc(t.title)}</button>`).join(''));
    }
  }
  sections += opsc_section('History', opsc_renderHistory(detail.events));
  const membersOpen = (ui.members || detail.members || []).some(m => m.member_status === 'open') || !!(detail.members_cursor);
  const form = ui.form ? opsc_renderForm(kind, ui.form, { row, events: detail.events, membersOpen, actingRole: ui.actingRole, draft: ui.draft, error: ui.error }) : '';
  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
      <div>
        <div style="font-family:var(--mono, monospace);font-size:12px;color:${OPS_COLORS.textDim};">${opscEsc(row.case_ref)} · ${opscEsc(isDq ? opscLabel(OPSC_DQ_LABELS, row.ticket_type) : opscLabel(OPSC_EXC_LABELS, row.exception_type))}</div>
        <h2 id="opsc-drawer-title" tabindex="-1" style="font-size:17px;margin:6px 0 8px;outline:none;">${opscEsc(row.title)}</h2>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">${opsc_sevBadge(row.severity)}
          <span style="font-size:12px;font-weight:700;">${opscEsc(OPSC_STATUS_LABELS[row.status] || row.status)}</span>
          ${isDq && opsc_isProtected(row) ? `<span style="color:${OPS_COLORS.amber};font-size:11px;font-weight:700;">Protected decision</span>` : ''}
          ${ui.loading ? `<span style="font-size:12px;color:${OPS_COLORS.textDim};">Loading…</span>` : ''}</div>
      </div>
      <button type="button" data-opsc-close="1" aria-label="Close" ${OPSC_BTN}>Close</button>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:14px;" role="group" aria-label="Actions">
      ${actions.map(a => `<button type="button" data-opsc-action="${a.action}" aria-pressed="${ui.form === a.action}" ${OPSC_BTN}>${opscEsc(a.label)}</button>`).join('')}
    </div>
    ${status}${form}${sections}`;
}

// =============================================================================================
// Controller (DOM). Thin: state in, render out, one delegated listener per container.
// =============================================================================================

const opscState = {
  EXC: { statuses: ['open', 'acknowledged'], items: [], next_cursor: null, loading: false, error: null, wired: false },
  DQ: { statuses: ['open', 'triaged', 'fix_pending'], items: [], next_cursor: null, loading: false, error: null, wired: false },
  drawer: null   // { kind, ref, detail, ui, returnFocus }
};
const OPSC_CONTAINER = { EXC: 'ops-tab-cases', DQ: 'ops-tab-dq' };
const opscActingRole = () => { const r = _opsPref('ops_acting_role'); return OPSC_ROLES.includes(r) ? r : 'Founder'; };
const opscNewId = () => crypto.randomUUID();

function ops_loadCases() { return opsc_loadList('EXC', false); }
function ops_loadDq() { return opsc_loadList('DQ', false); }

function opsc_listPath(kind, cursor) {
  const st = opscState[kind];
  const base = kind === 'EXC' ? '/api/ops/admin/exceptions' : '/api/ops/admin/dq-tickets';
  return `${base}?status=${encodeURIComponent(st.statuses.join(','))}&limit=${OPSC_LIMIT}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
}

async function opsc_loadList(kind, more) {
  const el = document.getElementById(OPSC_CONTAINER[kind]);
  if (!el) return;
  opsc_wire(kind, el);
  const st = opscState[kind];
  st.loading = true; st.error = null;
  if (!more) { st.items = []; st.next_cursor = null; }
  el.innerHTML = opsc_renderList(kind, st);
  const res = await data_opsAdmin(opsc_listPath(kind, more ? st.next_cursor : null));
  st.loading = false;
  if (res.ok) {
    st.items = more ? st.items.concat(res.data.items || []) : (res.data.items || []);
    st.next_cursor = res.data.next_cursor || null;
  } else {
    st.error = opsc_mapResponse(res).text;
  }
  el.innerHTML = opsc_renderList(kind, st);
  if (!opscState.drawer) opsc_restoreFromHash(kind);
}

// Filters and the open ref live in the URL hash (console only), so Back works (§5.1).
function opsc_writeHash(kind) {
  if (!OPS_CONSOLE_MODE) return;
  const d = opscState.drawer;
  const ref = d && d.kind === kind ? `&ref=${encodeURIComponent(d.ref)}` : '';
  const h = `#${kind === 'EXC' ? 'cases' : 'dq'}?status=${encodeURIComponent(opscState[kind].statuses.join(','))}${ref}`;
  if (location.hash !== h) history.pushState(null, '', h);
}
function opsc_readHash() {
  const m = /^#(cases|dq)\?(.*)$/.exec(location.hash || '');
  if (!m) return null;
  const p = new URLSearchParams(m[2]);
  const kind = m[1] === 'cases' ? 'EXC' : 'DQ';
  const valid = kind === 'EXC' ? OPSC_CASE_STATUSES : OPSC_DQ_STATUSES;
  const statuses = (p.get('status') || '').split(',').filter(s => valid.includes(s));
  const ref = p.get('ref');
  return { kind, statuses, ref: ref && OPSC_REF_RE[opscKind(ref)].test(ref) ? ref : null };
}
function opsc_restoreFromHash(kind) {
  const h = opsc_readHash();
  if (h && h.kind === kind && h.ref) opsc_openDrawer(h.ref, null);
}

function opsc_wire(kind, el) {
  const st = opscState[kind];
  if (st.wired) return;
  st.wired = true;
  el.addEventListener('click', ev => {
    const t = ev.target.closest ? ev.target : null;
    if (!t) return;
    const chip = t.closest('[data-opsc-chip]'), open = t.closest('[data-opsc-open]');
    if (t.closest('[data-opsc-refresh]')) opsc_loadList(kind, false);
    else if (t.closest('[data-opsc-more]')) opsc_loadList(kind, true);
    else if (chip) {
      const s = chip.dataset.opscChip;
      st.statuses = st.statuses.includes(s) ? st.statuses.filter(x => x !== s) : st.statuses.concat(s);
      if (!st.statuses.length) st.statuses = [s];   // never an empty filter
      opsc_writeHash(kind);
      opsc_loadList(kind, false);
    } else if (open) opsc_openDrawer(open.dataset.opscOpen, open);
  });
  el.addEventListener('keydown', ev => {
    const row = ev.target.closest && ev.target.closest('tr[data-opsc-open]');
    if (row && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); opsc_openDrawer(row.dataset.opscOpen, row); }
  });
}

function opsc_drawerEl() {
  let el = document.getElementById('opsc-drawer');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'opsc-drawer';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'opsc-drawer-title');
  el.style.cssText = `position:fixed;top:0;right:0;width:min(720px,100vw);height:100vh;overflow-y:auto;z-index:3100;
    background:#0d1016;border-left:1px solid #2a3038;padding:24px;box-sizing:border-box;color:${OPS_COLORS.text};
    font-family:system-ui,-apple-system,sans-serif;box-shadow:-12px 0 32px rgba(0,0,0,0.5);`;
  (document.getElementById('ops-panel') || document.body).appendChild(el);
  el.addEventListener('click', opsc_onDrawerClick);
  el.addEventListener('submit', opsc_onDrawerSubmit);
  el.addEventListener('change', ev => { if (ev.target.name === 'actor_role') _opsPref('ops_acting_role', ev.target.value); });
  el.addEventListener('keydown', ev => { if (ev.key === 'Escape') opsc_closeDrawer(); });
  return el;
}

function opsc_paintDrawer(focusTitle) {
  const d = opscState.drawer;
  if (!d || !d.detail) return;
  const el = opsc_drawerEl();
  el.innerHTML = opsc_renderDrawer(d.kind, d.detail, { ...d.ui, actingRole: opscActingRole() });
  if (focusTitle) { const h = el.querySelector('#opsc-drawer-title'); if (h) h.focus(); }
  const f = d.ui.errorField ? el.querySelector(`[name="${d.ui.errorField}"]`) : null;
  if (f) f.focus();
}

async function opsc_openDrawer(ref, returnFocus) {
  const kind = opscKind(ref);
  const prev = opscState.drawer;
  opscState.drawer = { kind, ref, detail: prev && prev.ref === ref ? prev.detail : null, ui: { loading: true }, returnFocus: returnFocus || (prev && prev.returnFocus) || null, pending: null };
  const res = await data_opsAdmin(`/api/ops/admin/cases/${encodeURIComponent(ref)}`);
  const d = opscState.drawer;
  if (!d || d.ref !== ref) return;
  d.ui.loading = false;
  if (!res.ok) {
    const el = opsc_drawerEl();
    el.innerHTML = `<h2 id="opsc-drawer-title" tabindex="-1" style="font-size:16px;">${opscEsc(ref)}</h2>
      <div role="alert" style="color:${OPS_COLORS.red};font-size:13px;">${opscEsc(opsc_mapResponse(res).text)}</div>
      <button type="button" data-opsc-close="1" ${opscBtn('margin-top:12px;')}>Close</button>`;
    return;
  }
  d.detail = res.data;
  d.ui.members = res.data.members;
  d.ui.membersCursor = res.data.members_cursor;
  opsc_writeHash(kind);
  opsc_paintDrawer(true);
}

async function opsc_rereadDrawer(status) {
  const d = opscState.drawer;
  if (!d) return;
  const res = await data_opsAdmin(`/api/ops/admin/cases/${encodeURIComponent(d.ref)}`);
  if (res.ok) { d.detail = res.data; d.ui.members = res.data.members; d.ui.membersCursor = res.data.members_cursor; }
  d.ui.status = status;
  opsc_paintDrawer(false);
  opsc_loadList(d.kind, false);   // refresh the list row (§6.1)
}

function opsc_closeDrawer() {
  const d = opscState.drawer;
  const el = document.getElementById('opsc-drawer');
  if (el) el.remove();
  opscState.drawer = null;
  if (d) { opsc_writeHash(d.kind); if (d.returnFocus && d.returnFocus.isConnected !== false && d.returnFocus.focus) d.returnFocus.focus(); }
}

function opsc_formValues(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    out[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  }
  return out;
}

function opsc_onDrawerClick(ev) {
  const t = ev.target;
  const d = opscState.drawer;
  if (!d || !t.closest) return;
  const a = t.closest('[data-opsc-action]'), open = t.closest('[data-opsc-open]'), mem = t.closest('[data-opsc-member]');
  if (t.closest('[data-opsc-close]')) opsc_closeDrawer();
  else if (open) opsc_openDrawer(open.dataset.opscOpen, null);
  else if (a) { d.ui = { ...d.ui, form: a.dataset.opscAction, draft: null, error: null, errorField: null, status: null, memberIndex: undefined }; d.pending = null; opsc_paintDrawer(false); }
  else if (mem) { d.ui = { ...d.ui, form: null, memberIndex: Number(mem.dataset.opscMember), draft: null, error: null, status: null }; d.pending = null; opsc_paintDrawer(false); }
  else if (t.closest('[data-opsc-cancel]')) { d.ui = { ...d.ui, form: null, memberIndex: undefined, error: null, errorField: null }; d.pending = null; opsc_paintDrawer(false); }
  else if (t.closest('[data-opsc-members-more]')) opsc_moreMembers();
  else if (t.closest('[data-opsc-retry]') && d.pending) opsc_send(d.pending.body, d.pending.draft, d.pending.memberIndex);
  else if (t.closest('[data-opsc-signin]')) location.reload();
}

async function opsc_moreMembers() {
  const d = opscState.drawer;
  if (!d || !d.ui.membersCursor) return;
  const res = await data_opsAdmin(`/api/ops/admin/cases/${encodeURIComponent(d.ref)}?members_after=${encodeURIComponent(d.ui.membersCursor)}`);
  if (res.ok) { d.ui.members = (d.ui.members || []).concat(res.data.members || []); d.ui.membersCursor = res.data.members_cursor; d.ui.status = null; }
  else d.ui.status = opsc_mapResponse(res);
  opsc_paintDrawer(false);
}

function opsc_onDrawerSubmit(ev) {
  ev.preventDefault();
  const d = opscState.drawer;
  if (!d || !d.detail) return;
  const form = ev.target;
  const values = opsc_formValues(form);
  const row = d.detail.case;
  const members = d.ui.members || d.detail.members || [];
  const ctx = { row, requestId: opscNewId(), actingRole: values.actor_role || opscActingRole(),
                fixScheduled: (d.detail.events || []).some(e => e.event_type === 'fix_scheduled'),
                membersOpen: members.some(m => m.member_status === 'open') || !!d.ui.membersCursor };
  let built, memberIndex;
  if (form.dataset.opscMemberForm !== undefined) {
    memberIndex = Number(form.dataset.opscMemberForm);
    built = opsc_buildMemberBody(members[memberIndex], values, { ...ctx, actingRole: opscActingRole() });
  } else {
    built = opsc_buildActionBody(d.kind, form.dataset.opscForm, values, ctx);
  }
  if (built.error) { d.ui = { ...d.ui, draft: values, error: built.error, errorField: built.field || null }; opsc_paintDrawer(false); return; }
  opsc_send(built.body, values, memberIndex);
}

// One in-flight submit at a time; the same request_id is re-sent only by Retry after a network error (§6.1, AC-7).
async function opsc_send(body, draft, memberIndex) {
  const d = opscState.drawer;
  if (!d || d.inFlight) return;
  d.inFlight = true;
  d.ui = { ...d.ui, status: { tone: 'ok', text: 'Sending…' }, error: null, errorField: null };
  opsc_paintDrawer(false);
  const btn = document.querySelector('#opsc-drawer button[type="submit"]');
  if (btn) btn.disabled = true;
  const res = await data_opsAdmin(`/api/ops/admin/cases/${encodeURIComponent(d.ref)}/action`, { method: 'POST', body });
  d.inFlight = false;
  const m = opsc_mapResponse(res);
  d.pending = m.retrySame ? { body, draft, memberIndex } : null;
  if (m.tone === 'ok') {
    d.ui = { ...d.ui, form: null, memberIndex: undefined, draft: null };
    return opsc_rereadDrawer(m);
  }
  d.ui = { ...d.ui, draft, status: m, memberIndex };   // the form contents are kept on every failure
  if (m.reread) return opsc_rereadDrawer(m);
  opsc_paintDrawer(false);
}

window.addEventListener('popstate', () => {
  if (!OPS_CONSOLE_MODE) return;
  const h = opsc_readHash();
  if (!h) return;
  if (h.statuses.length) opscState[h.kind].statuses = h.statuses;
  if (!h.ref && opscState.drawer) { const el = document.getElementById('opsc-drawer'); if (el) el.remove(); opscState.drawer = null; }
  if (typeof ops_switchTab === 'function') ops_switchTab(h.kind === 'EXC' ? 'cases' : 'dq');
});
