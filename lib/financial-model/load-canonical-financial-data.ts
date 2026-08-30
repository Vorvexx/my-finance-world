import "server-only";

import { loadPersistedFinancialSources } from "../persistence/load-persisted-financial-sources.ts";
import { applyRelationshipSemantics } from "../relationships/apply-relationship-semantics.ts";
import { withRelationshipRuntime } from "../relationships/relationship-runtime.ts";
import { applyReviewOutcomes } from "../review/apply-review-outcomes.ts";
import { withReviewRuntime } from "../review/review-runtime.ts";
import { applyDeterministicAttribution } from "../transactions/attribution.ts";
import { loadCanonicalFinancialModel } from "./load-canonical-financial-model.ts";

export const loadCanonicalFinancialData = async (evaluatedAt = new Date()) => {
  const model = await loadCanonicalFinancialModel();
  const persisted = loadPersistedFinancialSources(model.money.accounts.map((account) => account.id));
  const attributed = persisted ? applyDeterministicAttribution(persisted.transactions) : null;
  const reviewed = attributed ? withReviewRuntime(({ store }) => applyReviewOutcomes(
    attributed, store.evaluateTransactions(attributed, evaluatedAt.toISOString()), evaluatedAt.toISOString(),
  )) ?? attributed : null;
  const relationships = reviewed ? withRelationshipRuntime(({ store }) =>
    applyRelationshipSemantics(reviewed, store.listRelationships()))
    ?? { transactions: reviewed, suppressedActivityTransactionIds: new Set<string>() } : null;
  const review = relationships ? withReviewRuntime(({ service }) => ({
    corrections: service.correctionsForTransactions(relationships.transactions),
    understanding: service.understandingState(evaluatedAt, relationships.transactions),
  })) : null;
  const reviewCounts = relationships ? withReviewRuntime(({ store }) => store.auditCounts()) ?? null : null;
  return {
    model,
    transactions: relationships?.transactions ?? null,
    visibleTransactions: relationships?.transactions.filter((transaction) => !relationships.suppressedActivityTransactionIds.has(transaction.id)) ?? null,
    statementFacts: persisted?.statementFacts ?? null,
    imports: persisted?.imports ?? null,
    investmentSnapshots: persisted?.investmentSnapshots ?? null,
    suppressedActivityTransactionIds: relationships?.suppressedActivityTransactionIds ?? new Set<string>(),
    corrections: review?.corrections ?? new Map(),
    genuinelyUnknownTransactionIds: review?.understanding.genuinelyUnknownTransactionIds,
    intentionallyDeferredTransactionIds: review?.understanding.intentionallyDeferredTransactionIds ?? new Set<string>(),
    accountNames: new Map(model.money.accounts.map((account) => [account.id, account.name])),
    reviewCounts,
  };
};
