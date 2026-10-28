# MA-OCT-011.APILOT — Task v1 (immutable): A-pilot adjudication (E-4), Wed 21 Oct

**ISSUED BY:** Main Lane, Tue 20 Oct · **EXECUTED BY:** LANE-11, Data-Identity Lead · **SPOT-CHECK:** Operations Lead (via RECOND day section)

**Start only after** `claude/packets/MA-OCT-011.RUN_Report.md` has a Wed 21 section showing A-001 applied and the runner holding for adjudication.

Inputs: the RUN report Wed 21 section; A-001's checkpoint and pre-image in `~/MeridianAtlas-work/gleif-011/` (read grant; never open the key file); the 011 spec rev 1.10 §3.1 E-4, RA-12/RA-14/RA-15; `gleif_006.db` / the 28 Sep Golden Copy for evidence. Read-only; up to 50 GLEIF API lookups allowed; 0 D1 writes; no git writes. You authored the spec, not the runner or this batch.

1. Draw a seeded random sample of **≥ 50 rows** from A-001 (record the seed).
2. For each: confirm the written LEI belongs to that entity (legal name, country, and where useful the parent) against GLEIF; record match / mismatch with evidence.
3. **Result:** 50/50 → write `holds/a-pilot-adjudication.json` with `{"batch":"A-001","sample":N,"matches":N,"result":"PASS","seed":...}` so A-002 may run. **Any mismatch → E-4:** write `holds/e4-trigger.json` instead, and state it; the runner then stops A, restores A-001, and drops E-A and ECA (RA-12, RA-15).

Writes allowed: `claude/packets/MA-OCT-011.APILOT_Report.md` and the one holds file named above. Reply **"MA-OCT-011.APILOT reported — PASS"** or **"— E-4"**.
