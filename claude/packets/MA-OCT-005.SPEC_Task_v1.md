# MA-OCT-005.SPEC — Task v1 (immutable): 005 Operator console redesign — spec rev 0

**ISSUED BY:** Main Lane, Sun 25 Oct · **EXECUTED BY:** UX Lead (REVIEW-007) (spec author)

Write **`claude/MA-OCT-005_Spec.md`**.

Inputs: `claude/meridian-october-revised-scope-v2.md` (`967bebd7c1762a0389d150d96a04ae08c4f0df0cdaf127328f0f4a88e1f33445`) §MA-OCT-005; `claude/MA-OCT-003_Spec.md` rev 1 (`7b8bba9f3adb582c495c3899717a98dee61d8c0f285919b221240ca1483480c2`) — the live case routes (list, detail, actions with CSRF `X-Ops-Client`, request_id) on `meridian-ops`; `claude/MA-OCT-004_Spec.md` rev 1 (`570de1a571a69c752ce26ce3502177fbadca8e9fcb0d00b4f44f992c9dee5379`) — DQ tickets (live from Tue 27); `claude/MA-OCT-001_Spec_Review.md` (the closed board/ledger buttons); the A6 split (`meridian-control` serves Sprint Board / Release Ledger / events / drift; `meridian-ops` redirects the public GETs); `App/ma-ops.js` (read only).

Cover: the Ops tabs redesign in `ma-ops.js` — a Cases view (003) and a DQ Tickets view (004) with list, detail and the allowed actions behind Access; restoring board/ledger actions only if they are safe and in scope; states and copy; Access/CSRF handling from the browser; reads per view; tests; front-end-only release if possible (no new Worker routes).

Calendar (Founder, ML-1024-3): reviews Tue 27; build Wed 28 – Fri 30; last production deploy **Sat 31 Oct**; release sign-off Sun 1 Nov. Size the spec to fit that, and say what must be cut to fit if needed.

Global rules: vanilla ES6, no frameworks/bundlers; Workers Web-APIs only; one D1 `meridian-etf`; three-point check (index audit, single execution < 50k reads, per-invocation read/write budget) for every query; state the domain (ETF / Entities / Ops) of any new table; ETF tables read-only; no new cron unless a CR (5/5 slots used). Doc-only: 0 D1 writes; read-only EXPLAIN/point reads ≤ 2k total allowed only through a named Engineering lane later — not in this packet; no git writes.

End the spec with: open questions for the Founder (≤ 3, each with a recommendation), review questions for the reviewers, acceptance criteria, build plan by day, rollback. Write the spec file named above and `claude/packets/MA-OCT-005.SPEC_Report.md` (spec SHA-256, line count). Reply **"MA-OCT-005.SPEC reported"**.
