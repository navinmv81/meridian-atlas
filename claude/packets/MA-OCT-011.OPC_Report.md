# MA-OCT-011.OPC — Report

```text
CONTROL:      MA-OCT-011.OPC Control v1, SHA-256 56252ce46d27a2c4e4c1af802d81ee790b01b09871694e339e242dcc9a137261
EXECUTED BY:  Operations Lead (LANE-1-OPS, Cowork). Doc-only: 0 D1 reads, 0 D1 writes, no deploys, no git writes.
DATE:         2026-10-10, about 08:30 UTC
```

## Preflight

- No `.git/*.lock` files. HEAD is `16918e0` (`git --no-optional-locks`).
- **Independence:** I authored neither 011 rev 1.9 nor 013 rev 1.7 (LANE-11 owns both). The items being confirmed are my own OPS-R7 items, which this packet's Control explicitly scopes as "confirmation of own review items".

## Input hashes, as found on disk (all match; no stop)

| File | SHA-256 | Expected |
|---|---|---|
| `claude/packets/MA-OCT-011.OPC_Control_v1.md` | `56252ce46d27a2c4e4c1af802d81ee790b01b09871694e339e242dcc9a137261` | ✔ board row and Founder message |
| `claude/packets/MA-OCT-011.OPC_Task_v1.md` | `093b4d99aba06f25c3baa245a7e354ce4837a3c95200e10a29e0fcc5d95e9c09` | ✔ Control |
| `claude/MA-OCT-011_Spec.md` (rev 1.9) | `e09c01b97729bb5a33b8bf9f1c3f23fc129caa24bb6db32456ae0868d31f2d22` | ✔ Task |
| `claude/MA-OCT-013_Spec_Brief.md` (rev 1.7) | `a79bb98b7c0966bb6de2d16594208c041f033673992e9663f8806214700613de` | ✔ Task |
| `claude/MA-OCT-011_Ops_Review.md` (OPS-R7) | `976f08379f3f8324bb8ea8eb37e74d1c61f6a86af4c4cb07c6596190d34428f9` | ✔ Task |

## 1. Hash confirm: OPS-R7 items present and not weakened

**`claude/MA-OCT-011_Spec.md` rev 1.9 (`e09c01b9…2d22`): CONFIRMED.**

| Item | Where in rev 1.9 | Status |
|---|---|---|
| R-1 (a) | ≥ 15 A rows in the Fri 16 freshness gate; an A identity mismatch is an E-4 trigger before any A or E-A write (§9) | present |
| R-1 (b) | E-A only after every A read-back diff has passed (§4.4) | present |
| R-1 (c) | ≥ 10 A rows among the 25 post-run spot checks (§9) | present |
| R-1, overall | — | **Strengthened** by AR11-2 / RA-12 / RA-14: an A pilot with 50/50 adjudication, and on any wrong T1 match A stops and the batch is restored |
| R-2 | Rollback inputs kept ≥ 30 days after close and until 013 closes, independent of `gleif_006.db` (§7, §10, §11) | present. AR11-1's "rollback valid only until 013 starts" limits when rollback can be used, not how long the inputs are kept, so it doesn't weaken R-2. |
| R-3 | Full write payload for the 9 deferred LEIs / 22 rows in the 013 hand-off file (§11) | present |
| R-4 | Engineering Lead `recon/<date>/` exports (≤ 300 reads) with SHA-256s; Ops signs by 09:00 UTC next day; an unsigned day blocks the next day's first batch (§7, §11) | present |
| N-1 | Ops authorises, LANE-1-ENG executes (§7, §11, timeline) | present |
| N-2 | `expected_max_duration_s` = 900 per batch (§7, §11) | present |
| N-3 | Freeze 17–23 Oct on `meridian-ops`, `OPS_INGEST_KEYS` and Entities Workers (§8, §11) | present |
| N-4 | Full rollback ≈ 4 run days, 26–29 Oct; Founder decision; per-batch restore is the default (§10) | present |
| N-5, N-6 | — | 013 items; confirmed in the 013 brief below |

**`claude/MA-OCT-013_Spec_Brief.md` rev 1.7 (`a79bb98b…13de`): CONFIRMED.**

| Item | Where in rev 1.7 | Status |
|---|---|---|
| R-3 | 9 deferred LEIs written from the 011 hand-off payload, never from a rebuilt DB, plus a ≤ 10-call freshness re-check | present |
| N-5 | Measured reads recorded, including temp-B-tree grouping under the 9 Oct 2.5× rule | present |
| N-6 | Run gates written out: `d1-today` with F-1 to F-5, ≤ 25k a day, no Sunday / Monday before 08:00 / enrich windows, observability gate; ETF Product Lead review kept | present |
| Rev 1.7 changes | B13-1 (key UPDATE after DELETE), B13-2 (colliding exposure rows merged, never dropped; R_collide measured), B13-3 (index matched by name) | add safety; nothing weakened |

## 2. Ruling ML-0910-1: **CONCUR**

011's ≈ 300 heartbeat and ops writes a day count toward its 25k daily cap. That is the conservative reading, and it is consistent with OPS-R3 F-1, which counts 011's own rows, including Ops ingest rows. Totals are unchanged; Mon 19 Oct Bucket B goes to ≈ 6,170 rows and the overflow rolls to Tue.

**One clarification for the build brief:** outbox replays and any `headroom_unavailable` / `failed` heartbeats also count, at about 5 row-writes per ingest event. The runner should compute the figure from its delivered events, not use a flat 300.

## Stop point

Report written. No other files touched.
