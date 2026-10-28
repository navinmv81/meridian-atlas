#!/usr/bin/env node
// MA-OCT-011 dry run (Task item 4; spec §9 "before the run"): executes a whole
// plan against a LOCAL replica (live DDL + the plan's export), with a simulated
// clock walking the §4.4 calendar from Sat 17 Oct, a stubbed d1-today, the A
// pilot hold and the E-A release, then applies the §9 post-run checks, then a
// full rollback (§10) and compares the replica with its original content.
// 0 D1 calls, 0 GLEIF calls.
//
//   node tests/gleif-reconcile-011-dryrun.mjs --plan <dir> --replica <db> --out <dir>

import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { calendarCheck, loadFreezes, readJsonl, sha256, sha256File } from '../lib/gleif-reconcile-011-core.mjs';
import { makeContext, cmdRun, cmdRestore } from '../scripts/gleif-reconcile-011.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');

export async function simulate({ planDir, replica, out, start = '2026-10-17T07:20:00Z', log = () => {} }) {
  mkdirSync(out, { recursive: true });
  const db = path.join(out, 'replica.db');
  copyFileSync(replica, db);
  let t = Date.parse(start);
  const now = () => new Date(t);
  const ctx = await makeContext({ plan: planDir, transport: `local:${db}`, work: path.join(out, 'work'), operator: 'dry-run' },
    { write: true, now, sleep: async () => {}, ingestCfg: null, log,
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, date: now().toISOString().slice(0, 10), rowsWritten: 10000 }) }),
      pauseFlag: path.join(out, 'paused'), stopFlag: path.join(out, 'stop') });
  const q = sql => ctx.d1.db.prepare(sql).get().n;
  const dump = () => ['SELECT * FROM entity_master ORDER BY entity_id', 'SELECT * FROM entity_relationships ORDER BY parent_entity_id, child_entity_id, relationship_type',
                      'SELECT * FROM entity_enrichment_queue ORDER BY entity_id'].map(s => ctx.d1.db.prepare(s).all().map(r => JSON.stringify(r)).join('\n')).join('\n#\n');
  const original = sha256(dump());
  const dupSet = () => new Set(ctx.d1.db.prepare('SELECT lei FROM entity_master WHERE lei IS NOT NULL GROUP BY lei HAVING COUNT(*) > 1').all().map(r => r.lei));
  const dupBefore = dupSet();
  const before = { lei_rows: q('SELECT COUNT(*) n FROM entity_master WHERE lei IS NOT NULL'), legal_parent: q("SELECT COUNT(*) n FROM entity_relationships WHERE relationship_type = 'legal_parent'"), duplicate_leis: dupBefore.size };
  const holds = [];
  for (let i = 0; i < 600; i++) {
    const r = await cmdRun(ctx);
    if (r.done) break;
    if (r.stopped === 'a-pilot hold') {
      const f = path.join(out, 'a-adjudication.json');
      writeFileSync(f, JSON.stringify({ batch: 'A-001', adjudicated: 50, correct: 50, data_identity_lead: 'DRY-RUN (simulated)', ops_spot_check: true }));
      ctx.args['a-adjudication'] = f; holds.push({ utc: now().toISOString(), hold: 'A pilot' }); continue;
    }
    if (r.stopped === 'hold' && /--ea-release/.test(r.reason)) {
      // RA-15: the Operations Lead's release must name ECA explicitly, or ECA stays blocked.
      if (ctx.args['ea-release']) throw new Error(`release supplied but still held: ${r.reason}`);
      const f = path.join(out, 'ea-release.json');
      writeFileSync(f, JSON.stringify({ release: 'EA', steps: ['ECA', 'EA'], no_open_trigger: true, by: 'DRY-RUN (simulated)' }));
      ctx.args['ea-release'] = f; holds.push({ utc: now().toISOString(), hold: 'ECA/E-A release', reason: r.reason }); continue;
    }
    if (r.stopped === 'hold') throw new Error(`unexpected hold: ${r.reason}`);
    t += 20 * 60000;                                          // calendar / budget: next check 20 min later
  }
  const rl = readJsonl(ctx.paths.runlog);
  const freezes = loadFreezes(path.join(REPO, 'claude', 'relays', 'FREEZES.json'));
  const tally = {}; const perDay = {};
  for (const x of rl.filter(x => x.tally)) {
    tally[x.step] = tally[x.step] || {};
    for (const [k, n] of Object.entries(x.tally)) tally[x.step][k] = (tally[x.step][k] || 0) + n;
  }
  for (const x of rl.filter(x => x.writes > 0 && x.mode === 'forward')) { const d = x.utc.slice(0, 10); perDay[d] = (perDay[d] || 0) + x.writes; }
  const after = {
    lei_rows_excl_new_parents: q('SELECT COUNT(*) n FROM entity_master WHERE lei IS NOT NULL') - q("SELECT COUNT(*) n FROM entity_master WHERE type = 'holding' AND gleif_enrichment_version = 11 AND created_at >= '2026-10-01'"),
    new_parent_rows: q("SELECT COUNT(*) n FROM entity_master WHERE type = 'holding' AND gleif_enrichment_version = 11 AND created_at >= '2026-10-01'"),
    phase3_pool: q(`SELECT COUNT(*) n FROM entity_master WHERE lei IS NOT NULL AND type != 'fund' AND (lei_status IS NULL OR (direct_parent_lei IS NULL AND ultimate_parent_lei IS NULL AND direct_parent_exception IS NULL))`),
    no_link_declared: q(`SELECT COUNT(*) n FROM entity_master WHERE direct_parent_exception = 'NO_LINK_DECLARED'`),
    ultimate_exception_on_existing_rows: q(`SELECT COUNT(*) n FROM entity_master WHERE ultimate_parent_exception IS NOT NULL AND created_at < '2026-10-01'`),
    legal_parent_edges: q(`SELECT COUNT(*) n FROM entity_relationships WHERE relationship_type = 'legal_parent'`),
    a_rows: q(`SELECT COUNT(*) n FROM entity_master WHERE match_source = 'gc_name_t1'`),
    queue_closed_by_011: q(`SELECT COUNT(*) n FROM entity_enrichment_queue WHERE status = 'complete' AND last_attempt >= '2026-10-17'`),
    new_duplicate_leis: [...dupSet()].filter(l => !dupBefore.has(l)).length,
    duplicate_leis_total: dupSet().size
  };
  const calendarViolations = rl.filter(x => x.writes > 0 && !calendarCheck(new Date(x.utc), freezes).ok).length;
  // Post-run snapshot for the §9 export-based checks (gleif-reconcile-011-verify.mjs postrun).
  const postDb = path.join(out, 'post-run.db');
  ctx.d1.db.exec(`VACUUM INTO '${postDb.replace(/'/g, "''")}'`);
  // Full rollback.
  ctx.args.all = true;
  t = Date.parse('2026-10-26T08:10:00Z');
  for (let i = 0; i < 600; i++) { const r = await cmdRestore(ctx); if (!r.stopped) break; t += 20 * 60000; }
  const restored = sha256(dump());
  ctx.d1.close();
  const summary = { plan_dir: planDir, replica, replica_sha256: sha256File(replica), started: start, before, after, tally, writes_per_day_cost_model: perDay, max_day: Math.max(...Object.values(perDay)),
    batches_run: rl.filter(x => x.tally && x.mode === 'forward').length, holds, calendar_violations: calendarViolations, post_run_db: postDb,
    rollback: { original_sha256: original, after_full_rollback_sha256: restored, identical: original === restored } };
  const f = path.join(out, 'summary.json');
  writeFileSync(f, JSON.stringify(summary, null, 1) + '\n');
  return { ...summary, file: f, sha256: sha256File(f) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = Object.fromEntries(process.argv.slice(2).reduce((acc, x, i, arr) => (x.startsWith('--') ? acc.concat([[x.slice(2), arr[i + 1]]]) : acc), []));
  simulate({ planDir: a.plan, replica: a.replica, out: a.out }).then(s => { console.log(JSON.stringify(s, null, 1)); process.exit(s.rollback.identical && s.calendar_violations === 0 ? 0 : 1); })
    .catch(e => { console.error('DRY RUN ERROR:', e.message); process.exit(1); });
}
