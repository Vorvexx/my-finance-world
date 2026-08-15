import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const componentPath = new URL("../components/financial-home.tsx", import.meta.url);
const pagePath = new URL("../app/page.tsx", import.meta.url);
const stylesPath = new URL("../app/globals.css", import.meta.url);
const rendererPath = new URL("../components/webgl-aurora.tsx", import.meta.url);
const reviewPagePath = new URL("../app/review/page.tsx", import.meta.url);
const reviewFormPath = new URL("../components/review-decision-form.tsx", import.meta.url);

test("Universe consumes only the browser-safe homepage view", async () => {
  const [component, page] = await Promise.all([readFile(componentPath, "utf8"), readFile(pagePath, "utf8")]);
  assert.match(component, /HomepageViewModel/);
  assert.match(page, /<FinancialHome view=\{view\} \/>/);
  for (const forbidden of ["sqlite", "database", "import-journal", "statement-parser", "fingerprint", "setInterval", "fetch(", "transactionId", "reviewId", "importId"])
    assert.equal(component.includes(forbidden), false, forbidden);
});

test("Universe exposes factual recursive Worlds and compact detail surfaces", async () => {
  const component = await readFile(componentPath, "utf8");
  for (const world of ["Cash", "Investments", "Liabilities", "Home", "Vehicle", "Lifestyle", "Cashflow"])
    assert.equal(component.includes(`label: "${world}"`), true, world);
  for (const phrase of [
    "SpatialChild", "accountChildren", "CashflowChildDetail", "selectedCashflow", "Money In", "Money Out", "Recent", "Upcoming",
    "Nothing known yet", "LifestyleDetail", "supporting transaction", "Review these uncategorized transactions", "RealWorldDetail",
    "Property value", "Vehicle financing", "Add factual information", "Net worth", "journey-trail",
    "child-object", "WorldIcon", "WebglAurora", "pnn-grid", "IntelligenceRail", "Lifestyle spending",
    "Obligations", "Cashflow", "Contribution portions are context only and are never added",
    "Latest known statement", "does not replace or add to the canonical liability balance",
  ]) assert.equal(component.includes(phrase), true, phrase);
  assert.match(component, /: "Unavailable"/);
  assert.match(component, /category\.label === selectedLifestyle/);
  assert.match(component, /setSelectedAccount\(account\)/);
  assert.match(component, /selectWorld\(selected\)/);
  assert.match(component, /Around \{item\.date\}/);
  assert.match(component, /Due \{item\.date\}/);
  assert.match(component, /href="\/statements"/);
  assert.match(component, /href="\/facts"/);
  assert.doesNotMatch(component, /AccountObjects|TimelineDetail|Explore a World|Back to Lifestyle/);
  assert.doesNotMatch(component, /orbit-line|orbit-cash|orbit-investments/);
  assert.doesNotMatch(component, /FinancialConnection|connection-line|connection-current|money-pulse|<animateMotion/);
  assert.doesNotMatch(component, /mock|placeholder balance|sample financial/i);
});

test("Universe remains keyboard-operable, responsive, and motion-safe", async () => {
  const [component, styles, renderer] = await Promise.all([readFile(componentPath, "utf8"), readFile(stylesPath, "utf8"), readFile(rendererPath, "utf8")]);
  for (const phrase of ["<button", "aria-pressed", "aria-live=\"polite\"", "setSelectedAccount(null)"])
    assert.equal(component.includes(phrase), true, phrase);
  for (const pattern of [
    /@media \(max-width: 820px\)/, /@media \(max-width: 620px\)/, /@media \(prefers-reduced-motion: reduce\)/,
    /depth-world/, /surface-arrive/, /webgl-aurora/, /world-drift/, /depth-object \.child-object\.is-selected/,
    /depth-object \.world-node\.is-selected/, /pnn-grid/, /:focus-visible/,
  ]) assert.match(styles, pattern);
  for (const pattern of [/webgl2/, /powerPreference: "high-performance"/, /devicePixelRatio/, /\.58/, /1000 \/ 30/, /visibilitychange/, /prefers-reduced-motion/, /dataset\.fallback/, /requestAnimationFrame/]) assert.match(renderer, pattern);
  for (const forbidden of ["HomepageViewModel", "CanonicalTransaction", "fetch(", "WebSocket", "localStorage", "indexedDB"]) assert.equal(renderer.includes(forbidden), false, forbidden);
});

