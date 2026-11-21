// ma-ops.js — Meridian Atlas operator console (Ops views)
// Pure vanilla JS + inline SVG/CSS. No external dependencies.
//
// MA-OCT-OPS.A (Founder "Ops option A", ML-1031-4): this file runs only inside the signed-in
// operator console (GET /api/ops/admin/console on meridian-ops, which loads it from GitHub Pages).
// The public terminal no longer loads it: its OPS button is a link to the console, so there is no
// anonymous Ops panel. The console holds four views: System Health, Cases, DQ Tickets and
// Drift & Budget.
// Events, Sprint Board and Release Ledger removed from the console by MA-NOV-UI (OPS-01); routes and tables unchanged (OPS-05).
// MA-NOV-UI (OPS-03/04): one injected <style id="ops-theme"> carries the main product's tokens and the
// .ops-* classes; every colour below comes from a token through a class. Shared states: ops_stateHtml().

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

// ---------------------------------------------------------------------------------------------
// ops-theme (MA-NOV-UI §1.5). The console CSP allows inline <style> ('unsafe-inline') but no font
// or stylesheet host, so Inter shows only where it is installed locally (UD-5). This block is the
// only place in this file that holds colour literals.
// ---------------------------------------------------------------------------------------------
const OPS_THEME_CSS = `
/* Copied from App/index.html :root — keep in step (test O-9 compares every value). */
:root {
  --bg:#07111F; --bg2:#0B1730; --bg3:#0F1B34; --bg4:#13213D;
  --border:rgba(160, 184, 214, 0.14); --border2:rgba(160, 184, 214, 0.25);
  --text:#E6EEF8; --text2:#93A4BD; --muted:#7D8D9F; --dim:#68788D;
  --green:#2D9C75; --green-bg:rgba(45, 156, 117, 0.10); --green-bd:rgba(45, 156, 117, 0.25);
  --red:#D9534F; --red-bg:rgba(217, 83, 79, 0.10); --red-bd:rgba(217, 83, 79, 0.25);
  --blue:#5A9BC8; --blue-bg:rgba(90, 155, 200, 0.12); --blue-bd:rgba(90, 155, 200, 0.30);
  --amber:#D99C3D; --amber-bg:rgba(217, 156, 61, 0.10); --amber-bd:rgba(217, 156, 61, 0.25);
  --cyan:#4E9CAF; --purple:#8E82C2; --teal:#3F928A;
  --mono:'Inter',sans-serif; --sans:'Inter',sans-serif;
  --r:2px; --sh:none;
  --sh-md:none;
  --row-h:28px;
}
/* End of the copied block. */
html,body{background:var(--bg)}
#ops-panel.ops-root{position:fixed;top:0;left:0;width:100vw;height:100vh;box-sizing:border-box;overflow-y:auto;overflow-x:hidden;z-index:3000;
  background:var(--bg);color:var(--text);font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:12px;line-height:1.45;-webkit-font-smoothing:antialiased}
.ops-root *,.ops-root *::before,.ops-root *::after{box-sizing:border-box}
.ops-root :focus-visible{outline:2px solid var(--blue);outline-offset:1px}
.ops-head{position:sticky;top:0;z-index:5;background:var(--bg2)}
.ops-titlebar{height:42px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 24px;border-bottom:1px solid var(--border)}
.ops-logo{display:flex;align-items:center;gap:8px;min-width:0}
.ops-logo svg{width:24px;height:24px;flex-shrink:0}
.ops-logo .l0{fill:#eef4fc}.ops-logo .l1{fill:#93c2e8}.ops-logo .l2{fill:#4a90d9}.ops-logo .l3{fill:#1a56a0}
.ops-logo .l4{stroke:#0e7490;fill:none}.ops-logo .l5{fill:#0e7490}
.ops-logo-name{font-size:13px;font-weight:600;color:var(--text);letter-spacing:-.01em;line-height:1.2}
.ops-logo-name span{color:var(--blue)}
.ops-logo-sub{font-size:8px;color:var(--muted);letter-spacing:.02em;line-height:1.2}
.ops-role{font-size:10.5px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ops-tabs{display:flex;flex-wrap:nowrap;gap:2px;padding:0 20px;border-bottom:1px solid var(--border);overflow-x:auto;overflow-y:hidden;
  scroll-snap-type:x proximity;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.ops-tabs::-webkit-scrollbar{display:none}
.ops-tab{flex:0 0 auto;scroll-snap-align:start;background:none;border:0;border-bottom:2px solid transparent;color:var(--text2);font-family:inherit;
  font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding:10px 10px 8px;cursor:pointer;white-space:nowrap}
.ops-tab:hover{color:var(--text)}
.ops-tab[aria-selected="true"]{color:var(--text);border-bottom-color:var(--blue)}
.ops-tab:focus-visible{outline-offset:-2px}
.ops-body{padding:16px 24px 40px}
.ops-card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);margin-bottom:10px;min-width:0}
.ops-chdr{padding:6px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;min-height:30px}
.ops-ctitle{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text);margin:0}
.ops-cbody{padding:12px}
.ops-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px}
.ops-h1{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text);margin:0}
.ops-note{font-size:11px;color:var(--text2)}
.ops-dim{color:var(--text2)}
.ops-num{font-family:var(--mono);font-variant-numeric:tabular-nums}
.ops-big{font-size:18px;font-weight:600;color:var(--text)}
.ops-mid{font-size:14px;font-weight:600;color:var(--text)}
.ops-line{margin-top:6px}
.ops-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}
.ops-grid>.ops-card{margin-bottom:0}
.ops-stack{margin-bottom:10px}
.ops-trio{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.ops-row{display:flex;gap:20px;align-items:center;flex-wrap:wrap}
.ops-stats{display:flex;gap:28px;flex-wrap:wrap}
.ops-rows>div{padding:6px 0;border-bottom:1px solid var(--border);font-size:11.5px}
.ops-rows>div:last-child{border-bottom:none}
.ops-ok{color:var(--green)}.ops-bad{color:var(--red)}
.ops-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:6px 0 0}
.ops-bar{height:8px;width:100%;background:var(--bg4);border-radius:var(--r);overflow:hidden;display:flex;margin-top:6px}
.ops-bar.thick{height:12px}
.ops-bar>i{display:block;height:100%}
.ops-fill-blue{background:var(--blue)}.ops-fill-green{background:var(--green)}.ops-fill-amber{background:var(--amber)}
.ops-fill-muted{background:var(--muted)}.ops-fill-cyan{background:var(--cyan)}
.ops-gauge{position:relative;display:inline-block;width:150px;height:150px;flex-shrink:0}
.ops-gauge svg{width:150px;height:150px;display:block}
.ops-gauge path{fill:none;stroke-width:14;stroke-linecap:round}
.ops-gauge .ops-g-track{stroke:var(--bg4)}
.ops-gauge .ops-g-guard{stroke:var(--red);stroke-width:20;stroke-linecap:butt;opacity:.85}
.ops-stroke-green{stroke:var(--green)}.ops-stroke-amber{stroke:var(--amber)}.ops-stroke-red{stroke:var(--red)}.ops-stroke-muted{stroke:var(--muted)}
.ops-gauge-val{position:absolute;top:50%;left:50%;transform:translate(-50%,-40%);text-align:center}
.ops-center{text-align:center}
.ops-btn{background:var(--bg3);border:1px solid var(--border);color:var(--text2);font-family:inherit;font-size:10.5px;font-weight:500;line-height:1.4;
  padding:3px 8px;border-radius:var(--r);cursor:pointer;white-space:nowrap;transition:background-color .15s ease,border-color .15s ease,color .15s ease}
.ops-btn:hover{background:var(--bg4);border-color:var(--border2);color:var(--text)}
.ops-btn.primary,.ops-btn[aria-pressed="true"]{background:var(--blue-bg);color:var(--blue);border-color:var(--blue-bd)}
.ops-btn:disabled{opacity:.5;cursor:default}
.ops-chips{display:flex;gap:6px;flex-wrap:wrap}
.ops-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}
.ops-btnrow{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.ops-tbl-wrap{overflow-x:auto;max-width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);margin-top:10px}
.ops-tbl-wrap.bare{background:none;border:0;margin-top:0}
.ops-tbl{width:100%;border-collapse:collapse}
.ops-tbl.wide{min-width:760px}
.ops-tbl th{padding:5px 8px;font-size:9px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--text2);background:var(--bg3);
  text-align:left;border-bottom:1px solid var(--border);white-space:nowrap}
.ops-tbl td{padding:6px 8px;height:var(--row-h);font-size:11.5px;border-bottom:1px solid var(--border);vertical-align:top;overflow-wrap:break-word}
.ops-tbl tbody tr:last-child td{border-bottom:none}
.ops-tbl tbody tr:hover td{background:rgba(160, 184, 214, 0.05)}
.ops-tbl tr[data-opsc-open]{cursor:pointer}
.ops-tbl tr[data-opsc-open]:focus-visible{outline-offset:-2px}
.ops-tbl tr[aria-current="true"] td{background:var(--bg4)}
.ops-tbl tr[aria-current="true"] td:first-child{box-shadow:inset 2px 0 0 var(--blue)}
.ops-tbl td.ops-state-cell{padding:0}
.ops-tbl td .ops-mono{white-space:nowrap}
.ops-sev{display:inline-block;font-size:9px;font-weight:600;padding:1px 6px;border-radius:var(--r);border:1px solid var(--border);white-space:nowrap;color:var(--muted)}
.ops-sev.s1{color:var(--red);background:var(--red-bg);border-color:var(--red-bd)}
.ops-sev.s2{color:var(--amber);background:var(--amber-bg);border-color:var(--amber-bd)}
.ops-sev.s3{color:var(--blue);background:var(--blue-bg);border-color:var(--blue-bd)}
.ops-sev.s4{color:var(--muted)}
.ops-flag{font-size:9.5px;font-weight:600;white-space:nowrap}
.ops-flag.red{color:var(--red)}.ops-flag.amber{color:var(--amber)}
.ops-mono{font-family:var(--mono);font-variant-numeric:tabular-nums}
.ops-small{font-size:10.5px;color:var(--text2)}
.ops-state{padding:10px 12px;font-size:11.5px;color:var(--text2)}
.ops-state.error{color:var(--red);background:var(--red-bg);border:1px solid var(--red-bd);border-radius:var(--r)}
.ops-tbl .ops-state.error{border:0;border-radius:0}
.ops-spin{display:inline-block;width:10px;height:10px;margin-right:6px;vertical-align:-1px;border:1.5px solid var(--border2);border-top-color:var(--blue);
  border-radius:50%;animation:ops-sp 1s linear infinite}
@keyframes ops-sp{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.ops-spin{animation:none}}
.ops-msg{margin-top:10px;font-size:11.5px}
.ops-msg.ok{color:var(--green)}.ops-msg.warn{color:var(--amber)}.ops-msg.error{color:var(--red)}
.ops-drawer{position:fixed;top:0;right:0;width:min(720px,100vw);height:100vh;overflow-y:auto;overflow-x:hidden;z-index:3100;background:var(--bg2);
  border-left:1px solid var(--border2);padding:20px 24px;box-sizing:border-box;color:var(--text);box-shadow:var(--sh);
  font-family:'Inter',system-ui,-apple-system,sans-serif;font-size:12px;line-height:1.45}
.ops-drawer *,.ops-drawer *::before,.ops-drawer *::after{box-sizing:border-box}
.ops-drawer :focus-visible{outline:2px solid var(--blue);outline-offset:1px}
.ops-dhead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.ops-dtitle{font-size:15px;font-weight:600;margin:6px 0 8px;color:var(--text);overflow-wrap:anywhere}
.ops-dtitle:focus{outline:none}
.ops-badges{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.ops-strong{font-weight:600}
.ops-sec{margin-top:16px}
.ops-sec-title{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text2);margin:0 0 6px}
.ops-kv{border-collapse:collapse}
.ops-kv th{text-align:left;padding:3px 12px 3px 0;color:var(--text2);font-weight:500;vertical-align:top;font-size:11px;white-space:nowrap}
.ops-kv td{padding:3px 0;overflow-wrap:anywhere;font-size:11.5px}
.ops-pre{white-space:pre-wrap;overflow-wrap:anywhere}
.ops-hist{list-style:none;margin:0;padding:0}
.ops-hist li{padding:6px 0;border-bottom:1px solid var(--border);font-size:11.5px}
.ops-form{margin-top:12px;padding:12px;border:1px solid var(--border2);border-radius:var(--r)}
.ops-form-title{font-weight:600;font-size:12px}
.ops-label{display:block;margin-top:10px;font-size:11px;color:var(--text2)}
.ops-field{display:block;margin-top:4px;width:100%;background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:var(--r);
  padding:5px 8px;font-family:inherit;font-size:11.5px}
select.ops-field{width:auto;max-width:100%}
.ops-field:focus{border-color:var(--blue);background:var(--bg4)}
.ops-check{display:flex;gap:8px;align-items:flex-start;margin-top:10px;font-size:11px}
.ops-gap{margin-top:8px}
@media (max-width:640px){
  .ops-titlebar{padding:0 12px}
  .ops-logo-sub{display:none}
  .ops-tabs{padding:0 6px}
  .ops-body{padding:12px 12px 32px}
  .ops-grid,.ops-trio{grid-template-columns:minmax(0,1fr)}
  .ops-drawer{padding:16px}
  .ops-btn{min-height:32px}
  .ops-tab{min-height:38px}
}
`;

