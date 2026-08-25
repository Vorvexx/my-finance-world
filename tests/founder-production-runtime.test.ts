import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { provisionFounderRuntime, validateFounderSnapshot } from "../lib/runtime/provisioning.ts";
import { founderRuntimePaths } from "../lib/runtime/paths.ts";
import { createKeychainKey } from "../lib/runtime/keychain.ts";

const account = (id: string, name: string, type: "asset" | "liability", group: "cash" | "debts") => ({
  id, name, institution: "TD", balance: type === "asset" ? 100 : 20, type, group, updatedAt: "Aug 1, 2026, 1:30 p.m.",
});

test("Founder provisioning migrates validated facts and explicit mappings into owner-only local state", async () => {
  const home = mkdtempSync(path.join(os.tmpdir(), "vorvex-founder-"));
  mkdirSync(path.join(home, "Documents"));
  const source = path.join(home, "founder-backup");
  mkdirSync(source);
  const accounts = [account("cash-1", "Daily Chequing", "asset", "cash"), account("debt-1", "Primary Visa", "liability", "debts")];
  writeFileSync(path.join(source, "my-finance-world-real-accounts-v1.json"), JSON.stringify(accounts));
  writeFileSync(path.join(source, "my-finance-world-last-updated-v1.txt"), "Aug 3, 2026, 9:00 a.m.");
  const staged = founderRuntimePaths(home).canonicalSnapshot;
  mkdirSync(staged, { recursive: true });
  writeFileSync(path.join(staged, "my-finance-world-real-accounts-v1.json"), JSON.stringify(accounts));
  writeFileSync(path.join(staged, "my-finance-world-last-updated-v1.txt"), "Aug 3, 2026, 9:00 a.m.");
  mkdirSync(founderRuntimePaths(home).statementFolder, { mode: 0o700 });
  const key = Buffer.alloc(32, 7);
  const configuration = await provisionFounderRuntime({
    snapshotDirectory: source, chequingDisplayName: "Daily Chequing", creditCardDisplayName: "Primary Visa",
    home, platform: "darwin", keyProvider: () => Buffer.from(key), now: "2026-08-08T12:00:00.000Z",
  });
  const paths = founderRuntimePaths(home);
  assert.deepEqual(configuration.mappings, { "td-chequing": "cash-1", "td-credit-card": "debt-1" });
  assert.deepEqual(JSON.parse(readFileSync(path.join(paths.canonicalSnapshot, "my-finance-world-real-accounts-v1.json"), "utf8")), accounts);
  assert.equal(statSync(paths.root).mode & 0o077, 0);
  assert.equal(statSync(paths.configFile).mode & 0o077, 0);
  assert.equal(statSync(paths.statementFolder).mode & 0o077, 0);
  assert.equal(statSync(paths.ingestionDatabase).mode & 0o077, 0);
  assert.equal(configuration.snapshotProvenance.validation, "validated");
  assert.equal(readFileSync(path.join(source, "my-finance-world-last-updated-v1.txt"), "utf8"), "Aug 3, 2026, 9:00 a.m.");
});

test("snapshot validation accepts established human timestamps and rejects duplicate IDs", () => {
  const valid = [account("cash-1", "Daily Chequing", "asset", "cash")];
  assert.equal(validateFounderSnapshot({ accounts: valid, lastUpdated: "Aug 3, 2026, 9:00 a.m." }).money.accounts.length, 1);
  assert.throws(() => validateFounderSnapshot({ accounts: [...valid, { ...valid[0] }], lastUpdated: "Aug 3, 2026, 9:00 a.m." }), /SNAPSHOT_DUPLICATE_ACCOUNT_ID/);
  assert.throws(() => validateFounderSnapshot({ accounts: valid, lastUpdated: "not-a-date" }), /SNAPSHOT_TIMESTAMP_INVALID/);
});

test("Founder provisioning rejects ambiguous account mappings without creating runtime state", async () => {
  const home = mkdtempSync(path.join(os.tmpdir(), "vorvex-founder-"));
  mkdirSync(path.join(home, "Documents"));
  const source = path.join(home, "backup");
  mkdirSync(source);
  writeFileSync(path.join(source, "my-finance-world-real-accounts-v1.json"), JSON.stringify([
    account("cash-1", "Same", "asset", "cash"), account("cash-2", "Same", "asset", "cash"), account("debt-1", "Visa", "liability", "debts"),
  ]));
  writeFileSync(path.join(source, "my-finance-world-last-updated-v1.txt"), "Aug 3, 2026, 9:00 a.m.");
  await assert.rejects(() => provisionFounderRuntime({ snapshotDirectory: source, chequingDisplayName: "Same", creditCardDisplayName: "Visa", home, platform: "darwin", keyProvider: () => Buffer.alloc(32, 9) }), /ACCOUNT_SELECTION_AMBIGUOUS/);
  assert.equal(statSync(home).isDirectory(), true);
  assert.throws(() => statSync(founderRuntimePaths(home).root));
});

test("Keychain creation uses the Security-framework helper without plaintext arguments", () => {
  const calls: Array<{ command: string; args: readonly string[] }> = [];
  const encoded = Buffer.alloc(32, 4).toString("base64");
  const key = createKeychainKey((command, args) => {
    calls.push({ command, args });
    return { status: 0, stdout: encoded };
  });
  try {
    assert.equal(key.byteLength, 32);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].args, ["get-or-create"]);
    assert.equal(calls[0].args.includes(encoded), false);
  } finally { key.fill(0); }
});

test("LaunchAgent template receives an explicit Node executable search path", () => {
  const template = readFileSync(path.join(process.cwd(), "packaging", "com.vorvex.founder-v1.plist"), "utf8");
  const installer = readFileSync(path.join(process.cwd(), "scripts", "install-founder-runtime.sh"), "utf8");
  assert.match(template, /<key>PATH<\/key><string>__NODE_BIN_PATH__:\/usr\/bin:/);
  assert.match(installer, /node_bin_path=\$\(dirname "\$node_path"\)/);
  assert.match(installer, /__NODE_BIN_PATH__/);
  assert.match(installer, /if ! launchctl bootstrap/);
  assert.match(installer, /sleep 1/);
  assert.match(installer, /keychain-helper\.swift/);
  assert.match(template, /<key>Umask<\/key><integer>63<\/integer>/);
  assert.match(installer, /launcher\.swift/);
  const launcher = readFileSync(path.join(process.cwd(), "packaging", "launcher.swift"), "utf8");
  assert.ok(launcher.indexOf("Data(contentsOf: url)") < launcher.indexOf('arguments = ["kickstart"'));
  assert.match(launcher, /com\.google\.Chrome/);
  assert.match(launcher, /open\(\[url\], withApplicationAt: chrome/);
});

test("production keeps the PDF engine external so its worker remains resolvable", () => {
  const configuration = readFileSync(path.join(process.cwd(), "next.config.ts"), "utf8");
  assert.match(configuration, /serverExternalPackages:\s*\["pdfjs-dist"\]/);
});
