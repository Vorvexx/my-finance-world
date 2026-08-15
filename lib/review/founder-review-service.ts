import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { MoneyWorldKey } from "../../types/finance.ts";
import type { BrowserReviewSuggestion, FounderReviewInput, ReviewExplanationSource, ReviewQueueView } from "../../types/review-interface.ts";
import type { ReviewItem } from "../../types/review.ts";
import type { CanonicalTransaction, FinancialMeaning } from "../../types/transactions.ts";
import { LocalReviewLearningStore, ReviewLearningError } from "./local-review-learning-store.ts";

const WORLDS = new Set<MoneyWorldKey>(["cash", "investments", "home", "vehicle", "creditDebt", "income", "upcoming", "future"]);
const MEANINGS = new Set<FinancialMeaning>([
  "expense", "income", "refund", "reversal", "fee", "interest", "credit-card-purchase",
  "credit-card-payment", "transfer", "cash-withdrawal", "cash-deposit", "unknown",
]);
const TOKEN_TTL_MS = 30 * 60 * 1000;
const CONCEPTS: ReadonlyArray<Omit<BrowserReviewSuggestion, "reason" | "searchTerms" | "recommended"> & { terms: string; directions?: readonly CanonicalTransaction["direction"][] }> = [
  { id: "mortgage-payment", label: "Mortgage payment", path: "Home → Mortgage → Payment", financialMeaning: "expense", category: "Mortgage", world: "home", terms: "mortgage mtg housing loan", directions: ["outflow"] },
  { id: "rent-payment", label: "Rent payment", path: "Home → Housing → Rent", financialMeaning: "expense", category: "Rent", world: "home", terms: "rent landlord housing", directions: ["outflow"] },
  { id: "home-utilities", label: "Home utilities", path: "Home → Utilities", financialMeaning: "expense", category: "Utilities", world: "home", terms: "utility utilities hydro electricity water gas", directions: ["outflow"] },
  { id: "home-maintenance", label: "Home maintenance and repairs", path: "Home → Maintenance & Repairs", financialMeaning: "expense", category: "Maintenance & Repairs", world: "home", terms: "home house condo property maintenance repair repairs service upkeep courtyards", directions: ["outflow"] },
  { id: "home-insurance", label: "Home insurance", path: "Home → Insurance", financialMeaning: "expense", category: "Insurance", world: "home", terms: "home house condo property insurance insu", directions: ["outflow"] },
  { id: "home-rebate", label: "Home rebate or cashback", path: "Home → Rebate/Cashback", financialMeaning: "refund", category: "Rebate/Cashback", world: "home", terms: "home house property rebate cashback cash back realtor realty", directions: ["inflow"] },
  { id: "vehicle-payment", label: "Vehicle payment", path: "Vehicle → Financing → Payment", financialMeaning: "expense", category: "Vehicle payment", world: "vehicle", terms: "vehicle car auto loan financing", directions: ["outflow"] },
  { id: "vehicle-fuel", label: "Fuel", path: "Vehicle → Fuel", financialMeaning: "expense", category: "Fuel", world: "vehicle", terms: "fuel gas petrol station", directions: ["outflow"] },
  { id: "vehicle-maintenance", label: "Vehicle maintenance and repairs", path: "Vehicle → Maintenance & Repairs", financialMeaning: "expense", category: "Maintenance & Repairs", world: "vehicle", terms: "vehicle car auto automobile truck service maintenance repair repairs mechanic dealership lexus kia", directions: ["outflow"] },
  { id: "vehicle-insurance", label: "Vehicle insurance", path: "Vehicle → Insurance", financialMeaning: "expense", category: "Insurance", world: "vehicle", terms: "vehicle car auto automobile truck insurance", directions: ["outflow"] },
  { id: "groceries", label: "Groceries", path: "Lifestyle → Groceries", financialMeaning: "expense", category: "Groceries", world: "cash", terms: "grocery groceries supermarket food market", directions: ["outflow"] },
  { id: "dining", label: "Dining out", path: "Lifestyle → Dining", financialMeaning: "expense", category: "Dining", world: "cash", terms: "dining restaurant cafe coffee takeout", directions: ["outflow"] },
  { id: "shopping", label: "Shopping", path: "Lifestyle → Shopping", financialMeaning: "expense", category: "Shopping", world: "cash", terms: "shopping retail store purchase", directions: ["outflow"] },
  { id: "subscription", label: "Subscription", path: "Lifestyle → Subscriptions", financialMeaning: "expense", category: "Subscriptions", world: "cash", terms: "subscription membership monthly service", directions: ["outflow"] },
  { id: "entertainment-outing", label: "Entertainment or outing", path: "Lifestyle → Entertainment / Outing", financialMeaning: "expense", category: "Entertainment / Outing", world: "cash", terms: "entertainment outing night out event activity fun range", directions: ["outflow"] },
  { id: "salary", label: "Salary or payroll", path: "Cashflow → Income → Salary", financialMeaning: "income", category: "Salary", world: "income", terms: "salary payroll pay deposit employer wages", directions: ["inflow"] },
  { id: "refund", label: "Refund", path: "Cashflow → Money in → Refund", financialMeaning: "refund", category: "Refund", world: "cash", terms: "refund return reimbursement credit", directions: ["inflow"] },
  { id: "bank-fee", label: "Bank fee", path: "Banking → Fees → Charge", financialMeaning: "fee", category: "Banking Fees", world: "cash", terms: "bank banking fee service charge", directions: ["outflow"] },
  { id: "bank-fee-rebate", label: "Bank fee rebate", path: "Banking → Fees → Rebate", financialMeaning: "refund", category: "Banking Fees", world: "cash", terms: "bank banking fee rebate refund cashback", directions: ["inflow"] },
  { id: "credit-card-payment", label: "Credit-card payment", path: "Liabilities → Credit card → Payment", financialMeaning: "credit-card-payment", category: null, world: "creditDebt", terms: "credit card payment visa mastercard", directions: ["inflow", "outflow"] },
  { id: "investment-transfer", label: "Investment contribution or transfer", path: "Investments → Contribution", financialMeaning: "transfer", category: "Contribution", world: "investments", terms: "investment contribution tfsa rrsp transfer", directions: ["outflow"] },
  { id: "cash-transfer", label: "Transfer between accounts", path: "Cash → Transfer", financialMeaning: "transfer", category: null, world: "cash", terms: "transfer etransfer e-transfer account movement", directions: ["inflow", "outflow"] },
  { id: "cash-withdrawal", label: "Cash withdrawal", path: "Cash → Withdrawal", financialMeaning: "cash-withdrawal", category: null, world: "cash", terms: "cash withdrawal atm", directions: ["outflow"] },
  { id: "cash-deposit", label: "Cash deposit", path: "Cash → Deposit", financialMeaning: "cash-deposit", category: null, world: "cash", terms: "cash deposit", directions: ["inflow"] },
];

