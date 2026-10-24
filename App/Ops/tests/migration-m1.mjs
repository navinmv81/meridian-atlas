#!/usr/bin/env node
// MA-OCT-003 test 2 (spec rev 1 §15 step 2): M1 and M2 against a local copy of the legacy rows.
// entity_exceptions is built from the REAL 015b and 015c SQL files (9 rows); the Ops tables from the real
// migrations 002–004. M1 is rendered by the real tools/m1-render.mjs and run as one transaction (the
// `--file` batch). Checks the guard, V1–V4, AC-12, AC-13, the unknown-type and malformed-JSON fixtures, M2,
// and the renderer's refusal rules. No network, no remote D1.   Usage: node App/Ops/tests/migration-m1.mjs

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { render, TEMPLATE } from '../tools/m1-render.mjs';

const OPS = new URL('../', import.meta.url);
const CA = new URL('../../Corporate Atlas/', import.meta.url);
const read = (base, rel) => readFileSync(new URL(rel, base), 'utf8');
let pass = 0, fail = 0;
const check = (name, ok, got) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + JSON.stringify(got).slice(0, 900)}`); };
const sha = s => createHash('sha256').update(s).digest('hex');

const GUARD = `SELECT COUNT(*) AS n FROM entity_exceptions WHERE exception_type NOT IN ('entity_merge','bad_relationship_edge','isin_duplicate')`;
const V2 = `SELECT COUNT(*) AS n FROM entity_exceptions e JOIN ops_data_quality_ticket t ON t.legacy_source = 'entity_exceptions' AND t.legacy_id = CAST(e.id AS TEXT)
            WHERE t.resolved_by IS NOT e.decided_by OR t.resolved_at IS NOT e.decided_at OR t.opened_at IS NOT e.created_at
               OR t.disposition IS NOT e.decision OR t.source_record_ref IS NOT e.source_ref`;

function freshDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(read(OPS, 'migrations/002-ops-control-plane.sql'));
  db.exec(read(OPS, 'migrations/003-ops-job-pause.sql'));
  db.exec(read(OPS, 'migrations/004-ops-cases.sql'));
  db.exec(read(CA, 'migrations/ma-sep-015b-entity-exceptions.sql'));
  db.exec(read(CA, 'migrations/ma-sep-015c-seed-known-issues.sql'));
  return db;
}
// Splits a migration file into statements (no ';' inside these files' string literals is assumed — checked below).
const statements = text => text.split('\n').filter(l => !/^\s*--/.test(l)).join('\n').split(/;\s*(?:\n|$)/).map(s => s.trim()).filter(Boolean);
// Runs a file as one transaction (the `--file` batch); returns per-statement changes, or throws after a rollback.
function runFile(db, text) {
  const out = [];
  db.exec('BEGIN');
  try { for (const s of statements(text)) out.push(Number(db.prepare(s).run().changes)); db.exec('COMMIT'); return out; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}
const n = (db, sql, ...a) => db.prepare(sql).get(...a).n;

const template = readFileSync(TEMPLATE, 'utf8');
const { fileSha, text: m1 } = render(template, 'abc1234');
check('[render] template SHA-256 recorded; the fragment filled; header comments untouched',
  fileSha === sha(template) && m1.includes(`'file_sha256','${fileSha}','commit','abc1234'`) && m1.includes('fills __FILE_SHA__') && !m1.includes(`'__COMMIT__'`), null);
check('[render] M1 splits into exactly 4 statements', statements(m1).length === 4, statements(m1).length);

// --- happy path ----------------------------------------------------------------------
const db = freshDb();
const legacy = db.prepare(`SELECT * FROM entity_exceptions ORDER BY id`).all();
check('[fixture] 015b + 015c give 9 legacy rows, ids 1–9 (R1)', legacy.length === 9 && legacy.map(r => r.id).join() === '1,2,3,4,5,6,7,8,9', legacy.length);
check('[guard] 0 rows of a non-DQ type → proceed', n(db, GUARD) === 0, n(db, GUARD));
const c1 = runFile(db, m1);
check('[AC-12] tickets inserted 9; events created 9, decision_recorded 7, migrated 9 (per-statement changes)', c1.join() === '9,9,7,9', c1);
const tickets = db.prepare(`SELECT * FROM ops_data_quality_ticket ORDER BY ticket_id`).all();
check('[V1] 9 tickets: 7 resolved + 2 open', tickets.length === 9 && tickets.filter(t => t.status === 'resolved').length === 7 && tickets.filter(t => t.status === 'open').length === 2, tickets.map(t => t.status));
check('[V2] byte-for-byte: decided_by, decided_at, created_at, decision, source_ref → 0 mismatches', n(db, V2) === 0, n(db, V2));
const ev = Object.fromEntries(db.prepare(`SELECT event_type, COUNT(*) AS n FROM ops_case_event WHERE subject_type = 'dq_ticket' GROUP BY event_type`).all().map(r => [r.event_type, r.n]));
check('[V3] events: created 9, decision_recorded 7, migrated 9', ev.created === 9 && ev.decision_recorded === 7 && ev.migrated === 9, ev);
const keys = new Set(tickets.map(t => t.object_key));
check('[AC-12] object_key set = {931, 2589, 2014, 3, 143, 49, 194, 204921, 28219} (003-7)',
  keys.size === 9 && ['931', '2589', '2014', '3', '143', '49', '194', '204921', '28219'].every(k => keys.has(k)), [...keys]);
check('[§10.1] case_ref DQ-M-000001 … DQ-M-000009 = legacy id; legacy_source/legacy_id set; raised_via migration',
  tickets.every(t => t.case_ref === `DQ-M-${String(t.legacy_id).padStart(6, '0')}` && t.legacy_source === 'entity_exceptions' && t.raised_via === 'migration' && t.object_domain === 'entity'), tickets.map(t => t.case_ref));
const legacyOf = t => legacy.find(r => String(r.id) === t.legacy_id);   // INSERT … SELECT order follows the legacy index, not id
check('[§10.1] ticket_type verbatim; title "<type> (legacy #id)"; owner Data-Identity Lead; sev3', tickets.every(t => t.ticket_type === legacyOf(t).exception_type
  && t.title === `${legacyOf(t).exception_type} (legacy #${legacyOf(t).id})` && t.owner_role === 'Data-Identity Lead' && t.severity === 'sev3'), null);
check('[DV-4] object_ref = {source_table, source_ref as parsed JSON}; source_record_ref = source_ref text verbatim',
  tickets.every(t => { const L = legacyOf(t), o = JSON.parse(t.object_ref); return o.source_table === L.source_table && JSON.stringify(o.source_ref) === JSON.stringify(JSON.parse(L.source_ref)) && t.source_record_ref === L.source_ref; }), null);
const dnm = tickets.filter(t => t.disposition === 'do_not_merge').map(t => t.case_ref);
check('[§10.6] the 3 protected do_not_merge decisions are DQ-M-000001..3', dnm.join() === 'DQ-M-000001,DQ-M-000002,DQ-M-000003', dnm);
const mig = db.prepare(`SELECT payload, actor, actor_source FROM ops_case_event WHERE event_type = 'migrated' LIMIT 1`).get();
const mp = JSON.parse(mig.payload);
check('[DV-2] migrated event: actor ops_lead:wrangler / system; payload has the template SHA and the commit', mig.actor === 'ops_lead:wrangler' && mig.actor_source === 'system'
  && mp.file_sha256 === fileSha && mp.commit === 'abc1234' && mp.packet === 'MA-OCT-003', mig);
const dec = db.prepare(`SELECT e.actor, e.occurred_at, e.to_value, x.decided_by, x.decided_at, x.decision FROM ops_case_event e
                        JOIN ops_data_quality_ticket t ON e.subject_type = 'dq_ticket' AND e.subject_id = CAST(t.ticket_id AS TEXT)
                        JOIN entity_exceptions x ON CAST(x.id AS TEXT) = t.legacy_id WHERE e.event_type = 'decision_recorded'`).all();
check('[§10.2] decision_recorded: actor = decided_by verbatim, occurred_at = decided_at, to_value = decision', dec.length === 7
  && dec.every(r => r.actor === (r.decided_by ?? 'legacy:unrecorded') && r.occurred_at === (r.decided_at ?? r.occurred_at) && r.to_value === r.decision), dec);
const cr = db.prepare(`SELECT COUNT(*) AS n FROM ops_case_event e JOIN ops_data_quality_ticket t ON e.subject_type='dq_ticket' AND e.subject_id = CAST(t.ticket_id AS TEXT)
                       WHERE e.event_type = 'created' AND e.occurred_at IS NOT t.opened_at`).get().n;
check('[§10.2] created events carry the original created_at', cr === 0, cr);
const before = JSON.stringify(db.prepare(`SELECT * FROM entity_exceptions ORDER BY id`).all());

// --- AC-13 / V4: re-run is a no-op --------------------------------------------------------
const c2 = runFile(db, m1);
check('[AC-13 / V4] M1 again → 0 changes on all 4 statements', c2.join() === '0,0,0,0', c2);
check('[read-only] entity_exceptions unchanged by M1', JSON.stringify(db.prepare(`SELECT * FROM entity_exceptions ORDER BY id`).all()) === before, null);

// --- unknown type → guard stops; M1 never migrates it ------------------------------------
const dbU = freshDb();
dbU.prepare(`INSERT INTO entity_exceptions (exception_type, source_table, source_ref, decision) VALUES ('job_failed', 'ops_job_run', '{"run_id":"x"}', 'pending')`).run();
check('[guard] a non-DQ type → guard returns 1 → the runbook STOPs (spec §10.1)', n(dbU, GUARD) === 1, n(dbU, GUARD));
runFile(dbU, m1);
check('[guard] even if run, M1 does not migrate the non-DQ row', n(dbU, `SELECT COUNT(*) n FROM ops_data_quality_ticket`) === 9 && n(dbU, `SELECT COUNT(*) n FROM ops_data_quality_ticket WHERE ticket_type = 'job_failed'`) === 0, null);

// --- malformed source_ref → the batch fails and nothing is partially inserted ---------------
const dbM = freshDb();
dbM.prepare(`INSERT INTO entity_exceptions (exception_type, source_table, source_ref, decision) VALUES ('isin_duplicate', 'instrument_master', '{bad json', 'pending')`).run();
let threw = false;
try { runFile(dbM, m1); } catch { threw = true; }
check('[§15.2] malformed source_ref → the batch fails; 0 tickets and 0 events written (transaction)', threw
  && n(dbM, `SELECT COUNT(*) n FROM ops_data_quality_ticket`) === 0 && n(dbM, `SELECT COUNT(*) n FROM ops_case_event`) === 0, { threw });

// --- M2 -----------------------------------------------------------------------------
const m2 = readFileSync(new URL('migrations/m2-seed-gleif-cases.sql', OPS), 'utf8');
const s1 = runFile(db, m2);
const seeded = db.prepare(`SELECT case_ref, exception_type, severity, status, job_id, owner_role, raised_via, dedupe_key FROM ops_exception ORDER BY case_ref`).all();
check('[AC-10 / §10.4] M2 seeds EXC-M-000001 (E3, sev2, phase1) and EXC-M-000002 (E4, sev3, cf.meridian-entities-delta), each with 1 created event',
  s1.join() === '1,1,1,1' && seeded.length === 2 && seeded[0].case_ref === 'EXC-M-000001' && seeded[0].exception_type === 'gleif_orphaned_backlog' && seeded[0].severity === 'sev2'
  && seeded[0].job_id === 'cf.meridian-entities-enrich.phase1' && seeded[1].case_ref === 'EXC-M-000002' && seeded[1].exception_type === 'gleif_frozen_source'
  && seeded[1].severity === 'sev3' && seeded[1].job_id === 'cf.meridian-entities-delta' && seeded.every(r => r.raised_via === 'ops_console' && r.owner_role === 'Data-Identity Lead' && r.status === 'open'), { s1, seeded });
check('[§10.4] M2 again → 0 changes', runFile(db, m2).join() === '0,0,0,0', null);
check('[§10.4] EXC-M- refs match the C-1 case_ref pattern', seeded.every(r => /^(EXC|DQ)-(S-[0-9A-F]{12,16}|M-\d{6}|\d{6})$/.test(r.case_ref)), null);
check('[§10.1] the DQ-M- refs match the C-1 case_ref pattern', tickets.every(t => /^(EXC|DQ)-(S-[0-9A-F]{12,16}|M-\d{6}|\d{6})$/.test(t.case_ref)), null);

// --- renderer refusals (R1-5 discipline) ----------------------------------------------
const refuses = (fn, re) => { try { fn(); return false; } catch (e) { return re.test(e.message); } };
check('[render] refuses a NUL byte', refuses(() => render(template + '\u0000', 'abc1234'), /NUL/), null);
check('[render] refuses a commit that is not 7–40 lowercase hex (e.g. containing a quote)', refuses(() => render(template, "abc'; DROP"), /hex/) && refuses(() => render(template, 'ABC1234'), /hex/), null);
check('[render] refuses a template where the fragment occurs 0 or 2 times', refuses(() => render(template.replace(/'file_sha256','__FILE_SHA__','commit','__COMMIT__'/, 'x'), 'abc1234'), /exactly once/)
  && refuses(() => render(template + "\n-- 'file_sha256','__FILE_SHA__','commit','__COMMIT__'", 'abc1234'), /exactly once/), null);
// The splitter breaks only on ';' at a line end, so a literal is unsafe only if it holds ';' + newline.
const literals = t => t.split('\n').filter(l => !/^\s*--/.test(l)).join('\n').match(/'(?:[^']|'')*'/g) || [];
check('[render] statement splitter is safe: no string literal in M1 or M2 holds ";" at a line end', ![m1, m2].some(t => literals(t).some(x => /;\s*(\n|$)/.test(x))), null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
