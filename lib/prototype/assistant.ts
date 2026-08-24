import type { PrototypeView } from "@/types/prototype";

const cad = (value: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(value);
const list = (items: PrototypeView["topInflows"]) => items.length ? items.map((item) => `${item.name} (${cad(item.amount)}, ${item.date})`).join("; ") : "None recorded.";

export const answerFinancialQuestion = (question: string, view: PrototypeView) => {
  const q = question.toLowerCase().trim();
  const caveat = view.coverage.status === "complete" ? "" : ` Coverage is ${view.coverage.status}: ${view.coverage.message}`;
  if (!q) return { answer: "Ask a factual question about your recorded financial world.", grounded: true };
  if (/balance|cash.*have|how much.*cash/.test(q)) {
    const cash = view.worlds.cash.value; return { answer: cash == null ? "Your balance is Unknown because no authoritative cash balance is recorded." : `Your recorded cash balance is ${cad(cash)}. Transaction history does not replace a current statement balance.`, grounded: true };
  }
  if (/how much.*spend|spending/.test(q)) return { answer: `Recorded spending for ${view.period.label} is ${cad(view.totals.spending)}.${caveat}`, grounded: true };
  if (/top.*inflow/.test(q)) return { answer: `Top inflows: ${list(view.topInflows)}${caveat}`, grounded: true };
  if (/top.*outflow|largest.*payment/.test(q)) return { answer: `Top outflows excluding transfers and credit-card payments: ${list(view.topOutflows)}${caveat}`, grounded: true };
  if (/where.*spend|categor/.test(q)) return { answer: view.categories.length ? `Largest recorded spending categories: ${view.categories.slice(0, 3).map((c) => `${c.category} (${cad(c.amount)})`).join("; ")}.${caveat}` : `No categorized spending is available for this period.${caveat}`, grounded: true };
  if (/increase|compare|previous/.test(q)) {
    if (!view.previous) return { answer: "A previous-period comparison is Unknown because Vorvex does not have enough earlier data.", grounded: true };
    const delta = view.totals.spending - view.previous.spending; return { answer: `Spending was ${cad(Math.abs(delta))} ${delta >= 0 ? "higher" : "lower"} than the previous period (${cad(view.previous.spending)} previously).${caveat}`, grounded: true };
  }
  if (/review|uncertain/.test(q)) return { answer: view.review.length ? `${view.review.length} transaction${view.review.length === 1 ? " needs" : "s need"} review. The oldest visible item is ${view.review.at(-1)?.name}.` : "No transactions currently need review.", grounded: true };
  if (/significant|happened|movement|this month|financially/.test(q)) return { answer: `For ${view.period.label}: ${cad(view.totals.inflow)} recorded inflow, ${cad(view.totals.spending)} spending, and ${cad(view.totals.net)} net cashflow excluding transfers and card payments. Significant movements: ${list(view.significant)}${caveat}`, grounded: true };
  if (/missing|enough data|coverage|unknown/.test(q)) return { answer: `${view.coverage.message} Available transaction history runs from ${view.coverage.availableStart ?? "Unknown"} to ${view.coverage.availableEnd ?? "Unknown"}. Home and Vehicle values remain Unknown until authoritative facts are provided.`, grounded: true };
  return { answer: "I can answer factual questions about balances, spending, inflows, outflows, categories, comparisons, significant movements, coverage, and items needing review. I will not infer facts outside the recorded data.", grounded: true };
};
