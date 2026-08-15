import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ingestFinancialSnapshot } from "../lib/financial-model/canonical-financial-model.ts";
import { deriveHomepageView } from "../lib/homepage/derive-homepage-view.ts";
import { applyReviewOutcomes } from "../lib/review/apply-review-outcomes.ts";
import { FounderReviewService, FounderReviewServiceError } from "../lib/review/founder-review-service.ts";
import { LocalReviewLearningStore } from "../lib/review/local-review-learning-store.ts";
import type { CanonicalTransaction } from "../types/transactions.ts";

const FIRST = new Date("2099-08-08T12:00:00.000Z");
const LATER = new Date("2099-08-08T12:01:00.000Z");
const transaction = (id = "private-transaction-1"): CanonicalTransaction => ({
  id, accountId: "private-account", transactionDate: "2099-08-08", postedDate: null,
  amount: 24.5, direction: "outflow", currency: "CAD", rawDescription: "SYNTHETIC CORNER CAFE",
  normalizedCounterparty: "SYNTHETIC CORNER CAFE", financialMeaning: "unknown", status: "posted", relatedTransactionId: null,
  attribution: { world: null, category: null, method: "unclassified", ruleId: null, confidence: null, correctedAt: null },
  provenance: {
    importId: "private-import", providerId: "td", sourceRecordId: null, sourceKind: "import",
    observedAt: FIRST.toISOString(), sourceUpdatedAt: null,
    fingerprint: { version: "private-version", value: "private-fingerprint" }, deduplicationKey: "private-deduplication-key",
  },
  createdAt: FIRST.toISOString(), updatedAt: FIRST.toISOString(),
});
const model = ingestFinancialSnapshot({
  lastUpdated: "2099-08-08",
  accounts: [{ id: "private-account", name: "Synthetic", institution: "Synthetic", balance: 100, type: "asset", group: "cash", updatedAt: "2099-08-08" }],
});

const fixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "vorvex-founder-review-"));
  const key = randomBytes(32);
  const store = new LocalReviewLearningStore({ databasePath: path.join(root, "review.sqlite"), encryptionKey: key });
  const service = new FounderReviewService(store, key);
  return { key, root, store, service, async cleanup() { store.close(); key.fill(0); await rm(root, { recursive: true, force: true }); } };
};

test("browser review DTO contains only review display fields and a sealed action token", async () => {
  const context = await fixture();
  try {
    const outcome = context.store.evaluateTransaction(transaction(), FIRST.toISOString());
    const internal = context.store.listReviewItems()[0];
    const queue = context.service.listPending(FIRST);
    assert.equal(queue.status, "available");
    if (queue.status !== "available") return;
    assert.equal(queue.items[0].description, "SYNTHETIC CORNER CAFE");
    assert.equal(queue.items[0].explanationSource, "Unknown");
    assert.equal(queue.items[0].representativeDescription, "SYNTHETIC CORNER CAFE");
    assert.equal(queue.items[0].direction, "unknown");
    const serialized = JSON.stringify(queue);
    for (const forbidden of [
      internal.id, outcome.reviewItemId!, "private-transaction", "private-account", "private-import", "private-fingerprint",
      "fingerprint", "parser", "filename", "sourcePath", "encrypted", "databasePath", "normalizedCounterparty",
    ]) assert.equal(serialized.includes(forbidden), false, forbidden);
  } finally { await context.cleanup(); }
});

test("Founder decision persists learning, refreshes homepage inputs, and classifies future evaluation", async () => {
  const context = await fixture();
  try {
    const source = transaction();
    context.store.evaluateTransaction(transaction(), FIRST.toISOString());
    const before = deriveHomepageView({ model, transactions: [source], statementFacts: [], asOfDate: "2099-08-08" });
    assert.equal(before.lifestyle.qualifyingSpending.status, "known");
    assert.equal(before.lifestyle.qualifyingSpending.amount, 0);
    assert.equal(before.lifestyle.unclassifiedCount, 1);
    const queue = context.service.listPending(FIRST);
    if (queue.status !== "available") assert.fail("queue unavailable");
    const saved = context.service.save({
      actionToken: queue.items[0].actionToken, choice: "classify", financialMeaning: "expense", category: "Dining", world: "future",
    }, LATER);
    assert.ok(saved.learnedRuleId);
    assert.equal(context.store.listReviewItems("pending").length, 0);
    assert.equal(context.store.listRules().length, 1);
    const outcome = context.store.evaluateTransaction(source, LATER.toISOString());
    const reviewed = applyReviewOutcomes([source], [outcome], LATER.toISOString());
    const after = deriveHomepageView({ model, transactions: reviewed, statementFacts: [], asOfDate: "2099-08-08" });
    assert.deepEqual(after.lifestyle.qualifyingSpending, { status: "known", amount: 24.5 });
    assert.deepEqual(after.lifestyle.topCategories, [{ category: "Dining", amount: 24.5 }]);
    assert.equal(after.lifestyle.unclassifiedCount, 0);
    assert.match(after.assistantSummary.join(" "), /Dining is the largest/);
    const future = context.store.evaluateTransaction(transaction("private-transaction-2"), "2099-08-09T00:00:00.000Z");
    assert.equal(future.method, "user-confirmed-learned");
    assert.equal(future.category, "Dining");
  } finally { await context.cleanup(); }
});

