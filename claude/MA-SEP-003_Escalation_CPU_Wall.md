# MA-SEP-003 — Escalation: chunked-resumable design hits a hard CPU wall at ~82% of one file

**Raised by:** local Claude Code build session, 2026-08-20/21
**Status:** RESOLVED 2026-08-21 — Founder approved a new architecture (one-time local seed + Cloudflare-native daily delta Worker) rather than pursuing a fix to the chunked full-file approach. Full decision record: `MA-SEP-003_Change_Request_Delta_Architecture.md`. Next steps for a local Claude Code session are in the revised `MA-SEP-003_Build_Brief.md`. The root-cause analysis and options below remain accurate as a record of what was considered — kept for reference, not because Option 1/2/3 below is still under consideration.
**Related:** `MA-SEP-003_Spec.md`, `MA-SEP-003_Build_Brief.md`, `MA-SEP-003_Change_Request_Cron_Consolidation.md`

## Summary

The Spec's Open Question 1 (resolved 2026-08-19) concluded `meridian-firds` needed to be "chunked/resumable from v1" because a single invocation can't fit the full ~86.6MiB/150,558-record file. That part was correct and is built and live-tested. What wasn't anticipated: the chunked design itself hits a **second, independent CPU ceiling** partway through a *single file's full resumable pass* — not from processing too much per chunk, but from an unavoidable cost that grows with how far into the file a chunk resumes.

**Live-tested result:** 24 successful invocations (500 new unique ISINs each) got through 124,020 of 150,558 raw records (82.3%) / 10,986 of 18,353 unique ISINs (59.9%) before every subsequent invocation started failing with Cloudflare's real `error code 1102` (CPU time exceeded) — 20 consecutive failures at the same resume point, no further progress possible. State is safely paused (`firds:state` KV: `nextIndex: 124020, status: in_progress`); every write is `INSERT OR IGNORE`, so nothing is corrupted and a restart from scratch is harmless, just redundant.

## Root cause

`meridian-firds` cannot persist decompressed state between invocations (Workers have no cross-invocation memory), so every invocation:
1. Re-fetches and re-decompresses the zip from the start.
2. Skip-scans (cheap boundary detection only, no field extraction) past every record before its resume point.
3. Field-extracts up to `RECORD_CHUNK_SIZE` (500) *new* unique-ISIN records.

Step 2's cost grows with resume position and is **independent of chunk size** — shrinking the extraction chunk doesn't reduce it, because the skip-scan still has to decompress and boundary-scan everything before it. Early invocations (resuming at ~10K records) cost ~30-70ms; by ~120K the skip-scan alone exceeds the account's real per-invocation CPU budget, before any new extraction happens at all. This is a fundamentally different constraint from the "single invocation can't hold the whole file" problem the Spec already solved — it's "a resumable pass across many invocations still can't finish the file," because the *cumulative* cost of all the skip-scans is roughly quadratic in the number of chunks.

This was flagged as a known trade-off in the code's own comments before live testing ("later invocations cost more... inherent cost of not persisting decompressed state between invocations, not a bug") but the session underestimated how early it would actually become fatal — ~82% through, not near the very end.

## What's confirmed working

- Table, Worker, and linkage logic are all correct — verified against real row-count deltas (not self-reported counters, which had their own now-fixed bug, see below), across `firds_instrument_reference`, `entity_isin_map`, `instrument_master`, `entity_master`.
- CFI-C filtering, ISIN dedup, LEI-based entity resolution, and the new-issuer placeholder-name creation path (per 2026-08-20 decision) all behaved correctly on 10,986 real instruments.
- Zero ETF-domain reads/writes; zero cron changes; `meridian-firds` deployed with cron disabled, `/run`-only.

Three real bugs were also found and fixed during this same live-testing pass (D1 bound-parameter ceiling on an unbatched `IN` query; `meta.rows_written` being a physical-write metric, not a logical row count — switched to `meta.changes`; a Workers-vs-Node `DecompressionStream` behavioral difference around ZIP trailing bytes, fixed by reading the real ZIP Central Directory instead of relying on decoder self-termination). None of these are open — full detail in code comments in `src/firds-parse.js` and `src/firds.js`.

## Options (not decided here — Founder/Architect call)

1. **Ship v1 as partial-coverage.** Accept that one weekly pass only reaches however far into the file the CPU budget allows (~60-80% of unique ISINs on this session's numbers, real plan/account performance may vary day to day) and stop there. No further engineering. Downsides: silently incomplete coverage, no clean rule for which instruments are missing, and the *next* week's pass starts over from scratch (`status` resets to a fresh cycle once `done` — currently never reached, but would be once a smaller effective file size made completion possible), so coverage doesn't monotonically improve on its own.
2. **Persist intermediate decompression state externally** (e.g. R2 or a KV blob holding a compressed checkpoint) so a later invocation doesn't redo the full skip-scan from byte zero. This is the structural fix — removes the position-dependent cost — but is real new engineering (a new storage resource, more complexity) beyond what this packet scoped, and changes the "chunked/resumable, mirroring edgar_bootstrap_progress" design the Spec already signed off on.
3. **Reduce the total work per pass some other way** — e.g. only process CFI-C records ESMA hasn't already delivered in a prior week's file (a delta-like approach layered on top of the weekly full file), so a "full" pass only happens once and subsequent weeks are cheap. Not evaluated in depth this session; flagged as a third direction worth considering alongside 1 and 2.

## Required for next steps

Whichever option is chosen, it changes the Spec's "chunked/resumable, mirroring edgar_bootstrap_progress" design statement and should get the same Architect sign-off the schema itself required — flagging per the project's own "flag deviations before implementing" rule rather than the build session picking one unilaterally.
