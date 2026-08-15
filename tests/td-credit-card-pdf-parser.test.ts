import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateLocalPdf } from "../lib/financial-files/pdf-intake.ts";
import {
  parseTdCreditCardPdf,
  TdCreditCardParserError,
} from "../lib/financial-files/td-credit-card-pdf-parser.ts";
import type { TdCreditCardParsedStatement } from "../types/financial-files.ts";
import {
  buildSyntheticTdCreditCardPdf,
  type SyntheticTdCreditCardPdfOptions,
} from "./helpers/synthetic-td-credit-card-pdf.ts";

let sequence = 0;
const parseSynthetic = async (
  options: SyntheticTdCreditCardPdfOptions = {},
): Promise<TdCreditCardParsedStatement> => {
  sequence += 1;
  const root = await mkdtemp(path.join(os.tmpdir(), "vorvex-card-parser-"));
  const sourcePath = path.join(root, `statement-${sequence}.pdf`);
  await writeFile(sourcePath, buildSyntheticTdCreditCardPdf(options));
  const source = await validateLocalPdf({ sourcePath, allowedRoot: root, intakeTimestamp: "2099-08-05T00:00:00.000Z" });
  try {
    return await parseTdCreditCardPdf({ source, importContext: { importId: `card-import-${sequence}` } });
  } finally {
    source.bytes.fill(0);
    await rm(root, { recursive: true, force: true });
  }
};

const rejectsSafely = async (
  operation: Promise<unknown>,
  code: TdCreditCardParserError["code"],
) => assert.rejects(operation, (error: unknown) => {
  assert.ok(error instanceof TdCreditCardParserError);
  assert.equal(error.code, code);
  assert.equal(error.message, code);
  return true;
});

test("parses exact statement facts, dated rows, semantics, and liability reconciliation", async () => {
  const parsed = await parseSynthetic();
  assert.equal(parsed.parser.version, "td-credit-card-pdf-v2");
  assert.equal(parsed.parser.accountType, "credit-card");
  assert.equal(parsed.currency, "CAD");
  assert.deepEqual(parsed.statementPeriod, { startDate: "2099-07-07", endDate: "2099-08-04" });
  assert.equal(parsed.statementDate, "2099-08-04");
  assert.equal(parsed.paymentDueDate, "2099-08-25");
  assert.equal(parsed.minimumPaymentCents, 1_000);
  assert.equal(parsed.previousBalanceCents, 100_000);
  assert.equal(parsed.newBalanceCents, 95_000);
  assert.equal(parsed.transactions.length, 6);
  assert.equal(parsed.transactions[0].transactionDate, "2099-07-08");
  assert.equal(parsed.transactions[0].postedDate, "2099-07-09");
  assert.deepEqual(
    parsed.transactions.map((row) => row.sourceTransactionTypeEvidence),
    ["purchase", "purchase", "payment", "refund", "interest", "fee"],
  );
  assert.ok(parsed.transactions.filter((row) => row.chargeCents !== null).every((row) => row.creditCents === null));
  assert.ok(parsed.transactions.filter((row) => row.creditCents !== null).every((row) => row.chargeCents === null));
  assert.equal(parsed.reconciliation.status, "passed");
  assert.equal(parsed.reconciliation.calculatedNewBalanceCents, parsed.newBalanceCents);
  const serialized = JSON.stringify(parsed);
  for (const forbidden of [
    "SYNTHETIC_PERSON_NAME",
    "99,999.00",
    "88,888.00",
    "77,777.00",
    "66,666.00",
    "55,555.00",
  ]) assert.equal(serialized.includes(forbidden), false);
});

