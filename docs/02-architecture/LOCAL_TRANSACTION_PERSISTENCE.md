# Local Transaction Persistence

**Status:** Current architecture boundary

**Established:** 2026-08-08

## Decision

Vorvex persists validated local statement imports in a narrowly scoped SQLite store. SQLite fits the founder-only local build because it is transactional, requires no external service, supports indexed and constrained identity, and has a direct migration path through versioned schemas. The implementation uses Node 24's built-in SQLite binding rather than adding a native database dependency.

```text
Folder worker
  → secure file intake
  → provider parser
  → canonical normalization
  → import journal
  → atomic SQLite commit
  → server-side queries
```

The store is not a general persistence framework and is not connected to the dashboard yet.

## Import journal and state machine

The journal stores an internal import ID, source SHA-256, provider, account type, mapped Vorvex account ID, parser version, statement period, source format, timestamps, state, transaction counts, a safe failure code, and schema version. It never stores the original filename, source path, PDF, extracted page text, account-holder details, or full account identifiers.

Allowed forward transitions are:

```text
received → parsing → proposed → committed
    │          │          │
    ├──────────┴──────────┼→ rejected
    ├──────────┴──────────┼→ quarantined
    └→ duplicate
```

Terminal states cannot transition. A process can resume an existing `received`, `parsing`, or `proposed` record. A repeated completed file is a no-op, and an atomic commit updates the journal and financial rows together. A failed database transaction rolls back all transaction rows and leaves the proposed import recoverable.

## Account mapping

The caller explicitly registers an existing canonical account for each route. TD Chequing registration requires a TD-compatible cash asset; TD Credit Card registration requires a TD-compatible debt liability. Mapping never derives ownership from a bank or card number and never stores those identifiers. The worker uses only an approved internal mapping and must not infer one from private document identity.

## Canonical identity and deduplication

The versioned chequing and credit-card fingerprints hash minimized, ordered activity facts scoped to the mapped account. Credit-card fingerprints include transaction date, posting date, integer amount cents, direction, currency, normalized description, and the row's occurrence ordinal. Chequing fingerprints retain their documented optional justified masked token. Both exclude filenames, paths, customer identity, bank numbers, and card numbers.

The occurrence ordinal preserves legitimate identical-looking rows within a statement. Across overlapping statements, matching account-scoped fingerprints resolve to the existing canonical transaction. This is intentionally conservative: source reordering or provider description changes can produce a new fingerprint, while indistinguishable repeated rows across overlapping statements remain inherently ambiguous.

Canonical IDs use a separate versioned Vorvex hash over the mapped account and transaction fingerprint. They are independent of provider IDs, filenames, and import IDs, so a recognized re-import does not create a new ID. TD PDF provides no trustworthy provider transaction ID; it remains `null`.

Deduplication order is:

1. completed source SHA-256 scoped to account/provider/account type;
2. trustworthy provider identity when a future adapter supplies one;
3. versioned account-scoped fingerprint.

Database unique constraints enforce the durable boundary, not only application checks.

## Encryption and local key boundary

Financial transaction payloads are encrypted with AES-256-GCM before SQLite receives them. This includes exact cents, direction, source and normalized descriptions, financial meaning, attribution, masked token, and non-indexed provenance. A fresh authentication tag and nonce protect every payload. The database directory is restricted to owner access and the database file to owner read/write access.

The store requires a caller-supplied 32-byte key and has no plaintext fallback. It does not generate, hard-code, commit, log, or store that key beside the database, and it clears its in-process key copy when closed. Tests use ephemeral random keys and no Founder secret.

This is field-level encryption, not full-database encryption. Operational journal fields and the minimum metadata needed for indexed queries and deduplication remain plaintext: internal IDs, source hash, provider/account type, mapped account ID, parser/schema versions, statement/transaction dates, currency, fingerprints, statuses, counts, safe error codes, and timestamps. Before a persistent Founder deployment, the application host must supply the key from OS-protected secret storage. OS keychain integration, encrypted backup/export, key rotation, and full-database encryption remain explicit follow-up hardening; the implementation does not claim they exist.

## Statement facts and durable queries

Schema version 3 adds `statement_facts` for reconciled TD Credit Card payment facts: statement date and period, due date, minimum payment, previous balance, and new balance. Monetary facts are authenticated-encrypted; indexed dates and internal provider/account identity remain plaintext. Statement facts are not transactions and are queryable only through the server-side store by mapped account or import.

Persistent `rawDescription` means only the whitespace-normalized description inside the parser's validated transaction row. It excludes page context and unrelated statement text. The encrypted payload also holds the normalized description and only a structurally justified masked reference token.

The server-only store exposes transactions by account, transactions linked to an import, transaction count, journal history, import status, and a constrained terminal receipt. Callers must not serialize database rows directly to clients. The safe receipt contains only internal import identity, terminal status, provider/account type, counts, and `safeToDeleteSource`.

## Source lifecycle and future folder worker

`safeToDeleteSource` is true only for `committed` or verified file-level `duplicate` results. Rejected and quarantined imports never grant deletion permission. This action does not delete files.

The implemented [Automatic Bank Statement Drop Folder](./STATEMENT_DROP_FOLDER.md) uses one configurable, user-controlled folder named `Vorvex Bank Statements`, not a repository directory. It takes an in-process claim without creating archival copies, uses the internal journal as the authoritative sorter, and deletes the source only after the safe signal. Failed inputs remain available for user action. Permanent `inbox/processing/rejected` copies would unnecessarily multiply sensitive statements and are not the design.

## Backup and migration limits

Schema creation and migration are transactional and tracked with SQLite `user_version`; a database from a newer unsupported schema fails closed. Version 2 added minimized safe folder-result history, and version 3 adds encrypted credit-card statement facts. Copying only the database without its separately protected key is not a usable backup. A tested encrypted backup/export, restoration, and key-recovery policy is required before this store becomes the sole durable copy of Founder financial history.
