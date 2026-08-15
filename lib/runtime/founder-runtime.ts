import "server-only";

import { existsSync } from "node:fs";
import { LocalIngestionStore } from "../persistence/local-ingestion-store.ts";
import { LocalRelationshipStore } from "../relationships/local-relationship-store.ts";
import { FounderRelationshipService } from "../relationships/founder-relationship-service.ts";
import { StatementFolderWorker } from "../statement-folder/worker.ts";
import { validateStatementFolder } from "../statement-folder/config.ts";
import type { RuntimeHealth } from "../../types/runtime.ts";
import { appendSafeAuditEvent } from "./audit.ts";
import { loadFounderConfiguration } from "./configuration.ts";
import { readKeychainKey } from "./keychain.ts";
import { applyFounderRuntimeEnvironment } from "./paths.ts";
import { loadReviewQueue } from "../review/review-runtime.ts";
import { loadRelationshipQueue, relationshipAccounts } from "../relationships/relationship-runtime.ts";

type RuntimeState = { worker: StatementFolderWorker; ingestion: LocalIngestionStore; relationships: LocalRelationshipStore };
const globalRuntime = globalThis as typeof globalThis & { __vorvexFounderRuntime?: RuntimeState; __vorvexSignals?: boolean };

export const startFounderRuntime = async () => {
  if (globalRuntime.__vorvexFounderRuntime) return "running" as const;
  const paths = applyFounderRuntimeEnvironment();
  const configuration = loadFounderConfiguration();
  if (!configuration) return "setup-required" as const;
  const key = readKeychainKey();
  if (!key) return "blocked" as const;
  let ingestion: LocalIngestionStore | null = null;
  let relationships: LocalRelationshipStore | null = null;
  try {
    await validateStatementFolder({ folderPath: paths.statementFolder, approvedRoot: paths.statementApprovedRoot });
    ingestion = new LocalIngestionStore({ databasePath: paths.ingestionDatabase, encryptionKey: key });
    relationships = new LocalRelationshipStore({ databasePath: paths.relationshipDatabase, encryptionKey: key });
    const accountModels = configuration.accounts.map((account) => ({
      id: account.canonicalId, name: account.displayName, institution: account.institution, balance: 0,
      updatedAt: configuration.provisionedAt,
      type: account.accountType === "chequing" ? "asset" as const : "liability" as const,
      group: account.accountType === "chequing" ? "cash" as const : "debts" as const,
    }));
    const relationshipService = new FounderRelationshipService(relationships, key);
    const worker = new StatementFolderWorker({
      config: { folderPath: paths.statementFolder, approvedRoot: paths.statementApprovedRoot },
      store: ingestion, accountMappings: configuration.mappings,
      relationshipProcessor: {
        evaluate: (transactions, evaluatedAt) => relationshipService.sync(transactions, relationshipAccounts(accountModels), evaluatedAt),
      },
    });
    await worker.start();
    globalRuntime.__vorvexFounderRuntime = { worker, ingestion, relationships };
    appendSafeAuditEvent({ at: new Date().toISOString(), event: "runtime-started", authority: "runtime", source: "local-runtime", reason: "Validated Founder runtime started." });
    if (!globalRuntime.__vorvexSignals) {
      globalRuntime.__vorvexSignals = true;
      const shutdown = () => { void stopFounderRuntime(); };
      process.once("SIGTERM", shutdown);
      process.once("SIGINT", shutdown);
    }
    return "running" as const;
  } catch {
    ingestion?.close(); relationships?.close();
    return "blocked" as const;
  } finally { key.fill(0); }
};

export const stopFounderRuntime = async () => {
  const active = globalRuntime.__vorvexFounderRuntime;
  if (!active) return;
  delete globalRuntime.__vorvexFounderRuntime;
  await active.worker.stop();
  active.ingestion.close();
  active.relationships.close();
  appendSafeAuditEvent({ at: new Date().toISOString(), event: "runtime-stopped", authority: "runtime", source: "local-runtime", reason: "Founder runtime stopped cleanly." });
};

export const scanFounderStatements = async () => {
  const status = await startFounderRuntime();
  if (status !== "running" || !globalRuntime.__vorvexFounderRuntime) throw new Error("RUNTIME_UNAVAILABLE");
  return globalRuntime.__vorvexFounderRuntime.worker.scanNow();
};

export const loadRuntimeHealth = async (): Promise<RuntimeHealth> => {
  const paths = applyFounderRuntimeEnvironment();
  const configuration = loadFounderConfiguration();
  if (!configuration) return { status: "setup-required", worker: "stopped", encryption: "missing", databases: "unavailable", statementFolder: "unavailable", reviewBacklog: null, relationshipBacklog: null, safeMessage: "Complete local setup to connect Vorvex." };
  const key = readKeychainKey();
  if (!key) return { status: "blocked", worker: "stopped", encryption: "missing", databases: "unavailable", statementFolder: "unavailable", reviewBacklog: null, relationshipBacklog: null, safeMessage: "The protected encryption key is unavailable. Existing data was not opened and no replacement key was created." };
  key.fill(0);
  const runtime = await startFounderRuntime();
  const databases = [paths.ingestionDatabase, paths.reviewDatabase, paths.relationshipDatabase].every(existsSync);
  let folderHealthy = true;
  try { await validateStatementFolder({ folderPath: paths.statementFolder, approvedRoot: paths.statementApprovedRoot }); } catch { folderHealthy = false; }
  const review = loadReviewQueue();
  const relationship = loadRelationshipQueue();
  return {
    status: runtime === "running" && databases && folderHealthy ? "ready" : "blocked",
    worker: runtime === "running" ? "running" : "stopped", encryption: "available",
    databases: databases ? "healthy" : "unavailable", statementFolder: folderHealthy ? "healthy" : "unavailable",
    reviewBacklog: review.status === "available" ? review.items.length : null,
    relationshipBacklog: relationship.status === "available" ? relationship.items.length : null,
    safeMessage: runtime === "running" && databases && folderHealthy ? "Vorvex is ready and watching for supported statements." : "Vorvex is blocked because a required local resource is unavailable.",
  };
};
