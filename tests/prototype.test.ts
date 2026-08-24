import test from "node:test";
import assert from "node:assert/strict";
import { parseTdCsv } from "../lib/prototype/td-csv.ts";
import { ingestTransactions } from "../lib/transactions/ingestion.ts";
import { buildPrototypeView } from "../lib/prototype/intelligence.ts";
import { answerFinancialQuestion } from "../lib/prototype/assistant.ts";
import { createBackup, readBackup } from "../lib/prototype/backup.ts";
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
  const state: PrototypeState = { version: 4, person: { id: "primary-person", name: null }, accounts: [], transactions: [...ledger.transactions], corrections: [], statements: [{ id: "statement", filename: "td-chequing.csv", provider: "td", accountId: parsed.accountId, accountType: "chequing", importedAt: observedAt, startDate: parsed.startDate, endDate: parsed.endDate, transactionCount: 3, duplicateCount: 0, balanceCaptured: false }], facts: [], updatedAt: observedAt };
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

test("captures an explicitly supplied TD balance without inventing one", () => {
  const withBalance = parseTdCsv("Transaction Date,Transaction Description,Debit Amount,Credit Amount,Running Balance,Account Type\n08/04/2026,COFFEE,5.00,,995.00,Chequing", "td-export.csv", observedAt);
  assert.equal(withBalance.closingBalance, 995);
  assert.equal(parseTdCsv(csv, "td-chequing.csv", observedAt).closingBalance, null);
});

test("encrypted backup round-trips and rejects the wrong passphrase", () => {
  const parsed = parseTdCsv(csv, "td-chequing.csv", observedAt); const ledger = ingestTransactions(parsed.rows);
  const state: PrototypeState = { version: 4, person: { id: "primary-person", name: null }, accounts: [], transactions: [...ledger.transactions], corrections: [], statements: [], facts: [{ id: "fact", kind: "investment", name: "Retirement", value: 1000, effectiveDate: "2026-08-24", updatedAt: observedAt, provenance: "founder" }], updatedAt: observedAt };
  const backup = createBackup(state, "a-secure-test-passphrase");
  assert.equal(readBackup(backup, "a-secure-test-passphrase").facts[0].value, 1000);
  assert.throws(() => readBackup(backup, "wrong-passphrase"));
});

test("Founder facts create a known position while unsupported values stay unknown", () => {
  const state: PrototypeState = { version: 4, person: { id: "primary-person", name: null }, accounts: [], transactions: [], corrections: [], statements: [], facts: [{ id: "home", kind: "home", name: "Home", value: 600000, effectiveDate: "2026-08-24", updatedAt: observedAt, provenance: "founder" }, { id: "mortgage", kind: "mortgage", name: "Mortgage", value: 500000, effectiveDate: "2026-08-24", updatedAt: observedAt, provenance: "founder" }], updatedAt: observedAt };
  const view = buildPrototypeView(state);
  assert.equal(view.position.netWorth, 100000);
  assert.equal(view.worlds.vehicle.value, null);
  assert.match(answerFinancialQuestion("What is my net worth?", view).answer, /\$100,000/);
});