function _opsInjectTheme(panel) {
  if (document.getElementById('ops-theme')) return;
  const style = document.createElement('style');
  style.id = 'ops-theme';
  style.textContent = OPS_THEME_CSS;
  (document.head || panel).appendChild(style);
}

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

// --- shared states (§1.6) ----------------------------------------------------------------------
// kind: 'loading' | 'empty' | 'error'. Errors carry role="alert"; loading shows the spinner.
function ops_stateHtml(kind, text) {
  if (kind === 'loading') return `<div class="ops-state loading"><span class="ops-spin" aria-hidden="true"></span>${_escapeHtml(text || 'Loading…')}</div>`;
  if (kind === 'error') return `<div class="ops-state error" role="alert">${_escapeHtml(text)}</div>`;
  return `<div class="ops-state empty">${_escapeHtml(text)}</div>`;
}
function _opsBusy(el, busy) { if (el && el.setAttribute) el.setAttribute('aria-busy', busy ? 'true' : 'false'); }

// Circular arc gauge — returns inline SVG markup. value/max define the fill fraction; guardAt (optional)
// draws a marker. Colours come from .ops-stroke-* / .ops-g-* classes (presentation attributes take no var()).
function _svgGauge(value, max, guardAt, tone) {
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = 70;

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
  const t = tone || (max > 0 ? (value / max > 0.7 ? 'red' : value / max > 0.4 ? 'amber' : 'green') : 'muted');

  let guardMarker = '';
  if (guardAt != null && max > 0) {
    const guardAngle = startAngle + sweepAngle * Math.min(guardAt / max, 1);
    const gp1 = polarToXY(guardAngle - 1.5);
    const gp2 = polarToXY(guardAngle + 1.5);
    guardMarker = `<path class="ops-g-guard" d="M ${gp1.x.toFixed(2)} ${gp1.y.toFixed(2)} L ${gp2.x.toFixed(2)} ${gp2.y.toFixed(2)}"/>`;
  }

  return `<svg viewBox="0 0 ${size} ${size}" aria-hidden="true" focusable="false">
      <path class="ops-g-track" d="${arcPath(startAngle, startAngle + sweepAngle)}"/>
      ${guardMarker}
      ${pct > 0 ? `<path class="ops-stroke-${t}" d="${arcPath(startAngle, fillEndAngle)}"/>` : ''}
    </svg>`;
}

