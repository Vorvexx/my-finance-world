import { spawnSync } from "node:child_process";
import { founderRuntimePaths } from "../runtime/paths.ts";

export const isLocalSetupRequest = (request: Request) => {
  const url = new URL(request.url);
  return ["127.0.0.1:3210", "localhost:3210"].includes(url.host) &&
    request.headers.get("host") === url.host && request.headers.get("origin") === url.origin &&
    request.headers.get("sec-fetch-site") === "same-origin" &&
    request.headers.get("content-type") === "application/json";
};
export const validatePlaidSetup = (body: unknown): body is { clientId: string; secret: string } => {
  if (!body || typeof body !== "object") return false;
  const { clientId, secret } = body as Record<string, unknown>;
  return typeof clientId === "string" && /^[a-f0-9]{24}$/i.test(clientId) &&
    typeof secret === "string" && /^[a-f0-9]{30,128}$/i.test(secret);
};
// Secrets travel only over stdin to the existing native Keychain helper.
// Synchronous calls prevent another request observing a half-written configuration.
export const saveProductionPlaidSetup = (clientId: string, secret: string) => {
  if (process.env.PLAID_CLIENT_ID || process.env.PLAID_SECRET || process.env.PLAID_ENV) throw new Error("ENVIRONMENT_OVERRIDE");
  const helper = process.env.VORVEX_KEYCHAIN_HELPER || `${founderRuntimePaths().runtime}/keychain-helper`;
  const run = (operation: string, input?: string) => spawnSync(helper, [operation], { input, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"], timeout: 15000 });
  const fields = ["client-id", "secret", "environment"];
  const previous = fields.map((field) => run(`get-plaid-${field}`));
  // This cutover requires an existing, recoverable Sandbox configuration.
  if (previous.some((result) => result.status !== 0 || !result.stdout)) throw new Error("EXISTING_CONFIGURATION_REQUIRED");
  const values = [clientId, secret, "production"];
  for (let index = 0; index < fields.length; index++) {
    if (run(`set-plaid-${fields[index]}`, values[index]).status !== 0) {
      for (let restore = 0; restore < fields.length; restore++) run(`set-plaid-${fields[restore]}`, previous[restore].stdout);
      throw new Error("KEYCHAIN_WRITE_FAILED");
    }
  }
};
