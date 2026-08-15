# Vorvex Global Product Contract

This contract freezes the Founder-approved interaction system without changing financial truth, taxonomy, ingestion, encryption, provenance, or canonical boundaries.

## Financial Orb Contract

Every financial object is rendered by `FinancialOrb`. Its indivisible anatomy is always:

1. name;
2. glass ball with one centered semantic icon;
3. value or status.

Callers may provide only content, accent, size (`compact`, `secondary`, `primary`, `hero`), state (`idle`, `selected`, `parent`, `receded`), placement class, and navigation target. A World, account, category, Cashflow object, or review World must not recreate this internal markup or override its internal geometry.

`FinancialWorldIcon` owns the shared semantic World icon set. Future financial objects should pass their semantic icon into `FinancialOrb`; they should not draw a second visible object around it.

## Spatial Navigation Contract

The Universe is one persistent scene. Navigation changes object state and placement:

- idle objects form the constellation;
- selection advances the chosen object while the rest recede;
- child objects reuse the same Orb anatomy;
- selecting a child advances it and leaves its parent visible as the return target;
- returning reverses those states instead of introducing a separate page grammar.

Screen- or World-specific CSS may position whole Orb instances. It must not rearrange name, ball, icon, or value.

## HUD Contract

`FinancialHud` is the single spatial information-surface shell. It owns the glass surface, close control, polite live region, glow, and content boundary. World, account, category, and Cashflow content is injected inside it. Closing the HUD hides information without changing spatial depth; spatial back navigation remains on the parent Orb or Universe control.

## Authoritative Facts

The Browser receives only `HomepageViewModel`. Shared account balances, transaction classifications, World attribution, period scope, and totals are derived before rendering. Orb and HUD components display those facts and never create financial calculations, identifiers, persistence, or fallback values.

## Extension Rule

To add a future World or object:

1. add its authoritative projection to the existing safe homepage view;
2. render it with `FinancialOrb`;
3. choose an existing size and state;
4. place the whole Orb using constellation/child coordinates;
5. render detail through `FinancialHud`;
6. extend the structural contract test if a new render path is introduced.

Do not add a new orb component, duplicate the anatomy, or introduce a World-specific anatomy selector.
