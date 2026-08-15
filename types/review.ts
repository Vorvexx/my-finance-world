import type { MoneyWorldKey } from "./finance.ts";
import type { FinancialMeaning } from "./transactions.ts";

export type ReviewReason =
  | "unknown-merchant"
  | "ambiguous-transfer"
  | "ambiguous-relationship"
  | "no-category"
  | "low-confidence"
  | "conflicting-learned-rules"
  | "unknown-financial-meaning"
  | "manual-review-requested";
export type ReviewStatus = "pending" | "resolved" | "ignored";
export type RelationshipKind = "transfer" | "repayment" | "reimbursement" | "loan" | "credit-card-payment";
export type ReviewDecisionKind = "classify" | "confirm-relationship" | "ignore" | "keep-unknown";
export type LearningRuleSource = "user-created" | "user-confirmed-learned";
export type LearningRuleStatus = "active" | "disabled";

export type ReviewItem = {
  id: string;
  transactionId: string;
  status: ReviewStatus;
  reason: ReviewReason;
  description: string;
  normalizedCounterparty: string;
  accountId: string;
  importId: string;
  currentFinancialMeaning: FinancialMeaning;
  currentCategory: string | null;
  currentWorld: MoneyWorldKey | null;
  currentConfidence: number | null;
  candidateRelationshipKind: RelationshipKind | null;
  createdAt: string;
  updatedAt: string;
};

export type RuleClassification = {
  financialMeaning: FinancialMeaning | null;
  category: string | null;
  world: MoneyWorldKey | null;
};

export type LanguageAlias = { id: string; phrase: string; classification: RuleClassification; createdAt: string; updatedAt: string };

export type LearningRule = {
  id: string;
  source: LearningRuleSource;
  status: LearningRuleStatus;
  normalizedCounterparty: string;
  accountId: string | null;
  classification: RuleClassification;
  explanation: string;
  createdAt: string;
  updatedAt: string;
};

export type ClassificationOutcome = RuleClassification & {
  method: "explicit-transaction-correction" | LearningRuleSource | "deterministic-engineering-rule" | "unknown";
  ruleId: string | null;
  confidence: number | null;
  explanation: string;
  reviewItemId: string | null;
};

export type ReviewDecision = {
  kind: ReviewDecisionKind;
  financialMeaning?: FinancialMeaning | null;
  category?: string | null;
  world?: MoneyWorldKey | null;
  relationshipKind?: RelationshipKind | null;
  relatedTransactionId?: string | null;
};
