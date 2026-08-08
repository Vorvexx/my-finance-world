# Canonical Transaction Ingestion

## Decision

All transaction sources enter Vorvex through one provider-agnostic pipeline:

```text
Provider
  ↓ raw transaction
Validation
  ↓ structurally trustworthy transaction
Normalization
  ↓ canonical counterparty and stable financial facts
Deduplication
  ↓ one authoritative transaction per source record
Classification and World attribution
  ↓ explicit enrichment metadata
Canonical transaction ledger
  ↓ queries
UI, Worlds, reports, insights, and future assistants
```

The UI never consumes provider formats. The canonical financial model owns the transaction ledger, even when it is empty.

## Canonical Record

A canonical transaction preserves immutable financial facts and evidence:

- Unique ID and account relationship
- Date, positive amount, and explicit inflow/outflow direction
- Posted or pending status
- Original raw description
- Normalized counterparty
- Category and optional World relationship
- Provider, source kind, source record ID, timestamps, and deduplication key
- Attribution method, rule, confidence, and correction timestamp

Raw descriptions remain unchanged. Normalization creates a separate value; it never rewrites evidence.

## Provider Contract

A provider only loads raw records. It does not calculate totals, normalize descriptions, classify activity, or shape UI output. Future manual entry, API, CSV, PDF, or database adapters must return the raw transaction contract and use the same ingestion function.

The initial local synthetic provider exists only for development and tests. It is deliberately not registered in the production financial-model loader, so synthetic activity cannot appear as personal history.

## Validation and Privacy

Validation rejects missing identifiers, malformed dates or timestamps, non-positive amounts, unknown directions, unknown statuses, and unsupported source kinds. No private transaction data is present in this checkpoint. Future private providers must remain outside tracked source files and preserve raw provenance locally.

The test suite uses Node's native TypeScript execution. The repository therefore declares Node 24 or newer as an explicit runtime requirement.

## Deduplication

The primary deduplication key is `provider ID + source record ID`. This reflects the source system's identity instead of guessing from merchant, amount, and date. When the same key appears more than once:

1. A posted record replaces its pending version.
2. Otherwise, the version with the newest source-updated or observed timestamp wins.
3. The ledger reports the number of duplicate inputs it resolved.

Cross-provider duplicate detection is intentionally deferred because similar-looking transactions can be legitimate. It should require explicit reconciliation evidence.

## World Attribution

Attribution is enrichment, not a mutation of transaction facts. Precedence is:

1. User correction
2. Deterministic rule
3. Future AI classification
4. Unclassified

Rules currently demonstrate Home (mortgage and hydro), Vehicle (fuel), Income (salary), and Investments (contributions). User corrections are separate records and win without deleting the prior evidence. Future AI output must use the same attribution shape, identify its method, and expose confidence; AI is not implemented here.

## Derived Services

The query layer provides recent transactions, pending transactions, account and World filters, and integer-cent inflow/outflow/net totals over an inclusive date period. UI code should call these services rather than reimplement financial calculations.
