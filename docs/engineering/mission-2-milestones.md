# Mission 2 Milestones

## M2.1 — Spatial Universe foundation

- Milestone: Replace panel-first selection with the first Person → World → Object spatial journey.
- Outcome: The Person and Net Worth now form the calm default centre. Selecting a World moves it to the visual centre, pushes unrelated Worlds into depth, reveals account objects spatially, preserves a visible journey trail, and places supporting detail in a compact translucent contextual surface. Utility actions use natural product language. Desktop, tablet, mobile, keyboard, focus, and reduced-motion states remain represented.
- Validation: ESLint passed; TypeScript passed; all 110 tests passed; production build passed. Managed in-app browser control could not authorize localhost, but final acceptance used a local-only headless browser render of the installed Founder application.
- Commit: `0f1ab9d`
- Preserved: Mission 1 canonical architecture, browser-safe view model, server-authoritative calculations, Unknown semantics, and all local financial storage boundaries.
- CXO decision: none
- Next: Add honest historical coverage modeling and process the protected TD historical archive, then revisit this spatial surface with richer data.

## M2.2 — Honest historical coverage

- Milestone: Replace oldest/newest-date inference with statement-period continuity.
- Outcome: The protected import journal now supplies browser-safe statement coverage. Overlapping and adjacent committed statement periods are merged, real missing date ranges are identified, and each selected period is described as complete or partial without treating transaction silence as a gap.
- Validation: ESLint passed; TypeScript passed; all 111 tests passed, including explicit continuous and missing-period cases.
- Commit: `7ea9583`
- Preserved: Coverage derives only from committed imports; transaction contents and private import identifiers remain outside the browser view.
- CXO decision: none
- Next: Characterize legitimate historical TD layout variations found during the first one-year backfill attempt.

## M2.3 — Expected & Upcoming intelligence foundation

- Milestone: Introduce deterministic recurring-pattern detection and keep forecasts distinct from obligations.
- Outcome: Vorvex detects weekly, biweekly, and monthly candidates using repeated account, direction, financial meaning, normalized counterparty, cadence tolerance, and robust median amounts. At least three observations are required. Known statement obligations and evidence-based Expected movements are rendered in separate groups; estimates use approximate amounts, plain-language confidence, evidence counts, and explicit non-obligation language.
- Validation: ESLint passed; TypeScript passed; all 113 tests passed; production build passed. Tests cover cadence detection, robust amount estimation, irregular activity, transfers, and pending records.
- Commit: `733b606`
- Preserved: No AI or external processing; no prediction becomes a canonical fact; transfer activity is excluded; all calculations remain server-side.
- CXO decision: none
- Next: Use the historical backfill to exercise real patterns, then add correction/dismissal only if the existing learning boundary can absorb it cleanly.

## M2.4 — Factual TD investment history

- Milestone: Establish a provider-specific investment snapshot boundary and explain value change honestly.
- Outcome: TD Multi-Holding TFSA/RRSP reports now yield reporting period, ending market value, and book cost through a fail-closed adapter. Snapshots persist encrypted and deduplicate by source and account period. Investments and account detail expose recorded value history, a restrained sparkline, and neutral change language that explicitly does not call unexplained value movement return. DCP and PRPP were characterized as structurally distinct and remain outside this TD adapter.
- Validation: The adapter parsed 42 protected historical TFSA/RRSP reports; 10 older variants failed closed for later characterization. ESLint, TypeScript, all 117 tests, and production build passed. Persistence tests prove encrypted values and deduplication.
- Commit: `8e0f2ff`
- Preserved: Founder documents remain unchanged and outside Git; raw holdings and statement text are not stored; contribution/performance decomposition remains Unknown when unsupported.
- CXO decision: none
- Next: Upgrade the installed runtime, ingest the supported protected investment history, and validate factual changes after restart.

## M2.5 — Historical TD credit continuity

