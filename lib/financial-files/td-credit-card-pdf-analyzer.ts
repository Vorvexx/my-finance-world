import { getDocument, version as pdfJsVersion } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  FinancialFileIntakeError,
  PDF_INTAKE_LIMITS,
  validateLocalPdf,
  type ValidatedPdfSource,
} from "./pdf-intake.ts";
import type {
  FinancialFileErrorCode,
  TdCreditCardPdfStructuralAnalysis,
} from "../../types/financial-files.ts";

type PositionedText = { text: string; pageNumber: number; x: number; right: number; y: number };
type TextLine = { text: string; items: readonly PositionedText[]; pageNumber: number; y: number };

const DATE = /^(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*\d{1,2}$/i;
const AMOUNT = /^(-)?\$?(?:0|[1-9]\d{0,2}(?:,\d{3})*|[1-9]\d*)\.\d{2}$/;

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

const safeParserError = (error: unknown) => {
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

const analyzeLines = (
  lines: readonly TextLine[],
  file: TdCreditCardPdfStructuralAnalysis["file"],
  pageCount: number,
): TdCreditCardPdfStructuralAnalysis => {
  const allText = lines.map((line) => line.text).join("\n");
  const pagesWithTextCount = new Set(lines.map((line) => line.pageNumber)).size;
  const statementPages = new Set<number>();
  const statementPageTotals = new Set<number>();
  for (const match of allText.matchAll(/\b(\d+)\s+OF\s+(\d+)\b/gi)) {
    statementPages.add(Number(match[1]));
    statementPageTotals.add(Number(match[2]));
  }
  const statementPageTotal = [...statementPageTotals][0];
  const statementPageSequenceValid = statementPageTotals.size === 1 && Boolean(statementPageTotal)
    && statementPageTotal >= 2 && statementPageTotal <= PDF_INTAKE_LIMITS.maximumPages
    && statementPages.size === statementPageTotal
    && [...statementPages].every((page) => page >= 1 && page <= statementPageTotal);

  const transactionPages = new Map<number, { headerY: number; terminalY: number | null; continuedY: number | null }>();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const pageLines = lines.filter((line) => line.pageNumber === pageNumber);
    const headerTop = pageLines.find((line) => /\bTRANSACTION\b/i.test(line.text) && /\bPOSTING\b/i.test(line.text));
    const headerBottom = pageLines.find((line) =>
      headerTop
      && Math.abs(line.y - headerTop.y) <= 10
      && /\bACTIVITY\b/i.test(line.text)
      && /\bDESCRIPTION\b/i.test(line.text)
      && /\bAMOUNT\b/i.test(line.text),
    );
    if (!headerTop || !headerBottom) continue;
    const terminal = pageLines.find((line) => /\bTOTAL\s+NEW\s+BALANCE\b/i.test(line.text));
    const continued = pageLines.find((line) =>
      line.items.some((item) => item.x < 360 && /^\s*CONTINUED\s*$/i.test(item.text)),
    );
    transactionPages.set(pageNumber, {
      headerY: Math.min(headerTop.y, headerBottom.y),
      terminalY: terminal?.y ?? null,
      continuedY: continued?.y ?? null,
    });
  }

  let transactionRowCount = 0;
  let chargeRowCount = 0;
  let creditRowCount = 0;
  for (const [pageNumber, boundary] of transactionPages) {
    const lowerBoundary = boundary.terminalY ?? boundary.continuedY ?? -Infinity;
    for (const line of lines.filter((candidate) =>
      candidate.pageNumber === pageNumber
      && candidate.y < boundary.headerY
      && candidate.y > lowerBoundary,
    )) {
      const dates = line.items.filter((item) => item.x < 130 && DATE.test(item.text));
      const amount = line.items.find((item) => item.x > 285 && item.right < 360 && AMOUNT.test(item.text));
      if (dates.length !== 2 || !amount) continue;
      transactionRowCount += 1;
      if (amount.text.startsWith("-")) creditRowCount += 1;
      else chargeRowCount += 1;
    }
  }

  const textLayerPresent = allText.trim().length > 0;
  const statementHeaderText = lines.filter((line) =>
    line.pageNumber === 1 && line.y > 650 && line.items.some((item) => item.x < 360),
  ).map((line) => line.text).join("\n");
  const tdMarkerDetected = /\bTD\b|TORONTO[-\s]+DOMINION/i.test(allText);
  const creditCardMarkerDetected = /\b(?:VISA|MASTERCARD|CREDIT\s+CARD|CARDHOLDER)\b/i.test(statementHeaderText);
  const transactionHeaderOccurrenceCount = transactionPages.size;
  const continuedMarkerCount = lines.reduce(
    (count, line) => count + line.items.filter((item) => item.x < 360 && /^\s*CONTINUED\s*$/i.test(item.text)).length,
    0,
  );
  const terminalBalanceMarkerCount = lines.filter((line) => /\bTOTAL\s+NEW\s+BALANCE\b/i.test(line.text)).length;
  const transactionTableBoundaryDetected = transactionPages.size > 0
    && [...transactionPages.values()].every((boundary) => boundary.continuedY !== null || boundary.terminalY !== null)
    && terminalBalanceMarkerCount === 1;
  const statementPeriodDetected = /\bSTATEMENT\s+PERIOD\s*:/i.test(allText)
    && /\bTO\b/i.test(allText);
  const statementDateDetected = /\bSTATEMENT\s+DATE\s*:/i.test(allText);
  const previousBalanceDetected = /\bPREVIOUS\s+(?:STATEMENT\s+)?BALANCE\b/i.test(allText);
  const newBalanceDetected = /\bNEW\s+BALANCE\b/i.test(allText) && terminalBalanceMarkerCount === 1;
  const paymentDueDateDetected = /\bPAYMENT\s+DUE\s+DATE\b/i.test(allText);
  const minimumPaymentDetected = /\bMINIMUM\s+PAYMENT\b/i.test(allText);
  const paymentsAndCreditsTotalDetected = /\bPAYMENTS?\s*&\s*CREDITS?\b/i.test(allText);
  const purchasesAndChargesTotalDetected = /\bPURCHASES?\s*&\s*OTHER\s+CHARGES?\b/i.test(allText);
  const cashAdvancesTotalDetected = /\bCASH\s+ADVANCES?\b/i.test(allText);
  const interestTotalDetected = /\bINTEREST\b/i.test(allText);
  const feesTotalDetected = /\bFEES\b/i.test(allText);
  const recognized = tdMarkerDetected
    && creditCardMarkerDetected
    && statementPageSequenceValid
    && transactionHeaderOccurrenceCount > 0
    && transactionRowCount > 0
    && statementDateDetected
    && statementPeriodDetected
    && previousBalanceDetected
    && newBalanceDetected
    && paymentDueDateDetected
    && minimumPaymentDetected
    && paymentsAndCreditsTotalDetected
    && purchasesAndChargesTotalDetected
    && cashAdvancesTotalDetected
    && interestTotalDetected
    && feesTotalDetected
    && transactionTableBoundaryDetected;
  const status = !textLayerPresent ? "image-only" : recognized ? "recognized" : "structure-not-recognized";
  const safeReasonCode: FinancialFileErrorCode | null = !textLayerPresent
    ? "IMAGE_ONLY_PDF"
    : recognized
      ? null
      : "STRUCTURE_NOT_RECOGNIZED";

  return {
    file,
    parserVersion: `pdfjs-dist/${pdfJsVersion};td-credit-card-structure/v1`,
    status,
    safeReasonCode: safeReasonCode as TdCreditCardPdfStructuralAnalysis["safeReasonCode"],
    pageCount,
    pagesWithTextCount,
    statementPageCount: statementPages.size,
    transactionPageCount: transactionPages.size,
    transactionHeaderOccurrenceCount,
    transactionRowCount,
    chargeRowCount,
    creditRowCount,
    continuedMarkerCount,
    terminalBalanceMarkerCount,
    textLayerPresent,
    tdMarkerDetected,
    creditCardMarkerDetected,
    statementDateDetected,
    statementPeriodDetected,
    separateTransactionAndPostingDatesDetected: transactionRowCount > 0,
    previousBalanceDetected,
    newBalanceDetected,
    paymentDueDateDetected,
    minimumPaymentDetected,
    paymentsAndCreditsTotalDetected,
    purchasesAndChargesTotalDetected,
    cashAdvancesTotalDetected,
    interestTotalDetected,
    feesTotalDetected,
    transactionTableBoundaryDetected,
  };
};

export const analyzeValidatedTdCreditCardPdf = async (
  source: ValidatedPdfSource,
): Promise<TdCreditCardPdfStructuralAnalysis> => {
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
      if (itemCount > PDF_INTAKE_LIMITS.maximumTextItems) {
        throw new FinancialFileIntakeError("TEXT_LIMIT_EXCEEDED");
      }
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
    return analyzeLines(groupIntoLines(positioned), source.metadata, document.numPages);
  } catch (error) {
    if (error instanceof FinancialFileIntakeError) throw error;
    throw safeParserError(error);
  } finally {
    await loadingTask.destroy();
  }
};

export const analyzeTdCreditCardPdf = async ({
  sourcePath,
  allowedRoot,
  intakeTimestamp,
}: {
  sourcePath: string;
  allowedRoot: string;
  intakeTimestamp?: string;
}): Promise<TdCreditCardPdfStructuralAnalysis> => {
  const source = await validateLocalPdf({ sourcePath, allowedRoot, intakeTimestamp });
  try {
    return await analyzeValidatedTdCreditCardPdf(source);
  } finally {
    source.bytes.fill(0);
  }
};
