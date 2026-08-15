import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { LocalReviewLearningStore } from "../lib/review/local-review-learning-store.ts";
import type { CanonicalTransaction, FinancialMeaning } from "../types/transactions.ts";

const NOW = "2099-08-09T12:00:00.000Z";
const transaction = ({
  id = "synthetic-transaction-1", counterparty = "SYNTHETIC CAFE", meaning = "unknown",
  category = null, world = null, method = "unclassified", confidence = null,
}: {
  id?: string; counterparty?: string; meaning?: FinancialMeaning; category?: string | null;
  world?: CanonicalTransaction["attribution"]["world"];
  method?: CanonicalTransaction["attribution"]["method"]; confidence?: number | null;
} = {}): CanonicalTransaction => ({
  id, accountId: "synthetic-account", transactionDate: "2099-08-08", postedDate: null,
  amount: 10, direction: "outflow", currency: "CAD", rawDescription: counterparty,
  normalizedCounterparty: counterparty, financialMeaning: meaning, status: "posted", relatedTransactionId: null,
  attribution: { world, category, method, ruleId: method === "deterministic-rule" ? "engineering-rule" : null, confidence, correctedAt: method === "user-correction" ? NOW : null },
  provenance: {
    importId: "synthetic-import", providerId: "synthetic-provider", sourceRecordId: null, sourceKind: "import",
    observedAt: NOW, sourceUpdatedAt: null, fingerprint: { version: "synthetic-v1", value: "synthetic-fingerprint" },
    deduplicationKey: `synthetic:${id}`,
  },
  createdAt: NOW, updatedAt: NOW,
});

const fixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "vorvex-review-learning-"));
  const databasePath = path.join(root, "review.sqlite");
  const key = randomBytes(32);
  const store = new LocalReviewLearningStore({ databasePath, encryptionKey: key });
  return { root, databasePath, key, store, async cleanup() { store.close(); key.fill(0); await rm(root, { recursive: true, force: true }); } };
};

test("creates one durable review for unknown evidence and preserves Unknown", async () => {
  const context = await fixture();
  try {
    const source = transaction();
    const first = context.store.evaluateTransaction(source, NOW);
    const duplicate = context.store.evaluateTransaction(source, NOW);
    assert.equal(first.method, "unknown");
    assert.equal(first.financialMeaning, null);
    assert.equal(first.explanation, "Insufficient evidence; human confirmation requested.");
    assert.equal(first.reviewItemId, duplicate.reviewItemId);
    const [review] = context.store.listReviewItems();
    assert.equal(review.reason, "unknown-financial-meaning");
    assert.equal(review.currentCategory, null);
    context.store.close();
    const reopened = new LocalReviewLearningStore({ databasePath: context.databasePath, encryptionKey: context.key });
    assert.equal(reopened.listReviewItems().length, 1);
    reopened.close();
  } finally {
    context.key.fill(0);
    await rm(context.root, { recursive: true, force: true });
  }
});

test("a confirmed classification creates a narrow account-scoped learned rule", async () => {
  const context = await fixture();
  try {
    const source = transaction({ meaning: "credit-card-purchase" });
    const outcome = context.store.evaluateTransaction(source, NOW);
    const decision = context.store.resolveReview(outcome.reviewItemId!, {
      kind: "classify", category: "Dining", world: "future", financialMeaning: "credit-card-purchase",
    }, "2099-08-09T12:01:00.000Z");
    assert.ok(decision.learnedRuleId);
    assert.equal(context.store.listReviewItems(null)[0].status, "resolved");
    const future = context.store.evaluateTransaction(transaction({ id: "synthetic-transaction-2", meaning: "credit-card-purchase" }), "2099-08-10T00:00:00.000Z");
    assert.equal(future.method, "user-confirmed-learned");
    assert.equal(future.financialMeaning, "credit-card-purchase");
    assert.equal(future.category, "Dining");
    assert.match(future.explanation, /user-confirmed rule created/);
    const differentAccount = { ...transaction({ id: "synthetic-transaction-3", meaning: "credit-card-purchase" }), accountId: "different-account" };
    assert.equal(context.store.evaluateTransaction(differentAccount, NOW).method, "unknown");
    context.store.close();
    const reopened = new LocalReviewLearningStore({ databasePath: context.databasePath, encryptionKey: context.key });
    assert.equal(reopened.listRules().length, 1);
    assert.equal(reopened.evaluateTransaction(transaction({ id: "synthetic-transaction-4", meaning: "credit-card-purchase" }), NOW).category, "Dining");
    reopened.close();
  } finally { await context.cleanup(); }
});

