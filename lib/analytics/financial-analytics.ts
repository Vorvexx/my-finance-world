import type { MoneyWorldKey } from "../../types/finance.ts";
import type { ImportJournalRecord } from "../../types/imports.ts";
import type { CanonicalInvestmentSnapshot } from "../../types/investments.ts";
import type { CanonicalTransaction, FinancialMeaning } from "../../types/transactions.ts";
import { economicMeaningFor } from "../financial-model/economic-semantics.ts";

export type DateRange = { startDate: string; endDate: string };
export type AmountBreakdown = { key: string; amount: number; transactionCount: number };

const PRIMARY_INFLOW = new Set<FinancialMeaning>(["income", "gift-received", "refund", "reversal", "reimbursement"]);
const PRIMARY_OUTFLOW = new Set<FinancialMeaning>(["expense", "fee", "interest", "credit-card-purchase", "gift-given"]);
const NON_LIFESTYLE_WORLDS = new Set<MoneyWorldKey>(["home", "vehicle", "investments", "creditDebt"]);
const cents = (value: number) => Math.round(value * 100);
const amount = (value: number) => value / 100;
const sum = (transactions: readonly CanonicalTransaction[]) => amount(transactions.reduce((total, transaction) => total + cents(transaction.amount), 0));
const addDays = (date: string, days: number) => {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};

export const isPrimaryInflow = (transaction: CanonicalTransaction) => ["income", "gift-received", "refund-rebate", "reimbursement"].includes(economicMeaningFor(transaction));
export const isPrimaryOutflow = (transaction: CanonicalTransaction) => ["consumption", "gift-given", "financial-fee", "financial-interest-cost"].includes(economicMeaningFor(transaction));
export const isPrimaryInflowMeaning = (meaning: FinancialMeaning) => PRIMARY_INFLOW.has(meaning);
export const isPrimaryOutflowMeaning = (meaning: FinancialMeaning) => PRIMARY_OUTFLOW.has(meaning);
export const isRefund = (transaction: CanonicalTransaction) => economicMeaningFor(transaction) === "refund-rebate" || economicMeaningFor(transaction) === "reimbursement";
export const isInternalMovement = (transaction: CanonicalTransaction) => ["transfer", "credit-card-settlement", "wealth-building", "liability-reduction", "investment-withdrawal", "money-lent", "receivable-repayment", "asset-liquidation"].includes(economicMeaningFor(transaction));
export const isBankingFee = (transaction: CanonicalTransaction) => transaction.financialMeaning === "fee"
  || transaction.financialMeaning === "interest"
  || /^(?:bank|banking) fees$/i.test(transaction.attribution.category?.trim() ?? "");
export const affectsLifestyle = (transaction: CanonicalTransaction) =>
  (isPrimaryOutflow(transaction) || isRefund(transaction))
  && !isBankingFee(transaction)
  && !NON_LIFESTYLE_WORLDS.has(transaction.attribution.world ?? "future");

export const transactionsInRange = (transactions: readonly CanonicalTransaction[], range: DateRange) =>
  transactions.filter((transaction) => transaction.transactionDate >= range.startDate && transaction.transactionDate <= range.endDate);

export const summarizeCashFlow = (transactions: readonly CanonicalTransaction[], range: DateRange) => {
  const period = transactionsInRange(transactions, range);
  const primaryInflows = period.filter((transaction) => economicMeaningFor(transaction) === "income" || economicMeaningFor(transaction) === "gift-received");
  const primaryOutflows = period.filter(isPrimaryOutflow);
  const circulationInflows = period.filter((transaction) => transaction.direction === "inflow");
  const circulationOutflows = period.filter((transaction) => transaction.direction === "outflow");
  const moneyIn = sum(primaryInflows);
  const moneyOut = sum(primaryOutflows);
  const refundAmount = sum(period.filter(isRefund));
  return {
    transactionCount: period.length,
    moneyIn,
    moneyOut,
    net: amount(cents(moneyIn) - cents(moneyOut) + cents(refundAmount)),
    circulationIn: sum(circulationInflows),
    circulationOut: sum(circulationOutflows),
    transfers: sum(period.filter((transaction) => transaction.financialMeaning === "transfer")),
    creditCardPayments: sum(period.filter((transaction) => transaction.financialMeaning === "credit-card-payment")),
    cashMovements: sum(period.filter((transaction) => transaction.financialMeaning === "cash-withdrawal" || transaction.financialMeaning === "cash-deposit")),
  };
};

