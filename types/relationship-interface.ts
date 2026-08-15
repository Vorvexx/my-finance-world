import type { RelationshipDecision, RelationshipType } from "./relationships.ts";

export type BrowserRelationshipCandidate = {
  actionToken: string;
  proposedType: RelationshipType;
  firstDescription: string;
  secondDescription: string;
  amount: number;
  currency: string;
  firstDate: string;
  secondDate: string;
  supportingEvidence: readonly string[];
  missingEvidence: readonly string[];
  explanation: string;
};

export type RelationshipQueueView =
  | { status: "available"; items: readonly BrowserRelationshipCandidate[] }
  | { status: "unavailable"; items: readonly []; message: string };

export type FounderRelationshipInput = { actionToken: string; decision: RelationshipDecision };
