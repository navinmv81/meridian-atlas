// MA-NOV-UI.OPS.BUILD (spec §1.9) — preview harness fixtures. TEST-ONLY: never copied to docs/
// (generate-docs.mjs copies its 11 named files only).
//
// Replaces window.fetch BEFORE ma-data.js / ma-ops.js load, so the console runs on fixture responses and
// never reaches a live Ops endpoint. Nothing here calls the browser's own fetch.
//
// URL switches (combine with &):
//   ?fail=health          /api/ops-health → HTTP 500          ?fail=health-offline  ops-health network error
//   ?fail=drift           every Drift & Budget read → 500     ?fail=budget | cf | inv | figi   one panel only
//   ?fail=cases | dq      the list read → HTTP 500            ?fail=signedout       admin reads → 401 (signed out)
//   ?fail=offline         every request → network error       ?empty=cases,dq       empty lists
//   ?delay=<ms>           response delay (default 150) to see the loading state
// The requests made are kept in window.__opsPreviewLog.
(function () {
  const q = new URLSearchParams(location.search);
  const fail = new Set((q.get('fail') || '').split(',').filter(Boolean));
  const empty = new Set((q.get('empty') || '').split(',').filter(Boolean));
  const delay = Math.max(0, Math.min(Number(q.get('delay') || 150), 10000));
  const log = window.__opsPreviewLog = [];
  const now = Date.now();
  const ago = mins => new Date(now - mins * 60000).toISOString();

  const CASES = [
    { case_ref: 'EXC-S-0000000000A1', severity: 'sev1', exception_type: 'job_missed', title: 'meridian-holdings missed its Sunday run <script>alert(1)</script>',
      job_id: 'meridian-holdings', opened_at: ago(190), owner_role: 'Operations Lead', status: 'open', overdue: true,
      summary: 'No heartbeat since the 04:00Z window. <img src=x onerror=alert(2)>', raised_by: 'service:sweep', raised_via: 'sweep',
      run_snapshot: JSON.stringify({ expected_at: ago(200), last_seen: ago(10200) }) },
    { case_ref: 'EXC-S-0000000000A2', severity: 'sev2', exception_type: 'budget_risk', title: 'Shared D1 writes passed 80% of the daily cap',
      job_id: null, opened_at: ago(45), owner_role: null, status: 'open', summary: 'writes_today 81,400 of 100,000.', raised_by: 'service:sweep', raised_via: 'sweep' },
    { case_ref: 'EXC-S-0000000000A3', severity: 'sev3', exception_type: 'schedule_drift', title: 'meridian-entities-seed fired outside its window',
      job_id: 'meridian-entities-seed', opened_at: ago(60 * 26), owner_role: 'Engineering Lead', status: 'acknowledged', summary: 'Fired Sunday 04:00Z; expected Monday.', raised_by: 'service:sweep', raised_via: 'sweep' },
    { case_ref: 'EXC-M-000004', severity: 'sev4', exception_type: 'manual', title: 'Check the FIRDS seed after the holiday', job_id: null, opened_at: ago(60 * 24 * 9),
      owner_role: 'Founder', status: 'resolved', resolution: 'fixed', summary: 'Checked; nothing to do.', raised_by: 'founder@example.test', raised_via: 'console' }
  ];
  const DQ = [
    { case_ref: 'DQ-000101', severity: 'sev3', ticket_type: 'missing_mapping', title: 'Holdings without an issuer mapping (3)', object_domain: 'instrument', object_key: 'CUSIP:037833100',
      owner_role: 'Data-Identity Lead', status: 'open', opened_at: ago(60 * 30), summary: 'Three instruments have no issuer link.', evidence: 'gate3 v2 back-fill, run 2026-11-20',
      raised_by: 'service:sweep', raised_via: 'sweep',
      members: [
        { object_domain: 'instrument', object_key: 'CUSIP:037833100', proposed_action: 'map_issuer', member_status: 'open', object_ref: JSON.stringify({ name: 'Apple Inc' }) },
        { object_domain: 'instrument', object_key: 'CUSIP:594918104', proposed_action: 'map_issuer', member_status: 'open', object_ref: JSON.stringify({ name: 'Microsoft Corp' }) },
        { object_domain: 'instrument', object_key: 'ISIN:TW0002330008', proposed_action: 'map_issuer', member_status: 'fixed', note: 'MA-NOV-EXP.BF1', object_ref: JSON.stringify({ name: 'Taiwan Semiconductor' }) }
      ] },
    { case_ref: 'DQ-M-000001', severity: 'sev4', ticket_type: 'entity_merge', title: 'Keep the two BlackRock entities apart', object_domain: 'entity', object_key: '528',
      owner_role: 'Founder', status: 'triaged', disposition: 'do_not_merge', opened_at: ago(60 * 24 * 21), summary: 'Founder decision: do not merge.', raised_by: 'founder@example.test', raised_via: 'console',
      merged_into: null, members: [] }
  ];
  const EVENTS = {};
  const evs = ref => (EVENTS[ref] ||= [{ event_type: 'raised', actor: 'service:sweep', occurred_at: (CASES.concat(DQ).find(r => r.case_ref === ref) || {}).opened_at || ago(5) }]);

  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
  const wait = () => new Promise(r => setTimeout(r, delay));
  const offline = () => { throw new TypeError('Failed to fetch (preview fixture: offline)'); };

  const listOf = (rows, path, key) => {
    if (empty.has(key)) return json({ ok: true, items: [], next_cursor: null });
    const st = (new URLSearchParams(path.split('?')[1] || '').get('status') || '').split(',');
    return json({ ok: true, items: rows.filter(r => st.includes(r.status)).map(r => { const { members, ...rest } = r; return rest; }), next_cursor: null });
  };
  const detail = ref => {
    const row = CASES.concat(DQ).find(r => r.case_ref === ref);
    if (!row) return json({ ok: false, error: 'not_found' }, 404);
    const { members, ...c } = row;
    return ref.startsWith('DQ-')
      ? json({ case: c, events: evs(ref), members: members || [], members_cursor: null, linked_exception: null })
      : json({ case: c, events: evs(ref), registry: c.job_id ? { execution_mode: 'cron', status: 'active' } : null, runs: [], linked_dq_tickets: [] });
  };
  const NEXT = { acknowledge: 'acknowledged', resolve: 'resolved', dismiss: 'dismissed', reopen: 'open', triage: 'triaged', schedule_fix: 'fix_pending' };
  const act = (ref, body) => {
    const row = CASES.concat(DQ).find(r => r.case_ref === ref);
    if (!row) return json({ ok: false, error: 'not_found' }, 404);
    if (body.expected_status !== row.status) return json({ ok: false, error: 'stale_expected_status' }, 409);
    const e = { event_type: body.action === 'schedule_fix' ? 'fix_scheduled' : body.action === 'member_update' ? 'member_updated' : body.action,
      actor: 'founder@example.test', actor_role: body.actor_role, occurred_at: new Date().toISOString(), body: body.note || null };
    if (body.action === 'member_update') {
      const m = (row.members || []).find(x => x.object_key === body.member.object_key);
      if (m) { e.from_value = m.member_status; m.member_status = body.member_status; e.to_value = m.member_status; if (body.note) m.note = body.note; }
    } else if (NEXT[body.action]) { e.from_value = row.status; row.status = NEXT[body.action]; e.to_value = row.status; }
    if (body.severity) row.severity = body.severity;
    if (body.owner_role) row.owner_role = body.owner_role;
    evs(ref).push(e);
    return json({ ok: true });
  };

  const HEALTH = { pipeline: { offset: 171, total: 237, last_run: ago(38), last_status: 'running:171/237:partial:1', writes_today: 23412, writes_limit: 100000, writes_guard: 80000 },
    coverage: { total_deep: 237, null_depth: 6, depth_1: 41, depth_2_plus: 190 }, bootstrap: { current_cik: 1940122, discovery_threshold: 2000000 },
    enrichment: { version_1_pending: null, version_2_complete: null, total: null, enrichment_source: 'removed-ML-1025-3' }, snapshot_at: new Date().toISOString() };
  const INV = {
    'meridian-holdings': { cron_invocation_count: 1, all_trigger_invocation_count: 1, matches_cron_only: true, cron_invocations: [{ datetime: '2026-11-15T04:00:02Z', cron: '0 4 * * sun', status: 'success' }] },
    'meridian-entities-seed': { cron_invocation_count: 0, all_trigger_invocation_count: 0, matches_cron_only: true, cron_invocations: [] },
    'meridian-entities-enrich': { cron_invocation_count: 6, all_trigger_invocation_count: 7, matches_cron_only: false, cron_invocations: [{ datetime: '2026-11-21T08:30:01Z', cron: '*/30 * * * *', status: 'success' }] }
  };

  window.fetch = async function (input, init) {
    init = init || {};
    const s = String((input && input.url) || input);
    const i = s.indexOf('/api/');
    const path = i >= 0 ? s.slice(i) : s;
    const p = path.split('?')[0];
    const method = (init.method || 'GET').toUpperCase();
    log.push({ method, path, at: new Date().toISOString() });
    await wait();
    if (fail.has('offline')) offline();

    if (p === '/api/ops-health') {
      if (fail.has('health-offline')) offline();
      return fail.has('health') ? json({ error: 'fixture 500' }, 500) : json(HEALTH);
    }
    if (p.startsWith('/api/ops/admin/')) {
      if (fail.has('signedout')) return new Response('', { status: 401 });
      if (p === '/api/ops/admin/exceptions') return fail.has('cases') ? json({ ok: false, error: 'fixture' }, 500) : listOf(CASES, path, 'cases');
      if (p === '/api/ops/admin/dq-tickets') return fail.has('dq') ? json({ ok: false, error: 'fixture' }, 500) : listOf(DQ, path, 'dq');
      const m = /^\/api\/ops\/admin\/cases\/([^/]+)(\/action)?$/.exec(p);
      if (m && m[2] && method === 'POST') return act(decodeURIComponent(m[1]), JSON.parse(init.body || '{}'));
      if (m) return detail(decodeURIComponent(m[1]));
      return json({ ok: false, error: 'not_found' }, 404);
    }
    const driftFail = name => fail.has('drift') || fail.has(name);
    if (p === '/api/ops/budget-risk') return driftFail('budget') ? json({ error: 'fixture' }, 500) : json({ writes_today: 23412, daily_limit: 100000, pct: 23.4 });
    if (p === '/api/ops/cf/d1-today') return driftFail('cf') ? json({ error: 'fixture' }, 500)
      : json({ rowsWritten: 61208, daily_cap: 100000, pct_of_cap: 61.2, rowsRead: 1834221, writeQueries: 4120, readQueries: 22811 });
    if (p === '/api/ops/cf/invocations') {
      const script = new URLSearchParams(path.split('?')[1] || '').get('script');
      return driftFail('inv') || !INV[script] ? json({ error: 'fixture' }, 500) : json(INV[script]);
    }
    if (p === '/api/ops/openfigi-status') return driftFail('figi') ? json({ error: 'fixture' }, 500)
      : json({ coverage_pct: 87.4, instrument_entity_map_total: 41250, instrument_master_total: 47198, openfigicache_total: 46012, openfigi_matched_no_entity: 2210 });
    // Anything else (including the retired /api/ops/sprint-board, /release-ledger, /events, /drift) is a 404 here.
    return json({ ok: false, error: 'not in the preview fixtures' }, 404);
  };

  // ?tab=health|cases|dq|drift opens that tab after load (for screenshots); a drawer opens from the console's own
  // hash, e.g. #cases?status=open,acknowledged&ref=EXC-S-0000000000A1
  const tab = q.get('tab');
  if (tab) window.addEventListener('load', () => { if (typeof window.ops_switchTab === 'function') window.ops_switchTab(tab); });
})();
