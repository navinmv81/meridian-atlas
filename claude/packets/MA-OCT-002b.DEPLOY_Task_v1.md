# MA-OCT-002b.DEPLOY — Task v1 (immutable): 002b deploy Thu 5 (from 08:05Z) — gated on both sign-offs + the Founder's token

Governing: 002b.BUILD report `b42b48585dece86633d4aa62e4c091a86c96b230715cf0645c1af27b8a5709ca` (run sheet M0–M11, re-dated to **Thu 5 from 08:05Z**); sign-offs `MA-OCT-002b.SIGNE_Report.md` and `MA-OCT-002b.SIGND_Report.md` (apply every condition they set); Main Lane RQ-2 ruling (Phase 2+3 keeps the counter).

**Preconditions:** both sign-off reports exist and neither is REJECTED for the step you run (skip only that step); rebase onto current `origin/October-2026` (≥ `f362131`), all suites green, commit + push. The Founder puts `CF_WORKERS_READ_TOKEN` himself at your M5 prompt (you check the name only with `wrangler secret list`). **Finish 002b before 013.RUN starts (target ≤ 17:30Z);** one change at a time; record every rollback id. After the deploys: B-2 subrequest measurement via the opt-in route; first heartbeat events land 201; drift sweep sees 5/5 schedules. Tell the Founder **"002b live"**.

**Standing rules:** Wrangler only `/usr/local/bin/wrangler` 4.96.0; pre-flight `wrangler whoami`. `claude/relays/FREEZES.json` (Thu 5: 05:50–07:10, 07:55–08:05, 10:45–11:15, 11:45–12:15, 16:45–17:15, 17:45–18:15, 23:50–00:10 UTC). **One production change at a time** across lanes (announce with UTC time in your report; check the other Thu lanes' reports first). Production steps end by 23:45Z. ML-1024-1; ML-1013-3. Explicit-path staging only (commit your own files, `pull --rebase`); never `git add -A`; never `September-2026`. Own worktree only. D1 writes guarded, batched, three-point check first.

Write `claude/packets/MA-OCT-002b.DEPLOY_Report.md`. Reply **"MA-OCT-002b.DEPLOY reported"**.
