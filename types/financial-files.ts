export type FinancialFileErrorCode =
  | "UNSUPPORTED_FILE"
  | "INVALID_PDF"
  | "PASSWORD_PROTECTED"
  | "PDF_TOO_LARGE"
  | "PAGE_LIMIT_EXCEEDED"
  | "TEXT_LIMIT_EXCEEDED"
  | "TEXT_EXTRACTION_FAILED"
  | "PDF_ANALYSIS_TIMEOUT"
  | "IMAGE_ONLY_PDF"
  | "STRUCTURE_NOT_RECOGNIZED"
  | "SOURCE_NOT_ALLOWED"
  | "TD_CHEQUING_MULTIPAGE_NOT_SUPPORTED"
  | "TD_CHEQUING_STRUCTURE_NOT_RECOGNIZED"
  | "TD_CHEQUING_STATEMENT_PERIOD_INVALID"
  | "TD_CHEQUING_MONEY_INVALID"
  | "TD_CHEQUING_ROW_INVALID"
  | "TD_CHEQUING_RECONCILIATION_FAILED"
  | "TD_CHEQUING_IMPORT_CONTEXT_INVALID"
  | "TD_CREDIT_CARD_STRUCTURE_NOT_RECOGNIZED"
  | "TD_CREDIT_CARD_STATEMENT_PERIOD_INVALID"
  | "TD_CREDIT_CARD_MONEY_INVALID"
  | "TD_CREDIT_CARD_ROW_INVALID"
  | "TD_CREDIT_CARD_RECONCILIATION_FAILED"
  | "TD_CREDIT_CARD_IMPORT_CONTEXT_INVALID";

export type ValidatedPdfMetadata = {
  internalFileId: string;
  byteSize: number;
  sha256: string;
  detectedFileType: "application/pdf";
  intakeTimestamp: string;
  validationResult: "accepted";
  status: "validated";
};

export type TdChequingPdfStructuralAnalysis = {
  file: ValidatedPdfMetadata;
  parserVersion: string;
  status: "recognized" | "structure-not-recognized" | "image-only";
  safeReasonCode: Extract<
    FinancialFileErrorCode,
    "IMAGE_ONLY_PDF" | "STRUCTURE_NOT_RECOGNIZED"
  > | null;
  pageCount: number;
  textLayerPresent: boolean;
  tdMarkerDetected: boolean;
  transactionTableDetected: boolean;
  transactionTableBoundaryDetected: boolean;
  transactionHeaderOccurrenceCount: number;
  likelyTransactionRowCount: number;
  withdrawalRowCount: number;
  depositRowCount: number;
  rowsWithRunningBalanceCount: number;
  startingBalanceDetected: boolean;
  closingBalanceDetected: boolean;
  withdrawalTotalDetected: boolean;
  depositTotalDetected: boolean;
  statementPeriodDetected: boolean;
  reconciliationFieldsDetected: boolean;
};

export type TdCreditCardPdfStructuralAnalysis = {
  file: ValidatedPdfMetadata;
  parserVersion: string;
  status: "recognized" | "structure-not-recognized" | "image-only";
  safeReasonCode: Extract<FinancialFileErrorCode, "IMAGE_ONLY_PDF" | "STRUCTURE_NOT_RECOGNIZED"> | null;
  pageCount: number;
  pagesWithTextCount: number;
  statementPageCount: number;
  transactionPageCount: number;
  transactionHeaderOccurrenceCount: number;
  transactionRowCount: number;
  chargeRowCount: number;
  creditRowCount: number;
  continuedMarkerCount: number;
  terminalBalanceMarkerCount: number;
  textLayerPresent: boolean;
  tdMarkerDetected: boolean;
  creditCardMarkerDetected: boolean;
  statementDateDetected: boolean;
  statementPeriodDetected: boolean;
  separateTransactionAndPostingDatesDetected: boolean;
  previousBalanceDetected: boolean;
  newBalanceDetected: boolean;
  paymentDueDateDetected: boolean;
  minimumPaymentDetected: boolean;
  paymentsAndCreditsTotalDetected: boolean;
  purchasesAndChargesTotalDetected: boolean;
  cashAdvancesTotalDetected: boolean;
  interestTotalDetected: boolean;
  feesTotalDetected: boolean;
  transactionTableBoundaryDetected: boolean;
};

export type FinancialFileImportContext = {
  importId: string;
};

export type TdChequingParsedTransaction = {
  sourceRowNumber: number;
  transactionDate: string;
  sourceDescription: string;
  normalizedDescription: string;
  maskedReferenceToken: string | null;
  withdrawalCents: number | null;
  depositCents: number | null;
  runningBalanceCents: number | null;
};

export type TdChequingParsedStatement = {
  parser: {
    providerId: "td";
    accountType: "chequing";
    version: "td-chequing-pdf-v2";
  };
  source: {
    importId: string;
    internalFileId: string;
    sha256: string;
    byteSize: number;
    intakeTimestamp: string;
  };
  currency: "CAD";
  statementPeriod: {
    startDate: string;
    endDate: string;
  };
  openingBalanceCents: number;
  closingBalanceCents: number;
  totalWithdrawalsCents: number;
  totalDepositsCents: number;
  transactions: TdChequingParsedTransaction[];
  reconciliation: {
    status: "passed";
    calculatedClosingBalanceCents: number;
    calculatedWithdrawalsCents: number;
    calculatedDepositsCents: number;
    runningBalancesChecked: number;
  };
};

export type TdCreditCardTransactionEvidence =
  | "purchase"
  | "payment"
  | "refund"
  | "fee"
  | "interest"
  | "reversal"
  | "cash-advance"
  | "credit";

export type TdCreditCardParsedTransaction = {
  sourceRowNumber: number;
  transactionDate: string;
  postedDate: string;
  sourceDescription: string;
  normalizedDescription: string;
  chargeCents: number | null;
  creditCents: number | null;
  sourceTransactionTypeEvidence: TdCreditCardTransactionEvidence;
};

export type TdCreditCardParsedStatement = {
  parser: {
    providerId: "td";
    accountType: "credit-card";
    version: "td-credit-card-pdf-v2";
  };
  source: {
    importId: string;
    internalFileId: string;
    sha256: string;
    byteSize: number;
    intakeTimestamp: string;
  };
  currency: "CAD";
  statementDate: string;
  statementPeriod: { startDate: string; endDate: string };
  paymentDueDate: string;
  minimumPaymentCents: number;
  previousBalanceCents: number;
  paymentsAndCreditsCents: number;
  purchasesAndOtherChargesCents: number;
  cashAdvancesCents: number;
  interestCents: number;
  feesCents: number;
  subtotalCents: number;
  newBalanceCents: number;
  transactions: TdCreditCardParsedTransaction[];
  reconciliation: {
    status: "passed";
    calculatedPaymentsAndCreditsCents: number;
    calculatedPurchasesAndOtherChargesCents: number;
    calculatedCashAdvancesCents: number;
    calculatedInterestCents: number;
    calculatedFeesCents: number;
    calculatedSubtotalCents: number;
    calculatedNewBalanceCents: number;
  };
};
