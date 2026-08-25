import test from "node:test";
import assert from "node:assert/strict";
import { FINANCIAL_PERIODS, parseFinancialPeriod, resolveFinancialPeriod } from "../lib/homepage/financial-period.ts";

test("defines one reusable calendar-period vocabulary", () => {
  assert.deepEqual(FINANCIAL_PERIODS.map(({ key }) => key), ["day", "week", "month", "quarter", "year", "custom"]);
  assert.equal(parseFinancialPeriod("quarter"), "quarter");
  assert.equal(parseFinancialPeriod("private-id"), "month");
  assert.equal(parseFinancialPeriod(undefined), "month");
});

test("resolves Monday weeks, calendar months, quarters, years, navigation and inclusive custom ranges", () => {
  assert.deepEqual(resolveFinancialPeriod({ key: "week", anchorDate: "2026-08-24" }), { key: "week", label: "Week", displayLabel: "Aug 24 – Aug 30, 2026", startDate: "2026-08-24", endDate: "2026-08-30", anchorDate: "2026-08-24", previousAnchor: "2026-08-17", nextAnchor: "2026-08-31" });
  assert.equal(resolveFinancialPeriod({ key: "month", anchorDate: "2024-02-17" }).endDate, "2024-02-29");
  assert.deepEqual(resolveFinancialPeriod({ key: "quarter", anchorDate: "2026-08-24" }).startDate, "2026-07-01");
  assert.deepEqual(resolveFinancialPeriod({ key: "quarter", anchorDate: "2026-08-24" }).endDate, "2026-09-30");
  assert.deepEqual(resolveFinancialPeriod({ key: "year", anchorDate: "2026-08-24" }).startDate, "2026-01-01");
  const custom = resolveFinancialPeriod({ key: "custom", anchorDate: "2026-08-24", customStart: "2026-05-14", customEnd: "2026-07-23" });
  assert.deepEqual([custom.startDate, custom.endDate], ["2026-05-14", "2026-07-23"]);
});