- Milestone: Characterize legitimate TD historical variations needed for a continuous real-data year.
- Outcome: Credit Card v2 validates the statement's own consistent page-total evidence instead of assuming four pages. It recognizes legitimate transaction dates up to seven days before a statement period only when the posting date is inside the period. Chequing v2 permits a separately validated non-financial trailing page while still requiring exactly one reconciled transaction page. These narrow changes make 20 consecutive real Credit statements from January 2025 through August 2026 parse successfully.
- Validation: All 118 tests pass, including the new pre-period transaction/posting-date case and safe multipage Chequing case. Private archive characterization now accepts 31 Credit reports overall while continuing to reject 37 unsupported/ambiguous older variants.
- Commit: `b41ade3`, completed by `8187bfc`
- Preserved: Exact balance reconciliation, row integrity, source boundaries, deduplication, and fail-closed behavior remain mandatory.
- CXO decision: none
- Next: Install v2 parsers, backfill the continuous Credit period from protected copies, and measure coverage, recurrence, review load, and persistence.

## M2.6 — Protected historical runtime backfill

- Milestone: Turn the characterized formats into durable Founder history and verify the intelligence layer against it.
- Outcome: The installed local runtime now contains 852 canonical transactions across both approved transaction accounts, 20 statement-fact records, and 42 factual TFSA/RRSP investment snapshots. Transaction activity spans December 2024 through August 2026. The deterministic recurrence engine finds seven current candidates across weekly, biweekly, and monthly cadences: one inflow and six outflows. The protected inbox retains unsupported copies for safe follow-up rather than deleting them.
- Validation: Counts were read from owner-only stores; recurrence was evaluated locally after decrypting in memory and reported only as aggregate categories. Persistence survived runtime restarts. No descriptions or financial values entered logs or this record.
- Commit: data milestone; source support in `8e0f2ff`, `b41ade3`, and `8187bfc`
- Preserved: Source archives were not altered. Runtime payloads remain encrypted, local, and outside Git and recovery bundles.
- CXO decision: none
- Next: Make long-period movement and the large review backlog useful inside the redesigned Universe.

## M2.7 — Actionable historical experience

- Milestone: Integrate long history into Cashflow, Lifestyle, coverage, and Review without dashboard sprawl.
- Outcome: Statement continuity is now assessed separately for every imported account, preventing one account from masking another account's gap. Cashflow and Lifestyle gain restrained monthly movement views derived on the server from the selected period. Review defaults to recent items, presents bounded starting sets, and explicitly tells the Founder that clearing hundreds of historical items is not required; existing decisions still teach exact, account-scoped rules.
- Validation: ESLint and TypeScript passed; all 119 tests passed; production build passed. New tests cover cross-account coverage masking and monthly-history reconciliation.
- Commit: `fb77039`
- Preserved: Transfers and payments remain excluded from spending movement; browser projections contain no persistence identifiers; full review evidence remains durable.
- CXO decision: none
- Next: Complete installed-runtime, visual, documentation, and independent-preservation acceptance.

## M2.8 — Founder acceptance and installed product

- Milestone: Validate Mission 2 as one coherent installed product rather than a collection of modules.
- Outcome: The installed Founder application serves successfully on its local-only endpoint. Rendered desktop acceptance confirms a dominant Person/Net Worth centre, differentiated luminous Worlds, visible orbital hierarchy, premium atmospheric depth, restrained utility navigation, and sufficient open space without the former giant lower panel. Cashflow, Lifestyle, Investments, objects, review, statements, and facts all remain part of the same product journey.
- Validation: Local endpoint returned HTTP 200; final production build passed; all 119 tests passed; rendered 1440 × 1100 visual inspection passed. Keyboard, focus, reduced-motion, tablet, and mobile behavior remain covered by source acceptance tests and responsive rules.
- Commit: final Mission acceptance documentation commit
- Preserved: The acceptance image remained temporary and outside Git. No source statements, runtime databases, or private canonical values enter source preservation.
- CXO decision: none
- Next: Create the final source commit and independent verified bundle.

## M2.1 correction — Living financial constellation

