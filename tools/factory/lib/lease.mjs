// O_EXCL lease files: claude/factory/leases/<ID>.lease. Creation with 'wx' is atomic on local APFS,
// so two dispatchers racing for one packet cannot both win.
import fs from 'node:fs';
import path from 'node:path';
import { factoryDir } from './util.mjs';

export class LeaseError extends Error { constructor(m) { super(m); this.name = 'LeaseError'; } }

export function leasesDir(root) { return path.join(factoryDir(root), 'leases'); }
export function leasePath(root, id) { return path.join(leasesDir(root), `${id}.lease`); }

export function acquireLease(root, id, lease) {
  fs.mkdirSync(leasesDir(root), { recursive: true });
  let fd;
  try {
    fd = fs.openSync(leasePath(root, id), 'wx');
  } catch (e) {
    if (e.code === 'EEXIST') throw new LeaseError(`duplicate launch refused: lease already exists for ${id}`);
    throw e;
  }
  try { fs.writeSync(fd, JSON.stringify(lease, null, 2) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  return lease;
}

export function readLeaseFile(root, id) {
  const p = leasePath(root, id);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return { corrupt: true }; }
}

export function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

// 'live' (not expired) | 'expired-alive' (past expiry, holder still running) | 'stale' (past expiry, holder gone)
export function leaseState(lease, nowMs = Date.now()) {
  if (!lease) return null;
  if (lease.corrupt) return 'stale';
  const exp = Date.parse(lease.expires);
  if (!(exp <= nowMs)) return 'live';
  return pidAlive(lease.pid) ? 'expired-alive' : 'stale';
}

// Move a lease into the run folder (rename, never delete).
export function retireLease(root, id, runId, name = 'lease.json') {
  const src = leasePath(root, id);
  if (!fs.existsSync(src)) return null;
  const dir = path.join(factoryDir(root), 'runs', runId || `unknown-${id}`);
  fs.mkdirSync(dir, { recursive: true });
  const dst = path.join(dir, name);
  fs.renameSync(src, dst);
  return dst;
}
