import type { CanonicalTransaction } from "@/types/transactions";
import type { CoverageStatus, PeriodKey, PrototypeState, PrototypeView, Movement } from "@/types/prototype";

const iso = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => { const copy = new Date(date); copy.setUTCDate(copy.getUTCDate() + days); return copy; };
const startOf = (key: PeriodKey, end: Date) => {
  const value = new Date(end);
  if (key === "day") return value;
  if (key === "week") return addDays(value, -6);
  if (key === "fortnight") return addDays(value, -13);
  if (key === "month") return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
  if (key === "quarter") return new Date(Date.UTC(value.getUTCFullYear(), Math.floor(value.getUTCMonth() / 3) * 3, 1));
  return new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
};
const cents = (value: number) => Math.round(value * 100);
const money = (value: number) => Math.round(value) / 100;
const movement = (transaction: CanonicalTransaction): Movement => ({ id: transaction.id, date: transaction.date, name: transaction.normalizedCounterparty || transaction.rawDescription, amount: transaction.amount, direction: transaction.direction, category: transaction.attribution.category });
const summarize = (transactions: CanonicalTransaction[]) => {
  const inflow = transactions.filter((t) => t.financialRole === "income").reduce((sum, t) => sum + cents(t.amount), 0);
  const spending = transactions.filter((t) => t.financialRole === "spending").reduce((sum, t) => sum + cents(t.amount), 0);
  const transfers = transactions.filter((t) => t.financialRole === "transfer").reduce((sum, t) => sum + cents(t.amount), 0);
  const payments = transactions.filter((t) => t.financialRole === "credit-card-payment").reduce((sum, t) => sum + cents(t.amount), 0);
  return { inflow: money(inflow), spending: money(spending), transfers: money(transfers), payments: money(payments), net: money(inflow - spending) };
};

