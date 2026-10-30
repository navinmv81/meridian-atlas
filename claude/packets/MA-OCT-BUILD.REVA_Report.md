# MA-OCT-BUILD.REVA — Report (REVIEW-A, Architect)

```text
PACKET:   MA-OCT-BUILD.REVA — Architect code review — 004 build + 009/010 build
CONTROL:  claude/packets/MA-OCT-BUILD.REVA_Control_v1.md  0e3f6288d3680fc7c4d4e86fc30cbaa8276f4f137f57cb630c4445132bf115f6  (matches STATUS_BOARD row 85)
TASK:     claude/packets/MA-OCT-BUILD.REVA_Task_v1.md     fa563ec2d17db607406e8aede6d4d4d10b012f0ca616d299b2a4e75408d3758c  (matches Control)
OUTPUT:   claude/MA-OCT-004_009_Code_Review.md            42ef70392403cffe5b8bde3bdc989d393e6f4d4b9bda27e19d9cb9fa16ffa8b8  (260 lines)
SESSION:  Thu 29 Oct, 20:15–20:30Z, Claude Code, read-only, inside the stop point (23:45Z)
```

## Opener checks
- **Locks and branch:** no `.git/*.lock`; the shared checkout is on `October-2026`.
- **Control and Task:** Control re-hashed = board row 85; Task re-hashed = Control.
- **Inputs, all four re-hashed = Task:**
  - 004 report `8eddf582…`;
  - 004 spec rev 1 `570de1a5…`, committed;
  - 009 report `a32e8d0b…`;
  - 009/010 spec rev 1 `2f83d58e…`, working copy only.
- **Wrangler:** `/usr/local/bin/wrangler` 4.96.0, and `whoami` OK.

## Verdicts
| Build | Verdict | B | MUST-FIX (deploy) | MUST-FIX (Mon 2 release) | NOTE | Fri 30 deploy |
|---|---|---|---|---|---|---|
| **004** | **PASS WITH NOTES** | 0 | 3 | — | 9 | **Yes, first**, after M4-1..3 |
| **009/010** | **PASS WITH NOTES** | 0 | 2 | 2 | 5 | **Yes, after 004**, after M9-1..2 |

**MUST-FIX before deploy:**
- **M4-1:** the 004 worktree sits on `acfd069`, not deploy 4 `fd7b753`.
  - The scratch merge has 2 conflicts, in `ops-api.js` `sweep()` and in the toml `[vars]`. Both resolve by keeping both sides, and the toml keeps a single `OPS_SERVICE_ACTORS` line, 004's superset.
  - All Ops suites are green on the merged tree.
  - LANE-1-ENG reproduces this and records the merged hashes.
- **M4-2:** the run sheet's expected case_refs `DQ-000010…21` assume `sqlite_sequence` = 9.
  - Sat 24's M1 re-runs (`INSERT OR IGNORE … SELECT` over existing rows) likely spent ids. This was reproduced locally.
  - Fix: read `sqlite_sequence` at step 3, gate on counts and `dedupe_key` rather than case_refs, and run no D-2 test ticket before the seeds.
- **M4-3:** the run sheet is dated Thu 29. It needs re-issuing for Fri 30 against FREEZES and the A2 window. A2 batches do not run during a `meridian-ops` deploy, so the Main Lane sequences the two.
- **M9-1:** commit spec rev 1 before the 009 Worker commit.
- **M9-2:** the suggested 08:10Z slot is inside A2's Entities-writer freeze, and the A2 spec exempts the gate *flip*, not its CREATE. Either:
  - run the gate migration in the 07:10–07:55Z gap, or
  - have the Main Lane record an explicit exemption.

**MUST-FIX before the Mon 2 release (010):**
- **M9-3:** the copy for `ambiguous`/`source_conflict` with fewer than 2 candidates ("0 candidate issuers… Choose one.").
- **M9-4:** the F1 page-local "latest filing" must not be labelled as the issuer's latest filing. Use F3's `latest_filing`, or relabel it "among the bonds shown".

**Rulings on the lane items:**

| Lane item | Ruling | Follow-up |
|---|---|---|
| 004 B-2 | Upheld. Run `schedule_fix` first. | App. A B1 erratum |
| 004 E8 | Accepted. | NOTE: non-ISIN-shaped 12-character keys and `TICKER:` keys with spaces fail closed |
| 004 `LIKE` | Accepted. SCAN confirmed remotely; about 22 rows. | November range rewrite |
| 004 B-7 | Accepted as cosmetic, but the "matches spec" claim is withdrawn. | M4-2 |
| 009 item 1 | Accepted. Fixture only, 58/58 re-run. | — |
| 009 item 2 | Accepted. The proof moves to the open re-run; the closed smoke asserts `no-store`. | T-F10 erratum |
| 009 item 3 | Worker correct. | Front end: M9-3 |
| 009 item 4 | Accepted. It gates the Mon 2 release; preview from the worktree's own untracked config. | Main Lane call |
| 009 item 5 | Upheld. | M9-1 |
| 009 item 6 | Not accepted as labelled. | M9-4 |

**Base and endpoints:**
- **`meridian-ops`:** live = `2e4c3fc6` "deploy 4 (sweep, fd7b753)", 19:34:01Z Thu, confirmed by `wrangler deployments list`. Endpoints are 14/15: deploy 4 adds no route.
- **`meridian-entities-api`:** live = `1e54a425` (009 rollback target). The 009 base has no drift to origin `71fab4b`.

**Three-point checks:** confirmed for both builds.
- **004:**
  - remote EXPLAIN of 4 statements matches (the seed `LIKE` SCAN is the accepted exception);
  - the largest single execution is about 710 rows;
  - the one-time load is about 550 writes.
- **009:**
  - 14 plans;
  - F3 is ≤ about 1.5k reads;
  - uncached use is about 0.5–0.7M reads/day;
  - the gate migration is about 3 writes.

## Production and governance footprint
- **D1:** 0 rows read, 0 written. 4 remote `EXPLAIN QUERY PLAN` statements (limit 20).
- **Deploys and commits:** 0 deploys, 0 commits, 0 code edits. Both worktrees were left as found.
- **Scratch:** the merge check ran in the session scratchpad only.
- **Production changes:** none started, so there was no announcement.
- **Secrets:** no secrets or `.env*` read (ML-1024-1).
- **macOS:** no permission prompts.
- **Files written:** only the review file and this report.

MA-OCT-BUILD.REVA reported.
