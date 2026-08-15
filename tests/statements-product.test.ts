import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pagePath = new URL("../app/statements/page.tsx", import.meta.url);
const actionsPath = new URL("../app/statements/actions.ts", import.meta.url);
const operationalPath = new URL("../lib/runtime/load-operational-view.ts", import.meta.url);
const controlsPath = new URL("../components/statement-actions.tsx", import.meta.url);

test("Statements product exposes the supported local workflow without private diagnostics", async () => {
  const [page, actions, operational, controls] = await Promise.all([readFile(pagePath, "utf8"), readFile(actionsPath, "utf8"), readFile(operationalPath, "utf8"), readFile(controlsPath, "utf8")]);
  for (const expected of ["TD Chequing", "TD Credit Card", "Automatic scanning", "Already processed", "Needs Review", "Available history", "Private by design"]) assert.equal(page.includes(expected), true, expected);
  assert.match(controls, /Open statement inbox/);
  assert.match(controls, /Scan now/);
  assert.match(actions, /scanFounderStatements/);
  assert.match(actions, /revalidatePath\("\/"\)/);
  assert.match(actions, /spawnSync\("\/usr\/bin\/open"/);
  assert.match(operational, /safeExplanation/);
  for (const forbidden of ["resultId", "importId", "safeReasonCode"]) assert.equal(page.includes(forbidden), false, forbidden);
});
