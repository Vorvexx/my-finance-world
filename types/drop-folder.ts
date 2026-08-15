export type StatementRouteId = "td-chequing" | "td-credit-card";

export type StatementFolderResultStatus =
  | "processing"
  | "imported"
  | "duplicate"
  | "needs-attention"
  | "unsupported"
  | "rejected";

export type StatementFolderResult = {
  resultId: string;
  importId: string | null;
  routeId: StatementRouteId | null;
  providerId: "td" | null;
  accountType: "chequing" | "credit-card" | null;
  status: StatementFolderResultStatus;
  transactionCount: number;
  duplicateCount: number;
  safeReasonCode: string | null;
  processedAt: string;
};

export type StatementFolderAccountMappings = Readonly<Partial<Record<StatementRouteId, string>>>;
