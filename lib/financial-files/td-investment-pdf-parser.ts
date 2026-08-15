import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { ValidatedPdfSource } from "./pdf-intake.ts";
import { parseUnsignedDecimalMoneyToCents } from "./exact-money.ts";
import type { ParsedInvestmentSnapshot } from "../../types/investments.ts";

export const TD_INVESTMENT_PDF_PARSER_VERSION = "td-multi-holding-investment-v1";
type PositionedText = { text: string; x: number; right: number; y: number; page: number };

export class TdInvestmentParserError extends Error {
  readonly code: "TD_INVESTMENT_STRUCTURE_NOT_RECOGNIZED" | "TD_INVESTMENT_PERIOD_INVALID" | "TD_INVESTMENT_VALUE_INVALID";
  constructor(code: TdInvestmentParserError["code"]) { super(code); this.name = "TdInvestmentParserError"; this.code = code; }
}

const MONTHS = new Map<string, number>([["january", 1], ["february", 2], ["march", 3], ["april", 4], ["may", 5], ["june", 6], ["july", 7], ["august", 8], ["september", 9], ["october", 10], ["november", 11], ["december", 12]]);
const DATE_RANGE = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\s+to\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\b/i;
const MONEY = /^\$?(?:0|[1-9]\d{0,2}(?:,\d{3})*|[1-9]\d*)\.\d{2}$/;
const iso = (month: string, day: string, year: string) => `${year}-${String(MONTHS.get(month.toLowerCase())).padStart(2, "0")}-${String(Number(day)).padStart(2, "0")}`;
const money = (value: string) => parseUnsignedDecimalMoneyToCents(value.replace(/^\$/, "").replaceAll(",", ""));

export const parseTdInvestmentPdf = async (source: ValidatedPdfSource): Promise<ParsedInvestmentSnapshot> => {
  const task = getDocument({ data: Uint8Array.from(source.bytes), disableFontFace: true, enableXfa: false, stopAtErrors: true, useWorkerFetch: false, useWasm: false, verbosity: 0 });
  try {
    const document = await task.promise;
    if (document.numPages < 2 || document.numPages > 12) throw new TdInvestmentParserError("TD_INVESTMENT_STRUCTURE_NOT_RECOGNIZED");
    const positioned: PositionedText[] = [];
    for (let page = 1; page <= document.numPages; page += 1) {
      const content = await (await document.getPage(page)).getTextContent({ disableNormalization: false });
      for (const raw of content.items) {
        const item = raw as { str?: unknown; transform?: unknown; width?: unknown };
        if (typeof item.str !== "string" || !item.str.trim() || !Array.isArray(item.transform)) continue;
        const x = Number(item.transform[4]); const y = Number(item.transform[5]); const width = Number(item.width ?? 0);
        if ([x, y, width].every(Number.isFinite)) positioned.push({ text: item.str.trim(), x, right: x + width, y, page });
      }
    }
    const allText = positioned.map((item) => item.text).join(" ");
    const accountType = /Multi-Holding\s+TFSA/i.test(allText) ? "tfsa" as const : /Multi-Holding\s+(?:RSP|RRSP)/i.test(allText) ? "rrsp" as const : null;
    if (!accountType || !/TD Investment Services/i.test(allText)) throw new TdInvestmentParserError("TD_INVESTMENT_STRUCTURE_NOT_RECOGNIZED");
    const periods = [...allText.matchAll(new RegExp(DATE_RANGE.source, "gi"))];
    if (periods.length !== 1) throw new TdInvestmentParserError("TD_INVESTMENT_PERIOD_INVALID");
    const period = periods[0];
    const statementPeriodStart = iso(period[1], period[2], period[3]);
    const statementPeriodEnd = iso(period[4], period[5], period[6]);
    if (statementPeriodStart > statementPeriodEnd) throw new TdInvestmentParserError("TD_INVESTMENT_PERIOD_INVALID");
    const firstPage = positioned.filter((item) => item.page === 1);
    const label = firstPage.find((item) => /Total of all your assets/i.test(item.text));
    if (!label) throw new TdInvestmentParserError("TD_INVESTMENT_VALUE_INVALID");
    const row = firstPage.filter((item) => Math.abs(item.y - label.y) <= 2);
    const book = row.filter((item) => item.x >= 250 && item.right <= 430 && MONEY.test(item.text));
    const market = row.filter((item) => item.x >= 430 && item.right <= 520 && MONEY.test(item.text));
    if (book.length !== 1 || market.length !== 1) throw new TdInvestmentParserError("TD_INVESTMENT_VALUE_INVALID");
    return {
      parserVersion: TD_INVESTMENT_PDF_PARSER_VERSION, providerId: "td", accountType,
      statementPeriodStart, statementPeriodEnd, endingValueCents: money(market[0].text), bookCostCents: money(book[0].text),
      contributionsCents: null, withdrawalsCents: null, employeeContributionsCents: null, employerContributionsCents: null,
      sourceSha256: source.metadata.sha256,
    };
  } finally { await task.destroy(); }
};
