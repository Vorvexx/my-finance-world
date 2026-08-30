# Homepage Financial View

**Status:** Current architecture boundary

**Established:** 2026-08-08

## Decision

The homepage consumes one minimized server-side `HomepageViewModel`. UI components do not query SQLite, imports, parsers, statement files, or private account snapshots.

```text
canonical account snapshot + encrypted local transaction store + local review rules + transaction relationships
  → one effective canonical financial-data loader
  → deterministic attribution + review/rule outcomes + relationship semantics
  → shared financial analytics primitives
  → deterministic homepage aggregation
  → minimized homepage DTO
  → server-rendered homepage
  → client-side spatial presentation using only that DTO
```

The account snapshot remains authoritative for position. Imported transactions explain recent movement, and reconciled statement facts provide upcoming obligations. A newer statement balance does not overwrite or duplicate a canonical liability balance without a separately approved balance-synchronization rule.

## Position and Worlds

Net worth is derived from canonical accounts as assets minus liabilities. Cash, investments, and liabilities use existing canonical group relationships. Home and Vehicle remain visible but unknown until authoritative asset and relationship data exists. Lifestyle is a temporary presentation lens for qualifying categorized spending, not a permanent taxonomy or a new domain parent.

## Activity semantics

The Time Navigator uses one calendar-period vocabulary for Day, Week, Month, Quarter, Year, All, and Custom. Qualifying Money Out includes canonical expense, credit-card purchase, fee, and interest meanings. Money In includes income, refunds, and reversals; refunds remain distinguishable and reduce Lifestyle spending where applicable. Transfers, credit-card payments, cash deposits, cash withdrawals, and unknown meanings are excluded from primary cash-flow and spending totals while remaining visible as account circulation.

This exclusion prevents a chequing-side card payment and credit-card-side payment credit from appearing as spending plus income before relationship matching exists. ATM withdrawals remain cash movement rather than assumed consumption.

Recent activity shows at most six transaction-specific descriptions already approved for durable storage. Upcoming currently uses reconciled credit-card due date, minimum payment, and statement balance facts; these remain facts, not future transactions.

## Unknown and coverage behavior

A missing source is unknown, not zero. A connected store with no matching records can report a known empty result, but coverage remains partial because imported statements do not prove complete history. The homepage labels imported coverage as partial and exposes only its date boundary and imported-account count.

## Browser privacy boundary

The DTO omits canonical account and transaction IDs, account names and institutions not rendered by the homepage, import IDs, provider/parser provenance, hashes, fingerprints, deduplication keys, source paths, filenames, masked references, encrypted payloads, raw statement metadata, and internal errors. It contains only canonical position values, account counts, approved transaction descriptions, summarized activity, sanitized coverage, and relevant statement obligations.

The homepage is server-rendered and has no client-side database code, financial mutation, analytics, telemetry, or external model call. Local persistence is read only when `VORVEX_INGESTION_DATABASE_PATH` and a valid external 32-byte key (`VORVEX_INGESTION_KEY_PATH` or `VORVEX_INGESTION_KEY_BASE64`) are configured. Missing or invalid configuration fails privately to an unavailable activity state.

The Vorvex Universe is a presentation layer over this same DTO. Current top-level navigation follows the approved five-World structure; Cashflow and liability remain canonical analytical/domain concepts projected contextually rather than duplicated top-level records. The component may format supplied values and select supplied recent items for display, but it does not derive balances, classify activity, match relationships, persist state, poll, or fetch another financial source.

When `VORVEX_REVIEW_DATABASE_PATH` is also configured, the server evaluates the already-persisted canonical transactions against explicit corrections, learned rules, and engineering rules before aggregation. This is an in-memory read-model overlay: the import ledger is not rewritten and statements are not re-imported. A saved Founder classification invalidates the homepage and review routes, so Lifestyle, spending summaries, recent activity meaning, and assistant summary are rebuilt from the updated evaluation immediately.

When `VORVEX_RELATIONSHIP_DATABASE_PATH` is configured, the server applies persisted accepted or confirmed-rule relationships to the read model. Exact evidence evaluation occurs after durable import, not during page rendering. Transfer, card-payment, loan, and loan-repayment legs cannot become spending or salary income. A confirmed reimbursement becomes expense plus refund. Recent activity suppresses the secondary leg so the same financial event appears once. Canonical transactions remain unchanged.

## Current limitations

- No account-balance synchronization from statement facts.
- No fuzzy, merchant-based, or cross-person relationship matcher; uncertain or ambiguous exact pairs require review.
- Historical whole-person net-worth and non-investment account-balance history remain unavailable because synchronized historical positions do not exist.
- Recurring events are evidence-based expectations, not obligations or forecasts.
- No network-host authentication layer; the review-capable application must remain within its owner-local host boundary unless a separate access-control design is approved.
- The application host still needs protected key provisioning and durable ingestion-store configuration before imported activity appears in a normal local session.
