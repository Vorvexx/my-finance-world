# Technical Debt

## Mission 2 accepted debt

- Desjardins DCP and Canada Life retirement reports remain outside automated product ingestion. The Desjardins layout exposes reliable value and contribution decomposition, but has only two available periods. The Canada Life archive currently identifies its plan as an RPP while the canonical account is labelled PRPP; Vorvex must not silently equate them. Add provider-specific adapters only after account identity is explicitly reconciled.
- Ten older TD investment reports and older TD transaction layouts remain fail-closed. Extend adapters only from characterized fixtures; do not weaken reconciliation to increase acceptance counts.
- The local Founder installer can complete while macOS reports a transient LaunchAgent bootstrap error; a subsequent service kickstart works. Packaging lifecycle hardening is useful but remains secondary to product capability.
- Managed in-app browser control cannot access localhost. Final desktop visual acceptance used a local-only headless browser render; direct Founder interaction remains the authoritative subjective quality check for motion feel.

## Purpose

This document records engineering limitations and cleanup opportunities. Product ideas belong in the [Parking Lot](../04-decisions/PARKING_LOT.md), not here.

Technical debt is not automatically bad. Some debt is consciously accepted to ship and learn from a prototype. Agents must not refactor debt merely because they notice it. Address debt when it blocks delivery, risks data, causes defects, or materially increases future cost. Product work and debt cleanup should normally remain separate tasks and commits.

## Entry Template

```markdown
## Technical-debt title

- Date observed:
- Observed during:
- Area:
- Description:
- Current impact:
- Risk if ignored:
- Suggested resolution:
- Preconditions:
- Estimated urgency: Low / Medium / High / Critical
- Status:
- Related files:
- Related branch or commit:
```

## Current Debt

## TD Credit Card Layout Breadth

- Date observed: 2026-08-08
- Observed during: TD Credit Card PDF ingestion
- Area: Provider adapters
- Description: Parser v1 is validated against one real TD credit-card statement layout. Deterministic cross-account payment matching is now handled separately by the canonical relationship engine.
- Current impact: The characterized layout imports automatically and preserves payment meaning, but changed layouts fail closed.
- Risk if ignored: A bank layout change requires attention.
- Suggested resolution: Characterize additional real statement variants before widening the adapter.
- Preconditions: More sanitized statement variants.
- Estimated urgency: Medium
- Status: Open; payment-matching portion resolved by Action 14
- Related files: `lib/financial-files/td-credit-card-pdf-parser.ts`, `lib/transactions/td-credit-card-normalization.ts`
- Related branch or commit: `build/local-transaction-ingestion`

## Drop-Folder Host Lifecycle and Filesystem Retention

- Date observed: 2026-08-08
- Observed during: Automatic bank-statement drop-folder ingestion
- Area: Local process operations and privacy
- Description: The LaunchAgent now owns one production server and the runtime owns one worker lifecycle. File deletion still cannot guarantee secure erasure from filesystem journals, snapshots, backups, synchronization services, or storage media.
- Current impact: Daily Founder operation has one lifecycle owner. The acquisition folder should remain non-synchronized where residual retention is unacceptable.
- Risk if ignored: Multiple application processes could duplicate work before database constraints resolve it, hot-reload integration could create unnecessary watchers, and deleted source bytes may remain in systems outside Vorvex's control.
- Suggested resolution: Assess platform-specific retention before general deployment.
- Preconditions: Approved local application packaging and OS deployment model.
- Estimated urgency: High before persistent Founder deployment
- Status: Lifecycle resolved by Action 15; filesystem-retention limitation remains open
- Related files: `lib/statement-folder/worker.ts`, `lib/statement-folder/config.ts`, `docs/02-architecture/STATEMENT_DROP_FOLDER.md`
- Related branch or commit: `build/local-transaction-ingestion`

## Local Ingestion Key and Backup Operations

