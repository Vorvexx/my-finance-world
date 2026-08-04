# Product Parking Lot

## Purpose

This document preserves valuable product ideas that are intentionally not being implemented because they are outside the current task, premature, uncertain, or lower priority.

The parking lot is not a roadmap, commitment, or promise. An item moves to the [roadmap](../05-roadmap/ROADMAP.md) only after explicit prioritization.

## Rules

- Agents may identify ideas outside their assigned scope.
- Agents must not implement those ideas without approval.
- Meaningful ideas should be recorded rather than silently discarded.
- Entries must remain concise enough to review.
- Duplicate ideas should be consolidated.
- Rejected ideas remain recorded with the reason.
- Status does not imply priority.

## Entry Template

```markdown
## Idea title

- Date discovered:
- Discovered during:
- Proposed by:
- Problem or opportunity:
- Idea:
- Potential user value:
- Why it was deferred:
- Dependencies:
- Risks:
- Relevant Worlds:
- Review trigger:
- Status: Unreviewed / Review later / Accepted / Rejected / Implemented
- Related task, branch, commit, or decision:
```

## Unprioritized Ideas

### Manual Activity Editor

- Date discovered: 2026-08-03
- Discovered during: Functional dashboard prototype
- Proposed by: Build
- Problem or opportunity: Sample cash-flow activity cannot represent the founder's real day-to-day activity.
- Idea: Replace sample activity with a small manual editor for inflows, outflows, and expected activity.
- Potential user value: Makes cash-flow summaries personally useful without bank integrations.
- Why it was deferred: Outside the functional-dashboard checkpoint.
- Dependencies: Clear separation between sample and user-entered data.
- Risks: Activity entry could become transaction-first navigation.
- Relevant Worlds: Money and all Worlds that generate activity
- Review trigger: Before the next cash-flow implementation task.
- Status: Unreviewed
- Related task, branch, commit, or decision: `prototype/functional-dashboard-v1`, `31c1605`

### Person-Centred Visual Universe

- Date discovered: 2026-08-03
- Discovered during: Review of the functional dashboard
- Proposed by: Founder and CTO
- Problem or opportunity: A conventional stacked-card dashboard does not express the Vorvex universe.
- Idea: Build a person-centred visual universe while preserving the functional financial engine.
- Potential user value: Makes exploration begin with the person and their Worlds.
- Why it was deferred: Requires a precise interaction specification and a protected checkpoint.
- Dependencies: Functional engine, mission, principles, vision, and data model.
- Risks: Visual novelty could reduce clarity or hide essential information.
- Relevant Worlds: All
- Review trigger: When the founder and CTO approve the next interface specification.
- Status: Review later
- Related task, branch, commit, or decision: `prototype/functional-dashboard-v1`, `31c1605`

### Progressive Life Drill-Down

- Date discovered: 2026-08-03
- Discovered during: Permanent architecture definition
- Proposed by: Founder and CTO
- Problem or opportunity: People need summary and depth without seeing all complexity at once.
- Idea: Support progressive exploration from Person to World to Object to Event.
- Potential user value: Allows every number and object to reveal its complete context.
- Why it was deferred: Requires product testing and a scoped interaction design.
- Dependencies: Stable identities and contextual navigation.
- Risks: Deep hierarchy may disorient users if context is lost.
- Relevant Worlds: All
- Review trigger: Before defining the first full World experience.
- Status: Review later
- Related task, branch, commit, or decision: [Data Model](../02-architecture/DATA_MODEL.md)

### World Archive and Life History

- Date discovered: 2026-08-03
- Discovered during: Mission and product-principles work
- Proposed by: Founder and CTO
- Problem or opportunity: Sold, closed, replaced, or completed Worlds remain part of a person's story.
- Idea: Provide an archive and life-history view for completed Worlds and Objects.
- Potential user value: Preserves memories, outcomes, and long-term progress.
- Why it was deferred: The active-World prototype must be validated first.
- Dependencies: World lifecycle and time model.
- Risks: Poor information hierarchy could create clutter.
- Relevant Worlds: All
- Review trigger: When the first World lifecycle is implemented.
- Status: Review later
- Related task, branch, commit, or decision: [Product Principles](../00-company/PRODUCT_PRINCIPLES.md)

### World Maintenance and Service Reminders

- Date discovered: 2026-08-03
- Discovered during: World examples discussion
- Proposed by: Founder
- Problem or opportunity: Important services, renewals, warranties, and maintenance are easy to miss.
- Idea: Track reminders and future actions inside Homes, Vehicles, Phones, Appliances, Pets, and similar Worlds.
- Potential user value: Helps the person maintain what they own and care for.
- Why it was deferred: Premature before the core World and Event experience exists.
- Dependencies: Events, dates, status, and notification policy.
- Risks: Excessive or inaccurate reminders could create noise.
- Relevant Worlds: Homes, Vehicles, Phones, Appliances, Pets
- Review trigger: After the first World supports dated Events.
- Status: Unreviewed
- Related task, branch, commit, or decision: [Data Model](../02-architecture/DATA_MODEL.md)

### “What Did You Build?” Framing

- Date discovered: 2026-08-03
- Discovered during: Product philosophy discussion
- Proposed by: Founder and CTO
- Problem or opportunity: Spending analysis often creates guilt and removes life context.
- Idea: Frame financial activity around what it built, enabled, maintained, or changed.
- Potential user value: Creates clarity and pride without hiding financial consequences.
- Why it was deferred: Requires testing against real user activity and language.
- Dependencies: Events linked to Worlds and Objects.
- Risks: Positive framing must not obscure loss, risk, or obligation.
- Relevant Worlds: All
- Review trigger: Before redesigning spending and cash-flow explanations.
- Status: Review later
- Related task, branch, commit, or decision: [Mission](../00-company/MISSION.md)

