import { randomUUID } from "node:crypto";
import { chmodSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { MoneyWorldKey } from "../../types/finance.ts";
import type { CanonicalTransaction, FinancialMeaning } from "../../types/transactions.ts";
import type {
  ClassificationOutcome,
  LearningRule,
  LanguageAlias,
  LearningRuleSource,
  RelationshipKind,
  ReviewDecision,
  ReviewItem,
  ReviewReason,
  RuleClassification,
} from "../../types/review.ts";
import { copyPersistenceKey, decryptJsonPayload, encryptJsonPayload } from "../persistence/field-encryption.ts";

type SqlRow = Record<string, unknown>;
type ReviewPayload = Omit<ReviewItem, "id" | "transactionId" | "status" | "reason" | "createdAt" | "updatedAt">;
type RulePayload = Pick<LearningRule, "normalizedCounterparty" | "accountId" | "classification" | "explanation">;
type DecisionPayload = ReviewDecision & { relatedTransactionId: string | null; learnedRuleId: string | null; learnedAliasId?: string | null; previousAlias?: AliasPayload | null; deferred?: boolean };
type AliasPayload = Pick<LanguageAlias, "phrase" | "classification">;

const SCHEMA_VERSION = 2;
const REVIEW_REASONS = new Set<ReviewReason>([
  "unknown-merchant", "ambiguous-transfer", "ambiguous-relationship", "no-category", "low-confidence",
  "conflicting-learned-rules", "unknown-financial-meaning", "manual-review-requested",
]);
const WORLDS = new Set<MoneyWorldKey>(["cash", "investments", "home", "vehicle", "creditDebt", "income", "upcoming", "future"]);
const MEANINGS = new Set<FinancialMeaning>([
  "expense", "income", "refund", "reversal", "fee", "interest", "credit-card-purchase",
  "credit-card-payment", "transfer", "cash-withdrawal", "cash-deposit", "unknown",
]);
const RULE_SOURCES = new Set<LearningRuleSource>(["user-created", "user-confirmed-learned"]);
const DECISIONS = new Set<ReviewDecision["kind"]>(["classify", "confirm-relationship", "ignore", "keep-unknown"]);
const RELATIONSHIPS = new Set<RelationshipKind>(["transfer", "repayment", "reimbursement", "loan", "credit-card-payment"]);

const schema = `
  CREATE TABLE review_metadata (key TEXT PRIMARY KEY, value INTEGER NOT NULL) STRICT;
  INSERT INTO review_metadata (key, value) VALUES ('schema_version', ${SCHEMA_VERSION});
  CREATE TABLE review_items (
    review_id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('pending','resolved','ignored')),
    reason TEXT NOT NULL,
    encrypted_payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;
  CREATE INDEX review_items_status_created ON review_items(status, created_at, review_id);
  CREATE TABLE learning_rules (
    rule_id TEXT PRIMARY KEY,
    source TEXT NOT NULL CHECK (source IN ('user-created','user-confirmed-learned')),
    status TEXT NOT NULL CHECK (status IN ('active','disabled')),
    encrypted_payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT;
  CREATE INDEX learning_rules_status_source ON learning_rules(status, source, created_at);
  CREATE TABLE review_decisions (
    decision_id TEXT PRIMARY KEY,
    review_id TEXT NOT NULL UNIQUE REFERENCES review_items(review_id),
    transaction_id TEXT NOT NULL,
    decision_kind TEXT NOT NULL CHECK (decision_kind IN ('classify','confirm-relationship','ignore','keep-unknown')),
    encrypted_payload TEXT NOT NULL,
    decided_at TEXT NOT NULL
  ) STRICT;
  CREATE TABLE language_aliases (
    alias_id TEXT PRIMARY KEY, encrypted_payload TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  ) STRICT;
`;

export class ReviewLearningError extends Error {
  readonly code: "REVIEW_INVALID" | "REVIEW_NOT_FOUND" | "RULE_INVALID" | "RULE_NOT_FOUND" | "REVIEW_PERSISTENCE_FAILED";

  constructor(code: ReviewLearningError["code"]) {
    super(code);
    this.name = "ReviewLearningError";
    this.code = code;
  }
}

const assertTimestamp = (value: string) => {
  if (!value || Number.isNaN(Date.parse(value))) throw new ReviewLearningError("REVIEW_INVALID");
};
const assertClassification = (value: RuleClassification) => {
  if (value.financialMeaning !== null && !MEANINGS.has(value.financialMeaning)) throw new ReviewLearningError("RULE_INVALID");
  if (value.world !== null && !WORLDS.has(value.world)) throw new ReviewLearningError("RULE_INVALID");
  if (value.category !== null && (!value.category.trim() || value.category.length > 80)) throw new ReviewLearningError("RULE_INVALID");
  if (value.financialMeaning === null && value.world === null && value.category === null) throw new ReviewLearningError("RULE_INVALID");
};
const sameClassification = (left: RuleClassification, right: RuleClassification) =>
  left.financialMeaning === right.financialMeaning && left.category === right.category && left.world === right.world;

export class LocalReviewLearningStore {
  readonly databasePath: string;
  #database: DatabaseSync;
  #key: Uint8Array;
  #closed = false;

  constructor({ databasePath, encryptionKey }: { databasePath: string; encryptionKey: Uint8Array }) {
    this.databasePath = databasePath;
    this.#key = copyPersistenceKey(encryptionKey);
    if (databasePath !== ":memory:") {
      const directory = path.dirname(databasePath);
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      chmodSync(directory, 0o700);
    }
    try {
      this.#database = new DatabaseSync(databasePath);
      if (databasePath !== ":memory:") chmodSync(databasePath, 0o600);
      this.#database.exec("PRAGMA foreign_keys = ON; PRAGMA secure_delete = ON; PRAGMA synchronous = FULL;");
      const metadataExists = this.#database.prepare(
        "SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'review_metadata'",
      ).get();
      if (!metadataExists) this.#database.exec(schema);
      const version = Number(this.#database.prepare("SELECT value FROM review_metadata WHERE key = 'schema_version'").get()?.value);
      if (version === 1) this.#database.exec("BEGIN; CREATE TABLE language_aliases (alias_id TEXT PRIMARY KEY, encrypted_payload TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL) STRICT; UPDATE review_metadata SET value = 2 WHERE key = 'schema_version'; COMMIT;");
      else if (version !== SCHEMA_VERSION) throw new ReviewLearningError("REVIEW_PERSISTENCE_FAILED");
    } catch (error) {
      this.#key.fill(0);
      if (error instanceof ReviewLearningError) throw error;
      throw new ReviewLearningError("REVIEW_PERSISTENCE_FAILED");
    }
  }

  close() {
    if (this.#closed) return;
    this.#database.close();
    this.#key.fill(0);
    this.#closed = true;
  }

  databasePermissions() {
    return this.databasePath === ":memory:" ? null : statSync(this.databasePath).mode & 0o777;
  }

  #ruleFromRow(row: SqlRow): LearningRule {
    const payload = decryptJsonPayload<RulePayload>(String(row.encrypted_payload), this.#key);
    return {
      id: String(row.rule_id), source: String(row.source) as LearningRuleSource,
      status: String(row.status) as LearningRule["status"], createdAt: String(row.created_at), updatedAt: String(row.updated_at),
      ...payload,
    };
  }

  #reviewFromRow(row: SqlRow): ReviewItem {
    const payload = decryptJsonPayload<ReviewPayload>(String(row.encrypted_payload), this.#key);
    return {
      id: String(row.review_id), transactionId: String(row.transaction_id), status: String(row.status) as ReviewItem["status"],
      reason: String(row.reason) as ReviewReason, createdAt: String(row.created_at), updatedAt: String(row.updated_at), ...payload,
    };
  }

  listRules(): readonly LearningRule[] {
    return (this.#database.prepare("SELECT * FROM learning_rules ORDER BY created_at, rule_id").all() as SqlRow[]).map((row) => this.#ruleFromRow(row));
  }

  listLanguageAliases(): readonly LanguageAlias[] {
    return (this.#database.prepare("SELECT * FROM language_aliases ORDER BY created_at, alias_id").all() as SqlRow[]).map((row) => ({
      id: String(row.alias_id), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
      ...decryptJsonPayload<AliasPayload>(String(row.encrypted_payload), this.#key),
    }));
  }

  createLanguageAlias(phrase: string, classification: RuleClassification, createdAt: string) {
    assertTimestamp(createdAt); assertClassification(classification);
    const normalized = phrase.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-CA");
    if (normalized.length < 2 || normalized.length > 240) throw new ReviewLearningError("RULE_INVALID");
    const existing = this.listLanguageAliases().find((alias) => alias.phrase === normalized);
    const payload: AliasPayload = { phrase: normalized, classification };
    if (existing) {
      this.#database.prepare("UPDATE language_aliases SET encrypted_payload = ?, updated_at = ? WHERE alias_id = ?").run(encryptJsonPayload(payload, this.#key), createdAt, existing.id);
      return { ...existing, classification, updatedAt: createdAt, created: false };
    }
    const alias: LanguageAlias = { id: `language-alias:${randomUUID()}`, ...payload, createdAt, updatedAt: createdAt };
    this.#database.prepare("INSERT INTO language_aliases VALUES (?, ?, ?, ?)").run(alias.id, encryptJsonPayload(payload, this.#key), createdAt, createdAt);
    return { ...alias, created: true };
  }

  createRule({
    source = "user-created", normalizedCounterparty, accountId = null, classification, explanation, createdAt,
  }: {
    source?: LearningRuleSource; normalizedCounterparty: string; accountId?: string | null;
    classification: RuleClassification; explanation?: string; createdAt: string;
  }): LearningRule {
    assertTimestamp(createdAt);
    const matcher = normalizedCounterparty.trim();
    if (!RULE_SOURCES.has(source) || !matcher || matcher.length > 240 || (accountId !== null && !accountId.trim())) {
      throw new ReviewLearningError("RULE_INVALID");
    }
    assertClassification(classification);
    const rule: LearningRule = {
      id: `review-rule:${randomUUID()}`, source, status: "active", normalizedCounterparty: matcher,
      accountId, classification, explanation: explanation?.trim() || `Matched ${source} exact counterparty rule.`, createdAt, updatedAt: createdAt,
    };
    const payload: RulePayload = {
      normalizedCounterparty: rule.normalizedCounterparty, accountId: rule.accountId,
      classification: rule.classification, explanation: rule.explanation,
    };
    this.#database.prepare("INSERT INTO learning_rules VALUES (?, ?, 'active', ?, ?, ?)")
      .run(rule.id, rule.source, encryptJsonPayload(payload, this.#key), createdAt, createdAt);
    return rule;
  }

  setRuleEnabled(ruleId: string, enabled: boolean, updatedAt: string) {
    assertTimestamp(updatedAt);
    const result = this.#database.prepare("UPDATE learning_rules SET status = ?, updated_at = ? WHERE rule_id = ?")
      .run(enabled ? "active" : "disabled", updatedAt, ruleId);
    if (result.changes !== 1) throw new ReviewLearningError("RULE_NOT_FOUND");
  }

  updateRule(ruleId: string, update: {
    normalizedCounterparty?: string; accountId?: string | null;
    classification: RuleClassification; explanation: string;
  }, updatedAt: string) {
    assertTimestamp(updatedAt);
    assertClassification(update.classification);
    const row = this.#database.prepare("SELECT * FROM learning_rules WHERE rule_id = ?").get(ruleId) as SqlRow | undefined;
    if (!row) throw new ReviewLearningError("RULE_NOT_FOUND");
    const current = this.#ruleFromRow(row);
    const normalizedCounterparty = update.normalizedCounterparty?.trim() ?? current.normalizedCounterparty;
    const accountId = update.accountId === undefined ? current.accountId : update.accountId;
    if (!normalizedCounterparty || normalizedCounterparty.length > 240 || (accountId !== null && !accountId.trim())) {
      throw new ReviewLearningError("RULE_INVALID");
    }
    const payload: RulePayload = {
      normalizedCounterparty, accountId, classification: update.classification, explanation: update.explanation.trim(),
    };
    this.#database.prepare("UPDATE learning_rules SET encrypted_payload = ?, updated_at = ? WHERE rule_id = ?")
      .run(encryptJsonPayload(payload, this.#key), updatedAt, ruleId);
  }

  deleteRule(ruleId: string) {
    const result = this.#database.prepare("DELETE FROM learning_rules WHERE rule_id = ?").run(ruleId);
    if (result.changes !== 1) throw new ReviewLearningError("RULE_NOT_FOUND");
  }

  listReviewItems(status: ReviewItem["status"] | null = "pending"): readonly ReviewItem[] {
    const rows = status === null
      ? this.#database.prepare("SELECT * FROM review_items ORDER BY created_at, review_id").all()
      : this.#database.prepare("SELECT * FROM review_items WHERE status = ? ORDER BY created_at, review_id").all(status);
    return (rows as SqlRow[]).map((row) => this.#reviewFromRow(row));
  }

  reviewDecision(reviewId: string) {
    const row = this.#database.prepare("SELECT * FROM review_decisions WHERE review_id = ?").get(reviewId) as SqlRow | undefined;
    return row ? decryptJsonPayload<DecisionPayload>(String(row.encrypted_payload), this.#key) : null;
  }

  restoreDeferredReviews(now: string) {
    assertTimestamp(now);
    const threshold = Date.parse(now) - 24 * 60 * 60 * 1000;
    const rows = this.#database.prepare("SELECT * FROM review_decisions WHERE decision_kind = 'ignore'").all() as SqlRow[];
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const row of rows) {
        const payload = decryptJsonPayload<DecisionPayload>(String(row.encrypted_payload), this.#key);
        if (payload.deferred && Date.parse(String(row.decided_at)) <= threshold) {
          this.#database.prepare("DELETE FROM review_decisions WHERE decision_id = ?").run(String(row.decision_id));
          this.#database.prepare("UPDATE review_items SET status = 'pending', updated_at = ? WHERE review_id = ?").run(now, String(row.review_id));
        }
      }
      this.#database.exec("COMMIT");
    } catch { this.#database.exec("ROLLBACK"); throw new ReviewLearningError("REVIEW_PERSISTENCE_FAILED"); }
  }

  deferReviews(reviewIds: readonly string[], decidedAt: string) {
    assertTimestamp(decidedAt);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const reviewId of [...new Set(reviewIds)]) {
        const row = this.#database.prepare("SELECT * FROM review_items WHERE review_id = ? AND status = 'pending'").get(reviewId) as SqlRow | undefined;
        if (!row) throw new ReviewLearningError("REVIEW_INVALID");
        const payload: DecisionPayload = { kind: "ignore", relatedTransactionId: null, learnedRuleId: null, deferred: true };
        this.#database.prepare("INSERT INTO review_decisions VALUES (?, ?, ?, 'ignore', ?, ?)").run(`review-decision:${randomUUID()}`, reviewId, String(row.transaction_id), encryptJsonPayload(payload, this.#key), decidedAt);
        this.#database.prepare("UPDATE review_items SET status = 'ignored', updated_at = ? WHERE review_id = ?").run(decidedAt, reviewId);
      }
      this.#database.exec("COMMIT");
      return { status: "deferred" as const };
    } catch { this.#database.exec("ROLLBACK"); throw new ReviewLearningError("REVIEW_PERSISTENCE_FAILED"); }
  }

  undoReviews(reviewIds: readonly string[], updatedAt: string) {
    assertTimestamp(updatedAt);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const reviewId of [...new Set(reviewIds)]) {
        const decisionRow = this.#database.prepare("SELECT * FROM review_decisions WHERE review_id = ?").get(reviewId) as SqlRow | undefined;
        if (!decisionRow) throw new ReviewLearningError("REVIEW_NOT_FOUND");
        const payload = decryptJsonPayload<DecisionPayload>(String(decisionRow.encrypted_payload), this.#key);
        if (payload.learnedRuleId) this.#database.prepare("DELETE FROM learning_rules WHERE rule_id = ?").run(payload.learnedRuleId);
        if (payload.learnedAliasId) this.#database.prepare("DELETE FROM language_aliases WHERE alias_id = ?").run(payload.learnedAliasId);
        else if (payload.previousAlias) this.createLanguageAlias(payload.previousAlias.phrase, payload.previousAlias.classification, updatedAt);
        this.#database.prepare("DELETE FROM review_decisions WHERE review_id = ?").run(reviewId);
        this.#database.prepare("UPDATE review_items SET status = 'pending', updated_at = ? WHERE review_id = ?").run(updatedAt, reviewId);
      }
      this.#database.exec("COMMIT");
      return { status: "pending" as const, restoredCount: new Set(reviewIds).size };
    } catch { this.#database.exec("ROLLBACK"); throw new ReviewLearningError("REVIEW_PERSISTENCE_FAILED"); }
  }

  correctReview(reviewId: string, decision: ReviewDecision, decidedAt: string) {
    assertTimestamp(decidedAt);
    if (decision.kind !== "classify") throw new ReviewLearningError("REVIEW_INVALID");
    const row = this.#database.prepare("SELECT * FROM review_items WHERE review_id = ?").get(reviewId) as SqlRow | undefined;
    const oldDecisionRow = this.#database.prepare("SELECT * FROM review_decisions WHERE review_id = ?").get(reviewId) as SqlRow | undefined;
    if (!row) throw new ReviewLearningError("REVIEW_NOT_FOUND");
    if (String(row.status) === "pending" && !oldDecisionRow) return this.resolveReviewSubset([reviewId], decision, decidedAt);
    if (String(row.status) !== "resolved" || !oldDecisionRow) throw new ReviewLearningError("REVIEW_NOT_FOUND");
    const old = decryptJsonPayload<DecisionPayload>(String(oldDecisionRow.encrypted_payload), this.#key);
    const classification: RuleClassification = { financialMeaning: decision.financialMeaning ?? null, category: decision.category ?? null, world: decision.world ?? null };
    assertClassification(classification);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      if (old.learnedAliasId) this.#database.prepare("DELETE FROM language_aliases WHERE alias_id = ?").run(old.learnedAliasId);
      else if (old.previousAlias) this.createLanguageAlias(old.previousAlias.phrase, old.previousAlias.classification, decidedAt);
      const learnedRuleId = null;
      const payload: DecisionPayload = { ...decision, relatedTransactionId: null, learnedRuleId, learnedAliasId: null, previousAlias: null };
      this.#database.prepare("UPDATE review_decisions SET decision_kind = 'classify', encrypted_payload = ?, decided_at = ? WHERE review_id = ?").run(encryptJsonPayload(payload, this.#key), decidedAt, reviewId);
      this.#database.prepare("UPDATE review_items SET updated_at = ? WHERE review_id = ?").run(decidedAt, reviewId);
      this.#database.exec("COMMIT");
      return { status: "resolved" as const, learnedRuleId };
    } catch { this.#database.exec("ROLLBACK"); throw new ReviewLearningError("REVIEW_PERSISTENCE_FAILED"); }
  }

  #createReview(transaction: CanonicalTransaction, reason: ReviewReason, createdAt: string, candidateRelationshipKind: RelationshipKind | null = null) {
    if (!REVIEW_REASONS.has(reason)) throw new ReviewLearningError("REVIEW_INVALID");
    const existing = this.#database.prepare("SELECT * FROM review_items WHERE transaction_id = ?").get(transaction.id) as SqlRow | undefined;
    if (existing) return this.#reviewFromRow(existing);
    const item: ReviewItem = {
      id: `review-item:${randomUUID()}`, transactionId: transaction.id, status: "pending", reason,
      description: transaction.rawDescription, normalizedCounterparty: transaction.normalizedCounterparty,
      accountId: transaction.accountId, importId: transaction.provenance.importId,
      currentFinancialMeaning: transaction.financialMeaning, currentCategory: transaction.attribution.category,
      currentWorld: transaction.attribution.world, currentConfidence: transaction.attribution.confidence,
      candidateRelationshipKind, createdAt, updatedAt: createdAt,
    };
    const payload: ReviewPayload = {
      description: item.description, normalizedCounterparty: item.normalizedCounterparty,
      accountId: item.accountId, importId: item.importId, currentFinancialMeaning: item.currentFinancialMeaning,
      currentCategory: item.currentCategory, currentWorld: item.currentWorld, currentConfidence: item.currentConfidence,
      candidateRelationshipKind: item.candidateRelationshipKind,
    };
    this.#database.prepare("INSERT INTO review_items VALUES (?, ?, 'pending', ?, ?, ?, ?)")
      .run(item.id, item.transactionId, item.reason, encryptJsonPayload(payload, this.#key), createdAt, createdAt);
    return item;
  }

  requestManualReview(transaction: CanonicalTransaction, reason: ReviewReason, createdAt: string, relationshipKind: RelationshipKind | null = null) {
    assertTimestamp(createdAt);
    return this.#createReview(transaction, reason, createdAt, relationshipKind);
  }

  evaluateTransaction(transaction: CanonicalTransaction, evaluatedAt: string, rules = this.listRules()): ClassificationOutcome {
    assertTimestamp(evaluatedAt);
    if (transaction.attribution.method === "user-correction") {
      return {
        financialMeaning: transaction.financialMeaning, category: transaction.attribution.category, world: transaction.attribution.world,
        method: "explicit-transaction-correction", ruleId: null, confidence: 1,
        explanation: "Explicit correction on this transaction.", reviewItemId: null,
      };
    }
    const resolvedRow = this.#database.prepare("SELECT * FROM review_items WHERE transaction_id = ? AND status = 'resolved'").get(transaction.id) as SqlRow | undefined;
    if (resolvedRow) {
      const resolved = this.reviewDecision(String(resolvedRow.review_id));
      if (resolved?.kind === "classify") return {
        financialMeaning: resolved.financialMeaning ?? null, category: resolved.category ?? null, world: resolved.world ?? null,
        method: "explicit-transaction-correction", ruleId: null, confidence: 1,
        explanation: "Founder-confirmed understanding for this transaction.", reviewItemId: null,
      };
    }
    const matching = rules.filter((rule) => rule.status === "active"
      && rule.normalizedCounterparty === transaction.normalizedCounterparty
      && (rule.accountId === null || rule.accountId === transaction.accountId));
    const rank = (source: LearningRuleSource) => source === "user-created" ? 2 : 1;
    const highest = matching.length ? Math.max(...matching.map((rule) => rank(rule.source))) : 0;
    const strongest = matching.filter((rule) => rank(rule.source) === highest);
    if (strongest.length > 1 && strongest.some((rule) => !sameClassification(rule.classification, strongest[0].classification))) {
      const review = this.#createReview(transaction, "conflicting-learned-rules", evaluatedAt);
      return { financialMeaning: null, category: null, world: null, method: "unknown", ruleId: null, confidence: null, explanation: "Conflicting rules require confirmation.", reviewItemId: review.id };
    }
    const selected = strongest[0];
    if (selected) return {
      financialMeaning: selected.classification.financialMeaning ?? (transaction.financialMeaning === "unknown" ? null : transaction.financialMeaning),
      category: selected.classification.category ?? transaction.attribution.category,
      world: selected.classification.world ?? transaction.attribution.world,
      method: selected.source, ruleId: selected.id, confidence: 1, explanation: selected.explanation, reviewItemId: null,
    };
    if (transaction.attribution.method === "deterministic-rule") {
      const review = transaction.attribution.confidence !== null && transaction.attribution.confidence < 0.9
        ? this.#createReview(transaction, "low-confidence", evaluatedAt) : null;
      return {
        financialMeaning: transaction.financialMeaning, category: transaction.attribution.category, world: transaction.attribution.world,
        method: "deterministic-engineering-rule", ruleId: transaction.attribution.ruleId,
        confidence: transaction.attribution.confidence, explanation: "Matched deterministic engineering rule.", reviewItemId: review?.id ?? null,
      };
    }
    let reason: ReviewReason | null = null;
    if (transaction.financialMeaning === "unknown") reason = "unknown-financial-meaning";
    else if (["transfer", "credit-card-payment"].includes(transaction.financialMeaning)) reason = "ambiguous-transfer";
    else if (transaction.attribution.category === null && ["expense", "refund", "reversal", "fee", "interest", "credit-card-purchase"].includes(transaction.financialMeaning)) reason = "no-category";
    const review = reason ? this.#createReview(transaction, reason, evaluatedAt) : null;
    return {
      financialMeaning: transaction.financialMeaning === "unknown" ? null : transaction.financialMeaning,
      category: transaction.attribution.category, world: transaction.attribution.world, method: "unknown", ruleId: null,
      confidence: null, explanation: review ? "Insufficient evidence; human confirmation requested." : "No classification rule applied.", reviewItemId: review?.id ?? null,
    };
  }

  evaluateTransactions(transactions: readonly CanonicalTransaction[], evaluatedAt: string) {
    const rules = this.listRules();
    return transactions.map((transaction) => this.evaluateTransaction(transaction, evaluatedAt, rules));
  }

  resolveReview(reviewId: string, decision: ReviewDecision, decidedAt: string, userPhrase: string | null = null) {
    assertTimestamp(decidedAt);
    const row = this.#database.prepare("SELECT * FROM review_items WHERE review_id = ?").get(reviewId) as SqlRow | undefined;
    if (!row) throw new ReviewLearningError("REVIEW_NOT_FOUND");
    const item = this.#reviewFromRow(row);
    if (item.status !== "pending") throw new ReviewLearningError("REVIEW_INVALID");
    if (!DECISIONS.has(decision.kind)
      || (decision.relationshipKind !== undefined && decision.relationshipKind !== null && !RELATIONSHIPS.has(decision.relationshipKind))) {
      throw new ReviewLearningError("REVIEW_INVALID");
    }
    let learnedRuleId: string | null = null;
    let learnedAliasId: string | null = null;
    let previousAlias: AliasPayload | null = null;
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      if (decision.kind === "classify") {
        const classification: RuleClassification = {
          financialMeaning: decision.financialMeaning ?? null, category: decision.category ?? null, world: decision.world ?? null,
        };
        assertClassification(classification);
        learnedRuleId = this.createRule({
          source: "user-confirmed-learned", normalizedCounterparty: item.normalizedCounterparty,
          accountId: item.accountId, classification, createdAt: decidedAt,
          explanation: `Matched user-confirmed rule created ${decidedAt.slice(0, 10)}.`,
        }).id;
        const existingAlias = userPhrase?.trim() ? this.listLanguageAliases().find((alias) => alias.phrase === userPhrase.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-CA")) : null;
        previousAlias = existingAlias ? { phrase: existingAlias.phrase, classification: existingAlias.classification } : null;
        const alias = userPhrase?.trim() ? this.createLanguageAlias(userPhrase, classification, decidedAt) : null;
        learnedAliasId = alias?.created ? alias.id : null;
      } else if (decision.kind === "confirm-relationship" && !decision.relationshipKind) {
        throw new ReviewLearningError("REVIEW_INVALID");
      }
      const status = decision.kind === "ignore" ? "ignored" : "resolved";
      const payload: DecisionPayload = { ...decision, relatedTransactionId: decision.relatedTransactionId ?? null, learnedRuleId, learnedAliasId, previousAlias };
      this.#database.prepare("INSERT INTO review_decisions VALUES (?, ?, ?, ?, ?, ?)")
        .run(`review-decision:${randomUUID()}`, reviewId, item.transactionId, decision.kind, encryptJsonPayload(payload, this.#key), decidedAt);
      this.#database.prepare("UPDATE review_items SET status = ?, updated_at = ? WHERE review_id = ?")
        .run(status, decidedAt, reviewId);
      this.#database.exec("COMMIT");
      return { status, learnedRuleId };
    } catch {
      this.#database.exec("ROLLBACK");
      throw new ReviewLearningError("REVIEW_PERSISTENCE_FAILED");
    }
  }

  resolveReviewGroup(reviewIds: readonly string[], decision: ReviewDecision, decidedAt: string, userPhrase: string | null = null) {
    assertTimestamp(decidedAt);
    const uniqueIds = [...new Set(reviewIds)];
    if (uniqueIds.length === 0 || decision.kind !== "classify") throw new ReviewLearningError("REVIEW_INVALID");
    const items = uniqueIds.map((reviewId) => {
      const row = this.#database.prepare("SELECT * FROM review_items WHERE review_id = ?").get(reviewId) as SqlRow | undefined;
      if (!row) throw new ReviewLearningError("REVIEW_NOT_FOUND");
      return this.#reviewFromRow(row);
    });
    if (items.some((item) => item.status !== "pending"
      || item.normalizedCounterparty !== items[0].normalizedCounterparty
      || item.accountId !== items[0].accountId
      || item.currentFinancialMeaning !== items[0].currentFinancialMeaning)) throw new ReviewLearningError("REVIEW_INVALID");
    const classification: RuleClassification = {
      financialMeaning: decision.financialMeaning ?? null, category: decision.category ?? null, world: decision.world ?? null,
    };
    assertClassification(classification);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const learnedRuleId = this.createRule({
        source: "user-confirmed-learned", normalizedCounterparty: items[0].normalizedCounterparty,
        accountId: items[0].accountId, classification, createdAt: decidedAt,
        explanation: `Matched Founder-confirmed group rule created ${decidedAt.slice(0, 10)}.`,
      }).id;
      const existingAlias = userPhrase?.trim() ? this.listLanguageAliases().find((alias) => alias.phrase === userPhrase.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-CA")) : null;
      const previousAlias = existingAlias ? { phrase: existingAlias.phrase, classification: existingAlias.classification } : null;
      const alias = userPhrase?.trim() ? this.createLanguageAlias(userPhrase, classification, decidedAt) : null;
      const learnedAliasId = alias?.created ? alias.id : null;
      for (const item of items) {
        const payload: DecisionPayload = { ...decision, relatedTransactionId: null, learnedRuleId, learnedAliasId, previousAlias };
        this.#database.prepare("INSERT INTO review_decisions VALUES (?, ?, ?, 'classify', ?, ?)")
          .run(`review-decision:${randomUUID()}`, item.id, item.transactionId, encryptJsonPayload(payload, this.#key), decidedAt);
        this.#database.prepare("UPDATE review_items SET status = 'resolved', updated_at = ? WHERE review_id = ?").run(decidedAt, item.id);
      }
      this.#database.exec("COMMIT");
      return { status: "resolved" as const, learnedRuleId, resolvedCount: items.length };
    } catch {
      this.#database.exec("ROLLBACK");
      throw new ReviewLearningError("REVIEW_PERSISTENCE_FAILED");
    }
  }

  resolveReviewSubset(reviewIds: readonly string[], decision: ReviewDecision, decidedAt: string, userPhrase: string | null = null) {
    assertTimestamp(decidedAt);
    const uniqueIds = [...new Set(reviewIds)];
    if (uniqueIds.length === 0 || decision.kind !== "classify") throw new ReviewLearningError("REVIEW_INVALID");
    const items = uniqueIds.map((reviewId) => {
      const row = this.#database.prepare("SELECT * FROM review_items WHERE review_id = ?").get(reviewId) as SqlRow | undefined;
      if (!row) throw new ReviewLearningError("REVIEW_NOT_FOUND");
      return this.#reviewFromRow(row);
    });
    if (items.some((item) => item.status !== "pending")) throw new ReviewLearningError("REVIEW_INVALID");
    const classification: RuleClassification = {
      financialMeaning: decision.financialMeaning ?? null, category: decision.category ?? null, world: decision.world ?? null,
    };
    assertClassification(classification);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      const existingAlias = userPhrase?.trim() ? this.listLanguageAliases().find((alias) => alias.phrase === userPhrase.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-CA")) : null;
      const previousAlias = existingAlias ? { phrase: existingAlias.phrase, classification: existingAlias.classification } : null;
      const alias = userPhrase?.trim() ? this.createLanguageAlias(userPhrase, classification, decidedAt) : null;
      const learnedAliasId = alias?.created ? alias.id : null;
      for (const item of items) {
        const payload: DecisionPayload = { ...decision, relatedTransactionId: null, learnedRuleId: null, learnedAliasId, previousAlias };
        this.#database.prepare("INSERT INTO review_decisions VALUES (?, ?, ?, 'classify', ?, ?)")
          .run(`review-decision:${randomUUID()}`, item.id, item.transactionId, encryptJsonPayload(payload, this.#key), decidedAt);
        this.#database.prepare("UPDATE review_items SET status = 'resolved', updated_at = ? WHERE review_id = ?").run(decidedAt, item.id);
      }
      this.#database.exec("COMMIT");
      return { status: "resolved" as const, learnedRuleId: null, resolvedCount: items.length };
    } catch {
      this.#database.exec("ROLLBACK");
      throw new ReviewLearningError("REVIEW_PERSISTENCE_FAILED");
    }
  }
}
