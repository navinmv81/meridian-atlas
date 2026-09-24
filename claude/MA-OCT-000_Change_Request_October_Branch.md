# Change Request: Create `October-2026` branch from `September-2026`

```text
ISSUED BY:    Program Orchestrator (Control)
EXECUTED BY:  Operations Lead
REVIEWED BY:  Architect
APPROVED BY:  Founder
PACKET:       MA-OCT-000 — Runtime truth baseline (Wave 0 item 0.5)
GATE:         Change Request approval (drafted only — NOT executed)
```

**Requester:** Operations Lead (drafted inside MA-OCT-000) | **Date:** 2026-09-23 | **Priority:** High (blocks Wave 1 builds, 1 Oct)
**Status:** Draft. Drafted only: the branch has **not** been created. It is executed after Architect review and Founder approval, as a separate step.

### Description

Create a new git branch `October-2026` at the current tip of `September-2026` in `navinmv81/meridian-atlas`. Then switch LOCAL_MASTER (`/Users/navinkumar/Desktop/MeridianAtlas/Meridian Atlas Clean (v11)`) to it, so every `MA-OCT-*` commit lands on `October-2026`.

Baseline at drafting time (verified by MA-OCT-000 Part A, 2026-09-23):

- `September-2026` HEAD = `origin/September-2026` = `420487d` ("Incident fix: add .nojekyll…").
- It contains `472d7bf` (MA-SEP-017) and `821a48f` (MA-SEP-013 `/docs`).
- The working tree is clean apart from the untracked-file register in the MA-OCT-000 close-out. None of those files are carried or affected by a branch creation.
- **GitHub Pages serves `September-2026` `/docs`.** This is corroborated byte-for-byte against the live site. `corporate-atlas-v4-deploy-clean` is the rollback Pages source.

### Business Justification

- **One branch per sprint** is the established pattern (`august-sprint-clean-v11` → `September-2026`). It keeps the September release state intact while October work lands on its own branch.
- **It keeps the live site safe during the build.** Pages serves `September-2026/docs`, so October commits to `September-2026` would put half-built work one `generate-docs.mjs` run away from production. A separate branch removes that risk.
- **A clean rollback point.** `September-2026` @ `420487d` becomes the known-good September release, and it can be restored with a Pages source switch alone.
- It follows CLAUDE.md's rule that no branch change proceeds without a change request.

### Impact Analysis

| Area | Impact | Details |
|------|--------|---------|
| Users (site visitors) | None | Pages keeps serving `September-2026/docs`. Creating a branch changes nothing that is served. |
| Founder / sessions | Low | Every October session must confirm `git branch --show-current` = `October-2026`. The Kit v2 opening block and the MA-OCT-000 preconditions must be updated to name the new branch. |
| Systems: GitHub Pages | None now; **decision needed at release** | The live site stays on September content until one of the release options below is chosen. |
| Systems: Cloudflare Workers / D1 | None | Worker deploys are not tied to git (`wrangler deploy` runs from the working tree). No D1 impact. |
| Systems: local LaunchAgents | Low | `firds-weekly-seed` and `entities-enrich-boost` run from absolute paths inside `App/Corporate Atlas/`. Checking out a branch at the same commit changes no file. Later October commits to those scripts will take effect on the next launchd fire, whichever branch is checked out. That already applies to every branch, but October packets touching those files must flag it. |
| Processes | Low | CLAUDE.md "LOCAL_MASTER's own git branch" line moves to `October-2026`. The Sprint Board mirror and Release Ledger reference the new branch. |
| Cost | None | — |

### Release-path decision (for Architect review; not decided in this CR)

At the October release (29–31 Oct), the October work has to reach `/docs` on whichever branch Pages serves. There are two options:

- **Option A — switch Pages to `October-2026` `/docs`.** This repeats the MA-SEP-013 Step 5 pattern. It is a manual Founder step, and `.nojekyll` is already carried in `docs/`. `September-2026` then becomes the rollback source.
- **Option B — fast-forward `September-2026` to `October-2026`.** Pages stays pointed where it is. This only works if `September-2026` receives no commits in October, and it blurs the "September release state" rollback point.

