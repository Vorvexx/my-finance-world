export type SyntheticCreditCardRow = {
  transactionDate: string;
  postingDate: string;
  description: string;
  amount: string;
};

export type SyntheticTdCreditCardPdfOptions = {
  rowsByStatementPage?: Readonly<Record<1 | 3 | 4, readonly SyntheticCreditCardRow[]>>;
  previousBalance?: string;
  paymentsAndCredits?: string;
  purchasesAndCharges?: string;
  cashAdvances?: string;
  interest?: string;
  fees?: string;
  subtotal?: string;
  newBalance?: string;
  minimumPayment?: string;
  statementDate?: string;
  statementPeriod?: string;
  paymentDueDate?: string;
  missingTerminal?: boolean;
  duplicateTerminal?: boolean;
  includeTdMarker?: boolean;
  includeCardMarker?: boolean;
};

type TextItem = { x: number; y: number; text: string };

const defaultRows: Readonly<Record<1 | 3 | 4, readonly SyntheticCreditCardRow[]>> = {
  1: [
    { transactionDate: "JUL 8", postingDate: "JUL 9", description: "SYNTHETIC PURCHASE ALPHA", amount: "$100.00" },
    { transactionDate: "JUL 8", postingDate: "JUL 9", description: "SYNTHETIC PURCHASE BETA", amount: "$50.00" },
  ],
  3: [
    { transactionDate: "JUL 10", postingDate: "JUL 11", description: "PREAUTHORIZED PAYMENT", amount: "-$200.00" },
    { transactionDate: "JUL 12", postingDate: "JUL 13", description: "SYNTHETIC MERCHANT REFUND", amount: "-$30.00" },
    { transactionDate: "JUL 14", postingDate: "JUL 15", description: "INTEREST CHARGE", amount: "$10.00" },
  ],
  4: [
    { transactionDate: "AUG 4", postingDate: "AUG 4", description: "ANNUAL FEE", amount: "$20.00" },
  ],
};

const escapePdfText = (value: string) => value
  .replaceAll("\\", "\\\\")
  .replaceAll("(", "\\(")
  .replaceAll(")", "\\)");

const streamFor = (items: readonly TextItem[]) => items
  .map(({ x, y, text }) => `BT /F1 8 Tf 1 0 0 1 ${x} ${y} Tm (${escapePdfText(text)}) Tj ET`)
  .join("\n");

const header = (statementPage: number, options: SyntheticTdCreditCardPdfOptions): TextItem[] => [
  { x: 48, y: 750, text: options.includeTdMarker === false ? "SYNTHETIC BANK" : "TD" },
  { x: 48, y: 720, text: options.includeCardMarker === false ? "SYNTHETIC ACCOUNT" : "Cash Back Visa Card" },
  { x: 48, y: 700, text: "SYNTHETIC_PERSON_NAME" },
  { x: 48, y: 680, text: `STATEMENT DATE: ${options.statementDate ?? "August 04, 2099"}` },
  { x: 300, y: 680, text: `${statementPage} OF 4` },
];

const transactionHeader = (y: number): TextItem[] => [
  { x: 48, y, text: "TRANSACTION" },
  { x: 96, y, text: "POSTING" },
  { x: 48, y: y - 7, text: "DATE" },
  { x: 96, y: y - 7, text: "DATE" },
  { x: 140, y: y - 7, text: "ACTIVITY DESCRIPTION" },
  { x: 309, y: y - 7, text: "AMOUNT($)" },
];

const transactionRows = (rows: readonly SyntheticCreditCardRow[], startY: number): TextItem[] =>
  rows.flatMap((row, index) => {
    const y = startY - index * 19;
    return [
      { x: 48, y, text: row.transactionDate },
      { x: 96, y, text: row.postingDate },
      { x: 140, y, text: row.description },
      { x: 310, y, text: row.amount },
    ];
  });

