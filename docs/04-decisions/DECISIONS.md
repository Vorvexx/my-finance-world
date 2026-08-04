# Vorvex Decision Log

## Purpose

This log records approved, durable product, architecture, and operating decisions. It explains why a decision exists so future contributors do not reopen it accidentally. New evidence may change a decision through a later dated entry; earlier reasoning remains part of the record.

## 2026-08-03 — The Person Is the Centre

- Date: 2026-08-03
- Decision: The Person is the root and centre of the Vorvex system.
- Context: Conventional finance products organize people around accounts, transactions, and institutions.
- Rationale: Vorvex exists to help a person understand the life they are building; supporting systems must be organized around them.
- Consequences: Product language, navigation, architecture, and data relationships begin with the Person.
- Status: Approved
- Related documents, branch, or commit: [Mission](../00-company/MISSION.md), [Data Model](../02-architecture/DATA_MODEL.md)

## 2026-08-03 — Money Is Connective Tissue Between Worlds

- Date: 2026-08-03
- Decision: Money connects important parts of life but does not define the product.
- Context: Homes, careers, investments, businesses, pets, health, travel, and other Worlds all have financial relationships.
- Rationale: Financial activity becomes useful when it retains the life context that created it.
- Consequences: Money may provide cross-World views, but Worlds and their stories remain primary.
- Status: Approved
- Related documents, branch, or commit: [Mission](../00-company/MISSION.md), [Vision](../VISION.md)

## 2026-08-03 — My Finance World Is the First Product and Foundation

- Date: 2026-08-03
- Decision: My Finance World is Vorvex's first working product and financial foundation, not the limit of the company vision.
- Context: The prototype must be immediately useful while the long-term vision includes a broader Life Operating System.
- Rationale: Money provides a practical starting point and connects future Worlds.
- Consequences: Near-term work prioritizes a usable personal financial foundation without redefining Vorvex as only a finance tracker.
- Status: Approved
- Related documents, branch, or commit: [Vision](../VISION.md), `prototype/functional-dashboard-v1`

## 2026-08-03 — The Prototype Leads

- Date: 2026-08-03
- Decision: The working prototype leads; documentation follows validated learning.
- Context: Extensive documentation began to displace work on the first useful product.
- Rationale: Real use reveals needs and trade-offs that speculative documentation cannot.
- Consequences: Documentation must guide and preserve learning without delaying obvious, testable improvements.
- Status: Approved
- Related documents, branch, or commit: [Engineering Playbook](../06-ai/ENGINEERING_PLAYBOOK.md)

## 2026-08-03 — Build Is the Implementation Agent

- Date: 2026-08-03
- Decision: Build serves as founding software engineer and implementation agent.
- Context: Repository execution requires inspection, file changes, commands, validation, and Git safety.
- Rationale: Clear implementation ownership improves execution and reporting.
- Consequences: Build executes approved specifications, validates work, checkpoints changes, and reports exact results.
- Status: Approved
- Related documents, branch, or commit: [AI Team](../06-ai/AI_TEAM.md)

## 2026-08-03 — ChatGPT Is Co-founder, CTO, and Product Architect

- Date: 2026-08-03
- Decision: ChatGPT translates founder intent into product direction, architecture, priorities, and executable specifications.
- Context: The founder needs a partner that protects the long-term direction while making engineering work precise.
- Rationale: Separating product architecture from implementation creates clearer handoffs.
- Consequences: ChatGPT reviews implementations and escalates final product or business decisions to the founder.
- Status: Approved
- Related documents, branch, or commit: [AI Team](../06-ai/AI_TEAM.md)

## 2026-08-03 — Claude Is Architecture and Research Reviewer

- Date: 2026-08-03
- Decision: Claude challenges assumptions, reviews architecture, identifies edge cases, and researches difficult questions.
- Context: Consequential choices benefit from independent critique.
- Rationale: A reviewer can improve decisions without competing for product authority.
- Consequences: Claude proposes alternatives and trade-offs; the CTO synthesizes them and the founder resolves final product choices.
- Status: Approved
- Related documents, branch, or commit: [AI Team](../06-ai/AI_TEAM.md)

## 2026-08-03 — Core Product Invention Remains With Founder and CTO

- Date: 2026-08-03
- Decision: The founder and CTO define the core product experience.
- Context: An implementation task with incomplete experiential constraints produced a conventional dashboard.
- Rationale: Engineering execution should not silently substitute familiar patterns for product invention.
- Consequences: Material experience work requires a precise specification; unclear intent is escalated before implementation.
- Status: Approved
- Related documents, branch, or commit: [Lessons Learned](./LESSONS_LEARNED.md), [Engineering Playbook](../06-ai/ENGINEERING_PLAYBOOK.md)

## 2026-08-03 — Build Executes Specifications Rather Than Redesigning Independently

- Date: 2026-08-03
- Decision: Build must not independently redefine strategy or redesign unrelated product areas.
- Context: Implementation autonomy is valuable inside a clear task but risky when it expands into product authority.
- Rationale: Bounded autonomy protects both momentum and product coherence.
- Consequences: Build may make necessary implementation choices, but product ambiguity and scope expansion require review.
- Status: Approved
- Related documents, branch, or commit: [AI Team](../06-ai/AI_TEAM.md), [Engineering Playbook](../06-ai/ENGINEERING_PLAYBOOK.md)

