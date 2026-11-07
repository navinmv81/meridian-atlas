// Shared helpers for the delivery factory. Node built-ins only.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Repo root: FACTORY_ROOT (tests point it at a temp copy) or two levels above tools/factory.
export function repoRoot() {
  if (process.env.FACTORY_ROOT) return path.resolve(process.env.FACTORY_ROOT);
  return path.resolve(import.meta.dirname, '..', '..', '..');
}

export const PACKETS_DIR = path.join('claude', 'packets');
export const FACTORY_DIR = path.join('claude', 'factory');

export function packetsDir(root) { return path.join(root, PACKETS_DIR); }
export function factoryDir(root) { return path.join(root, FACTORY_DIR); }

export function sha256Buf(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
export function sha256File(file) { return sha256Buf(fs.readFileSync(file)); }

// ISO timestamp to the second, UTC, e.g. 2026-11-07T10:12:33Z
export function isoSec(d = new Date()) { return new Date(d).toISOString().replace(/\.\d{3}Z$/, 'Z'); }

// JSON with sorted object keys (arrays keep their order) — deterministic output.
export function stableStringify(value, indent = 0) {
  return JSON.stringify(sortKeys(value), null, indent);
}
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeys(v[k]);
    return out;
  }
  return v;
}

export function readJsonIfExists(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export const CONFIG_DEFAULTS = { schema: 1, model: null, claude_bin: null, heartbeat_amber_s: 300, lease_ttl_s: 7200, refresh_s: 30 };

export function readConfig(root, { required = false } = {}) {
  const file = path.join(factoryDir(root), 'config.json');
  const cfg = readJsonIfExists(file);
  if (!cfg && required) throw new Error(`missing ${path.relative(root, file)}`);
  return { ...CONFIG_DEFAULTS, ...(cfg || {}) };
}

export function readPause(root) {
  return readJsonIfExists(path.join(factoryDir(root), 'PAUSE.json'));
}
