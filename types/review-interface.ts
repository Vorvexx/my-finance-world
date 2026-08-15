import type { MoneyWorldKey } from "./finance.ts";
import type { FinancialMeaning } from "./transactions.ts";

export type ReviewExplanationSource = "Engineering rule" | "Founder correction" | "Learned rule" | "Unknown";

export type BrowserReviewItem = {
  actionToken: string;
  description: string;
  currentFinancialMeaning: FinancialMeaning;
  currentCategory: string | null;
  currentWorld: MoneyWorldKey | null;
  explanationSource: ReviewExplanationSource;
  explanation: string;
  similarCount: number;
  totalAmount: number;
  currency: string;
  representativeDescription: string;
  accountNames: readonly string[];
  direction: "inflow" | "outflow" | "unknown";
  recurring: boolean;
  representativeTransactions: readonly { date: string; amount: number; accountName: string; description: string }[];
  suggestions: readonly BrowserReviewSuggestion[];
};

export type BrowserReviewSuggestion = {
  id: string;
  label: string;
  path: string;
  financialMeaning: FinancialMeaning;
  category: string | null;
  world: MoneyWorldKey | null;
  reason: string;
  searchTerms: string;
  recommended: boolean;
};

export type ReviewQueueView =
  | { status: "available"; items: readonly BrowserReviewItem[] }
  | { status: "unavailable"; items: readonly []; message: string };

export type FounderReviewChoice = "classify" | "keep-unknown" | "ignore" | "review-later";

export type FounderReviewInput = {
  actionToken: string;
  choice: FounderReviewChoice;
  financialMeaning?: FinancialMeaning | null;
  category?: string | null;
  world?: MoneyWorldKey | null;
  scope?: "one" | "subset" | "group";
  selectedIndexes?: readonly number[];
  userPhrase?: string | null;
};
