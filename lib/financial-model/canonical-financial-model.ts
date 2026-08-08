import type {
  CanonicalFinancialModel,
  CanonicalFinancialSnapshot,
  FinancialAccount,
  LegacyAccountGroup,
  MoneyWorldKey,
  NetWorthSummary,
  RawFinancialSnapshot,
} from "@/types/finance";
import { emptyTransactionLedger } from "@/lib/transactions/ingestion";

const ACCOUNT_TYPES = new Set(["asset", "liability"]);
const ACCOUNT_GROUPS = new Set<LegacyAccountGroup>([
  "cash",
  "investments",
  "property",
  "debts",
  "other",
]);
const WORLD_KEYS: MoneyWorldKey[] = [
  "cash",
  "investments",
  "home",
  "vehicle",
  "creditDebt",
  "income",
  "upcoming",
  "future",
];

const isFinancialAccount = (value: unknown): value is FinancialAccount => {
  if (!value || typeof value !== "object") return false;

  const account = value as Record<string, unknown>;
  return (
    typeof account.id === "string" &&
    typeof account.name === "string" &&
    typeof account.institution === "string" &&
    typeof account.balance === "number" &&
    Number.isFinite(account.balance) &&
    typeof account.type === "string" &&
    ACCOUNT_TYPES.has(account.type) &&
    typeof account.group === "string" &&
    ACCOUNT_GROUPS.has(account.group as LegacyAccountGroup) &&
    typeof account.updatedAt === "string"
  );
};

const assertRawSnapshot = (raw: RawFinancialSnapshot) => {
  if (!Array.isArray(raw.accounts) || !raw.accounts.every(isFinancialAccount)) {
    throw new Error("Financial data does not match the canonical account schema.");
  }
  if (raw.lastUpdated !== null && typeof raw.lastUpdated !== "string") {
    throw new Error("Financial data has an invalid last-updated value.");
  }

  return {
    accounts: raw.accounts,
    lastUpdated: raw.lastUpdated,
  };
};

const toCents = (value: number) => Math.round(value * 100);
const fromCents = (value: number) => value / 100;

export const computeNetWorthSummary = (
  sourceAccounts: readonly FinancialAccount[],
): NetWorthSummary => {
  const assetCents = sourceAccounts
    .filter((account) => account.type === "asset")
    .reduce((sum, account) => sum + toCents(account.balance), 0);
  const liabilityCents = sourceAccounts
    .filter((account) => account.type === "liability")
    .reduce((sum, account) => sum + toCents(account.balance), 0);

  return {
    totalAssets: fromCents(assetCents),
    totalLiabilities: fromCents(liabilityCents),
    netWorth: fromCents(assetCents - liabilityCents),
  };
};

const createSnapshot = (
  accounts: readonly FinancialAccount[],
  lastUpdated: string | null,
): CanonicalFinancialSnapshot => ({
  person: { id: "primary-person" },
  money: {
    currency: "CAD",
    lastUpdated,
    accounts,
    worlds: {
      cash: {
        status: "known",
        accountIds: accounts.filter((account) => account.group === "cash").map((account) => account.id),
      },
      investments: {
        status: "known",
        accountIds: accounts.filter((account) => account.group === "investments").map((account) => account.id),
      },
      creditDebt: {
        status: "known",
        accountIds: accounts.filter((account) => account.group === "debts").map((account) => account.id),
      },
      home: { status: "unknown", reason: "No Home records have been loaded." },
      vehicle: { status: "unknown", reason: "No Vehicle asset value has been loaded." },
      income: { status: "unknown", reason: "No income records have been loaded." },
      upcoming: { status: "unknown", reason: "No upcoming-event records have been loaded." },
      future: { status: "unknown", reason: "Future Worlds have not been recorded." },
    },
  },
});

const accountsForWorld = (
  snapshot: CanonicalFinancialSnapshot,
  world: MoneyWorldKey,
): readonly FinancialAccount[] => {
  const worldState = snapshot.money.worlds[world];
  if (worldState.status === "unknown") return [];

  const ids = new Set(worldState.accountIds);
  return snapshot.money.accounts.filter((account) => ids.has(account.id));
};

const assembleModel = (
  snapshot: CanonicalFinancialSnapshot,
  status: CanonicalFinancialModel["status"],
  statusMessage: string | null,
): CanonicalFinancialModel => {
  const accountsByWorld = Object.fromEntries(
    WORLD_KEYS.map((world) => [world, accountsForWorld(snapshot, world)]),
  ) as Record<MoneyWorldKey, readonly FinancialAccount[]>;
  const totalsByWorld = Object.fromEntries(
    WORLD_KEYS.map((world) => {
      if (snapshot.money.worlds[world].status === "unknown") return [world, null];
      const cents = accountsByWorld[world].reduce(
        (sum, account) => sum + (account.type === "asset" ? 1 : -1) * toCents(account.balance),
        0,
      );
      return [world, fromCents(cents)];
    }),
  ) as Record<MoneyWorldKey, number | null>;

  return {
    ...snapshot,
    status,
    statusMessage,
    summary: status === "loaded" ? computeNetWorthSummary(snapshot.money.accounts) : null,
    accountsByWorld,
    totalsByWorld,
    transactions: emptyTransactionLedger(),
  };
};

export const ingestFinancialSnapshot = (raw: RawFinancialSnapshot): CanonicalFinancialModel => {
  const validated = assertRawSnapshot(raw);
  return assembleModel(createSnapshot(validated.accounts, validated.lastUpdated), "loaded", null);
};

export const createEmptyFinancialModel = (
  status: "not-loaded" | "invalid" = "not-loaded",
  message = status === "not-loaded" ? "No local financial data loaded." : "Financial data could not be loaded.",
) => assembleModel(createSnapshot([], null), status, message);
