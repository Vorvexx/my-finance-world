# Lessons Learned

## Purpose

This document records durable learning from product work, engineering, workflow, user feedback, and AI collaboration. Lessons describe what changed our behaviour; they are not a diary of routine activity.

## Entry Template

```markdown
## YYYY-MM-DD — Lesson title

- Context:
- What happened:
- What we learned:
- Why it matters:
- Decision or behaviour changed:
- Where this should be applied:
- Related files, branch, task, or commit:
```

## 2026-08-03 — Conventional Dashboards Emerge Without Explicit Product Constraints

- Context: Build was asked for a usable finance prototype with functional requirements but insufficient visual and experiential constraints.
- What happened: The result was competent and functional but resembled a conventional financial dashboard rather than the Vorvex universe.
- What we learned: Functional requirements alone do not communicate the intended product experience.
- Why it matters: A technically successful implementation can still move the product away from its distinctive direction.
- Decision or behaviour changed: Future UI tasks must reference the mission, product principles, vision, data model, and a precise interaction specification.
- Where this should be applied: Every material interface task.
- Related files, branch, task, or commit: `prototype/functional-dashboard-v1`, `31c1605`

## 2026-08-03 — Separate Product Invention From Engineering Execution

- Context: Multiple AI roles were used for product thinking, review, and repository implementation.
- What happened: Build was effective at implementation, testing, branches, and commits but filled unspecified experience details with familiar patterns.
- What we learned: Core product invention and implementation execution require different ownership.
- Why it matters: Clear ownership improves both creativity and engineering reliability.
- Decision or behaviour changed: The founder and CTO define the experience, Build implements the specification, and Claude critiques difficult decisions.
- Where this should be applied: Product specifications, handoffs, and implementation reviews.
- Related files, branch, task, or commit: [AI Team](../06-ai/AI_TEAM.md)

## 2026-08-03 — The Prototype Leads and Documentation Follows

- Context: The project spent substantial time defining company and architecture documents before the first daily-use prototype was complete.
- What happened: Documentation improved clarity but began to displace building.
- What we learned: Documentation has high coordination value only when it supports working product and validated learning.
- Why it matters: Vorvex must not become a company that documents endlessly without shipping.
- Decision or behaviour changed: Every session should produce a working improvement, validated decision, or durable company asset; obvious useful prototype work should not wait for speculative documentation.
- Where this should be applied: Planning and task prioritization.
- Related files, branch, task, or commit: [Engineering Playbook](../06-ai/ENGINEERING_PLAYBOOK.md)

## 2026-08-03 — One Objective Per Agent Task

- Context: Mixed objectives created broad conversations and unclear implementation boundaries.
- What happened: Context became harder to manage and unrelated changes became more likely.
- What we learned: A single primary objective produces clearer specifications, safer execution, and better reporting.
- Why it matters: Focus protects momentum and repository safety.
- Decision or behaviour changed: Use one Claude conversation and one Build task for one primary objective.
- Where this should be applied: All agent assignments.
- Related files, branch, task, or commit: [Engineering Playbook](../06-ai/ENGINEERING_PLAYBOOK.md)

## 2026-08-03 — Git Checkpoints Make Experimentation Safe

- Context: A functional dashboard existed before a different visual direction was considered.
- What happened: A dedicated branch and commit preserved the working implementation.
- What we learned: A coherent checkpoint allows ambitious experimentation without sacrificing working behaviour.
- Why it matters: Safe reversibility encourages learning while protecting progress.
- Decision or behaviour changed: Create checkpoints before major interface or architecture experiments.
- Where this should be applied: Significant product experiments and refactors.
- Related files, branch, task, or commit: `prototype/functional-dashboard-v1`, `31c16052fa3cd221521bf5f01d0b3f7a7d0e5363`

## 2026-08-03 — Inspect Uncommitted Work Before Editing

