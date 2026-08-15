type TextItem = { x: number; y: number; text: string };
const escape = (value: string) => value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
const stream = (items: readonly TextItem[]) => items.map(({ x, y, text }) => `BT /F1 9 Tf 1 0 0 1 ${x} ${y} Tm (${escape(text)}) Tj ET`).join("\n");

export const buildSyntheticTdInvestmentPdf = ({ accountType = "TFSA", marketValue = "20,000.00" }: { accountType?: "TFSA" | "RSP"; marketValue?: string } = {}) => {
  const objects: string[] = [];
  const add = (value: string) => { objects.push(value); return objects.length; };
  const catalog = add(""); const pages = add(""); const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds: number[] = [];
  for (let page = 1; page <= 4; page += 1) {
    const content = stream(page === 1 ? [
      { x: 48, y: 750, text: `Your TD Multi-Holding ${accountType} statement` },
      { x: 350, y: 720, text: "April 1, 2099 to June 30, 2099" },
      { x: 350, y: 700, text: "TD Investment Services Inc." },
      { x: 54, y: 300, text: "Total of all your assets" },
      { x: 328, y: 300, text: "15,000.00" },
      { x: 467, y: 300, text: marketValue },
      { x: 530, y: 300, text: "100.00%" },
    ] : [{ x: 48, y: 750, text: "Activity in your account this period" }]);
    const contentId = add(`<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${contentId} 0 R >>`));
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pages} 0 R >>`;
  objects[pages - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count 4 >>`;
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf, "latin1")); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
};
