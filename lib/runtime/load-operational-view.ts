import "server-only";

import { existsSync } from "node:fs";
import type { OperationalView, SafeImportTimelineItem } from "../../types/operations.ts";
import { LocalIngestionStore } from "../persistence/local-ingestion-store.ts";
import { loadPersistenceKey } from "../persistence/load-persistence-key.ts";
import { loadFounderConfiguration } from "./configuration.ts";
import { applyFounderRuntimeEnvironment } from "./paths.ts";
import { withReviewRuntime } from "../review/review-runtime.ts";
import { withRelationshipRuntime } from "../relationships/relationship-runtime.ts";

const sourceLabel = (type: string | null): SafeImportTimelineItem["source"] => type === "chequing" ? "TD Chequing" : type === "credit-card" ? "TD Credit Card" : "Unknown statement";
const safeExplanation = (code: string | null) => {
  if (!code) return "The statement was not imported.";
  if (code.includes("MAPPING") || code.includes("ACCOUNT")) return "The configured account needs attention before this statement can be imported.";
  if (code.includes("UNSUPPORTED") || code === "UNSUPPORTED_FILE") return "This file is not a supported TD Chequing or TD Credit Card statement.";
  if (code.includes("PDF") || code.includes("PARSE") || code.includes("RECONCIL")) return "Vorvex could not safely understand and reconcile this statement.";
  if (code.includes("SOURCE") || code.includes("DELETE")) return "The financial data is safe, but the source file needs attention.";
  if (code.includes("RELATIONSHIP")) return "The statement imported, but related activity requires attention.";
  return "Vorvex stopped safely without changing previously imported financial data.";
};

export const loadOperationalView = (): OperationalView => {
  const empty: OperationalView = { coverage: { status: "Unknown", oldestTransaction: null, newestTransaction: null, gapCount: null, explanation: "Statement coverage has not been established." }, imports: [], knowledge: [], summary: { imported: 0, alreadyProcessed: 0, needsReview: 0, failed: 0 } };
  const configuration = loadFounderConfiguration();
  const paths = applyFounderRuntimeEnvironment();
  const key = loadPersistenceKey();
  if (!configuration || !key || !existsSync(paths.ingestionDatabase)) { key?.fill(0); return empty; }
  let store: LocalIngestionStore | null = null;
  try {
    store = new LocalIngestionStore({ databasePath: paths.ingestionDatabase, encryptionKey: key });
    const transactions = configuration.accounts.flatMap((account) => store!.getTransactionsByAccount(account.canonicalId));
    const dates = transactions.map((item) => item.transactionDate).sort();
    const imports = store.getStatementFolderResults().filter((item) => item.status !== "processing").slice(0, 12).flatMap((item): SafeImportTimelineItem[] => {
      const common = { at: item.processedAt, source: sourceLabel(item.accountType), transactionCount: item.transactionCount };
      if (item.status === "imported") return [
        { ...common, outcome: "Imported", explanation: "Canonical receipt committed and reconciled." },
        { ...common, outcome: "Source removed", explanation: "The source PDF was removed after its protected receipt was committed." },
      ];
      const outcome = item.status === "duplicate" ? "Already processed" : item.status === "needs-attention" ? "Needs Review" : item.status === "unsupported" ? "Unsupported" : item.status === "rejected" ? "Rejected" : "Failed";
      return [{ ...common, outcome, explanation: safeExplanation(item.safeReasonCode) }];
    });
    const reviewKnowledge = withReviewRuntime(({ store: reviewStore }) => [
      ...reviewStore.listReviewItems(null).filter((item) => item.status !== "pending").map((item) => ({ at: item.updatedAt, kind: "Review decision", explanation: item.status === "ignored" ? "Founder ignored a review item." : "Founder resolved a review item." })),
      ...reviewStore.listRules().map((rule) => ({ at: rule.createdAt, kind: "Learned rule", explanation: rule.source === "user-confirmed-learned" ? "A Founder-confirmed classification created a reusable rule." : "A Founder-created rule was recorded." })),
    ]) ?? [];
    const relationshipKnowledge = withRelationshipRuntime(({ store: relationshipStore }) => [
      ...relationshipStore.listRelationships().map((item) => ({ at: item.createdAt, kind: "Relationship", explanation: item.confirmation === "founder-confirmed" ? "Founder confirmed a transaction relationship." : "A prior Founder-confirmed deterministic rule was reused." })),
      ...relationshipStore.listCandidates(null).filter((item) => item.status !== "pending").map((item) => ({ at: item.updatedAt, kind: "Relationship review", explanation: `Founder recorded a ${item.status} relationship decision.` })),
    ]) ?? [];
    return {
      coverage: dates.length ? { status: "Partial", oldestTransaction: dates[0], newestTransaction: dates.at(-1)!, gapCount: null, explanation: "Imported transaction dates are known; complete statement history has not been confirmed." } : empty.coverage,
      imports,
      summary: {
        imported: imports.filter((item) => item.outcome === "Imported").length,
        alreadyProcessed: imports.filter((item) => item.outcome === "Already processed").length,
        needsReview: imports.filter((item) => item.outcome === "Needs Review").length,
        failed: imports.filter((item) => item.outcome === "Rejected" || item.outcome === "Unsupported" || item.outcome === "Failed").length,
      },
      knowledge: [
        ...imports.map((item) => ({ at: item.at, kind: item.outcome, explanation: `${item.source}: ${item.explanation}` })),
        ...reviewKnowledge,
        ...relationshipKnowledge,
      ].sort((left, right) => right.at.localeCompare(left.at)).slice(0, 20),
    };
  } catch { return empty; }
  finally { store?.close(); key.fill(0); }
};
