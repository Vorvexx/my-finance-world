import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  FinancialFileIntakeError,
  PDF_INTAKE_LIMITS,
  type ValidatedPdfSource,
} from "./pdf-intake.ts";
import { parseUnsignedDecimalMoneyToCents } from "./exact-money.ts";
import type {
  FinancialFileErrorCode,
  FinancialFileImportContext,
  TdCreditCardParsedStatement,
  TdCreditCardParsedTransaction,
  TdCreditCardTransactionEvidence,
} from "../../types/financial-files.ts";

export const TD_CREDIT_CARD_PDF_PARSER_VERSION = "td-credit-card-pdf-v2" as const;

type PositionedText = { text: string; pageNumber: number; x: number; right: number; y: number };
type TextLine = { text: string; items: readonly PositionedText[]; pageNumber: number; y: number };
type StatementPeriod = TdCreditCardParsedStatement["statementPeriod"];

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
] as const;
const MONTH_PATTERN = "JAN(?:UARY)?|FEB(?:RUARY)?|MAR(?:CH)?|APR(?:IL)?|MAY|JUN(?:E)?|JUL(?:Y)?|AUG(?:UST)?|SEP(?:TEMBER)?|OCT(?:OBER)?|NOV(?:EMBER)?|DEC(?:EMBER)?";
const ROW_DATE = new RegExp(`^(${MONTH_PATTERN})\\.?\\s*(\\d{1,2})$`, "i");
const FULL_DATE = new RegExp(`\\b(${MONTH_PATTERN})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, "i");
const PERIOD = new RegExp(`^(${MONTH_PATTERN})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})\\s+TO\\s+(${MONTH_PATTERN})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})$`, "i");
const SIGNED_AMOUNT = /^(-)?\$?(?:0|[1-9]\d{0,2}(?:,\d{3})*|[1-9]\d*)\.\d{2}$/;
const IMPORT_ID = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/;

export class TdCreditCardParserError extends Error {
  readonly code: Extract<FinancialFileErrorCode,
    | "IMAGE_ONLY_PDF"
    | "TD_CREDIT_CARD_STRUCTURE_NOT_RECOGNIZED"
    | "TD_CREDIT_CARD_STATEMENT_PERIOD_INVALID"
    | "TD_CREDIT_CARD_MONEY_INVALID"
    | "TD_CREDIT_CARD_ROW_INVALID"
    | "TD_CREDIT_CARD_RECONCILIATION_FAILED"
    | "TD_CREDIT_CARD_IMPORT_CONTEXT_INVALID"
  >;

  constructor(code: TdCreditCardParserError["code"]) {
    super(code);
    this.name = "TdCreditCardParserError";
    this.code = code;
  }
}

const withTimeout = async <T>(operation: Promise<T>): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new FinancialFileIntakeError("PDF_ANALYSIS_TIMEOUT")),
          PDF_INTAKE_LIMITS.parserTimeoutMilliseconds,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const safePdfError = (error: unknown) => {
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
  if (name === "PasswordException") return new FinancialFileIntakeError("PASSWORD_PROTECTED");
  if (name === "InvalidPDFException" || name === "MissingPDFException") {
    return new FinancialFileIntakeError("INVALID_PDF");
  }
  return new FinancialFileIntakeError("TEXT_EXTRACTION_FAILED");
};

const toPositionedText = (item: unknown, pageNumber: number): PositionedText | null => {
  if (!item || typeof item !== "object") return null;
  const candidate = item as { str?: unknown; transform?: unknown; width?: unknown };
  if (typeof candidate.str !== "string" || !candidate.str.trim()) return null;
  if (!Array.isArray(candidate.transform) || candidate.transform.length < 6) return null;
  const x = Number(candidate.transform[4]);
  const y = Number(candidate.transform[5]);
  const width = Number(candidate.width ?? 0);
  if (![x, y, width].every(Number.isFinite)) return null;
  return { text: candidate.str.trim(), pageNumber, x, right: x + width, y };
};

const groupIntoLines = (items: readonly PositionedText[]): readonly TextLine[] => {
  const groups: PositionedText[][] = [];
  for (const item of [...items].sort((a, b) => a.pageNumber - b.pageNumber || b.y - a.y || a.x - b.x)) {
    const group = groups.find((candidate) =>
      candidate[0].pageNumber === item.pageNumber && Math.abs(candidate[0].y - item.y) <= 2,
    );
    if (group) group.push(item);
    else groups.push([item]);
  }
  return groups.map((group) => {
    const ordered = group.sort((a, b) => a.x - b.x);
    return {
      text: ordered.map((item) => item.text).join(" "),
      items: ordered,
      pageNumber: ordered[0].pageNumber,
      y: ordered[0].y,
    };
  });
};

const isoDate = (year: number, month: number, day: number) => {
  const value = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day) {
    throw new TdCreditCardParserError("TD_CREDIT_CARD_STATEMENT_PERIOD_INVALID");
  }
  return value;
};

const monthNumber = (value: string) => {
  const index = MONTHS.indexOf(value.slice(0, 3).toUpperCase() as (typeof MONTHS)[number]);
  if (index < 0) throw new TdCreditCardParserError("TD_CREDIT_CARD_STATEMENT_PERIOD_INVALID");
  return index + 1;
};

const parseFullDate = (value: string) => {
  const match = FULL_DATE.exec(value.trim());
  if (!match) throw new TdCreditCardParserError("TD_CREDIT_CARD_STATEMENT_PERIOD_INVALID");
  return isoDate(Number(match[3]), monthNumber(match[1]), Number(match[2]));
};

const parsePeriod = (value: string): StatementPeriod => {
  const match = PERIOD.exec(value.trim());
  if (!match) throw new TdCreditCardParserError("TD_CREDIT_CARD_STATEMENT_PERIOD_INVALID");
  const startDate = isoDate(Number(match[3]), monthNumber(match[1]), Number(match[2]));
  const endDate = isoDate(Number(match[6]), monthNumber(match[4]), Number(match[5]));
  if (startDate > endDate) throw new TdCreditCardParserError("TD_CREDIT_CARD_STATEMENT_PERIOD_INVALID");
  return { startDate, endDate };
};

const parseRowDate = (value: string, period: StatementPeriod, allowedDaysBeforePeriod = 0) => {
  const match = ROW_DATE.exec(value.trim());
  if (!match) throw new TdCreditCardParserError("TD_CREDIT_CARD_ROW_INVALID");
  const month = monthNumber(match[1]);
  const day = Number(match[2]);
  const startYear = Number(period.startDate.slice(0, 4));
  const endYear = Number(period.endDate.slice(0, 4));
  const candidates = [...new Set([startYear, endYear])]
    .map((year) => {
      try { return isoDate(year, month, day); } catch { return null; }
    })
    .filter((candidate): candidate is string => candidate !== null)
    .filter((candidate) => candidate >= new Date(Date.parse(`${period.startDate}T00:00:00Z`) - allowedDaysBeforePeriod * 86_400_000).toISOString().slice(0, 10)
      && candidate <= period.endDate);
  if (candidates.length !== 1) throw new TdCreditCardParserError("TD_CREDIT_CARD_ROW_INVALID");
  return candidates[0];
};

const parseAmount = (value: string): { cents: number; credit: boolean } => {
  const match = SIGNED_AMOUNT.exec(value.trim());
  if (!match) throw new TdCreditCardParserError("TD_CREDIT_CARD_MONEY_INVALID");
  try {
    return {
      cents: parseUnsignedDecimalMoneyToCents(value.replace(/^-?\$/, "").replace(/^-/, "")),
      credit: Boolean(match[1]),
    };
  } catch {
    throw new TdCreditCardParserError("TD_CREDIT_CARD_MONEY_INVALID");
  }
};

const evidenceFor = (description: string, credit: boolean): TdCreditCardTransactionEvidence => {
  if (/\bREVERS(?:AL|ED)\b/i.test(description)) return "reversal";
  if (credit) {
    if (/\b(?:PAYMENT|PYMT)\b/i.test(description)) return "payment";
    if (/\b(?:REFUND|REBATE)\b/i.test(description)) return "refund";
    return "credit";
  }
  if (/\bINTEREST\b/i.test(description)) return "interest";
  if (/\b(?:ANNUAL|ACCOUNT|OVERLIMIT|CASH\s+ADVANCE|BALANCE\s+TRANSFER|FOREIGN\s+CURRENCY)\s+FEE\b/i.test(description)) return "fee";
  if (/\b(?:CASH\s+ADVANCE|BALANCE\s+TRANSFER)\b/i.test(description)) return "cash-advance";
  return "purchase";
};

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

export const parseTdCreditCardPdf = async ({
  source,
  importContext,
}: {
  source: ValidatedPdfSource;
  importContext: FinancialFileImportContext;
}): Promise<TdCreditCardParsedStatement> => {
  if (!IMPORT_ID.test(importContext.importId) || source.metadata.status !== "validated") {
    throw new TdCreditCardParserError("TD_CREDIT_CARD_IMPORT_CONTEXT_INVALID");
  }
  const loadingTask = getDocument({
    data: source.bytes.slice(),
    disableFontFace: true,
    enableXfa: false,
    maxImageSize: 20_000_000,
    stopAtErrors: true,
    useWorkerFetch: false,
    useWasm: false,
    verbosity: 0,
  });
  try {
    const document = await withTimeout(loadingTask.promise);
    if (document.numPages > PDF_INTAKE_LIMITS.maximumPages) {
      throw new FinancialFileIntakeError("PAGE_LIMIT_EXCEEDED");
    }
    const positioned: PositionedText[] = [];
    let itemCount = 0;
    let characterCount = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await withTimeout(document.getPage(pageNumber));
      const content = await withTimeout(page.getTextContent({ disableNormalization: false }));
      itemCount += content.items.length;
      if (itemCount > PDF_INTAKE_LIMITS.maximumTextItems) throw new FinancialFileIntakeError("TEXT_LIMIT_EXCEEDED");
      for (const item of content.items) {
        const value = toPositionedText(item, pageNumber);
        if (!value) continue;
        characterCount += value.text.length;
        if (characterCount > PDF_INTAKE_LIMITS.maximumExtractedCharacters) {
          throw new FinancialFileIntakeError("TEXT_LIMIT_EXCEEDED");
        }
        positioned.push(value);
      }
      page.cleanup();
    }
    if (positioned.length === 0) throw new TdCreditCardParserError("IMAGE_ONLY_PDF");
    const lines = groupIntoLines(positioned);
    const allText = lines.map((line) => line.text).join("\n");
    if (!/\bTD\b|TORONTO[-\s]+DOMINION/i.test(allText)) {
      throw new TdCreditCardParserError("TD_CREDIT_CARD_STRUCTURE_NOT_RECOGNIZED");
    }
    const headerText = lines.filter((line) => line.pageNumber === 1 && line.y > 650)
      .map((line) => line.items.filter((item) => item.x < 360).map((item) => item.text).join(" ")).join("\n");
    if (!/\b(?:VISA|MASTERCARD|CREDIT\s+CARD|CARDHOLDER)\b/i.test(headerText)) {
      throw new TdCreditCardParserError("TD_CREDIT_CARD_STRUCTURE_NOT_RECOGNIZED");
    }
    const statementPages = new Set<number>();
    const statementPageTotals = new Set<number>();
    for (const match of allText.matchAll(/\b(\d+)\s+OF\s+(\d+)\b/gi)) {
      statementPages.add(Number(match[1]));
      statementPageTotals.add(Number(match[2]));
    }
    const statementPageTotal = [...statementPageTotals][0];
    if (statementPageTotals.size !== 1 || !statementPageTotal || statementPageTotal < 2
      || statementPageTotal > PDF_INTAKE_LIMITS.maximumPages || statementPages.size !== statementPageTotal
      || [...statementPages].some((page) => page < 1 || page > statementPageTotal)) {
      throw new TdCreditCardParserError("TD_CREDIT_CARD_STRUCTURE_NOT_RECOGNIZED");
    }

    const leftText = lines.filter((line) => line.pageNumber === 1)
      .map((line) => line.items.filter((item) => item.x < 350).map((item) => item.text).join(" "));
    const statementDateLine = leftText.find((line) => /\bSTATEMENT\s+DATE\s*:/i.test(line));
    const periodLine = leftText.find((line) => /\bSTATEMENT\s+PERIOD\s*:/i.test(line));
    if (!statementDateLine || !periodLine) {
      throw new TdCreditCardParserError("TD_CREDIT_CARD_STATEMENT_PERIOD_INVALID");
    }
    const statementDate = parseFullDate(statementDateLine.replace(/^.*?STATEMENT\s+DATE\s*:\s*/i, ""));
    const statementPeriod = parsePeriod(periodLine.replace(/^.*?STATEMENT\s+PERIOD\s*:\s*/i, ""));
    if (statementDate !== statementPeriod.endDate) {
      throw new TdCreditCardParserError("TD_CREDIT_CARD_STATEMENT_PERIOD_INVALID");
    }

    const rightLines = lines.filter((line) => line.pageNumber === 1).map((line) => ({
      text: line.items.filter((item) => item.x >= 360).map((item) => item.text).join(" "),
      items: line.items.filter((item) => item.x >= 360),
      y: line.y,
    }));
    const rightValue = (label: RegExp, maximumY = Number.POSITIVE_INFINITY) => {
      const matches = rightLines.filter((line) =>
        line.y > 250 && line.y < maximumY && label.test(line.text)
        && line.items.some((item) => item.x > 500 && SIGNED_AMOUNT.test(item.text)),
      );
      if (matches.length !== 1) throw new TdCreditCardParserError("TD_CREDIT_CARD_STRUCTURE_NOT_RECOGNIZED");
      const amount = matches[0].items.find((item) => item.x > 500 && SIGNED_AMOUNT.test(item.text));
      if (!amount) throw new TdCreditCardParserError("TD_CREDIT_CARD_MONEY_INVALID");
      const parsed = parseAmount(amount.text);
      if (parsed.credit) throw new TdCreditCardParserError("TD_CREDIT_CARD_MONEY_INVALID");
      return parsed.cents;
    };
    const rightDate = (label: RegExp) => {
      const matches = rightLines.filter((line) => line.y > 250 && label.test(line.text) && FULL_DATE.test(line.text));
      if (matches.length !== 1) throw new TdCreditCardParserError("TD_CREDIT_CARD_STRUCTURE_NOT_RECOGNIZED");
      const labelEnd = matches[0].text.match(label)?.[0] ?? "";
      return parseFullDate(matches[0].text.slice(matches[0].text.indexOf(labelEnd) + labelEnd.length).trim());
    };

    const minimumPaymentCents = rightValue(/\bMINIMUM\s+PAYMENT\b/i);
    const paymentDueDate = rightDate(/\bPAYMENT\s+DUE\s+DATE\b/i);
    if (paymentDueDate <= statementDate) {
      throw new TdCreditCardParserError("TD_CREDIT_CARD_STATEMENT_PERIOD_INVALID");
    }
    const previousBalanceCents = rightValue(/\bPREVIOUS\s+BALANCE\b/i, 520);
    const paymentsAndCreditsCents = rightValue(/\bPAYMENTS?\s*&\s*CREDITS?\b/i, 520);
    const purchasesAndOtherChargesCents = rightValue(/\bPURCHASES?\s*&\s*OTHER\s+CHARGES?\b/i, 520);
    const cashAdvancesCents = rightValue(/^\s*CASH\s+ADVANCES?\b/i, 520);
    const interestCents = rightValue(/^\s*INTEREST\b/i, 520);
    const feesCents = rightValue(/^\s*FEES\b/i, 520);
    const subtotalCents = rightValue(/\bSUB-TOTAL\b/i, 520);
    const newBalanceCents = rightValue(/^\s*NEW\s+BALANCE\b/i, 520);

    const sections: Array<{ pageNumber: number; headerY: number; lowerY: number }> = [];
    let terminalBalanceCents: number | null = null;
    let tablePreviousBalanceCents: number | null = null;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const pageLines = lines.filter((line) => line.pageNumber === pageNumber);
      const top = pageLines.find((line) => /\bTRANSACTION\b/i.test(line.text) && /\bPOSTING\b/i.test(line.text));
      const bottom = pageLines.find((line) => top && Math.abs(line.y - top.y) <= 10
        && /\bACTIVITY\b/i.test(line.text) && /\bDESCRIPTION\b/i.test(line.text) && /\bAMOUNT\b/i.test(line.text));
      if (!top || !bottom) continue;
      const terminal = pageLines.filter((line) => /\bTOTAL\s+NEW\s+BALANCE\b/i.test(line.text));
      const continued = pageLines.filter((line) =>
        line.items.some((item) => item.x < 360 && /^\s*CONTINUED\s*$/i.test(item.text)),
      );
      if (terminal.length + continued.length !== 1) {
        throw new TdCreditCardParserError("TD_CREDIT_CARD_STRUCTURE_NOT_RECOGNIZED");
      }
      const boundary = terminal[0] ?? continued[0];
      if (terminal.length === 1) {
        if (terminalBalanceCents !== null) throw new TdCreditCardParserError("TD_CREDIT_CARD_STRUCTURE_NOT_RECOGNIZED");
        const amount = terminal[0].items.find((item) => item.x > 285 && item.right < 360 && SIGNED_AMOUNT.test(item.text));
        if (!amount) throw new TdCreditCardParserError("TD_CREDIT_CARD_MONEY_INVALID");
        terminalBalanceCents = parseAmount(amount.text).cents;
      }
      sections.push({ pageNumber, headerY: Math.min(top.y, bottom.y), lowerY: boundary.y });
    }
    if (sections.length === 0 || terminalBalanceCents === null) {
      throw new TdCreditCardParserError("TD_CREDIT_CARD_STRUCTURE_NOT_RECOGNIZED");
    }

    const transactions: TdCreditCardParsedTransaction[] = [];
    let lastTransactionPageNumber = -1;
    let lastTransactionY = Number.POSITIVE_INFINITY;
    for (const section of sections) {
      const activityLines = lines.filter((line) =>
        line.pageNumber === section.pageNumber && line.y < section.headerY && line.y > section.lowerY,
      );
      for (const line of activityLines) {
        const leftItems = line.items.filter((item) => item.x < 360);
        const leftLine = leftItems.map((item) => item.text).join(" ");
        if (/\bPREVIOUS\s+STATEMENT(?:\s+BALANCE)?\b/i.test(leftLine)) {
          const amount = leftItems.find((item) => item.x > 285 && SIGNED_AMOUNT.test(item.text));
          if (!amount || tablePreviousBalanceCents !== null) {
            throw new TdCreditCardParserError("TD_CREDIT_CARD_STRUCTURE_NOT_RECOGNIZED");
          }
          tablePreviousBalanceCents = parseAmount(amount.text).cents;
          continue;
        }
        const dateItems = leftItems.filter((item) => item.x < 130 && ROW_DATE.test(item.text));
        const amountItems = leftItems.filter((item) => item.x > 285 && item.right < 360 && SIGNED_AMOUNT.test(item.text));
        if (dateItems.length === 0 && amountItems.length === 0 && !leftLine.trim()) continue;
        if (
          dateItems.length === 0
          && amountItems.length === 0
          && leftItems.length > 0
          && leftItems.every((item) => item.x >= 130 && item.x < 285)
          && lastTransactionPageNumber === section.pageNumber
          && lastTransactionY - line.y >= 7
          && lastTransactionY - line.y <= 13
          && transactions.length > 0
        ) {
          const continuation = leftItems.map((item) => item.text).join(" ").replace(/\s+/g, " ").trim();
          const previous = transactions[transactions.length - 1];
          previous.sourceDescription = `${previous.sourceDescription} ${continuation}`;
          previous.normalizedDescription = previous.sourceDescription;
          lastTransactionPageNumber = section.pageNumber;
          lastTransactionY = line.y;
          continue;
        }
        // Historical TD layouts place non-financial annotations and page furniture
        // inside the visual activity boundary. They carry neither row dates nor an
        // amount, so they cannot be transaction evidence and are ignored. A partial
        // financial row (date without amount or amount without dates) still fails.
        if (dateItems.length === 0 && amountItems.length === 0) continue;
        if (dateItems.length !== 2 || amountItems.length !== 1) {
          throw new TdCreditCardParserError("TD_CREDIT_CARD_ROW_INVALID");
        }
        const description = leftItems.filter((item) => item.x >= 130 && item.x < 285)
          .map((item) => item.text).join(" ").replace(/\s+/g, " ").trim();
        if (!description) throw new TdCreditCardParserError("TD_CREDIT_CARD_ROW_INVALID");
        const parsedAmount = parseAmount(amountItems[0].text);
        if (parsedAmount.cents <= 0) throw new TdCreditCardParserError("TD_CREDIT_CARD_MONEY_INVALID");
        transactions.push({
          sourceRowNumber: transactions.length + 1,
          transactionDate: parseRowDate(dateItems[0].text, statementPeriod, 7),
          postedDate: parseRowDate(dateItems[1].text, statementPeriod),
          sourceDescription: description,
          normalizedDescription: description,
          chargeCents: parsedAmount.credit ? null : parsedAmount.cents,
          creditCents: parsedAmount.credit ? parsedAmount.cents : null,
          sourceTransactionTypeEvidence: evidenceFor(description, parsedAmount.credit),
        });
        lastTransactionPageNumber = section.pageNumber;
        lastTransactionY = line.y;
      }
    }
    if (transactions.length === 0 || tablePreviousBalanceCents !== previousBalanceCents) {
      throw new TdCreditCardParserError("TD_CREDIT_CARD_RECONCILIATION_FAILED");
    }

    const calculatedPaymentsAndCreditsCents = sum(transactions.flatMap((row) => row.creditCents ?? []));
    const calculatedPurchasesAndOtherChargesCents = sum(transactions
      .filter((row) => row.sourceTransactionTypeEvidence === "purchase")
      .flatMap((row) => row.chargeCents ?? []));
    const calculatedCashAdvancesCents = sum(transactions
      .filter((row) => row.sourceTransactionTypeEvidence === "cash-advance")
      .flatMap((row) => row.chargeCents ?? []));
    const calculatedInterestCents = sum(transactions
      .filter((row) => row.sourceTransactionTypeEvidence === "interest")
      .flatMap((row) => row.chargeCents ?? []));
    const calculatedFeesCents = sum(transactions
      .filter((row) => row.sourceTransactionTypeEvidence === "fee")
      .flatMap((row) => row.chargeCents ?? []));
    const calculatedSubtotalCents = calculatedPurchasesAndOtherChargesCents
      + calculatedCashAdvancesCents + calculatedInterestCents + calculatedFeesCents;
    const calculatedNewBalanceCents = previousBalanceCents - calculatedPaymentsAndCreditsCents + calculatedSubtotalCents;
    if (
      calculatedPaymentsAndCreditsCents !== paymentsAndCreditsCents
      || calculatedPurchasesAndOtherChargesCents !== purchasesAndOtherChargesCents
      || calculatedCashAdvancesCents !== cashAdvancesCents
      || calculatedInterestCents !== interestCents
      || calculatedFeesCents !== feesCents
      || calculatedSubtotalCents !== subtotalCents
      || calculatedNewBalanceCents !== newBalanceCents
      || terminalBalanceCents !== newBalanceCents
    ) throw new TdCreditCardParserError("TD_CREDIT_CARD_RECONCILIATION_FAILED");

    return {
      parser: { providerId: "td", accountType: "credit-card", version: TD_CREDIT_CARD_PDF_PARSER_VERSION },
      source: {
        importId: importContext.importId,
        internalFileId: source.metadata.internalFileId,
        sha256: source.metadata.sha256,
        byteSize: source.metadata.byteSize,
        intakeTimestamp: source.metadata.intakeTimestamp,
      },
      currency: "CAD",
      statementDate,
      statementPeriod,
      paymentDueDate,
      minimumPaymentCents,
      previousBalanceCents,
      paymentsAndCreditsCents,
      purchasesAndOtherChargesCents,
      cashAdvancesCents,
      interestCents,
      feesCents,
      subtotalCents,
      newBalanceCents,
      transactions,
      reconciliation: {
        status: "passed",
        calculatedPaymentsAndCreditsCents,
        calculatedPurchasesAndOtherChargesCents,
        calculatedCashAdvancesCents,
        calculatedInterestCents,
        calculatedFeesCents,
        calculatedSubtotalCents,
        calculatedNewBalanceCents,
      },
    };
  } catch (error) {
    if (error instanceof FinancialFileIntakeError || error instanceof TdCreditCardParserError) throw error;
    throw safePdfError(error);
  } finally {
    await loadingTask.destroy();
  }
};