test("enforces correction, user-created, learned, deterministic, Unknown precedence", async () => {
  const context = await fixture();
  try {
    context.store.createRule({
      source: "user-confirmed-learned", normalizedCounterparty: "SYNTHETIC CAFE", accountId: "synthetic-account",
      classification: { financialMeaning: null, category: "Learned", world: "future" }, createdAt: NOW,
    });
    const userRule = context.store.createRule({
      normalizedCounterparty: "SYNTHETIC CAFE", accountId: "synthetic-account",
      classification: { financialMeaning: null, category: "Explicit", world: "future" }, createdAt: "2099-08-09T12:01:00.000Z",
    });
    const selected = context.store.evaluateTransaction(transaction({ meaning: "expense", method: "deterministic-rule", category: "Engineering", world: "home", confidence: 1 }), NOW);
    assert.equal(selected.ruleId, userRule.id);
    assert.equal(selected.category, "Explicit");
    const corrected = context.store.evaluateTransaction(transaction({ method: "user-correction", meaning: "expense", category: "Corrected", world: "vehicle", confidence: 1 }), NOW);
    assert.equal(corrected.method, "explicit-transaction-correction");
    assert.equal(corrected.category, "Corrected");
    context.store.setRuleEnabled(userRule.id, false, "2099-08-09T12:02:00.000Z");
    assert.equal(context.store.evaluateTransaction(transaction({ meaning: "expense" }), NOW).category, "Learned");
    context.store.updateRule(userRule.id, {
      normalizedCounterparty: "SYNTHETIC MARKET", classification: { financialMeaning: null, category: "Edited", world: "future" }, explanation: "Edited explicit rule.",
    }, "2099-08-09T12:03:00.000Z");
    assert.equal(context.store.listRules().find((rule) => rule.id === userRule.id)?.normalizedCounterparty, "SYNTHETIC MARKET");
    context.store.deleteRule(userRule.id);
    assert.equal(context.store.listRules().some((rule) => rule.id === userRule.id), false);
  } finally { await context.cleanup(); }
});

test("conflicting strongest rules fail to Unknown and request review", async () => {
  const context = await fixture();
  try {
    for (const category of ["Dining", "Shopping"]) context.store.createRule({
      normalizedCounterparty: "SYNTHETIC CAFE", accountId: "synthetic-account",
      classification: { financialMeaning: null, category, world: "future" }, createdAt: NOW,
    });
    const outcome = context.store.evaluateTransaction(transaction({ meaning: "expense" }), NOW);
    assert.equal(outcome.method, "unknown");
    assert.equal(outcome.category, null);
    assert.equal(context.store.listReviewItems()[0].reason, "conflicting-learned-rules");
  } finally { await context.cleanup(); }
});

test("preserves refund semantics and requests category review", async () => {
  const context = await fixture();
  try {
    const outcome = context.store.evaluateTransaction(transaction({ meaning: "refund" }), NOW);
    assert.equal(outcome.financialMeaning, "refund");
    assert.equal(outcome.category, null);
    assert.equal(context.store.listReviewItems()[0].reason, "no-category");
  } finally { await context.cleanup(); }
});

test("keeps transfer, reimbursement, and loan relationships human-confirmed", async () => {
  const context = await fixture();
  try {
    const transfer = transaction({ id: "transfer", meaning: "transfer" });
    assert.equal(context.store.evaluateTransaction(transfer, NOW).reviewItemId !== null, true);
    assert.equal(context.store.listReviewItems()[0].reason, "ambiguous-transfer");
    const reimbursement = context.store.requestManualReview(
      transaction({ id: "reimbursement" }), "ambiguous-relationship", NOW, "reimbursement",
    );
    const loan = context.store.requestManualReview(
      transaction({ id: "loan" }), "ambiguous-relationship", NOW, "loan",
    );
    context.store.resolveReview(reimbursement.id, { kind: "confirm-relationship", relationshipKind: "reimbursement", relatedTransactionId: null }, NOW);
    context.store.resolveReview(loan.id, { kind: "keep-unknown" }, NOW);
    assert.equal(context.store.listReviewItems(null).filter((item) => item.status === "resolved").length, 2);
  } finally { await context.cleanup(); }
});

test("encrypts merchant, classification, provenance, and relationship decisions at rest", async () => {
  const context = await fixture();
  try {
    const source = transaction({ counterparty: "SENSITIVE SYNTHETIC MERCHANT", meaning: "expense" });
    const review = context.store.evaluateTransaction(source, NOW);
    context.store.resolveReview(review.reviewItemId!, { kind: "classify", category: "Private Category", world: "future" }, NOW);
    context.store.close();
    const bytes = await readFile(context.databasePath);
    for (const forbidden of ["SENSITIVE SYNTHETIC MERCHANT", "Private Category", "synthetic-import", "future"]) {
      assert.equal(bytes.includes(Buffer.from(forbidden)), false);
    }
    assert.equal((await import("node:fs")).statSync(context.databasePath).mode & 0o777, 0o600);
  } finally {
    context.key.fill(0);
    await rm(context.root, { recursive: true, force: true });
  }
});

test("stores Founder language as an encrypted alias to a confirmed existing concept", async () => {
  const context = await fixture();
  try {
    const review = context.store.evaluateTransaction(transaction({ counterparty: "SYNTHETIC PROPERTY SERVICE" }), NOW);
    context.store.resolveReview(review.reviewItemId!, {
      kind: "classify", financialMeaning: "expense", category: "Maintenance & Repairs", world: "home",
    }, NOW, "house upkeep");
    assert.deepEqual(context.store.listLanguageAliases().map(({ phrase, classification }) => ({ phrase, classification })), [{
      phrase: "house upkeep", classification: { financialMeaning: "expense", category: "Maintenance & Repairs", world: "home" },
    }]);
    context.store.close();
    const bytes = await readFile(context.databasePath);
    assert.equal(bytes.includes(Buffer.from("house upkeep")), false);
    const reopened = new LocalReviewLearningStore({ databasePath: context.databasePath, encryptionKey: context.key });
    assert.equal(reopened.listLanguageAliases()[0].phrase, "house upkeep");
    reopened.close();
  } finally {
    context.key.fill(0);
    await rm(context.root, { recursive: true, force: true });
  }
});
