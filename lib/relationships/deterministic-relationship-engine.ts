import type { CanonicalTransaction } from "../../types/transactions.ts";
import type {
  ConfirmedRelationshipRule, RelationshipAccount, RelationshipProposal, RelationshipType, TransactionRelationship,
} from "../../types/relationships.ts";

const MAX_DAY_GAP = 3;
const cents = (amount: number) => Math.round(amount * 100);
const daysBetween = (left: string, right: string) => Math.abs(
  (Date.parse(`${left}T00:00:00.000Z`) - Date.parse(`${right}T00:00:00.000Z`)) / 86_400_000,
);
const accountPair = (left: string, right: string) => [left, right].sort().join("\u0000");
const transactionPair = (left: string, right: string) => [left, right].sort().join("\u0000");

const proposedType = (
  outflow: CanonicalTransaction, inflow: CanonicalTransaction,
  outflowAccount: RelationshipAccount, inflowAccount: RelationshipAccount,
): RelationshipType | null => {
  if (outflow.financialMeaning === "credit-card-payment" && inflow.financialMeaning === "credit-card-payment"
    && outflowAccount.type === "asset" && inflowAccount.type === "liability") return "credit-card-payment";
  if (outflow.financialMeaning === "transfer" && inflow.financialMeaning === "transfer"
    && outflowAccount.type === "asset" && inflowAccount.type === "asset") return "internal-transfer";
  return null;
};

export const detectDeterministicRelationships = ({
  transactions, accounts, confirmedRules, relationships,
}: {
  transactions: readonly CanonicalTransaction[];
  accounts: readonly RelationshipAccount[];
  confirmedRules: readonly ConfirmedRelationshipRule[];
  relationships: readonly TransactionRelationship[];
}): readonly RelationshipProposal[] => {
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const existingPairs = new Set(relationships.map((relationship) => transactionPair(
    relationship.primaryTransactionId, relationship.secondaryTransactionId,
  )));
  const exactPairs: Array<Omit<RelationshipProposal, "disposition" | "evidence">> = [];
  for (let leftIndex = 0; leftIndex < transactions.length; leftIndex += 1) {
    const left = transactions[leftIndex];
    if (left.status !== "posted") continue;
    for (let rightIndex = leftIndex + 1; rightIndex < transactions.length; rightIndex += 1) {
      const right = transactions[rightIndex];
      if (right.status !== "posted" || left.accountId === right.accountId || left.direction === right.direction
        || left.currency !== right.currency || cents(left.amount) !== cents(right.amount)) continue;
      const gap = daysBetween(left.transactionDate, right.transactionDate);
      if (!Number.isInteger(gap) || gap > MAX_DAY_GAP) continue;
      const outflow = left.direction === "outflow" ? left : right;
      const inflow = left.direction === "inflow" ? left : right;
      const outflowAccount = accountsById.get(outflow.accountId);
      const inflowAccount = accountsById.get(inflow.accountId);
      if (!outflowAccount || !inflowAccount || outflowAccount.ownerId !== inflowAccount.ownerId) continue;
      const type = proposedType(outflow, inflow, outflowAccount, inflowAccount);
      if (!type || existingPairs.has(transactionPair(outflow.id, inflow.id))) continue;
      exactPairs.push({
        type, primaryTransactionId: outflow.id, secondaryTransactionId: inflow.id,
        primaryAccountId: outflow.accountId, secondaryAccountId: inflow.accountId,
        primaryDescription: outflow.rawDescription, secondaryDescription: inflow.rawDescription,
        primaryDate: outflow.transactionDate, secondaryDate: inflow.transactionDate,
        amount: outflow.amount, currency: outflow.currency, dayGap: gap,
      });
    }
  }
  const appearances = new Map<string, number>();
  for (const pair of exactPairs) for (const id of [pair.primaryTransactionId, pair.secondaryTransactionId]) {
    appearances.set(id, (appearances.get(id) ?? 0) + 1);
  }
  return exactPairs.map((pair) => {
    const ambiguous = (appearances.get(pair.primaryTransactionId) ?? 0) > 1 || (appearances.get(pair.secondaryTransactionId) ?? 0) > 1;
    const rule = confirmedRules.find((candidate) => candidate.type === pair.type
      && accountPair(candidate.firstAccountId, candidate.secondAccountId) === accountPair(pair.primaryAccountId, pair.secondaryAccountId)
      && pair.dayGap <= candidate.maxDayGap);
    const supporting = [
      "Same exact amount and currency.", "Opposite transaction directions.",
      `${pair.dayGap === 0 ? "Same transaction date." : `${pair.dayGap} day${pair.dayGap === 1 ? "" : "s"} apart.`}`,
      "Both accounts belong to the same Person.",
      pair.type === "credit-card-payment" ? "Asset-account outflow and liability-account payment credit." : "Both canonical meanings are Internal Transfer.",
    ];
    if (rule && !ambiguous) supporting.push("This account pair and relationship type were previously confirmed by the Founder.");
    const missing = [
      ...(ambiguous ? ["A transaction has more than one exact counterpart; the correct pair is not uniquely determined."] : []),
      ...(!rule ? ["Founder confirmation for this account pair and relationship type."] : []),
    ];
    return {
      ...pair, disposition: rule && !ambiguous ? "automatic" as const : "candidate" as const,
      evidence: {
        supporting, missing,
        explanation: rule && !ambiguous
          ? `Matched as ${pair.type} using exact canonical evidence and a prior Founder-confirmed account-pair rule.`
          : `Proposed as ${pair.type} from exact canonical evidence; no relationship was created automatically.`,
      },
    };
  });
};

export const createExplicitRelationshipProposal = ({
  type, first, second, accounts,
}: {
  type: "loan" | "loan-repayment" | "reimbursement";
  first: CanonicalTransaction;
  second: CanonicalTransaction;
  accounts: readonly RelationshipAccount[];
}): RelationshipProposal => {
  const knownAccounts = new Set(accounts.filter((account) => account.ownerId === "primary-person").map((account) => account.id));
  if (first.id === second.id || first.accountId === second.accountId || !knownAccounts.has(first.accountId) || !knownAccounts.has(second.accountId)
    || first.direction === second.direction || first.currency !== second.currency || cents(first.amount) !== cents(second.amount)) {
    throw new Error("RELATIONSHIP_EVIDENCE_INVALID");
  }
  const outflow = first.direction === "outflow" ? first : second;
  const inflow = first.direction === "inflow" ? first : second;
  const gap = daysBetween(outflow.transactionDate, inflow.transactionDate);
  if (!Number.isInteger(gap)) throw new Error("RELATIONSHIP_EVIDENCE_INVALID");
  return {
    type, primaryTransactionId: outflow.id, secondaryTransactionId: inflow.id,
    primaryAccountId: outflow.accountId, secondaryAccountId: inflow.accountId,
    primaryDescription: outflow.rawDescription, secondaryDescription: inflow.rawDescription,
    primaryDate: outflow.transactionDate, secondaryDate: inflow.transactionDate,
    amount: outflow.amount, currency: outflow.currency, dayGap: gap, disposition: "candidate",
    evidence: {
      supporting: ["Founder supplied the relationship type.", "Same exact amount and currency.", "Opposite transaction directions.", "Both accounts belong to the same Person."],
      missing: ["Founder acceptance of this exact transaction pair."],
      explanation: `Explicitly proposed as ${type}; Vorvex did not infer this relationship automatically.`,
    },
  };
};
