# MA-OCT-011.APILOT — Task v2 (immutable; supersedes v1, never run: aligns the output with the runner's `--a-adjudication` gate)

**ISSUED BY:** Main Lane, Wed 21 Oct · **EXECUTED BY:** LANE-11, Data-Identity Lead

A-001 ran Wed 21 13:07Z: 250/250 applied, 0 mismatches; the runner is holding (`holds/a-pilot.json`). See `claude/packets/MA-OCT-011.RUN_Report.md` (`1489d82f0429dd8815f13e38ccbc4b54c93e53129617bd115784e819d74ffb12`) Wed 21 section. Material in `~/MeridianAtlas-work/gleif-011/adjudication/` (read grant; never open the key file): `A-001_all_250.csv` and the seeded `A-001_sample50_…csv` with a blank `correct_identity (Y/N)` column. You authored the spec, not this run.

1. Use the lane's seeded 50-row sample (record its file name and seed). For each row, decide **correct identity Y/N**: the written LEI belongs to that entity (GLEIF legal name, country; parent where useful). Up to 50 GLEIF API lookups allowed; the 28 Sep Golden Copy is the primary evidence.
2. Write `~/MeridianAtlas-work/gleif-011/adjudication/A-001_adjudication_DIL.csv` (the sample with your Y/N and a one-line reason each) and `~/MeridianAtlas-work/gleif-011/adjudication/A-001_adjudication_DIL.json`:
   `{"batch":"A-001","sample_file":"…","seed":…,"adjudicated":50,"correct":<n>,"incorrect_rows":[…],"data_identity_lead":"Data-Identity Lead (LANE-11)","result":"PASS"|"E-4"}`
3. **Any incorrect row = E-4:** set `"result":"E-4"` and also write `~/MeridianAtlas-work/gleif-011/holds/e4-trigger.json` naming the rows (RA-12/RA-15: A stops, A-001 restored, E-A and ECA dropped).
4. Do **not** write the runner's release file: the Operations Lead writes it after the spot-check (MA-OCT-011.ASPOT).

Write `claude/packets/MA-OCT-011.APILOT_Report.md`. Reply **"MA-OCT-011.APILOT reported — PASS"** or **"— E-4"**.
