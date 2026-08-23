# Build Brief

## Ticket
- ID: MA-SEP-001
- Title: Entity duplicate cleanup (`entity_master`)
- Stage: ENG_DIAGNOSTIC (opens with an audit, not a build)

## Approved scope
- Full audit of the entity master table via `/explore-data`: a table-wide LEI-collision count and name-normalization duplicate scan, not limited to the 3 pairs already confirmed (Danaher; CureVac NV / CureVac N.V.; Jai Corp Ltd / JAI CORP LIMITED). Current State v12 §22.3 explicitly says full scope is unknown until this runs.
- Resolve confirmed duplicate pairs: merge into one canonical `entity_id`, repoint dependent rows in `entity_relationships`, `fund_entity_link`, `instrument_entity_map`, `entity_exposure_monthly`, `fund_exposure_coverage`, `entity_enrichment_queue` to the surviving row, then remove the duplicate row — as one reviewed batch per pair, not ad hoc deletes.
- Normalize the matching/creation logic so the same pattern (legal-suffix variants: NV/N.V., Ltd/Limited, Corp/Corporation, etc.) isn't reintroduced by future entity-creation pipelines (`meridian-entities-seed`, `meridian-entities-enrich`). Document the fix.
- Close with `/validate-data` before marking CLOSED on the Sprint Board.
- Done-condition (per Meridian-Sept-Scope.md): zero known duplicate pairs remain; normalization fix documented for future prevention.

## Architecture constraints
- **Confirm the physical table name first.** CLAUDE.md's enabled-skills section and the Entities-domain table list use `entitymaster` (no underscore); Sprint Board / Scope docs colloquially say `entity_master`. Do not assume — check the live schema before writing any query.
- This is an Entities-domain table (owned by Entities Product Lead lane per project instructions). ETF-domain tables (`etfmaster`, `fundholdingsmonthly`, `fundsnapshotmonthly`, `universechangesmonthly`, `holdingspipelinestate`, `etfaliases`, `edgarbootstrap*`) are strictly read-only from this packet.
- D1 writes: always `INSERT OR IGNORE` / `ON CONFLICT DO NOTHING`, batched via `db.batch()` — never loop individual inserts.
- Any merge/delete touching the dependent tables listed under Approved Scope must go in as a single reviewed batch per pair, with a before/after row-count check.
- No new cron. If any new heavy query is introduced, it needs the three-point check first (index audit — no full scan; single-execution read test under 50k rows; documented read/write budget) before anything runs on a schedule.
- LOCAL_MASTER is `Meridian Atlas Clean (v11)` (branch `august-sprint-clean-v11`) per MA-SEP-000. This packet is backend/data only — no frontend/`App/` changes in scope.
- This packet is intended to run from local Claude Code (this repo), since it needs live Cloudflare/D1 API access that the Cowork cloud sandbox cannot reach (confirmed 2026-08-15) — same constraint already documented for MA-AUG-003's local LaunchAgent requirement.

## UX constraints
- None. Backend data-integrity packet only — no UI changes. (MA-SEP-004's hierarchy UI depends on this closing cleanly first, but is out of scope here.)

## Touched assets
- `entity_master` (name TBC — see above)
- Read + guarded repoint-write: `entity_relationships`, `fund_entity_link`, `instrument_entity_map`, `entity_exposure_monthly`, `fund_exposure_coverage`, `entity_enrichment_queue`
- Possibly `meridian-entities-seed` / `meridian-entities-enrich` Worker code, only if the normalization fix requires a code change there. No new Worker.

## Do not do
- No scope expansion — do not touch ETF-domain tables; do not start MA-SEP-003/004 work even if it feels adjacent or convenient.
- No schema changes beyond what's needed to fix the duplicate/matching issue.
- No cron enablement or schedule changes.
- No merge decision on an ambiguous pair without Founder sign-off. Auto-merge only pairs meeting a clearly stated confidence bar (e.g. LEI match + normalized-name match); flag everything else for the Founder rather than guessing.

## Required outputs
- Touched files (any Worker code changed for the normalization fix)
- Migration/data changes: row counts before/after per merge, which row survived
- Query/index implications: confirm no full scan introduced
- Tests performed: `/validate-data` output
- Release implications: any Worker redeploy needed for the normalization fix
- Risks / follow-ups: full duplicate scope found vs. the 3 known pairs; any ambiguous pairs punted to the Founder

## First step (this session)
1. Confirm the physical table name (`entitymaster` vs `entity_master`) via schema inspection.
2. Run `/explore-data` as a full-scope audit (LEI-collision count + name-normalization scan across the whole table).
3. Report the full duplicate scope back before doing any merge.

---
*Drafted 2026-08-15 in the Control master-lane Cowork session, per Sept Operating Kit's session structure. Copied into the repo at `Meridian Atlas Clean (v11)` for local Claude Code to read directly.*
