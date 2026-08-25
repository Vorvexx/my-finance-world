import test from "node:test";
import assert from "node:assert/strict";
import { ingestTransactions } from "../lib/transactions/ingestion.ts";
import { normalizeCounterparty } from "../lib/transactions/normalization.ts";
import { applyDeterministicAttribution } from "../lib/transactions/attribution.ts";
import {
  pendingTransactions,
  recentTransactions,
  transactionTotalsForPeriod,
  transactionsByAccount,
  transactionsByWorld,
} from "../lib/transactions/queries.ts";
import { validateRawTransaction } from "../lib/transactions/validation.ts";
import type { FinancialMeaning, RawTransaction } from "../types/transactions.ts";

const raw = (overrides: Partial<RawTransaction> = {}): RawTransaction => ({
  accountId: "account-1",
  importId: "import-1",
  transactionDate: "2026-08-01",
  postedDate: null,
  amount: 100,
  direction: "outflow",
  currency: "CAD",
  description: "POS PURCHASE CITY HYDRO #1234",
  financialMeaning: "expense",
  status: "posted",
  sourceRecordId: "source-record-1",
  fingerprint: { version: "test-v1", value: "fingerprint-1" },
  source: "test-provider",
  sourceKind: "local-synthetic",
  observedAt: "2026-08-02T12:00:00.000Z",
  ...overrides,
});

test("validates the canonical ingestion contract and nullable provider fields", () => {
  const validated = validateRawTransaction(raw({ sourceRecordId: null, postedDate: null }));
  assert.equal(validated.accountId, "account-1");
  assert.equal(validated.sourceRecordId, null);
  assert.equal(validated.postedDate, null);

  assert.throws(() => validateRawTransaction(raw({ transactionDate: undefined })), /Transaction date/);
  assert.throws(() => validateRawTransaction(raw({ transactionDate: "08\/01\/2026" })), /YYYY-MM-DD/);
  assert.throws(() => validateRawTransaction(raw({ postedDate: "08\/02\/2026" })), /Posted date/);
  assert.throws(() => validateRawTransaction(raw({ currency: undefined })), /currency/);
  assert.throws(() => validateRawTransaction(raw({ currency: "cad" })), /currency/);
  assert.throws(() => validateRawTransaction(raw({ importId: undefined })), /Import ID/);
  assert.throws(() => validateRawTransaction(raw({ sourceRecordId: "" })), /Source record ID/);
  assert.throws(() => validateRawTransaction(raw({ financialMeaning: "purchase" })), /Financial meaning/);
});

test("fails closed for malformed amounts, directions, fingerprints, and source data", () => {
  assert.throws(() => validateRawTransaction(raw({ amount: -1 })), /positive finite/);
  assert.throws(() => validateRawTransaction(raw({ direction: "sideways" })), /direction/);
  assert.throws(() => validateRawTransaction(raw({ fingerprint: null })), /fingerprint/);
  assert.throws(() => validateRawTransaction(raw({ description: "" })), /description/);
  assert.throws(() => validateRawTransaction(raw({ status: "settled" })), /status/);
});

test("normalizes provider noise without changing the raw description", () => {
  const ledger = ingestTransactions([raw()]);
  assert.equal(normalizeCounterparty("POS PURCHASE ACME MARKET #1234"), "ACME MARKET");
  assert.equal(ledger.transactions[0].rawDescription, "POS PURCHASE CITY HYDRO #1234");
  assert.equal(ledger.transactions[0].normalizedCounterparty, "CITY HYDRO");
});

test("keeps Vorvex identity independent of optional provider identity", () => {
  const withProviderId = ingestTransactions([raw()]).transactions[0];
  const withoutProviderId = ingestTransactions([raw({ sourceRecordId: null })]).transactions[0];

  assert.equal(withProviderId.id, withoutProviderId.id);
  assert.notEqual(withProviderId.id, withProviderId.provenance.sourceRecordId);
  assert.match(withProviderId.id, /^vorvex-transaction:/);
});

test("deduplicates by scoped provider identity and prefers posted updates", () => {
  const ledger = ingestTransactions([
    raw({ status: "pending", observedAt: "2026-08-01T10:00:00.000Z" }),
    raw({ status: "posted", observedAt: "2026-08-02T10:00:00.000Z" }),
  ]);

  assert.equal(ledger.transactions.length, 1);
  assert.equal(ledger.duplicateCount, 1);
  assert.equal(ledger.transactions[0].status, "posted");
});

test("uses the versioned fingerprint when provider identity is absent", () => {
  const ledger = ingestTransactions([
    raw({ sourceRecordId: null, observedAt: "2026-08-01T10:00:00.000Z" }),
    raw({ sourceRecordId: null, observedAt: "2026-08-02T10:00:00.000Z" }),
  ]);

  assert.equal(ledger.transactions.length, 1);
  assert.equal(ledger.duplicateCount, 1);
  assert.match(ledger.transactions[0].provenance.deduplicationKey, /fingerprint:test-v1:fingerprint-1$/);
});