- Milestone: Remove the solar-system interpretation without changing Mission 2 financial capability.
- Outcome: Elliptical orbits and spherical planet treatment were replaced in the existing UI with an asymmetric constellation, irregular luminous Worlds, factual connection paths, restrained moving money pulses, and quieter guidance. Existing depth navigation continues to drive Person → World → Object travel and Back. Mobile reuses a simple horizontal exploration layout.
- Validation: Chrome desktop and mobile renders inspected; ESLint, TypeScript, all 119 tests, and production build passed.
- Complexity: Three existing product/test files changed, no product files added or removed, no dependencies or architecture layers added.
- Preserved: All canonical calculations, persistence, ingestion, coverage, recurrence, privacy, and Unknown semantics.
- CXO decision: Founder visual acceptance pending.

## M2.2 correction — Recursive spatial interaction

- Milestone: Tighten Person → World → Object travel before adding any new capability.
- Outcome: Cash, Investments, and Liabilities expose real account balls; Lifestyle exposes up to five factual category balls; Cashflow exposes Money In, Money Out, Recent, and Upcoming balls. Selecting a child moves it to the centre while Net Worth and its parent World remain visible and clickable for outward travel. Detail is reduced to a compact supporting surface using Past / Now / Next where evidence exists. Dotted connectors are replaced by layered Fluid Aurora paths with a restrained moving current.
- Validation: ESLint passed; TypeScript passed; all 119 tests passed; production build passed. Chrome interaction and visual acceptance remain pending because Chrome control was not connected in this task.
- Complexity: Four existing product/test files changed, no product files added or removed, no dependencies, backend contracts, persistence, or architecture layers changed.
- Preserved: Canonical calculations, encrypted local storage, import/review workflows, coverage, recurrence, privacy boundaries, factual Known versus Expected language, and Unknown semantics.
- CXO decision: Founder visual acceptance pending.

## M2.3 — Finish the Founder experience

- Milestone: Complete safe historical ingestion and finish the recursive Founder journey without expanding the architecture.
- Outcome: The configured inbox is now the validation authority root and the worker scans only loose inbox files plus the six explicitly authorized immediate account folders. It never recursively discovers candidates, retains organized Founder originals, and reconciles in the background without delaying the UI. Supported transaction history increased from 852 to 1,291 canonical records while all 42 investment snapshots remained intact. Narrow high-confidence categorization is applied at read time to historical unclassified records while Founder corrections and learned rules retain priority. Recursive World and account travel now returns home through VORVEX, account detail always uses Past / Now / Next, activity is bounded, and the supporting surface is a centred bottom layer rather than a right panel.
- Validation: ESLint and TypeScript passed; all 121 tests and the production build passed before installation. Post-boundary focused tests and a second production build passed. The installed local-only endpoint returned HTTP 200 and its LaunchAgent was running. The six authorized account folders retained their original aggregate PDF counts. Chrome desktop/mobile interaction remains pending because the required ChatGPT browser-control extension was not installed.
- Complexity: Existing ingestion, attribution, homepage, styling, tests, and architecture documentation were updated; no dependency, service, persistence model, or security framework was added.
- Preserved: Financial document access remains limited to the configured inbox and named immediate folders; no broad filesystem discovery or new permissions were introduced. Originals, encrypted canonical storage, 42 investment snapshots, provenance, Unknown semantics, and Founder authority were preserved.
- CXO decision: Founder visual acceptance pending.
- Next: Founder completes visual acceptance in Chrome after browser control is available. Stop until a new Founder/CTO mission is authorized.

## M2.4 — Transaction intelligence and first complete products

