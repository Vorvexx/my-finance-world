import { attributeTransaction, defaultWorldAttributionRules } from "./attribution.ts";
import { normalizeCounterparty } from "./normalization.ts";
import { validateRawTransaction, type ValidatedRawTransaction } from "./validation.ts";
import type {
  CanonicalTransaction,
  CanonicalTransactionLedger,
  RawTransaction,
  TransactionCorrection,
  WorldAttributionRule,
} from "../../types/transactions.ts";

const deduplicationKey = (transaction: ValidatedRawTransaction) =>
  `${transaction.source}:${transaction.sourceRecordId}`;

const shouldReplaceDuplicate = (
  current: ValidatedRawTransaction,
  candidate: ValidatedRawTransaction,
) => {
  if (current.status === "pending" && candidate.status === "posted") return true;
  if (current.status === "posted" && candidate.status === "pending") return false;

  const currentTimestamp = current.sourceUpdatedAt ?? current.observedAt;
  const candidateTimestamp = candidate.sourceUpdatedAt ?? candidate.observedAt;
  return Date.parse(candidateTimestamp) > Date.parse(currentTimestamp);
};

const canonicalize = (
  transaction: ValidatedRawTransaction,
  corrections: readonly TransactionCorrection[],
  rules: readonly WorldAttributionRule[],
): CanonicalTransaction => {
  const normalizedCounterparty = normalizeCounterparty(transaction.description);
  const attribution = attributeTransaction({
    transactionId: transaction.id,
    description: transaction.description,
    normalizedCounterparty,
    corrections,
    rules,
  });
  const updatedAt = transaction.sourceUpdatedAt ?? transaction.observedAt;

  return {
    id: transaction.id,
    accountId: transaction.accountId,
    date: transaction.date,
    amount: transaction.amount,
    direction: transaction.direction,
    rawDescription: transaction.description,
    normalizedCounterparty,
    status: transaction.status,
    attribution,
    provenance: {
      providerId: transaction.source,
      sourceRecordId: transaction.sourceRecordId,
      sourceKind: transaction.sourceKind,
      observedAt: transaction.observedAt,
      sourceUpdatedAt: transaction.sourceUpdatedAt,
      deduplicationKey: deduplicationKey(transaction),
    },
    createdAt: transaction.observedAt,
    updatedAt,
  };
};

export const ingestTransactions = (
  rawTransactions: readonly RawTransaction[],
  options: {
    corrections?: readonly TransactionCorrection[];
    rules?: readonly WorldAttributionRule[];
  } = {},
): CanonicalTransactionLedger => {
  const unique = new Map<string, ValidatedRawTransaction>();
  let duplicateCount = 0;

  for (const raw of rawTransactions) {
    const validated = validateRawTransaction(raw);
    const key = deduplicationKey(validated);
    const current = unique.get(key);
    if (!current) {
      unique.set(key, validated);
      continue;
    }

    duplicateCount += 1;
    if (shouldReplaceDuplicate(current, validated)) unique.set(key, validated);
  }

  const corrections = options.corrections ?? [];
  const rules = options.rules ?? defaultWorldAttributionRules;
  const transactions = [...unique.values()]
    .map((transaction) => canonicalize(transaction, corrections, rules))
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));

  return { transactions, duplicateCount };
};

export const emptyTransactionLedger = (): CanonicalTransactionLedger => ({
  transactions: [],
  duplicateCount: 0,
});
