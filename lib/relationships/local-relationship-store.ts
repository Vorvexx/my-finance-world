import { createHmac, randomUUID } from "node:crypto";
import { chmodSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  ConfirmedRelationshipRule, RelationshipCandidate, RelationshipCandidateStatus, RelationshipDecision,
  RelationshipProposal, RelationshipType, TransactionRelationship,
} from "../../types/relationships.ts";
import { copyPersistenceKey, decryptJsonPayload, encryptJsonPayload } from "../persistence/field-encryption.ts";

type SqlRow = Record<string, unknown>;
type CandidatePayload = Omit<RelationshipCandidate, "id" | "status" | "type" | "createdAt" | "updatedAt">;
type RelationshipPayload = Omit<TransactionRelationship, "id" | "type" | "confirmation" | "createdAt">;
type RulePayload = Omit<ConfirmedRelationshipRule, "id" | "type" | "createdAt">;

const TYPES = new Set<RelationshipType>(["internal-transfer", "credit-card-payment", "loan", "loan-repayment", "reimbursement"]);
const DECISIONS = new Set<RelationshipDecision>(["accept", "reject", "keep-unknown", "ignore"]);
const STATUSES = new Set<RelationshipCandidateStatus>(["pending", "accepted", "rejected", "unknown", "ignored"]);
const SCHEMA_VERSION = 1;
const schema = `
  CREATE TABLE relationship_metadata (key TEXT PRIMARY KEY, value INTEGER NOT NULL) STRICT;
  INSERT INTO relationship_metadata (key, value) VALUES ('schema_version', ${SCHEMA_VERSION});
  CREATE TABLE relationship_candidates (
    candidate_id TEXT PRIMARY KEY,
    pair_key TEXT NOT NULL,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('internal-transfer','credit-card-payment','loan','loan-repayment','reimbursement')),
    status TEXT NOT NULL CHECK (status IN ('pending','accepted','rejected','unknown','ignored')),
    encrypted_payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(pair_key, relationship_type)
  ) STRICT;
  CREATE INDEX relationship_candidates_status_created ON relationship_candidates(status, created_at, candidate_id);
  CREATE TABLE transaction_relationships (
    relationship_id TEXT PRIMARY KEY,
    pair_key TEXT NOT NULL UNIQUE,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('internal-transfer','credit-card-payment','loan','loan-repayment','reimbursement')),
    confirmation TEXT NOT NULL CHECK (confirmation IN ('founder-confirmed','confirmed-rule-reuse')),
    encrypted_payload TEXT NOT NULL,
    created_at TEXT NOT NULL
  ) STRICT;
  CREATE TABLE confirmed_relationship_rules (
    rule_id TEXT PRIMARY KEY,
    account_pair_key TEXT NOT NULL,
    relationship_type TEXT NOT NULL CHECK (relationship_type IN ('internal-transfer','credit-card-payment','loan','loan-repayment','reimbursement')),
    encrypted_payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(account_pair_key, relationship_type)
  ) STRICT;
`;

export class RelationshipStoreError extends Error {
  readonly code: "RELATIONSHIP_INVALID" | "RELATIONSHIP_NOT_FOUND" | "RELATIONSHIP_PERSISTENCE_FAILED";
  constructor(code: RelationshipStoreError["code"]) { super(code); this.name = "RelationshipStoreError"; this.code = code; }
}

