import { spawnSync } from "node:child_process";
import { founderRuntimePaths } from "../runtime/paths.ts";
const helper = () => process.env.VORVEX_KEYCHAIN_HELPER || `${founderRuntimePaths().runtime}/keychain-helper`;
const read = (operation: string) => { const result = spawnSync(helper(), [operation], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); return result.status === 0 && result.stdout.trim() ? result.stdout.trim() : null; };
export const loadPlaidCredentials = () => ({
  clientId: process.env.PLAID_CLIENT_ID || read("get-plaid-client-id"),
  secret: process.env.PLAID_SECRET || read("get-plaid-secret"),
  environment: process.env.PLAID_ENV || read("get-plaid-environment") || "sandbox",
});
