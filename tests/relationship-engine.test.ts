import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ingestFinancialSnapshot } from "../lib/financial-model/canonical-financial-model.ts";
import { deriveHomepageView } from "../lib/homepage/derive-homepage-view.ts";
import { applyRelationshipSemantics } from "../lib/relationships/apply-relationship-semantics.ts";
import { createExplicitRelationshipProposal, detectDeterministicRelationships } from "../lib/relationships/deterministic-relationship-engine.ts";
import { FounderRelationshipService, FounderRelationshipServiceError } from "../lib/relationships/founder-relationship-service.ts";
import { LocalRelationshipStore } from "../lib/relationships/local-relationship-store.ts";
import type { RelationshipAccount, RelationshipType } from "../types/relationships.ts";
import type { CanonicalTransaction, FinancialMeaning } from "../types/transactions.ts";

const FIRST = new Date("2099-08-08T12:00:00.000Z");
const LATER = new Date("2099-08-08T12:01:00.000Z");
const accounts: readonly RelationshipAccount[] = [
  { id: "private-chequing", ownerId: "primary-person", type: "asset", group: "cash" },
  { id: "private-savings", ownerId: "primary-person", type: "asset", group: "cash" },
  { id: "private-card", ownerId: "primary-person", type: "liability", group: "debts" },
];
const transaction = ({
  id, accountId, direction, meaning, date = "2099-08-08", amount = 125, description = id,
}: {
  id: string; accountId: string; direction: "inflow" | "outflow"; meaning: FinancialMeaning;
  date?: string; amount?: number; description?: string;
}): CanonicalTransaction => ({
  id, accountId, transactionDate: date, postedDate: date, amount, direction, currency: "CAD",
  rawDescription: description, normalizedCounterparty: description, financialMeaning: meaning, status: "posted", relatedTransactionId: null,
  attribution: { world: null, category: null, method: "unclassified", ruleId: null, confidence: null, correctedAt: null },
  provenance: {
    importId: `private-import-${id}`, providerId: "synthetic", sourceRecordId: null, sourceKind: "local-synthetic",
    observedAt: FIRST.toISOString(), sourceUpdatedAt: null,
    fingerprint: { version: "synthetic", value: `private-fingerprint-${id}` }, deduplicationKey: `private-dedup-${id}`,
  }, createdAt: FIRST.toISOString(), updatedAt: FIRST.toISOString(),
});
const paymentPair = (suffix = "1", date = "2099-08-08") => [
  transaction({ id: `chequing-payment-${suffix}`, accountId: "private-chequing", direction: "outflow", meaning: "credit-card-payment", date, description: "PAYMENT TO TD VISA" }),
  transaction({ id: `card-payment-${suffix}`, accountId: "private-card", direction: "inflow", meaning: "credit-card-payment", date, description: "PAYMENT RECEIVED" }),
] as const;
const fixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "vorvex-relationships-"));
  const key = randomBytes(32);
  const databasePath = path.join(root, "relationships.sqlite");
  const store = new LocalRelationshipStore({ databasePath, encryptionKey: key });
  const service = new FounderRelationshipService(store, key);
  return { root, key, databasePath, store, service, async cleanup() { store.close(); key.fill(0); await rm(root, { recursive: true, force: true }); } };
};

test("canonical-only exact evidence creates a credit-card-payment candidate, not a relationship", () => {
  const proposals = detectDeterministicRelationships({ transactions: paymentPair(), accounts, confirmedRules: [], relationships: [] });
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].type, "credit-card-payment");
  assert.equal(proposals[0].disposition, "candidate");
  assert.deepEqual(proposals[0].evidence.missing, ["Founder confirmation for this account pair and relationship type."]);
  assert.match(proposals[0].evidence.explanation, /no relationship was created automatically/);
});

test("Founder acceptance persists a relationship and enables exact future rule reuse", async () => {
  const context = await fixture();
  try {
    context.service.sync(paymentPair(), accounts, FIRST.toISOString());
    const queue = context.service.listPending(FIRST);
    if (queue.status !== "available") assert.fail("queue unavailable");
    const accepted = context.service.save({ actionToken: queue.items[0].actionToken, decision: "accept" }, LATER);
    assert.equal(accepted.status, "accepted");
    assert.equal(context.store.listRelationships()[0].confirmation, "founder-confirmed");
    assert.equal(context.store.listRules().length, 1);
    const future = paymentPair("2", "2099-08-09");
    const sync = context.service.sync(future, accounts, "2099-08-09T12:00:00.000Z");
    assert.equal(sync.proposals[0].disposition, "automatic");
    assert.equal(sync.relationships.at(-1)?.confirmation, "confirmed-rule-reuse");
    assert.match(sync.relationships.at(-1)?.evidence.explanation ?? "", /prior Founder-confirmed/);
  } finally { await context.cleanup(); }
});