const statementPageOne = (options: SyntheticTdCreditCardPdfOptions): TextItem[] => [
  ...header(1, options),
  { x: 48, y: 655, text: `STATEMENT PERIOD: ${options.statementPeriod ?? "July 07, 2099 to August 04, 2099"}` },
  ...transactionHeader(625),
  { x: 140, y: 605, text: "PREVIOUS STATEMENT BALANCE" },
  { x: 306, y: 605, text: `$${options.previousBalance ?? "1,000.00"}` },
  ...transactionRows((options.rowsByStatementPage ?? defaultRows)[1], 585),
  { x: 311, y: 530, text: "Continued" },
  { x: 370, y: 620, text: "PAYMENT INFORMATION" },
  { x: 370, y: 600, text: "Minimum Payment" },
  { x: 530, y: 600, text: `$${options.minimumPayment ?? "10.00"}` },
  { x: 370, y: 580, text: "Payment Due Date" },
  { x: 500, y: 580, text: options.paymentDueDate ?? "Aug. 25, 2099" },
  { x: 370, y: 500, text: "CALCULATING YOUR BALANCE" },
  { x: 370, y: 480, text: "Previous Balance" },
  { x: 530, y: 480, text: `$${options.previousBalance ?? "1,000.00"}` },
  { x: 370, y: 460, text: "Payments & Credits" },
  { x: 530, y: 460, text: `$${options.paymentsAndCredits ?? "230.00"}` },
  { x: 370, y: 440, text: "Purchases & Other Charges" },
  { x: 530, y: 440, text: `$${options.purchasesAndCharges ?? "150.00"}` },
  { x: 370, y: 420, text: "Cash Advances" },
  { x: 530, y: 420, text: `$${options.cashAdvances ?? "0.00"}` },
  { x: 370, y: 400, text: "Interest" },
  { x: 530, y: 400, text: `$${options.interest ?? "10.00"}` },
  { x: 370, y: 380, text: "Fees" },
  { x: 530, y: 380, text: `$${options.fees ?? "20.00"}` },
  { x: 370, y: 360, text: "Sub-total" },
  { x: 530, y: 360, text: `$${options.subtotal ?? "180.00"}` },
  { x: 370, y: 340, text: "NEW BALANCE" },
  { x: 530, y: 340, text: `$${options.newBalance ?? "950.00"}` },
  { x: 370, y: 300, text: "Credit Limit" },
  { x: 530, y: 300, text: "$99,999.00" },
];

const statementPageTwo = (options: SyntheticTdCreditCardPdfOptions): TextItem[] => [
  ...header(2, options),
  { x: 48, y: 620, text: "PAYMENT INSTRUCTIONS AND LEGAL TERMS" },
  { x: 48, y: 600, text: "Promotional amount $88,888.00 is unrelated to transaction activity." },
  { x: 48, y: 580, text: "Payment Due Date examples and interest disclosures." },
];

const continuedStatementPage = (
  statementPage: 3 | 4,
  options: SyntheticTdCreditCardPdfOptions,
): TextItem[] => {
  const rows = (options.rowsByStatementPage ?? defaultRows)[statementPage];
  const items = [
    ...header(statementPage, options),
    ...transactionHeader(625),
    ...transactionRows(rows, 605),
  ];
  const endY = 605 - rows.length * 19;
  if (statementPage === 3) items.push({ x: 311, y: endY - 5, text: "Continued" });
  else {
    if (!options.missingTerminal) {
      items.push({ x: 140, y: endY - 5, text: "TOTAL NEW BALANCE" });
      items.push({ x: 310, y: endY - 5, text: `$${options.newBalance ?? "950.00"}` });
      if (options.duplicateTerminal) {
        items.push({ x: 140, y: endY - 24, text: "TOTAL NEW BALANCE" });
        items.push({ x: 310, y: endY - 24, text: `$${options.newBalance ?? "950.00"}` });
      }
    }
    items.push({ x: 48, y: endY - 45, text: options.includeTdMarker === false ? "MESSAGE CENTRE" : "TD MESSAGE CENTRE" });
    items.push({ x: 48, y: endY - 65, text: "Future payment example $77,777.00 is not a transaction." });
  }
  return items;
};

const trailingPage = (pageNumber: number, includeTdMarker: boolean): TextItem[] => pageNumber === 5
  ? [
      { x: 48, y: 740, text: includeTdMarker ? "TD SPECIAL OFFERS AND INFORMATION" : "SPECIAL OFFERS AND INFORMATION" },
      { x: 48, y: 700, text: "Rewards amount $66,666.00 and promotional savings are unrelated." },
    ]
  : pageNumber === 6
    ? [
        { x: 48, y: 740, text: includeTdMarker ? "Important changes to your TD account" : "Important account changes" },
        { x: 48, y: 700, text: "Legal interest example $55,555.00 is unrelated." },
      ]
    : [{ x: 20, y: 400, text: includeTdMarker ? "TD DOCUMENT CONTROL" : "DOCUMENT CONTROL" }];

export const buildSyntheticTdCreditCardPdf = (
  options: SyntheticTdCreditCardPdfOptions = {},
): Uint8Array => {
  const pages: readonly TextItem[][] = [
    statementPageOne(options),
    statementPageTwo(options),
    continuedStatementPage(3, options),
    continuedStatementPage(4, options),
    trailingPage(5, options.includeTdMarker !== false),
    trailingPage(6, options.includeTdMarker !== false),
    trailingPage(7, options.includeTdMarker !== false),
  ];
  const objects: string[] = [];
  const addObject = (value: string) => (objects.push(value), objects.length);
  const catalogId = addObject("");
  const pagesId = addObject("");
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds: number[] = [];
  for (const pageItems of pages) {
    const stream = streamFor(pageItems);
    const contentId = addObject(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    pageIds.push(addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    ));
  }
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
};
