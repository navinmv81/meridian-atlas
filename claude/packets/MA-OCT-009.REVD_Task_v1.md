# MA-OCT-009.REVD — Task v1 (immutable): Data-Identity review of the 009/010 Fixed Income spec rev 0

Review `claude/MA-OCT-009_010_Spec.md` rev 0 as **Data-Identity Lead**. Answer every §15 review question addressed to the Data-Identity Lead, and check:
1. The gate (§4): who opens it, on what AC12 evidence (exact keys, expected issuer for the 4 PepsiCo Singapore keys), the one statement, and the close/kill-switch use after Sat 31.
2. `parse_confidence >= 60` and the other row filters match 008 §16 and DIL14; no bond row can be shown linked to a guarantor.
3. Issuer identity on the 010 page: which entity is shown as issuer vs guarantor; LEI display; empty state when the gate is closed.
4. The **pre-deploy PepsiCo check** (≤ 8 PK reads on the 4 keys) now inside the 009 build: define pass/fail precisely.
5. Data-quality items that should become 004 tickets.

**Inputs (verify SHA-256 before reading; stop on mismatch):**
- `claude/MA-OCT-009_010_Spec.md` rev 0 `8216123ec92f17b6f0f828246305a01bb7ea4b6ec0a59f1945b192131f8ef3b4`
- `claude/MA-OCT-008_Spec.md` `bcdad9a2d315371b9c60b11cbcf72dfca88c99dca22fbe4e5310e2fb5f815cd3`
- `claude/packets/MA-OCT-008.DIL14_Report.md` `c517dde7b9a561870ef1123b33d55a2d99fcbdb6f3bbb197dd946691d11c9399`
- `claude/MA-OCT-007_Spec.md` rev 1.4 `4d4fffefab020d516a1804843d01142452306bd07e20275a0cd1bf79759b397c`
- **Code:** read live code from git, not the shared working copy (it holds stale uncommitted 003 copies): `git --no-optional-locks show origin/October-2026:<path>` at **`721d093`**.

**Founder decisions already taken (do not re-open; check the spec against them):**
- Q1 yes: a "Fixed Income" nav link opens the `#/fi` issuer directory as a 007 layer; full FI panel → November.
- Q2 yes: the gate is the one-row Entities-domain table `fi_serving_gate`, created closed, opened by the Data-Identity Lead on AC12 evidence; also the kill switch.
- Q3 yes: PepsiCo check before any front end can reach R1f.

**Plan changes since the spec was written (check the spec still works):**
- Option C (ML-1025-5): go-live **Tue 3 Nov**; last production change **Mon 2 Nov**.
- 009/010 build **Wed 28** (local); `meridian-entities-api` deploy **Thu 29**, gate closed; gate opens after the 008 AC12 re-check passes (Wed 28–Thu 29).
- ML-1026-1: the 007 front end was **not** released Mon 26; GitHub Pages serves `September-2026/docs`. The 007 + 010 front ends ship together in the **Mon 2 Nov site release**. The ≤ 8-read PepsiCo check moves into the 009 build as a **pre-deploy** check.
- 003 deploy 5 (old-route retirement on `meridian-entities-api`) goes **Wed 28 before** the 009 build, so the 009 diff must rebase on it.

**Rules:** doc-only review lane (Cowork). **No D1 calls, no deploys, no git writes**, no secrets (ML-1024-1: never read the contents of `~/.meridian-secrets/*`, `.env*`, `*.secret`). Write only the two files named below. Keep it short: findings with severity (BLOCKER / MUST-FIX before build / NOTE), each tied to a spec section, plus a verdict **PASS / PASS WITH NOTES / FAIL**.

**Outputs:** `claude/MA-OCT-009_010_DIL_Review.md` and `claude/packets/MA-OCT-009.REVD_Report.md` (verdict, findings count by severity, output SHA-256). Reply **"MA-OCT-009.REVD reported"**.
