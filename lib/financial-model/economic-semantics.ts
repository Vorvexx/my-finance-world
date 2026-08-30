import type { CanonicalTransaction, FinancialMeaning } from "../../types/transactions.ts";

export type EconomicMeaning =
  | "income" | "consumption" | "wealth-building" | "liability-reduction" | "transfer"
  | "credit-card-settlement" | "investment-withdrawal" | "refund-rebate" | "reimbursement"
  | "gift-given" | "gift-received" | "money-lent" | "receivable-repayment" | "asset-liquidation"
  | "financial-fee" | "financial-interest-cost" | "unknown-incoming" | "unknown-outgoing";
export type CostNature = "required-fixed" | "required-variable" | "required-periodic" | "required-irregular" | "discretionary-recurring" | "discretionary-variable" | null;
export type EconomicSemantics = { economicMeaning: EconomicMeaning; costNature: CostNature; world: CanonicalTransaction["attribution"]["world"]; category: string | null; paymentAccountId: string; context: { merchant: string; sourceTransactionId: string } };
export type TransactionSplit = { id: string; sourceTransactionId: string; amountCents: number; world: CanonicalTransaction["attribution"]["world"]; category: string; economicMeaning: EconomicMeaning; costNature: CostNature };

const directMeaning = (meaning: FinancialMeaning): EconomicMeaning | null => ({
  "wealth-building": "wealth-building", "liability-reduction": "liability-reduction", "investment-withdrawal": "investment-withdrawal",
  reimbursement: "reimbursement", "gift-given": "gift-given", "gift-received": "gift-received", "money-lent": "money-lent",
  "receivable-repayment": "receivable-repayment", "asset-liquidation": "asset-liquidation", "unknown-incoming": "unknown-incoming", "unknown-outgoing": "unknown-outgoing",
} as Partial<Record<FinancialMeaning, EconomicMeaning>>)[meaning] ?? null;

export const costNatureFor = (transaction: CanonicalTransaction): CostNature => {
  const category = transaction.attribution.category?.trim() ?? "";
  if (/mortgage|utilit|electric|water|gas bill|grocer|fuel|vehicle service|maintenance & repairs/i.test(category)) return "required-variable";
  if (/condo maintenance|maintenance fee|insurance|internet|phone|vehicle payment|auto payment/i.test(category)) return "required-fixed";
  if (/property tax|municipal tax/i.test(category)) return "required-periodic";
  if (/special assessment/i.test(category)) return "required-irregular";
  if (/subscription/i.test(category)) return "discretionary-recurring";
  if (/dining|food|shopping|entertainment|leisure|travel|alcohol/i.test(category)) return "discretionary-variable";
  return null;
};

export const economicMeaningFor = (transaction: CanonicalTransaction): EconomicMeaning => {
  const direct = directMeaning(transaction.financialMeaning); if (direct) return direct;
  if (transaction.financialMeaning === "income") return "income";
  if (transaction.financialMeaning === "refund" || transaction.financialMeaning === "reversal") return "refund-rebate";
  if (transaction.financialMeaning === "fee") return "financial-fee";
  if (transaction.financialMeaning === "interest") return "financial-interest-cost";
  if (transaction.financialMeaning === "credit-card-payment") return "credit-card-settlement";
  if (transaction.financialMeaning === "cash-withdrawal" || transaction.financialMeaning === "cash-deposit") return "transfer";
  if (transaction.financialMeaning === "transfer") {
    if (transaction.attribution.world === "investments") return transaction.direction === "outflow" ? "wealth-building" : "investment-withdrawal";
    return "transfer";
  }
  if (transaction.financialMeaning === "expense" || transaction.financialMeaning === "credit-card-purchase") return "consumption";
  return transaction.direction === "inflow" ? "unknown-incoming" : "unknown-outgoing";
};

export const projectEconomicSemantics = (transaction: CanonicalTransaction): EconomicSemantics => ({
  economicMeaning: economicMeaningFor(transaction), costNature: costNatureFor(transaction), world: transaction.attribution.world,
  category: transaction.attribution.category, paymentAccountId: transaction.accountId,
  context: { merchant: transaction.normalizedCounterparty || transaction.rawDescription, sourceTransactionId: transaction.id },
});

export const validateTransactionSplits = (transaction: CanonicalTransaction, splits: readonly TransactionSplit[]) => {
  const relevant = splits.filter((split) => split.sourceTransactionId === transaction.id);
  if (relevant.length === 0) return true;
  if (relevant.some((split) => !Number.isSafeInteger(split.amountCents) || split.amountCents <= 0)) return false;
  return relevant.reduce((total, split) => total + split.amountCents, 0) === Math.round(transaction.amount * 100);
};
