# MA-OCT-REL.SITE — Report (LANE-1-ENG, Engineering Lead)

At 09:13Z Sat 31:
- Control `4c5b720f…efdb` and Task `4b4257a5…d526` were re-hashed. Both match, and so does the board row (line 103). The row shows the Founder's **"Approve go-live today"** (ML-1031-2) ✅.
- No `.git/*.lock`.
- Worktree `~/MeridianAtlas-work/rel-site/worktree`, fresh and detached at `origin/October-2026` = `ca15f70`.
- No D1 writes, no Worker deploys, no secrets read.

## Change log (UTC)
- 09:14Z: step 1 pre-checks (read-only).
- 09:15Z: step 2, the AC12 spread copy fix and its test.
- 09:16–09:20Z: step 3, build and local browser checks.
- 09:20:30Z: step 4, commit `98e830e` pushed. The Founder was asked to switch Pages.

## 1. Pre-checks ✅
- `origin/September-2026` = **`420487d`** (untouched).
- `origin/October-2026` ≥ `ca15f70` ✅.
- **No file under `docs/` or `App/` exists on September only.** Both branches carry `docs/.nojekyll`, and the October build keeps it.
- The release changes 4 of the 11 front-end files against September `docs/`: `index.html`, `ma-entities.js` (007 + 010), `ma-ops.js` (005) and `ma-data.js` (007). The other 7 are byte-identical.

## 2. 010 display notes (`claude/MA-OCT-008_AC12_Readjudication.md` §161–163)
- **Spread is shown in whole bp, so it must not read as exact:** fixed as a copy change.
  - Floating and fixed-to-floating rows now read "SOFR + **≈191** bp".
  - The bond detail adds "(spread rounded to the nearest basis point)".
  - New test in `fi-010-frontend` (now **71/71**). fi-009-worker 133/133, nav-007 58/58 + 39/39, retirement 77/77.
- **No "fixed for life" on reset notes:** already true. Fixed rows say "Fixed coupon" (spec §7.4), and the new test asserts the phrase never appears. No change was needed.
- **Known issues for November:** a source-exact spread needs a NUMERIC column (008, data change). Reset notes are still labelled plain "Fixed coupon" rather than "Fixed (resets)", because `rate_type` cannot distinguish them (data change).

## 3. Build and local checks ✅
`node generate-docs.mjs`:
- 11/11 files copied (the fixed list in `generate-docs.mjs`); `docs/` = `App/` byte for byte for all 11;
- `docs/.nojekyll` present;
- `docs/index.html` `86f4961f…`, `docs/ma-entities.js` `709f41d0…`.

