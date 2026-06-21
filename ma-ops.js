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

  panel.innerHTML = `
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
    panel.innerHTML = `
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
