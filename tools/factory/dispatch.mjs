#!/usr/bin/env node
// Dispatcher (MA-NOV-P1.BUILD Task §5; interactive mode MA-NOV-P1.FIX). Node built-ins only.
//   node tools/factory/dispatch.mjs check            eligibility (§3) + running leases as JSON; handles stale leases; exit 0
//   node tools/factory/dispatch.mjs status           one line per November packet
//   node tools/factory/dispatch.mjs begin <ID>       interactive run: lease + EXECUTING + before.json (Founder choice B)
//   node tools/factory/dispatch.mjs end <ID>         interactive run: scope check → REVIEW_NEEDED | BLOCKED
//   node tools/factory/dispatch.mjs run <ID> [--dry-run]   headless run (kept for later; needs a signed-in worker)
// exit codes: 0 begun / finished → REVIEW_NEEDED · 2 refused (nothing changed) · 3 finished → BLOCKED · 1 internal error.
// One bounded run at a time, no retries, never relaunches an interrupted run.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { repoRoot, factoryDir, sha256File, isoSec, readConfig } from './lib/util.mjs';
import { readStatus, writeStatusFresh, listStatus, statusPath, TRANSITIONS_FILE } from './lib/state.mjs';
import { evaluate, reportCandidates } from './lib/eligibility.mjs';
import { acquireLease, retireLease, readLeaseFile, leaseState, LeaseError, pidAlive,
  acquireGlobalLock, retireGlobalLock, readGlobalLock, globalLockPath } from './lib/lease.mjs';
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
// F1: `committed` = paths changed by commits made during the run. `committedUnchanged(p)` is true when a path that
// was already dirty at the start was committed byte-for-byte as it was (allowed only when the packet may commit) —
// e.g. pinned Main Lane files the Task tells the run to commit. Any other committed path outside scope is a violation.
export function scopeViolations(before, after, allowed, ownPrefixes, legit = () => false, { committed = [], committedUnchanged = () => false } = {}) {
  const own = (p) => ownPrefixes.some((o) => p === o || p.startsWith(o));
  const skip = (p) => own(p) || pathAllowed(p, allowed) || legit(p);
  const out = [];
  for (const [p, sig] of after) {
    if (before.get(p) === sig || skip(p)) continue;
    out.push(p);
  }
  for (const p of before.keys()) {
    if (!after.has(p) && !skip(p) && !committedUnchanged(p)) out.push(p); // reverted/removed/committed changed
  }
  for (const p of committed) {
    if (skip(p)) continue;
    if (before.has(p) && committedUnchanged(p)) continue;
    out.push(p);
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

// Files written during a run by the Founder (PAUSE.json) or by the state library itself (transitions.jsonl,
// MA-NOV-P1.FIX2 F10); never a worker scope violation.
const FOUNDER_ACTION_FILES = ['claude/factory/PAUSE.json', TRANSITIONS_FILE];
// In-flight atomic-write temp files of the state library (.<file>.<pid>.<hex>.tmp) and the generator
// (.<file>.<pid>.tmp). A concurrent Main Lane write can be caught mid-rename by one git snapshot and not the other.
// F7: accepted only when <file> is an existing *_Status.json or STATUS_BOARD.md in claude/packets/, or
// control-tower.html in claude/factory/ — any other dotfile .tmp is checked like every other path.
const ATOMIC_TMP_RE = /^claude\/(packets|factory)\/\.([^/]+)\.\d+(\.[0-9a-f]+)?\.tmp$/;
export function isAtomicTemp(root, p) {
  const m = ATOMIC_TMP_RE.exec(p);
  if (!m) return false;
  const [, dir, base] = m;
  const ok = dir === 'packets' ? (base.endsWith('_Status.json') || base === 'STATUS_BOARD.md') : base === 'control-tower.html';
  return ok && fs.existsSync(path.join(root, 'claude', dir, base));
}

// Commit awareness (F1). HEAD at start is recorded; at the end, paths changed by new commits join the scope check.
function gitHead(root) {
  const r = spawnSync('git', ['--no-optional-locks', 'rev-parse', '--verify', '-q', 'HEAD'], { cwd: root, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}
function commitCheck(root, startHead, allowCommits) {
  if (!startHead) return { available: false, moved: false, head: gitHead(root), paths: [], problems: [] };
  const head = gitHead(root);
  if (head === startHead) return { available: true, moved: false, head, paths: [], problems: [] };
  const problems = [];
  if (allowCommits !== true) problems.push('commits not allowed for this packet');
  const anc = head ? spawnSync('git', ['--no-optional-locks', 'merge-base', '--is-ancestor', startHead, head], { cwd: root }) : { status: 1 };
  if (anc.status !== 0) problems.push('HEAD is not a descendant of the start commit');
  // G1 (FIX3): union of the net diff and every commit's own paths, so a file added then removed is still checked.
  const git = (...a) => (head ? spawnSync('git', ['--no-optional-locks', ...a], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }) : null);
  const d = git('diff', '--no-renames', '--name-only', '-z', `${startHead}..${head}`);
  // Not a descendant → already BLOCKED; the log range would then list unrelated history, so only the net diff is used.
  const l = anc.status === 0 ? git('log', '--no-renames', '--format=', '--name-only', '-z', `${startHead}..${head}`) : { status: 0, stdout: '' };
  if (!d || d.status !== 0 || !l || l.status !== 0) problems.push('git diff/log of the run\'s commits failed — scope check incomplete');
  const split = (r) => (r && r.status === 0 ? r.stdout.split(/[\0\n]/).filter(Boolean) : []);
  const paths = [...new Set([...split(d), ...split(l)])].sort();
  return { available: true, moved: true, head, paths, problems };
}

// G2 (FIX3): every ref, as "<refname> → <sha>".
export function refSnapshot(root) {
  const r = spawnSync('git', ['--no-optional-locks', 'for-each-ref', '--format=%(refname) %(objectname)'], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) return null;
  return Object.fromEntries(r.stdout.split('\n').filter(Boolean).map((x) => x.split(' ')));
}
function currentBranchRef(root) {
  const r = spawnSync('git', ['--no-optional-locks', 'symbolic-ref', '-q', 'HEAD'], { cwd: root, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}
// Changed, new or removed refs other than the current branch (and its origin tracking ref when commits are allowed).
export function refChanges(root, before, allowCommits) {
  const after = refSnapshot(root) || {};
  const branch = currentBranchRef(root);
  const skip = new Set(branch ? [branch] : []);
  if (branch && allowCommits) skip.add(`refs/remotes/origin/${branch.replace(/^refs\/heads\//, '')}`);
  const names = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return names.filter((n) => !skip.has(n) && before[n] !== after[n]);
}

// G5 (FIX3): size + SHA-256 of the transitions log; at the end the old bytes must be an unchanged prefix.
export function transitionsMark(root) {
  const f = path.join(root, ...TRANSITIONS_FILE.split('/'));
  const buf = fs.existsSync(f) ? fs.readFileSync(f) : Buffer.alloc(0);
  return { size: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex') };
}
export function transitionsRewritten(root, mark) {
  const f = path.join(root, ...TRANSITIONS_FILE.split('/'));
  const buf = fs.existsSync(f) ? fs.readFileSync(f) : Buffer.alloc(0);
  if (buf.length < mark.size) return true;
  return crypto.createHash('sha256').update(buf.subarray(0, mark.size)).digest('hex') !== mark.sha256;
}
// Content hash of a path as committed at HEAD ('gone' if absent there).
function headBlobHash(root, p) {
  const r = spawnSync('git', ['--no-optional-locks', 'show', `HEAD:${p}`], { cwd: root, maxBuffer: 256 * 1024 * 1024 });
  return r.status === 0 ? crypto.createHash('sha256').update(r.stdout).digest('hex') : 'gone';
}
const sigHash = (sig) => (sig ? sig.slice(3) : null); // "<XY>:<hash>" → hash

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
      retireGlobalLock(root, runId);
      handled.push({ id: st.id, run_id: runId, action: 'BLOCKED', lease_moved_to: moved && rel(root, moved) });
      log(`stale lease: ${st.id} run ${runId} → BLOCKED (interrupted run — no automatic rerun)`);
    } else {
      handled.push({ id: st.id, run_id: runId, action: 'reported only', state: s.state });
      log(`stale lease: ${st.id} run ${runId} — state ${s.state}, left for the Main Lane`);
    }
  }
  // Orphan global lock: expired, holder gone, and no packet lease of the same run left (e.g. a crash between
  // taking the global lock and the per-packet lease). Renamed into the run folder, never deleted.
  const g = readGlobalLock(root);
  if (g) {
    const own = g.packet ? readLeaseFile(root, g.packet) : null;
    // G3 (FIX3): an unparsable lock may be one being written right now — retire it only once its mtime is > 60 s old.
    let mtimeMs = nowMs; try { mtimeMs = fs.statSync(globalLockPath(root)).mtimeMs; } catch { /* gone meanwhile */ }
    const gone = g.corrupt ? nowMs - mtimeMs > 60000 : (Date.parse(g.expires) <= nowMs && !pidAlive(g.pid));
    if (gone && !(own && own.run_id === g.run_id)) {
      const moved = retireGlobalLock(root, g.run_id, 'global.lock.json', { force: true });
      handled.push({ id: g.packet || null, run_id: g.run_id || null, action: 'orphan global lock retired', lock_moved_to: moved && rel(root, moved) });
      log(`stale global lock: run ${g.run_id} (${g.packet}) retired`);
    }
  }
  if (handled.length) { try { project({ root, now: new Date(nowMs) }); } catch (e) { log(`project.mjs: ${e.message}`); } }
  return handled;
}

function buildArgs(cfg, s, sessionId) {
  const rp = s.run_profile;
  const tools = rp.allowed_tools.join(',');
  // --tools limits which tools exist at all; --allowedTools only pre-approves them (P1.DEMO finding: Bash,
  // WebSearch and Task were still visible with --allowedTools alone). Both are passed.
  return ['-p', '--session-id', sessionId, '--model', cfg.model, '--output-format', 'stream-json', '--verbose',
    '--permission-mode', rp.permission_mode, '--permission-prompts', 'none',
    '--tools', tools, '--allowedTools', tools, '--setting-sources', 'project'];
}

function buildPrompt(id, s) {
  return `Execute claude/packets/${s.task.file} under claude/packets/${s.control.file} (Control sha256 ${s.control.sha256}, Task sha256 ${s.task.sha256}). Founder Start Approval recorded in claude/packets/${id}_Status.json.\n`;
}

// Sign-in failure, as seen in P1.DEMO run r-20261107T092212Z-c0da: an event with "error":"authentication_failed"
// and a result "Not logged in · Please run /login". Classified as BLOCKED "worker not signed in" — no hold, no retry.
const SIGNIN_RE = /not logged in|please run \/login|authentication_failed/i;
export function detectSignin(files) {
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      if (f.endsWith('.err')) { if (SIGNIN_RE.test(line)) return true; continue; }
      let ev; try { ev = JSON.parse(line); } catch { continue; }
      if (ev && ev.error === 'authentication_failed') return true;
      if (ev && ev.type === 'result' && ev.is_error && /not logged in/i.test(String(ev.result))) return true;
    }
  }
  return false;
}

const newRunId = (d) => `r-${d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}-${crypto.randomBytes(2).toString('hex')}`;

function refuseUnlessEligible(root, id, forRun) {
  const ev = evaluate({ root, forRun });
  if (!ev.eligible.includes(id)) {
    const why = (ev.ineligible.find((x) => x.id === id) || { reasons: ['no such November packet'] }).reasons;
    throw new RefusedError(`${id} is not eligible: ${why.join('; ')}`);
  }
}

// Pilot: one run at a time across all packets (keeps the scope diff unambiguous).
function refuseIfOtherLease(root, id) {
  const dir = path.join(factoryDir(root), 'leases');
  const others = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.lease') && f !== `${id}.lease`) : [];
  if (others.length) throw new RefusedError(`another run holds a lease (${others.join(', ')}) — the pilot runs one at a time`);
}

// F2: global O_EXCL lock first, then the directory read below, then the per-packet lease. On any failure after the
// global lock is taken it is renamed into the run folder as global.lock.unused.json.
function takeGlobalLock(root, id, info) {
  try { acquireGlobalLock(root, { packet: id, ...info }); } catch (e) { if (e instanceof LeaseError) throw new RefusedError(e.message); throw e; }
  try { refuseIfOtherLease(root, id); } catch (e) { retireGlobalLock(root, info.run_id, 'global.lock.unused.json'); throw e; }
}
function takeLease(root, id, lease) {
  try { acquireLease(root, id, lease); } catch (e) {
    retireGlobalLock(root, lease.run_id, 'global.lock.unused.json');
    if (e instanceof LeaseError) throw new RefusedError(e.message);
    throw e;
  }
}
const envSession = (env = process.env) => env.CLAUDE_CODE_SESSION_ID || null;

function statusMark(root, id) {
  return { rev: readStatus(id, { root }).rev, hash: sha256File(statusPath(id, root)) };
}

// Shared step 7 for `run` and `end`: scope check → outcome → Status → run.json → lease to run folder → regenerate.
// `decide({violations, report})` returns {outcome, reason}.
function finishRun({ root, id, s, runId, runRec, before, revsBefore, mark, decide, quota = null, summaryExtra = {}, log,
  startHead, strictOwn = false, refsBefore = null, transBefore = null }) {
  const after = gitSnapshot(root);
  const allowCommits = !!(s.run_profile && s.run_profile.allow_commits === true);
  const commits = commitCheck(root, startHead, allowCommits);
  const refsChanged = refsBefore ? refChanges(root, refsBefore, allowCommits) : [];
  const transRewritten = transBefore ? transitionsRewritten(root, transBefore) : false;
  // Dispatcher-owned paths. The packet's Status file is checked separately below; the two generated
  // projections are excluded because they are regenerated from Status after every run anyway.
  const own = [`claude/factory/runs/${runId}/`, 'claude/factory/leases/', `claude/packets/${id}_Status.json`,
    'claude/packets/STATUS_BOARD.md', 'claude/factory/control-tower.html'];
  const revsAfter = statusRevs(root);
  // Another packet's Status written through the state library (rev bumped) is a Main Lane write, not the worker's.
  const ignoredTemp = [];
  const temp = (p) => { if (isAtomicTemp(root, p)) { ignoredTemp.push(p); return true; } return false; };
  const legit = (p) => FOUNDER_ACTION_FILES.includes(p) || temp(p) || (p in revsBefore && p in revsAfter && revsAfter[p] > revsBefore[p]);
  const allowed = (s.run_profile && s.run_profile.allowed_write_paths) || [];
  const committedPreexisting = [];
  const committedUnchanged = (p) => {
    if (!allowCommits || !before || !before.has(p) || after.has(p)) return false;
    const same = sigHash(before.get(p)) === headBlobHash(root, p);
    if (same) committedPreexisting.push(p);
    return same;
  };
  const violations = before ? scopeViolations(before, after, allowed, own, legit, { committed: commits.paths, committedUnchanged }) : [];
  const problems = [...commits.problems, ...refsChanged.map((r) => `ref changed: ${r}`), ...(transRewritten ? ['transitions log rewritten'] : [])];
  const curRev = readStatus(id, { root }).rev;
  if (mark && curRev === mark.rev && sha256File(statusPath(id, root)) !== mark.hash) {
    violations.push(`claude/packets/${id}_Status.json (edited outside the state library)`);
  } else if (mark && strictOwn && curRev !== mark.rev) {
    // F6: in interactive mode the dispatcher writes nothing between begin and end, so any rev change is foreign.
    problems.push(`own Status changed during run (rev ${mark.rev}→${curRev})`);
  }
  const otherStatusChanges = Object.keys(revsAfter).filter((p) => p !== `claude/packets/${id}_Status.json` && p in revsBefore && revsAfter[p] !== revsBefore[p])
    .map((p) => ({ path: p, rev_from: revsBefore[p], rev_to: revsAfter[p] }));
  const report = reportCandidates(root, id, s).find((p) => fs.existsSync(p)) || null;
  const { outcome, reason } = decide({ violations, report, problems });
  const reportSha = outcome === 'REVIEW_NEEDED' && report ? sha256File(report) : null;
  const ended = new Date();
  writeStatusFresh(id, (x) => {
    x.state = outcome; x.lease = null;
    x.run = { ...runRec, ...(summaryExtra.run || {}), ended: isoSec(ended), outcome,
      ...(reason ? { blocked_reason: reason } : {}), ...(reportSha ? { report_file: rel(root, report), report_sha256: reportSha } : {}) };
    x.updated = isoSec(ended); x.updated_by = 'dispatcher';
  }, { writer: 'dispatcher', root });
  if (quota) {
    writeStatusFresh(id, (x) => { x.hold = { type: 'CAPACITY_HOLD', set_by: 'dispatcher', reason: `worker log: ${quota}`, at: isoSec(ended) }; }, { writer: 'dispatcher-hold', root });
  }
  const summary = { run_id: runId, packet: id, mode: runRec.mode, ...(summaryExtra.summary || {}), started: runRec.started, ended: isoSec(ended),
    outcome, blocked_reason: reason, report_sha256: reportSha, capacity_hold: !!quota, scope_violations: violations,
    start_head: startHead || null, end_head: commits.head,
    commit_check: commits.available ? (commits.moved ? 'commits checked' : 'no commits') : 'unavailable — no start HEAD recorded (run begun by pre-FIX2 code)',
    ref_check: refsBefore ? (refsChanged.length ? 'refs changed' : 'checked') : 'unavailable', refs_changed: refsChanged,
    transitions_check: transBefore ? (transRewritten ? 'rewritten' : 'append-only') : 'unavailable',
    committed_paths: commits.paths, committed_preexisting_unchanged: [...new Set(committedPreexisting)].sort(),
    ignored_temp_files: [...new Set(ignoredTemp)].sort(), other_status_changes: otherStatusChanges };
  const runDir = path.join(factoryDir(root), 'runs', runId);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, 'run.json'), JSON.stringify(summary, null, 2) + '\n');
  retireLease(root, id, runId, 'lease.json'); // rename, no delete
  retireGlobalLock(root, runId);
  try { project({ root }); } catch (e) { log(`project.mjs: ${e.message}`); }
  return summary;
}

