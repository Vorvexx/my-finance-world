import { createHash } from "node:crypto";
import type { RawTransaction } from "@/types/transactions";

const parseLine = (line: string) => {
  const cells: string[] = []; let cell = ""; let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && quoted && line[i + 1] === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { cells.push(cell.trim()); cell = ""; }
    else cell += char;
  }
  cells.push(cell.trim()); return cells;
};

const amount = (value: string) => Number(value.replace(/[$,\s]/g, "").replace(/^\((.*)\)$/, "-$1"));
const date = (value: string) => {
  const cleaned = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  const match = cleaned.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!match) throw new Error("TD statement contains an unsupported date.");
  return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
};
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

export type ParsedTdStatement = { accountId: string; accountType: "chequing" | "credit-card"; rows: RawTransaction[]; startDate: string; endDate: string };

export const parseTdCsv = (text: string, filename: string, observedAt: string): ParsedTdStatement => {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("Statement has no transaction rows.");
  const header = parseLine(lines[0]).map(slug);
  const index = (...names: string[]) => names.map((name) => header.indexOf(name)).find((value) => value >= 0) ?? -1;
  const dateIndex = index("date", "transactiondate");
  const descIndex = index("description", "transactiondescription", "merchantname");
  const debitIndex = index("withdrawals", "withdrawal", "debit");
  const creditIndex = index("deposits", "deposit", "credit");
  const amountIndex = index("amount");
  const accountIndex = index("account", "accountnumber", "cardnumber");
  if (dateIndex < 0 || descIndex < 0 || (amountIndex < 0 && debitIndex < 0 && creditIndex < 0)) throw new Error("Unsupported TD CSV columns.");
  const creditCard = /credit|visa|mastercard/i.test(filename) || (amountIndex >= 0 && debitIndex < 0);
  const rows: RawTransaction[] = [];
  for (const [position, line] of lines.slice(1).entries()) {
    const cells = parseLine(line); const transactionDate = date(cells[dateIndex] ?? "");
    const description = cells[descIndex]?.trim(); if (!description) throw new Error("Statement contains a transaction without a description.");
    const rawDebit = debitIndex >= 0 ? amount(cells[debitIndex] || "0") : 0;
    const rawCredit = creditIndex >= 0 ? amount(cells[creditIndex] || "0") : 0;
    const signed = amountIndex >= 0 ? amount(cells[amountIndex] || "0") : rawCredit - rawDebit;
    if (!Number.isFinite(signed) || signed === 0) throw new Error("Statement contains an invalid or zero amount.");
    const direction = creditCard ? (signed < 0 ? "inflow" : "outflow") : (signed > 0 ? "inflow" : "outflow");
    const value = Math.abs(signed);
    const accountHint = (accountIndex >= 0 ? cells[accountIndex] : "") || (creditCard ? "credit-card" : "chequing");
    const accountId = `td-${slug(accountHint).slice(-12) || (creditCard ? "credit-card" : "chequing")}`;
    const fingerprint = createHash("sha256").update(`${accountId}|${transactionDate}|${description}|${value}|${direction}`).digest("hex").slice(0, 24);
    rows.push({ id: `txn-${fingerprint}`, accountId, date: transactionDate, amount: value, direction, description, status: "posted", sourceRecordId: fingerprint, source: creditCard ? "td-credit-card-csv-v1" : "td-chequing-csv-v1", sourceKind: "import", observedAt });
    if (position > 10000) throw new Error("Statement exceeds the safe transaction limit.");
  }
  const dates = rows.map((row) => row.date as string).sort();
  return { accountId: rows[0].accountId as string, accountType: creditCard ? "credit-card" : "chequing", rows, startDate: dates[0], endDate: dates.at(-1)! };
};