### Home Buy-versus-Rent Analysis

- Date discovered: 2026-08-03
- Discovered during: Home World discussion
- Proposed by: Founder
- Problem or opportunity: Generic comparisons do not reflect a person's real housing history and priorities.
- Idea: Compare buying and renting using the person's historical Home World.
- Potential user value: Provides contextual decision support grounded in lived experience.
- Why it was deferred: Requires reliable history, assumptions, and comparison rules.
- Dependencies: Complete Home World and explainable calculations.
- Risks: False precision or universal recommendations.
- Relevant Worlds: Homes, Money, Career, Investments
- Review trigger: After real Home World history is available.
- Status: Unreviewed
- Related task, branch, commit, or decision: [Vision](../VISION.md)

### Complete Asset Ownership Outcome

- Date discovered: 2026-08-03
- Discovered during: Home, vehicle, and collection discussions
- Proposed by: Founder
- Problem or opportunity: A sale price alone does not explain the complete outcome of ownership.
- Idea: Show total cost, gain or loss, use, improvements, financing, and history when an asset is sold.
- Potential user value: Helps the person understand the full story without judgment.
- Why it was deferred: Requires complete, trustworthy Event history.
- Dependencies: Time, Events, valuations, and linked financial activity.
- Risks: Missing data may make outcomes misleading.
- Relevant Worlds: Homes, Vehicles, Investments, Collections, Possessions
- Review trigger: Before implementing the first sale or archive flow.
- Status: Unreviewed
- Related task, branch, commit, or decision: [Data Model](../02-architecture/DATA_MODEL.md)

### Contextual Assistant Within Each World

- Date discovered: 2026-08-03
- Discovered during: Long-term vision work
- Proposed by: Founder and CTO
- Problem or opportunity: A generic chat screen lacks the context of what the person is exploring.
- Idea: Place a context-aware assistant inside each World.
- Potential user value: Makes explanations and decision support relevant to the current subject.
- Why it was deferred: The World experience and trustworthy context must exist first.
- Dependencies: World context, provenance, and explainable reasoning.
- Risks: Unsupported advice or unclear assumptions.
- Relevant Worlds: All
- Review trigger: After one World is useful without an assistant.
- Status: Review later
- Related task, branch, commit, or decision: [Vision](../VISION.md)

### World Documents and Future Actions

- Date discovered: 2026-08-03
- Discovered during: World examples discussion
- Proposed by: Founder
- Problem or opportunity: Documents, warranties, renewals, service history, and future actions are fragmented.
- Idea: Preserve these materials and actions within the relevant World and Object.
- Potential user value: Makes each World practically useful beyond financial reporting.
- Why it was deferred: Core Objects and Events are not yet implemented.
- Dependencies: Object identity, documents, Events, and lifecycle.
- Risks: Privacy, retention, and information overload.
- Relevant Worlds: All
- Review trigger: When defining the first World's complete story.
- Status: Unreviewed
- Related task, branch, commit, or decision: [Data Model](../02-architecture/DATA_MODEL.md)

### Independent Sub-Worlds

- Date discovered: 2026-08-03
- Discovered during: Collections and ownership discussion
- Proposed by: Founder
- Problem or opportunity: Multiple properties, vehicles, investments, and possessions need independent identities and histories.
- Idea: Allow each important item to become a sub-World when its story warrants it.
- Potential user value: Supports depth without forcing every item into the same level of detail.
- Why it was deferred: The boundary between World and Object needs product testing.
- Dependencies: Nested relationships and clear navigation.
- Risks: Excessive fragmentation.
- Relevant Worlds: Homes, Vehicles, Investments, Collections, Possessions
- Review trigger: When one category contains multiple meaningful items.
- Status: Review later
- Related task, branch, commit, or decision: [Product Principles](../00-company/PRODUCT_PRINCIPLES.md)

### Life Timeline Navigation

- Date discovered: 2026-08-03
- Discovered during: Time and historical-storytelling discussion
- Proposed by: Founder and CTO
- Problem or opportunity: Current-state views do not explain how the person's life changed.
- Idea: Navigate across financial and life history through a connected timeline.
- Potential user value: Makes causes, milestones, and relationships visible through time.
- Why it was deferred: Requires reliable dated Events across Worlds.
- Dependencies: Event history and cross-World relationships.
- Risks: Dense timelines may obscure rather than explain.
- Relevant Worlds: All
- Review trigger: After multiple Worlds contain meaningful history.
- Status: Unreviewed
- Related task, branch, commit, or decision: [Vision](../VISION.md)

### Reusable World Anatomy

- Date discovered: 2026-08-03
- Discovered during: World Engine discussion
- Proposed by: CTO
- Problem or opportunity: Worlds may benefit from common concepts without becoming identical templates.
- Idea: Test whether overview, objects, timeline, documents, insights, and future actions form a reusable anatomy.
- Potential user value: Creates predictable exploration across different Worlds.
- Why it was deferred: Common structure must emerge from tested Worlds rather than speculation.
- Dependencies: At least two useful World implementations.
- Risks: Premature standardization may flatten meaningful differences.
- Relevant Worlds: All
- Review trigger: After two distinct Worlds have been tested.
- Status: Review later
- Related task, branch, commit, or decision: [Product Principles](../00-company/PRODUCT_PRINCIPLES.md)