- Milestone: Make TD Chequing and TD Credit Card the first coherent transaction-understanding vertical slice.
- Outcome: Conservative deterministic understanding and the existing learned-rule authority now classify 60% of spending value, up from 2%, without rewriting the 1,291 canonical transactions. Active classification is grouped by exact normalized counterparty, account, direction, and meaning; 202 prioritized groups represent 341 unresolved transactions instead of presenting the entire history one row at a time. One grouped decision resolves matching history atomically and creates one narrow account-scoped future rule. Cash/Credit objects expose factual activity, purchases, refunds, payments, categories, statement obligations, and recurrence evidence. Cashflow and Lifestyle use the same canonical meanings, while credit-card payments and investment-labelled transfers remain excluded from spending. Investment value movement remains neutral and account contribution linkage stays Unknown without matching evidence.
- Experience: Mature spatial depths now use one canvas, an independently closable Past / Now / Next surface, and a right intelligence rail. Net Worth and parent Worlds remain spatial navigation controls; VORVEX returns home. Depth scale, perspective, atmospheric falloff, responsive viewport adaptation, dimensional entities, and restrained existing Aurora paths were tightened without a graphics dependency.
- Validation: ESLint and TypeScript passed; all 123 tests and the production build passed. The installed local-only service survived restart and returned HTTP 200; warm homepage response was approximately 0.38 seconds. Chrome visual acceptance could not run because the ChatGPT Chrome extension and native host were unavailable.
- Complexity: Fourteen existing source/test files changed before this milestone entry; no dependency, service, folder, database schema, persistence model, or parallel categorization engine was added.
- Preserved: The configured inbox remains the exact financial-document authority root. Founder originals, 1,291 encrypted canonical transactions, 42 investment snapshots, correction/rule precedence, relationship suppression, Unknown semantics, and no-return claims are preserved.
- Deferred honestly: A true transaction-only correction requires durable explicit-correction persistence not present in the current review store; the grouped workflow ships first rather than misleadingly creating a reusable rule from an action labelled transaction-only. Drag/drop and unsupported investment performance remain deferred.
- CXO decision: none. Founder visual acceptance pending.
- Next: Stop until Founder/CTO authorization; complete Chrome visual acceptance when browser control is available.

## M2.5 — Correct the current Vorvex experience

- Milestone: Correct the Founder-rejected connector, repeated analytics, activity-surface, depth, collision, and navigation behavior without expanding product scope.
- Outcome: The prior SVG connector/stroke implementation was removed completely. Net Worth now sits within a volumetric Aurora field built from three broad translucent CSS-filled veils, independent depth planes, organic curvature, slow opacity/shape motion, and travelling particles. No line, beam, graph edge, stroke dash, or World-to-World connector remains. Selected Worlds move higher and forward; outward objects become compact navigation controls whose values are hidden at depth, preventing Net Worth or background labels from bleeding through foreground Worlds. The bottom surface uses Past / Now / Next activity for Cash, Liabilities, Investments, Lifestyle, Cashflow and their mature children. X closes only that surface, and a dedicated control reopens it without navigation. The independent right rail now derives only from the selected World or account; global Lifestyle observations no longer appear in Investments or unrelated Worlds.
- Reference slice: Cash, TD Chequing and TD Credit retain factual deposits, withdrawals, purchases, refunds, payments, categories, recurring evidence and obligations. Grouped review and correction authority are unchanged.
- Validation: ESLint, TypeScript, all 125 tests and the production build pass. Source acceptance proves connector primitives are absent, contextual rails do not map the global insight feed, surface close/open is independent, reduced motion is respected, and foreground text is occluded at depth. Chrome visual inspection remains blocked because the required ChatGPT Chrome extension and native-host manifest are not installed; visual completion is not claimed.
- Complexity: Existing spatial component, stylesheet, source acceptance test and this milestone record changed. No dependency, graphics runtime, persistence model, service, financial model or architecture layer was added.
- Preserved: Exact authorized inbox boundary, originals, encrypted canonical data, Founder corrections, learned rules, relationship suppression, financial truth and Unknown semantics.
- CXO decision: none. Founder visual acceptance pending.
- Next: Stop. Perform the required ten-second Chrome visual acceptance after browser control is installed.

### M2.5 visual correction — Option 3 source of truth

