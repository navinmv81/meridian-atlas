# MA-OCT-SAT24.ENG1 — Report

**Lane:** LANE-1-ENG, Engineering Lead (Claude Code). **Date:** Sat 24 Oct 2026.
**Opening checks (08:16 UTC):**
- Control `73a02a06…5eb1` matches the board row, which shows the **Founder's Sat 24 go-live approval (given Fri 23)**.
- Task `34d00e46…572f` matches the Control.
- Governing documents found by hash: CLOSEREV-OPS `408948c2…`, A6R `76fe7e01…`, 002a report `7996e98c…`, BREVA `36546418…`.
  - **Note:** `7996e98c…` is the shared checkout's 002a report, which predates the Thu 22 section with C0–C6. That section is on origin in `7330a7f` and in the A6 worktree, and was followed from there.
- No `.git/*.lock`.
- **Pre-flight token refresh:** `wrangler whoami` at 08:17:10Z. Logged in, account `ea360704…`, before the first remote call.

## Step 1: Boost resume ✅ (08:17:00Z)

- **Timing deviation:** the Task's slot was 07:15–07:50 UTC; this session started at 08:16. The resume ran at **08:17:00Z**. That is inside CLOSEREV-OPS §4b's authorised window (07:15–10:40 UTC), outside every freeze, before K-5, and before the first boost slot of the day (10:50Z).
- **No missed slot:** none passed between row 1's expiry (00:00Z) and the resume.
- **Before:**
  - `.entities-enrich-boost-paused` was present ("paused at 2026-10-16T18:32:46Z").
  - LaunchAgent `com.meridianatlas.entities-enrich-boost` was loaded.
  - The last log lines were the two `paused` no-ops of Fri 23 (10:50, 16:50).
- **Command:** `"App/Corporate Atlas/scripts/entities-enrich-boost-resume.sh"`, which printed "Resumed. Pause flag removed".
- **After:** the flag is absent, the agent is still loaded (no launchctl or plist change), and both outbox files are empty (0 bytes).
- **The first live fire (10:50Z)** is verified in step 6.

## Step 2: K-5, retire the `gleif-011` ingest key ✅ (Ops choice: remove)

| | |
|---|---|
| `meridian-ops` before | `9d437dd1-e3ec-4841-887a-1989bea49303` (the T12 put, 15 Oct) |
| Precheck (08:17:48Z, 0 D1) | `boost-local` 400, `health-check-local` 400, `local-bonds` 400, `gleif-011` 400 (all accepted); a random key under `gleif-011` → 401 |
| Put (08:18:00Z) | One `wrangler secret put OPS_INGEST_KEYS --config wrangler-ops.toml`, the JSON on stdin, built from the T12 canonical map (`f1840595…6520`, unchanged and kept as the rollback source) minus `gleif-011`. The script first checked that each key file's hash equals its canonical entry. |
| Before → after (names, hash prefixes) | `boost-local=9613478a`, `health-check-local=996a3312`, `gleif-011=c3d7471e`, `local-bonds=0985ac0a` → `boost-local=9613478a`, `health-check-local=996a3312`, `local-bonds=0985ac0a` |
| **`meridian-ops` after** | **`3c88f8d2-84f5-4d14-9021-45cda6eee351`** ("Secret Change", 08:18:01Z) |
| Verify (08:18:15Z) | **`gleif-011` (old key) → 401**; `boost-local` 400, `health-check-local` 400, `local-bonds` 400 (still accepted); random → 401 |
| New canonical map (hashes only, 600) | `~/MeridianAtlas-work/sat24/ops-ingest-keys.canonical-map.k5.json` |

- **Optional item, done as Ops recommended (08:19:01Z):** `ops_job_registry.ingest_enabled = 0` for `manual.gleif-reconcile-011`.
  - Executed as one guarded UPDATE plus an `ops_case_event` row (event **19**, key `registry:manual.gleif-reconcile-011:ingest_enabled:0:sat24`).
  - Batch `~/MeridianAtlas-work/sat24/k5-ingest-disable.sql` SHA-256 `26efe3cc…e574`; rows_read 18, **rows_written 5**.
  - `d1-today` gate before it: 26 account writes today.
  - Read-back: `ingest_enabled 0`; the row is kept as history.
