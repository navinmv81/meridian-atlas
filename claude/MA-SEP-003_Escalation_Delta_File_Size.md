# MA-SEP-003 — Escalation: DLTINS delta files are far larger than the weekly full file (resolved same-day)

**Raised by:** local Claude Code session, 2026-08-21, per the Phase 2 diagnostic instruction in the previous Build Brief revision ("get real numbers before designing anything")
**Status:** RESOLVED 2026-08-21 — Founder decided same day to abandon the daily-delta-Worker approach in favor of a recurring weekly local job. See `MA-SEP-003_Change_Request_Local_Weekly_Job.md` for the resulting architecture and `MA-SEP-003_Spec.md`'s "2026-08-21 Architecture Revision v2" for the current design.

## Summary

The previous revision's core assumption — "daily deltas are materially smaller than the weekly full file" — was wrong, confirmed against real data before any delta Worker was built (per the standing "real numbers before design" discipline).

## Real numbers

Three real `DLTINS_*.zip` files pulled via the ESMA Solr file-listing endpoint (first part of each day, 2026-08-19 through 2026-08-21):

| File | Compressed | Uncompressed | Total records (NewRcrd+ModfdRcrd+TermntdRcrd) | CFI-C records |
|---|---:|---:|---:|---:|
| `DLTINS_20260821_01of03.zip` | 13.3 MB | 452.0 MiB | 500,000 | 39 |
| `DLTINS_20260820_01of03.zip` | 13.4 MB | 452.4 MiB | 500,000 | 60 |
| `DLTINS_20260819_01of04.zip` | 13.4 MB | 460.0 MiB | 500,000 | 40 |

## Why the assumption was wrong

ESMA's delta files aren't scoped to funds — they cover every in-scope instrument type across the whole EU market (bonds, derivatives, warrants, everything), and are capped at 500,000 records per part the same way weekly `FULINS` files are, meaning a full day's delta spans multiple parts (3 on 8/20 and 8/21, 4 on 8/19). Extrapolating part-1 size across parts, one day's delta is roughly 1.4–1.8 GiB uncompressed — over 16x the weekly `FULINS_C` file (86.6 MiB) that already broke the chunked-Worker design. CFI-C (fund) records are ~0.01% of each part — real, but not worth the cost of fetching everything else to find them.

## Other findings from the same diagnostic pass

- **Record-type tags: 3 of 4 confirmed at real volume** (`NewRcrd`, `ModfdRcrd`, `TermntdRcrd` sum to exactly 500,000/part). `CancRcrd`: 0 occurrences across all three files (1.5M records sampled) — the tag mechanism works (proven by the other three), it simply wasn't present in this sample; treat as real-but-rare, not assumed absent.
- **CFI code is present per-record, confirmed** — `<ClssfctnTp>` count matches record count exactly (500,000/500,000) in every file.
- **Structural mismatch from FULINS, also confirmed:** DLTINS does not use `<RefData>` as its record envelope (0 occurrences) — the real structure nests the record-type tag itself as the wrapper (`<FinInstrm><ModfdRcrd>...</ModfdRcrd></FinInstrm>`), not a sibling tag. Inner field paths look structurally identical to FULINS, but the existing `firds-parse.js` boundary scanner (`REF_DATA_OPEN`/`REF_DATA_CLOSE`) would not have worked as-is against delta files — moot now that delta ingestion isn't being built, but worth remembering if daily-delta ingestion is ever revisited.

## Resolution

Founder decided, in the same conversation the numbers were reported, to abandon the daily-delta-Worker approach entirely rather than attempt to make it viable (e.g. filtering server-side isn't possible — ESMA offers no query API, only whole-file downloads, confirmed earlier this packet). The weekly `FULINS_C` file is already pre-filtered to funds by ESMA and is a complete snapshot, not a diff — re-running the existing, already-tested Phase 1 seed logic weekly (as a recurring local job, not a Cloudflare Worker) achieves the same "stay current" goal without any of the delta-file complexity or size problem. Full design: `MA-SEP-003_Change_Request_Local_Weekly_Job.md`.
