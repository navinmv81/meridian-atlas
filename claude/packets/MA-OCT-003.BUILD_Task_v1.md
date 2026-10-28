# MA-OCT-003.BUILD — Task v1 (immutable): 003 local build (Wed 21 – Fri 23), remote steps from Sat 24

**ISSUED BY:** Main Lane, Wed 21 Oct · **EXECUTED BY:** LANE-8-ENG, Engineering Lead (idle until 008 fixes after 24 Oct) · **REVIEWED BY:** Architect + Data-Identity Lead · **APPROVED BY:** Founder (rev 1 approved 17 Oct)

Governing: `claude/MA-OCT-003_Spec.md` rev 1 (`7b8bba9f3adb582c495c3899717a98dee61d8c0f285919b221240ca1483480c2`) — build plan §16, ACs §17, migrations §10, Appendix A read pack; R1C-ARC G-1 (Sat 24 only after the 011 window closes) and its doc notes.

1. **Preflight:** hashes; no locks; HEAD; read the spec in full. Note that `App/Ops/src/ops-api.js` and `meridian-ops` are also touched by 002 A6 (LANE-1-ENG, Sat 24) — coordinate by files, do not edit A6 files.
2. **Read pack (Appendix A R1–R5):** EXPLAIN first, ≤ 5k reads total, read-only. Stop if a plan differs.
3. **Build locally** everything §16 lists for Mon 19 – Fri 23: migrations as files (not applied), Worker routes and sweep changes in code, the service-token allowlist, seeds as files, tests. Dry-run M1/M2 and the seeds against a local copy of the legacy rows.
4. **Tests:** full suite passing, 0 skipped; record counts.
5. **Sat 24 run sheet:** the exact ordered remote steps for Sat 24 (A6 handshake, deploys, Access Block, migration, M1/M2), with each step's reads/writes, rollback, and the Founder actions (Access app, `/exceptions` block, token after its check).

**Not allowed before Sat 24 (N-3, ML-1017-3):** any deploy, migration, Access change, D1 write or `OPS_INGEST_KEYS` change. No git writes (ML-1012-2: list files for the Main Lane's commit list). Never print secrets.

**Budget:** D1 reads ≤ 5k (read pack); 0 writes.

Write `claude/packets/MA-OCT-003.BUILD_Report.md` (one section per day). Reply **"MA-OCT-003.BUILD day <date> reported"**. Stop point: end of each day; final stop Fri 23 with the Sat 24 run sheet.
