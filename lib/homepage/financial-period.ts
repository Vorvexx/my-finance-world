export const FINANCIAL_PERIODS = [
  { key: "day", label: "Day" }, { key: "week", label: "Week" }, { key: "month", label: "Month" },
  { key: "quarter", label: "Quarter" }, { key: "year", label: "Year" }, { key: "all", label: "All" }, { key: "custom", label: "Custom" },
] as const;
export type FinancialPeriodKey = typeof FINANCIAL_PERIODS[number]["key"];
export type FinancialPeriodSelection = { key: FinancialPeriodKey; anchorDate: string; customStart?: string; customEnd?: string; evidenceStart?: string; evidenceEnd?: string };
const iso = (date: Date) => date.toISOString().slice(0, 10);
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const addDays = (value: string, days: number) => { const result = date(value); result.setUTCDate(result.getUTCDate() + days); return iso(result); };
const valid = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const human = (value: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", ...options }).format(date(value));
export const parseFinancialPeriod = (value: unknown): FinancialPeriodKey => FINANCIAL_PERIODS.some((period) => period.key === value) ? value as FinancialPeriodKey : "month";
export const resolveFinancialPeriod = ({ key, anchorDate, customStart, customEnd, evidenceStart, evidenceEnd }: FinancialPeriodSelection) => {
  const anchor = date(anchorDate); let startDate = anchorDate; let endDate = anchorDate; let previousAnchor = anchorDate; let nextAnchor = anchorDate;
  if (key === "week") { const offset = (anchor.getUTCDay() + 6) % 7; startDate = addDays(anchorDate, -offset); endDate = addDays(startDate, 6); previousAnchor = addDays(anchorDate, -7); nextAnchor = addDays(anchorDate, 7); }
  else if (key === "month") { startDate = iso(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1))); endDate = iso(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0))); previousAnchor = iso(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 1, 1))); nextAnchor = iso(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1))); }
  else if (key === "quarter") { const month = Math.floor(anchor.getUTCMonth() / 3) * 3; startDate = iso(new Date(Date.UTC(anchor.getUTCFullYear(), month, 1))); endDate = iso(new Date(Date.UTC(anchor.getUTCFullYear(), month + 3, 0))); previousAnchor = iso(new Date(Date.UTC(anchor.getUTCFullYear(), month - 3, 1))); nextAnchor = iso(new Date(Date.UTC(anchor.getUTCFullYear(), month + 3, 1))); }
  else if (key === "year") { startDate = `${anchor.getUTCFullYear()}-01-01`; endDate = `${anchor.getUTCFullYear()}-12-31`; previousAnchor = `${anchor.getUTCFullYear() - 1}-01-01`; nextAnchor = `${anchor.getUTCFullYear() + 1}-01-01`; }
  else if (key === "day") { previousAnchor = addDays(anchorDate, -1); nextAnchor = addDays(anchorDate, 1); }
  else if (key === "all") { startDate = valid(evidenceStart) ? evidenceStart : anchorDate; endDate = valid(evidenceEnd) && evidenceEnd >= startDate ? evidenceEnd : anchorDate; previousAnchor = anchorDate; nextAnchor = anchorDate; }
  else { startDate = valid(customStart) ? customStart : anchorDate; endDate = valid(customEnd) && customEnd >= startDate ? customEnd : startDate; }
  const label = FINANCIAL_PERIODS.find((period) => period.key === key)!.label;
  const displayLabel = key === "all" ? "All recorded activity"
    : key === "day" ? human(startDate, { month: "long", day: "numeric", year: "numeric" })
    : key === "month" ? human(startDate, { month: "long", year: "numeric" })
    : key === "year" ? startDate.slice(0, 4)
    : key === "quarter" ? `Q${Math.floor(date(startDate).getUTCMonth() / 3) + 1} · ${human(startDate, { month: "short" })} – ${human(endDate, { month: "short", year: "numeric" })}`
    : `${human(startDate, { month: "short", day: "numeric" })} – ${human(endDate, { month: "short", day: "numeric", year: "numeric" })}`;
  return { key, label, displayLabel, startDate, endDate, anchorDate, previousAnchor, nextAnchor };
};
