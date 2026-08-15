import test from "node:test";
import assert from "node:assert/strict";
import { FINANCIAL_PERIODS, parseFinancialPeriod } from "../lib/homepage/financial-period.ts";

test("defines one safe shared rolling-period vocabulary", () => {
  assert.deepEqual(FINANCIAL_PERIODS.map(({ key, days }) => [key, days]), [
    ["day", 1], ["week", 7], ["fortnight", 14], ["month", 30], ["quarter", 90], ["year", 365],
  ]);
  assert.equal(parseFinancialPeriod("quarter"), "quarter");
  assert.equal(parseFinancialPeriod("private-id"), "month");
  assert.equal(parseFinancialPeriod(undefined), "month");
});
