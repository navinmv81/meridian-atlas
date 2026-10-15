# REVIEW-A (Architect + ETF PL, independent session): REPORT

```text
ISSUED BY:    REVIEW-A, Fri 9 Oct 2026 (≈ 21:50 UTC)
EXECUTED BY:  Architect + ETF Product Lead (doc-only: 0 D1 reads/writes, no git writes, no deploys)
REVIEWED BY:  Main Lane
APPROVED BY:  Founder
RE:           claude/relays/REVIEW-A_NEXT.md  sha256 67c71233fb5202a6f1fd9f0f786ad514dead185eeffd12e556e1af6910d4c2d3 (21:41 UTC)
SUPERSEDES:   this file's 16:27 UTC version
```

## What I did

| # | Item | Status |
|---|---|---|
| 1 | 008 rev 1.2 against A8-1 to A8-6 | **DONE. All six MET.** Appended as §8 "Rev check" to `MA-OCT-008_Architect_Review.md`. 4 tidy-ups, none blocking. No conflicts with rev 1.1's Ops sections. |
| 2 | 011 rev 1.9 / 013 brief rev 1.7 against AR11-1, AR11-2/RA-12, RA-13, RA-14, B13-1..B13-3 | **WAITING. Trigger not met.** `LANE-11_REPORT.md` (`c9b19afb…955d`, 16:35) still reports 011 rev 1.8 and 013 rev 1.6. On disk, `MA-OCT-011_Spec.md` already shows **rev 1.9** (`e09c01b97729bb5a33b8bf9f1c3f23fc129caa24bb6db32456ae0868d31f2d22`, 21:43, unreported). `MA-OCT-013_Spec_Brief.md` is still rev 1.6 (`00ec6303…3485`). Per the stop-on-unreported rule, I have not checked rev 1.9. I will check it once LANE-11 reports both hashes. |

## Per item (008)

| Item | Verdict |
|---|---|
| A8-1 final inputs + wrangler pin | **MET** |
| A8-2 F-1..F-5, 120 s / UTC date, freezes (enrich 05:50–07:10 etc., from `FREEZES.json`) | **MET** |
| A8-3 classifier precedence, benchmark exclusion, `\bUnits\b` title-only, AC16, AC17 | **MET** |
| A8-4 per-tranche vs whole-filing `parse_failed`; re-parse path; AC18 | **MET** |
| A8-5 `status` (`active`/`paused`), no status filter, "sole inserter" + 013 repoint | **MET** (the 007 §3.6 edit is routed to LANE-7) |
| A8-6 ETF-tree reads stated; C1 real estimate + 10k stop | **MET** (ETF PL: no objection) |

## Files (full SHA-256)

**Written**
- `claude/MA-OCT-008_Architect_Review.md`: **`3fcb303d655038897f194827d85f979274e02ca62a2ed7ec5df6bfd457ac06ed`** (was `1e91b3d3da4188238178b2fc0786a0bf38edc464e3742c00297c85de100f222d`; append-only, §0–§7 unchanged)
- `claude/relays/REVIEW-A_REPORT.md` (this file)

**Checked**
- `claude/MA-OCT-008_Spec.md` rev 1.2 `bcdad9a2d315371b9c60b11cbcf72dfca88c99dca22fbe4e5310e2fb5f815cd3` (matches the NEXT file)
- `claude/relays/LANE-8_REPORT.md` `8ef16b4afef7a28e20d1beb405d4bbeaec873788da591deca2b13105e2437d2f`
- `claude/relays/FREEZES.json` `cdc9606a881d7b24c92a2d675efd3b4f4d6df8205073fa299209b068d16ac346`

**Not yet reviewed**
- `claude/MA-OCT-011_Architect_Review.md` `d097e6f90b7b158e4233f52ae8eb8952bb162fd8d7822ebe5836061610037679` is unchanged and waits for item 2.

Repo HEAD `16918e0`, branch `October-2026`, no `.git/*.lock`.

## Rulings

- **RA-15:** 008 rev 1.2 meets A8-1 to A8-6. It needs only the Main Lane hash check (`bcdad9a2…5cd3`) before the Founder on 12 Oct.
- **RA-16 (non-blocking):** fix the stale §0 lines D4 ("sole writer") and D11 (old freeze list) in the build brief. Re-cite 011 and 013 there once rev 1.9 and rev 1.7 are final. Add a fixture with a `'` in the title for the EP-1 literal SQL.

## Questions

1. **Main Lane:** 011 rev 1.9 is on disk but unreported, and 013 rev 1.7 is not on disk yet. Please confirm when LANE-11 reports, and I will run item 2 straight away.
