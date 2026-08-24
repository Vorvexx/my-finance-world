import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import type { PrototypeState } from "@/types/prototype";

const aad = Buffer.from("vorvex-founder-backup-v1");
export const createBackup = (state: PrototypeState, passphrase: string) => {
  if (passphrase.length < 12) throw new Error("Backup passphrase must contain at least 12 characters.");
  const salt = randomBytes(16); const iv = randomBytes(12); const key = scryptSync(passphrase, salt, 32);
  const cipher = createCipheriv("aes-256-gcm", key, iv); cipher.setAAD(aad);
  const data = Buffer.concat([cipher.update(JSON.stringify(state), "utf8"), cipher.final()]);
  return Buffer.from(JSON.stringify({ format: "vorvex-backup", version: 1, stateVersion: state.version, createdAt: new Date().toISOString(), salt: salt.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") }));
};

export const readBackup = (backup: Buffer, passphrase: string): PrototypeState => {
  if (backup.byteLength > 25 * 1024 * 1024) throw new Error("Backup exceeds the 25 MB safety limit.");
  const payload = JSON.parse(backup.toString("utf8")) as Record<string, unknown>;
  if (payload.format !== "vorvex-backup" || payload.version !== 1 || typeof payload.salt !== "string" || typeof payload.iv !== "string" || typeof payload.tag !== "string" || typeof payload.data !== "string") throw new Error("Unsupported or malformed Vorvex backup.");
  const decipher = createDecipheriv("aes-256-gcm", scryptSync(passphrase, Buffer.from(payload.salt, "base64"), 32), Buffer.from(payload.iv, "base64")); decipher.setAAD(aad); decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const state = JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload.data, "base64")), decipher.final()]).toString("utf8")) as PrototypeState;
  if (state.version !== 4 || !Array.isArray(state.transactions) || !Array.isArray(state.facts) || !Array.isArray(state.statements)) throw new Error("Backup state version is not compatible with this Vorvex build.");
  return state;
};
