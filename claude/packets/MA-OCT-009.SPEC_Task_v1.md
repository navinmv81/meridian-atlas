# MA-OCT-009.SPEC — Task v1 (immutable): 009 Fixed Income API + 010 Fixed Income page — spec rev 0

**ISSUED BY:** Main Lane, Sun 25 Oct · **EXECUTED BY:** Engineering Lead (LANE-7) (spec author)

Write **`claude/MA-OCT-009_010_Spec.md`** (one spec covering both).

Inputs: `claude/meridian-october-revised-scope-v2.md` (`967bebd7c1762a0389d150d96a04ae08c4f0df0cdaf127328f0f4a88e1f33445`) §MA-OCT-009 and §MA-OCT-010; `claude/MA-OCT-008_Spec.md` rev 1.2 (`bcdad9a2d315371b9c60b11cbcf72dfca88c99dca22fbe4e5310e2fb5f815cd3`) — the bond tables `bond_issuance`, `bond_issuer_link` and their indexes; `claude/packets/MA-OCT-008.DIL14_Report.md` (AC12 FAIL: bond rows may not be served until the re-check passes — design 009 to refuse or flag until AC12 passes); `claude/MA-OCT-007_Spec.md` rev 1.4 (`4d4fffefab020d516a1804843d01142452306bd07e20275a0cd1bf79759b397c`) and the live `meridian-entities-api` routes R1–R4 (issuer pages, instrument card) — 010 should hang off 007's issuer layer rather than add a new top-level surface; `App/Corporate Atlas/src/entities-api.js`, `App/ma-entities.js` (read only).

Cover: 009 routes on the existing `meridian-entities-api` Worker (issuer → bonds, bond detail), paging, response shapes, caching, error states, the AC12 gate; 010 UI in `ma-entities.js` (a "Bonds" section on the issuer layer, maturity ladder / table), states and copy; reads per page; tests; deploy as one Worker deploy + front-end change.

Calendar (Founder, ML-1024-3): reviews Tue 27; build Wed 28 – Fri 30; last production deploy **Sat 31 Oct**; release sign-off Sun 1 Nov. Size the spec to fit that, and say what must be cut to fit if needed.

Global rules: vanilla ES6, no frameworks/bundlers; Workers Web-APIs only; one D1 `meridian-etf`; three-point check (index audit, single execution < 50k reads, per-invocation read/write budget) for every query; state the domain (ETF / Entities / Ops) of any new table; ETF tables read-only; no new cron unless a CR (5/5 slots used). Doc-only: 0 D1 writes; read-only EXPLAIN/point reads ≤ 2k total allowed only through a named Engineering lane later — not in this packet; no git writes.

End the spec with: open questions for the Founder (≤ 3, each with a recommendation), review questions for the reviewers, acceptance criteria, build plan by day, rollback. Write the spec file named above and `claude/packets/MA-OCT-009.SPEC_Report.md` (spec SHA-256, line count). Reply **"MA-OCT-009.SPEC reported"**.
