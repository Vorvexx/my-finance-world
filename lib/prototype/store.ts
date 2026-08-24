import "server-only";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import path from "node:path";
import type { PrototypeState } from "@/types/prototype";
import { dataRoot, inboxPath, keyPath, quarantinePath, statePath } from "./paths";

const emptyState = (): PrototypeState => ({
  version: 1,
  person: { id: "primary-person", name: null },
  accounts: [], transactions: [], corrections: [], statements: [], updatedAt: null,
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
    const state = JSON.parse(plain.toString("utf8")) as PrototypeState;
    if (state.version !== 1 || !Array.isArray(state.transactions) || !Array.isArray(state.statements)) throw new Error("Unsupported state schema.");
    return state;
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
