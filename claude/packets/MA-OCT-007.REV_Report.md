# MA-OCT-007.REV — Report

**Control v1** `claude/packets/MA-OCT-007.REV_Control_v1.md` SHA-256 `0de0912f2b14c0ef45bdf6b4cc53a513119b49bc6fa3dddfbb78b87cb9e0f3a7` (matches the STATUS_BOARD.md row and MA-OCT-007.REV_Status.json)
**Task v1** `claude/packets/MA-OCT-007.REV_Task_v1.md` SHA-256 `ef7c5c292f050ea8e836a36ee9291d1de4d1c8e79216e745109a0bd1ccb1242d` (matches the Control)

```text
REPORT TO:    Main Lane (Program Orchestrator)
FROM:         REVIEW-007 — independent UX Lead + Data-Identity Lead, fresh Cowork session, Sat 10 Oct 2026
EXECUTED ON:  Founder's instruction to execute
VERDICT:      PASS WITH NOTES. 10 required (R7-1…R7-10, doc-only, rev 1.4 before Phase 1 build Wed 14 Oct);
              12 non-blocking (N7-1…N7-12). Nothing blocks Founder spec approval on Mon 12 Oct.
```

## 1. Preflight
- Folder `Meridian Atlas Clean (v11)`; branch `October-2026`, HEAD `16918e0` (as at issue). No `.git/*.lock`. Git read with `--no-optional-locks` only.
- Independence: this session authored none of the inputs and is not LANE-7, Main Lane, LANE-8 or LANE-11.
- Budget used: 0 D1 reads, 0 D1 writes, 0 deploys, 0 git writes. The 007 spec and every other spec are untouched. `MA-OCT-007.REV_Status.json` and `STATUS_BOARD.md` not edited (Main Lane owns state).

## 2. Input hashes (as found on disk)

| File | Expected (Task) | Found |
|---|---|---|
| `claude/MA-OCT-007_Spec.md` rev 1.3 (772 lines) | `332c638c…ec72e` | `332c638cb0e42156e623e457bf452141bd02c420008a307ae216b731cceec72e` ✔ |
| `claude/packets/MA-OCT-007.R13_Report.md` | `47436fcc…a203` | `47436fcc26bd934b986ab326bb8a06ece5430551de5092ad5fff74a1617ba203` ✔ |
| `claude/MA-OCT-007_AppendixA_Results.md` | `a6ee18d4…94aa` | `a6ee18d47c86932d66d8490d4995828dfbb984cffea25a8ed7c89747235594aa` ✔ |
| `claude/MA-OCT-007_Spec_Brief.md` | read as found | `d57ed1dcf77109b9283a16c596af415d69ad8562719b27c58baa9c001bebe2b8` (= spec's `d57ed1dc…e2b8`) |
| `claude/MA-OCT-008_Spec.md` rev 1.2 | `bcdad9a2…5cd3` | `bcdad9a2d315371b9c60b11cbcf72dfca88c99dca22fbe4e5310e2fb5f815cd3` ✔ |
| `claude/MA-OCT-ENT-CR1_Index_Change_Request.md` rev 1 | `fb13ff3e…6c20` | `fb13ff3eeb97b2f04098d84f9cd2f035d6d5952afc3c98bc3a7e9fabeac96c20` ✔ |

## 3. Output
`claude/MA-OCT-007_Spec_Review.md` — new file, 114 lines, SHA-256 **`79a852cad56864bfee39e1d3d3e404995200c978a586205390243100b70b035b`**.

## 4. Required items (rev 1.4)

| ID | Hat | Item | Spec location |
|---|---|---|---|
| R7-1 | DI | Close O2: composite `idx_iem_entity_key` (ENT-CR1 C1); gate R2/R4 on "ENT-CR1 verified" | §7.3, §11, §12, §15.2, App. A P6/P7/Q3, App. B |
| R7-2 | DI | Placeholder keys (`CUSIP:000000000` etc.) must resolve to `unmatched`, no candidates; 2-read pre-build check | E8, §3.1, §5.1, T1/T2 |
| R7-3 | DI | Define `source` / band / `as_of` of a de-duplicated candidate (+ additive `also_sources`) | §5.1 step 5, §3.2, §5.2, T9 |
| R7-4 | UX | O5: correct the key-order description; single-page sort vs multi-page flat list | §7.2, §4.2, O5 |
| R7-5 | UX | Copy table for every state × reason (incl. `source_conflict`) | §4.1, §5.3, §6.4–§6.5, AC7 |
| R7-6 | UX | History/popstate contract (1 entry per overlay; no-route Back closes overlays, never re-renders) | §3.3, §4.4, AC1 |
| R7-7 | DI | Read figures: AC2 bound contradicts §11.1; measure per-row multiplier on 13 Oct; R1 worst ≈ 110, R5 ≈ 5.5k | AC2, §7.2, §11.1, P6 |
| R7-8 | UX+DI | `lei_only`: keep in contract, T2 fixture, live wording `no_mapping`; UAT instrument selection | AC7, UAT 7, §4.1 |
| R7-9 | UX+DI | Heuristic = 75 live: fix example; explain source override on screen and in Q2 | §4.1, §5.2, Q2, UAT 5 |
| R7-10 | UX+DI | `from` grammar: add `bond:{key}`, define parse for keys containing `:` | §3.3, §3.5 |

## 5. Answers in brief
- **O2:** composite, closed (ENT-CR1 rev 1 C1).
- **O3:** no backfill in October — no pre-007 surface ever carried entity ids in URLs or storage, the source pairs are unverified, and a wrong redirect is worse than an honest `gone`.
- **O5:** yes, with R7-4's conditions.
- **Author Q1–Q4:** close O2 (R7-1); `lei_only` via T2 fixture + wording change (R7-8); 55 → 75 plus visible explanation (R7-9); 2.5 × N applies to grouped scans and the P6′ fallback, not to R1–R4 after the index — the unmeasured per-row lookup multiplier is measured on 13 Oct (R7-7, N7-12).
- **Founder Q1–Q3 (reviewer view only):** agree with (a), Yes, No. For Q2, the Founder should be told that heuristic rows (1,649, confidence 75) show as Low by source.

## 6. Questions for the Main Lane
1. **Q2 Decision Request on 12 Oct:** include the heuristic-75 fact (R7-9) even if rev 1.4 is not yet on disk?
2. **R7-7 measurement:** add one R2 execution on entity 28088 (`limit=25` and `limit=100`, ≈ 60–410 reads) to ENT-CR1's after-set on Tue 13 Oct, or route it as a separate read in the 007 build lane? It needs the Engineering Lead's session either way.
3. **R7-2 pre-build check:** two PK reads (`instrument_master` and `instrument_entity_map` for `CUSIP:000000000`). Route with the P0 prerequisites?
4. **N7-5** is a note for the 008/009 owners (cross-key bond gap; partial-index literal). Relay it?

Stop point reached. The spec was not edited.
