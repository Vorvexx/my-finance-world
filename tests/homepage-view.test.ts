import test from "node:test";
import assert from "node:assert/strict";
import { ingestFinancialSnapshot, createEmptyFinancialModel } from "../lib/financial-model/canonical-financial-model.ts";
import { deriveHomepageView } from "../lib/homepage/derive-homepage-view.ts";
import type { CanonicalStatementFacts, ImportJournalRecord } from "../types/imports.ts";
import type { CanonicalTransaction, FinancialMeaning } from "../types/transactions.ts";
import { applyFounderWorldFacts } from "../lib/runtime/world-facts.ts";
import type { CanonicalInvestmentSnapshot } from "../types/investments.ts";

const model = ingestFinancialSnapshot({
  lastUpdated: "2099-08-03",
  accounts: [
    { id: "private-cash-id", name: "Cash Account", institution: "Synthetic Bank", balance: 1000, type: "asset", group: "cash", updatedAt: "2099-08-03" },
    { id: "private-investment-id", name: "TFSA", institution: "Synthetic Bank", balance: 5000, type: "asset", group: "investments", updatedAt: "2099-08-03" },
    { id: "private-rrsp-id", name: "RRSP", institution: "Synthetic Bank", balance: 1200, type: "asset", group: "investments", updatedAt: "2099-08-02" },
    { id: "private-dcp-id", name: "Group Retirement Savings - DCP", institution: "Synthetic Pension", balance: 800, type: "asset", group: "investments", updatedAt: "2099-08-01" },
    { id: "private-prpp-id", name: "PRPP", institution: "Synthetic Pension", balance: 1000, type: "asset", group: "investments", updatedAt: "2099-07-31" },
    { id: "private-liability-id", name: "TD Credit Card", institution: "Synthetic Bank", balance: 400, type: "liability", group: "debts", updatedAt: "2099-08-03" },
    { id: "private-car-loan-id", name: "BMO Car Loan", institution: "Synthetic Lender", balance: 10000, type: "liability", group: "debts", updatedAt: "2099-08-01" },
  ],
});

const transaction = ({
  index,
  meaning,
  amount,
  direction = "outflow",
  category = null,
  accountId = "private-cash-id",
}: {
  index: number;
  meaning: FinancialMeaning;
  amount: number;
  direction?: "inflow" | "outflow";
  category?: string | null;
  accountId?: string;
}): CanonicalTransaction => ({
  id: `private-transaction-${index}`,
  accountId,
  transactionDate: `2099-08-${String(index).padStart(2, "0")}`,
  postedDate: null,
  amount,
  direction,
  currency: "CAD",
  rawDescription: `Approved description ${index}`,
  normalizedCounterparty: `Approved description ${index}`,
  financialMeaning: meaning,
  status: "posted",
  relatedTransactionId: null,
  attribution: { world: null, category, method: category ? "deterministic-rule" : "unclassified", ruleId: null, confidence: null, correctedAt: null },
  provenance: {
    importId: `private-import-${index}`,
    providerId: "td",
    sourceRecordId: null,
    sourceKind: "import",
    observedAt: "2099-08-08T00:00:00.000Z",
    sourceUpdatedAt: null,
    fingerprint: { version: "private-version", value: `private-hash-${index}` },
    deduplicationKey: `private-dedup-${index}`,
  },
  createdAt: "2099-08-08T00:00:00.000Z",
  updatedAt: "2099-08-08T00:00:00.000Z",
});

const facts: CanonicalStatementFacts = {
  id: "private-statement-id",
  importId: "private-import-id",
  accountId: "private-liability-id",
  providerId: "td",
  accountType: "credit-card",
  currency: "CAD",
  statementDate: "2099-08-04",
  statementPeriodStart: "2099-07-07",
  statementPeriodEnd: "2099-08-04",
  paymentDueDate: "2099-08-25",
  minimumPaymentCents: 2500,
  previousBalanceCents: 30000,
  newBalanceCents: 40000,
  createdAt: "2099-08-08T00:00:00.000Z",
};

