export const FINANCIAL_PERIODS = [
  { key: "day", label: "Day", days: 1 },
  { key: "week", label: "Week", days: 7 },
  { key: "fortnight", label: "Fortnight", days: 14 },
  { key: "month", label: "Month", days: 30 },
  { key: "quarter", label: "Quarter", days: 90 },
  { key: "year", label: "Year", days: 365 },
] as const;

export type FinancialPeriodKey = typeof FINANCIAL_PERIODS[number]["key"];
export const financialPeriod = (key: FinancialPeriodKey) => FINANCIAL_PERIODS.find((period) => period.key === key)!;
export const parseFinancialPeriod = (value: unknown): FinancialPeriodKey =>
  FINANCIAL_PERIODS.some((period) => period.key === value) ? value as FinancialPeriodKey : "month";
