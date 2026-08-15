import { spawnSync } from "node:child_process";
import { founderRuntimePaths } from "./paths.ts";

export const VORVEX_KEYCHAIN_SERVICE = "com.vorvex.founder-v1.persistence";
export const VORVEX_KEYCHAIN_ACCOUNT = "local-encryption-key";

type CommandResult = { status: number | null; stdout: string };
type CommandRunner = (command: string, args: readonly string[]) => CommandResult;
const systemRunner: CommandRunner = (command, args) => {
  const result = spawnSync(command, [...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return { status: result.status, stdout: result.stdout ?? "" };
};
const helperPath = () => process.env.VORVEX_KEYCHAIN_HELPER || `${founderRuntimePaths().runtime}/keychain-helper`;

export const readKeychainKey = (run: CommandRunner = systemRunner): Buffer | null => {
  if (process.platform !== "darwin") return null;
  const result = run(helperPath(), ["get"]);
  if (result.status !== 0) return null;
  const key = Buffer.from(result.stdout.trim(), "base64");
  if (key.byteLength === 32) return key;
  key.fill(0);
  return null;
};

export const createKeychainKey = (run: CommandRunner = systemRunner): Buffer => {
  if (process.platform !== "darwin") throw new Error("KEYCHAIN_UNAVAILABLE");
  const result = run(helperPath(), ["get-or-create"]);
  if (result.status !== 0) throw new Error("KEYCHAIN_WRITE_FAILED");
  const key = Buffer.from(result.stdout.trim(), "base64");
  if (key.byteLength === 32) return key;
  key.fill(0);
  throw new Error("KEYCHAIN_WRITE_FAILED");
};
