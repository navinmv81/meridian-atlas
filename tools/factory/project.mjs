#!/usr/bin/env node
// Tower/board generator (MA-NOV-P1.BUILD Task §4; interim design MA-NOV-P1.FIX4). No model calls, no network.
// Reads claude/packets/MA-NOV-*_Status.json, claude/factory/PAUSE.json (optional), claude/factory/config.json,
// claude/factory/runs/*/run.json and claude/factory/transitions.jsonl.
// Writes claude/packets/STATUS_BOARD.md and claude/factory/control-tower.html.
// Usage: node tools/factory/project.mjs [--check]   (--check: print what would change, write nothing)
import fs from 'node:fs';
import path from 'node:path';
import { repoRoot, packetsDir, factoryDir, sha256File, isoSec, stableStringify, readConfig, readPause } from './lib/util.mjs';
import { listStatus, TRANSITIONS_FILE } from './lib/state.mjs';
import { evaluate, SCOPE_KINDS, RECORD_KINDS } from './lib/eligibility.mjs';
import { TOWER_LOGIC_FUNCTIONS } from './lib/tower-logic.mjs';

export const BOARD_TITLE = '# Status Board — November 2026 (generated — do not edit; run node tools/factory/project.mjs)';
export const BOARD_SECTION = '## November 2026 — admitted packets';
export const SCOPE_SECTION = '## November scope — outcomes';
export const REQUEST_SECTION = '## Waiting for the Founder';
// FIX3 item 7: outcome / carry-over records are sprint scope, not work — shown in their own section only.
// FIX4 item 7: founder-request and plan records are rendered too, and are never work or runnable (RECORD_KINDS).
export { SCOPE_KINDS, RECORD_KINDS };
export const isScope = (p) => SCOPE_KINDS.includes(p.kind);
export const isRecord = (p) => RECORD_KINDS.includes(p.kind);
const COLUMNS = ['Packet', 'State', 'Control (SHA-256)', 'Lane / tool', 'Write owner', 'Next gate', 'Blocker', 'Usage'];

const dash = (v) => (v === null || v === undefined || v === '' ? '—' : String(v));
const cell = (v) => dash(v).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
const ver = (v) => (v ? (String(v).startsWith('v') ? String(v) : `v${v}`) : 'v?');
const arr = (v) => (Array.isArray(v) ? v : []);

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

// FIX4: state changes from the append-only transitions log (rows with from === to are field edits, not decisions).
function recentTransitions(root, n = 12) {
  const f = path.join(root, ...TRANSITIONS_FILE.split('/'));
  if (!fs.existsSync(f)) return [];
  const rows = [];
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let r; try { r = JSON.parse(line); } catch { continue; }
    if (r && r.id && r.from !== r.to) rows.push({ at: r.at ?? null, id: r.id, writer: r.writer ?? null, from: r.from ?? null, to: r.to ?? null, rev: r.rev ?? null });
  }
  return rows.slice(-n).reverse();
}

function pick(s) {
  const pickObj = (o, keys) => (o && typeof o === 'object' ? Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]])) : o ?? null);
  return {
    title: s.title ?? null, kind: s.kind ?? null, state: s.state ?? null, phase: s.phase ?? null, rev: Number.isInteger(s.rev) ? s.rev : 1,
    lane: s.lane ?? null, write_owner: s.write_owner ?? null, next_gate: s.next_gate ?? null,
    blocker: blockerText(s), usage_class: s.usage_class ?? null, updated: s.updated ?? null, updated_by: s.updated_by ?? null,
    control: pickObj(s.control, ['version', 'file', 'sha256']), task: pickObj(s.task, ['version', 'file', 'sha256']),
    start_approval: pickObj(s.start_approval, ['by', 'at', 'words']),
    lease: pickObj(s.lease, ['run_id', 'holder', 'mode', 'pid', 'acquired', 'expires']),
    heartbeat: s.heartbeat ?? null,
    run: pickObj(s.run, ['run_id', 'mode', 'session_id', 'started', 'ended', 'exit_code', 'outcome', 'blocked_reason', 'report_sha256']),
    hold: pickObj(s.hold, ['type', 'set_by', 'at', 'reason', 'resume_state', 'reset_at']),
    ...(SCOPE_KINDS.includes(s.kind) ? { requirements: arr(s.requirements), dependencies: arr(s.dependencies), observations: arr(s.observations) } : {}),
    ...(s.kind === 'founder-request' ? { request: { type: s.request_type ?? 'note', question: s.question ?? null, options: arr(s.options),
      reply: s.reply ?? null, due: s.due ?? null, status: s.status ?? 'open', answer: s.answer ?? null, answered_at: s.answered_at ?? null } } : {}),
    ...(s.kind === 'plan' ? { plan: { milestones: arr(s.milestones), handoffs: arr(s.handoffs) } } : {}),
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
    transitions: recentTransitions(root),
  };
}

