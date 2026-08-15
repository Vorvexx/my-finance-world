import { createHash } from "node:crypto";
import type { TdChequingParsedStatement } from "../../types/financial-files.ts";
import type {
  ImportJournalRecord,
  PreparedTdChequingImport,
} from "../../types/imports.ts";
import type { FinancialMeaning } from "../../types/transactions.ts";

export const TD_TRANSACTION_FINGERPRINT_VERSION = "td-chequing-fingerprint-v1" as const;
export const CANONICAL_TRANSACTION_ID_VERSION = "canonical-transaction-id-v1" as const;
export const LOCAL_INGESTION_SCHEMA_VERSION = 4;

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

const financialMeaning = (description: string): FinancialMeaning => {
  if (/\b(?:MONTHLY\s+)?ACCOUNT\s+FEE\b/i.test(description)) return "fee";
  if (/\b(?:VISA|MASTERCARD|CREDIT\s+CARD)\s+PAYMENT\b/i.test(description)) {
    return "credit-card-payment";
  }
  if (/\b(?:ATM|CASH)\s+WITHDRAWAL\b/i.test(description)) return "cash-withdrawal";
  return "unknown";
};

const fingerprintBase = ({
  accountId,
  transactionDate,
  amountCents,
  direction,
  currency,
  normalizedDescription,
  maskedReferenceToken,
}: {
  accountId: string;
  transactionDate: string;
  amountCents: number;
  direction: "inflow" | "outflow";
  currency: string;
  normalizedDescription: string;
  maskedReferenceToken: string | null;
}) => JSON.stringify([
  accountId,
  transactionDate,
  amountCents,
  direction,
  currency,
  normalizedDescription,
  maskedReferenceToken,
]);

export const normalizeTdChequingStatement = ({
  parsed,
  accountId,
  receivedAt,
}: {
  parsed: TdChequingParsedStatement;
  accountId: string;
  receivedAt: string;
}): PreparedTdChequingImport => {
  const occurrenceCounts = new Map<string, number>();
  const transactions = parsed.transactions.map((source) => {
    const direction = source.withdrawalCents === null ? "inflow" as const : "outflow" as const;
    const amountCents = source.withdrawalCents ?? source.depositCents;
    if (amountCents === null || !Number.isSafeInteger(amountCents) || amountCents <= 0) {
      throw new Error("TD_CANONICAL_NORMALIZATION_FAILED");
    }
    const base = fingerprintBase({
      accountId,
      transactionDate: source.transactionDate,
      amountCents,
      direction,
      currency: parsed.currency,
      normalizedDescription: source.normalizedDescription,
      maskedReferenceToken: source.maskedReferenceToken,
    });
    const occurrenceOrdinal = (occurrenceCounts.get(base) ?? 0) + 1;
    occurrenceCounts.set(base, occurrenceOrdinal);
    const fingerprintValue = sha256(JSON.stringify([
      TD_TRANSACTION_FINGERPRINT_VERSION,
      base,
      occurrenceOrdinal,
    ]));
    const id = `vorvex-transaction:${sha256(JSON.stringify([
      CANONICAL_TRANSACTION_ID_VERSION,
      accountId,
      TD_TRANSACTION_FINGERPRINT_VERSION,
      fingerprintValue,
    ]))}`;
    const meaning = financialMeaning(source.sourceDescription);

    return {
      sourceRowNumber: source.sourceRowNumber,
      amountCents,
      maskedReferenceToken: source.maskedReferenceToken,
      transaction: {
        id,
        accountId,
        transactionDate: source.transactionDate,
        postedDate: null,
        amount: amountCents / 100,
        direction,
        currency: parsed.currency,
        rawDescription: source.sourceDescription,
        normalizedCounterparty: source.normalizedDescription,
        financialMeaning: meaning,
        status: "posted" as const,
        relatedTransactionId: null,
        attribution: {
          world: null,
          category: null,
          method: "unclassified" as const,
          ruleId: null,
          confidence: null,
          correctedAt: null,
        },
        provenance: {
          importId: parsed.source.importId,
          providerId: parsed.parser.providerId,
          sourceRecordId: null,
          sourceKind: "import" as const,
          observedAt: receivedAt,
          sourceUpdatedAt: null,
          fingerprint: {
            version: TD_TRANSACTION_FINGERPRINT_VERSION,
            value: fingerprintValue,
          },
          deduplicationKey: [
            parsed.parser.providerId,
            accountId,
            TD_TRANSACTION_FINGERPRINT_VERSION,
            fingerprintValue,
          ].join(":"),
        },
        createdAt: receivedAt,
        updatedAt: receivedAt,
      },
    };
  });

  const journal: ImportJournalRecord = {
    importId: parsed.source.importId,
    sourceSha256: parsed.source.sha256,
    providerId: parsed.parser.providerId,
    accountType: parsed.parser.accountType,
    accountId,
    parserVersion: parsed.parser.version,
    statementPeriodStart: parsed.statementPeriod.startDate,
    statementPeriodEnd: parsed.statementPeriod.endDate,
    sourceFormat: "pdf",
    receivedAt,
    processingStartedAt: receivedAt,
    proposedAt: receivedAt,
    committedAt: null,
    status: "proposed",
    parsedTransactionCount: transactions.length,
    committedTransactionCount: 0,
    duplicateTransactionCount: 0,
    safeErrorCode: null,
    schemaVersion: LOCAL_INGESTION_SCHEMA_VERSION,
  };

  return { journal, transactions };
};
