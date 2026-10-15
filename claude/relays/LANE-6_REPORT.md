# LANE-6 (Data-Identity Lead): REPORT — reply to LANE-6_NEXT.md (9 Oct, 2nd pass)

```text
ISSUED BY:    Data-Identity Lead (LANE-6), Fri 9 Oct 2026
EXECUTED BY:  Data-Identity Lead (doc-only: no D1, no git writes, no code edits)
REVIEWED BY:  Main Lane (hash check only)
APPROVED BY:  Founder (12 Oct)
RE:           claude/relays/LANE-6_NEXT.md  sha256 82237d9359d1624abae1d5bfa682cdb42d96163f03e9748c723f0124398842ea
```

## Result: ENT-CR1 rev 1 written, with AR-1 to AR-4 applied

| File | SHA-256 |
|---|---|
| `claude/MA-OCT-ENT-CR1_Index_Change_Request.md` (**rev 1**, 28,567 bytes) | **`fb13ff3eeb97b2f04098d84f9cd2f035d6d5952afc3c98bc3a7e9fabeac96c20`** |
| supersedes rev 0 | `c85434e221fa88042d0302079f7cbcff57e3bf4386ca58452ccbbd83f1a440ed` |
| Architect review used (re-hashed, matches) | `5ca5bb0ee91cb0d57c719f3cb344103b95471f954e3c16bf93fda8fadfc2d2b3` |

| Condition | Where in the CR | What it now says |
|---|---|---|
| **AR-1** (RA-4) | §3, §5, §7, §9 | C1 reads **32.8k–82k** (1 × to 2.5 × *R*ᵢ; the 9 Oct temp-B-tree rule). Declared read cap **≤ 90k**. **Operations Lead exception to the 50k per-execution ceiling, granted in advance; no exception on file → C1 does not run.** The S1 gate (*R*ᵢ ≤ 45,000) stays. Actual `rows_read` and `rows_written` for C1–C3 are recorded as the first measured DDL costs. RB-2 notes that a recreate could report up to ≈ 137k reads. |
| **AR-2** (RA-5) | §3, §5, §6 step 5 | `d1-today` `rowsWritten` **≤ 30,000 before C1**. **≤ 35,000, re-read before C2 and again before C3.** C2 > 1,000 writes → stop, and C3 moves to another day. A failed gate → C2/C3 move to another day. The day stays under 100k even in the worst case (2 × C1, or a DROP billed at about 55k). |
| **AR-3** (RA-6) | §6 steps 4, 5, 7, 8; §7 | **"ENT-CR1 verified" = C1 applied + E1, E2 and E4 passed.** That releases 013's precondition and 007 R2/R4. C2/C3 may slip to Wed 14 Oct or to after 23 Oct; slipping is not a rollback. The migration file holds only the statements actually applied, plus a follow-up `ent-cr1b-…sql` if needed. |
| **AR-4** (RA-7) | §6 window, sequencing, steps 0–4; §8 | Start **≥ 08:05 UTC**, clear of the bootstrap's 08:00 fire. ENT-CR1 runs to completion **before any 002 work on Tue 13**. Inside 08:05–10:30: no Entities Worker (A5) deploys, no figi `/run`, no gate2/gate3 scripts. Optional `d1-today` lag sample at +1, +5 and +15 min after C1, for LANE-2. |

**Also taken up (the Architect's non-blocking notes, no scope change):**
- **N-1:** E5's expected "before" is a `SCAN` plus correlated `SEARCH`es, so it is not read as a regression.
- **N-2:** a `sqlite_stat1` preflight read (ST), with an explicit **"do not run `ANALYZE`"**.
- **N-4:** a "superseded by ENT-CR1, do not replay" note on `corporate_atlas_prompt6_execution_v3.md:312-318` in the close-out commit. It is outside the DDL scope.

**Not changed:** the design, which pair is dropped (DIL-0208-1), the EXPLAIN pass rules, the Tue 13 / Wed 14 timing (never 17–23 Oct), and RB-1/RB-2.

## Rulings
- **L6-3:** AR-1 to AR-4 accepted in full and applied as written. N-1, N-2 and N-4 taken up as doc-only additions. No in-lane deviation.

## Questions / dependencies for the Main Lane
1. **C1 is blocked until LANE-1-OPS grants the AR-1 exception** (≤ 90k `rows_read`, one execution, Tue 13 / Wed 14 only). Rev 1 says "no exception on file → C1 does not run". Please confirm it is on file before Mon 12 Oct.
2. **N-6 is still open:** the formal ETF Product Lead consult on E8/E8b (13F Worker and the manager-positions seed switching to the identical `idx_instrument_cusip6`). The Architect asked the Main Lane to route it.

## Files
- Written: `claude/MA-OCT-ENT-CR1_Index_Change_Request.md` (rev 1), and `claude/relays/LANE-6_REPORT.md` (this file).
- Read only: `claude/relays/LANE-6_NEXT.md`, `claude/MA-OCT-ENT-CR1_Architect_Review.md`, `claude/relays/README.md`, `claude/relays/LANE-1-OPS_NEXT.md`.
- D1: 0 reads, 0 writes. Git: none. The R4 cleanup still waits for 12 Oct.
