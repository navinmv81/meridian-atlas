#!/usr/bin/env node
// Tower/board generator (MA-NOV-P1.BUILD Task §4). No model calls, no network.
// Reads claude/packets/MA-NOV-*_Status.json, claude/factory/PAUSE.json (optional), claude/factory/config.json.
// Writes claude/packets/STATUS_BOARD.md and claude/factory/control-tower.html.
// Usage: node tools/factory/project.mjs [--check]   (--check: print what would change, write nothing)
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot, packetsDir, factoryDir, sha256File, isoSec, stableStringify, readConfig, readPause } from './lib/util.mjs';
import { listStatus } from './lib/state.mjs';
import { evaluate } from './lib/eligibility.mjs';
import { TOWER_LOGIC_FUNCTIONS } from './lib/tower-logic.mjs';

export const BOARD_TITLE = '# Status Board — November 2026 (generated — do not edit; run node tools/factory/project.mjs)';
export const BOARD_SECTION = '## November 2026 — admitted packets';
const COLUMNS = ['Packet', 'State', 'Control (SHA-256)', 'Lane / tool', 'Write owner', 'Next gate', 'Blocker', 'Usage'];

const dash = (v) => (v === null || v === undefined || v === '' ? '—' : String(v));
const cell = (v) => dash(v).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
const ver = (v) => (v ? (String(v).startsWith('v') ? String(v) : `v${v}`) : 'v?');

export function blockerText(s) {
  if (s.blocker) return s.blocker;
  if (s.state === 'BLOCKED' && s.run && s.run.blocked_reason) return s.run.blocked_reason;
  if (s.hold) return `hold ${s.hold.type}${s.hold.reason ? `: ${s.hold.reason}` : ''}`;
  return null;
}

// F4: the opener named by config.opener (default claude/packets/LANE_OPENER_v2.md), with its computed SHA-256.
export function opener(root, cfg = readConfig(root)) {
  const file = cfg.opener;
  const f = path.join(root, ...file.split('/'));
  if (!fs.existsSync(f)) return { file, sha256: null, fixed_line: null };
  const sha = sha256File(f);
  const m = fs.readFileSync(f, 'utf8').match(/## Fixed line[^\n]*\n+```[^\n]*\n([\s\S]*?)\n```/);
  return { file, sha256: sha, fixed_line: m ? m[1].trim().replace('<hash>', sha) : null };
}

function recentRuns(root) {
  const dir = path.join(factoryDir(root), 'runs');
  if (!fs.existsSync(dir)) return [];
  const runs = [];
  for (const d of fs.readdirSync(dir).sort()) {
    const f = path.join(dir, d, 'run.json');
    if (fs.existsSync(f)) { try { runs.push(JSON.parse(fs.readFileSync(f, 'utf8'))); } catch { /* skip unreadable */ } }
  }
  runs.sort((a, b) => String(b.started || '').localeCompare(String(a.started || '')) || String(a.run_id).localeCompare(String(b.run_id)));
  return runs.slice(0, 10);
}

function pick(s) {
  const pickObj = (o, keys) => (o && typeof o === 'object' ? Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]])) : o ?? null);
  return {
    title: s.title ?? null, state: s.state ?? null, phase: s.phase ?? null, rev: Number.isInteger(s.rev) ? s.rev : 1,
    lane: s.lane ?? null, write_owner: s.write_owner ?? null, next_gate: s.next_gate ?? null,
    blocker: blockerText(s), usage_class: s.usage_class ?? null, updated: s.updated ?? null, updated_by: s.updated_by ?? null,
    control: pickObj(s.control, ['version', 'file', 'sha256']), task: pickObj(s.task, ['version', 'file', 'sha256']),
    start_approval: pickObj(s.start_approval, ['by', 'at', 'words']),
    lease: pickObj(s.lease, ['run_id', 'holder', 'mode', 'pid', 'acquired', 'expires']),
    heartbeat: s.heartbeat ?? null,
    run: pickObj(s.run, ['run_id', 'mode', 'session_id', 'started', 'ended', 'exit_code', 'outcome', 'blocked_reason', 'report_sha256']),
    hold: pickObj(s.hold, ['type', 'set_by', 'at', 'reason', 'resume_state', 'reset_at']),
  };
}

