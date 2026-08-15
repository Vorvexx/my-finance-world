import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  ExactMoneyParseError,
  parseUnsignedDecimalMoneyToCents,
} from "../lib/financial-files/exact-money.ts";
import { validateLocalPdf } from "../lib/financial-files/pdf-intake.ts";
import {
  parseTdChequingPdf,
  TdChequingParserError,
} from "../lib/financial-files/td-chequing-pdf-parser.ts";
import type { TdChequingParsedStatement } from "../types/financial-files.ts";
import {
  buildSyntheticTdPdf,
  type SyntheticTdPdfOptions,
} from "./helpers/synthetic-td-pdf.ts";

let scratchRoot: string;
let sequence = 0;

before(async () => {
  scratchRoot = await mkdtemp(path.join(os.tmpdir(), "vorvex-td-parser-test-"));
});

after(async () => {
  await rm(scratchRoot, { recursive: true, force: true });
});

const parseSynthetic = async (
  options: SyntheticTdPdfOptions = {},
  importId?: string,
): Promise<TdChequingParsedStatement> => {
  sequence += 1;
  const sourcePath = path.join(scratchRoot, `synthetic-${sequence}.pdf`);
  await writeFile(sourcePath, buildSyntheticTdPdf(options));
  const source = await validateLocalPdf({
    sourcePath,
    allowedRoot: scratchRoot,
    intakeTimestamp: "2099-08-01T00:00:00.000Z",
  });
  try {
    return await parseTdChequingPdf({
      source,
      importContext: { importId: importId ?? `synthetic-import-${sequence}` },
    });
  } finally {
    if (source.bytes.byteLength) source.bytes.fill(0);
  }
};

const expectSafeParserError = async (
  operation: Promise<unknown>,
  expectedCode: TdChequingParserError["code"],
) => {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof TdChequingParserError);
    assert.equal(error.code, expectedCode);
    assert.equal(error.message, expectedCode);
    for (const forbidden of [
      "SYNTHETIC_PERSON_NAME",
      "123 SYNTHETIC STREET",
      "SYNTHETIC_ACCOUNT_12345",
      "***REF-A",
      "1,450.00",
      scratchRoot,
    ]) {
      assert.equal(error.message.includes(forbidden), false);
    }
    return true;
  });
};

test("parses unsigned decimal money exactly into integer cents", () => {
  assert.equal(parseUnsignedDecimalMoneyToCents("0.00"), 0);
  assert.equal(parseUnsignedDecimalMoneyToCents("1.23"), 123);
  assert.equal(parseUnsignedDecimalMoneyToCents("1,234.56"), 123456);
  assert.equal(parseUnsignedDecimalMoneyToCents("1234.56"), 123456);
  for (const malformed of ["", "1", "1.2", "1.234", "1,23.45", "-1.00", "+1.00", "$1.00", "01.00"] ) {
    assert.throws(() => parseUnsignedDecimalMoneyToCents(malformed), ExactMoneyParseError);
  }
});

test("parses and fully reconciles the supported one-page TD layout", async () => {
  const result = await parseSynthetic({ lowerContent: true });

  assert.deepEqual(result.parser, {
    providerId: "td",
    accountType: "chequing",
    version: "td-chequing-pdf-v2",
  });
  assert.equal(result.currency, "CAD");
  assert.deepEqual(result.statementPeriod, {
    startDate: "2099-06-30",
    endDate: "2099-07-31",
  });
  assert.equal(result.openingBalanceCents, 100000);
  assert.equal(result.closingBalanceCents, 145000);
  assert.equal(result.totalWithdrawalsCents, 60000);
  assert.equal(result.totalDepositsCents, 105000);
  assert.equal(result.transactions.length, 5);
  assert.equal(result.transactions[1].transactionDate, "2099-07-02");
  assert.equal(result.transactions[2].transactionDate, "2099-07-02");
  assert.equal(result.transactions[3].transactionDate, "2099-07-02");
  assert.equal(result.transactions[0].sourceDescription, "SYNTHETIC PAY SPLIT");
  assert.equal(result.transactions[1].sourceDescription, "SYNTHETIC ***MID PURCHASE");
  assert.equal(result.transactions[1].normalizedDescription, "SYNTHETIC ***MID PURCHASE");
  assert.equal(result.transactions[1].maskedReferenceToken, null);
  assert.equal(result.transactions[2].sourceDescription, "SEND E-TFR ***REF-A");
  assert.equal(result.transactions[2].normalizedDescription, "SEND E-TFR");
  assert.equal(result.transactions[2].maskedReferenceToken, "***REF-A");
  assert.equal(result.transactions[0].maskedReferenceToken, null);
  assert.equal(result.transactions[2].runningBalanceCents, null);
  assert.equal(result.reconciliation.status, "passed");
  assert.equal(result.reconciliation.runningBalancesChecked, 3);
  assert.equal(JSON.stringify(result).includes("UNRELATED_LEGAL_MARKER"), false);
});