- **Key file:** the R-2 retention manifest (`~/MeridianAtlas-work/gleif-011/closeout/retained-rollback-inputs.json`, `ca6d6cc8…5a28`, hash verified) **does not list** `ops-ingest.env`. After verification passed, `~/MeridianAtlas-work/gleif-011/ops-ingest.env` was confirmed as the `gleif-011` key (hash `c3d7471e` = canonical) and **deleted**. No key value was printed.
- **Rollback, if ever needed:** re-put the 4-hash T12 map, or `wrangler rollback` to `9d437dd1`. Restoring the key itself is impossible (the file is deleted), so a rollback would need a fresh key, which is the K-1 path A2 needs anyway.

## Step 3: A6 deploy ✅ (R-A6-1 order: AUD committed first, one `meridian-control` deploy)

**C0 (08:19:22Z):**
- The A6 worktree (`~/MeridianAtlas-work/a6-worktree`) is clean at `7330a7f` = `origin/October-2026`, with nothing new on origin (A6R N-2).
- **`meridian-ops` rollback target: `3c88f8d2`** (post-K-5).
- **Live pre-split capture** saved to `~/MeridianAtlas-work/a6-live/pre/`. Each of the 4 GETs returns 200 with ACAO `*`:

  | GET | Bytes | SHA-256 prefix |
  |---|---|---|
  | `sprint-board` | 92,564 | `9d77d1d962e1` |
  | `release-ledger` | 15,413 | `1452db7ba46b` |
  | `events` | 2,800 | `08df72ed7c56` |
  | `drift` | 40 | `0669f0eacee2` |

