import type { CanonicalChequingStatementFacts } from "../../types/imports.ts";

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
