import type { CanonicalTransaction, FinancialMeaning } from "../../types/transactions.ts";

export type RecurringPattern = {
  accountId: string;
  label: string;
  direction: "inflow" | "outflow";
  financialMeaning: FinancialMeaning;
  cadence: "weekly" | "biweekly" | "monthly";
  expectedDate: string;
  approximateAmount: number;
  confidence: "strong" | "expected" | "possible";
  evidenceCount: number;
};

const DAY = 86_400_000;
const dateValue = (date: string) => Date.parse(`${date}T00:00:00.000Z`);
const addDays = (date: string, days: number) => new Date(dateValue(date) + days * DAY).toISOString().slice(0, 10);
const median = (values: readonly number[]) => {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
};
const cadenceFor = (interval: number) => {
  if (interval >= 6 && interval <= 8) return { cadence: "weekly" as const, days: 7, tolerance: 2 };
  if (interval >= 12 && interval <= 16) return { cadence: "biweekly" as const, days: 14, tolerance: 3 };
  if (interval >= 27 && interval <= 33) return { cadence: "monthly" as const, days: 30, tolerance: 4 };
  return null;
};

export const detectRecurringPatterns = (
  transactions: readonly CanonicalTransaction[],
  asOfDate: string,
): readonly RecurringPattern[] => {
  const eligible = transactions.filter((transaction) => transaction.status === "posted"
    && ["income", "expense", "fee", "interest", "credit-card-purchase", "credit-card-payment"].includes(transaction.financialMeaning));
  const groups = new Map<string, CanonicalTransaction[]>();
  for (const transaction of eligible) {
    const counterparty = transaction.normalizedCounterparty.trim().toLocaleUpperCase("en-CA");
    if (!counterparty) continue;
    const key = [transaction.accountId, transaction.direction, transaction.financialMeaning, counterparty].join("|");
    groups.set(key, [...(groups.get(key) ?? []), transaction]);
  }
  const patterns: RecurringPattern[] = [];
  for (const grouped of groups.values()) {
    const ordered = [...grouped].sort((left, right) => left.transactionDate.localeCompare(right.transactionDate));
    if (ordered.length < 3) continue;
    const intervals = ordered.slice(1).map((item, index) => Math.round((dateValue(item.transactionDate) - dateValue(ordered[index].transactionDate)) / DAY));
    const typicalInterval = median(intervals.slice(-5));
    const cadence = cadenceFor(typicalInterval);
    if (!cadence) continue;
    const matchingIntervals = intervals.filter((interval) => Math.abs(interval - cadence.days) <= cadence.tolerance).length;
    if (matchingIntervals < Math.max(2, intervals.length - 1)) continue;
    const recent = ordered.slice(-6);
    const amount = median(recent.map((transaction) => transaction.amount));
    const stableAmountShare = recent.filter((transaction) =>
      Math.abs(transaction.amount - amount) / Math.max(amount, 0.01) <= 0.35).length / recent.length;
    let expectedDate = addDays(ordered.at(-1)!.transactionDate, cadence.days);
    while (expectedDate < asOfDate) expectedDate = addDays(expectedDate, cadence.days);
    if ((dateValue(expectedDate) - dateValue(asOfDate)) / DAY > 45) continue;
    const confidence = ordered.length >= 5 && matchingIntervals >= intervals.length - 1 && stableAmountShare === 1
      ? "strong" as const
      : ordered.length >= 4 && stableAmountShare >= 0.75 ? "expected" as const : "possible" as const;
    patterns.push({
      accountId: ordered[0].accountId,
      label: ordered.at(-1)!.rawDescription,
      direction: ordered[0].direction,
      financialMeaning: ordered[0].financialMeaning,
      cadence: cadence.cadence,
      expectedDate,
      approximateAmount: Math.round(amount * 100) / 100,
      confidence,
      evidenceCount: ordered.length,
    });
  }
  return patterns.sort((left, right) => left.expectedDate.localeCompare(right.expectedDate)
    || left.label.localeCompare(right.label)).slice(0, 8);
};
