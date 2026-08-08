import type {
  RawTransaction,
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

const isIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};
const isIsoTimestamp = (value: string) => !Number.isNaN(Date.parse(value));

export type ValidatedRawTransaction = {
  id: string;
  accountId: string;
  date: string;
  amount: number;
  direction: TransactionDirection;
  description: string;
  status: TransactionStatus;
  sourceRecordId: string;
  source: string;
  sourceKind: TransactionSourceKind;
  observedAt: string;
  sourceUpdatedAt: string | null;
};

export const validateRawTransaction = (raw: RawTransaction): ValidatedRawTransaction => {
  if (typeof raw.id !== "string" || !raw.id.trim()) throw new Error("Transaction ID is required.");
  if (typeof raw.accountId !== "string" || !raw.accountId.trim()) throw new Error("Account ID is required.");
  if (typeof raw.date !== "string" || !isIsoDate(raw.date)) throw new Error("Transaction date must be YYYY-MM-DD.");
  if (typeof raw.amount !== "number" || !Number.isFinite(raw.amount) || raw.amount <= 0) {
    throw new Error("Transaction amount must be a positive finite number.");
  }
  if (typeof raw.direction !== "string" || !DIRECTIONS.has(raw.direction as TransactionDirection)) {
    throw new Error("Transaction direction is invalid.");
  }
  if (typeof raw.description !== "string" || !raw.description.trim()) throw new Error("Transaction description is required.");
  if (typeof raw.status !== "string" || !STATUSES.has(raw.status as TransactionStatus)) {
    throw new Error("Transaction status is invalid.");
  }
  if (typeof raw.sourceRecordId !== "string" || !raw.sourceRecordId.trim()) throw new Error("Source record ID is required.");
  if (typeof raw.source !== "string" || !raw.source.trim()) throw new Error("Transaction source is required.");
  if (typeof raw.sourceKind !== "string" || !SOURCE_KINDS.has(raw.sourceKind as TransactionSourceKind)) {
    throw new Error("Transaction source kind is invalid.");
  }
  if (typeof raw.observedAt !== "string" || !isIsoTimestamp(raw.observedAt)) throw new Error("Observed timestamp is invalid.");
  if (raw.sourceUpdatedAt != null && (typeof raw.sourceUpdatedAt !== "string" || !isIsoTimestamp(raw.sourceUpdatedAt))) {
    throw new Error("Source-updated timestamp is invalid.");
  }

  return {
    id: raw.id,
    accountId: raw.accountId,
    date: raw.date,
    amount: raw.amount,
    direction: raw.direction as TransactionDirection,
    description: raw.description,
    status: raw.status as TransactionStatus,
    sourceRecordId: raw.sourceRecordId,
    source: raw.source,
    sourceKind: raw.sourceKind as TransactionSourceKind,
    observedAt: raw.observedAt,
    sourceUpdatedAt: (raw.sourceUpdatedAt as string | null | undefined) ?? null,
  };
};
