import test from "node:test";
import assert from "node:assert/strict";
import { parseTdInvestmentPdf, TdInvestmentParserError } from "../lib/financial-files/td-investment-pdf-parser.ts";
import { buildSyntheticTdInvestmentPdf } from "./helpers/synthetic-td-investment-pdf.ts";

const source = (bytes: Uint8Array) => ({ bytes, metadata: {
  internalFileId: "synthetic", byteSize: bytes.byteLength, sha256: "synthetic-hash", detectedFileType: "application/pdf" as const,
  intakeTimestamp: "2099-07-01T00:00:00.000Z", validationResult: "accepted" as const, status: "validated" as const,
} });

test("parses factual TD investment period, ending value, and book cost without inventing performance", async () => {
  const parsed = await parseTdInvestmentPdf(source(buildSyntheticTdInvestmentPdf()));
  assert.equal(parsed.accountType, "tfsa");
  assert.equal(parsed.statementPeriodStart, "2099-04-01");
  assert.equal(parsed.statementPeriodEnd, "2099-06-30");
  assert.equal(parsed.endingValueCents, 2_000_000);
  assert.equal(parsed.bookCostCents, 1_500_000);
  assert.equal(parsed.contributionsCents, null);
});

test("fails closed when the total-assets value is ambiguous", async () => {
  await assert.rejects(() => parseTdInvestmentPdf(source(buildSyntheticTdInvestmentPdf({ marketValue: "Unavailable" }))),
    (error: unknown) => error instanceof TdInvestmentParserError && error.code === "TD_INVESTMENT_VALUE_INVALID");
});
