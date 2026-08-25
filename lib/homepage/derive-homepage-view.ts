import type { CanonicalFinancialModel } from "../../types/finance.ts";
import type { CanonicalStatementFacts } from "../../types/imports.ts";
import type { ImportJournalRecord } from "../../types/imports.ts";
import type { CanonicalInvestmentSnapshot } from "../../types/investments.ts";
import type { HomepageAccount, HomepageActivity, HomepageMoney, HomepageViewModel } from "../../types/homepage.ts";
import type { CanonicalTransaction, FinancialMeaning } from "../../types/transactions.ts";
import { resolveFinancialPeriod, type FinancialPeriodKey } from "./financial-period.ts";
import { detectMissingExpectedEvents, detectRecurringPatterns } from "./recurring-patterns.ts";

export type HomepageFinancialSources = {
  model: CanonicalFinancialModel;
  transactions: readonly CanonicalTransaction[] | null;
  statementFacts: readonly CanonicalStatementFacts[] | null;
  imports?: readonly ImportJournalRecord[] | null;
  investmentSnapshots?: readonly CanonicalInvestmentSnapshot[] | null;
  asOfDate: string;
  suppressedActivityTransactionIds?: ReadonlySet<string>;
  periodKey?: FinancialPeriodKey;
  periodAnchor?: string;
  customStart?: string;
  customEnd?: string;
  corrections?: ReadonlyMap<string, { actionToken: string; suggestions: import("../../types/review-interface.ts").BrowserReviewSuggestion[] }>;
  deferredReviewTransactionIds?: ReadonlySet<string>;
};

const SPENDING = new Set<FinancialMeaning>(["expense", "fee", "interest", "credit-card-purchase"]);
const PAYMENT = new Set<FinancialMeaning>(["credit-card-payment"]);
const TRANSFER = new Set<FinancialMeaning>(["transfer"]);
const CASH_MOVEMENT = new Set<FinancialMeaning>(["cash-withdrawal", "cash-deposit"]);
const NON_LIFESTYLE_WORLDS = new Set(["home", "vehicle", "investments", "creditDebt"]);
const isBankingFeeCategory = (category: string | null) => category !== null && /^(?:bank|banking) fees$/i.test(category.trim());
const affectsLifestyle = (transaction: CanonicalTransaction) =>
  (SPENDING.has(transaction.financialMeaning) || transaction.financialMeaning === "refund" || transaction.financialMeaning === "reversal")
  && transaction.financialMeaning !== "fee" && transaction.financialMeaning !== "interest"
  && !isBankingFeeCategory(transaction.attribution.category)
  && !NON_LIFESTYLE_WORLDS.has(transaction.attribution.world ?? "");
const cents = (value: number) => Math.round(value * 100);
const money = (value: number): HomepageMoney => ({ status: "known", amount: value });
const unknown = (reason: string): HomepageMoney => ({ status: "unknown", reason });
const fromCents = (value: number) => value / 100;
const accountType = (name: string, world: "cash" | "investments" | "liabilities") => {
  if (world === "cash") return /chequing/i.test(name) ? "Chequing" : "Cash account";
  if (world === "liabilities") {
    if (/credit card|visa|mastercard/i.test(name)) return "Credit card";
    if (/car loan|auto loan|vehicle loan/i.test(name)) return "Vehicle loan";
    if (/mortgage/i.test(name)) return "Mortgage";
    return "Liability account";
  }
  if (/\bTFSA\b/i.test(name)) return "Tax-free savings account";
  if (/\bRRSP\b/i.test(name)) return "Registered retirement savings plan";
  if (/\bDCP\b|group retirement/i.test(name)) return "Defined contribution pension";
  if (/\bPRPP\b/i.test(name)) return "Pooled registered pension plan";
  return "Investment account";
};
const accountView = (
  account: CanonicalFinancialModel["money"]["accounts"][number],
  world: "cash" | "investments" | "liabilities",
  index: number,
  statement?: CanonicalStatementFacts,
  investmentSnapshots: readonly CanonicalInvestmentSnapshot[] = [],
): HomepageAccount => ({
  viewKey: `${world}-${index + 1}`,
  displayName: account.name,
  institution: account.institution,
  accountType: accountType(account.name, world),
  balance: money(account.balance),
  currency: "CAD",
  freshness: account.updatedAt.trim()
    ? { status: "known", asOf: account.updatedAt }
    : { status: "unknown", message: "Balance date is unavailable." },
  sourceLabel: "Canonical financial snapshot",
  activity: { moneyIn: 0, moneyOut: 0, recent: [], purchases: [], refunds: [], payments: [], incomeHistory: [], uncertainHistory: [], categoryDistribution: [], expected: [], reconciliation: { purchases: 0, refunds: 0, payments: 0 } },
  ...(statement ? {
    statement: {
      statementDate: statement.statementDate,
      paymentDueDate: statement.paymentDueDate,
      minimumPayment: fromCents(statement.minimumPaymentCents),
      statementBalance: fromCents(statement.newBalanceCents),
      currency: "CAD" as const,
    },
  } : {}),
  ...(/\bDCP\b|group retirement/i.test(account.name) ? {
    contributionBreakdown: {
      status: "unknown" as const,
      message: "Employee and employer portions are not available in canonical data.",
    },
  } : {}),
  ...(world === "investments" ? (() => {
    const ordered = [...investmentSnapshots].sort((left, right) => left.statementPeriodEnd.localeCompare(right.statementPeriodEnd));
    const latest = ordered.at(-1); const previous = ordered.at(-2);
    return { investmentHistory: {
      snapshots: ordered.map((snapshot) => ({ date: snapshot.statementPeriodEnd, value: fromCents(snapshot.endingValueCents) })),
      previousDate: previous?.statementPeriodEnd ?? null,
      valueChange: latest && previous ? money(fromCents(latest.endingValueCents - previous.endingValueCents)) : unknown("A previous recorded statement is needed."),
      message: latest && previous
        ? `Account value change since ${previous.statementPeriodEnd}. Contributions, withdrawals, income, fees, and market movement are not separated unless the statements support them.`
        : "A second recorded statement is needed before Vorvex can show change.",
    } };
  })() : {}),
});
const addDays = (date: string, days: number) => {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};

