# MA-OCT-000 — Architect Review

```text
REVIEWER:     Architect (hosted in October Main Lane; not the executing role)
PACKET:       MA-OCT-000 — Runtime truth baseline
VERDICT:      PASS WITH NOTES
DATE:         2026-09-24
```

## Evidence checked
1. `claude/MA-OCT-000_Closeout_Summary.md`, the Job Manifest (md and json, 47 jobs, 23 fields each), and the October branch CR.
2. **Checksums re-computed independently.** All 10 in-scope hashes match `MA-OCT-000_Review_Checksums.txt`. The brief under review is rev 2, including the Step 5 update.
3. **Git state re-verified.** `September-2026` = origin = `420487d`, nothing is staged, and `CLAUDE.md` is modified with only two diff hunks (Environment Truth and Current Sprint Packet), +29/−14.
4. **Cron expressions** re-read from the tomls and matched to manifest §5.1.
5. **F1 corroborated.** `c3a07c7` is reachable only from `origin/corporate-atlas-v4-deploy-clean`. The token-bearing script paths in that commit number 11, the same count as the 11 scripts in the August MA-AUG-004 credential incident.
6. **F5 corroborated.** `13F Seed/health-check-log.txt` and `backfill-log.txt` were last modified 2026-08-23 08:27.
7. **Query ledger:** plans were recorded, total reads were 159,829 against a 250k budget, and there were zero writes.

## Assessment
This is a high-quality baseline. The packet stayed read-only, stopped at the SCAN rule instead of working around it, named every gap it hit, and turned up four High findings no one knew about. It meets its purpose: MA-OCT-002 has a registry seed, and MA-OCT-006 has a GLEIF evidence base.

## Rulings on the executor's specific asks

| Ask | Ruling |
|---|---|
| 1. Observed-invocation method instead of the CF schedules API | **Accepted for the baseline.** Observed invocations are stronger evidence of *effective* schedule than configuration is. **Condition for MA-OCT-002:** the Founder creates a scoped token (Account → Workers Scripts: Read, plus Account Analytics: Read) and stores it as a `meridian-ops` secret. 002 must read effective schedules from the API, not from inference, and must add bootstrap, proxy, 13f and filings to the invocation allowlist. |
| 2. MA-SEP-017 residual SCAN (~44k reads) | **Not authorised. Deferred to MA-OCT-006.** The SCAN rule doesn't get exceptions inside a baseline packet. Two reasons. First, F2 moves the check dates to Sundays 13 and 20 Sep. Second, 006 already needs an `entity_master` index audit, and adding an `updated_at` index goes through its own CR there, as a write-cost trade-off. MA-SEP-017 stays open with a pointer to 006. |
| 3. Branch CR, Option A | **Option A accepted.** Each sprint branch stays an immutable release record, and Pages is switched at the October go-live. **The order changes, though (Required item 1).** |
| 4. F2 routing and F1 escalation | **Confirmed.** F2 gets a narrow, dedicated fix packet before the next Sunday co-fire (27 Sep 04:00Z); see Findings N2. F1 goes to the Founder today. |

## Findings

1. **F1 (security). Likely the MA-AUG-004 tokens, not a new leak, but confirm it.** The file count (11) matches the August incident, where both tokens were rotated and history was scrubbed with `git filter-repo`. The scrub evidently missed `corporate-atlas-v4-deploy-clean`, which was pushed afterwards (see CLAUDE.md on `c82963e`). If the Founder confirms both tokens show as **revoked or deleted** in Cloudflare, the exposure is inert. Rewriting that branch's history is then optional hygiene with its own CR, and low priority. If either token is still active, revoke it immediately. That is not a packet decision.
2. **N1 (new, security). `meridian-bootstrap` `/trigger` is an unauthenticated write endpoint** (close-out §5.4). It carries the same risk class as Known Issues 22.13 and 22.18, which were fixed in September. It was not raised as a headline finding, so this review raises it. Owner: ETF Product Lead. Addressed with F9 (below).
3. **N2 (F2/F3). The Sunday co-fire is the root cause of Known Issue 22.1, and it costs ETF data every week.**
   - Cloudflare numbers day-of-week 1–7 with 1 = Sunday, so `0 4 * * 1` fires on Sunday alongside holdings.
   - Seed's writes push `writes_today` over holdings' 80k guard, so holdings ends `partial` (F3).
   - **Fix:** a one-line cron change in `wrangler-entities-seed.toml` to **`0 4 * * mon`**. Use the named-day form, which removes the numbering ambiguity. This is the same convention holdings already uses (`sun`). Then redeploy the seed Worker and **observe the actual fire** on Mon 28 Sep through `meridian-ops` invocations.
   - The cron count stays at 5/5, since this changes a slot rather than adding one.
   - Three-point check: no new queries. The read and write budget is the seed's existing one. The only risk is scheduling.
