import "server-only";

import { existsSync } from "node:fs";
import path from "node:path";
import type { FinancialAccount } from "../../types/finance.ts";
import type { RelationshipAccount } from "../../types/relationships.ts";
import { loadPersistenceKey } from "../persistence/load-persistence-key.ts";
import { FounderRelationshipService } from "./founder-relationship-service.ts";
import { LocalRelationshipStore } from "./local-relationship-store.ts";

export const relationshipAccounts = (accounts: readonly FinancialAccount[]): readonly RelationshipAccount[] => accounts.map((account) => ({
  id: account.id, ownerId: "primary-person", type: account.type, group: account.group,
}));

export const withRelationshipRuntime = <T>(work: (runtime: { store: LocalRelationshipStore; service: FounderRelationshipService }) => T): T | null => {
  const configuredPath = process.env.VORVEX_RELATIONSHIP_DATABASE_PATH;
  if (!configuredPath) return null;
  const databasePath = path.resolve(configuredPath);
  const key = loadPersistenceKey();
  if (!key) return null;
  let store: LocalRelationshipStore | null = null;
  try {
    if (!existsSync(databasePath)) return null;
    store = new LocalRelationshipStore({ databasePath, encryptionKey: key });
    return work({ store, service: new FounderRelationshipService(store, key) });
  } catch { return null; }
  finally { store?.close(); key.fill(0); }
};

export const loadRelationshipQueue = () => withRelationshipRuntime(({ service }) => service.listPending())
  ?? { status: "unavailable" as const, items: [] as const, message: "Relationship review is not connected on this device." };
