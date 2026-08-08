import type {
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
    category: "Unclassified",
    method: "unclassified",
    ruleId: null,
    confidence: null,
    correctedAt: null,
  };
};
