# Vorvex Product Principles

## Purpose

These principles define how Vorvex should behave as a product and how it should be built. They are durable constraints, not feature ideas or interface conventions.

Use them when evaluating product scope, data models, architecture, interaction design, and implementation trade-offs. When two approaches appear reasonable, prefer the one that follows these principles more closely.

## 1. The Person Comes First

### Why It Exists

Vorvex represents a person's life. Accounts, institutions, assets, liabilities, documents, transactions, and Worlds exist to help that person understand what they have built and what requires attention. The system must never place its own structure ahead of the person's mental model.

### Engineering Implications

- Model ownership and relationships from the person's perspective rather than from an institution's schema.
- Keep the person as the root of the domain model.
- Do not require a bank, account, or transaction before a person can represent something important.
- Prefer language and abstractions that describe real life over internal database terminology.
- Treat personal control, privacy, and data portability as foundational requirements.

### UX Implications

- Begin with the person's current situation, not a list of accounts or product features.
- Use language that reflects how people describe their lives.
- Make institutional details available when useful without allowing them to dominate navigation.
- Help the person feel informed and in control after every meaningful interaction.

## 2. Worlds Over Pages

### Why It Exists

People think about their home, car, career, investments, business, pets, health, travel, and collections as meaningful parts of life. They do not naturally think in application pages or database tables. Vorvex organizes information into Worlds that match these durable mental models.

### Engineering Implications

- Represent a World as a first-class domain object with identity, relationships, history, and lifecycle.
- Build shared capabilities that can apply across many kinds of Worlds.
- Avoid creating disconnected feature silos for each new subject.
- Allow Worlds to reference other Worlds and shared underlying objects.
- Design new features around what a World needs rather than where a page belongs in navigation.

### UX Implications

- Let people enter and explore a World rather than navigate a collection of dashboards.
- Give every World a coherent overview, story, current state, and relevant next actions.
- Keep navigation anchored in recognizable parts of the person's life.
- Present shared information in each World where it provides useful context.

## 3. Drill Down Forever

### Why It Exists

Every meaningful object contains more detail. A home contains a mortgage, maintenance, rooms, appliances, documents, and events. An investment contains contributions, holdings, returns, fees, and decisions. Vorvex should support deeper understanding without forcing all detail onto the first screen.

### Engineering Implications

- Give important objects stable identities so they can be addressed and explored independently.
- Support parent, child, and linked relationships without imposing arbitrary depth limits.
- Keep summary data traceable to the underlying records that produced it.
- Design APIs and storage models for progressive retrieval rather than large, flattened payloads.
- Preserve context and navigation paths as a person moves between levels.

### UX Implications

- Start with a clear summary and reveal detail progressively.
- Make important numbers, objects, and relationships explorable.
- Keep the person oriented by showing where they are and how to return.
- Do not expose complexity until the person asks for it through an action or question.

## 4. No Judgement

### Why It Exists

Financial decisions are shaped by circumstance, opportunity, necessity, responsibility, ambition, and incomplete information. Software rarely knows the full story. Vorvex provides understanding without assigning shame, virtue, or a universal definition of success.

### Engineering Implications

- Do not encode moral labels into financial states or classifications.
- Separate factual observations from recommendations and assumptions.
- Avoid scores that reduce a person's life to a single judgment.
- Make comparison logic transparent and configurable when personal priorities differ.
- Test generated language and alerts for guilt, alarmism, and unsupported conclusions.

### UX Implications

- Use neutral, factual language for debt, spending, losses, and missed plans.
- Explain consequences and options without declaring a person good or bad.
- Celebrate progress without turning another outcome into failure.
- Reserve urgent language for genuinely urgent conditions.

## 5. Explain Everything

### Why It Exists

A number without context creates uncertainty. Every balance, total, change, estimate, and recommendation should be able to answer: “Why is this true?” Trust depends on visible reasoning and traceable sources.

### Engineering Implications

- Store provenance for calculated and imported values.
- Make calculations deterministic, testable, and inspectable.
- Distinguish facts, user-entered values, estimates, forecasts, and assumptions.
- Preserve the inputs required to reproduce important totals and insights.
- Do not produce a recommendation that cannot identify the evidence and reasoning behind it.

### UX Implications

- Allow a person to inspect how a number was calculated.
- Label estimates, forecasts, and incomplete data clearly.
- Explain changes in plain language and identify their main causes.
- Place context close to the value it explains rather than hiding it in general help content.

