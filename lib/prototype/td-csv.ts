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
  const yearFirst = cleaned.match(/^(\d{4})[\/](\d{1,2})[\/](\d{1,2})$/);
  if (yearFirst) return `${yearFirst[1]}-${yearFirst[2].padStart(2, "0")}-${yearFirst[3].padStart(2, "0")}`;
  const match = cleaned.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!match) {
    const parsed = new Date(cleaned); if (!/^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}$/.test(cleaned) || Number.isNaN(parsed.valueOf())) throw new Error("TD statement contains an unsupported date.");
    return parsed.toISOString().slice(0, 10);
  }
  return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
};
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

export type ParsedTdStatement = { accountId: string; accountType: "chequing" | "credit-card"; rows: RawTransaction[]; startDate: string; endDate: string; closingBalance: number | null };

export const parseTdCsv = (text: string, filename: string, observedAt: string): ParsedTdStatement => {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("Statement has no transaction rows.");
  const firstCells = parseLine(lines[0]); const headerless = /^\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}$/.test(firstCells[0] ?? "");
  const filenameCredit = /credit|visa|mastercard/i.test(filename);
  if (headerless && firstCells.length < 4) throw new Error("Headerless TD exports require an identifiable account layout.");
  const header = headerless ? (filenameCredit ? ["date", "description", "amount", "cardnumber"] : ["date", "description", "withdrawals", "deposits", "balance"]) : firstCells.map(slug);
  const dataLines = headerless ? lines : lines.slice(1);
  const index = (...names: string[]) => names.map((name) => header.indexOf(name)).find((value) => value >= 0) ?? -1;
  const dateIndex = index("date", "transactiondate", "postingdate", "posteddate");
  const descIndex = index("description", "transactiondescription", "merchantname", "details", "transactiondetails");
  const debitIndex = index("withdrawals", "withdrawal", "debit", "debitamount");
  const creditIndex = index("deposits", "deposit", "credit", "creditamount");
  const amountIndex = index("amount", "transactionamount");
  const accountIndex = index("account", "accountnumber", "cardnumber", "accountid");
  const balanceIndex = index("balance", "runningbalance", "currentbalance", "availablebalance");
  const typeIndex = index("accounttype", "producttype");
  if (dateIndex < 0 || descIndex < 0 || (amountIndex < 0 && debitIndex < 0 && creditIndex < 0)) throw new Error("Unsupported TD CSV columns.");
  const firstData = parseLine(dataLines[0]);
  const creditCard = filenameCredit || (typeIndex >= 0 && /credit|visa|mastercard/i.test(firstData[typeIndex] ?? "")) || (!headerless && amountIndex >= 0 && debitIndex < 0);
  const rows: RawTransaction[] = [];
  for (const [position, line] of dataLines.entries()) {
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
  const lastCells = parseLine(dataLines.at(-1)!);
  const parsedBalance = balanceIndex >= 0 ? amount(lastCells[balanceIndex] || "") : Number.NaN;
  return { accountId: rows[0].accountId as string, accountType: creditCard ? "credit-card" : "chequing", rows, startDate: dates[0], endDate: dates.at(-1)!, closingBalance: Number.isFinite(parsedBalance) ? Math.abs(parsedBalance) : null };
};