function _pipelineTone(pct) {
  if (pct > 80) return 'green';
  if (pct > 50) return 'amber';
  return 'blue';
}

// One horizontal bar; segments: [[pct, tone], …]. Widths are the only inline styles here (dynamic).
function _opsBar(segments, thick) {
  return `<div class="ops-bar${thick ? ' thick' : ''}">${segments.map(([pct, tone]) =>
    `<i class="ops-fill-${tone}" style="width:${Math.max(0, Math.min(pct, 100)).toFixed(1)}%"></i>`).join('')}</div>`;
}

function _coverageBar(value, total, tone) {
  return _opsBar([[total > 0 ? (value / total) * 100 : 0, tone]]);
}

function _opsCard(title, body, extraHead) {
  return `<section class="ops-card"><div class="ops-chdr"><h2 class="ops-ctitle">${title}</h2>${extraHead || ''}</div><div class="ops-cbody">${body}</div></section>`;
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
  const lastRunAgo = _timeAgo(pipeline.last_run);
  const statusHuman = _parseStatus(pipeline.last_status);

  const writesGaugeSvg = _svgGauge(
    pipeline.writes_today || 0,
    pipeline.writes_limit || 100000,
    pipeline.writes_guard || 80000
  );

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

  // Since 30 Jul 2026 the Health view writes only into #ops-tab-health (the tab chrome lives above it).
  const healthContainer = document.getElementById('ops-tab-health') || panel;
  _opsBusy(healthContainer, false);

  const coverageCell = (n, label, tone) => `
        <div>
          <div class="ops-num ops-big">${n}</div>
          <div class="ops-note">${label}</div>
          ${_coverageBar(n, coverageTotal, tone)}
        </div>`;

  healthContainer.innerHTML = `
    ${_opsCard('Pipeline Health', `
      ${_opsBar([[pipelinePct, _pipelineTone(pipelinePct)]], true)}
      <div class="ops-line ops-num ops-mid">ETF Second Pass — ${pipeline.offset} of ${pipeline.total} complete (${pipelinePct.toFixed(1)}%)</div>
      <div class="ops-line ops-note">Last run: ${_escapeHtml(lastRunAgo)}</div>
      <div>${_escapeHtml(statusHuman)}</div>`)}

    <div class="ops-grid ops-stack">
      ${_opsCard('Writes Today', `
        <div class="ops-row">
          <div class="ops-gauge">${writesGaugeSvg}
            <div class="ops-gauge-val">
              <div class="ops-num ops-big">${(pipeline.writes_today || 0).toLocaleString()}</div>
              <div class="ops-note">of ${(pipeline.writes_limit || 100000).toLocaleString()}</div>
            </div>
          </div>
          <div class="ops-note">Reads today: see Drift &amp; Budget → Cloudflare usage today.</div>
        </div>`)}
      ${_opsCard(`Coverage Depth (${coverageTotal} ETFs)`, `
        <div class="ops-trio">
          ${coverageCell(coverage.null_depth ?? 0, 'No data', 'muted')}
          ${coverageCell(coverage.depth_1 ?? 0, '1 month', 'blue')}
          ${coverageCell(coverage.depth_2_plus ?? 0, '2+ months', 'cyan')}
        </div>`)}
    </div>

    ${_opsCard('Entity Enrichment Status', `
      ${_opsBar([[enrichedPct, 'blue'], [pendingPct, 'amber']], true)}
      ${enrichmentRemoved ? `
      <div class="ops-line">Enrichment counts removed (ML-1025-3) — not shown since 26 Oct</div>
      <div class="ops-note">The count read the whole entity table on every refresh, so it was taken out to save D1 reads.</div>` : `
      <div class="ops-line ops-num">${(enrichment.version_2_complete || 0).toLocaleString()} enriched · ${(enrichment.version_1_pending || 0).toLocaleString()} pending enrichment</div>
      <div class="ops-note">Enrichment resumes after ETF Phase 3 gate</div>`}`)}

    ${_opsCard('Bootstrap Progress', `
      ${_opsBar([[bootstrapPct, 'blue']])}
      <div class="ops-line ops-num">Bootstrap CIK: ${bootstrap.current_cik != null ? bootstrap.current_cik.toLocaleString() : 'unknown'} — next ETF discovery at CIK ${(bootstrap.discovery_threshold || 0).toLocaleString()}</div>`)}

    <p class="ops-note">Job schedules and missed runs are checked by the Ops sweep; problems appear in Cases.</p>

    <div class="ops-footer ops-note">
      <div>
        Last refreshed: ${new Date(data.snapshot_at || Date.now()).toLocaleTimeString()}<br/>
        Auto-refresh every 10 minutes
      </div>
      <button type="button" id="ops-refresh-btn" class="ops-btn primary">Refresh Now</button>
    </div>
  `;
}

