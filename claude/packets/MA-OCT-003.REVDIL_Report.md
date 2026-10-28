# MA-OCT-003.REVDIL — Report (LANE-11, Data-Identity Lead): review of the 003 and 004 specs, rev 0

**Control:** `claude/packets/MA-OCT-003.REVDIL_Control_v1.md` `7049e9d7c8ffd0b0510d85df9d2e6239bd28941598f68e5528787ccb81957476`. It matches the STATUS_BOARD row. **Task v1** `617d477ff82628a221afa0a3d9c778e5a67a7b9b7e1ba8197b986544c2b14a0a` matches.
**Date:** Sat 17 Oct 2026. **Git:** HEAD `0dd7ef0`. No `.git/*.lock` and nothing staged, before and after. **Doc-only:** 0 D1 reads or writes, no deploys, no git writes, no GLEIF calls, no secrets opened.
**Independence:** this lane did not author 003 or 004 (author: LANE-3, Operations Lead). It did author 011 and the 013 brief. Where this review points at those documents, it raises hand-offs only and does not judge them.
**011 A-pilot (Wed 21):** not affected. This review asks nothing of LANE-11 before Sat 24, apart from item H-1.

## Inputs (hash-checked)

| File | SHA-256 | Match |
|---|---|---|
| `claude/MA-OCT-003_Spec.md` rev 0 | `8fb129ac…a0ed91` | ✓ Task |
| `claude/MA-OCT-004_Spec.md` rev 0 | `c3d0cd3e…c0889` | ✓ Task |
| `claude/packets/MA-OCT-003.SPEC_Report.md` | `064f73bf…837a` | read |
| `claude/packets/MA-OCT-003_ReadPack_Results.md` | `93a8d434…af99` | read (R1: N = 9; R2: 0; R3: 1 stuck row from 11 Jun) |
| `claude/MA-OCT-002_Spec.md` rev 1.3 | `9ec6773a…3893` | ✓ (the same hash as 003 App. C) |
| `claude/October_Decisions_Log.md` | `865f4a83…27aa` | read, up to ML-1017-1 |
| Cross-checks: 006 Spec `1dab3539…7b273` (§8.3, §8.4, §9.2); 006 Evidence `0d1bbf9b…db1bc` (§15.3); 011 Spec rev 1.10 `63280691…aaa`; 013 brief `a79bb98b…13de`; 008 BUILD report; 011 FRI / RELARC reports; 015b/015c migrations; `entities-enrich.js`; `gleif-reconcile-011.mjs` | — | read only |

## Verdicts

| Spec | Verdict |
|---|---|
| **MA-OCT-003 rev 0** | **PASS WITH NOTES.** Required changes 003-1 to 003-8 go into rev 1 before the build. |
| **MA-OCT-004 rev 0** | **PASS WITH NOTES.** Required changes 004-1 to 004-9 go into rev 1 before the build. The design holds, but several of the known items the Task lists are not yet on record. |

The domain boundary in both specs is correct, and no data-identity rule is weakened by the design itself:
- all writes go to Ops tables;
- Entities tables are read only (`entity_exceptions` and `entity_enrichment_queue` in 003; `entity_isin_map` and `entity_master` in 004 B1/B2);
- every fix to Entities data is left to Data-Identity Lead packets dated ≥ 24 Oct.

The required changes are about **coverage**, **two GLEIF-code definitions**, **protecting `do_not_merge` decisions**, and the **calendar under ML-1017-1**.

---

## 1. Exception and ticket model (Task item 1)

### 1.1 GLEIF codes E1–E6 against 006 §8.3