export function buildSnapshot({ root, now = new Date() }) {
  const cfg = readConfig(root);
  const packets = listStatus('MA-NOV-', { root });
  const ev = evaluate({ root, nowMs: now.getTime() });
  const reasons = Object.fromEntries(ev.ineligible.map((x) => [x.id, x.reasons]));
  const op = opener(root, cfg);
  return {
    schema: 1,
    generated_at: isoSec(now),
    config: { heartbeat_amber_s: cfg.heartbeat_amber_s, lease_ttl_s: cfg.lease_ttl_s, refresh_s: cfg.refresh_s, model: cfg.model },
    pause: readPause(root),
    capacity_hold: ev.capacity_hold,
    opener: { file: op.file, sha256: op.sha256 },
    fixed_line: op.fixed_line,
    packets: packets.map(({ id, status }) => ({ id, ...pick(status), eligible: ev.eligible.includes(id), reasons: reasons[id] || [], warnings: ev.warnings[id] || [] })),
    runs: recentRuns(root),
  };
}

export const runMode = (p) => (p.lease && p.lease.mode) || (p.run && p.run.mode) || 'headless';

function runningText(snap) {
  const r = snap.packets.filter((p) => p.state === 'EXECUTING' || p.lease);
  if (!r.length) return 'none (dispatcher idle)';
  return r.map((p) => `${p.id} — ${runMode(p)}, holder ${dash(p.lease && p.lease.holder)}, run \`${dash(p.run && p.run.run_id)}\`, started ${dash((p.run && p.run.started) || (p.lease && p.lease.acquired))}, lease expires ${dash(p.lease && p.lease.expires)}`).join(' · ');
}

export function renderBoard(snap) {
  const lines = [
    BOARD_TITLE,
    '',
    `generated_at: ${snap.generated_at}`,
    '',
    '*Projection of `claude/packets/MA-NOV-*_Status.json` (the only live state). Hand edits are overwritten. October board archived unchanged at `claude/packets/STATUS_BOARD_October_2026.md`.*',
    '',
    `**Global pause:** ${snap.pause ? `ON — ${cell(snap.pause.reason)}` : 'off'} · **Capacity hold:** ${snap.capacity_hold ? `ON — ${cell(snap.capacity_hold.reason)} (set by ${cell(snap.capacity_hold.set_by)})` : 'off'}`,
    '',
    `**Running:** ${runningText(snap)}`,
    '',
    BOARD_SECTION,
    '',
    `| ${COLUMNS.join(' | ')} |`,
    `|${COLUMNS.map(() => '---').join('|')}|`,
  ];
  for (const p of snap.packets) {
    const name = p.title ? `${p.id} — ${p.title}` : p.id;
    const ctrl = p.control && p.control.sha256 ? `${ver(p.control.version)} \`${p.control.sha256}\`` : '—';
    lines.push(`| ${[cell(name), cell(p.state), ctrl, cell(p.lane), cell(p.write_owner), cell(p.next_gate), cell(p.blocker), cell(p.usage_class)].join(' | ')} |`);
  }
  return lines.join('\n') + '\n';
}

