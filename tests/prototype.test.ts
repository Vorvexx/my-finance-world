import test from "node:test";
import assert from "node:assert/strict";
import { parseTdCsv } from "../lib/prototype/td-csv.ts";
import { ingestTransactions } from "../lib/transactions/ingestion.ts";
import { buildPrototypeView } from "../lib/prototype/intelligence.ts";
import { answerFinancialQuestion } from "../lib/prototype/assistant.ts";
import type { PrototypeState } from "../types/prototype.ts";

const observedAt = "2026-08-24T12:00:00.000Z";
const csv = `Date,Description,Withdrawals,Deposits,Account Number
08/01/2026,PAYROLL,,3000.00,1234
08/02/2026,GROCERY MARKET,120.50,,1234
08/03/2026,VISA PAYMENT,500.00,,1234`;

test("TD chequing CSV adapts into provider-independent raw transactions", () => {
  const parsed = parseTdCsv(csv, "td-chequing.csv", observedAt);
  assert.equal(parsed.accountType, "chequing");
  assert.equal(parsed.rows.length, 3);
  assert.equal(parsed.rows[0].direction, "inflow");
  assert.equal(parsed.rows[1].amount, 120.5);
  assert.equal(parsed.startDate, "2026-08-01");
});

test("stable fingerprints deduplicate overlapping statement rows", () => {
  const first = parseTdCsv(csv, "td-chequing-july.csv", observedAt);
  const second = parseTdCsv(csv, "td-chequing-august.csv", "2026-08-25T12:00:00.000Z");
  const ledger = ingestTransactions([...first.rows, ...second.rows]);
  assert.equal(ledger.transactions.length, 3);
  assert.equal(ledger.duplicateCount, 3);
});

test("payments are excluded from spending and partial coverage remains explicit", () => {
  const parsed = parseTdCsv(csv, "td-chequing.csv", observedAt);
  const ledger = ingestTransactions(parsed.rows);
  const state: PrototypeState = { version: 3, person: { id: "primary-person", name: null }, accounts: [], transactions: [...ledger.transactions], corrections: [], statements: [{ id: "statement", filename: "td-chequing.csv", provider: "td", accountId: parsed.accountId, accountType: "chequing", importedAt: observedAt, startDate: parsed.startDate, endDate: parsed.endDate, transactionCount: 3, duplicateCount: 0 }], updatedAt: observedAt };
  const view = buildPrototypeView(state, "month", "2026-08-31");
  assert.equal(view.totals.inflow, 3000);
  assert.equal(view.totals.spending, 120.5);
  assert.equal(view.totals.payments, 500);
  assert.equal(view.coverage.status, "partial");
  assert.match(answerFinancialQuestion("How much did I spend?", view).answer, /\$120\.50/);
});

test("unsupported statement shapes fail closed", () => {
  assert.throws(() => parseTdCsv("Thing,Value\nA,1", "unknown.csv", observedAt), /Unsupported TD CSV columns/);
});

test("credit-card inflows are payments, never income", () => {
  const parsed = parseTdCsv("Date,Description,Amount,Card Number\n08/04/2026,PAYMENT THANK YOU,-850.00,5678", "td-credit-card.csv", observedAt);
  const transaction = ingestTransactions(parsed.rows).transactions[0];
  assert.equal(transaction.financialRole, "credit-card-payment");
});
