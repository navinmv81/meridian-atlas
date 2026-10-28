#!/usr/bin/env node
// MA-OCT-011 — offline GLEIF reconciliation runner (spec rev 1.9 §4, §7–§10).
//
// Local, manual, interactive Entities-domain runner. No cron, no LaunchAgent.
// Executes ONLY a SHA-pinned plan written by gleif-reconcile-011-plan.mjs.
//
//   run      --plan <dir> [--until <batch|step>] [--max-batches N]   execute batches from the cursor
//   restore  --plan <dir> --batch <id>    per-batch restore from its pre-image (§10)
//   restore  --plan <dir> --batch <A id>  first deletes the ECA edges whose parent is in that A batch (RA-15)
//   readback --plan <dir> --batch <id>    B-2: complete a read-back-pending checkpoint (read-only)
//   restore  --plan <dir> --all           full rollback (includes failed batches with applied rows, B-3);, order Q → E-A → ECA → A → E-C → C-reasons/RC-15/C → B → P
//   explain  --plan <dir>                 EXPLAIN QUERY PLAN set (§6 (i)); read-only
//   probe    --plan <dir> [--rows 50]     live pre-image sample per step vs the plan; read-only
//   recon    [--date YYYY-MM-DD]          R-4 daily reconciliation export (≤ 300 reads); read-only
//   rehearse --plan <dir> --step CR --rows 20 --max-writes 100   rollback rehearsal (§11)
//   build-replica --out <db> [--export <dir|d2>]  local SQLite replica (live DDL) for the dry run
//
// Transport: --transport remote (wrangler OAuth, /usr/local/bin/wrangler) or
// --transport local:<replica.db>. Every write invocation passes, in order:
//   stop flag (kill switch) → pause flag → calendar + FREEZES.json → hold_all_jobs
//   (once, at start) → A/E-A holds → headroom gate (fails closed, §4.3).
// Per batch (§9): pre-image → execute (3 retries, idempotent) → read-back diff →
// checkpoint → run-log line → heartbeat. The cursor moves only on success/partial.

import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  D1_TODAY_URL, EM_COLS, ENRICH_VERSION, JOB_ID, LIMITS, RESTORE_ORDER, STEP_ORDER,
  appendRunLog, assertReadOnly, assertTables, calendarCheck, ensureDir, fetchD1Today, headroomDecision, heartbeatFor,
  imageQueries, isNull, lit, loadFreezes, reconQuery, readTotals, readCeilingDecision, estBatchReads, loadIngestConfig, localTransport, ownWrites, readJson, readJsonl, redact,
  renderStatement, renderValue, sha256, sha256File, stableStringify, workPaths, writeJsonAtomic, wranglerTransport, D1Error
} from '../lib/gleif-reconcile-011-core.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CORP_DIR = path.resolve(SCRIPT_DIR, '..');
const REPO = path.resolve(CORP_DIR, '..', '..');
export const PAUSE_FLAG = path.join(CORP_DIR, '.gleif-reconcile-011-paused');
export const STOP_FLAG = path.join(CORP_DIR, '.gleif-reconcile-011-stop');
const FREEZES_PATH = path.join(REPO, 'claude', 'relays', 'FREEZES.json');
const WRANGLER_CONFIG = path.join(CORP_DIR, 'wrangler-entities-enrich.toml');
const COMPARE_COLS = EM_COLS.filter(c => c !== 'updated_at');

// ── Context ──────────────────────────────────────────────────────────────

export async function makeContext(args, overrides = {}) {
  const paths = workPaths(args.work || overrides.work);
  ensureDir(paths.work);
  const tspec = args.transport || 'remote';
  let d1;
  if (overrides.transport) d1 = overrides.transport;
  else if (tspec === 'remote') d1 = wranglerTransport({ cwd: CORP_DIR, config: WRANGLER_CONFIG, readOnly: !overrides.write, ledger: e => appendJsonl(paths.ledger, e) });
  else if (tspec.startsWith('local:')) d1 = await localTransport(tspec.slice(6), { readOnly: !overrides.write });
  else throw new Error(`unknown --transport ${tspec}`);
  const ctx = {
    args, paths, d1,
    now: overrides.now || (() => new Date()),
    sleep: overrides.sleep || (ms => new Promise(r => setTimeout(r, ms))),
    fetchImpl: overrides.fetchImpl || fetch,
    d1TodayUrl: args['d1-today-url'] || D1_TODAY_URL,
    ignoreCalendar: !!args['ignore-calendar'],
    pauseFlag: overrides.pauseFlag || PAUSE_FLAG,
    stopFlag: overrides.stopFlag || STOP_FLAG,
    freezesPath: overrides.freezesPath || FREEZES_PATH,
    log: overrides.log || (s => console.log(s)),
    stopRequested: false, operator: args.operator || null,
    outbox: null, ingestWhy: null
  };
  if (ctx.ignoreCalendar && !d1.name.startsWith('local')) throw new Error('--ignore-calendar is allowed only with a local transport');
  await setupHeartbeats(ctx, overrides);
  return ctx;
}

function appendJsonl(file, obj) { ensureDir(path.dirname(file)); writeFileSync(file, JSON.stringify(obj) + '\n', { flag: 'a' }); }
const gateLog = (ctx, text) => { appendJsonl(path.join(ctx.paths.work, 'gate.jsonl'), { utc: ctx.now().toISOString(), text }); ctx.log(text); };

// ── Heartbeats (MA-OCT-001 contract v1) via the 002 outbox when present ───

async function setupHeartbeats(ctx, overrides) {
  const { cfg, why } = overrides.ingestCfg !== undefined ? { cfg: overrides.ingestCfg, why: overrides.ingestCfg ? null : 'disabled (test)' } : loadIngestConfig(ctx.paths.ingestEnv);
  ctx.ingestWhy = why;
  // Event bodies carry no secrets (the key travels only in a header and is never logged);
  // key=value patterns are still redacted, but run UUIDs stay readable for reconciliation.
  const hbLog = text => appendJsonl(ctx.paths.heartbeatLog, { utc: new Date().toISOString(), text: String(text).replace(/(bearer|authorization|secret|token|key)\s*[:=]\s*\S+/gi, '$1=[redacted]') });
  try {
    const mod = overrides.outboxModule || await import('../lib/ops-outbox.mjs');
    ctx.outbox = mod.createOpsOutbox({ outboxDir: ctx.paths.outbox, name: 'gleif-reconcile-011', cfg, log: hbLog });
    ctx.outboxLive = true;
  } catch {
    ctx.outbox = null; ctx.outboxLive = false;            // run-log fallback (§7)
  }
  ctx.hbLog = hbLog;
}

function eventFor(ctx, run, event, extra = {}) {
  const now = ctx.now();
  const evt = { v: 1, run_id: run.id, job_id: JOB_ID, event, trigger: 'manual', started_at: run.startedAt.toISOString() };
  if (event !== 'start') { evt.ended_at = now.toISOString(); evt.duration_ms = Math.max(0, now - run.startedAt); }
  for (const k of ['rows_read', 'rows_written', 'items_attempted', 'items_progressed']) if (Number.isInteger(extra[k])) evt[k] = extra[k];
  if (extra.cursor) evt.cursor = extra.cursor;
  if (extra.error) evt.error = { class: extra.error.class, summary: redact(extra.error.summary).slice(0, 500) };
  evt.detail = { step: run.step, batch: run.batch, ...(extra.detail || {}) };
  return evt;
}

// Fire-and-forget with a 2 s ceiling; the run log is always written first.
async function sendEvent(ctx, evt) {
  ctx.hbLog(`${evt.event} ${JSON.stringify(evt)}`);
  if (!ctx.outbox) return { delivered: false };
  try {
    const r = await ctx.outbox.send(evt, { ceilingMs: 2000 });
    let replayed = 0;
    if (r.delivered) { const rp = await ctx.outbox.replay({ max: 10, ceilingMs: 2000 }); replayed = rp.replayed || 0; }
    else if (r.spoolable) ctx.outbox.spool(r.body);
    const delivered = (r.delivered ? 1 : 0) + replayed;
    if (delivered) appendJsonl(ctx.paths.events, { utc: ctx.now().toISOString(), run_id: evt.run_id, event: evt.event, delivered });
    return { delivered: !!r.delivered, replayed };
  } catch { return { delivered: false }; }
}

// Run-log line, then the mapped heartbeat (§7 table).
async function report(ctx, run, outcome, { rows = 0, writes = 0, cursor = null, extra = {}, error = null, metrics = null, reads = null } = {}) {
  appendRunLog(ctx.paths.runlog, { run_key: run.id, step: run.step, batch: run.batch, rows, writes, cursor, outcome, utc: ctx.now().toISOString(), operator: ctx.operator, transport: ctx.d1.name, ...extra });
  const hb = heartbeatFor(outcome);
  const evExtra = { cursor: cursor ? { before: String(cursor.before ?? ''), after: String(cursor.after ?? '') } : undefined,
                    rows_written: Number.isInteger(writes) ? writes : undefined, rows_read: Number.isInteger(reads) ? reads : undefined,
                    items_attempted: metrics?.attempted, items_progressed: metrics?.progressed,
                    detail: { ...(hb.reason ? { reason: hb.reason } : {}), ...(metrics ? { metrics } : {}), outcome } };
  if (hb.event === 'failed' || hb.event === 'killed') evExtra.error = error || { class: hb.errorClass || outcome, summary: extra.reason || outcome };
  if (hb.errorClass) evExtra.error = { class: hb.errorClass, summary: (error && error.summary) || extra.reason || hb.errorClass };
  return sendEvent(ctx, eventFor(ctx, run, hb.event, evExtra));
}

// ── Plan, cursor, checkpoints ────────────────────────────────────────────

export function loadPlan(dir) {
  const text = readFileSync(path.join(dir, 'plan.json'), 'utf8');
  const pinned = readFileSync(path.join(dir, 'plan.sha256'), 'utf8').split(/\s+/)[0];
  const got = sha256(text);                                       // the file's own SHA-256 (shasum -a 256 plan.json)
  if (got !== pinned) throw new Error(`plan SHA ${got} does not match plan.sha256 ${pinned}`);
  const plan = JSON.parse(text);
  if (stableStringify(plan) + '\n' !== text) throw new Error('plan.json is not in canonical form');
  for (const [f, sha] of Object.entries(plan.files || {})) if (sha256(readFileSync(path.join(dir, f), 'utf8')) !== sha) throw new Error(`plan file ${f}: SHA mismatch`);
  return { plan, sha: got, dir };
}

