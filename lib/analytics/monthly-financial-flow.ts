import type { ImportJournalRecord } from "../../types/imports.ts";
import type { CanonicalInvestmentSnapshot } from "../../types/investments.ts";
import type { CanonicalTransaction } from "../../types/transactions.ts";
import { isPrimaryOutflow, isRefund, largestMovements, statementCoverage, summarizeCashFlow, transactionsInRange } from "./financial-analytics.ts";
import { economicMeaningFor } from "../financial-model/economic-semantics.ts";

export type AnalyticsEvidence = { date: string; description: string; amount: number; accountName: string };
export type RequiredCostComponent = {
  key: string; label: string; category: string | null; world: string; kind: "fixed" | "variable";
  cadence: "weekly" | "biweekly" | "monthly"; confidence: "strong" | "expected";
  normalizedMonthlyAmount: number; equivalentBiweeklyAmount: number; evidenceCount: number;
  supportingTransactions: readonly AnalyticsEvidence[];
};
export type AllocationBreakdown = { key: string; amount: number; transactionCount: number; percentageOfMoneyIn: number | null; percentageOfOutflow: number | null; percentageOfParent?: number | null };
export type WorldAllocationBreakdown = AllocationBreakdown & { categories: readonly AllocationBreakdown[] };
export type EvidenceLimitedAmount = { status: "known" | "partial" | "unknown"; amount: number | null; percentageOfAvailableToAllocate: number | null; reason: string | null };
export type MonthlyFinancialFlow = {
  month: string; startDate: string; endDate: string; status: "complete" | "partial";
  coverage: { complete: boolean; confidence: "high" | "partial"; message: string };
  openingPosition: { status: "known"; amount: number; date: string } | { status: "unknown"; reason: string };
  transactionCount: number; moneyIn: number; regularIncome: number; nonRegularEconomicInflows: number; moneyOut: number; rawCirculationIn: number; rawCirculationOut: number; netEconomicCashFlow: number;
  observedRequiredCosts: number; requiredCostCoverage: { status: "sufficient" | "partial"; normalizationSufficient: boolean; normalizedMonthlyAmount: number | null; reason: string };
  discretionaryConsumption: number;
  availableToAllocate: number; availableToAllocatePercentage: number | null; availableToAllocateChange: number | null; availableToAllocatePercentageChange: number | null; rollingThreeMonthAverage: number | null;
  verifiedWealthAllocation: EvidenceLimitedAmount; unknownAllocationResidual: EvidenceLimitedAmount; remainingAvailable: EvidenceLimitedAmount; unallocatedMoney: EvidenceLimitedAmount; discretionaryConsumptionRate: number | null;
  allocationBridge: { moneyIn: { amount: number; percentageOfMoneyIn: 100 | null }; nonRegularEconomicInflows: { amount: number; percentageOfMoneyIn: number | null }; observedRequired: { amount: number; percentageOfMoneyIn: number | null }; availableToAllocate: { amount: number; percentageOfMoneyIn: number | null }; discretionaryConsumption: { amount: number; percentageOfAvailableToAllocate: number | null }; verifiedWealthAllocation: EvidenceLimitedAmount; unknownAllocationResidual: EvidenceLimitedAmount; remainingAvailable: EvidenceLimitedAmount; unallocatedMoney: EvidenceLimitedAmount; equation: string; reconciles: true };
  transfers: number; creditCardSettlements: number; refunds: number; fees: number;
  unknownPartial: { amount: number; count: number };
  requiredCostComponents: readonly RequiredCostComponent[];
  byWorld: readonly WorldAllocationBreakdown[]; topMerchants: readonly AllocationBreakdown[];
  largestInflows: readonly AnalyticsEvidence[]; largestOutflows: readonly AnalyticsEvidence[];
  trend: { comparable: boolean; moneyInChange: number | null; moneyInPercentageChange: number | null; requiredCostChange: number | null; availableToAllocateChange: number | null; discretionaryChange: number | null; wealthAllocationChange: number | null; drivers: readonly string[] };
};
export type HistoricalFinancialFlow = {
  generatedThrough: string; startMonth: string; endMonth: string; months: readonly MonthlyFinancialFlow[];
  definitions: { availableToAllocate: string; remainingAvailable: string; refunds: string; exclusions: string; partialCoverage: string };
  all: { transactionCount: number; moneyIn: number; moneyOut: number; netEconomicCashFlow: number; observedRequiredCosts: number; availableToAllocate: number; discretionaryConsumption: number; verifiedWealthAllocation: EvidenceLimitedAmount; unknownAllocationResidual: EvidenceLimitedAmount; remainingAvailable: EvidenceLimitedAmount; transfers: number; creditCardSettlements: number; refunds: number; fees: number; unknownPartial: { amount: number; count: number }; byWorld: readonly WorldAllocationBreakdown[] };
};

