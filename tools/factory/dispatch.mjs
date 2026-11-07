#!/usr/bin/env node
// Dispatcher (MA-NOV-P1.BUILD Task §5). Node built-ins only.
//   node tools/factory/dispatch.mjs check            eligibility (§3) as JSON; handles stale leases; exit 0
//   node tools/factory/dispatch.mjs status           one line per November packet
//   node tools/factory/dispatch.mjs run <ID> [--dry-run]
// run exit codes: 0 finished → REVIEW_NEEDED · 2 refused (nothing launched) · 3 finished → BLOCKED · 1 internal error.
// One bounded run, no retries, never relaunches an interrupted run.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { repoRoot, factoryDir, sha256File, isoSec, readConfig } from './lib/util.mjs';
import { readStatus, writeStatusFresh, listStatus, statusPath } from './lib/state.mjs';
import { evaluate, reportCandidates } from './lib/eligibility.mjs';
import { acquireLease, retireLease, LeaseError } from './lib/lease.mjs';
import { project } from './project.mjs';

export class RefusedError extends Error { constructor(m) { super(m); this.name = 'RefusedError'; } }

const APP_BIN_GLOB = ['Library', 'Application Support', 'Claude', 'claude-code'];
const QUOTA_RE = /(usage|quota|rate)[ _-]?limit|limit reached|insufficient_quota|exceeded your (current )?(usage|quota)/i;

function semverCmp(a, b) {
  const pa = a.split(/[.-]/).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  const pb = b.split(/[.-]/).map((x) => (/^\d+$/.test(x) ? Number(x) : x));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0; const y = pb[i] ?? 0;
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') return x - y;
    return String(x).localeCompare(String(y));
  }
  return 0;
}

function isExecutable(p) { try { fs.accessSync(p, fs.constants.X_OK); return fs.statSync(p).isFile(); } catch { return false; } }

// Binary: env CLAUDE_BIN → config.claude_bin → newest app-bundled Claude Code (Founder choice 1b).
export function resolveBinary(cfg, env = process.env) {
  let bin = env.CLAUDE_BIN || cfg.claude_bin || null;
  if (!bin) {
    const base = path.join(os.homedir(), ...APP_BIN_GLOB);
    if (fs.existsSync(base)) {
      const versions = fs.readdirSync(base).filter((v) => /^\d/.test(v)).sort(semverCmp).reverse();
      outer: for (const v of versions) {
        for (const h of fs.readdirSync(path.join(base, v)).sort()) {
          const cand = path.join(base, v, h, 'claude.app', 'Contents', 'MacOS', 'claude');
          if (isExecutable(cand)) { bin = cand; break outer; }
        }
      }
    }
  }
  if (!bin) throw new RefusedError('no Claude Code binary found (CLAUDE_BIN, config.claude_bin, app bundle)');
  if (!isExecutable(bin)) throw new RefusedError(`binary not executable: ${bin}`);
  const v = spawnSync(bin, ['--version'], { encoding: 'utf8', timeout: 30000 });
  if (v.status !== 0) throw new RefusedError(`binary --version failed: ${bin}`);
  return { bin, version: (v.stdout || '').trim() };
}

// git status snapshot: path → "<XY>:<sha256|dir|gone>"
function gitSnapshot(root) {
  const r = spawnSync('git', ['--no-optional-locks', 'status', '--porcelain=v1', '-z', '-uall'], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) throw new RefusedError(`git status failed in ${root} — scope check impossible`);
  const map = new Map();
  const parts = r.stdout.split('\0').filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const code = parts[i].slice(0, 2); const p = parts[i].slice(3);
    if (code[0] === 'R' || code[0] === 'C') i++; // skip rename source
    const abs = path.join(root, p);
    let h = 'gone';
    try { const st = fs.statSync(abs); h = st.isFile() ? sha256File(abs) : 'dir'; } catch { /* deleted */ }
    map.set(p, `${code}:${h}`);
  }
  return map;
}

function globToRe(g) {
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*' && g[i + 1] === '*') { re += '.*'; i++; } else if (c === '*') re += '[^/]*';
    else re += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}
export function pathAllowed(p, allowed) {
  return allowed.some((a) => (a.endsWith('/') ? p.startsWith(a) : a.includes('*') ? globToRe(a).test(p) : p === a));
}