function cursorFile(ctx, planSha) { return path.join(ctx.paths.work, `cursor-${planSha.slice(0, 16)}.json`); }
function loadCursor(ctx, planSha) { return readJson(cursorFile(ctx, planSha), { plan_sha256: planSha, next: 0, done: {} }); }
function saveCursor(ctx, planSha, cur) { writeJsonAtomic(cursorFile(ctx, planSha), cur); }
const ckptFile = (ctx, planSha, id) => path.join(ctx.paths.checkpoints, planSha.slice(0, 16), `${id}.json`);
const readCkpt = (ctx, planSha, id) => readJson(ckptFile(ctx, planSha, id));

// ── D1 helpers ───────────────────────────────────────────────────────────

async function readImages(ctx, batch) {
  const qs = imageQueries(batch);
  if (!qs.length) return { images: {}, reads: 0 };
  const res = await ctx.d1.exec(qs.map(q => q.sql), { label: `image ${batch.id}` });
  const images = {}; let reads = 0;
  qs.forEach((q, i) => { images[q.key] = res[i].results; reads += res[i].meta.rows_read || 0; });
  return { images, reads };
}

async function readHold(ctx) {
  const [r] = await ctx.d1.exec([`SELECT value FROM holdings_pipeline_state WHERE key = 'hold_all_jobs'`], { label: 'hold_all_jobs' });
  return r.results[0]?.value === 'true';
}

// ── Diff (§9 step 3) ─────────────────────────────────────────────────────

const same = (a, b) => (isNull(a) && isNull(b)) || a === b || (typeof a !== typeof b && String(a) === String(b));
const rowEq = (a, b, cols) => cols.every(c => same(a?.[c], b?.[c]));

export function diffBatch(batch, pre, post, runTs) {
  const byId = rows => new Map((rows || []).map(r => [String(r.entity_id), r]));
  const preEm = byId(pre.em), postEm = byId(post.em);
  const preLei = new Map((pre.em_lei || []).map(r => [r.lei, r])), postLei = new Map((post.em_lei || []).map(r => [r.lei, r]));
  const postLeiCount = new Map(); for (const r of post.em_lei || []) postLeiCount.set(r.lei, (postLeiCount.get(r.lei) || 0) + 1);
  const edgeKey = e => `${e.parent_entity_id}|${e.child_entity_id}|${e.relationship_type}|${e.source}`;
  const preEdges = new Set((pre.edge || []).map(edgeKey)), postEdges = new Set((post.edge || []).map(edgeKey));
  const parentIds = new Map(); for (const r of post.edge_parent || []) { const k = r.lei; parentIds.set(k, parentIds.has(k) ? null : r.entity_id); }
  const preQ = byId(pre.queue), postQ = byId(post.queue);
  const out = [];
  for (const s of batch.statements) {
    const rec = { key: s.key, kind: s.kind };
    if (s.kind === 'em_update') {
      const lp = preEm.get(String(s.entity_id)), po = postEm.get(String(s.entity_id));
      if (!lp || !po) { out.push({ ...rec, status: 'mismatch', why: 'row missing in pre-image or read-back' }); continue; }
      const set = Object.fromEntries(Object.entries(s.set).map(([k, v]) => [k, renderValue(v, runTs)]));
      const casHolds = Object.entries(s.pre).every(([c, v]) => same(lp[c], v));
      const expected = casHolds ? { ...lp, ...set } : lp;
      if (rowEq(po, expected, COMPARE_COLS)) rec.status = casHolds ? 'applied' : 'raced';
      else if (rowEq(po, lp, COMPARE_COLS)) rec.status = 'raced';
      else { rec.status = 'mismatch'; rec.why = COMPARE_COLS.filter(c => !same(po[c], expected[c])).join(','); }
      if (rec.status === 'applied') rec.cols = Object.keys(set);
      rec.entity_id = s.entity_id;
    } else if (s.kind === 'em_insert') {
      const lp = preLei.get(s.values.lei), po = postLei.get(s.values.lei);
      const vals = Object.fromEntries(Object.entries(s.values).map(([k, v]) => [k, renderValue(v, runTs)]));
      // Duplicate-LEI-holder check (Sat 17 pilot note): after the insert, the LEI must be held by
      // exactly one row, whatever the pre-image said. Two or more holders is a mismatch (stop rule).
      if ((postLeiCount.get(s.values.lei) || 0) > 1) { rec.status = 'mismatch'; rec.why = `LEI held by ${postLeiCount.get(s.values.lei)} rows after the insert`; }
      else if (lp) rec.status = 'raced';
      else if (!po) rec.status = 'parent_collision';
      else if (rowEq(po, vals, Object.keys(vals))) { rec.status = 'applied'; rec.entity_id = po.entity_id; }
      else { rec.status = 'mismatch'; rec.why = Object.keys(vals).filter(c => !same(po[c], vals[c])).join(','); }
    } else if (s.kind === 'edge_insert') {
      const pid = parentIds.get(s.parent_lei);
      const k = pid ? `${pid}|${s.child_entity_id}|legal_parent|gleif` : null;
      rec.parent_entity_id = pid ?? null; rec.child_entity_id = s.child_entity_id;
      if (!k) rec.status = 'raced', rec.why = 'parent LEI not held by exactly one row';
      else if (postEdges.has(k) && !preEdges.has(k)) rec.status = 'applied';
      else if (postEdges.has(k)) rec.status = 'already_present';
      else rec.status = 'raced', rec.why = 'edge not inserted (child LEI guard)';
    } else if (s.kind === 'q_update') {
      const lp = preQ.get(String(s.entity_id)), po = postQ.get(String(s.entity_id));
      if (!lp || !po) { out.push({ ...rec, status: 'mismatch', why: 'queue row missing' }); continue; }
      const casHolds = lp.status === 'pending' || lp.status === 'failed';
      const expected = casHolds ? { ...lp, status: 'complete', last_attempt: runTs } : lp;
      rec.status = rowEq(po, expected, ['status', 'last_attempt', 'retry_after']) ? (casHolds ? 'applied' : 'raced') : rowEq(po, lp, ['status', 'last_attempt']) ? 'raced' : 'mismatch';
      rec.entity_id = s.entity_id;
    }
    out.push(rec);
  }
  return out;
}

// ── Restore statements (§10) ─────────────────────────────────────────────

export function restoreStatements(batch, ckpt) {
  const pre = ckpt.pre, post = ckpt.post;
  const byId = rows => new Map((rows || []).map(r => [String(r.entity_id), r]));
  const preEm = byId(pre.em), postEm = byId(post.em), preQ = byId(pre.queue), postQ = byId(post.queue);
  const stmts = [];
  for (const d of ckpt.diff) {
    if (d.status !== 'applied') continue;                 // raced / collision rows were never written by 011
    if (d.kind === 'em_update') {
      const lp = preEm.get(String(d.entity_id)), po = postEm.get(String(d.entity_id));
      const cols = d.cols;
      stmts.push({ key: d.key, entity_id: d.entity_id, cols, sql:
        `UPDATE entity_master SET ${cols.map(c => `${c} = ${lit(lp[c])}`).join(', ')} WHERE entity_id = ${lit(d.entity_id)} ` +
        `AND gleif_enrichment_version = ${ENRICH_VERSION} AND ${cols.map(c => `${c} IS ${lit(po[c])}`).join(' AND ')}` });
    } else if (d.kind === 'em_insert') {
      stmts.push({ key: d.key, entity_id: d.entity_id, sql:
        `DELETE FROM entity_master WHERE entity_id = ${lit(d.entity_id)} AND gleif_enrichment_version = ${ENRICH_VERSION} ` +
        `AND NOT EXISTS (SELECT 1 FROM entity_relationships r WHERE r.parent_entity_id = ${lit(d.entity_id)}) ` +
        `AND NOT EXISTS (SELECT 1 FROM entity_relationships r WHERE r.child_entity_id = ${lit(d.entity_id)})` });
    } else if (d.kind === 'edge_insert') {
      stmts.push({ key: d.key, sql: `DELETE FROM entity_relationships WHERE parent_entity_id = ${lit(d.parent_entity_id)} AND child_entity_id = ${lit(d.child_entity_id)} AND relationship_type = 'legal_parent' AND source = 'gleif'` });
    } else if (d.kind === 'q_update') {
      const lp = preQ.get(String(d.entity_id)), po = postQ.get(String(d.entity_id));
      stmts.push({ key: d.key, entity_id: d.entity_id, sql:
        `UPDATE entity_enrichment_queue SET status = ${lit(lp.status)}, last_attempt = ${lit(lp.last_attempt)} WHERE entity_id = ${lit(d.entity_id)} AND status = 'complete' AND last_attempt IS ${lit(po.last_attempt)}` });
    }
  }
  return stmts;
}

// ── Gates ────────────────────────────────────────────────────────────────

function flagGate(ctx) {
  if (ctx.stopRequested || existsSync(ctx.stopFlag)) return 'killed';
  if (existsSync(ctx.pauseFlag)) return 'paused';
  return null;
}

function calendarGate(ctx) {
  if (ctx.ignoreCalendar) return { ok: true };
  let freezes;
  try { freezes = loadFreezes(ctx.freezesPath); } catch (e) { return { ok: false, reason: `FREEZES.json unreadable (${e.message}); fail closed` }; }
  ctx.freezesSha = freezes.sha256;
  return calendarCheck(ctx.now(), freezes);
}

async function headroomGate(ctx, writesDeclared) {
  let reading = null, fetchError = null;
  try { reading = await fetchD1Today({ url: ctx.d1TodayUrl, fetchImpl: ctx.fetchImpl, now: ctx.now, sleep: ctx.sleep }); }
  catch (e) { fetchError = e.message; }
  const state = readJson(ctx.paths.headroom, {});
  const dec = headroomDecision({ reading, fetchError, now: ctx.now(), state, batchWrites: writesDeclared, own: ownWrites(ctx.paths, ctx.now()) });
  writeJsonAtomic(ctx.paths.headroom, dec.nextState);
  appendJsonl(path.join(ctx.paths.work, 'headroom.jsonl'), { utc: ctx.now().toISOString(), ok: dec.ok, outcome: dec.outcome || null, reading, fetchError, detail: dec.detail });
  return { ...dec, reading };
}

// R-4: when the outbox is not live, the previous run day must carry the
// Operations Lead's sign-off before today's first batch. Run days come from the
// run log (a day with any batch that wrote). Local transports are exempt (tests).
function reconGate(ctx) {
  if (ctx.d1.name.startsWith('local') || ctx.args['outbox-live-confirmed']) return null;
  const today = ctx.now().toISOString().slice(0, 10);
  const days = [...new Set(readJsonl(ctx.paths.runlog).filter(x => x.writes > 0 && x.transport === 'remote-rw').map(x => String(x.utc).slice(0, 10)))].filter(d => d < today).sort();
  const prev = days.at(-1);
  if (!prev) return null;
  const f = path.join(ctx.paths.work, 'recon', prev, 'ops-signoff.json');
  const j = readJson(f);
  if (!j || j.date !== prev || !j.signed_by || !/^(MATCH|RECONCILED)/i.test(String(j.result || ''))) return `R-4: run day ${prev} has no Operations Lead sign-off at ${f}`;
  return null;
}

