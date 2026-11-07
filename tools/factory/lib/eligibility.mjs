// Eligibility (MA-NOV-P1.BUILD Task §3): LANE_OPENER.md step 3, plus lease, pause, hold and run_profile.
import fs from 'node:fs';
import path from 'node:path';
import { packetsDir, sha256File, readPause } from './util.mjs';
import { listStatus } from './state.mjs';
import { readLeaseFile, leaseState } from './lease.mjs';

// Report paths a packet may produce: Status report.file, <ID>_Report.md, and any
// claude/packets/<ID>…_Report.md the Control names.
export function reportCandidates(root, id, status) {
  const dir = packetsDir(root);
  const out = new Set();
  if (status.report && status.report.file) out.add(path.join(dir, path.basename(status.report.file)));
  out.add(path.join(dir, `${id}_Report.md`));
  const cfile = status.control && status.control.file && path.join(dir, status.control.file);
  if (cfile && fs.existsSync(cfile)) {
    const text = fs.readFileSync(cfile, 'utf8');
    for (const m of text.matchAll(/claude\/packets\/([A-Za-z0-9._-]+_Report\.md)/g)) {
      if (m[1].startsWith(id)) out.add(path.join(dir, m[1]));
    }
  }
  return [...out];
}

// The global capacity hold: any packet carrying hold.type CAPACITY_HOLD blocks every launch (§Q7).
export function capacityHold(packets) {
  for (const { id, status } of packets) {
    if (status.hold && status.hold.type === 'CAPACITY_HOLD') return { id, ...status.hold };
  }
  return null;
}

function diskHash(root, file) {
  const p = path.join(packetsDir(root), file || '');
  if (!file || !fs.existsSync(p)) return null;
  return sha256File(p);
}

export function packetLease(root, id, status, nowMs) {
  const file = readLeaseFile(root, id);
  const lease = file || status.lease || null;
  if (!lease) return null;
  return { source: file ? 'file' : 'status', lease, state: leaseState(lease, nowMs) };
}

export function evaluate({ root, nowMs = Date.now(), forRun = false, prefix = 'MA-NOV-' }) {
  const packets = listStatus(prefix, { root });
  const pause = readPause(root);
  const cap = capacityHold(packets);
  const eligible = [];
  const ineligible = [];
  const stale = [];
  const warnings = {};
  for (const { id, status: s } of packets) {
    const reasons = [];
    if (s.state !== 'READY') reasons.push(`state ${s.state}`);
    const a = s.start_approval;
    if (!a) reasons.push('no Founder start approval');
    else {
      if (a.by !== 'Founder') reasons.push(`start approval by "${a.by}", not Founder`);
      if (!a.at) reasons.push('start approval has no time');
      if (!a.control_sha256 || !a.task_sha256) reasons.push('start approval missing hashes');
      const cS = s.control && s.control.sha256;
      const tS = s.task && s.task.sha256;
      if (a.control_sha256 !== cS) reasons.push('approval Control hash differs from Status');
      if (a.task_sha256 !== tS) reasons.push('approval Task hash differs from Status');
      const cD = diskHash(root, s.control && s.control.file);
      const tD = diskHash(root, s.task && s.task.file);
      if (cD === null) reasons.push('Control file missing on disk');
      else if (cD !== a.control_sha256) reasons.push('Control on disk differs from approval (stale approval)');
      if (tD === null) reasons.push('Task file missing on disk');
      else if (tD !== a.task_sha256) reasons.push('Task on disk differs from approval (stale approval)');
    }
    for (const r of reportCandidates(root, id, s)) {
      if (fs.existsSync(r)) reasons.push(`report exists: ${path.relative(root, r)}`);
    }
    const pl = packetLease(root, id, s, nowMs);
    if (pl) {
      if (pl.state === 'live') reasons.push(`live lease ${pl.lease.run_id || ''}`.trim());
      else if (pl.state === 'expired-alive') reasons.push('lease expired but holder still running');
      else { reasons.push('stale lease (interrupted run)'); stale.push({ id, ...pl }); }
    }
    if (pause) reasons.push(`global pause (PAUSE.json${pause.reason ? `: ${pause.reason}` : ''})`);
    if (s.hold) reasons.push(`hold ${s.hold.type || '?'}${s.hold.reason ? `: ${s.hold.reason}` : ''}`);
    else if (cap) reasons.push(`capacity hold (set by ${cap.set_by || '?'} on ${cap.id})`);
    const rp = s.run_profile;
    const rpMissing = !rp || !Array.isArray(rp.allowed_tools) || !rp.allowed_tools.length || !rp.permission_mode || !Array.isArray(rp.allowed_write_paths);
    if (rpMissing) {
      if (forRun) reasons.push('no complete run_profile (allowed_tools, permission_mode, allowed_write_paths)');
      else if (s.state === 'READY') warnings[id] = ['no run_profile — dispatch run would refuse'];
    }
    if (reasons.length) ineligible.push({ id, reasons });
    else eligible.push(id);
  }
  return { eligible, ineligible, stale, warnings, pause, capacity_hold: cap };
}
