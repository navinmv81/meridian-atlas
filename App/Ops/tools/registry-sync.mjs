#!/usr/bin/env node
// registry-sync.mjs — MA-OCT-002a A1 (spec MA-OCT-002 rev 1.3 §6.1, CR-A1).
//
// Builds the intended ops_job_registry from its sources and diffs it against the
// live registry, then GENERATES a `wrangler d1 execute --remote --file` batch:
//   - INSERT OR IGNORE for each job not yet registered;
//   - for a changed managed field on an existing row: one guarded
//     UPDATE … WHERE job_id=? AND <field> IS NOT <new>, plus an ops_case_event
//     row (subject_type 'ops_control', event_type 'registry_updated', old/new in
//     the payload; idempotency_key makes a re-run a no-op).
// It never writes D1 itself. Re-running after the load must report an EMPTY diff
// (AC-a1). Rule (§6.1): any change to a [triggers] block, an install script's
// schedule, a plist, or the set of runners attaches this tool's diff.
//
// Sources:
//   claude/MA-OCT-000_job_manifest.json  (47 jobs; corrections below)
//   App/**/wrangler*.toml [triggers] crons (live repo)
//   App/Corporate Atlas/scripts/entities-enrich-boost-install.sh FIRE_HOURS_UTC
//   ~/Library/LaunchAgents/com.meridianatlas.*.plist (installed; macOS plutil)
//   live registry: one read-only SELECT (≤ 60 rows, declared SCAN) via the pinned wrangler
//
// Corrections (§6.1): duplicate manual.gleif-seed (13F Seed copy) → manual.gleif-seed.13f-seed;
// cf.meridian-entities-enrich → .phase1 (0 6 * * *) and .phase23 (50 6 * * *), no un-phased id.
//
// Usage: node App/Ops/tools/registry-sync.mjs [--out <file.sql>] [--registry-json <file>]
//   --registry-json reads the live registry from a file instead of D1 (tests).

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const WRANGLER = process.env.WRANGLER_BIN || '/usr/local/bin/wrangler';
const WRANGLER_PIN = '4.96.0';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? a.concat([[v.slice(2), arr[i + 1]]]) : a), []));

// --- defaults from spec §6.1 / §6.3 ------------------------------------------
const EXPECTED_MAX = {
  'cf.meridian-holdings': 900, 'cf.meridian-entities-seed': 900, 'cf.meridian-entities-enrich.phase1': 900,
  'cf.meridian-entities-enrich.phase23': 900, 'cf.meridian-bootstrap': 900,
  'local.entities-enrich-boost': 120, 'local.health-check': 120,
  'local.firds-weekly-seed': 3600, 'local.financialfact-backfill': 3600
};
const GRACE = {   // [on_time_tol_s, grace_s]
  'cf.meridian-holdings': [600, 7200], 'cf.meridian-entities-seed': [600, 7200],
  'cf.meridian-entities-enrich.phase1': [600, 3600], 'cf.meridian-entities-enrich.phase23': [600, 3600],
  'cf.meridian-bootstrap': [600, 3600], 'local.entities-enrich-boost': [540, 10800],
  'local.firds-weekly-seed': [1800, 43200], 'local.health-check': [900, 28800], 'local.financialfact-backfill': [900, 28800]
};
const STATUS = { 'cf.meridian-entities-delta': 'held', 'local.financialfact-backfill': 'held', 'cf.meridian-firds': 'retired' };
const EMITTER = { 'local.entities-enrich-boost': 'boost-local' };   // health-check-local is added at A3
const PLISTS = {
  'local.entities-enrich-boost': 'com.meridianatlas.entities-enrich-boost',
  'local.firds-weekly-seed': 'com.meridianatlas.firds-weekly-seed',
  'local.health-check': 'com.meridianatlas.health-check',
  'local.financialfact-backfill': 'com.meridianatlas.financialfact-backfill'
};
// Fields this tool owns on existing rows (descriptive fields set by hand are left alone).
const MANAGED = ['execution_mode', 'status', 'intended_schedule', 'expected_max_duration_s', 'emitter_id', 'worker_name', 'source_path'];

function normMode(m) {
  m = (m || '').toLowerCase();
  if (m.startsWith('retired')) return 'retired';
  if (m.startsWith('held')) return 'on_request';
  if (m.startsWith('cron')) return 'cron';
  if (m.startsWith('local schedule')) return 'local_schedule';
  if (m.startsWith('on-request')) return 'on_request';
  if (m.startsWith('manual')) return 'manual';
  throw new Error(`unmapped execution_mode "${m}"`);
}

