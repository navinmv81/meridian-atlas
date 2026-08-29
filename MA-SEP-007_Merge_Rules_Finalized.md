# MA-SEP-007 — Finalized Merge Rule (Scenario A/B/C) + New Backlog Proposal

**Role:** Entities Product Lead | **Session:** Cowork swim-lane (device-bridge) | **Date:** 2026-08-28
**Status:** Rule agreed in conversation with the Founder. Still cannot be executed from this session — no live D1/GLEIF access (see MA-SEP-007_Diagnostic_Report.md §0). Hands off to a true local Claude Code Terminal session for execution, exactly as the original diagnostic report scoped.

This addendum supersedes the tiering discussion in the original diagnostic report's §1/§5 with a finalized, numbered rule, and adds one new backlog item the conversation surfaced.

---

## 1. Finalized rule

| Scenario | Rule | Groups | Entities |
|---|---|---|---|
| **A** — no LEI on either side | **Defer.** Leave as-is; not enough evidence to merge safely. Includes 115 Category-A country-mismatch groups + 1 reclassified Category-C group (BlackRock / Blackrock Inc — also has no LEI on either side, so it doesn't actually fit Scenario C's premise despite the type mismatch). | 116 | 232 |
| **B** — both sides share an LEI | **Auto-eligible to merge onto that LEI**, but the surviving **name must come from a live GLEIF lookup on that LEI** — not from either existing string. (Neither current row actually holds GLEIF's own legal name for 111 of 112 of these pairs; see §2.) Gated by a 0.5 name-similarity floor **plus three named overrides** regardless of score. | 105 auto / 7 individual review | 226 |
| **C** — one side has a GLEIF-confirmed LEI, the other doesn't | Same treatment as B: merge onto the LEI-bearing identity, name from a live GLEIF lookup. All 16 qualifying groups clear the similarity floor comfortably (lowest: Invesco/Invesco Ltd at 0.78). | 16 | 32 |
| **Total** | | **244** | **490** |

**The 7 Scenario-B individual-review exceptions** (below the 0.5 floor, or a named override, regardless of score):

- `SLM Corp` / `Navient Corp` (sim 0.50) — **named override.** Known 2014 spinoff; historically distinct, publicly traded, shares an LEI. Already flagged in `MA-SEP-007_backlog.md`.
- `Santander Bank Polska SA` / `Erste Bank Polska Spółka Akcyjna` (sim 0.62) — **named override.** Two different bank brand names on the same LEI; unverified, not assumed safe.
- `OPAP Holding SA` / `Allwyn AG` (sim 0.25) — **named override.** Different name and different country on the same LEI; possibly a legitimate rename, unverified.
- `International Business Machines Corp.` / `IBM` (sim 0.15), `MERCK Kommanditgesellschaft auf Aktien` / `Merck KGaA` (sim 0.38), `RWE AG` / `RWE Aktiengesellschaft` (sim 0.43), `RELX PUBLIC LIMITED COMPANY` / `RELX PLC` (sim 0.46) — below the numeric floor but read as ordinary abbreviation variants on inspection; routed to review rather than trusted blind, since the floor is a blunt instrument (see §2).

**Why named overrides on top of a numeric floor, not the floor alone:** `Santander Bank Polska`/`Erste Bank Polska` scores 0.62 — comfortably above the 0.5 floor — and would have auto-merged under a pure numeric rule despite being exactly the shape of case the Founder flagged from direct transaction experience: an absorbed entity can retain its LEI (or have it reused) post-merger/spinoff for a myriad of technical reasons, so LEI collision alone is never sufficient proof of identity. The floor catches the *obvious* low-similarity cases; named/manual override is what catches the ones that look fine numerically but aren't verified.

## 2. Correction to the original "go with GLEIF" framing (carried over from the prior message, restated for the record)

`entities-enrich.js`'s Phase 2 — the only pipeline stage that puts an LEI onto 111 of the 112 Scenario-B pairs — updates `lei`/`lei_status`/`country` but **never writes `name`**. So "the entity that came from GLEIF" isn't literally sitting in either existing row for those 111 pairs; both are still their original ETF/N-PORT holdings-disclosure strings, just LEI-confirmed after the fact. Only 1 of 112 pairs (`Banco Comercial Português S.A.`) has a row whose name was actually written from GLEIF's own `legalName` field (via `entities-enrich.js` Phase 3's parent-auto-creation path). Executing the agreed rule correctly requires a **live GLEIF LEI-record lookup at merge time** to fetch the current legal name — this session cannot make that call (no live network access from this Cowork device bridge), so it can only mark which 121 groups qualify, not fetch the names.

