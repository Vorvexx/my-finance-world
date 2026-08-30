import test from "node:test";
import assert from "node:assert/strict";
import {
  comparePeriods,
  dataQuality,
  investmentContributionEvidence,
  liabilityActivity,
  largestMovements,
  statementCoverage,
  summarizeCashFlow,
  summarizeSpending,
} from "../lib/analytics/financial-analytics.ts";
import type { ImportJournalRecord } from "../types/imports.ts";
import type { CanonicalInvestmentSnapshot } from "../types/investments.ts";
import type { CanonicalTransaction, FinancialMeaning } from "../types/transactions.ts";
import { buildHistoricalFinancialFlow, emergencyFundTarget, validateGoalIntentions } from "../lib/analytics/monthly-financial-flow.ts";

const transaction = ({ id, date, amount, direction = "outflow", meaning, category = null, world = null, accountId = "cash", counterparty = id }: {
  id: string; date: string; amount: number; direction?: "inflow" | "outflow"; meaning: FinancialMeaning;
  category?: string | null; world?: CanonicalTransaction["attribution"]["world"]; accountId?: string; counterparty?: string;
}): CanonicalTransaction => ({
  id, accountId, transactionDate: date, postedDate: null, amount, direction, currency: "CAD", rawDescription: id,
  normalizedCounterparty: counterparty.toUpperCase(), financialMeaning: meaning, status: "posted", relatedTransactionId: null,
  attribution: { world, category, method: category ? "user-correction" : "unclassified", ruleId: null, confidence: category ? 1 : null, correctedAt: null },
  provenance: { importId: `import-${id}`, providerId: "td", sourceRecordId: null, sourceKind: "import", observedAt: "2026-08-01T00:00:00Z", sourceUpdatedAt: null, fingerprint: { version: "v1", value: id }, deduplicationKey: id },
  createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z",
});

const range = { startDate: "2026-08-01", endDate: "2026-08-31" };

test("canonical cash-flow analytics separate economic activity from circulation", () => {
  const transactions = [
    transaction({ id: "salary", date: "2026-08-01", amount: 3000, direction: "inflow", meaning: "income", category: "Salary", world: "income" }),
    transaction({ id: "refund", date: "2026-08-02", amount: 50, direction: "inflow", meaning: "refund", category: "Shopping", world: "cash" }),
    transaction({ id: "groceries", date: "2026-08-03", amount: 200, meaning: "expense", category: "Groceries", world: "cash" }),
    transaction({ id: "payment", date: "2026-08-04", amount: 1000, meaning: "credit-card-payment", world: "creditDebt" }),
    transaction({ id: "transfer", date: "2026-08-05", amount: 500, meaning: "transfer", world: "investments" }),
  ];
  assert.deepEqual(summarizeCashFlow(transactions, range), {
    transactionCount: 5, moneyIn: 3050, moneyOut: 200, net: 2850,
    circulationIn: 3050, circulationOut: 1700, transfers: 500, creditCardPayments: 1000, cashMovements: 0,
  });
  assert.deepEqual(summarizeSpending(transactions, range), {
    grossSpending: 200, refunds: 50, netSpending: 150, understoodAmount: 200, understoodPercentage: 100,
    byCategory: [{ key: "Groceries", amount: 200, transactionCount: 1 }, { key: "Shopping", amount: -50, transactionCount: 1 }],
    byWorld: [{ key: "cash", amount: 150, transactionCount: 2 }],
  });
});

test("period comparison and largest movements remain deterministic", () => {
  const transactions = [
    transaction({ id: "july", date: "2026-07-10", amount: 100, meaning: "expense", category: "Dining", world: "cash" }),
    transaction({ id: "aug-small", date: "2026-08-10", amount: 150, meaning: "expense", category: "Dining", world: "cash" }),
    transaction({ id: "aug-large", date: "2026-08-11", amount: 400, meaning: "expense", category: "Travel", world: "cash" }),
  ];
  const comparison = comparePeriods(transactions, range, { startDate: "2026-07-01", endDate: "2026-07-31" });
  assert.equal(comparison.change.moneyOut, 450);
  assert.equal(comparison.change.netSpending, 450);
  assert.deepEqual(largestMovements(transactions, range, 1).outflows.map((item) => item.id), ["aug-large"]);
});