4. **N3. Cron capacity is a hard blocker for October design.** The account is at 5/5. The October Ops control plane (lateness detection, heartbeat sweeps) will almost certainly need a scheduled invocation. **Architect direction:** retire the `meridian-bootstrap` cron (F9: `status=complete` since 11 June). That frees one slot and removes N1's live exposure at the same time, provided `/trigger` is also auth-gated or removed. This goes to MA-OCT-002's spec as a prerequisite, owned by the ETF Product Lead, and needs a CR.
5. **F4 (GLEIF queue stall) is MA-OCT-006's primary evidence.** 26,537 rows are pending and have never been attempted, while enrich runs "successfully" twice a day. This shows exactly the gap the scope names between a job running and a job doing work. No action before 006.
6. **F5, F6 and F7 (monitoring blind spots)** go into MA-OCT-002's scope, not a hotfix:
   - The dead health-check LaunchAgent.
   - Wrangler OAuth failing under launchd.
   - The write guard that reads 0 on weekdays.

   **Interim mitigation:** until 002 lands, the Operations Lead manually checks the D1 budget in Cloudflare once a week. The Sunday co-fire is the only day near the cap, and N2 removes it.
7. **Domain-boundary notes for the MA-OCT-002 registry:**
   - `13F Seed/seed-entity-cik.js` writes the Entities table `entity_master` from the 13F folder.
   - `13F Seed/debug-d1-raw-shape.js` writes `holding13f_normalized`.

   Both must be registered with an explicit owner. Nothing changes now.
8. **F8 (ID collision). Keep register v3.** MA-OCT-001 stays "Ops backend foundation". The August D1 row "Data Quality Exception Management tool" is set to `SUPERSEDED → MA-OCT-003/004` (consistent with D4) through a Program Orchestrator board write. The tracked root file `MA-OCT-001_Spec.md` is renamed `MA-OCT-001-LEGACY_DQ_Exception_Spec.md` and moved to `claude/` in the same commit as the MA-OCT-000 outputs. Both actions are covered by the branch CR below; no separate CR is needed.
9. **Minor evidence gap.** Close-out §11 records the CLAUDE.md diff as "shown in session" and doesn't include it in the file. This is acceptable, because the checksum pins the reviewed CLAUDE.md exactly. For future packets, put the diff in the close-out file.

## Required before approval
1. **The commit order must be settled so the reviewed state doesn't live only in an uncommitted working tree.**
   - **Architect recommendation (branch first):** execute the October branch CR now. Run `git switch -c October-2026` from `420487d`; uncommitted changes carry over. Then commit the MA-OCT-000 outputs, the governing docs, CLAUDE.md, the Decisions Log and the F8 rename to `October-2026`, and push that branch.
   - This leaves `September-2026` frozen and the live site untouched, since Pages still serves `September-2026` `/docs`. It also honours the Founder's intent that nothing goes live before the October go-live.
   - Before the commit, the executing lane re-verifies the 10 hashes against `MA-OCT-000_Review_Checksums.txt`.
   - Every later October lane then works on `October-2026`.
   - **If the Founder prefers to keep the deferral**, it can stand, but no further October lane may open in `Clean (v11)` until the commit is done. Any `git switch`, `generate-docs.mjs` run or other commit would put the reviewed state at risk.

## Not required for approval, but time-bound
- **F1:** the Founder confirms token revocation. **Today.**
- **N2:** the seed cron fix is live before **Sun 27 Sep 04:00Z**.
