import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("My Data covers normal Founder maintenance without browser identifiers", async () => {
  const [page, actions] = await Promise.all([
    readFile(new URL("../app/facts/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/facts/actions.ts", import.meta.url), "utf8"),
  ]);
  for (const expected of ["My data", "Known accounts", "Add an unsupported account", "Home and Vehicle", "Effective date"]) assert.equal(page.includes(expected), true, expected);
  assert.match(page, /account-\$\{index \+ 1\}/);
  assert.doesNotMatch(page, /canonicalAccountId|founder-account-/);
  assert.match(actions, /loadCanonicalFinancialModel/);
  assert.match(actions, /randomUUID/);
});
