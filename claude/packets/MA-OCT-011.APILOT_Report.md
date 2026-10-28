# MA-OCT-011.APILOT — Report (LANE-11, Data-Identity Lead): A-001 50-row adjudication

**Result: E-4.** 48 of 50 correct. **2 incorrect: entities 2303 and 2488.** `holds/e4-trigger.json` is written.

**Control v2:** `claude/packets/MA-OCT-011.APILOT_Control_v2.md` `530e945f4a563cd3628d74ca451fe2e228da63f35340da1047c6203a1ba44a47`. It matches the STATUS_BOARD row. **Task v2** `2b0b7256ffa52de4af695013e3c8c351277b592f275f2aa90fffcf9b38809abf` matches.
**Date:** Wed 21 Oct 2026, ≈ 18:00–18:30 UTC. **Git:** HEAD `c3c6e4a`. No `.git/*.lock`. No git writes. **0 D1** reads or writes. **0 GLEIF API calls:** `api.gleif.org` is refused by the egress proxy from both shells, so the 28 Sep Golden Copy was the only evidence (it is the primary evidence the Task names).
**Independence:** I authored the 011 spec, not this run or its matcher output. I adjudicated the rows against the source file directly. I did not take the runner's `gc_*` columns on trust.
**Access:** the Founder approved two folder grants this session: `~/MeridianAtlas-work/gleif-011` and `~/MeridianAtlas-work/gleif-006/gc` (read). There was no macOS prompt. The key file `ops-ingest.env` was **not opened**.

## Inputs

