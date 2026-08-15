export type AccountRegistryEntry = {
  canonicalId: string;
  institution: string;
  provider: "td";
  accountType: "chequing" | "credit-card";
  displayName: string;
  currency: "CAD";
  lifecycleState: "active" | "closed";
  visibility: "visible" | "hidden";
  capabilities: readonly ("statement-import")[];
};

export type FounderRuntimeConfiguration = {
  version: 1;
  provisionedAt: string;
  snapshotProvenance: {
    authority: "founder-provided";
    migratedAt: string;
    schema: "canonical-financial-snapshot-v1";
    validation: "validated";
  };
  managedSnapshotDirectory: string;
  statementFolder: string;
  accounts: readonly AccountRegistryEntry[];
  mappings: Readonly<Partial<Record<"td-chequing" | "td-credit-card", string>>>;
};

export type RuntimeHealth = {
  status: "ready" | "setup-required" | "blocked";
  worker: "running" | "stopped" | "unavailable";
  encryption: "available" | "missing" | "unavailable";
  databases: "healthy" | "unavailable";
  statementFolder: "healthy" | "unavailable";
  reviewBacklog: number | null;
  relationshipBacklog: number | null;
  safeMessage: string;
};

export type FounderWorldFacts = {
  version: 1;
  home: {
    property: { value: number; currency: "CAD"; effectiveDate: string; source: "founder-manual" } | null;
    mortgage: { institution: string; balance: number; currency: "CAD"; effectiveDate: string; source: "founder-manual" } | null;
  };
  accountOverrides?: readonly { canonicalAccountId: string; balance: number; effectiveDate: string; source: "founder-manual" }[];
  additionalAccounts?: readonly { id: string; name: string; institution: string; balance: number; type: "asset" | "liability"; group: "cash" | "investments" | "debts"; effectiveDate: string; source: "founder-manual" }[];
  vehicle?: { description: string; value: number; currency: "CAD"; effectiveDate: string; source: "founder-manual" } | null;
};
