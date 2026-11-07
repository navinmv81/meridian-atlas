// Status-JSON state library (MA-NOV-P1.BUILD Task §2).
// One state system: claude/packets/<ID>_Status.json. Every write is a compare-and-swap on `rev`
// through a temp file in the same folder followed by rename(2), so a crash never leaves a torn file.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { repoRoot, packetsDir, stableStringify } from './util.mjs';

export class OwnershipError extends Error { constructor(m) { super(m); this.name = 'OwnershipError'; } }
export class TransitionError extends Error { constructor(m) { super(m); this.name = 'TransitionError'; } }
export class RevConflictError extends Error { constructor(m) { super(m); this.name = 'RevConflictError'; } }

export const STATES = ['DRAFT', 'READY', 'EXECUTING', 'REVIEW_NEEDED', 'CHANGES_REQUESTED', 'DECISION_NEEDED',
  'APPROVED', 'CLOSED', 'BLOCKED', 'PAUSED', 'CAPACITY_HOLD'];

const TRANSITIONS = {
  DRAFT: ['READY'],
  READY: ['EXECUTING', 'BLOCKED', 'PAUSED', 'CAPACITY_HOLD'],
  EXECUTING: ['REVIEW_NEEDED', 'BLOCKED'],
  REVIEW_NEEDED: ['CHANGES_REQUESTED', 'DECISION_NEEDED', 'APPROVED'],
  CHANGES_REQUESTED: ['READY'],
  DECISION_NEEDED: ['APPROVED', 'CHANGES_REQUESTED', 'BLOCKED'],
  APPROVED: ['CLOSED'],
  CLOSED: [],
};
const HELD_STATES = ['BLOCKED', 'PAUSED', 'CAPACITY_HOLD'];

// Field ownership (MA-NOV-000 §Q6.1, Founder choice 4) — applies to MA-NOV-* packets.
export const WRITERS = ['dispatcher', 'dispatcher-hold', 'main-lane'];
const DISPATCHER_FIELDS = new Set(['lease', 'heartbeat', 'run', 'updated', 'updated_by', 'state']);
const DISPATCHER_TRANSITIONS = new Set(['READY>EXECUTING', 'EXECUTING>REVIEW_NEEDED', 'EXECUTING>BLOCKED']);
// Documented exception (README): the dispatcher's capacity-hold path may write `hold` and nothing else.
const DISPATCHER_HOLD_FIELDS = new Set(['hold']);

export function allowedNext(cur) {
  const from = cur.state;
  if (HELD_STATES.includes(from)) return [(cur.hold && cur.hold.resume_state) || 'READY'];
  return TRANSITIONS[from] || [];
}

export function checkTransition(cur, toState) {
  const from = cur.state;
  if (from === toState) return;
  if (!STATES.includes(toState)) throw new TransitionError(`unknown state ${toState}`);
  if (!allowedNext(cur).includes(toState)) throw new TransitionError(`transition ${from} -> ${toState} not allowed`);
}

export function statusPath(id, root = repoRoot()) {
  return path.join(packetsDir(root), `${id}_Status.json`);
}

export function readStatus(id, { root = repoRoot() } = {}) {
  return JSON.parse(fs.readFileSync(statusPath(id, root), 'utf8'));
}

// All Status files whose packet id starts with `prefix`, sorted by id. Temp files are ignored.
export function listStatus(prefix = '', { root = repoRoot() } = {}) {
  const dir = packetsDir(root);
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('_Status.json') && !f.startsWith('.') && f.startsWith(prefix))
    .sort()
    .map((f) => {
      const s = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      return { id: f.slice(0, -'_Status.json'.length), status: s };
    });
}

function changedKeys(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  keys.delete('rev');
  return [...keys].filter((k) => stableStringify(a[k]) !== stableStringify(b[k]));
}

function checkOwnership(id, writer, cur, next) {
  if (!WRITERS.includes(writer)) throw new OwnershipError(`unknown writer "${writer}"`);
  if (!id.startsWith('MA-NOV-') || writer === 'main-lane') return;
  const changed = changedKeys(cur, next);
  const allowed = writer === 'dispatcher' ? DISPATCHER_FIELDS : DISPATCHER_HOLD_FIELDS;
  const bad = changed.filter((k) => !allowed.has(k));
  if (bad.length) throw new OwnershipError(`${writer} may not change: ${bad.join(', ')}`);
  if (writer === 'dispatcher' && cur.state !== next.state && !DISPATCHER_TRANSITIONS.has(`${cur.state}>${next.state}`)) {
    throw new OwnershipError(`dispatcher may not move ${cur.state} -> ${next.state}`);
  }
}

// read → check rev === expectRev → mutate → ownership + transition checks → rev+1 → temp write → rename.
// Returns the written object. Throws (and writes nothing) on any check failure.
export function writeStatus(id, mutate, { writer, expectRev, root = repoRoot(), _crashBeforeRename = false } = {}) {
  const file = statusPath(id, root);
  const cur = JSON.parse(fs.readFileSync(file, 'utf8'));
  const curRev = Number.isInteger(cur.rev) ? cur.rev : 1;
  if (expectRev !== curRev) throw new RevConflictError(`${id}: expected rev ${expectRev}, found ${curRev}`);
  const draft = structuredClone(cur);
  const returned = mutate(draft);
  const next = returned && typeof returned === 'object' ? returned : draft;
  checkOwnership(id, writer, cur, next);
  if (next.state !== cur.state) checkTransition(cur, next.state);
  next.rev = curRev + 1;
  const data = JSON.stringify(next, null, 2) + '\n';
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`);
  const fd = fs.openSync(tmp, 'wx');
  try { fs.writeSync(fd, data); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  if (_crashBeforeRename) process.kill(process.pid, 'SIGKILL'); // test 8 only: simulate a crash here
  fs.renameSync(tmp, file);
  return next;
}

// Convenience: write against the rev currently on disk.
export function writeStatusFresh(id, mutate, opts = {}) {
  const root = opts.root || repoRoot();
  const cur = readStatus(id, { root });
  return writeStatus(id, mutate, { ...opts, root, expectRev: Number.isInteger(cur.rev) ? cur.rev : 1 });
}