const coveredImport = (importId: string, start: string, end: string, accountId = "private-cash-id"): ImportJournalRecord => ({
  importId, sourceSha256: `hash-${importId}`, providerId: "td", accountType: "chequing", accountId,
  parserVersion: "test", statementPeriodStart: start, statementPeriodEnd: end, sourceFormat: "pdf",
  receivedAt: "2099-08-08T00:00:00.000Z", processingStartedAt: null, proposedAt: null,
  committedAt: "2099-08-08T00:00:00.000Z", status: "committed", parsedTransactionCount: 0,
  committedTransactionCount: 0, duplicateTransactionCount: 0, safeErrorCode: null, schemaVersion: 3,
});

test("derives canonical position and known World balances without statement double counting", () => {
  const view = deriveHomepageView({ model, transactions: [], statementFacts: [facts], asOfDate: "2099-08-08" });
  assert.deepEqual(view.position.netWorth, { status: "known", amount: -1400 });
  assert.deepEqual(view.position.assets, { status: "known", amount: 9000 });
  assert.deepEqual(view.position.liabilities, { status: "known", amount: 10400 });
  assert.deepEqual(view.cash.total, { status: "known", amount: 1000 });
  assert.equal(view.cash.accountCount, 2);
  assert.equal(view.cash.accounts.some((account) => account.accountType === "Credit card" && account.displayName === "TD Credit Card"), true);
  assert.deepEqual(view.investments.total, { status: "known", amount: 8000 });
  assert.equal(view.investments.accounts.length, 4);
  assert.equal(view.investments.accounts.reduce((sum, account) => sum + (account.balance.status === "known" ? account.balance.amount : 0), 0), 8000);
  const dcp = view.investments.accounts.find((account) => account.displayName.includes("DCP"));
  assert.deepEqual(dcp?.contributionBreakdown, {
    status: "unknown",
    message: "Employee and employer portions are not available in canonical data.",
  });
  assert.equal(view.recentAndUpcoming.upcoming[0].certainty, "known");
  assert.equal(view.recentAndUpcoming.upcoming[0].certainty === "known" ? view.recentAndUpcoming.upcoming[0].statementBalance : null, 400);
  assert.equal(view.position.liabilities.amount, 10400);
  assert.deepEqual(view.liabilities.total, { status: "known", amount: 10400 });
  assert.equal(view.liabilities.accounts.length, 2);
  assert.equal(view.liabilities.accounts.reduce((sum, account) => sum + (account.balance.status === "known" ? account.balance.amount : 0), 0), 10400);
  const card = view.liabilities.accounts.find((account) => account.displayName === "TD Credit Card");
  assert.equal(view.cash.accounts.find((account) => account.displayName === "TD Credit Card")?.statement?.minimumPayment, 25);
  assert.deepEqual(card?.statement, {
    statementDate: "2099-08-04",
    paymentDueDate: "2099-08-25",
    minimumPayment: 25,
    statementBalance: 400,
    currency: "CAD",
  });
  assert.equal(view.liabilities.accounts.find((account) => account.displayName === "BMO Car Loan")?.statement, undefined);
  assert.equal(view.vehicle.status, "partial");
  assert.equal(view.vehicle.financing?.displayName, "BMO Car Loan");
  assert.deepEqual(view.vehicle.financing?.balance, { status: "known", amount: 10000 });
  assert.equal(view.vehicle.asset, null);
  assert.equal(view.vehicle.equity.status, "unknown");
});

