# Vorvex Engineering Operating Manual

**Status:** Required operating authority

**Established:** 2026-08-08

## Purpose

This manual defines how engineering work is understood, challenged, planned, built, validated, documented, reviewed, and preserved at Vorvex. It applies to human contributors, AI agents, contractors, reviewers, and future specialist teams.

Every engineering task must begin by reviewing this manual. A task prompt may then focus on its objective, scope, constraints, and acceptance criteria instead of repeating the operating philosophy.

This manual consolidates the working rules previously distributed across the Engineering Playbook, role documents, architecture decisions, lessons, and checkpoint practices. Detailed product and architecture documents remain authoritative for their subjects; this manual links to them rather than replacing them.

## 1. Authority and required context

### Authority hierarchy

When sources conflict, use this order:

1. Explicit current Founder decision
2. Approved current task specification
3. [Mission](../00-company/MISSION.md)
4. [Product Principles](../00-company/PRODUCT_PRINCIPLES.md) and [Anti-Goals](../00-company/ANTI_GOALS.md)
5. [Vision](../VISION.md)
6. Approved domain and technical architecture documents
7. [Decision Log](../04-decisions/DECISIONS.md)
8. This Engineering Operating Manual
9. Relevant research, lessons, technical-debt records, and roadmap
10. Existing implementation patterns
11. Contributor preference

A lower authority must not silently override a higher one. New evidence may justify changing an earlier decision, but the conflict, evidence, consequences, and proposed replacement must be surfaced to the decision owner before implementation.

### Required reading

Before every engineering task, read:

- this manual;
- the current task specification;
- repository-level contributor instructions;
- current Git branch, status, and relevant recent checkpoints;
- the documents directly relevant to the task.

For product or domain work, the relevant set normally includes the [Mission](../00-company/MISSION.md), [Product Principles](../00-company/PRODUCT_PRINCIPLES.md), [Vision](../VISION.md), and [Permanent Data Model](../02-architecture/DATA_MODEL.md).

For financial-data work, also read the [Canonical Financial Model](../02-architecture/CANONICAL_FINANCIAL_MODEL.md), [Canonical Transaction Ingestion](../02-architecture/TRANSACTION_INGESTION.md), and applicable ingestion or privacy decisions.

For material interface work, review the product principles, prior prototypes, applicable design notes, and lessons about conventional dashboard drift.

Do not read every document mechanically when it is unrelated. Identify the authoritative context required to make the scoped change correctly.

### One objective per task

Every task has one primary objective. Its specification must state:

- user or business reason;
- scope;
- explicit exclusions;
- constraints;
- acceptance criteria;
- validation expectations;
- checkpoint or delivery expectation.

If a second objective emerges, record or propose it separately. Do not broaden the active task without approval.

## 2. Mission of the Engineering Team

The Engineering Team turns the Founder’s intent and approved product direction into safe, useful, understandable, and durable software.

Engineering exists to help a person understand, manage, and preserve the life they are building. Technical activity is valuable only when it advances that outcome, protects the person and their information, or preserves the integrity needed to do so later.

The team is responsible for more than producing code. It must:

- protect the product’s person-centred identity;
- preserve data, privacy, trust, and recoverability;
- translate architecture into coherent working systems;
- expose risks and trade-offs before they become hidden costs;
- validate claims with evidence;
- preserve durable knowledge in the repository;
- create safe checkpoints that make learning reversible.

The team is not a passive implementation service. It behaves as a senior engineering partner while respecting product and company authority.

## 3. Roles and decision boundaries

### Founder

The Founder owns:

- company vision and values;
- product instinct and customer understanding;
- priorities and acceptable trade-offs;
- final product, business, privacy-posture, and risk decisions.

The Founder defines the outcome and resolves material disagreements. Repository changes should still pass through the same inspected, validated, and recoverable engineering workflow.

### CTO

The CTO owns:

- translating Founder intent into product direction and bounded specifications;
- architecture stewardship;
- technical and product sequencing recommendations;
- identifying consequential trade-offs and escalation points;
- reviewing implementation against approved intent;
- maintaining coherence across product, data, privacy, and engineering decisions.

The CTO may challenge the requested approach and recommend a better one. The CTO must not treat an unapproved preference as company strategy or silently override the Founder.

### Engineering Team

The Engineering Team owns:

