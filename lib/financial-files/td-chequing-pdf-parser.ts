import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  FinancialFileIntakeError,
  PDF_INTAKE_LIMITS,
  type ValidatedPdfSource,
} from "./pdf-intake.ts";
import {
  ExactMoneyParseError,
  parseUnsignedDecimalMoneyToCents,
} from "./exact-money.ts";
import type {
  FinancialFileErrorCode,
  FinancialFileImportContext,
  TdChequingParsedStatement,
  TdChequingParsedTransaction,
} from "../../types/financial-files.ts";

export const TD_CHEQUING_PDF_PARSER_VERSION = "td-chequing-pdf-v2" as const;

type PositionedText = {
  text: string;
  x: number;
  right: number;
  y: number;
};

type TextLine = {
  text: string;
  items: readonly PositionedText[];
};

type StatementPeriod = TdChequingParsedStatement["statementPeriod"];
type MoneyColumn = "withdrawals" | "deposits" | "balance";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;
const MONTH_NUMBER = new Map(MONTHS.map((month, index) => [month, index + 1]));
const MONTH_PATTERN = MONTHS.join("|");
const TRANSACTION_DATE = new RegExp(`^(${MONTH_PATTERN})\\s*(\\d{1,2})$`, "i");
const STATEMENT_PERIOD = new RegExp(
  `\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?\\s*(?:-|TO)\\s*(${MONTH_PATTERN})\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?\\b`,
  "gi",
);
const MONEY = /^(?:0|[1-9]\d{0,2}(?:,\d{3})*|[1-9]\d*)\.\d{2}$/;
const IMPORT_ID = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/;
const MASKED_REFERENCE_AT_END = /(?:^|\s)((?:\*{3}|X{2,})[A-Z0-9-]+)$/i;
const COLUMN_MAX_DISTANCE = 28;
const COLUMN_MIN_SEPARATION = 8;
const PDF_FRAGMENT_JOIN_DISTANCE = 1;

export class TdChequingParserError extends Error {
  readonly code: Extract<FinancialFileErrorCode,
    | "IMAGE_ONLY_PDF"
    | "TD_CHEQUING_MULTIPAGE_NOT_SUPPORTED"
    | "TD_CHEQUING_STRUCTURE_NOT_RECOGNIZED"
    | "TD_CHEQUING_STATEMENT_PERIOD_INVALID"
    | "TD_CHEQUING_MONEY_INVALID"
    | "TD_CHEQUING_ROW_INVALID"
    | "TD_CHEQUING_RECONCILIATION_FAILED"
    | "TD_CHEQUING_IMPORT_CONTEXT_INVALID"
  >;

  constructor(code: TdChequingParserError["code"]) {
    super(code);
    this.name = "TdChequingParserError";
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

const toPositionedText = (item: unknown): PositionedText | null => {
  if (!item || typeof item !== "object") return null;
  const candidate = item as { str?: unknown; transform?: unknown; width?: unknown };
  if (typeof candidate.str !== "string" || !candidate.str.trim()) return null;
  if (!Array.isArray(candidate.transform) || candidate.transform.length < 6) return null;
  const x = Number(candidate.transform[4]);
  const y = Number(candidate.transform[5]);
  const width = typeof candidate.width === "number" ? candidate.width : 0;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width)) return null;
  return { text: candidate.str.trim(), x, right: x + width, y };
};

const groupIntoLines = (items: readonly PositionedText[]): readonly TextLine[] => {
  const groups: PositionedText[][] = [];
  for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const group = groups.find((candidate) => Math.abs(candidate[0].y - item.y) <= 2);
    if (group) group.push(item);
    else groups.push([item]);
  }
  return groups.map((group) => {
    const ordered = group.sort((a, b) => a.x - b.x);
    const reconstructed: PositionedText[] = [];
    for (const item of ordered) {
      const previous = reconstructed.at(-1);
      if (previous && item.x - previous.right <= PDF_FRAGMENT_JOIN_DISTANCE) {
        previous.text += item.text;
        previous.right = Math.max(previous.right, item.right);
      } else {
        reconstructed.push({ ...item });
      }
    }
    return { text: reconstructed.map((item) => item.text).join(" "), items: reconstructed };
  });
};

