# MA-OCT-009.SPEC — Report

**Control:** v1 `claude/packets/MA-OCT-009.SPEC_Control_v1.md` SHA-256 `1bd1c83800a0674ca50fe26c12d2dfe2c62b7ac83259316569918bcdfc349408` (matches STATUS_BOARD row 69)
**Task:** v1 `claude/packets/MA-OCT-009.SPEC_Task_v1.md` SHA-256 `ca66f8661ba9fb14923f6422925e1b15996e84255c2be15a525582d8eae4bfa7` (matches the Control)
**Executed by:** Engineering Lead (LANE-7), Cowork, Sun 25 Oct 2026, on the Founder's instruction. Author only.

## Preflight
- Folder `Meridian Atlas Clean (v11)`, branch `October-2026`, HEAD `c3c6e4a`; no `.git/*.lock`; git read with `--no-optional-locks` only. No secret file opened.
- Inputs re-hashed; all hashed inputs match the Task: scope v2 `967bebd7…f33445`, 008 rev 1.2 `bcdad9a2…15cd3`, 007 rev 1.4 `4d4fffef…397c`. Read as found: DIL14 `c517dde7…9c399`, `entities-api.js` `d18845dd…c70db`, `ma-entities.js` `9b42b5ff…e303`.

## Output

| File | SHA-256 | Lines |
|---|---|---|
| `claude/MA-OCT-009_010_Spec.md` (rev 0) | `8216123ec92f17b6f0f828246305a01bb7ea4b6ec0a59f1945b192131f8ef3b4` | 360 |

## Summary
- **009:** five `GET` routes on `meridian-entities-api`: issuer → bonds (multi-CIK keyset, 008 §8.3), CIK → bonds (unlinked issuers), bond detail (with a 007 NavLink), coverage/directory (cached 1 h), maturity ladder (cached 1 h). One Worker deploy, no new Worker, cron or index.
- **AC12 gate:** one-row Entities-domain table `fi_serving_gate`, created **closed**, fails closed, opened by one statement on the Data-Identity Lead's AC12 evidence. No deploy is needed to open or close it.
- **010:** a Bonds section on the 007 issuer layer (table + ladder), a bond detail layer, a `#/fi` directory layer from one nav link, and an unlinked-issuer layer; §7.5 copy; not-live-pricing disclosure everywhere.
- **Budget:** one-CIK issuer view ≤ 55 reads; ≈ 0.25M reads/day worst; 0 writes from either packet (gate create ≈ 3, each flip 1, operator actions).
- **Fits** Wed 28 – Sat 31 (§10), with a cut list (§11): ladder, matured toggle, CIK layer, then the directory (Founder).

## Finding for the Main Lane today (C4, Founder Q3)
**007's R1f is live and ungated.** Since 008's tables exist (16 Oct), R1's step 3a can return a `sec_bond` issuer candidate with no AC12 gate and no `parse_confidence` filter. That includes PepsiCo Inc for the 4 PepsiCo Singapore rows that failed AC12. DIL14 says no bond row may be read until the re-test passes. The spec gates R1f in the Wed 28 deploy (§4.3) and recommends a ≤ 8-read check of those 4 keys before Monday's 007 front-end release, with a one-constant R1f switch-off if any key is reachable. Not verified here (0 D1 reads in this packet).

## Founder questions
Q1 the destination (`#/fi` layer vs a full panel); Q2 the gate mechanism (table vs Worker variable); Q3 stop R1f before Wed 28. Each has a recommendation in spec §14.

## Budget
0 D1 reads or writes, no deploys, no git writes, no web lookups. `MA-OCT-009.SPEC_Status.json` and `STATUS_BOARD.md` not edited. Stop point reached.
