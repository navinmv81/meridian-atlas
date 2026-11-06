# Meridian Atlas — November Content Scope and Requirements

## Status

November kickoff edition — 2 November 2026. Supersedes the 31 October content brief without removing its agreed scope. High-level requirements only; detailed specifications, coverage targets, ordering and implementation need review after the actual patched release baseline is assessed.

## 1. Objective and boundaries

Finish a coherent research experience using existing capabilities rather than add standalone modules. Three priorities:
1. Exceptional delivery, including Ops UI consistency.
2. Connected exposure-to-company research, including bond reliability/enrichment.
3. Homepage as the research entrance.

Delivery-factory design/operation are governed separately by `claude_project_agentic_delivery_spec.md` and `meridian_atlas_agentic_delivery_factory_operating_kit.md`. The Ops interface and delivery Control Tower are distinct. Existing budget, security, architecture, domain ownership and approval rules prevail.

## 2. Ops UI cleanup

Outcome: System Health, Cases and DQ feel like one Meridian Atlas interface.

| ID | Requirement |
|---|---|
| OPS-01 | Remove Events, Sprint Board and Release Ledger tabs from Ops. |
| OPS-02 | Retain System Health, Cases and DQ and preserve their functionality. |
| OPS-03 | Match existing Meridian Atlas fonts, colour palette, spacing, navigation, tables, forms and status styling across all retained tabs. |
| OPS-04 | Align desktop/mobile, loading, empty, error, selected and focus states. This is not a new visual identity. |
| OPS-05 | Do not delete underlying events, APIs, records or history because a tab is removed. Backend retirement needs separate assessment/approval. |
| OPS-06 | Sprint/release visibility belongs in the delivery Control Tower without competing record systems. Preserve access during transition. |

Acceptance: retained tabs visually match the main product and pass functional regression checks; removed tabs do not cause record loss.

## 3. Connected exposure-to-company research

User outcome: understand the companies behind selected investments, identify overlapping exposure and investigate those companies.

| ID | Requirement |
|---|---|
| EXP-01 | Select supported ETFs/direct equities, enter allocation percentages, edit and remove entries. |
| EXP-02 | Explain and validate allocation totals and duplicate inputs; no silent normalisation. |
| EXP-03 | Calculate combined direct and ETF-derived company exposure. |
| EXP-04 | Explain contributions from each input and distinguish direct from indirect exposure. |
| EXP-05 | Show major company concentrations and shared exposure. |
| EXP-06 | Preserve instrument/issuer distinctions; aggregate with verified mappings and expose ambiguity. |
| EXP-07 | Show supported coverage and unresolved exposure; never redistribute unknown exposure silently. |
| EXP-08 | Display holdings/reporting/source dates and differences between periods. |
| EXP-09 | Link results into Corporate Atlas and available related instruments, ETF holdings, 13F and bonds. |
| EXP-10 | Label ownership evidence according to actual universe and reporting period; no claim of comprehensive current ownership. |
| EXP-11 | Explain unsupported inputs, missing mappings, empty and error states. |
| EXP-12 | Verify calculations and identity aggregation against manually checked examples, including incomplete-data cases. |

Corporate Atlas is the existing research spine, not a new corporate platform. Core use requires no account or brokerage connection. Persistence is optional only after approval. Not every company needs complete coverage in every dataset.

Acceptance: supported investments → explainable combined exposure and gaps → company → available connected evidence, with checked calculations and no misleading completeness claims.

## 4. Bond parsing reliability and prospectus enrichment

This explicitly extends the earlier context-only bonds scope. Fix existing parsing and enrich supported offerings; do not introduce comprehensive bond analytics or a broad new ingestion programme.

### 4.1 Reliability first

