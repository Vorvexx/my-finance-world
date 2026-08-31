import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  ingestParsedTdChequingStatement,
  rejectPreparedTdChequingImport,
} from "../lib/imports/td-chequing-import.ts";
import { validateLocalPdf } from "../lib/financial-files/pdf-intake.ts";
import { parseTdChequingPdf } from "../lib/financial-files/td-chequing-pdf-parser.ts";
import {
  LocalIngestionError,
  LocalIngestionStore,
} from "../lib/persistence/local-ingestion-store.ts";
import {
  LOCAL_INGESTION_SCHEMA_VERSION,
  normalizeTdChequingStatement,
  TD_TRANSACTION_FINGERPRINT_VERSION,
} from "../lib/transactions/td-chequing-normalization.ts";
import type { FinancialAccount } from "../types/finance.ts";
import type { TdChequingParsedStatement } from "../types/financial-files.ts";
import type { PreparedTdChequingImport } from "../types/imports.ts";
import {
  buildSyntheticTdPdf,
  type SyntheticTdPdfOptions,
} from "./helpers/synthetic-td-pdf.ts";

const RECEIVED_AT = "2099-08-01T12:00:00.000Z";
const COMMITTED_AT = "2099-08-01T12:00:01.000Z";
const ACCOUNT: FinancialAccount = {
  id: "vorvex-account-synthetic-chequing",
  name: "Synthetic Chequing",
  institution: "TD Canada Trust",
  balance: 0,
  type: "asset",
  group: "cash",
  updatedAt: RECEIVED_AT,
};

let scratchRoot: string;
let sequence = 0;

before(async () => {
  scratchRoot = await mkdtemp(path.join(os.tmpdir(), "vorvex-durable-ingestion-test-"));
});

after(async () => {
  await rm(scratchRoot, { recursive: true, force: true });
});

const databasePath = (name: string) => path.join(scratchRoot, `${name}.sqlite`);

const createStore = (name: string, key = randomBytes(32)) => {
  const store = new LocalIngestionStore({ databasePath: databasePath(name), encryptionKey: key });
  store.registerCanonicalAccount({
    account: ACCOUNT,
    providerId: "td",
    accountType: "chequing",
    registeredAt: RECEIVED_AT,
  });
  return { store, key };
};

const parseSyntheticPdf = async ({
  importId,
  options = {},
  fileLabel,
}: {
  importId: string;
  options?: SyntheticTdPdfOptions;
  fileLabel?: string;
}): Promise<TdChequingParsedStatement> => {
  sequence += 1;
  const sourcePath = path.join(scratchRoot, `${fileLabel ?? `statement-${sequence}`}.pdf`);
  await writeFile(sourcePath, buildSyntheticTdPdf(options));
  const source = await validateLocalPdf({
    sourcePath,
    allowedRoot: scratchRoot,
    intakeTimestamp: RECEIVED_AT,
  });
  try {
    return await parseTdChequingPdf({ source, importContext: { importId } });
  } finally {
    if (source.bytes.byteLength) source.bytes.fill(0);
  }
};

const ingest = (
  store: LocalIngestionStore,
  parsed: TdChequingParsedStatement,
) => ingestParsedTdChequingStatement({
  store,
  parsed,
  accountId: ACCOUNT.id,
  receivedAt: RECEIVED_AT,
  committedAt: COMMITTED_AT,
});

test("creates the import journal and enforces valid state transitions", async () => {
  const { store } = createStore("journal");
  try {
    const parsed = await parseSyntheticPdf({ importId: "journal-import" });
    const prepared = normalizeTdChequingStatement({
      parsed,
      accountId: ACCOUNT.id,
      receivedAt: RECEIVED_AT,
    });
    const received = store.createReceivedImport(prepared.journal);
    assert.equal(received.status, "received");
    const parsing = store.transitionImport({
      importId: received.importId,
      to: "parsing",
      timestamp: RECEIVED_AT,
    });
    assert.equal(parsing.status, "parsing");
    const proposed = store.transitionImport({
      importId: received.importId,
      to: "proposed",
      timestamp: RECEIVED_AT,
      parsedTransactionCount: prepared.transactions.length,
    });
    assert.equal(proposed.status, "proposed");
    assert.throws(
      () => store.transitionImport({
        importId: received.importId,
        to: "parsing",
        timestamp: RECEIVED_AT,
      }),
      (error: unknown) => error instanceof LocalIngestionError && error.code === "IMPORT_INVALID_STATE",
    );
  } finally {
    store.close();
  }
});