test("Founder Home facts project once into Home, Liabilities, equity, and Person totals", () => {
  const enriched = applyFounderWorldFacts(model, { version: 1, home: {
    property: { value: 400000, currency: "CAD", effectiveDate: "2099-08-05", source: "founder-manual" },
    mortgage: { institution: "Synthetic Mortgage", balance: 250000, currency: "CAD", effectiveDate: "2099-08-06", source: "founder-manual" },
  } });
  const view = deriveHomepageView({ model: enriched, transactions: [], statementFacts: [], asOfDate: "2099-08-08" });
  assert.equal(view.home.status, "known");
  assert.deepEqual(view.home.asset?.value, { status: "known", amount: 400000 });
  assert.deepEqual(view.home.financing?.balance, { status: "known", amount: 250000 });
  assert.deepEqual(view.home.equity, { status: "known", amount: 150000 });
  assert.deepEqual(view.position.netWorth, { status: "known", amount: 148600 });
  assert.deepEqual(view.position.liabilities, { status: "known", amount: 260400 });
  assert.equal(view.liabilities.accounts.filter((account) => account.accountType === "Mortgage").length, 1);
  assert.equal(view.home.financing?.displayName, "Mortgage");
});

test("describes investment snapshot movement neutrally without calling it return", () => {
  const investmentSnapshot = (id: string, accountId: string, date: string, value: number): CanonicalInvestmentSnapshot => ({
    id, accountId, providerId: "td", accountType: accountId.includes("rrsp") ? "rrsp" : "tfsa", parserVersion: "test",
    statementPeriodStart: date.slice(0, 8) + "01", statementPeriodEnd: date, endingValueCents: value,
    bookCostCents: null, contributionsCents: null, withdrawalsCents: null, employeeContributionsCents: null,
    employerContributionsCents: null, sourceSha256: `hash-${id}`, recordedAt: "2099-08-08T00:00:00Z",
  });
  const view = deriveHomepageView({ model, transactions: [], statementFacts: [], asOfDate: "2099-08-08", investmentSnapshots: [
    investmentSnapshot("tfsa-one", "private-investment-id", "2099-03-31", 500_000),
    investmentSnapshot("tfsa-two", "private-investment-id", "2099-06-30", 550_000),
    investmentSnapshot("rrsp-one", "private-rrsp-id", "2099-03-31", 100_000),
    investmentSnapshot("rrsp-two", "private-rrsp-id", "2099-06-30", 90_000),
  ] });
  assert.deepEqual(view.investments.change, { status: "known", amount: 400 });
  assert.match(view.investments.changeMessage, /not described as investment return/i);
  const tfsa = view.investments.accounts.find((account) => account.displayName === "TFSA");
  assert.deepEqual(tfsa?.investmentHistory?.valueChange, { status: "known", amount: 500 });
  assert.equal(tfsa?.investmentHistory?.snapshots.length, 2);
});

test("Founder-managed accounts and Vehicle facts update the canonical position without duplicate financing", () => {
  const enriched = applyFounderWorldFacts(model, { version: 1, home: { property: null, mortgage: null },
    accountOverrides: [{ canonicalAccountId: "private-investment-id", balance: 6500, effectiveDate: "2099-08-07", source: "founder-manual" }],
    additionalAccounts: [{ id: "founder-extra-cash", name: "Emergency Cash", institution: "Founder Bank", balance: 750, type: "asset", group: "cash", effectiveDate: "2099-08-07", source: "founder-manual" }],
    vehicle: { description: "Founder Vehicle", value: 18000, currency: "CAD", effectiveDate: "2099-08-07", source: "founder-manual" },
  });
  const view = deriveHomepageView({ model: enriched, transactions: [], statementFacts: [], asOfDate: "2099-08-08" });
  assert.deepEqual(view.investments.total, { status: "known", amount: 9500 });
  assert.deepEqual(view.cash.total, { status: "known", amount: 1750 });
  assert.equal(view.vehicle.status, "known");
  assert.deepEqual(view.vehicle.asset?.value, { status: "known", amount: 18000 });
  assert.deepEqual(view.vehicle.financing?.balance, { status: "known", amount: 10000 });
  assert.deepEqual(view.vehicle.equity, { status: "known", amount: 8000 });
  assert.deepEqual(view.position.netWorth, { status: "known", amount: 18850 });
  assert.equal(view.liabilities.accounts.filter((account) => account.displayName === "BMO Car Loan").length, 1);
});

