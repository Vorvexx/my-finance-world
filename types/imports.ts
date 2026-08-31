import type { CanonicalTransaction } from "./transactions.ts";

export type ImportJournalStatus =
  | "received"
  | "parsing"
  | "proposed"
  | "committed"
  | "duplicate"
  | "rejected"
  | "quarantined";

export type ImportJournalRecord = {
  importId: string;
  sourceSha256: string;
  providerId: string;
  accountType: string;
  accountId: string;
  parserVersion: string;
  statementPeriodStart: string;
  statementPeriodEnd: string;
  sourceFormat: "pdf";
  receivedAt: string;
  processingStartedAt: string | null;
  proposedAt: string | null;
  committedAt: string | null;
  status: ImportJournalStatus;
  parsedTransactionCount: number;
  committedTransactionCount: number;
  duplicateTransactionCount: number;
  safeErrorCode: string | null;
  schemaVersion: number;
};

export type CanonicalAccountImportMapping = {
  accountId: string;
  providerId: "td";
  accountType: "chequing" | "credit-card";
};

export type PreparedCanonicalTransaction = {
  transaction: CanonicalTransaction;
  sourceRowNumber: number;
  amountCents: number;
  maskedReferenceToken: string | null;
};

export type PreparedTdChequingImport = {
  journal: ImportJournalRecord;
  transactions: readonly PreparedCanonicalTransaction[];
  chequingStatementFacts: CanonicalChequingStatementFacts;
};

export type CanonicalChequingStatementFacts = {
  id: string;
  importId: string;
  accountId: string;
  providerId: "td";
  accountType: "chequing";
  currency: "CAD";
  statementPeriodStart: string;
  statementPeriodEnd: string;
  openingBalanceCents: number;
  totalDepositsCents: number;
  totalWithdrawalsCents: number;
  closingBalanceCents: number;
  closingBalanceEvidence: "statement-label" | "reconciled-final-running-balance";
  sourceSha256: string;
  createdAt: string;
};

export type CanonicalStatementFacts = {
  id: string;
  importId: string;
  accountId: string;
  providerId: "td";
  accountType: "credit-card";
  currency: "CAD";
  statementDate: string;
  statementPeriodStart: string;
  statementPeriodEnd: string;
  paymentDueDate: string;
  minimumPaymentCents: number;
  previousBalanceCents: number;
  newBalanceCents: number;
  createdAt: string;
};

export type PreparedTdCreditCardImport = {
  journal: ImportJournalRecord;
  transactions: readonly PreparedCanonicalTransaction[];
  statementFacts: CanonicalStatementFacts;
};

export type PreparedStatementImport = PreparedTdChequingImport | PreparedTdCreditCardImport;

export type DurableImportReceipt = {
  importId: string;
  status: Extract<ImportJournalStatus, "committed" | "duplicate" | "rejected" | "quarantined">;
  providerId: string;
  accountType: string;
  transactionCount: number;
  duplicateCount: number;
  reviewCount: number;
  safeToDeleteSource: boolean;
};
