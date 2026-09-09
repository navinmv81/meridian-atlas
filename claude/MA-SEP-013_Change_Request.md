# MA-SEP-013 — Change Request: Retarget Live GitHub Pages Source to `September-2026`

**Role: Tech Ops / SRE (branch/deploy-environment matter, per CLAUDE.md's role definitions). Packet: MA-SEP-013.**

*Drafted 2026-09-09 by the Control master-lane Cowork session, per CLAUDE.md's Non-Negotiable Rule: "No environment, branch, folder, or schema change proceeds without `/change-request` producing an impact analysis and rollback plan first." Durable Project doc per this project's standing rule — Change Requests are never left as in-conversation prompt text.*

---

## Change Request: Retarget GitHub Pages from `corporate-atlas-v4-deploy-clean` to `September-2026`

**Requester:** Nav (Founder) | **Date:** 2026-09-09 | **Priority:** High (blocks go-live target)
**Status:** Draft — Pending Approval

### Description

Today, GitHub Pages (the live Meridian Atlas frontend) builds from `corporate-atlas-v4-deploy-clean`, a branch that exists solely as a flat-root mirror of the 11 frontend files (`index.html`, `ma-etf.js`, `ma-entities.js`, `ma-13f.js`, `ma-research.js`, `ma-ops.js`, `ma-modal.js`, `ma-dcf.js`, `ma-market.js`, `ma-data.js`, `ma-search.js`). It is not LOCAL_MASTER's own branch. Every frontend release requires a manual "flatten and copy" step: taking the current files from `App/` on LOCAL_MASTER (`September-2026`) and pushing a flattened copy into the separate deploy branch.

The Founder has decided (2026-09-09, in response to this session's direct question) that `September-2026` — LOCAL_MASTER's actual working branch, where all current GitHub work already lives — should become the live GitHub Pages source directly, ending the two-branch deploy model. His own words: *"All local files are here - '/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)' and all Github latest are in September 2026 folder, we should get to September 2026 in github as the live version."*

**Structural problem this change must solve:** `September-2026`'s frontend files sit nested inside an `App/` subfolder (alongside `App/Corporate Atlas/`, `App/ETF Refresh/`, `App/Ops/` backend source), not flat at repo root. GitHub Pages requires the served files to be flat at root (or in a `/docs` folder at root) — it cannot serve out of an arbitrary nested subfolder. Simply switching Pages' source branch to `September-2026` without addressing this would break the live site immediately.

**Proposed mechanism:** Configure GitHub Pages to build from `September-2026`, source folder `/docs`. Maintain `/docs` as a generated, flattened mirror of the 11 `App/`-nested frontend files, produced by adapting the existing manual flatten-and-copy tooling to write into `/docs` on the same branch instead of into the separate `corporate-atlas-v4-deploy-clean` branch. Backend/Worker source (`App/Corporate Atlas/`, `App/ETF Refresh/`, `App/Ops/`) and `13F Seed/` at repo root are untouched by this change — only the frontend publish mechanism changes.

`corporate-atlas-v4-deploy-clean` is **not deleted**. It remains fully intact, untouched, and available as an instant rollback path — reverting live service to it requires only a GitHub Settings change (Pages source), not a git operation.

### Business Justification

- Eliminates a standing manual, error-prone step (flatten-and-copy into a separate branch) that has been the single point of "frontend built but not live" confusion across multiple packets this sprint (MA-SEP-004, MA-SEP-014 both currently sit built-but-not-deployed for exactly this reason).
- Collapses two branches doing the job of one into a single source of truth (`September-2026`) for both local development and what GitHub actually serves, directly supporting the Founder's stated go-live goal for the weekend of 19–20 Sep 2026.
- Reduces the risk of exactly the kind of drift this project has already hit (LOCAL_MASTER branch renames outpacing CLAUDE.md's own Environment Truth section, e.g. MA-SEP-000/MA-SEP-008 history).

### Impact Analysis

| Area | Impact | Details |
|------|--------|---------|
| Users | Low | Single-user (Founder) product; no external users of the live site are known to depend on continuity of any particular URL structure — only on the site staying up. |
| Systems | Medium | GitHub Pages source setting changes; new `/docs`-generation tooling created (adapted from existing flatten-and-copy script); no Worker, D1, or cron touched — Worker/D1 side is entirely unaffected by this change. |
| Processes | Medium | Replaces the "flatten and copy to `corporate-atlas-v4-deploy-clean`" release step with "flatten and copy to `September-2026`'s `/docs` folder, then push." One fewer branch to reason about per release. CLAUDE.md's Environment Truth section must be updated post-cutover (see Rollback/Sustain below) — currently names `corporate-atlas-v4-deploy-clean` as DEPLOY_BRANCH. |
| Cost | None | No infrastructure cost change — GitHub Pages and Cloudflare Workers free tiers unaffected either way. |

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| New `/docs`-generation script is untested code, not just a renamed path — a bug could push a broken or partial flatten to the folder GitHub actually serves. | Medium | High | Dry-run the script against a local checkout first; diff its `/docs` output against a manually-flattened copy before ever pointing Pages at it; do not wire it into any automated/cron step this sprint — manual-trigger only, same discipline as today's manual step. |
| GitHub Pages source-setting changes take effect within minutes — a misconfigured `/docs` folder at the moment of cutover is a live-site-down risk with no cooling-off period. | Low | High | Perform the cutover only after `/docs` has been fully populated and manually verified (open `index.html` locally, confirm all 11 files resolve with correct relative paths) *before* flipping the GitHub Pages source setting. Cutover itself is a single Settings-page change, done last, not first. |
| CLAUDE.md's Environment Truth section explicitly names `corporate-atlas-v4-deploy-clean` as DEPLOY_BRANCH; if not updated post-cutover, the repo's own source-of-truth file will misstate live reality — exactly the staleness pattern already seen once with the LOCAL_MASTER branch rename (MA-SEP-000/008). | High (if forgotten) | Medium | Make the CLAUDE.md Environment Truth update an explicit, checked step in this packet's own close-out evidence requirements (see Implementation Plan) — not a follow-up to remember later. |
| Schedule risk: building and dry-run testing new deploy tooling in the 10 days before a hard 19–20 Sep go-live target competes with the "everything built in September" release-event scope the Founder also wants finished the same weekend. | Medium | Medium | Sequence this Change Request's execution *before*, not alongside, the final release-event push — treat the branch retarget as infrastructure that must be stable first, so the actual go-live weekend is a content push onto already-proven tooling, not a simultaneous tooling-and-content risk. |

### Implementation Plan

| Step | Owner | Timeline | Dependencies |
|------|-------|----------|--------------|
| 1. Founder approves this Change Request | Founder | 2026-09-09/10 | This document |
| 2. Open dedicated Tech Ops swim-lane (`Role: Tech Ops / SRE. Packet: MA-SEP-013.`); adapt existing flatten-and-copy script to write into `September-2026`'s `/docs` folder instead of the separate branch | Tech Ops / SRE (local swim-lane) | By ~2026-09-12 | Step 1 |
| 3. Dry-run the adapted script locally; diff `/docs` output against a manual flatten for correctness; do not push yet | Tech Ops / SRE (local swim-lane) | Same session as Step 2 | Step 2 |
| 4. Push verified `/docs` folder to `September-2026`; manually confirm all 11 files present and correct in the pushed branch | Tech Ops / SRE (local swim-lane) | Same session | Step 3 |
| 5. Flip GitHub Pages source setting to `September-2026` / `/docs`; confirm live site loads correctly within minutes | Founder (GitHub Settings access) or Tech Ops swim-lane if Founder delegates | Immediately after Step 4, same session ideally | Step 4 |
| 6. Update CLAUDE.md's Environment Truth section: DEPLOY_BRANCH becomes `September-2026` (`/docs` folder), remove the "separate branch" language, note `corporate-atlas-v4-deploy-clean` as retained-but-inactive rollback branch | Tech Ops / SRE (local swim-lane) | Same session as Step 5 | Step 5 |
| 7. Update Sprint_Board.md / Release_Ledger.md to reflect the new deploy mechanism | Control (this session) | Same day as Step 6's close-out report | Step 6 |
| 8. Buffer/smoke-test window before the actual go-live weekend content push | Founder + swim-lanes | ~2026-09-13 through 18 | Steps 1–7 complete |

Respects the Founder's stated ~2–3 hr/day capacity — Steps 2–6 are sized to fit inside one swim-lane session, not spread across many.

### Communication Plan

| Audience | Message | Channel | Timing |
|----------|---------|---------|--------|
| Founder (sole stakeholder) | This Change Request itself — approval requested before any swim-lane touches GitHub Pages settings or writes new tooling | Project doc + device push (`claude/` folder) | 2026-09-09, now |
| Founder | Confirmation once cutover (Step 5) is live and verified | Sprint Board update / close-out report | Same day as Step 5 |

No external audience — single-person project, no team or user base requiring advance notice beyond the Founder's own approval.

### Rollback Plan

- **Trigger:** live site fails to load, loads incorrectly (missing/broken JS modules, broken relative paths), or any smoke-test check fails after the Step 5 cutover.
- **Steps:** In GitHub repo Settings → Pages, revert the source setting back to `corporate-atlas-v4-deploy-clean` (branch, root). This branch is not touched or deleted by this change and still reflects the last-known-good flat-root frontend as of MA-SEP-013's own scoping. No git revert or force-push is needed — this is a Settings-only rollback.
- **Verification:** Reload the live site; confirm it matches pre-cutover behavior. Cross-check against the last confirmed-good state recorded in Release_Ledger.md for the pre-MA-SEP-013 deploy.

### Approvals Required

| Approver | Role | Status |
|----------|------|--------|
| Nav | Founder / sole approver | Pending |

---

## Notes for the executing swim-lane

- This Change Request authorizes the branch/environment change itself. A separate `/write-spec` Spec for MA-SEP-013's full go-live batch (per the Founder's "everything we build for in September" scope decision) is being drafted alongside this document and will define exactly what content ships in the go-live weekend push — this document only covers the deploy-mechanism change.
- Do not delete `corporate-atlas-v4-deploy-clean` as part of this packet, now or later — it is the rollback path referenced above and should only be reconsidered for removal well after the go-live weekend has proven stable.
- Standard close-out evidence applies: exact commit hash(es) for the `/docs`-generation tooling and the `September-2026` push, independent `HEAD`/`origin` confirmation, screenshots or a plain confirmation of the live site post-cutover, and a one-line outcome note for the Sprint Board.