test("information surfaces close independently from spatial navigation", async () => {
  const component = await readFile(componentPath, "utf8");
  assert.match(component, /const closeSurface = \(\) => \{ setSurfaceAfterTravel\(false\); setSurfaceOpen\(false\); \}/);
  assert.match(component, /aria-label="Close information surface"/);
  assert.match(component, /<IntelligenceRail view=\{view\}/);
  assert.match(component, /onClick=\{leaveWorld\} aria-label="Return to Universe"/);
  assert.match(component, /const leaveObject = \(\) => \{ setSelectedAccount\(null\); setSelectedLifestyle\(null\); setSelectedCashflow\(null\); beginTravel\(true\); \}/);
  assert.match(component, /onClick=\{isParent \? leaveObject : \(\) => selectWorld\(world\.key\)\}/);
  assert.match(component, /aria-label=\{isParent \? `Return to \$\{world\.label\}` : undefined\}/);
});

test("intelligence is contextual rather than a repeated global feed", async () => {
  const component = await readFile(componentPath, "utf8");
  for (const context of ['world === "cash"', 'world === "cashflow"', 'world === "lifestyle"', 'world === "investments"', 'world === "liabilities"']) assert.equal(component.includes(context), true, context);
  assert.doesNotMatch(component, /view\.insights\.map/);
});

test("foreground Worlds occlude outward text and keep activity below the spatial canvas", async () => {
  const styles = await readFile(stylesPath, "utf8");
  assert.match(styles, /depth-world \.person-core strong[^}]+display:none/);
  assert.match(styles, /depth-world \.world-node:not\(\.is-selected\) span[^}]+opacity:0/);
  assert.match(styles, /universe-shell\.depth-world:has\(\.world-dock\) \.world-node\.is-selected/);
  assert.match(styles, /open-activity/);
  assert.match(styles, /world-node i::before/);
  assert.match(styles, /backdrop-filter:blur\(5px\) saturate\(1\.35\)/);
  assert.match(styles, /border-radius:50%/);
  assert.doesNotMatch(styles, /aurora-ribbon|aurora-cloud|aurora-particle|aurora-flow-a/);
});

test("desktop typography is readable and spatial surfaces follow the orb transition", async () => {
  const styles = await readFile(stylesPath, "utf8");
  for (const pattern of [
    /--type-hero:clamp\(2\.75rem/, /--type-body:1rem/, /--type-meta:\.75rem/,
    /world-node \{ transition:transform 1\.05s/, /intelligence-rail \{ animation-duration:\.72s;animation-delay:\.2s/,
    /world-dock \{ animation-duration:\.72s;animation-delay:\.26s/,
  ]) assert.match(styles, pattern);
  assert.match(styles, /prefers-reduced-motion:reduce[^}]+world-node[^}]+transition:none!important/);
});

test("Aurora is deterministic, calm, viewport-wide, and renderer-private", async () => {
  const [styles, renderer] = await Promise.all([readFile(stylesPath, "utf8"), readFile(rendererPath, "utf8")]);
  assert.match(styles, /\.webgl-aurora \{ position:fixed;inset:0;z-index:0;width:100vw;height:100svh/);
  assert.match(renderer, /time \* 0\.0045/);
  assert.doesNotMatch(renderer, /Math\.random|crypto\.getRandomValues|financial|transaction|account/);
});

test("Founder acceptance removes ghost Worlds and supports in-context transaction correction", async () => {
  const [component, styles] = await Promise.all([readFile(componentPath, "utf8"), readFile(stylesPath, "utf8")]);
  assert.doesNotMatch(component, /className="world-focus"/);
  assert.match(styles, /\.webgl-aurora \{ position:fixed !important/);
  assert.match(styles, /\.world-dock,\.universe-shell\[class\*="world-"\] \.world-dock/);
  assert.match(component, /InlineTransactionCorrection/);
  assert.match(component, /setSelectedLifestyle\(category\.label\); beginTravel\(true\)/);
  assert.match(component, /surfaceOpen && !travelling/);
});

test("Foundation v1 freezes one object grammar and continuous teaching flow", async () => {
  const [styles, reviewPage, reviewForm] = await Promise.all([
    readFile(stylesPath, "utf8"), readFile(reviewPagePath, "utf8"), readFile(reviewFormPath, "utf8"),
  ]);
  assert.match(styles, /Foundation v1 invariants/);
  assert.match(styles, /world-node>span,.child-object>span \{ order:1/);
  assert.match(styles, /world-node>svg,.child-object>svg \{ position:static; order:2/);
  assert.match(styles, /world-node>strong,.child-object>strong \{ order:3/);
  assert.match(styles, /max-height:34svh/);
  assert.match(reviewPage, /Only explicitly selected transactions will change/);
  assert.match(reviewPage, /relationshipQueue\.items\.length > 0/);
  assert.doesNotMatch(reviewPage, /Relationship queue is clear|pending relationship candidates/);
  assert.match(reviewForm, /scrollIntoView\(\{ behavior: "smooth", block: "center" \}\)/);
  assert.match(reviewForm, /window\.setTimeout\(\(\) => router\.refresh\(\)/);
  assert.doesNotMatch(reviewForm, /Next transaction/);
});
