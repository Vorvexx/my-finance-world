import assert from "node:assert/strict";
import test from "node:test";
import { buildChequingStatementHistory, buildMonthlyChequingBalances } from "../lib/analytics/chequing-statement-history.ts";
import type { CanonicalChequingStatementFacts } from "../types/imports.ts";
import type { CanonicalTransaction } from "../types/transactions.ts";

const fact = (overrides: Partial<CanonicalChequingStatementFacts>): CanonicalChequingStatementFacts => ({
  id: "statement-1", importId: "import-1", accountId: "cash-1", providerId: "td", accountType: "chequing",
  currency: "CAD", statementPeriodStart: "2026-05-31", statementPeriodEnd: "2026-06-30",
  openingBalanceCents: 100000, totalDepositsCents: 50000, totalWithdrawalsCents: 20000, closingBalanceCents: 130000,
  closingBalanceEvidence: "statement-label", sourceSha256: "a".repeat(64), createdAt: "2026-07-01T00:00:00.000Z",
  ...overrides,
});

test("builds newest-first factual Cash Change and reconciles adjacent balances", () => {
  const history = buildChequingStatementHistory([
    fact({}),
    fact({ id: "statement-2", importId: "import-2", statementPeriodStart: "2026-06-30", statementPeriodEnd: "2026-07-31",
      openingBalanceCents: 130000, totalDepositsCents: 10000, totalWithdrawalsCents: 40000, closingBalanceCents: 100000, sourceSha256: "b".repeat(64) }),
  ]);
  assert.equal(history.length, 2);
  assert.equal(history[0].cashChange, -300);
  assert.equal(history[0].percentageChange, -23.08);
  assert.equal(history[0].adjacentBalanceReconciles, true);
  assert.equal(history[1].cashChange, 300);
});

test("fails closed when statement or adjacent balance arithmetic conflicts", () => {
  assert.throws(() => buildChequingStatementHistory([fact({ closingBalanceCents: 129999 })]), /CHEQUING_STATEMENT_RECONCILIATION_FAILED/);
  assert.throws(() => buildChequingStatementHistory([
    fact({}),
    fact({ id: "statement-2", importId: "import-2", statementPeriodStart: "2026-06-30", statementPeriodEnd: "2026-07-31",
      openingBalanceCents: 120000, totalDepositsCents: 10000, totalWithdrawalsCents: 30000, closingBalanceCents: 100000, sourceSha256: "b".repeat(64) }),
  ]), /CHEQUING_ADJACENT_BALANCE_RECONCILIATION_FAILED/);
});

test("reconstructs exact calendar opening and month-end chequing balances", () => {
  const statements = [
    fact({ statementPeriodStart: "2025-12-31", statementPeriodEnd: "2026-01-30", openingBalanceCents: 100000, totalDepositsCents: 20000, totalWithdrawalsCents: 5000, closingBalanceCents: 115000 }),
    fact({ id: "statement-2", importId: "import-2", statementPeriodStart: "2026-01-30", statementPeriodEnd: "2026-02-27", openingBalanceCents: 115000, totalDepositsCents: 10000, totalWithdrawalsCents: 3000, closingBalanceCents: 122000, sourceSha256: "b".repeat(64) }),
  ];
  const transactions = [
    { accountId: "cash-1", transactionDate: "2026-01-31", direction: "outflow", amount: 10 },
    { accountId: "cash-1", transactionDate: "2026-02-01", direction: "inflow", amount: 20 },
  ] as CanonicalTransaction[];
  const history = buildMonthlyChequingBalances(statements, transactions);
  const january = history.find((month) => month.month === "2026-01");
  const february = history.find((month) => month.month === "2026-02");
  assert.equal(january?.closingCash, 1140);
  assert.equal(february?.openingCash, 1140);
});
