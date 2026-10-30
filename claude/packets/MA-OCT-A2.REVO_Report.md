# MA-OCT-A2.REVO — Report

```text
CONTROL:      MA-OCT-A2.REVO Control v1, SHA-256 2b1d2d5d0e782fe32259c49160244e2c1eb4c85079a707703a33a7cb27f126aa (matches STATUS_BOARD row 84)
TASK:         v1, SHA-256 ef148793639452abfa4124504409e951c578b8b12123122c39dd6610d77a869f (matches the Control)
EXECUTED BY:  Operations Lead (LANE-1-OPS, Cowork). Doc-only: 0 D1, no deploys, no git writes, no secrets.
DATE:         Thu 29 Oct 2026, about 07:22 UTC
VERDICT:      PASS WITH NOTES
FINDINGS:     0 BLOCKER · 6 MUST-FIX before the run · 10 NOTE
```

## Preflight

- No `.git/*.lock` files. HEAD = `origin/October-2026` = `acfd069`; 011 code commit `58cd922` present.
- Spec rev 0 `226d07db…842d` ✔.
- `FREEZES.json` is `9c368fa6…e829` (the spec pins the earlier `b6d035f6…`; N-1).
- **Independence:** this session wrote neither the A2 spec nor the 011 code.
- The Control header says "issued 07:30Z", later than this session's clock (07:18Z at start). Recorded only.

## Output

| File | SHA-256 |
|---|---|
| `claude/MA-OCT-A2_Ops_Review.md` | `883e1760dc50fdc378e9c5e0bd3df61c74c7137195708c5c880b300519a47c9e` |
| `claude/packets/MA-OCT-A2.REVO_Report.md` | this file |

## MUST-FIX (summary)

1. **M-1, freeze mechanism.** The enrich cron (06:00/06:50Z) ignores FREEZES.json. Its only stop, `hold_all_jobs`, is global and would also stop A2. 011's identical freeze did not stop it.
   - **Enrich:** one triggers-only change off before Sat 06:00Z, restored Sun ≥ 08:05Z with version ids recorded. **Ops recommends this;** the alternative is a Founder re-rule.
   - **Boost:** pause flag + `ops_job_pause` row 2 (authorised).
2. **M-2, pair Q with A** on the same day, so the 25k cap or a short Sat never leaves applied A rows with `pending` queue rows for enrich to pick up. The alternative is a runner cap reservation plus an extended freeze.
3. **M-3, R-4 applies:** Fri recon by 23:30Z; Ops sign-off before Sat's first batch (by 08:00Z); no `--outbox-live-confirmed`.
4. **M-4, job and key:** `manual.gleif-reconcile-a2`, emitter `gleif-a2`, `expected_max_duration_s = 900` (the deploy-4 sweep's `job_lost`).
   - **K-3 before:** `boost-local`, `health-check-local`, `local-bonds`. **After:** + `gleif-a2`.
   - **K-4 evidence**, and the put as its own step after deploy 4 and the 004 deploy. K-5 at close. **Authorised for LANE-1-ENG.**
5. **M-5, control scripts:** `status.sh` and `stop.sh` default to the 011 work dir, where `stop.sh` can't find the A2 pid and `status.sh` shows 011's E-4 holds. Use one `a2.env` sourced by every command, with `status` printing the work dir and job.
6. **M-6, restore calendar:** no A2 write or restore on Sun 1 (holdings ≈ 70k + ≈ 32k > 100k). Per-batch restores Fri/Sat only. A full rollback is a Founder decision that moves 013.

## For the Main Lane

- Fold M-1 to M-6 into spec rev 0.1 or the A2 run sheet; a hash check is enough.
- Issue Ops packets for:
  - the **Fri pilot spot-check** (read grant to `gleif-a2/adjudication/`);
  - the **Sat OPS-R10 release file**;
  - a **standing R-4** for Fri 30 / Sat 31 (as RECOND), with write grants to `gleif-a2/recon/` and `gleif-a2/holds/`.

**Stop point:** both outputs written.