// A pilot hold, E-A and ECA sequencing (§3.1 E-4, RA-14, Ops R-1 (b); RA-15 / R110R-B1:
// ECA is treated exactly like E-A).
export const holdFile = (ctx, name) => path.join(ctx.paths.holds, name);
const EDGE_STEPS = ['ECA', 'EA'];

// The Operations Lead's release (Ops R-1 (b)). E-A: {release:"EA", no_open_trigger:true}
// (a `steps` list, when present, must name EA). ECA is released ONLY by a release
// whose `steps` list names ECA explicitly (RA-15).
export function releaseCovers(j, step) {
  if (!j || j.release !== 'EA' || j.no_open_trigger !== true) return false;
  if (step === 'ECA') return Array.isArray(j.steps) && j.steps.includes('ECA');
  return !Array.isArray(j.steps) || j.steps.includes('EA');
}

// "A stops" (E-4 response, RA-12; RA-15 c): an open E-4 trigger, an A drop, or a
// failed A batch. Returns the reason or null.
export function aStopReason(ctx, plan, planSha) {
  if (existsSync(holdFile(ctx, 'e4-trigger.json'))) return 'E-4 trigger open';
  if (ctx.args['drop-a'] || existsSync(holdFile(ctx, 'a-dropped.json'))) return 'A dropped';
  for (const b of plan.batches.filter(x => x.step === 'A')) {
    const c = readCkpt(ctx, planSha, b.id);
    if (c && c.outcome === 'failed') return `A batch ${b.id} failed`;
  }
  return null;
}

export function abGate(ctx, plan, planSha, batch, cur) {
  if (['A', 'ECA', 'EA', 'Q'].includes(batch.step)) {
    if (existsSync(holdFile(ctx, 'e4-trigger.json'))) return `E-4 trigger open (${holdFile(ctx, 'e4-trigger.json')}): A, ECA, E-A and Q are stopped`;
  }
  if (batch.step === 'A' && (ctx.args['drop-a'] || existsSync(holdFile(ctx, 'a-dropped.json')))) return 'A dropped for the rest of the run (A defers to after 013)';
  const aBatches = plan.batches.filter(b => b.step === 'A');
  const adj = () => {
    const f = ctx.args['a-adjudication'];
    if (!f) return 'A pilot hold: the next A batch needs --a-adjudication <file> (≥ 50 rows of the pilot batch adjudicated 50/50, RA-14)';
    const j = readJson(f);
    if (!j || j.batch !== aBatches[0]?.id || !(j.adjudicated >= 50) || j.correct !== j.adjudicated || !j.data_identity_lead || !j.ops_spot_check) {
      return `A adjudication file ${f} does not record ≥ 50/50 on ${aBatches[0]?.id} with Data-Identity Lead + Ops spot-check`;
    }
    cur.a_adjudication = { file: f, sha256: sha256File(f) };
    return null;
  };
  if (batch.step === 'A' && !batch.a_pilot) return adj();
  if (EDGE_STEPS.includes(batch.step)) {
    const name = batch.step === 'EA' ? 'E-A' : 'ECA';
    if (ctx.args['drop-ea'] || existsSync(holdFile(ctx, 'ea-dropped.json'))) return `${name} dropped for the rest of the run (--drop-ea / ea-dropped.json drops ECA and E-A)`;
    if (existsSync(holdFile(ctx, 'eca-ea-dropped.json'))) return `${name} dropped: A stopped earlier in this run (RA-12 / RA-15)`;
    const stop = aStopReason(ctx, plan, planSha); if (stop) return `${name} blocked: ${stop}`;
    const a = adj(); if (a) return a;
    for (const b of aBatches) {
      const c = readCkpt(ctx, planSha, b.id);
      if (!c || !['success', 'partial'].includes(c.outcome) || c.mismatches > 0) return `${name} sequencing: A batch ${b.id} has no passed read-back diff`;
    }
    const f = ctx.args['ea-release'];
    const j = f && readJson(f);
    if (!releaseCovers(j, batch.step)) {
      return batch.step === 'ECA'
        ? 'ECA needs --ea-release <file> {release:"EA", steps:["ECA","EA"], no_open_trigger:true} from the Operations Lead: a release that does not list ECA blocks ECA (RA-15)'
        : 'E-A needs --ea-release <file> {release:"EA", no_open_trigger:true} from the Operations Lead (Ops R-1 (b))';
    }
    cur.ea_release = { file: f, sha256: sha256File(f) };
  }
  return null;
}

// RA-12 / RA-15 (c): when A stops, ECA and E-A are dropped for the rest of the run and
// every ECA / E-A edge already written is deleted (restore of each such batch, E-A
// first, then ECA) before anything else runs. Idempotent: the marker records it.
export async function dropEdgeStepsIfAStopped(ctx, P, cur) {
  const why = aStopReason(ctx, P.plan, P.sha);
  if (!why) return null;
  const marker = holdFile(ctx, 'eca-ea-dropped.json');
  const pending = Object.keys(cur.done).filter(id => EDGE_STEPS.includes(id.split('-')[0]))
    .sort((a, b) => RESTORE_ORDER.indexOf(a.split('-')[0]) - RESTORE_ORDER.indexOf(b.split('-')[0]) || b.localeCompare(a));
  if (!existsSync(marker)) writeJsonAtomic(marker, { utc: ctx.now().toISOString(), reason: why, edge_batches_to_delete: pending });
  const results = [];
  for (const id of pending) {
    const ck = readCkpt(ctx, P.sha, id);
    gateLog(ctx, `A stopped (${why}): deleting the ${id.split('-')[0]} edges of ${id}`);
    const r = await restoreBatch(ctx, P, { id, step: ck.step, statements: ck.statements }, ck);
    results.push({ id, outcome: r.outcome, writes: r.writes });
    if (r.outcome !== 'success' && r.outcome !== 'partial') return { why, results, stopped: r.outcome };
    cur.restored = { ...(cur.restored || {}), [id]: { checkpoint: r.ckFile, utc: ctx.now().toISOString(), reason: why } };
    delete cur.done[id]; saveCursor(ctx, P.sha, cur);
  }
  return { why, results };
}

// ── Execute one batch ────────────────────────────────────────────────────

// P-3 (RELARC note on transient Cloudflare errors, e.g. 7403 / 10000): a failed write call
// is retried ONLY if a read-back shows that no statement of the batch was applied (every
// row still equals its pre-image, i.e. the failure came before the first statement). If any
// row changed, there is no retry: the batch ends `failed` with the cursor kept, and its
// checkpoint diff records which rows were applied (restorable with `restore --batch`).
// A row changed by a concurrent writer also counts as changed (stops; never retries).
function imagesEqual(a, b) {
  const norm = rows => (rows || []).map(r => JSON.stringify(Object.keys(r).sort().map(k => [k, r[k]]))).sort();
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of keys) { const x = norm(a?.[k]), y = norm(b?.[k]); if (x.length !== y.length || x.some((v, i) => v !== y[i])) return false; }
  return true;
}

async function execNoRetryAfterWrites(ctx, sqls, label, pre, imageBatch) {
  const log = [];
  let probeReads = 0;
  // A probe is one read-only read-back of the batch's rows (image queries). Its own read
  // errors are not retried here: a failed probe means "unknown", which never permits a retry.
  const probe = async () => {
    try { const r = await readImages(ctx, imageBatch); probeReads += r.reads || 0; return { unchanged: imagesEqual(pre, r.images), err: null }; }
    catch (re) { return { unchanged: false, err: re }; }
  };
  const fail = (msg, extra = {}) => { const err = new Error(msg); Object.assign(err, { retryLog: log, probeReads }, extra); return err; };
  for (let attempt = 0; ; attempt++) {
    try { const res = await ctx.d1.exec(sqls, { label }); return { res, attempts: attempt + 1, log, probeReads }; }
    catch (e) {
      const p1 = await probe();
      log.push({ attempt: attempt + 1, phase: 'after-failure', error: redact(e.message).slice(0, 300), code: e.code ?? null, rows_unchanged: p1.unchanged, probe_error: p1.err ? redact(p1.err.message).slice(0, 200) : null });
      if (p1.err) throw fail(`ambiguous failure of ${label}; read-back failed, so no retry (P-3): ${e.message}`, { probeFailed: true });
      if (!p1.unchanged) throw fail(`ambiguous failure of ${label} after writes: no retry (P-3): ${e.message}`, { afterWrites: true });
      if ((e instanceof D1Error && !e.ambiguous) || attempt >= LIMITS.retryDelaysMs.length) {
        throw fail(`${attempt + 1} failure(s) of ${label} before any write (3 retries max): ${e.message}`);
      }
      ctx.log(`  ${label}: failed before any write (read-back = pre-image); retry ${attempt + 1}/${LIMITS.retryDelaysMs.length} after ${LIMITS.retryDelaysMs[attempt] / 1000}s`);
      await ctx.sleep(LIMITS.retryDelaysMs[attempt]);
      // B-1: probe AGAIN just before re-sending (closes P3R N-1: writes of an in-flight call
      // that land during the sleep are seen here, and then there is no retry).
      const p2 = await probe();
      log.push({ attempt: attempt + 1, phase: 'before-retry', rows_unchanged: p2.unchanged, probe_error: p2.err ? redact(p2.err.message).slice(0, 200) : null });
      if (p2.err) throw fail(`${label}: the pre-retry read-back failed, so no retry (P-3, B-1): ${e.message}`, { probeFailed: true });
      if (!p2.unchanged) throw fail(`ambiguous failure of ${label}: writes landed during the retry delay; no retry (P-3, B-1): ${e.message}`, { afterWrites: true });
    }
  }
}

// B-2: the read-back itself is read-only, so it is retried (outside P-3).
const READBACK_RETRY_MS = [10000, 60000, 180000];
async function readImagesRetry(ctx, batch) {
  let lastErr = null;
  for (let i = 0; i <= READBACK_RETRY_MS.length; i++) {
    if (i) await ctx.sleep(READBACK_RETRY_MS[i - 1]);
    try { return await readImages(ctx, batch); } catch (e) { lastErr = e; }
  }
  throw lastErr;
}
export const readbackHoldFile = (ctx, id) => path.join(ctx.paths.holds, `readback-pending-${id}.json`);