- Context: The repository contained earlier documentation, helper, and type work.
- What happened: Build audited the working tree and isolated the functional dashboard checkpoint from unrelated changes.
- What we learned: File contents alone do not reveal ownership or task boundaries.
- Why it matters: Uncommitted work may be valuable and unrecoverable.
- Decision or behaviour changed: Every task begins with repository and Git inspection; unrelated work is preserved and reported.
- Where this should be applied: Every repository task.
- Related files, branch, task, or commit: `prototype/functional-dashboard-v1`, `31c1605`

## 2026-08-03 — AI Agents Are Replaceable; Company Knowledge Is Durable

- Context: Tools, context limits, and agent availability may change.
- What happened: Important reasoning was distributed across conversations and tools.
- What we learned: The company cannot depend on one agent's memory or chat history.
- Why it matters: Mission, decisions, architecture, lessons, and product principles must survive changes in tooling.
- Decision or behaviour changed: Store durable knowledge in the repository and keep agent instructions concise enough to direct contributors to it.
- Where this should be applied: Decisions, handoffs, and completion reporting.
- Related files, branch, task, or commit: `docs/`

## 2026-08-03 — Deferred Ideas Should Not Disappear

- Context: Strict scope protected implementation momentum while useful adjacent ideas emerged.
- What happened: Ideas risked being lost or implemented without prioritization.
- What we learned: Focus and institutional memory are compatible when findings have separate destinations.
- Why it matters: Vorvex should preserve valuable thinking without allowing it to broaden current work.
- Decision or behaviour changed: Record product ideas in the Parking Lot, engineering limitations in Technical Debt, and durable learning here.
- Where this should be applied: Every agent completion report.
- Related files, branch, task, or commit: [Parking Lot](./PARKING_LOT.md), [Technical Debt](../02-architecture/TECHNICAL_DEBT.md)

## 2026-08-03 — The Human Is the Centre; Money Is Connective Tissue

- Context: Early product discussion began with finance software concepts.
- What happened: Home, vehicle, pet, investment, collection, and life-history examples revealed a broader organizing principle.
- What we learned: Vorvex is not primarily an account, transaction, category, or budgeting system.
- Why it matters: The organizing model determines what the company can become.
- Decision or behaviour changed: Product and architecture decisions organize money around the person's life and Worlds.
- Where this should be applied: Product design, data modeling, navigation, and language.
- Related files, branch, task, or commit: [Mission](../00-company/MISSION.md), [Data Model](../02-architecture/DATA_MODEL.md)

## 2026-08-03 — UI Duplication May Be Correct While Data Duplication Is Not

- Context: A mortgage is relevant to Money, Home, cash flow, and timeline views.
- What happened: Treating one location as exclusively correct would weaken the user experience; copying the record would weaken data integrity.
- What we learned: One authoritative object should support multiple contextual views.
- Why it matters: People explore meaning from different perspectives and must receive consistent information in each.
- Decision or behaviour changed: Allow contextual repetition while enforcing one source of truth.
- Where this should be applied: Domain modeling, queries, and interface composition.
- Related files, branch, task, or commit: [Data Model](../02-architecture/DATA_MODEL.md)

## 2026-08-08 — Statement Dates Require Source-Bound Year Evidence

- Context: Production parsing of a sanitized real TD Chequing PDF.
- What happened: The embedded statement-period text exposed month and day but no year; the PDF's creation metadata supplied a corroborating year and date close to the period end.
- What we learned: A filename or the computer's current year is not reliable financial evidence, while tightly validated metadata inside the source can resolve an otherwise incomplete period.
- Why it matters: A plausible but incorrect year would silently corrupt transaction identity, ordering, deduplication, and history.
- Decision or behaviour changed: TD parser version 1 accepts an embedded year or, when it is absent, an exact PDF creation date no more than seven days after period end; otherwise it fails closed.
- Where this should be applied: Statement parsers, import provenance, and date normalization.
- Related files, branch, task, or commit: [Secure PDF Intake and Structural Analysis](../02-architecture/PDF_INTAKE.md), `td-chequing-pdf-v1`
