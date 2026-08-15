import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_BYTES = 32;
const IV_BYTES = 12;
const FORMAT_VERSION = "aes-256-gcm-v1";

export class PersistenceEncryptionError extends Error {
  constructor() {
    super("PERSISTENCE_ENCRYPTION_FAILED");
    this.name = "PersistenceEncryptionError";
  }
}

export const copyPersistenceKey = (key: Uint8Array): Uint8Array => {
  if (key.byteLength !== KEY_BYTES) throw new PersistenceEncryptionError();
  return Uint8Array.from(key);
};

export const encryptJsonPayload = (value: unknown, key: Uint8Array): string => {
  try {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const plaintext = Buffer.from(JSON.stringify(value), "utf8");
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    plaintext.fill(0);
    return [
      FORMAT_VERSION,
      iv.toString("base64"),
      tag.toString("base64"),
      ciphertext.toString("base64"),
    ].join(".");
  } catch {
    throw new PersistenceEncryptionError();
  }
};

export const decryptJsonPayload = <T>(value: string, key: Uint8Array): T => {
  try {
    const [version, ivValue, tagValue, ciphertextValue, extra] = value.split(".");
    if (version !== FORMAT_VERSION || !ivValue || !tagValue || !ciphertextValue || extra) {
      throw new Error("invalid encrypted payload");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivValue, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64")),
      decipher.final(),
    ]);
    const parsed = JSON.parse(plaintext.toString("utf8")) as T;
    plaintext.fill(0);
    return parsed;
  } catch {
    throw new PersistenceEncryptionError();
  }
};
