# MA-OCT-REL.SITE — Task v1 (immutable): October site release (front end) — gated on the Founder's "Approve go-live today"

Governing: Option C (ML-1025-5); ML-1026-1 (Pages serves `September-2026`/docs; the October front end ships as one release); 009 code review M-2 (release only with gated R1f live — **met**: `meridian-entities-api` `4e7ee20b`, gate open 30 Oct 21:21Z after AC12 PASS); `Claude.md` §DEPLOY_BRANCH; `generate-docs.mjs` (docs/ is generated, never hand-edited). Live services today: `meridian-ops` `1109edb6` (005), `meridian-entities-api` `4e7ee20b` (009), `meridian-proxy` `9253b611`.

**Rollback (any time, minutes):** the Founder switches GitHub Pages back to `September-2026` / `/docs` (commit `420487d` is untouched). No Worker changes in this packet.

Do in order:
1. **Pre-checks (read-only):** `origin/September-2026` is still `420487d` and has nothing that `October-2026` lacks under `docs/` or `App/` that matters (list any file present on September only, e.g. `.nojekyll`, and make sure the October build keeps it). `origin/October-2026` ≥ `ca15f70`. No `.git/*.lock`.
2. **010 display notes** from `claude/MA-OCT-008_AC12_Readjudication.md` (spread shown in whole bp — label it as rounded; no "fixed for life" label on reset notes): fix only if it is a label/copy change with a test; otherwise list as known issues for November. No data or Worker change.
3. **Build:** in a fresh worktree from `origin/October-2026`, run `node generate-docs.mjs`; confirm the fixed 11-file list, `.nojekyll`, and that `docs/` matches `App/` per the generator. Serve `docs/` locally (static server in your worktree) and run headless Chromium (Playwright is installed) at **1280 px and 375 px**: no console errors and no CSP violations on the terminal home, an ETF view, Corporate Atlas, a 007 instrument card (`US5949181045`), the **Fixed Income** nav → `#/fi` directory → PepsiCo Inc (1457) bonds (19, no Singapore rows) → one bond detail, and the Ops console page link. Screenshots to `~/MeridianAtlas-work/rel-site/`. Fix-forward only copy/CSS issues; anything bigger → stop and report.
4. **Commit** `docs/` (+ step-2 files) by explicit path on `October-2026`; push. Then tell the Founder in chat, exactly:
   > **Ready for the switch.** GitHub → repository → **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `October-2026`, folder `/docs` → Save.** Reply "switched" when done.
5. **After "switched":** wait for the Pages build (poll the live site's `index.html` until it matches the committed `docs/index.html`, ≤ 10 min), then repeat step 3's checks **on the live site** (incl. 375 px). Any blocking error → tell the Founder to switch back to `September-2026` /docs, and report.
6. **Record:** update `Claude.md` DEPLOY_BRANCH to `October-2026` /docs (dated, citing this packet) and commit by path. Tell the Founder **"site live — ready for UAT"** with a short UAT list: Fixed Income nav and PepsiCo bonds; a 007 instrument card; Ops console (sign in) — dismiss test ticket **DQ-000036**; ETF pages unchanged; one phone-width look; Safari + Chrome.

Standing rules: no D1 writes, no Worker deploys, no secrets; ML-1024-1; ML-1013-3; explicit-path staging only, never `git add -A`; **never commit to `September-2026`**; own worktree only. Sunday 04:00–07:05Z holdings freeze does not apply (front end only), but avoid starting step 5 inside it.

Write `claude/packets/MA-OCT-REL.SITE_Report.md`. Reply **"MA-OCT-REL.SITE reported"**.
