# MA-OCT-A2.SPEC — Report (LANE-11, Data-Identity Lead)

**Control v1:** `claude/packets/MA-OCT-A2.SPEC_Control_v1.md` `50a9bdcd81e3642fbaed1d3bb755027996d66f59e2b0ae9f221c2b381abd2e93`. It matches the STATUS_BOARD row (79). **Task v1** `eb63a161a237752c59491f109726a044bb8be43fbe10506cc5a748fc1b044e59` matches.
**Date:** Wed 28 Oct 2026. **Git:** HEAD `29ddfb4` = `origin/October-2026`. No `.git/*.lock`, nothing staged. **Doc-only:**
- 0 D1, no deploys, no git writes;
- no secrets opened (`ops-ingest.env` not opened);
- 0 GLEIF calls.

## Output

| File | SHA-256 | Lines |
|---|---|---|
| `claude/MA-OCT-A2_Spec.md` (rev 0) | `226d07db138a3aff78f6ec7df6a8fdc5a6d67b0b96e8c2c08dfa31957bb7842d` | 250 |

## Inputs verified

- **Task hashes, all matched:**
  - 011 spec rev 1.10 `63280691…0aaa`;
  - CLOSE `89dab615…7c9a`;
  - CLOSEREV-ARC `a9c1cd19…8ff54`;
  - DIL29 `95842115…37e6`.
- **Work files hashed** (outside the repo):
  - `holds/e4-trigger.json` `7e3c9153…3094`;
  - `holds/ea-dropped.json` `b9e18517…daac`;
  - `a2/A2_exclusions_DIL.json` `ac1c1572…b4f7`;
  - `closeout/a-deferral-list.json` `86ec9d99…6d56`;
  - plan `e3854698…e6a8`;
  - `handoff-013.json` `0597e15d…6009`;
  - `exceptions-closeout.json` `7fe7eb2f…4d32`.
- **Code at commit `58cd922`** (core `830b49a8…63c7`, runner `29300a0e…59fa`, plan `02ac8c67…67b8`, verify `b887e2f9…bb21`). The core library sits at `App/Corporate Atlas/lib/gleif-reconcile-011-core.mjs`.
- **FREEZES** `b6d035f6…89bc`.

## Spec headline

| Item | Content |
|---|---|
| **Scope** | **A 3,648, ECA 44, E-A 296, Q 3,648** after the 28 DIL29 exclusions. That is about 31.6k writes plus about 1k Ops events. Fresh-export withholds (LEI now on another row) go to 013 and are never written. |
| **Matcher fix** | R-LF / R-CUR / R-FUND are coded in `generate --a2`. **STOP** if the IDs they exclude differ from `A2_exclusions_DIL.json` (24 / 1 / 5, union 28). The rules are also a runtime assertion. The 006 T1 base and the 011 guards are unchanged. |
| **Runner reuse** | C-1..C-6:<br>- a separate work dir `gleif-a2`, leaving the 011 holds untouched;<br>- its own job `manual.gleif-reconcile-a2` with a new emitter key (CA-2);<br>- a `--a2` plan mode;<br>- the runtime exclusion assertion;<br>- a new read-ceiling file;<br>- tests. |
| **Budgets** | Reads about 195k: export 74k, batches 46k, verification 75k. A2 ceiling 250k, ≤ 200k/day. Writes ≤ 25k/day own and ≤ 60k account: Fri about 11k, Sat about 21.6k, **Sun 0**. |
| **GO gates** | **G-1:** reviews Thu 29. **G-2:** fixed-matcher sample of 150 with 0 errors (LB 98.02%), or 237 with ≤ 1 error, else STOP. **G-3:** freshness gate, ≤ 50 API calls. **G-4:** fresh export + pinned plan + Architect delta. **G-5:** job, key, ceiling, dated freeze. **G-6:** Founder. |
| **Run plan** | **Thu 29:** reviews, code, G-2 adjudication. **Fri 30:** FG → export → plan → GO → pilot A2-001 → 50/50 → A2-002..007. **Sat 31:** A2-008..015 → ECA → E-A → Q → verify. **Sun 1:** nothing. **Mon 2:** 013. |
| **Acceptance** | AC-A1..A9:<br>- read-backs 0 mismatches; invariants 0;<br>- pilot 50/50;<br>- 200/200 sampled diff;<br>- **≥ 10 real API spot checks** (D-1);<br>- E-2/E-3 edges;<br>- budgets;<br>- hand-offs. |
| **Rollback** | A retained manifest under `gleif-a2/`, re-issued if any file grows after close. Restore order Q → EA → ECA → A. **Valid until 013's first write (Mon 2).** |
| **013** | No conflict: A2 writes only the surviving older twins. 013's plan is built from a post-A2 export and does not start before the A2 close-out. Withholds become 013 inputs. |

**Founder questions (3), with recommendations:**
- **Q1:** a 28 Sep Level 1 basis with a ≤ 50-call freshness gate, rather than a newer GC → **gate**.
- **Q2:** freeze the other Entities writers Fri 30 08:05Z → Sun 1 00:10Z → **yes**.
- **Q3:** if G-2, FG or the pilot fails, defer A2 to November → **yes**.

## For the Main Lane

- Add the dated FREEZES window (§6) before Fri 30.
- Ask the Operations Lead for the A2 job registry row and the new emitter key (C-2).
- Issue the Thu 29 Architect and Operations Lead reviews.
- Issue a LANE-11-ENG packet for C-1..C-6.
- Schedule the G-2 adjudication slot for LANE-11 (Thu 29). This lane did not draw the sample; per §7 it is drawn by LANE-11-ENG with seed `MA-OCT-A2.G2`.

## Stop

Both outputs are written. No other file was changed.