test("uses financial meaning before category for spending and income", () => {
  const transactions = [
    transaction({ index: 1, meaning: "credit-card-purchase", amount: 100, category: "Dining", accountId: "private-liability-id" }),
    transaction({ index: 2, meaning: "expense", amount: 50, category: "Dining" }),
    transaction({ index: 3, meaning: "refund", amount: 20, direction: "inflow", category: "Dining", accountId: "private-liability-id" }),
    transaction({ index: 4, meaning: "income", amount: 500, direction: "inflow" }),
    transaction({ index: 5, meaning: "credit-card-payment", amount: 200, direction: "inflow", accountId: "private-liability-id" }),
    transaction({ index: 6, meaning: "transfer", amount: 200 }),
    transaction({ index: 7, meaning: "cash-withdrawal", amount: 40 }),
    transaction({ index: 8, meaning: "unknown", amount: 10 }),
  ];
  const view = deriveHomepageView({ model, transactions, statementFacts: [], asOfDate: "2099-08-08" });
  assert.deepEqual(view.lifestyle.qualifyingSpending, { status: "known", amount: 130 });
  assert.deepEqual(view.inflows.qualifyingIncome, { status: "known", amount: 500 });
  assert.deepEqual(view.cashflow.moneyIn, { status: "known", amount: 520 });
  assert.deepEqual(view.cashflow.moneyOut, { status: "known", amount: 150 });
  assert.deepEqual(view.cashflow.net, { status: "known", amount: 370 });
  assert.deepEqual(view.cashflow.topInflows.map((item) => item.amount), [500, 20]);
  assert.deepEqual(view.cashflow.topOutflows.map((item) => item.amount), [100, 50]);
  assert.deepEqual(view.lifestyle.topCategories, [{ category: "Dining", amount: 130 }]);
  assert.equal(view.lifestyle.unclassifiedCount, 1);
  assert.deepEqual(view.recentAndUpcoming.recent.map((item) => item.kind), [
    "other", "cash-movement", "transfer", "payment", "income", "refund",
  ]);
  assert.deepEqual(view.cash.incomeHistory.map((item) => item.amount), [500]);
  assert.deepEqual(view.cash.uncertainHistory.map((item) => item.amount), [10]);
  assert.deepEqual(view.cash.accounts.find((account) => account.displayName === "Cash Account")?.activity.incomeHistory.map((item) => item.amount), [500]);
});

test("Lifestyle categories reconcile to eligible visible transactions", () => {
  const transactions = [
    transaction({ index: 1, meaning: "expense", amount: 100, category: "Dining" }),
    transaction({ index: 2, meaning: "expense", amount: 50, category: "Groceries" }),
    transaction({ index: 3, meaning: "refund", amount: 20, direction: "inflow", category: "Dining" }),
    transaction({ index: 4, meaning: "credit-card-payment", amount: 200 }),
    transaction({ index: 5, meaning: "transfer", amount: 300 }),
    transaction({ index: 6, meaning: "credit-card-purchase", amount: 25, accountId: "private-liability-id" }),
    transaction({ index: 7, meaning: "unknown", amount: 500 }),
    transaction({ index: 8, meaning: "expense", amount: 40, category: "Dining" }),
  ];
  const view = deriveHomepageView({
    model, transactions, statementFacts: [], asOfDate: "2099-08-08",
    suppressedActivityTransactionIds: new Set(["private-transaction-8"]),
  });

  assert.deepEqual(view.lifestyle.qualifyingSpending, { status: "known", amount: 155 });
  assert.deepEqual(view.lifestyle.categories.map(({ label, total }) => ({ label, total })), [
    { label: "Dining", total: 80 },
    { label: "Groceries", total: 50 },
    { label: "Category unclear", total: 25 },
  ]);
  assert.equal(view.lifestyle.categories.reduce((sum, category) => sum + category.total, 0), 155);
  for (const category of view.lifestyle.categories) {
    assert.equal(category.transactions.reduce((sum, item) => sum + item.spendingImpact, 0), category.total);
  }
  assert.equal(view.lifestyle.unclassifiedCount, 2);
  assert.equal(view.lifestyle.categories.find((category) => category.label === "Category unclear")?.transactions[0].needsReview, false);
  const descriptions = view.lifestyle.categories.flatMap((category) => category.transactions.map((item) => item.description));
  assert.deepEqual(descriptions.sort(), ["Approved description 1", "Approved description 2", "Approved description 3", "Approved description 6"]);
});

