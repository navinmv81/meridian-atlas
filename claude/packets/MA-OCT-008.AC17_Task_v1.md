# MA-OCT-008.AC17 — Task v1 (immutable): Data-Identity sign-off before the 008 pilot

**ISSUED BY:** Main Lane, Wed 14 Oct · **EXECUTED BY:** LANE-8, Data-Identity Lead (008 spec owner, Cowork) · **REVIEWED BY:** Architect sees B-3/B-4 at the 008 close-out · **APPROVED BY:** Founder

From `claude/packets/MA-OCT-008.BUILD_Report.md` (`142383c67c6687d7029dd7f12f532c605b0534b2a691eb32d9bddb0f9ef6220b`), Wed 14 section (§6, §7, §8 and Appendix D1-A), against `claude/MA-OCT-008_Spec.md` rev 1.2 (`bcdad9a2…5cd3`):

1. **AC17:** sign or reject **each** of the 51 `skipped_*` rows for the 29 non-Wells issuers (Appendix D1-A). A rejected skip = a bond that should load: say why.
2. **Rule on B-1, B-1b, B-2, B-3, B-4** and the demand-note proposal (accept / change / reject, with reason). B-1/B-1b keep preliminary GM/Verizon supplements out of the served set — the priority.
3. **L8-4 co-registrant issuers** filed under the parent CIK (NextEra Energy Capital Holdings, Welltower OP LLC, Pfizer Netherlands International Finance B.V.): how they are linked (unlinked + DQ ticket per Q2, separate `bond_issuer_link` rows, or another rule).
4. **Same instrument on several accessions** (19 recurring keys): accept both rows loading, and say how 009 should show them.

Doc-only; you may read the build lane's `state/dryrun-2026-10-14.json` and fixtures. No D1, no SEC calls, no git writes, no code edits. Output `claude/MA-OCT-008_AC17_Signoff.md` (one row per skipped row + rulings) and a short `claude/packets/MA-OCT-008.AC17_Report.md`. Reply **"MA-OCT-008.AC17 reported"**. The pilot cannot start until this exists.
