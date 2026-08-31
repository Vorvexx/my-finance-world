import "server-only";

import { loadCanonicalFinancialData } from "../financial-model/load-canonical-financial-data.ts";
import { deriveHomepageView } from "./derive-homepage-view.ts";
import type { FinancialPeriodKey } from "./financial-period.ts";

export const loadHomepageView = async ({ asOfDate, periodKey, periodAnchor, customStart, customEnd }: { asOfDate?: string; periodKey?: FinancialPeriodKey; periodAnchor?: string; customStart?: string; customEnd?: string } = {}) => {
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const data = await loadCanonicalFinancialData();
  return deriveHomepageView({
    model: data.model,
    transactions: data.transactions,
    statementFacts: data.statementFacts,
    chequingStatementFacts: data.chequingStatementFacts,
    imports: data.imports,
    investmentSnapshots: data.investmentSnapshots,
    asOfDate: asOfDate ?? localDate,
    periodKey,
    periodAnchor,
    customStart,
    customEnd,
    suppressedActivityTransactionIds: data.suppressedActivityTransactionIds,
    corrections: data.corrections,
    deferredReviewTransactionIds: data.intentionallyDeferredTransactionIds,
    genuinelyUnknownTransactionIds: data.genuinelyUnknownTransactionIds,
  });
};