test("ambiguous exact counterparts remain candidates even after an account-pair rule exists", async () => {
  const context = await fixture();
  try {
    context.service.sync(paymentPair(), accounts, FIRST.toISOString());
    const queue = context.service.listPending(FIRST);
    if (queue.status !== "available") assert.fail("queue unavailable");
    context.service.save({ actionToken: queue.items[0].actionToken, decision: "accept" }, LATER);
    const [outflow, inflow] = paymentPair("ambiguous", "2099-08-09");
    const duplicateInflow = transaction({ ...{
      id: "card-payment-other", accountId: "private-card", direction: "inflow" as const,
      meaning: "credit-card-payment" as const, date: "2099-08-09", description: "SECOND EXACT PAYMENT",
    } });
    const result = detectDeterministicRelationships({
      transactions: [outflow, inflow, duplicateInflow], accounts,
      confirmedRules: context.store.listRules(), relationships: context.store.listRelationships(),
    });
    assert.equal(result.every((proposal) => proposal.disposition === "candidate"), true);
    assert.equal(result.every((proposal) => proposal.evidence.missing.some((evidence) => evidence.includes("more than one"))), true);
  } finally { await context.cleanup(); }
});

test("internal transfers require exact transfer meanings and Founder confirmation", () => {
  const pair = [
    transaction({ id: "transfer-out", accountId: "private-chequing", direction: "outflow", meaning: "transfer" }),
    transaction({ id: "transfer-in", accountId: "private-savings", direction: "inflow", meaning: "transfer", date: "2099-08-10" }),
  ];
  const [proposal] = detectDeterministicRelationships({ transactions: pair, accounts, confirmedRules: [], relationships: [] });
  assert.equal(proposal.type, "internal-transfer");
  assert.equal(proposal.dayGap, 2);
  assert.equal(detectDeterministicRelationships({ transactions: [{ ...pair[0], financialMeaning: "unknown" }, pair[1]], accounts, confirmedRules: [], relationships: [] }).length, 0);
});

test("loan, repayment, and reimbursement candidates require explicit Founder-originated evidence", async () => {
  const context = await fixture();
  try {
    const pair = [
      transaction({ id: "manual-out", accountId: "private-chequing", direction: "outflow", meaning: "unknown" }),
      transaction({ id: "manual-in", accountId: "private-savings", direction: "inflow", meaning: "unknown" }),
    ] as const;
    assert.equal(detectDeterministicRelationships({ transactions: pair, accounts, confirmedRules: [], relationships: [] }).length, 0);
    for (const type of ["loan", "loan-repayment", "reimbursement"] as const) {
      const proposal = createExplicitRelationshipProposal({ type, first: pair[0], second: { ...pair[1], id: `${pair[1].id}-${type}` }, accounts });
      assert.equal(proposal.type, type);
      assert.match(proposal.evidence.explanation, /did not infer/);
    }
    context.service.requestExplicitCandidate({ type: "loan", first: pair[0], second: pair[1], accounts, requestedAt: FIRST.toISOString() });
    assert.equal(context.store.listCandidates()[0].type, "loan");
  } finally { await context.cleanup(); }
});

test("Reject, Keep Unknown, and Ignore preserve transactions and create no relationship", async () => {
  for (const decision of ["reject", "keep-unknown", "ignore"] as const) {
    const context = await fixture();
    try {
      context.service.sync(paymentPair(), accounts, FIRST.toISOString());
      const queue = context.service.listPending(FIRST);
      if (queue.status !== "available") assert.fail("queue unavailable");
      context.service.save({ actionToken: queue.items[0].actionToken, decision }, LATER);
      assert.equal(context.store.listRelationships().length, 0);
      assert.equal(context.store.listRules().length, 0);
      const expected = decision === "keep-unknown" ? "unknown" : decision === "reject" ? "rejected" : "ignored";
      assert.equal(context.store.listCandidates(null)[0].status, expected);
    } finally { await context.cleanup(); }
  }
});