// Health clicks (Refresh Now, Try again): one delegated listener on the Health container.
function _opsWireHealth(container) {
  if (!container || container.dataset.opsWired === '1') return;
  container.dataset.opsWired = '1';
  container.addEventListener('click', ev => {
    const t = ev.target && ev.target.closest ? ev.target : null;
    if (t && (t.closest('#ops-refresh-btn') || t.closest('[data-ops-retry]'))) openOps({ skipCreate: true });
  });
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
    panel.className = 'ops-root';
    document.body.appendChild(panel);
    _opsInjectTheme(panel);

    // Persistent chrome (title bar + tab bar), built once at panel creation; survives every Health
    // refresh because _renderOpsPanel() only touches #ops-tab-health. ops_switchTab() loads Health
    // (and starts its poll) only when Health is the active tab (MA-OCT-005).
    ops_renderTabBar();
    return;
  }
  if (!_opsHealthWanted()) return;   // M-3: ops-health is read only on the visible Health tab

  const healthContainer = document.getElementById('ops-tab-health') || panel;
  _opsWireHealth(healthContainer);
  if (!healthContainer.innerHTML) { _opsBusy(healthContainer, true); healthContainer.innerHTML = ops_stateHtml('loading'); }
  const res = await data_proxyGet(OPS_HEALTH_PATH);
  if (res.ok && res.data) {
    _renderOpsPanel(res.data);
  } else {
    _opsBusy(healthContainer, false);
    const why = res.status ? `HTTP ${res.status}` : 'network error';
    healthContainer.innerHTML = `<section class="ops-card"><div class="ops-cbody">
        ${ops_stateHtml('error', `Couldn't load system health (${why}).`)}
        <div class="ops-btnrow"><button type="button" class="ops-btn primary" data-ops-retry="health">Try again</button></div>
      </div></section>`;
  }
}

// ============================================================
// Console chrome and the Drift & Budget view.
// Top-level functions added since 30 July 2026 are ops_-prefixed per the naming convention adopted
// after the _freshnessBadge collision incident (Current State v11, Section 7.4).
// All network calls route through ma-data.js (data_opsGet for Drift & Budget; data_opsAdmin for
// Cases/DQ; data_proxyGet for openOps()'s Health read, moved out of its inline fetch() by MA-OCT-005 §5.6).
// ============================================================

// MA-OCT-005 (§5): Cases and DQ Tickets are the console section at the end of this file (ops_loadCases / ops_loadDq).
// Fleet (§5.5) and the "New case" form are pre-cut (Ops review M-6; Founder Q3 order).
// MA-NOV-UI (OPS-01): exactly these four views, in this order; the console opens on Cases.
const OPS_TABS = [
  { id: 'health', label: 'System Health' },
  { id: 'cases', label: 'Cases' },
  { id: 'dq', label: 'DQ Tickets' },
  { id: 'drift', label: 'Drift & Budget' }
];

function ops_tabButtonsHtml(active) {
  return OPS_TABS.map(t => {
    const on = t.id === active;
    return `<button type="button" class="ops-tab" role="tab" id="ops-tabbtn-${t.id}" aria-controls="ops-tab-${t.id}" aria-selected="${on}" tabindex="${on ? '0' : '-1'}" data-ops-tab="${t.id}">${_escapeHtml(t.label)}</button>`;
  }).join('');
}

function ops_titlebarRoleHtml() {
  const r = _opsPref('ops_acting_role');
  return OPSC_ROLES.includes(r) ? `Acting as ${_escapeHtml(r)}` : '';
}
function ops_refreshTitlebarRole() {
  const el = document.getElementById('ops-role');
  if (el) el.innerHTML = ops_titlebarRoleHtml();
}

function ops_renderTabBar() {
  const panel = document.getElementById('ops-panel');
  if (!panel || document.getElementById('ops-tab-bar')) return; // idempotent — build once

  const head = document.createElement('div');
  head.className = 'ops-head';
  const title = document.createElement('div');
  title.className = 'ops-titlebar';
  title.innerHTML = `
    <div class="ops-logo">
      <svg viewBox="0 0 30 30" aria-hidden="true" focusable="false">
        <rect class="l0" width="30" height="30" rx="6"/>
        <rect class="l1" x="3" y="19" width="5" height="8" rx="1"/>
        <rect class="l2" x="10" y="13" width="5" height="14" rx="1"/>
        <rect class="l3" x="17" y="7" width="5" height="20" rx="1"/>
        <polyline class="l4" points="3,21 12,14 19,8 27,4" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
        <circle class="l5" cx="27" cy="4" r="2"/>
      </svg>
      <div><div class="ops-logo-name"><span>Meridian</span> Atlas</div><div class="ops-logo-sub">Operator console</div></div>
    </div>
    <div class="ops-role" id="ops-role">${ops_titlebarRoleHtml()}</div>`;

  // §6.5: role tablist/tab/tabpanel; Left/Right/Home/End move between tabs. One delegated listener each.
  const bar = document.createElement('div');
  bar.id = 'ops-tab-bar';
  bar.className = 'ops-tabs';
  bar.setAttribute('role', 'tablist');
  bar.setAttribute('aria-label', 'Ops views');
  bar.innerHTML = ops_tabButtonsHtml(null);

  const contentWrap = document.createElement('div');
  contentWrap.id = 'ops-tab-content';
  contentWrap.className = 'ops-body';
  OPS_TABS.forEach(t => {
    const div = document.createElement('div');
    div.id = `ops-tab-${t.id}`;
    div.setAttribute('role', 'tabpanel');
    div.setAttribute('aria-labelledby', `ops-tabbtn-${t.id}`);
    div.setAttribute('tabindex', '-1');
    div.hidden = true;
    contentWrap.appendChild(div);
  });

  head.appendChild(title);
  head.appendChild(bar);
  panel.appendChild(head);
  panel.appendChild(contentWrap);

  bar.addEventListener('click', ev => {
    const btn = ev.target && ev.target.closest ? ev.target.closest('[data-ops-tab]') : null;
    if (btn) ops_switchTab(btn.dataset.opsTab);
  });
  bar.addEventListener('keydown', ops_onTabKey);

  ops_switchTab('cases');   // the console opens on Cases (§5)
}

function ops_onTabKey(ev) {
  const btn = ev.target && ev.target.closest ? ev.target.closest('[data-ops-tab]') : null;
  if (!btn) return;
  const i = OPS_TABS.findIndex(t => t.id === btn.dataset.opsTab);
  const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: OPS_TABS.length - 1 }[ev.key];
  if (j === undefined) return;
  ev.preventDefault();
  const next = OPS_TABS[(j + OPS_TABS.length) % OPS_TABS.length].id;
  ops_switchTab(next);
  const nb = document.getElementById(`ops-tabbtn-${next}`);
  if (nb && nb.focus) nb.focus();
}

function ops_switchTab(tabName) {
  _opsActiveTab = tabName;
  OPS_TABS.forEach(t => {
    const el = document.getElementById(`ops-tab-${t.id}`);
    if (el) el.hidden = t.id !== tabName;
  });
  const bar = document.getElementById('ops-tab-bar');
  if (bar) {
    const hadFocus = !!(bar.contains && document.activeElement && bar.contains(document.activeElement));
    bar.innerHTML = ops_tabButtonsHtml(tabName);
    const nb = document.getElementById(`ops-tabbtn-${tabName}`);
    if (nb && hadFocus && nb.focus) nb.focus();
    if (nb && nb.scrollIntoView) nb.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // M-3: Health reads and polls only while it is the visible tab.
  if (tabName === 'health') { openOps({ skipCreate: true }); _opsStartPoll(); }
  else _opsStopPoll();
  if (tabName === 'cases') ops_loadCases();
  else if (tabName === 'dq') ops_loadDq();
  else if (tabName === 'drift') ops_loadDriftTab();
}

// The views draw their Refresh buttons as data-ops-refresh="<tab>"; one delegated listener per
// container wires them, so no inline on*= handler is ever emitted (Ops review M-1).
function _opsWireRefresh(container, load) {
  if (!container || container.dataset.opsWired === '1') return;
  container.dataset.opsWired = '1';
  container.addEventListener('click', ev => {
    const t = ev.target && ev.target.closest ? ev.target : null;
    if (t && t.closest('[data-ops-refresh]')) load();
  });
}

// --- Drift & Budget (one combined tab) ---------------------------------------------------------

// MA-AUG-006, 2 August 2026 — Workers whose cron firing history is worth a glance. Kept short and
// explicit, since this list controls real API calls against Cloudflare's GraphQL Analytics — see
// ops-api.js's TRACKED_SCRIPTS for the enforced allowlist.
const OPS_CRON_SCRIPTS = ['meridian-holdings', 'meridian-entities-seed', 'meridian-entities-enrich'];

// MA-NOV-UI (UD-2): the deployment-drift panel is gone (it read the frozen releaseledger);
// /api/ops/drift itself is unchanged and simply no longer requested here.
async function ops_loadDriftTab() {
  const container = document.getElementById('ops-tab-drift');
  if (!container) return;
  _opsWireRefresh(container, ops_loadDriftTab);
  _opsBusy(container, true);
  container.innerHTML = `${ops_driftToolbar()}${ops_stateHtml('loading')}`;

  const [budgetRes, figiRes, cfD1Res, ...cfInvocationResults] = await Promise.all([
    data_opsGet('/api/ops/budget-risk'),
    data_opsGet('/api/ops/openfigi-status'),
    data_opsGet('/api/ops/cf/d1-today'),
    ...OPS_CRON_SCRIPTS.map(s => data_opsGet(`/api/ops/cf/invocations?script=${encodeURIComponent(s)}`))
  ]);

  const budgetHtml = ops_renderBudgetRisk(budgetRes.ok ? budgetRes.data : null);
  const cfHtml = ops_renderLiveCfMetrics(
    cfD1Res.ok ? cfD1Res.data : null,
    OPS_CRON_SCRIPTS.map((s, i) => ({ script: s, data: cfInvocationResults[i].ok ? cfInvocationResults[i].data : null }))
  );
  const figiHtml = ops_renderOpenFigiStatus(figiRes.ok ? figiRes.data : null);

  _opsBusy(container, false);
  container.innerHTML = `
    ${ops_driftToolbar()}
    ${budgetHtml}
    ${cfHtml}
    ${figiHtml}
  `;
}

function ops_driftToolbar() {
  return `<div class="ops-toolbar"><h1 class="ops-h1">Drift &amp; Budget</h1>
      <button type="button" class="ops-btn primary" data-ops-refresh="drift">Refresh</button></div>`;
}

// MA-AUG-006: Cloudflare-metered numbers (authoritative) shown alongside the app's own self-reported
// writes_today_ counter — the 2 August incident showed these two can diverge (real per-run multiplier
// ranged 2.56x-3.69x against assumptions), so surfacing both side by side is deliberate.
function ops_renderLiveCfMetrics(d1Data, invocations) {
  const d1Html = d1Data
    ? `<div><span class="ops-num ops-big">${d1Data.rowsWritten.toLocaleString()}</span> <span class="ops-note">of ${d1Data.daily_cap.toLocaleString()} rows written today (${d1Data.pct_of_cap}%), as metered by Cloudflare for the whole account</span></div>
       <div class="ops-line ops-note">${d1Data.rowsRead.toLocaleString()} rows read · ${d1Data.writeQueries.toLocaleString()} write queries · ${d1Data.readQueries.toLocaleString()} read queries</div>`
    : ops_stateHtml('error', "Couldn't load Cloudflare usage. If this keeps happening, check the CF_ANALYTICS_TOKEN secret on meridian-ops.");

  const rows = invocations.map(({ script, data }) => {
    if (!data) return `<div>${ops_stateHtml('error', `Couldn't load ${script}.`)}</div>`;
    const last = data.cron_invocations[data.cron_invocations.length - 1];
    const flag = data.matches_cron_only
      ? '<span class="ops-ok">cron-only ✓</span>'
      : `<span class="ops-bad">mismatch — ${data.all_trigger_invocation_count} total vs ${data.cron_invocation_count} cron-only</span>`;
    return `
      <div>
        <span class="ops-strong">${_escapeHtml(script)}</span> — ${data.cron_invocation_count} invocation(s) today, ${flag}
        ${last ? `<br/><span class="ops-small">last: ${_escapeHtml(last.datetime)} · cron "${_escapeHtml(last.cron)}" · ${_escapeHtml(last.status)}</span>` : ''}
      </div>`;
  }).join('');

  return _opsCard('Cloudflare usage today', `${d1Html}<div class="ops-rows ops-gap">${rows}</div>`);
}

function ops_renderBudgetRisk(data) {
  if (!data) return _opsCard('Shared D1 Write Budget Today', ops_stateHtml('error', "Couldn't load the write budget."));
  const gaugeSvg = _svgGauge(data.writes_today, data.daily_limit, data.daily_limit * 0.9);
  return _opsCard('Shared D1 Write Budget Today', `
      <div class="ops-row">
        <div class="ops-gauge">${gaugeSvg}</div>
        <div><span class="ops-num ops-big">${data.writes_today.toLocaleString()}</span> <span class="ops-note">of ${data.daily_limit.toLocaleString()} (${data.pct}%)</span></div>
      </div>`);
}

function ops_renderOpenFigiStatus(data) {
  if (!data) return _opsCard('Instrument → Entity Resolution', ops_stateHtml('error', "Couldn't load instrument → entity resolution."));
  return _opsCard('Instrument → Entity Resolution', `
      <div class="ops-stats">
        <div><div class="ops-num ops-big">${data.coverage_pct}%</div><div class="ops-note">Coverage (${data.instrument_entity_map_total.toLocaleString()} / ${data.instrument_master_total.toLocaleString()})</div></div>
        <div><div class="ops-num ops-big">${data.openfigicache_total.toLocaleString()}</div><div class="ops-note">Instruments checked (cached)</div></div>
        <div><div class="ops-num ops-big">${data.openfigi_matched_no_entity.toLocaleString()}</div><div class="ops-note">Matched, no entity yet — cheap re-match candidates</div></div>
      </div>`);
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
// MA-NOV-UI §1.5: every element takes an .ops-* class from ops-theme; no colour or inline style here.

function opsc_sevBadge(sev) {
  const ok = /^sev[1-4]$/.test(sev || '');
  const label = ok ? `Sev ${sev.slice(3)}` : (sev || '—');
  return `<span class="ops-sev${ok ? ` s${sev.slice(3)}` : ''}">${opscEsc(label)}</span>`;
}
const OPSC_TH = 'scope="col"';
const OPSC_BTN = 'class="ops-btn"';
const OPSC_BTN_PRIMARY = 'class="ops-btn primary"';

function opsc_statusChips(view, statuses, active) {
  return `<div role="group" aria-label="Status filter" class="ops-chips">${statuses.map(s => {
    const on = active.includes(s);
    return `<button type="button" class="ops-btn ops-chip" data-opsc-chip="${s}" aria-pressed="${on}">${opscEsc(OPSC_STATUS_LABELS[s] || s)}${on ? ' ✓' : ''}</button>`;
  }).join('')}</div>`;
}

// §1.6: "No open cases…" only while the filter holds open statuses alone; any other filter gets the neutral line.
function opsc_emptyText(kind, statuses) {
  if (kind === 'DQ') return 'No tickets with these statuses.';
  return (statuses || []).length && statuses.every(s => s === 'open' || s === 'acknowledged')
    ? 'No open cases. The last sweep raised nothing new.' : 'No cases with these statuses.';
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
  const openRef = opscState.drawer && opscState.drawer.kind === kind ? opscState.drawer.ref : null;
  const rows = items.map(i => {
    const overdue = i.overdue ? ' <span class="ops-flag red">Overdue</span>' : '';
    const prot = isDq && opsc_isProtected(i) ? ' <span class="ops-flag amber">Protected decision</span>' : '';
    const opened = `<span title="${opscEsc(i.opened_at)}">${opscEsc(_timeAgo(i.opened_at))}</span>`;
    const cells = isDq
      ? [opsc_sevBadge(i.severity), `<span class="ops-mono">${opscEsc(i.case_ref)}</span>`, opscEsc(opscLabel(OPSC_DQ_LABELS, i.ticket_type)),
         opscEsc(i.title) + prot, `<span class="ops-mono">${opscEsc(i.object_domain)}:${opscEsc(i.object_key)}</span>`
           + (i.merged_into ? `<br/><span class="ops-small">merged into ${opscEsc(i.merged_into)}</span>` : ''),
         opscEsc(i.owner_role || '—'), opscEsc(OPSC_STATUS_LABELS[i.status] || i.status), `${opened}${overdue}`]
      : [opsc_sevBadge(i.severity), `<span class="ops-mono">${opscEsc(i.case_ref)}</span>`, opscEsc(opscLabel(OPSC_EXC_LABELS, i.exception_type)),
         opscEsc(i.title), opscEsc(i.job_id || '—'), `${opened}${overdue}`, opscEsc(i.owner_role || '—'), opscEsc(OPSC_STATUS_LABELS[i.status] || i.status)];
    return `<tr tabindex="0" data-opsc-open="${opscEsc(i.case_ref)}" aria-label="${opscEsc(i.case_ref)} ${opscEsc(i.title)}"${i.case_ref === openRef ? ' aria-current="true"' : ''}>
      ${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
  }).join('');
  const stateRow = html => `<tr><td colspan="${head.length}" class="ops-state-cell">${html}</td></tr>`;
  const body = state.loading && !items.length ? stateRow(ops_stateHtml('loading'))
    : state.error && !items.length ? stateRow(ops_stateHtml('error', state.error))
    : rows || stateRow(ops_stateHtml('empty', opsc_emptyText(kind, state.statuses)));
  return `
    <div class="ops-toolbar">
      <div>
        <h1 class="ops-h1">${title}</h1>
        <div class="ops-note" aria-live="polite">${countLine}</div>
      </div>
      <button type="button" data-opsc-refresh="1" ${OPSC_BTN_PRIMARY}>Refresh</button>
    </div>
    ${opsc_statusChips(kind, isDq ? OPSC_DQ_STATUSES : OPSC_CASE_STATUSES, state.statuses)}
    ${state.error && items.length ? `<div class="ops-gap">${ops_stateHtml('error', state.error)}</div>` : ''}
    <div class="ops-tbl-wrap">
      <table class="ops-tbl wide">
        <thead><tr>${head.map(h => `<th ${OPSC_TH}>${h}</th>`).join('')}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    ${state.next_cursor ? `<div class="ops-line ops-note">Showing ${items.length} · <button type="button" data-opsc-more="1" ${OPSC_BTN}>Load more</button></div>` : ''}`;
}