// ---- headless mode (kept for later; Founder chose interactive, sign-in option B) ----
export async function runPacket(id, { root = repoRoot(), dryRun = false, env = process.env, log = console.log } = {}) {
  handleStale(root, Date.now(), log);
  refuseUnlessEligible(root, id, 'headless');                     // 1. eligibility
  refuseIfOtherLease(root, id); // early read (dry-run too); the global lock below is the atomic check
  const cfg = readConfig(root, { required: true });
  const { bin, version } = resolveBinary(cfg, env);                // 2. binary
  if (!cfg.model) throw new RefusedError('Founder has not recorded the model (choice 2b)'); // 3. never invented
  const s = readStatus(id, { root });
  const sessionId = crypto.randomUUID();
  const args = buildArgs(cfg, s, sessionId);
  const prompt = buildPrompt(id, s);
  if (dryRun) {
    log(JSON.stringify({ dry_run: true, id, bin, version, args, prompt: prompt.trim(), note: 'nothing written, no lease taken' }, null, 2));
    return { dryRun: true, args };
  }
  const started = new Date();                                       // 4. lease (O_EXCL)
  const runId = newRunId(started);
  const lease = { run_id: runId, holder: 'dispatcher', mode: 'headless', pid: process.pid, acquired: isoSec(started),
    expires: isoSec(new Date(started.getTime() + cfg.lease_ttl_s * 1000)), session_id: sessionId };
  takeGlobalLock(root, id, { run_id: runId, mode: 'headless', pid: lease.pid, acquired: lease.acquired, expires: lease.expires, session_id: sessionId });
  takeLease(root, id, lease);
  const runDir = path.join(factoryDir(root), 'runs', runId);
  fs.mkdirSync(runDir, { recursive: true });
  const logFile = path.join(runDir, 'worker.jsonl');
  const errFile = path.join(runDir, 'worker.err');
  const runRec = { run_id: runId, mode: 'headless', session_id: sessionId, started: isoSec(started), log: rel(root, logFile) };
  let mark = null;
  const record = (mutate) => {
    writeStatusFresh(id, (x) => { mutate(x); x.updated = isoSec(); x.updated_by = 'dispatcher'; }, { writer: 'dispatcher', root });
    mark = statusMark(root, id);
  };
  try {                                                              // 5. EXECUTING
    record((x) => { x.state = 'EXECUTING'; x.lease = lease; x.run = runRec; x.heartbeat = isoSec(started); });
  } catch (e) {
    retireLease(root, id, runId, 'lease.unused.json');
    retireGlobalLock(root, runId, 'global.lock.unused.json');
    throw e;
  }
  try { project({ root }); } catch (e) { log(`project.mjs: ${e.message}`); }
  // revs first, then git: a Main Lane write landing between the two then shows as a rev bump (legit), not a raw edit.
  const revsBefore = statusRevs(root);
  const startHead = gitHead(root);
  const before = gitSnapshot(root);
  const refsBefore = refSnapshot(root);   // G2
  const transBefore = transitionsMark(root); // G5
  fs.writeFileSync(path.join(runDir, 'before.json'), JSON.stringify({ run_id: runId, packet: id, taken_at: isoSec(), session_id: sessionId,
    head: startHead, status_revs: revsBefore, refs: refsBefore, transitions: transBefore, entries: Object.fromEntries(before) }, null, 2) + '\n');
  const outFd = fs.openSync(logFile, 'a');                          // 6. launch — one attempt, no retry
  const errFd = fs.openSync(errFile, 'a');
  let interrupted = null;
  const child = spawn(bin, args, { cwd: root, stdio: ['pipe', outFd, errFd], env });
  child.stdin.on('error', () => {});
  child.stdin.end(prompt);
  const fwd = (sig) => { interrupted = sig; try { child.kill('SIGTERM'); } catch { /* gone */ } };
  process.once('SIGINT', fwd); process.once('SIGTERM', fwd);
  const hb = setInterval(() => {
    try { const m = fs.statSync(logFile).mtime; record((x) => { x.heartbeat = isoSec(m); }); } catch { /* rev conflict or transient: skip tick */ }
  }, Number(env.FACTORY_HEARTBEAT_MS) || 30000);
  const { code, signal } = await new Promise((resolve) => {
    child.on('error', (e) => { fs.appendFileSync(errFile, `spawn error: ${e.message}\n`); resolve({ code: null, signal: null }); });
    child.on('exit', (c, sg) => resolve({ code: c, signal: sg }));
  });
  clearInterval(hb);
  process.removeListener('SIGINT', fwd); process.removeListener('SIGTERM', fwd);
  fs.closeSync(outFd); fs.closeSync(errFd);
  const signin = detectSignin([logFile, errFile]);
  const quota = signin ? null : detectQuota([logFile, errFile]);
  const decide = ({ violations, report, problems }) => {           // 7. outcome
    if (violations.length || problems.length) {
      return { outcome: 'BLOCKED', reason: [...(violations.length ? [`scope violation: ${violations.join(', ')}`] : []), ...problems].join('; ') };
    }
    if (interrupted) return { outcome: 'BLOCKED', reason: `dispatcher interrupted (${interrupted})` };
    if (signin) return { outcome: 'BLOCKED', reason: 'worker not signed in' };
    if (code === 0 && report) return { outcome: 'REVIEW_NEEDED', reason: null };
    if (code !== 0) return { outcome: 'BLOCKED', reason: `worker exit ${code === null ? 'none' : code}${signal ? ` (${signal})` : ''}${quota ? ' — usage/quota limit' : ''}` };
    return { outcome: 'BLOCKED', reason: `worker exited 0 without the report (${reportCandidates(root, id, s).map((p) => rel(root, p)).join(' or ')})` };
  };
  const summary = finishRun({ root, id, s, runId, runRec, before, revsBefore, mark, decide, quota, log, startHead, refsBefore, transBefore,
    summaryExtra: { run: { exit_code: code, signal: signal || null }, summary: { session_id: sessionId, bin, bin_version: version, model: cfg.model, exit_code: code, signal: signal || null } } });
  log(`${id} run ${runId}: ${summary.outcome}${summary.blocked_reason ? ` — ${summary.blocked_reason}` : ''}${quota ? ' · CAPACITY_HOLD set' : ''}`);
  return summary;
}