test("Review Later is disclosed separately and Home and Vehicle categories remain traceable", () => {
  const deferred = transaction({ index: 1, meaning: "credit-card-purchase", amount: 25 });
  const home = { ...transaction({ index: 2, meaning: "expense", amount: 80, category: "Utilities" }), attribution: { ...transaction({ index: 2, meaning: "expense", amount: 80, category: "Utilities" }).attribution, world: "home" as const } };
  const vehicle = { ...transaction({ index: 3, meaning: "expense", amount: 60, category: "Fuel" }), attribution: { ...transaction({ index: 3, meaning: "expense", amount: 60, category: "Fuel" }).attribution, world: "vehicle" as const } };
  const view = deriveHomepageView({ model, transactions: [deferred, home, vehicle], statementFacts: [], asOfDate: "2099-08-08", deferredReviewTransactionIds: new Set([deferred.id]) });
  assert.equal(view.lifestyle.unclassifiedCount, 1);
  assert.equal(view.lifestyle.reviewedLaterCount, 1);
  assert.equal(view.lifestyle.actionableReviewCount, 0);
  assert.equal(view.lifestyle.categories[0].label, "Review Later");
  assert.deepEqual(view.home.categories.map(({ label, total }) => ({ label, total })), [{ label: "Utilities", total: 80 }]);
  assert.deepEqual(view.vehicle.categories.map(({ label, total }) => ({ label, total })), [{ label: "Fuel", total: 60 }]);
});

test("bank fees remain Cashflow activity but never inflate Lifestyle", () => {
  const transactions = [
    transaction({ index: 1, meaning: "fee", amount: 15, category: "Banking Fees" }),
    transaction({ index: 2, meaning: "expense", amount: 40, category: "Dining" }),
    transaction({ index: 3, meaning: "refund", amount: 15, direction: "inflow", category: "Banking Fees" }),
  ];
  const view = deriveHomepageView({ model, transactions, statementFacts: [], asOfDate: "2099-08-08" });
  assert.deepEqual(view.cashflow.moneyOut, { status: "known", amount: 55 });
  assert.deepEqual(view.cashflow.moneyIn, { status: "known", amount: 15 });
  assert.deepEqual(view.lifestyle.qualifyingSpending, { status: "known", amount: 40 });
  assert.equal(view.lifestyle.categories.some((category) => category.label === "Banking Fees"), false);
});

test("projects selectable recent facts and suppresses related payment double counting", () => {
  const transactions = [
    transaction({ index: 1, meaning: "income", amount: 100, direction: "inflow" }),
    transaction({ index: 2, meaning: "expense", amount: 40 }),
    transaction({ index: 3, meaning: "credit-card-payment", amount: 200 }),
    transaction({ index: 4, meaning: "credit-card-payment", amount: 200, direction: "inflow", accountId: "private-liability-id" }),
  ];
  const view = deriveHomepageView({
    model, transactions, statementFacts: [facts], asOfDate: "2099-08-08",
    suppressedActivityTransactionIds: new Set(["private-transaction-4"]),
  });
  assert.deepEqual(view.recentAndUpcoming.summary, {
    inflow: { status: "known", amount: 100 },
    outflow: { status: "known", amount: 240 },
    reviewNeededCount: 0,
  });
  assert.equal(view.recentAndUpcoming.recent.length, 3);
  assert.deepEqual(view.cashflow.moneyIn, { status: "known", amount: 100 });
  assert.deepEqual(view.cashflow.moneyOut, { status: "known", amount: 40 });
  assert.deepEqual(view.cashflow.net, { status: "known", amount: 60 });
  assert.deepEqual(view.recentAndUpcoming.recent[0], {
    viewKey: "recent-1", date: "2099-08-03", description: "Approved description 3", amount: 200,
    direction: "outflow", kind: "payment", accountName: "Cash Account", category: null,
    financialMeaning: "credit-card-payment", needsReview: false, understandingState: "understood",
    correction: null,
  });
  assert.deepEqual(view.recentAndUpcoming.upcoming[0], {
    viewKey: "upcoming-known-1", certainty: "known", date: "2099-08-25", amount: 25, statementBalance: 400,
    label: "Credit card payment", accountName: "TD Credit Card",
  });
});

