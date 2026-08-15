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

const deduplicationKey = (transaction: ValidatedRawTransaction) => {
  const sourceIdentity = transaction.sourceRecordId
    ? `source:${transaction.sourceRecordId}`
    : `fingerprint:${transaction.fingerprint.version}:${transaction.fingerprint.value}`;
  return `${transaction.source}:${transaction.accountId}:${sourceIdentity}`;
};

const canonicalTransactionId = (transaction: ValidatedRawTransaction) =>
  `vorvex-transaction:${transaction.importId}:${transaction.accountId}:${transaction.fingerprint.version}:${transaction.fingerprint.value}`;

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
  const id = canonicalTransactionId(transaction);
  const attribution = attributeTransaction({
    transactionId: id,
    description: transaction.description,
    normalizedCounterparty,
    corrections,
    rules,
  });
  const updatedAt = transaction.sourceUpdatedAt ?? transaction.observedAt;

  return {
    id,
    accountId: transaction.accountId,
    transactionDate: transaction.transactionDate,
    postedDate: transaction.postedDate,
    amount: transaction.amount,
    direction: transaction.direction,
    currency: transaction.currency,
    rawDescription: transaction.description,
    normalizedCounterparty,
    financialMeaning: transaction.financialMeaning,
    status: transaction.status,
    relatedTransactionId: null,
    attribution,
    provenance: {
      importId: transaction.importId,
      providerId: transaction.source,
      sourceRecordId: transaction.sourceRecordId,
      sourceKind: transaction.sourceKind,
      observedAt: transaction.observedAt,
      sourceUpdatedAt: transaction.sourceUpdatedAt,
      fingerprint: transaction.fingerprint,
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
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate) || b.updatedAt.localeCompare(a.updatedAt));

  return { transactions, duplicateCount };
};

export const emptyTransactionLedger = (): CanonicalTransactionLedger => ({
  transactions: [],
  duplicateCount: 0,
});