test("uses corroborating PDF creation metadata when the extracted period omits a year", async () => {
  const result = await parseSynthetic({
    period: "Jun 30 - Jul 31",
    creationDate: "D:20990801000000Z",
  });
  assert.deepEqual(result.statementPeriod, {
    startDate: "2099-06-30",
    endDate: "2099-07-31",
  });
});

test("resolves transaction dates across a December-to-January statement period", async () => {
  const result = await parseSynthetic({
    period: "Dec 15 - Jan 14, 2100",
    openingBalance: "1,000.00",
    closingBalance: "1,050.00",
    totalWithdrawals: "50.00",
    totalDeposits: "100.00",
    rows: [
      { descriptionBlocks: ["SYNTHETIC DEPOSIT"], deposit: "100.00", date: "DEC20", balance: "1,100.00" },
      { descriptionBlocks: ["SYNTHETIC PURCHASE"], withdrawal: "50.00", date: "JAN5", balance: "1,050.00" },
    ],
  });
  assert.equal(result.transactions[0].transactionDate, "2099-12-20");
  assert.equal(result.transactions[1].transactionDate, "2100-01-05");
});

test("fails closed for statement and parsed-row reconciliation errors", async () => {
  for (const options of [
    { closingBalance: "1,451.00" },
    { totalWithdrawals: "601.00" },
    { totalDeposits: "1,051.00" },
    {
      rows: [
        { descriptionBlocks: ["SYNTHETIC PAY"], deposit: "1,000.00", date: "JUL1", balance: "2,000.00" },
        { descriptionBlocks: ["SYNTHETIC PURCHASE"], withdrawal: "301.00", date: "JUL2", balance: "1,699.00" },
        { descriptionBlocks: ["SYNTHETIC TRANSFER"], withdrawal: "200.00", date: "JUL2" },
        { descriptionBlocks: ["SYNTHETIC TRANSFER"], withdrawal: "100.00", date: "JUL2" },
        { descriptionBlocks: ["SYNTHETIC REBATE"], deposit: "50.00", date: "JUL3", balance: "1,449.00" },
      ],
    },
  ] satisfies SyntheticTdPdfOptions[]) {
    await expectSafeParserError(
      parseSynthetic(options),
      "TD_CHEQUING_RECONCILIATION_FAILED",
    );
  }
});

test("fails closed for malformed or ambiguous transaction rows", async () => {
  const invalidCases: SyntheticTdPdfOptions[] = [
    {
      rows: [{
        descriptionBlocks: ["SYNTHETIC BOTH"],
        withdrawal: "10.00",
        deposit: "10.00",
        date: "JUL1",
      }],
    },
    { rows: [{ descriptionBlocks: ["SYNTHETIC NEITHER"], date: "JUL1" }] },
    { rows: [{ descriptionBlocks: ["SYNTHETIC MALFORMED"], withdrawal: "10.0", date: "JUL1" }] },
    { rows: [{ descriptionBlocks: ["SYNTHETIC BAD DATE"], withdrawal: "10.00", date: "JLY1" }] },
    { rows: [{ descriptionBlocks: ["SYNTHETIC OUTSIDE"], withdrawal: "10.00", date: "AUG1" }] },
    { rows: [{ descriptionBlocks: ["SYNTHETIC AMBIGUOUS"], withdrawal: "10.00", date: "JUL1", amountX: 338 }] },
    { unexpectedLineBeforeClosing: true },
  ];
  for (const options of invalidCases) {
    await expectSafeParserError(parseSynthetic(options), "TD_CHEQUING_ROW_INVALID");
  }
});

