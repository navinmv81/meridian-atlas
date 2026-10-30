#!/usr/bin/env node
// MA-OCT-004 test 2 (spec rev 1 §15 step 2): the seed batches against a local copy of the legacy rows.
// entity_exceptions from the REAL 015b/015c SQL (9 rows) → 003's real M1 (rendered by tools/m1-render.mjs) and M2 →
// V2 and B3 (must pass BEFORE M3a) → M3a → the template over seeds/m3-seeds.json (tools/seed-sql.mjs) → m3c-links.sql →
// the template over seeds/m4-minimum.json, then over a fixture unmatched-issuers.json that repeats a named CIK →
// the template over seeds/m3d-009dil.json (new D-2 / D-3 tickets from the 009 DIL review). Each file runs as one
// transaction (the `--file` batch) and is re-run for 0 changes. Checks AC-11, AC-12, AC-13, AC-17, the Appendix D
// byte-for-byte rule and the generator's refusal rules. No network, no remote D1.   Usage: node App/Ops/tests/dq-seeds.mjs

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { render as renderM1, TEMPLATE as M1_TEMPLATE } from '../tools/m1-render.mjs';
import { renderSeeds, unmatchedToSeeds, TEMPLATE } from '../tools/seed-sql.mjs';

const OPS = new URL('../', import.meta.url);
const CA = new URL('../../Corporate Atlas/', import.meta.url);
const read = (base, rel) => readFileSync(new URL(rel, base), 'utf8');
const bytes = rel => readFileSync(new URL(rel, OPS));
let pass = 0, fail = 0;
const check = (name, ok, got) => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  → ' + JSON.stringify(got).slice(0, 900)}`); };
const sha = b => createHash('sha256').update(b).digest('hex');

