# MA-OCT-001 — Architect Review (close-out)

```text
ISSUED BY:    Program Orchestrator (October Main Lane)
EXECUTED BY:  Architect (review only; not the builder or the packet owner)
REVIEWED BY:  —
APPROVED BY:  Founder
PACKET:       MA-OCT-001 — Ops backend foundation
GATE:         Close-out
```

```text
REVIEWER:     Architect
PACKET:       MA-OCT-001
VERDICT:      PASS WITH NOTES
EVIDENCE CHECKED:
  - claude/MA-OCT-001_Closeout_Summary.md 924b7345…daf2e = committed copy in 658326a (single-file commit),
    origin/October-2026 = 658326a, fast-forward from da38cf5; no .git locks (device bridge, --no-optional-locks, 4 Oct 08:11 UTC)
  - logs/entities-enrich-boost-heartbeat.log: 6 lines = AC9 table exactly (1 undelivered failed, 1 delivered failed,
    2 × start+success, all delivered events HTTP 201)
  - logs/entities-enrich-boost-launchd-stderr.log: 36 F6 entries, all code 10000 (72 matching lines, 2 per entry)
  - App/Ops/src/ops-api.js at HEAD: 955 lines; Q4 last_end_at uses phase = 'end' … LIMIT 1 (line 866–872)
  - Operations Lead release-readiness block (4 Oct): PASS WITH NOTES, nothing required before approval
  - Earlier Main Lane verifications: da38cf5 contents and governance-doc hashes (1 Oct); pilot runner diff vs Data-Identity
    conditions (1)–(4) (1 Oct); 2 Oct 10:50 undelivered heartbeat (2 Oct)
FINDINGS:
  1. 15 of 16 ACs pass with evidence. AC4 is complete: the Founder signed in through Access on 1 Oct and the admin read
     returned through a real session; the forged/expired/wrong-aud/kid/signature matrix returns 401 at the Worker and 302 at the edge.
  2. AC9 (strict 100% capture): NOT met — 3 of 4 fires captured. ACCEPTED as a recorded deviation, for three reasons:
     (a) the delivered events cover every outcome path the pilot can produce (start+success ×2; end-only failed with
         error_class wrangler_auth_10000 ×1), each matched to its run-log line;
     (b) the miss is a transport loss, not a code defect, and is accounted for locally with run_id and cause; the design
         under-reports honestly (spec §7.4) and the job outcome and exit code never changed (AC8 in test, and in production);
     (c) guaranteed delivery is now a binding 002a requirement (on-disk outbox replayed with the same run_id; 001's
         UNIQUE(run_id, phase) + INSERT OR IGNORE makes replay idempotent).
     AC9 is recorded as "met with deviation", not as passed.
  3. Q4 query deviation ACCEPTED. The spec's MAX(started_at) … event_type <> 'start' would read every run row for a job
     (no MIN/MAX shortcut); phase = 'end' ORDER BY started_at DESC LIMIT 1 is equivalent under the table's CHECK and reads
     about 2 rows. No new SCAN; the only SCAN remains the declared ≤60-row registry scan.
  4. Local emitter fetch → node:https with req.destroy() ACCEPTED (recorded 1 Oct). Local Node emitters only; Worker emitters keep fetch.
  5. Security posture improved and holds: the 4 anonymous POSTs return 401 (AC5); no key material in committed files or the
     front end (AC10); ingest keys hashed per emitter; three kill-switch layers proven (AC7). Rollback to 589ae24c reopens the
     anonymous POSTs and stays emergency-only.
  6. Budget and size within limits: ~115 build writes / ~3k reads (500 / 50k); steady state ~4 heartbeat events/day;
     14 endpoints (≤15) and 955 lines (≤1,500). One route of headroom left, so the meridian-control split (002 A6) is
     a precondition for 003/004 routes.
  7. Minor: the close-out header lacks an EXECUTED BY line (ISSUED BY names the Engineering Lead). Not blocking; future
     close-outs should carry all four lines.
CARRIED TO MA-OCT-002 (binding, with the Operations Lead's conditions a–d):
  a. On-disk outbox for local emitters (002a A4), landing before 17 Oct.
  b. trigger='manual' label fixed via OPS_TRIGGER in the plist, with Data-Identity Lead sign-off.
  c. Alerting caller = revived health-check LaunchAgent; N1 (bootstrap /trigger) fixed separately (002a A5).
  d. First Worker emitter passes the error-1042 test and reserves its heartbeat subrequest(s) (N-3).
  F6 (wrangler auth 10000, 36 occurrences, not connectivity-dependent) stays its own Known Issue (22.31), outside 001.
REQUIRED BEFORE APPROVAL: none
```
