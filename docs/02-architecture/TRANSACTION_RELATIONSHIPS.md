# Canonical Transaction Relationships

**Status:** Current architecture boundary

**Established:** 2026-08-08

## Decision

Vorvex represents two canonical transactions that describe one financial event through a separate durable relationship. Canonical transaction records and statement evidence are never rewritten or deleted by relationship work.

```text
canonical transactions + canonical account ownership/type
  → exact deterministic evidence evaluation
  → relationship candidate when confirmation is missing
  → Founder decision
  → encrypted relationship + narrow confirmed account-pair rule
  → relationship-aware homepage read model
```

The engine is provider-independent and has no PDF, parser, filename, source-path, merchant-similarity, NLP, AI, probability, or network dependency. The statement worker invokes it only after a durable import and passes canonical transactions through a narrow callback. Relationship failure cannot roll back an already committed import; it retains the source with safe `RELATIONSHIP_EVALUATION_FAILED` status for retry.

## Supported relationships

The first contract supports only:

- `internal-transfer`
- `credit-card-payment`
- `loan`
- `loan-repayment`
- `reimbursement`

Unknown remains valid. No unlisted relationship can be persisted.

## Deterministic discovery

Automatic discovery is deliberately narrower than relationship storage. It proposes only Internal Transfer and Credit Card Payment pairs.

Both require posted canonical transactions with:

- different canonical accounts owned by the same Person;
- the same exact amount in the same currency;
- opposite directions;
- dates no more than three calendar days apart; and
- exact compatible canonical financial meanings and account types.

Credit Card Payment requires an asset-account outflow and liability-account inflow, both already classified as `credit-card-payment`. Internal Transfer requires two asset accounts and both meanings already classified as `transfer`.

This exact evidence creates a candidate the first time. It does not create a relationship because amount and timing do not prove identity. Founder acceptance creates a rule for that exact unordered account pair, relationship type, and confirmed maximum date gap. A future unique pair satisfying the same canonical evidence may then be related automatically. If either transaction has more than one exact counterpart, every possibility remains a candidate even when a confirmed rule exists.

Loan, Loan Repayment, and Reimbursement are never discovered automatically. Their candidates require an explicit Founder-originated relationship type plus exact amount, currency, direction, distinct-account, and ownership validation. Accepting them stores the relationship, but does not enable automatic discovery.

## Candidate and confirmation lifecycle

Candidates include the proposed type, both approved descriptions and dates, exact amount/currency, supporting evidence, missing evidence, and a plain explanation. Decisions are Accept, Reject, Keep Unknown, and Ignore. Only Accept creates a relationship. The other decisions preserve the candidate outcome and create neither a relationship nor a rule.

Candidate creation is idempotent for one transaction pair and type. A canonical transaction with multiple possible exact counterparts is never resolved silently. Relationship deletion removes the relationship and its account-pair reuse rule so it cannot be recreated immediately; it cannot delete either canonical transaction.

## Persistence and privacy

Relationships, candidates, and confirmed rules live in a separate owner-local SQLite database configured by `VORVEX_RELATIONSHIP_DATABASE_PATH`. Sensitive payloads—including canonical transaction/account references, descriptions, dates, amounts, evidence, and rule inputs—use the existing required AES-256-GCM field encryption. Plaintext pair lookup keys are keyed HMAC values, not raw IDs. The file and containing directory use owner-only permissions.

The browser DTO contains only review display information and a sealed authenticated 30-minute action token. It excludes database IDs, canonical transaction/account IDs, HMAC keys, hashes, encryption metadata, import/parser provenance, paths, filenames, and rule internals. Missing or invalid configuration returns a generic unavailable state. Homepage and review rendering read relationships and candidates but do not create them; all persistence occurs in the worker boundary or a validated Founder Server Action.

## Homepage semantics

Relationship-aware aggregation is an in-memory read model:

- Internal Transfer, Credit Card Payment, Loan, and Loan Repayment legs are transfer-like and excluded from spending and salary income.
- Reimbursement outflow remains expense and its confirmed inflow becomes refund, producing the correct net spending effect.
- The secondary leg is suppressed from Recent activity so one financial event appears once.

The canonical ingestion ledger is unchanged. Deleting a relationship restores the independent transaction semantics on the next homepage read.

## Current limitations

- Confirmed rules are exact account-pair/type/date-gap rules; merchant aliases and fuzzy evidence are prohibited.
- Loan and reimbursement candidate origination has an engine API but no dedicated creation control in the Founder interface.
- The owner-local application still requires protected key, ingestion database, review database, and relationship database configuration.
- Network-host authentication remains outside this local boundary.