| Code | 006 §8.3 | 003 §9.3 | Finding |
|---|---|---|---|
| E1 no-progress | ≥ 2 consecutive `success` runs with progress 0 while backlog > 0; High | Last 2 end events `success`/`partial`, `items_attempted > 0`, `items_progressed = 0`; sev2 | **RQ-7: accept**, because attempted > 0 implies backlog > 0. **But see 003-4:** the 011 runner reports `progressed = tally.applied` (`gleif-reconcile-011.mjs:475`). A resumed batch whose rows are already applied or raced reports `attempted > 0`, `progressed = 0`, which is correct behaviour. Two such batches would raise a false sev2. |
| E2 stuck in-progress | any row `in_progress` > 24 h; Medium | Daily, ≤ 50 reads, sev3 | **Rule accepted (RQ-4: accept the read). The `job_id` is wrong (003-1).** `in_progress` is written only by **Phase 2** (`entities-enrich.js:167`, ISIN search). Phase 2 runs in the mins ≥ 50 invocation (`:527`) and in the boost path (`:577`), not in Phase 1. The owner is **`cf.meridian-entities-enrich.phase23`**, not `…phase1`. The case will fire on the first daily check, because of the 11 Jun row (R3). That is correct. **Resetting that row is an Entities write**, so it goes to a Data-Identity Lead packet ≥ Sat 24, and 003 should not suggest otherwise. |
| E3 orphaned backlog | `lookup_method` with no consumer (H1); High | Not automated; seeded once by M2; sev2 | **Accepted** (point 1 of the three-point check fails: about 66k reads). **M2's wording overstates 011 (003-2).** 011 bucket A + Q close at most **3,676** queue rows (3,677 less OTP Bank 2019, withheld). 011 Spec §2 records **26,083** `name_search` rows. At least ≈ 22.4k therefore stay orphaned after 011. The remediation owner is the enrich fix packet (H1), with 011 as partial relief only. |
| E4 frozen source | held GLEIF job whose data is > 35 days stale; **"delta: never run"** | No `success` in `ops_job_run` for > 35 days, or none ever with a registry row > 35 days old. "Cannot fire before ≈ 5 Nov, by design" | **Weakens 006 (003-3).** 006 says the condition is **true today** for `cf.meridian-entities-delta` (never run). Using the ledger as a proxy delays it by about 3 weeks, only because the ledger is new. Fix: seed one E4 case for `cf.meridian-entities-delta` in M2 (as E3 is), and keep the automatic rule for the future. |
| E5 local auth failure | `wrangler_auth_10000` on ≥ 2 consecutive fires; Medium | The last 2 end events have `error_class` ∈ {`wrangler_auth_10000`, `CF_API_10000`}; sev3 | Accepted (it is a superset). |
| E6 blind guard | guard ran with no `writes_today_<date>` key; Low | Dormant, keyed on `guard_blind = 1` | Accepted. It matches 002 F7 (A4 removed the boost's blind guard), so it is dormant by design. |

### 1.2 `entity_exceptions`: keep until drop

- The migration design is sound. Values are copied inside D1; V2 is a byte check; the guard fails closed on any unknown type; R1/R2 confirm N = 9 and 0 malformed rows. The legacy `disposition` values are read-only (004 §7.2).
- **DV-3: accept.** `child_entity_id` is the right `object_key` for `bad_relationship_edge`; the full edge stays in `object_ref` and `source_record_ref`.
- **DV-4: accept.**
- **`object_key` precedence: accept.** The author's dry-run values match 015b/015c: 931, 2589, 2014; 3, 143, 49, 194; 204921, 28219.
- **Q2 (keep until November): accept, with a condition (003-5).**

**The `do_not_merge` pairs must stay protected after the move (003-5, 004-6, H-2).** The 3 legacy `entity_merge` rows are Founder **`do_not_merge`** decisions on pairs that **share one LEI**:

| Pair | Shared LEI | Note |
|---|---|---|
| 931 / 1216 | `54930067J0ZNOEBRW338` | SLM / Navient, 2014 spin-off |
| 2589 / 25577 | `259400LGXW3K0GDAG361` | 006 classification row 103540 cites "LEI on D2 row 2589, 25577", RC-10, KI 22.41 |
| 2014 / 25655 | `213800M4NRGFJCI34834` | OPAP; D6-4 rename |

These are exactly the shape 013 merges. Today the 013 brief does not read them, and that gap is this lane's (H-2). Once M1 runs, the authoritative copy is `DQ-M-000001…3` in Ops. Two consequences:
- **Q2's November drop** must wait until 013 (or any merge writer) reads `do_not_merge` from Ops.
- **`reopen` on a `do_not_merge` ticket** must not quietly erase the decision. `reopen` clears `disposition` on the row (003 §7.1 and 004 §7.1). 004 must refuse `reopen` on legacy `do_not_merge` tickets unless the note records a Founder supersession.

### 1.3 How 011 and 013 appear

- **011 runner:** 003 names it only as a future `GLEIF_JOBS` member (D-5). Gate refusals stay in `gate.jsonl` (OQ-8), and `held` maps to a heartbeat `skipped`/`hold` (OQ-7), so the sweep sees heartbeats only. That is fine, apart from E1 (003-4).
- **011 exception reasons:** C-reasons (`reasons_all`, pipe-joined; 011 §3.5 OQ-3) are **entity fields, not exceptions**. They correctly do not appear in 003.
- **011's report-only and deferred lists (011 §11):** these have **no home in 004** (004-4).
- **013 hand-off:** neither spec carries the 013 inputs. 004 links 013 only in the KI 22.17 re-check. See 004-4, 004-5 and 004-6.

---

## 2. DQ tickets (Task item 2, 004)

| Known item | In 004 rev 0? | Owner | Required |
|---|---|---|---|
| **KI 22.9** (4 bad edges) | M3c, only if Q1 = yes | Data-Identity Lead | **004-7:** the member key `entity_relationships:<p>-><c>:legal_parent` leaves out `source`. 011 writes `legal_parent` edges with `source = 'gleif'`, so the delete key must carry the full identity `(parent, child, 'legal_parent', <source of the legacy edge>)`. The later delete must then never touch an 011 edge. |
| **KI 22.44** (24 wrong LEIs) | M3b; members from a Data-Identity Lead export of `WORK/day6/wrong_lei_detail.csv` | Data-Identity Lead | **004-8 (source):** `WORK/` is not reachable from this lane. **006 Evidence §15.3** (in the repo, `0d1bbf9b…db1bc`) holds all 25 rows. Less OPAP 2014, cleared by D6-4, that is **24**, and the T1 column gives **6 / 5 / 13** (checked here). M3b should take its members from §15.3 at that hash; the Task's own check (24 rows, 6/5/13, names = §15.3) then holds by construction. **004-8 (action):** `null_and_requeue` sends 13 entities into the queue that has no `name_search` consumer (H1 / E3), so they would be orphaned. Rename it **`null_and_offline_match`** (the next offline GLEIF pass). **Link:** entity 931 (SLM Corp) is both a 22.44 member and legacy `DQ-M-000001` (`do_not_merge` with 1216). The 22.44 ticket should cite `DQ-M-000001` in its evidence. |
| **KI 22.43** (657 wrong `NO_LINK_DECLARED` markers, after D7-2) | **Missing** | Data-Identity Lead | **004-3:** seed an aggregate ticket (anchor `known-issue:22.43`, `fix_ref` MA-OCT-011). **No members:** 657 > the 500-per-ticket cap; the evidence cites 011's close-out list by SHA. Resolve after 011 §9 verification. The **recurrence** (live Phase 3 keeps writing the generic marker, H6) stays open under the enrich fix packet. |
| **008:** Welltower Inc CIK `0000766704` stored on entity 2289 (which holds Welltower OP LLC's name and LEI `T6IZ0MBEG5ACZDTR7D06`) | **Missing.** It is not a `missing_entity`, and `data_error` defaults to the Operations Lead | Data-Identity Lead | **004-2:** add `ticket_type` **`wrong_identifier`** (default owner Data-Identity Lead). Seed one ticket: `object_domain='entity'`, `object_key='2289'`, `field_name='cik'`, `observed_value='0000766704'`, `expected_value='0001917598'`. Fixed by an Entities packet ≥ Sat 24, sequenced **before** 008 applies its signed Welltower OP LLC → 2289 link (008.DIL14 item 2). |
| **008:** no entity for GM Financial (LEI `5493008B6JBRUJ90QL97`), Welltower Inc (`254900F33BIAR82QTA19`), Pfizer Netherlands International Finance B.V. (`254900YI79T8NMNA4349`, CIK 0002058265) | Generic, via M4 from `unmatched-issuers.json` | Data-Identity Lead | **004-1:** name these 3 in AC-13 as the **minimum expected set** (each with its LEI in `object_ref`), whatever the file holds. If M4 is late, seed them by hand. Pfizer NL is a co-registrant (L8-12): `co_registrant_of` = Pfizer, **never linked to the parent**. |
| **011: OTP Bank pair** (entity 2019 "OTP Bank Nyrt", operating, no LEI / 467290, holding, LEI `529900W3MOO00A18X956`, created by live Phase 3 on 6 Oct; 011 withheld 2019) | **Missing** | Data-Identity Lead | **004-5:** seed one `entity_merge` ticket with members `entity:2019` and `entity:467290`, `fix_ref` MA-OCT-013, evidence `MA-OCT-011.FRI_Report` and RELARC N-3. It is also an **input for 013** (H-2). |

### Who may raise and who may resolve (004-9)

- **Raise:** 004 §8.3's caller classes are right. A person via `nav-007` may raise only the 4 007 types; a service token only `missing_entity`; the console any type.
- **Resolve:** rev 0 lets **any** Access identity resolve or dismiss any ticket. For tickets on Entities data (`wrong_lei`, `wrong_identifier`, `bad_relationship_edge`, `entity_merge`, `isin_duplicate`, `missing_entity`, and the 007 mapping types), state the following:
  - `resolve` with `fixed` needs an earlier `fix_scheduled` event with a `fix_ref` naming an **applied** Data-Identity Lead packet (enforced by the Worker);
  - resolve and dismiss are done by the **Data-Identity Lead or the Founder** (`actor_role` recorded; procedural, because Access identifies only the person);
  - a **service token may never resolve or dismiss**;
  - `reopen` on a legacy `do_not_merge` ticket is refused (409) unless the note names a Founder supersession (§1.2).
- **Members:** `member_update` → `fixed` follows the same rule (a `fix_ref` in the note).

### Other 004 notes (accepted, no change)

- **RQ-4:** accept the `domain=entities` → `instrument`/`entity` mapping and the `ref` whitelist (keys only, no names, ≤ 10 candidate ids).
- **RQ-5:** accept the vocabularies, plus `wrong_identifier` (004-2); the `source_record` key formats, with 004-7's edge key; and the 22.17 consolidation of `DQ-M-000008/9` (their 3 ISINs are among the 37: AU000000CMW8, US49446R1095 and the third in 015c).
- **RQ-6:** the M4 input `[{cik, sec_name, lei|null, co_registrant_of|null}]` is sufficient. LANE-8-ENG confirms the path.
- **006 §8.4 aggregate rule:** correctly applied. There is no per-entity ticket for the ~27k gaps.

---

## 3. Interaction with the 011 run, 17–23 Oct (Task item 3)

- **Entities writes:** **no build step in 003 or 004 writes an Entities table in the window**, or at any time:
  - 003: M1 only *reads* `entity_exceptions`; E2 only reads the queue. The Access Block is a dashboard step, not a D1 write. Retirement and the R-7 file deletes are ≥ Sat 24.
  - 004: its remote steps are Mon 26 – Wed 28; B1/B2 are reads only.
  - The fixes 004 tracks are all ≥ Sat 24, in Data-Identity Lead packets.
- **But 003 §16 deploys `meridian-ops` on Tue 20 and Wed 21 and runs M1 on Thu 22, which conflicts with ML-1017-1** (Decisions Log, 17 Oct): 002 A6 changes `meridian-ops` and is blocked by N-3 until Sat 24; 003 may code and test locally from Mon 19 and **deploy from Sat 24**. The 011 runner reads `GET /api/ops/cf/d1-today` and posts `POST /api/ops/ingest/run-event` on `meridian-ops` before and after every batch. A redeploy during a batch makes it fail closed with `headroom_unavailable`. That is safe, but it stops the run, possibly on the A-pilot day. **003-6:** move every 003 remote step, including the M1/M2 D1 batches (which write Ops rows during 011's own-row window), to **≥ Sat 24 08:05 UTC**. A6 goes first, and `/api/ops/cf/d1-today` and `/api/ops/ingest/run-event` keep their paths (002 §13 already keeps both in `meridian-ops`). The Founder's Access Block can stay on Thu 22, because it touches no D1.
- **004-follow-on:** 004 D-1 ("003 live by Fri 23") no longer holds. 004's Mon 26 start moves, or runs locally, until 003 is live. The Main Lane re-sequences: for example Sat 24 A6 + 003 deploy + M1/M2; Sun 25 (clock change) sweep extensions; Mon 26 the entities-api retirement and the 004 start; 007 Phase 4 by Wed 28 is then at risk. This is for the Main Lane to decide; this review does not choose it.
- **The sweep during the run:** the frozen Entities writers (OQ-9) must not create E1 noise, and E4 is unaffected. 003-4 covers the 011 runner itself.

---

## 4. Acceptance criteria (Task item 4)

Most of 003 AC-1 to AC-16 and 004 AC-1 to AC-16 are testable as written. The gaps:

| # | Spec | Change |
|---|---|---|
| 003-7 | 003 AC-12 / V3 | State the counts: **9 tickets (7 `resolved`, 2 `open`); events `created` 9, `decision_recorded` 7, `migrated` 9; `object_key` set {931, 2589, 2014, 3, 143, 49, 194, 204921, 28219}**. These are R1's numbers (4 + 3 decided, 2 pending) and match the author's dry-run. "As expected" is not testable. |
| 003-8 | 003 AC-10 | Add: the E2 case carries `job_id = cf.meridian-entities-enrich.phase23` (003-1); M2 seeds **two** cases, E3 and E4-delta (003-3); and a resumed 011 batch with `attempted > 0`, `progressed = 0`, `raced > 0` raises **no** E1 (003-4). |
| 004 AC-12 | 004 | Members from Evidence §15.3 `0d1bbf9b…`: 24 rows, actions 6 / 5 / 13 (`null_and_offline_match`), OPAP 2014 absent, and 931's evidence cites `DQ-M-000001`. |
| 004 AC-13 | 004 | At least GM Financial, Welltower Inc and Pfizer NL, each with its LEI; Pfizer NL has `co_registrant_of` set and no parent link. |
| New 004 AC-17 | 004 | Seeds exist: KI 22.43 (0 members, `fix_ref` MA-OCT-011), `wrong_identifier` on 2289/`cik`, OTP `entity_merge` with members 2019 and 467290, and the 011 hand-off tickets (004-4). Re-run: 0 changes. |
| New 004 AC-18 | 004 | Resolve authority (004-9): `fixed` without a `fix_scheduled` event → 409; a service token on resolve/dismiss → 403; `reopen` on `DQ-M-000001…3` without a Founder note → 409. |

---

## 5. Required changes (numbered)

### MA-OCT-003 (rev 1)

1. **003-1** E2 `job_id` = `cf.meridian-entities-enrich.phase23`, the only writer of `in_progress` (`entities-enrich.js:167`, Phase 2). Remove the "expected phase1" wording, and note that resetting the 11 Jun row is a Data-Identity Lead packet ≥ Sat 24.
2. **003-2** M2 summary: 011 closes **at most 3,676** of the **26,083** orphaned `name_search` rows. At least ≈ 22.4k remain. The remediation owner is the enrich fix packet (H1), and 011 gives partial relief.
3. **003-3** E4: seed one case for `cf.meridian-entities-delta` in M2 now (006 §8.3: "delta: never run"). Keep the automatic rule. This keeps 006's condition visible today rather than from about 5 Nov.
4. **003-4** E1: for the 011 runner, count `raced` (already applied) rows as progress, or leave `JOB_ID` out of E1, because 011 has its own E-gates and read-back stop rule. Otherwise a correct resume raises a false sev2.
5. **003-5** Q2 condition: `entity_exceptions` is dropped only after every merge writer (013 first) reads `do_not_merge` from `DQ-M-000001…3` in Ops. Name the three pairs (931/1216, 2589/25577, 2014/25655) in §10 as protected decisions.
6. **003-6** Calendar to ML-1017-1: every remote step (deploys, `004-ops-cases.sql`, M1, M2, AC-1/AC-16 in production) moves to ≥ Sat 24 08:05 UTC, A6 first, with `d1-today` and `run-event` paths unchanged. The Thu 22 Access Block may stay. §5 and §16 should say "17–23 Oct" consistently (§5 says 17–24).
7. **003-7** AC-12 counts as in §4.
8. **003-8** AC-10 additions as in §4.

### MA-OCT-004 (rev 1)

1. **004-1** AC-13 / M4: GM Financial, Welltower Inc and Pfizer NL are the named minimum set, with their LEIs. Pfizer NL is a co-registrant with no parent link.
2. **004-2** New `ticket_type` `wrong_identifier` (owner Data-Identity Lead). Seed it for entity 2289 `cik` 0000766704 → 0001917598, fixed before 008 applies the Welltower OP LLC → 2289 link.
3. **004-3** Seed KI 22.43 as an aggregate with 0 members (657 > the 500 cap). `fix_ref` MA-OCT-011; evidence is 011's close-out list SHA; the recurrence goes to the enrich fix packet.
4. **004-4** **M5 "011 close-out hand-off"** (≥ Sat 24, after 011 close-out): aggregate tickets with 0 members (counts and list SHAs in evidence) for:
   - 215 deferred A edges;
   - 6 T1_LAPSED parent LEIs and their 3 waiting edges;
   - the 1 E-1 exclusion (child 99231, parent `549300CZ8QS1GE53O776`, RC-12);
   - 31 LEIs / 62 rows (KI 22.41 → 013);
   - the 9 government rows (D7-1);
   - the report-only tiers: 1,342 T1_LAPSED, 1,739 T1+/T1c, 852 N+, 2,336 review;
   - 128 no-reason rows.

   Owner: Data-Identity Lead. The 011 author supplies the list SHAs at close-out (H-1).
5. **004-5** Seed an `entity_merge` ticket for the OTP Bank pair (2019 / 467290), with `fix_ref` MA-OCT-013.
6. **004-6** `reopen` on legacy `do_not_merge` tickets is refused unless the note names a Founder supersession. The decision must stay readable on the row.
7. **004-7** The KI 22.9 member key carries the edge `source`, so a later delete cannot touch an 011 `gleif` edge.
8. **004-8** M3b: take its members from Evidence §15.3 (`0d1bbf9b…`; 24 rows = 25 less OPAP; 6/5/13). Rename `null_and_requeue` to `null_and_offline_match`. Cite `DQ-M-000001` on member 931.
9. **004-9** Resolve authority for Entities-data tickets as in §2. Add AC-17 and AC-18.

---

## 6. Founder questions: recommended answers

| Q | Recommendation | One-line reason |
|---|---|---|
| **003 Q1** auto-resolve replayed `job_missed` | **Yes** | It closes only an operational miss, with the matched `run_id` audited, behind its own switch and cap. No identity data is touched. |
| **003 Q2** keep `entity_exceptions` frozen until November | **Yes, keep** | It is the M1 rollback source, and it holds three Founder `do_not_merge` decisions. The drop waits until 013 reads them from Ops (003-5). |
| **003 Q3** Access service token for scripted case actions | **Yes** | It lets AC-2 to AC-4 run in production, provided the token can raise but never resolve or dismiss a ticket on Entities data (004-9). |
| **004 Q1** reopen KI 22.9 for deletion of the 4 edges | **Yes** | 006 confirmed all 4 are W with no GLEIF relationship behind them (RC-20). After 011 the graph's other edges are RR-backed, so these 4 would be the only unsupported ones. The fix is about 16 writes ≥ Sat 24, and your 22 Aug decision stays on record. |
| **004 Q2** 008's runner raises `missing_entity` with a service token | **Yes** | It is limited to that one type, with server-side dedupe, and it never links an entity. It replaces a manual re-load after each re-verification. |
| **004 Q3** new DQ tickets in the macOS notification | **Yes** | One indexed count and 0 writes. It means button reports (and the 004-4 hand-off tickets) are seen before 005's console exists. |

---

## 7. Hand-offs (not changes to 003/004; for the Main Lane)

- **H-1 (LANE-11, at 011 close-out ≥ Sat 24):** supply the list files and SHAs for 004-4 and 004-3. This is part of 011 §11 deliverables already, so there is no new 011 work, and nothing before the Wed 21 A-pilot.
- **H-2 (013 brief owner = LANE-11; needs its own packet):** 013 must:
  - exclude the three `do_not_merge` pairs;
  - add the OTP Bank pair (2019 / 467290) and any other F-2-pattern pair from 011 close-out as inputs;
  - read `do_not_merge` from Ops after M1.

  This packet does not allow the 013 brief to be edited, so nothing was changed.
- **H-3 (LANE-8 / 008.DIL14):** sequence the Welltower OP LLC → 2289 link after the `wrong_identifier` fix on 2289 (004-2).
- **H-4 (Main Lane):** re-sequence 003 and 004 under ML-1017-1 (003-6), and record the effect on 007 Phase 4 (by Wed 28).

## Outputs

`claude/packets/MA-OCT-003.REVDIL_Report.md` only. No other file was written. No git writes. 0 D1.