export class FounderReviewServiceError extends Error {
  readonly code: "INVALID_ACTION" | "REVIEW_UNAVAILABLE";
  constructor(code: "INVALID_ACTION" | "REVIEW_UNAVAILABLE") {
    super(code);
    this.name = "FounderReviewServiceError";
    this.code = code;
  }
}

const tokenKey = (key: Uint8Array) => createHash("sha256").update("vorvex-founder-review-action-v1").update(key).digest();
const sealReviewReference = (reviewIds: readonly string[], key: Uint8Array, now: Date) => {
  const iv = randomBytes(12);
  const derived = tokenKey(key);
  try {
    const cipher = createCipheriv("aes-256-gcm", derived, iv);
    const payload = Buffer.from(JSON.stringify({ reviewIds, expiresAt: now.getTime() + TOKEN_TTL_MS }));
    const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
  } finally { derived.fill(0); }
};

const unsealReviewReference = (token: string, key: Uint8Array, now: Date) => {
  try {
    const packed = Buffer.from(token, "base64url");
    if (packed.byteLength < 29) throw new Error();
    const derived = tokenKey(key);
    try {
      const decipher = createDecipheriv("aes-256-gcm", derived, packed.subarray(0, 12));
      decipher.setAuthTag(packed.subarray(12, 28));
      const payload = JSON.parse(Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString("utf8")) as unknown;
      if (!payload || typeof payload !== "object" || !("reviewIds" in payload) || !("expiresAt" in payload)
        || !Array.isArray(payload.reviewIds) || payload.reviewIds.length === 0 || payload.reviewIds.some((id) => typeof id !== "string")
        || typeof payload.expiresAt !== "number" || payload.expiresAt < now.getTime()) throw new Error();
      return payload.reviewIds as string[];
    } finally { derived.fill(0); }
  } catch { throw new FounderReviewServiceError("INVALID_ACTION"); }
};

