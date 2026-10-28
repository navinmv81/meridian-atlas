# MA-OCT-005.SPEC — Report (UX Lead, REVIEW-007): Operator console spec rev 0

**Control v1:** `c68849ee7116ee6186dfc925b86f686d85a0579c2dc533d09b7ae39b2f96ace6`. It matches STATUS_BOARD row 70 and the Status JSON.
**Task v1:** `0d804183d5bbeb124cb51114e681fb78ec28a835871b6f5d49be5ca86e8a448d`. It matches the Control.
**Date:** Sun 25 Oct 2026, on the Founder's "execute it".
**Git:** `October-2026` @ `c3c6e4a` (shared checkout), read with `--no-optional-locks` only. No `.git/*.lock`.
**Doc-only:**
- 0 D1 reads or writes, no deploys, no git writes;
- no secret file opened (ML-1024-1);
- no macOS prompt.

## Output

| File | SHA-256 | Lines |
|---|---|---|
| `claude/MA-OCT-005_Spec.md` rev 0 | `e5fffec6a69b1a0a69009ab88e990834b361ca13fd15ca9c16978ac3232e6de6` | 473 |

## Inputs (hash-checked)

| Input | SHA-256 | Match |
|---|---|---|
| Scope v2 | `967bebd7…3445` | ✓ |
| 003 Spec rev 1 | `7b8bba9f…80c2` | ✓ |
| 004 Spec rev 1 | `570de1a5…5379` | ✓ |
| `MA-OCT-001_Spec_Review.md` | `8573326f…f5531` | read |
| `App/ma-ops.js` | `9687f759…2d9e5f` (795 lines; read only) | read |
| `App/ma-data.js` | `38eb07ae…6c9ded` | read |

**Live facts** come from the 003.BUILD, SAT24.ENG8 and 002a.A6R reports:
- `meridian-ops` is `14aa968c`;
- A6 is live, with `meridian-control` at `c442209c` serving the board and ledger;
- `meridian-ops` answers the moved public GETs with a 302 to `meridian-control`;
- admin routes answer 302 to Access when unauthenticated.

## Headline

- **Two new tabs in `ma-ops.js`:**
  - **Cases** (003): list, drawer, and all 7 actions as inline forms;
  - **DQ Tickets** (004): list, drawer, member paging, the actions with the "Fixed" gate and the protected-reopen fields.
- **Read-only Fleet tab** (P1, first to cut).
- **Board and ledger stay read-only** (Q2). The dead `prompt()`/`alert()` buttons are removed.
- **No new API, query or table.** Every POST carries JSON, `X-Ops-Client: console`, a UUID `request_id` and `expected_status`. All server responses map to copy (§6.3). Reads are ≤ 102 to ≤ 500 per call, with no polling.

**Finding:** a front-end-only release is not possible for the authenticated views. They run on GitHub Pages and call Access-gated `meridian-ops`, which sends no CORS headers (001 §6.2), and a plain `fetch` gets the Access 302. The spec gives two options, both with all view code in `ma-ops.js` and switched by one constant:

| Option | Backend cost | Browser support | Recommended |
|---|---|---|---|
| **B: same-origin console shell** | One 0-D1 page route, `GET /api/ops/admin/console`. It is the **15th and last** `meridian-ops` endpoint. One deploy. | Every browser | **Yes** |
| **A: inside the terminal** | No new route; credentialed CORS for one origin; Access CORS settings and `SameSite=None` | Expected to fail by default in Safari and Firefox | No |

**Calendar:**

| Day | Work |
|---|---|
| Wed 28 | Cases |
| Thu 29 | DQ Tickets |
| Fri 30 | Shell or CORS, clean-up, tests |
| Sat 31 | One Worker deploy, the October Pages release, Founder UAT |

**Cut order:** Fleet → New case → DQ member edits. Cases and DQ triage are never cut.

## Founder questions (for the combined Decision Request, ML-1025-1)

1. **Q1:** console host, B or A. Recommendation: **B**.
2. **Q2:** keep the board and ledger read-only in October. Recommendation: **yes**.
3. **Q3:** accept the cut order. Recommendation: **yes**.

## Review questions (Operations Lead, Tue 27; Architect consulted)

| # | Question |
|---|---|
| RQ-1 | Use the last endpoint (Option B). Could 004's D-3 page later fold into the console? |
| RQ-2 | The shell's CSP and its trust in GitHub Pages content |
| RQ-3 | If Option A: `SameSite=None` and credentialed CORS |
| RQ-4 | The self-declared "Acting as" role label |
| RQ-5 | The Fleet read budget, measured once at build |

## Independence

This lane (REVIEW-007) wrote this spec. The same Cowork session earlier authored the 003 and 004 specs as LANE-3. **005 must therefore not be reviewed by this session.** The Operations Lead review named in ML-1024-2 should run in a separate session.

Stop point reached. Reply: **"MA-OCT-005.SPEC reported"**.
