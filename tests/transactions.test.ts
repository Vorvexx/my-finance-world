import test from "node:test";
import assert from "node:assert/strict";
import { ingestTransactions } from "../lib/transactions/ingestion.ts";
import { normalizeCounterparty } from "../lib/transactions/normalization.ts";
import {
  pendingTransactions,
  recentTransactions,
  transactionTotalsForPeriod,
  transactionsByAccount,
  transactionsByWorld,
} from "../lib/transactions/queries.ts";
import { validateRawTransaction } from "../lib/transactions/validation.ts";
import type { RawTransaction } from "../types/transactions.ts";

const raw = (overrides: Partial<RawTransaction> = {}): RawTransaction => ({
  id: "transaction-1",
  accountId: "account-1",
  date: "2026-08-01",
  amount: 100,
  direction: "outflow",
  description: "POS PURCHASE CITY HYDRO #1234",
  status: "posted",
  sourceRecordId: "source-record-1",
  source: "test-provider",
  sourceKind: "local-synthetic",
  observedAt: "2026-08-02T12:00:00.000Z",
  ...overrides,
});

test("validates required transaction fields and rejects invalid amounts", () => {
  assert.equal(validateRawTransaction(raw()).accountId, "account-1");
  assert.throws(() => validateRawTransaction(raw({ amount: -1 })), /positive finite/);
  assert.throws(() => validateRawTransaction(raw({ direction: "sideways" })), /direction/);
  assert.throws(() => validateRawTransaction(raw({ date: "08/01/2026" })), /YYYY-MM-DD/);
});

test("normalizes provider noise without changing the raw description", () => {
  const ledger = ingestTransactions([raw()]);
  assert.equal(normalizeCounterparty("POS PURCHASE ACME MARKET #1234"), "ACME MARKET");
  assert.equal(ledger.transactions[0].rawDescription, "POS PURCHASE CITY HYDRO #1234");
  assert.equal(ledger.transactions[0].normalizedCounterparty, "CITY HYDRO");
});

test("deduplicates by provider and source record, preferring posted updates", () => {
  const ledger = ingestTransactions([
    raw({ id: "pending-version", status: "pending", observedAt: "2026-08-01T10:00:00.000Z" }),
    raw({ id: "posted-version", status: "posted", observedAt: "2026-08-02T10:00:00.000Z" }),
  ]);

  assert.equal(ledger.transactions.length, 1);
  assert.equal(ledger.duplicateCount, 1);
  assert.equal(ledger.transactions[0].id, "posted-version");
  assert.equal(ledger.transactions[0].status, "posted");
});

test("attributes Worlds deterministically and lets user corrections win", () => {
  const mortgage = ingestTransactions([raw({ description: "MORTGAGE PAYMENT" })]);
  assert.equal(mortgage.transactions[0].attribution.world, "home");
  assert.equal(mortgage.transactions[0].attribution.method, "deterministic-rule");

  const corrected = ingestTransactions([raw({ description: "MORTGAGE PAYMENT" })], {
    corrections: [{
      transactionId: "transaction-1",
      world: "future",
      category: "Corrected category",
      correctedAt: "2026-08-03T12:00:00.000Z",
    }],
  });
  assert.equal(corrected.transactions[0].attribution.world, "future");
  assert.equal(corrected.transactions[0].attribution.method, "user-correction");
});

test("queries recent, pending, account, World, and period totals", () => {
  const ledger = ingestTransactions([
    raw({ id: "salary", sourceRecordId: "salary", date: "2026-08-05", amount: 3200, direction: "inflow", description: "SALARY DEPOSIT", status: "pending" }),
    raw({ id: "fuel", sourceRecordId: "fuel", date: "2026-08-04", amount: 80.25, description: "SHELL GAS STATION" }),
    raw({ id: "mortgage", sourceRecordId: "mortgage", date: "2026-07-31", amount: 2100, description: "MORTGAGE PAYMENT", accountId: "account-2" }),
  ]);
  const transactions = ledger.transactions;

  assert.equal(recentTransactions(transactions, 2).length, 2);
  assert.equal(recentTransactions(transactions, 1)[0].id, "salary");
  assert.equal(pendingTransactions(transactions).length, 1);
  assert.equal(transactionsByAccount(transactions, "account-2").length, 1);
  assert.equal(transactionsByWorld(transactions, "vehicle").length, 1);
  assert.deepEqual(transactionTotalsForPeriod(transactions, "2026-08-01", "2026-08-31"), {
    inflow: 3200,
    outflow: 80.25,
    net: 3119.75,
  });
});