test("shared calendar periods apply identical boundaries to Cashflow, Lifestyle, detail, and timeline", () => {
  const dates = ["2099-08-08", "2099-08-02", "2099-07-26", "2099-07-10", "2099-05-11", "2098-08-09", "2098-08-08"];
  const values = [1, 2, 4, 8, 16, 32, 64];
  const transactions = dates.flatMap((transactionDate, index) => [
    { ...transaction({ index: index + 20, meaning: "income", amount: values[index], direction: "inflow" }), transactionDate },
    { ...transaction({ index: index + 40, meaning: "expense", amount: values[index] * 10, category: "Living" }), transactionDate },
  ]);
  const expectations = [
    ["day", 1, 10, "2099-08-08"], ["week", 1, 10, "2099-08-03"], ["month", 3, 30, "2099-08-01"],
    ["quarter", 15, 150, "2099-07-01"], ["year", 31, 310, "2099-01-01"],
  ] as const;
  for (const [periodKey, moneyIn, moneyOut, startDate] of expectations) {
    const view = deriveHomepageView({ model, transactions, statementFacts: [facts], asOfDate: "2099-08-08", periodKey });
    assert.equal(view.period.startDate, startDate);
    assert.deepEqual(view.cashflow.moneyIn, { status: "known", amount: moneyIn });
    assert.deepEqual(view.cashflow.moneyOut, { status: "known", amount: moneyOut });
    assert.deepEqual(view.cashflow.net, { status: "known", amount: moneyIn - moneyOut });
    assert.deepEqual(view.lifestyle.qualifyingSpending, { status: "known", amount: moneyOut });
    assert.equal(view.lifestyle.categories[0].total, moneyOut);
    assert.equal(view.lifestyle.categories[0].transactions.reduce((sum, item) => sum + item.spendingImpact, 0), moneyOut);
    assert.equal(view.recentAndUpcoming.recent.every((item) => item.date >= startDate), true);
    assert.equal(view.recentAndUpcoming.upcoming.length, 1);
  }
  const year = deriveHomepageView({ model, transactions, statementFacts: [facts], asOfDate: "2099-08-08", periodKey: "year" });
  assert.deepEqual(year.cashflow.monthlyHistory, [
    { month: "2099-05", moneyIn: 16, moneyOut: 160, lifestyleSpending: 160 },
    { month: "2099-07", moneyIn: 12, moneyOut: 120, lifestyleSpending: 120 },
    { month: "2099-08", moneyIn: 3, moneyOut: 30, lifestyleSpending: 30 },
  ]);
  const custom = deriveHomepageView({ model, transactions, statementFacts: [facts], asOfDate: "2099-08-08", periodKey: "custom", customStart: "2099-05-11", customEnd: "2099-07-26" });
  assert.deepEqual(custom.cashflow.moneyIn, { status: "known", amount: 28 });
  assert.deepEqual([custom.period.startDate, custom.period.endDate], ["2099-05-11", "2099-07-26"]);
});