function opsc_kv(rows) {
  return `<table class="ops-kv">${rows.filter(([, v]) => v != null && v !== '').map(([k, v]) =>
    `<tr><th scope="row">${opscEsc(k)}</th>
     <td>${opscEsc(typeof v === 'object' ? JSON.stringify(v) : v)}</td></tr>`).join('')}</table>`;
}
function opsc_section(title, inner) {
  return `<section class="ops-sec"><h3 class="ops-sec-title">${opscEsc(title)}</h3>${inner}</section>`;
}

function opsc_renderHistory(events) {
  const list = events || [];
  const rows = list.map(e => `
    <li>
      <div><span class="ops-strong">${opscEsc(opscSentence(e.event_type))}</span>
        ${e.from_value || e.to_value ? `<span class="ops-dim">${opscEsc(e.from_value || '—')} → ${opscEsc(e.to_value || '—')}</span>` : ''}
        <span class="ops-dim" title="${opscEsc(e.occurred_at)}">· ${opscEsc(_timeAgo(e.occurred_at))}</span></div>
      <div class="ops-dim">${opscEsc(e.actor)}${e.actor_role ? ` (${opscEsc(e.actor_role)})` : ''}</div>
      ${e.body ? `<div class="ops-pre ops-gap">${opscEsc(e.body)}</div>` : ''}
    </li>`).join('');
  const cap = list.length >= 200 ? '<div class="ops-line ops-small">Showing the first 200 events.</div>' : '';
  return `<ol class="ops-hist">${rows || '<li class="ops-dim">No events.</li>'}</ol>${cap}`;
}