test("atomically commits normalized canonical transactions and exposes safe queries", async () => {
  const { store } = createStore("commit-query");
  try {
    const parsed = await parseSyntheticPdf({ importId: "commit-import", options: { lowerContent: true } });
    const receipt = ingest(store, parsed);
    assert.deepEqual(receipt, {
      importId: "commit-import",
      status: "committed",
      providerId: "td",
      accountType: "chequing",
      transactionCount: 5,
      duplicateCount: 0,
      reviewCount: 0,
      safeToDeleteSource: true,
    });
    assert.equal(store.getTransactionCount(), 5);
    assert.equal(store.getTransactionsByAccount(ACCOUNT.id).length, 5);
    assert.equal(store.getTransactionsByImport("commit-import").length, 5);
    assert.equal(store.getImportHistory().length, 1);
    const statement = store.getChequingStatementFactsByAccount(ACCOUNT.id)[0];
    assert.equal(statement.openingBalanceCents, 100000);
    assert.equal(statement.totalDepositsCents, 105000);
    assert.equal(statement.totalWithdrawalsCents, 60000);
    assert.equal(statement.closingBalanceCents, 145000);
    assert.equal(statement.closingBalanceEvidence, "statement-label");
    const transaction = store.getTransactionsByImport("commit-import")[0];
    assert.equal(transaction.accountId, ACCOUNT.id);
    assert.equal(transaction.postedDate, null);
    assert.equal(transaction.currency, "CAD");
    assert.equal(transaction.provenance.providerId, "td");
    assert.equal(transaction.provenance.sourceRecordId, null);
    assert.equal(transaction.provenance.fingerprint.version, TD_TRANSACTION_FINGERPRINT_VERSION);
    assert.match(transaction.id, /^vorvex-transaction:[a-f0-9]{64}$/);
    assert.equal(transaction.financialMeaning, "unknown");
  } finally {
    store.close();
  }
});

test("marks renamed identical bytes as a file duplicate and does not reinsert", async () => {
  const { store } = createStore("file-dedup");
  try {
    const first = await parseSyntheticPdf({
      importId: "file-first",
      fileLabel: "first-name",
    });
    const second = await parseSyntheticPdf({
      importId: "file-second",
      fileLabel: "renamed-same-bytes",
    });
    assert.equal(first.source.sha256, second.source.sha256);
    assert.equal(ingest(store, first).status, "committed");
    const duplicate = ingest(store, second);
    assert.equal(duplicate.status, "duplicate");
    assert.equal(duplicate.transactionCount, 0);
    assert.equal(duplicate.duplicateCount, 5);
    assert.equal(duplicate.safeToDeleteSource, true);
    assert.equal(store.getTransactionCount(), 5);
    assert.equal(store.getImportHistory().length, 1);
  } finally {
    store.close();
  }
});

test("deduplicates overlapping statement transactions across different files", async () => {
  const { store } = createStore("overlap");
  try {
    const first = await parseSyntheticPdf({ importId: "overlap-first" });
    const overlap = await parseSyntheticPdf({
      importId: "overlap-second",
      options: { lowerContent: true },
    });
    assert.notEqual(first.source.sha256, overlap.source.sha256);
    ingest(store, first);
    const receipt = ingest(store, overlap);
    assert.equal(receipt.status, "committed");
    assert.equal(receipt.transactionCount, 0);
    assert.equal(receipt.duplicateCount, 5);
    assert.equal(store.getTransactionCount(), 5);
    assert.equal(store.getTransactionsByImport("overlap-second").length, 5);
  } finally {
    store.close();
  }
});

test("preserves legitimate identical-looking rows with occurrence-ordinal fingerprints", async () => {
  const { store } = createStore("identical-rows");
  try {
    const parsed = await parseSyntheticPdf({
      importId: "identical-import",
      options: {
        openingBalance: "1,000.00",
        closingBalance: "980.00",
        totalWithdrawals: "20.00",
        totalDeposits: "0.00",
        rows: [
          { descriptionBlocks: ["SYNTHETIC IDENTICAL"], withdrawal: "10.00", date: "JUL2", balance: "990.00" },
          { descriptionBlocks: ["SYNTHETIC IDENTICAL"], withdrawal: "10.00", date: "JUL2", balance: "980.00" },
        ],
      },
    });
    const prepared = normalizeTdChequingStatement({ parsed, accountId: ACCOUNT.id, receivedAt: RECEIVED_AT });
    assert.equal(prepared.transactions.length, 2);
    assert.notEqual(
      prepared.transactions[0].transaction.provenance.fingerprint.value,
      prepared.transactions[1].transaction.provenance.fingerprint.value,
    );
    const receipt = ingest(store, parsed);
    assert.equal(receipt.transactionCount, 2);
    assert.equal(store.getTransactionCount(), 2);
  } finally {
    store.close();
  }
});

