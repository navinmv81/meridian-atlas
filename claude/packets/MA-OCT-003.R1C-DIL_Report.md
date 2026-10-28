# MA-OCT-003.R1C-DIL — Report (LANE-11, Data-Identity Lead): delta check of the 003 and 004 specs, rev 1

**Control:** `claude/packets/MA-OCT-003.R1C-DIL_Control_v1.md` `c7327e14c3d680701cdfac719a496648b9bc09c7cd4ce59745f5634708f64722`. It matches the STATUS_BOARD row. **Task v1** `923bd537832eaf42dcc8672e04e8fea11342d5067e7c4070f47cda71974930cc` matches.
**Date:** Sat 17 Oct 2026. **Git:** HEAD `0dd7ef0`. No `.git/*.lock` and nothing staged, before and after. **Doc-only:** 0 D1, no deploys, no git writes, no GLEIF calls.
**Independence:** this lane did not author 003 or 004 (LANE-3 did). It authored the REVDIL items being checked, and the 011 spec / 013 brief, which are cited only as sources.
**011 A-pilot:** not affected.

## Inputs (hash-checked)

| File | SHA-256 | Match |
|---|---|---|
| `claude/MA-OCT-003_Spec.md` rev 1 | `7b8bba9f…80c2` (937 lines) | ✓ Task |
| `claude/MA-OCT-004_Spec.md` rev 1 | `570de1a5…5379` (1,511 lines) | ✓ Task |
| `claude/MA-OCT-003_Spec_rev0.md` | `8fb129ac…ed91` | ✓ |
| `claude/MA-OCT-004_Spec_rev0.md` | `c3d0cd3e…0889` | ✓ |
| `claude/packets/MA-OCT-003.R1_Report.md` | **absent** (Mac link dropped; Decisions Log 17 Oct) | Used instead: 003 Appendix D and 004 Appendix C change tables, per the Task |
| `claude/October_Decisions_Log.md` | `f4b3d42a…fa2` | Read: Founder answers 17 Oct, ML-1017-3, DIL14 (PepsiCo Singapore) |
| Cross-checks | 006 Evidence `0d1bbf9b…db1bc` (§14.5, §15.3); 015c migration; REVDIL report `37aaa057…f217` | read only |

## Overall verdicts

| Spec | Items | Verdict |
|---|---|---|
| **MA-OCT-003 rev 1** | 003-1 to 003-8: **8 / 8 MET** | **PASS** |
| **MA-OCT-004 rev 1** | 004-1 to 004-9: **9 / 9 MET** | **PASS WITH NOTES** (N-1 to N-4 below; none blocks approval) |

---

## MA-OCT-003 rev 1

