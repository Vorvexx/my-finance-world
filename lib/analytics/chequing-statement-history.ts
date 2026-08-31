import type { CanonicalChequingStatementFacts } from "../../types/imports.ts";
import type { CanonicalTransaction } from "../../types/transactions.ts";

const fromCents = (value: number) => value / 100;

export type ChequingStatementHistoryItem = {
  statementId: string;
  startDate: string;
  endDate: string;
  openingCash: number;
  deposits: number;
  withdrawals: number;
  closingCash: number;
  cashChange: number;
  percentageChange: number | null;
  adjacentBalanceReconciles: boolean | null;
  coverage: "verified";
  source: "TD Chequing statement";
};

export type MonthlyChequingBalance = {
  month: string;
  openingCash: number | null;
  closingCash: number | null;
  coverage: "verified" | "partial";
};

const monthEnd = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
const previousDay = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
const monthsBetween = (start: string, end: string) => {
  const months: string[] = []; let cursor = `${start}-01`;
  while (cursor.slice(0, 7) <= end) {
    months.push(cursor.slice(0, 7));
    const date = new Date(`${cursor}T00:00:00Z`);
    cursor = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  }
  return months;
};

export const buildMonthlyChequingBalances = (
  facts: readonly CanonicalChequingStatementFacts[],
  transactions: readonly CanonicalTransaction[],
): readonly MonthlyChequingBalance[] => {
  if (!facts.length) return [];
  const ordered = [...facts].sort((left, right) => left.statementPeriodStart.localeCompare(right.statementPeriodStart));
  const balanceAt = (date: string): number | null => {
    const fact = ordered.find((item) => item.statementPeriodStart <= date && item.statementPeriodEnd >= date);
    if (!fact) return null;
    if (date === fact.statementPeriodEnd) return fromCents(fact.closingBalanceCents);
    const movement = transactions.filter((item) => item.accountId === fact.accountId && item.transactionDate > fact.statementPeriodStart && item.transactionDate <= date)
      .reduce((total, item) => total + (item.direction === "inflow" ? Math.round(item.amount * 100) : -Math.round(item.amount * 100)), 0);
    return fromCents(fact.openingBalanceCents + movement);
  };
  return monthsBetween(ordered[0].statementPeriodStart.slice(0, 7), ordered.at(-1)!.statementPeriodEnd.slice(0, 7)).map((month) => {
    const openingCash = balanceAt(previousDay(`${month}-01`));
    const closingCash = balanceAt(monthEnd(month));
    return { month, openingCash, closingCash, coverage: openingCash !== null && closingCash !== null ? "verified" as const : "partial" as const };
  });
};

export const buildChequingStatementHistory = (
  facts: readonly CanonicalChequingStatementFacts[],
): readonly ChequingStatementHistoryItem[] => {
  const ordered = [...facts].sort((left, right) => left.statementPeriodEnd.localeCompare(right.statementPeriodEnd));
  const history = ordered.map((fact, index) => {
    const arithmeticClosing = fact.openingBalanceCents + fact.totalDepositsCents - fact.totalWithdrawalsCents;
    if (arithmeticClosing !== fact.closingBalanceCents) throw new Error("CHEQUING_STATEMENT_RECONCILIATION_FAILED");
    const previous = ordered[index - 1];
    const comparable = previous?.statementPeriodEnd === fact.statementPeriodStart;
    const adjacentBalanceReconciles = comparable ? previous.closingBalanceCents === fact.openingBalanceCents : null;
    if (adjacentBalanceReconciles === false) throw new Error("CHEQUING_ADJACENT_BALANCE_RECONCILIATION_FAILED");
    const changeCents = fact.closingBalanceCents - fact.openingBalanceCents;
    return {
      statementId: fact.id,
      startDate: fact.statementPeriodStart,
      endDate: fact.statementPeriodEnd,
      openingCash: fromCents(fact.openingBalanceCents),
      deposits: fromCents(fact.totalDepositsCents),
      withdrawals: fromCents(fact.totalWithdrawalsCents),
      closingCash: fromCents(fact.closingBalanceCents),
      cashChange: fromCents(changeCents),
      percentageChange: fact.openingBalanceCents === 0 ? null : Math.round(changeCents / fact.openingBalanceCents * 10_000) / 100,
      adjacentBalanceReconciles,
      coverage: "verified" as const,
      source: "TD Chequing statement" as const,
    };
  });
  return history.reverse();
};