const activityKind = (meaning: FinancialMeaning): HomepageActivity["kind"] => {
  if (SPENDING.has(meaning)) return "spending";
  if (meaning === "income") return "income";
  if (meaning === "refund" || meaning === "reversal") return "refund";
  if (PAYMENT.has(meaning)) return "payment";
  if (TRANSFER.has(meaning)) return "transfer";
  if (CASH_MOVEMENT.has(meaning)) return "cash-movement";
  return "other";
};

export const deriveHomepageView = ({
  model,
  transactions,
  statementFacts,
  imports = null,
  investmentSnapshots = null,
  asOfDate,
  suppressedActivityTransactionIds = new Set<string>(),
  periodKey = "month",
  periodAnchor = asOfDate,
  customStart,
  customEnd,
  corrections = new Map(),
  deferredReviewTransactionIds = new Set<string>(),
}: HomepageFinancialSources): HomepageViewModel => {
  const selectedPeriod = resolveFinancialPeriod({ key: periodKey, anchorDate: periodAnchor, customStart, customEnd });
  const startDate = selectedPeriod.startDate;
  const endDate = selectedPeriod.endDate;
  const positionAvailable = model.status === "loaded" && model.summary !== null;
  const periodTransactions = transactions?.filter(
    (transaction) => transaction.transactionDate >= startDate && transaction.transactionDate <= endDate,
  ) ?? [];
  const visiblePeriodTransactions = periodTransactions.filter((transaction) => !suppressedActivityTransactionIds.has(transaction.id));
  const visibleHistoryTransactions = (transactions ?? []).filter(
    (transaction) => transaction.transactionDate <= asOfDate && !suppressedActivityTransactionIds.has(transaction.id),
  );
  const activityAvailable = transactions !== null;
  const periodHasActivity = periodTransactions.length > 0;
  const allDates = transactions?.map((transaction) => transaction.transactionDate).sort() ?? [];
  const coversSelectedPeriod = Boolean(allDates[0] && allDates[0] <= startDate && allDates.at(-1)! >= endDate);
  const periodHasEvidence = periodHasActivity || coversSelectedPeriod;
  const spendingCents = visiblePeriodTransactions
    .filter((transaction) => SPENDING.has(transaction.financialMeaning) && affectsLifestyle(transaction))
    .reduce((sum, transaction) => sum + cents(transaction.amount), 0);
  const refundCents = visiblePeriodTransactions
    .filter((transaction) => (transaction.financialMeaning === "refund" || transaction.financialMeaning === "reversal") && affectsLifestyle(transaction))
    .reduce((sum, transaction) => sum + cents(transaction.amount), 0);
  const incomeCents = visiblePeriodTransactions
    .filter((transaction) => transaction.financialMeaning === "income")
    .reduce((sum, transaction) => sum + cents(transaction.amount), 0);
  const categories = new Map<string, number>();
  for (const transaction of visiblePeriodTransactions) {
    if (!transaction.attribution.category || !affectsLifestyle(transaction)) continue;
    const sign = SPENDING.has(transaction.financialMeaning)
      ? 1
      : transaction.financialMeaning === "refund" || transaction.financialMeaning === "reversal" ? -1 : 0;
    if (sign === 0) continue;
    categories.set(
      transaction.attribution.category,
      (categories.get(transaction.attribution.category) ?? 0) + sign * cents(transaction.amount),
    );
  }
  const topCategories = [...categories.entries()]
    .filter(([, value]) => value > 0)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 3)
    .map(([category, value]) => ({ category, amount: fromCents(value) }));
  const lifestyleTotalCents = spendingCents - refundCents;
  const understoodSpendingCents = visiblePeriodTransactions
    .filter((transaction) => SPENDING.has(transaction.financialMeaning) && affectsLifestyle(transaction) && transaction.attribution.category !== null)
    .reduce((sum, transaction) => sum + cents(transaction.amount), 0);
  const lifestyleGroups = new Map<string, CanonicalTransaction[]>();
  for (const transaction of visiblePeriodTransactions) {
    if (!affectsLifestyle(transaction)) continue;
    const label = transaction.attribution.category ?? (deferredReviewTransactionIds.has(transaction.id) ? "Review Later" : transaction.financialMeaning === "unknown" ? "Unknown" : "Category unclear");
    lifestyleGroups.set(label, [...(lifestyleGroups.get(label) ?? []), transaction]);
  }
  const lifestyleCategories = [...lifestyleGroups.entries()].map(([label, grouped]) => {
    const totalCents = grouped.reduce((sum, transaction) => sum + (SPENDING.has(transaction.financialMeaning) ? 1 : -1) * cents(transaction.amount), 0);
    return { label, grouped, totalCents };
  }).filter((category) => category.totalCents !== 0)
    .sort((left, right) => right.totalCents - left.totalCents || left.label.localeCompare(right.label))
    .map((category, categoryIndex) => ({
      viewKey: `lifestyle-${categoryIndex + 1}`,
      label: category.label,
      total: fromCents(category.totalCents),
      relativeShare: lifestyleTotalCents > 0 && category.totalCents > 0 ? category.totalCents / lifestyleTotalCents : null,
      needsReview: category.label === "Unknown",
      transactions: [...category.grouped]
        .sort((left, right) => right.transactionDate.localeCompare(left.transactionDate))
        .map((transaction, transactionIndex) => ({
          viewKey: `lifestyle-${categoryIndex + 1}-${transactionIndex + 1}`,
          date: transaction.transactionDate,
          description: transaction.rawDescription,
          accountName: model.money.accounts.find((account) => account.id === transaction.accountId)?.name ?? "Unknown account",
          amount: transaction.amount,
          spendingImpact: SPENDING.has(transaction.financialMeaning) ? transaction.amount : -transaction.amount,
          category: transaction.attribution.category,
          needsReview: transaction.financialMeaning === "unknown" && !deferredReviewTransactionIds.has(transaction.id),
          correction: corrections.get(transaction.id) ?? null,
        })),
    }));
  const worldCategories = (world: "home" | "vehicle") => {
    const grouped = new Map<string, CanonicalTransaction[]>();
    for (const transaction of visiblePeriodTransactions) {
      if (transaction.attribution.world !== world || !transaction.attribution.category) continue;
      grouped.set(transaction.attribution.category, [...(grouped.get(transaction.attribution.category) ?? []), transaction]);
    }
    return [...grouped.entries()].map(([label, transactions], categoryIndex) => ({
      viewKey: `${world}-${categoryIndex + 1}`,
      label,
      total: fromCents(transactions.reduce((sum, transaction) => sum + (SPENDING.has(transaction.financialMeaning) ? 1 : -1) * cents(transaction.amount), 0)),
      relativeShare: null,
      needsReview: false,
      transactions: [...transactions].sort((left, right) => right.transactionDate.localeCompare(left.transactionDate)).map((transaction, transactionIndex) => ({
        viewKey: `${world}-${categoryIndex + 1}-${transactionIndex + 1}`,
        date: transaction.transactionDate, description: transaction.rawDescription,
        accountName: model.money.accounts.find((account) => account.id === transaction.accountId)?.name ?? "Unknown account",
        amount: transaction.amount, spendingImpact: SPENDING.has(transaction.financialMeaning) ? transaction.amount : -transaction.amount,
        category: transaction.attribution.category, needsReview: false, correction: corrections.get(transaction.id) ?? null,
      })),
    })).sort((left, right) => right.total - left.total || left.label.localeCompare(right.label));
  };
  const unclassifiedCount = visiblePeriodTransactions.filter((transaction) =>
    (SPENDING.has(transaction.financialMeaning) || transaction.financialMeaning === "unknown")
    && transaction.attribution.category === null,
  ).length;
  const reviewedLaterCount = visiblePeriodTransactions.filter((transaction) => deferredReviewTransactionIds.has(transaction.id)
    && (SPENDING.has(transaction.financialMeaning) || transaction.financialMeaning === "unknown") && transaction.attribution.category === null).length;
  const actionableReviewCount = visiblePeriodTransactions.filter((transaction) => transaction.financialMeaning === "unknown" && !deferredReviewTransactionIds.has(transaction.id)).length;
  const accountNames = new Map(model.money.accounts.map((account) => [account.id, account.name]));
  const activityView = (transaction: CanonicalTransaction, viewKey: string, direction = transaction.direction): HomepageActivity => ({
    viewKey, date: transaction.transactionDate, description: transaction.rawDescription, amount: transaction.amount,
    direction, kind: activityKind(transaction.financialMeaning),
    accountName: accountNames.get(transaction.accountId) ?? "Unknown account",
    category: transaction.attribution.category, financialMeaning: transaction.financialMeaning,
    needsReview: transaction.financialMeaning === "unknown" && !deferredReviewTransactionIds.has(transaction.id),
    understandingState: deferredReviewTransactionIds.has(transaction.id) ? "intentionally-deferred"
      : transaction.financialMeaning === "unknown" ? "genuinely-unknown"
      : SPENDING.has(transaction.financialMeaning) && transaction.attribution.category === null ? "category-ambiguous" : "understood",
    correction: corrections.get(transaction.id) ?? null,
  });
  const recent = [...visiblePeriodTransactions]
    .sort((left, right) => right.transactionDate.localeCompare(left.transactionDate) || right.postedDate?.localeCompare(left.postedDate ?? "") || 0)
    .slice(0, 6)
    .map((transaction, index) => activityView(transaction, `recent-${index + 1}`));
  const cashflowInflows = visiblePeriodTransactions.filter((transaction) => transaction.financialMeaning === "income"
    || transaction.financialMeaning === "refund" || transaction.financialMeaning === "reversal");
  const cashflowOutflows = visiblePeriodTransactions.filter((transaction) => SPENDING.has(transaction.financialMeaning));
  const flowGroup = (items: readonly CanonicalTransaction[], direction: "inflow" | "outflow") => {
    const grouped = new Map<string, { label: string; included: boolean; transactions: CanonicalTransaction[] }>();
    for (const transaction of items) {
      const included = direction === "inflow" ? cashflowInflows.includes(transaction) : cashflowOutflows.includes(transaction);
      const label = direction === "inflow"
        ? transaction.financialMeaning === "income" ? transaction.attribution.category ?? "Income"
        : transaction.financialMeaning === "refund" || transaction.financialMeaning === "reversal" ? `Refund / Rebate${transaction.attribution.category ? ` · ${transaction.attribution.category}` : ""}`
        : transaction.financialMeaning === "transfer" ? "Transfer In"
        : transaction.financialMeaning === "credit-card-payment" ? "Card settlement"
        : "Other / Unknown"
        : transaction.attribution.world === "home" ? "Home"
        : transaction.attribution.world === "vehicle" ? "Vehicle"
        : transaction.attribution.world === "investments" ? "Investments"
        : affectsLifestyle(transaction) ? "Lifestyle"
        : transaction.financialMeaning === "credit-card-payment" ? "Cash / Banking · Card settlement"
        : transaction.financialMeaning === "transfer" ? "Cash / Banking · Transfer"
        : transaction.financialMeaning === "fee" || transaction.financialMeaning === "cash-withdrawal" ? "Cash / Banking"
        : "Other / Unknown";
      const key = `${included ? "primary" : "movement"}:${label}`;
      const current = grouped.get(key) ?? { label, included, transactions: [] };
      current.transactions.push(transaction); grouped.set(key, current);
    }
    return [...grouped.entries()].map(([key, group], index) => ({
      key, label: group.label, includedInPrimaryTotal: group.included,
      total: fromCents(group.transactions.reduce((sum, transaction) => sum + cents(transaction.amount), 0)),
      transactions: [...group.transactions].sort((left, right) => right.amount - left.amount || right.transactionDate.localeCompare(left.transactionDate))
        .map((transaction, transactionIndex) => activityView(transaction, `flow-${direction}-${index + 1}-${transactionIndex + 1}`)),
    })).sort((left, right) => Number(right.includedInPrimaryTotal) - Number(left.includedInPrimaryTotal) || right.total - left.total || left.label.localeCompare(right.label));
  };
  const cashflowInCents = cashflowInflows.reduce((sum, transaction) => sum + cents(transaction.amount), 0);
  const cashflowOutCents = cashflowOutflows.reduce((sum, transaction) => sum + cents(transaction.amount), 0);
  const monthlyMovement = new Map<string, { moneyIn: number; moneyOut: number; lifestyleSpending: number }>();
  for (const transaction of visiblePeriodTransactions) {
    const month = transaction.transactionDate.slice(0, 7);
    const bucket = monthlyMovement.get(month) ?? { moneyIn: 0, moneyOut: 0, lifestyleSpending: 0 };
    if (transaction.financialMeaning === "income" || transaction.financialMeaning === "refund" || transaction.financialMeaning === "reversal") bucket.moneyIn += cents(transaction.amount);
    if (SPENDING.has(transaction.financialMeaning)) {
      bucket.moneyOut += cents(transaction.amount);
      if (affectsLifestyle(transaction)) bucket.lifestyleSpending += cents(transaction.amount);
    } else if ((transaction.financialMeaning === "refund" || transaction.financialMeaning === "reversal") && affectsLifestyle(transaction)) bucket.lifestyleSpending -= cents(transaction.amount);
    monthlyMovement.set(month, bucket);
  }
  const monthlyHistory = [...monthlyMovement.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([month, movement]) => ({
    month, moneyIn: fromCents(movement.moneyIn), moneyOut: fromCents(movement.moneyOut), lifestyleSpending: fromCents(movement.lifestyleSpending),
  }));
  const largest = (items: CanonicalTransaction[], prefix: string, direction: "inflow" | "outflow") => [...items]
    .sort((left, right) => right.amount - left.amount || right.transactionDate.localeCompare(left.transactionDate))
    .slice(0, 3).map((transaction, index) => activityView(transaction, `${prefix}-${index + 1}`, direction));
  const knownUpcoming = (statementFacts ?? [])
    .filter((facts) => facts.statementDate <= endDate && facts.paymentDueDate >= startDate)
    .sort((left, right) => left.paymentDueDate.localeCompare(right.paymentDueDate))
    .map((facts, index) => ({
      viewKey: `upcoming-known-${index + 1}`,
      certainty: "known" as const,
      date: facts.paymentDueDate,
      amount: fromCents(facts.minimumPaymentCents),
      statementBalance: fromCents(facts.newBalanceCents),
      label: "Credit card payment" as const,
      accountName: accountNames.get(facts.accountId) ?? "Unknown account",
    }));
  const recurringPatterns = detectRecurringPatterns(transactions ?? [], endDate);
  const missingExpectedEvents = detectMissingExpectedEvents(transactions ?? [], endDate);
  const expectedUpcoming = recurringPatterns.map((pattern, index) => ({
    viewKey: `upcoming-expected-${index + 1}`,
    certainty: "expected" as const,
    date: pattern.expectedDate,
    amount: pattern.approximateAmount,
    label: pattern.label,
    accountName: accountNames.get(pattern.accountId) ?? "Unknown account",
    cadence: pattern.cadence,
    confidence: pattern.confidence,
    direction: pattern.direction,
    evidenceCount: pattern.evidenceCount,
  }));
  const upcoming = [...knownUpcoming, ...expectedUpcoming].sort((left, right) => right.amount - left.amount || left.date.localeCompare(right.date));
  const accountActivity = (accountId: string) => {
    const accountTransactions = visiblePeriodTransactions.filter((transaction) => transaction.accountId === accountId);
    const isCreditCardAccount = liabilityAccounts.some((account) => account.id === accountId && accountType(account.name, "liabilities") === "Credit card");
    const cashCardPayments = isCreditCardAccount
      ? visiblePeriodTransactions.filter((transaction) => transaction.financialMeaning === "credit-card-payment" && transaction.direction === "outflow")
      : accountTransactions.filter((transaction) => transaction.financialMeaning === "credit-card-payment");
    const accountHistory = visibleHistoryTransactions.filter((transaction) => transaction.accountId === accountId)
      .sort((left, right) => right.transactionDate.localeCompare(left.transactionDate));
    const accountCategories = new Map<string, number>();
    for (const transaction of accountTransactions.filter((item) => SPENDING.has(item.financialMeaning) && item.attribution.category)) {
      accountCategories.set(transaction.attribution.category!, (accountCategories.get(transaction.attribution.category!) ?? 0) + cents(transaction.amount));
    }
    const activities = [...accountTransactions].sort((left, right) => right.transactionDate.localeCompare(left.transactionDate));
    const select = (predicate: (transaction: CanonicalTransaction) => boolean, prefix: string) => activities.filter(predicate).slice(0, 6).map((transaction, index) => activityView(transaction, `${prefix}-${index + 1}`));
    return {
      moneyIn: fromCents(accountTransactions.filter((transaction) => transaction.direction === "inflow").reduce((sum, transaction) => sum + cents(transaction.amount), 0)),
      moneyOut: fromCents(accountTransactions.filter((transaction) => transaction.direction === "outflow").reduce((sum, transaction) => sum + cents(transaction.amount), 0)),
      recent: select(() => true, "account-recent"),
      purchases: select((transaction) => transaction.financialMeaning === "credit-card-purchase", "account-purchase"),
      refunds: select((transaction) => transaction.financialMeaning === "refund" || transaction.financialMeaning === "reversal", "account-refund"),
      payments: [...cashCardPayments].sort((left, right) => right.transactionDate.localeCompare(left.transactionDate)).slice(0, 6)
        .map((transaction, index) => activityView(transaction, `account-payment-${index + 1}`)),
      incomeHistory: accountHistory.filter((transaction) => transaction.financialMeaning === "income").slice(0, 12)
        .map((transaction, index) => activityView(transaction, `account-income-history-${index + 1}`)),
      uncertainHistory: accountHistory.filter((transaction) => transaction.financialMeaning === "unknown").slice(0, 12)
        .map((transaction, index) => activityView(transaction, `account-uncertain-history-${index + 1}`)),
      categoryDistribution: [...accountCategories.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5).map(([category, amount]) => ({ category, amount: fromCents(amount) })),
      expected: expectedUpcoming.filter((_, index) => recurringPatterns[index]?.accountId === accountId),
      reconciliation: {
        purchases: fromCents(accountTransactions.filter((transaction) => transaction.financialMeaning === "credit-card-purchase").reduce((sum, transaction) => sum + cents(transaction.amount), 0)),
        refunds: fromCents(accountTransactions.filter((transaction) => transaction.financialMeaning === "refund" || transaction.financialMeaning === "reversal").reduce((sum, transaction) => sum + cents(transaction.amount), 0)),
        payments: fromCents(cashCardPayments.reduce((sum, transaction) => sum + cents(transaction.amount), 0)),
      },
    };
  };
  const visibleInflowCents = visiblePeriodTransactions.filter((transaction) => transaction.direction === "inflow").reduce((sum, transaction) => sum + cents(transaction.amount), 0);
  const visibleOutflowCents = visiblePeriodTransactions.filter((transaction) => transaction.direction === "outflow").reduce((sum, transaction) => sum + cents(transaction.amount), 0);
  const visibleReviewCount = visiblePeriodTransactions.filter((transaction) => transaction.financialMeaning === "unknown" && !deferredReviewTransactionIds.has(transaction.id)).length;
  const importedAccountCount = new Set(transactions?.map((transaction) => transaction.accountId) ?? []).size;
  const committedPeriods = (imports ?? []).map((record) => ({ accountId: record.accountId, startDate: record.statementPeriodStart, endDate: record.statementPeriodEnd }));
  const coverageByAccount = new Map<string, Array<{ startDate: string; endDate: string }>>();
  for (const period of committedPeriods) coverageByAccount.set(period.accountId, [...(coverageByAccount.get(period.accountId) ?? []), period]);
  const mergedCoverageByAccount = new Map<string, Array<{ startDate: string; endDate: string }>>();
  for (const [accountId, periods] of coverageByAccount) {
    const merged: Array<{ startDate: string; endDate: string }> = [];
    for (const period of periods.sort((left, right) => left.startDate.localeCompare(right.startDate))) {
      const previous = merged.at(-1);
      if (!previous || period.startDate > addDays(previous.endDate, 1)) merged.push({ startDate: period.startDate, endDate: period.endDate });
      else if (period.endDate > previous.endDate) previous.endDate = period.endDate;
    }
    mergedCoverageByAccount.set(accountId, merged);
  }
  const coverageGaps = [...mergedCoverageByAccount].flatMap(([accountId, periods]) => periods.slice(1).map((period, index) => ({
    accountName: accountNames.get(accountId) ?? "Unknown account",
    startDate: addDays(periods[index].endDate, 1), endDate: addDays(period.startDate, -1),
  })));
  const selectedPeriodCovered = mergedCoverageByAccount.size > 0 && [...mergedCoverageByAccount.values()].every((periods) =>
    periods.some((period) => period.startDate <= startDate && period.endDate >= endDate));
  const assistantSummary: string[] = [];
  if (periodHasActivity) {
    assistantSummary.push(`${periodTransactions.filter((transaction) => SPENDING.has(transaction.financialMeaning)).length} qualifying outflows are available for the selected ${selectedPeriod.label.toLowerCase()}.`);
    if (topCategories[0]) assistantSummary.push(`${topCategories[0].category} is the largest categorized spending area in this imported period.`);
    if (unclassifiedCount > 0) assistantSummary.push("Some transactions still need classification.");
  } else if (activityAvailable) assistantSummary.push("No imported activity is available for this period.");
  else assistantSummary.push("Imported activity is not connected on this device.");
  if (knownUpcoming[0]) assistantSummary.push(`A credit card payment is due on ${knownUpcoming[0].date}.`);
  else if (expectedUpcoming[0]) assistantSummary.push(`A recurring movement is expected around ${expectedUpcoming[0].date}.`);

  const cashAccounts = model.accountsByWorld.cash;
  const investmentAccounts = model.accountsByWorld.investments;
  const investmentSnapshotGroups = new Map<string, CanonicalInvestmentSnapshot[]>();
  for (const snapshot of investmentSnapshots ?? []) investmentSnapshotGroups.set(snapshot.accountId, [...(investmentSnapshotGroups.get(snapshot.accountId) ?? []), snapshot]);
  const latestInvestmentSnapshots = investmentAccounts.flatMap((account) => {
    const ordered = [...(investmentSnapshotGroups.get(account.id) ?? [])].sort((left, right) => left.statementPeriodEnd.localeCompare(right.statementPeriodEnd));
    return ordered.length >= 2 ? [{ latest: ordered.at(-1)!, previous: ordered.at(-2)! }] : [];
  });
  const investmentChangeCents = latestInvestmentSnapshots.reduce((sum, pair) => sum + pair.latest.endingValueCents - pair.previous.endingValueCents, 0);
  const liabilityAccounts = model.accountsByWorld.creditDebt;
  const homeAsset = model.accountsByWorld.home[0] ?? null;
  const mortgage = liabilityAccounts.find((account) => /mortgage/i.test(account.name)) ?? null;
  const vehicleLoan = liabilityAccounts.find((account) => /car loan|auto loan|vehicle loan/i.test(account.name)) ?? null;
  const vehicleAsset = model.accountsByWorld.vehicle[0] ?? null;
  const latestStatementByAccount = new Map<string, CanonicalStatementFacts>();
  for (const statement of statementFacts ?? []) {
    const current = latestStatementByAccount.get(statement.accountId);
    if (!current || statement.statementDate > current.statementDate) latestStatementByAccount.set(statement.accountId, statement);
  }
  const insights = [
    ...missingExpectedEvents.map((event) => ({ title: event.label, detail: `The latest matching fee passed its usual rebate window on ${event.expectedBy}; ${event.evidenceCount} prior fee-and-rebate observations support this expectation.`, tone: "attention" as const })),
    ...(spendingCents > 0 ? [{ title: `${Math.round(understoodSpendingCents / spendingCents * 100)}% of spending value understood`, detail: `${fromCents(understoodSpendingCents).toLocaleString("en-CA", { style: "currency", currency: "CAD" })} of ${fromCents(spendingCents).toLocaleString("en-CA", { style: "currency", currency: "CAD" })} has a canonical category for this period.`, tone: "positive" as const }] : []),
    ...(topCategories[0] ? [{ title: `${topCategories[0].category} is the largest spending category`, detail: `${topCategories[0].amount.toLocaleString("en-CA", { style: "currency", currency: "CAD" })} in the selected ${selectedPeriod.label.toLowerCase()}.`, tone: "neutral" as const }] : []),
    ...(knownUpcoming[0] ? [{ title: "A known credit-card obligation is approaching", detail: `Minimum payment is due ${knownUpcoming[0].date}.`, tone: "attention" as const }] : []),
    ...(visiblePeriodTransactions.some((transaction) => transaction.financialMeaning === "transfer" && transaction.attribution.world === "investments") ? [{ title: "Investment-related movement detected", detail: "The cash-side movement is excluded from Lifestyle. A specific investment account is not asserted without matching canonical evidence.", tone: "neutral" as const }] : []),
    ...(latestInvestmentSnapshots.length > 0 ? [{ title: "Recorded investment value changed", detail: "Vorvex has comparable snapshots, but does not label unexplained movement as return.", tone: "neutral" as const }] : []),
  ].slice(0, 4);
  return {
    status: !positionAvailable ? "unavailable" : activityAvailable ? "ready" : "partial",
    currency: "CAD",
    snapshotDate: model.money.lastUpdated,
    period: selectedPeriod,
    position: {
      netWorth: positionAvailable ? money(model.summary!.netWorth) : unknown("Canonical account position is unavailable."),
      assets: positionAvailable ? money(model.summary!.totalAssets) : unknown("Canonical asset position is unavailable."),
      liabilities: positionAvailable ? money(model.summary!.totalLiabilities) : unknown("Canonical liability position is unavailable."),
    },
    cash: {
      total: positionAvailable && model.totalsByWorld.cash !== null ? money(model.totalsByWorld.cash) : unknown("Cash balance is unavailable."),
      accountCount: cashAccounts.length + liabilityAccounts.filter((account) => accountType(account.name, "liabilities") === "Credit card").length,
      accounts: [
        ...cashAccounts.map((account, index) => ({ ...accountView(account, "cash", index), activity: accountActivity(account.id) })),
        ...liabilityAccounts.filter((account) => accountType(account.name, "liabilities") === "Credit card")
          .map((account, index) => ({ ...accountView(account, "liabilities", index, latestStatementByAccount.get(account.id)), activity: accountActivity(account.id) })),
      ],
      incomeHistory: visibleHistoryTransactions.filter((transaction) => transaction.financialMeaning === "income")
        .sort((left, right) => right.transactionDate.localeCompare(left.transactionDate)).slice(0, 12)
        .map((transaction, index) => activityView(transaction, `cash-income-history-${index + 1}`)),
      uncertainHistory: visibleHistoryTransactions.filter((transaction) => transaction.financialMeaning === "unknown")
        .sort((left, right) => right.transactionDate.localeCompare(left.transactionDate)).slice(0, 12)
        .map((transaction, index) => activityView(transaction, `cash-uncertain-history-${index + 1}`)),
    },
    investments: {
      total: positionAvailable && model.totalsByWorld.investments !== null ? money(model.totalsByWorld.investments) : unknown("Investment balance is unavailable."),
      accountCount: investmentAccounts.length,
      accounts: investmentAccounts.map((account, index) => ({ ...accountView(account, "investments", index, undefined, investmentSnapshotGroups.get(account.id)), activity: accountActivity(account.id) })),
      change: latestInvestmentSnapshots.length > 0 ? money(fromCents(investmentChangeCents)) : unknown("Previous investment statements are not available."),
      changeMessage: latestInvestmentSnapshots.length > 0
        ? `Combined account value change across ${latestInvestmentSnapshots.length} account${latestInvestmentSnapshots.length === 1 ? "" : "s"} with comparable recorded statements. This is not described as investment return.`
        : "Add another recorded investment statement to see what changed.",
    },
    liabilities: {
      total: positionAvailable ? money(model.summary!.totalLiabilities) : unknown("Liability balance is unavailable."),
      accountCount: liabilityAccounts.length,
      accounts: liabilityAccounts.map((account, index) => ({ ...accountView(account, "liabilities", index, latestStatementByAccount.get(account.id)), activity: accountActivity(account.id) })),
    },
    home: {
      status: homeAsset || mortgage ? homeAsset && mortgage ? "known" : "partial" : "unknown",
      message: homeAsset || mortgage ? "Known Home facts are shown; unavailable facts remain Unknown." : "No canonical Home or mortgage facts are available yet.",
      asset: homeAsset ? { name: homeAsset.name, value: money(homeAsset.balance), effectiveDate: homeAsset.updatedAt, sourceLabel: "Founder-provided factual entry" } : null,
      financing: mortgage ? { displayName: mortgage.name, institution: mortgage.institution, balance: money(mortgage.balance), effectiveDate: mortgage.updatedAt } : null,
      equity: homeAsset && mortgage ? money(fromCents(cents(homeAsset.balance) - cents(mortgage.balance))) : unknown("Property value and mortgage balance are both required."),
      categories: worldCategories("home"),
    },
    vehicle: {
      status: vehicleAsset || vehicleLoan ? vehicleAsset && vehicleLoan ? "known" : "partial" : "unknown",
      message: vehicleAsset || vehicleLoan ? "Known Vehicle facts are shown; unavailable facts remain Unknown." : "No canonical vehicle or vehicle-financing facts are available yet.",
      asset: vehicleAsset ? { name: vehicleAsset.name, value: money(vehicleAsset.balance), effectiveDate: vehicleAsset.updatedAt, sourceLabel: "Founder-provided factual entry" } : null,
      financing: vehicleLoan ? { displayName: vehicleLoan.name, institution: vehicleLoan.institution, balance: money(vehicleLoan.balance), effectiveDate: vehicleLoan.updatedAt } : null,
      equity: vehicleAsset && vehicleLoan ? money(fromCents(cents(vehicleAsset.balance) - cents(vehicleLoan.balance))) : unknown("Vehicle value and financing balance are both required."),
      categories: worldCategories("vehicle"),
    },
    lifestyle: {
      qualifyingSpending: periodHasEvidence
        ? money(fromCents(lifestyleTotalCents))
        : unknown("No imported activity is available for this period."),
      topCategories,
      categories: lifestyleCategories,
      unclassifiedCount,
      actionableReviewCount,
      reviewedLaterCount,
      message: unclassifiedCount > 0 ? "Some transactions still need classification." : null,
      understanding: spendingCents > 0
        ? { status: "known", percentage: Math.round(understoodSpendingCents / spendingCents * 100), understoodAmount: fromCents(understoodSpendingCents), totalAmount: fromCents(spendingCents) }
        : { status: "unknown", reason: "No canonical spending is available for this period." },
    },
    inflows: {
      qualifyingIncome: periodHasEvidence
        ? money(fromCents(incomeCents))
        : unknown("No imported income activity is available for this period."),
    },
    cashflow: {
      moneyIn: periodHasEvidence ? money(fromCents(cashflowInCents)) : unknown("No recorded activity establishes this selected period."),
      moneyOut: periodHasEvidence ? money(fromCents(cashflowOutCents)) : unknown("No recorded activity establishes this selected period."),
      net: periodHasEvidence ? money(fromCents(cashflowInCents - cashflowOutCents)) : unknown("No recorded activity establishes this selected period."),
      topInflows: largest(cashflowInflows, "cashflow-in", "inflow"),
      topOutflows: largest(cashflowOutflows, "cashflow-out", "outflow"),
      inflowGroups: flowGroup(visiblePeriodTransactions.filter((transaction) => transaction.direction === "inflow"), "inflow"),
      outflowGroups: flowGroup(visiblePeriodTransactions.filter((transaction) => transaction.direction === "outflow"), "outflow"),
      reviewNeededCount: visibleReviewCount,
      monthlyHistory,
    },
    recentAndUpcoming: {
      recent,
      upcoming,
      activityStatus: activityAvailable ? "available" : "unavailable",
      obligationStatus: statementFacts === null ? "unavailable" : "available",
      summary: {
        inflow: activityAvailable ? money(fromCents(visibleInflowCents)) : unknown("Recent inflow activity is unavailable."),
        outflow: activityAvailable ? money(fromCents(visibleOutflowCents)) : unknown("Recent outflow activity is unavailable."),
        reviewNeededCount: visibleReviewCount,
      },
    },
    coverage: activityAvailable
      ? {
          status: selectedPeriodCovered ? "complete" : "partial",
          earliestTransactionDate: allDates[0] ?? null,
          latestTransactionDate: allDates.at(-1) ?? null,
          importedAccountCount,
          gapCount: imports === null ? null : coverageGaps.length,
          gaps: coverageGaps,
          message: committedPeriods.length > 0
            ? `${selectedPeriodCovered ? "Complete statement coverage" : "Partial statement coverage"} for the selected ${selectedPeriod.label.toLowerCase()}. ${coverageGaps.length ? `${coverageGaps.length} gap${coverageGaps.length === 1 ? "" : "s"} exist in imported history.` : "No gaps exist between imported statement periods."}`
            : allDates.length > 0
            ? `Activity is available from ${allDates[0]} to ${allDates.at(-1)}, but statement continuity has not been established.`
            : "The import store is connected, but no historical activity is available to establish this period.",
        }
      : {
          status: "unavailable",
          earliestTransactionDate: null,
          latestTransactionDate: null,
          importedAccountCount: 0,
          gapCount: null,
          gaps: [],
          message: "Imported transaction coverage is not connected on this device.",
        },
    attention: {
      genuinelyUnknownCount: visibleHistoryTransactions.filter((transaction) => transaction.financialMeaning === "unknown" && !deferredReviewTransactionIds.has(transaction.id)).length,
      intentionallyDeferredCount: visibleHistoryTransactions.filter((transaction) => transaction.financialMeaning === "unknown" && deferredReviewTransactionIds.has(transaction.id)).length,
      categoryAmbiguityCount: visibleHistoryTransactions.filter((transaction) => transaction.financialMeaning !== "unknown" && SPENDING.has(transaction.financialMeaning) && transaction.attribution.category === null).length,
    },
    assistantSummary,
    insights,
  };
};
