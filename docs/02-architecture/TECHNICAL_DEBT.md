# Technical Debt

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