const explanation = (item: ReviewItem): { source: ReviewExplanationSource; text: string } => {
  if (item.reason === "low-confidence") return { source: "Engineering rule", text: "An engineering rule matched, but its confidence requires your confirmation." };
  if (item.reason === "conflicting-learned-rules") return { source: "Learned rule", text: "Two learned rules disagree, so Vorvex kept this transaction Unknown." };
  if (item.reason === "manual-review-requested") return { source: "Founder correction", text: "This transaction was explicitly sent for Founder review." };
  if (item.reason === "no-category") return { source: "Unknown", text: "The financial meaning is known, but there is not enough evidence for a category." };
  if (item.reason === "ambiguous-transfer" || item.reason === "ambiguous-relationship") return { source: "Unknown", text: "The movement may represent a relationship between accounts, but no relationship was assumed." };
  return { source: "Unknown", text: "There is not enough reliable evidence to classify this transaction." };
};

const isRecurring = (transactions: readonly CanonicalTransaction[]) => {
  if (transactions.length < 3) return false;
  const dates = [...transactions].map((item) => Date.parse(`${item.transactionDate}T00:00:00Z`)).filter(Number.isFinite).sort((a, b) => a - b);
  if (dates.length < 3) return false;
  const intervals = dates.slice(1).map((date, index) => Math.round((date - dates[index]) / 86_400_000));
  const typical = [...intervals].sort((a, b) => a - b)[Math.floor(intervals.length / 2)];
  return typical >= 5 && intervals.filter((days) => Math.abs(days - typical) <= Math.max(3, typical * .22)).length >= Math.max(2, intervals.length - 1);
};
const ambiguityKey = (transaction: CanonicalTransaction) => [transaction.accountId, transaction.normalizedCounterparty, transaction.direction, transaction.financialMeaning].join("\u0000");
const ambiguousGroupKeys = (transactions: readonly CanonicalTransaction[]) => {
  const grouped = new Map<string, CanonicalTransaction[]>();
  for (const transaction of transactions) grouped.set(ambiguityKey(transaction), [...(grouped.get(ambiguityKey(transaction)) ?? []), transaction]);
  return new Set([...grouped].filter(([, items]) => {
    if (items.length < 3 || isRecurring(items)) return false;
    const amounts = items.map((item) => item.amount).filter((amount) => amount > 0);
    return amounts.length >= 3 && Math.max(...amounts) / Math.max(.01, Math.min(...amounts)) >= 4 && new Set(amounts.map((amount) => Math.round(amount / 5))).size >= 3;
  }).map(([key]) => key));
};

const suggestionsFor = (item: ReviewItem, transactions: readonly CanonicalTransaction[], aliases: ReturnType<LocalReviewLearningStore["listLanguageAliases"]>): readonly BrowserReviewSuggestion[] => {
  const direction = transactions[0]?.direction;
  const subject = `${item.normalizedCounterparty} ${item.description}`.toLocaleLowerCase("en-CA");
  const words = new Set(subject.split(/[^a-z0-9]+/).filter(Boolean));
  const learned = aliases.map((alias) => CONCEPTS.find((concept) => concept.financialMeaning === alias.classification.financialMeaning && concept.category === alias.classification.category && concept.world === alias.classification.world)).filter((concept): concept is (typeof CONCEPTS)[number] => Boolean(concept));
  const concepts = [...new Set([...learned, ...CONCEPTS])];
  return concepts.filter((concept) => !direction || !concept.directions || concept.directions.includes(direction)).map((concept) => {
    const terms = concept.terms.split(" ");
    const matches = terms.filter((term) => words.has(term) || (term.length >= 4 && subject.includes(term))).length;
    const current = concept.financialMeaning === item.currentFinancialMeaning && concept.category === item.currentCategory && concept.world === item.currentWorld;
    const aliasMatch = aliases.some((alias) => alias.phrase.split(" ").some((word) => subject.includes(word)) && alias.classification.financialMeaning === concept.financialMeaning && alias.classification.category === concept.category && alias.classification.world === concept.world);
    return { concept, score: (current ? 100 : 0) + (aliasMatch ? 80 : 0) + matches * 10 };
  }).sort((left, right) => right.score - left.score || left.concept.label.localeCompare(right.concept.label)).map(({ concept, score }) => ({
    id: concept.id, label: concept.label, path: concept.path, financialMeaning: concept.financialMeaning,
    category: concept.category, world: concept.world, searchTerms: concept.terms,
    recommended: score >= 20,
    reason: score >= 100 ? "Matches the current canonical understanding." : score > 0 ? "Suggested from the transaction name and direction; confirmation is still required." : "Available canonical concept.",
  }));
};