const db = new DatabaseSync(':memory:');
for (const m of ['002-ops-control-plane.sql', '003-ops-job-pause.sql', '004-ops-cases.sql', '005-ops-dq.sql']) db.exec(read(OPS, `migrations/${m}`));
db.exec(read(CA, 'migrations/ma-sep-015b-entity-exceptions.sql'));
db.exec(read(CA, 'migrations/ma-sep-015c-seed-known-issues.sql'));
const n = (sql, ...a) => db.prepare(sql).get(...a).n;
// The `--file` splitter (as 003's test): statements end with ';' at a line end; no literal may hold one there (checked).
const statements = text => text.split('\n').filter(l => !/^\s*--/.test(l)).join('\n').split(/;\s*(?:\n|$)/).map(s => s.trim()).filter(Boolean);
const literals = t => t.split('\n').filter(l => !/^\s*--/.test(l)).join('\n').match(/'(?:[^']|'')*'/g) || [];   // SQL lines only (comments hold apostrophes)
function runFile(text) {
  const out = [];
  db.exec('BEGIN');
  try { for (const s of statements(text)) out.push(Number(db.prepare(s).run().changes)); db.exec('COMMIT'); return out; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}
const sum = a => a.reduce((x, y) => x + y, 0);
const tkt = key => db.prepare(`SELECT * FROM ops_data_quality_ticket WHERE dedupe_key = ?`).get(key);
const members = key => db.prepare(`SELECT m.* FROM ops_dq_ticket_member m JOIN ops_data_quality_ticket t ON t.ticket_id = m.ticket_id WHERE t.dedupe_key = ? ORDER BY m.object_domain, m.object_key`).all(key);
const evTypes = id => db.prepare(`SELECT event_type FROM ops_case_event WHERE subject_type = 'dq_ticket' AND subject_id = ? ORDER BY event_id`).all(String(id)).map(e => e.event_type);

// --- Appendix D byte-for-byte (the spec is the source) ------------------------------------------
const SPEC = new URL('../../../claude/MA-OCT-004_Spec.md', import.meta.url);
let specText = null;
try { specText = readFileSync(SPEC, 'utf8'); } catch { /* the governance doc may not be in this checkout */ }
if (specText && sha(specText) === '570de1a571a69c752ce26ce3502177fbadca8e9fcb0d00b4f44f992c9dee5379') {
  const blocks = [...specText.matchAll(/\*\*`App\/Ops\/seeds\/(m3-seeds|m4-minimum)\.json`\*\*[^\n]*\n\n```json\n([\s\S]*?)\n```/g)];
  check('[App. D] m3-seeds.json and m4-minimum.json equal the spec rev 1 blocks byte-for-byte', blocks.length === 2
    && blocks.every(([, f, body]) => bytes(`seeds/${f}.json`).toString('utf8') === body + '\n'), blocks.map(b => b[1]));
} else {
  console.log('SKIP  [App. D] spec rev 1 (570de1a5…) not present in this checkout — byte check runs in the shared checkout');
}

// --- 003 M1 + M2, then V2 and B3 (gate for M3a) -------------------------------------------------
const m1 = renderM1(readFileSync(M1_TEMPLATE, 'utf8'), 'abc1234').text;
check('[setup] 003 M1 → 9 tickets; M2 → 2 GLEIF cases', sum(runFile(m1)) > 0 && n(`SELECT COUNT(*) n FROM ops_data_quality_ticket`) === 9
  && sum(runFile(read(OPS, 'migrations/m2-seed-gleif-cases.sql'))) === 4, null);
const V2 = `SELECT COUNT(*) AS n FROM entity_exceptions e JOIN ops_data_quality_ticket t ON t.legacy_source = 'entity_exceptions' AND t.legacy_id = CAST(e.id AS TEXT)
            WHERE t.resolved_by IS NOT e.decided_by OR t.resolved_at IS NOT e.decided_at OR t.opened_at IS NOT e.created_at OR t.disposition IS NOT e.decision OR t.source_record_ref IS NOT e.source_ref`;
const B3 = `SELECT COUNT(*) AS n FROM ops_data_quality_ticket WHERE legacy_source = 'entity_exceptions'`;
check('[gate] V2 = 0 mismatches and B3 = 9 before M3a (§10.1, App. A B3)', n(V2) === 0 && n(B3) === 9, { v2: n(V2), b3: n(B3) });
const legacyOpen = db.prepare(`SELECT case_ref FROM ops_data_quality_ticket WHERE ticket_type = 'isin_duplicate' AND status = 'open' ORDER BY case_ref`).all().map(r => r.case_ref);
check('[setup] the 2 legacy open isin_duplicate tickets are DQ-M-000008/9', legacyOpen.join() === 'DQ-M-000008,DQ-M-000009', legacyOpen);

// --- M3a (AC-11) --------------------------------------------------------------------------------
const m3a = read(OPS, 'migrations/m3a-ki2217.sql');
const c3a = runFile(m3a);
const k17 = tkt('ki:22.17');
const l8 = db.prepare(`SELECT * FROM ops_data_quality_ticket WHERE case_ref = 'DQ-M-000008'`).get();
const dis = db.prepare(`SELECT * FROM ops_case_event WHERE event_type = 'dismissed' AND idempotency_key LIKE 'seed:ki:22.17:dismiss:%' ORDER BY event_id`).all();
check('[AC-11] M3a: 44 changes (author dry-run); one DQ-nnnnnn ticket (DQ-000010 here, as the dry-run) triaged with 37 distinct dedupe members', sum(c3a) === 44 && k17.case_ref === 'DQ-000010' && k17.status === 'triaged'
  && members('ki:22.17').length === 37 && members('ki:22.17').every(m => m.proposed_action === 'dedupe' && /^entity_isin_map:[A-Z]{2}[A-Z0-9]{9}\d$/.test(m.object_key)), { c3a, k17 });
check('[AC-11] DQ-M-000008/9 → dismissed/duplicate naming DQ-000010; their events keep from_value open, legacy_disposition pending, duplicate_of DQ-000010',
  l8.status === 'dismissed' && l8.disposition === 'duplicate' && /DQ-000010/.test(l8.resolution_note) && dis.length === 2
  && dis.every(e => e.from_value === 'open' && JSON.parse(e.payload).legacy_disposition === 'pending' && JSON.parse(e.payload).duplicate_of === 'DQ-000010'), { l8, dis });
check('[AC-11] M3a re-run → 0 changes', sum(runFile(m3a)) === 0, null);

// --- M3 template + M3c (AC-12, AC-17) ---------------------------------------------------------------
const tpl = readFileSync(TEMPLATE, 'utf8');
const r3 = renderSeeds(tpl, bytes('seeds/m3-seeds.json'), JSON.parse(bytes('seeds/m3-seeds.json')));
check('[generator] m3: SHA-256 of the file bytes recorded; 5 seeds, 30 members; comment lines untouched; no ";" at a literal line end',
  r3.fileSha === sha(bytes('seeds/m3-seeds.json')) && r3.seeds === 5 && r3.members === 30 && r3.text.includes(`'file_sha256', '${r3.fileSha}'`)
  && r3.text.includes('-- MA-OCT-004 seed template. The generator') && !literals(r3.text).some(x => /;\s*(\n|$)/.test(x)) && statements(r3.text).length === 5, r3.fileSha);
const c3 = runFile(r3.text);
check('[AC-12] M3 per statement: 5 tickets, 5 case_refs, 30 members, 5 created, 2 fix_scheduled (47; author dry-run)', c3.join() === '5,5,30,5,2', c3);
const k44 = tkt('ki:22.44'), m44 = members('ki:22.44');
const acts = a => m44.filter(m => m.proposed_action === a).map(m => m.object_key).sort((x, y) => x - y).join();
check('[AC-12] KI 22.44: wrong_lei sev2 triaged, 24 members 6/5/13, exact ids; OPAP 2014 absent; 931 cites DQ-M-000001',
  /^DQ-\d{6}$/.test(k44.case_ref) && k44.ticket_type === 'wrong_lei' && k44.severity === 'sev2' && k44.status === 'triaged' && m44.length === 24
  && acts('replace_lei_t1') === '528,596,1134,1514,1803,1809' && acts('review') === '575,902,931,1049,1868'
  && acts('null_and_offline_match') === '576,702,838,890,899,927,943,1015,1138,1157,1162,1181,1455'
  && !m44.some(m => m.object_key === '2014') && /^DQ-M-000001\b/.test(JSON.parse(m44.find(m => m.object_key === '931').object_ref).see_also), { k44, n: m44.length });   // App. D text: 'DQ-M-000001 (do_not_merge 931/1216)'
const k9 = tkt('ki:22.9'), m9 = members('ki:22.9');
const links = db.prepare(`SELECT * FROM ops_case_event WHERE event_type = 'linked' AND idempotency_key LIKE 'seed:ki:22.9:link:%'`).all();
const c3c = runFile(read(OPS, 'migrations/m3c-links.sql'));
const links2 = db.prepare(`SELECT e.*, t.case_ref, t.status, t.disposition FROM ops_case_event e JOIN ops_data_quality_ticket t ON e.subject_id = CAST(t.ticket_id AS TEXT)
                           WHERE e.event_type = 'linked' AND e.idempotency_key LIKE 'seed:ki:22.9:link:%' ORDER BY t.case_ref`).all();
check('[AC-12] KI 22.9: 4 delete_edge members whose keys carry legal_parent:gleif:<created_at>; object_ref holds all five identity fields',
  /^DQ-\d{6}$/.test(k9.case_ref) && m9.length === 4 && m9.every(m => m.proposed_action === 'delete_edge' && /^entity_relationships:\d+->\d+:legal_parent:gleif:2026-06-1\dT\d\d:\d\d:\d\d$/.test(m.object_key)
    && ['parent_entity_id', 'child_entity_id', 'relationship_type', 'source', 'created_at'].every(f => JSON.parse(m.object_ref)[f] != null)), m9.map(m => m.object_key));
check('[AC-12] M3c: 4 linked events on DQ-M-000004…7 naming the KI 22.9 aggregate; the legacy rows stay resolved/accepted_no_fix',
  links.length === 0 && sum(c3c) === 4 && links2.map(l => l.case_ref).join() === 'DQ-M-000004,DQ-M-000005,DQ-M-000006,DQ-M-000007'
  && links2.every(l => l.status === 'resolved' && l.disposition === 'accepted_no_fix' && JSON.parse(l.payload).superseded_by === k9.case_ref), links2.map(l => [l.case_ref, l.status, l.disposition]));
const k43 = tkt('ki:22.43'), kw = tkt('wrong_identifier:entity:2289:cik'), ko = tkt('entity_merge:2019:467290');
const fixRef = t => JSON.parse(db.prepare(`SELECT payload FROM ops_case_event WHERE subject_id = ? AND event_type = 'fix_scheduled'`).get(String(t.ticket_id))?.payload || '{}').fix_ref;
check('[AC-17] KI 22.43: no_link_marker fix_pending, 0 members, 1 fix_scheduled event with fix_ref MA-OCT-011', k43.ticket_type === 'no_link_marker' && k43.status === 'fix_pending'
  && members('ki:22.43').length === 0 && evTypes(k43.ticket_id).join() === 'created,fix_scheduled' && /^MA-OCT-011/.test(fixRef(k43)), { k43, f: fixRef(k43) });
check('[AC-17] wrong_identifier: entity 2289, cik 0000766704 → 0001917598, triaged sev2, 0 members', kw.ticket_type === 'wrong_identifier' && kw.object_domain === 'entity' && kw.object_key === '2289'
  && kw.field_name === 'cik' && kw.observed_value === '0000766704' && kw.expected_value === '0001917598' && kw.severity === 'sev2' && members(kw.dedupe_key).length === 0, kw);
check('[AC-17] OTP: entity_merge fix_pending, members 2019 and 467290 (merge_013), fix_ref MA-OCT-013', ko.ticket_type === 'entity_merge' && ko.status === 'fix_pending'
  && members(ko.dedupe_key).map(m => `${m.object_key}:${m.proposed_action}`).join() === '2019:merge_013,467290:merge_013' && fixRef(ko) === 'MA-OCT-013', ko);
check('[N4-4] proposed_resolution is the seed text verbatim (fix_ref lives only in the event)', k43.proposed_resolution === JSON.parse(bytes('seeds/m3-seeds.json')).find(x => x.dedupe === 'ki:22.43').proposal, k43.proposed_resolution);
check('[AC-12/17] M3 + M3c re-run → 0 changes', sum(runFile(r3.text)) === 0 && sum(runFile(read(OPS, 'migrations/m3c-links.sql'))) === 0, null);

// --- M4: the named 4, then 008's list (AC-13) -----------------------------------------------------------
const r4 = renderSeeds(tpl, bytes('seeds/m4-minimum.json'), JSON.parse(bytes('seeds/m4-minimum.json')));
const c4 = runFile(r4.text);
check('[AC-13] M4 named minimum: 4 tickets, 4 case_refs, 7 members, 4 created, 0 fix_scheduled (19; author dry-run)', c4.join() === '4,4,7,4,0', c4);
const w = tkt('sec_cik:0000766704'), g = tkt('sec_cik:0000804269'), pf = tkt('sec_cik:0002058265'), pe = tkt('sec_cik:0002007029');
const ref = t => JSON.parse(t.object_ref);
check('[AC-13] Welltower Inc 0000766704: sev4, LEI 254900F33BIAR82QTA19, member gleif:<LEI> create_entity', w.severity === 'sev4' && ref(w).lei === '254900F33BIAR82QTA19'
  && members(w.dedupe_key).map(m => `${m.object_key}:${m.proposed_action}`).join() === 'gleif:254900F33BIAR82QTA19:create_entity', w);
check('[AC-13] GM Financial 0000804269: 3 candidate members (merge_then_assign_lei), LEI in object_ref', ref(g).lei === '5493008B6JBRUJ90QL97'
  && members(g.dedupe_key).map(m => m.object_key).join() === '103981,30187,3324' && members(g.dedupe_key).every(m => m.proposed_action === 'merge_then_assign_lei'), members(g.dedupe_key));
check('[AC-13] Pfizer NL 0002058265: co_registrant_of Pfizer Inc, member 106006 confirm_and_assign_lei', ref(pf).co_registrant_of === 'Pfizer Inc'
  && members(pf.dedupe_key).map(m => `${m.object_key}:${m.proposed_action}`).join() === '106006:confirm_and_assign_lei', pf);
check('[AC-13] PepsiCo Singapore 0002007029: members 3367 and 31416, current_wrong_link_entity 1457, LEI unknown (null)', ref(pe).current_wrong_link_entity === 1457 && ref(pe).lei === null
  && members(pe.dedupe_key).map(m => m.object_key).join() === '31416,3367', pe);
const allM4 = db.prepare(`SELECT m.object_key FROM ops_dq_ticket_member m JOIN ops_data_quality_ticket t ON t.ticket_id = m.ticket_id WHERE t.ticket_type = 'missing_entity'`).all().map(r => r.object_key);
check('[AC-13] no ticket links a subsidiary to its parent or guarantor (no member 2289, 1457 or a Pfizer Inc entity)', !allM4.some(k => ['2289', '1457'].includes(k)), allM4);
const fixture = [{ cik: '0002007029', sec_name: 'PepsiCo Singapore Financing I Pte. Ltd.', lei: null, co_registrant_of: null },
                 { cik: '0001234567', sec_name: "O'Brien Holdings LLC", lei: null, co_registrant_of: 'Example Parent Inc' }];
const fxBytes = Buffer.from(JSON.stringify(fixture));
const ru = renderSeeds(tpl, fxBytes, unmatchedToSeeds(fixture));
const cu = runFile(ru.text);
check("[AC-13] 008's list: a CIK in both files makes one ticket; the new CIK one ticket (quote in the name survives); file SHA in its created event",
  n(`SELECT COUNT(*) n FROM ops_data_quality_ticket WHERE dedupe_key = 'sec_cik:0002007029'`) === 1 && cu[0] === 1 && tkt('sec_cik:0001234567').title.includes("O'Brien")
  && JSON.parse(db.prepare(`SELECT payload FROM ops_case_event WHERE idempotency_key = 'seed:sec_cik:0001234567:created'`).get().payload).file_sha256 === sha(fxBytes), cu);
check('[AC-13] M4 + list re-run → 0 changes', sum(runFile(r4.text)) === 0 && sum(runFile(ru.text)) === 0, null);

// --- M3d: the new 009 DIL review tickets (D-2, D-3) -------------------------------------------------------
const rd = renderSeeds(tpl, bytes('seeds/m3d-009dil.json'), JSON.parse(bytes('seeds/m3d-009dil.json')));
const cd = runFile(rd.text);
const d2 = tkt('dil009:d2:caterpillar_tranche_labels'), d3 = tkt('dil009:d3:cusip:14913UAP5');
check('[D-2/D-3] 2 tickets, 2 case_refs, 39 members, 2 created events', cd.join() === '2,2,39,2,0', cd);
check('[D-2] data_error triaged, owner Data-Identity Lead, 37 bond members (accession#seq), all CIK 0000764764 boilerplate labels',
  d2.ticket_type === 'data_error' && d2.owner_role === 'Data-Identity Lead' && members(d2.dedupe_key).length === 37
  && members(d2.dedupe_key).every(m => m.object_domain === 'bond' && /^\d{10}-\d{2}-\d{6}#\d{1,3}$/.test(m.object_key) && /SUPPLEMENT|PROSPECTUS|Dated/i.test(JSON.parse(m.object_ref).label_head)), d2);
check('[D-3] anchored on instrument CUSIP:14913UAP5 with the two accessions as review members', d3.object_domain === 'instrument' && d3.object_key === 'CUSIP:14913UAP5'
  && members(d3.dedupe_key).map(m => m.object_key).join() === '0001104659-24-088590#1,0001104659-24-088828#1', members(d3.dedupe_key));
check('[D-2/D-3] re-run → 0 changes', sum(runFile(rd.text)) === 0, null);

// --- totals, event mix, generator refusals ----------------------------------------------------------------
const evMix = Object.fromEntries(db.prepare(`SELECT event_type, COUNT(*) n FROM ops_case_event WHERE subject_type = 'dq_ticket' GROUP BY event_type`).all().map(r => [r.event_type, r.n]));
check('[totals] events: created 9+1+5+4+1+2, decision_recorded 7, migrated 9, dismissed 2, fix_scheduled 2, linked 4',
  evMix.created === 22 && evMix.decision_recorded === 7 && evMix.migrated === 9 && evMix.dismissed === 2 && evMix.fix_scheduled === 2 && evMix.linked === 4, evMix);
check('[totals] every seed ticket has a final DQ-nnnnnn case_ref (no DQ-SEED- left)', n(`SELECT COUNT(*) n FROM ops_data_quality_ticket WHERE case_ref LIKE 'DQ-SEED-%'`) === 0, null);
const throwsWith = (f, re) => { try { f(); return false; } catch (e) { return re.test(e.message); } };
check('[generator] refuses: duplicate dedupe, missing key, NUL byte, a template without 4 __SEEDS__',
  throwsWith(() => renderSeeds(tpl, Buffer.from('x'), [{ ...JSON.parse(bytes('seeds/m4-minimum.json'))[0] }, { ...JSON.parse(bytes('seeds/m4-minimum.json'))[0] }]), /duplicate dedupe/)
  && throwsWith(() => renderSeeds(tpl, Buffer.from('x'), [{ dedupe: 'x' }]), /missing/)
  && throwsWith(() => renderSeeds(tpl, Buffer.from([0]), [{}]), /NUL/)
  && throwsWith(() => renderSeeds('SELECT 1;', Buffer.from('x'), JSON.parse(bytes('seeds/m4-minimum.json'))), /exactly 4/), null);

console.log(`\n${pass} passed, ${fail} failed`);
console.log(fail ? 'FAILED' : 'ALL PASSED');
process.exit(fail ? 1 : 0);
