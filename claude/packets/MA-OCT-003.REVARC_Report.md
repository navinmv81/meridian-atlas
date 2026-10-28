# MA-OCT-003.REVARC — Report: Architect review of MA-OCT-003 and MA-OCT-004 specs (rev 0)

**Control v1** `8c50d402567b2a16914eef0292499db9f1c159bd34ba8cabd15fc73824fb3572` (matches STATUS_BOARD.md row 32)
**Task v1** `e00f51bf17ef2139bfac3cba3816e221861e5a914399a07ba6de56c51b44799d` (matches the Control)

```text
REPORT TO:    Main Lane
FROM:         REVIEW-A, Architect (+ ETF PL read), Sat 17 Oct 2026 (~08:30 UTC)
EXECUTED ON:  Founder's instruction to execute
VERDICT:      MA-OCT-003 rev 0: PASS WITH NOTES. 7 required changes (A3-1..A3-7), all doc-only, in rev 1 before the build starts Mon 19.
              MA-OCT-004 rev 0: PASS WITH NOTES. 4 required changes (A4-1..A4-4), doc-only, in rev 1 before the build starts Mon 26.
              The design is sound in both. The main defects are the calendar (N-3), one dangerous line-number instruction, and two audit holes.
```

## 1. Preflight and inputs
- Branch `October-2026`, HEAD `0dd7ef0`. No `.git/*.lock`. Git read with `--no-optional-locks` only. 0 D1, no deploys, no git writes. No secret file opened. No command that could raise a macOS prompt was run.
- **Independence:** REVIEW-A did not author 003, 004 or their inputs (author: LANE-3, Operations Lead).

| Input | SHA-256 (as found) | |
|---|---|---|
| `claude/MA-OCT-003_Spec.md` rev 0 | `8fb129ac00909aecbbd4065f05895ba88808614352f46eb8499679fd74a0ed91` | ✔ Task |
| `claude/MA-OCT-004_Spec.md` rev 0 | `c3d0cd3e1ddfc02a5eeb48101eabe5f2aebbfd93dbc47df96ace15c5b51c0889` | ✔ Task |
| `claude/packets/MA-OCT-003.SPEC_Report.md` | `064f73bf22b458899c3a0b0352feb7180329e9374f561750e8a561cc5565837a` | as found |
| `claude/packets/MA-OCT-003_ReadPack_Results.md` | `93a8d4349954b85a8123e84c21fb26bc10328c36d3352271e2a1e20995f2af99` | as found |
| `claude/MA-OCT-002_Spec.md` rev 1.3 | `9ec6773a2cf8be3ca855f1583bef148146d0ee6ae42a875407fc20dbfef23893` | ✔ rev 1.3 |
| `claude/October_Decisions_Log.md` | `865f4a832cd6e67db29ab0e452903f4e3fe7978d88c771d83047aa41c8ae27aa` | as found (includes ML-1017-1) |
| Repo, read-only | `App/Ops/src/ops-api.js` `c77973de…7f19` (= spec App. C); `App/Ops/migrations/002-ops-control-plane.sql`; `App/Corporate Atlas/src/entities-api.js` **`fac446bf…e245`** (≠ spec App. C `19993e84…e2f6`; see A3-2) | |

## 2. Tables and Workers (item 1: boundaries and ownership)

| Spec | Writes | Reads | Workers | New table / domain |
|---|---|---|---|---|
| 003 | `ops_exception`, `ops_case_event`, `ops_data_quality_ticket` (M1), `ops_job_registry` (R-8): all Ops | `entity_exceptions` (9 rows), `entity_enrichment_queue` (E2, ≤ 50, index): **Entities, read only**; `ops_job_run`, registry | `meridian-ops` (routes, sweep); `meridian-entities-api` (code **removal** only); `meridian-control` (A6 prerequisite) | None. Index `idx_ops_dq_linked_exc`, Ops. |
| 004 | `ops_data_quality_ticket`, `ops_dq_ticket_member`, `ops_case_event`: Ops | `ops_exception`; build checks B1/B2 read `entity_isin_map` / `entity_master` (Entities, read only, ≤ 104 rows, index/PK) | `meridian-ops` | **`ops_dq_ticket_member`: Ops domain, declared** (§6), owner Operations Lead, writer `meridian-ops` + reviewed seeds |

