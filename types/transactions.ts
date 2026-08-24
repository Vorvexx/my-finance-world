import type { MoneyWorldKey } from "./finance.ts";

export type TransactionDirection = "inflow" | "outflow";
export type TransactionStatus = "posted" | "pending";
export type TransactionSourceKind = "local-synthetic" | "manual" | "import" | "api" | "database";
export type AttributionMethod = "deterministic-rule" | "user-correction" | "ai" | "unclassified";

export type RawTransaction = {
  id: unknown;
  accountId: unknown;
  date: unknown;
  amount: unknown;
  direction: unknown;
  description: unknown;
  status: unknown;
  sourceRecordId: unknown;
  source: unknown;
  sourceKind: unknown;
  observedAt: unknown;
  sourceUpdatedAt?: unknown;
};

export type TransactionProvenance = {
  providerId: string;
  sourceRecordId: string;
  sourceKind: TransactionSourceKind;
  observedAt: string;
  sourceUpdatedAt: string | null;
  deduplicationKey: string;
};

export type TransactionAttribution = {
  world: MoneyWorldKey | null;
  category: string;
  method: AttributionMethod;
  ruleId: string | null;
  confidence: number | null;
  correctedAt: string | null;
};

export type CanonicalTransaction = {
  id: string;
  accountId: string;
  date: string;
  amount: number;
  direction: TransactionDirection;
  rawDescription: string;
  normalizedCounterparty: string;
  status: TransactionStatus;
  attribution: TransactionAttribution;
  provenance: TransactionProvenance;
  createdAt: string;
  updatedAt: string;
  financialRole: "income" | "spending" | "transfer" | "credit-card-payment" | "other";
};

export type TransactionCorrection = {
  transactionId: string;
  world: MoneyWorldKey | null;
  category: string;
  correctedAt: string;
};

export type WorldAttributionRule = {
  id: string;
  pattern: RegExp;
  world: MoneyWorldKey;
  category: string;
  confidence: number;
};

export type CanonicalTransactionLedger = {
  transactions: readonly CanonicalTransaction[];
  duplicateCount: number;
};

export type TransactionDataProvider = {
  id: string;
  load: () => Promise<readonly RawTransaction[]>;
};

export type TransactionPeriodTotals = {
  inflow: number;
  outflow: number;
  net: number;
};
