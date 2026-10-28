# Sat 24 Oct — Founder go-live checklist

*Main Lane, Fri 23 Oct. All times BST (UTC+1). Answer "Yes" to Claude Code prompts; answer "No" to any Mac password or system-permission prompt and tell the Main Lane.*

## Before you start
- Reply **"Approve Sat 24 go-live"** to the Main Lane (covers 002 CR-1 `meridian-control` and 003 go-live). The lanes refuse to start until it is on the board.

## Morning
| Time (BST) | Where | What |
|---|---|---|
| 08:15 | LANE-1-ENG | Paste the ENG1 line. It resumes the boost job, then retires 011's temporary key. |
| any time before 10:00 | Cloudflare Zero Trust (browser) | **1. Create the Access application "meridian-control admin"** for the `meridian-control` Worker hostname the lane gives you (same policy as the existing meridian-ops admin app). Copy its **Application Audience (AUD) tag** and paste it into LANE-1-ENG. |
| when LANE-1-ENG asks | Browser | Check the Ops tabs on the live site still load (it will tell you which). |
| when LANE-1-ENG says "A6 live" | LANE-8-ENG | Paste the ENG8 line. |
| when LANE-8-ENG asks | Cloudflare Zero Trust | **2. Create service token "ops-script"** (don't add it to any policy yet). Give the lane the **Client ID only** (keep the Client Secret in `~/.meridian-secrets/`, never in chat). |
| when LANE-8-ENG asks | Cloudflare Zero Trust | **3. Block the old `/exceptions` Access app** (set its policy to Block). |
| when LANE-8-ENG says checks passed | Cloudflare Zero Trust | **4. Add "ops-script" to the meridian-ops admin policy.** |
| when asked | LANE-8-ENG | **5. Pick one open case** for its two live checks. |

## Afternoon / evening
- After 18:15 BST the lane confirms the evening sweep; paste both lane reports to the Main Lane.

## Not on Saturday
- 003 sweep deploy, retiring the old exceptions code in the Entities Worker, and the **007 front-end release** → Mon 26.
