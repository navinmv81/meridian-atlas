# MA-OCT-003.REVARC — Task v1 (immutable): Architect review of the 003 and 004 specs (rev 0)

**ISSUED BY:** Main Lane, Sat 17 Oct · **EXECUTED BY:** REVIEW-A, Architect · **APPROVED BY:** Founder

Inputs: `claude/MA-OCT-003_Spec.md` rev 0 (`8fb129ac00909aecbbd4065f05895ba88808614352f46eb8499679fd74a0ed91`), `claude/MA-OCT-004_Spec.md` rev 0 (`c3d0cd3e1ddfc02a5eeb48101eabe5f2aebbfd93dbc47df96ace15c5b51c0889`), `claude/packets/MA-OCT-003.SPEC_Report.md`, `claude/packets/MA-OCT-003_ReadPack_Results.md`, `claude/MA-OCT-002_Spec.md` rev 1.3, the October Decisions Log. Doc-only: 0 D1, no deploys, no git writes. You did not author these specs.

Review both specs as Architect (and ETF PL where ETF tables are touched):
1. **Boundaries and ownership:** every table and Worker read or written; domain of each new table (ETF vs Entities vs Ops) stated; no cross-domain writes; ETF tables read-only.
2. **Three-point check:** index audit for every new query (no scans on large tables), single-execution reads < 50k, read/write budget per invocation and per day; cron slots (5/5 used) and any new cron needs a CR.
3. **Dependencies and sequencing:** 002 A6 (`meridian-control` split) and the **N-3 freeze 17–23 Oct** (no `meridian-ops`, Entities Worker or `OPS_INGEST_KEYS` change) — say what can be built and tested locally from Mon 19 and what must wait for deploy from Sat 24; 008 ticket hook; 011/013 hand-offs; `entity_exceptions` migration path.
4. **Security:** retirement of `ADMIN_EXCEPTIONS_SECRET` (003 AC-15, now at `~/.meridian-secrets/admin-exceptions.env`), Access service token, no secrets in front end or logs.
5. **Founder questions** (003 §19 Q1–Q3, 004 §19 Q1–Q3): give a recommended answer and one-line reason for each.

Verdict per spec: PASS / PASS WITH NOTES / FAIL, numbered required changes. Write `claude/packets/MA-OCT-003.REVARC_Report.md`. Reply **"MA-OCT-003.REVARC reported"**.
