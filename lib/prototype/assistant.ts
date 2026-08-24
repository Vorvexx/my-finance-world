import type { PrototypeView } from "@/types/prototype";

const cad = (value: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(value);
const list = (items: PrototypeView["topInflows"]) => items.length ? items.map((item) => `${item.name} (${cad(item.amount)}, ${item.date})`).join("; ") : "None recorded.";

export const answerFinancialQuestion = (question: string, view: PrototypeView) => {
  const q = question.toLowerCase().trim();
  const caveat = view.coverage.status === "complete" ? "" : ` Coverage is ${view.coverage.status}: ${view.coverage.message}`;
  if (!q) return { answer: "Ask a factual question about your recorded financial world.", grounded: true };
  if (/balance|cash.*have|how much.*cash/.test(q)) {
    const cash = view.worlds.cash.value; return { answer: cash == null ? "Unknown — no authoritative cash balance is recorded." : `Fact: your authoritative recorded cash balance is ${cad(cash)}. Transaction history does not replace a current balance.`, grounded: true };
  }
  if (/how much.*spend|spending/.test(q)) return { answer: `Recorded spending for ${view.period.label} is ${cad(view.totals.spending)}.${caveat}`, grounded: true };
  if (/top.*inflow|income.*came|what income/.test(q)) return { answer: `Known inflows: ${list(view.topInflows)}${caveat}`, grounded: true };
  if (/top.*outflow|largest.*payment|biggest.*expense|largest.*expense/.test(q)) return { answer: `Largest expenses excluding transfers and credit-card payments: ${list(view.topOutflows)}${caveat}`, grounded: true };
  if (/where.*spend|categor/.test(q)) return { answer: view.categories.length ? `Largest recorded spending categories: ${view.categories.slice(0, 3).map((c) => `${c.category} (${cad(c.amount)})`).join("; ")}.${caveat}` : `No categorized spending is available for this period.${caveat}`, grounded: true };
  if (/increase|compare|previous|what changed|change.*month|change.*week/.test(q)) {
    if (!view.previous) return { answer: "A previous-period comparison is Unknown because Vorvex does not have enough earlier data.", grounded: true };
    const delta = view.totals.spending - view.previous.spending; return { answer: `Spending was ${cad(Math.abs(delta))} ${delta >= 0 ? "higher" : "lower"} than the previous period (${cad(view.previous.spending)} previously).${caveat}`, grounded: true };
  }
  if (/review|uncertain/.test(q)) return { answer: view.review.length ? `${view.review.length} transaction${view.review.length === 1 ? " needs" : "s need"} review. The oldest visible item is ${view.review.at(-1)?.name}.` : "No transactions currently need review.", grounded: true };
  if (/recurring|upcoming|subscription|next/.test(q)) return { answer: view.recurring.length ? `Evidence-based inference, not a confirmed future event: ${view.recurring.slice(0, 4).map((item) => `${item.name} around ${item.nextExpectedDate} (average ${cad(item.averageAmount)}, ${item.occurrences} observations)`).join("; ")}.${caveat}` : `Unknown — there is not enough consistent repeating history to predict upcoming activity.${caveat}`, grounded: true };
  if (/investment|retirement/.test(q)) return { answer: view.worlds.investments.value == null ? "Unknown — no authoritative investment or retirement balances are recorded." : `Fact: authoritative recorded investment balances total ${cad(view.worlds.investments.value)}. Gains and performance are Unknown.`, grounded: true };
  if (/what.*owe|how much.*owe|debt|liabilit/.test(q)) return { answer: view.worlds.liabilities.value == null ? "Unknown — no authoritative outstanding liability balances are recorded." : `Fact: authoritative recorded liabilities total ${cad(view.worlds.liabilities.value)}. Payments are kept separate from Lifestyle spending.`, grounded: true };
  if (/net worth|financial position|where.*stand/.test(q)) return { answer: view.position.netWorth == null ? "Unknown — there are not enough authoritative balances to calculate your financial position." : `Calculation: known assets ${cad(view.position.assets!)} minus known liabilities ${cad(view.position.liabilities!)} equals a known financial position of ${cad(view.position.netWorth)}. Unknown assets and liabilities are excluded.`, grounded: true };
  if (/summarize|summary/.test(q)) return { answer: `Calculation for ${view.period.label}: ${cad(view.totals.inflow)} true inflow, ${cad(view.totals.spending)} true spending, and ${cad(view.totals.net)} net cashflow. ${view.position.netWorth == null ? "Overall financial position is Unknown." : `Known financial position is ${cad(view.position.netWorth)}.`} ${view.review.length} item${view.review.length === 1 ? "" : "s"} need review.${caveat}`, grounded: true };
  if (/significant|happened|movement|this month|financially/.test(q)) return { answer: `For ${view.period.label}: ${cad(view.totals.inflow)} recorded inflow, ${cad(view.totals.spending)} spending, and ${cad(view.totals.net)} net cashflow excluding transfers and card payments. Significant movements: ${list(view.significant)}${caveat}`, grounded: true };
  if (/missing|enough data|coverage|unknown/.test(q)) { const missing = Object.entries(view.worlds).filter(([, world]) => world.status === "unknown").map(([name]) => name); return { answer: `${view.coverage.message} Available transaction history runs from ${view.coverage.availableStart ?? "Unknown"} to ${view.coverage.availableEnd ?? "Unknown"}. ${missing.length ? `Still Unknown: ${missing.join(", ")}.` : "All current World summaries have authoritative values or partial evidence."}`, grounded: true }; }
  return { answer: "I can explain balances, financial position, spending, inflows, outflows, categories, comparisons, recurring predictions, significant movements, coverage, investments, and review items. I will not infer facts outside recorded evidence.", grounded: true };
};
