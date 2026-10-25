import test from "node:test";
import assert from "node:assert/strict";
import { PlaidApi } from "plaid";
import { PlaidConnector } from "../lib/connections/plaid-connector.ts";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { isLocalSetupRequest, validatePlaidSetup, saveProductionPlaidSetup } from "../lib/connections/plaid-setup.ts";
import type { FinancialProviderConnection } from "../types/financial-provider.ts";

const connection = (): FinancialProviderConnection => ({ id: "fixture", provider: "plaid", institution: "Test institution", status: "CONNECTED", itemId: "fixture-item", accessToken: "fixture-token", cursor: null, lastSuccessfulSync: null, balanceAsOf: null, transactionSyncAt: null, errorCode: null, accounts: [], transactions: [] });
test("Production cannot use legacy Sandbox tokens", async () => {
  process.env.PLAID_ENV = "production";
  const refreshed = await new PlaidConnector().refresh(connection());
  assert.equal(refreshed.errorCode, "PLAID_ENVIRONMENT_MISMATCH");
  assert.equal(refreshed.accessToken, "fixture-token");
  delete process.env.PLAID_ENV;
});
test("actual Plaid sync replaces pending with posted and applies removals", async () => {
  process.env.PLAID_ENV = "sandbox"; process.env.PLAID_CLIENT_ID = "fixture"; process.env.PLAID_SECRET = "fixture";
  const original = PlaidApi.prototype.transactionsSync;
  const c = connection();
  c.transactions = [{ providerTransactionId: "pending", providerAccountId: "account", amount: 10, date: "2026-01-01", authorizedDate: null, description: "fixture", merchant: null, pending: true, pendingTransactionId: null, firstSeenAt: "2026-01-01", lastSeenAt: "2026-01-01", sourceMetadata: {} }];
  PlaidApi.prototype.transactionsSync = async () => ({ data: { added: [{ transaction_id: "posted", pending_transaction_id: "pending", account_id: "account", amount: 12, date: "2026-01-02", name: "fixture", pending: false }], modified: [], removed: [], next_cursor: "next", has_more: false } }) as never;
  try {
    const synced = await new PlaidConnector().syncTransactions(c);
    assert.deepEqual(synced.transactions.map((item) => item.providerTransactionId), ["posted"]);
    assert.equal(synced.transactions[0].amount, 12);
    assert.equal(synced.cursor, "next");
    PlaidApi.prototype.transactionsSync = async () => ({ data: { added: [], modified: [], removed: [{ transaction_id: "posted" }], next_cursor: "removed", has_more: false } }) as never;
    assert.equal((await new PlaidConnector().syncTransactions({ ...c, transactions: synced.transactions })).transactions.length, 0);
  } finally { PlaidApi.prototype.transactionsSync = original; delete process.env.PLAID_ENV; delete process.env.PLAID_CLIENT_ID; delete process.env.PLAID_SECRET; }
});
test("setup rejects foreign origins, rebinding hosts and malformed credentials", () => {
  const request = (origin: string, host = "127.0.0.1:3210") => new Request("http://127.0.0.1:3210/api/connections/plaid/configure", { method: "POST", headers: { origin, host, "sec-fetch-site": "same-origin", "content-type": "application/json" } });
  assert.equal(isLocalSetupRequest(request("http://127.0.0.1:3210")), true);
  assert.equal(isLocalSetupRequest(request("https://attacker.invalid")), false);
  assert.equal(isLocalSetupRequest(request("http://127.0.0.1:3210", "attacker.invalid")), false);
  assert.equal(validatePlaidSetup({ clientId: "x", secret: "y" }), false);
  assert.equal(validatePlaidSetup({ clientId: "a".repeat(24), secret: "b".repeat(30) }), true);
});

test("Chrome setup writes credentials over stdin and restores configuration on helper failure", () => {
  const root = mkdtempSync(path.join(tmpdir(), "vorvex-keychain-fixture-"));
  const statePath = path.join(root, "state.json");
  const helperPath = path.join(root, "helper");
  const prior = { "client-id": "old-id", secret: "old-secret", environment: "sandbox" };
  writeFileSync(statePath, JSON.stringify(prior));
  writeFileSync(helperPath, `#!${process.execPath}
const fs = require("node:fs");
if (process.argv.length !== 3) process.exit(2);
const file = ${JSON.stringify(statePath)};
const state = JSON.parse(fs.readFileSync(file, "utf8"));
const operation = process.argv[2];
const field = operation.replace(/^(get|set)-plaid-/, "");
if (operation.startsWith("get-")) process.stdout.write(state[field]);
else { const value = fs.readFileSync(0, "utf8"); if (process.env.VORVEX_FIXTURE_FAIL === "yes" && value === "production") process.exit(4); state[field] = value; fs.writeFileSync(file, JSON.stringify(state)); }
`, { mode: 0o700 });
  const previousHelper = process.env.VORVEX_KEYCHAIN_HELPER;
  process.env.VORVEX_KEYCHAIN_HELPER = helperPath;
  try {
    process.env.VORVEX_FIXTURE_FAIL = "yes";
    assert.throws(() => saveProductionPlaidSetup("a".repeat(24), "b".repeat(30)), /KEYCHAIN_WRITE_FAILED/);
    assert.deepEqual(JSON.parse(readFileSync(statePath, "utf8")), prior);
    delete process.env.VORVEX_FIXTURE_FAIL;
    saveProductionPlaidSetup("a".repeat(24), "b".repeat(30));
    assert.equal(JSON.parse(readFileSync(statePath, "utf8")).environment, "production");
  } finally { delete process.env.VORVEX_FIXTURE_FAIL; if (previousHelper) process.env.VORVEX_KEYCHAIN_HELPER = previousHelper; else delete process.env.VORVEX_KEYCHAIN_HELPER; }
});