const breakdown = (transactions: readonly CanonicalTransaction[], keyFor: (transaction: CanonicalTransaction) => string | null) => {
  const grouped = new Map<string, { cents: number; transactionCount: number }>();
  for (const transaction of transactions) {
    const key = keyFor(transaction);
    if (!key) continue;
    const sign = isRefund(transaction) ? -1 : isPrimaryOutflow(transaction) ? 1 : 0;
    if (sign === 0) continue;
    const current = grouped.get(key) ?? { cents: 0, transactionCount: 0 };
    current.cents += sign * cents(transaction.amount);
    current.transactionCount += 1;
    grouped.set(key, current);
  }
  return [...grouped.entries()].map(([key, value]) => ({ key, amount: amount(value.cents), transactionCount: value.transactionCount }))
    .sort((left, right) => right.amount - left.amount || left.key.localeCompare(right.key));
};

export const summarizeSpending = (transactions: readonly CanonicalTransaction[], range: DateRange) => {
  const period = transactionsInRange(transactions, range).filter(affectsLifestyle);
  const charges = period.filter(isPrimaryOutflow);
  const refunds = period.filter(isRefund);
  const understoodCharges = charges.filter((transaction) => transaction.attribution.category !== null);
  const grossSpending = sum(charges);
  const refundAmount = sum(refunds);
  const understoodAmount = sum(understoodCharges);
  return {
    grossSpending,
    refunds: refundAmount,
    netSpending: amount(cents(grossSpending) - cents(refundAmount)),
    understoodAmount,
    understoodPercentage: grossSpending > 0 ? Math.round(understoodAmount / grossSpending * 100) : null,
    byCategory: breakdown(period, (transaction) => transaction.attribution.category),
    byWorld: breakdown(period, (transaction) => transaction.attribution.world),
  };
};

export const comparePeriods = (transactions: readonly CanonicalTransaction[], current: DateRange, previous: DateRange) => {
  const currentCashFlow = summarizeCashFlow(transactions, current);
  const previousCashFlow = summarizeCashFlow(transactions, previous);
  const currentSpending = summarizeSpending(transactions, current);
  const previousSpending = summarizeSpending(transactions, previous);
  return {
    current: { cashFlow: currentCashFlow, spending: currentSpending },
    previous: { cashFlow: previousCashFlow, spending: previousSpending },
    change: {
      moneyIn: amount(cents(currentCashFlow.moneyIn) - cents(previousCashFlow.moneyIn)),
      moneyOut: amount(cents(currentCashFlow.moneyOut) - cents(previousCashFlow.moneyOut)),
      net: amount(cents(currentCashFlow.net) - cents(previousCashFlow.net)),
      netSpending: amount(cents(currentSpending.netSpending) - cents(previousSpending.netSpending)),
    },
  };
};

export const largestMovements = (transactions: readonly CanonicalTransaction[], range: DateRange, limit = 5) => {
  const period = transactionsInRange(transactions, range);
  const ranked = (items: readonly CanonicalTransaction[]) => [...items]
    .sort((left, right) => right.amount - left.amount || right.transactionDate.localeCompare(left.transactionDate) || left.id.localeCompare(right.id))
    .slice(0, limit);
  return { inflows: ranked(period.filter(isPrimaryInflow)), outflows: ranked(period.filter(isPrimaryOutflow)) };
};

export const merchantTrends = (transactions: readonly CanonicalTransaction[], range: DateRange) => {
  const period = transactionsInRange(transactions, range).filter((transaction) => isPrimaryInflow(transaction) || isPrimaryOutflow(transaction));
  const grouped = new Map<string, { cents: number; transactionCount: number }>();
  for (const transaction of period) {
    const key = transaction.normalizedCounterparty.trim();
    if (!key) continue;
    const current = grouped.get(key) ?? { cents: 0, transactionCount: 0 };
    current.cents += cents(transaction.amount);
    current.transactionCount += 1;
    grouped.set(key, current);
  }
  return [...grouped.entries()].map(([key, value]) => ({ key, amount: amount(value.cents), transactionCount: value.transactionCount }))
    .sort((left, right) => right.amount - left.amount || right.transactionCount - left.transactionCount || left.key.localeCompare(right.key));
};

export const liabilityActivity = (transactions: readonly CanonicalTransaction[], liabilityAccountIds: ReadonlySet<string>, range: DateRange) => {
  const period = transactionsInRange(transactions, range).filter((transaction) => liabilityAccountIds.has(transaction.accountId));
  const increases = period.filter((transaction) => transaction.direction === "outflow");
  const reductions = period.filter((transaction) => transaction.direction === "inflow");
  const increasedBy = sum(increases);
  const reducedBy = sum(reductions);
  return {
    increasedBy,
    reducedBy,
    netActivity: amount(cents(increasedBy) - cents(reducedBy)),
    transactionCount: period.length,
    balanceChangeKnown: false as const,
  };
};