const DAY = 86_400_000;
const toCents = (value: number) => Math.round(value * 100);
const fromCents = (value: number) => value / 100;
const sum = (items: readonly CanonicalTransaction[]) => fromCents(items.reduce((total, item) => total + toCents(item.amount), 0));
const iso = (date: Date) => date.toISOString().slice(0, 10);
const monthEnd = (month: string) => iso(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)));
const monthSequence = (start: string, end: string) => {
  const values: string[] = [];
  let cursor = `${start}-01`;
  while (cursor.slice(0, 7) <= end) {
    values.push(cursor.slice(0, 7));
    const date = new Date(`${cursor}T00:00:00.000Z`);
    cursor = iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)));
  }
  return values;
};
const median = (values: readonly number[]) => {
  const ordered = [...values].sort((a, b) => a - b); const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : Math.round((ordered[middle - 1] + ordered[middle]) / 2);
};
const days = (left: string, right: string) => Math.round((Date.parse(`${right}T00:00:00Z`) - Date.parse(`${left}T00:00:00Z`)) / DAY);
const cadence = (interval: number) => interval >= 6 && interval <= 8 ? { name: "weekly" as const, days: 7, monthly: 52 / 12 }
  : interval >= 12 && interval <= 16 ? { name: "biweekly" as const, days: 14, monthly: 26 / 12 }
  : interval >= 27 && interval <= 33 ? { name: "monthly" as const, days: 30, monthly: 1 } : null;
const requiredCategory = (transaction: CanonicalTransaction) => {
  const category = transaction.attribution.category?.trim() ?? "";
  return /mortgage|rent|insurance|utilit|hydro|electric|water|gas bill|telecom|internet|mobile|phone|grocer|medical|health|childcare|daycare|transit|property tax|municipal tax|vehicle payment|auto payment|fuel/i.test(category);
};
const explicitFixedObligation = (transaction: CanonicalTransaction) =>
  /mortgage|rent|property tax|municipal tax|vehicle payment|auto payment|insurance/i.test(transaction.attribution.category?.trim() ?? "");
const isFinancialFee = (transaction: CanonicalTransaction) => /^(?:bank|banking) fees$/i.test(transaction.attribution.category?.trim() ?? "")
  || ((transaction.financialMeaning === "fee" || transaction.financialMeaning === "interest")
    && transaction.attribution.world !== "home" && transaction.attribution.world !== "vehicle" && transaction.attribution.world !== "investments");
const isNonRegularEconomicInflow = (transaction: CanonicalTransaction) => isRefund(transaction)
  && (/rebate|cashback/i.test(transaction.attribution.category?.trim() ?? "")
    || /^(?:bank|banking) fees$/i.test(transaction.attribution.category?.trim() ?? "")
    || (economicMeaningFor(transaction) === "reimbursement" && /workplace wellness benefit/i.test(transaction.attribution.category?.trim() ?? "")));