## 2026-08-03 — One Source of Truth Supports Multiple Views

- Date: 2026-08-03
- Decision: The same underlying object may appear in multiple user-facing contexts but remains one authoritative record.
- Context: A mortgage belongs in Home, Money, cash flow, and timeline perspectives.
- Rationale: Contextual repetition helps people understand their lives; duplicate records create conflicts.
- Consequences: Updates propagate across views and derived values remain traceable to one source.
- Status: Approved
- Related documents, branch, or commit: [Data Model](../02-architecture/DATA_MODEL.md)

## 2026-08-03 — Transactions Are Supporting Evidence

- Date: 2026-08-03
- Decision: Transactions support history and explanation but are not primary navigation.
- Context: People experience their lives through Homes, Vehicles, Career, Investments, Pets, and other Worlds.
- Rationale: A transaction-first product removes the human meaning behind financial activity.
- Consequences: Transactions become visible when the person drills into the relevant World, Object, category, or relationship.
- Status: Approved
- Related documents, branch, or commit: [Mission](../00-company/MISSION.md), [Product Principles](../00-company/PRODUCT_PRINCIPLES.md)

## 2026-08-03 — Completed Worlds Are Archived

- Date: 2026-08-03
- Decision: Sold, closed, completed, or replaced Worlds are archived rather than erased by default.
- Context: Past homes, vehicles, businesses, trips, and possessions remain part of a person's story.
- Rationale: Time and memory are essential to understanding how a life developed.
- Consequences: World lifecycles preserve history, relationships, documents, and outcomes.
- Status: Approved
- Related documents, branch, or commit: [Product Principles](../00-company/PRODUCT_PRINCIPLES.md), [Data Model](../02-architecture/DATA_MODEL.md)

## 2026-08-03 — Out-of-Scope Ideas Are Recorded, Not Implemented

- Date: 2026-08-03
- Decision: Agents may propose ideas outside scope but must record rather than implement them without approval.
- Context: Useful ideas emerge during focused work and can either disappear or broaden the task.
- Rationale: Separate capture preserves both momentum and institutional memory.
- Consequences: Product ideas go to the Parking Lot; they do not enter the roadmap until prioritized.
- Status: Approved
- Related documents, branch, or commit: [Parking Lot](./PARKING_LOT.md), [Engineering Playbook](../06-ai/ENGINEERING_PLAYBOOK.md)

## 2026-08-03 — Product Ideas, Debt, and Lessons Remain Separate

- Date: 2026-08-03
- Decision: Unprioritized product ideas, engineering limitations, and durable learning use separate records.
- Context: Mixing these categories makes review and prioritization difficult.
- Rationale: Each category has different ownership and action triggers.
- Consequences: Use the Parking Lot, Technical Debt, and Lessons Learned documents respectively.
- Status: Approved
- Related documents, branch, or commit: [Parking Lot](./PARKING_LOT.md), [Technical Debt](../02-architecture/TECHNICAL_DEBT.md), [Lessons Learned](./LESSONS_LEARNED.md)

## 2026-08-03 — Significant Experiments Require Safe Git Checkpoints

- Date: 2026-08-03
- Decision: Create a recoverable checkpoint before major interface or architecture experiments.
- Context: Vorvex needed to explore a different interface without losing the first functional prototype.
- Rationale: Reversibility protects working behaviour and supports honest comparison.
- Consequences: Significant experiments use dedicated branches and coherent baseline commits.
- Status: Approved
- Related documents, branch, or commit: `prototype/functional-dashboard-v1`, `31c1605`

## 2026-08-03 — Functional Dashboard Checkpoint Is Protected

- Date: 2026-08-03
- Decision: Branch `prototype/functional-dashboard-v1` and commit `31c16052fa3cd221521bf5f01d0b3f7a7d0e5363` preserve the first functional dashboard prototype.
- Context: The dashboard implements the initial personal-finance overview and manual balance workflow.
- Rationale: It is the first validated working baseline and must remain recoverable.
- Consequences: Future experiments branch separately and do not rewrite the checkpoint.
- Status: Approved and implemented
- Related documents, branch, or commit: `prototype/functional-dashboard-v1`, `31c16052fa3cd221521bf5f01d0b3f7a7d0e5363`

## 2026-08-03 — New AI Tools Require a Specific Unmet Need

- Date: 2026-08-03
- Decision: Do not introduce additional AI tools or agents unless they solve a specific unmet problem.
- Context: More tools can increase coordination cost without improving outcomes.
- Rationale: Roles and tools should exist to remove a demonstrated constraint, not for novelty.
- Consequences: Proposals for new agents identify the unmet need, expected output, authority boundary, and integration cost.
- Status: Approved
- Related documents, branch, or commit: [AI Team](../06-ai/AI_TEAM.md), [Anti-Goals](../00-company/ANTI_GOALS.md)