- inspecting the real repository, runtime, dependencies, and Git state;
- assessing feasibility and implementation risk;
- planning and implementing approved work;
- selecting bounded implementation details within the approved architecture;
- testing, validation, privacy review, security review, accessibility review, and exact reporting;
- safe branches, commits, checkpoints, and preservation of unrelated work;
- recording meaningful debt, lessons, decisions, and deferred ideas in the correct place.

The Engineering Team may and should challenge an unsafe, contradictory, unnecessarily costly, or structurally weak request before changing the repository. It must explain the evidence, consequence, and safer alternative.

The Engineering Team must not independently:

- redefine the company mission or product strategy;
- invent a material product experience when intent is unclear;
- redesign unrelated areas;
- implement deferred ideas without prioritization;
- introduce integrations, infrastructure, AI, authentication, or cloud systems merely because they may be useful later;
- discard, overwrite, stage, or commit unrelated work;
- claim completion without validation evidence.

### Decision rule

Ideas compete on merit; roles do not compete for authority. Any role may propose a better approach. The owner of the relevant decision approves, rejects, or requests more evidence.

Escalate when a choice would materially change product behaviour, architecture, privacy posture, data ownership, external dependencies, cost, or irreversible state. Continue autonomously with safe, reversible implementation details inside the approved scope.

## 4. Product philosophy

### Person first

The Person is the root of Vorvex. Accounts, institutions, assets, liabilities, transactions, documents, and software exist to help the person understand their life. Do not organize the person around an institution’s schema or a familiar finance-product pattern.

### Money connects everything

Money is connective tissue, not the product and not the definition of a life. It makes relationships across Worlds visible while each World retains its human meaning. Transactions are evidence and history, not primary navigation.

### Digital Financial Twin

My Finance World is the first foundation of a broader life operating system. It should become a faithful, explorable representation of a person’s financial position, activity, commitments, relationships, and history.

The twin must distinguish:

- known facts;
- user assertions;
- imported evidence;
- calculations;
- estimates and forecasts;
- expected future events;
- unknown or missing information.

A clear incomplete model is better than a comprehensive misleading one. Unknown is not zero.

### Local-first and privacy-first

Prefer local operation, user control, and minimum disclosure when they can deliver the required outcome. Remote services must earn their place through demonstrated value and must enter through controlled boundaries.

Local-first does not mean “no backups,” “no security,” or “never cloud.” It means the product defaults toward the person’s control and does not require avoidable external custody.

### Progressive disclosure

Complexity belongs in the system, not on the first screen. Begin with a legible whole and reveal detail as the person explores a World, Object, Event, number, or question. Preserve orientation and make every important summary traceable to its evidence.

### Build trust before automation

Prefer an honest manual or local workflow over automation whose coverage, security, provenance, or correctness is unclear. Automation must preserve explainability, user correction, consent, and safe failure.

### Simplicity over feature count

Build the smallest coherent improvement that is useful and testable. Do not confuse more controls, integrations, screens, or abstractions with more value.

### No judgement or manipulation

Use factual, neutral language. Do not shame debt, spending, loss, or imperfect choices. Do not reduce a person to a score, optimize for screen time, use dark patterns, or allow advertising incentives to distort recommendations.

### Preserve history

Time is part of the model. Preserve meaningful Events, revisions, provenance, and completed Worlds. Prefer archival and reversible actions over silent erasure where that aligns with the person’s explicit retention choices.

## 5. Engineering principles

### Lean execution default

Product progress is the default. Engineering work should create user value, enable the next milestone, protect an important capability, or remove a real blocker. Use this decision test before significant investment:

> **Does this work materially improve the product, protect something important, or enable the next milestone?**

If not, normally do not do it; if uncertain, challenge it first. For the Founder-prototype phase, aim directionally for 80% building and 20% validation, security, and documentation, adjusting when consequences justify more or less rigor.

Apply validation proportionally to risk. Normal UI work usually needs relevant tests, typecheck, build or lint where appropriate, and practical interaction validation—not database forensics or exhaustive security matrices. Financial calculations require reconciliation and correctness evidence; persistence changes require migration and integrity testing; statement ingestion requires parser, deduplication, privacy, and failure-path coverage; credentials, encryption, and external financial integrations require deeper security review. Security remains non-negotiable where financial truth, private data, credentials, destructive operations, external integrations, or source durability face credible risk.

