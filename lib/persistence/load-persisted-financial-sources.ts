import "server-only";

import { existsSync } from "node:fs";
import path from "node:path";
import type { CanonicalStatementFacts } from "../../types/imports.ts";
import type { ImportJournalRecord } from "../../types/imports.ts";
import type { CanonicalInvestmentSnapshot } from "../../types/investments.ts";
import type { CanonicalTransaction } from "../../types/transactions.ts";
import { loadPersistenceKey } from "./load-persistence-key.ts";
import { LocalIngestionStore } from "./local-ingestion-store.ts";

export type PersistedFinancialSources = {
  transactions: readonly CanonicalTransaction[];
  statementFacts: readonly CanonicalStatementFacts[];
  imports: readonly ImportJournalRecord[];
  investmentSnapshots: readonly CanonicalInvestmentSnapshot[];
};

export const loadPersistedFinancialSources = (accountIds: readonly string[]): PersistedFinancialSources | null => {
  const configuredPath = process.env.VORVEX_INGESTION_DATABASE_PATH;
  if (!configuredPath) return null;
  const databasePath = path.resolve(configuredPath);
  if (!existsSync(databasePath)) return null;
  let key: Buffer | null = null;
  let store: LocalIngestionStore | null = null;
  try {
    key = loadPersistenceKey();
    if (!key) return null;
    store = new LocalIngestionStore({ databasePath, encryptionKey: key });
    return {
      transactions: accountIds.flatMap((accountId) => store!.getTransactionsByAccount(accountId)),
      statementFacts: accountIds.flatMap((accountId) => store!.getStatementFactsByAccount(accountId)),
      imports: store.getImportHistory().filter((record) => record.status === "committed"),
      investmentSnapshots: accountIds.flatMap((accountId) => store!.getInvestmentSnapshots(accountId)),
    };
  } catch { return null; }
  finally { store?.close(); key?.fill(0); }
};