test("investment, liability and quality primitives disclose their evidence limits", () => {
  const contribution = transaction({ id: "tfsa", date: "2026-08-05", amount: 250, meaning: "transfer", category: "Contribution", world: "investments" });
  const cardPurchase = transaction({ id: "purchase", date: "2026-08-06", amount: 100, meaning: "credit-card-purchase", accountId: "card", category: "Dining", world: "cash" });
  const cardPayment = transaction({ id: "card-payment", date: "2026-08-07", amount: 70, direction: "inflow", meaning: "credit-card-payment", accountId: "card" });
  const unknown = transaction({ id: "unknown", date: "2026-08-08", amount: 20, meaning: "unknown" });
  const snapshot: CanonicalInvestmentSnapshot = { id: "snapshot", accountId: "tfsa-account", providerId: "td", accountType: "tfsa", parserVersion: "v1", statementPeriodStart: "2026-08-01", statementPeriodEnd: "2026-08-31", endingValueCents: 100000, bookCostCents: 90000, contributionsCents: null, withdrawalsCents: null, employeeContributionsCents: null, employerContributionsCents: null, sourceSha256: "hash", recordedAt: "2026-09-01T00:00:00Z" };
  assert.deepEqual(investmentContributionEvidence([contribution], [snapshot], range), {
    cashSideTransfers: 250,
    statementReported: [{ accountId: "tfsa-account", periodStart: "2026-08-01", periodEnd: "2026-08-31", contributions: null, employeeContributions: null, employerContributions: null, withdrawals: null }],
    linkedToSpecificInvestmentAccount: false,
  });
  assert.deepEqual(liabilityActivity([cardPurchase, cardPayment], new Set(["card"]), range), { increasedBy: 100, reducedBy: 70, netActivity: 30, transactionCount: 2, balanceChangeKnown: false });
  assert.equal(dataQuality([contribution, unknown], new Set([unknown.id])).genuinelyUnknownCount, 1);
});

test("statement coverage merges overlaps and exposes real gaps", () => {
  const imported = (id: string, start: string, end: string): ImportJournalRecord => ({
    importId: id, sourceSha256: id, providerId: "td", accountType: "chequing", accountId: "cash", parserVersion: "v1",
    statementPeriodStart: start, statementPeriodEnd: end, sourceFormat: "pdf", receivedAt: "2026-08-01T00:00:00Z",
    processingStartedAt: null, proposedAt: null, committedAt: "2026-08-01T00:00:00Z", status: "committed",
    parsedTransactionCount: 1, committedTransactionCount: 1, duplicateTransactionCount: 0, safeErrorCode: null, schemaVersion: 1,
  });
  const coverage = statementCoverage([
    imported("one", "2026-01-01", "2026-01-31"), imported("overlap", "2026-01-15", "2026-02-15"), imported("three", "2026-03-01", "2026-03-31"),
  ], new Map([["cash", "Cash"]]), { startDate: "2026-01-01", endDate: "2026-02-15" });
  assert.equal(coverage.committedImportCount, 3);
  assert.equal(coverage.gapCount, 1);
  assert.equal(coverage.selectedPeriodCovered, true);
  assert.deepEqual(coverage.accounts[0].gaps, [{ startDate: "2026-02-16", endDate: "2026-02-28" }]);
});