test("one conservative grouped decision resolves matching history with one narrow learned rule", async () => {
  const context = await fixture();
  try {
    const sources = [transaction("private-transaction-1"), transaction("private-transaction-2")];
    context.store.evaluateTransactions(sources, FIRST.toISOString());
    const queue = context.service.listPending(FIRST, sources);
    if (queue.status !== "available") assert.fail("queue unavailable");
    assert.equal(queue.items.length, 1);
    assert.equal(queue.items[0].similarCount, 2);
    assert.equal(queue.items[0].totalAmount, 49);
    assert.equal(queue.items[0].representativeTransactions.length, 2);
    assert.deepEqual(queue.items[0].accountNames, ["Account"]);
    const saved = context.service.save({
      actionToken: queue.items[0].actionToken, choice: "classify", scope: "group",
      financialMeaning: "expense", category: "Dining", world: "cash",
    }, LATER);
    assert.equal("resolvedCount" in saved ? saved.resolvedCount : null, 2);
    assert.equal(context.store.listReviewItems("pending").length, 0);
    assert.equal(context.store.listRules().length, 1);
    assert.equal(context.store.evaluateTransaction(transaction("private-transaction-3"), LATER.toISOString()).category, "Dining");
  } finally { await context.cleanup(); }
});

test("recurring merchant groups lead value-only groups and expose review evidence", async () => {
  const context = await fixture();
  try {
    const source = (id: string, name: string, date: string, amount: number) => ({
      ...transaction(id), transactionDate: date, amount, rawDescription: `${name} LOCATION DETAIL`, normalizedCounterparty: name,
    });
    const sources = [
      source("weekly-1", "WEEKLY MERCHANT", "2099-07-11", 10), source("weekly-2", "WEEKLY MERCHANT", "2099-07-18", 10),
      source("weekly-3", "WEEKLY MERCHANT", "2099-07-25", 10), source("large-1", "LARGE ONE OFF", "2099-08-08", 1000),
    ];
    context.store.evaluateTransactions(sources, FIRST.toISOString());
    const queue = context.service.listPending(FIRST, sources, new Map([["private-account", "Everyday account"]]));
    if (queue.status !== "available") assert.fail("queue unavailable");
    assert.equal(queue.items[0].description, "WEEKLY MERCHANT");
    assert.equal(queue.items[0].recurring, true);
    assert.equal(queue.items[0].direction, "outflow");
    assert.deepEqual(queue.items[0].accountNames, ["Everyday account"]);
    assert.equal(queue.items[0].representativeTransactions.length, 3);
    assert.equal(typeof queue.items[0].representativeTransactions[0].actionToken, "string");
    assert.deepEqual({ ...queue.items[0].representativeTransactions[0], actionToken: undefined }, {
      actionToken: undefined,
      date: "2099-07-25", amount: 10, accountName: "Everyday account",
      description: "WEEKLY MERCHANT LOCATION DETAIL", direction: "outflow",
    });
  } finally { await context.cleanup(); }
});

test("review UI presents one filterable bulk workspace with explicit selection and Undo", async () => {
  const [page, form] = await Promise.all([
    readFile(new URL("../app/review/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../components/bulk-review-workspace.tsx", import.meta.url), "utf8"),
  ]);
  for (const phrase of ["Review unresolved transactions", "Only checked transactions will change", "BulkReviewWorkspace"])
    assert.equal(page.includes(phrase), true, phrase);
  for (const phrase of ["Search merchant or description", "All accounts", "Inflow and outflow", "World, category or meaning", "Select all visible", "Clear selection", "Inspect exactly what will change", "Choose a World", "+ New", "Cancel", "Confirm", "Undo"])
    assert.equal(form.includes(phrase), true, phrase);
});