test("homepage relationship semantics prevent payment and transfer double impact", () => {
  const [outflow, inflow] = paymentPair();
  const relationship = {
    id: "relationship", type: "credit-card-payment" as const, primaryTransactionId: outflow.id, secondaryTransactionId: inflow.id,
    primaryAccountId: outflow.accountId, secondaryAccountId: inflow.accountId,
    evidence: { supporting: [], missing: [], explanation: "Confirmed." }, confirmation: "founder-confirmed" as const, createdAt: FIRST.toISOString(),
  };
  const semantic = applyRelationshipSemantics([
    { ...outflow, financialMeaning: "expense" }, { ...inflow, financialMeaning: "income" },
  ], [relationship]);
  const model = ingestFinancialSnapshot({
    lastUpdated: "2099-08-08",
    accounts: [{ id: "private-chequing", name: "Synthetic", institution: "Synthetic", balance: 100, type: "asset", group: "cash", updatedAt: "2099-08-08" }],
  });
  const view = deriveHomepageView({
    model, transactions: semantic.transactions, statementFacts: [], asOfDate: "2099-08-08",
    suppressedActivityTransactionIds: semantic.suppressedActivityTransactionIds,
  });
  assert.deepEqual(view.lifestyle.qualifyingSpending, { status: "known", amount: 0 });
  assert.deepEqual(view.inflows.qualifyingIncome, { status: "known", amount: 0 });
  assert.equal(view.recentAndUpcoming.recent.length, 1);
  assert.equal(view.recentAndUpcoming.recent[0].kind, "payment");
  const transferSemantic = applyRelationshipSemantics([
    { ...outflow, financialMeaning: "income" }, { ...inflow, financialMeaning: "expense" },
  ], [{ ...relationship, id: "internal-transfer", type: "internal-transfer" }]);
  const transferView = deriveHomepageView({
    model, transactions: transferSemantic.transactions, statementFacts: [], asOfDate: "2099-08-08",
    suppressedActivityTransactionIds: transferSemantic.suppressedActivityTransactionIds,
  });
  assert.deepEqual(transferView.lifestyle.qualifyingSpending, { status: "known", amount: 0 });
  assert.deepEqual(transferView.inflows.qualifyingIncome, { status: "known", amount: 0 });
  assert.equal(transferView.recentAndUpcoming.recent.length, 1);
  assert.equal(transferView.recentAndUpcoming.recent[0].kind, "transfer");
});

test("loan and reimbursement semantics remain distinct from salary", () => {
  const outflow = transaction({ id: "relationship-out", accountId: "private-chequing", direction: "outflow", meaning: "expense", amount: 50 });
  const inflow = transaction({ id: "relationship-in", accountId: "private-savings", direction: "inflow", meaning: "income", amount: 50 });
  for (const type of ["loan", "loan-repayment"] as RelationshipType[]) {
    const semantic = applyRelationshipSemantics([outflow, inflow], [{
      id: type, type, primaryTransactionId: outflow.id, secondaryTransactionId: inflow.id,
      primaryAccountId: outflow.accountId, secondaryAccountId: inflow.accountId,
      evidence: { supporting: [], missing: [], explanation: "Confirmed." }, confirmation: "founder-confirmed", createdAt: FIRST.toISOString(),
    }]);
    assert.equal(semantic.transactions.every((item) => item.financialMeaning === "transfer"), true);
  }
  const reimbursement = applyRelationshipSemantics([outflow, inflow], [{
    id: "reimbursement", type: "reimbursement", primaryTransactionId: outflow.id, secondaryTransactionId: inflow.id,
    primaryAccountId: outflow.accountId, secondaryAccountId: inflow.accountId,
    evidence: { supporting: [], missing: [], explanation: "Confirmed." }, confirmation: "founder-confirmed", createdAt: FIRST.toISOString(),
  }]);
  assert.deepEqual(reimbursement.transactions.map((item) => item.financialMeaning), ["expense", "refund"]);
});

test("relationship DTO hides identifiers and encrypted persistence survives reopen and deletion", async () => {
  const context = await fixture();
  try {
    context.service.sync(paymentPair(), accounts, FIRST.toISOString());
    const queue = context.service.listPending(FIRST);
    if (queue.status !== "available") assert.fail("queue unavailable");
    const serialized = JSON.stringify(queue);
    for (const forbidden of ["chequing-payment-1", "card-payment-1", "private-chequing", "private-card", "fingerprint", "databasePath", "pair_key"]) {
      assert.equal(serialized.includes(forbidden), false, forbidden);
    }
    assert.throws(() => context.service.save({ actionToken: `${queue.items[0].actionToken}x`, decision: "accept" }, LATER), FounderRelationshipServiceError);
    const accepted = context.service.save({ actionToken: queue.items[0].actionToken, decision: "accept" }, LATER);
    const relationshipId = accepted.relationship!.id;
    context.store.close();
    const bytes = await readFile(context.databasePath);
    for (const forbidden of ["chequing-payment-1", "card-payment-1", "private-chequing", "PAYMENT TO TD VISA"]) {
      assert.equal(bytes.includes(Buffer.from(forbidden)), false, forbidden);
    }
    const reopened = new LocalRelationshipStore({ databasePath: context.databasePath, encryptionKey: context.key });
    assert.equal(reopened.listRelationships().length, 1);
    reopened.deleteRelationship(relationshipId);
    assert.equal(reopened.listRelationships().length, 0);
    assert.equal(reopened.listRules().length, 0);
    reopened.close();
    assert.equal(context.store.databasePermissions(), 0o600);
  } finally {
    context.key.fill(0);
    await rm(context.root, { recursive: true, force: true });
  }
});