// ---- interactive mode (Founder choice B): the session started by the fixed line brackets its own work ----
// Holder pid = the calling shell's parent (the interactive Claude Code process), else the shell itself.
function holderPid() {
  const r = spawnSync('ps', ['-o', 'ppid=', '-p', String(process.ppid)], { encoding: 'utf8' });
  const pid = parseInt((r.stdout || '').trim(), 10);
  return Number.isInteger(pid) && pid > 1 ? pid : process.ppid;
}

export function beginPacket(id, { root = repoRoot(), log = console.log, env = process.env } = {}) {
  handleStale(root, Date.now(), log);
  refuseUnlessEligible(root, id, 'interactive');
  const cfg = readConfig(root, { required: true });
  const started = new Date();
  const runId = newRunId(started);
  const sessionId = envSession(env); // F5: null when the variable is absent
  const lease = { run_id: runId, holder: 'interactive', mode: 'interactive', pid: holderPid(), acquired: isoSec(started),
    expires: isoSec(new Date(started.getTime() + cfg.lease_ttl_s * 1000)), session_id: sessionId };
  takeGlobalLock(root, id, { run_id: runId, mode: 'interactive', pid: lease.pid, acquired: lease.acquired, expires: lease.expires, session_id: sessionId });
  takeLease(root, id, lease);
  const runRec = { run_id: runId, mode: 'interactive', session_id: sessionId, started: isoSec(started) };
  try {
    writeStatusFresh(id, (x) => { x.state = 'EXECUTING'; x.lease = lease; x.run = runRec; x.heartbeat = null; x.updated = isoSec(started); x.updated_by = 'dispatcher'; },
      { writer: 'dispatcher', root });
  } catch (e) {
    retireLease(root, id, runId, 'lease.unused.json');
    retireGlobalLock(root, runId, 'global.lock.unused.json');
    throw e;
  }
  try { project({ root }); } catch (e) { log(`project.mjs: ${e.message}`); }
  const mark = statusMark(root, id);
  const revs = statusRevs(root); // revs before git (see runPacket)
  const head = gitHead(root);    // F1
  const before = { run_id: runId, packet: id, taken_at: isoSec(), session_id: sessionId, head, status_rev: mark.rev, status_sha256: mark.hash,
    status_revs: revs, refs: refSnapshot(root), transitions: transitionsMark(root), entries: Object.fromEntries(gitSnapshot(root)) };
  const runDir = path.join(factoryDir(root), 'runs', runId);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, 'before.json'), JSON.stringify(before, null, 2) + '\n');
  log(`BEGIN ${id} run ${runId} — work now; finish with: node tools/factory/dispatch.mjs end ${id}`);
  return { run_id: runId, lease };
}