export class FounderReviewService {
  #store: LocalReviewLearningStore;
  #key: Uint8Array;
  constructor(store: LocalReviewLearningStore, key: Uint8Array) { this.#store = store; this.#key = key; }

  listPending(now = new Date(), transactions: readonly CanonicalTransaction[] = [], accountNames: ReadonlyMap<string, string> = new Map()): ReviewQueueView {
    this.#store.restoreDeferredReviews(now.toISOString());
    const transactionById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
    const ambiguous = ambiguousGroupKeys(transactions);
    const grouped = new Map<string, ReviewItem[]>();
    for (const item of this.#store.listReviewItems("pending")) {
      const transaction = transactionById.get(item.transactionId);
      if (transaction) {
        const highConfidence = transaction.attribution.method !== "unclassified" && (transaction.attribution.confidence ?? 0) >= 0.9;
        const stillNeedsClassification = transaction.financialMeaning === "unknown"
          || transaction.financialMeaning === "transfer"
          || (["expense", "refund", "reversal", "fee", "interest", "credit-card-purchase"].includes(transaction.financialMeaning)
            && transaction.attribution.category === null);
        if (highConfidence || !stillNeedsClassification) continue;
      }
      const baseKey = [item.accountId, item.normalizedCounterparty, transaction?.direction ?? "unknown", item.currentFinancialMeaning].join("\u0000");
      const key = transaction && ambiguous.has(ambiguityKey(transaction)) ? `${baseKey}\u0000${item.transactionId}` : baseKey;
      grouped.set(key, [...(grouped.get(key) ?? []), item]);
    }
    return {
      status: "available",
      items: [...grouped.values()].map((items) => {
        const item = items[0];
        const why = explanation(item);
        const matched = items.flatMap((candidate) => transactionById.get(candidate.transactionId) ?? []);
        const ordered = [...matched].sort((left, right) => right.transactionDate.localeCompare(left.transactionDate));
        return {
          actionToken: sealReviewReference(items.map((candidate) => candidate.id), this.#key, now), description: item.normalizedCounterparty || item.description,
          currentFinancialMeaning: item.currentFinancialMeaning, currentCategory: item.currentCategory,
          currentWorld: item.currentWorld, explanationSource: why.source, explanation: why.text,
          similarCount: items.length, totalAmount: matched.reduce((sum, transaction) => sum + transaction.amount, 0),
          currency: matched[0]?.currency ?? "CAD",
          representativeDescription: item.description,
          accountNames: [...new Set(matched.map((transaction) => accountNames.get(transaction.accountId) ?? "Account"))],
          direction: matched[0]?.direction ?? "unknown", recurring: isRecurring(matched),
          representativeTransactions: ordered.map((transaction) => ({
            date: transaction.transactionDate, amount: transaction.amount,
            accountName: accountNames.get(transaction.accountId) ?? "Account", description: transaction.rawDescription,
          })),
          suggestions: suggestionsFor(item, matched, this.#store.listLanguageAliases()),
        };
      }).sort((left, right) => Number(right.similarCount > 1) - Number(left.similarCount > 1)
        || Number(right.recurring) - Number(left.recurring)
        || right.similarCount - left.similarCount
        || right.totalAmount - left.totalAmount
        || (right.representativeTransactions[0]?.date ?? "").localeCompare(left.representativeTransactions[0]?.date ?? "")
        || Number(["expense", "income", "credit-card-purchase"].includes(right.currentFinancialMeaning)) - Number(["expense", "income", "credit-card-purchase"].includes(left.currentFinancialMeaning))
        || left.description.localeCompare(right.description)),
    };
  }

  save(input: FounderReviewInput, now = new Date()) {
    const reviewIds = unsealReviewReference(input.actionToken, this.#key, now);
    const reviewId = reviewIds[0];
    try {
      if (input.choice === "review-later") return { ...this.#store.deferReviews(reviewIds, now.toISOString()), learnedRuleId: null };
      if (input.choice === "keep-unknown") return this.#store.resolveReview(reviewId, { kind: "keep-unknown" }, now.toISOString());
      if (input.choice === "ignore") return this.#store.resolveReview(reviewId, { kind: "ignore" }, now.toISOString());
      if (input.choice !== "classify") throw new FounderReviewServiceError("INVALID_ACTION");
      const category = input.category?.trim() || null;
      const world = input.world ?? null;
      const financialMeaning = input.financialMeaning ?? null;
      if ((category !== null && category.length > 80) || (world !== null && !WORLDS.has(world))
        || (financialMeaning !== null && !MEANINGS.has(financialMeaning))) throw new FounderReviewServiceError("INVALID_ACTION");
      const decision = { kind: "classify" as const, category, world, financialMeaning };
      return input.scope === "group" && reviewIds.length > 1
        ? this.#store.resolveReviewGroup(reviewIds, decision, now.toISOString(), input.userPhrase?.trim() || null)
        : this.#store.resolveReview(reviewId, decision, now.toISOString(), input.userPhrase?.trim() || null);
    } catch (error) {
      if (error instanceof FounderReviewServiceError) throw error;
      if (error instanceof ReviewLearningError) throw new FounderReviewServiceError("INVALID_ACTION");
      throw new FounderReviewServiceError("REVIEW_UNAVAILABLE");
    }
  }

  undo(actionToken: string, now = new Date(), scope: "one" | "group" = "group") {
    const reviewIds = unsealReviewReference(actionToken, this.#key, now);
    try { return this.#store.undoReviews(scope === "one" ? reviewIds.slice(0, 1) : reviewIds, now.toISOString()); }
    catch { throw new FounderReviewServiceError("INVALID_ACTION"); }
  }

  listRecentDecisions(now = new Date(), limit = 250) {
    return [...this.#store.listReviewItems("resolved")].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, limit).flatMap((item) => {
      const decision = this.#store.reviewDecision(item.id);
      if (!decision || decision.kind !== "classify") return [];
      return [{ actionToken: sealReviewReference([item.id], this.#key, now), description: item.normalizedCounterparty || item.description, world: decision.world, category: decision.category, financialMeaning: decision.financialMeaning }];
    });
  }

  correctionForTransaction(transaction: CanonicalTransaction, now = new Date()) {
    return this.correctionsForTransactions([transaction], now).get(transaction.id) ?? null;
  }

  correctionsForTransactions(transactions: readonly CanonicalTransaction[], now = new Date()) {
    const transactionById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
    const aliases = this.#store.listLanguageAliases();
    const corrections = new Map<string, { actionToken: string; suggestions: readonly BrowserReviewSuggestion[] }>();
    for (const item of this.#store.listReviewItems(null)) {
      const transaction = transactionById.get(item.transactionId);
      if (!transaction || item.status === "ignored") continue;
      corrections.set(transaction.id, {
        actionToken: sealReviewReference([item.id], this.#key, now),
        suggestions: suggestionsFor(item, [transaction], aliases),
      });
    }
    return corrections;
  }

  correct(actionToken: string, classification: { financialMeaning: FinancialMeaning; category: string | null; world: MoneyWorldKey | null }, now = new Date()) {
    const reviewIds = unsealReviewReference(actionToken, this.#key, now);
    if (reviewIds.length !== 1 || !MEANINGS.has(classification.financialMeaning) || (classification.world && !WORLDS.has(classification.world)) || (classification.category && classification.category.length > 80)) throw new FounderReviewServiceError("INVALID_ACTION");
    try { return this.#store.correctReview(reviewIds[0], { kind: "classify", ...classification }, now.toISOString()); }
    catch { throw new FounderReviewServiceError("INVALID_ACTION"); }
  }
}