// `legit(p)` marks changes made during the run by the Founder/Main Lane through their own channels.
export function scopeViolations(before, after, allowed, ownPrefixes, legit = () => false) {
  const own = (p) => ownPrefixes.some((o) => p === o || p.startsWith(o));
  const out = [];
  for (const [p, sig] of after) {
    if (before.get(p) === sig || own(p) || pathAllowed(p, allowed) || legit(p)) continue;
    out.push(p);
  }
  for (const p of before.keys()) {
    if (!after.has(p) && !own(p) && !pathAllowed(p, allowed) && !legit(p)) out.push(p); // reverted/removed
  }
  return [...new Set(out)].sort();
}

// rev of every Status file, to tell state-library writes (rev bumped) from raw edits (rev unchanged).
function statusRevs(root) {
  const out = {};
  const dir = path.join(root, 'claude', 'packets');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('_Status.json') && !x.startsWith('.'))) {
    let rev = -1; // unreadable → never counts as a state-library write
    try { const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); rev = Number.isInteger(j.rev) ? j.rev : 1; } catch { /* corrupt */ }
    out[`claude/packets/${f}`] = rev;
  }
  return out;
}

// Founder-action files written during a run; never a worker scope violation.
const FOUNDER_ACTION_FILES = ['claude/factory/PAUSE.json'];

function detectQuota(files) {
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      if (f.endsWith('.err')) { if (QUOTA_RE.test(line)) return line.trim().slice(0, 300); continue; }
      let ev; try { ev = JSON.parse(line); } catch { continue; }
      const isErr = ev && (ev.is_error === true || ev.type === 'error' || ev.error);
      const text = JSON.stringify(ev.result ?? ev.error ?? ev.message ?? '');
      if (isErr && QUOTA_RE.test(text)) return text.slice(0, 300);
    }
  }
  return null;
}

const rel = (root, p) => path.relative(root, p).split(path.sep).join('/');

// Stale lease (expired, holder gone) → BLOCKED "interrupted run — no automatic rerun"; never relaunch.
export function handleStale(root, nowMs = Date.now(), log = console.log) {
  const ev = evaluate({ root, nowMs });
  const handled = [];
  for (const st of ev.stale) {
    const s = readStatus(st.id, { root });
    const runId = (st.lease && st.lease.run_id) || (s.run && s.run.run_id) || null;
    if (s.state === 'EXECUTING') {
      writeStatusFresh(st.id, (x) => {
        x.state = 'BLOCKED';
        x.lease = null;
        x.run = { ...(x.run || {}), ended: isoSec(nowMs), outcome: 'BLOCKED', blocked_reason: 'interrupted run — no automatic rerun' };
        x.updated = isoSec(nowMs); x.updated_by = 'dispatcher';
      }, { writer: 'dispatcher', root });
      const moved = retireLease(root, st.id, runId, 'lease.json');
      handled.push({ id: st.id, run_id: runId, action: 'BLOCKED', lease_moved_to: moved && rel(root, moved) });
      log(`stale lease: ${st.id} run ${runId} → BLOCKED (interrupted run — no automatic rerun)`);
    } else {
      handled.push({ id: st.id, run_id: runId, action: 'reported only', state: s.state });
      log(`stale lease: ${st.id} run ${runId} — state ${s.state}, left for the Main Lane`);
    }
  }
  if (handled.length) { try { project({ root, now: new Date(nowMs) }); } catch (e) { log(`project.mjs: ${e.message}`); } }
  return handled;
}

function buildArgs(cfg, s, sessionId) {
  const rp = s.run_profile;
  return ['-p', '--session-id', sessionId, '--model', cfg.model, '--output-format', 'stream-json', '--verbose',
    '--permission-mode', rp.permission_mode, '--permission-prompts', 'none',
    '--allowedTools', rp.allowed_tools.join(','), '--setting-sources', 'project'];
}

function buildPrompt(id, s) {
  return `Execute claude/packets/${s.task.file} under claude/packets/${s.control.file} (Control sha256 ${s.control.sha256}, Task sha256 ${s.task.sha256}). Founder Start Approval recorded in claude/packets/${id}_Status.json.\n`;
}

