import { chmodSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { FinancialAccount } from "../../types/finance.ts";
import type {
  DurableImportReceipt,
  ImportJournalRecord,
  ImportJournalStatus,
  PreparedStatementImport,
  CanonicalStatementFacts,
  CanonicalChequingStatementFacts,
} from "../../types/imports.ts";
import type { CanonicalTransaction } from "../../types/transactions.ts";
import type { CanonicalInvestmentSnapshot } from "../../types/investments.ts";
import type { StatementFolderResult } from "../../types/drop-folder.ts";
import {
  copyPersistenceKey,
  decryptJsonPayload,
  encryptJsonPayload,
  PersistenceEncryptionError,
} from "./field-encryption.ts";
import { LOCAL_INGESTION_SCHEMA_VERSION } from "../transactions/td-chequing-normalization.ts";

type SqlRow = Record<string, unknown>;

type EncryptedTransactionPayload = {
  amountCents: number;
  direction: CanonicalTransaction["direction"];
  postedDate: string | null;
  rawDescription: string;
  normalizedCounterparty: string;
  financialMeaning: CanonicalTransaction["financialMeaning"];
  status: CanonicalTransaction["status"];
  relatedTransactionId: string | null;
  attribution: CanonicalTransaction["attribution"];
  sourceRecordId: string | null;
  sourceKind: CanonicalTransaction["provenance"]["sourceKind"];
  observedAt: string;
  sourceUpdatedAt: string | null;
  maskedReferenceToken: string | null;
};

type EncryptedStatementFactsPayload = {
  minimumPaymentCents: number;
  previousBalanceCents: number;
  newBalanceCents: number;
};

type EncryptedChequingStatementFactsPayload = {
  openingBalanceCents: number;
  totalDepositsCents: number;
  totalWithdrawalsCents: number;
  closingBalanceCents: number;
};

export type LocalIngestionErrorCode =
  | "IMPORT_ACCOUNT_NOT_FOUND"
  | "IMPORT_ACCOUNT_INCOMPATIBLE"
  | "IMPORT_CONTEXT_INVALID"
  | "IMPORT_ID_CONFLICT"
  | "IMPORT_INVALID_STATE"
  | "IMPORT_PERSISTENCE_FAILED"
  | "IMPORT_SCHEMA_UNSUPPORTED"
  | "IMPORT_ENCRYPTION_KEY_INVALID";

export class LocalIngestionError extends Error {
  readonly code: LocalIngestionErrorCode;

  constructor(code: LocalIngestionErrorCode) {
    super(code);
    this.name = "LocalIngestionError";
    this.code = code;
  }
}

const STATE_TRANSITIONS: Readonly<Record<ImportJournalStatus, readonly ImportJournalStatus[]>> = {
  received: ["parsing", "rejected", "quarantined", "duplicate"],
  parsing: ["proposed", "rejected", "quarantined"],
  proposed: ["committed", "rejected", "quarantined"],
  committed: [],
  duplicate: [],
  rejected: [],
  quarantined: [],
};

const schemaV1 = `
  CREATE TABLE account_import_mappings (
    account_id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL,
    account_type TEXT NOT NULL,
    created_at TEXT NOT NULL
  ) STRICT;

  CREATE TABLE import_journal (
    import_id TEXT PRIMARY KEY,
    source_sha256 TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    account_type TEXT NOT NULL,
    account_id TEXT NOT NULL REFERENCES account_import_mappings(account_id),
    parser_version TEXT NOT NULL,
    statement_period_start TEXT NOT NULL,
    statement_period_end TEXT NOT NULL,
    source_format TEXT NOT NULL CHECK (source_format = 'pdf'),
    received_at TEXT NOT NULL,
    processing_started_at TEXT,
    proposed_at TEXT,
    committed_at TEXT,
    status TEXT NOT NULL CHECK (status IN ('received','parsing','proposed','committed','duplicate','rejected','quarantined')),
    parsed_transaction_count INTEGER NOT NULL DEFAULT 0 CHECK (parsed_transaction_count >= 0),
    committed_transaction_count INTEGER NOT NULL DEFAULT 0 CHECK (committed_transaction_count >= 0),
    duplicate_transaction_count INTEGER NOT NULL DEFAULT 0 CHECK (duplicate_transaction_count >= 0),
    safe_error_code TEXT,
    schema_version INTEGER NOT NULL
  ) STRICT;

  CREATE UNIQUE INDEX import_journal_committed_source
    ON import_journal(source_sha256, account_id, provider_id, account_type)
    WHERE status = 'committed';
  CREATE INDEX import_journal_status_received
    ON import_journal(status, received_at);
  CREATE INDEX import_journal_account_period
    ON import_journal(account_id, statement_period_start, statement_period_end);

  CREATE TABLE canonical_transactions (
    transaction_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES account_import_mappings(account_id),
    originating_import_id TEXT NOT NULL REFERENCES import_journal(import_id),
    provider_id TEXT NOT NULL,
    transaction_date TEXT NOT NULL,
    currency TEXT NOT NULL,
    fingerprint_version TEXT NOT NULL,
    fingerprint_value TEXT NOT NULL,
    deduplication_key TEXT NOT NULL,
    encrypted_payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(account_id, fingerprint_version, fingerprint_value),
    UNIQUE(deduplication_key)
  ) STRICT;
  CREATE INDEX canonical_transactions_account_date
    ON canonical_transactions(account_id, transaction_date DESC);
  CREATE INDEX canonical_transactions_origin
    ON canonical_transactions(originating_import_id);

  CREATE TABLE import_transaction_links (
    import_id TEXT NOT NULL REFERENCES import_journal(import_id) ON DELETE CASCADE,
    transaction_id TEXT NOT NULL REFERENCES canonical_transactions(transaction_id),
    source_row_number INTEGER NOT NULL CHECK (source_row_number > 0),
    outcome TEXT NOT NULL CHECK (outcome IN ('inserted','duplicate')),
    PRIMARY KEY(import_id, source_row_number),
    UNIQUE(import_id, transaction_id)
  ) STRICT;
  CREATE INDEX import_transaction_links_transaction
    ON import_transaction_links(transaction_id);
`;

const schemaV2 = `
  CREATE TABLE statement_folder_results (
    result_id TEXT PRIMARY KEY,
    import_id TEXT,
    route_id TEXT,
    provider_id TEXT,
    account_type TEXT,
    status TEXT NOT NULL CHECK (status IN ('processing','imported','duplicate','needs-attention','unsupported','rejected')),
    transaction_count INTEGER NOT NULL DEFAULT 0 CHECK (transaction_count >= 0),
    duplicate_count INTEGER NOT NULL DEFAULT 0 CHECK (duplicate_count >= 0),
    safe_reason_code TEXT,
    processed_at TEXT NOT NULL
  ) STRICT;
  CREATE INDEX statement_folder_results_processed
    ON statement_folder_results(processed_at DESC, result_id DESC);
  CREATE INDEX statement_folder_results_status
    ON statement_folder_results(status, processed_at DESC);
`;

const schemaV3 = `
  CREATE TABLE statement_facts (
    statement_id TEXT PRIMARY KEY,
    import_id TEXT NOT NULL UNIQUE REFERENCES import_journal(import_id),
    account_id TEXT NOT NULL REFERENCES account_import_mappings(account_id),
    provider_id TEXT NOT NULL,
    account_type TEXT NOT NULL,
    currency TEXT NOT NULL,
    statement_date TEXT NOT NULL,
    statement_period_start TEXT NOT NULL,
    statement_period_end TEXT NOT NULL,
    payment_due_date TEXT NOT NULL,
    encrypted_payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(account_id, provider_id, account_type, statement_period_start, statement_period_end)
  ) STRICT;
  CREATE INDEX statement_facts_account_due
    ON statement_facts(account_id, payment_due_date DESC);
`;

const schemaV4 = `
  CREATE TABLE investment_snapshots (
    snapshot_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    account_type TEXT NOT NULL,
    parser_version TEXT NOT NULL,
    statement_period_start TEXT NOT NULL,
    statement_period_end TEXT NOT NULL,
    source_sha256 TEXT NOT NULL,
    encrypted_payload TEXT NOT NULL,
    recorded_at TEXT NOT NULL,
    UNIQUE(account_id, statement_period_start, statement_period_end),
    UNIQUE(account_id, source_sha256)
  ) STRICT;
  CREATE INDEX investment_snapshots_account_period ON investment_snapshots(account_id, statement_period_end DESC);
`;

const schemaV5 = `
  CREATE TABLE chequing_statement_facts (
    statement_id TEXT PRIMARY KEY,
    import_id TEXT NOT NULL UNIQUE REFERENCES import_journal(import_id),
    account_id TEXT NOT NULL REFERENCES account_import_mappings(account_id),
    provider_id TEXT NOT NULL,
    account_type TEXT NOT NULL,
    currency TEXT NOT NULL,
    statement_period_start TEXT NOT NULL,
    statement_period_end TEXT NOT NULL,
    closing_balance_evidence TEXT NOT NULL CHECK (closing_balance_evidence IN ('statement-label','reconciled-final-running-balance')),
    source_sha256 TEXT NOT NULL,
    encrypted_payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(account_id, provider_id, account_type, statement_period_start, statement_period_end),
    UNIQUE(account_id, source_sha256)
  ) STRICT;
  CREATE INDEX chequing_statement_facts_account_period
    ON chequing_statement_facts(account_id, statement_period_end DESC);
`;

const importFromRow = (row: SqlRow): ImportJournalRecord => ({
  importId: String(row.import_id),
  sourceSha256: String(row.source_sha256),
  providerId: String(row.provider_id),
  accountType: String(row.account_type),
  accountId: String(row.account_id),
  parserVersion: String(row.parser_version),
  statementPeriodStart: String(row.statement_period_start),
  statementPeriodEnd: String(row.statement_period_end),
  sourceFormat: "pdf",
  receivedAt: String(row.received_at),
  processingStartedAt: row.processing_started_at === null ? null : String(row.processing_started_at),
  proposedAt: row.proposed_at === null ? null : String(row.proposed_at),
  committedAt: row.committed_at === null ? null : String(row.committed_at),
  status: String(row.status) as ImportJournalStatus,
  parsedTransactionCount: Number(row.parsed_transaction_count),
  committedTransactionCount: Number(row.committed_transaction_count),
  duplicateTransactionCount: Number(row.duplicate_transaction_count),
  safeErrorCode: row.safe_error_code === null ? null : String(row.safe_error_code),
  schemaVersion: Number(row.schema_version),
});

const receiptFromImport = (record: ImportJournalRecord): DurableImportReceipt => ({
  importId: record.importId,
  status: record.status as DurableImportReceipt["status"],
  providerId: record.providerId,
  accountType: record.accountType,
  transactionCount: record.committedTransactionCount,
  duplicateCount: record.duplicateTransactionCount,
  reviewCount: 0,
  safeToDeleteSource: record.status === "committed" || record.status === "duplicate",
});

export class LocalIngestionStore {
  readonly databasePath: string;
  readonly schemaVersion: number;
  #database!: DatabaseSync;
  #encryptionKey: Uint8Array;
  #closed = false;

  constructor({
    databasePath,
    encryptionKey,
  }: {
    databasePath: string;
    encryptionKey: Uint8Array;
  }) {
    this.databasePath = databasePath;
    try {
      this.#encryptionKey = copyPersistenceKey(encryptionKey);
    } catch (error) {
      if (error instanceof PersistenceEncryptionError) {
        throw new LocalIngestionError("IMPORT_ENCRYPTION_KEY_INVALID");
      }
      throw error;
    }

    if (databasePath !== ":memory:") {
      const directory = path.dirname(databasePath);
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      chmodSync(directory, 0o700);
    }
    try {
      this.#database = new DatabaseSync(databasePath);
      if (databasePath !== ":memory:") chmodSync(databasePath, 0o600);
      this.#database.exec("PRAGMA foreign_keys = ON; PRAGMA secure_delete = ON; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;");
      this.#migrate();
      this.schemaVersion = Number(this.#database.prepare("PRAGMA user_version").get()?.user_version);
    } catch (error) {
      this.#encryptionKey.fill(0);
      if (error instanceof LocalIngestionError) throw error;
      throw new LocalIngestionError("IMPORT_PERSISTENCE_FAILED");
    }
  }

  #assertOpen() {
    if (this.#closed) throw new LocalIngestionError("IMPORT_PERSISTENCE_FAILED");
  }

  #migrate() {
    let current = Number(this.#database.prepare("PRAGMA user_version").get()?.user_version);
    if (current > LOCAL_INGESTION_SCHEMA_VERSION) {
      throw new LocalIngestionError("IMPORT_SCHEMA_UNSUPPORTED");
    }
    if (current === 0) {
      this.#database.exec("BEGIN IMMEDIATE");
      try {
        this.#database.exec(schemaV1);
        this.#database.exec("PRAGMA user_version = 1");
        this.#database.exec("COMMIT");
        current = 1;
      } catch (error) {
        this.#database.exec("ROLLBACK");
        throw error;
      }
    }
    if (current === 1) {
      this.#database.exec("BEGIN IMMEDIATE");
      try {
        this.#database.exec(schemaV2);
        this.#database.exec("PRAGMA user_version = 2");
        this.#database.exec("COMMIT");
        current = 2;
      } catch (error) {
        this.#database.exec("ROLLBACK");
        throw error;
      }
    }
    if (current === 2) {
      this.#database.exec("BEGIN IMMEDIATE");
      try {
        this.#database.exec(schemaV3);
        this.#database.exec("PRAGMA user_version = 3");
        this.#database.exec("COMMIT");
        current = 3;
      } catch (error) {
        this.#database.exec("ROLLBACK");
        throw error;
      }
    }
    if (current === 3) {
      this.#database.exec("BEGIN IMMEDIATE");
      try {
        this.#database.exec(schemaV4);
        this.#database.exec("PRAGMA user_version = 4");
        this.#database.exec("COMMIT");
        current = 4;
      } catch (error) {
        this.#database.exec("ROLLBACK");
        throw error;
      }
    }
    if (current === 4) {
      this.#database.exec("BEGIN IMMEDIATE");
      try {
        this.#database.exec(schemaV5);
        this.#database.exec(`PRAGMA user_version = ${LOCAL_INGESTION_SCHEMA_VERSION}`);
        this.#database.exec("COMMIT");
      } catch (error) {
        this.#database.exec("ROLLBACK");
        throw error;
      }
    }
  }

  close() {
    if (this.#closed) return;
    this.#database.close();
    this.#encryptionKey.fill(0);
    this.#closed = true;
  }

  databasePermissions(): number | null {
    if (this.databasePath === ":memory:") return null;
    return statSync(this.databasePath).mode & 0o777;
  }

  registerCanonicalAccount({
    account,
    providerId,
    accountType,
    registeredAt,
  }: {
    account: FinancialAccount;
    providerId: "td";
    accountType: "chequing" | "credit-card";
    registeredAt: string;
  }) {
    this.#assertOpen();
    const institutionCompatible = /(?:^|\b)(?:TD|TORONTO\s+DOMINION)(?:\b|$)/i.test(account.institution);
    const typeCompatible = accountType === "chequing"
      ? account.type === "asset" && account.group === "cash"
      : account.type === "liability" && account.group === "debts";
    if (!institutionCompatible || !typeCompatible) {
      throw new LocalIngestionError("IMPORT_ACCOUNT_INCOMPATIBLE");
    }
    const existing = this.#database.prepare(
      "SELECT provider_id, account_type FROM account_import_mappings WHERE account_id = ?",
    ).get(account.id) as SqlRow | undefined;
    if (existing) {
      if (existing.provider_id !== providerId || existing.account_type !== accountType) {
        throw new LocalIngestionError("IMPORT_ACCOUNT_INCOMPATIBLE");
      }
      return;
    }
    this.#database.prepare(`
      INSERT INTO account_import_mappings (account_id, provider_id, account_type, created_at)
      VALUES (?, ?, ?, ?)
    `).run(account.id, providerId, accountType, registeredAt);
  }

  assertAccountMapping(accountId: string, providerId: string, accountType: string) {
    this.#assertOpen();
    const mapping = this.#database.prepare(
      "SELECT provider_id, account_type FROM account_import_mappings WHERE account_id = ?",
    ).get(accountId) as SqlRow | undefined;
    if (!mapping) throw new LocalIngestionError("IMPORT_ACCOUNT_NOT_FOUND");
    if (mapping.provider_id !== providerId || mapping.account_type !== accountType) {
      throw new LocalIngestionError("IMPORT_ACCOUNT_INCOMPATIBLE");
    }
  }

  createReceivedImport(record: ImportJournalRecord) {
    this.#assertOpen();
    this.assertAccountMapping(record.accountId, record.providerId, record.accountType);
    const existing = this.getImportStatus(record.importId);
    if (existing) {
      if (
        existing.sourceSha256 !== record.sourceSha256
        || existing.accountId !== record.accountId
        || existing.providerId !== record.providerId
        || existing.accountType !== record.accountType
        || existing.parserVersion !== record.parserVersion
        || existing.statementPeriodStart !== record.statementPeriodStart
        || existing.statementPeriodEnd !== record.statementPeriodEnd
        || existing.sourceFormat !== record.sourceFormat
      ) {
        throw new LocalIngestionError("IMPORT_ID_CONFLICT");
      }
      return existing;
    }
    this.#database.prepare(`
      INSERT INTO import_journal (
        import_id, source_sha256, provider_id, account_type, account_id,
        parser_version, statement_period_start, statement_period_end,
        source_format, received_at, status, schema_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', ?)
    `).run(
      record.importId,
      record.sourceSha256,
      record.providerId,
      record.accountType,
      record.accountId,
      record.parserVersion,
      record.statementPeriodStart,
      record.statementPeriodEnd,
      record.sourceFormat,
      record.receivedAt,
      LOCAL_INGESTION_SCHEMA_VERSION,
    );
    return this.getImportStatus(record.importId)!;
  }

  transitionImport({
    importId,
    to,
    timestamp,
    parsedTransactionCount,
    committedTransactionCount,
    duplicateTransactionCount,
    safeErrorCode,
  }: {
    importId: string;
    to: ImportJournalStatus;
    timestamp: string;
    parsedTransactionCount?: number;
    committedTransactionCount?: number;
    duplicateTransactionCount?: number;
    safeErrorCode?: string | null;
  }): ImportJournalRecord {
    this.#assertOpen();
    const current = this.getImportStatus(importId);
    if (!current || !STATE_TRANSITIONS[current.status].includes(to)) {
      throw new LocalIngestionError("IMPORT_INVALID_STATE");
    }
    const processingStartedAt = to === "parsing" ? timestamp : current.processingStartedAt;
    const proposedAt = to === "proposed" ? timestamp : current.proposedAt;
    const committedAt = to === "committed" || to === "duplicate" ? timestamp : current.committedAt;
    this.#database.prepare(`
      UPDATE import_journal SET
        status = ?, processing_started_at = ?, proposed_at = ?, committed_at = ?,
        parsed_transaction_count = ?, committed_transaction_count = ?,
        duplicate_transaction_count = ?, safe_error_code = ?
      WHERE import_id = ?
    `).run(
      to,
      processingStartedAt,
      proposedAt,
      committedAt,
      parsedTransactionCount ?? current.parsedTransactionCount,
      committedTransactionCount ?? current.committedTransactionCount,
      duplicateTransactionCount ?? current.duplicateTransactionCount,
      safeErrorCode ?? current.safeErrorCode,
      importId,
    );
    return this.getImportStatus(importId)!;
  }

  findCommittedFileDuplicate(record: ImportJournalRecord): ImportJournalRecord | null {
    this.#assertOpen();
    const row = this.#database.prepare(`
      SELECT * FROM import_journal
      WHERE source_sha256 = ? AND account_id = ? AND provider_id = ?
        AND account_type = ? AND status = 'committed'
      LIMIT 1
    `).get(
      record.sourceSha256,
      record.accountId,
      record.providerId,
      record.accountType,
    ) as SqlRow | undefined;
    return row ? importFromRow(row) : null;
  }

  commitPreparedImport(prepared: PreparedStatementImport, committedAt: string): DurableImportReceipt {
    this.#assertOpen();
    const current = this.getImportStatus(prepared.journal.importId);
    if (!current || current.status !== "proposed") {
      throw new LocalIngestionError("IMPORT_INVALID_STATE");
    }

    let committedCount = 0;
    let duplicateCount = 0;
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      for (const preparedTransaction of prepared.transactions) {
        const transaction = preparedTransaction.transaction;
        const existing = this.#database.prepare(`
          SELECT transaction_id FROM canonical_transactions
          WHERE account_id = ? AND fingerprint_version = ? AND fingerprint_value = ?
        `).get(
          transaction.accountId,
          transaction.provenance.fingerprint.version,
          transaction.provenance.fingerprint.value,
        ) as SqlRow | undefined;
        let transactionId = transaction.id;
        let outcome = "inserted";
        if (existing) {
          transactionId = String(existing.transaction_id);
          outcome = "duplicate";
          duplicateCount += 1;
        } else {
          const payload: EncryptedTransactionPayload = {
            amountCents: preparedTransaction.amountCents,
            direction: transaction.direction,
            postedDate: transaction.postedDate,
            rawDescription: transaction.rawDescription,
            normalizedCounterparty: transaction.normalizedCounterparty,
            financialMeaning: transaction.financialMeaning,
            status: transaction.status,
            relatedTransactionId: transaction.relatedTransactionId,
            attribution: transaction.attribution,
            sourceRecordId: transaction.provenance.sourceRecordId,
            sourceKind: transaction.provenance.sourceKind,
            observedAt: transaction.provenance.observedAt,
            sourceUpdatedAt: transaction.provenance.sourceUpdatedAt,
            maskedReferenceToken: preparedTransaction.maskedReferenceToken,
          };
          this.#database.prepare(`
            INSERT INTO canonical_transactions (
              transaction_id, account_id, originating_import_id, provider_id,
              transaction_date, currency, fingerprint_version, fingerprint_value,
              deduplication_key, encrypted_payload, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            transaction.id,
            transaction.accountId,
            transaction.provenance.importId,
            transaction.provenance.providerId,
            transaction.transactionDate,
            transaction.currency,
            transaction.provenance.fingerprint.version,
            transaction.provenance.fingerprint.value,
            transaction.provenance.deduplicationKey,
            encryptJsonPayload(payload, this.#encryptionKey),
            transaction.createdAt,
            transaction.updatedAt,
          );
          committedCount += 1;
        }
        this.#database.prepare(`
          INSERT INTO import_transaction_links (import_id, transaction_id, source_row_number, outcome)
          VALUES (?, ?, ?, ?)
        `).run(
          prepared.journal.importId,
          transactionId,
          preparedTransaction.sourceRowNumber,
          outcome,
        );
      }
      if ("statementFacts" in prepared) {
        const facts = prepared.statementFacts;
        const payload: EncryptedStatementFactsPayload = {
          minimumPaymentCents: facts.minimumPaymentCents,
          previousBalanceCents: facts.previousBalanceCents,
          newBalanceCents: facts.newBalanceCents,
        };
        const existingFacts = this.#database.prepare(
          "SELECT * FROM statement_facts WHERE statement_id = ?",
        ).get(facts.id) as SqlRow | undefined;
        if (existingFacts) {
          const existingPayload = decryptJsonPayload<EncryptedStatementFactsPayload>(
            String(existingFacts.encrypted_payload),
            this.#encryptionKey,
          );
          if (
            String(existingFacts.account_id) !== facts.accountId
            || String(existingFacts.statement_date) !== facts.statementDate
            || String(existingFacts.payment_due_date) !== facts.paymentDueDate
            || existingPayload.minimumPaymentCents !== facts.minimumPaymentCents
            || existingPayload.previousBalanceCents !== facts.previousBalanceCents
            || existingPayload.newBalanceCents !== facts.newBalanceCents
          ) throw new Error("STATEMENT_FACTS_CONFLICT");
        } else {
          this.#database.prepare(`
            INSERT INTO statement_facts (
              statement_id, import_id, account_id, provider_id, account_type, currency,
              statement_date, statement_period_start, statement_period_end,
              payment_due_date, encrypted_payload, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            facts.id,
            facts.importId,
            facts.accountId,
            facts.providerId,
            facts.accountType,
            facts.currency,
            facts.statementDate,
            facts.statementPeriodStart,
            facts.statementPeriodEnd,
            facts.paymentDueDate,
            encryptJsonPayload(payload, this.#encryptionKey),
            facts.createdAt,
          );
        }
      }
      if ("chequingStatementFacts" in prepared) {
        this.saveChequingStatementFacts(prepared.chequingStatementFacts);
      }
      this.#database.prepare(`
        UPDATE import_journal SET status = 'committed', committed_at = ?,
          committed_transaction_count = ?, duplicate_transaction_count = ?
        WHERE import_id = ? AND status = 'proposed'
      `).run(committedAt, committedCount, duplicateCount, prepared.journal.importId);
      this.#database.exec("COMMIT");
    } catch {
      this.#database.exec("ROLLBACK");
      throw new LocalIngestionError("IMPORT_PERSISTENCE_FAILED");
    }
    return receiptFromImport(this.getImportStatus(prepared.journal.importId)!);
  }

  markFileDuplicate(record: ImportJournalRecord, timestamp: string): DurableImportReceipt {
    const committed = this.findCommittedFileDuplicate(record);
    if (committed) {
      return {
        ...receiptFromImport(committed),
        status: "duplicate",
        transactionCount: 0,
        duplicateCount: record.parsedTransactionCount,
      };
    }
    const current = this.createReceivedImport(record);
    if (current.status === "duplicate") return receiptFromImport(current);
    if (current.status !== "received") throw new LocalIngestionError("IMPORT_INVALID_STATE");
    const duplicate = this.transitionImport({
      importId: record.importId,
      to: "duplicate",
      timestamp,
      parsedTransactionCount: record.parsedTransactionCount,
      duplicateTransactionCount: record.parsedTransactionCount,
    });
    return receiptFromImport(duplicate);
  }

  getImportStatus(importId: string): ImportJournalRecord | null {
    this.#assertOpen();
    const row = this.#database.prepare(
      "SELECT * FROM import_journal WHERE import_id = ?",
    ).get(importId) as SqlRow | undefined;
    return row ? importFromRow(row) : null;
  }

  getImportHistory(): readonly ImportJournalRecord[] {
    this.#assertOpen();
    return (this.#database.prepare(
      "SELECT * FROM import_journal ORDER BY received_at DESC, import_id DESC",
    ).all() as SqlRow[]).map(importFromRow);
  }

  getTransactionCount(): number {
    this.#assertOpen();
    return Number(this.#database.prepare(
      "SELECT COUNT(*) AS count FROM canonical_transactions",
    ).get()?.count);
  }

  saveChequingStatementFacts(facts: CanonicalChequingStatementFacts): "saved" | "duplicate" {
    this.#assertOpen();
    const existing = this.#database.prepare(`SELECT * FROM chequing_statement_facts
      WHERE account_id = ? AND (source_sha256 = ? OR (statement_period_start = ? AND statement_period_end = ?)) LIMIT 1`).get(
      facts.accountId, facts.sourceSha256, facts.statementPeriodStart, facts.statementPeriodEnd,
    ) as SqlRow | undefined;
    if (existing) {
      const current = this.#chequingStatementFactsFromRow(existing);
      if (
        current.openingBalanceCents !== facts.openingBalanceCents
        || current.totalDepositsCents !== facts.totalDepositsCents
        || current.totalWithdrawalsCents !== facts.totalWithdrawalsCents
        || current.closingBalanceCents !== facts.closingBalanceCents
      ) throw new LocalIngestionError("IMPORT_PERSISTENCE_FAILED");
      return "duplicate";
    }
    this.#database.prepare(`INSERT INTO chequing_statement_facts (
      statement_id, import_id, account_id, provider_id, account_type, currency,
      statement_period_start, statement_period_end, closing_balance_evidence,
      source_sha256, encrypted_payload, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      facts.id, facts.importId, facts.accountId, facts.providerId, facts.accountType, facts.currency,
      facts.statementPeriodStart, facts.statementPeriodEnd, facts.closingBalanceEvidence, facts.sourceSha256,
      encryptJsonPayload({ openingBalanceCents: facts.openingBalanceCents, totalDepositsCents: facts.totalDepositsCents,
        totalWithdrawalsCents: facts.totalWithdrawalsCents, closingBalanceCents: facts.closingBalanceCents }, this.#encryptionKey),
      facts.createdAt,
    );
    return "saved";
  }

  #transactionFromRow(row: SqlRow): CanonicalTransaction {
    const payload = decryptJsonPayload<EncryptedTransactionPayload>(
      String(row.encrypted_payload),
      this.#encryptionKey,
    );
    return {
      id: String(row.transaction_id),
      accountId: String(row.account_id),
      transactionDate: String(row.transaction_date),
      postedDate: payload.postedDate,
      amount: payload.amountCents / 100,
      direction: payload.direction,
      currency: String(row.currency),
      rawDescription: payload.rawDescription,
      normalizedCounterparty: payload.normalizedCounterparty,
      financialMeaning: payload.financialMeaning,
      status: payload.status,
      relatedTransactionId: payload.relatedTransactionId,
      attribution: payload.attribution,
      provenance: {
        importId: String(row.originating_import_id),
        providerId: String(row.provider_id),
        sourceRecordId: payload.sourceRecordId,
        sourceKind: payload.sourceKind,
        observedAt: payload.observedAt,
        sourceUpdatedAt: payload.sourceUpdatedAt,
        fingerprint: {
          version: String(row.fingerprint_version),
          value: String(row.fingerprint_value),
        },
        deduplicationKey: String(row.deduplication_key),
      },
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    };
  }

  getTransactionsByAccount(accountId: string): readonly CanonicalTransaction[] {
    this.#assertOpen();
    return (this.#database.prepare(`
      SELECT * FROM canonical_transactions
      WHERE account_id = ? ORDER BY transaction_date DESC, transaction_id
    `).all(accountId) as SqlRow[]).map((row) => this.#transactionFromRow(row));
  }

  getTransactionsByImport(importId: string): readonly CanonicalTransaction[] {
    this.#assertOpen();
    return (this.#database.prepare(`
      SELECT t.* FROM canonical_transactions t
      INNER JOIN import_transaction_links l ON l.transaction_id = t.transaction_id
      WHERE l.import_id = ? ORDER BY l.source_row_number
    `).all(importId) as SqlRow[]).map((row) => this.#transactionFromRow(row));
  }

  getReceipt(importId: string): DurableImportReceipt | null {
    const record = this.getImportStatus(importId);
    if (!record || !["committed", "duplicate", "rejected", "quarantined"].includes(record.status)) {
      return null;
    }
    return receiptFromImport(record);
  }

  #statementFactsFromRow(row: SqlRow): CanonicalStatementFacts {
    const payload = decryptJsonPayload<EncryptedStatementFactsPayload>(
      String(row.encrypted_payload),
      this.#encryptionKey,
    );
    return {
      id: String(row.statement_id),
      importId: String(row.import_id),
      accountId: String(row.account_id),
      providerId: "td",
      accountType: "credit-card",
      currency: "CAD",
      statementDate: String(row.statement_date),
      statementPeriodStart: String(row.statement_period_start),
      statementPeriodEnd: String(row.statement_period_end),
      paymentDueDate: String(row.payment_due_date),
      minimumPaymentCents: payload.minimumPaymentCents,
      previousBalanceCents: payload.previousBalanceCents,
      newBalanceCents: payload.newBalanceCents,
      createdAt: String(row.created_at),
    };
  }

  #chequingStatementFactsFromRow(row: SqlRow): CanonicalChequingStatementFacts {
    const payload = decryptJsonPayload<EncryptedChequingStatementFactsPayload>(
      String(row.encrypted_payload), this.#encryptionKey,
    );
    return {
      id: String(row.statement_id), importId: String(row.import_id), accountId: String(row.account_id),
      providerId: "td", accountType: "chequing", currency: "CAD",
      statementPeriodStart: String(row.statement_period_start), statementPeriodEnd: String(row.statement_period_end),
      closingBalanceEvidence: String(row.closing_balance_evidence) as CanonicalChequingStatementFacts["closingBalanceEvidence"],
      sourceSha256: String(row.source_sha256), createdAt: String(row.created_at), ...payload,
    };
  }

  getChequingStatementFactsByAccount(accountId: string): readonly CanonicalChequingStatementFacts[] {
    this.#assertOpen();
    return (this.#database.prepare(`SELECT * FROM chequing_statement_facts
      WHERE account_id = ? ORDER BY statement_period_end ASC, statement_id`).all(accountId) as SqlRow[])
      .map((row) => this.#chequingStatementFactsFromRow(row));
  }

  getStatementFactsByAccount(accountId: string): readonly CanonicalStatementFacts[] {
    this.#assertOpen();
    return (this.#database.prepare(`
      SELECT * FROM statement_facts WHERE account_id = ? ORDER BY statement_date DESC, statement_id
    `).all(accountId) as SqlRow[]).map((row) => this.#statementFactsFromRow(row));
  }

  getStatementFactsByImport(importId: string): CanonicalStatementFacts | null {
    this.#assertOpen();
    const row = this.#database.prepare(
      "SELECT * FROM statement_facts WHERE import_id = ?",
    ).get(importId) as SqlRow | undefined;
    return row ? this.#statementFactsFromRow(row) : null;
  }

  saveInvestmentSnapshot(snapshot: CanonicalInvestmentSnapshot): "saved" | "duplicate" {
    this.#assertOpen();
    const existing = this.#database.prepare(`SELECT snapshot_id FROM investment_snapshots
      WHERE account_id = ? AND (source_sha256 = ? OR (statement_period_start = ? AND statement_period_end = ?)) LIMIT 1`).get(
      snapshot.accountId, snapshot.sourceSha256, snapshot.statementPeriodStart, snapshot.statementPeriodEnd,
    );
    if (existing) return "duplicate";
    const encrypted = encryptJsonPayload({
      endingValueCents: snapshot.endingValueCents, bookCostCents: snapshot.bookCostCents,
      contributionsCents: snapshot.contributionsCents, withdrawalsCents: snapshot.withdrawalsCents,
      employeeContributionsCents: snapshot.employeeContributionsCents, employerContributionsCents: snapshot.employerContributionsCents,
    }, this.#encryptionKey);
    this.#database.prepare(`INSERT INTO investment_snapshots (
      snapshot_id, account_id, provider_id, account_type, parser_version, statement_period_start,
      statement_period_end, source_sha256, encrypted_payload, recorded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      snapshot.id, snapshot.accountId, snapshot.providerId, snapshot.accountType, snapshot.parserVersion,
      snapshot.statementPeriodStart, snapshot.statementPeriodEnd, snapshot.sourceSha256, encrypted, snapshot.recordedAt,
    );
    return "saved";
  }

  getInvestmentSnapshots(accountId: string): readonly CanonicalInvestmentSnapshot[] {
    this.#assertOpen();
    return this.#database.prepare(`SELECT * FROM investment_snapshots WHERE account_id = ? ORDER BY statement_period_end ASC`).all(accountId).map((row) => {
      const value = row as SqlRow;
      const payload = decryptJsonPayload<Omit<CanonicalInvestmentSnapshot, "id" | "accountId" | "providerId" | "accountType" | "parserVersion" | "statementPeriodStart" | "statementPeriodEnd" | "sourceSha256" | "recordedAt">>(String(value.encrypted_payload), this.#encryptionKey);
      return {
        id: String(value.snapshot_id), accountId: String(value.account_id), providerId: String(value.provider_id) as CanonicalInvestmentSnapshot["providerId"],
        accountType: String(value.account_type) as CanonicalInvestmentSnapshot["accountType"], parserVersion: String(value.parser_version),
        statementPeriodStart: String(value.statement_period_start), statementPeriodEnd: String(value.statement_period_end),
        sourceSha256: String(value.source_sha256), recordedAt: String(value.recorded_at), ...payload,
      };
    });
  }

  findRecoverableImport({
    sourceSha256,
    accountId,
    providerId,
    accountType,
  }: {
    sourceSha256: string;
    accountId: string;
    providerId: string;
    accountType: string;
  }): ImportJournalRecord | null {
    this.#assertOpen();
    const row = this.#database.prepare(`
      SELECT * FROM import_journal
      WHERE source_sha256 = ? AND account_id = ? AND provider_id = ? AND account_type = ?
        AND status IN ('received','parsing','proposed')
      ORDER BY received_at, import_id LIMIT 1
    `).get(sourceSha256, accountId, providerId, accountType) as SqlRow | undefined;
    return row ? importFromRow(row) : null;
  }

  saveStatementFolderResult(result: StatementFolderResult) {
    this.#assertOpen();
    this.#database.prepare(`
      INSERT INTO statement_folder_results (
        result_id, import_id, route_id, provider_id, account_type, status,
        transaction_count, duplicate_count, safe_reason_code, processed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(result_id) DO UPDATE SET
        import_id = excluded.import_id,
        route_id = excluded.route_id,
        provider_id = excluded.provider_id,
        account_type = excluded.account_type,
        status = excluded.status,
        transaction_count = excluded.transaction_count,
        duplicate_count = excluded.duplicate_count,
        safe_reason_code = excluded.safe_reason_code,
        processed_at = excluded.processed_at
    `).run(
      result.resultId,
      result.importId,
      result.routeId,
      result.providerId,
      result.accountType,
      result.status,
      result.transactionCount,
      result.duplicateCount,
      result.safeReasonCode,
      result.processedAt,
    );
  }

  getStatementFolderResults(): readonly StatementFolderResult[] {
    this.#assertOpen();
    return (this.#database.prepare(`
      SELECT * FROM statement_folder_results ORDER BY processed_at DESC, result_id DESC
    `).all() as SqlRow[]).map((row) => ({
      resultId: String(row.result_id),
      importId: row.import_id === null ? null : String(row.import_id),
      routeId: row.route_id === null ? null : String(row.route_id) as StatementFolderResult["routeId"],
      providerId: row.provider_id === null ? null : "td",
      accountType: row.account_type === null ? null : String(row.account_type) as StatementFolderResult["accountType"],
      status: String(row.status) as StatementFolderResult["status"],
      transactionCount: Number(row.transaction_count),
      duplicateCount: Number(row.duplicate_count),
      safeReasonCode: row.safe_reason_code === null ? null : String(row.safe_reason_code),
      processedAt: String(row.processed_at),
    }));
  }
}