| File | SHA-256 |
|---|---|
| `adjudication/A-001_all_250.csv` | `c1f1cd20c250453afcc4becdfb98e6620dc32ae18707c4b5a0ba4e1acaec7afc` |
| `adjudication/A-001_sample50_seed-MA-OCT-011.APILOT-A-001.csv` (the lane's seeded sample; **seed `MA-OCT-011.APILOT-A-001`**; 50 rows, 50 distinct LEIs, all from A-001) | `cbaaddb35d2dd0a7ea9e44e834405a132325d0961ca6b0fa0f2fda1a2b522fb1` |
| `holds/a-pilot.json` (batch A-001, 13:07:52Z) | read |
| GC `20260928-1600-gleif-goldencopy-lei2-golden-copy.csv` (in `lei2.csv.zip`), plus `rr.csv.zip` and `repex.csv.zip` | streamed read-only |
| Replica `replica/replica-fresh-2026-10-16.db` (read-only open) | used for the D1 context of 2303 and 2488 |
| `claude/packets/MA-OCT-011.RUN_Report.md` | cited by the Task as `1489d82f…fb12` |

## Method

1. I extracted the 50 written LEIs' **lei2 records** straight from the GC file (all 50 found). For each, the GC legal name, legal-address country, entity status and registration status **equal the runner's `gc_*` columns: 50 / 50**.
2. Per row, the identity test was: is the written LEI's legal entity **the same legal person** as the D1 row? I used:
   - the legal name, other names and previous legal names, and transliterated names;
   - the legal and HQ country, and the jurisdiction;
   - the entity category and legal form;
   - and, where in doubt, `rr` (parents/children) and `repex` (parent exceptions).
3. For the doubtful rows, I also searched the whole lei2 file for competing records (e.g. any "Tradeweb Markets …", "TaskUs …", "Hong Kong Dollar …" entities).

## Incorrect rows (E-4)

| entity_id | D1 row | Written LEI → GC record | Why it is the wrong identity |
|---|---|---|---|
| **2303** | Tradeweb Markets Inc (US, operating) | `5493000G5QHJUY9ZWQ91` → **TRADEWEB MARKETS LLC** (US-DE, legal form HZEH, ACTIVE/ISSUED) | The D1 row is the listed holding company (Inc.). The LEI belongs to its operating **LLC**, a different legal person. GC has **no** "Tradeweb Markets Inc." record. The LLC's direct-parent exception is `NO_LEI` (repex), which means its parent has no LEI. This is the subsidiary-LEI-on-parent shape of RC-12 / KI 22.44. |
| **2488** | HONG KONG DOLLAR (HK, operating) | `213800L2NP81ACBDZV94` → **HONG KONG DOLLAR**, category **FUND**: `IS_SUBFUND_OF` HSBC GLOBAL MONEY FUNDS (`2138003EIJ83VL13NZ87`), `IS_FUND-MANAGED_BY` HSBC Investment Funds (Hong Kong) Ltd (`213800R9W4BDUVGI6O12`) | The D1 row is a **currency pseudo-entity** from holdings. Its siblings in D1 are EURO 2373, JAPANESE YEN 2436, SWISS FRANC 2480, NEW ZEALAND DOLLAR 2369, AUSTRALIAN DOLLAR 2578, INDIAN RUPEE 17344, and others. The GC record is an HSBC money-market sub-fund that happens to be named "Hong Kong Dollar". The names match exactly, but the identities do not. (006 classified this row as T1 / high, row 3,912; a name-exact T1 cannot tell the difference.) |

## Correct rows (48), with the ones worth a note

- **Name variants only** (case, punctuation, legal-form abbreviation; same country and jurisdiction; ACTIVE/ISSUED): **30 rows**, e.g. Tiptree, Eicher Motors, Proofpoint, Marvell, Oklo, CoreWeave, Expedia, TMX, Toromont.
- **Local-script legal name, matched through the GC other or transliterated name:** **11 rows**: LG Electronics, Power Assets, Muyuan Foods, MonotaRO, Hyosung Heavy Industries, NAVER, Agricultural Bank of China, Hanwha Aerospace, Postal Savings Bank of China, CTBC and ZENSHO.
- **Same entity, renamed** (GC `PREVIOUS_LEGAL_NAME` matches D1):

  | entity_id | D1 name | GC legal name | Previous legal name |
  |---|---|---|---|
  | 966 | TaskUs | TASKUS HOLDINGS, INC. | "TASKUS, INC."; the only TaskUs LEI in GC apart from TaskUs India, its child |
  | 1309 | Osaic Holdings | Osaic Holdings, Inc. | Advisor Group Holdings |
  | 2625 | TMX Group | TMX Group Limited | Maple Group Acquisition Corp |
  | 1578 | Everest Group | Everest Group, Ltd. | Everest Re Group |
  | 2322 | UL Solutions | UL Solutions Inc. | UL Inc. |

- **836 State Street Institutional US Government Money Market Fund:** the identity is correct (the GC FUND record has the same name). D1 `type = 'operating'` is wrong, but 011 does not write `type`. This is a note only.
- **2413 CK Infrastructure:** legal address BM, HQ HK, consistent with D1.
- **Tally:** 30 + 11 + 5 + 836 + 2413 = 48.

The per-row Y/N and reasons are in the DIL CSV.

## Outputs written (the Task's files only)

| File | SHA-256 |
|---|---|
| `~/MeridianAtlas-work/gleif-011/adjudication/A-001_adjudication_DIL.csv` (the sample + `correct_identity (Y/N)` + one-line note) | `6aa1ea751dbe194699590485cc76e7524a7acb5f59d8d482fe369e245684f042` |
| `~/MeridianAtlas-work/gleif-011/adjudication/A-001_adjudication_DIL.json` (`adjudicated` 50, `correct` 48, `incorrect_rows` [2303, 2488], `result` **"E-4"**) | `e2ee84ede7d64cabd1d4cd31456ec94623d885545906970291fa04caccf96b5c` |
| `~/MeridianAtlas-work/gleif-011/holds/e4-trigger.json` (rows 2303 / `5493000G5QHJUY9ZWQ91` and 2488 / `213800L2NP81ACBDZV94`; RA-12/RA-15) | `7e3c91538951dd3c1083e2119e054e1eb1a0aeb29855c968561961ac31163094` |

- **The release file was not written** (Task item 4). With `e4-trigger.json` present, the runner refuses A, ECA, E-A and Q (`gleif-reconcile-011.mjs:320/331`).
- `holds/a-pilot.json` is untouched.

**Per RA-12 / RA-15:**
- A stops;
- A-001 is restored from its checkpoint / pre-images (LANE-11-ENG, under RUN Control v4 and C-1);
- E-A and ECA are dropped unless the Founder re-rules.

## Findings outside the sample (for the Main Lane; not adjudicated, not part of the E-4 count)

The two errors are **matcher classes**, not one-offs. A read-only scan of all **3,676 A statements** in the released plan (`plans/release-2026-10-16/plan.json`):

1. **Currency rows:** only **1** A row has a pure currency name (2488). The class is therefore limited in A. Bucket B and the 013 hand-off may hold others, and should be checked before any re-plan.
2. **Legal-form mismatch** (D1 says Inc / Corp / LP; the GC record is an LLC / LP / Ltd): **29 rows** across A, 6 of them in A-001 (483, 517, 1156, 1275, 1337, 2303).
   - Several look like the **Up-C pattern** (a listed Inc. over an operating LLC), which is the same error as Tradeweb: Vitesse Energy 483, FONAR 517, Dutch Bros 15538, Shift4 Payments 15589, Solo Brands 87094, Silvercrest 86996, Playstudios 87745 ("PLAYSTUDIOS US, LLC"), Walker & Dunlop 15441, V2X 3262, Allegro MicroSystems 14771, Terreno Realty 14864, J.M. Smucker 99017, BroadStreet 1337, Citadel Securities 1275.
   - Others are probably fine: truncated bond-issuer names such as ROBERT BOSCH FINANCE, GABX LEASING, CABLEVISION LIGHTPATH; or CLO LLC/Ltd naming.
3. **Implication:**
   - T1 precision for A is below the 50/50 that RA-14 needs. Two in 50 is 4% in the sample, and the out-of-sample suspects point the same way.
   - **I recommend not re-sampling A as it stands.** Exclude the legal-form-mismatch and currency rows (or move them to the review list) in a re-plan, then pilot again.
   - This is a spec change to 011 §3.1 (the T1 rule must compare legal form, and must reject names that equal a currency name and point at FUND records). That is for the 011 spec owner under its own packet, and it needs a Founder decision, because GATE-1012 D1 ruled on Option 1 with E-A kept.
4. **KI 22.44 link:** 2303 is the same shape as the 18 "subsidiary LEI on the listed parent" rows. Here the wrong LEI was written by 011, not by the June `isin_direct` mapping. After the restore it disappears from live data.

## Stop

The report is written. No other file was changed. Next steps, per the Task, are for others:
- LANE-11-ENG restores A-001 under RA-12/RA-15;
- the Main Lane decides what happens to E-A and ECA, and whether to re-plan A;
- ASPOT / APOPS do not proceed to a release file.