const esc = (v) => dash(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function section(title, items, empty) {
  return `<section><h2>${esc(title)} <span class="n">${items.length}</span></h2>${items.length ? items.join('\n') : `<p class="empty">${esc(empty)}</p>`}</section>`;
}

function card(p, extra = '') {
  const reasons = p.reasons.filter((r) => !r.startsWith('state '));
  return `<div class="card st-${esc(p.state)}"><div class="row"><b>${esc(p.id)}</b> <span class="pill">${esc(p.state)}</span>${p.eligible ? ' <span class="pill ok">eligible</span>' : ''}</div>
<div class="t">${esc(p.title)}</div>
<div class="meta">Next gate: ${esc(p.next_gate)} · Owner: ${esc(p.write_owner)} · Usage: ${esc(p.usage_class)} · Control ${esc(p.control && p.control.version)} <code>${esc(p.control && p.control.sha256 ? p.control.sha256.slice(0, 12) + '…' : null)}</code></div>
${p.blocker ? `<div class="why">Blocker: ${esc(p.blocker)}</div>` : ''}${reasons.length && !p.eligible ? `<div class="why">Why not ready: ${reasons.map(esc).join('; ')}</div>` : ''}${extra}</div>`;
}

export function renderHtml(snap) {
  const P = snap.packets;
  const by = (...states) => P.filter((p) => states.includes(p.state));
  const waiting = [
    ...(snap.pause ? [`<div class="card banner red"><b>Global pause is ON</b> — ${esc(snap.pause.reason)} (set ${esc(snap.pause.at)})</div>`] : []),
    ...(snap.capacity_hold ? [`<div class="card banner amber"><b>Capacity hold</b> — ${esc(snap.capacity_hold.reason)} · ${snap.capacity_hold.set_by === 'dispatcher' ? 'set automatically from a worker quota error' : 'manual entry, not telemetry'} (${esc(snap.capacity_hold.set_by)}, ${esc(snap.capacity_hold.at)}) · CAPACITY_HOLD</div>`] : []),
    ...P.filter((p) => p.state === 'READY' && !p.start_approval).map((p) => card(p, '<div class="act">Action (manual/assisted): tell the Main Lane "approve ' + esc(p.id) + '"</div>')),
    ...by('DECISION_NEEDED').map((p) => card(p, '<div class="act">Action (manual/assisted): give the Main Lane your decision</div>')),
    ...by('DRAFT').map((p) => card(p, '<div class="act">Draft — awaiting admission by the Main Lane</div>')),
    ...P.filter((p) => p.hold && !['CLOSED'].includes(p.state)).map((p) => card(p, `<div class="act">Hold ${esc(p.hold.type)} — resume via the Main Lane</div>`)),
  ];
  const running = by('EXECUTING').map((p) => {
    const mode = runMode(p);
    const l = p.lease || {};
    const common = `<div class="meta"><span class="pill mode-${esc(mode)}">${esc(mode)}</span> holder ${esc(l.holder)} · run <code>${esc(p.run && p.run.run_id)}</code> · started ${esc((p.run && p.run.started) || l.acquired)} · lease expires <span class="lx" data-exp="${esc(l.expires)}">${esc(l.expires)}</span></div>`;
    const tail = mode === 'interactive'
      ? `<div class="meta">Interactive session — no heartbeat expected; it finishes with <code>node tools/factory/dispatch.mjs end ${esc(p.id)}</code>.</div>`
      : `<div class="meta">Heartbeat <span class="hb" data-hb="${esc(p.heartbeat)}" data-exp="${esc(l.expires)}">${esc(p.heartbeat)}</span></div>`;
    return card(p, common + tail);
  });
  const anyLease = P.some((p) => p.lease);
  const ready = P.filter((p) => p.state === 'READY' && p.start_approval).map((p) => card(p, `<div class="meta">Start approval: ${esc(p.start_approval.by)} ${esc(p.start_approval.at)} — “${esc(p.start_approval.words)}”</div>${p.warnings.length ? `<div class="meta">${p.warnings.map(esc).join('; ')}</div>` : ''}`));
  const review = by('REVIEW_NEEDED', 'CHANGES_REQUESTED', 'APPROVED').map((p) => card(p, p.run && p.run.report_sha256 ? `<div class="meta">Report <code>${esc(p.run.report_sha256)}</code></div>` : ''));
  const blocked = by('BLOCKED', 'PAUSED', 'CAPACITY_HOLD').map((p) => card(p));
  const closed = by('CLOSED').sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')) || a.id.localeCompare(b.id)).slice(0, 10)
    .map((p) => `<div class="line"><b>${esc(p.id)}</b> — ${esc(p.title)} <span class="dim">${esc(p.updated)}</span></div>`);
  const runs = snap.runs.map((r) => `<div class="line"><code>${esc(r.run_id)}</code> ${esc(r.packet)} · ${esc(r.mode || 'headless')} · ${esc(r.outcome)}${r.mode === 'interactive' ? '' : ` · exit ${esc(r.exit_code)}`} · ${esc(r.started)} → ${esc(r.ended)}${r.blocked_reason ? ` · ${esc(r.blocked_reason)}` : ''}</div>`);
  const logic = TOWER_LOGIC_FUNCTIONS.map((f) => f.toString()).join('\n');
  const json = stableStringify(snap).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="${snap.config.refresh_s}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Meridian Atlas — Control Tower</title>
<style>
:root{--bg:#f7f7f5;--fg:#1d1d1b;--dim:#6b6b66;--card:#fff;--line:#e2e2dc;--ok:#1f7a3a;--amber:#a86500;--red:#b3261e;--pill:#ecece7}
@media (prefers-color-scheme:dark){:root{--bg:#161614;--fg:#ececea;--dim:#9a9a94;--card:#21211e;--line:#34342f;--ok:#5cc27a;--amber:#e3a33c;--red:#f07167;--pill:#2e2e2a}}
*{box-sizing:border-box}body{margin:0;padding:20px;font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;background:var(--bg);color:var(--fg)}
h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:22px 0 8px;border-bottom:1px solid var(--line);padding-bottom:4px}.n{color:var(--dim);font-weight:400}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin:8px 0}.banner.red{border-color:var(--red)}.banner.amber{border-color:var(--amber)}
.pill{background:var(--pill);border-radius:10px;padding:1px 8px;font-size:12px}.pill.ok{color:var(--ok)}.t{margin:2px 0}.meta,.dim,.empty{color:var(--dim);font-size:12.5px}
.why{color:var(--amber);font-size:12.5px}.act{color:var(--fg);font-size:12.5px;font-style:italic}.line{padding:3px 0;border-bottom:1px dashed var(--line)}
code{font:12px ui-monospace,SFMono-Regular,Menlo,monospace}.mode-interactive{color:var(--ok)}.lx.red{color:var(--red);font-weight:600}.hb.ok{color:var(--ok)}.hb.amber{color:var(--amber)}.hb.red{color:var(--red);font-weight:600}
#status{display:inline-block;margin-left:8px;padding:1px 10px;border-radius:10px;background:var(--pill);font-size:13px;font-weight:400}#status.live{color:var(--ok)}#status.amber{background:var(--amber);color:#fff}#status.red{background:var(--red);color:#fff;font-weight:600}
pre{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px;white-space:pre-wrap;word-break:break-all}footer{margin-top:24px;color:var(--dim);font-size:12px}
</style>
</head>
<body>
<h1>Meridian Atlas — Control Tower <span id="status">snapshot</span></h1>
<div class="dim">Generated ${esc(snap.generated_at)} from Status files · reloads every ${snap.config.refresh_s}s · ${anyLease ? 'dispatcher has an active lease' : 'dispatcher idle (no lease)'} · model: ${esc(snap.config.model || 'not recorded (choice 2b)')}</div>
${section('Waiting for you', waiting, 'Nothing waiting for the Founder.')}
${section('Running', running, anyLease ? 'No EXECUTING packet.' : 'Idle — no lease held.')}
${section('Ready', ready, 'No approved packet waiting to run.')}
${section('In review', review, 'Nothing in review.')}
${section('Blocked / held', blocked, 'Nothing blocked or held.')}
${section('Closed (last 10)', closed, 'None closed.')}
${section('Recent runs', runs, 'No dispatcher runs recorded.')}
<section><h2>How to start a run</h2><p class="meta">Founder: open a Claude Code session and type the fixed line. Runs are interactive (Founder choice B, 7 Nov): the session brackets its work with <code>node tools/factory/dispatch.mjs begin &lt;ID&gt;</code> … <code>end &lt;ID&gt;</code>, so this page shows it as running and the scope check applies.</p><pre>${esc(snap.fixed_line)}</pre><p class="meta">Opener: <code>${esc(snap.opener && snap.opener.file)}</code> sha256 <code>${esc(snap.opener && snap.opener.sha256)}</code> (computed from the file when this page was generated)</p></section>
<footer>generated_at ${esc(snap.generated_at)} · node tools/factory/project.mjs · no secrets, no network</footer>
<script type="application/json" id="snapshot">${json}</script>
<script id="tower-logic">
${logic}
</script>
<script>
(function(){
  var snap = JSON.parse(document.getElementById('snapshot').textContent);
  function tick(){
    var now = Date.now();
    var leases = snap.packets.filter(function (p) { return p.lease; }).map(function (p) { return { id: p.id, run_id: p.lease.run_id, expires: p.lease.expires }; });
    var st = towerStatus(snap.generated_at, now, snap.config.refresh_s, leases);
    var el = document.getElementById('status');
    el.textContent = st.label;
    el.className = st.cls;
    var hbs = document.querySelectorAll('.hb');
    for (var i = 0; i < hbs.length; i++) {
      var hb = hbs[i].getAttribute('data-hb'), exp = hbs[i].getAttribute('data-exp');
      hb = hb === '—' ? null : hb; exp = exp === '—' ? null : exp;
      var c = heartbeatClass(hb, exp, now, snap.config.heartbeat_amber_s);
      hbs[i].className = 'hb ' + c;
      hbs[i].textContent = (hb ? formatAge((now - Date.parse(hb)) / 1000) + ' ago' : 'none') + (c === 'red' ? ' — STALE (past lease expiry)' : '');
    }
    var lxs = document.querySelectorAll('.lx');
    for (var j = 0; j < lxs.length; j++) {
      var e = lxs[j].getAttribute('data-exp'); e = e === '—' ? null : e;
      var lc = leaseClass(e, now);
      lxs[j].className = 'lx ' + lc;
      if (lc === 'red') lxs[j].textContent = e + ' — EXPIRED';
    }
  }
  tick(); setInterval(tick, 5000);
})();
</script>
</body>
</html>
`;
}

export function boardIsGenerated(file) {
  if (!fs.existsSync(file)) return true;
  const first = fs.readFileSync(file, 'utf8').split('\n', 1)[0];
  return first === BOARD_TITLE;
}

export function project({ root = repoRoot(), now = new Date(), write = true } = {}) {
  const snap = buildSnapshot({ root, now });
  const board = renderBoard(snap);
  const html = renderHtml(snap);
  const boardFile = path.join(packetsDir(root), 'STATUS_BOARD.md');
  const htmlFile = path.join(factoryDir(root), 'control-tower.html');
  if (write) {
    if (!boardIsGenerated(boardFile)) {
      throw new Error('claude/packets/STATUS_BOARD.md is not a generated board — archive it first (Task §6.1); refusing to overwrite');
    }
    fs.mkdirSync(path.dirname(htmlFile), { recursive: true });
    atomicWrite(boardFile, board);
    atomicWrite(htmlFile, html);
  }
  return { snap, board, html, boardFile, htmlFile };
}

function atomicWrite(file, data) {
  const tmp = `${path.join(path.dirname(file), '.' + path.basename(file))}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  try {
    const r = project({ write: !process.argv.includes('--check') });
    console.log(`packets: ${r.snap.packets.length} · board: ${path.relative(repoRoot(), r.boardFile)} · tower: ${path.relative(repoRoot(), r.htmlFile)} · generated_at ${r.snap.generated_at}${process.argv.includes('--check') ? ' (check only, nothing written)' : ''}`);
  } catch (e) {
    console.error(`project.mjs: ${e.message}`);
    process.exit(1);
  }
}
