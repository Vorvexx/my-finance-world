import "server-only";

import { existsSync } from "node:fs";
import path from "node:path";
import { loadPersistenceKey } from "../persistence/load-persistence-key.ts";
import { FounderReviewService } from "./founder-review-service.ts";
import { LocalReviewLearningStore } from "./local-review-learning-store.ts";
import type { CanonicalTransaction } from "../../types/transactions.ts";

export const withReviewRuntime = <T>(work: (runtime: { store: LocalReviewLearningStore; service: FounderReviewService }) => T): T | null => {
  const configuredPath = process.env.VORVEX_REVIEW_DATABASE_PATH;
  if (!configuredPath) return null;
  const databasePath = path.resolve(configuredPath);
  const key = loadPersistenceKey();
  if (!key) return null;
  let store: LocalReviewLearningStore | null = null;
  try {
    if (!existsSync(databasePath)) return null;
    store = new LocalReviewLearningStore({ databasePath, encryptionKey: key });
    return work({ store, service: new FounderReviewService(store, key) });
  } catch { return null; }
  finally { store?.close(); key.fill(0); }
};

export const loadReviewQueue = (transactions: readonly CanonicalTransaction[] = [], accountNames: ReadonlyMap<string, string> = new Map()) => withReviewRuntime(({ service }) => service.listPending(new Date(), transactions, accountNames)) ?? {
  status: "unavailable" as const, items: [] as const,
  message: "Review is not connected on this device.",
};
