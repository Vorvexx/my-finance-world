import {
  getDocument,
  version as pdfJsVersion,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  FinancialFileIntakeError,
  PDF_INTAKE_LIMITS,
  validateLocalPdf,
  type ValidatedPdfSource,
} from "./pdf-intake.ts";
import type {
  FinancialFileErrorCode,
  TdChequingPdfStructuralAnalysis,
} from "../../types/financial-files.ts";

type PositionedText = {
  text: string;
  pageNumber: number;
  x: number;
  right: number;
  y: number;
};

type TextLine = {
  text: string;
  items: readonly PositionedText[];
  pageNumber: number;
};

const MONTH_DATE = /\b(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*\d{1,2}\b/i;
const STATEMENT_DATE_RANGE = /\b(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{1,2}\s*(?:-|TO)\s*(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+\d{1,2}(?:,?\s+\d{4})?\b/i;
const MONEY = /^-?\$?\d{1,3}(?:,\d{3})*\.\d{2}$/;

const safeParserError = (error: unknown): FinancialFileIntakeError => {
  const name = error && typeof error === "object" && "name" in error
    ? String(error.name)
    : "";
  if (name === "PasswordException") return new FinancialFileIntakeError("PASSWORD_PROTECTED");
  if (name === "InvalidPDFException" || name === "MissingPDFException") {
    return new FinancialFileIntakeError("INVALID_PDF");
  }
  return new FinancialFileIntakeError("TEXT_EXTRACTION_FAILED");
};

const withTimeout = async <T>(operation: Promise<T>, timeoutMilliseconds: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new FinancialFileIntakeError("PDF_ANALYSIS_TIMEOUT")),
          timeoutMilliseconds,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const toPositionedText = (item: unknown, pageNumber: number): PositionedText | null => {
  if (!item || typeof item !== "object") return null;
  const candidate = item as { str?: unknown; transform?: unknown; width?: unknown };
  if (typeof candidate.str !== "string" || !candidate.str.trim()) return null;
  if (!Array.isArray(candidate.transform) || candidate.transform.length < 6) return null;
  const x = Number(candidate.transform[4]);
  const y = Number(candidate.transform[5]);
  const width = typeof candidate.width === "number" ? candidate.width : 0;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width)) return null;
  return { text: candidate.str.trim(), pageNumber, x, right: x + width, y };
};

const groupIntoLines = (items: readonly PositionedText[]): readonly TextLine[] => {
  const groups: PositionedText[][] = [];
  for (const item of [...items].sort(
    (a, b) => a.pageNumber - b.pageNumber || b.y - a.y || a.x - b.x,
  )) {
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
    };
  });
};

const closestColumn = (
  item: PositionedText,
  columns: Readonly<Record<"withdrawals" | "deposits" | "balance", number>>,
) => (Object.entries(columns) as Array<[keyof typeof columns, number]>)
  .sort((a, b) => Math.abs(item.right - a[1]) - Math.abs(item.right - b[1]))[0]?.[0];

