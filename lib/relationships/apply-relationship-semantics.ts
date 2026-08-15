import type { TransactionRelationship } from "../../types/relationships.ts";
import type { CanonicalTransaction } from "../../types/transactions.ts";

export const applyRelationshipSemantics = (
  transactions: readonly CanonicalTransaction[], relationships: readonly TransactionRelationship[],
) => {
  const typeByTransaction = new Map<string, TransactionRelationship["type"]>();
  const suppressedActivityTransactionIds = new Set<string>();
  for (const relationship of relationships) {
    typeByTransaction.set(relationship.primaryTransactionId, relationship.type);
    typeByTransaction.set(relationship.secondaryTransactionId, relationship.type);
    suppressedActivityTransactionIds.add(relationship.secondaryTransactionId);
  }
  const semanticTransactions = transactions.map((transaction) => {
    const type = typeByTransaction.get(transaction.id);
    if (!type) return transaction;
    const financialMeaning = type === "reimbursement"
      ? transaction.direction === "outflow" ? "expense" as const : "refund" as const
      : type === "credit-card-payment" ? "credit-card-payment" as const : "transfer" as const;
    return { ...transaction, financialMeaning };
  });
  return { transactions: semanticTransactions, suppressedActivityTransactionIds };
};
