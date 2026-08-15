import type { AccountType, LegacyAccountGroup } from "./finance.ts";

export type RelationshipType = "internal-transfer" | "credit-card-payment" | "loan" | "loan-repayment" | "reimbursement";
export type RelationshipCandidateStatus = "pending" | "accepted" | "rejected" | "unknown" | "ignored";
export type RelationshipDecision = "accept" | "reject" | "keep-unknown" | "ignore";

export type RelationshipAccount = {
  id: string;
  ownerId: "primary-person";
  type: AccountType;
  group: LegacyAccountGroup;
};

export type RelationshipEvidence = {
  supporting: readonly string[];
  missing: readonly string[];
  explanation: string;
};

export type RelationshipProposal = {
  type: RelationshipType;
  primaryTransactionId: string;
  secondaryTransactionId: string;
  primaryAccountId: string;
  secondaryAccountId: string;
  primaryDescription: string;
  secondaryDescription: string;
  primaryDate: string;
  secondaryDate: string;
  amount: number;
  currency: string;
  dayGap: number;
  evidence: RelationshipEvidence;
  disposition: "candidate" | "automatic";
};

export type RelationshipCandidate = Omit<RelationshipProposal, "disposition"> & {
  id: string;
  status: RelationshipCandidateStatus;
  createdAt: string;
  updatedAt: string;
};

export type TransactionRelationship = {
  id: string;
  type: RelationshipType;
  primaryTransactionId: string;
  secondaryTransactionId: string;
  primaryAccountId: string;
  secondaryAccountId: string;
  evidence: RelationshipEvidence;
  confirmation: "founder-confirmed" | "confirmed-rule-reuse";
  createdAt: string;
};

export type ConfirmedRelationshipRule = {
  id: string;
  type: RelationshipType;
  firstAccountId: string;
  secondAccountId: string;
  maxDayGap: number;
  createdAt: string;
};