const identity = (transaction: CanonicalTransaction) => [transaction.accountId, transaction.normalizedCounterparty.trim().toLocaleUpperCase("en-CA"), transaction.attribution.category ?? "", transaction.attribution.world ?? ""].join("|");
const evidence = (transaction: CanonicalTransaction, accountNames: ReadonlyMap<string, string>): AnalyticsEvidence => ({
  date: transaction.transactionDate, description: transaction.rawDescription, amount: transaction.amount,
  accountName: accountNames.get(transaction.accountId) ?? "Unknown account",
});
const detectRequiredCosts = (transactions: readonly CanonicalTransaction[], asOfDate: string, accountNames: ReadonlyMap<string, string>) => {
  const eligible = transactions.filter((item) => item.transactionDate <= asOfDate && item.status === "posted" && isPrimaryOutflow(item) && !isFinancialFee(item) && requiredCategory(item));
  const groups = new Map<string, CanonicalTransaction[]>();
  for (const item of eligible) groups.set(identity(item), [...(groups.get(identity(item)) ?? []), item]);
  const components: Array<RequiredCostComponent & { matchKey: string }> = [];
  for (const [key, group] of groups) {
    const ordered = [...group].sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));
    if (ordered.length < 3) continue;
    const intervals = ordered.slice(1).map((item, index) => days(ordered[index].transactionDate, item.transactionDate));
    const detected = cadence(median(intervals.slice(-5)));
    if (!detected) continue;
    const matching = intervals.filter((interval) => Math.abs(interval - detected.days) <= (detected.name === "monthly" ? 4 : 3)).length;
    if (matching < Math.max(2, intervals.length - 1)) continue;
    const recent = ordered.slice(-6); const medianCents = median(recent.map((item) => toCents(item.amount)));
    const deviation = recent.reduce((total, item) => total + Math.abs(toCents(item.amount) - medianCents), 0) / recent.length / Math.max(medianCents, 1);
    const normalizedCents = Math.round(medianCents * detected.monthly);
    components.push({
      key: "", matchKey: key, label: ordered.at(-1)!.normalizedCounterparty || ordered.at(-1)!.rawDescription,
      category: ordered.at(-1)!.attribution.category, world: ordered.at(-1)!.attribution.world ?? "Unknown",
      kind: deviation <= 0.1 ? "fixed" : "variable", cadence: detected.name,
      confidence: ordered.length >= 5 && matching >= intervals.length - 1 ? "strong" : "expected",
      normalizedMonthlyAmount: fromCents(normalizedCents), equivalentBiweeklyAmount: fromCents(Math.round(normalizedCents * 12 / 26)),
      evidenceCount: ordered.length, supportingTransactions: recent.map((item) => evidence(item, accountNames)),
    });
  }
  return components.sort((a, b) => b.normalizedMonthlyAmount - a.normalizedMonthlyAmount || a.label.localeCompare(b.label))
    .map((component, index) => ({ ...component, key: `required-${index + 1}` }));
};
const signedOutflowCents = (item: CanonicalTransaction) => isPrimaryOutflow(item) ? toCents(item.amount) : isRefund(item) ? -toCents(item.amount) : 0;
const allocation = (items: readonly CanonicalTransaction[], keyFor: (item: CanonicalTransaction) => string, moneyIn: number, moneyOut: number) => {
  const grouped = new Map<string, { amount: number; count: number }>();
  for (const item of items) {
    const impact = signedOutflowCents(item); if (!impact) continue; const key = keyFor(item);
    const current = grouped.get(key) ?? { amount: 0, count: 0 }; current.amount += impact; current.count += 1; grouped.set(key, current);
  }
  return [...grouped].map(([key, value]) => ({ key, amount: fromCents(value.amount), transactionCount: value.count,
    percentageOfMoneyIn: moneyIn > 0 ? Math.round(value.amount / toCents(moneyIn) * 10_000) / 100 : null,
    percentageOfOutflow: moneyOut > 0 ? Math.round(value.amount / toCents(moneyOut) * 10_000) / 100 : null,
  })).sort((a, b) => b.amount - a.amount || a.key.localeCompare(b.key));
};
const worldKey = (item: CanonicalTransaction) => isFinancialFee(item) ? "Fees"
  : item.attribution.world === "home" ? "Home"
  : item.attribution.world === "vehicle" ? "Vehicle"
  : item.attribution.world === "investments" ? "Investments / wealth"
  : item.attribution.world === "creditDebt" ? "Debt / liabilities"
  : !item.attribution.world || !item.attribution.category ? "Unknown / Partial" : "Lifestyle";