test("preserves legitimate duplicate-looking purchases", async () => {
  const duplicate = { transactionDate: "JUL 8", postingDate: "JUL 9", description: "SYNTHETIC PURCHASE ALPHA", amount: "$100.00" };
  const parsed = await parseSynthetic({
    rowsByStatementPage: {
      1: [duplicate, duplicate, { transactionDate: "JUL 8", postingDate: "JUL 9", description: "SYNTHETIC PURCHASE BETA", amount: "$50.00" }],
      3: [
        { transactionDate: "JUL 10", postingDate: "JUL 11", description: "PREAUTHORIZED PAYMENT", amount: "-$200.00" },
        { transactionDate: "JUL 12", postingDate: "JUL 13", description: "SYNTHETIC MERCHANT REFUND", amount: "-$30.00" },
        { transactionDate: "JUL 14", postingDate: "JUL 15", description: "INTEREST CHARGE", amount: "$10.00" },
      ],
      4: [{ transactionDate: "AUG 4", postingDate: "AUG 4", description: "ANNUAL FEE", amount: "$20.00" }],
    },
    purchasesAndCharges: "250.00",
    subtotal: "280.00",
    newBalance: "1,050.00",
  });
  assert.equal(parsed.transactions.length, 7);
  assert.equal(parsed.transactions.filter((row) => row.sourceDescription === duplicate.description).length, 2);
});

test("accepts a transaction made shortly before the period when its posting date is inside the period", async () => {
  const parsed = await parseSynthetic({ rowsByStatementPage: {
    1: [
      { transactionDate: "JUL 4", postingDate: "JUL 7", description: "SYNTHETIC PURCHASE ALPHA", amount: "$100.00" },
      { transactionDate: "JUL 8", postingDate: "JUL 9", description: "SYNTHETIC PURCHASE BETA", amount: "$50.00" },
    ],
    3: [
      { transactionDate: "JUL 10", postingDate: "JUL 11", description: "PREAUTHORIZED PAYMENT", amount: "-$200.00" },
      { transactionDate: "JUL 12", postingDate: "JUL 13", description: "SYNTHETIC MERCHANT REFUND", amount: "-$30.00" },
      { transactionDate: "JUL 14", postingDate: "JUL 15", description: "INTEREST CHARGE", amount: "$10.00" },
    ],
    4: [{ transactionDate: "AUG 4", postingDate: "AUG 4", description: "ANNUAL FEE", amount: "$20.00" }],
  } });
  assert.equal(parsed.transactions[0].transactionDate, "2099-07-04");
  assert.equal(parsed.transactions[0].postedDate, "2099-07-07");
});

test("fails closed for incorrect totals, balance, missing rows, and malformed amounts", async () => {
  await rejectsSafely(
    parseSynthetic({ purchasesAndCharges: "151.00" }),
    "TD_CREDIT_CARD_RECONCILIATION_FAILED",
  );
  await rejectsSafely(
    parseSynthetic({ newBalance: "951.00" }),
    "TD_CREDIT_CARD_RECONCILIATION_FAILED",
  );
  await rejectsSafely(
    parseSynthetic({ rowsByStatementPage: { 1: [], 3: [], 4: [] } }),
    "TD_CREDIT_CARD_RECONCILIATION_FAILED",
  );
  await rejectsSafely(
    parseSynthetic({
      rowsByStatementPage: {
        1: [{ transactionDate: "JUL 8", postingDate: "JUL 9", description: "SYNTHETIC PURCHASE", amount: "$1.2" }],
        3: [],
        4: [],
      },
    }),
    "TD_CREDIT_CARD_ROW_INVALID",
  );
});

test("fails closed for ambiguous boundaries, dates, and import context", async () => {
  await rejectsSafely(
    parseSynthetic({ missingTerminal: true }),
    "TD_CREDIT_CARD_STRUCTURE_NOT_RECOGNIZED",
  );
  await rejectsSafely(
    parseSynthetic({ duplicateTerminal: true }),
    "TD_CREDIT_CARD_STRUCTURE_NOT_RECOGNIZED",
  );
  await rejectsSafely(
    parseSynthetic({ statementPeriod: "July 07, 2099 to August 03, 2099" }),
    "TD_CREDIT_CARD_STATEMENT_PERIOD_INVALID",
  );
});
