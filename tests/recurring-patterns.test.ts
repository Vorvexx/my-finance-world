import test from "node:test";
import assert from "node:assert/strict";
import { detectMissingExpectedEvents, detectRecurringPatterns } from "../lib/homepage/recurring-patterns.ts";
import type { CanonicalTransaction } from "../types/transactions.ts";

const recurring = (index: number, date: string, amount = 2500): CanonicalTransaction => ({
  id: `transaction-${index}`, accountId: "account", transactionDate: date, postedDate: null,
  amount, direction: "inflow", currency: "CAD", rawDescription: "Employer payroll",
  normalizedCounterparty: "EMPLOYER PAYROLL", financialMeaning: "income", status: "posted",
  relatedTransactionId: null, attribution: { world: null, category: null, method: "unclassified", ruleId: null, confidence: null, correctedAt: null },
  provenance: { importId: `import-${index}`, providerId: "td", sourceRecordId: null, sourceKind: "import", observedAt: "2099-01-01T00:00:00Z", sourceUpdatedAt: null, fingerprint: { version: "v1", value: `hash-${index}` }, deduplicationKey: `dedup-${index}` },
  createdAt: "2099-01-01T00:00:00Z", updatedAt: "2099-01-01T00:00:00Z",
});

test("detects a strong biweekly pattern and uses a robust approximate amount", () => {
  const patterns = detectRecurringPatterns([
    recurring(1, "2099-05-07", 2500), recurring(2, "2099-05-21", 2520), recurring(3, "2099-06-04", 2490),
    recurring(4, "2099-06-18", 2510), recurring(5, "2099-07-02", 2500), recurring(6, "2099-07-16", 9000),
  ], "2099-07-20");
  assert.equal(patterns.length, 1);
  assert.equal(patterns[0].cadence, "biweekly");
  assert.equal(patterns[0].expectedDate, "2099-07-30");
  assert.equal(patterns[0].approximateAmount, 2505);
  assert.equal(patterns[0].confidence, "expected");
});

test("does not promote sparse, irregular, transfer, or pending activity", () => {
  const irregular = [recurring(1, "2099-05-01"), recurring(2, "2099-05-09"), recurring(3, "2099-06-20")];
  const transfer = { ...recurring(4, "2099-07-01"), financialMeaning: "transfer" as const };
  const pending = { ...recurring(5, "2099-07-15"), status: "pending" as const };
  assert.deepEqual(detectRecurringPatterns([...irregular, transfer, pending], "2099-07-20"), []);
});

test("surfaces a missing fee rebate only after repeated matched evidence", () => {
  const fee = (index: number, date: string) => ({ ...recurring(index, date, 15), direction: "outflow" as const, financialMeaning: "fee" as const, rawDescription: "Monthly account fee", normalizedCounterparty: "MONTHLY ACCOUNT FEE", attribution: { ...recurring(index, date).attribution, world: "cash" as const, category: "Banking Fees" } });
  const rebate = (index: number, date: string) => ({ ...recurring(index, date, 15), financialMeaning: "refund" as const, rawDescription: "Monthly fee rebate", normalizedCounterparty: "MONTHLY FEE REBATE", attribution: { ...recurring(index, date).attribution, world: "cash" as const, category: "Banking Fees" } });
  const history = [
    fee(1, "2099-01-01"), rebate(11, "2099-01-03"), fee(2, "2099-02-01"), rebate(12, "2099-02-03"),
    fee(3, "2099-03-01"), rebate(13, "2099-03-03"), fee(4, "2099-04-01"),
  ];
  assert.deepEqual(detectMissingExpectedEvents(history, "2099-04-10"), [{ label: "Expected bank-fee rebate not seen", expectedBy: "2099-04-08", evidenceCount: 3 }]);
  assert.deepEqual(detectMissingExpectedEvents([...history, rebate(14, "2099-04-03")], "2099-04-10"), []);
});
