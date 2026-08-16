# Vorvex Visual & Spatial Contract V1

**Status:** Frozen foundation  
**Scope:** Founder financial Universe, Worlds, Objects, HUDs, intelligence and spatial travel

## Philosophy

Vorvex is one continuous financial universe. Navigation expresses depth: the selected financial object travels inward, becomes the active centre, and reveals its children around it. Pages must not feel like unrelated dashboards or route changes.

The scene remains calm when settled and fast while travelling. Financial truth is primary; visual atmosphere supports it.

## Scene hierarchy

Every supported spatial view uses the same hierarchy:

1. Minimal global header and breadcrumb
2. One active centre `FinancialOrb`
3. A `FinancialConstellation` of surrounding children
4. One globally sized bottom `FinancialHud`
5. Quiet footer provenance and coverage

`FinancialScene` owns the header, footer and HUD safe zones. The scene geometry is identical whether the HUD is open or closed.

## Canonical orb anatomy

Every financial object uses `FinancialOrb` as one atomic unit:

1. Name
2. Spherical glass object
3. Centred semantic icon
4. Value or truthful status

Net Worth is a hero-sized `FinancialOrb`; it has no bespoke dashboard anatomy. Asset, liability, coverage and provenance detail belongs in contextual surfaces or the footer.

The sphere uses controlled reflection, refraction, depth, internal colour and restrained glow. It must not become a flat card, generic bubble or neon badge.

## Constellation rules

`FinancialConstellation` is the only financial-object placement engine. It supports explicit count-balanced radial or elliptical layouts for one through eight children and a controlled spiral fallback for larger future sets.

Pages provide financial-object data, never coordinates. The engine owns:

- centre and child placement;
- count-based orbital composition;
- viewport containment;
- header, footer and HUD safe zones;
- arrival sequencing;
- parent, selected and receded states.

No merchant, category, account or World name may appear in geometry CSS. Adding a World or child must not require new positioning rules.

## HUD contract

All spatial information surfaces use `FinancialHud`.

- Wide, low and horizontally structured
- Fixed global width, bottom offset, padding, radius, glass and height limits
- Default information architecture: **Past | Now | Next**
- Section label: one line
- Primary insight: no more than two lines
- Supporting copy: no more than three lines
- Lists: approximately three useful items before drill-down
- No repetition of the centre value as a second visual headline

Close leaves a compact **Open details** control inside the reserved HUD zone. Opening or closing the HUD must cause zero constellation movement.

## Intelligence

`FinancialIntelligence` is secondary context. On wide viewports it may use a restrained rail. On constrained viewports it yields to the HUD rather than shrinking, moving or hiding the constellation.

## Typography

The shared typography tokens cover brand, breadcrumb, centre and child titles and values, HUD hierarchy, transactions and footer status. Titles remain attached to their orb and use controlled two-line limits. Pages must not invent spatial typography or shrink text to repair geometry.

## Colour

World colour is semantic and token-owned:

- Cash — green
- Cashflow — blue
- Investments — violet
- Liabilities — rose
- Lifestyle — orange
- Home — gold
- Vehicle — cyan
- Review state — neutral slate

Children inherit the parent World unless a defined semantic state requires otherwise. Colour applies to icon, value, sphere energy and restrained environmental response—not all text.

## Iconography

`VorvexIcon` is the controlled icon family. It defines one stroke weight, view box, optical scale and glow treatment. Lifestyle meanings use distinct semantic icons for Dining, Entertainment, Shopping, Convenience, Alcohol, Cannabis, Telecom, Subscriptions and Utilities. Review Later uses the review-state icon and treatment; it is not a Lifestyle spending category.

## Spacing and safe zones

`VorvexSafeZones` and spacing variables reserve the header, footer and bottom HUD regions before the constellation is calculated. The active centre sits in the upper-middle region. No HUD state, intelligence state or page content may compensate with page-level object offsets.

The Universe is clipped rather than scrollable. No keyboard, focus, HUD or navigation action may move an internal scroll container.

## Motion

`SpatialTransition` provides one sub-second travel sequence:

1. Selected orb intensifies
2. Surrounding orbit recedes
3. Selected orb becomes centre
4. Children settle sequentially
5. HUD updates after travel settles

World colour may subtly bias the environment during travel. The Aurora remains restrained and continuous.

Reduced-motion preference preserves the same navigation and final geometry while replacing vortex motion with effectively immediate depth and opacity changes. Functionality never depends on animation completion.

## Responsive behaviour

Responsive rules remain central. Supported acceptance viewports are:

- Founder connected-Chrome viewport
- 1440 × 900 common laptop
- 1280 × 720 smaller laptop
- 1024 × 700 compact laptop
- 1920 × 1080 large desktop

The engine may reduce radius, sphere scale and anatomy row height, but it may not change the object grammar, hide the active parent, introduce document scrolling or create page-specific layouts.

## Prohibited implementations

Feature pages must not:

- position `FinancialOrb` instances independently;
- introduce World-, category-, merchant- or account-named coordinates;
- create bespoke centre objects or HUD dimensions;
- reorder orb anatomy;
- create arbitrary colour or icon systems;
- duplicate centre headings or values in the HUD;
- hide the parent to fit children;
- move the scene when HUD or intelligence state changes;
- introduce scroll-based spatial navigation.

## Extension instructions

To add a future World, provide only:

- name;
- controlled semantic icon;
- controlled semantic colour;
- value or truthful status;
- child objects using the same data shape;
- Past, Now and Next HUD content.

`FinancialScene`, `FinancialConstellation`, `FinancialOrb`, `FinancialHud`, `FinancialIntelligence` and `SpatialTransition` must handle placement, fit, interaction and motion without new geometry CSS.

## Required acceptance

A change to the spatial product is not complete until automated validation and connected-Chrome acceptance both pass. The acceptance matrix must confirm:

- zero overlapping or clipped financial objects;
- zero HUD/orb collisions;
- active parent visible at every depth;
- stable geometry after every return;
- stable geometry across HUD open/close;
- no internal or document scrolling;
- semantic icon and colour use;
- zero Chrome console errors.
