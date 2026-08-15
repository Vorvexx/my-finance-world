import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { timingSafeEqual } from "node:crypto";
import path from "node:path";
import { ingestFinancialSnapshot } from "../financial-model/canonical-financial-model.ts";
import { LocalIngestionStore } from "../persistence/local-ingestion-store.ts";
import { LocalReviewLearningStore } from "../review/local-review-learning-store.ts";
import { LocalRelationshipStore } from "../relationships/local-relationship-store.ts";
import { createStatementFolder } from "../statement-folder/config.ts";
import type { AccountRegistryEntry, FounderRuntimeConfiguration } from "../../types/runtime.ts";
import { appendSafeAuditEvent } from "./audit.ts";
import { loadFounderConfiguration, saveFounderConfiguration } from "./configuration.ts";
import { createKeychainKey } from "./keychain.ts";
import { applyFounderRuntimeEnvironment } from "./paths.ts";

const ACCOUNTS_FILE = "my-finance-world-real-accounts-v1.json";
const UPDATED_FILE = "my-finance-world-last-updated-v1.txt";
const ownerOnly = (target: string) => chmodSync(target, statSync(target).isDirectory() ? 0o700 : 0o600);
const copyVerifiedSource = (source: string, destination: string) => {
  if (existsSync(destination)) {
    const sourceBytes = readFileSync(source);
    const destinationBytes = readFileSync(destination);
    if (sourceBytes.byteLength !== destinationBytes.byteLength || !timingSafeEqual(sourceBytes, destinationBytes)) {
      throw new Error("MANAGED_SNAPSHOT_CONFLICT");
    }
    ownerOnly(destination);
    return;
  }
  cpSync(source, destination, { errorOnExist: true, force: false });
  ownerOnly(destination);
};

const validSnapshotTimestamp = (value: string) => {
  if (!value.trim()) return false;
  if (!Number.isNaN(Date.parse(value))) return true;
  const normalized = value.trim().replace(/\b([ap])\.m\.\s*$/i, (_, marker: string) => marker.toUpperCase() === "A" ? "AM" : "PM");
  return /^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}, \d{1,2}:\d{2} (?:AM|PM)$/.test(normalized)
    && !Number.isNaN(Date.parse(normalized));
};

export const validateFounderSnapshot = ({ accounts, lastUpdated }: { accounts: unknown; lastUpdated: string | null }) => {
  const model = ingestFinancialSnapshot({ accounts, lastUpdated });
  const ids = model.money.accounts.map((account) => account.id);
  if (new Set(ids).size !== ids.length) throw new Error("SNAPSHOT_DUPLICATE_ACCOUNT_ID");
  if (model.money.accounts.some((account) => !validSnapshotTimestamp(account.updatedAt))
    || lastUpdated === null || !validSnapshotTimestamp(lastUpdated)) throw new Error("SNAPSHOT_TIMESTAMP_INVALID");
  return model;
};

export const provisionFounderRuntime = async ({
  snapshotDirectory,
  chequingDisplayName,
  creditCardDisplayName,
  home,
  now = new Date().toISOString(),
  platform = process.platform,
  keyProvider = createKeychainKey,
}: {
  snapshotDirectory: string;
  chequingDisplayName: string;
  creditCardDisplayName: string;
  home?: string;
  now?: string;
  platform?: NodeJS.Platform;
  keyProvider?: () => Buffer;
}): Promise<FounderRuntimeConfiguration> => {
  if (platform !== "darwin") throw new Error("MACOS_REQUIRED");
  if (loadFounderConfiguration(home)) throw new Error("ALREADY_PROVISIONED");
  const sourceDirectory = path.resolve(snapshotDirectory.trim());
  const accountsPath = path.join(sourceDirectory, ACCOUNTS_FILE);
  const updatedPath = path.join(sourceDirectory, UPDATED_FILE);
  if (!existsSync(accountsPath)) throw new Error("SNAPSHOT_NOT_FOUND");
  const rawAccounts = JSON.parse(readFileSync(accountsPath, "utf8")) as unknown;
  const lastUpdated = existsSync(updatedPath) ? readFileSync(updatedPath, "utf8") : null;
  const model = validateFounderSnapshot({ accounts: rawAccounts, lastUpdated });
  const exact = (name: string) => model.money.accounts.filter((account) => account.name === name.trim());
  const chequing = exact(chequingDisplayName);
  const credit = exact(creditCardDisplayName);
  if (chequing.length !== 1 || credit.length !== 1) throw new Error("ACCOUNT_SELECTION_AMBIGUOUS");
  if (chequing[0].type !== "asset" || chequing[0].group !== "cash") throw new Error("CHEQUING_ACCOUNT_INCOMPATIBLE");
  if (credit[0].type !== "liability" || credit[0].group !== "debts") throw new Error("CREDIT_ACCOUNT_INCOMPATIBLE");

  const paths = applyFounderRuntimeEnvironment(home);
  for (const directory of [paths.root, paths.databases, paths.configuration, paths.runtime, paths.audit, paths.backups, paths.canonicalSnapshot]) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    ownerOnly(directory);
  }
  await createStatementFolder({ folderPath: paths.statementFolder, approvedRoot: paths.statementApprovedRoot });
  copyVerifiedSource(accountsPath, path.join(paths.canonicalSnapshot, ACCOUNTS_FILE));
  if (existsSync(updatedPath)) {
    copyVerifiedSource(updatedPath, path.join(paths.canonicalSnapshot, UPDATED_FILE));
  }

  const key = keyProvider();
  try {
    const ingestion = new LocalIngestionStore({ databasePath: paths.ingestionDatabase, encryptionKey: key });
    const review = new LocalReviewLearningStore({ databasePath: paths.reviewDatabase, encryptionKey: key });
    const relationships = new LocalRelationshipStore({ databasePath: paths.relationshipDatabase, encryptionKey: key });
    try {
      ingestion.registerCanonicalAccount({ account: chequing[0], providerId: "td", accountType: "chequing", registeredAt: now });
      ingestion.registerCanonicalAccount({ account: credit[0], providerId: "td", accountType: "credit-card", registeredAt: now });
    } finally { ingestion.close(); review.close(); relationships.close(); }
  } finally { key.fill(0); }

  const toRegistry = (account: typeof chequing[number], accountType: "chequing" | "credit-card"): AccountRegistryEntry => ({
    canonicalId: account.id, institution: account.institution, provider: "td", accountType,
    displayName: account.name, currency: "CAD", lifecycleState: "active", visibility: "visible",
    capabilities: ["statement-import"],
  });
  const configuration: FounderRuntimeConfiguration = {
    version: 1, provisionedAt: now,
    snapshotProvenance: { authority: "founder-provided", migratedAt: now, schema: "canonical-financial-snapshot-v1", validation: "validated" },
    managedSnapshotDirectory: paths.canonicalSnapshot,
    statementFolder: paths.statementFolder,
    accounts: [toRegistry(chequing[0], "chequing"), toRegistry(credit[0], "credit-card")],
    mappings: { "td-chequing": chequing[0].id, "td-credit-card": credit[0].id },
  };
  saveFounderConfiguration(configuration, home);
  appendSafeAuditEvent({ at: now, event: "provisioned", authority: "founder", source: "local-ui", reason: "Founder confirmed snapshot and account mappings." }, home);
  return configuration;
};
