// Test helpers: every test works in a fresh temp copy (fs.mkdtempSync), never the real repo.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';

export const FACTORY = path.resolve(import.meta.dirname, '..');
export const REAL_ROOT = path.resolve(FACTORY, '..', '..');
export const DISPATCH = path.join(FACTORY, 'dispatch.mjs');
export const PROJECT = path.join(FACTORY, 'project.mjs');
const STUB_SRC = path.join(import.meta.dirname, 'fixtures', 'fake-claude.mjs');

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const git = (root, ...a) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t.invalid', '-c', 'commit.gpgsign=false', ...a], { cwd: root, encoding: 'utf8' });

export const LANE_OPENER_FIXTURE = '# LANE_OPENER (fixture)\n\n## Fixed line (the Founder keeps this)\n\n```\nFollow claude/packets/LANE_OPENER.md (sha256 <hash>) and run the Founder-approved packet.\n```\n';
export const LANE_OPENER_V2_FIXTURE = '# LANE_OPENER v2 (fixture)\n\n## Fixed line (the Founder keeps this)\n\n```\nFollow claude/packets/LANE_OPENER_v2.md (sha256 <hash>) and run the Founder-approved packet.\n```\n';

// Write a packet: Control + Task + Status with a Founder start_approval bound to both hashes.
export function addPacket(root, id, { state = 'READY', approved = true, runProfile = true, extra = {} } = {}) {
  const dir = path.join(root, 'claude', 'packets');
  const control = `# ${id} Control v1\nWrite \`claude/packets/${id}_Report.md\`.\n`;
  const task = `# ${id} Task v1\nDo the thing.\n`;
  fs.writeFileSync(path.join(dir, `${id}_Control_v1.md`), control);
  fs.writeFileSync(path.join(dir, `${id}_Task_v1.md`), task);
  const s = {
    packet: id, title: `Fixture ${id}`, state, phase: 'BUILD', rev: 1, owner: 'Main Lane', lane: 'TEST', write_owner: 'Test lane',
    control: { version: 'v1', file: `${id}_Control_v1.md`, sha256: sha(control) },
    task: { version: 'v1', file: `${id}_Task_v1.md`, sha256: sha(task) },
    next_gate: 'run', blocker: null, usage_class: 'light', updated: '2026-11-07T00:00Z', updated_by: 'Main Lane',
    ...(approved ? { start_approval: { by: 'Founder', at: '2026-11-07T00:00Z', words: `approve ${id}`, control_sha256: sha(control), task_sha256: sha(task), recorded_by: 'Main Lane' } } : {}),
    ...(runProfile ? { run_profile: { allowed_tools: ['Read', 'Write'], permission_mode: 'acceptEdits', allowed_write_paths: [`claude/packets/${id}_Report.md`] } } : {}),
    ...extra,
  };
  fs.writeFileSync(path.join(dir, `${id}_Status.json`), JSON.stringify(s, null, 2) + '\n');
  return s;
}

export function makeRepo({ packets = [], config = {}, git: useGit = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-test-'));
  fs.mkdirSync(path.join(root, 'claude', 'packets'), { recursive: true });
  fs.mkdirSync(path.join(root, 'claude', 'factory', 'leases'), { recursive: true });
  fs.mkdirSync(path.join(root, 'claude', 'factory', 'runs'), { recursive: true });
  fs.mkdirSync(path.join(root, 'App'), { recursive: true });
  fs.writeFileSync(path.join(root, 'App', 'keep.txt'), 'app\n');
  fs.writeFileSync(path.join(root, 'claude', 'packets', 'LANE_OPENER.md'), LANE_OPENER_FIXTURE);
  fs.writeFileSync(path.join(root, 'claude', 'packets', 'LANE_OPENER_v2.md'), LANE_OPENER_V2_FIXTURE);
  fs.writeFileSync(path.join(root, 'claude', 'factory', 'config.json'),
    JSON.stringify({ schema: 1, model: 'test-model', claude_bin: null, heartbeat_amber_s: 300, lease_ttl_s: 7200, refresh_s: 30, ...config }, null, 2) + '\n');
  for (const p of packets) (typeof p === 'string' ? addPacket(root, p) : addPacket(root, p.id, p));
  const stub = path.join(root, '.stub', 'fake-claude.mjs');
  fs.mkdirSync(path.dirname(stub), { recursive: true });
  fs.copyFileSync(STUB_SRC, stub);
  fs.chmodSync(stub, 0o755);
  fs.writeFileSync(path.join(root, '.gitignore'), '.stub/\n');
  if (useGit) {
    git(root, 'init', '-q');
    git(root, 'add', '-A');
    git(root, 'commit', '-q', '-m', 'fixture');
  }
  const calls = path.join(root, '.stub', 'calls.jsonl');
  return { root, stub, calls };
}

export function envFor(repo, extra = {}) {
  return { ...process.env, FACTORY_ROOT: repo.root, CLAUDE_BIN: repo.stub, FAKE_CALLS: repo.calls, FACTORY_HEARTBEAT_MS: '100',
    CLAUDE_CODE_SESSION_ID: 'test-session-1', ...extra };
}

export function gitIn(root, ...a) {
  const r = git(root, ...a);
  if (r.status !== 0) throw new Error(`git ${a.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

export function runNode(script, args, env) {
  return spawnSync(process.execPath, [script, ...args], { env, encoding: 'utf8', timeout: 60000 });
}

export function spawnNode(script, args, env) {
  const child = spawn(process.execPath, [script, ...args], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; let err = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { err += d; });
  const done = new Promise((resolve) => child.on('exit', (code, signal) => resolve({ code, signal, out, err })));
  return { child, done };
}

export function callCount(repo) {
  return fs.existsSync(repo.calls) ? fs.readFileSync(repo.calls, 'utf8').split('\n').filter(Boolean).length : 0;
}

export function status(repo, id) {
  return JSON.parse(fs.readFileSync(path.join(repo.root, 'claude', 'packets', `${id}_Status.json`), 'utf8'));
}

export async function waitFor(fn, ms = 10000, step = 25) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (fn()) return true; await new Promise((r) => setTimeout(r, step)); }
  throw new Error('waitFor timed out');
}

// Strip the only intended difference between two generator runs.
export function stripGenerated(text) {
  return text.replace(/generated_at[":\s]*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/g, 'generated_at=X').replace(/Generated \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/g, 'Generated X');
}
