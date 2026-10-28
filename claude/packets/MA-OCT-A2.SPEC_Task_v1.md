# MA-OCT-A2.SPEC — Task v1 (immutable): A2 spec — the deferred GLEIF A-rows (3,676 + 298 E-A + 44 ECA)

Governing: ML-1025-5 (A2 in October scope; run Fri 30–Sat 31; `gleif_006.db` kept until A2 closes). Doc-only (no D1, no deploys, no git writes, no secrets).

Inputs (verify SHA-256): `claude/MA-OCT-011_Spec.md` `6328069130ee437d128c3c0f08081218cab7e0e5df3beb2c0010dda46c1b0aaa`; 011.CLOSE report `89dab6159c124ce7c996c4b35fff43948a8673069417808dc857bf92419b7c9a` (A deferral lists 3,676 / 298 / 44 ECA, 42 A rows matched to GLEIF FUND records, `gleif_006.db` note); CLOSEREV-ARC `a9c1cd196c88f59ec1534bdd8606762f2e686d5d46d1a14736c44f14aba8ff54` §3 (A2 inputs); DIL29 `958421159b2836b743400ba520552f71d20cb0033f7c0c22069d832d875737e6` (29-row legal-form list, 16 extended, FUND rules, `A2_exclusions_DIL.json`); the E-4 trigger and `ea-dropped.json` as referenced there (outside the repo under `~/MeridianAtlas-work/`; hash what you read).

Spec must give: scope and exclusions; matching rules (reuse 011 core, DIL29 lists); runner reuse of `gleif-reconcile-011-core.mjs` (committed tonight by LANE-1-ENG); read budget per day (011 used 247,468/350k) and write budget with batching; freeze windows; acceptance criteria with spot checks; rollback manifest; Fri 30–Sat 31 run plan that avoids Sun 1 heavy writes; 013 interaction (no merge conflict — 013 runs Mon 2); reviewers Thu 29: Architect + Operations Lead. Founder questions, if any, max 3 with recommendations.

Write `claude/packets/MA-OCT-A2.SPEC_Report.md`. Reply **"MA-OCT-A2.SPEC reported"**.