export function endPacket(id, { root = repoRoot(), log = console.log, env = process.env } = {}) {
  const lease = readLeaseFile(root, id);
  if (!lease) throw new RefusedError(`no lease for ${id} — nothing to end (run begin first)`);
  if (lease.mode !== 'interactive') throw new RefusedError(`${id} lease is not interactive (${lease.mode || 'headless'} run) — end refused`);
  const s = readStatus(id, { root });
  if (s.state !== 'EXECUTING' || !s.run || s.run.run_id !== lease.run_id) {
    throw new RefusedError(`${id} Status (${s.state}, run ${s.run && s.run.run_id}) does not match lease run ${lease.run_id}`);
  }
  // F5/F9: only the session that began the run may end it (checked when both ids are known; nothing is written on refusal).
  const endedBy = envSession(env);
  const begunBy = lease.session_id || (s.run && s.run.session_id) || null;
  if (lease.session_id && !endedBy) throw new RefusedError('end needs the session that began the run'); // G4
  if (endedBy && begunBy && endedBy !== begunBy) {
    throw new RefusedError(`this run was begun by another session (begun by ${begunBy}, end called from ${endedBy}) — end refused`);
  }
  const runId = lease.run_id;
  const expired = leaseState(lease) !== 'live';
  const beforeFile = path.join(factoryDir(root), 'runs', runId, 'before.json');
  const b = fs.existsSync(beforeFile) ? JSON.parse(fs.readFileSync(beforeFile, 'utf8')) : null;
  const decide = ({ violations, report, problems }) => {
    const parts = [];
    if (!b) parts.push('before.json missing — scope check impossible');
    if (violations.length) parts.push(`scope violation: ${violations.join(', ')}`);
    parts.push(...problems);
    if (expired) parts.push('lease expired before end — Main Lane to confirm');
    if (parts.length) return { outcome: 'BLOCKED', reason: parts.join('; ') };
    if (report) return { outcome: 'REVIEW_NEEDED', reason: null };
    return { outcome: 'BLOCKED', reason: `no report (expected ${reportCandidates(root, id, s).map((p) => rel(root, p)).join(' or ')})` };
  };
  const summary = finishRun({ root, id, s, runId, runRec: { ...s.run, ended_by_session: endedBy },
    before: b ? new Map(Object.entries(b.entries)) : null, revsBefore: b ? b.status_revs : {},
    mark: b ? { rev: b.status_rev, hash: b.status_sha256 } : null, decide, log, startHead: b ? b.head : null, strictOwn: true,
    refsBefore: (b && b.refs) || null, transBefore: (b && b.transitions) || null,
    summaryExtra: { summary: { holder: lease.holder, holder_pid: lease.pid, lease_expires: lease.expires, lease_expired: expired,
      session_id: begunBy, ended_by_session: endedBy } } });
  log(`END ${id} run ${runId}: ${summary.outcome}${summary.blocked_reason ? ` — ${summary.blocked_reason}` : ''}${summary.report_sha256 ? ` · report ${summary.report_sha256}` : ''}`);
  return summary;
}