test("pending and recent reviews expose canonical transaction context with posted-date fallback", async () => {
  const context = await fixture();
  try {
    const source = { ...transaction(), transactionDate: "", postedDate: "2099-08-07" };
    context.store.evaluateTransaction(source, FIRST.toISOString());
    const names = new Map([["private-account", "TD Chequing Account"]]);
    const queue = context.service.listPending(FIRST, [source], names);
    if (queue.status !== "available") assert.fail("queue unavailable");
    assert.equal(typeof queue.items[0].representativeTransactions[0].actionToken, "string");
    assert.deepEqual({ ...queue.items[0].representativeTransactions[0], actionToken: undefined }, {
      actionToken: undefined,
      date: "2099-08-07", amount: 24.5, accountName: "TD Chequing Account",
      description: "SYNTHETIC CORNER CAFE", direction: "outflow",
    });
    context.service.save({ actionToken: queue.items[0].actionToken, choice: "classify", scope: "one", financialMeaning: "expense", category: "Dining", world: "cash" }, LATER);
    const recent = context.service.listRecentDecisions(LATER, 250, [source], names);
    assert.deepEqual({ description: recent[0].description, date: recent[0].date, accountName: recent[0].accountName, amount: recent[0].amount, direction: recent[0].direction, currency: recent[0].currency }, {
      description: "SYNTHETIC CORNER CAFE", date: "2099-08-07", accountName: "TD Chequing Account",
      amount: 24.5, direction: "outflow", currency: "CAD",
    });
  } finally { await context.cleanup(); }
});

test("bulk classification changes only explicit unrelated rows, creates no rule, and undoes exactly", async () => {
  const context = await fixture();
  try {
    const sources = [
      { ...transaction("bulk-a"), rawDescription: "MERCHANT A", normalizedCounterparty: "MERCHANT A" },
      { ...transaction("bulk-b"), rawDescription: "MERCHANT B", normalizedCounterparty: "MERCHANT B" },
      { ...transaction("bulk-c"), rawDescription: "MERCHANT C", normalizedCounterparty: "MERCHANT C" },
    ];
    context.store.evaluateTransactions(sources, FIRST.toISOString());
    const queue = context.service.listPending(FIRST, sources);
    if (queue.status !== "available") assert.fail("queue unavailable");
    const tokens = queue.items.filter((item) => item.description !== "MERCHANT C").map((item) => item.representativeTransactions[0].actionToken);
    const saved = context.service.saveBulk(tokens, { financialMeaning: "expense", category: "Shopping", world: "cash" }, LATER);
    assert.equal(saved.resolvedCount, 2);
    assert.equal(context.store.listRules().length, 0);
    assert.equal(context.store.listReviewItems("resolved").length, 2);
    assert.equal(context.store.listReviewItems("pending").length, 1);
    context.service.undo(saved.undoToken, new Date("2099-08-08T12:02:00.000Z"));
    assert.equal(context.store.listReviewItems("resolved").length, 0);
    assert.equal(context.store.listReviewItems("pending").length, 3);
    assert.equal(context.store.listRules().length, 0);
  } finally { await context.cleanup(); }
});

test("classification can be undone atomically with its learned rule and alias", async () => {
  const context = await fixture();
  try {
    context.store.evaluateTransaction(transaction(), FIRST.toISOString());
    const queue = context.service.listPending(FIRST, [transaction()]);
    if (queue.status !== "available") assert.fail("queue unavailable");
    context.service.save({ actionToken: queue.items[0].actionToken, choice: "classify", financialMeaning: "expense", category: "Dining", world: "cash", userPhrase: "dinner out" }, LATER);
    assert.equal(context.store.listRules().length, 1); assert.equal(context.store.listLanguageAliases().length, 1);
    context.service.undo(queue.items[0].actionToken, new Date("2099-08-08T12:02:00.000Z"));
    assert.equal(context.store.listRules().length, 0); assert.equal(context.store.listLanguageAliases().length, 0);
    assert.equal(context.store.listReviewItems("pending").length, 1);
  } finally { await context.cleanup(); }
});