- Date observed: 2026-08-08
- Observed during: Durable local transaction ingestion
- Area: Financial persistence security and recovery
- Description: Transaction payloads use authenticated field-level encryption and Founder v1 now uses macOS Keychain custody. Key rotation, encrypted backup/export, and tested restore are not implemented. Indexed journal and identity metadata are not fully database-encrypted.
- Current impact: Long-lived local use has protected key custody, but the database must not become the sole irreplaceable copy until recovery is tested.
- Risk if ignored: Loss of the external key makes encrypted records unrecoverable; an unprotected backup may disclose journal metadata; one local database is not a resilient sole copy.
- Suggested resolution: Add encrypted versioned export/backup, restoration tests, and a key-rotation plan before relying on the store as the sole durable Founder ledger. Re-evaluate SQLCipher only if the remaining metadata exposure is unacceptable.
- Preconditions: Approved deployment location, retention posture, and recovery ownership.
- Estimated urgency: High before persistent Founder deployment
- Status: Keychain custody resolved by Action 15; recovery and full-database metadata protection remain open
- Related files: `lib/persistence/field-encryption.ts`, `lib/persistence/local-ingestion-store.ts`, `docs/02-architecture/LOCAL_TRANSACTION_PERSISTENCE.md`
- Related branch or commit: `build/local-transaction-ingestion`

## Founder Runtime Packaging and Updates

- Date observed: 2026-08-08
- Observed during: Founder Production Readiness
- Area: macOS distribution
- Description: Founder v1 uses a reproducible repository-based installer, LaunchAgent, and small `.app` launcher. It is not code-signed, notarized, self-updating, or a public installer.
- Current impact: A compatible Founder Mac needs Node.js 24+, installed dependencies, and the canonical repository for one-time installation. Ordinary use after installation needs no Terminal.
- Risk if ignored: This is unsuitable for public customer distribution and updates remain an engineering operation.
- Suggested resolution: Design a signed, notarized, versioned installer and safe update/rollback channel before external distribution.
- Preconditions: Approved commercial distribution and update architecture.
- Estimated urgency: Low for Founder v1; critical before public distribution
- Status: Open
- Related files: `scripts/install-founder-runtime.sh`, `packaging/`
- Related branch or commit: `build/founder-production-readiness`

## Oversized Dashboard Component

- Date observed: 2026-08-03
- Observed during: Functional dashboard prototype
- Area: Frontend structure
- Description: `app/page.tsx` has historically grown too large and may need gradual component extraction.
- Current impact: The page is harder to review and change safely than smaller focused components.
- Risk if ignored: Future interface work may increase coupling and regression risk.
- Suggested resolution: Extract components and domain logic incrementally when a scoped feature requires it.
- Preconditions: Preserve current behaviour and validate each extraction.
- Estimated urgency: Medium
- Status: Accepted for prototype
- Related files: `app/page.tsx`
- Related branch or commit: `prototype/functional-dashboard-v1`, `31c1605`

## Earlier Uncommitted Helper and Type Work

- Date observed: 2026-08-03
- Observed during: Repository audit and dashboard checkpoint
- Area: Working tree and code organization
- Description: Earlier uncommitted work remains under `lib/` and `types/`. `types/finance.ts` contained mixed earlier work and dashboard additions and was deliberately excluded from the checkpoint.
- Current impact: The working tree contains useful code without a clear committed ownership boundary.
- Risk if ignored: Later tasks may accidentally overwrite, duplicate, or commit mixed work.
- Suggested resolution: Audit the files in a dedicated task, retain valuable logic, and create a coherent code-only checkpoint.
- Preconditions: Clean documentation checkpoint and confirmation of intended ownership.
- Estimated urgency: Medium
- Status: Open
- Related files: `lib/`, `types/finance.ts`
- Related branch or commit: `prototype/functional-dashboard-v1`, `31c1605`

## Documentation Move State

- Date observed: 2026-08-03
- Observed during: Documentation restructuring
- Area: Git and documentation
- Description: Restructuring created deleted old paths and untracked replacement paths.
- Current impact: Documentation history is difficult to review until a clean documentation commit records the moves and additions.
- Risk if ignored: Valuable documents could remain outside a recoverable checkpoint or be mistaken for unrelated files.
- Suggested resolution: Consolidate and commit the documentation system separately from application code.
- Preconditions: Review all target documents and preserve foundational meaning.
- Estimated urgency: High
- Status: In progress
- Related files: `docs/`
- Related branch or commit: `docs/agent-operating-system-v1`

## Sample and Real Activity Separation

