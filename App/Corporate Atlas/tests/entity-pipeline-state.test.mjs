// MA-OCT-002b B5 (spec 002 §14, KI 22.39, CR-10 steps 1–2): migration 009 + delta dual-write. 0 network, 0 D1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const mig = readFileSync(new URL('../migrations/009-entity-pipeline-state.sql', import.meta.url), 'utf8');
const delta = readFileSync(new URL('../src/entities-delta.js', import.meta.url), 'utf8');

test('009 creates entity_pipeline_state (key PK, value NOT NULL, updated_at default) and is idempotent', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(mig); db.exec(mig);
  const cols = db.prepare(`PRAGMA table_info(entity_pipeline_state)`).all().map(c => [c.name, c.notnull, c.pk]);
  assert.deepEqual(cols, [['key', 0, 1], ['value', 1, 0], ['updated_at', 1, 0]]);
  db.prepare(`INSERT INTO entity_pipeline_state (key, value) VALUES ('delta_inactive_X', 'LAPSED:2026-11-02')`).run();
  assert.match(db.prepare(`SELECT updated_at u FROM entity_pipeline_state`).get().u, /^\d{4}-\d\d-\d\dT/);
});
test('009 touches no ETF-domain table', () => { assert.doesNotMatch(mig.replace(/--.*$/gm, ''), /holdings_pipeline_state|etf_|fund_holdings/); });
test('delta: every delta_inactive_<LEI> write goes to BOTH tables in the same statements batch (dual-write, step 2)', () => {
  const i = delta.indexOf("bind(`delta_inactive_${row.lei}`"); const block = delta.slice(i - 400, i + 700);
  assert.match(block, /INTO holdings_pipeline_state/); assert.match(block, /INTO entity_pipeline_state/);
  assert.equal((delta.match(/bind\(`delta_inactive_\$\{row\.lei\}`/g) || []).length, 2);
});
test('no Entities Worker writes entity_pipeline_state except delta (seed/figi counters stay; enrich run facts → B2)', () => {
  for (const f of ['entities-seed.js', 'entities-enrich.js', 'entities-figi.js', 'entities-api.js'])
    assert.doesNotMatch(readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8'), /INTO entity_pipeline_state/, f);
});