- Correction: Replaced the geometric clipped veils with five overlapping, softly blurred Aurora ribbon volumes and a shared multicolor haze. Cyan, green, purple, pink and orange fields now curve around and between the financial balls through layered translucency, changing organic radii and slow multidimensional motion. They remain filled energy fields: no connector, graph edge, beam, SVG path or thin stroke was introduced.
- Navigation: At object depth, the visible selected World ball is now an explicit one-level outward control. Cash from TD Chequing returns to Cash, and the same behavior applies to every account, Lifestyle category and Cashflow child. Net Worth still returns home, breadcrumbs remain secondary, and X still closes only the bottom activity surface.
- Scope: UI component, stylesheet, source acceptance test and this existing milestone record only. Backend, canonical data, ingestion and security architecture are unchanged. Founder visual acceptance remains pending.

## M2.6 — Glass orbs and grouped transaction review

- Glass orbs: World and child objects retain their spatial motion and the accepted Aurora, but now use circular translucent shells, hard specular highlights, internal reflected light, refraction-like layered gradients, shadow depth and restrained per-World color. The treatment remains abstract financial glass rather than literal planets and uses existing CSS/DOM only.
- Grouped review: The existing exact normalized-counterparty, account, direction and meaning grouping remains the conservative identity boundary. Each group now exposes its normalized merchant/name, representative raw description, count, total, account context, direction, current suggestion and up to three representative transactions. Default ordering is recurrence first, then value, recency, Cashflow/Lifestyle impact and remaining groups. Founder actions are Apply to all matching transactions, Only this transaction, and Skip / unsure. Group classification still commits atomically and creates the existing narrow account-scoped learned rule.
- Scope: Existing UI, review service/DTO/runtime and tests only. No module, dependency, ingestion, security, canonical-data or investment expansion.

## M2.7 — Live Vorvex Universe

- Visual system: Each glass World now contains a compact luminous identity drawn with inline semantic SVG: wallet, cashflow chart, investment growth, cup, liability card, vehicle and home. Account/child glass objects inherit their parent World identity. Net Worth remains the dominant refractive centre; labels and factual values remain unchanged.
- Atmosphere: Replaced the prior elongated Aurora treatment with five overlapping multi-lobed cloud volumes and a blended atmospheric field. Radial density pockets, soft highlights, blur, screen blending, depth transforms and slow independent deformation create connected cyan, green, violet, pink and amber financial atmosphere without lines, connectors, beams, graph edges, geometric ribbons or additional rendering dependencies.
- Interaction and performance: Existing World, account, parent, Net Worth and X behavior is unchanged and source-tested. Motion is compositor-friendly transform/opacity animation over a fixed ten-element atmospheric DOM, reduced-motion remains supported, and no canvas/WebGL/runtime graphics dependency was added.
- Scope: Universe component, Universe stylesheet, source regression test and this existing milestone record only. Financial data, grouped review, categorization, ingestion, security, backend architecture, calculations and unrelated screens are unchanged. Founder visual acceptance pending.

### M2.7 approved WebGL2 Aurora pass

- Renderer: Replaced the rejected CSS cloud/gradient Aurora with one isolated native WebGL2 canvas behind the unchanged DOM Universe. A full-screen fragment shader builds domain-warped fBM density, multi-scale body and curl structure, bright inner density, transparent luminous edges, five blended Vorvex hues, dark negative space and sparse stars. The canvas receives no props or financial data and performs no network, storage or filesystem work.
- Performance and resilience: Internal resolution is 58% with device pixel ratio capped at 1.25. The loop measures delivered frames and adapts between 60 and 30 fps, stops while the document is hidden, renders a static time state for reduced motion, responds to resize and falls back to a restrained static CSS atmosphere when WebGL2 or shader compilation is unavailable. No dependency was added.
- Preserved: Glass orbs, icons, navigation, layout, activity panels, review, financial behavior and all backend/security/data systems are unchanged. Founder visual acceptance pending.

## M2.8 — Usability and financial understanding

