import type {
  CanonicalTransaction,
  TransactionPeriodTotals,
} from "../../types/transactions.ts";
import type { MoneyWorldKey } from "../../types/finance.ts";

const toCents = (value: number) => Math.round(value * 100);
const fromCents = (value: number) => value / 100;

export const recentTransactions = (
  transactions: readonly CanonicalTransaction[],
  limit = 10,
) => [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);

export const pendingTransactions = (transactions: readonly CanonicalTransaction[]) =>
  transactions.filter((transaction) => transaction.status === "pending");

export const transactionsByAccount = (
  transactions: readonly CanonicalTransaction[],
  accountId: string,
) => transactions.filter((transaction) => transaction.accountId === accountId);

export const transactionsByWorld = (
  transactions: readonly CanonicalTransaction[],
  world: MoneyWorldKey,
) => transactions.filter((transaction) => transaction.attribution.world === world);

export const transactionTotalsForPeriod = (
  transactions: readonly CanonicalTransaction[],
  startDate: string,
  endDate: string,
): TransactionPeriodTotals => {
  const inPeriod = transactions.filter(
    (transaction) => transaction.date >= startDate && transaction.date <= endDate,
  );
  const inflowCents = inPeriod
    .filter((transaction) => transaction.direction === "inflow")
    .reduce((sum, transaction) => sum + toCents(transaction.amount), 0);
  const outflowCents = inPeriod
    .filter((transaction) => transaction.direction === "outflow")
    .reduce((sum, transaction) => sum + toCents(transaction.amount), 0);

  return {
    inflow: fromCents(inflowCents),
    outflow: fromCents(outflowCents),
    net: fromCents(inflowCents - outflowCents),
  };
};
