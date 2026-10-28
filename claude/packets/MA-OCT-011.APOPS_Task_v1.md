# MA-OCT-011.APOPS — Task v1 (immutable): Ops spot-check of the A-pilot adjudication and the A release file

**ISSUED BY:** Main Lane, Wed 21 Oct · **EXECUTED BY:** LANE-1-OPS, Operations Lead

**Start only after** `claude/packets/MA-OCT-011.APILOT_Report.md` reports N/N and `~/MeridianAtlas-work/gleif-011/adjudication/A-001_dil.json` exists. If an E-4 trigger exists instead: stop and report.

1. Check `A-001_dil.json` against the adjudicated sheet (SHA-256, counts, seed) and that `correct == adjudicated ≥ 50`.
2. **Spot-check ≥ 10 rows** of the 50 yourself (name and country against GLEIF or the Golden Copy; ≤ 10 lookups). Record each.
3. If all agree, write the runner's release file `~/MeridianAtlas-work/gleif-011/adjudication/A-001-release.json` = `{"batch":"A-001","adjudicated":<N>,"correct":<N>,"data_identity_lead":"Data-Identity Lead (LANE-11)","ops_spot_check":true,"ops_rows_checked":<k>,"dil_file_sha256":"<sha>"}` (new file, mode 600). This is the file LANE-11-ENG passes to `--a-adjudication`.
4. If any spot-check row disagrees: do not write the release; report it (the Data-Identity Lead re-adjudicates).

Writes allowed: the release file and `claude/packets/MA-OCT-011.APOPS_Report.md`. 0 D1; no git writes; never open key files. Reply **"MA-OCT-011.APOPS reported — released"** or **"— not released"**.