// Live leases = running (interactive runs have no heartbeat; their lease expiry is shown instead).
export function running(root = repoRoot(), nowMs = Date.now()) {
  return listStatus('MA-NOV-', { root }).map(({ id, status: s }) => ({ id, s, l: readLeaseFile(root, id) || s.lease }))
    .filter((x) => x.l && leaseState(x.l, nowMs) !== 'stale')
    .map(({ id, l }) => ({ id, mode: l.mode || 'headless', holder: l.holder, run_id: l.run_id, started: l.acquired, expires: l.expires, lease_state: leaseState(l, nowMs) }));
}

export function statusLines(root = repoRoot()) {
  const run = Object.fromEntries(running(root).map((r) => [r.id, r]));
  return listStatus('MA-NOV-', { root }).map(({ id, status: s }) => {
    const r = run[id];
    const live = r ? (r.mode === 'interactive'
      ? `running:interactive ${r.run_id} holder:${r.holder} expires:${r.expires}${r.lease_state === 'live' ? '' : ' (EXPIRED)'}`
      : `running:headless ${r.run_id} hb:${s.heartbeat || '-'} expires:${r.expires}`) : 'lease:-';
    return `${id.padEnd(22)} ${String(s.state).padEnd(16)} ${live} hold:${s.hold ? s.hold.type : '-'}`;
  });
}