function opsc_select(name, label, options, value, extra = '') {
  return `<label class="ops-label" for="opsc-f-${name}">${opscEsc(label)}</label>
    <select id="opsc-f-${name}" name="${name}" class="ops-field" ${extra}>
      ${options.map(o => {
        const [v, l, dis] = Array.isArray(o) ? o : [o, o];
        return `<option value="${opscEsc(v)}"${v === value ? ' selected' : ''}${dis ? ' disabled' : ''}>${opscEsc(l)}</option>`;
      }).join('')}</select>`;
}
function opsc_input(name, label, value, extra = '') {
  return `<label class="ops-label" for="opsc-f-${name}">${opscEsc(label)}</label>
    <input id="opsc-f-${name}" name="${name}" class="ops-field" value="${opscEsc(value || '')}" ${extra}>`;
}
function opsc_check(name, label) {
  return `<label class="ops-check"><input type="checkbox" name="${name}" id="opsc-f-${name}"> <span>${opscEsc(label)}</span></label>`;
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
    html += '<div class="ops-line ops-small">Sev 1 and Sev 2 notify the Founder at the next health check.</div>';
  }
  if (has('fix_ref')) html += opsc_input('fix_ref', 'Fix ref — the packet or CR doing the fix (required)', d.fix_ref, 'placeholder="MA-OCT-019"');
  if (has('exception_ref')) html += opsc_input('exception_ref', 'Exception ref (EXC-…, required)', d.exception_ref);
  const codeField = kind === 'EXC' ? 'resolution' : 'disposition';
  if (has(codeField)) {
    const gated = kind === 'DQ' && action === 'resolve' && !fixScheduled;
    html += opsc_select(codeField, 'Resolution (required)', [['', 'Choose…']].concat(spec.codes.map(c => [c, opscSentence(c) + (gated && c === 'fixed' ? ' — schedule the fix first' : ''), gated && c === 'fixed'])), d[codeField] || '');
    if (gated) html += '<div class="ops-line ops-small">"Fixed" is available after a Schedule fix event.</div>';
  }
  if (has('duplicate_of')) html += opsc_input('duplicate_of', `Duplicate of (${kind === 'EXC' ? 'EXC-' : 'DQ-'}…; only for "Duplicate")`, d.duplicate_of);
  if (kind === 'DQ' && action === 'resolve' && ctx.membersOpen) {
    html += opsc_check('force', 'Force: resolve although some members are still open (say why in the note)');
    html += opsc_check('confirm', 'I confirm: force-resolve with open members');
  }
  if (kind === 'DQ' && action === 'reopen' && opsc_isProtected(ctx.row)) {
    html += '<div class="ops-msg warn">Protected Founder decision (do not merge). Reopening needs the Founder\'s supersession.</div>';
    html += opsc_input('supersession_reference', 'Founder supersession reference (required)', d.supersession_reference);
    html += opsc_input('supersession_decided_at', 'Decided at (YYYY-MM-DD, required)', d.supersession_decided_at, 'placeholder="2026-10-31"');
    html += opsc_check('confirm', 'I confirm: reopen a protected Founder decision');
  }
  if (kind === 'DQ' && (action === 'resolve' || action === 'dismiss') && OPSC_ENTITIES_TYPES.has(ctx.row.ticket_type)) {
    html += '<div class="ops-line ops-small">Resolve and dismiss are for the Data-Identity Lead or the Founder.</div>';
  }
  if (has('note')) {
    html += `<label class="ops-label" for="opsc-f-note">Note${req('note') ? ' (required)' : ' (optional)'}</label>
      <textarea id="opsc-f-note" name="note" class="ops-field" maxlength="2000" rows="3">${opscEsc(d.note || '')}</textarea>`;
  }
  html += opsc_select('actor_role', 'Acting as (recorded as your role; your identity comes from sign-in)', OPSC_ROLES.map(r => [r, r]), ctx.actingRole || 'Founder');
  const err = ctx.error ? `<div id="opsc-form-error" role="alert" class="ops-msg error">${opscEsc(ctx.error)}</div>` : '';
  return `<form data-opsc-form="${action}" aria-describedby="${ctx.error ? 'opsc-form-error' : ''}" class="ops-form">
      <div class="ops-form-title">${opscEsc(spec.label)}</div>${html}${err}
      <div class="ops-btnrow"><button type="submit" ${OPSC_BTN_PRIMARY}>${opscEsc(spec.label)}</button>
      <button type="button" data-opsc-cancel="1" ${OPSC_BTN}>Cancel</button></div></form>`;
}

