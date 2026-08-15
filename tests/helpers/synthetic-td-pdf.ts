type SyntheticRow = {
  descriptionBlocks: readonly string[];
  withdrawal?: string;
  deposit?: string;
  date?: string;
  balance?: string;
  amountX?: number;
};

export type SyntheticTdPdfOptions = {
  pageCount?: number;
  includeTdMarker?: boolean;
  period?: string;
  creationDate?: string;
  openingBalance?: string;
  closingBalance?: string;
  totalWithdrawals?: string;
  totalDeposits?: string;
  rows?: readonly SyntheticRow[];
  duplicateHeader?: boolean;
  missingTotals?: boolean;
  unexpectedLineBeforeClosing?: boolean;
  misleadingLineAfterClosing?: boolean;
  lowerContent?: boolean;
};

type TextItem = { x: number; y: number; text: string };

const escapePdfText = (value: string) => value
  .replaceAll("\\", "\\\\")
  .replaceAll("(", "\\(")
  .replaceAll(")", "\\)");

const textStream = (items: readonly TextItem[]) => items
  .map(({ x, y, text }) => `BT /F1 8 Tf 1 0 0 1 ${x} ${y} Tm (${escapePdfText(text)}) Tj ET`)
  .join("\n");

const defaultRows: readonly SyntheticRow[] = [
  { descriptionBlocks: ["SYNTHETIC   PAY", "SPLIT"], deposit: "1,000.00", date: "JUL1", balance: "2,000.00" },
  { descriptionBlocks: ["SYNTHETIC ***MID", "PURCHASE"], withdrawal: "300.00", date: "JUL2", balance: "1,700.00" },
  { descriptionBlocks: ["SEND E-TFR", "***REF-A"], withdrawal: "200.00", date: "JUL2" },
  { descriptionBlocks: ["SEND E-TFR", "***REF-B"], withdrawal: "100.00", date: "JUL2" },
  { descriptionBlocks: ["SYNTHETIC", "REBATE"], deposit: "50.00", date: "JUL3", balance: "1,450.00" },
];

const statementItems = (options: SyntheticTdPdfOptions): TextItem[] => {
  const rows = options.rows ?? defaultRows;
  const items: TextItem[] = [
    { x: 48, y: 760, text: options.includeTdMarker === false ? "SYNTHETIC BANK STATEMENT" : "TD SYNTHETIC STATEMENT" },
    { x: 48, y: 744, text: "SYNTHETIC_PERSON_NAME" },
    { x: 48, y: 732, text: "123 SYNTHETIC STREET" },
    { x: 48, y: 720, text: "SYNTHETIC_ACCOUNT_12345" },
    { x: 48, y: 704, text: options.period ?? "Jun 30 - Jul 31, 2099" },
    { x: 48, y: 680, text: "Description" },
    { x: 280, y: 680, text: "Withdrawals" },
    { x: 360, y: 680, text: "Deposits" },
    { x: 430, y: 680, text: "Date" },
    { x: 500, y: 680, text: "Balance" },
    { x: 48, y: 664, text: "STARTING BALANCE" },
    { x: 500, y: 664, text: options.openingBalance ?? "1,000.00" },
  ];

  let y = 648;
  for (const row of rows) {
    row.descriptionBlocks.forEach((block, index) => items.push({ x: 48 + index * 100, y, text: block }));
    if (row.withdrawal) items.push({ x: row.amountX ?? 280, y, text: row.withdrawal });
    if (row.deposit) items.push({ x: row.amountX ?? 360, y, text: row.deposit });
    if (row.date) items.push({ x: 430, y, text: row.date });
    if (row.balance) items.push({ x: 500, y, text: row.balance });
    y -= 16;
  }

  if (options.unexpectedLineBeforeClosing) {
    items.push({ x: 48, y, text: "UNEXPECTED SYNTHETIC CONTENT" });
    y -= 16;
  }
  items.push({ x: 48, y, text: "CLOSING BALANCE" });
  items.push({ x: 500, y, text: options.closingBalance ?? "1,450.00" });
  y -= 16;
  if (options.misleadingLineAfterClosing) {
    items.push({ x: 48, y, text: "MISLEADING FEE" });
    items.push({ x: 280, y, text: "5.00" });
    items.push({ x: 430, y, text: "JUL31" });
    y -= 16;
  }
  if (!options.missingTotals) {
    items.push({ x: 48, y, text: "Totals" });
    items.push({ x: 280, y, text: options.totalWithdrawals ?? "600.00" });
    items.push({ x: 360, y, text: options.totalDeposits ?? "1,050.00" });
    y -= 16;
  }
  if (options.duplicateHeader) {
    items.push({ x: 48, y, text: "Description" });
    items.push({ x: 280, y, text: "Withdrawals" });
    items.push({ x: 360, y, text: "Deposits" });
    items.push({ x: 430, y, text: "Date" });
    items.push({ x: 500, y, text: "Balance" });
    y -= 16;
  }
  if (options.lowerContent) {
    items.push({ x: 48, y, text: "ACCOUNT FEES AND OVERDRAFT INTEREST" });
    y -= 16;
    items.push({ x: 48, y, text: "SYNTHETIC LOWER TABLE ROW" });
    items.push({ x: 280, y, text: "999.99" });
    items.push({ x: 430, y, text: "JUL31" });
    y -= 16;
    items.push({ x: 48, y, text: "UNRELATED_LEGAL_MARKER" });
  }
  return items;
};

export const buildSyntheticTdPdf = (options: SyntheticTdPdfOptions = {}): Uint8Array => {
  const pageCount = options.pageCount ?? 1;
  const objects: string[] = [];
  const addObject = (value: string) => {
    objects.push(value);
    return objects.length;
  };

  const catalogId = addObject("");
  const pagesId = addObject("");
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds: number[] = [];
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const stream = textStream(pageNumber === 1 ? statementItems(options) : [
      { x: 48, y: 760, text: "TD SYNTHETIC SECOND PAGE" },
    ]);
    const contentId = addObject(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageIds.push(pageId);
  }
  const infoId = addObject(`<< /CreationDate (${options.creationDate ?? "D:20990801000000Z"}) >>`);
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
};