| ID | Requirement |
|---|---|
| BOND-01 | Inventory the existing supported bond/prospectus universe; classify success, partial, failure, skipped and unsupported with definitions. |
| BOND-02 | Explain root causes and fix agreed parsing defects within approved document scope. |
| BOND-03 | Make incomplete extraction and remaining exceptions visible; no silent success. |
| BOND-04 | Reprocess affected documents safely with source references and duplicate prevention, subject to write approval. |
| BOND-05 | Test previously successful/unsuccessful examples and multi-tranche cases where present; report before/after counts and remaining exceptions. |

Do not promise all bonds parsed before establishing universe and causes. Claude proposes a measurable supported-scope target for approval.

### 4.2 Offering information

| ID | Requirement |
|---|---|
| BOND-06 | Extract/display underwriters and bookrunners where disclosed, preserving source roles. |
| BOND-07 | Provide a concise structured summary of relevant prospectus offering information. |
| BOND-08 | Associate offering-level facts with correct bonds/tranches; preserve tranche-specific terms. |
| BOND-09 | Distinguish not disclosed, not applicable and not extracted; do not invent information. |
| BOND-10 | Link source documents and section/page references where feasible. |
| BOND-11 | Distinguish intermediaries from issuer, guarantor and trustee. |
| BOND-12 | Distinguish extracted facts from generated narrative; verify summaries against sources. |

Candidate summary fields to assess and specify where disclosed/applicable:
- Identity: issuer, guarantor, document date, security identifiers.
- Terms: amount, currency, issue price, coupon, maturity, payment terms.
- Dates: pricing, issue and settlement.
- Structure: seniority, security, guarantees, redemption provisions.
- Purpose/economics: use of proceeds, discounts/commissions, net proceeds.
- Distribution: underwriters, bookrunners and stated roles.
- Conditions: material offering-specific restrictions, conditions and risk disclosures.

Final field set and display require specification approval. Summary is not wholesale prospectus reproduction. Enrichment depends on verified parsing and source traceability.

Acceptance: measurable parsing improvement, visible exceptions and verified offering summaries with correct participant/tranche attribution.

## 5. Homepage as research entrance

User outcome: understand Meridian Atlas value and quickly start exposure analysis or company research.

| ID | Requirement |
|---|---|
| HOME-01 | Explain the connected research proposition concretely. |
| HOME-02 | Provide prominent entry into exposure analysis. |
| HOME-03 | Provide a direct route into company research. |
| HOME-04 | Maintain coherent navigation between homepage, exposure results and company views. |
| HOME-05 | Retain useful existing news/market information without expanding the news product or hiding primary actions. |
| HOME-06 | Show appropriate dates/coverage for surfaced holdings/filings; no false live-data claims. |
| HOME-07 | Support desktop/mobile and loading/empty/error states. |

Research continuation, recently viewed items and a what-changed feed are conditional, not baseline commitments. They need supporting data and approval; no implicit historical-data programme.

Acceptance: users can understand the proposition and enter either research route without exploring unrelated modules.

## 6. Exclusions and scope control

No backtesting, historical portfolio performance, optimisation, brokerage connections, tax lots, transaction histories or investment recommendations. No separate geography/asset expansion, large ingestion programme, standalone news redesign, bond valuation or comprehensive credit analytics. Reuse October capabilities first. New schema, production processing/deployment and spend require applicable approvals.

Ops/bond additions must not silently displace prior commitments. Assess total capacity; present trade-offs for Founder decision. Order fixes by dependency and user outcome, not by document section number.

## 7. Claude assessment and delivery checkpoints

1. Assess actual post-patch baseline: reusable features, data/identity gaps, bond failure inventory, dependencies, capacity impact and recommended minimum complete scope. Stop for Founder scope approval.
2. Specify approved scope: calculations, contracts, fields, interfaces, coverage targets, acceptance tests, change/rollback plan and small sequenced work units. Stop at required approval gates.
3. Deliver through the accepted factory workflow: bounded execution, evidence, independent review, demonstrations and Founder acceptance.

Final demonstration covers retained Ops tabs; exposure-to-company journey; bond remediation/enrichment; homepage entry. Pages existing or tickets closing is not proof of completion. Delivery-factory acceptance remains separate.