- **No cross-domain writes. No ETF table is read or written by either spec** (ETF PL: no objection; ETF screens untouched, and 007's button only builds a URL, 004 AC-16).
- Entities fixes stay in Data-Identity Lead packets after 24 Oct (004 §3) ✔. The Ops-reads-Entities rows (E2, B1, B2) are read-only and index-backed ✔ (RQ-4 accepted).
- **Cron:** no new cron trigger. The sweep runs from the existing `local.health-check` LaunchAgent. Slots stay 5/5 ✔.

## 3. Three-point check (item 2)

| | 003 | 004 |
|---|---|---|
| Index audit | Every query is a `SEARCH` or a declared bounded scan. E3 was correctly dropped from automation (≈ 66k reads). **Exception: S2's bound is not argued (A3-4).** | All `SEARCH`, PK or unique probes ✔ |
| Single execution < 50k | Max ≈ 1,000 (sweep) ✔ | Max ≈ 500 (C-1 / resolve check) ✔ |
| Budget per invocation and per day | Steady ≤ 150 writes/day, ≈ 7k reads/day; one-time ≈ 175 ✔ | Steady ≤ ≈ 600 writes/day, ≈ 3k reads/day; one-time ≤ 900 ✔ |

Both specs make every remote step read `d1-today` against the F-5 60k ceiling and avoid the FREEZES windows ✔.

## 4. MA-OCT-003 — required changes (rev 1, before Mon 19)

**A3-1. Re-plan the build under N-3 (ML-1017-1).** §0 item 3 and 9, §5, §13 P0 ("must ship by 23 Oct"), §16 (Tue 20 and Wed 21 `meridian-ops` deploys; "Mon 19 starts with A6"), and CR-003-1 Impact ("`meridian-ops` 2–3 deploys, 20–21 Oct") all conflict with N-3. N-3 bars any `meridian-ops`, Entities Worker or `OPS_INGEST_KEYS` change 17–23 Oct, and ML-1017-1 already records "A6 … blocked by N-3 until Sat 24; 003 build can code and test locally from Mon 19, deploy from Sat 24". Rev 1 must say:
- **Mon 19 – Fri 23: local only.** `wrangler dev`, `node:sqlite` tests 1–4, migrations `--local`, M1 test 2 against the 015b/015c files, and the retirement commit (own commit).
- **No remote deploy of `meridian-ops` (A6 or 003), no `entities-api` deploy and no secret change before Sat 24 08:05 UTC.**
- **D1-only remote steps** (`004-ops-cases.sql`; the Access Block, M1 and M2 on Thu 22) are not Worker changes. In the Architect's view they may run in the window under F-5 and FREEZES, **but the Main Lane must rule this explicitly**. Otherwise they move to Sat 24, ahead of the retirement deploy.
- **Order from Sat 24, one owner (LANE-1-ENG), C1 deployed = repo and the previous version id recorded before each deploy:** A6 (`meridian-control` + `meridian-ops` without governance routes; Founder creates the "meridian-control admin" Access app beforehand) → AC-a6 → 003 routes deploy → AC-1/AC-16 → `entities-api` retirement → AC-14/AC-15. The **sweep extensions deploy separately, on a later day**, after one observed sweep on the route deploy. At most 3 production deploys on Sat 24. Not on Sun 25 (FIRDS / seed day and the UK clock change).
- 004's Mon 26 start then depends on this (A4-1).

**A3-2. Remove the line-number delete instruction in R-2 (and §0.1).** `entities-api.js` changed after the spec was read: 007.P1 `0dd7ef0` is live as `73851c02`, and the file hash is now `fac446bf…e245`. **The spec's "lines 547–672" now hold 007's live R1 `GET /api/instruments/:key` code**, and the `/admin/exceptions` residue has moved, to `checkAdminExceptionsAuth` at about line 912, the handlers at about lines 916–1030 and the dispatch at about lines 1631–1648. Deleting by the cited lines would break 007 in production. Rev 1:
- name R-1/R-2 targets **by symbol** (`checkAdminExceptionsAuth`, the three `entity_merge_exceptions` handlers, the `/admin/exceptions` dispatch, `verifyAccessJwt`, the `/exceptions*` dispatch and `entityExceptionsUiHtml`), never by line;
- add **007 R1–R4 (`/api/instruments/*`) to the R-9 / test 4 / AC-14 smoke set** alongside `/api/entities/*`;
- R-4 keeps `GET` (007 routes);
- D-4 notes that the retirement commit builds on `0dd7ef0`.

**A3-3. Close the two audit holes ("every change leaves one event", Goal 1).**
- **(a)** §8.4 (lines 210–229): for status-preserving actions (`comment`, `assign`, `set_severity`), a replayed or reused `request_id` passes statement (1), and the event is then dropped by `INSERT OR IGNORE` on `idempotency_key`. The result is a state change with no audit row. Add `AND NOT EXISTS (SELECT 1 FROM ops_case_event WHERE idempotency_key = 'act:' || :request_id)` to (1). Add an AC: a reused `request_id` with a different action gives 0 changes.
- **(b)** §9.4: `idempotency_key = 'autoresolve:' || case_ref` collides on a second auto-resolve after a reopen, so the `UPDATE` applies and the event is ignored. It would also immediately re-close a case a human just reopened. Fix: key `'autoresolve:' || case_ref || ':' || :now`, the same `NOT EXISTS` guard, and **skip any case that has a `reopened` event**.
- Also correct the line "concurrent comments also serialise on `updated_at`". They do not, because (1) does not test `updated_at`. That is harmless, but the text is wrong.

**A3-4. Bound S2 (§9.1, lines 244–251).** `idx_ops_exception_job` is `(job_id, opened_at)`, so S2 reads **every** case of the job in every status. The "≤ about 50 a year" bound is not supported: `job_failed` per run and `job_missed` per slot for the boost alone can reach hundreds a year, so S2 grows without limit and erodes the sweep's ≤ 1,000 cap. Fix: add to `004-ops-cases.sql` an additive `idx_ops_exception_job_cond(job_id, exception_type, status)`, and restrict S2 to the 6 condition types. Update §11.1 (+1 index row per insert and status change) and AC-16 (S2 measured).

**A3-5. CSRF on E-2 and C-2.** `ops-api.js` parses `request.json()` (line 93) without checking `Content-Type`. A cross-site `text/plain` form POST carrying a JSON body would therefore be parsed if the Access cookie travels cross-site. Adopt 004 §8.4's rule in 003 itself: `Content-Type: application/json` **and** `X-Ops-Client`, otherwise 400 before any D1 access. Add it to AC-1. The existing 001 governance POSTs move to `meridian-control` with A6 and are out of scope (note for 002b).

**A3-6. Secret retirement paths (Task item 4).** T12 moved `.env.admin-exceptions` to `~/.meridian-secrets/admin-exceptions.env` (mode 600; T12 Report). The repo copy is gone, and `git log --all` shows it was never committed. Rev 1 changes:
- **R-7 and AC-15** delete it at the new path, as a local-lane step with Founder approval (it is outside the Cowork folder).
- R-6 (`wrangler secret list` names only, then delete) stays Sat 24 after AC-14 ✔.
- The §10.3 dumps hold identities. `App/Corporate Atlas/logs/` is gitignored ✔, but the folder is on the Desktop, so either write them under `~/MeridianAtlas-work/` (RA-13 K-2 precedent) or delete them after R-10, and record the hash only.
- No secret appears in the front end or in logs, in either spec ✔.

**A3-7. Make AC-14 observable.** While the blocked `/exceptions` Access app exists (until R-10 on 31 Oct), Access answers 403 before the Worker runs, so the production 410 cannot be seen on Sat 24. Restate:
- **Sat 24:** Access 403 on the public paths + Worker-level 410 proven by test 4 + Sat 24 dump = Thu 22 dump.
- **31 Oct, after R-10:** the production 410 check.

**Notes (non-blocking):**
- **Review questions:**
  - **RQ-1:** accept DV-5, subject to A3-3(b).
  - **RQ-2:** accept the shared C-1/C-2 routes.
  - **RQ-3:** accept DV-1 (numeric `subject_id`). The 6 live rows can't change, so correct 001 §5.2's comment.
  - **RQ-5:** accept DV-2 (`ops_lead:wrangler`).
- **N3-1.** Leave the 011 runner (a one-off manual bulk job) out of `GLEIF_JOBS` for E1/E4. Raced or withheld batches give `attempted > 0, progressed = 0` and would raise sev2 noise.
- **N3-2.** The sweep's uppercase-hex `EXC-S-` refs (`ops-api.js:950`) match the §8.3 regex ✔.
- **N3-3.** A service-token actor is `service:<common_name>`, which is the Access client id. Map it to a readable label through A4-2's allowlist.
- **N3-4.** M1 `object_key`s are entity ids that 013 may merge. Readers resolve them through `entity_merge_redirect` (see A4-4).

## 5. MA-OCT-004 — required changes (rev 1, before Mon 26)

**A4-1. Fix the dependency dates.** §5 and D-1 assume "003 built and live by Fri 23", which N-3 now rules out. 003 goes live no earlier than Sat 24 (A3-1). Fri 23 local prep stays. If 003's Sat 24 deploys slip, Mon 26 slips, and the stated 007 Phase 4 rule (button deferred after 28 Oct) applies. Say so in §16.

**A4-2. Scope service tokens in the Worker (004 Q2 and 003 Q3).** The "meridian-ops admin" Access app covers all of `/api/ops/admin/*`, so any service token that passes Access reaches every admin route, including the governance POSTs until A6 and every C-2 action. The §8.3 caller matrix (lines 218–226) narrows D-2 only. Required:
- a Worker allowlist (an `OPS_SERVICE_ACTORS` var: common_name → label + allowed routes/actions), checked after `verifyAccessJwt` on **every** admin route; an unknown service gives 403;
- **one token per caller:** 008 runner = D-2 `missing_entity` only; scripted ops = E-1, C-1, C-2; neither gets governance or the consumer types;
- the token is added to the Access policy **only after** the allowlist is deployed;
- tokens are stored in `~/.meridian-secrets/` (mode 600), with an expiry set and recorded, and never put in the repo or logs.

**A4-3. Guard `member_update` (§7.1, line 163).** The member `UPDATE`, the ticket `updated_at` bump and the event are "in the same batch", but the bump and the event are not conditioned on the member change having applied. Set the member `updated_at = :now`, and make the ticket bump and the event `… WHERE` the member row now shows `member_status = :to AND updated_at = :now`. Apply the same `NOT EXISTS` idempotency guard as A3-3(a). The same applies to `add_members` and `link_exception`.

**A4-4. Write down the 013 hand-off for entity-keyed members.** The KI 22.44 members (`entity_id`), 003's M1 `object_key`s and 008's tickets reference entity ids that 013 may merge away (the 392 hand-off twins). Rev 1 must say:
- seeds and members are **never rewritten** by 013;
- C-1 and D-1 resolve an `entity` key through `entity_merge_redirect` (read-only, the 007 R3 pattern) and show "merged into";
- build check B2 also checks the 24 ids against 013's hand-off file.

KI 22.17 is keyed by ISIN, so it is unaffected ✔.

**Notes (non-blocking):**
- **RQ-1:** accept `ops_dq_ticket_member` and its index (Ops domain declared, no FK, ≤ 500 rows).
- **RQ-2:** accept the object-scoped dedupe. `INSERT … WHERE NOT EXISTS` is one statement, and D1 serialises writes ✔.
- **RQ-3:** accept `/api/ops/admin/dq/new`, its CSP and the CSRF rule. Add `base-uri 'none'` to the CSP.
- **N4-1.** The daily create cap counts only `status='open'`, so triaging frees cap. Count today's tickets across the five statuses (5 seeks on `idx_ops_dq_queue`).
- **N4-2.** C-1 returns ≤ 200 members, but a ticket may hold 500. Add a keyset member page.
- **N4-3.** M4's source is a gitignored state file: record its SHA-256 in the build report.
- **N4-4.** Keep `fix_ref` in the `fix_scheduled` event only. Do not rewrite `proposed_resolution`.
- **N4-5.** Q3 adds one indexed count, 0 writes and no new macOS permission (the health-check already notifies) ✔.

## 6. Dependencies and sequencing (item 3), summary

| Item | Position |
|---|---|
| 002 A6 | Hard prerequisite for both specs (15/15 endpoints today). Remote ≥ Sat 24 (N-3). Code, `wrangler dev` and tests locally from Mon 19. The Founder can create the "meridian-control admin" Access app before then. Deploying `meridian-control` early (dormant) is possible only if the Main Lane rules a new Worker outside N-3. |
| N-3 freeze 17–23 Oct | **Local from Mon 19:** 003 tests 1–4, M1 test 2, `cases.js`, the retirement commit; 004 `005-ops-dq.sql` `--local` and the engine skeleton (Fri 23). **Waits for Sat 24 or later:** every `meridian-ops` / `meridian-control` / `entities-api` deploy and any secret change. **Main Lane ruling needed:** the D1-only remote steps (003 index, Access Block, M1, M2) on Thu 22. |
| 008 ticket hook | M4 from `bonds/state/unmatched-issuers.json` (gitignored ✔) Tue 27–Wed 28. Runner raising only with a scoped token (A4-2). |
| 011 / 013 hand-offs | 003 E3 seed points at 011 bucket A ✔. Leave the 011 runner out of E1/E4 (N3-1). 013 redirect resolution for entity keys (A4-4). |
| `entity_exceptions` migration | Freeze (Access Block) → dump → M1 in D1 (byte-identical, V2) → M2 → Sat 24 re-dump compare → retirement. Sound. Table kept frozen to November (Q2). |
| 007 | Retirement commit on top of `0dd7ef0`, with the 007 R-routes in the smoke set (A3-2). Phase 4 button against `/api/ops/admin/dq/new` from Wed 28. |

## 7. Founder questions (item 5): recommended answers

| Q | Recommendation | Reason |
|---|---|---|
| **003 Q1** auto-resolve replayed `job_missed` | **Yes** | Replays otherwise leave stale cases; safe once A3-3(b) is in (audited, never re-closes a human reopen). |
| **003 Q2** keep `entity_exceptions` frozen to November | **Keep** | 9 rows at ≈ 0 cost, and it is the only clean fallback for an M1 rollback; drop under its own approval after export. |
| **003 Q3** Access service token for scripted case actions | **Yes, with A4-2** | Lets the build lane run AC-2..AC-4 and act on cases before 005, provided the Worker allowlist is live before the token is admitted. |
| **004 Q1** reopen KI 22.9 as an aggregate ticket | **Yes** | It is a ticket, not a fix (0 Entities writes now). The 22 Aug decision stays on record, and 006 found no RR support for the 4 edges. |
| **004 Q2** 008 runner raises `missing_entity` itself | **Yes, after A4-2** | Re-verification then needs no manual reload, and the token can do nothing but that one create. |
| **004 Q3** DQ count in the health-check notification | **Yes** | One indexed count, 0 writes and no new prompt; otherwise button reports wait for the console. |

## 8. Questions for the Main Lane
1. **N-3 scope ruling:** are D1-only remote steps (003's `004-ops-cases.sql`, the `/exceptions` Access Block, M1 and M2 on Thu 22) inside or outside N-3? The Architect's view is outside, under F-5 and FREEZES.
2. **A6 sequencing:** may `meridian-control` (a new Worker) deploy dormant before Sat 24, or does everything wait for Sat 24?
3. Route A3-1..A3-7 and A4-1..A4-4 to LANE-3 for rev 1, together with REVDIL's items, before one Founder Decision Request.

REVIEW-A did not edit any spec, STATUS_BOARD.md or a Status JSON.