## 6. Time Matters

### Why It Exists

A person's life cannot be understood from a current snapshot alone. Every World has a beginning, changes, milestones, commitments, and possible futures. Time explains how the present came to exist.

### Engineering Implications

- Treat time as a core dimension of the data model.
- Preserve effective dates, recorded dates, and source dates where they differ.
- Prefer append-only history or explicit revisions for meaningful changes.
- Support past, present, and expected future states without overwriting one with another.
- Make time-range calculations consistent across the product.

### UX Implications

- Show what changed, when it changed, and what caused the change.
- Let people move through useful time ranges while retaining context.
- Separate recorded history from future expectations.
- Use timelines when sequence and development matter more than a static list.

## 7. Preserve Memories

### Why It Exists

Important parts of life remain meaningful after they are sold, completed, closed, or replaced. A past home, vehicle, business, trip, collection, or achievement is part of the person's story. Completion should not mean disappearance.

### Engineering Implications

- Archive meaningful objects instead of deleting them by default.
- Preserve relationships, history, documents, and calculated outcomes after a World becomes inactive.
- Make destructive operations explicit, narrow, and recoverable wherever practical.
- Maintain stable identifiers so historical references do not break.
- Design retention and export capabilities alongside creation and editing.

### UX Implications

- Distinguish active Worlds from archived Worlds without treating archived information as clutter.
- Make past Worlds easy to revisit when the person chooses.
- Preserve meaningful milestones and outcomes in their original context.
- Explain what deletion will remove and offer safer alternatives when available.

## 8. Reduce Cognitive Load

### Why It Exists

A complete model of a life is necessarily complex. That complexity belongs in the system, not in the person's immediate view. Vorvex should show what matters now and make deeper detail available when needed.

### Engineering Implications

- Build summary layers that are consistent with their underlying details.
- Prioritize information using explicit, testable rules rather than arbitrary interface order.
- Support contextual retrieval so clients do not need to load or present everything at once.
- Use shared definitions for status, urgency, and importance.
- Resist features that add permanent interface complexity for rare cases.

### UX Implications

- Lead with the current position, meaningful changes, and near-term attention.
- Use progressive disclosure instead of dense screens.
- Prefer a few clear choices over many weakly differentiated options.
- Hide detailed transactions until the person enters the relevant World, category, or explanation.
- Remove information that does not help the person make sense of the current context.

## 9. One Source of Truth

### Why It Exists

The same information may be relevant in many places. A mortgage belongs to a home, liabilities, cash flow, and future commitments. Showing it in each place is useful; storing conflicting copies is not.

### Engineering Implications

- Give each underlying object one authoritative identity and source of truth.
- Represent multiple appearances through relationships, queries, and views rather than duplicated records.
- Define ownership and update rules for shared data.
- Make derived values reproducible from authoritative sources.
- Handle conflicts explicitly instead of silently choosing whichever copy was updated last.

### UX Implications

- Show information wherever it helps the person understand the current World.
- Keep names, balances, status, and history consistent across views.
- Let an update made in one context appear everywhere the object is represented.
- Avoid exposing technical distinctions between a source object and its contextual views.

## 10. Delight Through Discovery

### Why It Exists

Understanding one's own life should feel rewarding. Vorvex should help people notice connections, progress, memories, and consequences they could not easily see before. Delight should come from discovery and clarity, not distraction or habit-forming mechanics.

### Engineering Implications

- Build relationships and history so the product can reveal meaningful connections.
- Prefer accurate, relevant discoveries over frequent or generic observations.
- Keep discovery logic explainable and grounded in the person's own information.
- Measure usefulness and confidence gained rather than time spent or interactions generated.
- Do not use artificial scarcity, streaks, or manipulative engagement systems.

### UX Implications

- Surface meaningful changes, milestones, and relationships at appropriate moments.
- Make exploration feel responsive, calm, and coherent.
- Use visual emphasis to reward understanding rather than demand attention.
- Allow discovery to emerge naturally as a person explores their Worlds.

## Applying These Principles

Product and engineering proposals should identify which principles they support and where they create tension. A proposal that conflicts with a principle requires an explicit reason, a limited scope, and a plan to prevent the exception from becoming the default.

These principles should remain stable even as technologies, interfaces, and individual Worlds change. Their purpose is to ensure that Vorvex continues to organize complexity around the person and helps them understand their life with clarity, ownership, and pride.