const analyzeLines = (
  lines: readonly TextLine[],
  file: TdChequingPdfStructuralAnalysis["file"],
  pageCount: number,
): TdChequingPdfStructuralAnalysis => {
  const allText = lines.map((line) => line.text).join("\n");
  const headerLines = lines.filter((line) =>
    ["description", "withdrawals", "deposits", "date", "balance"]
      .every((header) => line.text.toLowerCase().includes(header)),
  );
  const headerLine = headerLines[0];
  const headerItem = (name: string) => headerLine?.items.find(
    (item) => item.text.toLowerCase().includes(name),
  );
  const columns = {
    withdrawals: headerItem("withdrawals")?.right ?? 0,
    deposits: headerItem("deposits")?.right ?? 0,
    balance: headerItem("balance")?.right ?? 0,
  };
  const headerIndex = headerLine ? lines.indexOf(headerLine) : -1;
  const closingBalanceIndex = lines.findIndex(
    (line, index) => index > headerIndex && /\bCLOSING\s+BALANCE\b/i.test(line.text),
  );
  const totalsIndex = lines.findIndex((line, index) => {
    if (index <= closingBalanceIndex || !/^\s*TOTALS?\b/i.test(line.text)) return false;
    const represented = new Set(
      line.items.filter((item) => MONEY.test(item.text)).map((item) => closestColumn(item, columns)),
    );
    return represented.has("withdrawals") && represented.has("deposits");
  });
  const explicitlyLabelledWithdrawalTotalIndex = lines.findIndex(
    (line, index) => index > headerIndex
      && index < closingBalanceIndex
      && /\bTOTAL\s+WITHDRAWALS?\b/i.test(line.text),
  );
  const explicitlyLabelledDepositTotalIndex = lines.findIndex(
    (line, index) => index > headerIndex
      && index < closingBalanceIndex
      && /\bTOTAL\s+DEPOSITS?\b/i.test(line.text),
  );
  const explicitlyLabelledWithdrawalTotalDetected = explicitlyLabelledWithdrawalTotalIndex > headerIndex;
  const explicitlyLabelledDepositTotalDetected = explicitlyLabelledDepositTotalIndex > headerIndex;
  const transactionTableBoundaryDetected =
    headerIndex >= 0
    && closingBalanceIndex > headerIndex
    && (
      totalsIndex > closingBalanceIndex
      || (explicitlyLabelledWithdrawalTotalDetected && explicitlyLabelledDepositTotalDetected)
    );
  const transactionLines = transactionTableBoundaryDetected
    ? lines.slice(headerIndex + 1, closingBalanceIndex).filter(
      (line) => MONTH_DATE.test(line.text) && !/\bSTARTING\s+BALANCE\b/i.test(line.text),
    )
    : [];
  let withdrawalRowCount = 0;
  let depositRowCount = 0;
  let rowsWithRunningBalanceCount = 0;

  if (headerLine) {
    for (const line of transactionLines) {
      const moneyItems = line.items.filter((item) => MONEY.test(item.text));
      const represented = new Set(moneyItems.map((item) => closestColumn(item, columns)));
      if (represented.has("withdrawals")) withdrawalRowCount += 1;
      if (represented.has("deposits")) depositRowCount += 1;
      if (represented.has("balance")) rowsWithRunningBalanceCount += 1;
    }
  }

  const textLayerPresent = allText.trim().length > 0;
  const tdMarkerDetected = /\b(?:TD|TORONTO\s+DOMINION)\b/i.test(allText);
  const transactionTableDetected = Boolean(headerLine);
  const startingBalanceDetected = /\bSTARTING\s+BALANCE\b/i.test(allText);
  const closingBalanceDetected = /\bCLOSING\s+BALANCE\b/i.test(allText);
  const withdrawalTotalDetected = totalsIndex >= 0 || explicitlyLabelledWithdrawalTotalDetected;
  const depositTotalDetected = totalsIndex >= 0 || explicitlyLabelledDepositTotalDetected;
  const statementPeriodDetected = /\bSTATEMENT\s+PERIOD\b/i.test(allText)
    || STATEMENT_DATE_RANGE.test(allText);
  const recognized = transactionTableDetected
    && transactionTableBoundaryDetected
    && startingBalanceDetected
    && closingBalanceDetected
    && withdrawalTotalDetected
    && depositTotalDetected
    && statementPeriodDetected;
  const status = !textLayerPresent
    ? "image-only"
    : recognized
      ? "recognized"
      : "structure-not-recognized";
  const safeReasonCode: FinancialFileErrorCode | null = !textLayerPresent
    ? "IMAGE_ONLY_PDF"
    : recognized
      ? null
      : "STRUCTURE_NOT_RECOGNIZED";

  return {
    file,
    parserVersion: `pdfjs-dist/${pdfJsVersion};td-chequing-structure/v1`,
    status,
    safeReasonCode: safeReasonCode as TdChequingPdfStructuralAnalysis["safeReasonCode"],
    pageCount,
    textLayerPresent,
    tdMarkerDetected,
    transactionTableDetected,
    transactionTableBoundaryDetected,
    transactionHeaderOccurrenceCount: headerLines.length,
    likelyTransactionRowCount: transactionLines.length,
    withdrawalRowCount,
    depositRowCount,
    rowsWithRunningBalanceCount,
    startingBalanceDetected,
    closingBalanceDetected,
    withdrawalTotalDetected,
    depositTotalDetected,
    statementPeriodDetected,
    reconciliationFieldsDetected:
      startingBalanceDetected && closingBalanceDetected && withdrawalTotalDetected && depositTotalDetected,
  };
};

export const analyzeValidatedTdChequingPdf = async (
  source: ValidatedPdfSource,
): Promise<TdChequingPdfStructuralAnalysis> => {
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
    const document = await withTimeout(
      loadingTask.promise,
      PDF_INTAKE_LIMITS.parserTimeoutMilliseconds,
    );
    if (document.numPages > PDF_INTAKE_LIMITS.maximumPages) {
      throw new FinancialFileIntakeError("PAGE_LIMIT_EXCEEDED");
    }

    const positionedText: PositionedText[] = [];
    let textItemCount = 0;
    let extractedCharacterCount = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await withTimeout(
        document.getPage(pageNumber),
        PDF_INTAKE_LIMITS.parserTimeoutMilliseconds,
      );
      const content = await withTimeout(
        page.getTextContent({ disableNormalization: false }),
        PDF_INTAKE_LIMITS.parserTimeoutMilliseconds,
      );
      textItemCount += content.items.length;
      if (textItemCount > PDF_INTAKE_LIMITS.maximumTextItems) {
        throw new FinancialFileIntakeError("TEXT_LIMIT_EXCEEDED");
      }
      for (const item of content.items) {
        const positioned = toPositionedText(item, pageNumber);
        if (!positioned) continue;
        extractedCharacterCount += positioned.text.length;
        if (extractedCharacterCount > PDF_INTAKE_LIMITS.maximumExtractedCharacters) {
          throw new FinancialFileIntakeError("TEXT_LIMIT_EXCEEDED");
        }
        positionedText.push(positioned);
      }
      page.cleanup();
    }

    return analyzeLines(groupIntoLines(positionedText), source.metadata, document.numPages);
  } catch (error) {
    if (error instanceof FinancialFileIntakeError) throw error;
    throw safeParserError(error);
  } finally {
    await loadingTask.destroy();
  }
};

export const analyzeTdChequingPdf = async ({
  sourcePath,
  allowedRoot,
  intakeTimestamp,
}: {
  sourcePath: string;
  allowedRoot: string;
  intakeTimestamp?: string;
}): Promise<TdChequingPdfStructuralAnalysis> => {
  const source = await validateLocalPdf({ sourcePath, allowedRoot, intakeTimestamp });
  try {
    return await analyzeValidatedTdChequingPdf(source);
  } finally {
    source.bytes.fill(0);
  }
};