function opsc_renderMembers(row, members, cursor, ui) {
  if (!members || !members.length) return '';
  const editable = OPSC_DQ_OPEN.includes(row.status);
  const rows = members.map((m, i) => {
    const ref = (() => { try { return m.object_ref ? JSON.parse(m.object_ref) : null; } catch { return m.object_ref; } })();
    const editing = ui && ui.memberIndex === i;
    const form = editing ? `
      <form data-opsc-member-form="${i}" class="ops-gap">
        ${opsc_select('member_status', 'New status', OPSC_MEMBER_STATUSES.filter(s => s !== m.member_status).map(s => [s, OPSC_STATUS_LABELS[s]]), (ui.draft || {}).member_status || '')}
        <label class="ops-label" for="opsc-f-mnote">Note (required for Fixed: name the applied fix packet)</label>
        <textarea id="opsc-f-mnote" name="note" class="ops-field" maxlength="500" rows="2">${opscEsc((ui.draft || {}).note || '')}</textarea>
        ${opsc_check('confirm', 'I confirm: mark Fixed (only after the fix packet was applied)')}
        ${ui.error ? `<div role="alert" class="ops-msg error">${opscEsc(ui.error)}</div>` : ''}
        <div class="ops-btnrow"><button type="submit" ${OPSC_BTN_PRIMARY}>Save member</button><button type="button" data-opsc-cancel="1" ${OPSC_BTN}>Cancel</button></div>
      </form>` : '';
    return `<tr>
      <td><span class="ops-mono">${opscEsc(m.object_domain)}:${opscEsc(m.object_key)}</span>
        ${m.merged_into ? `<br/><span class="ops-small">merged into ${opscEsc(m.merged_into)}</span>` : ''}
        ${ref && ref.name ? `<br/><span class="ops-small">${opscEsc(ref.name)}</span>` : ''}</td>
      <td>${opscEsc(opscSentence(m.proposed_action))}</td>
      <td>${opscEsc(OPSC_STATUS_LABELS[m.member_status] || m.member_status)}</td>
      <td>${opscEsc(m.note || '')}${form}</td>
      <td>${editable && !editing ? `<button type="button" data-opsc-member="${i}" ${OPSC_BTN}>Change status</button>` : ''}</td></tr>`;
  }).join('');
  return opsc_section(`Members (${members.length}${cursor ? '+' : ''})`, `
    <div class="ops-tbl-wrap"><table class="ops-tbl"><thead><tr>${['Object', 'Proposed action', 'Status', 'Note', ''].map(h => `<th ${OPSC_TH}>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows}</tbody></table></div>
    ${cursor ? `<div class="ops-gap"><button type="button" data-opsc-members-more="1" ${OPSC_BTN}>Load more members</button></div>` : ''}`);
}

// detail: the C-1 response. ui: { form, draft, error, status, memberIndex, members, membersCursor, loading }
function opsc_renderDrawer(kind, detail, ui) {
  const row = detail.case;
  const isDq = kind === 'DQ';
  const actions = opsc_legalActions(kind, row, detail.events);
  const status = ui.status ? `<div role="status" aria-live="polite" class="ops-msg ${ui.status.tone === 'ok' ? 'ok' : ui.status.tone === 'warn' ? 'warn' : 'error'}">
      ${opscEsc(ui.status.text)}${ui.status.signedOut ? ` <button type="button" data-opsc-signin="1" ${OPSC_BTN}>Sign in again</button>` : ''}${ui.status.retrySame ? ` <button type="button" data-opsc-retry="1" ${OPSC_BTN}>Retry</button>` : ''}</div>`
    : '<div role="status" aria-live="polite"></div>';
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
    sections += opsc_section('Summary', `<div class="ops-pre">${opscEsc(row.summary || '—')}</div>`
      + opsc_kv([['Owner', row.owner_role], ['Assignee', row.assignee], ['Resolution', row.resolution ? opscSentence(row.resolution) : null], ['Resolved by', row.resolved_by], ['Raised by', `${row.raised_by} (${row.raised_via})`]]));
    let snap = null;
    try { snap = row.run_snapshot ? JSON.parse(row.run_snapshot) : null; } catch { snap = row.run_snapshot; }
    if (detail.registry || snap || (detail.runs || []).length) {
      sections += opsc_section('Job and run', opsc_kv([['Job', row.job_id], ['Run', row.run_id], ['Mode', detail.registry && detail.registry.execution_mode],
        ['Registry status', detail.registry && detail.registry.status]])
        + (snap ? `<div class="ops-gap">${opsc_kv(Object.entries(Array.isArray(snap) ? (snap[0] || {}) : snap))}</div>` : ''));
    }
    if ((detail.linked_dq_tickets || []).length) {
      sections += opsc_section('Linked DQ tickets', `<div class="ops-chips">${detail.linked_dq_tickets.map(t =>
        `<button type="button" data-opsc-open="${opscEsc(t.case_ref)}" ${OPSC_BTN}>${opscEsc(t.case_ref)} — ${opscEsc(t.title)}</button>`).join('')}</div>`);
    }
  }
  sections += opsc_section('History', opsc_renderHistory(detail.events));
  const membersOpen = (ui.members || detail.members || []).some(m => m.member_status === 'open') || !!(detail.members_cursor);
  const form = ui.form ? opsc_renderForm(kind, ui.form, { row, events: detail.events, membersOpen, actingRole: ui.actingRole, draft: ui.draft, error: ui.error }) : '';
  return `
    <div class="ops-dhead">
      <div>
        <div class="ops-mono ops-small">${opscEsc(row.case_ref)} · ${opscEsc(isDq ? opscLabel(OPSC_DQ_LABELS, row.ticket_type) : opscLabel(OPSC_EXC_LABELS, row.exception_type))}</div>
        <h2 id="opsc-drawer-title" class="ops-dtitle" tabindex="-1">${opscEsc(row.title)}</h2>
        <div class="ops-badges">${opsc_sevBadge(row.severity)}
          <span class="ops-strong">${opscEsc(OPSC_STATUS_LABELS[row.status] || row.status)}</span>
          ${isDq && opsc_isProtected(row) ? '<span class="ops-flag amber">Protected decision</span>' : ''}
          ${ui.loading ? '<span class="ops-small"><span class="ops-spin" aria-hidden="true"></span>Loading…</span>' : ''}</div>
      </div>
      <button type="button" data-opsc-close="1" aria-label="Close" ${OPSC_BTN}>Close</button>
    </div>
    <div class="ops-actions" role="group" aria-label="Actions">
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
  _opsBusy(el, true);
  el.innerHTML = opsc_renderList(kind, st);
  const res = await data_opsAdmin(opsc_listPath(kind, more ? st.next_cursor : null));
  st.loading = false;
  _opsBusy(el, false);
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
  el.className = 'ops-drawer';   // ops-theme: --bg2, left border --border2, no shadow (--sh is none)
  (document.getElementById('ops-panel') || document.body).appendChild(el);
  el.addEventListener('click', opsc_onDrawerClick);
  el.addEventListener('submit', opsc_onDrawerSubmit);
  el.addEventListener('change', ev => { if (ev.target.name === 'actor_role') { _opsPref('ops_acting_role', ev.target.value); ops_refreshTitlebarRole(); } });
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
    el.innerHTML = `<h2 id="opsc-drawer-title" class="ops-dtitle" tabindex="-1">${opscEsc(ref)}</h2>
      ${ops_stateHtml('error', opsc_mapResponse(res).text)}
      <div class="ops-btnrow"><button type="button" data-opsc-close="1" ${OPSC_BTN}>Close</button></div>`;
    return;
  }
  d.detail = res.data;
  d.ui.members = res.data.members;
  d.ui.membersCursor = res.data.members_cursor;
  opsc_writeHash(kind);
  opsc_paintDrawer(true);
  opsc_markSelected();
}

// §1.6 Selected: the list row whose drawer is open carries aria-current="true" (styled by ops-theme).
function opsc_markSelected() {
  const d = opscState.drawer;
  Object.entries(OPSC_CONTAINER).forEach(([kind, id]) => {
    const el = document.getElementById(id);
    if (!el || !el.querySelectorAll) return;
    el.querySelectorAll('tr[aria-current]').forEach(r => r.removeAttribute('aria-current'));
    if (d && d.kind === kind) {
      const r = el.querySelector(`tr[data-opsc-open="${d.ref}"]`);   // refs match OPSC_REF_RE: no quotes
      if (r && r.setAttribute) r.setAttribute('aria-current', 'true');
    }
  });
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
  opsc_markSelected();
  if (!d) return;
  opsc_writeHash(d.kind);
  let back = d.returnFocus && d.returnFocus.isConnected !== false && d.returnFocus.focus ? d.returnFocus : null;
  if (!back) {   // the list was re-rendered after an action: return focus to the same row
    const list = document.getElementById(OPSC_CONTAINER[d.kind]);
    const r = list && list.querySelector ? list.querySelector(`tr[data-opsc-open="${d.ref}"]`) : null;
    if (r && r.focus) back = r;
  }
  if (back) back.focus();
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
