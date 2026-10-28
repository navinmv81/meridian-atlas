# MA-OCT-011.ASPOT — Task v1 (immutable): Operations Lead spot-check and A release file

**ISSUED BY:** Main Lane, Wed 21 Oct · **EXECUTED BY:** LANE-1-OPS, Operations Lead (spec §11 E-4: "Data-Identity Lead, Operations Lead spot-check")

**Start only after** `claude/packets/MA-OCT-011.APILOT_Report.md` reports PASS and `~/MeridianAtlas-work/gleif-011/adjudication/A-001_adjudication_DIL.json` exists. If it reports E-4: do nothing but confirm `holds/e4-trigger.json` exists, and stop.

1. Spot-check **≥ 10** of the Data-Identity Lead's 50 rows (your own random pick; record it) against GLEIF / the Golden Copy (≤ 10 GLEIF lookups) and against `A-001_all_250.csv`. Confirm the 50 are the lane's seeded sample.
2. If all agree, write the runner's release file **`~/MeridianAtlas-work/gleif-011/adjudication/A-001_release.json`** exactly:
   `{"batch":"A-001","adjudicated":50,"correct":50,"data_identity_lead":"Data-Identity Lead (LANE-11)","ops_spot_check":true,"spot_checked_rows":[…],"source":"claude/packets/MA-OCT-011.APILOT_Report.md","source_sha256":"…"}`
   (mode 600, created new, never overwriting). Record its SHA-256.
3. If any spot-check disagrees: write nothing to the release file; state the rows; the Main Lane decides (E-4 path).

Write `claude/packets/MA-OCT-011.ASPOT_Report.md`. Reply **"MA-OCT-011.ASPOT reported — released"** or **"— not released"**.
