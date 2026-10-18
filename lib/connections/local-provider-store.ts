import { chmodSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { copyPersistenceKey, decryptJsonPayload, encryptJsonPayload } from "../persistence/field-encryption.ts";
import type { FinancialProviderConnection, PublicProviderConnection } from "../../types/financial-provider.ts";

export class LocalProviderStore {
  #database: DatabaseSync; #key: Uint8Array;
  constructor({ databasePath, encryptionKey }: { databasePath: string; encryptionKey: Uint8Array }) {
    this.#key = copyPersistenceKey(encryptionKey); mkdirSync(path.dirname(databasePath), { recursive: true, mode: 0o700 });
    this.#database = new DatabaseSync(databasePath); this.#database.exec("CREATE TABLE IF NOT EXISTS provider_connections (connection_id TEXT PRIMARY KEY, provider TEXT NOT NULL, status TEXT NOT NULL, encrypted_payload TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)");
    if (databasePath !== ":memory:") chmodSync(databasePath, 0o600);
  }
  close() { this.#database.close(); this.#key.fill(0); }
  permissions(databasePath: string) { return statSync(databasePath).mode & 0o777; }
  save(connection: Omit<FinancialProviderConnection, "id"> & { id?: string }) {
    const now = new Date().toISOString(); const id = connection.id?.trim() || `provider-connection:${randomUUID()}`; const payload = { ...connection, id } as FinancialProviderConnection;
    this.#database.prepare("INSERT INTO provider_connections VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(connection_id) DO UPDATE SET status=excluded.status, encrypted_payload=excluded.encrypted_payload, updated_at=excluded.updated_at")
      .run(id, payload.provider, payload.status, encryptJsonPayload(payload, this.#key), now, now); return payload;
  }
  list(): FinancialProviderConnection[] { return (this.#database.prepare("SELECT encrypted_payload FROM provider_connections ORDER BY created_at").all() as Array<{ encrypted_payload: string }>).map((row) => decryptJsonPayload<FinancialProviderConnection>(row.encrypted_payload, this.#key)); }
  get(id: string) { return this.list().find((item) => item.id === id) ?? null; }
  remove(id: string) { this.#database.prepare("DELETE FROM provider_connections WHERE connection_id = ?").run(id); }
  publicList(): PublicProviderConnection[] { return this.list().map((stored) => { const accounts = stored.accounts.map((storedAccount, index) => { const account = { ...storedAccount }; delete (account as Partial<typeof account>).providerAccountId; return { ...account, viewKey: `account-${index + 1}` }; }); const connection = { id: stored.id, provider: stored.provider, institution: stored.institution, status: stored.status, lastSuccessfulSync: stored.lastSuccessfulSync, balanceAsOf: stored.balanceAsOf, transactionSyncAt: stored.transactionSyncAt, errorCode: stored.errorCode, accounts }; const transactions = stored.transactions; return { ...connection, transactionCount: transactions.length, pendingTransactionCount: transactions.filter((item) => item.pending).length, transactionStart: transactions.map((item) => item.date).sort()[0] ?? null, transactionEnd: transactions.map((item) => item.date).sort().at(-1) ?? null }; }); }
}
