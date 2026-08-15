import "server-only";

import { loadCanonicalFinancialModel } from "../financial-model/load-canonical-financial-model.ts";
import { deriveHomepageView } from "./derive-homepage-view.ts";
import { loadPersistedFinancialSources } from "../persistence/load-persisted-financial-sources.ts";
import { applyReviewOutcomes } from "../review/apply-review-outcomes.ts";
import { withReviewRuntime } from "../review/review-runtime.ts";
import { applyRelationshipSemantics } from "../relationships/apply-relationship-semantics.ts";
import { withRelationshipRuntime } from "../relationships/relationship-runtime.ts";
import type { FinancialPeriodKey } from "./financial-period.ts";
import { applyDeterministicAttribution } from "../transactions/attribution.ts";

export const loadHomepageView = async ({ asOfDate, periodKey }: { asOfDate?: string; periodKey?: FinancialPeriodKey } = {}) => {
  const model = await loadCanonicalFinancialModel();
  const persisted = loadPersistedFinancialSources(model.money.accounts.map((account) => account.id));
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const evaluatedAt = new Date().toISOString();
  const attributedTransactions = persisted ? applyDeterministicAttribution(persisted.transactions) : null;
  const reviewedTransactions = attributedTransactions ? withReviewRuntime(({ store }) => applyReviewOutcomes(
    attributedTransactions, store.evaluateTransactions(attributedTransactions, evaluatedAt), evaluatedAt,
  )) ?? attributedTransactions : null;
  const relationshipReadModel = reviewedTransactions ? withRelationshipRuntime(({ store }) =>
    applyRelationshipSemantics(reviewedTransactions, store.listRelationships()))
    ?? { transactions: reviewedTransactions, suppressedActivityTransactionIds: new Set<string>() } : null;
  const corrections = relationshipReadModel
    ? withReviewRuntime(({ service }) => service.correctionsForTransactions(relationshipReadModel.transactions)) ?? new Map()
    : new Map();
  return deriveHomepageView({
    model,
    transactions: relationshipReadModel?.transactions ?? null,
    statementFacts: persisted?.statementFacts ?? null,
    imports: persisted?.imports ?? null,
    investmentSnapshots: persisted?.investmentSnapshots ?? null,
    asOfDate: asOfDate ?? localDate,
    periodKey,
    suppressedActivityTransactionIds: relationshipReadModel?.suppressedActivityTransactionIds,
    corrections,
  });
};