Engineering has authority over routine, reversible implementation choices such as file and component structure, internal APIs, test organization, naming, minor refactoring, safe dependency choices, development tooling, and equivalent techniques. Do not escalate those decisions. Escalate choices that materially affect product vision or experience, financial truth, privacy or security architecture, irreversible or expensive architecture, external financial integrations, meaningful operating cost, major scope, or destructive data operations.

Objectives and boundaries are authoritative; prescribed mechanics may be challenged. Prefer the smallest safe solution, and challenge redundant validation, speculative architecture, unnecessary abstraction, excessive documentation, and work that does not advance the milestone—even when the instruction originates with the Founder or CXO. Build for current requirements with sensible extension boundaries: simple, correct, and extensible beats generalized, sophisticated, and hypothetical.

Document durable decisions, models, security boundaries, meaningful debt, and lessons future engineers need—not routine activity already clear in code, tests, and Git history. For product milestones, make the improvement visible and usable whenever practical.

Default cadence:

> **Understand briefly → Challenge if necessary → Build → Validate proportionally → Commit → Preserve → Recommend next action**

### Challenge assumptions with evidence

Do not challenge for ceremony. Challenge when the requested direction is materially unsupported, stale, unsafe, contradictory, needlessly expensive, or likely to create avoidable rework. State:

1. the assumption;
2. the evidence or conflict;
3. the practical consequence;
4. the recommended alternative;
5. the decision needed.

### Protect architecture without worshipping it

Architecture exists to preserve product coherence, data integrity, safety, and changeability. Do not bypass approved boundaries for short-term convenience. Also do not build speculative frameworks ahead of demonstrated need.

### Ship small, meaningful increments

Prefer one complete vertical improvement over several partial systems. Each increment should create working value, validated learning, or a durable engineering asset.

### Prefer reusable systems at stable boundaries

Reuse is valuable when multiple known consumers share the same invariant. Place reusable logic behind canonical boundaries, typed contracts, and focused services. Do not create generic abstractions based only on imagined future use.

### Preserve one authoritative truth

The same information may appear in multiple views, but those views must reference one authoritative record. UI convenience never justifies duplicated financial facts or calculations.

### Keep provider details at the edge

External and local data sources adapt into provider-independent raw contracts. Validation, normalization, deduplication, attribution, calculations, and UI models belong to canonical Vorvex layers, not providers.

### Preserve evidence and provenance

Do not overwrite raw evidence during normalization or enrichment. Important facts, totals, classifications, and recommendations must be traceable to source and method.

### Fail honestly

Reject malformed, unsupported, ambiguous, or unsafe input rather than silently inventing a plausible result. Display unknown, stale, unavailable, or partial state explicitly.

### Explain trade-offs

Material choices must identify benefits, costs, risks, reversibility, migration impact, and uncertainty. Do not present estimates or vendor claims as verified facts.

### Avoid premature optimization

Measure before optimizing. Optimize when performance, cost, scale, or reliability creates an observed constraint or a clearly imminent threshold. Correctness, clarity, and changeability come first.

### Treat technical debt deliberately

Not all debt requires immediate repair. Record meaningful limitations and address them when they block delivery, risk data or security, cause defects, or materially increase the cost of approved work. Avoid unrelated cleanup inside a feature commit.

### Preserve working and user-entered behaviour

Inspect persistence and migration implications before changing models or storage. Never make personal information inaccessible merely to simplify a redesign or schema change.

### Use current framework evidence

When framework, platform, provider, regulatory, or security behaviour may have changed, inspect the installed version and current primary documentation. Do not rely solely on remembered conventions.

## 6. Standard engineering workflow

Every task follows this loop:

```text
Understand
   ↓
Challenge when material
   ↓
Plan
   ↓
Build
   ↓
Validate
   ↓
Document
   ↓
Recommend
   ↓
Checkpoint
```

### Understand

- Read this manual and task-specific authorities.
- Inspect the repository, branch, status, recent commits, dependencies, and relevant code.
- Identify pre-existing changes and ownership boundaries.
- Restate the single objective, acceptance criteria, exclusions, and risks.
- Determine whether the task authorizes read-only review, implementation, destructive action, external communication, or a commit.

### Challenge when material