export async function runPacket(id, { root = repoRoot(), dryRun = false, env = process.env, log = console.log } = {}) {
  handleStale(root, Date.now(), log);
  // 1. eligibility
  const ev = evaluate({ root, forRun: true });
  if (!ev.eligible.includes(id)) {
    const why = (ev.ineligible.find((x) => x.id === id) || { reasons: ['no such November packet'] }).reasons;
    throw new RefusedError(`${id} is not eligible: ${why.join('; ')}`);
  }
  // Pilot: one worker at a time across all packets (keeps the post-run scope diff unambiguous).
  const leasesDirPath = path.join(factoryDir(root), 'leases');
  const others = fs.existsSync(leasesDirPath) ? fs.readdirSync(leasesDirPath).filter((f) => f.endsWith('.lease') && f !== `${id}.lease`) : [];
  if (others.length) throw new RefusedError(`another run holds a lease (${others.join(', ')}) — the pilot runs one worker at a time`);
  const cfg = readConfig(root, { required: true });
  // 2. binary
  const { bin, version } = resolveBinary(cfg, env);
  // 3. model — never invented or changed
  if (!cfg.model) throw new RefusedError('Founder has not recorded the model (choice 2b)');
  const s = readStatus(id, { root });
  const sessionId = crypto.randomUUID();
  const args = buildArgs(cfg, s, sessionId);
  const prompt = buildPrompt(id, s);
  if (dryRun) {
    log(JSON.stringify({ dry_run: true, id, bin, version, args, prompt: prompt.trim(), note: 'nothing written, no lease taken' }, null, 2));
    return { dryRun: true, args };
  }
  // 4. lease (O_EXCL)
  const started = new Date();
  const runId = `r-${started.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}-${crypto.randomBytes(2).toString('hex')}`;
  const expires = new Date(started.getTime() + cfg.lease_ttl_s * 1000);
  const lease = { run_id: runId, holder: 'dispatcher', pid: process.pid, acquired: isoSec(started), expires: isoSec(expires) };
  try { acquireLease(root, id, lease); } catch (e) { if (e instanceof LeaseError) throw new RefusedError(e.message); throw e; }
  const runDir = path.join(factoryDir(root), 'runs', runId);
  fs.mkdirSync(runDir, { recursive: true });
  const logFile = path.join(runDir, 'worker.jsonl');
  const errFile = path.join(runDir, 'worker.err');
  const runRec = { run_id: runId, session_id: sessionId, started: isoSec(started), log: rel(root, logFile) };
  let lastWritten;
  const record = (mutate, writer = 'dispatcher') => {
    const w = writeStatusFresh(id, (x) => { mutate(x); if (writer === 'dispatcher') { x.updated = isoSec(); x.updated_by = 'dispatcher'; } }, { writer, root });
    lastWritten = { rev: w.rev, hash: sha256File(statusPath(id, root)) };
    return w;
  };
  // 5. EXECUTING
  try {
    record((x) => { x.state = 'EXECUTING'; x.lease = lease; x.run = runRec; x.heartbeat = isoSec(started); });
  } catch (e) {
    retireLease(root, id, runId, 'lease.unused.json');
    throw e;
  }
  try { project({ root }); } catch (e) { log(`project.mjs: ${e.message}`); }
  const before = gitSnapshot(root);
  const revsBefore = statusRevs(root);
  // 6. launch — one attempt, no retry
  const outFd = fs.openSync(logFile, 'a');
  const errFd = fs.openSync(errFile, 'a');
  let interrupted = null;
  const child = spawn(bin, args, { cwd: root, stdio: ['pipe', outFd, errFd], env });
  child.stdin.on('error', () => {});
  child.stdin.end(prompt);
  const fwd = (sig) => { interrupted = sig; try { child.kill('SIGTERM'); } catch { /* gone */ } };
  process.once('SIGINT', fwd); process.once('SIGTERM', fwd);
  const hbMs = Number(env.FACTORY_HEARTBEAT_MS) || 30000;
  const hb = setInterval(() => {
    try {
      const m = fs.statSync(logFile).mtime;
      record((x) => { x.heartbeat = isoSec(m); });
    } catch { /* rev conflict or transient: skip this tick */ }
  }, hbMs);
  const { code, signal } = await new Promise((resolve) => {
    child.on('error', (e) => { fs.appendFileSync(errFile, `spawn error: ${e.message}\n`); resolve({ code: null, signal: null }); });
    child.on('exit', (c, sg) => resolve({ code: c, signal: sg }));
  });
  clearInterval(hb);
  process.removeListener('SIGINT', fwd); process.removeListener('SIGTERM', fwd);
  fs.closeSync(outFd); fs.closeSync(errFd);
  // 7. scope check + outcome
  const after = gitSnapshot(root);
  // Dispatcher-owned paths. The packet's Status file is checked separately below; the two generated
  // projections are excluded because they are regenerated from Status after every run anyway.
  const own = [`claude/factory/runs/${runId}/`, 'claude/factory/leases/', `claude/packets/${id}_Status.json`,
    'claude/packets/STATUS_BOARD.md', 'claude/factory/control-tower.html'];
  const revsAfter = statusRevs(root);
  // Another packet's Status written through the state library (rev bumped) is a Main Lane write, not the worker's.
  const legit = (p) => FOUNDER_ACTION_FILES.includes(p) || (p in revsBefore && p in revsAfter && revsAfter[p] > revsBefore[p]);
  const violations = scopeViolations(before, after, s.run_profile.allowed_write_paths, own, legit);
  const now = readStatus(id, { root });
  if (lastWritten && now.rev === lastWritten.rev && sha256File(statusPath(id, root)) !== lastWritten.hash) {
    violations.push(`claude/packets/${id}_Status.json (edited outside the state library)`);
  }
  const report = reportCandidates(root, id, s).find((p) => fs.existsSync(p)) || null;
  const quota = detectQuota([logFile, errFile]);
  let outcome; let reason = null; let reportSha = null;
  if (violations.length) { outcome = 'BLOCKED'; reason = `scope violation: ${violations.join(', ')}`; }
  else if (interrupted) { outcome = 'BLOCKED'; reason = `dispatcher interrupted (${interrupted})`; }
  else if (code === 0 && report) { outcome = 'REVIEW_NEEDED'; reportSha = sha256File(report); }
  else if (code !== 0) { outcome = 'BLOCKED'; reason = `worker exit ${code === null ? 'none' : code}${signal ? ` (${signal})` : ''}${quota ? ' — usage/quota limit' : ''}`; }
  else { outcome = 'BLOCKED'; reason = `worker exited 0 without the report (${reportCandidates(root, id, s).map((p) => rel(root, p)).join(' or ')})`; }
  const ended = new Date();
  record((x) => {
    x.state = outcome; x.lease = null;
    x.run = { ...runRec, ended: isoSec(ended), exit_code: code, signal: signal || null, outcome,
      ...(reason ? { blocked_reason: reason } : {}), ...(reportSha ? { report_file: rel(root, report), report_sha256: reportSha } : {}) };
  });
  if (quota) {
    record((x) => { x.hold = { type: 'CAPACITY_HOLD', set_by: 'dispatcher', reason: `worker log: ${quota}`, at: isoSec(ended) }; }, 'dispatcher-hold');
  }
  const summary = { run_id: runId, packet: id, session_id: sessionId, bin, bin_version: version, model: cfg.model, started: isoSec(started), ended: isoSec(ended),
    exit_code: code, signal: signal || null, outcome, blocked_reason: reason, report_sha256: reportSha, capacity_hold: !!quota, scope_violations: violations };
  fs.writeFileSync(path.join(runDir, 'run.json'), JSON.stringify(summary, null, 2) + '\n');
  // 8. lease → run folder (rename, no delete)
  retireLease(root, id, runId, 'lease.json');
  try { project({ root }); } catch (e) { log(`project.mjs: ${e.message}`); }
  log(`${id} run ${runId}: ${outcome}${reason ? ` — ${reason}` : ''}${quota ? ' · CAPACITY_HOLD set' : ''}`);
  return summary;
}