const assertTimestamp = (value: string) => {
  if (!value || Number.isNaN(Date.parse(value))) throw new RelationshipStoreError("RELATIONSHIP_INVALID");
};
const assertProposal = (proposal: RelationshipProposal) => {
  const evidenceStrings = [...proposal.evidence.supporting, ...proposal.evidence.missing];
  if (!TYPES.has(proposal.type) || !proposal.primaryTransactionId || !proposal.secondaryTransactionId
    || proposal.primaryTransactionId === proposal.secondaryTransactionId || !proposal.primaryAccountId || !proposal.secondaryAccountId
    || proposal.primaryAccountId === proposal.secondaryAccountId || !proposal.primaryDescription || !proposal.secondaryDescription
    || proposal.primaryDescription.length > 1000 || proposal.secondaryDescription.length > 1000
    || !/^\d{4}-\d{2}-\d{2}$/.test(proposal.primaryDate) || !/^\d{4}-\d{2}-\d{2}$/.test(proposal.secondaryDate)
    || !Number.isFinite(proposal.amount) || proposal.amount <= 0 || !/^[A-Z]{3}$/.test(proposal.currency)
    || !Number.isInteger(proposal.dayGap) || proposal.dayGap < 0 || evidenceStrings.length > 20
    || evidenceStrings.some((item) => !item.trim() || item.length > 300)
    || !proposal.evidence.explanation.trim() || proposal.evidence.explanation.length > 1000) {
    throw new RelationshipStoreError("RELATIONSHIP_INVALID");
  }
};
const sortedPair = (left: string, right: string) => [left, right].sort().join("\u0000");

export class LocalRelationshipStore {
  readonly databasePath: string;
  #database: DatabaseSync;
  #key: Uint8Array;
  #closed = false;

