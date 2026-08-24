import "server-only";
import { readFile, readdir, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { ingestTransactions } from "@/lib/transactions/ingestion";
import type { FinancialAccount } from "@/types/finance";
import type { StatementRecord } from "@/types/prototype";
import { inboxPath, quarantinePath } from "./paths";
import { loadState, saveState } from "./store";
import { parseTdCsv } from "./td-csv";

const safeName = (name: string) => path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");

export const scanInbox = async () => {
  const state = await loadState();
  const files = (await readdir(inboxPath(), { withFileTypes: true })).filter((entry) => entry.isFile() && !entry.isSymbolicLink());
  const result = { processed: 0, duplicates: 0, quarantined: 0, errors: [] as string[] };
  for (const entry of files) {
    const filename = safeName(entry.name); const sourcePath = path.join(inboxPath(), entry.name);
    try {
      if (path.extname(filename).toLowerCase() !== ".csv") throw new Error("Only TD CSV statements are currently supported.");
      const statText = await readFile(sourcePath, "utf8");
      if (Buffer.byteLength(statText) > 10 * 1024 * 1024) throw new Error("Statement exceeds the 10 MB safety limit.");
      const fileId = createHash("sha256").update(statText).digest("hex");
      if (state.statements.some((statement) => statement.id === fileId)) { result.duplicates += 1; await unlink(sourcePath); continue; }
      const importedAt = new Date().toISOString();
      const parsed = parseTdCsv(statText, filename, importedAt);
      const ledger = ingestTransactions([...state.transactions.map((transaction) => ({
        id: transaction.id, accountId: transaction.accountId, date: transaction.date, amount: transaction.amount,
        direction: transaction.direction, description: transaction.rawDescription, status: transaction.status,
        sourceRecordId: transaction.provenance.sourceRecordId, source: transaction.provenance.providerId,
        sourceKind: transaction.provenance.sourceKind, observedAt: transaction.provenance.observedAt,
        sourceUpdatedAt: transaction.provenance.sourceUpdatedAt,
      })), ...parsed.rows], { corrections: state.corrections });
      const statement: StatementRecord = { id: fileId, filename, provider: "td", accountId: parsed.accountId, accountType: parsed.accountType, importedAt, startDate: parsed.startDate, endDate: parsed.endDate, transactionCount: parsed.rows.length, duplicateCount: ledger.duplicateCount };
      const existingAccount = state.accounts.find((account) => account.id === parsed.accountId);
      if (!existingAccount) {
        const account: FinancialAccount = { id: parsed.accountId, name: parsed.accountType === "chequing" ? "TD Chequing" : "TD Credit Card", institution: "TD", balance: 0, type: parsed.accountType === "chequing" ? "asset" : "liability", group: parsed.accountType === "chequing" ? "cash" : "debts", updatedAt: importedAt };
        state.accounts.push(account);
      }
      state.transactions = [...ledger.transactions]; state.statements.push(statement); state.updatedAt = importedAt;
      await saveState(state); await unlink(sourcePath); result.processed += 1;
    } catch (error) {
      result.quarantined += 1; result.errors.push(`${filename}: ${error instanceof Error ? error.message : "Import failed."}`);
      await rename(sourcePath, path.join(quarantinePath(), `${Date.now()}-${filename}`)).catch(() => undefined);
    }
  }
  return result;
};
