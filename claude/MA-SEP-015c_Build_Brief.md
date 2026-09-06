# MA-SEP-015c — Data Quality Exception Engine: Close-out Completion + First Cross-Domain Population (Build Brief)

**Lane:** Data/Identity + Ops | **Owner role:** Entities Product Lead (build) + Tech Ops / SRE (three-point check on the new seeded rows) | **Stage:** APPROVED — ready to execute
**Depends on:** MA-SEP-015a (design, approved 2026-09-05) and MA-SEP-015b (build, deployed live at `https://meridian-entities-api.navinmv1981.workers.dev/exceptions/ui`, but two items from its own Build Brief were left undone — see Part A below).
**Must run in its own dedicated local Claude Code swim-lane** — this cloud Cowork session cannot reach the Cloudflare API for D1 writes, schema changes, or Worker redeploys, and per this project's session discipline, build work does not execute inside the Control master-lane.

**Swim-lane opener:** `Role: Entities Product Lead. Packet: MA-SEP-015c.`

---

## Context

MA-SEP-015b shipped a real, working live page (`entity_exceptions`, Cloudflare Access-protected, confirmed by Control via direct code read on 2026-09-05 — the JWT verification is a genuine signature/aud/exp/iss check against Access's own JWKS, not a header-presence check). The 3 real rows from the old `entity_merge_exceptions` table were migrated correctly, field values matched, not re-derived.

Two things were found still outstanding when Control checked the live repo directly (not reported back by the executing session, since no close-out report has reached Control yet for this packet):

1. **The Build Brief's own "retire" step never ran.** `entity_merge_exceptions` and its three `/admin/exceptions` routes are still live in `entities-api.js` — nothing was dropped. Two exception surfaces are running in parallel right now, not one.
2. **Nothing is committed.** `entities-api.js`, `wrangler-entities-api.toml`, and the new migration SQL are live and deployed but sit as uncommitted/untracked changes in the local working copy.

Separately, the Founder used the live page and asked why it only shows 3 rows, then said he wants this to be the real operational layer for all exceptions going forward. Two known, already-evidenced findings are the natural next rows — both already discussed as candidates for this engine, neither built until now:

- **Known Issue 22.17** — `entity_isin_map` duplicate ISIN-to-entity mappings, two real instances (`US69374H1547`; `AU000000CMW8`/`US49446R1095`), filed as `task_f3f1be29`/`task_7a94ca1d`. **Its fix priority remains on Founder HOLD** — logging it here as a `pending` exception row does not change that; it makes the existing finding visible in the one place the Founder is now using, nothing more.
- **Known Issue 22.9** — 4 known-bad `legal_parent` edges in `entity_relationships`, already decided by the Founder (2026-08-22) as accept-and-document rather than fixed. This packet records that decision as a real row rather than leaving it as text on the Sprint Board only.

## Part A — Finish MA-SEP-015b's own scope (do this first, before Part B)

1. **Re-verify the migration once more** against live D1 before dropping anything: confirm all 3 `entity_exceptions` rows still match their source values in `entity_merge_exceptions` field-for-field (not just a count).
2. **Retire `entity_merge_exceptions`:** drop the table, per MA-SEP-015b's own Build Brief instruction, only after step 1 passes.
3. **Remove the old `/admin/exceptions` routes** (GET/POST/PUT) from `entities-api.js` — the code, the secret-check block, and the route-dispatch entries. Confirm via grep that no reference to `/admin/exceptions` or the old secret-check function remains, mirroring the same grep discipline MA-SEP-012b itself used to confirm zero frontend exposure.
4. **Commit and push everything from MA-SEP-015b + this packet's own changes together**, on `September-2026`: `entities-api.js`, `wrangler-entities-api.toml`, the new migration SQL, and this Build Brief once synced to disk (same recurring habit as every other packet this sprint). Confirm local `HEAD` and `origin/September-2026` match afterward — do not just assume the push landed.
5. **Live-verification matrix, for real, not assumed:** an unauthenticated request to `/exceptions` is rejected by Cloudflare Access before it ever reaches the Worker; a request with a valid Access session succeeds; a rejected write is confirmed absent at the table level (query `entity_exceptions` directly, don't just trust the HTTP response) — this is the check MA-SEP-015b's own Build Brief asked for and that hasn't been reported yet.

## Part B — Seed the two known exception types (only after Part A's step 2 confirms `entity_exceptions` is the sole live table)

### 1. Known Issue 22.9 — `bad_relationship_edge` (4 rows)

Look up the real `entity_id`s for all 4 edges directly from `entity_relationships` — **do not use placeholder or guessed IDs**, per this project's standing rule. The 4 pairs, from the Sprint Board's Known Issue 22.9 entry:

- Cheniere Energy Inc → Alerian MLP ETF
- General Motors Company → PIMCO Enhanced Short Maturity Active ETF
- Banco Comercial Português S.A. → iShares MSCI Poland ETF
- ABB Ltd → SPDR Portfolio Short Term Corporate Bond ETF

For each, insert one row:

```
exception_type        'bad_relationship_edge'
source_table           'entity_relationships'
source_ref             JSON: {"parent_entity_id":<real>,"child_entity_id":<real>,"relationship_type":"legal_parent"}
flagged_reason          'legal_parent edge does not reflect a real legal-parent relationship; likely a MA-SEP-001 dedup-merge side effect (edge created 2026-06-10/11, child entity's updated_at exactly matches the 2026-08-16 04:00:51 merge timestamp; child entity now carries lei = null)'
evidence                free text citing Known Issue 22.9 and the entities-enrich.js/entities-delta.js write sites read (not touched) during MA-SEP-004's diagnostic
proposed_resolution     'root-cause fix would require revisiting MA-SEP-001's entity_relationships repoint logic; not yet scheduled'
decision                'accepted_no_fix'
corporate_action_note   NULL
decided_by              'Founder'
decided_at              '2026-08-22' (the date of the actual accept-and-document decision — real historical date, not today's)
```

### 2. Known Issue 22.17 — `isin_duplicate` (2 rows)

Look up the real `entity_id`(s) tied to each ISIN from `entity_isin_map` — again, no placeholder values. The two instances:

- `US69374H1547` (a new occurrence of the duplicate-ISIN pattern, `task_f3f1be29`)
- `AU000000CMW8` / `US49446R1095` (an older, pre-existing pair, `task_7a94ca1d`)

For each, insert one row:

```
exception_type        'isin_duplicate'
source_table           'entity_isin_map'
source_ref             JSON: {"isin":"<real ISIN>","entity_ids":[<real ids mapped to it>]}
flagged_reason          'entity_isin_map has no dedup/cleanup step on its own write path — same defect class as Known Issue 22.8, independent of that fix (which only touched firds_instrument_reference)'
evidence                reference task_f3f1be29 / task_7a94ca1d and the 2026-08-30 verification pass that found these
proposed_resolution     'likely the same content-diff-WHERE shape as Known Issue 22.8's fix; not yet scoped as its own packet'
decision                'pending'   -- real state: fix priority is on Founder HOLD (2026-08-30), not yet decided either way
corporate_action_note   NULL
decided_by              NULL
decided_at              NULL
```

**This does not resolve or override Known Issue 22.17's standing HOLD.** The row's `decision` stays `pending` — seeding it here only makes an already-known finding visible in the operational surface the Founder is now using; it is not a decision to fix it on any particular timeline.

## Safety

Six real rows total added to an already-tiny table (goes from 3 to 9) — the three-point check from MA-SEP-015b's own Build Brief still applies formally but the volume is trivial. No new Worker, no new cron, no schema change (the table already supports arbitrary `exception_type` values by design — confirm this by actually inserting rather than assuming).

## Do not do

- Do not fabricate or guess any `entity_id` — look every one up for real against live D1, per this project's standing rule (the same discipline MA-SEP-012b applied to its own 3 seed rows).
- Do not seed anything beyond the 4 + 2 rows named above — no other Known Issue, no synthetic examples.
- Do not touch `meridian-holdings`, any ETF-domain table, or any other open packet/Known Issue on the Sprint Board.
- Do not change Known Issue 22.17's or 22.9's status/priority on the Sprint Board itself as part of this packet — that stays Control's job, reconciled from this packet's close-out report.

## Required outputs (close-out report)

- Confirmation of Part A steps 1–5, in order, with real evidence for each (not just "done").
- The exact commit hash(es) once pushed, and independent confirmation that local `HEAD` matches `origin/September-2026`.
- The real `entity_id`s/ISINs used for all 6 new rows (not reproduced here since they weren't looked up yet).
- Final row count in `entity_exceptions` (expect 9) and a live screenshot-equivalent (a real `SELECT *` or the live page's own render) confirming all 9 display correctly, including the two new `exception_type` values rendering sensibly in the existing UI (flag back if the UI needs a small adjustment to display a `bad_relationship_edge` or `isin_duplicate` row sensibly — this Build Brief does not pre-approve UI changes beyond what's needed to not look broken).
- Confirmation `entity_merge_exceptions` no longer exists and no route references it.

Report back to the Control master-lane session with all of the above so the Sprint Board and Release Ledger can be reconciled, same pattern as every prior packet this sprint.

---
*Drafted 2026-09-05 in the Control master-lane (Cowork) session, from direct verification of the live MA-SEP-015b deployment plus the Founder's explicit decisions to (a) seed both known findings now and (b) finish the retire/commit steps via a swim-lane rather than leave both systems running.*