| Item | Required | Where in rev 1 | Result |
|---|---|---|---|
| **003-1** | E2 `job_id` = `cf.meridian-entities-enrich.phase23`; resetting the 11 Jun row is a Data-Identity Lead packet | §9.3 E2 row (cites `entities-enrich.js:167`, Phase 2 in the ≥ :50 invocation and the boost path; "003 never resets it"); AC-10; App. D row 9 | **MET** |
| **003-2** | M2 E3 wording: ≤ 3,676 of 26,083; ≥ ≈ 22.4k remain; owner = enrich fix packet (H1) | §9.3 E3 row; §10.4 M2 summary text | **MET** |
| **003-3** | Seed E4 for `cf.meridian-entities-delta` now | §9.3 E4 row; §10.4 `EXC-M-000002` (sev3, own dedupe key and `created` event); AC-10: automatic E4 is suppressed while the seed is open | **MET** |
| **003-4** | 011 runner: count raced rows as progress, or exclude it from E1 | §9.3: `manual.gleif-reconcile-011` excluded from `GLEIF_JOBS` (E1 and E4). `job_failed`, `job_lost` and `local_auth_failure` still apply. AC-10 fixture: a raced resume raises no E1. | **MET** (the exclusion option; it also covers REVARC N3-1) |
| **003-5** | The three `do_not_merge` pairs are protected; the November drop waits for merge writers to read them from Ops | §10.6: table of `DQ-M-000001` 931/1216 `54930067J0ZNOEBRW338`, `DQ-M-000002` 2589/25577 `259400LGXW3K0GDAG361`, `DQ-M-000003` 2014/25655 `213800M4NRGFJCI34834`. No 003/004 path changes their `disposition`. The drop needs (1) every merge writer, 013 first, to read them from Ops; (2) an export; (3) a dump compare. Founder Q2 answer recorded with this condition. | **MET** (all three pairs and LEIs match 015b) |
| **003-6** | Calendar per ML-1017-1/3; "17–23 Oct" used consistently | §16 calendar rule: Mon 19 – Fri 23 local only; no 003 or A6 remote step before Sat 24 08:05 UTC, **including the Access Block** (ML-1017-3 overrides REVDIL's "Thu 22 may stay", which is correct); `d1-today` / `run-event` named; nothing remote on Sun 25. No "17–24" left in the spec. | **MET** |
| **003-7** | AC-12 / V3 exact counts | §10.3 step 5 and AC-12: 9 tickets (7 resolved, 2 open); events `created` 9, `decision_recorded` 7, `migrated` 9; `object_key` set {931, 2589, 2014, 3, 143, 49, 194, 204921, 28219} | **MET** |
| **003-8** | AC-10 additions | AC-10: E2 `job_id` phase23; no E1 for the 011 runner; M2 seeds `EXC-M-000001` and `EXC-M-000002`; no second delta case | **MET** |

**Data-identity check of the rest of the 003 delta:** no new Entities write. M1 still only reads `entity_exceptions`. The retirement moved to Mon 26, the re-dump compare moved with it, and both are after the 011 window. The dump now goes to `~/MeridianAtlas-work/ma-oct-003/` (outside the repo, mode 600), which is fine for identity-bearing rows. Nothing found.

---

## MA-OCT-004 rev 1

| Item | Required | Where in rev 1 | Result |
|---|---|---|---|
| **004-1** | Named minimum set in M4 / AC-13 with LEIs; Pfizer NL a co-registrant with no parent link | §10.4 and `m4-minimum.json` (App. D):<br>- Welltower Inc `0000766704` / `254900F33BIAR82QTA19` (`create_entity`, sev4, "never link to 2289");<br>- GM Financial `0000804269` / `5493008B6JBRUJ90QL97` (members 3324, 30187, 103981, `merge_then_assign_lei`; a 013 input);<br>- Pfizer NL `0002058265` / `254900YI79T8NMNA4349` (member 106006, `co_registrant_of = 'Pfizer Inc'`);<br>- **PepsiCo Singapore Financing I** `0002007029` (members 3367, 31416; `current_wrong_link_entity` 1457; never linked to the guarantor).<br>AC-13: the named 4; no subsidiary-to-parent or guarantor link. | **MET.** DIL14's correction (candidate entities exist for GM Financial and Pfizer NL) is adopted, and that is right: REVDIL's "no entity" was based on 008's BUILD report only. |
| **004-2** | `wrong_identifier` type; 2289 `cik` seed, fixed before 008's 2289 link | §7.2 vocabulary (default owner Data-Identity Lead); seed `wrong_identifier:entity:2289:cik`, `cik` 0000766704 → 0001917598; AC-17; §19 H-3 sequencing | **MET** |
| **004-3** | KI 22.43 aggregate, 0 members, `fix_ref` MA-OCT-011, recurrence to the enrich fix packet | `ki:22.43` `no_link_marker`, `fix_pending`, 0 members (657 > cap), `fix_ref` "MA-OCT-011 (bucket C)" via the `fix_scheduled` event; the list SHA is added by `comment` at H-1; AC-17 | **MET** |
| **004-4** | M5 011 hand-off aggregates | §10.5: 7 `gleif_handoff` tickets, 0 members, anchors `ma-oct-011:<item>`, evidence = LANE-11's list SHAs. Counts match 011 rev 1.10 §11: 215; 6 LEIs / 3 edges; the E-1 exclusion (99231 → `549300CZ8QS1GE53O776`); 31 / 62; 9 government; 6,269 report-only (1,342 + 1,739 + 852 + 2,336, arithmetic checked); 128 no-reason. Runs only when H-1 delivers. | **MET** |
| **004-5** | OTP Bank seed | `entity_merge:2019:467290`, `fix_pending`, members `entity:2019` and `entity:467290` (`merge_013`), `fix_ref` MA-OCT-013; evidence 011 FRI + RELARC N-3; AC-17 | **MET** |
| **004-6** | No silent `reopen` of `do_not_merge` | §7.1: `reopen` refused with 409 `protected_decision` on `disposition = 'do_not_merge'` unless `founder_supersession {reference, decided_at}` is present (it goes into the event payload); §7.5; AC-18 cases 3 and 4 | **MET** |
| **004-7** | KI 22.9 delete key carries `source` | Members `entity_relationships:<p>-><c>:legal_parent:gleif:<created_at>`. `object_ref` holds all five identity fields plus the D4 rowid (265–268). The later delete must match all five. B4 re-reads by PK before M3, and a mismatch becomes a `comment` with no delete. Rev 1 goes further than asked: `source` alone cannot separate a legacy edge from an 011 `gleif` edge, so `created_at` is added. **The `created_at` values match 015c and Evidence §14.5 exactly** (19:51:32, 00:00:55, 20:00:59, 02:00:56). | **MET** (see N-2) |
| **004-8** | The 24 members come from Evidence §15.3; 6/5/13; `null_and_offline_match`; 931 cites `DQ-M-000001` | **Machine-checked here** against Evidence §15.3 (`0d1bbf9b…db1bc`, 25 table rows): all **24 ids present, no extras**; OPAP 2014 absent. For every member the **name, `current_lei` and action** match §15.3, where the action is `replace_lei_t1` if T1, `null_and_offline_match` if "none in GC", else `review`. For the 6 T1 rows, `correct_lei` = §15.3's T1 LEI. Totals: **6 / 5 / 13**. Member 931 `see_also` = "DQ-M-000001 (do_not_merge 931/1216)". The action is renamed in §7.3. | **MET** |
| **004-9** | Resolve authority | §7.5:<br>- `fixed` needs a `fix_scheduled` event (Worker, 409 `fix_not_scheduled`);<br>- resolve, dismiss and member `fixed` only by the Data-Identity Lead or the Founder (procedural; `actor_role` recorded);<br>- service tokens never resolve, dismiss or reopen (allowlist, 403 before D1);<br>- `do_not_merge` reopen guarded.<br>The Entities-data type list includes `missing_entity`, `gleif_handoff` and the 007 types. AC-18 and AC-18c. | **MET** |

### Notes (non-blocking; for LANE-3 at the next edit, or the build)

- **N-1:** §6's "Systems used by 004" list for `source_record` keys still names only `known-issue`, `entity_isin_map`, `entity_relationships` and `sec_cik`. Rev 1 also uses **`gleif:<LEI>`** (the Welltower Inc member) and **`ma-oct-011:<item>`** (the M5 anchors). Both pass the regex, so this is documentation only. Add them to the list.
- **N-2:** `source = 'gleif'` on the 4 legacy KI 22.9 edges is asserted in Appendix D, but Evidence §14.5 does not show the `source` column. B4 is the right control: if it differs, the member gets a comment and the delete does not touch the row, so this fails safe. The Data-Identity Lead's delete packet must then take the identity from B4's output, not from Appendix D.
- **N-3:** PepsiCo Singapore Financing I has **no known LEI**, but its members use `merge_then_assign_lei`. The assign step depends on a GLEIF lookup in the fix packet. If no LEI is found, the member is resolved as a merge only, with the LEI left NULL, never guessed.
- **N-4 (hand-off to this lane, H-2):** rev 1 adds two more **013 inputs**: GM Financial 3324 / 30187 / 103981 and PepsiCo Singapore 3367 / 31416. They join the OTP pair 2019 / 467290 and the three protected `do_not_merge` pairs. The 013 brief update needs its own packet (not allowed here), and should carry all of them.

### Data-identity check of the rest of the 004 delta

- **Entities writes:** none. B1, B2 and B4 are PK or index reads on Tue 27, after the window.
- **013 merges:** §7.6 (keys never rewritten; resolved on read through `entity_merge_redirect`, tolerant of a missing table) protects identity history.
- **Seed template:** the `NOT EXISTS` guard on `(object_domain, object_key)` with an open status cannot block another seed, because every M3/M4 anchor is distinct.
- **Calendar:** local from Mon 26, remote only after 003 is live, so nothing remote falls in the 011 window.

## Outputs

`claude/packets/MA-OCT-003.R1C-DIL_Report.md` only. No other file was written. No git writes. 0 D1.
