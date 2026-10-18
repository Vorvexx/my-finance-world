import "server-only";
import { existsSync } from "node:fs";
import { founderRuntimePaths } from "../runtime/paths.ts";
import { loadPersistenceKey } from "../persistence/load-persistence-key.ts";
import { LocalProviderStore } from "./local-provider-store.ts";

export const withProviderStore = <T>(work: (store: LocalProviderStore) => T): T | null => {
  const key = loadPersistenceKey(); if (!key) return null; const databasePath = process.env.VORVEX_PROVIDER_DATABASE_PATH || founderRuntimePaths().providerDatabase; let store: LocalProviderStore | null = null;
  try { store = new LocalProviderStore({ databasePath, encryptionKey: key }); return work(store); } catch { return null; } finally { store?.close(); key.fill(0); }
};
export const providerStoreExists = () => existsSync(process.env.VORVEX_PROVIDER_DATABASE_PATH || founderRuntimePaths().providerDatabase);