const worldAllocation = (items: readonly CanonicalTransaction[], moneyIn: number, moneyOut: number): WorldAllocationBreakdown[] =>
  allocation(items, worldKey, moneyIn, moneyOut).map((world) => ({
    ...world,
    categories: allocation(items.filter((item) => worldKey(item) === world.key), (item) => item.attribution.category ?? "Unknown / Partial", moneyIn, moneyOut)
      .map((category) => ({ ...category, percentageOfParent: world.amount === 0 ? null : Math.round(category.amount / world.amount * 10_000) / 100 })),
  }));
const percentChange = (current: number, previous: number) => previous === 0 ? null : Math.round((current - previous) / Math.abs(previous) * 10_000) / 100;
const assertMonthReconciles = (month: MonthlyFinancialFlow) => {
  const worldTotal = month.byWorld.reduce((sum, item) => sum + toCents(item.amount), 0);
  const netEconomicOutflow = toCents(month.moneyOut) - toCents(month.refunds) + toCents(month.nonRegularEconomicInflows);
  const hierarchyReconciles = month.byWorld.every((world) => world.categories.reduce((sum, item) => sum + toCents(item.amount), 0) === toCents(world.amount));
  if (toCents(month.netEconomicCashFlow) !== toCents(month.moneyIn) + toCents(month.nonRegularEconomicInflows) - netEconomicOutflow
    || toCents(month.availableToAllocate) !== toCents(month.moneyIn) - toCents(month.observedRequiredCosts)
    || toCents(month.discretionaryConsumption) !== netEconomicOutflow - toCents(month.observedRequiredCosts)
    || toCents(month.remainingAvailable.amount ?? month.unknownAllocationResidual.amount ?? 0) !== toCents(month.availableToAllocate) + toCents(month.nonRegularEconomicInflows) - toCents(month.discretionaryConsumption) - toCents(month.verifiedWealthAllocation.amount ?? 0)
    || toCents(month.observedRequiredCosts) > toCents(month.moneyOut)
    || worldTotal !== netEconomicOutflow || !hierarchyReconciles) {
    throw new Error(`FINANCIAL_FLOW_RECONCILIATION_FAILED:${month.month}`);
  }
};
const mergeBreakdowns = (months: readonly MonthlyFinancialFlow[], moneyIn: number, moneyOut: number): WorldAllocationBreakdown[] => {
  const grouped = new Map<string, { cents: number; count: number }>();
  for (const month of months) for (const item of month.byWorld) {
    const current = grouped.get(item.key) ?? { cents: 0, count: 0 }; current.cents += toCents(item.amount); current.count += item.transactionCount; grouped.set(item.key, current);
  }
  return [...grouped].map(([key, value]) => ({ key, amount: fromCents(value.cents), transactionCount: value.count,
    percentageOfMoneyIn: moneyIn > 0 ? Math.round(value.cents / toCents(moneyIn) * 10_000) / 100 : null,
    percentageOfOutflow: moneyOut > 0 ? Math.round(value.cents / toCents(moneyOut) * 10_000) / 100 : null,
    categories: (() => {
      const categories = new Map<string, { cents: number; count: number }>();
      for (const month of months) for (const world of month.byWorld.filter((item) => item.key === key)) for (const category of world.categories) {
        const current = categories.get(category.key) ?? { cents: 0, count: 0 }; current.cents += toCents(category.amount); current.count += category.transactionCount; categories.set(category.key, current);
      }
      return [...categories].map(([categoryKey, category]) => ({ key: categoryKey, amount: fromCents(category.cents), transactionCount: category.count,
        percentageOfMoneyIn: moneyIn > 0 ? Math.round(category.cents / toCents(moneyIn) * 10_000) / 100 : null,
        percentageOfOutflow: moneyOut > 0 ? Math.round(category.cents / toCents(moneyOut) * 10_000) / 100 : null,
        percentageOfParent: value.cents === 0 ? null : Math.round(category.cents / value.cents * 10_000) / 100,
      })).sort((a, b) => b.amount - a.amount || a.key.localeCompare(b.key));
    })(),
  })).sort((a, b) => b.amount - a.amount || a.key.localeCompare(b.key));
};