// B-3: a forward checkpoint that is `failed` with `applied` (or `unknown`) rows blocks its batch
// until a successful restore checkpoint bound to that failed run exists. Returns a reason or null.
export function failedBatchGate(ctx, planSha, id) {
  if (existsSync(readbackHoldFile(ctx, id))) return `B-2: ${id} has a pending read-back (${readbackHoldFile(ctx, id)}); run \`readback --batch ${id}\` first`;
  const ck = readCkpt(ctx, planSha, id);
  if (!ck || ck.mode !== 'forward' || ck.outcome !== 'failed') return null;
  const touched = (ck.diff || []).filter(d => d.status === 'applied' || d.status === 'unknown').length;
  if (!touched) return null;
  if (findRestoreOf(ctx, planSha, id, ck.run_id)) return null;
  return `C-1/B-3: ${id} failed with ${touched} applied/unknown row(s) (run ${ck.run_id.slice(0, 8)}); restore it first (\`restore --batch ${id}\`), then re-run`;
}
function findRestoreOf(ctx, planSha, id, runId) {
  const dir = path.join(ctx.paths.checkpoints, planSha.slice(0, 16));
  if (!existsSync(dir)) return null;
  for (const f of readdirSync(dir).filter(f => f.startsWith(`${id}.restore-`))) {
    const c = readJson(path.join(dir, f));
    if (c && c.restore_of_run_id === runId && (c.outcome === 'success' || c.outcome === 'partial')) return c;
  }
  return null;
}

export async function executeBatch(ctx, { plan, sha: planSha }, batch, { mode = 'forward', restoreOf = null } = {}) {
  const run = { id: randomUUID(), startedAt: ctx.now(), step: batch.step, batch: batch.id };
  const ckFile = ckptFile(ctx, planSha, mode === 'forward' ? batch.id : `${batch.id}.restore-${run.id.slice(0, 8)}`);
  ensureDir(path.dirname(ckFile));
  // B-3: a failed forward checkpoint is never overwritten: it is kept under its own run id.
  if (mode === 'forward' && existsSync(ckFile)) {
    const old = readJson(ckFile);
    if (old && old.outcome === 'failed') renameSync(ckFile, ckptFile(ctx, planSha, `${batch.id}.failed-${String(old.run_id).slice(0, 8)}`));
  }

  // E-2: ECA / E-A / Q statements run only when the A write(s) they depend on were applied.
  let statements = batch.statements;
  if (mode === 'forward' && ['ECA', 'EA', 'Q'].includes(batch.step)) {
    const applied = new Set();
    for (const b of plan.batches.filter(x => x.step === 'A')) for (const d of (readCkpt(ctx, planSha, b.id)?.diff || [])) if (d.status === 'applied') applied.add(d.key);
    const withheld = statements.filter(s => !(s.depends_on || []).every(k => applied.has(k)));
    statements = statements.filter(s => (s.depends_on || []).every(k => applied.has(k)));
    if (withheld.length) appendJsonl(path.join(ctx.paths.work, 'withheld-e2.jsonl'), { batch: batch.id, keys: withheld.map(s => s.key) });
  }
  const b = { ...batch, statements };
  const declared = mode === 'forward' ? statements.reduce((a, s) => a + s.est_writes, 0) : batch.est_writes;
  const evWrites = 2 * LIMITS.eventRowWrites;

  // R9-1: cumulative 011 read ceiling, checked before any D1 read of this step (remote only).
  if (!ctx.d1.name.startsWith('local')) {
    const est = estBatchReads(statements.length);
    const rd = readCeilingDecision(readTotals(ctx.paths, ctx.now()), est);
    if (!rd.ok) {
      await report(ctx, run, 'budget_limit', { rows: 0, writes: 0, cursor: { before: batch.id, after: batch.id }, extra: { reason: rd.reason, mode, est_reads: est } });
      return { outcome: 'budget_limit', stop: true, writes: 0 };
    }
  }
  // Headroom gate first (no D1 read when headroom is unavailable), then the
  // pre-image, then the 120 s fetch-age bound re-checked just before executing.
  const gate = await headroomGate(ctx, declared + evWrites);
  const failGate = async (outcome, detail) => {
    await report(ctx, run, outcome, { rows: 0, writes: 0, cursor: { before: batch.id, after: batch.id }, extra: { reason: detail?.reason || detail, mode },
      error: outcome === 'headroom_unavailable' ? { class: 'headroom_unavailable', summary: String(detail) } : null });
    return { outcome, stop: true, writes: 0 };
  };
  if (!gate.ok) return failGate(gate.outcome, gate.detail);
  const { images: pre, reads: preReads } = mode === 'forward' ? await readImages(ctx, b) : { images: restoreOf.images, reads: restoreOf.reads };
  const preFile = path.join(ctx.paths.preimages, planSha.slice(0, 16), `preimage-${batch.step}-${batch.id}${mode === 'forward' ? '' : '.restore'}-${run.id.slice(0, 8)}.json`);
  ensureDir(path.dirname(preFile)); const preText = JSON.stringify(pre) + '\n'; writeFileSync(preFile, preText, { mode: 0o600 });
  const age = ctx.now() - Date.parse(gate.reading.fetchedAt);
  if (age > LIMITS.fetchMaxAgeMs) return failGate('headroom_unavailable', `d1-today fetch is ${age} ms old at batch start (> ${LIMITS.fetchMaxAgeMs} ms)`);
  sendEvent(ctx, eventFor(ctx, run, 'start', { detail: { mode, statements: statements.length, declared_writes: declared } }));   // not awaited

  const runTs = ctx.now().toISOString();
  const sqls = mode === 'forward' ? statements.map(s => renderStatement(s, runTs)) : restoreOf.statements.map(s => s.sql);
  for (const q of sqls) assertTables(q, { write: true });
  let res = [], attempts = 0, failure = null, retryLog = [], probeReads = 0;
  const imgBatch = mode === 'forward' ? b : restoreOf.imageBatch;
  if (sqls.length) {
    try { ({ res, attempts, log: retryLog, probeReads } = await execNoRetryAfterWrites(ctx, sqls, `${mode} ${batch.id}`, pre, imgBatch)); }
    catch (e) { failure = e; retryLog = e.retryLog || []; probeReads = e.probeReads || 0; attempts = retryLog.filter(x => x.phase === 'after-failure').length; }
  }
  // B-2: guarded read-back. On persistent failure: checkpoint (outcome failed, diff unknown,
  // pre-image path) + a hold that blocks a forward re-run until `readback --batch` completes it.
  let post, postReads;
  try { ({ images: post, reads: postReads } = await readImagesRetry(ctx, imgBatch)); }
  catch (re) {
    const ckU = { batch: batch.id, step: batch.step, mode, run_id: run.id, plan_sha256: planSha, run_ts: runTs, outcome: 'failed',
      stops: [`read-back failed after ${READBACK_RETRY_MS.length + 1} attempts: ${redact(re.message).slice(0, 300)}`, ...(failure ? [failure.message] : [])],
      attempts, retry_log: retryLog, declared_writes: declared, writes: sqls.length ? declared : 0, writes_measured: null,
      writes_basis: 'B-5: read-back failed; every row unknown, so the declared writes are counted', reads: preReads + probeReads, mismatches: 0, readback_pending: true,
      tally: { unknown: statements.length }, diff: statements.map(s => ({ key: s.key, kind: s.kind, status: 'unknown', ...(s.entity_id !== undefined ? { entity_id: s.entity_id } : {}) })),
      preimage_file: preFile, preimage_sha256: sha256(preText), readback_file: null, statements: mode === 'forward' ? statements : restoreOf.statements,
      pre, post: null, ...(restoreOf?.restoreOfRunId ? { restore_of_run_id: restoreOf.restoreOfRunId } : {}), headroom: gate.detail, transport: ctx.d1.name };
    writeJsonAtomic(ckFile, ckU);
    writeJsonAtomic(readbackHoldFile(ctx, batch.id), { batch: batch.id, mode, run_id: run.id, checkpoint: ckFile, preimage_file: preFile, utc: ctx.now().toISOString(),
      next: `readback --batch ${batch.id} (read-only), then C-1: restore first if any row was applied` });
    await report(ctx, run, 'failed', { rows: sqls.length, writes: sqls.length ? declared : 0, reads: preReads + probeReads, cursor: { before: batch.id, after: batch.id },
      extra: { mode, checkpoint: ckFile, reason: ckU.stops.join('; '), readback_pending: true }, error: { class: 'readback_failed', summary: ckU.stops.join('; ') } });
    return { outcome: 'failed', stop: true, writes: sqls.length ? declared : 0, ck: ckU, ckFile };
  }
  const postFile = path.join(ctx.paths.readbacks, planSha.slice(0, 16), `readback-${batch.step}-${batch.id}${mode === 'forward' ? '' : '.restore'}-${run.id.slice(0, 8)}.json`);
  ensureDir(path.dirname(postFile)); const postText = JSON.stringify(post) + '\n'; writeFileSync(postFile, postText, { mode: 0o600 });

  // Local replica: SQLite change counts carry no index writes, so a forward batch is
  // counted at its cost-model writes per changed statement (§4.2 basis) to keep the
  // 25k/day and 60k gates realistic in the dry run. D1 runs use measured meta.
  const local = res.some(r => r.meta?.local);
  const writes = local && mode === 'forward'
    ? res.reduce((a, r, i) => a + ((r.meta?.changes || 0) > 0 ? statements[i].est_writes : 0), 0)
    : res.reduce((a, r) => a + (r.meta?.rows_written || 0), 0);
  const maxRead = res.reduce((a, r) => Math.max(a, r.meta?.rows_read || 0), 0);
  const reads = preReads + probeReads + postReads + res.reduce((a, r) => a + (r.meta?.rows_read || 0), 0);
  const meta = res.map((r, i) => ({ key: mode === 'forward' ? statements[i].key : restoreOf.statements[i].key, rows_read: r.meta?.rows_read ?? null, rows_written: r.meta?.rows_written ?? null, changes: r.meta?.changes ?? null }));

  const diff = mode === 'forward' ? diffBatch(b, pre, post, runTs) : restoreOf.verify(post);
  const tally = diff.reduce((a, d) => (a[d.status] = (a[d.status] || 0) + 1, a), {});
  // B-5 (B4R): a failed write call returns no meta, so its measured writes are 0. Rows it did
  // apply are counted from the read-back diff at their cost-model writes, so that 011's own
  // daily count (run log → ownWrites → the 25k cap) never under-counts a failure day.
  let writesCounted = writes, writesBasis = local ? (mode === 'forward' ? 'cost-model (local replica)' : 'sqlite changes (local replica)') : 'd1 meta.rows_written';
  if (failure && !local) {
    const appliedKeys = new Set(diff.filter(d => d.status === 'applied').map(d => d.key));
    const perStmt = mode === 'forward' ? null : Math.max(1, Math.round((batch.est_writes || 0) / Math.max(1, restoreOf.statements.length)));
    const est = (mode === 'forward' ? statements : restoreOf.statements).filter(s => appliedKeys.has(s.key)).reduce((a, s) => a + (perStmt ?? s.est_writes ?? 1), 0);
    if (est > writesCounted) { writesCounted = est; writesBasis = 'B-5: estimated from applied rows (write call failed; no meta)'; }
  }
  const mismatches = tally.mismatch || 0;
  const raced = (tally.raced || 0) + (tally.parent_collision || 0);
  const stops = [];
  if (failure) stops.push(failure.afterWrites || failure.probeFailed ? failure.message : `stopped: ${failure.message}`);
  if (mismatches > LIMITS.mismatchAbs || (statements.length && mismatches / statements.length > LIMITS.mismatchPct)) stops.push(`read-back mismatches ${mismatches} (> ${LIMITS.mismatchAbs} or > 0.5%)`);
  if (writes > LIMITS.writeOverrunFactor * declared && !res.some(r => r.meta?.local)) stops.push(`writes ${writes} > 1.3 × declared ${declared}`);   // measured meta only
  if (maxRead > LIMITS.maxReadsPerExecution) stops.push(`an execution read ${maxRead} > ${LIMITS.maxReadsPerExecution}`);
  if (batch.step === 'P' && mode === 'forward' && (tally.parent_collision || 0) / Math.max(1, statements.length) > LIMITS.parentCollisionPct) stops.push(`parent collision rate ${tally.parent_collision}/${statements.length} > 1%`);
  const outcome = stops.length ? 'failed' : raced ? 'partial' : 'success';
  const metrics = { selected: batch.statements.length, attempted: sqls.length, progressed: tally.applied || 0, raced, failed: mismatches };

  const ck = { batch: batch.id, step: batch.step, mode, run_id: run.id, plan_sha256: planSha, run_ts: runTs, outcome, stops, attempts, retry_log: retryLog,
    declared_writes: declared, writes: writesCounted, writes_measured: writes, writes_basis: writesBasis, reads, max_read: maxRead, mismatches, tally, metrics, meta,
    preimage_file: preFile, preimage_sha256: sha256(preText), readback_file: postFile, readback_sha256: sha256(postText),
    statements: mode === 'forward' ? statements : restoreOf.statements, pre, post, diff, probe_reads: probeReads,
    ...(restoreOf?.restoreOfRunId ? { restore_of_run_id: restoreOf.restoreOfRunId } : {}), headroom: gate.detail, freezes_sha256: ctx.freezesSha || null, transport: ctx.d1.name };
  writeJsonAtomic(ckFile, ck);
  await report(ctx, run, outcome, { rows: sqls.length, writes: writesCounted, reads, metrics, cursor: { before: batch.id, after: outcome === 'failed' ? batch.id : `${batch.id}+` },
    extra: { mode, checkpoint: ckFile, checkpoint_sha256: sha256File(ckFile), tally, ...(stops.length ? { reason: stops.join('; ') } : {}) },
    error: outcome === 'failed' ? { class: failure ? 'd1_failure' : 'stop_condition', summary: stops.join('; ') } : null });
  return { outcome, stop: outcome === 'failed', writes: writesCounted, ck, ckFile };
}

