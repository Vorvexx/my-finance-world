import type { RawTransaction, TransactionDataProvider } from "../../../types/transactions.ts";

const syntheticTransactions: readonly RawTransaction[] = [
  {
    id: "synthetic-mortgage-001",
    accountId: "synthetic-chequing",
    date: "2026-08-01",
    amount: 2100,
    direction: "outflow",
    description: "PREAUTHORIZED MORTGAGE PAYMENT",
    status: "posted",
    sourceRecordId: "local-001",
    source: "local-synthetic-provider",
    sourceKind: "local-synthetic",
    observedAt: "2026-08-02T12:00:00.000Z",
  },
  {
    id: "synthetic-hydro-001",
    accountId: "synthetic-chequing",
    date: "2026-08-03",
    amount: 124.56,
    direction: "outflow",
    description: "ONLINE PAYMENT CITY HYDRO",
    status: "posted",
    sourceRecordId: "local-002",
    source: "local-synthetic-provider",
    sourceKind: "local-synthetic",
    observedAt: "2026-08-04T12:00:00.000Z",
  },
  {
    id: "synthetic-salary-001",
    accountId: "synthetic-chequing",
    date: "2026-08-05",
    amount: 3200,
    direction: "inflow",
    description: "PAYROLL SALARY DEPOSIT",
    status: "pending",
    sourceRecordId: "local-003",
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