- Readability: Raised the product baseline type scale and contrast, then strengthened the existing Universe hierarchy for navigation, World/account labels, secondary values, metadata, activity surfaces and intelligence text without changing layout or the WebGL2 Aurora.
- Spatial travel: Extended the existing stable DOM-object transitions to use a shared one-second spatial easing. Selected, parent and surrounding orbs now transition as one constellation; child objects follow the same cadence, and the intelligence rail/activity surface enter after the spatial movement begins. Reduced motion removes these animations. Navigation semantics are unchanged.
- Needs Attention: Replaced the three internal taxonomy controls with a typeable/searchable “What was this?” concept selector. Existing canonical concepts translate Founder language into financial meaning, category and World; each suggestion explains its path and remains unselected until Founder confirmation. Group impact is shown before Apply all, Only this transaction and Skip / unsure. The existing encrypted atomic group decision and narrow learned-rule path remain authoritative.
- Downstream: Home/Mortgage classification maps to canonical expense + Mortgage + Home. It remains a Cashflow outflow and account activity but is excluded from Lifestyle spending because Home, Vehicle, Investment and Liability movements are not lifestyle merely because cash moved. Refund, income, fee, card-payment and transfer semantics remain unchanged.
- Genuine limitation: “Other / describe it” is available and explicitly refuses to force an unknown concept into an existing category, but the description is not saved because the encrypted review schema has no Founder-proposed taxonomy entity. Persisting and governing new concepts requires a CXO schema/taxonomy decision; no workaround or parallel engine was created.

## Mission 2.8 — Foundational usability and financial understanding

- Product continuity: My data, Statements and Needs attention now use one persistent Vorvex shell with stable navigation and a logo return to the Universe. Redundant page-level back links are removed.
- Founder language: Review presents one prioritized item and Vorvex's proposal first. Search understands common phrases for Home, Vehicle, Lifestyle, income, fees and transfers. “Other” progressively asks for a World and an existing meaning instead of exposing internal classification controls.
- Local learning: Founder wording is stored only as an encrypted alias to a confirmed existing concept. The alias is written atomically with the historical decision and narrow future match; it cannot create arbitrary Worlds or categories.
- Conservative understanding: Evidence-based amount dispersion separates genuinely ambiguous merchant histories while stable recurring groups remain grouped. Banking fee charges and rebates share Banking Fees while keeping distinct meaning and direction.
- Preserved: WebGL Aurora, glass orbs, canonical financial data, calculations, ingestion, authorization boundary, encrypted local storage, provenance, rule precedence and Unknown semantics are unchanged.

## Mission 2.9 — Persistent Universe and one-decision review

- Environment: The native WebGL2 renderer now fills the full viewport with no stage rectangle. Its deterministic procedural field retains visual continuity across refreshes, runs at substantially lower brightness and motion, and preserves renderer privacy, adaptive resolution, hidden-tab pause, reduced motion and CSS fallback.
- Spatial system: World travel uses one brief reusable arrival transition and settles into the existing recursive World/object model. Reduced motion removes travel animation without changing navigation. Empty permanent intelligence rails are removed; intelligence appears only for a selected account or category.
- Typography: Product-wide tokens now govern hero metrics, World metrics, titles, headings, object labels, body, secondary and metadata sizes, with tabular financial figures and final contrast overrides.
- Review: Needs Attention is a compact transaction → World → meaning → Confirm flow. Strong evidence enables direct Confirm; weak evidence presents World objects first. Natural-language “New” proposals remain constrained to supported concepts.
- Correction: Immediate Undo and later Change remove the decision, learned rule and newly created alias atomically, then return the original transaction for review. Review later creates no classification and automatically re-enters the queue after 24 hours.
- Preserved: Canonical transactions, direction, downstream Cashflow/Lifestyle semantics, ingestion, statement boundary, encryption, provenance and the established Founder-language interpretation system.
- Scope: Existing review service/DTO/form/page, homepage projection, global typography/spatial CSS, tests and this milestone record. Canonical architecture, ingestion, encryption, security boundary, financial data and the WebGL2 Aurora are unchanged. Founder acceptance pending.