test("monthly financial flow is historical, coverage-aware, reconciled, and future-safe", () => {
  const imported = (id: string): ImportJournalRecord => ({
    importId: id, sourceSha256: id, providerId: "td", accountType: "chequing", accountId: "cash", parserVersion: "v1",
    statementPeriodStart: "2024-10-01", statementPeriodEnd: "2025-01-31", sourceFormat: "pdf", receivedAt: "2025-02-01T00:00:00Z",
    processingStartedAt: null, proposedAt: null, committedAt: "2025-02-01T00:00:00Z", status: "committed", parsedTransactionCount: 9,
    committedTransactionCount: 9, duplicateTransactionCount: 0, safeErrorCode: null, schemaVersion: 1,
  });
  const items = [
    transaction({ id: "oct-rent", date: "2024-10-01", amount: 1000, meaning: "expense", category: "Rent", world: "home", counterparty: "Landlord" }),
    transaction({ id: "nov-rent", date: "2024-11-01", amount: 1000, meaning: "expense", category: "Rent", world: "home", counterparty: "Landlord" }),
    transaction({ id: "dec-rent", date: "2024-12-01", amount: 1000, meaning: "expense", category: "Rent", world: "home", counterparty: "Landlord" }),
    transaction({ id: "dec-pay", date: "2024-12-05", amount: 5000, direction: "inflow", meaning: "income", category: "Salary", world: "income" }),
    transaction({ id: "dec-food", date: "2024-12-10", amount: 200, meaning: "expense", category: "Groceries", world: "cash" }),
    transaction({ id: "dec-card", date: "2024-12-15", amount: 800, meaning: "credit-card-payment", world: "creditDebt" }),
    transaction({ id: "jan-rent", date: "2025-01-01", amount: 1100, meaning: "expense", category: "Rent", world: "home", counterparty: "Landlord" }),
    transaction({ id: "jan-pay", date: "2025-01-05", amount: 5000, direction: "inflow", meaning: "income", category: "Salary", world: "income" }),
    transaction({ id: "jan-dining", date: "2025-01-10", amount: 300, meaning: "expense", category: "Dining", world: "cash" }),
    transaction({ id: "jan-tax", date: "2025-01-12", amount: 100, meaning: "fee", category: "Property Tax", world: "home" }),
    transaction({ id: "jan-refund", date: "2025-01-11", amount: 50, direction: "inflow", meaning: "refund", category: "Dining", world: "cash" }),
  ];
  const timeline = buildHistoricalFinancialFlow({ transactions: items, imports: [imported("coverage")], investmentSnapshots: [], accountNames: new Map([["cash", "Cash"]]), endDate: "2025-01-31" });
  assert.equal(timeline.months.length, 2);
  assert.deepEqual(timeline.months.map((month) => [month.month, month.status, month.moneyIn, month.moneyOut, month.requiredCosts, month.availableMoney]), [
    ["2024-12", "complete", 5000, 1200, 1000, 4000], ["2025-01", "complete", 5050, 1500, 1200, 3850],
  ]);
  assert.equal(timeline.months[1].availableMoneyPercentageChange, -3.75);
  assert.equal(timeline.months[0].creditCardSettlements, 800);
  assert.equal(timeline.months[0].requiredCostComponents[0].evidenceCount, 3);
  assert.equal(timeline.months[0].requiredCostComponents[0].supportingTransactions.some((item) => item.date > "2024-12-31"), false);
  assert.equal(timeline.months[1].byWorld.find((item) => item.key === "Home")?.amount, 1200);
  assert.equal(timeline.months[1].fees, 0);
  assert.equal(timeline.months[1].byWorld.reduce((sum, item) => sum + Math.round(item.amount * 100), 0), 145000);
  assert.equal(timeline.all.transactionCount, 9);
  assert.equal(timeline.all.creditCardSettlements, 800);
});

test("goal intentions remain metadata and require an explicit emergency-fund horizon", () => {
  assert.deepEqual(validateGoalIntentions([
    { id: "one", name: "Emergency Fund", kind: "emergency-fund", assetAccountId: "cash", assignedAmount: 3000 },
    { id: "two", name: "Vacation", kind: "vacation", assetAccountId: "cash", assignedAmount: 1000 },
  ], new Map([["cash", 5000]])).valid, true);
  assert.equal(emergencyFundTarget(6, 1250), 7500);
  assert.equal(emergencyFundTarget(0, 1250), null);
});