test("distinguishes disconnected activity from an empty partial store without claiming zero", () => {
  const disconnected = deriveHomepageView({ model, transactions: null, statementFacts: null, asOfDate: "2099-08-08" });
  assert.equal(disconnected.lifestyle.qualifyingSpending.status, "unknown");
  assert.equal(disconnected.coverage.status, "unavailable");
  assert.equal(disconnected.recentAndUpcoming.summary.inflow.status, "unknown");
  assert.equal(disconnected.cashflow.moneyIn.status, "unknown");
  assert.equal(disconnected.cashflow.moneyOut.status, "unknown");
  assert.equal(disconnected.cashflow.net.status, "unknown");
  assert.equal(disconnected.recentAndUpcoming.obligationStatus, "unavailable");
  const connected = deriveHomepageView({ model, transactions: [], statementFacts: [], asOfDate: "2099-08-08" });
  assert.equal(connected.lifestyle.qualifyingSpending.status, "unknown");
  assert.equal(connected.coverage.status, "partial");
  assert.equal(connected.coverage.latestTransactionDate, null);
  assert.deepEqual(connected.recentAndUpcoming.summary.inflow, { status: "known", amount: 0 });
  assert.equal(connected.cashflow.net.status, "unknown");
  assert.equal(connected.recentAndUpcoming.obligationStatus, "available");
});

test("distinguishes complete statement coverage from gaps in historical periods", () => {
  const complete = deriveHomepageView({
    model, transactions: [], statementFacts: [], asOfDate: "2099-08-08", periodKey: "month",
    imports: [coveredImport("one", "2099-08-01", "2099-08-31")],
  });
  assert.equal(complete.coverage.status, "complete");
  assert.equal(complete.coverage.gapCount, 0);
  assert.deepEqual(complete.coverage.gaps, []);

  const partial = deriveHomepageView({
    model, transactions: [], statementFacts: [], asOfDate: "2099-08-08", periodKey: "month",
    imports: [coveredImport("one", "2099-08-01", "2099-08-20"), coveredImport("two", "2099-08-25", "2099-08-31")],
  });
  assert.equal(partial.coverage.status, "partial");
  assert.equal(partial.coverage.gapCount, 1);
  assert.deepEqual(partial.coverage.gaps, [{ accountName: "Cash Account", startDate: "2099-08-21", endDate: "2099-08-24" }]);
});

test("does not let one account's continuous history mask another account's gap", () => {
  const view = deriveHomepageView({
    model, transactions: [], statementFacts: [], asOfDate: "2099-08-08", periodKey: "month",
    imports: [
      coveredImport("cash", "2099-08-01", "2099-08-31"),
      coveredImport("credit-before", "2099-08-01", "2099-08-20", "private-liability-id"),
      coveredImport("credit-after", "2099-08-25", "2099-08-31", "private-liability-id"),
    ],
  });
  assert.equal(view.coverage.status, "partial");
  assert.deepEqual(view.coverage.gaps, [{ accountName: "TD Credit Card", startDate: "2099-08-21", endDate: "2099-08-24" }]);
});

test("keeps missing canonical position unknown", () => {
  const view = deriveHomepageView({ model: createEmptyFinancialModel(), transactions: null, statementFacts: null, asOfDate: "2099-08-08" });
  assert.equal(view.position.netWorth.status, "unknown");
  assert.equal(view.cash.total.status, "unknown");
  assert.deepEqual(view.cash.accounts, []);
  assert.deepEqual(view.investments.accounts, []);
  assert.deepEqual(view.liabilities.accounts, []);
  assert.equal(view.home.status, "unknown");
  assert.equal(view.vehicle.status, "unknown");
});

test("homepage DTO excludes persistence provenance and private identifiers", () => {
  const view = deriveHomepageView({
    model,
    transactions: [transaction({ index: 1, meaning: "expense", amount: 10 })],
    statementFacts: [facts],
    asOfDate: "2099-08-08",
  });
  const serialized = JSON.stringify(view);
  for (const forbidden of [
    "private-cash-id", "private-liability-id", "private-car-loan-id", "private-transaction", "private-import",
    "private-investment-id", "private-dcp-id", "private-hash", "private-dedup", "fingerprint", "sourcePath", "filename", "encrypted",
  ]) assert.equal(serialized.includes(forbidden), false);
  assert.equal(serialized.includes("Approved description 1"), true);
  assert.equal(serialized.includes("TFSA"), true);
  assert.equal(serialized.includes("Canonical financial snapshot"), true);
  assert.equal(serialized.includes("recent-1"), true);
});