test("individual Undo from a grouped decision restores only the saved transaction", async () => {
  const context = await fixture();
  try {
    const sources = [transaction("private-transaction-1"), transaction("private-transaction-2")];
    context.store.evaluateTransactions(sources, FIRST.toISOString());
    const queue = context.service.listPending(FIRST, sources); if (queue.status !== "available") assert.fail("queue unavailable");
    context.service.save({ actionToken: queue.items[0].actionToken, choice: "classify", scope: "one", financialMeaning: "expense", category: "Dining", world: "cash" }, LATER);
    assert.equal(context.store.listReviewItems("resolved").length, 1);
    assert.equal(context.store.listRules().length, 0);
    context.service.undo(queue.items[0].actionToken, new Date("2099-08-08T12:02:00.000Z"), "one");
    assert.equal(context.store.listReviewItems("resolved").length, 0);
    assert.equal(context.store.listReviewItems("pending").length, 2);
  } finally { await context.cleanup(); }
});

test("a selected subset resolves explicitly without learning across the remaining merchant group", async () => {
  const context = await fixture();
  try {
    const sources = [0, 1, 2, 3].map((index) => ({ ...transaction(`subset-${index}`), amount: 10 + index }));
    context.store.evaluateTransactions(sources, FIRST.toISOString());
    const queue = context.service.listPending(FIRST, sources); if (queue.status !== "available") assert.fail("queue unavailable");
    const saved = context.service.save({ actionToken: queue.items[0].actionToken, choice: "classify", scope: "subset", selectedIndexes: [0, 2], financialMeaning: "expense", category: "Groceries", world: "cash" }, LATER);
    assert.equal("resolvedCount" in saved ? saved.resolvedCount : null, 2);
    assert.equal(context.store.listReviewItems("resolved").length, 2);
    assert.equal(context.store.listReviewItems("pending").length, 2);
    assert.equal(context.store.listRules().length, 0);
    context.service.undo(queue.items[0].actionToken, new Date("2099-08-08T12:02:00.000Z"), "subset", [0, 2]);
    assert.equal(context.store.listReviewItems("pending").length, 4);
  } finally { await context.cleanup(); }
});

test("a Founder-created category persists as an alias and is offered again without a broad rule", async () => {
  const context = await fixture();
  try {
    const source = transaction(); context.store.evaluateTransaction(source, FIRST.toISOString());
    const queue = context.service.listPending(FIRST, [source]); if (queue.status !== "available") assert.fail("queue unavailable");
    context.service.save({ actionToken: queue.items[0].actionToken, choice: "classify", scope: "one", financialMeaning: "expense", category: "Pet care", world: "cash", userPhrase: "pet care" }, LATER);
    assert.equal(context.store.listRules().length, 0); assert.equal(context.store.listLanguageAliases().length, 1);
    const next = transaction("private-transaction-2"); context.store.evaluateTransaction(next, LATER.toISOString());
    const nextQueue = context.service.listPending(new Date("2099-08-08T12:02:00.000Z"), [next]); if (nextQueue.status !== "available") assert.fail("queue unavailable");
    assert.equal(nextQueue.items[0].suggestions.some((suggestion) => suggestion.category === "Pet care" && suggestion.reason.includes("Founder")), true);
  } finally { await context.cleanup(); }
});

test("Review later preserves Unknown and automatically returns after the cooling period", async () => {
  const context = await fixture();
  try {
    const source = transaction(); context.store.evaluateTransaction(source, FIRST.toISOString());
    const queue = context.service.listPending(FIRST, [source]); if (queue.status !== "available") assert.fail("queue unavailable");
    context.service.save({ actionToken: queue.items[0].actionToken, choice: "review-later" }, LATER);
    assert.equal(context.store.listReviewItems("pending").length, 0); assert.equal(context.store.listRules().length, 0);
    assert.equal(context.service.listPending(new Date("2099-08-09T12:02:00.000Z"), [source]).items.length, 1);
  } finally { await context.cleanup(); }
});