- Date observed: 2026-08-03
- Observed during: Functional dashboard prototype
- Area: Prototype data
- Description: The functional dashboard contains clearly labelled sample activity alongside support for real user-entered balances.
- Current impact: Cash-flow views are illustrative rather than fully personal.
- Risk if ignored: A person may confuse sample activity with real history as the prototype grows.
- Suggested resolution: Create an explicit boundary between sample mode and user-entered activity before adding more activity features.
- Preconditions: Approved manual activity specification and data-preservation plan.
- Estimated urgency: High
- Status: Open
- Related files: `lib/constants/sample-data.ts`, `app/page.tsx`
- Related branch or commit: `prototype/functional-dashboard-v1`, `31c1605`

## Shared Financial Calculation Layer

- Date observed: 2026-08-03
- Observed during: Dashboard implementation and Universe discussion
- Area: Domain calculations
- Description: The functional prototype and a future person-centred interface should use one calculation layer.
- Current impact: No current defect, but parallel presentation work could duplicate logic.
- Risk if ignored: Net worth, balances, and cash-flow values may diverge between interfaces.
- Suggested resolution: Define one tested calculation boundary before building a second presentation layer.
- Preconditions: Audit earlier `lib/` work and approve the next interface specification.
- Estimated urgency: Medium
- Status: Open
- Related files: `app/page.tsx`, `lib/calculations/`
- Related branch or commit: `prototype/functional-dashboard-v1`, `31c1605`

## Prototype Persistence and Migration

- Date observed: 2026-08-03
- Observed during: Functional dashboard prototype
- Area: Data persistence
- Description: Local storage is appropriate for the current prototype but has no deliberate long-term persistence or migration strategy.
- Current impact: Data remains local to a browser origin and device.
- Risk if ignored: Schema changes or browser changes could make personal data inaccessible.
- Suggested resolution: Define export, versioning, migration, and later persistence requirements before storage complexity is introduced.
- Preconditions: Validated manual data model and real use of the prototype.
- Estimated urgency: Medium
- Status: Accepted for prototype
- Related files: `app/page.tsx`, `lib/constants/storage-keys.ts`
- Related branch or commit: `prototype/functional-dashboard-v1`, `31c1605`

## Preserve Manual Account Behaviour During Redesign

- Date observed: 2026-08-03
- Observed during: Functional dashboard checkpoint
- Area: Regression safety
- Description: Future interface work must preserve manual account creation, editing, deletion, and stored values.
- Current impact: These behaviours work and provide the prototype's functional foundation.
- Risk if ignored: A visual redesign could remove the only real data workflow or lose user-entered values.
- Suggested resolution: Treat existing behaviour and stored data as acceptance criteria for interface experiments.
- Preconditions: Safe checkpoint and runtime regression checks.
- Estimated urgency: High
- Status: Ongoing constraint
- Related files: `app/page.tsx`
- Related branch or commit: `prototype/functional-dashboard-v1`, `31c1605`

## Recoverable Conventional Dashboard Checkpoint

- Date observed: 2026-08-03
- Observed during: Preparation for interface experimentation
- Area: Git safety
- Description: The conventional functional dashboard must remain recoverable while a person-centred interface is explored.
- Current impact: The branch and commit provide a known working baseline.
- Risk if ignored: Experiments could remove working functionality without a reliable comparison or recovery point.
- Suggested resolution: Keep the checkpoint branch intact and create new branches for significant presentation experiments.
- Preconditions: None.
- Estimated urgency: High
- Status: Mitigated
- Related files: Dashboard implementation files
- Related branch or commit: `prototype/functional-dashboard-v1`, `31c16052fa3cd221521bf5f01d0b3f7a7d0e5363`
## Current Relationship Candidate Origination

- Date observed: 2026-08-08
- Observed during: Action 14 deterministic relationship matching
- Area: Founder review workflow
- Description: Loan, Loan Repayment, and Reimbursement candidates can be created through the explicit engine API but do not yet have a dedicated Founder-facing origination control.
- Current impact: The Founder can review and decide these candidates once created, but cannot initiate one from the current minimal review page.
- Risk if ignored: Explicit relationship support remains incomplete for cases that cannot be discovered safely.
- Suggested resolution: Add a transaction-pair selection flow only when Founder/CTO approves that interaction.
- Preconditions: Preserve exact canonical references, Unknown, and the no-fuzzy/no-automatic-reimbursement boundary.
- Estimated urgency: Low
- Status: Open
- Related files: `lib/relationships/founder-relationship-service.ts`, `app/review/page.tsx`
