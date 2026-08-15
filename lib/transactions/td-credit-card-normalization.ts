import { createHash } from "node:crypto";
import type { TdCreditCardParsedStatement, TdCreditCardTransactionEvidence } from "../../types/financial-files.ts";
import type { ImportJournalRecord, PreparedTdCreditCardImport } from "../../types/imports.ts";
import type { FinancialMeaning } from "../../types/transactions.ts";
import { LOCAL_INGESTION_SCHEMA_VERSION } from "./td-chequing-normalization.ts";

export const TD_CREDIT_CARD_FINGERPRINT_VERSION = "td-credit-card-fingerprint-v1" as const;
export const TD_CREDIT_CARD_CANONICAL_ID_VERSION = "canonical-transaction-id-v1" as const;
export const STATEMENT_FACTS_ID_VERSION = "statement-facts-id-v1" as const;

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

const meaningFor = (evidence: TdCreditCardTransactionEvidence): FinancialMeaning => {
  if (evidence === "purchase") return "credit-card-purchase";
  if (evidence === "payment") return "credit-card-payment";
  if (evidence === "refund") return "refund";
  if (evidence === "fee") return "fee";
  if (evidence === "interest") return "interest";
  if (evidence === "reversal") return "reversal";
  return "unknown";
};

export const normalizeTdCreditCardStatement = ({
  parsed,
  accountId,
  receivedAt,
}: {
  parsed: TdCreditCardParsedStatement;
  accountId: string;
  receivedAt: string;
}): PreparedTdCreditCardImport => {
  const occurrenceCounts = new Map<string, number>();
  const transactions = parsed.transactions.map((source) => {
    const direction = source.chargeCents === null ? "inflow" as const : "outflow" as const;
    const amountCents = source.chargeCents ?? source.creditCents;
    if (amountCents === null || !Number.isSafeInteger(amountCents) || amountCents <= 0) {
      throw new Error("TD_CREDIT_CARD_CANONICAL_NORMALIZATION_FAILED");
    }
    const base = JSON.stringify([
      accountId,
      source.transactionDate,
      source.postedDate,
      amountCents,
      direction,
      parsed.currency,
      source.normalizedDescription,
    ]);
    const occurrenceOrdinal = (occurrenceCounts.get(base) ?? 0) + 1;
    occurrenceCounts.set(base, occurrenceOrdinal);
    const fingerprintValue = sha256(JSON.stringify([
      TD_CREDIT_CARD_FINGERPRINT_VERSION,
      base,
      occurrenceOrdinal,
    ]));
    const id = `vorvex-transaction:${sha256(JSON.stringify([
      TD_CREDIT_CARD_CANONICAL_ID_VERSION,
      accountId,
      TD_CREDIT_CARD_FINGERPRINT_VERSION,
      fingerprintValue,
    ]))}`;
    return {
      sourceRowNumber: source.sourceRowNumber,
      amountCents,
      maskedReferenceToken: null,
      transaction: {
        id,
        accountId,
        transactionDate: source.transactionDate,
        postedDate: source.postedDate,
        amount: amountCents / 100,
        direction,
        currency: parsed.currency,
        rawDescription: source.sourceDescription,
        normalizedCounterparty: source.normalizedDescription,
        financialMeaning: meaningFor(source.sourceTransactionTypeEvidence),
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
          observedAt: parsed.source.intakeTimestamp,
          sourceUpdatedAt: null,
          fingerprint: { version: TD_CREDIT_CARD_FINGERPRINT_VERSION, value: fingerprintValue },
          deduplicationKey: `${parsed.parser.providerId}:${accountId}:${TD_CREDIT_CARD_FINGERPRINT_VERSION}:${fingerprintValue}`,
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
    processingStartedAt: null,
    proposedAt: null,
    committedAt: null,
    status: "received",
    parsedTransactionCount: transactions.length,
    committedTransactionCount: 0,
    duplicateTransactionCount: 0,
    safeErrorCode: null,
    schemaVersion: LOCAL_INGESTION_SCHEMA_VERSION,
  };
  const statementFactsId = `vorvex-statement:${sha256(JSON.stringify([
    STATEMENT_FACTS_ID_VERSION,
    accountId,
    parsed.parser.providerId,
    parsed.parser.accountType,
    parsed.statementDate,
    parsed.statementPeriod.startDate,
    parsed.statementPeriod.endDate,
  ]))}`;
  return {
    journal,
    transactions,
    statementFacts: {
      id: statementFactsId,
      importId: parsed.source.importId,
      accountId,
      providerId: parsed.parser.providerId,
      accountType: parsed.parser.accountType,
      currency: parsed.currency,
      statementDate: parsed.statementDate,
      statementPeriodStart: parsed.statementPeriod.startDate,
      statementPeriodEnd: parsed.statementPeriod.endDate,
      paymentDueDate: parsed.paymentDueDate,
      minimumPaymentCents: parsed.minimumPaymentCents,
      previousBalanceCents: parsed.previousBalanceCents,
      newBalanceCents: parsed.newBalanceCents,
      createdAt: receivedAt,
    },
  };
};
