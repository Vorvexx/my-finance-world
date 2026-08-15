import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Founder prototype connects the normal product journey without engineering tools", async () => {
  const files = await Promise.all([
    "../components/financial-home.tsx", "../components/vorvex-shell.tsx", "../app/facts/page.tsx", "../app/statements/page.tsx", "../app/review/page.tsx", "../app/setup/page.tsx",
  ].map((file) => readFile(new URL(file, import.meta.url), "utf8")));
  const product = files.join("\n");
  for (const capability of [
    "Net worth", 'label: "Cash"', 'label: "Investments"', 'label: "Liabilities"', 'label: "Cashflow"',
    'label: "Lifestyle"', 'label: "Home"', 'label: "Vehicle"', "Money In", "Money Out", "Recent", "Upcoming",
    "My data", "Statements", "Needs attention",
  ]) assert.equal(product.includes(capability), true, capability);
  for (const route of ['href="/facts"', 'href="/statements"', 'href="/review"', 'href="/"']) assert.equal(product.includes(route), true, route);
  assert.doesNotMatch(product, /sqlite|fingerprint|importId|transactionId|database identifier/i);
});