export const runMode = (p) => (p.lease && p.lease.mode) || (p.run && p.run.mode) || 'headless';

function runningText(snap) {
  const r = snap.packets.filter((p) => !isRecord(p) && (p.state === 'EXECUTING' || p.lease));
  if (!r.length) return 'none (dispatcher idle)';
  return r.map((p) => `${p.id} — ${runMode(p)}, holder ${dash(p.lease && p.lease.holder)}, run \`${dash(p.run && p.run.run_id)}\`, started ${dash((p.run && p.run.started) || (p.lease && p.lease.acquired))}, lease expires ${dash(p.lease && p.lease.expires)}`).join(' · ');
}

const openRequests = (snap) => snap.packets.filter((p) => p.kind === 'founder-request' && p.request.status === 'open');

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
  for (const p of snap.packets.filter((x) => !isRecord(x))) {
    const name = p.title ? `${p.id} — ${p.title}` : p.id;
    const ctrl = p.control && p.control.sha256 ? `${ver(p.control.version)} \`${p.control.sha256}\`` : '—';
    lines.push(`| ${[cell(name), cell(p.state), ctrl, cell(p.lane), cell(p.write_owner), cell(p.next_gate), cell(p.blocker), cell(p.usage_class)].join(' | ')} |`);
  }
  const reqs = openRequests(snap);
  if (reqs.length) {
    lines.push('', REQUEST_SECTION, '', ...reqs.map((p) => `- **${cell(p.id)}** (${cell(p.request.type)}) — ${cell(p.title || p.request.question)}${p.request.reply ? ` · reply: \`${cell(p.request.reply)}\`` : ''}${p.request.due ? ` · due ${cell(p.request.due)}` : ''}`));
  }
  const scope = snap.packets.filter(isScope);
  if (scope.length) {
    lines.push('', SCOPE_SECTION, '', '| Outcome | Kind | State | Requirements | Dependencies | Next gate |', '|---|---|---|---|---|---|');
    for (const p of scope) {
      lines.push(`| ${[cell(p.title ? `${p.id} — ${p.title}` : p.id), cell(p.kind), cell(p.state), cell(p.requirements.join('; ')), cell(p.dependencies.join('; ')), cell(p.next_gate)].join(' | ')} |`);
    }
    for (const p of scope.filter((x) => x.observations.length)) {
      lines.push('', `**${p.id} observations:**`, ...p.observations.map((o) => `- ${cell(o.at)} · ${cell(o.item)} — ${cell(o.note)}`));
    }
  }
  return lines.join('\n') + '\n';
}

// ---------------- Control Tower (interim design: claude/factory/design/interim-tower-reference.html) ----------------
const esc = (v) => dash(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const STATE_PILL = { READY: 'p-ready', EXECUTING: 'p-run', REVIEW_NEEDED: 'p-review', CHANGES_REQUESTED: 'p-review', APPROVED: 'p-review',
  DECISION_NEEDED: 'p-decision', CLOSED: 'p-closed', BLOCKED: 'p-stale', PAUSED: 'p-stale', CAPACITY_HOLD: 'p-stale', DRAFT: 'p-interim' };
const pill = (cls, text) => `<span class="pill ${cls}"><i></i>${esc(text)}</span>`;
const statePill = (st) => pill(STATE_PILL[st] || 'p-interim', st);
const chip = (t, cls = '') => `<span class="chip${cls ? ` ${cls}` : ''}">${esc(t)}</span>`;
const short = (h, n = 8) => (h ? String(h).slice(0, n) : null);

function section(title, body, count = null) {
  return `<section><h2>${esc(title)}${count === null ? '' : ` <span class="n">${count}</span>`}</h2>${body}</section>`;
}
const emptyP = (t) => `<p class="empty">${esc(t)}</p>`;

function workCard(p, extra = '') {
  const reasons = p.reasons.filter((r) => !r.startsWith('state '));
  const chips = [p.lane && chip(p.lane), p.usage_class && chip(p.usage_class),
    p.control && p.control.sha256 && chip(`ctl ${short(p.control.sha256)}`),
    p.run && p.run.session_id && chip(`session ${short(p.run.session_id)}`)].filter(Boolean);
  return `<div class="card"><div class="k"><span class="id">${esc(p.id)}</span>${statePill(p.state)}</div>
<span class="t">${esc(p.title)}</span>
<span class="x">Next gate: ${esc(p.next_gate)} · Owner: ${esc(p.write_owner)}</span>
${p.blocker ? `<span class="x why">Blocker: ${esc(p.blocker)}</span>` : ''}${reasons.length && !p.eligible && p.state !== 'CLOSED' ? `<span class="x">Why not ready: ${reasons.map(esc).join('; ')}</span>` : ''}${extra}
<div class="chips">${chips.join('')}</div></div>`;
}

let copySeq = 0;
function replyLine(reply, due) {
  const id = `cp-${++copySeq}`;
  return `<div class="reply">${reply ? `<span class="dim sm">Reply to the Main Lane:</span><code id="${id}">${esc(reply)}</code><button class="copy" type="button" data-copy="${id}">Copy</button>` : ''}${due ? `<span class="dim sm due">${esc(due)}</span>` : ''}</div>`;
}
// kind: start (red) | decision (amber) | note (slate) | hold (red)
const ASK_STYLE = { start: ['', 'p-decision', 'Start approval'], decision: ['soft', 'p-run', 'Decision'], note: ['note', 'p-interim', 'Note'], hold: ['', 'p-stale', 'Hold'] };
function ask(kind, title, body, { reply = null, due = null, id = null, label = null } = {}) {
  const [cls, pcls, ptext] = ASK_STYLE[kind] || ASK_STYLE.note;
  return `<div class="ask ${cls}"><div class="k"><span class="t">${title}</span>${pill(pcls, label || ptext)}</div>
${body ? `<div class="x">${body}</div>` : ''}${id ? `<div class="chips">${chip(id)}</div>` : ''}${replyLine(reply, due)}</div>`;
}

export function renderHtml(snap) {
  copySeq = 0;
  const P = snap.packets.filter((p) => !isRecord(p));
  const by = (...states) => P.filter((p) => states.includes(p.state));
  const requests = snap.packets.filter((p) => p.kind === 'founder-request');
  const plan = snap.packets.find((p) => p.kind === 'plan') || null;
  const anyLease = snap.packets.some((p) => p.lease);

  // Waiting for you
  const asks = [
    ...(snap.pause ? [ask('hold', 'Global pause is ON', `${esc(snap.pause.reason)} (set ${esc(snap.pause.at)})`, { label: 'Pause' })] : []),
    ...(snap.capacity_hold ? [ask('hold', 'Capacity hold', `${esc(snap.capacity_hold.reason)} · ${snap.capacity_hold.set_by === 'dispatcher' ? 'set automatically from a worker quota error' : 'manual entry, not telemetry'} (${esc(snap.capacity_hold.set_by)}, ${esc(snap.capacity_hold.at)}) · CAPACITY_HOLD`, { label: 'CAPACITY_HOLD' })] : []),
    ...P.filter((p) => p.state === 'READY' && !p.start_approval).map((p) => ask('start', `Start ${esc(p.id)} — ${esc(p.title)}`,
      `Awaiting your Start Approval. Usage: ${esc(p.usage_class)} · Control ${esc(p.control && p.control.version)} <span class="mono">${esc(short(p.control && p.control.sha256, 12))}…</span>`, { reply: `approve ${p.id}`, id: p.id })),
    ...by('DECISION_NEEDED').map((p) => ask('decision', `${esc(p.id)} — ${esc(p.title)}`, `Decision needed. Next gate: ${esc(p.next_gate)}`, { id: p.id })),
    ...requests.filter((p) => p.request.status === 'open').map((p) => {
      const r = p.request;
      const body = [p.title && r.question ? esc(r.question) : '', r.options.length ? `Options: ${r.options.map(esc).join(' · ')}` : ''].filter(Boolean).join('<br>');
      return ask(r.type === 'start' ? 'start' : r.type === 'decision' ? 'decision' : 'note', esc(p.title || r.question), body, { reply: r.reply, due: r.due, id: p.id });
    }),
    ...P.filter((p) => p.hold && p.state !== 'CLOSED').map((p) => ask('hold', `${esc(p.id)} — hold ${esc(p.hold.type)}`, `${esc(p.hold.reason)} · resume via the Main Lane`, { id: p.id })),
  ];

  // Work columns
  const running = by('EXECUTING').map((p) => {
    const mode = runMode(p);
    const l = p.lease || {};
    const common = `<span class="x"><span class="chip mode-${esc(mode)}">${esc(mode)}</span> holder ${esc(l.holder)} · run <code>${esc(p.run && p.run.run_id)}</code> · started ${esc((p.run && p.run.started) || l.acquired)} · lease expires <span class="lx" data-exp="${esc(l.expires)}">${esc(l.expires)}</span></span>`;
    const tail = mode === 'interactive'
      ? `<span class="x">Interactive session — no heartbeat expected; it finishes with <code>node tools/factory/dispatch.mjs end ${esc(p.id)}</code>.</span>`
      : `<span class="x">Heartbeat <span class="hb" data-hb="${esc(p.heartbeat)}" data-exp="${esc(l.expires)}">${esc(p.heartbeat)}</span></span>`;
    return workCard(p, common + tail);
  });
  const ready = [
    ...P.filter((p) => p.state === 'READY').map((p) => workCard(p, p.start_approval
      ? `<span class="x">Start approval: ${esc(p.start_approval.by)} ${esc(p.start_approval.at)} — “${esc(p.start_approval.words)}”</span>${p.warnings.length ? `<span class="x">${p.warnings.map(esc).join('; ')}</span>` : ''}`
      : '<span class="x">Waiting for your Start Approval (see Waiting for you)</span>')),
    ...by('DRAFT').map((p) => workCard(p, '<span class="x">Draft — not admitted yet (Main Lane)</span>')),
  ];
  const review = by('REVIEW_NEEDED', 'CHANGES_REQUESTED', 'DECISION_NEEDED', 'APPROVED').map((p) => workCard(p, p.run && p.run.report_sha256 ? `<span class="x">Report <code>${esc(short(p.run.report_sha256, 12))}…</code></span>` : ''));
  const blocked = by('BLOCKED', 'PAUSED', 'CAPACITY_HOLD').map((p) => workCard(p));
  const closed = by('CLOSED').sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')) || a.id.localeCompare(b.id)).slice(0, 10).map((p) => workCard(p));
  const col = (cls, label, items, empty) => `<div class="col"><div class="col-h">${pill(cls, label)}<span class="n">${items.length}</span></div>${items.length ? items.join('\n') : `<span class="empty">${esc(empty)}</span>`}</div>`;
  const board = `<div class="board">${[
    col('p-run', 'Running', running, anyLease ? 'No EXECUTING packet.' : 'Idle — no lease held.'),
    col('p-ready', 'Ready', ready, 'No packet waiting to run.'),
    col('p-review', 'In review', review, 'Nothing in review.'),
    col('p-stale', 'Blocked / held', blocked, 'Nothing blocked or held.'),
    col('p-closed', 'Closed', closed, 'None closed.'),
  ].join('\n')}</div>`;

  // Start a run
  const start = `<div class="panel line"><ol class="steps">
<li>Approve the packet by replying to the Main Lane with the line on its card under <i>Waiting for you</i>.</li>
<li>Open a <b>new</b> Claude Code session on <span class="mono">Meridian Atlas Clean (v11)</span>. Every run and every review needs a fresh session.</li>
<li>Type the fixed line. The session brackets its work with <code>node tools/factory/dispatch.mjs begin &lt;ID&gt;</code> … <code>end &lt;ID&gt;</code>, so this page shows it as running and the scope check applies.</li>
<li>When it stops, tell the Main Lane "done".</li></ol>
<pre id="fixed">${esc(snap.fixed_line)}</pre>
<div class="reply"><button class="copy" type="button" data-copy="fixed">Copy line</button><span class="dim sm">Opener <span class="mono">${esc(snap.opener && snap.opener.file)}</span> sha256 <span class="mono">${esc(snap.opener && snap.opener.sha256)}</span> (computed when this page was generated)</span></div></div>`;

  // Path + Handoffs (one plan record)
  const ms = plan ? plan.plan.milestones : [];
  const LAB = { done: '<span class="lab l-auto">Done</span>', now: '<span class="lab l-asst">Now</span>', next: '<span class="lab l-next">Next</span>' };
  const pathBody = ms.length ? `<div class="panel path">${ms.map((m) => `<div class="stp"><span class="d">${esc(m.when)}</span><span class="dot ${m.status === 'done' ? 'done' : m.status === 'now' ? 'now' : ''}" aria-label="${esc(m.status)}"></span><span class="w">${esc(m.title)}<span>${esc(m.detail)}</span></span><span class="s">${LAB[m.status] || ''}</span></div>`).join('')}</div>`
    : emptyP(plan ? 'The plan record has no milestones.' : 'No plan record (kind "plan").');
  const H = { automatic: ['l-auto', 'Automatic'], assisted: ['l-asst', 'Assisted'], manual: ['l-man', 'Manual'] };
  const hs = plan ? plan.plan.handoffs : [];
  const handBody = hs.length ? `<div class="panel tbl"><table><thead><tr><th>Handoff</th><th>Today</th><th>How today</th><th>Target</th></tr></thead><tbody>${hs.map((h) => {
    const [c, t] = H[h.today] || ['l-man', dash(h.today)];
    return `<tr><td>${esc(h.step)}</td><td><span class="lab ${c}">${esc(t)}</span></td><td>${esc(h.how)}</td><td class="dim">${esc(h.target)}</td></tr>`;
  }).join('')}</tbody></table></div>` : emptyP(plan ? 'The plan record has no handoffs.' : 'No plan record (kind "plan").');

  // November scope
  const scope = snap.packets.filter(isScope).map((p) => `<div class="scard"><div class="k"><span class="id">${esc(p.id)}</span><span>${pill('p-interim', p.kind)} ${statePill(p.state)}</span></div>
<span class="t">${esc(p.title)}</span>
<div class="chips">${p.requirements.length ? p.requirements.map((r) => chip(r, 'req')).join('') : '<span class="dim sm">No requirements listed</span>'}</div>
<span class="x">Dependencies: ${p.dependencies.length ? p.dependencies.map(esc).join('; ') : '—'}</span>
<span class="x">Next gate: ${esc(p.next_gate)}</span>${p.observations.length ? `<ul class="obs">${p.observations.map((o) => `<li><span class="dim">${esc(o.at)}</span> <b>${esc(o.item)}</b> — ${esc(o.note)}</li>`).join('')}</ul>` : ''}</div>`);

  // Recent runs + decisions
  const runs = snap.runs.map((r) => `<li><span class="tag ${r.outcome === 'REVIEW_NEEDED' ? 'ok' : r.outcome === 'BLOCKED' ? 'bad' : ''}">${esc(r.outcome)}</span><span><code>${esc(r.run_id)}</code> ${esc(r.packet)} · ${esc(r.mode || 'headless')} · ${esc(r.outcome)}${r.mode === 'interactive' ? '' : ` · exit ${esc(r.exit_code)}`} · ${esc(r.started)} → ${esc(r.ended)}${r.blocked_reason ? ` · ${esc(r.blocked_reason)}` : ''}</span></li>`);
  const decisions = [
    ...requests.filter((p) => p.request.status === 'answered').map((p) => ({ at: p.request.answered_at || p.updated || '', html: `<b>${esc(p.id)}</b> — ${esc(p.title || p.request.question)}: <b>${esc(p.request.answer)}</b>` })),
    ...requests.filter((p) => p.request.status === 'withdrawn').map((p) => ({ at: p.updated || '', html: `<b>${esc(p.id)}</b> — ${esc(p.title || p.request.question)}: withdrawn` })),
    ...(snap.transitions || []).map((t) => ({ at: t.at || '', html: `${esc(t.id)} ${esc(t.from)} → <b>${esc(t.to)}</b> <span class="dim">(${esc(t.writer)}, rev ${esc(t.rev)})</span>` })),
  ].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 15).map((d) => `<li><span class="tag">${esc(d.at)}</span><span>${d.html}</span></li>`);

  const logic = TOWER_LOGIC_FUNCTIONS.map((f) => f.toString()).join('\n');
  const json = stableStringify(snap).replace(/</g, '\\u003c');
  const list = (items, empty) => (items.length ? `<div class="panel"><ul class="plain">${items.join('\n')}</ul></div>` : emptyP(empty));
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="${snap.config.refresh_s}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>November Control Tower</title>
<style>
:root{--bg:#f3f5f8;--panel:#ffffff;--line:#d8dee6;--fg:#16202b;--dim:#5b6878;--accent:#1f6fb8;--acc-bg:rgba(31,111,184,.09);
--ok:#1c8650;--ok-bg:rgba(28,134,80,.10);--warn:#a46500;--warn-bg:rgba(164,101,0,.10);--bad:#c23b3b;--bad-bg:rgba(194,59,59,.09);--slate:#5b6b80;--sl-bg:rgba(91,107,128,.10);
--sans:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,Helvetica,Arial,sans-serif;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0b0f14;--panel:#121821;--line:#24303d;--fg:#dbe4ee;--dim:#8b99a9;--accent:#58b4ff;--acc-bg:rgba(88,180,255,.12);
--ok:#3fd987;--ok-bg:rgba(63,217,135,.12);--warn:#f3b843;--warn-bg:rgba(243,184,67,.12);--bad:#ff6d6d;--bad-bg:rgba(255,109,109,.12);--slate:#8ea0b6;--sl-bg:rgba(142,160,182,.12);color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0b0f14;--panel:#121821;--line:#24303d;--fg:#dbe4ee;--dim:#8b99a9;--accent:#58b4ff;--acc-bg:rgba(88,180,255,.12);
--ok:#3fd987;--ok-bg:rgba(63,217,135,.12);--warn:#f3b843;--warn-bg:rgba(243,184,67,.12);--bad:#ff6d6d;--bad-bg:rgba(255,109,109,.12);--slate:#8ea0b6;--sl-bg:rgba(142,160,182,.12);color-scheme:dark}
*{box-sizing:border-box}html,body{margin:0}
body{background:var(--bg);color:var(--fg);font-family:var(--sans);font-size:14px;line-height:1.5}
.wrap{max-width:1180px;margin:0 auto;padding:24px 16px 56px;display:flex;flex-direction:column;gap:24px}
h1{font-size:21px;margin:0;font-weight:700;text-wrap:balance}
h2{font-size:11.5px;text-transform:uppercase;letter-spacing:1.2px;color:var(--dim);margin:0 0 10px;font-weight:600}h2 .n{font-family:var(--mono);letter-spacing:0}
.mono,code{font-family:var(--mono)}code{font-size:12px;overflow-wrap:anywhere}.dim{color:var(--dim)}.sm{font-size:12px}
header{display:flex;flex-direction:column;gap:8px}.top{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.meta{display:flex;flex-wrap:wrap;gap:4px 18px;font-size:12.5px;color:var(--dim)}.meta b{color:var(--fg);font-weight:500}
.pill{display:inline-flex;align-items:center;gap:6px;font-size:10.5px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;padding:3px 9px;border-radius:20px;border:1px solid currentColor;white-space:nowrap}
.pill i{width:7px;height:7px;border-radius:50%;background:currentColor;flex:none}
.p-ready{color:var(--accent);background:var(--acc-bg)}.p-run{color:var(--warn);background:var(--warn-bg)}.p-review{color:var(--warn);background:var(--warn-bg);border-style:dashed}
.p-closed{color:var(--ok);background:var(--ok-bg)}.p-decision{color:var(--bad);background:var(--bad-bg)}.p-interim{color:var(--slate);background:var(--sl-bg)}
.p-fresh{color:var(--ok);background:var(--ok-bg)}.p-stale{color:var(--bad);background:var(--bad-bg)}.p-aging{color:var(--warn);background:var(--warn-bg)}
#status{white-space:normal;text-transform:none;letter-spacing:0;font-size:12px}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:14px 16px;min-width:0}
.asks{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}
.ask{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--bad);border-radius:8px;padding:14px 16px;display:flex;flex-direction:column;gap:8px;min-width:0}
.ask.soft{border-left-color:var(--warn)}.ask.note{border-left-color:var(--slate)}
.k{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap}.ask .t{font-weight:600;font-size:14.5px}.ask .x{font-size:13px;color:var(--dim)}
.reply{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.reply code{font-size:12.5px;background:var(--acc-bg);color:var(--accent);padding:3px 8px;border-radius:4px}.due{margin-left:auto}
button.copy{font:inherit;font-size:12px;background:var(--panel);color:var(--accent);border:1px solid var(--accent);border-radius:6px;padding:3px 10px;cursor:pointer}
button.copy:hover{background:var(--acc-bg)}button.copy:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.board{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.col{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:10px;min-width:0}
.col-h{display:flex;justify-content:space-between;align-items:center}.col-h .n{font-family:var(--mono);font-size:12px;color:var(--dim)}
.card{border-top:1px solid var(--line);padding-top:10px;display:flex;flex-direction:column;gap:4px;min-width:0}.col-h+.card{border-top:0;padding-top:0}
.id{font-family:var(--mono);font-size:12.5px;font-weight:600;overflow-wrap:anywhere}.card .t,.scard .t{font-size:13px}
.card .x,.scard .x{font-size:12px;color:var(--dim);overflow-wrap:anywhere}.why{color:var(--warn)!important}
.empty{font-size:12.5px;color:var(--dim);font-style:italic;margin:0}
.chips{display:flex;flex-wrap:wrap;gap:6px}.chip{font-size:10.5px;font-family:var(--mono);color:var(--dim);border:1px solid var(--line);border-radius:4px;padding:1px 6px;overflow-wrap:anywhere}
.chip.req{color:var(--accent);border-color:var(--accent)}.mode-interactive{color:var(--ok);border-color:var(--ok)}
.lx.red,.hb.red{color:var(--bad);font-weight:600}.hb.ok{color:var(--ok)}.hb.amber{color:var(--warn)}
.line{display:flex;flex-direction:column;gap:8px}.line pre{margin:0;font-family:var(--mono);font-size:12.5px;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:10px 12px;white-space:pre-wrap;overflow-wrap:anywhere}
.steps{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:4px;font-size:13px}
.two{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px}
.path{display:flex;flex-direction:column}.stp{display:grid;grid-template-columns:92px 22px minmax(0,1fr) auto;gap:10px;align-items:start;padding:8px 0;border-top:1px solid var(--line)}.stp:first-child{border-top:0}
.stp .d{font-family:var(--mono);font-size:12px;color:var(--dim);padding-top:1px}.dot{width:12px;height:12px;border-radius:50%;border:2px solid var(--line);margin-top:4px}
.dot.done{background:var(--ok);border-color:var(--ok)}.dot.now{background:var(--accent);border-color:var(--accent)}.stp .w{font-size:13px}.stp .w span{display:block;font-size:12px;color:var(--dim)}
@media (max-width:520px){.stp{grid-template-columns:22px minmax(0,1fr)}.stp .d,.stp .s{grid-column:2}}
.tbl{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;padding:7px 10px;border-top:1px solid var(--line);vertical-align:top}
th{font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--dim);font-weight:600;border-top:0}
.lab{font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;padding:2px 7px;border-radius:4px;white-space:nowrap}
.l-man{color:var(--bad);background:var(--bad-bg)}.l-asst{color:var(--warn);background:var(--warn-bg)}.l-auto{color:var(--ok);background:var(--ok-bg)}.l-next{color:var(--slate);background:var(--sl-bg)}
.scopes{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}
.scard{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:8px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;min-width:0}
.obs{margin:4px 0 0;padding-left:18px;font-size:12px}
ul.plain{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:7px;font-size:13px}ul.plain li{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:baseline;overflow-wrap:anywhere}
.tag{font-family:var(--mono);font-size:10.5px;font-weight:600;padding:1px 6px;border-radius:4px;white-space:nowrap;color:var(--slate);background:var(--sl-bg)}.tag.ok{color:var(--ok);background:var(--ok-bg)}.tag.bad{color:var(--bad);background:var(--bad-bg)}
footer{font-size:12px;color:var(--dim);border-top:1px solid var(--line);padding-top:12px}
@media (prefers-reduced-motion:no-preference){.pill i.pulse{animation:p 2s ease-in-out infinite}@keyframes p{50%{opacity:.35}}}
</style>
</head>
<body>
<div class="wrap">
<header>
<div class="top"><h1>Meridian Atlas — November Control Tower</h1><span class="pill p-interim" id="status"><i class="pulse"></i><span id="status-t">snapshot</span></span></div>
<div class="meta"><span class="mono">Generated ${esc(snap.generated_at)}</span><span>Reloads every <b>${snap.config.refresh_s}s</b></span><span><b>${anyLease ? 'dispatcher has an active lease' : 'dispatcher idle (no lease)'}</b></span><span>Model <b>${esc(snap.config.model || 'not recorded (choice 2b)')}</b></span><span>Source <b class="mono">claude/packets/MA-NOV-*_Status.json</b></span></div>
</header>
${section('Waiting for you', asks.length ? `<div class="asks">${asks.join('\n')}</div>` : emptyP('Nothing waiting for the Founder.'), asks.length)}
${section('Work', board)}
<div class="two">
${section('Start a run', start)}
${section('Path', pathBody)}
</div>
${section('Handoffs', handBody)}
${section('November scope', scope.length ? `<div class="scopes">${scope.join('\n')}</div>` : emptyP('No outcome records.'), scope.length)}
<div class="two">
${section('Recent runs', list(runs, 'No dispatcher runs recorded.'))}
${section('Recent decisions', list(decisions, 'No decisions recorded yet.'))}
</div>
<footer>Generated ${esc(snap.generated_at)} by <span class="mono">node tools/factory/project.mjs</span> from the Status files — this page holds no state of its own. Approve by replying to the Main Lane with the line on a card. No secrets, no network.</footer>
</div>
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
    document.getElementById('status-t').textContent = st.label;
    document.getElementById('status').className = 'pill ' + badgeClass(st.cls);
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
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('button.copy'); if (!b) return;
    var src = document.getElementById(b.getAttribute('data-copy')); if (!src) return;
    var old = b.textContent;
    function fallback() {
      try { var r = document.createRange(); r.selectNodeContents(src); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (_) {}
      b.textContent = 'Selected — press Cmd+C';
    }
    try {
      navigator.clipboard.writeText(src.textContent).then(function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = old; }, 1500); }, fallback);
    } catch (_) { fallback(); }
  });
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
