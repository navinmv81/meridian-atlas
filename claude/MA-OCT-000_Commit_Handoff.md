# MA-OCT-000 — Commit Handoff (branch first)

```text
ISSUED BY:    Program Orchestrator (October Main Lane)
EXECUTED BY:  Operations Lead (the MA-OCT-000 lane, local Claude Code, Clean (v11))
REVIEWED BY:  Architect (hash re-check reported back to the Main Lane)
APPROVED BY:  Founder, 2026-09-24 ("Branch first")
PACKET:       MA-OCT-000 — final step (deferred commit)
GATE:         Close-out approved; this is the recording step
```

**Decision:** the Founder approved MA-OCT-000 on 2026-09-24 and chose **branch first**. This replaces the earlier "defer commit to pre-go-live" decision. `September-2026` stays frozen, and the live site (Pages → `September-2026` `/docs`) is untouched.

## Steps (stop and report on any mismatch)

1. **Preflight.** `pwd` is the baseline root. `git status --short --branch` shows `September-2026` at `420487d`, level with origin. `git diff --cached --name-only` is empty.
2. **Hash re-check.** Recompute SHA-256 for the 10 files listed in `claude/MA-OCT-000_Review_Checksums.txt`. **All 10 must match.** If any differs, STOP and report; do not commit.
3. **Create the branch** from the current HEAD. Uncommitted changes carry over:
   ```bash
   git switch -c October-2026
   ```
4. **F8 rename** (Architect review, finding 8):
   ```bash
   git mv MA-OCT-001_Spec.md "claude/MA-OCT-001-LEGACY_DQ_Exception_Spec.md"
   ```
5. **Stage by explicit path only.** Never use `-A` or `.`.
   ```bash
   git add CLAUDE.md \
     claude/MA-OCT-000_Build_Brief.md \
     claude/Meridian_October_Operating_Kit_v3_Addendum.md \
     claude/meridian-october-operating-kit-v2.md \
     claude/meridian-october-revised-scope-v2.md \
     claude/MA-OCT-004-Bond-Spec.md \
     claude/MA-OCT-000_Job_Manifest.md \
     claude/MA-OCT-000_job_manifest.json \
     claude/MA-OCT-000_Closeout_Summary.md \
     claude/MA-OCT-000_Change_Request_October_Branch.md \
     claude/MA-OCT-000_Review_Checksums.txt \
     claude/MA-OCT-000_Architect_Review.md \
     claude/MA-OCT-000_Commit_Handoff.md \
     claude/October_Decisions_Log.md \
     claude/MA-OCT-012_Build_Brief.md
   ```
   **Do not stage:**
   - `13F Seed/gleif-seed.js` (standing rule; it contains a revoked token literal)
   - `Claude outputs/`
   - the root `MA-SEP-010_Change_Request.md` and `Meridian_Atlas_Current_State_v13.docx`
   - the Word lock file
   - the untracked `claude/MA-SEP-014/015*` docs and `September_Sprint_Testing_Runbook.md`
6. **Show** `git diff --cached --stat` and confirm it lists exactly the 15 files plus 1 rename.
7. **Secret scan the staged diff** (`git diff --cached`) for `cfoat_`, the `.env` token and generic bearer or token patterns. It must be clean.
8. **Commit:**
   ```
   MA-OCT-000: runtime truth baseline, October governing docs, branch October-2026 (CR Option A, branch-first)
   ```
9. **Push:** `git push -u origin October-2026`. Then confirm with `git rev-parse HEAD origin/October-2026` that they match.
10. **Confirm the live site is unaffected:** `origin/September-2026` is still `420487d`.
11. **Report back to the Main Lane** with the commit SHA, the push confirmation, the 10-hash re-check result and the staged-file list.

## After this
- Every October lane works on **`October-2026`** from now on.
- Commits to `September-2026` are prohibited. It is the frozen September release record and the Pages source until the October go-live (CR Option A).
- **Still pending, not part of this step:** updating the `sprintboarditems` row `MA-OCT-001` to `SUPERSEDED → MA-OCT-003/004`. This is a D1 write, so it will be done in a later lane that has D1 access, with its own approval.