- Identify conflicts with mission, product principles, architecture, privacy, security, data preservation, or current evidence.
- Propose the smallest safer or more coherent adjustment.
- Stop for approval only when the decision materially changes scope or authority. Continue safe reversible investigation where useful.

### Plan

- Choose the smallest coherent implementation.
- Identify affected boundaries, data migrations, failure modes, validation, rollback, and documentation.
- Separate current-task work from unrelated work.
- Create or confirm the appropriate branch before significant changes.
- Use sub-tasks or specialist review only when work is independently bounded and coordination adds clear value.

### Build

- Follow existing patterns that remain compatible with approved architecture.
- Keep changes focused and reviewable.
- Use typed contracts and deterministic logic for financial facts.
- Do not add hidden fallback values, provider-specific UI dependencies, or sample data that can appear personal.
- Preserve safe failure, accessibility, responsive behaviour, and reduced-motion support where applicable.
- Do not implement adjacent ideas merely because they are easy while the file is open.

### Validate

- Validate in proportion to risk and against the acceptance criteria.
- Test the changed behaviour and relevant regressions, not only compilation.
- Capture evidence for claims made in the completion report.
- Treat skipped, unavailable, flaky, or partially passing checks as explicit results, not success.

### Document

- Update durable documentation when behaviour, architecture, operation, privacy, migration, or an approved decision changes.
- Do not document speculative implementation as current truth.
- Record out-of-scope findings in the correct institutional-memory document.

### Recommend

- Explain the outcome and important decisions.
- Identify remaining risks, unknowns, debt, and the safest next task.
- Distinguish completed work from future recommendations.

### Checkpoint

- Inspect the complete diff and staged diff.
- Stage only current-task files.
- Run a privacy and generated-artifact review.
- Create one coherent commit when authorized.
- Report branch, full commit hash, exact committed files, validation, and deliberately uncommitted files.

If the task prohibits or does not authorize a commit, leave a clearly reported, reviewable working state. “Checkpoint” then means a reproducible handoff, not an unauthorized Git mutation.

## 7. Validation standard

### Completion checklist

Before declaring completion, evaluate every item:

- [ ] Acceptance criteria verified
- [ ] Relevant tests pass
- [ ] Type checking passes
- [ ] Lint passes
- [ ] Production build passes
- [ ] Changed runtime behaviour verified
- [ ] Existing critical behaviour remains intact
- [ ] Financial invariants and rendered values verified when financial data changes
- [ ] Privacy review completed
- [ ] Security review completed
- [ ] Accessibility review completed
- [ ] Responsive and reduced-motion behaviour verified when UI changes
- [ ] Documentation updated
- [ ] Migration, rollback, and data-preservation implications reviewed
- [ ] No private, generated, prototype, or unrelated files included
- [ ] Full diff, staged diff, and Git status reviewed
- [ ] Commit or handoff is reproducible

Each item must be **passed**, **failed**, **blocked**, or **not applicable with a reason**. A documentation-only change does not require a meaningless application build, but it still requires content, link, privacy, formatting, diff, and Git validation. High-risk financial, persistence, parser, authentication, or provider work requires deeper negative and recovery testing.

### Test expectations

Tests should cover the behaviour most likely to break trust:

- financial calculations and invariant totals;
- validation and rejection of malformed data;
- duplicate and idempotency behaviour;
- migrations and recovery;
- source provenance;
- unknown versus zero state;
- provider isolation;
- access control and secret handling;
- destructive and irreversible actions;
- accessibility-critical interactions;
- failure, retry, and interrupted-state recovery.

Synthetic test data must be explicitly non-personal and must never enter production as if it were real.

### Runtime evidence

For user-facing changes, inspect the rendered result at relevant viewport sizes and exercise primary keyboard and pointer paths. A successful build alone is not runtime validation.

## 8. Privacy and security operating rules

### Permanent defaults

- Local-first by default.
- Privacy-first from design, not as cleanup.
- Collect, expose, retain, and transmit only what the approved purpose requires.
- Use least-privilege, read-only access whenever possible.
- Keep application source separate from personal data.
- Never commit personal financial data, statements, transaction exports, credentials, secrets, tokens, account numbers, or private backups.
- Keep private local paths ignored by Git and verify the ignore rule before each relevant commit.
- Validate all external, imported, recovered, and user-supplied data as untrusted.
- Use secure defaults and require explicit consent for less-private modes.
- Preserve provenance without retaining unnecessary sensitive payloads.

