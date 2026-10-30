# MA-OCT-005.REVO — Report

```text
CONTROL:      MA-OCT-005.REVO Control v1, SHA-256 f2f2eede66dafd7951b106849f65a4b77bd1f894b290dd370dd8e7ed3754b56a (matches STATUS_BOARD row 74)
TASK:         v1, SHA-256 a3302c731b619683dffa26b228d42b61637f0672fc2bcd81d535d84243fd8d0d (matches the Control)
EXECUTED BY:  Operations Lead (LANE-1-OPS, Cowork). Doc-only: 0 D1, no deploys, no git writes, no secret files.
DATE:         Wed 28 Oct 2026, about 19:45 UTC
VERDICT:      PASS WITH NOTES
FINDINGS:     0 BLOCKER · 6 MUST-FIX before build · 8 NOTE
```

## Preflight

- No `.git/*.lock` files. Local HEAD `c3c6e4a`; `origin/October-2026` = `721d093d2d0448158766c2f591d3c8994a5b2166`.
- All live code was read with `git --no-optional-locks show origin/October-2026:<path>`.
- **Inputs re-hashed, all match the Task:**
  - 005 spec rev 0 `e5fffec6…6e6`;
  - 003 spec `7b8bba9f…80c2`;
  - 004 spec rev 1 `570de1a5…5379`.
- **Independence:** this session wrote none of 003, 004 or 005 (ML-1025-2).

## Output

| File | SHA-256 |
|---|---|
| `claude/MA-OCT-005_Ops_Review.md` | `39b707ff7aab0a8ec4eb625f3bfe1b00c07aebfca2102705dccbc15bc24c496c` |
| `claude/packets/MA-OCT-005.REVO_Report.md` | this file |

## Summary

- **Item 1, actions against the live code:** the seven case actions, CSRF header, request id, replay and actor attribution match `cases.js` at `76f4261` and 004 rev 1. **Gaps:**
  - the forms don't mark the server's required notes;
  - DQ `expected_member_status` is missing;
  - the protected-reopen field shape is unspecified;
  - the response map is missing live codes (`stale_expected_status`, `not_applied`, 200 `replay`).

  → M-4, M-5.
- **Item 2, Option B route count:** **11** routes live today, + 3 from 004, + 1 console = **15 ≤ 15, with 0 headroom.** The path is covered by the existing Access app. The console is human-only, since `serviceGate` refuses tokens on `'other'`.
- **Item 3, reads:** every call is ≤ 500 at `limit=50`, on already-EXPLAINed indexes, with no admin polling. Worst day ≈ 175k (3.5 % of 5M). **The console's Health tab must not poll while not shown** → M-3.
- **Item 4, operational safety:** the operator can change only audited Ops case and ticket state. Protected reopen, force-resolve and member → fixed get a confirm step. **The failure map lacks 500, HTML 5xx and reliable sign-in-expiry detection** (`redirect: 'manual'`) → M-5.
- **Item 5, dates:** the build shrinks to Fri 30; Pages ships only Mon 2, so the shell deployed Sat 31 would load the September `ma-ops.js`. **M-6** re-plans this:
  - pre-cut Fleet and New case;
  - add a shell guard;
  - pre-UAT locally Sat 31;
  - production UAT Mon 2;
  - a defined rollback.
- **Item 6:** a **per-query read watch** is written for the Pre-Refresh Checklist (review §6).
- **Key technical finding (M-1):** the proposed shell CSP would break the console. A nonce in `style-src` disables `'unsafe-inline'`, which blocks live `ma-ops.js`'s 145 `style="…"` attributes. Its 6 inline `onclick` handlers are blocked too. `script-src` should be scoped to `/meridian-atlas/`.
- Other MUST-FIX: **M-2**, build from 721d093's `ma-ops.js` (hidden-tab pause, null enrichment fields).
- **RQ-1 to RQ-5:** accept, accept with M-1, N/A, accept, accept (≤ 1,000, else cut Fleet).

## For the Main Lane

1. Carry M-1 to M-6 into the 005 build brief or a spec rev 0.1; a hash check is enough, no new Ops review.
2. Record that Founder Q1 supersedes 004 §8.1's "005 must not add Worker routes" (N-1).
3. Add the per-query read watch (review §6) to the Pre-Refresh Checklist.

**Stop point:** both outputs written.
