import type {
  CanonicalTransaction,
  TransactionAttribution,
  TransactionCorrection,
  WorldAttributionRule,
} from "../../types/transactions.ts";

export const defaultWorldAttributionRules: readonly WorldAttributionRule[] = [
  { id: "home-mortgage", pattern: /\bmortgage\b/i, world: "home", category: "Mortgage", confidence: 1 },
  { id: "home-hydro", pattern: /\b(hydro|electric|utility)\b/i, world: "home", category: "Utilities", confidence: 0.95 },
  { id: "vehicle-fuel", pattern: /\b(fuel|gas station|petro|shell|esso)\b/i, world: "vehicle", category: "Fuel", confidence: 0.9 },
  { id: "income-salary", pattern: /\b(salary|payroll|pay deposit)\b/i, world: "income", category: "Salary", confidence: 0.98 },
  { id: "investment-contribution", pattern: /\b(investment contribution|tfsa contribution|rrsp contribution)\b/i, world: "investments", category: "Contribution", confidence: 0.98 },
  { id: "investment-td-registered-contribution", pattern: /\bTD\s+MHA\s+PPP\s+(?:TFS|RSP)\b/i, world: "investments", category: "Contribution", confidence: 0.99 },
  { id: "lifestyle-groceries", pattern: /\b(grocery|groceries|supermarket)\b/i, world: "cash", category: "Groceries", confidence: 0.95 },
  { id: "lifestyle-dining", pattern: /\b(restaurant|cafe|coffee shop|dining)\b/i, world: "cash", category: "Dining", confidence: 0.92 },
  { id: "lifestyle-telecom", pattern: /\b(telecom|internet|mobile phone|wireless)\b/i, world: "cash", category: "Telecom", confidence: 0.95 },
  { id: "vehicle-transit", pattern: /\b(parking|public transit|toll)\b/i, world: "vehicle", category: "Transit", confidence: 0.92 },
  { id: "home-insurance", pattern: /\b(home insurance|property insurance)\b/i, world: "home", category: "Insurance", confidence: 0.96 },
  { id: "insurance-provider", pattern: /\b(?:SECURITY NATIONAL INSUR|INSURANCE)\b/i, world: "home", category: "Insurance", confidence: 0.95 },
  { id: "lifestyle-coffee-dining", pattern: /\b(?:TIM HORTONS|STARBUCKS|MCDONALD'?S|WENDY'?S|SUBWAY|DOMINO'?S|KFC|SWISS CHALET|UBER\*?\s*EATS|UBEREATS|RESTAURANT|CAFE|COFFEE SHOP|DINING|ROADHOUSE|GASTROPUB|TAKEOUT)\b/i, world: "cash", category: "Dining", confidence: 0.96 },
  { id: "lifestyle-grocery-merchants", pattern: /\b(?:WHOLE FOODS|FOOD CENTRE|GROCERY|GROCERS|SUPERMARKET|TOWN & COUNTRY MARKET|SUBZI MANDI)\b/i, world: "cash", category: "Groceries", confidence: 0.96 },
  { id: "lifestyle-convenience", pattern: /\b(?:CIRCLE K|MACS CONV)\b/i, world: "cash", category: "Convenience", confidence: 0.94 },
  { id: "lifestyle-alcohol", pattern: /\b(?:LCBO|RAO #)\b/i, world: "cash", category: "Alcohol", confidence: 0.98 },
  { id: "lifestyle-cannabis", pattern: /\b(?:CANNABIS|CANNA CABANA|HUNNY POT)\b/i, world: "cash", category: "Cannabis", confidence: 0.98 },
  { id: "lifestyle-telecom-provider", pattern: /\b(?:ROGERS|BELL CANADA)\b/i, world: "cash", category: "Telecom", confidence: 0.96 },
  { id: "lifestyle-fuel-provider", pattern: /\b(?:ESSO|PETRO-CANADA|GAS STATION)\b/i, world: "vehicle", category: "Fuel", confidence: 0.97 },
  { id: "lifestyle-travel", pattern: /\b(?:DELTA AIR|AIR FRANCE|AIRBNB|HILTON HOTELS|KIWI\.COM|TRAVELGO)\b/i, world: "cash", category: "Travel", confidence: 0.96 },
  { id: "lifestyle-subscription", pattern: /\b(?:AMAZON\.CA PRIME MEMBER|NETFLIX|SPOTIFY)\b/i, world: "cash", category: "Subscriptions", confidence: 0.98 },
  { id: "home-alectra", pattern: /\bALECTRA\b/i, world: "home", category: "Utilities", confidence: 0.98 },
];

export const attributeTransaction = ({
  transactionId,
  description,
  normalizedCounterparty,
  corrections = [],
  rules = defaultWorldAttributionRules,
}: {
  transactionId: string;
  description: string;
  normalizedCounterparty: string;
  corrections?: readonly TransactionCorrection[];
  rules?: readonly WorldAttributionRule[];
}): TransactionAttribution => {
  const correction = corrections.find((item) => item.transactionId === transactionId);
  if (correction) {
    return {
      world: correction.world,
      category: correction.category,
      method: "user-correction",
      ruleId: null,
      confidence: 1,
      correctedAt: correction.correctedAt,
    };
  }

  const subject = `${description} ${normalizedCounterparty}`;
  const rule = rules.find((candidate) => candidate.pattern.test(subject));
  if (rule) {
    return {
      world: rule.world,
      category: rule.category,
      method: "deterministic-rule",
      ruleId: rule.id,
      confidence: rule.confidence,
      correctedAt: null,
    };
  }

  return {
    world: null,
    category: null,
    method: "unclassified",
    ruleId: null,
    confidence: null,
    correctedAt: null,
  };
};

export const applyDeterministicAttribution = (
  transactions: readonly CanonicalTransaction[],
): readonly CanonicalTransaction[] => transactions.map((transaction) => {
  const subject = `${transaction.rawDescription} ${transaction.normalizedCounterparty}`;
  const financialMeaning = transaction.financialMeaning !== "unknown" ? transaction.financialMeaning
    : transaction.direction === "outflow" && /\bTD\s+(?:VISA|MASTERCARD).*\b(?:PYMT|PAYMENT)\b/i.test(subject) ? "credit-card-payment"
    : transaction.direction === "outflow" && /\bTD\s+MHA\s+PPP\s+(?:TFS|RSP)\b/i.test(subject) ? "transfer"
    : transaction.direction === "outflow" && /\b(?:ROGERS|BELL CANADA|ALECTRA|HYDRO|UTILITY)\b/i.test(subject) ? "expense"
    : transaction.direction === "outflow" && /\b(?:ATM|CASH)\s+(?:W\/D|WITHDRAW)\b/i.test(subject) ? "cash-withdrawal"
    : transaction.financialMeaning;
  if (transaction.attribution.method !== "unclassified") return financialMeaning === transaction.financialMeaning ? transaction : { ...transaction, financialMeaning };
  const attribution = attributeTransaction({
    transactionId: transaction.id,
    description: transaction.rawDescription,
    normalizedCounterparty: transaction.normalizedCounterparty,
  });
  return attribution.method === "unclassified" && financialMeaning === transaction.financialMeaning
    ? transaction : { ...transaction, financialMeaning, attribution };
});
