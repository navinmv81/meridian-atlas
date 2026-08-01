// seed-ops-tables.js
// One-time script: migrates the real current content of Sprint_Board_August.html
// (and this session's real history) into sprintboarditems / releaseledger via
// the new meridian-ops routes — not raw SQL, so operationalevents correctly
// records a packet_created for each row. Safe to re-run: every insert is
// ON CONFLICT DO NOTHING at the Worker level.
//
// Run with: node seed-ops-tables.js
// (requires Node 18+ for native fetch)

const OPS_BASE = 'https://meridian-ops.navinmv1981.workers.dev';

const TICKETS = [
  {
    ticket_id: 'MA-AUG-001',
    title: 'OpenFIGI entity-resolution upgrade',
    domain: 'Entities',
    lane: 'data_identity',
    stage: 'CLOSED',
    owner_role: 'Entities Product Lead',
    actor_role: 'Program Orchestrator',
    next_step: 'Optional fast-follow: cheap re-match pass against openfigicache once entity_master gains rows',
    notes: 'Backfill complete 29-30 July 2026: instrument_entity_map 23,963 -> 32,763 (60.0% coverage, up from 43.9%). openfigicache built (28,605 rows) as the root-cause fix for a stuck-batch bug found mid-backfill.'
  },
  {
    ticket_id: 'MA-AUG-002',
    title: 'Entity worker reactivation',
    domain: 'Entities/Ops',
    lane: 'ops',
    stage: 'FOUNDER_APPROVAL',
    owner_role: 'Operations Lead',
    actor_role: 'Program Orchestrator',
    approval_needed: 'Founder + Architect: entities-seed re-enable cadence (weekly/monthly recommended, not the original daily schedule)',
    next_step: 'Decide entities-seed cron cadence, then deploy the cron change to close this ticket',
    notes: 'entities-seed and entities-enrich both verified working end-to-end via live wrangler tail. Root cause of the multi-day verification saga (Cloudflare subrequest ceiling) found and fixed. Cron re-enable is the one remaining item.'
  },
  {
    ticket_id: 'MA-AUG-003',
    title: 'Data completion and coverage expansion',
    domain: 'Issuer/13F',
    lane: 'data_identity',
    stage: 'PRODUCT_SPEC',
    owner_role: 'Equities Product Lead',
    actor_role: 'Program Orchestrator',
    next_step: 'Equities Product Lead defines the backfill tranche plan and issuer coverage sequencing',
    approval_needed: 'Founder approval for scope sequencing'
  },
  {
    ticket_id: 'MA-AUG-004',
    title: 'Operational hardening and observability',
    domain: 'Ops',
    lane: 'ops',
    stage: 'PRODUCT_SPEC',
    owner_role: 'Operations Lead',
    actor_role: 'Program Orchestrator',
    next_step: 'Operations Lead formally scopes the hardening package (mid-loop write checkpoint, cadence review, entities-enrich Phase 3 scan fix)',
    approval_needed: 'Founder approval for August inclusion'
  },
  {
    ticket_id: 'MA-AUG-005',
    title: 'August Operating Layer — Sprint Board, Release Ledger, OPS dashboard extension',
    domain: 'Ops/Control',
    lane: 'ops',
    stage: 'ENG_IMPLEMENT',
    owner_role: 'Program Orchestrator',
    actor_role: 'Program Orchestrator',
    next_step: 'Deploy meridian-ops, run this seed script, extend ma-data.js and ma-ops.js',
    notes: 'Implements August_Operating_Layer_Blueprint.md: sprintboarditems/releaseledger/operationalevents/openfigicache tables (migration already applied), meridian-ops Worker, ma-ops.js tab-based dashboard extension.'
  }
];

const RELEASES = [
  {
    release_id: 'REL-2026-07-001',
    ticket_ids: ['MA-AUG-001'],
    change_summary: 'meridian-entities-figi: OpenFIGI Worker, instrument_entity_map migration, openfigicache root-cause fix, full backfill to 60.0% coverage',
    worker_files: 'entities-figi.js, entities-seed.js (normalizeName export)',
    events: ['migration_applied', 'worker_deployed', 'verification_passed']
  },
  {
    release_id: 'REL-2026-07-002',
    ticket_ids: ['MA-AUG-002'],
    change_summary: 'entities-seed.js / entities-enrich.js write-guard fixes, N+1 removal, BATCH_SIZE increase — verified end-to-end',
    worker_files: 'entities-seed.js, entities-enrich.js',
    events: ['worker_deployed', 'verification_passed']
  }
];

async function post(path, body) {
  const res = await fetch(`${OPS_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  console.log('Seeding sprintboarditems...');
  for (const t of TICKETS) {
    const r = await post('/api/ops/sprint-board', t);
    console.log(`  ${t.ticket_id}: ${r.ok ? 'ok' : 'FAILED'} (${r.status})`, r.ok ? '' : JSON.stringify(r.data));
  }

  console.log('Seeding releaseledger...');
  for (const rel of RELEASES) {
    const created = await post('/api/ops/release-ledger', {
      release_id: rel.release_id,
      ticket_ids: rel.ticket_ids,
      change_summary: rel.change_summary,
      worker_files: rel.worker_files,
      actor_role: 'Program Orchestrator'
    });
    console.log(`  ${rel.release_id}: ${created.ok ? 'ok' : 'FAILED'} (${created.status})`);

    for (const eventType of rel.events) {
      const evt = await post(`/api/ops/release-ledger/${rel.release_id}/event`, {
        event_type: eventType,
        actor_role: 'Program Orchestrator',
        payload: {}
      });
      console.log(`    event ${eventType}: ${evt.ok ? 'ok' : 'FAILED'} (${evt.status})`);
    }
  }

  console.log('Done. Verify with:');
  console.log(`  curl -s ${OPS_BASE}/api/ops/sprint-board | jq`);
  console.log(`  curl -s ${OPS_BASE}/api/ops/release-ledger | jq`);
}

main().catch(err => {
  console.error('Seed script failed:', err);
  process.exit(1);
});
