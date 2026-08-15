import type {
  FinancialMeaning,
  RawTransaction,
  TransactionFingerprint,
  TransactionDirection,
  TransactionSourceKind,
  TransactionStatus,
} from "../../types/transactions.ts";

const DIRECTIONS = new Set<TransactionDirection>(["inflow", "outflow"]);
const STATUSES = new Set<TransactionStatus>(["posted", "pending"]);
const SOURCE_KINDS = new Set<TransactionSourceKind>([
  "local-synthetic",
  "manual",
  "import",
  "api",
  "database",
]);
const FINANCIAL_MEANINGS = new Set<FinancialMeaning>([
  "expense",
  "income",
  "refund",
  "reversal",
  "fee",
  "interest",
  "credit-card-purchase",
  "credit-card-payment",
  "transfer",
  "cash-withdrawal",
  "cash-deposit",
  "unknown",
]);

const isIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};
const isIsoTimestamp = (value: string) => !Number.isNaN(Date.parse(value));

export type ValidatedRawTransaction = {
  accountId: string;
  importId: string;
  transactionDate: string;
  postedDate: string | null;
  amount: number;
  direction: TransactionDirection;
  currency: string;
  description: string;
  financialMeaning: FinancialMeaning;
  status: TransactionStatus;
  sourceRecordId: string | null;
  fingerprint: TransactionFingerprint;
  source: string;
  sourceKind: TransactionSourceKind;
  observedAt: string;
  sourceUpdatedAt: string | null;
};

export const validateRawTransaction = (raw: RawTransaction): ValidatedRawTransaction => {
  if (typeof raw.accountId !== "string" || !raw.accountId.trim()) throw new Error("Account ID is required.");
  if (typeof raw.importId !== "string" || !raw.importId.trim()) throw new Error("Import ID is required.");
  if (typeof raw.transactionDate !== "string" || !isIsoDate(raw.transactionDate)) {
    throw new Error("Transaction date must be YYYY-MM-DD.");
  }
  if (raw.postedDate != null && (typeof raw.postedDate !== "string" || !isIsoDate(raw.postedDate))) {
    throw new Error("Posted date must be null or YYYY-MM-DD.");
  }
  if (typeof raw.amount !== "number" || !Number.isFinite(raw.amount) || raw.amount <= 0) {
    throw new Error("Transaction amount must be a positive finite number.");
  }
  if (typeof raw.direction !== "string" || !DIRECTIONS.has(raw.direction as TransactionDirection)) {
    throw new Error("Transaction direction is invalid.");
  }
  if (typeof raw.currency !== "string" || !/^[A-Z]{3}$/.test(raw.currency)) {
    throw new Error("Transaction currency must be a three-letter uppercase ISO-style code.");
  }
  if (typeof raw.description !== "string" || !raw.description.trim()) throw new Error("Transaction description is required.");
  if (typeof raw.financialMeaning !== "string" || !FINANCIAL_MEANINGS.has(raw.financialMeaning as FinancialMeaning)) {
    throw new Error("Financial meaning is invalid.");
  }
  if (typeof raw.status !== "string" || !STATUSES.has(raw.status as TransactionStatus)) {
    throw new Error("Transaction status is invalid.");
  }
  if (raw.sourceRecordId != null && (typeof raw.sourceRecordId !== "string" || !raw.sourceRecordId.trim())) {
    throw new Error("Source record ID must be null or a non-empty string.");
  }
  if (!raw.fingerprint || typeof raw.fingerprint !== "object") throw new Error("Transaction fingerprint is required.");
  const fingerprint = raw.fingerprint as Record<string, unknown>;
  if (typeof fingerprint.version !== "string" || !fingerprint.version.trim()) {
    throw new Error("Transaction fingerprint version is required.");
  }
  if (typeof fingerprint.value !== "string" || !fingerprint.value.trim()) {
    throw new Error("Transaction fingerprint value is required.");
  }
  if (typeof raw.source !== "string" || !raw.source.trim()) throw new Error("Transaction source is required.");
  if (typeof raw.sourceKind !== "string" || !SOURCE_KINDS.has(raw.sourceKind as TransactionSourceKind)) {
    throw new Error("Transaction source kind is invalid.");
  }
  if (typeof raw.observedAt !== "string" || !isIsoTimestamp(raw.observedAt)) throw new Error("Observed timestamp is invalid.");
  if (raw.sourceUpdatedAt != null && (typeof raw.sourceUpdatedAt !== "string" || !isIsoTimestamp(raw.sourceUpdatedAt))) {
    throw new Error("Source-updated timestamp is invalid.");
  }

  return {
    accountId: raw.accountId,
    importId: raw.importId,
    transactionDate: raw.transactionDate,
    postedDate: (raw.postedDate as string | null | undefined) ?? null,
    amount: raw.amount,
    direction: raw.direction as TransactionDirection,
    currency: raw.currency,
    description: raw.description,
    financialMeaning: raw.financialMeaning as FinancialMeaning,
    status: raw.status as TransactionStatus,
    sourceRecordId: (raw.sourceRecordId as string | null | undefined) ?? null,
    fingerprint: {
      version: fingerprint.version,
      value: fingerprint.value,
    },
    source: raw.source,
    sourceKind: raw.sourceKind as TransactionSourceKind,
    observedAt: raw.observedAt,
    sourceUpdatedAt: (raw.sourceUpdatedAt as string | null | undefined) ?? null,
  };
};