## 3. What this session did vs. what's still needed

**Done here:** the rule is defined with exact numbers, applied to all 244 groups, and reflected in the updated `MA-SEP-007_Tier2_Review.xlsx` (new "Recommended Action" column; Decision pre-filled "Approve" for the 121 auto-eligible groups, left blank for the 116 deferred + 7 individual-review groups).

**Still needed, from a true local Claude Code Terminal session with live D1 + GLEIF access:**
1. For each of the 121 auto-eligible groups: fetch the current legal name from GLEIF's LEI-record API for the shared/confirmed LEI, then execute the merge via MA-SEP-001's exact repoint pattern (`db.batch()`, `INSERT OR IGNORE`, before/after row counts, repoint across the six dependent tables).
2. The 7 individual-review + 116 deferred groups wait on the Founder's row-by-row calls in the workbook (or explicit "still deferred" confirmation) before anything happens to them.
3. `/validate-data` at close, per the original spec's Requirement 4.
4. Tier 1 (1,665 groups) and Tier 1b (55 groups) — the earlier widened-bar auto-merge candidates — are unrelated to today's A/B/C conversation and still need their own rule-level sign-off (informed by the Tier 1 spot-check sample already sent), separate from this scenario's execution.

---

## 4. New backlog item — Data Quality Exception Management tool (proposed, IDEA stage, target: October)

**Where this came from:** working through Scenario B surfaced that "same LEI" collisions like SLM Corp/Navient Corp aren't one-off oddities — they're a recognized pattern (LEI retention/reuse through absorption, spinoffs, and other corporate actions, confirmed from the Founder's own transaction experience). Every future GLEIF re-sync or dedup pass will re-encounter the same handful of judgment calls unless the decision is recorded somewhere durable. A one-time Excel review answers today's 244 groups; it doesn't stop the same question from being re-asked next quarter.

**Proposed scope (not yet specced — needs `/write-spec` before a build session, per CLAUDE.md's standing rule):**
- A new, small D1 table recording durable exception decisions — e.g. `(lei_or_key, entity_id_a, entity_id_b, decision, reason, corporate_action_note, decided_by, decided_at)` — so a verified call ("SLM Corp/Navient Corp: distinct entities, shared LEI is a known 2014-spinoff artifact, do not merge, do not re-flag") persists and is checked automatically by future dedup/enrichment passes, instead of being re-litigated.
- A simple internal-only admin surface to view/add/edit these exceptions — **explicitly not exposed to Meridian Atlas's terminal end users**, visible only to you. How that visibility boundary gets enforced (a genuinely separate/unlinked route, a shared-secret gate, something else) is an open design question — this project has no existing auth pattern to reuse, so it needs its own small design decision, not an assumption baked in here.
- Domain ownership: proposed **Entities domain** (Entities Product Lead) as primary owner, since the subject matter is entity-dedup exceptions specifically — flagging per CLAUDE.md's rule that a new D1 table must explicitly declare its domain before being built. Likely touches Tech Ops/Architect too, for the access-control mechanism.

**Non-goals (for the spec phase to confirm, not decided unilaterally here):** not a general-purpose data-quality tool across every domain on day one — scoped to entity dedup/LEI exceptions first, matching what this packet actually needed; not a replacement for `/validate-data`'s existing checks.

**Suggested ticket ID:** `MA-OCT-001` (first October item, matching this project's `MA-<MONTH>-<NNN>` convention) — **tentative, not confirmed against `sprintboarditems`.** This project has hit one ID-collision before (`MA-SEP-002` → `MA-SEP-007`, 2026-08-16); recommend the Control-lane session confirm the next real available ID against live D1 before this gets written in permanently, rather than trusting this session's guess.

**Stage:** IDEA. Not yet Founder-reviewed as a spec, not yet on `sprintboarditems` (D1) — this session cannot write there. Needs Control-lane reconciliation into `Sprint_Board.md` and D1, same handoff pattern as every other finding in this packet.

---
*Written 2026-08-28, same Cowork swim-lane session as `MA-SEP-007_Diagnostic_Report.md`. Read together.*
