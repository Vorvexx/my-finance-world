export type AccountType = "asset" | "liability";

export type LegacyAccountGroup =
  | "cash"
  | "investments"
  | "property"
  | "debts"
  | "other";

export type GroupKey = LegacyAccountGroup;

export type MoneyWorldKey =
  | "cash"
  | "investments"
  | "home"
  | "vehicle"
  | "creditDebt"
  | "income"
  | "upcoming"
  | "future";

export type FinancialAccount = {
  id: string;
  name: string;
  institution: string;
  balance: number;
  type: AccountType;
  group: LegacyAccountGroup;
  updatedAt: string;
};

export type AccountForm = {
  name: string;
  institution: string;
  balance: string;
  type: AccountType;
  group: LegacyAccountGroup;
};

export type GroupDefinition = {
  key: GroupKey;
  name: string;
  description: string;
  defaultType: AccountType;
  x: number;
  y: number;
};

export type KnownWorld = {
  status: "known";
  accountIds: readonly string[];
};

export type UnknownWorld = {
  status: "unknown";
  reason: string;
};

export type MoneyWorld = KnownWorld | UnknownWorld;

export type CanonicalFinancialSnapshot = {
  person: {
    id: "primary-person";
  };
  money: {
    currency: "CAD";
    lastUpdated: string | null;
    accounts: readonly FinancialAccount[];
    worlds: Readonly<Record<MoneyWorldKey, MoneyWorld>>;
  };
};

export type NetWorthSummary = {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
};

export type CanonicalFinancialModel = CanonicalFinancialSnapshot & {
  status: "loaded" | "not-loaded" | "invalid";
  statusMessage: string | null;
  summary: NetWorthSummary | null;
  accountsByWorld: Readonly<Record<MoneyWorldKey, readonly FinancialAccount[]>>;
  totalsByWorld: Readonly<Record<MoneyWorldKey, number | null>>;
  transactions: import("./transactions").CanonicalTransactionLedger;
};

export type RawFinancialSnapshot = {
  accounts: unknown;
  lastUpdated: unknown;
};

export type FinancialDataProvider = {
  id: string;
  load: () => Promise<RawFinancialSnapshot | null>;
};