test("includes justified masked tokens in minimized versioned fingerprints", async () => {
  const parsed = await parseSyntheticPdf({ importId: "masked-token-import" });
  const prepared = normalizeTdChequingStatement({ parsed, accountId: ACCOUNT.id, receivedAt: RECEIVED_AT });
  const masked = prepared.transactions.filter((item) => item.maskedReferenceToken !== null);
  assert.equal(masked.length, 2);
  assert.notEqual(
    masked[0].transaction.provenance.fingerprint.value,
    masked[1].transaction.provenance.fingerprint.value,
  );
  assert.equal(masked[0].transaction.provenance.fingerprint.version, TD_TRANSACTION_FINGERPRINT_VERSION);
});

test("rolls back every transaction and leaves a recoverable proposed import on failure", async () => {
  const { store } = createStore("rollback");
  try {
    const parsed = await parseSyntheticPdf({ importId: "rollback-import" });
    const prepared = normalizeTdChequingStatement({ parsed, accountId: ACCOUNT.id, receivedAt: RECEIVED_AT });
    store.createReceivedImport(prepared.journal);
    store.transitionImport({ importId: prepared.journal.importId, to: "parsing", timestamp: RECEIVED_AT });
    store.transitionImport({
      importId: prepared.journal.importId,
      to: "proposed",
      timestamp: RECEIVED_AT,
      parsedTransactionCount: 2,
    });
    const duplicated: PreparedTdChequingImport = {
      journal: prepared.journal,
      chequingStatementFacts: prepared.chequingStatementFacts,
      transactions: [
        prepared.transactions[0],
        { ...prepared.transactions[0], sourceRowNumber: 2 },
      ],
    };
    assert.throws(
      () => store.commitPreparedImport(duplicated, COMMITTED_AT),
      (error: unknown) => error instanceof LocalIngestionError && error.code === "IMPORT_PERSISTENCE_FAILED",
    );
    assert.equal(store.getTransactionCount(), 0);
    assert.equal(store.getImportStatus("rollback-import")?.status, "proposed");
  } finally {
    store.close();
  }
});

test("reopens durable state, resumes an interrupted import, and preserves permissions", async () => {
  const name = "reopen-recovery";
  const key = randomBytes(32);
  const parsed = await parseSyntheticPdf({ importId: "recovery-import" });
  const prepared = normalizeTdChequingStatement({ parsed, accountId: ACCOUNT.id, receivedAt: RECEIVED_AT });
  const first = createStore(name, key).store;
  first.createReceivedImport(prepared.journal);
  first.transitionImport({ importId: prepared.journal.importId, to: "parsing", timestamp: RECEIVED_AT });
  first.transitionImport({
    importId: prepared.journal.importId,
    to: "proposed",
    timestamp: RECEIVED_AT,
    parsedTransactionCount: prepared.transactions.length,
  });
  assert.equal(first.databasePermissions(), 0o600);
  first.close();

  const reopened = createStore(name, key).store;
  try {
    assert.equal(reopened.schemaVersion, LOCAL_INGESTION_SCHEMA_VERSION);
    assert.equal(reopened.getImportStatus("recovery-import")?.status, "proposed");
    const receipt = ingest(reopened, parsed);
    assert.equal(receipt.status, "committed");
    assert.equal(reopened.getTransactionCount(), 5);
  } finally {
    reopened.close();
    key.fill(0);
  }
});

test("rejects unsupported schema versions and invalid encryption keys", () => {
  assert.throws(
    () => new LocalIngestionStore({ databasePath: ":memory:", encryptionKey: new Uint8Array(31) }),
    (error: unknown) => error instanceof LocalIngestionError && error.code === "IMPORT_ENCRYPTION_KEY_INVALID",
  );

  const unsupportedPath = databasePath("unsupported-schema");
  const database = new DatabaseSync(unsupportedPath);
  database.exec("PRAGMA user_version = 999");
  database.close();
  assert.throws(
    () => new LocalIngestionStore({ databasePath: unsupportedPath, encryptionKey: randomBytes(32) }),
    (error: unknown) => error instanceof LocalIngestionError && error.code === "IMPORT_SCHEMA_UNSUPPORTED",
  );
});