async function main(argv) {
  const root = repoRoot();
  const [cmd, id, ...rest] = argv;
  const guard = async (fn, okCode = (r) => 0) => {
    try { return okCode(await fn()); } catch (e) {
      if (e instanceof RefusedError) { console.error(`refused: ${e.message}`); return 2; }
      throw e;
    }
  };
  if (cmd === 'check') {
    const handled = handleStale(root, Date.now(), (m) => console.error(m));
    const ev = evaluate({ root });
    console.log(JSON.stringify({ eligible: ev.eligible, ineligible: ev.ineligible, running: running(root), warnings: ev.warnings, stale_handled: handled,
      pause: ev.pause, capacity_hold: ev.capacity_hold }, null, 2));
    return 0;
  }
  if (cmd === 'status') { for (const l of statusLines(root)) console.log(l); return 0; }
  if (cmd === 'run' && id) {
    return guard(() => runPacket(id, { root, dryRun: rest.includes('--dry-run') || id === '--dry-run' }),
      (r) => (r.dryRun ? 0 : r.outcome === 'REVIEW_NEEDED' ? 0 : 3));
  }
  if (cmd === 'begin' && id) return guard(() => beginPacket(id, { root }));
  if (cmd === 'end' && id) return guard(() => endPacket(id, { root }), (r) => (r.outcome === 'REVIEW_NEEDED' ? 0 : 3));
  console.error('usage: dispatch.mjs check | status | begin <ID> | end <ID> | run <ID> [--dry-run]');
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error(`dispatch.mjs: ${e.stack || e.message}`); process.exit(1); });
}