**AUD commit (08:20:43Z):**
- The Founder pasted the "meridian-control admin" AUD in chat (`22fad8a2…81f4`; an identifier, and it differs from `meridian-ops`'s `7f1b6784…`).
- Committed to `App/Ops/wrangler-control.toml` (explicit path) from the worktree as **`ccff23b`**, and pushed as a fast-forward with `git push origin HEAD:October-2026`. Origin was checked unchanged first.

**C1: the one `meridian-control` deploy (08:21:01Z):**
- **Version `c442209c-ccaa-41a1-bfc8-9a31223d1d3d`**, the first ever. The rollback is to leave it unused (§13).
- Checks at 08:21:18Z:
  - The 4 GETs → 200, ACAO `*`, **bodies byte-identical to the C0 capture**.
  - An ops route (`budget-risk`) → 404.

**C3: auth (partial, by the Founder's choice):**
- The admin path without a session → **302 to the Access login "Log in to meridian-control"**. The app is in front of `/api/ops/admin`; with a forged `Cf-Access-Jwt-Assertion` and no Access cookie the result is also 302.
- The 4 legacy anonymous POSTs → 401.
- **The authenticated missing-field POST → 400 check was skipped.** The Founder chose "Skip the session check" when asked to sign in in the browser pane. So the vendored JWT verification against the new AUD is **not yet proven live**. It is proven locally (A6 test, 100/100). **Carry-over:** the first time the Founder or the 005 console uses `meridian-control`'s admin routes, a 400 on a missing-field POST (or a 2xx) confirms it. A 401 "iss/aud mismatch" would mean the AUD or team domain needs checking.

**C4: deploy `meridian-ops` (A6) from the worktree (08:22:55Z):**
- Before deploying: the tree has 0 references to 003 (`cases.js`, `sweep-ext`, `OPS_CASES`, `OPS_SERVICE_ACTORS`). BREVA S-3 principle.
- **Version `fffe9f9f-579b-4b60-ac12-b6a728eb24e2`** (before: `3c88f8d2`).
- Checks at 08:23:16Z:
  - The 4 moved GETs → **302**, Location = the same path (and query) on `meridian-control`, ACAO `*`, `Cache-Control: no-store`.
  - Followed (`curl -L`): 200, ACAO `*`, **bodies byte-identical to C0**.
  - `budget-risk`, `openfigi-status`, `cf/d1-today` and `cf/invocations?script=meridian-control` → 200.
  - `d1-today`: 31 account writes.
  - `admin/jobs` without a session → Access (302).
  - Legacy POSTs → 401.
  - **Ingest secrets survived the deploy:** `boost-local`, `health-check-local` and `local-bonds` → 400 (accepted); random → 401.

**C5: live site (AC-a6), 08:24–08:25Z:**
- Opened `https://navinmv81.github.io/meridian-atlas/` (the September-2026 `/docs` build, so `ma-ops.js` is unchanged) in the built-in browser, with OPS → each tab.
- **Each tab renders live data through the redirect:**
  - Sprint Board, 19 tickets;
  - Release Ledger, 12 releases (13 table rows);
  - Event Timeline, last 13;
  - Drift & Budget.
- The browser's resource entries show the `meridian-ops` GETs ending in 200 (the 302 was followed).
- **No CORS or console errors** from the Ops tabs. The only console error is the existing `meridian-proxy ?ipos=1` 402 (home-screen module, not A6).
- Screenshot taken.

**Production deploys today:** 2 (C1 control, C4 ops). That leaves 1 for 003's deploy 3, within the 3-deploy cap (R-A6-1). Plus the K-5 secret put (a version change, not a code deploy).

## Step 4: "A6 live — LANE-8-ENG may start" ✅

Told the Founder in chat at ≈ 08:26Z, with the versions: `meridian-control` `c442209c`, `meridian-ops` `fffe9f9f`, rollback `3c88f8d2`.

- **For LANE-8-ENG:** `origin/October-2026` is at **`ccff23b`** (A6 + the AUD commit). The shared checkout is still at `c3c6e4a` with 003's uncommitted work. The rebase is stash / `merge --ff-only origin/October-2026` / pop (preview on Thu 22: 0 conflicts).
- **BREVA S-3 still applies to deploy 3** (A6R N-4).

## Step 5: Commits

- `ccff23b` (the AUD, part of step 3) is the only commit.
- This report is **not committed**; it waits for the Main Lane's commit list (ML-1012-2 / ML-1023-1).

## Step 6: First boost fire ✅ (checked 11:21Z, after the 10:45–11:15 freeze)

- **Run log:** `2026-10-24T10:53:56Z | fired | utc_minute=53 in_window=true writes_today=41 headroom=99959 … response={"ok":true,"message":"Enrichment triggered"}`. That is the first live fire since the 16 Oct pause, with real `writes_today`.
- **Heartbeats:** `start` and `success` (run_id `61c288a7-281d-44bb-980c-ad76e5def01a`), each **HTTP 201 `recorded:true`**. They were delivered to the post-A6 `meridian-ops` `fffe9f9f`, so the `boost-local` key and the ingest route survived both K-5 and the A6 deploy.
- **Outbox:** `entities-enrich-boost.jsonl` and `health-check.jsonl` are both 0 bytes (empty). The flag is still absent.
- **The lateness view** (slot `on_time`, 17–23 Oct `paused`) is read through the Access-only `admin/jobs`. It was **not checked**, because no session was available (the same reason as C3). The Operations Lead can confirm it from the console.

**Packet result:** all steps are done. C3 is partial (the Founder skipped the signed-in check). **Stop point reached.**

**For the Main Lane:**
- (a) Commit this report from the commit list.
- (b) FREEZES.json needs the DST update for Sun 25 (boost bands move to 11:45–12:15 / 17:45–18:15 UTC; CLOSEREV-OPS §4b).
- (c) The C3 signed-in check is still open.
- (d) The A6 worktree stays until LANE-8-ENG's rebase is confirmed. Then `git worktree remove ~/MeridianAtlas-work/a6-worktree`.

## Budget

- **D1:** 5 row-writes (ingest disable); reads: 18 + 2 read-backs, plus the verification GETs through the Workers.
- **Production changes, each in its own minute:**
  1. boost flag removal, 08:17:00;
  2. K-5 secret put, 08:18:00 (→ `3c88f8d2`);
  3. D1 ingest disable, 08:19:01;
  4. `meridian-control` deploy, 08:21:01 (`c442209c`);
  5. `meridian-ops` deploy, 08:22:55 (`fffe9f9f`).
- **Git:** `ccff23b`.
