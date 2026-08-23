# MA-SEP-007 — Entity duplicate cleanup, remaining backlog

**Domain:** Entities. **Lane:** data_identity. **Owner role:** Entities Product Lead.
**Stage:** IDEA (not yet spec'd — needs `/write-spec` before a build session, per CLAUDE.md).
**Opened:** 2026-08-16, as a direct follow-on to MA-SEP-001 (entity_master duplicate cleanup, CLOSED same day).

## What this is

MA-SEP-001 merged 1,833 duplicate groups (1,834 rows) out of `entity_master`, following a strict
auto-merge bar (LEI match on every row in a group, or byte-identical name text). Everything that
didn't clear that bar was deliberately left untouched and is captured here for review rather than
auto-merged.

**Review file:** [`ma-sep-007-open-duplicates.csv`](ma-sep-007-open-duplicates.csv) — 3,985 rows,
current as of the MA-SEP-001 close-out (`entity_master` at 33,124 rows). Regenerate before acting
on it if much time has passed, since `entities-seed`/`entities-enrich` run weekly/daily and the
underlying table will have moved.

## Categories in the review file

| Category code | Meaning | Groups | Entities |
|---|---|---|---|
| `A_same_type_no_lei_variant` | Same `type`, names collapse under `normalizeName()` (suffix-aware), but **no LEI on either side** — the only evidence is the name match itself | 1,780 | 3,561 |
| `B_lei_collision_name_mismatch` | Same LEI on ≥2 rows, but the names don't obviously match (abbreviation/hyphenation/truncation differences, or a genuine risk case) | 167 | 336 |
| `C_cross_type_non_fund` | Identical name under two different `type` values, neither of which is `fund`/`operating` (e.g. `holding`/`operating`, `government`/`operating`, `operating`/`spv`) | 17 | ~34 |
| `D_cross_type_fund_operating_intentional` | Identical name under `fund` vs `operating` — left alone by Founder decision (2026-08-16): treated as intentional, a fund entity and its corporate sponsor are meant to be separate rows | 27 | ~54 |

**One named risk case inside category B:** `SLM Corp` and `Navient Corp` share an LEI but are
historically distinct entities (Navient was spun off from SLM/Sallie Mae in 2014) — flagged so it
is never auto-merged on LEI alone. There are likely other legitimate-rename/spinoff cases like this
hiding in category B; each row needs a human look, not a blanket rule.

## Suggested next step

`/write-spec` to decide, category by category:
- Does category A get a lower-but-still-automatic confidence bar (e.g. suffix-normalized name match
  + same country), or does every one of the 1,780 groups need individual sign-off?
- Category B needs the SLM/Navient-style cases identified and excluded before any bulk action.
- Categories C/D are a design question (are type-splits ever the same underlying entity?) more than
  a data-cleanup question — may belong in front of the Architect rather than this packet.