// ── Commands ─────────────────────────────────────────────────────────────

async function startupGates(ctx, run) {
  const f = flagGate(ctx);
  if (f) { await report(ctx, run, f, { extra: { reason: f === 'killed' ? 'stop flag present (kill switch)' : 'pause flag present' } }); return false; }
  const cal = calendarGate(ctx);
  if (!cal.ok) { gateLog(ctx, `refused to start a batch: ${cal.reason}`); return false; }
  let held;
  try { held = await readHold(ctx); }
  catch (e) { await report(ctx, run, 'failed', { error: { class: 'hold_check_failed', summary: e.message } }); return false; }
  if (held) { await report(ctx, run, 'held', { extra: { reason: 'hold_all_jobs is true' } }); return false; }
  return true;
}

export async function cmdRun(ctx) {
  const P = loadPlan(ctx.args.plan);
  if (!P.plan.releasable && !ctx.d1.name.startsWith('local')) throw new Error('this plan is not releasable (dry-run export); refused on a remote transport');
  if (!ctx.d1.name.startsWith('local') && !readTotals(ctx.paths, ctx.now()).cfg) throw new Error('R9-1: read-ceiling.json is missing in the work folder; refused (fail closed)');
  const cur = loadCursor(ctx, P.sha);
  writeFileSync(ctx.paths.pid, String(process.pid));
  const startRun = { id: randomUUID(), startedAt: ctx.now(), step: P.plan.batches[cur.next]?.step || '-', batch: P.plan.batches[cur.next]?.id || '-' };
  if (cur.next >= P.plan.batches.length) { ctx.log('plan complete: nothing to run'); return { done: true }; }
  if (!(await startupGates(ctx, startRun))) return { stopped: 'startup gate' };
  const dropped = await dropEdgeStepsIfAStopped(ctx, P, cur);
  if (dropped?.stopped) return { stopped: dropped.stopped, reason: `deleting ECA/E-A edges after A stopped: ${dropped.why}` };
  const maxBatches = Number(ctx.args['max-batches'] || Infinity);
  let ran = 0;
  while (cur.next < P.plan.batches.length && ran < maxBatches) {
    const batch = P.plan.batches[cur.next];
    // --until <batch id or step>: the operator's day scope (§4.4: e.g. Sat 17 pilot = P + B-001; A starts Wed 21).
    const until = ctx.args.until;
    if (until && (batch.id === until || batch.step === until)) { gateLog(ctx, `stopping before ${batch.id}: --until ${until}`); return { stopped: 'until', at: batch.id }; }
    const run = { id: randomUUID(), startedAt: ctx.now(), step: batch.step, batch: batch.id };
    const f = flagGate(ctx);
    if (f) { await report(ctx, run, f, { cursor: { before: batch.id, after: batch.id }, extra: { reason: f === 'killed' ? 'kill switch' : 'pause flag' } }); return { stopped: f }; }
    const cal = calendarGate(ctx);
    if (!cal.ok) { gateLog(ctx, `stopping before ${batch.id}: ${cal.reason}`); return { stopped: 'calendar' }; }
    const unsigned = reconGate(ctx);
    if (unsigned) { gateLog(ctx, `stopping before ${batch.id}: ${unsigned}`); return { stopped: 'hold', reason: unsigned }; }
    const fb = failedBatchGate(ctx, P.sha, batch.id);
    if (fb) { gateLog(ctx, `stopping before ${batch.id}: ${fb}`); return { stopped: 'hold', reason: fb }; }
    const hold = abGate(ctx, P.plan, P.sha, batch, cur);
    if (hold) { gateLog(ctx, `stopping before ${batch.id}: ${hold}`); saveCursor(ctx, P.sha, cur); return { stopped: 'hold', reason: hold }; }
    ctx.log(`${batch.id} (${batch.step}, ${batch.n_statements} statements, ≈ ${batch.est_writes} writes) …`);
    const r = await executeBatch(ctx, P, batch);
    if (r.outcome === 'success' || r.outcome === 'partial') {
      cur.done[batch.id] = { outcome: r.outcome, writes: r.writes, checkpoint: r.ckFile };
      cur.next++; saveCursor(ctx, P.sha, cur); ran++;
      ctx.log(`  ${r.outcome}: writes ${r.writes}, tally ${JSON.stringify(r.ck.tally)}`);
      // B rows raced by live Phase 3 → the reviewed fallback C-reasons CAS (§4.2c).
      if (batch.step === 'B' && r.outcome === 'partial') {
        const fb = await runFallback(ctx, P, batch, r.ck);
        if (fb) { cur.done[`${batch.id}-fb`] = { outcome: fb.outcome, writes: fb.writes, checkpoint: fb.ckFile }; saveCursor(ctx, P.sha, cur); if (fb.stop) return { stopped: fb.outcome }; }
      }
      if (batch.a_pilot) { writeJsonAtomic(path.join(ctx.paths.holds, 'a-pilot.json'), { batch: batch.id, checkpoint: r.ckFile, utc: ctx.now().toISOString(), next: 'adjudicate ≥ 50 rows (Data-Identity Lead; Ops spot-check) → --a-adjudication' });
        gateLog(ctx, `A pilot ${batch.id} done: holding for the 50-row adjudication (RA-14)`); return { stopped: 'a-pilot hold' }; }
      continue;
    }
    ctx.log(`  ${r.outcome}${r.ck ? `: ${r.ck.stops.join('; ')}` : ''}`);
    if (batch.step === 'A' && r.outcome === 'failed') await dropEdgeStepsIfAStopped(ctx, P, cur);
    return { stopped: r.outcome };
  }
  return { done: cur.next >= P.plan.batches.length, ran };
}

async function runFallback(ctx, P, batch, ck) {
  const racedKeys = new Set(ck.diff.filter(d => d.status === 'raced').map(d => d.key));
  const fb = batch.statements.filter(s => racedKeys.has(s.key) && s.fallback)
    .map(s => ({ kind: 'em_update', step: 'B', key: `${s.key}:fb`, entity_id: s.entity_id, lei: s.lei, set: s.fallback.set, pre: s.fallback.pre, tiers: s.fallback.tiers, est_writes: 2 }));
  if (!fb.length) return null;
  const fbBatch = { id: `${batch.id}-fb`, step: 'B', seq: batch.seq, statements: fb, n_statements: fb.length, est_writes: fb.length * 2 };
  ctx.log(`  ${fbBatch.id}: ${fb.length} raced B rows → fallback C-reasons CAS`);
  return executeBatch(ctx, P, fbBatch);
}