### Canonical privacy boundary

The UI consumes canonical Vorvex models. It does not read private snapshots, local files, provider payloads, tokens, or source-specific formats directly.

```text
Private or external source
          ↓
Read-only provider adapter
          ↓
Validation and minimization
          ↓
Canonical model
          ↓
Provider-independent UI and services
```

The application must build and run from a clean clone without personal data. When no private source exists, the product reports that state honestly rather than substituting fake values.

### Founder-authorized financial-data locations

Explicit Founder authorization must precede every access to a financial document. A file's presence on the Founder’s device is not authorization.

- Vorvex, Engineering, human contributors, AI agents, scripts, tests, and diagnostic tooling may access financial documents only inside a location the Founder explicitly authorized for the current workflow or a specific file or folder the Founder explicitly identified for a specific task.
- The current authorized statement-ingestion location is `/Users/inder/Documents/Vorvex Bank Statements`. Engineering tooling follows the same boundary as the product.
- Never search, enumerate, inspect, parse, characterize, copy, hash, or otherwise access financial documents in Desktop, Downloads, Documents generally, iCloud, external drives, historical archives, or other user directories without explicit task-specific Founder authorization naming the target.
- Do not infer authorization from filesystem visibility, existing macOS permissions, prior access, relevance, convenience, or a broad task such as reconciliation, backfill, debugging, or validation.
- Do not request or broaden macOS filesystem permissions to locate financial sources. If authorized evidence is absent from the configured location, stop and ask the Founder to place it there or explicitly identify the narrow target.
- The normal local workflow is: the Founder manually places statements in the authorized inbox; Vorvex processes only that inbox; canonical data is updated locally. Future API access must also begin with explicit Founder authorization.
- Preserve existing canonical data and provenance when correcting an authorization boundary. Do not reopen source documents merely to reconstruct provenance unless the Founder explicitly authorizes that access.

### Credentials and secrets

- Vorvex must not collect bank credentials when a provider-hosted or bank-hosted authorization flow exists.
- Secrets and access tokens never belong in source control, browser storage, frontend bundles, analytics, crash reports, screenshots, or general logs.
- Commercial provider tokens belong behind a backend secret boundary with encryption, rotation, revocation, and audited access.
- Local secrets use operating-system secret storage when the integration safely supports a native client.
- Do not invent a local-secret design that embeds a confidential vendor secret in a distributable application.

### Storage and retention

- Encrypt sensitive data at rest and in transit in proportion to its risk.
- Keep encryption keys separate from encrypted data and backups.
- Define the purpose, minimum period, maximum period, deletion path, and recovery implications for every sensitive store.
- Original financial source files are opt-in, encrypted, and time-limited unless a documented requirement says otherwise.
- Logs contain operational metadata, not financial payloads.
- Backups must be encrypted, restorable, access-controlled, and subject to documented expiry.

### Security review triggers

Require an explicit threat model and security review before:

- adding authentication, remote storage, bank connections, or external providers;
- handling credentials, tokens, statements, or real transactions in a new way;
- changing encryption, backup, export, deletion, or retention behaviour;
- introducing parsers, file watchers, webhooks, background services, or privileged access;
- exposing personal information to another process, service, region, or legal entity.

Security review must consider device compromise, provider compromise, Vorvex compromise, malicious input, insider access, logging, backups, revocation, dependency supply chain, and safe recovery.

### Destructive operations

Resolve exact targets before deletion or overwrite. Prefer recoverable actions and narrow scope. Explain material deletion and recovery consequences. Never use broad unresolved paths, environment variables, or destructive repository commands without explicit authority.

## 9. Architecture principles

### Permanent domain hierarchy

The durable conceptual model is:

```text
Person
  ↓
Worlds
  ↓
Objects
  ↓
Events
  ↓
Money
```

The Person owns Worlds. Worlds give meaning to Objects. Events explain change through time. Money records and connects the financial consequences of those Events.

### Financial experience lens

The financial application may also present:

```text
Person
  ↓
Money
  ↓
Cash / Investments / Home / Vehicle / Credit-Debt / Income / Upcoming / Future Worlds
```

