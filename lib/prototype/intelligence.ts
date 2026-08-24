import type { CanonicalTransaction } from "@/types/transactions";
import type { CoverageStatus, FinancialInsight, PeriodKey, PrototypeState, PrototypeView, Movement } from "@/types/prototype";

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
const roundMoney = (value: number) => Math.round(value * 100) / 100;
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
  const merchantMap = new Map<string, { amount: number; transactions: number }>(); spending.forEach((transaction) => { const current = merchantMap.get(transaction.normalizedCounterparty) ?? { amount: 0, transactions: 0 }; current.amount += cents(transaction.amount); current.transactions += 1; merchantMap.set(transaction.normalizedCounterparty, current); });
  const merchants = [...merchantMap].map(([name, value]) => ({ name, amount: money(value.amount), transactions: value.transactions })).sort((a, b) => b.amount - a.amount);
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
  const recurringGroups = new Map<string, CanonicalTransaction[]>(); state.transactions.filter((t) => t.financialRole === "spending" || t.financialRole === "income").forEach((t) => recurringGroups.set(`${t.financialRole}:${t.normalizedCounterparty}`, [...(recurringGroups.get(`${t.financialRole}:${t.normalizedCounterparty}`) ?? []), t]));
  const recurring = [...recurringGroups].flatMap(([, source]) => {
    const items = [...source].sort((a, b) => a.date.localeCompare(b.date)); if (items.length < 2) return [];
    const gaps = items.slice(1).map((item, index) => Math.round((Date.parse(`${item.date}T00:00:00Z`) - Date.parse(`${items[index].date}T00:00:00Z`)) / 86400000));
    const averageGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    const consistent = averageGap >= 5 && gaps.every((gap) => Math.abs(gap - averageGap) <= Math.max(3, averageGap * .25));
    if (!consistent) return [];
    return [{ name: items[0].normalizedCounterparty, averageAmount: money(items.reduce((sum, t) => sum + cents(t.amount), 0) / items.length), occurrences: items.length, nextExpectedDate: iso(addDays(new Date(`${items.at(-1)!.date}T00:00:00Z`), Math.round(averageGap))), confidence: "evidence-based prediction" as const }];
  }).sort((a, b) => b.occurrences - a.occurrences).slice(0, 5);
  const knownCash = state.accounts.filter((a) => a.group === "cash" && a.balanceKnown !== false);
  const knownDebt = state.accounts.filter((a) => a.type === "liability" && a.balanceKnown !== false);
  const cash = knownCash.reduce((sum, a) => sum + a.balance, 0);
  const debt = knownDebt.reduce((sum, a) => sum + a.balance, 0);
  const factAssets = state.facts.filter((fact) => ["cash", "investment", "home", "vehicle"].includes(fact.kind)).reduce((sum, fact) => sum + fact.value, 0);
  const factLiabilities = state.facts.filter((fact) => ["liability", "mortgage", "vehicle-financing"].includes(fact.kind)).reduce((sum, fact) => sum + fact.value, 0);
  const knownAssets = knownCash.reduce((sum, account) => sum + account.balance, 0) + state.accounts.filter((a) => a.group === "investments" && a.balanceKnown !== false).reduce((sum, a) => sum + a.balance, 0) + factAssets;
  const knownLiabilities = debt + factLiabilities;
  const hasPosition = knownCash.length > 0 || knownDebt.length > 0 || state.facts.length > 0;
  const factsFor = (...kinds: PrototypeState["facts"][number]["kind"][]) => state.facts.filter((fact) => kinds.includes(fact.kind));
  const insights: FinancialInsight[] = [];
  if (previousTransactions.length) {
    const delta = totals.spending - previousTotals.spending; const percent = previousTotals.spending > 0 ? Math.round(Math.abs(delta) / previousTotals.spending * 100) : null;
    insights.push({ id: "cashflow-change", title: delta <= 0 ? "Spending decreased" : "Spending increased", detail: `${roundMoney(Math.abs(delta)).toLocaleString("en-CA", { style: "currency", currency: "CAD" })} ${delta <= 0 ? "less" : "more"} than the preceding equivalent period${percent == null ? "" : ` (${percent}%)`}.`, evidence: `${transactions.length} current and ${previousTransactions.length} preceding transactions`, tone: delta <= 0 ? "positive" : "attention" });
  }
  const changedCategory = categories.filter((category) => category.change != null).sort((a, b) => Math.abs(b.change!) - Math.abs(a.change!))[0];
  if (changedCategory) insights.push({ id: "category-change", title: `${changedCategory.category} changed most`, detail: `${roundMoney(Math.abs(changedCategory.change!)).toLocaleString("en-CA", { style: "currency", currency: "CAD" })} ${changedCategory.change! >= 0 ? "higher" : "lower"} than the preceding period.`, evidence: `${changedCategory.category} transactions in both selected ranges`, tone: changedCategory.change! > 0 ? "attention" : "positive" });
  if (review.length) insights.push({ id: "review", title: `${review.length} item${review.length === 1 ? " needs" : "s need"} your context`, detail: "Resolving them will improve Lifestyle and Assistant explanations.", evidence: "Canonical transactions without an authoritative classification", tone: "attention" });
  if (!insights.length && transactions.length) insights.push({ id: "largest", title: "Largest movement", detail: `${[...inflows, ...outflows].sort((a, b) => b.amount - a.amount)[0]?.name ?? "Unknown"} had the largest recorded effect in this period.`, evidence: "Canonical movements in the selected period", tone: "neutral" });
  const partial = coverageStatus === "empty" ? "unknown" : "partial";
  return {
    person: state.person, accounts: state.accounts, statements: state.statements, facts: state.facts,
    period: { key: periodKey, startDate: iso(start), endDate: iso(end), label: `${iso(start)} – ${iso(end)}` },
    coverage: { status: coverageStatus, availableStart, availableEnd, missingRanges, message: coverageStatus === "empty" ? "No transactions are available for this period." : missingRanges.length ? `Partial history: ${missingRanges.length} uncovered range${missingRanges.length === 1 ? "" : "s"}.` : "Partial history: transaction rows span this period, but the CSV does not prove days without activity." },
    totals, previous: previousTransactions.length ? { inflow: previousTotals.inflow, spending: previousTotals.spending, net: previousTotals.net } : null,
    topInflows: inflows.slice(0, 3), topOutflows: outflows.slice(0, 3), categories, merchants, insights: insights.slice(0, 3), significant: [...inflows, ...outflows].sort((a, b) => b.amount - a.amount).slice(0, 5), review,
    recent: state.transactions.slice(0, 8).map(movement), recurring, position: { assets: hasPosition ? roundMoney(knownAssets) : null, liabilities: hasPosition ? roundMoney(knownLiabilities) : null, netWorth: hasPosition ? roundMoney(knownAssets - knownLiabilities) : null },
    worlds: {
      cash: { status: knownCash.length || factsFor("cash").length ? "known" : "unknown", value: knownCash.length || factsFor("cash").length ? roundMoney(cash + factsFor("cash").reduce((sum, fact) => sum + fact.value, 0)) : null, detail: knownCash.length || factsFor("cash").length ? "Authoritative cash balances" : "Statements loaded; current balance remains Unknown" },
      cashflow: { status: partial, value: totals.net, detail: `${totals.inflow.toFixed(2)} in · ${totals.spending.toFixed(2)} spent` },
      lifestyle: { status: partial, value: totals.spending, detail: categories[0] ? `Largest category: ${categories[0].category}` : "No categorized spending" },
      investments: { status: factsFor("investment").length ? "known" : "unknown", value: factsFor("investment").length ? roundMoney(factsFor("investment").reduce((sum, fact) => sum + fact.value, 0)) : null, detail: factsFor("investment").length ? `${factsFor("investment").length} authoritative balance${factsFor("investment").length === 1 ? "" : "s"}` : "No authoritative investment balances recorded" },
      liabilities: { status: knownDebt.length || factsFor("liability", "mortgage", "vehicle-financing").length ? "known" : "unknown", value: knownDebt.length || factsFor("liability", "mortgage", "vehicle-financing").length ? roundMoney(debt + factLiabilities) : null, detail: knownDebt.length || factLiabilities ? "Authoritative outstanding balances" : "Statements loaded; current balance remains Unknown" },
      home: { status: factsFor("home").length ? "known" : "unknown", value: factsFor("home")[0]?.value ?? null, detail: factsFor("mortgage").length ? `Mortgage recorded: ${factsFor("mortgage")[0].name}` : factsFor("home").length ? "Property value recorded; mortgage Unknown" : "No authoritative Home facts recorded" }, vehicle: { status: factsFor("vehicle").length ? "known" : "unknown", value: factsFor("vehicle")[0]?.value ?? null, detail: factsFor("vehicle-financing").length ? `Financing recorded: ${factsFor("vehicle-financing")[0].name}` : factsFor("vehicle").length ? "Vehicle value recorded; financing Unknown" : "No authoritative Vehicle facts recorded" },
      statements: { status: state.statements.length ? "known" : "unknown", value: state.statements.length, detail: `${state.transactions.length} canonical transactions` },
      review: { status: review.length ? "partial" : "known", value: review.length, detail: review.length ? "Unclassified activity needs context" : "No items currently need review" },
      upcoming: { status: recurring.length ? "partial" : "unknown", value: recurring.length, detail: recurring.length ? `${recurring.length} prediction${recurring.length === 1 ? "" : "s"} from recurring evidence` : "Not enough repeating history yet" },
    }, updatedAt: state.updatedAt,
  };
};
