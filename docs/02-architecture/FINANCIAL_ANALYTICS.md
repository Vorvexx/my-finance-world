# Canonical Financial Analytics

**Status:** Current architecture boundary

**Established:** 2026-08-30

## Decision

Reusable analytics derive from the effective canonical read model produced by `loadCanonicalFinancialData`: canonical accounts and persisted transaction evidence, followed by deterministic attribution, Founder review/rule outcomes, and confirmed relationship semantics. Homepage, review, Worlds, and future analytics must not rebuild that sequence independently.

`lib/analytics/financial-analytics.ts` owns provider-independent, integer-cent analytics primitives. It separates economic cash flow from account circulation:

- Money In: income, refunds, and reversals.
- Money Out: expenses, fees, interest, and credit-card purchases.
- Transfers, credit-card payments, cash deposits, and cash withdrawals remain disclosed movements but are excluded from income and spending.
- Lifestyle excludes banking fees and Home, Vehicle, Investment, and Credit/Debt attribution.

## Available and derivable now

- current account balances, current net-worth components, and current net worth from the canonical financial model;
- Money In, Money Out, net cash flow, raw account circulation, and movement exclusions by inclusive period;
- spending and refunds by canonical category and World;
- period-over-period changes;
- largest supported inflows and outflows;
- transaction/category and merchant/payee trends;
- recurring inflows/outflows with evidence count, cadence, and confidence;
- credit-card purchase/refund/payment/fee activity without treating settlement as spending;
- liability account activity, explicitly not asserted as balance change;
- cash-side investment contribution/transfer evidence, kept separate from statement-reported contribution facts;
- TFSA and RRSP ending-value and book-cost history from factual snapshots;
- genuinely Unknown, intentionally deferred, category ambiguity, attribution, and date-range quality metrics;
- per-account statement coverage, merged overlaps, gaps, and selected-period coverage.

`lib/analytics/monthly-financial-flow.ts` is the canonical historical allocation dataset. It produces one fail-closed integer-cent timeline from December 2024 through the latest canonical transaction date and is consumed by both the Founder application and `/api/analytics`. Each month keeps economic cash flow separate from raw circulation and discloses Required Costs, Available to Allocate, Remaining Available, nested World/category allocations, refunds, fees, movements, Unknown/Partial evidence, coverage, and traceable trend drivers.

Required Costs include canonically explicit fixed obligations (for example mortgage, rent, property tax, insurance, or vehicle payments) in the month they occur. Other necessities require at least three cadence-consistent historical observations available by that month. Repetition alone is insufficient: discretionary categories are not promoted to required costs. The model exposes actual required transactions for each month separately from the normalized monthly burden and equivalent biweekly burden.

`lib/financial-model/economic-semantics.ts` projects each effective canonical transaction into independent World, cost nature, economic meaning, payment account, and context dimensions. Direction never supplies economic meaning by itself. Refunds and reimbursements reduce consumption; settlements, own-account transfers, cash movements, investment withdrawals, and asset transfers do not become Income or Consumption. Evidence-linked investment transfers become Wealth Building. Original bank transactions remain immutable, and any later economic split must reconcile exactly to their integer-cent amount.

Available to Allocate means `verified Economic Income − observed Required Costs`; it is financial capacity before discretionary consumption, not an account balance or money still available to spend. Remaining Available means `Available to Allocate − net Discretionary Consumption − verified Wealth Building`; it remains Partial/Unknown when destination evidence is incomplete. Available Cash is the separately supported current cash position. Month-over-month comparisons require complete coverage for both months. Whole-person opening position, mortgage decomposition, and unsupported wealth-building rates remain Unknown.

Goal/Dream intentions are metadata over an existing asset account and do not create another balance. Emergency-fund targets require an explicit Founder-selected number of months; Vorvex does not impose a default horizon.

## Requires more source data

- chequing and liability balance history beyond current canonical balances and credit-card statement balances;
- historical whole-person net worth because synchronized historical balances do not exist for every component;
- DCP/PRPP value history and contribution splits;
- investment contribution linkage to a specific investment account unless matching evidence exists;
- mortgage/home value history and vehicle asset value/history;
- debt principal, interest, amortization, and verified balance movement for loans without statements.

## Must not yet be calculated

- investment return, performance, gains, or attribution from ending-value movement alone;
- forecasts or recurring obligations presented as facts;
- savings rate without an approved definition and complete supporting scope;
- inferred historical balances or net worth reconstructed from incomplete transaction coverage;
- classifications, relationships, or account links invented to complete an analytic.

Unknown and Partial are valid analytic results. Presentation and final analytics selection remain Founder/CXO product decisions.
