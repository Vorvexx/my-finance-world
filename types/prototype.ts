import type { FinancialAccount, MoneyWorldKey } from "./finance";
import type { CanonicalTransaction, TransactionCorrection } from "./transactions";

export type StatementRecord = {
  id: string;
  filename: string;
  provider: "td";
  accountId: string;
  accountType: "chequing" | "credit-card";
  importedAt: string;
  startDate: string;
  endDate: string;
  transactionCount: number;
  duplicateCount: number;
  balanceCaptured: boolean;
};

export type FounderFactKind = "cash" | "investment" | "liability" | "home" | "mortgage" | "vehicle" | "vehicle-financing";
export type FounderFact = {
  id: string;
  kind: FounderFactKind;
  name: string;
  value: number;
  effectiveDate: string;
  updatedAt: string;
  provenance: "founder";
};

export type PrototypeState = {
  version: 4;
  person: { id: "primary-person"; name: string | null };
  accounts: FinancialAccount[];
  transactions: CanonicalTransaction[];
  corrections: TransactionCorrection[];
  statements: StatementRecord[];
  facts: FounderFact[];
  updatedAt: string | null;
};

export type PeriodKey = "day" | "week" | "fortnight" | "month" | "quarter" | "year";
export type CoverageStatus = "empty" | "partial" | "complete";

export type Movement = { id: string; date: string; name: string; amount: number; direction: "inflow" | "outflow"; category: string };
export type CategorySummary = { category: string; amount: number; previousAmount: number; change: number | null };

export type PrototypeView = {
  person: PrototypeState["person"];
  accounts: FinancialAccount[];
  statements: StatementRecord[];
  period: { key: PeriodKey; startDate: string; endDate: string; label: string };
  coverage: { status: CoverageStatus; availableStart: string | null; availableEnd: string | null; missingRanges: string[]; message: string };
  totals: { inflow: number; spending: number; transfers: number; payments: number; net: number };
  previous: { inflow: number; spending: number; net: number } | null;
  topInflows: Movement[];
  topOutflows: Movement[];
  categories: CategorySummary[];
  significant: Movement[];
  review: Array<{ id: string; date: string; name: string; amount: number; direction: string; category: string }>;
  recent: Movement[];
  recurring: Array<{ name: string; averageAmount: number; occurrences: number; nextExpectedDate: string | null; confidence: "evidence-based prediction" }>;
  facts: FounderFact[];
  position: { assets: number | null; liabilities: number | null; netWorth: number | null };
  worlds: Record<"cash" | "cashflow" | "lifestyle" | "investments" | "liabilities" | "home" | "vehicle" | "statements" | "review" | "upcoming", { status: "known" | "partial" | "unknown"; value: number | null; detail: string }>;
  updatedAt: string | null;
};

export type CorrectionInput = { transactionId: string; world: MoneyWorldKey | null; category: string };
export type FounderFactInput = Omit<FounderFact, "id" | "updatedAt" | "provenance"> & { id?: string };
