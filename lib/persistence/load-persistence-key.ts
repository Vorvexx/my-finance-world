import "server-only";

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { readKeychainKey } from "../runtime/keychain.ts";
import { founderRuntimePaths } from "../runtime/paths.ts";

export const loadPersistenceKey = () => {
  const keychainKey = readKeychainKey();
  if (keychainKey) return keychainKey;
  if (existsSync(founderRuntimePaths().configFile)) return null;
  const keyPath = process.env.VORVEX_INGESTION_KEY_PATH;
  const encoded = keyPath ? readFileSync(path.resolve(keyPath), "utf8").trim() : process.env.VORVEX_INGESTION_KEY_BASE64;
  if (!encoded) return null;
  const key = Buffer.from(encoded, "base64");
  if (key.byteLength === 32) return key;
  key.fill(0);
  return null;
};