**Browser.** Playwright is **not installed** on this Mac: no Node or Python package and no `ms-playwright` browser cache. Installing it means a download, so I didn't, and drove the installed **Google Chrome headless over the DevTools protocol** instead:
- one Node script (Node 24's built-in WebSocket) with a 127.0.0.1 static server inside it;
- throwaway profile, mock keychain, no macOS prompts;
- the script exits at the end, so no standing server was left.

Screenshots (22) and JSON are in **`~/MeridianAtlas-work/rel-site/`** (`local-*`, `baseline-sept-*`).

| View (1280 px and 375 px) | Console errors | CSP violations | Result |
|---|---|---|---|
| Terminal home | 1 pre-existing (see below) + local favicon 404 | 0 | ✅ renders |
| ETF Holdings launcher | 0 | 0 | ✅ |
| Corporate Atlas | 0 | 0 | ✅ |
| 007 instrument card `#/instrument/US5949181045` | 0 | 0 | ✅ |
| **Fixed Income** nav → `#/fi` directory | 0 | 0 | ✅ layer fits (1275/1275; 370/370 at 375) |
| → PepsiCo Inc (1457, CIK 0000077476) | 0 | 0 | ✅ **19 bonds, 0 Singapore rows** (`0001104659-24-022370`), no "Show more", ladder + "latest filing among the bonds shown 13 Oct 2026" |
| → bond detail `#/bond/0001104659-25-010139/1?from=entity:1457:1` | 0 | 0 | ✅ "4.400% Senior Notes due 2027", filer CIK 0000077476, candidate PepsiCo Inc · SEC filing · High 95, disclosure, SEC link |
| Ops → Cases tab → "Open operator console" link | 0 | 0 | ✅ `…/api/ops/admin/console`, `target=_blank rel=noopener`; the URL answers 302 to the Cloudflare Access sign-in, as designed |

**About the console errors:**
- The one error on home is `meridian-proxy …/?ipos=1` → **402**. It is not in this release's files, and the same proxy is live today.
- The September baseline home shows its own root 404. The baseline was run on live `https://navinmv1981.github.io/meridian-atlas/`, home, ETF and Corporate Atlas at both widths.
- **Nothing new is introduced by the release.**

**375 px.** Every navigation layer (instrument card, `#/fi`, issuer, bond detail) fits the 375 px width (layer scrollWidth = clientWidth). The **terminal header row** is the exception (known issue, below).

**Known issue (pre-existing, not fixed):** at phone width the terminal **header button row overflows**.
- The September site already does this: the document is 981 px wide at a 375 px viewport.
- The new "Fixed Income" button makes the row about 180 px wider: 1162 px.
- Making the header wrap would change every panel that is positioned under a fixed-height header. That is more than a copy/CSS fix-forward, so it is listed for November, not patched on release day.

## 4. Commit ✅
- **`98e830e`** on `October-2026`, pushed.
- Explicit paths: `docs/index.html`, `docs/ma-data.js`, `docs/ma-entities.js`, `docs/ma-ops.js`, `App/ma-entities.js`, `App/Corporate Atlas/tests/fi-010-frontend.test.mjs`.
- Nothing was committed to `September-2026`.
- The Founder was asked to switch Pages at 09:20Z.

## 5. Live checks — ✅ PASS on `https://navinmv81.github.io/meridian-atlas/` (09:33–09:35Z)
**Correction (09:33Z), my error.** The "Site not found" findings below came from polling the **wrong host**, `navinmv1981.github.io` (the e-mail name), not `navinmv81.github.io` (the GitHub account). The site was never down. Those findings are withdrawn and are kept only as a record of the mistake.

**Live:**
- All 4 changed files are byte-identical to `98e830e` `docs/` (`index.html` `86f4961f…`, `ma-entities.js` `709f41d0…`, `ma-ops.js` `f26862a0…`, `ma-data.js` `a28396cb…`).
- `last-modified` is 09:24:50Z, from the 09:24:58Z October build.
- The headless-Chrome checks re-ran on the live site at 1280 px and 375 px. Every result matches the local run:
  - 0 CSP violations;
  - the only console errors are the pre-existing ones (proxy `?ipos=1` 402; favicon);
  - **Fixed Income → `#/fi` directory**: "34 issuers · 632 bonds · 7 not linked yet";
  - **PepsiCo Inc (1457): 19 bonds, 0 Singapore rows**;
  - the bond detail opens; the instrument card renders; the Ops Cases tab shows the console link.
- Screenshots: `~/MeridianAtlas-work/rel-site/live-*`.

**Founder report at 09:32Z: "Fixed Income tab … when I click nothing happens."** This does not reproduce in a fresh browser.
- **Cause: browser caching across the switch.** Pages serves every file with `cache-control: max-age=600`, and `index.html` loads `<script src="ma-entities.js">` with **no version stamp**.
- A browser that loaded September shortly before 09:24Z can pair the new `index.html` (which has the `fiBtn` button) with its cached September `ma-entities.js` (no `openFixedIncome`). The click then throws a ReferenceError silently.
- **Fix for the Founder now:** a hard refresh (Cmd+Shift+R) or a private window. It also clears by itself within about 10 minutes.
- **Fix-forward proposal** (not applied; it is a markup change, beyond this packet's copy/CSS limit): add a release stamp to the 11 script tags (`ma-entities.js?v=98e830e`), so future releases cannot mix versions.

### (withdrawn) earlier, wrong-host findings
**09:27Z Founder report:** "deployed from October 2026 branch but … same as September … still see ops, no bonds page". The screenshot (09:27:12 GMT) shows the September header: no "Fixed Income" button.

**09:28–09:30:16Z findings** (read-only; public GitHub API plus cache-busted fetches):
- Every live URL, including `https://navinmv1981.github.io/meridian-atlas/` and `index.html`, `ma-entities.js`, `ma-ops.js` and `ma-data.js`, returns **HTTP 404, the GitHub Pages "Site not found" page** (9,115 B; identical hash `70d613e3…` for every file). Six polls from 09:28:35Z to 09:30:16Z.
- So the Founder's screen is a **browser-cached copy of September**. Nothing at all is being served right now.
- "Site not found" is GitHub's no-published-site page, not a missing-file 404 from our build.
- GitHub Actions, "pages build and deployment" (public API), shows the source being changed six times in 3 minutes:

| Created | Branch @ commit | Result |
|---|---|---|
| 09:21:56Z | `October-2026` @ `98e830e` | success |
| 09:22:39Z | `September-2026` @ `420487d` | success |
| 09:22:55Z | `October-2026` | success |
| 09:23:21Z | **`main` @ `33b777c`** | **failure** |
| 09:23:32Z | `October-2026` | success |
| **09:24:29Z** | **`October-2026` @ `98e830e`** | **success, finished 09:24:58Z** |

- **The latest deployment is the October build, and it succeeded, yet the site is not published.** That points at the Pages settings (publication or domain state), which only the Founder can see. Our `docs/` is not the cause.
- Step 5 checks are not run. No rollback is possible from this lane: Pages settings are Founder-only.
**Founder follow-ups (09:36–09:45Z):**
1. **Fixed Income click:** the Founder confirmed it was the browser cache. **Solved.**
2. **Ops page still public, and 3. exception queues not in the terminal:**
   - As built, this matches 005 as specified: Option B, Founder Q1, with the Ops tab kept read-only and the Cases and DQ tabs showing the sign-in launcher.
   - It also matches scope v2's Ops statement: "`ma-ops.js` remains the browser presentation layer … thin authenticated client"; workflow, state and audit in `meridian-ops` and D1.
   - Login exists: Cloudflare Access ("meridian-ops admin"), re-verified by the Worker, plus per-emitter keys for machine senders.
   - **The Founder expected the Ops surface to be fully behind the login, not a public panel.** That would be a scope change to 005.
   - Options given:
     - (1) the OPS button opens the signed-in console and the public panel is removed (recommended);
     - (2) keep System Health public and move the rest behind the login;
     - (3) keep it as built and redesign in November.
   - **The Founder is taking this to the Main Lane.**
3. **Bonds code under `App/Corporate Atlas/bonds/`:** by design (008 D8, folder CR `MA-OCT-008-CR1`). Understood by the Founder.

## 6. Record — **HELD by the Founder (09:45Z): "hold UAT, taking the summary to Main Lane, will revert".**
**Fact for the record, not yet written to `CLAUDE.md`:** GitHub Pages now serves `October-2026` `/docs` at `98e830e`. This is verified byte for byte on `https://navinmv81.github.io/meridian-atlas/`, with last-modified 09:24:50Z. Pages build history: the source was switched at 09:21–09:24Z. A `main` build failed at 09:23Z; this was an intermediate source setting, and the final setting is `October-2026` `/docs`.

**Still to do when the Founder reverts:**
- update the `CLAUDE.md` DEPLOY_BRANCH line and commit it by path;
- the "site live — ready for UAT" message and its UAT list.

**Rollback** stays available: Pages → `September-2026` `/docs` (`420487d` untouched).

**Main Lane instruction (09:48Z):** record `October-2026` as the live Pages source now and announce "site live — ready for UAT". UAT covers the release as built, including the Ops console. The Ops design change is a separate Main Lane decision and packet, and **Ops is not changed in this packet**.
- 09:49:11Z: live re-verified. **11/11 files byte-identical** to `docs/` at `98e830e`; `/.nojekyll` returns 200.
- 09:49:29Z: **`a3e3f1f`** pushed. It changes only `CLAUDE.md`, the DEPLOY_BRANCH line:
  - now `October-2026` `/docs`, dated and citing this packet and ML-1031-2;
  - rollback source `September-2026` `/docs` at `420487d`;
  - notes on the host name (`navinmv81`) and the 10-minute cache;
  - the previous text kept as history.
- **"site live — ready for UAT"** was announced to the Founder with the UAT list.
- **Packet complete.** No D1 writes, no Worker deploys, no Ops change. Commits: `98e830e` (release) and `a3e3f1f` (record).
