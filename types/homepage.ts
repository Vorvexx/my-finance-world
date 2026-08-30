export type HomepageMoney = { status: "known"; amount: number } | { status: "unknown"; reason: string };
import type { FinancialPeriodKey } from "../lib/homepage/financial-period.ts";
import type { BrowserReviewSuggestion } from "./review-interface.ts";
import type { HistoricalFinancialFlow } from "../lib/analytics/monthly-financial-flow.ts";

export type HomepageActivity = {
  viewKey: string;
  date: string;
  description: string;
  amount: number;
  direction: "inflow" | "outflow";
  kind: "spending" | "income" | "refund" | "payment" | "transfer" | "cash-movement" | "other";
  accountName: string;
  category: string | null;
  financialMeaning: string;
  needsReview: boolean;
  understandingState: "understood" | "category-ambiguous" | "genuinely-unknown" | "intentionally-deferred";
  correction: { actionToken: string; suggestions: readonly BrowserReviewSuggestion[] } | null;
};

export type HomepageCategoryTotal = { category: string; amount: number };
export type HomepageFlowGroup = { key: string; label: string; total: number; includedInPrimaryTotal: boolean; transactions: readonly HomepageActivity[] };

export type HomepageLifestyleTransaction = {
  viewKey: string;
  date: string;
  description: string;
  accountName: string;
  amount: number;
  spendingImpact: number;
  category: string | null;
  needsReview: boolean;
  correction: { actionToken: string; suggestions: readonly BrowserReviewSuggestion[] } | null;
};

export type HomepageLifestyleCategory = {
  viewKey: string;
  label: string;
  total: number;
  relativeShare: number | null;
  needsReview: boolean;
  transactions: readonly HomepageLifestyleTransaction[];
};

export type HomepageAccount = {
  viewKey: string;
  displayName: string;
  institution: string;
  accountType: string;
  balance: HomepageMoney;
  currency: "CAD";
  freshness: { status: "known"; asOf: string } | { status: "unknown"; message: string };
  sourceLabel: "Canonical financial snapshot";
  statement?: {
    statementDate: string;
    paymentDueDate: string;
    minimumPayment: number;
    statementBalance: number;
    currency: "CAD";
  };
  contributionBreakdown?:
    | { status: "known"; employee: number; employer: number }
    | { status: "unknown"; message: string };
  investmentHistory?: {
    snapshots: readonly { date: string; value: number }[];
    previousDate: string | null;
    valueChange: HomepageMoney;
    message: string;
  };
  activity: {
    moneyIn: number;
    moneyOut: number;
    recent: readonly HomepageActivity[];
    purchases: readonly HomepageActivity[];
    refunds: readonly HomepageActivity[];
    payments: readonly HomepageActivity[];
    incomeHistory: readonly HomepageActivity[];
    uncertainHistory: readonly HomepageActivity[];
    categoryDistribution: readonly HomepageCategoryTotal[];
    expected: readonly Extract<HomepageUpcomingObligation, { certainty: "expected" }>[];
    reconciliation: { purchases: number; refunds: number; payments: number; fees: number; netActivity: number };
    projectionGroups: readonly HomepageFlowGroup[];
  };
};

export type HomepageInsight = { title: string; detail: string; tone: "positive" | "attention" | "neutral" };

export type HomepageUpcomingObligation = {
  viewKey: string;
  certainty: "known";
  date: string;
  amount: number;
  statementBalance: number;
  label: "Credit card payment";
  accountName: string;
} | {
  viewKey: string;
  certainty: "expected";
  date: string;
  amount: number;
  label: string;
  accountName: string;
  cadence: "weekly" | "biweekly" | "monthly";
  confidence: "strong" | "expected" | "possible";
  direction: "inflow" | "outflow";
  evidenceCount: number;
};

export type HomepageRealWorldObject = {
  status: "known" | "partial" | "unknown";
  message: string;
  asset: { name: string; value: HomepageMoney; effectiveDate: string; sourceLabel: string } | null;
  financing: { displayName: string; institution: string; balance: HomepageMoney; effectiveDate: string } | null;
  equity: HomepageMoney;
  categories: readonly HomepageLifestyleCategory[];
};

export type HomepageViewModel = {
  status: "ready" | "partial" | "unavailable";
  currency: "CAD";
  snapshotDate: string | null;
  period: { key: FinancialPeriodKey; label: string; displayLabel: string; startDate: string; endDate: string; anchorDate: string; previousAnchor: string; nextAnchor: string };
  position: {
    netWorth: HomepageMoney;
    assets: HomepageMoney;
    liabilities: HomepageMoney;
  };
  cash: {
    total: HomepageMoney;
    accountCount: number;
    accounts: readonly HomepageAccount[];
    incomeHistory: readonly HomepageActivity[];
    uncertainHistory: readonly HomepageActivity[];
  };
  investments: { total: HomepageMoney; accountCount: number; accounts: readonly HomepageAccount[]; change: HomepageMoney; changeMessage: string };
  liabilities: { total: HomepageMoney; accountCount: number; accounts: readonly HomepageAccount[] };
  home: HomepageRealWorldObject;
  vehicle: HomepageRealWorldObject;
  lifestyle: {
    qualifyingSpending: HomepageMoney;
    topCategories: readonly HomepageCategoryTotal[];
    categories: readonly HomepageLifestyleCategory[];
    unclassifiedCount: number;
    actionableReviewCount: number;
    reviewedLaterCount: number;
    message: string | null;
    understanding: { status: "known"; percentage: number; understoodAmount: number; totalAmount: number } | { status: "unknown"; reason: string };
  };
  inflows: { qualifyingIncome: HomepageMoney };
  cashflow: {
    moneyIn: HomepageMoney;
    moneyOut: HomepageMoney;
    net: HomepageMoney;
    topInflows: readonly HomepageActivity[];
    topOutflows: readonly HomepageActivity[];
    inflowGroups: readonly HomepageFlowGroup[];
    outflowGroups: readonly HomepageFlowGroup[];
    reviewNeededCount: number;
    monthlyHistory: readonly { month: string; moneyIn: number; moneyOut: number; lifestyleSpending: number }[];
  };
  recentAndUpcoming: {
    recent: readonly HomepageActivity[];
    upcoming: readonly HomepageUpcomingObligation[];
    activityStatus: "available" | "unavailable";
    obligationStatus: "available" | "unavailable";
    summary: {
      inflow: HomepageMoney;
      outflow: HomepageMoney;
      reviewNeededCount: number;
    };
  };
  coverage: {
    status: "complete" | "partial" | "unavailable";
    earliestTransactionDate: string | null;
    latestTransactionDate: string | null;
    importedAccountCount: number;
    gapCount: number | null;
    gaps: readonly { accountName: string; startDate: string; endDate: string }[];
    message: string;
  };
  attention: { genuinelyUnknownCount: number; intentionallyDeferredCount: number; categoryAmbiguityCount: number };
  analytics: HistoricalFinancialFlow | null;
  assistantSummary: readonly string[];
  insights: readonly HomepageInsight[];
};