export const buildPrototypeView = (state: PrototypeState, periodKey: PeriodKey = "month", requestedEnd?: string): PrototypeView => {
  const availableDates = state.transactions.map((t) => t.date).sort();
  const end = new Date(`${requestedEnd ?? availableDates.at(-1) ?? iso(new Date())}T00:00:00Z`);
  const start = startOf(periodKey, end); const duration = Math.round((end.valueOf() - start.valueOf()) / 86400000) + 1;
  const previousEnd = addDays(start, -1); const previousStart = addDays(previousEnd, -(duration - 1));
  const inRange = (t: CanonicalTransaction, a: Date, b: Date) => t.date >= iso(a) && t.date <= iso(b);
  const transactions = state.transactions.filter((t) => inRange(t, start, end));
  const previousTransactions = state.transactions.filter((t) => inRange(t, previousStart, previousEnd));
  const totals = summarize(transactions); const previousTotals = summarize(previousTransactions);
  const spending = transactions.filter((t) => t.financialRole === "spending");
  const categoryMap = new Map<string, number>(); const previousMap = new Map<string, number>();
  spending.forEach((t) => categoryMap.set(t.attribution.category, (categoryMap.get(t.attribution.category) ?? 0) + cents(t.amount)));
  previousTransactions.filter((t) => t.financialRole === "spending").forEach((t) => previousMap.set(t.attribution.category, (previousMap.get(t.attribution.category) ?? 0) + cents(t.amount)));
  const categories = [...categoryMap].map(([category, amount]) => ({ category, amount: money(amount), previousAmount: money(previousMap.get(category) ?? 0), change: previousTransactions.length ? money(amount - (previousMap.get(category) ?? 0)) : null })).sort((a, b) => b.amount - a.amount);
  const availableStart = availableDates[0] ?? null; const availableEnd = availableDates.at(-1) ?? null;
  const statementDates = new Set<string>(); state.statements.forEach((s) => { let d = new Date(`${s.startDate}T00:00:00Z`); const finish = new Date(`${s.endDate}T00:00:00Z`); while (d <= finish) { statementDates.add(iso(d)); d = addDays(d, 1); } });
  const missingRanges: string[] = []; let gapStart: string | null = null;
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) { const key = iso(d); if (!statementDates.has(key) && !gapStart) gapStart = key; if (statementDates.has(key) && gapStart) { missingRanges.push(`${gapStart}–${iso(addDays(d, -1))}`); gapStart = null; } }
  if (gapStart) missingRanges.push(`${gapStart}–${iso(end)}`);
  // TD transaction CSVs expose activity rows, not an authoritative no-activity calendar.
  // They can prove available history and gaps outside their span, but not complete coverage.
  const coverageStatus: CoverageStatus = transactions.length === 0 ? "empty" : "partial";
  const review = state.transactions.filter((t) => t.attribution.method === "unclassified" && (t.financialRole === "income" || t.financialRole === "spending")).map((t) => ({ id: t.id, date: t.date, name: t.normalizedCounterparty, amount: t.amount, direction: t.direction, category: t.attribution.category }));
  const inflows = transactions.filter((t) => t.financialRole === "income").sort((a, b) => b.amount - a.amount).map(movement);
  const outflows = spending.sort((a, b) => b.amount - a.amount).map(movement);
  const recurringGroups = new Map<string, CanonicalTransaction[]>(); state.transactions.filter((t) => t.financialRole === "spending").forEach((t) => recurringGroups.set(t.normalizedCounterparty, [...(recurringGroups.get(t.normalizedCounterparty) ?? []), t]));
  const recurring = [...recurringGroups].filter(([, items]) => items.length >= 2).map(([name, items]) => ({ name, averageAmount: money(items.reduce((sum, t) => sum + cents(t.amount), 0) / items.length), occurrences: items.length, nextExpectedDate: null })).sort((a, b) => b.occurrences - a.occurrences).slice(0, 5);
  const knownCash = state.accounts.filter((a) => a.group === "cash" && a.balanceKnown !== false);
  const knownDebt = state.accounts.filter((a) => a.type === "liability" && a.balanceKnown !== false);
  const cash = knownCash.reduce((sum, a) => sum + a.balance, 0);
  const debt = knownDebt.reduce((sum, a) => sum + a.balance, 0);
  const partial = coverageStatus === "empty" ? "unknown" : "partial";
  return {
    person: state.person, accounts: state.accounts, statements: state.statements,
    period: { key: periodKey, startDate: iso(start), endDate: iso(end), label: `${iso(start)} – ${iso(end)}` },
    coverage: { status: coverageStatus, availableStart, availableEnd, missingRanges, message: coverageStatus === "empty" ? "No transactions are available for this period." : missingRanges.length ? `Partial history: ${missingRanges.length} uncovered range${missingRanges.length === 1 ? "" : "s"}.` : "Partial history: transaction rows span this period, but the CSV does not prove days without activity." },
    totals, previous: previousTransactions.length ? { inflow: previousTotals.inflow, spending: previousTotals.spending, net: previousTotals.net } : null,
    topInflows: inflows.slice(0, 3), topOutflows: outflows.slice(0, 3), categories, significant: [...inflows, ...outflows].sort((a, b) => b.amount - a.amount).slice(0, 5), review,
    recent: state.transactions.slice(0, 8).map(movement), recurring,
    worlds: {
      cash: { status: knownCash.length ? "known" : "unknown", value: knownCash.length ? cash : null, detail: knownCash.length ? "Recorded cash-account balance" : "Statements loaded; current balance remains Unknown" },
      cashflow: { status: partial, value: totals.net, detail: `${totals.inflow.toFixed(2)} in · ${totals.spending.toFixed(2)} spent` },
      lifestyle: { status: partial, value: totals.spending, detail: categories[0] ? `Largest category: ${categories[0].category}` : "No categorized spending" },
      liabilities: { status: knownDebt.length ? "known" : "unknown", value: knownDebt.length ? debt : null, detail: knownDebt.length ? "Recorded liability balance" : "Statements loaded; current balance remains Unknown" },
      home: { status: "unknown", value: null, detail: "No authoritative Home facts recorded" }, vehicle: { status: "unknown", value: null, detail: "No authoritative Vehicle facts recorded" },
      statements: { status: state.statements.length ? "known" : "unknown", value: state.statements.length, detail: `${state.transactions.length} canonical transactions` },
      review: { status: review.length ? "partial" : "known", value: review.length, detail: review.length ? "Unclassified activity needs context" : "No items currently need review" },
    }, updatedAt: state.updatedAt,
  };
};