**Recommendation: Option A.** It keeps each sprint branch as an immutable release record and matches the previous transition. Either way, `September-2026` should receive **no** commits after this CR executes, except the MA-OCT-000 close-out commit if it lands first.

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| A session keeps committing to `September-2026` by habit. This happened before: MA-SEP-009/010 landed on `august-sprint-clean-v11` by mistake. | M | M | Update CLAUDE.md in the same commit. Brief preconditions check the branch name. The weekly Orchestrator status runs `git log origin/September-2026 ^420487d` and expects it to be empty. |
| `September-2026` gets new commits in October, so the Option B fast-forward is no longer clean | L | M | Treat `September-2026` as frozen. If it happens anyway, merge rather than force-push. |
| MA-OCT-000's close-out commit lands after the branch is created | M | L | Sequence: commit and push MA-OCT-000 on `September-2026` **first**, then create `October-2026` from the new tip. Record the actual base SHA at execution time; it may differ from `420487d`. |
| Untracked files (`13F Seed/gleif-seed.js`, drafts) accidentally committed on the new branch | L | **H**: `gleif-seed.js` contains a token literal and the repo is public | Stage by explicit path only. Never `git add -A` or `git add .`. `gleif-seed.js` stays untouched under the standing rule. |
| Public repo: a new branch re-exposes history | — | — | No new exposure. The branch shares existing history. (The historical token literals in `c3a07c7` are a separate finding in the MA-OCT-000 close-out.) |

### Implementation Plan (runs only after approval)

| Step | Owner | Timeline | Dependencies |
|------|-------|----------|--------------|
| 1. Confirm the MA-OCT-000 commit is pushed and `HEAD == origin/September-2026`. Record the SHA. | Operations Lead | After MA-OCT-000 close-out approval (~29 Sep) | MA-OCT-000 approved |
| 2. `git switch -c October-2026` from that SHA, then `git push -u origin October-2026`. No force, no Pages change. | Operations Lead | Same session | Step 1 |
| 3. Verify: `git rev-parse October-2026 origin/October-2026 September-2026` all equal. `git branch --show-current` = `October-2026`. | Operations Lead | Same session | Step 2 |
| 4. Update CLAUDE.md "LOCAL_MASTER's own git branch" to `October-2026`. Commit on `October-2026`. | Operations Lead | Same session | Step 3 |
| 5. Record in the October Decisions Log, Sprint Board mirror and Release Ledger | Program Orchestrator | Next day | Step 4 |

### Communication Plan

| Audience | Message | Channel | Timing |
|----------|---------|---------|--------|
| All October swim-lane sessions | Branch is now `October-2026`. `September-2026` is frozen as the September release record. | Build-brief preconditions + CLAUDE.md | At execution |
| Founder | Live site unaffected. Release path is Option A (Pages switch) unless changed. | October Main Lane | At approval |
| Architect | Review the release-path recommendation | Review block, Addendum §3 | With this CR |

### Rollback Plan

- **Trigger:** the branch was created from the wrong SHA, sessions are confused about which branch to use, or the Founder withdraws approval before October commits exist.
- **Steps (before any October commits):** `git switch September-2026`, then `git branch -d October-2026`, then `git push origin --delete October-2026`, then revert the CLAUDE.md line.
- **Steps (after October commits exist):** do not delete. Keep the branch, and decide on a merge back into `September-2026` under a new CR.
- **Verification:** `git branch -a` no longer lists `October-2026`. `git branch --show-current` = `September-2026`. The live site is still byte-identical to `September-2026/docs` (it never changed).

### Approvals Required

| Approver | Role | Status |
|----------|------|--------|
| Architect | Design and safety review (Addendum D1) | Pending |
| Founder | Gate approval | Pending |