export const investmentContributionEvidence = (
  transactions: readonly CanonicalTransaction[], snapshots: readonly CanonicalInvestmentSnapshot[], range: DateRange,
) => ({
  cashSideTransfers: sum(transactionsInRange(transactions, range).filter((transaction) =>
    transaction.financialMeaning === "transfer" && transaction.attribution.world === "investments")),
  statementReported: snapshots.filter((snapshot) => snapshot.statementPeriodEnd >= range.startDate && snapshot.statementPeriodStart <= range.endDate)
    .map((snapshot) => ({
      accountId: snapshot.accountId,
      periodStart: snapshot.statementPeriodStart,
      periodEnd: snapshot.statementPeriodEnd,
      contributions: snapshot.contributionsCents === null ? null : amount(snapshot.contributionsCents),
      employeeContributions: snapshot.employeeContributionsCents === null ? null : amount(snapshot.employeeContributionsCents),
      employerContributions: snapshot.employerContributionsCents === null ? null : amount(snapshot.employerContributionsCents),
      withdrawals: snapshot.withdrawalsCents === null ? null : amount(snapshot.withdrawalsCents),
    })),
  linkedToSpecificInvestmentAccount: false as const,
});

export const investmentValueHistory = (snapshots: readonly CanonicalInvestmentSnapshot[]) => {
  const grouped = new Map<string, CanonicalInvestmentSnapshot[]>();
  for (const snapshot of snapshots) grouped.set(snapshot.accountId, [...(grouped.get(snapshot.accountId) ?? []), snapshot]);
  return [...grouped.entries()].map(([accountId, values]) => ({
    accountId,
    points: [...values].sort((left, right) => left.statementPeriodEnd.localeCompare(right.statementPeriodEnd)).map((snapshot) => ({
      date: snapshot.statementPeriodEnd,
      endingValue: amount(snapshot.endingValueCents),
      bookCost: snapshot.bookCostCents === null ? null : amount(snapshot.bookCostCents),
    })),
  })).sort((left, right) => left.accountId.localeCompare(right.accountId));
};

export const dataQuality = (
  transactions: readonly CanonicalTransaction[], genuinelyUnknownIds: ReadonlySet<string> = new Set(), intentionallyDeferredIds: ReadonlySet<string> = new Set(),
) => ({
  transactionCount: transactions.length,
  earliestDate: [...transactions].sort((left, right) => left.transactionDate.localeCompare(right.transactionDate))[0]?.transactionDate ?? null,
  latestDate: [...transactions].sort((left, right) => right.transactionDate.localeCompare(left.transactionDate))[0]?.transactionDate ?? null,
  genuinelyUnknownCount: transactions.filter((transaction) => genuinelyUnknownIds.has(transaction.id)).length,
  intentionallyDeferredCount: transactions.filter((transaction) => intentionallyDeferredIds.has(transaction.id)).length,
  categoryAmbiguityCount: transactions.filter((transaction) => isPrimaryOutflow(transaction) && transaction.attribution.category === null).length,
  deterministicCount: transactions.filter((transaction) => transaction.attribution.method === "deterministic-rule").length,
  founderUnderstoodCount: transactions.filter((transaction) => transaction.attribution.method === "user-correction").length,
  unclassifiedCount: transactions.filter((transaction) => transaction.attribution.method === "unclassified").length,
});

export const statementCoverage = (
  imports: readonly ImportJournalRecord[], accountNames: ReadonlyMap<string, string>, range?: DateRange,
) => {
  const committed = imports.filter((record) => record.status === "committed");
  const grouped = new Map<string, DateRange[]>();
  for (const record of committed) grouped.set(record.accountId, [...(grouped.get(record.accountId) ?? []), { startDate: record.statementPeriodStart, endDate: record.statementPeriodEnd }]);
  const accounts = [...grouped.entries()].map(([accountId, periods]) => {
    const merged: DateRange[] = [];
    for (const period of periods.sort((left, right) => left.startDate.localeCompare(right.startDate))) {
      const previous = merged.at(-1);
      if (!previous || period.startDate > addDays(previous.endDate, 1)) merged.push({ ...period });
      else if (period.endDate > previous.endDate) previous.endDate = period.endDate;
    }
    const gaps = merged.slice(1).map((period, index) => ({ startDate: addDays(merged[index].endDate, 1), endDate: addDays(period.startDate, -1) }));
    return {
      accountId, accountName: accountNames.get(accountId) ?? "Unknown account", periods: merged, gaps,
      selectedPeriodCovered: range ? merged.some((period) => period.startDate <= range.startDate && period.endDate >= range.endDate) : null,
    };
  }).sort((left, right) => left.accountName.localeCompare(right.accountName));
  return {
    accounts,
    committedImportCount: committed.length,
    gapCount: accounts.reduce((total, account) => total + account.gaps.length, 0),
    selectedPeriodCovered: range && accounts.length > 0 ? accounts.every((account) => account.selectedPeriodCovered) : null,
  };
};
