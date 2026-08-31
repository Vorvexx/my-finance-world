import assert from "node:assert/strict";
import test from "node:test";
import { buildChequingStatementHistory } from "../lib/analytics/chequing-statement-history.ts";
import type { CanonicalChequingStatementFacts } from "../types/imports.ts";

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
