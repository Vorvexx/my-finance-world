export type AccountType = "asset" | "liability";
export type GroupKey = "cash" | "investments" | "property" | "debts" | "other";
export type TimeRangeKey = "day" | "week" | "fortnight" | "month" | "quarter" | "year";
export type FinancialAccount = { id: string; name: string; institution: string; balance: number; type: AccountType; group: GroupKey; updatedAt: string };
export type AccountForm = { name: string; institution: string; balance: string; type: AccountType; group: GroupKey };
export type GroupDefinition = { key: GroupKey; name: string; description: string; defaultType: AccountType };
export type CashFlow = { id: string; label: string; amount: number; category: string; direction: "inflow" | "outflow"; date: string; daysAgo: number; world: GroupKey };
export type ExpectedCashFlow = Omit<CashFlow, "date"> & { dueInDays: number };

export const STORAGE_KEY = "my-finance-world-real-accounts-v1";
export const UPDATED_KEY = "my-finance-world-last-updated-v1";

export const groups: GroupDefinition[] = [
  { key: "cash", name: "Cash", description: "Chequing and savings", defaultType: "asset" },
  { key: "investments", name: "Investments", description: "TFSA, RRSP and pensions", defaultType: "asset" },
  { key: "property", name: "Property", description: "Home, vehicle and valuables", defaultType: "asset" },
  { key: "debts", name: "Debts", description: "Mortgage, loans and cards", defaultType: "liability" },
  { key: "other", name: "Other", description: "Other assets or liabilities", defaultType: "asset" },
];

export const emptyForm: AccountForm = { name: "", institution: "", balance: "", type: "asset", group: "cash" };

export const formatCurrency = (value: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value);
export const formatExactCurrency = (value: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
export const formatUpdateTimestamp = (date: Date = new Date()) => new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(date);

export const getGroupAccounts = (accounts: FinancialAccount[], group: GroupKey) => accounts.filter((account) => account.group === group);
export const getGroupTotal = (accounts: FinancialAccount[], group: GroupKey) => getGroupAccounts(accounts, group).reduce((total, account) => total + (account.type === "asset" ? account.balance : -account.balance), 0);
export const computeNetWorthSummary = (accounts: FinancialAccount[]) => {
  const totalAssets = accounts.filter((account) => account.type === "asset").reduce((total, account) => total + account.balance, 0);
  const totalLiabilities = accounts.filter((account) => account.type === "liability").reduce((total, account) => total + account.balance, 0);
  return { totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities };
};

const dateFromToday = (daysAgo: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
};

export const sampleAccounts: FinancialAccount[] = [
  { id: "sample-chequing", name: "Everyday chequing", institution: "TD", balance: 6840, type: "asset", group: "cash", updatedAt: "Sample data" },
  { id: "sample-savings", name: "Emergency savings", institution: "EQ Bank", balance: 14500, type: "asset", group: "cash", updatedAt: "Sample data" },
  { id: "sample-tfsa", name: "TFSA", institution: "Wealthsimple", balance: 38750, type: "asset", group: "investments", updatedAt: "Sample data" },
  { id: "sample-home", name: "Milton home", institution: "Personal estimate", balance: 735000, type: "asset", group: "property", updatedAt: "Sample data" },
  { id: "sample-mortgage", name: "Home mortgage", institution: "TD", balance: 522400, type: "liability", group: "debts", updatedAt: "Sample data" },
  { id: "sample-car", name: "Kia Forte", institution: "Personal estimate", balance: 16500, type: "asset", group: "property", updatedAt: "Sample data" },
  { id: "sample-car-loan", name: "Vehicle loan", institution: "Kia Finance", balance: 8900, type: "liability", group: "debts", updatedAt: "Sample data" },
];

const flow = (
  id: string,
  label: string,
  amount: number,
  category: string,
  direction: CashFlow["direction"],
  daysAgo: number,
  world: CashFlow["world"],
): CashFlow => ({ id, label, amount, category, direction, date: dateFromToday(daysAgo), daysAgo, world });

export const sampleCashFlows: CashFlow[] = [
  flow("pay-1", "Salary", 3240, "Income", "inflow", 2, "cash"),
  flow("freelance", "Freelance project", 850, "Income", "inflow", 11, "cash"),
  flow("refund", "Insurance refund", 220, "Refunds", "inflow", 19, "cash"),
  flow("pay-2", "Salary", 3240, "Income", "inflow", 16, "cash"),
  flow("mortgage", "Mortgage payment", 2480, "Home", "outflow", 3, "property"),
  flow("groceries", "Groceries", 486, "Food", "outflow", 5, "cash"),
  flow("car", "Vehicle payment", 420, "Transport", "outflow", 8, "property"),
  flow("utilities", "Utilities", 315, "Home", "outflow", 12, "property"),
  flow("dining", "Dining & coffee", 238, "Food", "outflow", 18, "cash"),
  flow("insurance", "Home & auto insurance", 294, "Insurance", "outflow", 24, "property"),
  flow("phone", "Phone & internet", 168, "Bills", "outflow", 29, "cash"),
  flow("travel", "Weekend away", 760, "Travel", "outflow", 55, "other"),
  flow("tfsa", "TFSA contribution", 500, "Investing", "outflow", 70, "investments"),
  flow("property-tax", "Property tax", 1240, "Home", "outflow", 110, "property"),
  flow("bonus", "Annual bonus", 5200, "Income", "inflow", 180, "cash"),
];

export const expectedCashFlows: ExpectedCashFlow[] = [
  { id: "next-pay", label: "Salary", amount: 3240, category: "Income", direction: "inflow", dueInDays: 5, daysAgo: 0, world: "cash" },
  { id: "next-mortgage", label: "Mortgage payment", amount: 2480, category: "Home", direction: "outflow", dueInDays: 8, daysAgo: 0, world: "property" },
  { id: "next-utilities", label: "Utilities", amount: 315, category: "Home", direction: "outflow", dueInDays: 12, daysAgo: 0, world: "property" },
  { id: "next-car", label: "Vehicle payment", amount: 420, category: "Transport", direction: "outflow", dueInDays: 15, daysAgo: 0, world: "property" },
];

export const timeRanges: { key: TimeRangeKey; label: string; days: number }[] = [
  { key: "day", label: "Day", days: 1 },
  { key: "week", label: "Week", days: 7 },
  { key: "fortnight", label: "Fortnight", days: 14 },
  { key: "month", label: "Month", days: 31 },
  { key: "quarter", label: "Quarter", days: 92 },
  { key: "year", label: "Year", days: 365 },
];
