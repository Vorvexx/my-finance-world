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
