import type { MoneyWorldKey } from "./finance.ts";

export type TransactionDirection = "inflow" | "outflow";
export type TransactionStatus = "posted" | "pending";
export type TransactionSourceKind = "local-synthetic" | "manual" | "import" | "api" | "database";
export type AttributionMethod = "deterministic-rule" | "user-correction" | "ai" | "unclassified";
export type FinancialMeaning =
  | "expense"
  | "income"
  | "refund"
  | "reversal"
  | "fee"
  | "interest"
  | "credit-card-purchase"
  | "credit-card-payment"
  | "transfer"
  | "cash-withdrawal"
  | "cash-deposit"
  | "unknown";

export type TransactionFingerprint = {
  version: string;
  value: string;
};

export type RawTransaction = {
  accountId: unknown;
  importId: unknown;
  transactionDate: unknown;
  postedDate?: unknown;
  amount: unknown;
  direction: unknown;
  currency: unknown;
  description: unknown;
  financialMeaning: unknown;
  status: unknown;
  sourceRecordId?: unknown;
  fingerprint: unknown;
  source: unknown;
  sourceKind: unknown;
  observedAt: unknown;
  sourceUpdatedAt?: unknown;
};

export type TransactionProvenance = {
  importId: string;
  providerId: string;
  sourceRecordId: string | null;
  sourceKind: TransactionSourceKind;
  observedAt: string;
  sourceUpdatedAt: string | null;
  fingerprint: TransactionFingerprint;
  deduplicationKey: string;
};

export type TransactionAttribution = {
  world: MoneyWorldKey | null;
  category: string | null;
  method: AttributionMethod;
  ruleId: string | null;
  confidence: number | null;
  correctedAt: string | null;
};

export type CanonicalTransaction = {
  /** Vorvex-controlled identity; never a provider row or transaction ID. */
  id: string;
  accountId: string;
  transactionDate: string;
  postedDate: string | null;
  amount: number;
  direction: TransactionDirection;
  currency: string;
  rawDescription: string;
  normalizedCounterparty: string;
  financialMeaning: FinancialMeaning;
  status: TransactionStatus;
  relatedTransactionId: string | null;
  attribution: TransactionAttribution;
  provenance: TransactionProvenance;
  createdAt: string;
  updatedAt: string;
};

export type TransactionCorrection = {
  transactionId: string;
  world: MoneyWorldKey | null;
  category: string | null;
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
