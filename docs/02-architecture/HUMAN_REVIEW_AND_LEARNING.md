# Human Review and Continuous Learning

**Status:** Current architecture boundary

**Established:** 2026-08-09

## Decision

Vorvex treats uncertainty as durable information. Canonical transactions can be evaluated by a local review-and-learning service after persistence. Insufficient or conflicting evidence produces an encrypted review item and an Unknown outcome; it never produces a guessed category, World, meaning, or relationship.

```text
canonical transaction
  → explicit correction
  → explicit user rule
  → user-confirmed learned rule
  → deterministic engineering rule
  → Unknown + review when needed
```

The service is provider-independent. It does not parse statements, change ingestion identity, match transfers, or call external services. A separate Founder review adapter now produces the minimized UI model described below.

## Durable review queue

The queue is a separate owner-only SQLite boundary using the existing required AES-256-GCM field encryption. A review row stores only internal review and canonical transaction references, safe status/reason, and timestamps in plaintext. Transaction description, normalized counterparty, account/import provenance, current meaning, category, World, confidence, and relationship candidate are encrypted.

One canonical transaction can have at most one review item. Re-evaluating the same transaction or processing a duplicate import cannot multiply its queue record. Queue states are `pending`, `resolved`, and `ignored`.

Review reasons include unknown financial meaning, missing category, low confidence, ambiguous transfer, ambiguous relationship, conflicting rules, unknown merchant, and explicit manual request.

## Human confirmation lifecycle

A person may classify a transaction, confirm a relationship type, ignore the item, or explicitly keep it Unknown. Classification confirmation can set any supported subset of financial meaning, category, and World. Confirmation creates an exact normalized-counterparty rule scoped to the same canonical account. It does not create a broad regular expression or institution-wide assumption.

The earlier nullable relationship decision fields remain compatibility preparation only. Active matching and confirmation now use the separate [Canonical Transaction Relationships](./TRANSACTION_RELATIONSHIPS.md) boundary and never mutate `relatedTransactionId`.

The decision, review-state transition, and any learned rule are committed atomically. No decision is forced.

## Learning rules and precedence

Rules match an exact normalized counterparty and optionally one exact canonical account. Rule classifications may supply financial meaning, category, and World; omitted fields preserve existing canonical facts rather than becoming fabricated replacements.

Precedence is:

1. Explicit transaction correction
2. Explicit user-created rule
3. User-confirmed learned rule
4. Deterministic engineering rule
5. Unknown

Conflicting rules at the strongest matching level produce Unknown and a conflict review. Lower-precedence evidence never breaks the tie silently.

Every outcome contains its method, optional rule ID, confidence when supported, and a plain explanation. Rules record their source plus creation/update timestamps. Users can list, edit, disable, re-enable, or delete rules. Disabled and deleted rules do not affect future evaluation.

## Unknown behavior

Unknown is not a placeholder category. An unknown financial meaning remains null in the classification outcome. Transfers and credit-card payments without confirmed relationships are reviewable but are not matched. Refund meaning remains a refund while missing contextual category is reviewed separately. Reimbursement and loan candidates require explicit manual review evidence.

## Privacy boundary

Review, merchant, classification, provenance, and relationship details remain local and encrypted. The engine has no network access, AI, prompts, telemetry, analytics, remote synchronization, or plaintext fallback. The encryption key is supplied externally and cleared from the store's private memory copy when closed.

The review database remains a server/local-process boundary and is never serialized directly to the browser. The Founder review data-access layer exposes only description, current meaning, current category, current World, a plain-language explanation, and a sealed 30-minute action token. The token contains an authenticated encrypted review reference; it does not expose a database or transaction identifier. Database IDs, account/import references, normalized counterparties, confidence internals, rule IDs, encryption metadata, fingerprints, parser provenance, source paths, and filenames do not cross the browser boundary.

Every save returns through a validated Server Action, reopens the configured local store, authenticates and decrypts the action token, and permits only classify, Keep Unknown, or Ignore. Classification inputs use the canonical meaning and World allowlists and the existing category length boundary. A successful save atomically records the decision and any learned rule, then invalidates both the review page and homepage. Browser code cannot open SQLite or supply an internal review ID.

## Founder language and product interaction

Review is a focused product conversation, not an exposed data-maintenance console. Vorvex proposes one human-readable financial meaning first; the Founder confirms, corrects, or skips it. Consumer UI uses language such as Home maintenance, car service, outing, salary, and mortgage. Internal terms such as taxonomy, canonical classification, and account-scoped rule remain implementation language.

Founder wording may be remembered as an encrypted local alias only after the Founder maps it to an existing supported concept. An alias never creates a new top-level World, category system, or arbitrary financial meaning. The confirmed transaction decision, matching-history update, narrow future rule, and alias write share the existing atomic review transaction. Direction remains evidence: a rebate alias cannot turn an inflow into an outflow.

Supporting pages share one persistent Vorvex shell. The Vorvex identity returns to the Universe; My data, Statements, and Needs attention remain stable destinations rather than separate applications with redundant back links.

Review follows a compact spatial sequence: transaction, World, meaning, confirmation. A sufficiently supported proposal can be confirmed directly; weak evidence starts with World choices. “New” remains governed: natural language is mapped to a confirmed existing concept and encrypted as an alias, while genuinely new categories require an explicit governed taxonomy extension rather than free-form canonical mutation.

Every classification is immediately reversible. Undo removes the associated decision, narrow learned rule, and newly created language alias in one local database transaction, then returns the original review item to pending. Recently resolved decisions remain available through Change. “Review later” records no classification or rule; it temporarily defers the item and automatically returns it to the pending workflow after 24 hours.

The review interface is available only when the owner-controlled application process has `VORVEX_REVIEW_DATABASE_PATH` plus the existing external 32-byte persistence key configuration. Missing or invalid configuration produces a generic unavailable state without disclosing paths or errors. The application remains an owner-local product; exposing it to a network requires a separately approved authentication and host-hardening decision.

## Current limitations

- The review interface intentionally has no batch editing, search, advanced filters, or rule editor. It now presents relationship candidates owned by the separate relationship boundary.
- Homepage loading invokes evaluation for its persisted canonical transactions before aggregation. The ingestion parsers and provider routing remain unchanged.
- Legacy review relationship fields do not create transaction relationships; the dedicated relationship store is authoritative.
- Rule matching is intentionally exact and account-scoped; aliases and merchant families require explicit future design.
- Keychain provisioning, encrypted backup/export, and restore remain shared local-persistence prerequisites.