test("encrypts financial payloads at rest and excludes private source material", async () => {
  const name = "privacy-encryption";
  const { store, key } = createStore(name);
  const parsed = await parseSyntheticPdf({ importId: "privacy-import", options: { lowerContent: true } });
  ingest(store, parsed);
  store.close();

  const databaseBytes = await readFile(databasePath(name));
  const databaseText = databaseBytes.toString("latin1");
  for (const forbidden of [
    "SYNTHETIC_PERSON_NAME",
    "123 SYNTHETIC STREET",
    "SYNTHETIC_ACCOUNT_12345",
    "UNRELATED_LEGAL_MARKER",
    "SEND E-TFR",
    "***REF-A",
    scratchRoot,
    ".pdf",
  ]) {
    assert.equal(databaseText.includes(forbidden), false);
  }

  const wrongKeyStore = new LocalIngestionStore({
    databasePath: databasePath(name),
    encryptionKey: randomBytes(32),
  });
  assert.throws(() => wrongKeyStore.getTransactionsByAccount(ACCOUNT.id));
  wrongKeyStore.close();
  key.fill(0);
});

test("rejects missing or incompatible account mappings", async () => {
  const key = randomBytes(32);
  const store = new LocalIngestionStore({ databasePath: databasePath("account-mapping"), encryptionKey: key });
  const parsed = await parseSyntheticPdf({ importId: "account-import" });
  try {
    assert.throws(
      () => ingest(store, parsed),
      (error: unknown) => error instanceof LocalIngestionError && error.code === "IMPORT_ACCOUNT_NOT_FOUND",
    );
    assert.throws(
      () => store.registerCanonicalAccount({
        account: { ...ACCOUNT, institution: "Synthetic Other Bank" },
        providerId: "td",
        accountType: "chequing",
        registeredAt: RECEIVED_AT,
      }),
      (error: unknown) => error instanceof LocalIngestionError && error.code === "IMPORT_ACCOUNT_INCOMPATIBLE",
    );
  } finally {
    store.close();
    key.fill(0);
  }
});

test("persists only narrow deterministic financial meanings", async () => {
  const parsed = await parseSyntheticPdf({ importId: "meaning-import" });
  const descriptions = [
    "MONTHLY ACCOUNT FEE",
    "VISA PAYMENT",
    "ATM WITHDRAWAL",
    "ORDINARY DEPOSIT",
  ];
  const modified: TdChequingParsedStatement = {
    ...parsed,
    transactions: parsed.transactions.slice(0, 4).map((transaction, index) => ({
      ...transaction,
      sourceDescription: descriptions[index],
      normalizedDescription: descriptions[index],
      maskedReferenceToken: null,
    })),
  };
  const prepared = normalizeTdChequingStatement({ parsed: modified, accountId: ACCOUNT.id, receivedAt: RECEIVED_AT });
  assert.deepEqual(
    prepared.transactions.map((item) => item.transaction.financialMeaning),
    ["fee", "credit-card-payment", "cash-withdrawal", "unknown"],
  );
  assert.ok(prepared.transactions.every((item) => item.transaction.attribution.method === "unclassified"));
});

test("records rejected imports without transactions or source-deletion permission", async () => {
  const { store } = createStore("rejected");
  try {
    const parsed = await parseSyntheticPdf({ importId: "rejected-import" });
    const prepared = normalizeTdChequingStatement({ parsed, accountId: ACCOUNT.id, receivedAt: RECEIVED_AT });
    const receipt = rejectPreparedTdChequingImport({
      store,
      prepared,
      safeErrorCode: "SYNTHETIC_REJECTION",
      rejectedAt: COMMITTED_AT,
    });
    assert.equal(receipt.status, "rejected");
    assert.equal(receipt.safeToDeleteSource, false);
    assert.equal(store.getTransactionCount(), 0);
    assert.equal(store.getImportStatus("rejected-import")?.safeErrorCode, "SYNTHETIC_REJECTION");
  } finally {
    store.close();
  }
});

test("parser or reconciliation failure cannot create a committed import", async () => {
  const { store } = createStore("upstream-failure");
  try {
    await assert.rejects(parseSyntheticPdf({
      importId: "parser-failure",
      options: { missingTotals: true },
    }));
    await assert.rejects(parseSyntheticPdf({
      importId: "reconciliation-failure",
      options: { closingBalance: "1,451.00" },
    }));
    assert.equal(store.getTransactionCount(), 0);
    assert.equal(store.getImportHistory().length, 0);
  } finally {
    store.close();
  }
});

test("parameterized queries treat SQL-like account input as data", async () => {
  const { store } = createStore("sql-injection");
  try {
    const parsed = await parseSyntheticPdf({ importId: "query-import" });
    ingest(store, parsed);
    assert.deepEqual(store.getTransactionsByAccount("' OR 1=1 --"), []);
    assert.equal(store.getTransactionCount(), 5);
  } finally {
    store.close();
  }
});
