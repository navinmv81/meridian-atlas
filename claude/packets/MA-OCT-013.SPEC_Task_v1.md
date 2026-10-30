# MA-OCT-013.SPEC — Task v1 (immutable): 013 duplicate-entity merge — pre-spec measurement (read-only D1) + full spec

Governing: `claude/MA-OCT-013_Spec_Brief.md` rev 1.6 `a79bb98b7c0966bb6de2d16594208c041f033673992e9663f8806214700613de`; ML-1025-5 (013 runs **Mon 2 Nov** after 08:00Z; reviews Fri 30 by Architect + Operations Lead + **ETF Product Lead**); ENT-CR1 complete (ML-1029-1); 011 hand-off (9 LEIs / 22 rows).

Do:
1. **Pre-spec measurement (read-only D1, brief N-5/N-7, L11-13):** confirm `idx_iem_entity_key` (and `idx_bil_entity` if `bond_issuer_link` present) per the brief's runner-check rules; measure repoint read cost on a sample, including temp B-tree grouping; extrapolate to 1,928 (and optional 743). Total measurement reads ≤ 50,000; record each query's `meta.rows_read`.
2. **Full spec** `claude/MA-OCT-013_Spec.md` rev 0 from the brief: merge order, repoint of every child table (incl. bond links), `entity_merge_redirect`, write budget per day vs the 100k cap (Mon 2 has the Mon 03:30–08:00Z freeze; no Sunday writes), batching, kill switch, read-back, rollback manifest, acceptance criteria, ETF-exposure impact for the ETF Product Lead, and its interaction with A2 (A2 finishes Sat 31).
3. Max 3 Founder questions with recommendations.

**Standing rules:** Wrangler only `/usr/local/bin/wrangler` 4.96.0 (never `npx`); pre-flight `wrangler whoami`. Respect `claude/relays/FREEZES.json` (today UTC: 07:55–08:05, 10:45–11:15, 11:45–12:15, 16:45–17:15, 17:45–18:15, 23:50–00:10; health-check sweep ≈ 22:00Z). **One production change at a time** across lanes — announce "starting <change>" with UTC time in your report log and check no other lane is mid-change. Production steps end by **23:45Z**; an unfinished production step waits for a new Control, it is not skipped silently. ML-1024-1: never read the contents of `~/.meridian-secrets/*`, `.env*`, `*.secret`. Stop before any macOS permission prompt (ML-1013-3). Explicit-path staging only; never `git add -A`; never `September-2026`; never touch `13F Seed/gleif-seed.js`, `.env.*`, `.claude/settings.local.json`. D1 writes guarded, batched, three-point check first. Work in your own worktree, never the shared checkout.

Write `claude/packets/MA-OCT-013.SPEC_Report.md`. Reply **"MA-OCT-013.SPEC reported"**.
