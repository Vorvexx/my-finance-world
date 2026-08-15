# Vorvex Engineering Playbook

**Status:** Superseded historical guidance

This playbook is preserved as historical context. The [Engineering Operating Manual](../engineering/ENGINEERING_OPERATING_MANUAL.md) is the permanent authority for current engineering work. Where this playbook differs from the manual, follow the manual.

## Purpose

This playbook defines how human and AI contributors execute engineering work at Vorvex. It keeps contributors aligned with the company direction while enabling fast, independent execution inside an approved task.

The playbook does not replace product judgment or permanent company documents. It defines the discipline for turning an approved objective into a safe, validated result.

## Hierarchy of Authority

When sources conflict, use this order:

1. Explicit current founder decision
2. Approved task specification
3. [Mission](../00-company/MISSION.md)
4. [Product Principles](../00-company/PRODUCT_PRINCIPLES.md)
5. [Vision](../VISION.md)
6. [Data Model and Architecture](../02-architecture/DATA_MODEL.md)
7. [Recorded Decisions](../04-decisions/DECISIONS.md)
8. Engineering Playbook
9. Existing implementation patterns
10. Agent preference

An agent must not silently override a higher-level source. When a conflict could materially change the outcome, stop, identify the conflict, and request review from the next human authority.

## Task Discipline

Every implementation task must define:

- One primary objective
- The business or user reason
- Explicit scope
- Out-of-scope items
- Constraints
- Acceptance criteria
- Definition of done

Agents must not broaden a task without approval. Necessary implementation work that remains within the stated outcome is allowed; adjacent product ideas are not.

Use one agent conversation or task for one primary objective. If a second objective emerges, complete or checkpoint the current objective and create a separate task.

## Product Discipline

- Keep the person at the centre of the system.
- Treat Worlds as more important than conventional application pages.
- Use money to connect Worlds rather than define the experience.
- Treat transactions as evidence and history, not primary navigation.
- Avoid conventional finance-dashboard patterns unless the specification explicitly requires them.
- Do not invent core UX when product intent is materially unclear.
- Do not redesign unrelated areas.
- Preserve working behaviour unless the task explicitly changes it.
- Prefer prototype usefulness over speculative architecture.
- Build the smallest coherent improvement that can be tested by a real person.
- Do not add integrations, authentication, infrastructure, or complexity before they are needed.
- Prefer honest manual use over fake sophistication.
- Preserve user-entered data through changes and experiments.
- Use neutral, non-judgmental language.
- Do not manipulate engagement or reduce a person to a score.

## Engineering Discipline

- Inspect the repository and applicable instructions before editing.
- Inspect the current Git branch and working tree before editing.
- Separate current-task work from pre-existing changes.
- Never discard, overwrite, stage, or commit unrelated uncommitted work.
- Create branches or checkpoints before significant changes.
- Make small, coherent commits.
- Do not mix documentation, refactoring, and new features in one commit unless the task cannot be completed safely otherwise.
- Avoid large rewrites without an explicit reason.
- Refactor only as much as required to deliver the task safely.
- Keep one authoritative source of truth even when information appears in several views.
- Validate types, linting, builds, and runtime behaviour in proportion to the change.
- Report failures, incomplete validation, and uncertainty honestly.
- Do not claim success without evidence.
- Explain important trade-offs and irreversible consequences.
- Maintain offline and local operation where practical during the prototype phase.
- Use sample data only when clearly labelled.
- Never allow sample data to masquerade as real user data.

## Unclear Requirements

When product intent is materially ambiguous:

1. Stop before implementing the ambiguous portion.
2. Ask the smallest number of high-impact questions.
3. State assumptions and their consequences.
4. Continue only with safe, reversible work when that work remains useful under likely answers.

Do not use minor uncertainty as a reason to avoid progress. Resolve discoverable facts from the repository and existing documents before asking the founder.

## Prototype-First Rule

The working prototype leads.

Documentation should guide implementation, but it must not delay an obvious, useful, testable improvement. Architecture exists to support progress and preserve coherence, not to become a speculative prerequisite for every feature.

Build the smallest useful version, test it, and capture the durable lessons that the prototype reveals. Documentation follows validated learning.

## Institutional Memory

Agents are encouraged to identify product opportunities, risks, technical debt, research questions, architectural concerns, and possible enhancements. They must complete the assigned task first and must not implement out-of-scope ideas without approval.

Record meaningful findings in the correct location:

- Unprioritized product idea → [Parking Lot](../04-decisions/PARKING_LOT.md)
- Engineering limitation → [Technical Debt](../02-architecture/TECHNICAL_DEBT.md)
- Durable learning → [Lessons Learned](../04-decisions/LESSONS_LEARNED.md)
- Approved architectural or product choice → [Decision Log](../04-decisions/DECISIONS.md)
- Prioritized future work → [Roadmap](../05-roadmap/ROADMAP.md)

Do not flood these documents with trivial observations. Consolidate duplicates, include enough context to support future review, and report additions in the task completion summary.

## Completion Report

Every Build task ends with:

- Objective completed
- Files changed
- Behaviour changed
- Validation performed
- Assumptions
- Questions requiring founder or CTO review
- Deferred product ideas
- Technical debt observed
- Lessons learned
- Risks
- Recommended next task
- Git branch and commit, when applicable
- Files deliberately left uncommitted

Sections with no findings may say “None.” The report must distinguish completed work from recommendations.