export async function cmdRestore(ctx) {
  const P = loadPlan(ctx.args.plan);
  const cur = loadCursor(ctx, P.sha);
  const failedIds = () => {
    const dir = path.join(ctx.paths.checkpoints, P.sha.slice(0, 16));
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter(f => /^[A-Z0-9]+-\d{3}(-fb)?\.json$/.test(f)).map(f => f.slice(0, -5))
      .filter(id => { const c = readCkpt(ctx, P.sha, id); return c && c.outcome === 'failed' && c.mode === 'forward' && !findRestoreOf(ctx, P.sha, id, c.run_id) && (c.diff || []).some(d => d.status === 'applied'); });
  };
  // B-3: --all includes failed forward batches that have applied rows and no restore yet.
  const ids = ctx.args.all ? restoreOrder([...new Set([...Object.keys(cur.done), ...failedIds()])]) : [ctx.args.batch];
  const run0 = { id: randomUUID(), startedAt: ctx.now(), step: 'restore', batch: ids.join(',').slice(0, 60) };
  if (!(await startupGates(ctx, run0))) return { stopped: 'startup gate' };
  const results = [];
  for (const id of ids) {
    const ck = readCkpt(ctx, P.sha, id);
    if (!ck) throw new Error(`no checkpoint for ${id}`);
    if (ck.readback_pending) throw new Error(`B-2: ${id} has a pending read-back; run \`readback --batch ${id}\` first`);
    const f = flagGate(ctx); if (f) return { stopped: f, results };
    const cal = calendarGate(ctx); if (!cal.ok) { gateLog(ctx, `restore stopped before ${id}: ${cal.reason}`); return { stopped: 'calendar', results }; }
    const batch = { id, step: ck.step, statements: ck.statements };   // the statements actually executed (incl. -fb batches)
    // RA-15 (d): restoring one A batch first deletes the ECA edges whose parent row is
    // in that batch (those parents lose their LEI); other ECA edges are left alone.
    if (!ctx.args.all && ck.step === 'A') {
      const dep = await restoreDependentEca(ctx, P, cur, ck);
      if (dep.some(x => x.outcome !== 'success' && x.outcome !== 'partial')) return { stopped: 'failed', results: [...results, ...dep] };
      results.push(...dep);
    }
    const r = await restoreBatch(ctx, P, batch, ck);
    results.push({ id, outcome: r.outcome, writes: r.writes, tally: r.ck?.tally });
    if (r.outcome === 'success' || r.outcome === 'partial') {
      cur.restored = { ...(cur.restored || {}), [id]: { checkpoint: r.ckFile, utc: ctx.now().toISOString() } };
      delete cur.done[id];
      if (P.plan.batches[cur.next - 1]?.id === id) cur.next--;        // the last batch can be re-applied by `run`
      saveCursor(ctx, P.sha, cur);
    }
    if (r.stop) return { stopped: r.outcome, results };
  }
  return { results };
}

export function restoreOrder(ids) {
  return ids.slice().sort((a, b) => {
    const sa = RESTORE_ORDER.indexOf(a.split('-')[0]), sb = RESTORE_ORDER.indexOf(b.split('-')[0]);
    return sa - sb || b.localeCompare(a);
  });
}

// ECA edges that depend on the A rows of one A checkpoint (statement depends_on
// "A:<parent entity_id>"), restored from each ECA checkpoint as a partial batch.
export async function restoreDependentEca(ctx, P, cur, aCk) {
  const aKeys = new Set(aCk.diff.filter(d => d.status === 'applied').map(d => d.key));
  const out = [];
  for (const id of Object.keys(cur.done).filter(x => x.split('-')[0] === 'ECA')) {
    const ck = readCkpt(ctx, P.sha, id);
    const keys = new Set(ck.statements.filter(s => (s.depends_on || []).some(k => aKeys.has(k))).map(s => s.key));
    const applied = ck.diff.filter(d => keys.has(d.key) && d.status === 'applied');
    if (!applied.length) continue;
    const part = { ...ck, diff: ck.diff.filter(d => keys.has(d.key)), statements: ck.statements.filter(s => keys.has(s.key)) };
    gateLog(ctx, `restore ${aCk.batch}: deleting ${applied.length} dependent ECA edge(s) of ${id} first (RA-15)`);
    const r = await restoreBatch(ctx, P, { id, step: 'ECA', statements: part.statements }, part);
    out.push({ id, partial_for: aCk.batch, keys: [...keys], outcome: r.outcome, writes: r.writes });
    if (r.outcome === 'success' || r.outcome === 'partial') {
      cur.partially_restored = { ...(cur.partially_restored || {}), [id]: [...new Set([...(cur.partially_restored?.[id] || []), ...keys])] };
      saveCursor(ctx, P.sha, cur);
    }
  }
  return out;
}

// Restores one forward checkpoint, then verifies each restored row equals its
// original pre-image on the restored columns; rows a live job changed after 011
// are listed (CAS miss), never clobbered.
export async function restoreBatch(ctx, P, batch, ck) {
  const stmts = restoreStatements(batch, ck);
  const appliedKeys = new Set(ck.diff.filter(d => d.status === 'applied').map(d => d.key));
  const imageBatch = { ...batch, statements: batch.statements.filter(s => appliedKeys.has(s.key)) };
  const { images, reads } = await readImages(ctx, imageBatch);
  const byId = rows => new Map((rows || []).map(r => [String(r.entity_id), r]));
  const orig = ck.pre;
  const verify = post => stmts.map(s => {
    if (s.cols) {
      const o = byId(orig.em).get(String(s.entity_id)), p = byId(post.em).get(String(s.entity_id));
      return { key: s.key, kind: 'restore', status: p && s.cols.every(c => same(p[c], o[c])) ? 'applied' : (p && rowEq(p, byId(images.em).get(String(s.entity_id)), COMPARE_COLS) ? 'raced' : 'mismatch') };
    }
    if (s.key.startsWith('Q:')) {
      const o = byId(orig.queue).get(String(s.entity_id)), p = byId(post.queue).get(String(s.entity_id));
      return { key: s.key, kind: 'restore', status: p && same(p.status, o.status) && same(p.last_attempt, o.last_attempt) ? 'applied' : 'mismatch' };
    }
    if (s.key.startsWith('P:')) {
      const gone = !(post.em_lei || []).some(r => String(r.entity_id) === String(s.entity_id));
      return { key: s.key, kind: 'restore', status: gone ? 'applied' : 'raced' };
    }
    const d = ck.diff.find(x => x.key === s.key);
    const still = (post.edge || []).some(e => e.parent_entity_id === d.parent_entity_id && e.child_entity_id === d.child_entity_id && e.relationship_type === 'legal_parent' && e.source === 'gleif');
    return { key: s.key, kind: 'restore', status: still ? 'mismatch' : 'applied' };
  });
  const est = Math.max(ck.writes || 0, stmts.length);              // a restore reverses the same index changes
  return executeBatch(ctx, P, { ...batch, est_writes: est }, { mode: 'restore', restoreOf: { statements: stmts, images, reads, imageBatch, verify, restoreOfRunId: ck.run_id } });
}

// EXPLAIN set (§6 (i)): one representative of every statement pattern, as-run form.
export function explainSet(plan) {
  const pick = (step, kind) => plan.batches.find(b => b.step === step)?.statements.find(s => s.kind === kind);
  const runTs = '2026-10-17T08:00:00.000Z';
  const out = [];
  const add = (id, sql, expect) => out.push({ id, sql: `EXPLAIN QUERY PLAN ${sql}`, expect });
  add('X1', `SELECT ${EM_COLS.join(', ')} FROM entity_master WHERE entity_id > 0 ORDER BY entity_id LIMIT 5000`, /SEARCH entity_master USING INTEGER PRIMARY KEY \(rowid>\?\)/);
  add('X2q', `SELECT entity_id, name, status, retry_after, last_attempt FROM entity_enrichment_queue WHERE entity_id > 0 ORDER BY entity_id LIMIT 5000`, /SEARCH entity_enrichment_queue USING INTEGER PRIMARY KEY \(rowid>\?\)/);
  add('X2r', `SELECT rowid, parent_entity_id, child_entity_id, relationship_type, source FROM entity_relationships WHERE rowid > 0 ORDER BY rowid LIMIT 5000`, /SEARCH entity_relationships USING INTEGER PRIMARY KEY \(rowid>\?\)/);
  const someIds = plan.batches.find(b => b.step === 'B').statements.slice(0, 3).map(s => s.entity_id);
  add('V1', `SELECT ${EM_COLS.join(', ')} FROM entity_master WHERE entity_id IN (${someIds.join(', ')})`, /SEARCH entity_master USING INTEGER PRIMARY KEY \(rowid=\?\)/);
  const leis = plan.batches.find(b => b.step === 'P')?.statements.slice(0, 3).map(s => lit(s.values.lei)).join(', ') || "'X'";
  add('V2', `SELECT ${EM_COLS.join(', ')} FROM entity_master INDEXED BY idx_entity_master_lei WHERE lei IN (${leis})`, /^SEARCH entity_master USING (COVERING )?INDEX idx_entity_master_lei \(lei=\?\)$/);
  add('V2p', `SELECT entity_id, lei FROM entity_master INDEXED BY idx_entity_master_lei WHERE lei IN (${leis})`, /^SEARCH entity_master USING (COVERING )?INDEX idx_entity_master_lei \(lei=\?\)$/);
  add('V2e', `SELECT parent_entity_id, child_entity_id, relationship_type, source FROM entity_relationships WHERE child_entity_id IN (${someIds.join(', ')})`, /SEARCH entity_relationships USING INDEX idx_entity_rel_child \(child_entity_id=\?\)/);
  add('V2q', `SELECT entity_id, status, retry_after, last_attempt FROM entity_enrichment_queue WHERE entity_id IN (${someIds.join(', ')})`, /SEARCH entity_enrichment_queue USING INTEGER PRIMARY KEY \(rowid=\?\)/);
  for (const [id, step, kind, re] of [['W1-B', 'B', 'em_update', /SEARCH entity_master USING INTEGER PRIMARY KEY \(rowid=\?\)/],
                                      ['W1-C', 'C', 'em_update', /SEARCH entity_master USING INTEGER PRIMARY KEY \(rowid=\?\)/],
                                      ['W1-CR', 'CR', 'em_update', /SEARCH entity_master USING INTEGER PRIMARY KEY \(rowid=\?\)/],
                                      ['W1-A', 'A', 'em_update', /SEARCH (entity_master|o) USING .*INDEX idx_entity_master_lei \(lei=\?\)/],
                                      ['W2', 'P', 'em_insert', null],
                                      ['W4', 'EC', 'edge_insert', /SEARCH (p|x) USING .*INDEX idx_entity_master_lei \(lei=\?\)/],
                                      ['W3', 'Q', 'q_update', /SEARCH entity_enrichment_queue USING INTEGER PRIMARY KEY \(rowid=\?\)/]]) {
    const s = pick(step, kind); if (s) add(id, renderStatement(s, runTs), re);
  }
  // Fallback CAS (§4.2c) and the restore patterns (§10), rendered exactly as restoreStatements() does.
  const fb = plan.batches.filter(b => b.step === 'B').flatMap(b => b.statements).find(x => x.fallback);
  if (fb) add('W1-fb', renderStatement({ kind: 'em_update', entity_id: fb.entity_id, set: fb.fallback.set, pre: fb.fallback.pre }, runTs), /^SEARCH entity_master USING INTEGER PRIMARY KEY \(rowid=\?\)$/);
  const anyId = someIds[0];
  const fake = { em: [{ entity_id: anyId, direct_parent_exception: 'NO_LINK_DECLARED', gleif_enrichment_version: 1 }], queue: [{ entity_id: anyId, status: 'pending', last_attempt: null }] };
  const fakePost = { em: [{ entity_id: anyId, direct_parent_exception: 'X', gleif_enrichment_version: 11 }], queue: [{ entity_id: anyId, status: 'complete', last_attempt: runTs }], edge: [] };
  const rs = restoreStatements({}, { pre: fake, post: fakePost, diff: [
    { key: 'R:em', kind: 'em_update', status: 'applied', entity_id: anyId, cols: ['direct_parent_exception', 'gleif_enrichment_version'] },
    { key: 'R:p', kind: 'em_insert', status: 'applied', entity_id: anyId },
    { key: 'R:e', kind: 'edge_insert', status: 'applied', parent_entity_id: anyId, child_entity_id: anyId },
    { key: 'Q:r', kind: 'q_update', status: 'applied', entity_id: anyId }] });
  add('R1-em', rs[0].sql, /^SEARCH entity_master USING INTEGER PRIMARY KEY \(rowid=\?\)$/);
  add('R2-P', rs[1].sql, /SEARCH entity_master USING INTEGER PRIMARY KEY \(rowid=\?\).*SEARCH r USING (COVERING )?INDEX idx_entity_rel_parent .*SEARCH r USING (COVERING )?INDEX idx_entity_rel_child/);
  add('R3-edge', rs[2].sql, /^SEARCH entity_relationships USING INDEX sqlite_autoindex_entity_relationships_1 \(parent_entity_id=\? AND child_entity_id=\? AND relationship_type=\?\)$/);
  add('R4-q', rs[3].sql, /^SEARCH entity_enrichment_queue USING INTEGER PRIMARY KEY \(rowid=\?\)$/);
  add('RECON', reconQuery('2026-10-17'), /^SEARCH ops_job_run USING INDEX idx_ops_job_run_job_at \(job_id=\? AND started_at>\? AND started_at<\?\)/);
  add('HOLD', `SELECT value FROM holdings_pipeline_state WHERE key = 'hold_all_jobs'`, /SEARCH holdings_pipeline_state USING (INDEX|PRIMARY KEY|INTEGER PRIMARY KEY)/);
  return out;
}