test("a resolved transaction can be corrected in place without duplication", async () => {
  const context = await fixture();
  try {
    const source = transaction(); context.store.evaluateTransaction(source, FIRST.toISOString());
    const queue = context.service.listPending(FIRST, [source]); if (queue.status !== "available") assert.fail("queue unavailable");
    context.service.save({ actionToken: queue.items[0].actionToken, choice: "classify", financialMeaning: "expense", category: "Fuel", world: "vehicle" }, LATER);
    const correction = context.service.correctionForTransaction(source, new Date("2099-08-08T12:02:00.000Z")); assert.ok(correction);
    context.service.correct(correction.actionToken, { financialMeaning: "expense", category: "Maintenance & Repairs", world: "vehicle" }, new Date("2099-08-08T12:03:00.000Z"));
    assert.equal(context.store.listReviewItems("resolved").length, 1); assert.equal(context.store.listRules().length, 1);
    const applied = context.store.evaluateTransaction(source, "2099-08-08T12:04:00.000Z");
    assert.equal(applied.category, "Maintenance & Repairs"); assert.equal(applied.world, "vehicle");
  } finally { await context.cleanup(); }
});

test("a classified transaction can be corrected contextually before a review decision exists", async () => {
  const context = await fixture();
  try {
    const source = transaction();
    context.store.evaluateTransaction(source, FIRST.toISOString());
    const correction = context.service.correctionForTransaction(source, new Date("2099-08-08T12:02:00.000Z"));
    assert.ok(correction);
    context.service.correct(correction.actionToken, { financialMeaning: "expense", category: "Maintenance & Repairs", world: "vehicle" }, new Date("2099-08-08T12:03:00.000Z"));
    assert.equal(context.store.listReviewItems("resolved").length, 1);
    assert.equal(context.store.listRules().length, 0);
    const applied = context.store.evaluateTransaction(source, "2099-08-08T12:04:00.000Z");
    assert.equal(applied.category, "Maintenance & Repairs");
    assert.equal(applied.world, "vehicle");
  } finally { await context.cleanup(); }
});

test("mortgage search concept maps one grouped confirmation through Cashflow and Home without Lifestyle spending", async () => {
  const context = await fixture();
  try {
    const sources = ["1", "2", "3"].map((id) => ({
      ...transaction(`mortgage-${id}`), amount: 1200, rawDescription: `BNC MTG PAYMENT ${id}`,
      normalizedCounterparty: "BNC MTG", transactionDate: `2099-08-0${Number(id) + 2}`,
    }));
    context.store.evaluateTransactions(sources, FIRST.toISOString());
    const queue = context.service.listPending(FIRST, sources, new Map([["private-account", "Everyday account"]]));
    if (queue.status !== "available") assert.fail("queue unavailable");
    const suggestion = queue.items[0].suggestions.find((item) => item.id === "mortgage-payment");
    assert.deepEqual(suggestion && { label: suggestion.label, path: suggestion.path, meaning: suggestion.financialMeaning, category: suggestion.category, world: suggestion.world }, {
      label: "Mortgage payment", path: "Home → Mortgage → Payment", meaning: "expense", category: "Mortgage", world: "home",
    });
    context.service.save({ actionToken: queue.items[0].actionToken, choice: "classify", scope: "group", financialMeaning: suggestion!.financialMeaning, category: suggestion!.category, world: suggestion!.world }, LATER);
    const reviewed = applyReviewOutcomes(sources, context.store.evaluateTransactions(sources, LATER.toISOString()), LATER.toISOString());
    assert.equal(reviewed.every((item) => item.attribution.world === "home" && item.attribution.category === "Mortgage" && item.financialMeaning === "expense"), true);
    const homepage = deriveHomepageView({ model, transactions: reviewed, statementFacts: [], asOfDate: "2099-08-08" });
    assert.deepEqual(homepage.cashflow.moneyOut, { status: "known", amount: 3600 });
    assert.deepEqual(homepage.lifestyle.qualifyingSpending, { status: "known", amount: 0 });
    assert.equal(homepage.lifestyle.categories.some((item) => item.label === "Mortgage"), false);
    assert.equal(context.store.listRules().length, 1);
  } finally { await context.cleanup(); }
});