test("attributes Worlds deterministically and lets user corrections win", () => {
  const mortgage = ingestTransactions([raw({ description: "MORTGAGE PAYMENT" })]);
  assert.equal(mortgage.transactions[0].attribution.world, "home");
  assert.equal(mortgage.transactions[0].attribution.method, "deterministic-rule");

  const corrected = ingestTransactions([raw({ description: "MORTGAGE PAYMENT" })], {
    corrections: [{
      transactionId: mortgage.transactions[0].id,
      world: "future",
      category: "Corrected category",
      correctedAt: "2026-08-03T12:00:00.000Z",
    }],
  });
  assert.equal(corrected.transactions[0].attribution.world, "future");
  assert.equal(corrected.transactions[0].attribution.method, "user-correction");
  assert.equal(corrected.transactions[0].attribution.category, "Corrected category");
});

test("applies narrow deterministic categories to historical unclassified records without overriding Founder authority", () => {
  const grocery = ingestTransactions([raw({ description: "NEIGHBOURHOOD GROCERY" })]).transactions[0];
  const historical = { ...grocery, attribution: { ...grocery.attribution, world: null, category: null, method: "unclassified" as const, ruleId: null, confidence: null } };
  const corrected = { ...historical, attribution: { ...historical.attribution, world: "future" as const, category: "Founder category", method: "user-correction" as const, correctedAt: "2026-08-03T12:00:00.000Z" } };
  const [classified, preserved] = applyDeterministicAttribution([historical, corrected]);

  assert.equal(classified.attribution.category, "Groceries");
  assert.equal(classified.attribution.method, "deterministic-rule");
  assert.equal(preserved.attribution.category, "Founder category");
  assert.equal(preserved.attribution.method, "user-correction");
});

test("accepts the approved financial meanings without forcing categories", () => {
  const cases: ReadonlyArray<{
    meaning: FinancialMeaning;
    direction: "inflow" | "outflow";
    expectedCategory: string | null;
  }> = [
    { meaning: "expense", direction: "outflow", expectedCategory: "Utilities" },
    { meaning: "income", direction: "inflow", expectedCategory: null },
    { meaning: "refund", direction: "inflow", expectedCategory: null },
    { meaning: "credit-card-purchase", direction: "outflow", expectedCategory: null },
    { meaning: "credit-card-payment", direction: "outflow", expectedCategory: null },
    { meaning: "transfer", direction: "outflow", expectedCategory: null },
    { meaning: "cash-withdrawal", direction: "outflow", expectedCategory: null },
    { meaning: "unknown", direction: "outflow", expectedCategory: null },
  ];

  for (const [index, item] of cases.entries()) {
    const description = item.meaning === "expense" ? "CITY HYDRO" : `SYNTHETIC ${item.meaning}`;
    const transaction = ingestTransactions([raw({
      direction: item.direction,
      description,
      financialMeaning: item.meaning,
      sourceRecordId: `meaning-${index}`,
      fingerprint: { version: "test-v1", value: `meaning-${index}` },
    })]).transactions[0];

    assert.equal(transaction.financialMeaning, item.meaning);
    assert.equal(transaction.attribution.category, item.expectedCategory);
  }
});

test("queries recent, pending, account, World, and period totals", () => {
  const ledger = ingestTransactions([
    raw({ sourceRecordId: "salary", fingerprint: { version: "test-v1", value: "salary" }, transactionDate: "2026-08-05", amount: 3200, direction: "inflow", description: "SALARY DEPOSIT", financialMeaning: "income", status: "pending" }),
    raw({ sourceRecordId: "fuel", fingerprint: { version: "test-v1", value: "fuel" }, transactionDate: "2026-08-04", amount: 80.25, description: "SHELL GAS STATION" }),
    raw({ sourceRecordId: "mortgage", fingerprint: { version: "test-v1", value: "mortgage" }, transactionDate: "2026-07-31", amount: 2100, description: "MORTGAGE PAYMENT", accountId: "account-2" }),
  ]);
  const transactions = ledger.transactions;

  assert.equal(recentTransactions(transactions, 2).length, 2);
  assert.equal(recentTransactions(transactions, 1)[0].provenance.sourceRecordId, "salary");
  assert.equal(pendingTransactions(transactions).length, 1);
  assert.equal(transactionsByAccount(transactions, "account-2").length, 1);
  assert.equal(transactionsByWorld(transactions, "vehicle").length, 1);
  assert.deepEqual(transactionTotalsForPeriod(transactions, "2026-08-01", "2026-08-31"), {
    inflow: 3200,
    outflow: 80.25,
    net: 3119.75,
  });
});

test("merchant intelligence classifies narrow identities but leaves ambiguous retailers Unknown", () => {
  const make = (description: string, index: number) => ingestTransactions([raw({
    description, financialMeaning: "unknown", sourceRecordId: `merchant-${index}`,
    fingerprint: { version: "test-v1", value: `merchant-${index}` },
  })]).transactions[0];
  const [coffee, telecom, subscription, ambiguous] = applyDeterministicAttribution([
    make("STARBUCKS 1234", 1), make("ROGERS WIRELESS", 2), make("NETFLIX.COM", 3), make("WALMART SUPERCENTRE", 4),
  ]);
  assert.equal(coffee.attribution.category, "Dining");
  assert.equal(telecom.attribution.category, "Telecom");
  assert.equal(subscription.attribution.category, "Subscriptions");
  assert.equal(ambiguous.attribution.category, null);
});