export const buildHistoricalFinancialFlow = ({ transactions, imports, investmentSnapshots, accountNames, genuinelyUnknownIds = new Set(), intentionallyDeferredIds = new Set(), startMonth = "2024-12", endDate }: {
  transactions: readonly CanonicalTransaction[]; imports: readonly ImportJournalRecord[]; investmentSnapshots: readonly CanonicalInvestmentSnapshot[];
  accountNames: ReadonlyMap<string, string>; genuinelyUnknownIds?: ReadonlySet<string>; intentionallyDeferredIds?: ReadonlySet<string>; startMonth?: string; endDate: string;
}): HistoricalFinancialFlow => {
  const endMonth = endDate.slice(0, 7);
  const months: MonthlyFinancialFlow[] = [];
  for (const month of monthSequence(startMonth, endMonth)) {
    const startDate = `${month}-01`; const periodEnd = month === endMonth ? endDate : monthEnd(month); const range = { startDate, endDate: periodEnd };
    const period = transactionsInRange(transactions, range); const cash = summarizeCashFlow(transactions, range);
    const detectedComponents = detectRequiredCosts(transactions, periodEnd, accountNames); const componentKeys = new Set(detectedComponents.map((item) => item.matchKey));
    const components: RequiredCostComponent[] = detectedComponents.map((item) => ({
      key: item.key, label: item.label, category: item.category, world: item.world, kind: item.kind, cadence: item.cadence,
      confidence: item.confidence, normalizedMonthlyAmount: item.normalizedMonthlyAmount, equivalentBiweeklyAmount: item.equivalentBiweeklyAmount,
      evidenceCount: item.evidenceCount, supportingTransactions: item.supportingTransactions,
    }));
    const required = period.filter((item) => isPrimaryOutflow(item) && !isFinancialFee(item)
      && (explicitFixedObligation(item) || componentKeys.has(identity(item))));
    const coverage = statementCoverage(imports, accountNames, range); const complete = coverage.selectedPeriodCovered === true;
    const unknownItems = period.filter((item) => genuinelyUnknownIds.has(item.id) || intentionallyDeferredIds.has(item.id) || (isPrimaryOutflow(item) && (!item.attribution.category || !item.attribution.world)));
    const nonRegularEconomicInflowItems = period.filter(isNonRegularEconomicInflow);
    const nonRegularEconomicInflows = sum(nonRegularEconomicInflowItems);
    const economic = period.filter((item) => isPrimaryOutflow(item) || (isRefund(item) && !isNonRegularEconomicInflow(item)));
    const refunds = sum(period.filter(isRefund));
    const fees = fromCents(period.filter(isFinancialFee).reduce((total, item) => total + signedOutflowCents(item), 0));
    const moneyIn = sum(period.filter((item) => economicMeaningFor(item) === "income" || economicMeaningFor(item) === "gift-received"));
    const verifiedWealthItems = period.filter((item) => economicMeaningFor(item) === "wealth-building");
    const verifiedWealthAmount = sum(verifiedWealthItems);
    const verifiedWealth: EvidenceLimitedAmount = verifiedWealthItems.length > 0
      ? { status: "known", amount: verifiedWealthAmount, percentageOfAvailableToAllocate: null, reason: "Destination-linked canonical investment evidence." }
      : { status: "unknown", amount: null, percentageOfAvailableToAllocate: null, reason: "No destination-linked evidence verifies wealth-building allocations for this period." };
    const observedRequiredCosts = sum(required);
    const unmodeledRequired = required.filter((item) => !componentKeys.has(identity(item)));
    const normalizationSufficient = complete && unmodeledRequired.length === 0 && components.length > 0;
    const normalizedMonthlyRequiredCost = fromCents(components.reduce((total, item) => total + toCents(item.normalizedMonthlyAmount), 0));
    const netEconomicOutflow = fromCents(toCents(cash.moneyOut) - toCents(refunds) + toCents(nonRegularEconomicInflows));
    const discretionaryConsumption = fromCents(toCents(netEconomicOutflow) - toCents(observedRequiredCosts));
    const availableToAllocate = fromCents(toCents(moneyIn) - toCents(observedRequiredCosts));
    const residual = fromCents(toCents(availableToAllocate) + toCents(nonRegularEconomicInflows) - toCents(discretionaryConsumption) - toCents(verifiedWealth.amount ?? 0));
    const residualPercentage = availableToAllocate === 0 ? null : Math.round(toCents(residual) / toCents(availableToAllocate) * 10_000) / 100;
    const remainingKnown = complete && unknownItems.length === 0 && verifiedWealth.amount !== null;
    const unknownAllocationResidual: EvidenceLimitedAmount = remainingKnown
      ? { status: "known", amount: 0, percentageOfAvailableToAllocate: 0, reason: "No unresolved allocation remains in this complete period." }
      : { status: "partial", amount: residual, percentageOfAvailableToAllocate: residualPercentage, reason: "Residual before any unverified wealth-building allocation; it is not assumed to remain spendable." };
    const remainingAvailable: EvidenceLimitedAmount = remainingKnown
      ? { status: "known", amount: residual, percentageOfAvailableToAllocate: residualPercentage, reason: "Complete coverage, resolved economic meaning, and verified wealth destinations support this amount." }
      : { status: "partial", amount: null, percentageOfAvailableToAllocate: null, reason: "Cannot be calculated until wealth-building destinations and unresolved allocations are verified." };
    const availableToAllocatePercentage = moneyIn > 0 ? Math.round(toCents(availableToAllocate) / toCents(moneyIn) * 10_000) / 100 : null;
    const discretionaryConsumptionRate = availableToAllocate !== 0 ? Math.round(toCents(discretionaryConsumption) / toCents(availableToAllocate) * 10_000) / 100 : null;
    const byWorld = worldAllocation(economic, moneyIn, cash.moneyOut);
    const topMerchants = allocation(economic, (item) => item.normalizedCounterparty || item.rawDescription, moneyIn, cash.moneyOut).slice(0, 10);
    const movements = largestMovements(transactions, range, 5);
    const current: MonthlyFinancialFlow = {
      month, startDate, endDate: periodEnd, status: complete ? "complete" : "partial",
      coverage: { complete, confidence: complete ? "high" : "partial", message: complete ? "All imported transaction accounts cover this period." : "At least one imported transaction account does not cover this full period." },
      openingPosition: { status: "unknown", reason: "A synchronized whole-person opening balance snapshot is unavailable for this month." },
      transactionCount: period.length, moneyIn, regularIncome: moneyIn, nonRegularEconomicInflows, moneyOut: cash.moneyOut, rawCirculationIn: cash.circulationIn, rawCirculationOut: cash.circulationOut, netEconomicCashFlow: fromCents(toCents(moneyIn) + toCents(nonRegularEconomicInflows) - toCents(netEconomicOutflow)),
      observedRequiredCosts,
      requiredCostCoverage: { status: complete ? "sufficient" : "partial", normalizationSufficient, normalizedMonthlyAmount: normalizationSufficient ? normalizedMonthlyRequiredCost : null,
        reason: !complete ? "Observed Required Costs reflect only available source coverage and must not be read as the Person's actual monthly requirement."
          : normalizationSufficient ? "Complete source coverage and cadence evidence support this normalized Required Cost."
          : "Observed Required Costs are complete for this source period, but one or more obligations lack sufficient cadence evidence for a normalized personal burden." },
      discretionaryConsumption,
      availableToAllocate, availableToAllocatePercentage,
      availableToAllocateChange: null, availableToAllocatePercentageChange: null, rollingThreeMonthAverage: null,
      verifiedWealthAllocation: { ...verifiedWealth, percentageOfAvailableToAllocate: verifiedWealth.amount !== null && availableToAllocate !== 0 ? Math.round(toCents(verifiedWealth.amount) / toCents(availableToAllocate) * 10_000) / 100 : null },
      unknownAllocationResidual, remainingAvailable, unallocatedMoney: remainingAvailable,
      discretionaryConsumptionRate,
      allocationBridge: {
        moneyIn: { amount: moneyIn, percentageOfMoneyIn: moneyIn === 0 ? null : 100 },
        nonRegularEconomicInflows: { amount: nonRegularEconomicInflows, percentageOfMoneyIn: moneyIn === 0 ? null : Math.round(toCents(nonRegularEconomicInflows) / toCents(moneyIn) * 10_000) / 100 },
        observedRequired: { amount: observedRequiredCosts, percentageOfMoneyIn: moneyIn === 0 ? null : Math.round(toCents(observedRequiredCosts) / toCents(moneyIn) * 10_000) / 100 },
        availableToAllocate: { amount: availableToAllocate, percentageOfMoneyIn: availableToAllocatePercentage },
        discretionaryConsumption: { amount: discretionaryConsumption, percentageOfAvailableToAllocate: discretionaryConsumptionRate },
        verifiedWealthAllocation: { ...verifiedWealth, percentageOfAvailableToAllocate: verifiedWealth.amount !== null && availableToAllocate !== 0 ? Math.round(toCents(verifiedWealth.amount) / toCents(availableToAllocate) * 10_000) / 100 : null },
        unknownAllocationResidual, remainingAvailable, unallocatedMoney: remainingAvailable,
        equation: `${moneyIn.toFixed(2)} - ${observedRequiredCosts.toFixed(2)} + ${nonRegularEconomicInflows.toFixed(2)} non-regular inflows - ${discretionaryConsumption.toFixed(2)} - ${verifiedWealth.amount === null ? "Unknown" : verifiedWealth.amount.toFixed(2)} wealth allocation = ${remainingKnown ? residual.toFixed(2) : `Partial; residual ${residual.toFixed(2)}`}`,
        reconciles: true,
      },
      transfers: cash.transfers, creditCardSettlements: cash.creditCardPayments, refunds, fees,
      unknownPartial: { amount: sum(unknownItems), count: unknownItems.length }, requiredCostComponents: components,
      byWorld, topMerchants,
      largestInflows: movements.inflows.map((item) => evidence(item, accountNames)),
      largestOutflows: movements.outflows.map((item) => evidence(item, accountNames)),
      trend: { comparable: false, moneyInChange: null, moneyInPercentageChange: null, requiredCostChange: null, availableToAllocateChange: null, discretionaryChange: null, wealthAllocationChange: null, drivers: [] },
    };
    const previous = months.at(-1);
    if (previous && previous.status === "complete" && current.status === "complete") {
      current.availableToAllocateChange = fromCents(toCents(current.availableToAllocate) - toCents(previous.availableToAllocate));
      current.availableToAllocatePercentageChange = percentChange(current.availableToAllocate, previous.availableToAllocate);
      const worldChanges = current.byWorld.map((item) => ({ key: item.key, change: toCents(item.amount) - toCents(previous.byWorld.find((prior) => prior.key === item.key)?.amount ?? 0) }))
        .sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 2).filter((item) => item.change !== 0);
      current.trend = { comparable: true,
        moneyInChange: fromCents(toCents(current.moneyIn) - toCents(previous.moneyIn)), moneyInPercentageChange: percentChange(current.moneyIn, previous.moneyIn),
        requiredCostChange: fromCents(toCents(current.observedRequiredCosts) - toCents(previous.observedRequiredCosts)), availableToAllocateChange: current.availableToAllocateChange,
        discretionaryChange: fromCents(toCents(current.discretionaryConsumption) - toCents(previous.discretionaryConsumption)), wealthAllocationChange: null,
        drivers: worldChanges.map((item) => `${item.key} ${item.change > 0 ? "increased" : "decreased"} by ${fromCents(Math.abs(item.change)).toFixed(2)}`),
      };
    }
    const comparable = [...months, current].filter((item) => item.status === "complete").slice(-3);
    if (current.status === "complete" && comparable.length === 3) current.rollingThreeMonthAverage = fromCents(Math.round(comparable.reduce((total, item) => total + toCents(item.availableToAllocate), 0) / 3));
    assertMonthReconciles(current);
    months.push(current);
  }
  const total = (field: "moneyIn" | "moneyOut" | "netEconomicCashFlow" | "observedRequiredCosts" | "availableToAllocate" | "discretionaryConsumption" | "transfers" | "creditCardSettlements" | "refunds" | "fees") =>
    fromCents(months.reduce((sum, month) => sum + toCents(month[field]), 0));
  const allMoneyIn = total("moneyIn"); const allMoneyOut = total("moneyOut");
  const allVerifiedWealth = fromCents(months.reduce((sum, month) => sum + toCents(month.verifiedWealthAllocation.amount ?? 0), 0));
  const hasVerifiedWealth = months.some((month) => month.verifiedWealthAllocation.status === "known");
  void investmentSnapshots;
  return { generatedThrough: endDate, startMonth, endMonth, months,
    definitions: {
      availableToAllocate: "Money In excluding refunds, minus observed Required Costs. This is financial capacity before discretionary consumption, not money still available to spend.",
      remainingAvailable: "Available to Allocate plus factual non-regular economic inflows, minus discretionary consumption and verified wealth-building allocations; also exposed as Unallocated Money. Partial/Unknown when wealth destinations are not factually linked.",
      refunds: "Purchase refunds reduce consumption in their canonical World/category. Factual rebates and banking rebates are shown as non-regular economic inflows. Neither is regular income.",
      exclusions: "Transfers and credit-card settlements are circulation and never consumption or wealth allocation.",
      partialCoverage: "Observed Required Costs are source-period facts; normalization and personal trend claims are suppressed when statement coverage is incomplete.",
    }, all: {
    transactionCount: months.reduce((sum, month) => sum + month.transactionCount, 0), moneyIn: allMoneyIn, moneyOut: allMoneyOut,
    netEconomicCashFlow: total("netEconomicCashFlow"), observedRequiredCosts: total("observedRequiredCosts"), availableToAllocate: total("availableToAllocate"), discretionaryConsumption: total("discretionaryConsumption"),
    verifiedWealthAllocation: hasVerifiedWealth
      ? { status: "known", amount: allVerifiedWealth, percentageOfAvailableToAllocate: total("availableToAllocate") === 0 ? null : Math.round(toCents(allVerifiedWealth) / toCents(total("availableToAllocate")) * 10_000) / 100, reason: "Sum of destination-linked canonical investment evidence." }
      : { status: "unknown", amount: null, percentageOfAvailableToAllocate: null, reason: "No destination-linked evidence verifies wealth-building allocations." },
    unknownAllocationResidual: { status: "partial", amount: fromCents(months.reduce((sum, month) => sum + toCents(month.unknownAllocationResidual.amount ?? 0), 0)), percentageOfAvailableToAllocate: total("availableToAllocate") === 0 ? null : Math.round(months.reduce((sum, month) => sum + toCents(month.unknownAllocationResidual.amount ?? 0), 0) / toCents(total("availableToAllocate")) * 10_000) / 100, reason: "Residual after verified wealth building and before any unverified allocation." },
    remainingAvailable: { status: "partial", amount: null, percentageOfAvailableToAllocate: null, reason: "Cannot be calculated until wealth-building destinations are verified." },
    transfers: total("transfers"), creditCardSettlements: total("creditCardSettlements"), refunds: total("refunds"), fees: total("fees"),
    unknownPartial: { amount: fromCents(months.reduce((sum, month) => sum + toCents(month.unknownPartial.amount), 0)), count: months.reduce((sum, month) => sum + month.unknownPartial.count, 0) },
    byWorld: mergeBreakdowns(months, allMoneyIn, allMoneyOut),
  } };
};

export type GoalIntention = { id: string; name: string; kind: "emergency-fund" | "car" | "home" | "vacation" | "education" | "retirement" | "custom"; assetAccountId: string; assignedAmount: number };
export const validateGoalIntentions = (intentions: readonly GoalIntention[], assetBalances: ReadonlyMap<string, number>) => {
  const assigned = new Map<string, number>();
  for (const intention of intentions) assigned.set(intention.assetAccountId, fromCents((toCents(assigned.get(intention.assetAccountId) ?? 0) + toCents(intention.assignedAmount))));
  return { valid: [...assigned].every(([accountId, value]) => value >= 0 && value <= (assetBalances.get(accountId) ?? -1)), assignedByAccount: assigned };
};
export const emergencyFundTarget = (chosenMonths: number, normalizedMonthlyRequiredCost: number) => {
  if (!Number.isInteger(chosenMonths) || chosenMonths <= 0) return null;
  return fromCents(toCents(normalizedMonthlyRequiredCost) * chosenMonths);
};