function tomlCrons(rel) {
  const p = path.join(ROOT, rel);
  if (!existsSync(p)) throw new Error(`toml not found: ${rel}`);
  const lines = readFileSync(p, 'utf8').split('\n').map(l => l.replace(/#.*$/, ''));   // comments out
  const txt = lines.join('\n');
  const m = txt.match(/\[triggers\][^[]*?crons\s*=\s*\[([^\]]*)\]/s);
  return m ? [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]) : [];
}

function plistCalendar(label) {
  const p = path.join(homedir(), 'Library/LaunchAgents', `${label}.plist`);
  if (!existsSync(p)) return null;
  const j = JSON.parse(execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', p], { encoding: 'utf8' }));
  let sci = j.StartCalendarInterval;
  if (!sci) return null;
  if (!Array.isArray(sci)) sci = [sci];
  return sci.map(e => ({ ...(e.Weekday !== undefined ? { weekday: e.Weekday } : {}), hour: e.Hour, minute: e.Minute ?? 0 }))
            .sort((a, b) => (a.weekday ?? 0) - (b.weekday ?? 0) || a.hour - b.hour || a.minute - b.minute);
}

function boostUtcTargets() {
  const s = readFileSync(path.join(ROOT, 'App/Corporate Atlas/scripts/entities-enrich-boost-install.sh'), 'utf8');
  const m = s.match(/^FIRE_HOURS_UTC=\(([^)]*)\)/m);
  return m ? m[1].trim().split(/\s+/).map(h => `${String(h).padStart(2, '0')}:50`) : [];
}

function intendedFor(job) {
  const id = job.job_id;
  const [tol, grace] = GRACE[id] || [];
  const extra = tol ? { on_time_tol_s: tol, grace_s: grace } : {};
  if (id.startsWith('cf.') && job.config_path) {
    const crons = tomlCrons(job.config_path);
    if (id === 'cf.meridian-entities-enrich.phase1') return { kind: 'cf_cron', exprs: crons.filter(c => /^0 6 /.test(c)), tz: 'UTC', ...extra };
    if (id === 'cf.meridian-entities-enrich.phase23') return { kind: 'cf_cron', exprs: crons.filter(c => /^50 6 /.test(c)), tz: 'UTC', ...extra };
    return crons.length ? { kind: 'cf_cron', exprs: crons, tz: 'UTC', ...extra } : { kind: 'none' };
  }
  if (PLISTS[id]) {
    const entries = plistCalendar(PLISTS[id]);
    if (!entries) return { kind: 'none', note: 'plist not installed' };
    const out = { kind: 'launchd_calendar', tz: 'Europe/London', entries, ...extra };
    if (id === 'local.entities-enrich-boost') {
      out.utc_targets = boostUtcTargets();
      // installed offset = local hour of the first entry − first UTC target hour
      const utcH = parseInt(out.utc_targets[0], 10), locH = entries[0].hour;
      const off = ((locH - utcH + 36) % 24) - 12;
      out.installed_utc_offset = `${off < 0 ? '-' : '+'}${String(Math.abs(off)).padStart(2, '0')}:00`;
    }
    if (id === 'local.firds-weekly-seed') out.dst_severity = 'sev4';
    return out;
  }
  return { kind: 'none' };
}

// --- build the intended registry --------------------------------------------
const manifest = JSON.parse(readFileSync(path.join(ROOT, 'claude/MA-OCT-000_job_manifest.json'), 'utf8')).jobs;
const rows = [];
for (const j of manifest) {
  let ids = [j.job_id];
  if (j.job_id === 'manual.gleif-seed' && j.source_path === '13F Seed/gleif-seed.js') ids = ['manual.gleif-seed.13f-seed'];
  if (j.job_id === 'cf.meridian-entities-enrich') ids = ['cf.meridian-entities-enrich.phase1', 'cf.meridian-entities-enrich.phase23'];
  for (const id of ids) {
    const job = { ...j, job_id: id };
    const intended = intendedFor(job);
    rows.push({
      job_id: id,
      display_name: id.includes('.phase') ? `${j.worker_or_script} (${id.endsWith('phase1') ? 'Phase 1, 06:00' : 'Phase 2+3, 06:50'})` : (j.worker_or_script || id),
      domain: j.domain, owner_role: j.proposed_owner_role,
      execution_mode: normMode(j.execution_mode),
      worker_name: id.startsWith('cf.') ? j.worker_or_script : null,
      source_path: j.source_path || null,
      intended_schedule: JSON.stringify(intended),
      emitter_id: EMITTER[id] || null,
      expected_max_duration_s: EXPECTED_MAX[id] ?? null,
      kill_switch_ref: j.kill_switch ? String(j.kill_switch).slice(0, 500) : null,
      write_budget_profile: j.write_guard ? JSON.stringify({ write_guard: String(j.write_guard).slice(0, 400) }) : null,
      status: STATUS[id] || 'active',
      notes: j.notes ? String(j.notes).slice(0, 500) : null
    });
  }
}
const ids = rows.map(r => r.job_id);
const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
if (dup.length) throw new Error(`duplicate job_id after corrections: ${dup}`);

// --- live registry ------------------------------------------------------------
function liveRegistry() {
  if (args['registry-json']) return JSON.parse(readFileSync(args['registry-json'], 'utf8'));
  const v = execFileSync(WRANGLER, ['--version'], { encoding: 'utf8' }).trim().split('\n').pop().trim();
  if (v !== WRANGLER_PIN) throw new Error(`wrangler ${v} != pinned ${WRANGLER_PIN}`);
  const out = execFileSync(WRANGLER, ['d1', 'execute', 'meridian-etf', '--remote', '--json', '--command',
    `SELECT job_id, ${MANAGED.join(', ')} FROM ops_job_registry`], { cwd: path.join(ROOT, 'App/Ops'), encoding: 'utf8', maxBuffer: 1 << 24 });
  const d = JSON.parse(out.slice(out.indexOf('['), out.lastIndexOf(']') + 1))[0];
  console.error(`[registry-sync] live registry: ${d.results.length} rows (rows_read=${d.meta?.rows_read})`);
  return d.results;
}
const live = new Map(liveRegistry().map(r => [r.job_id, r]));

// --- diff → SQL ----------------------------------------------------------------
const q = v => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const COLS = ['job_id', 'display_name', 'domain', 'owner_role', 'execution_mode', 'worker_name', 'source_path', 'intended_schedule',
              'emitter_id', 'expected_max_duration_s', 'kill_switch_ref', 'write_budget_profile', 'status', 'notes'];
const inserts = [], updates = [];
for (const r of rows) {
  const cur = live.get(r.job_id);
  if (!cur) { inserts.push(`INSERT OR IGNORE INTO ops_job_registry (${COLS.join(', ')})\n  VALUES (${COLS.map(c => q(r[c])).join(', ')});`); continue; }
  for (const f of MANAGED) {
    const nv = r[f], ov = cur[f] ?? null;
    if (f === 'emitter_id' && nv === null) continue;                 // never clears an emitter set elsewhere
    if ((nv ?? null) === ov) continue;
    const key = `registry:${r.job_id}:${f}:${createHash('sha256').update(String(nv)).digest('hex').slice(0, 12)}`;
    updates.push(
      `UPDATE ops_job_registry SET ${f} = ${q(nv)}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')\n  WHERE job_id = ${q(r.job_id)} AND ${f} IS NOT ${q(nv)};\n` +
      `INSERT OR IGNORE INTO ops_case_event (subject_type, subject_id, event_type, from_value, to_value, payload, actor, actor_source, actor_role, occurred_at, idempotency_key)\n` +
      `  VALUES ('ops_control', ${q(r.job_id)}, 'registry_updated', ${q(ov === null ? null : String(ov).slice(0, 500))}, ${q(nv === null ? null : String(nv).slice(0, 500))}, ${q(JSON.stringify({ field: f, source: 'registry-sync' }))}, 'engineering-lead:registry-sync', 'system', 'Engineering Lead', strftime('%Y-%m-%dT%H:%M:%fZ','now'), ${q(key)});`);
  }
}
const extraLive = [...live.keys()].filter(k => !ids.includes(k) && k !== 'ops.ingest');

const stamp = new Date().toISOString().slice(0, 10);
const header = `-- registry-load-${stamp}.sql — GENERATED by App/Ops/tools/registry-sync.mjs (MA-OCT-002a A1, CR-A1).
-- Do not edit by hand; re-run the tool. Source manifest: claude/MA-OCT-000_job_manifest.json (${manifest.length} jobs).
-- Intended registry: ${rows.length} jobs + ops.ingest = ${rows.length + 1} rows. Live before load: ${live.size} rows.
-- Diff: ${inserts.length} INSERT OR IGNORE, ${updates.length} guarded field UPDATE(s) (+ audit rows).
-- Estimated row-writes: ≈ ${inserts.length * 3 + updates.length * 6}.
-- Live rows not in the intended set (never deleted; jobs are retired, not removed): ${extraLive.length ? extraLive.join(', ') : 'none'}.
`;
const sql = header + '\n' + inserts.join('\n') + (updates.length ? '\n\n-- Field updates on existing rows\n' + updates.join('\n') : '') + '\n';
const summary = { intended_jobs: rows.length, live_rows: live.size, inserts: inserts.length, updates: updates.length, extra_live: extraLive, empty_diff: inserts.length === 0 && updates.length === 0 };
if (args.out) { writeFileSync(path.resolve(args.out), sql); console.error(`[registry-sync] wrote ${args.out}`); }
console.log(JSON.stringify(summary));
