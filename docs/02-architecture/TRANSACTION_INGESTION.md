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

The first available TD source is PDF. PDFs enter through the provider-independent [Secure PDF Intake and Structural Analysis](./PDF_INTAKE.md) boundary before any TD-specific interpretation. CSV and OFX/QFX remain future adapters; PDF details do not enter the canonical transaction model.

The production `td-chequing-pdf-v2` and `td-credit-card-pdf-v2` adapters convert validated TD sources into reconciled provider-specific facts. Their normalization boundaries translate activity into the same canonical transaction contract and atomically commit through [Local Transaction Persistence](./LOCAL_TRANSACTION_PERSISTENCE.md). Credit-card statement-level payment facts remain separate from transactions. No PDF field has been added to `CanonicalTransaction`.

The [Automatic Bank Statement Drop Folder](./STATEMENT_DROP_FOLDER.md) is the first production orchestration path. It detects stable local files, classifies document structure, selects a provider adapter, verifies an approved canonical account mapping, and invokes this same canonical boundary. Supported automatically: characterized TD Chequing PDF v2 statements, including a non-financial trailing page, and TD Credit Card PDF v2 statements with validated statement-page totals. No other bank-statement route is implied.

For liability accounts, purchases, interest, and fees are outflows that increase debt; payments, refunds, and other credits are inflows that reduce debt. A credit-card payment is not categorized as spending. Cross-account matching is owned by the separate encrypted [Canonical Transaction Relationships](./TRANSACTION_RELATIONSHIPS.md) boundary. It never rewrites transaction identity or relies on the legacy nullable `relatedTransactionId` field.

## Canonical Record

A canonical transaction preserves immutable financial facts and evidence:

- Vorvex-controlled ID and account relationship
- Transaction date, optional posted date, positive amount, explicit inflow/outflow direction, and currency
- Posted or pending status
- Original raw description
- Normalized counterparty
- Constrained financial meaning
- Nullable category and optional World relationship
- Import ID, provider, source kind, optional provider record ID, versioned fingerprint, timestamps, and deduplication key
- Optional related Vorvex transaction ID
- Attribution method, rule, confidence, and correction timestamp

For PDF imports, raw descriptions are limited to the whitespace-normalized description within a validated transaction row; unrelated page context is never retained. Normalization creates a separate value and never rewrites that evidence. Both values are encrypted in the local store.

### Identity and import provenance

The canonical transaction ID is created and controlled by Vorvex. A provider record ID is separate evidence, is scoped to its provider and account, and may be absent. Vorvex never promotes a provider ID into canonical identity or fabricates one when a structured export does not supply it.

Every transaction records the `importId` for the ingestion event that first created it without embedding the complete import record. TD PDF rows use the documented versioned fingerprint and Vorvex-controlled stable ID from [Local Transaction Persistence](./LOCAL_TRANSACTION_PERSISTENCE.md); later overlapping imports link to the existing record rather than changing its identity.

### Financial meaning and category

Financial meaning records transaction mechanics or economic interpretation. The initial values are expense, income, refund, reversal, fee, interest, credit-card purchase, credit-card payment, transfer, cash withdrawal, cash deposit, and unknown.

Category is separate contextual classification. It may be `null`: transfers and credit-card payments are not spending categories, and an unknown transaction must not receive an artificial `Unclassified` category. Existing attribution rules and user corrections assign category and optional World context without changing financial meaning.

### Relationship capability

`relatedTransactionId` remains a compatibility field and is not the active relationship authority. Confirmed relationships and their evidence live in the dedicated relationship store; canonical transaction rows remain unchanged.

## Provider Contract

A provider only loads raw records. It does not calculate totals, normalize descriptions, classify activity, or shape UI output. Future manual entry, API, CSV, PDF, or database adapters must return the raw transaction contract and use the same ingestion function. Imported records require resolved currency and import identity; adapters must not silently default currency or invent provider transaction IDs.

The initial local synthetic provider exists only for development and tests. It is deliberately not registered in the production financial-model loader, so synthetic activity cannot appear as personal history.

## Validation and Privacy

Validation rejects missing Vorvex-controlled import/account identity, malformed dates or timestamps, unresolved currency, invalid financial meaning, missing fingerprint evidence, non-positive amounts, unknown directions, unknown statuses, and unsupported source kinds. A provider record ID and posted date may legitimately be null. No private transaction data is present in this checkpoint. Future private providers must remain outside tracked source files and preserve minimized provenance locally.

The test suite uses Node's native TypeScript execution. The repository therefore declares Node 24 or newer as an explicit runtime requirement.

## Deduplication

The in-memory deduplication key is scoped by provider and account. It uses the provider record ID when present and otherwise uses the versioned transaction fingerprint. When the same key appears more than once:

1. A posted record replaces its pending version.
2. Otherwise, the version with the newest source-updated or observed timestamp wins.
3. The ledger reports the number of duplicate inputs it resolved.

The durable store handles completed-file and TD fingerprint deduplication, including overlapping statements and occurrence ordinals for legitimate identical-looking rows. Cross-provider matching remains deferred because similar-looking transactions can be legitimate and no approved reconciliation evidence exists.

## Human review and World attribution

Attribution is enrichment, not a mutation of transaction facts. The durable [Human Review and Continuous Learning](./HUMAN_REVIEW_AND_LEARNING.md) boundary establishes precedence as:

1. User correction
2. Explicit user-created rule
3. User-confirmed learned rule
4. Deterministic engineering rule
5. Unknown

Rules currently demonstrate Home (mortgage and hydro), Vehicle (fuel), Income (salary), and Investments (contributions). User corrections are separate evidence and win without deleting prior evidence. Conflicting rules and insufficient evidence remain Unknown and request human confirmation. No AI rule source exists.

## Derived Services

The query layer provides recent transactions, pending transactions, account and World filters, and integer-cent inflow/outflow/net totals over an inclusive date period. UI code should call these services rather than reimplement financial calculations.
