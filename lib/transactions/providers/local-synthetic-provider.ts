import type { RawTransaction, TransactionDataProvider } from "../../../types/transactions.ts";

const syntheticTransactions: readonly RawTransaction[] = [
  {
    accountId: "synthetic-chequing",
    importId: "synthetic-import-001",
    transactionDate: "2026-08-01",
    postedDate: "2026-08-02",
    amount: 2100,
    direction: "outflow",
    currency: "CAD",
    description: "PREAUTHORIZED MORTGAGE PAYMENT",
    financialMeaning: "expense",
    status: "posted",
    sourceRecordId: "local-001",
    fingerprint: { version: "synthetic-v1", value: "mortgage-001" },
    source: "local-synthetic-provider",
    sourceKind: "local-synthetic",
    observedAt: "2026-08-02T12:00:00.000Z",
  },
  {
    accountId: "synthetic-chequing",
    importId: "synthetic-import-001",
    transactionDate: "2026-08-03",
    postedDate: null,
    amount: 124.56,
    direction: "outflow",
    currency: "CAD",
    description: "ONLINE PAYMENT CITY HYDRO",
    financialMeaning: "expense",
    status: "posted",
    sourceRecordId: "local-002",
    fingerprint: { version: "synthetic-v1", value: "hydro-001" },
    source: "local-synthetic-provider",
    sourceKind: "local-synthetic",
    observedAt: "2026-08-04T12:00:00.000Z",
  },
  {
    accountId: "synthetic-chequing",
    importId: "synthetic-import-001",
    transactionDate: "2026-08-05",
    postedDate: null,
    amount: 3200,
    direction: "inflow",
    currency: "CAD",
    description: "PAYROLL SALARY DEPOSIT",
    financialMeaning: "income",
    status: "pending",
    sourceRecordId: "local-003",
    fingerprint: { version: "synthetic-v1", value: "salary-001" },
    source: "local-synthetic-provider",
    sourceKind: "local-synthetic",
    observedAt: "2026-08-05T12:00:00.000Z",
  },
];

export const localSyntheticTransactionProvider: TransactionDataProvider = {
  id: "local-synthetic-provider",
  async load() {
    return syntheticTransactions;
  },
};
