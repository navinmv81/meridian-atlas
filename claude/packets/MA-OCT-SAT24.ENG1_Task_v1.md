# MA-OCT-SAT24.ENG1 — Task v1 (immutable): Sat 24 go-live, part 1

Governing: CLOSEREV-OPS (`408948c20bdcdb44727442c8eca93c88f9faf2d53cf945d5c70b9f1d55c8f4cb`) §4a/§4b; A6R (`76fe7e011212f1196bf04873ce14afa070d86826ac1a36eadd8df53963bc831f`) incl. **R-A6-1**; 002a report (`7996e98c80c241252033b5f239a1e7582bda0f73347c23f9ff389cc3c9c29531`) Thu 22 steps C0–C6; BREVA (`365464181ee7219cdadd1f917bd51770d078b2078422087fc485886270e1a0c1`) S-5. Freezes (UTC) to avoid on Sat 24: 05:50–07:10, 07:55–08:05, 10:45–11:15, 16:45–17:15, 23:50–00:10.

Do in this order, each as its own step, recording versions before and after:
1. **07:15–07:50 UTC — Boost resume** (§4b): run `App/Corporate Atlas/scripts/entities-enrich-boost-resume.sh`; verify the flag is gone. First live fire is 10:50Z (verify later in step 6).
2. **08:05–10:40 UTC — K-5** (§4a, Ops choice *remove*): one `wrangler secret put OPS_INGEST_KEYS --config wrangler-ops.toml`, JSON on stdin = T12 canonical map minus `gleif-011`. Verify: old `gleif-011` key → 401; `boost-local`, `health-check-local`, `local-bonds` still authenticate. Record the new `meridian-ops` version, before/after names and hashes only. Optional: `ingest_enabled = 0` for `manual.gleif-reconcile-011`. Delete `~/MeridianAtlas-work/gleif-011/ops-ingest.env` only after verification and only if not in the retention manifest. Rollback: re-put the 4-hash map.
3. **A6 (R-A6-1 order, 3-deploy cap):** the Founder will already have created the "meridian-control admin" Access app and given you its AUD (they paste it in chat; it is not a secret). From the **A6 worktree** (`~/MeridianAtlas-work/a6-worktree`, never the shared checkout): C0 record the live `meridian-ops` version → commit the AUD into `wrangler-control.toml` by explicit path and push → C1 **one** deploy of `meridian-control` → C3 auth checks (missing-field POST → 400 with the Founder's session; no production row) → C4 deploy `meridian-ops` (A6) and check `d1-today` and the three ingest keys → C5 live-site check of the Ops tabs (redirects followed). Rollback by recorded version ids (S-5).
4. Tell the Founder in chat: **"A6 live — LANE-8-ENG may start"**, with the versions.
5. **Commits** (ML-1012-2, you remain the committer for everything except LANE-8-ENG's 003 files today — ML-1023-1): nothing else today unless listed in the Main Lane's commit list.
6. **After 10:50Z** (or 11:20Z after the freeze): confirm the first boost fire (`fired … in_window=true`, heartbeats 201, outbox empty).

Write `claude/packets/MA-OCT-SAT24.ENG1_Report.md`. Reply **"MA-OCT-SAT24.ENG1 reported"**.