test("Founder phrases map the acceptance merchants to conservative human concepts", async () => {
  const cases = [
    { name: "THE COURTYARDS MSP", direction: "outflow", concept: "home-maintenance", phrase: "house maintenance" },
    { name: "BK OF MONTREAL LOAN", direction: "outflow", concept: "vehicle-payment", phrase: "car payment vehicle loan" },
    { name: "TST IRANGE TORONTO", direction: "outflow", concept: "entertainment-outing", phrase: "outing" },
    { name: "SECURITY NATIONAL INS", direction: "outflow", concept: "home-insurance", phrase: "house insurance" },
    { name: "401 DIXIE KIA", direction: "outflow", concept: "vehicle-maintenance", phrase: "car service" },
    { name: "ZOWN REALTY", direction: "inflow", concept: "home-rebate", phrase: "house cashback" },
  ] as const;
  for (const [index, example] of cases.entries()) {
    const context = await fixture();
    try {
      const source = { ...transaction(`acceptance-${index}`), rawDescription: example.name, normalizedCounterparty: example.name, direction: example.direction };
      context.store.evaluateTransaction(source, FIRST.toISOString());
      const queue = context.service.listPending(FIRST, [source]);
      if (queue.status !== "available") assert.fail("queue unavailable");
      const suggestion = queue.items[0].suggestions.find((item) => item.id === example.concept);
      assert.ok(suggestion, example.name);
      for (const word of example.phrase.split(" ")) assert.match(`${suggestion.searchTerms} ${suggestion.label}`.toLowerCase(), new RegExp(word));
      if (example.direction === "inflow") assert.equal(suggestion.financialMeaning, "refund");
    } finally { await context.cleanup(); }
  }
});

test("bank fees and fee rebates share a category while preserving meaning and direction", async () => {
  const context = await fixture();
  try {
    const sources = [
      { ...transaction("fee"), rawDescription: "MONTHLY BANK FEE", normalizedCounterparty: "MONTHLY BANK FEE" },
      { ...transaction("rebate"), rawDescription: "BANK FEE REBATE", normalizedCounterparty: "BANK FEE REBATE", direction: "inflow" as const },
    ];
    context.store.evaluateTransactions(sources, FIRST.toISOString());
    const queue = context.service.listPending(FIRST, sources);
    if (queue.status !== "available") assert.fail("queue unavailable");
    const fee = queue.items.find((item) => item.direction === "outflow")!.suggestions.find((item) => item.id === "bank-fee")!;
    const rebate = queue.items.find((item) => item.direction === "inflow")!.suggestions.find((item) => item.id === "bank-fee-rebate")!;
    assert.equal(fee.category, rebate.category);
    assert.deepEqual([fee.financialMeaning, rebate.financialMeaning], ["fee", "refund"]);
  } finally { await context.cleanup(); }
});

test("amount dispersion splits ambiguous names while stable recurring evidence remains grouped", async () => {
  const context = await fixture();
  try {
    const make = (id: string, amount: number, date: string) => ({ ...transaction(id), amount, transactionDate: date, rawDescription: "MULTI PURPOSE NAME", normalizedCounterparty: "MULTI PURPOSE NAME" });
    const varied = [make("v1", 8, "2099-06-01"), make("v2", 70, "2099-06-08"), make("v3", 420, "2099-08-08")];
    context.store.evaluateTransactions(varied, FIRST.toISOString());
    const queue = context.service.listPending(FIRST, varied);
    if (queue.status !== "available") assert.fail("queue unavailable");
    assert.equal(queue.items.length, 3);
    assert.equal(queue.items.every((item) => item.similarCount === 1), true);
  } finally { await context.cleanup(); }
});

test("Keep Unknown and Ignore preserve evidence without creating learning rules", async () => {
  for (const choice of ["keep-unknown", "ignore"] as const) {
    const context = await fixture();
    try {
      context.store.evaluateTransaction(transaction(), FIRST.toISOString());
      const queue = context.service.listPending(FIRST);
      if (queue.status !== "available") assert.fail("queue unavailable");
      context.service.save({ actionToken: queue.items[0].actionToken, choice }, LATER);
      assert.equal(context.store.listRules().length, 0);
      assert.equal(context.store.listReviewItems(null)[0].status, choice === "ignore" ? "ignored" : "resolved");
    } finally { await context.cleanup(); }
  }
});

test("tampered and expired action tokens cannot resolve a review", async () => {
  const context = await fixture();
  try {
    context.store.evaluateTransaction(transaction(), FIRST.toISOString());
    const queue = context.service.listPending(FIRST);
    if (queue.status !== "available") assert.fail("queue unavailable");
    const token = queue.items[0].actionToken;
    for (const candidate of [`${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`, token]) {
      const now = candidate === token ? new Date(FIRST.getTime() + 31 * 60 * 1000) : LATER;
      assert.throws(() => context.service.save({ actionToken: candidate, choice: "keep-unknown" }, now), FounderReviewServiceError);
    }
    assert.equal(context.store.listReviewItems("pending").length, 1);
  } finally { await context.cleanup(); }
});
