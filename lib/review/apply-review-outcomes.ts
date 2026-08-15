import type { ClassificationOutcome } from "../../types/review.ts";
import type { CanonicalTransaction } from "../../types/transactions.ts";

export const applyReviewOutcomes = (
  transactions: readonly CanonicalTransaction[], outcomes: readonly ClassificationOutcome[], evaluatedAt: string,
): readonly CanonicalTransaction[] => transactions.map((transaction, index) => {
  const outcome = outcomes[index];
  if (!outcome || outcome.method === "unknown" || outcome.method === "deterministic-engineering-rule") return transaction;
  return {
    ...transaction,
    financialMeaning: outcome.financialMeaning ?? transaction.financialMeaning,
    attribution: {
      ...transaction.attribution,
      category: outcome.category ?? transaction.attribution.category,
      world: outcome.world ?? transaction.attribution.world,
      method: "user-correction",
      ruleId: null,
      confidence: outcome.confidence,
      correctedAt: evaluatedAt,
    },
  };
});
