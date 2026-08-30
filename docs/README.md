# Vorvex Documentation

This directory is Vorvex's durable source of company, product, architecture, decision, and operating knowledge. The working prototype leads; documentation preserves the direction and lessons needed to build it coherently.

## Documentation Structure

- [`00-company/`](./00-company/) — Permanent purpose, principles, and refusals
- [`01-product/`](./01-product/) — Product definitions and user understanding
- [`02-architecture/`](./02-architecture/) — Permanent architecture, current technical structure, and technical debt
- [`03-research/`](./03-research/) — Product and market research
- [`04-decisions/`](./04-decisions/) — Approved decisions, deferred ideas, and durable lessons
- [`05-roadmap/`](./05-roadmap/) — Explicitly prioritized future work
- [`06-ai/`](./06-ai/) — Contributor roles and historical AI/engineering guidance
- [`engineering/`](./engineering/) — Current engineering operating practice
- [`CHANGELOG.md`](./CHANGELOG.md) — Product-level history of shipped changes

## Foundational Documents

- [Mission](./00-company/MISSION.md) — Why Vorvex exists
- [Vision](./VISION.md) — The ten-year North Star
- [Product Principles](./00-company/PRODUCT_PRINCIPLES.md) — Non-negotiable product behaviour
- [Anti-Goals](./00-company/ANTI_GOALS.md) — What Vorvex refuses to become
- [Data Model](./02-architecture/DATA_MODEL.md) — Person → Worlds → Objects → Events → Money
- [Canonical Transaction Ingestion](./02-architecture/TRANSACTION_INGESTION.md) — Provider-independent transaction boundary
- [Homepage Financial View](./02-architecture/HOMEPAGE_FINANCIAL_VIEW.md) — Server-only aggregation and browser-safe homepage DTO
- [Canonical Financial Analytics](./02-architecture/FINANCIAL_ANALYTICS.md) — Shared effective read model, reusable analytics, and evidence limits
- [Human Review and Continuous Learning](./02-architecture/HUMAN_REVIEW_AND_LEARNING.md) — Durable uncertainty, confirmation, and reversible local learning
- [Canonical Transaction Relationships](./02-architecture/TRANSACTION_RELATIONSHIPS.md) — Exact relationship candidates, Founder confirmation, and separate encrypted persistence
- [Local Transaction Persistence](./02-architecture/LOCAL_TRANSACTION_PERSISTENCE.md) — Durable import journal, encrypted payloads, and local commit boundary
- [Automatic Bank Statement Drop Folder](./02-architecture/STATEMENT_DROP_FOLDER.md) — Local detection, classification, routing, and safe source lifecycle
- [Founder Production Runtime v1](./02-architecture/FOUNDER_PRODUCTION_RUNTIME.md) — Keychain custody, provisioning, LaunchAgent lifecycle, launcher, health, and recovery boundary

## Operating System

- [Engineering Operating Manual](./engineering/ENGINEERING_OPERATING_MANUAL.md) — Permanent authority for how engineering work is understood, executed, validated, documented, and checkpointed
- [Engineering Playbook](./06-ai/ENGINEERING_PLAYBOOK.md) — Superseded guidance preserved for historical context
- [AI Team and Roles](./06-ai/AI_TEAM.md) — Authority, responsibilities, outputs, and escalation paths
- [Decision Log](./04-decisions/DECISIONS.md) — Approved durable choices and their rationale
- [Parking Lot](./04-decisions/PARKING_LOT.md) — Unprioritized product ideas
- [Lessons Learned](./04-decisions/LESSONS_LEARNED.md) — Learning that changed behaviour
- [Technical Debt](./02-architecture/TECHNICAL_DEBT.md) — Engineering limitations and cleanup triggers
- [Roadmap](./05-roadmap/ROADMAP.md) — Prioritized future work

## Where Should This Go?

- Permanent purpose → Mission
- Long-term destination → Vision
- Non-negotiable product behaviour → Product Principles
- Company refusal or prohibition → Anti-Goals
- Architecture → `02-architecture/`
- Product research → `03-research/`
- Approved durable decision → Decision Log
- Unprioritized product idea → Parking Lot
- Engineering limitation → Technical Debt
- Durable learning → Lessons Learned
- Prioritized future work → Roadmap
- Engineering operating practice → `engineering/`
- AI contributor roles and historical guidance → `06-ai/`
- Shipped change → Changelog

Prefer updating the appropriate existing document over creating a duplicate. Keep entries concise, preserve earlier reasoning, and separate approved decisions from proposals.