This is a financial view and aggregation path, not a replacement ownership hierarchy. Money must not become the parent of the person’s life. Home, Vehicle, Career, and future Worlds retain independent meaning while being visible through Money.

### One truth, multiple views

Contextual duplication in the UI is allowed; data duplication is not. A mortgage may appear in Home, liabilities, cash flow, and upcoming commitments while remaining one underlying object and source of truth.

### Canonical Financial Model

All displayed financial balances and derived totals originate from the typed canonical financial model. UI components do not own balances, fallback numbers, sample activity, or calculations.

Known records remain authoritative. Derived totals use deterministic, tested arithmetic. Missing information remains unknown. Providers supply raw data; they do not shape UI models or calculate canonical totals.

### Canonical Transaction Model

Transactions are canonical evidence with identity, account relationship, date, amount and direction, status, raw description, normalized counterparty, classification, optional World relationship, source, provenance, and relevant metadata.

Raw evidence is preserved separately from normalization and enrichment. User corrections outrank deterministic rules; deterministic rules outrank future AI classification; unclassified remains a valid state.

### Provider-independent ingestion

Every financial source uses the same direction:

```text
Provider
  ↓ raw, untrusted record
Validation
  ↓ structurally trustworthy record
Normalization and deduplication
  ↓ canonical financial fact
Classification / World attribution
  ↓ contextual enrichment
Canonical model
  ↓ provider-independent data
UI / Worlds / queries / reports / assistants
```

Local snapshots, manual entry, CSV, OFX/QFX, PDF, future APIs, and future databases are adapters at the edge. No source bypasses validation or writes a provider format into the UI.

### Current transaction-source direction

The first real transaction source is the privacy-first local TD statement inbox:

- TD chequing and TD credit card first;
- Founder authorization is limited to the explicitly configured inbox; neither product code nor Engineering tooling may discover candidate financial files elsewhere;
- PDF implemented first because it is the available Founder workflow;
- embedded-text extraction is evaluated before any OCR decision;
- CSV and OFX/QFX remain future adapters if current TD access makes them available;
- manual local processing is implemented before scheduling or filesystem watching;
- successful imports delete the original source by default after verified commit;
- raw PDF bytes and extracted text remain ephemeral and never enter external AI services;
- Plaid/Flinks are deferred until automatic refresh is justified;
- Canadian consumer-driven banking is the preferred long-term direction when production coverage and accredited intermediaries are proven.

See [Secure PDF Intake and Structural Analysis](../02-architecture/PDF_INTAKE.md). The [Real Transaction Ingestion Strategy](../03-research/REAL_TRANSACTION_INGESTION_STRATEGY.md) preserves the earlier structured-export-first research and its now-superseded availability assumption.

### Future extensibility

Extensibility comes from stable domain identities, canonical models, provider contracts, and provenance—not from speculative feature frameworks. Add a new source by adapting it into the canonical pipeline. Add a new World by connecting it to existing Person, Object, Event, and Money concepts. Change the UI without changing the truth boundary.

## 10. Git standards

### Start safely

Before editing:

- confirm the canonical repository;
- inspect branch, status, recent commits, and worktrees when relevant;
- identify pre-existing tracked and untracked changes;
- determine which files belong to the current task;
- do not assume a dirty working tree is disposable.

### Branch naming

Use lowercase, hyphenated, purpose-led names:

- `build/<objective>` — feature or engineering foundation;
- `fix/<objective>` — defect correction;
- `docs/<objective>` — documentation system or substantial documentation work;
- `research/<objective>` — research that needs an isolated branch;
- `prototype/<objective>-vN` — non-production experiment;
- `chore/<objective>` — bounded maintenance.

Continue an existing branch when the task is the deliberate checkpoint or documentation of the work already on that branch. Do not create branch churn solely to satisfy naming preference.

### Commit style

Use concise Conventional Commit-style subjects:

- `feat: establish canonical transaction ingestion`
- `fix: preserve unknown balance state`
- `docs: define real transaction ingestion strategy`
- `test: cover overlapping statement imports`
- `refactor: isolate financial model provider`
- `chore: update local development tooling`

A commit must represent one coherent purpose. The subject says what durable change the commit establishes, not which tool produced it.

### Checkpoint philosophy

Checkpoint before major experiments, risky migrations, broad refactors, or architectural transitions. A checkpoint must be:

- coherent;
- reproducible;
- validated in proportion to risk;
- free of private and generated data;
- recoverable by branch and commit hash;
- documented enough to understand its purpose and limitations.

A milestone checkpoint is not durable until it exists outside the working repository. After committing, preserve it in a second verified location—for example, a pushed protected branch or a Git bundle stored on separate durable media—and record the commit hash. Verify that the second copy contains the commit before treating the milestone as recoverable. A local branch, worktree, or clone on the same storage device is not a sufficient backup.

Do not rewrite protected historical checkpoints. Later improvements use new commits or branches.

### Staging and review

Before committing:

1. inspect unstaged and staged status;
2. stage explicit current-task paths only;
3. inspect the full staged diff;
4. run whitespace and generated-artifact checks;
5. scan for secrets and private financial material;
6. confirm unrelated files remain unstaged;
7. commit with the approved message or a precise equivalent;
8. inspect the resulting commit and working tree.

Never use “stage all” in a dirty repository without proving every change belongs to the task. Never discard unrelated work to make a checkpoint appear clean.

### Prototype policy

A prototype is an experiment, not production by implication. It must:

- have a precise question or hypothesis;
- remain isolated through a protected branch or archived prototype directory;
- use non-personal data unless an explicitly private local evaluation requires otherwise;
- record what worked, limitations, and product learning;
- never become production directly without a separate review and implementation decision;
- remain unchanged after being designated an immutable archive.

### Research and architecture commits

Research commits contain evidence, uncertainty, alternatives, and a recommendation. They do not imply provider selection or implementation unless explicitly approved.

Architecture commits identify status, decision, rationale, boundaries, consequences, risks, migration implications, and superseded decisions. Keep architecture documentation separate from implementation when independent review or approval is valuable.

## 11. Documentation standards

### Document durable knowledge

Document when work changes:

- mission, product principles, or anti-goals;
- approved product or architecture decisions;
- domain or technical boundaries;
- storage, privacy, security, retention, or migration behaviour;
- operational procedures required to build, run, restore, or support the product;
- validated lessons that change future behaviour;
- known technical limitations with meaningful risk;
- notable shipped product behaviour.

Do not document routine implementation details that are clearer in code, temporary speculation, or every observation made during a task.

### Put information in one durable home

- Company purpose and permanent product constraints → `docs/00-company/`
- Product definitions and user understanding → `docs/01-product/`
- Domain and technical architecture → `docs/02-architecture/`
- Evidence and research → `docs/03-research/`
- Approved decisions, deferred ideas, and lessons → `docs/04-decisions/`
- Explicitly prioritized work → `docs/05-roadmap/`
- Engineering operating practice → `docs/engineering/`
- Product-level shipped history → `docs/CHANGELOG.md`

Prefer updating an authoritative document over creating a competing summary. Link across documents rather than copying details likely to change.

### Architecture Decision Records

A material architecture decision should include:

- title, date, and status;
- context and problem;
- decision;
- considered alternatives;
- rationale and evidence;
- consequences and trade-offs;
- privacy and security impact;
- migration and rollback path;
- validation or decision gate;
- related documents, branch, and commit;
- superseded decision, if any.

Approved decisions remain in history. A changed decision receives a new dated record that supersedes the earlier one; do not erase the original reasoning.

### Research documents

Research must separate verified fact, vendor claim, inference, unknown, and recommendation. Use current primary sources when available, cite them near the claim, state the research date, avoid invented cost estimates, and define what must be proven in a real pilot.

Research becomes an architecture or product decision only when its status is explicitly approved.

### Checkpoint summaries

Every implementation completion report includes:

- objective completed;
- files changed;
- behaviour changed;
- validation performed and results;
- assumptions;
- questions requiring Founder or CTO review;
- deferred product ideas;
- technical debt observed;
- lessons learned;
- risks and limitations;
- recommended next task;
- branch and commit, when applicable;
- files deliberately left uncommitted.

Sections without findings may say “None.” Do not inflate the report with routine detail.

## 12. Definition of done

A feature or engineering foundation is done only when it is:

1. **Implemented** — the scoped behaviour or durable asset exists.
2. **Validated** — applicable acceptance, test, build, lint, runtime, privacy, security, accessibility, and regression checks have evidence.
3. **Documented** — durable behaviour, architecture, operation, migration, and limitations are recorded in the correct place.
4. **Checkpointed** — the work is preserved in a coherent commit when authorized, or in an explicit reproducible handoff when commits are prohibited.
5. **Recommended** — the completion report states risks, unknowns, and the best next task.

“Code written,” “build passed,” “looks correct,” and “document drafted” are not individually complete.

A task may still be correctly reported as incomplete or blocked. Honesty about an unmet criterion is better than a false declaration of done.

## 13. Engineering behaviour

Vorvex Engineering behaves like a senior partner:

- lead with the outcome and evidence;
- ask only questions that materially affect the result and cannot be resolved from the repository;
- make bounded, reversible assumptions to maintain progress;
- challenge weak ideas with a concrete alternative;
- explain risk before taking irreversible action;
- protect user data and working behaviour;
- distinguish fact, inference, assumption, and recommendation;
- prefer primary evidence for changing technical, regulatory, provider, and security claims;
- identify debt without opportunistically refactoring it;
- record useful adjacent ideas without implementing them;
- communicate progress during long-running work;
- report exact results, failures, and remaining uncertainty;
- stop when completion requires new authority or a materially different objective.

Engineering must not:

- obey blindly when the request is unsafe or contradicts an approved authority;
- use architecture as a reason to avoid shipping a small useful improvement;
- optimize for technical novelty;
- hide a limitation behind polished language;
- call sample data real, unknown data zero, or a vendor promise validated behaviour;
- perform unrequested pushes, deployments, provider contacts, destructive operations, or external data transfers.

## 14. Prompt convention

Every future engineering task should begin with:

> Review the Engineering Operating Manual before starting. Identify any material conflict, stale assumption, privacy or security risk, and recommend an improvement before implementation when appropriate.

The remainder of the task should normally state only:

- objective and user/business reason;
- repository and branch constraints;
- scope and exclusions;
- acceptance criteria;
- required deliverables;
- validation requirements;
- commit, push, deployment, or external-action authority.

The prompt does not need to repeat the principles, workflow, Git safety, privacy defaults, completion report, or Definition of Done contained here. A task-specific instruction overrides this manual only through the authority hierarchy and only for that task.

## 15. Continuous improvement

This manual is a living operating authority, not an immutable historical artifact.

When the Engineering Team discovers a materially better practice:

1. identify the observed problem and evidence;
2. explain the current rule and why it is insufficient;
3. propose the smallest durable improvement;
4. identify affected decisions or documentation;
5. obtain approval from the appropriate owner;
6. update this manual in a dedicated documentation task and checkpoint;
7. preserve superseded reasoning when it remains useful.

Update the manual for durable changes in behaviour, not personal preference or one unusual task. Review it after a serious incident, data-loss risk, repeated workflow failure, major architecture transition, new external-data custody model, or material change in team structure.

## Current workflow recommendations

The documentation audit that established this manual identified these operating improvements:

1. **Use this manual as the single workflow authority.** The earlier Engineering Playbook remains historical context until a separately approved cleanup updates repository pointers; future tasks should cite this manual.
2. **Keep domain hierarchy and financial-view hierarchy distinct.** `Person → Worlds → Objects → Events → Money` is the permanent domain model. `Person → Money → financial Worlds` is a valid financial experience lens, not ownership.
3. **Use proportional validation with explicit status.** Every validation area is evaluated, but irrelevant checks are marked not applicable with a reason rather than performed ceremonially.
4. **Separate approval from evidence.** Research recommends; a dated approved status decides; implementation follows in a later scoped checkpoint when appropriate.
5. **Treat working-tree preservation as a first-class control.** Exact path staging and post-commit status review are required whenever unrelated work exists.

## Operating test

Before closing any engineering task, answer:

1. Did this help a person understand, manage, or preserve an important part of their life?
2. Did we keep the Person and their trust at the centre?
3. Did we preserve one authoritative truth and clear provenance?
4. Did we avoid unnecessary access, retention, dependencies, and complexity?
5. Did we verify the outcome rather than assume it?
6. Can another contributor understand, reproduce, and safely continue the work?
7. Is the checkpoint scoped, recoverable, and free of unrelated or private material?

If any answer is no, the work is not ready to be declared complete without an explicit accepted exception.
