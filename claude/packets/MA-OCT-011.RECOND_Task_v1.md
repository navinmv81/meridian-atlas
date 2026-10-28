# MA-OCT-011.RECOND — Task v1 (immutable): standing daily R-4 sign-off for the 011 run (supersedes the single-day RECON17 pattern)

**ISSUED BY:** Main Lane, Sun 18 Oct · **EXECUTED BY:** LANE-1-OPS, Operations Lead (ML-1018-1)

**Step 0 (now):** write `~/MeridianAtlas-work/gleif-011/recon/2026-10-17/ops-signoff.json` with exactly the content in your RECON17 report (`585bba213ef4fb29a4955eb967b878f2a12e0de9f8db440cd12d3eb0fc1adcb9`), adding `"source_sha256":"585bba213ef4fb29a4955eb967b878f2a12e0de9f8db440cd12d3eb0fc1adcb9"`. Read it back and record its SHA-256.

**Each later run day D (Mon 19, Tue 20, Wed 21, Thu 22),** when the Founder says `continue <date>`, by 09:00 UTC the next calendar day (Thu 22's by Fri 23 09:00 UTC):
1. Repeat the RECON17 checks on `recon/<D>/` and the RUN report's day section: every run-log line ↔ Ops end event; writes ≤ 25k by 011 and the 60k account gate (refusals recorded, not stops; S-3); each batch ≤ 1.3×; no batch in a freeze; reads cumulative ≤ ceiling and ≤ 200k/day; mismatches (incl. the new duplicate-LEI check) within the stop rule; C-1/C-2 handling if triggered; outbox empty.
2. For Thu 22 (edges) also confirm the E-A/ECA release was issued only under OPS-R10's four conditions.
3. Append a day section to `claude/packets/MA-OCT-011.RECOND_Report.md` and write `recon/<D>/ops-signoff.json` (`date`, `signed_by`, `result` MATCH / RECONCILED / NOT SIGNED, `source`, `source_sha256`).
4. If NOT SIGNED: say why in one line; the runner then refuses the next day's first batch.

OPS-R11 stands: `--outbox-live-confirmed` must not be used to skip this check during the window.

Writes allowed: `claude/packets/MA-OCT-011.RECOND_Report.md` and `recon/<date>/ops-signoff.json` files only. Read access to `~/MeridianAtlas-work/gleif-011/recon/` and the RUN report. Reply **"MA-OCT-011.RECOND <date> signed"** (or NOT SIGNED).