  constructor({ databasePath, encryptionKey }: { databasePath: string; encryptionKey: Uint8Array }) {
    this.databasePath = databasePath;
    this.#key = copyPersistenceKey(encryptionKey);
    if (databasePath !== ":memory:") {
      const directory = path.dirname(databasePath);
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      chmodSync(directory, 0o700);
    }
    try {
      this.#database = new DatabaseSync(databasePath);
      if (databasePath !== ":memory:") chmodSync(databasePath, 0o600);
      this.#database.exec("PRAGMA foreign_keys = ON; PRAGMA secure_delete = ON; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;");
      const exists = this.#database.prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'relationship_metadata'").get();
      if (!exists) this.#database.exec(schema);
      const version = Number(this.#database.prepare("SELECT value FROM relationship_metadata WHERE key = 'schema_version'").get()?.value);
      if (version !== SCHEMA_VERSION) throw new RelationshipStoreError("RELATIONSHIP_PERSISTENCE_FAILED");
    } catch (error) {
      this.#key.fill(0);
      if (error instanceof RelationshipStoreError) throw error;
      throw new RelationshipStoreError("RELATIONSHIP_PERSISTENCE_FAILED");
    }
  }

  close() { if (!this.#closed) { this.#database.close(); this.#key.fill(0); this.#closed = true; } }
  databasePermissions() { return this.databasePath === ":memory:" ? null : statSync(this.databasePath).mode & 0o777; }
  #digest(scope: string, left: string, right: string) {
    return createHmac("sha256", this.#key).update(scope).update("\u0000").update(sortedPair(left, right)).digest("base64url");
  }
  #pairKey(left: string, right: string) { return this.#digest("relationship-transaction-pair-v1", left, right); }
  #accountPairKey(left: string, right: string) { return this.#digest("relationship-account-pair-v1", left, right); }

  #candidateFromRow(row: SqlRow): RelationshipCandidate {
    const payload = decryptJsonPayload<CandidatePayload>(String(row.encrypted_payload), this.#key);
    return {
      id: String(row.candidate_id), status: String(row.status) as RelationshipCandidateStatus,
      type: String(row.relationship_type) as RelationshipType, createdAt: String(row.created_at), updatedAt: String(row.updated_at), ...payload,
    };
  }
  #relationshipFromRow(row: SqlRow): TransactionRelationship {
    const payload = decryptJsonPayload<RelationshipPayload>(String(row.encrypted_payload), this.#key);
    return {
      id: String(row.relationship_id), type: String(row.relationship_type) as RelationshipType,
      confirmation: String(row.confirmation) as TransactionRelationship["confirmation"], createdAt: String(row.created_at), ...payload,
    };
  }
  #ruleFromRow(row: SqlRow): ConfirmedRelationshipRule {
    const payload = decryptJsonPayload<RulePayload>(String(row.encrypted_payload), this.#key);
    return { id: String(row.rule_id), type: String(row.relationship_type) as RelationshipType, createdAt: String(row.created_at), ...payload };
  }

  listCandidates(status: RelationshipCandidateStatus | null = "pending") {
    if (status !== null && !STATUSES.has(status)) throw new RelationshipStoreError("RELATIONSHIP_INVALID");
    const rows = status === null
      ? this.#database.prepare("SELECT * FROM relationship_candidates ORDER BY created_at, candidate_id").all()
      : this.#database.prepare("SELECT * FROM relationship_candidates WHERE status = ? ORDER BY created_at, candidate_id").all(status);
    return (rows as SqlRow[]).map((row) => this.#candidateFromRow(row));
  }
  listRelationships() {
    return (this.#database.prepare("SELECT * FROM transaction_relationships ORDER BY created_at, relationship_id").all() as SqlRow[])
      .map((row) => this.#relationshipFromRow(row));
  }
  listRules() {
    return (this.#database.prepare("SELECT * FROM confirmed_relationship_rules ORDER BY created_at, rule_id").all() as SqlRow[])
      .map((row) => this.#ruleFromRow(row));
  }

  createCandidate(proposal: RelationshipProposal, createdAt: string) {
    assertTimestamp(createdAt);
    assertProposal(proposal);
    const pairKey = this.#pairKey(proposal.primaryTransactionId, proposal.secondaryTransactionId);
    if (this.#database.prepare("SELECT 1 AS present FROM transaction_relationships WHERE pair_key = ?").get(pairKey)) {
      throw new RelationshipStoreError("RELATIONSHIP_INVALID");
    }
    const existing = this.#database.prepare("SELECT * FROM relationship_candidates WHERE pair_key = ? AND relationship_type = ?")
      .get(pairKey, proposal.type) as SqlRow | undefined;
    if (existing) return this.#candidateFromRow(existing);
    const id = `relationship-candidate:${randomUUID()}`;
    const payload: CandidatePayload = {
      primaryTransactionId: proposal.primaryTransactionId, secondaryTransactionId: proposal.secondaryTransactionId,
      primaryAccountId: proposal.primaryAccountId, secondaryAccountId: proposal.secondaryAccountId,
      primaryDescription: proposal.primaryDescription, secondaryDescription: proposal.secondaryDescription,
      primaryDate: proposal.primaryDate, secondaryDate: proposal.secondaryDate, amount: proposal.amount,
      currency: proposal.currency, dayGap: proposal.dayGap, evidence: proposal.evidence,
    };
    this.#database.prepare(`INSERT INTO relationship_candidates
      (candidate_id, pair_key, relationship_type, status, encrypted_payload, created_at, updated_at)
      VALUES (?, ?, ?, 'pending', ?, ?, ?)`)
      .run(id, pairKey, proposal.type, encryptJsonPayload(payload, this.#key), createdAt, createdAt);
    return this.listCandidates(null).find((candidate) => candidate.id === id)!;
  }

  #insertRelationship(proposal: RelationshipProposal, confirmation: TransactionRelationship["confirmation"], createdAt: string) {
    const pairKey = this.#pairKey(proposal.primaryTransactionId, proposal.secondaryTransactionId);
    const existing = this.#database.prepare("SELECT * FROM transaction_relationships WHERE pair_key = ?").get(pairKey) as SqlRow | undefined;
    if (existing) {
      const relationship = this.#relationshipFromRow(existing);
      if (relationship.type !== proposal.type) throw new RelationshipStoreError("RELATIONSHIP_INVALID");
      return relationship;
    }
    const id = `transaction-relationship:${randomUUID()}`;
    const payload: RelationshipPayload = {
      primaryTransactionId: proposal.primaryTransactionId, secondaryTransactionId: proposal.secondaryTransactionId,
      primaryAccountId: proposal.primaryAccountId, secondaryAccountId: proposal.secondaryAccountId, evidence: proposal.evidence,
    };
    this.#database.prepare(`INSERT INTO transaction_relationships
      (relationship_id, pair_key, relationship_type, confirmation, encrypted_payload, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, pairKey, proposal.type, confirmation, encryptJsonPayload(payload, this.#key), createdAt);
    return this.listRelationships().find((relationship) => relationship.id === id)!;
  }

  createAutomaticRelationship(proposal: RelationshipProposal, createdAt: string) {
    assertTimestamp(createdAt);
    assertProposal(proposal);
    if (proposal.disposition !== "automatic") throw new RelationshipStoreError("RELATIONSHIP_INVALID");
    return this.#insertRelationship(proposal, "confirmed-rule-reuse", createdAt);
  }

  resolveCandidate(candidateId: string, decision: RelationshipDecision, decidedAt: string) {
    assertTimestamp(decidedAt);
    if (!DECISIONS.has(decision)) throw new RelationshipStoreError("RELATIONSHIP_INVALID");
    const row = this.#database.prepare("SELECT * FROM relationship_candidates WHERE candidate_id = ?").get(candidateId) as SqlRow | undefined;
    if (!row) throw new RelationshipStoreError("RELATIONSHIP_NOT_FOUND");
    const candidate = this.#candidateFromRow(row);
    if (candidate.status !== "pending") throw new RelationshipStoreError("RELATIONSHIP_INVALID");
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      let relationship: TransactionRelationship | null = null;
      if (decision === "accept") {
        relationship = this.#insertRelationship({ ...candidate, disposition: "candidate" }, "founder-confirmed", decidedAt);
        if (candidate.type === "internal-transfer" || candidate.type === "credit-card-payment") {
          const accountPairKey = this.#accountPairKey(candidate.primaryAccountId, candidate.secondaryAccountId);
          const rulePayload: RulePayload = {
            firstAccountId: candidate.primaryAccountId, secondAccountId: candidate.secondaryAccountId,
            maxDayGap: Math.min(3, candidate.dayGap),
          };
          this.#database.prepare(`INSERT OR IGNORE INTO confirmed_relationship_rules
            (rule_id, account_pair_key, relationship_type, encrypted_payload, created_at) VALUES (?, ?, ?, ?, ?)`)
            .run(`relationship-rule:${randomUUID()}`, accountPairKey, candidate.type, encryptJsonPayload(rulePayload, this.#key), decidedAt);
        }
      }
      const status: RelationshipCandidateStatus = decision === "accept" ? "accepted"
        : decision === "reject" ? "rejected" : decision === "keep-unknown" ? "unknown" : "ignored";
      this.#database.prepare("UPDATE relationship_candidates SET status = ?, updated_at = ? WHERE candidate_id = ?")
        .run(status, decidedAt, candidateId);
      this.#database.exec("COMMIT");
      return { status, relationship };
    } catch (error) {
      this.#database.exec("ROLLBACK");
      if (error instanceof RelationshipStoreError) throw error;
      throw new RelationshipStoreError("RELATIONSHIP_PERSISTENCE_FAILED");
    }
  }

  deleteRelationship(relationshipId: string) {
    const row = this.#database.prepare("SELECT * FROM transaction_relationships WHERE relationship_id = ?").get(relationshipId) as SqlRow | undefined;
    if (!row) throw new RelationshipStoreError("RELATIONSHIP_NOT_FOUND");
    const relationship = this.#relationshipFromRow(row);
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      this.#database.prepare("DELETE FROM confirmed_relationship_rules WHERE account_pair_key = ? AND relationship_type = ?")
        .run(this.#accountPairKey(relationship.primaryAccountId, relationship.secondaryAccountId), relationship.type);
      this.#database.prepare("DELETE FROM transaction_relationships WHERE relationship_id = ?").run(relationshipId);
      this.#database.exec("COMMIT");
    } catch {
      this.#database.exec("ROLLBACK");
      throw new RelationshipStoreError("RELATIONSHIP_PERSISTENCE_FAILED");
    }
  }
}
