import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { FounderRelationshipInput, RelationshipQueueView } from "../../types/relationship-interface.ts";
import type { CanonicalTransaction } from "../../types/transactions.ts";
import type { RelationshipAccount } from "../../types/relationships.ts";
import { createExplicitRelationshipProposal, detectDeterministicRelationships } from "./deterministic-relationship-engine.ts";
import { LocalRelationshipStore, RelationshipStoreError } from "./local-relationship-store.ts";

const TOKEN_TTL_MS = 30 * 60 * 1000;
export class FounderRelationshipServiceError extends Error {
  readonly code: "INVALID_ACTION" | "RELATIONSHIP_UNAVAILABLE";
  constructor(code: FounderRelationshipServiceError["code"]) { super(code); this.name = "FounderRelationshipServiceError"; this.code = code; }
}
const derivedKey = (key: Uint8Array) => createHash("sha256").update("vorvex-founder-relationship-action-v1").update(key).digest();
const seal = (candidateId: string, key: Uint8Array, now: Date) => {
  const iv = randomBytes(12);
  const tokenKey = derivedKey(key);
  try {
    const cipher = createCipheriv("aes-256-gcm", tokenKey, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify({ candidateId, expiresAt: now.getTime() + TOKEN_TTL_MS })), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
  } finally { tokenKey.fill(0); }
};
const unseal = (token: string, key: Uint8Array, now: Date) => {
  try {
    const packed = Buffer.from(token, "base64url");
    if (packed.byteLength < 29) throw new Error();
    const tokenKey = derivedKey(key);
    try {
      const decipher = createDecipheriv("aes-256-gcm", tokenKey, packed.subarray(0, 12));
      decipher.setAuthTag(packed.subarray(12, 28));
      const payload = JSON.parse(Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString("utf8")) as unknown;
      if (!payload || typeof payload !== "object" || !("candidateId" in payload) || !("expiresAt" in payload)
        || typeof payload.candidateId !== "string" || typeof payload.expiresAt !== "number" || payload.expiresAt < now.getTime()) throw new Error();
      return payload.candidateId;
    } finally { tokenKey.fill(0); }
  } catch { throw new FounderRelationshipServiceError("INVALID_ACTION"); }
};

export class FounderRelationshipService {
  #store: LocalRelationshipStore;
  #key: Uint8Array;
  constructor(store: LocalRelationshipStore, key: Uint8Array) { this.#store = store; this.#key = key; }

  sync(transactions: readonly CanonicalTransaction[], accounts: readonly RelationshipAccount[], evaluatedAt: string) {
    const proposals = detectDeterministicRelationships({
      transactions, accounts, confirmedRules: this.#store.listRules(), relationships: this.#store.listRelationships(),
    });
    for (const proposal of proposals) {
      if (proposal.disposition === "automatic") this.#store.createAutomaticRelationship(proposal, evaluatedAt);
      else this.#store.createCandidate(proposal, evaluatedAt);
    }
    return { proposals, relationships: this.#store.listRelationships() };
  }

  requestExplicitCandidate({
    type, first, second, accounts, requestedAt,
  }: {
    type: "loan" | "loan-repayment" | "reimbursement";
    first: CanonicalTransaction;
    second: CanonicalTransaction;
    accounts: readonly RelationshipAccount[];
    requestedAt: string;
  }) {
    return this.#store.createCandidate(createExplicitRelationshipProposal({ type, first, second, accounts }), requestedAt);
  }

  listPending(now = new Date()): RelationshipQueueView {
    return {
      status: "available",
      items: this.#store.listCandidates("pending").map((candidate) => ({
        actionToken: seal(candidate.id, this.#key, now), proposedType: candidate.type,
        firstDescription: candidate.primaryDescription, secondDescription: candidate.secondaryDescription,
        amount: candidate.amount, currency: candidate.currency, firstDate: candidate.primaryDate, secondDate: candidate.secondaryDate,
        supportingEvidence: candidate.evidence.supporting, missingEvidence: candidate.evidence.missing,
        explanation: candidate.evidence.explanation,
      })),
    };
  }

  save(input: FounderRelationshipInput, now = new Date()) {
    const candidateId = unseal(input.actionToken, this.#key, now);
    try {
      if (!["accept", "reject", "keep-unknown", "ignore"].includes(input.decision)) throw new FounderRelationshipServiceError("INVALID_ACTION");
      return this.#store.resolveCandidate(candidateId, input.decision, now.toISOString());
    } catch (error) {
      if (error instanceof FounderRelationshipServiceError) throw error;
      if (error instanceof RelationshipStoreError) throw new FounderRelationshipServiceError("INVALID_ACTION");
      throw new FounderRelationshipServiceError("RELATIONSHIP_UNAVAILABLE");
    }
  }
}