const isoDate = (year: number, month: number, day: number): string | null => {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const parseStatementPeriod = (text: string, pdfCreationDate: string | null): StatementPeriod => {
  const normalizedText = text.replace(
    new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2})/(\\d{2})\\b`, "gi"),
    (_match, month: string, day: string, year: string) => `${month} ${day}, 20${year}`,
  );
  const allMatches = [...normalizedText.matchAll(STATEMENT_PERIOD)];
  const datedMatches = allMatches.filter((match) => Boolean(match[3] || match[7]));
  const matches = datedMatches.length > 0 ? datedMatches : allMatches;
  if (matches.length !== 1) {
    throw new TdChequingParserError("TD_CHEQUING_STATEMENT_PERIOD_INVALID");
  }

  const [, startMonthText, startDayText, explicitStartYear, endMonthText, endDayText, explicitEndYear] = matches[0];
  const startMonth = MONTH_NUMBER.get(startMonthText.toUpperCase() as typeof MONTHS[number]);
  const endMonth = MONTH_NUMBER.get(endMonthText.toUpperCase() as typeof MONTHS[number]);
  const creationMatch = pdfCreationDate?.match(/^D:(\d{4})(\d{2})(\d{2})/);
  if (!startMonth || !endMonth || (!explicitStartYear && !explicitEndYear && !creationMatch)) {
    throw new TdChequingParserError("TD_CHEQUING_STATEMENT_PERIOD_INVALID");
  }

  const endYear = explicitEndYear
    ? Number(explicitEndYear)
    : explicitStartYear
      ? Number(explicitStartYear)
      : Number(creationMatch![1]);
  const startYear = explicitStartYear
    ? Number(explicitStartYear)
    : startMonth > endMonth
      ? endYear - 1
      : endYear;
  const startDate = isoDate(startYear, startMonth, Number(startDayText));
  const endDate = isoDate(endYear, endMonth, Number(endDayText));
  if (!startDate || !endDate || startDate > endDate) {
    throw new TdChequingParserError("TD_CHEQUING_STATEMENT_PERIOD_INVALID");
  }
  if (!explicitStartYear && !explicitEndYear) {
    const creationDate = isoDate(
      Number(creationMatch![1]),
      Number(creationMatch![2]),
      Number(creationMatch![3]),
    );
    if (!creationDate) throw new TdChequingParserError("TD_CHEQUING_STATEMENT_PERIOD_INVALID");
    const daysAfterPeriod = (
      Date.parse(`${creationDate}T00:00:00Z`) - Date.parse(`${endDate}T00:00:00Z`)
    ) / 86_400_000;
    if (daysAfterPeriod < 0 || daysAfterPeriod > 7) {
      throw new TdChequingParserError("TD_CHEQUING_STATEMENT_PERIOD_INVALID");
    }
  }
  return { startDate, endDate };
};

const parseTransactionDate = (value: string, period: StatementPeriod): string => {
  const match = TRANSACTION_DATE.exec(value);
  if (!match) throw new TdChequingParserError("TD_CHEQUING_ROW_INVALID");
  const month = MONTH_NUMBER.get(match[1].toUpperCase() as typeof MONTHS[number]);
  if (!month) throw new TdChequingParserError("TD_CHEQUING_ROW_INVALID");

  const startYear = Number(period.startDate.slice(0, 4));
  const endYear = Number(period.endDate.slice(0, 4));
  const candidates = [...new Set([startYear, endYear])]
    .map((year) => isoDate(year, month, Number(match[2])))
    .filter((date): date is string => Boolean(date && date >= period.startDate && date <= period.endDate));
  if (candidates.length !== 1) throw new TdChequingParserError("TD_CHEQUING_ROW_INVALID");
  return candidates[0];
};

const parseMoney = (value: string): number => {
  try {
    return parseUnsignedDecimalMoneyToCents(value);
  } catch (error) {
    if (error instanceof ExactMoneyParseError) {
      throw new TdChequingParserError("TD_CHEQUING_MONEY_INVALID");
    }
    throw error;
  }
};

const classifyColumn = (
  item: PositionedText,
  columns: Readonly<Record<MoneyColumn, number>>,
): MoneyColumn => {
  const distances = (Object.entries(columns) as Array<[MoneyColumn, number]>)
    .map(([column, right]) => [column, Math.abs(item.right - right)] as const)
    .sort((a, b) => a[1] - b[1]);
  if (
    !distances[0]
    || distances[0][1] > COLUMN_MAX_DISTANCE
    || (distances[1] && distances[1][1] - distances[0][1] < COLUMN_MIN_SEPARATION)
  ) {
    throw new TdChequingParserError("TD_CHEQUING_ROW_INVALID");
  }
  return distances[0][0];
};

const monetaryColumns = (
  line: TextLine,
  columns: Readonly<Record<MoneyColumn, number>>,
): ReadonlyMap<MoneyColumn, string> => {
  const values = new Map<MoneyColumn, string>();
  for (const item of line.items.filter((candidate) => MONEY.test(candidate.text))) {
    const column = classifyColumn(item, columns);
    if (values.has(column)) throw new TdChequingParserError("TD_CHEQUING_ROW_INVALID");
    values.set(column, item.text);
  }
  return values;
};

const requiredMoney = (
  values: ReadonlyMap<MoneyColumn, string>,
  column: MoneyColumn,
): number => {
  const value = values.get(column);
  if (!value) throw new TdChequingParserError("TD_CHEQUING_MONEY_INVALID");
  return parseMoney(value);
};

const parseDescription = (items: readonly PositionedText[]) => {
  const sourceDescription = items.map((item) => item.text).join(" ").replace(/\s+/g, " ").trim();
  if (!sourceDescription) throw new TdChequingParserError("TD_CHEQUING_ROW_INVALID");
  const tokenMatch = sourceDescription.match(MASKED_REFERENCE_AT_END);
  const maskedReferenceToken = tokenMatch?.[1] ?? null;
  const normalizedDescription = maskedReferenceToken
    ? sourceDescription.slice(0, tokenMatch!.index).trim()
    : sourceDescription;
  if (!normalizedDescription) throw new TdChequingParserError("TD_CHEQUING_ROW_INVALID");
  return { sourceDescription, normalizedDescription, maskedReferenceToken };
};

const checkedSum = (values: readonly number[]): number => {
  const total = values.reduce((sum, value) => sum + BigInt(value), BigInt(0));
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new TdChequingParserError("TD_CHEQUING_RECONCILIATION_FAILED");
  }
  return Number(total);
};

const parseLines = ({
  lines,
  source,
  importContext,
  pdfCreationDate,
}: {
  lines: readonly TextLine[];
  source: ValidatedPdfSource;
  importContext: FinancialFileImportContext;
  pdfCreationDate: string | null;
}): TdChequingParsedStatement => {
  const allText = lines.map((line) => line.text).join("\n");
  if (!allText.trim()) throw new TdChequingParserError("IMAGE_ONLY_PDF");
  // The validated TD statement exposes a TD marker but no literal "Chequing"
  // token in embedded text. Account type is therefore selected by the adapter;
  // document recognition still requires TD plus the exact reconciled layout.
  if (!/\bTD\b/i.test(allText)) {
    throw new TdChequingParserError("TD_CHEQUING_STRUCTURE_NOT_RECOGNIZED");
  }

  const headerLines = lines.filter((line) =>
    ["description", "withdrawals", "deposits", "date", "balance"]
      .every((header) => line.text.toLowerCase().includes(header)),
  );
  if (headerLines.length !== 1) {
    throw new TdChequingParserError("TD_CHEQUING_STRUCTURE_NOT_RECOGNIZED");
  }
  const headerLine = headerLines[0];
  const headerIndex = lines.indexOf(headerLine);
  const headerItem = (name: string) => headerLine.items.find(
    (item) => item.text.toLowerCase().includes(name),
  );
  const columns = {
    withdrawals: headerItem("withdrawals")?.right,
    deposits: headerItem("deposits")?.right,
    balance: headerItem("balance")?.right,
  };
  if (Object.values(columns).some((value) => typeof value !== "number")) {
    throw new TdChequingParserError("TD_CHEQUING_STRUCTURE_NOT_RECOGNIZED");
  }
  const resolvedColumns = columns as Record<MoneyColumn, number>;

  const startingIndexes = lines
    .map((line, index) => /\bSTARTING\s+BALANCE\b/i.test(line.text) ? index : -1)
    .filter((index) => index > headerIndex);
  const closingIndexes = lines
    .map((line, index) => (
      /\bCLOSING\s+BALANCE\b/i.test(line.text)
      && line.items.filter((item) => MONEY.test(item.text)).length === 1
    ) ? index : -1)
    .filter((index) => index > headerIndex);
  if (startingIndexes.length !== 1 || closingIndexes.length > 1) {
    throw new TdChequingParserError("TD_CHEQUING_STRUCTURE_NOT_RECOGNIZED");
  }
  const startingIndex = startingIndexes[0];
  const closingIndex = closingIndexes[0] ?? null;
  if (startingIndex !== headerIndex + 1 || (closingIndex !== null && closingIndex <= startingIndex + 1)) {
    throw new TdChequingParserError("TD_CHEQUING_STRUCTURE_NOT_RECOGNIZED");
  }

  const totalsIndexes = lines
    .map((line, index) => (
      /^\s*TOTALS?\b/i.test(line.text)
      || (
        line.items.filter((item) => MONEY.test(item.text)).length === 2
        && line.items.every((item) => MONEY.test(item.text))
      )
    ) ? index : -1)
    .filter((index) => index > (closingIndex ?? startingIndex));
  if (
    totalsIndexes.length !== 1
    || (closingIndex !== null && totalsIndexes[0] !== closingIndex + 1)
    || (closingIndex === null && totalsIndexes[0] <= startingIndex + 1)
  ) {
    throw new TdChequingParserError("TD_CHEQUING_STRUCTURE_NOT_RECOGNIZED");
  }
  const totalsIndex = totalsIndexes[0];
  const transactionEndIndex = closingIndex ?? totalsIndex;

  const statementPeriod = parseStatementPeriod(allText, pdfCreationDate);
  const startingMoney = monetaryColumns(lines[startingIndex], resolvedColumns);
  const closingMoney = closingIndex === null ? null : monetaryColumns(lines[closingIndex], resolvedColumns);
  const totalsMoney = monetaryColumns(lines[totalsIndex], resolvedColumns);
  if (startingMoney.size !== 1 || (closingMoney !== null && closingMoney.size !== 1) || totalsMoney.size !== 2) {
    throw new TdChequingParserError("TD_CHEQUING_MONEY_INVALID");
  }
  const openingBalanceCents = requiredMoney(startingMoney, "balance");
  const totalWithdrawalsCents = requiredMoney(totalsMoney, "withdrawals");
  const totalDepositsCents = requiredMoney(totalsMoney, "deposits");

  const transactions: TdChequingParsedTransaction[] = [];
  for (const [offset, line] of lines.slice(startingIndex + 1, transactionEndIndex).entries()) {
    const dateItems = line.items.filter((item) => TRANSACTION_DATE.test(item.text));
    const moneyItems = line.items.filter((item) => MONEY.test(item.text));
    const descriptionItems = line.items.filter(
      (item) => !TRANSACTION_DATE.test(item.text) && !MONEY.test(item.text),
    );
    if (dateItems.length !== 1 || moneyItems.length < 1 || moneyItems.length > 2) {
      throw new TdChequingParserError("TD_CHEQUING_ROW_INVALID");
    }
    const values = monetaryColumns(line, resolvedColumns);
    if (values.size !== moneyItems.length) throw new TdChequingParserError("TD_CHEQUING_ROW_INVALID");
    const withdrawal = values.get("withdrawals");
    const deposit = values.get("deposits");
    if (Boolean(withdrawal) === Boolean(deposit)) {
      throw new TdChequingParserError("TD_CHEQUING_ROW_INVALID");
    }
    transactions.push({
      sourceRowNumber: offset + 1,
      transactionDate: parseTransactionDate(dateItems[0].text, statementPeriod),
      ...parseDescription(descriptionItems),
      withdrawalCents: withdrawal ? parseMoney(withdrawal) : null,
      depositCents: deposit ? parseMoney(deposit) : null,
      runningBalanceCents: values.has("balance") ? requiredMoney(values, "balance") : null,
    });
  }
  if (transactions.length === 0) throw new TdChequingParserError("TD_CHEQUING_ROW_INVALID");

  const calculatedWithdrawalsCents = checkedSum(
    transactions.flatMap((transaction) => transaction.withdrawalCents === null ? [] : [transaction.withdrawalCents]),
  );
  const calculatedDepositsCents = checkedSum(
    transactions.flatMap((transaction) => transaction.depositCents === null ? [] : [transaction.depositCents]),
  );
  const calculatedClosingBalance = BigInt(openingBalanceCents)
    + BigInt(totalDepositsCents)
    - BigInt(totalWithdrawalsCents);
  const closingBalanceCents = closingMoney === null
    ? Number(calculatedClosingBalance)
    : requiredMoney(closingMoney, "balance");
  if (
    calculatedClosingBalance < BigInt(0)
    || calculatedClosingBalance > BigInt(Number.MAX_SAFE_INTEGER)
    || Number(calculatedClosingBalance) !== closingBalanceCents
    || calculatedWithdrawalsCents !== totalWithdrawalsCents
    || calculatedDepositsCents !== totalDepositsCents
  ) {
    throw new TdChequingParserError("TD_CHEQUING_RECONCILIATION_FAILED");
  }

  let runningBalance = BigInt(openingBalanceCents);
  let runningBalancesChecked = 0;
  for (const transaction of transactions) {
    runningBalance += BigInt(transaction.depositCents ?? 0) - BigInt(transaction.withdrawalCents ?? 0);
    if (transaction.runningBalanceCents !== null) {
      runningBalancesChecked += 1;
      if (runningBalance !== BigInt(transaction.runningBalanceCents)) {
        throw new TdChequingParserError("TD_CHEQUING_RECONCILIATION_FAILED");
      }
    }
  }
  if (closingMoney === null && transactions.at(-1)?.runningBalanceCents !== closingBalanceCents) {
    throw new TdChequingParserError("TD_CHEQUING_RECONCILIATION_FAILED");
  }

  return {
    parser: {
      providerId: "td",
      accountType: "chequing",
      version: TD_CHEQUING_PDF_PARSER_VERSION,
    },
    source: {
      importId: importContext.importId,
      internalFileId: source.metadata.internalFileId,
      sha256: source.metadata.sha256,
      byteSize: source.metadata.byteSize,
      intakeTimestamp: source.metadata.intakeTimestamp,
    },
    currency: "CAD",
    statementPeriod,
    openingBalanceCents,
    closingBalanceCents,
    closingBalanceEvidence: closingMoney === null ? "reconciled-final-running-balance" : "statement-label",
    totalWithdrawalsCents,
    totalDepositsCents,
    transactions,
    reconciliation: {
      status: "passed",
      calculatedClosingBalanceCents: Number(calculatedClosingBalance),
      calculatedWithdrawalsCents,
      calculatedDepositsCents,
      runningBalancesChecked,
    },
  };
};

export const parseTdChequingPdf = async ({
  source,
  importContext,
}: {
  source: ValidatedPdfSource;
  importContext: FinancialFileImportContext;
}): Promise<TdChequingParsedStatement> => {
  if (!IMPORT_ID.test(importContext.importId)) {
    throw new TdChequingParserError("TD_CHEQUING_IMPORT_CONTEXT_INVALID");
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
    if (document.numPages > PDF_INTAKE_LIMITS.maximumPages) throw new FinancialFileIntakeError("PAGE_LIMIT_EXCEEDED");
    const metadata = await withTimeout(document.getMetadata());
    const metadataInfo = metadata.info as { CreationDate?: unknown };
    const pdfCreationDate = typeof metadataInfo.CreationDate === "string"
      ? metadataInfo.CreationDate
      : null;
    const pages: PositionedText[][] = [];
    let extractedItemCount = 0;
    let extractedCharacterCount = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await withTimeout(document.getPage(pageNumber));
      const content = await withTimeout(page.getTextContent({ disableNormalization: false }));
      extractedItemCount += content.items.length;
      if (extractedItemCount > PDF_INTAKE_LIMITS.maximumTextItems) throw new FinancialFileIntakeError("TEXT_LIMIT_EXCEEDED");
      const positionedText: PositionedText[] = [];
      for (const item of content.items) {
        const positioned = toPositionedText(item);
        if (!positioned) continue;
        extractedCharacterCount += positioned.text.length;
        if (extractedCharacterCount > PDF_INTAKE_LIMITS.maximumExtractedCharacters) throw new FinancialFileIntakeError("TEXT_LIMIT_EXCEEDED");
        positionedText.push(positioned);
      }
      pages.push(positionedText);
      page.cleanup();
    }
    if (pages.every((items) => items.length === 0)) throw new TdChequingParserError("IMAGE_ONLY_PDF");
    const candidatePages = pages.filter((items) => {
      const text = groupIntoLines(items).map((line) => line.text).join("\n");
      return /\bSTARTING\s+BALANCE\b/i.test(text)
        && /Description.*Withdrawals.*Deposits.*Date.*Balance/i.test(text);
    });
    if (candidatePages.length !== 1) throw new TdChequingParserError("TD_CHEQUING_STRUCTURE_NOT_RECOGNIZED");
    return parseLines({
      lines: groupIntoLines(candidatePages[0]),
      source,
      importContext,
      pdfCreationDate,
    });
  } catch (error) {
    if (error instanceof FinancialFileIntakeError || error instanceof TdChequingParserError) throw error;
    throw safePdfError(error);
  } finally {
    await loadingTask.destroy();
  }
};
