import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { analyzeTdCreditCardPdf } from "../lib/financial-files/td-credit-card-pdf-analyzer.ts";
import { buildSyntheticTdCreditCardPdf } from "./helpers/synthetic-td-credit-card-pdf.ts";

const analyze = async (options = {}) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "vorvex-card-analysis-"));
  const sourcePath = path.join(root, "statement.pdf");
  try {
    await writeFile(sourcePath, buildSyntheticTdCreditCardPdf(options));
    return await analyzeTdCreditCardPdf({ sourcePath, allowedRoot: root });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

test("recognizes the characterized TD credit-card structure using constrained evidence", async () => {
  const result = await analyze();
  assert.equal(result.status, "recognized");
  assert.equal(result.pageCount, 7);
  assert.equal(result.statementPageCount, 4);
  assert.equal(result.transactionPageCount, 3);
  assert.equal(result.transactionHeaderOccurrenceCount, 3);
  assert.equal(result.transactionRowCount, 6);
  assert.equal(result.chargeRowCount, 4);
  assert.equal(result.creditRowCount, 2);
  assert.equal(result.continuedMarkerCount, 2);
  assert.equal(result.terminalBalanceMarkerCount, 1);
  assert.equal(result.transactionTableBoundaryDetected, true);
  assert.equal(result.separateTransactionAndPostingDatesDetected, true);
  for (const key of [
    "tdMarkerDetected",
    "creditCardMarkerDetected",
    "statementDateDetected",
    "statementPeriodDetected",
    "previousBalanceDetected",
    "newBalanceDetected",
    "paymentDueDateDetected",
    "minimumPaymentDetected",
    "paymentsAndCreditsTotalDetected",
    "purchasesAndChargesTotalDetected",
    "cashAdvancesTotalDetected",
    "interestTotalDetected",
    "feesTotalDetected",
  ] as const) assert.equal(result[key], true);
  const serialized = JSON.stringify(result);
  for (const forbidden of [
    "SYNTHETIC_PERSON_NAME",
    "SYNTHETIC PURCHASE",
    "PREAUTHORIZED PAYMENT",
    "99,999.00",
    "statement.pdf",
  ]) assert.equal(serialized.includes(forbidden), false);
});

test("fails closed for missing identity or transaction boundaries", async () => {
  assert.equal((await analyze({ includeTdMarker: false })).status, "structure-not-recognized");
  assert.equal((await analyze({ includeCardMarker: false })).status, "structure-not-recognized");
  assert.equal((await analyze({ missingTerminal: true })).status, "structure-not-recognized");
  assert.equal((await analyze({ duplicateTerminal: true })).status, "structure-not-recognized");
});