export function statusLines(root = repoRoot()) {
  return listStatus('MA-NOV-', { root }).map(({ id, status: s }) =>
    `${id.padEnd(22)} ${String(s.state).padEnd(16)} lease:${s.lease ? s.lease.run_id : '-'} hb:${s.heartbeat || '-'} hold:${s.hold ? s.hold.type : '-'}`);
}

async function main(argv) {
  const root = repoRoot();
  const [cmd, id, ...rest] = argv;
  if (cmd === 'check') {
    const handled = handleStale(root, Date.now(), (m) => console.error(m));
    const ev = evaluate({ root });
    console.log(JSON.stringify({ eligible: ev.eligible, ineligible: ev.ineligible, warnings: ev.warnings, stale_handled: handled,
      pause: ev.pause, capacity_hold: ev.capacity_hold }, null, 2));
    return 0;
  }
  if (cmd === 'status') { for (const l of statusLines(root)) console.log(l); return 0; }
  if (cmd === 'run' && id) {
    try {
      const r = await runPacket(id, { root, dryRun: rest.includes('--dry-run') || id === '--dry-run' });
      if (r.dryRun) return 0;
      return r.outcome === 'REVIEW_NEEDED' ? 0 : 3;
    } catch (e) {
      if (e instanceof RefusedError) { console.error(`refused: ${e.message}`); return 2; }
      throw e;
    }
  }
  console.error('usage: dispatch.mjs check | status | run <ID> [--dry-run]');
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error(`dispatch.mjs: ${e.stack || e.message}`); process.exit(1); });
}