// Point statements may not SCAN any table (aliases p/c/x/o are entity_master): stricter than §6's named list.
const SCAN_FORBIDDEN = /(^|\| )SCAN (?!CONSTANT ROW)/;

export async function cmdExplain(ctx) {
  const P = loadPlan(ctx.args.plan);
  const set = explainSet(P.plan);
  for (const e of set) assertReadOnly(e.sql);
  const res = await ctx.d1.exec(set.map(e => e.sql), { label: 'explain-set' });
  const rows = set.map((e, i) => {
    const details = res[i].results.map(r => r.detail);
    const text = details.join(' | ');
    const scan = SCAN_FORBIDDEN.test(text);
    const ok = !scan && (!e.expect || e.expect.test(text));
    return { id: e.id, ok, scan, plan: details, rows_read: res[i].meta.rows_read ?? null, rows_written: res[i].meta.rows_written ?? null };
  });
  const out = { utc: ctx.now().toISOString(), plan_sha256: P.sha, transport: ctx.d1.name, all_ok: rows.every(r => r.ok), rows };
  const f = path.join(ctx.paths.work, `explain-${ctx.d1.name}-${out.utc.replace(/[:.]/g, '')}.json`);
  writeJsonAtomic(f, out);
  ctx.log(JSON.stringify({ file: f, sha256: sha256File(f), all_ok: out.all_ok, rows: rows.map(r => `${r.id} ${r.ok ? 'OK' : 'FAIL'} ${r.plan.join(' | ')}`) }, null, 1));
  return out;
}

// B-2 completion: a read-only read-back of a batch whose checkpoint is `readback_pending`,
// diffed against the ORIGINAL pre-image in that checkpoint; the completed checkpoint keeps
// outcome `failed` (C-1 then decides: restore first if any row was applied). Lifts the hold.
export async function cmdReadback(ctx) {
  const P = loadPlan(ctx.args.plan);
  const id = ctx.args.batch;
  const ckFile = ckptFile(ctx, P.sha, id);
  const ck = readJson(ckFile);
  if (!ck || !ck.readback_pending) throw new Error(`${id}: no pending read-back`);
  const batch = { id, step: ck.step, statements: ck.statements };
  const { images: post, reads } = await readImagesRetry(ctx, batch);
  const diff = diffBatch(batch, ck.pre, post, ck.run_ts);
  const tally = diff.reduce((a, d) => (a[d.status] = (a[d.status] || 0) + 1, a), {});
  const postText = JSON.stringify(post) + '\n';
  const postFile = path.join(ctx.paths.readbacks, P.sha.slice(0, 16), `readback-${ck.step}-${id}-completed-${String(ck.run_id).slice(0, 8)}.json`);
  ensureDir(path.dirname(postFile)); writeFileSync(postFile, postText, { mode: 0o600 });
  const done = { ...ck, readback_pending: false, readback_completed_at: ctx.now().toISOString(), post, diff, tally, mismatches: tally.mismatch || 0,
    readback_file: postFile, readback_sha256: sha256(postText), reads: (ck.reads || 0) + reads };
  writeJsonAtomic(ckFile, done);
  unlinkSync(readbackHoldFile(ctx, id));
  gateLog(ctx, `readback ${id}: checkpoint completed against the original pre-image; tally ${JSON.stringify(tally)}`);
  return { batch: id, tally, checkpoint: ckFile };
}

// R-4 / OPS-R8 daily reconciliation export: that day's ops_job_run rows for
// manual.gleif-reconcile-011 (≤ 300 reads) and that day's run-log lines, both
// with SHA-256s, to <work>/recon/<date>/. The Operations Lead reconciles from
// these files and signs by 09:00 UTC the next day; an unsigned day blocks the
// next day's first batch (sign-off file recon/<date>/ops-signoff.json).
export async function cmdRecon(ctx) {
  const date = ctx.args.date || ctx.now().toISOString().slice(0, 10);
  const dir = ensureDir(path.join(ctx.paths.work, 'recon', date));
  const [r] = await ctx.d1.exec([reconQuery(date)], { label: `recon ${date}` });
  if ((r.meta.rows_read || 0) > 300) throw new Error(`recon read ${r.meta.rows_read} > 300`);
  if (r.results.length >= 150) throw new Error('recon hit its 150-row bound: export the day in two halves');
  const ops = JSON.stringify(r.results, null, 1) + '\n';
  const rl = readJsonl(ctx.paths.runlog).filter(x => String(x.utc).slice(0, 10) === date);
  const rlText = rl.map(x => JSON.stringify(x)).join('\n') + (rl.length ? '\n' : '');
  writeFileSync(path.join(dir, 'ops_job_run.json'), ops, { mode: 0o600 });
  writeFileSync(path.join(dir, 'runlog.jsonl'), rlText, { mode: 0o600 });
  // A first cut for the Operations Lead (they reconcile; this does not sign anything).
  const ends = new Map(r.results.filter(x => x.phase === 'end').map(x => [x.run_id, x]));
  const unmatched = rl.filter(x => !ends.has(x.run_key)).map(x => ({ run_key: x.run_key, batch: x.batch, outcome: x.outcome }));
  const man = { date, exported_at: ctx.now().toISOString(), job_id: JOB_ID, rows_read: r.meta.rows_read ?? null,
    files: { 'ops_job_run.json': { rows: r.results.length, sha256: sha256(ops) }, 'runlog.jsonl': { lines: rl.length, sha256: sha256(rlText) } },
    first_cut: { runlog_lines: rl.length, ops_end_events: ends.size, runlog_lines_without_ops_end_event: unmatched.length, unmatched: unmatched.slice(0, 50) },
    signoff_expected: path.join(dir, 'ops-signoff.json'),
    reads_011: (() => { const t = readTotals(ctx.paths, ctx.now()); return { cumulative: t.cumulative, ceiling: t.ceiling, today: t.today, day_max: t.day_max, since: t.cfg?.since ?? null }; })() };
  writeJsonAtomic(path.join(dir, 'manifest.json'), man);
  ctx.log(JSON.stringify(man, null, 1));
  return man;
}

// Read-only probe: live pre-images for up to N planned rows per step, compared
// with the plan's expected pre-image. Measures per-pattern rows_read (§6 (ii))
// and drift since the plan's export. 0 writes (read-only transport).
export async function cmdProbe(ctx) {
  const P = loadPlan(ctx.args.plan);
  const n = Math.min(Number(ctx.args.rows || 50), 250);
  const out = { utc: ctx.now().toISOString(), plan_sha256: P.sha, per_step: {} };
  let total = 0;
  for (const step of STEP_ORDER) {
    const ss = P.plan.batches.filter(b => b.step === step).flatMap(b => b.statements).slice(0, n);
    if (!ss.length) continue;
    const b = { id: `probe-${step}`, step, statements: ss };
    const qs = imageQueries(b);
    const res = await ctx.d1.exec(qs.map(q => q.sql), { label: `probe ${step}` });
    const images = {}; const reads = {};
    qs.forEach((q, i) => { images[q.key] = res[i].results; reads[q.key] = res[i].meta.rows_read ?? null; total += res[i].meta.rows_read || 0; });
    let match = 0, drift = [];
    for (const s of ss) {
      if (s.kind === 'em_update') {
        const r = (images.em || []).find(x => String(x.entity_id) === String(s.entity_id));
        const bad = r ? Object.entries(s.pre).filter(([c, v]) => !same(r[c], v)).map(([c]) => c) : ['row missing'];
        if (!bad.length) match++; else drift.push({ key: s.key, cols: bad });
      } else if (s.kind === 'em_insert') {
        if (!(images.em_lei || []).some(r => r.lei === s.values.lei)) match++; else drift.push({ key: s.key, cols: ['lei now held'] });
      } else if (s.kind === 'q_update') {
        const r = (images.queue || []).find(x => String(x.entity_id) === String(s.entity_id));
        if (r && (r.status === 'pending' || r.status === 'failed')) match++; else drift.push({ key: s.key, cols: ['queue status ' + (r ? r.status : 'missing')] });
      } else match++;
    }
    out.per_step[step] = { sampled: ss.length, pre_image_still_matches: match, drift: drift.slice(0, 20), drift_count: drift.length, rows_read: reads };
  }
  out.total_rows_read = total;
  const f = path.join(ctx.paths.work, `probe-${out.utc.replace(/[:.]/g, '')}.json`);
  writeJsonAtomic(f, out);
  ctx.log(JSON.stringify({ file: f, sha256: sha256File(f), total_rows_read: total,
    per_step: Object.fromEntries(Object.entries(out.per_step).map(([k, v]) => [k, `${v.pre_image_still_matches}/${v.sampled} match; reads ${JSON.stringify(v.rows_read)}`])) }, null, 1));
  return out;
}