test("enforces the totals boundary and rejects misleading or duplicated structure", async () => {
  const safe = await parseSynthetic({ lowerContent: true });
  assert.equal(safe.transactions.length, 5);
  assert.equal(safe.transactions.some((row) => row.sourceDescription.includes("LOWER")), false);

  for (const options of [
    { misleadingLineAfterClosing: true },
    { duplicateHeader: true },
    { missingTotals: true },
  ]) {
    await expectSafeParserError(
      parseSynthetic(options),
      "TD_CHEQUING_STRUCTURE_NOT_RECOGNIZED",
    );
  }
});

test("rejects invalid period evidence and running-balance contradictions", async () => {
  await expectSafeParserError(
    parseSynthetic({ period: "Jun 30 - Jul 31", creationDate: "D:20990915000000Z" }),
    "TD_CHEQUING_STATEMENT_PERIOD_INVALID",
  );
  await expectSafeParserError(
    parseSynthetic({ period: "Feb 30 - Mar 31, 2099" }),
    "TD_CHEQUING_STATEMENT_PERIOD_INVALID",
  );
  await expectSafeParserError(
    parseSynthetic({
      rows: [
        { descriptionBlocks: ["SYNTHETIC PAY"], deposit: "1,000.00", date: "JUL1", balance: "2,001.00" },
        { descriptionBlocks: ["SYNTHETIC PURCHASE"], withdrawal: "600.00", date: "JUL2" },
        { descriptionBlocks: ["SYNTHETIC REBATE"], deposit: "50.00", date: "JUL3", balance: "1,450.00" },
      ],
    }),
    "TD_CHEQUING_RECONCILIATION_FAILED",
  );
});

test("accepts a statement with a non-financial trailing page and rejects unsafe documents", async () => {
  await expectSafeParserError(
    parseSynthetic({}, "../unsafe-import-context"),
    "TD_CHEQUING_IMPORT_CONTEXT_INVALID",
  );
  assert.equal((await parseSynthetic({ pageCount: 2 })).transactions.length, 5);
  await expectSafeParserError(
    parseSynthetic({ includeTdMarker: false }),
    "TD_CHEQUING_STRUCTURE_NOT_RECOGNIZED",
  );

  const fixtureRoot = path.resolve("tests/fixtures");
  const imageOnly = await validateLocalPdf({
    sourcePath: path.join(fixtureRoot, "synthetic-image-only.pdf"),
    allowedRoot: fixtureRoot,
  });
  try {
    await expectSafeParserError(
      parseTdChequingPdf({
        source: imageOnly,
        importContext: { importId: "synthetic-image-only" },
      }),
      "IMAGE_ONLY_PDF",
    );
  } finally {
    if (imageOnly.bytes.byteLength) imageOnly.bytes.fill(0);
  }
});

test("returns only approved provenance and transaction-section content", async () => {
  const captured: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...values: unknown[]) => captured.push(values.map(String).join(" "));
  console.error = (...values: unknown[]) => captured.push(values.map(String).join(" "));
  let result: TdChequingParsedStatement;
  try {
    result = await parseSynthetic({ lowerContent: true });
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
  const serialized = JSON.stringify(result!);
  for (const forbidden of [
    "SYNTHETIC_PERSON_NAME",
    "123 SYNTHETIC STREET",
    "SYNTHETIC_ACCOUNT_12345",
    "UNRELATED_LEGAL_MARKER",
    scratchRoot,
    ".pdf",
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
  assert.deepEqual(captured, []);
});
