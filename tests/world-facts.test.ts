import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { founderRuntimePaths } from "../lib/runtime/paths.ts";
import { loadFounderWorldFacts, saveFounderWorldFacts, validateFounderWorldFacts } from "../lib/runtime/world-facts.ts";

const facts = { version: 1 as const, home: {
  property: { value: 400000, currency: "CAD" as const, effectiveDate: "2026-08-09", source: "founder-manual" as const },
  mortgage: { institution: "Factual Bank", balance: 250000, currency: "CAD" as const, effectiveDate: "2026-08-09", source: "founder-manual" as const },
} };

test("Founder World facts persist locally with narrow validation and owner-only permissions", () => {
  const home = mkdtempSync(path.join(os.tmpdir(), "vorvex-world-facts-"));
  saveFounderWorldFacts(facts, home);
  assert.deepEqual(loadFounderWorldFacts(home), facts);
  assert.equal(statSync(founderRuntimePaths(home).worldFactsFile).mode & 0o777, 0o600);
  assert.throws(() => validateFounderWorldFacts({ ...facts, home: { ...facts.home, mortgage: { ...facts.home.mortgage, balance: -1 } } }), /WORLD_FACTS_INVALID/);
  assert.throws(() => validateFounderWorldFacts({ ...facts, additionalAccounts: [{ id: "bad", name: "", institution: "Bank", balance: 1, type: "asset", group: "cash", effectiveDate: "2026-08-09", source: "founder-manual" }] }), /WORLD_FACTS_INVALID/);
});