// Rollback rehearsal (§11): ≤ 20 rows of one step, applied then restored,
// inside a hard write budget. Rows whose live state no longer matches the
// plan's pre-image are skipped, so only unchanged rows are touched.
export async function cmdRehearse(ctx) {
  const P = loadPlan(ctx.args.plan);
  const step = ctx.args.step || 'CR';
  const n = Math.min(Number(ctx.args.rows || 20), 20);
  const budget = Math.min(Number(ctx.args['max-writes'] || 100), 100);
  const candidates = P.plan.batches.filter(b => b.step === step).flatMap(b => b.statements).filter(s => s.kind === 'em_update');
  const probe = { id: `RH-${step}-probe`, step, statements: candidates.slice(0, Math.min(candidates.length, n * 3)) };
  const run0 = { id: randomUUID(), startedAt: ctx.now(), step: 'rehearsal', batch: probe.id };
  if (!(await startupGates(ctx, run0))) return { stopped: 'startup gate' };
  const { images } = await readImages(ctx, probe);
  const live = new Map((images.em || []).map(r => [String(r.entity_id), r]));
  const chosen = probe.statements.filter(s => { const r = live.get(String(s.entity_id)); return r && Object.entries(s.pre).every(([c, v]) => same(r[c], v)); }).slice(0, n);
  const fwd = chosen.reduce((a, s) => a + s.est_writes, 0);
  if (!chosen.length) throw new Error('rehearsal: no rows still match the plan pre-image');
  if (2 * fwd > budget) throw new Error(`rehearsal: ${chosen.length} rows ≈ ${fwd} writes forward + ${fwd} restore > budget ${budget}`);
  const batch = { id: `RH-${step}-001`, step, seq: -1, statements: chosen, n_statements: chosen.length, est_writes: fwd };
  ctx.log(`rehearsal ${batch.id}: ${chosen.length} rows, ≈ ${fwd} writes forward + ${fwd} restore (budget ${budget})`);
  const f = await executeBatch(ctx, P, batch);
  if (f.outcome !== 'success' && f.outcome !== 'partial') return { forward: f.outcome };
  const r = await restoreBatch(ctx, P, batch, f.ck);
  const total = f.writes + r.writes;
  const back = r.ck ? r.ck.diff.every(d => d.status === 'applied') : false;
  const out = { batch: batch.id, rows: chosen.length, forward: { outcome: f.outcome, writes: f.writes, tally: f.ck.tally }, restore: { outcome: r.outcome, writes: r.writes, tally: r.ck?.tally },
    total_writes: total, within_budget: total <= budget, all_rows_back_to_preimage: back, forward_checkpoint: f.ckFile, restore_checkpoint: r.ckFile };
  writeJsonAtomic(path.join(ctx.paths.work, `rehearsal-${ctx.now().toISOString().replace(/[:.]/g, '')}.json`), out);
  ctx.log(JSON.stringify(out, null, 1));
  return out;
}

// Local replica (live DDL from the 006 D0 catalog) loaded from an export, for
// the dry run and the tests. Never touches D1.
export async function buildReplica(out, exportSpec = 'd2') {
  const { loadExport } = await import('./gleif-reconcile-011-plan.mjs');
  const { DatabaseSync } = await import('node:sqlite');
  if (existsSync(out)) unlinkSync(out);
  const db = new DatabaseSync(out);
  db.exec(REPLICA_DDL);
  const exp = await loadExport(exportSpec);
  const ins = (table, cols, rows) => {
    const st = db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`);
    db.exec('BEGIN'); for (const r of rows) st.run(...cols.map(c => r[c] ?? null)); db.exec('COMMIT');
  };
  ins('entity_master', [...EM_COLS, 'created_at'], exp.em.map(r => ({ ...r, gleif_enrichment_version: r.gleif_enrichment_version ?? 1 })));
  ins('entity_enrichment_queue', ['entity_id', 'name', 'status', 'retry_after', 'last_attempt'], exp.queue.map(r => ({ ...r, name: r.name || '?' })));
  ins('entity_relationships', ['parent_entity_id', 'child_entity_id', 'relationship_type', 'source'], exp.rel);
  db.prepare(`INSERT INTO holdings_pipeline_state (key, value) VALUES ('hold_all_jobs', 'false')`).run();
  db.close();
  return { out, rows: exp.em.length, export: exp.kind };
}

const REPLICA_DDL = `
CREATE TABLE entity_master ( entity_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, normalized_name TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('operating','holding','fund','manager','government','spv')), lei TEXT NULL, lei_status TEXT NULL, country TEXT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, legal_name TEXT, other_names TEXT, entity_category TEXT, entity_status TEXT, expiration_date TEXT, expiration_reason TEXT, legal_address_line1 TEXT, legal_address_city TEXT, legal_address_region TEXT, legal_address_country TEXT, legal_address_postcode TEXT, hq_city TEXT, hq_country TEXT, legal_jurisdiction TEXT, legal_form_code TEXT, legal_form_text TEXT, business_register_id TEXT, registration_authority TEXT, lei_registration_status TEXT, lei_initial_registration TEXT, lei_last_updated TEXT, lei_next_renewal TEXT, lei_validation_source TEXT, bic_codes TEXT, primary_ticker TEXT, direct_parent_lei TEXT, direct_parent_name TEXT, direct_parent_relationship_status TEXT, direct_parent_period_start TEXT, direct_parent_exception TEXT, ultimate_parent_lei TEXT, ultimate_parent_name TEXT, ultimate_parent_relationship_status TEXT, ultimate_parent_exception TEXT, has_etf_holdings INTEGER DEFAULT 0, etf_holding_count INTEGER DEFAULT 0, has_13f_filings INTEGER DEFAULT 0, has_market_data INTEGER DEFAULT 0, gleif_last_updated TEXT, gleif_enrichment_version INTEGER DEFAULT 1, isin_match_count INTEGER DEFAULT 0, match_source TEXT, cik TEXT, UNIQUE(normalized_name, type) );
CREATE INDEX idx_entity_master_direct_parent ON entity_master(direct_parent_lei);
CREATE INDEX idx_entity_master_jurisdiction ON entity_master(legal_jurisdiction);
CREATE INDEX idx_entity_master_lei ON entity_master(lei);
CREATE INDEX idx_entity_master_match_source ON entity_master(match_source);
CREATE INDEX idx_entity_master_normalized ON entity_master(normalized_name);
CREATE INDEX idx_entity_master_phase3 ON entity_master(lei, type, lei_status, direct_parent_lei, ultimate_parent_lei, direct_parent_exception) WHERE lei IS NOT NULL;
CREATE INDEX idx_entity_master_status ON entity_master(entity_status);
CREATE INDEX idx_entity_master_type ON entity_master(type);
CREATE INDEX idx_entity_master_ultimate_parent ON entity_master(ultimate_parent_lei);
CREATE TABLE entity_enrichment_queue ( entity_id INTEGER PRIMARY KEY, name TEXT NOT NULL, country_hint TEXT NULL, type_hint TEXT NULL, isin_hint TEXT NULL, lookup_method TEXT NULL CHECK(lookup_method IN ('isin','name_search',NULL)), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','complete','failed')), retry_after DATETIME NULL, last_attempt DATETIME NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP );
CREATE INDEX idx_enrich_queue_status ON entity_enrichment_queue(status, retry_after);
CREATE TABLE entity_relationships ( parent_entity_id INTEGER NOT NULL, child_entity_id INTEGER NOT NULL, relationship_type TEXT NOT NULL CHECK(relationship_type IN ('legal_parent','fund_manager','umbrella_fund','peer')), source TEXT NOT NULL CHECK(source IN ('gleif','etf_universe','manual')), created_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (parent_entity_id, child_entity_id, relationship_type) );
CREATE INDEX idx_entity_rel_child ON entity_relationships(child_entity_id);
CREATE INDEX idx_entity_rel_parent ON entity_relationships(parent_entity_id);
CREATE TABLE holdings_pipeline_state (key TEXT PRIMARY KEY, value TEXT);
`;

// ── CLI ──────────────────────────────────────────────────────────────────

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { parseArgs } = await import('./gleif-reconcile-011-plan.mjs');
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  const writeCmds = new Set(['run', 'restore', 'rehearse']);
  if (!['run', 'restore', 'readback', 'explain', 'probe', 'recon', 'rehearse', 'build-replica'].includes(cmd)) {
    console.error('usage: gleif-reconcile-011.mjs run|restore|explain|rehearse --plan <dir> [--transport remote|local:<db>] | build-replica --out <db> [--export d2|<dir>]');
    process.exit(2);
  }
  // §7 / F6: interactive only — an attended operator run, never launchd or cron.
  if (writeCmds.has(cmd) && (process.ppid === 1 || !args.operator)) {
    console.error('refused: the 011 runner is interactive only (§7): start it from an attended session with --operator <name>; never from launchd');
    process.exit(2);
  }
  let ctx, code = 0;
  const onSignal = sig => { if (ctx) { ctx.stopRequested = true; console.error(`${sig}: kill switch — finishing the in-flight call, then checkpoint and exit`); } };
  process.on('SIGTERM', () => onSignal('SIGTERM')); process.on('SIGINT', () => onSignal('SIGINT'));
  try {
    if (cmd === 'build-replica') console.log(JSON.stringify(await buildReplica(args.out, args.export || 'd2')));
    else {
      ctx = await makeContext(args, { write: writeCmds.has(cmd) });
      if (ctx.ingestWhy) console.log(`heartbeats: ${ctx.ingestWhy}${ctx.outboxLive ? '' : '; outbox module absent'} — runlog.jsonl is the record of truth`);
      const r = cmd === 'run' ? await cmdRun(ctx) : cmd === 'restore' ? await cmdRestore(ctx) : cmd === 'readback' ? await cmdReadback(ctx) : cmd === 'explain' ? await cmdExplain(ctx) : cmd === 'probe' ? await cmdProbe(ctx) : cmd === 'recon' ? await cmdRecon(ctx) : await cmdRehearse(ctx);
      console.log(JSON.stringify(r && (r.rows ? { all_ok: r.all_ok } : r.per_step ? { total_rows_read: r.total_rows_read } : r)));
      if (r && ['failed', 'headroom_unavailable', 'killed'].includes(r.stopped)) code = 1;
      if (r && r.all_ok === false) code = 1;
    }
  } catch (e) {
    console.error('RUNNER ERROR:', redact(e.message));
    code = 1;
  }
  try { const pid = workPaths(args.work).pid; if (existsSync(pid) && readFileSync(pid, 'utf8') === String(process.pid)) unlinkSync(pid); } catch { /* ignore */ }
  process.exit(code);
}
