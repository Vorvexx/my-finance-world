import "server-only";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import path from "node:path";
import type { PrototypeState } from "@/types/prototype";
import { dataRoot, inboxPath, keyPath, quarantinePath, statePath } from "./paths";

const emptyState = (): PrototypeState => ({
  version: 4,
  person: { id: "primary-person", name: null },
  accounts: [], transactions: [], corrections: [], statements: [], facts: [], updatedAt: null,
});

const ensureRuntime = async () => {
  await Promise.all([
    mkdir(dataRoot(), { recursive: true, mode: 0o700 }),
    mkdir(inboxPath(), { recursive: true, mode: 0o700 }),
    mkdir(quarantinePath(), { recursive: true, mode: 0o700 }),
  ]);
};

const loadKey = async () => {
  await ensureRuntime();
  try { return await readFile(keyPath()); } catch {
    const key = randomBytes(32);
    await writeFile(keyPath(), key, { mode: 0o600, flag: "wx" });
    await chmod(keyPath(), 0o600);
    return key;
  }
};

export const loadState = async (): Promise<PrototypeState> => {
  await ensureRuntime();
  try {
    const payload = JSON.parse(await readFile(statePath(), "utf8")) as { iv: string; tag: string; data: string };
    const decipher = createDecipheriv("aes-256-gcm", await loadKey(), Buffer.from(payload.iv, "base64"));
    decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
    const plain = Buffer.concat([decipher.update(Buffer.from(payload.data, "base64")), decipher.final()]);
    const state = JSON.parse(plain.toString("utf8")) as Omit<PrototypeState, "version"> & { version: number };
    if (![1, 2, 3, 4].includes(state.version) || !Array.isArray(state.transactions) || !Array.isArray(state.statements)) throw new Error("Unsupported state schema.");
    let changed = false;
    if (state.version < 3) {
      state.accounts = state.accounts.map((account) => ({ ...account, balanceKnown: account.balanceKnown ?? false }));
      changed = true;
    }
    if (state.version < 4) {
      state.version = 4;
      state.facts = [];
      state.statements = state.statements.map((statement) => ({ ...statement, balanceCaptured: false }));
      changed = true;
    }
    const creditAccounts = new Set(state.statements.filter((statement) => statement.accountType === "credit-card").map((statement) => statement.accountId));
    state.transactions = state.transactions.map((transaction) => {
      const payment = (creditAccounts.has(transaction.accountId) && transaction.direction === "inflow") || /(?:PAYMENT.*(?:VISA|MASTERCARD|AMEX)|(?:VISA|MASTERCARD|AMEX).*PAYMENT)/.test(transaction.rawDescription.toUpperCase());
      if (!payment || transaction.financialRole === "credit-card-payment") return transaction;
      changed = true; return { ...transaction, financialRole: "credit-card-payment" as const };
    });
    if (changed) await saveState(state as PrototypeState);
    return state as PrototypeState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyState();
    throw error;
  }
};

export const saveState = async (state: PrototypeState) => {
  await ensureRuntime();
  const key = await loadKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(state), "utf8"), cipher.final()]);
  const payload = JSON.stringify({ iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: encrypted.toString("base64") });
  const temporary = path.join(dataRoot(), `state.${process.pid}.tmp`);
  await writeFile(temporary, payload, { mode: 0o600 });
  await rename(temporary, statePath());
  await chmod(statePath(), 0o600);
};
