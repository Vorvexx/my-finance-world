import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { access, chmod, mkdtemp, mkdir, realpath, rm, symlink, writeFile, appendFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { LocalIngestionStore } from "../lib/persistence/local-ingestion-store.ts";
import {
  StatementFolderConfigError,
  validateStatementFolder,
} from "../lib/statement-folder/config.ts";
import { StatementFolderWorker } from "../lib/statement-folder/worker.ts";
import { validateLocalPdf } from "../lib/financial-files/pdf-intake.ts";
import { parseTdChequingPdf } from "../lib/financial-files/td-chequing-pdf-parser.ts";
import { normalizeTdChequingStatement } from "../lib/transactions/td-chequing-normalization.ts";
import type { FinancialAccount } from "../types/finance.ts";
import type { CanonicalTransaction } from "../types/transactions.ts";
import { buildSyntheticTdPdf } from "./helpers/synthetic-td-pdf.ts";
import { buildSyntheticTdCreditCardPdf } from "./helpers/synthetic-td-credit-card-pdf.ts";
import { LOCAL_INGESTION_SCHEMA_VERSION } from "../lib/transactions/td-chequing-normalization.ts";

const ACCOUNT: FinancialAccount = {
  id: "synthetic-worker-account",
  name: "Synthetic TD Chequing",
  institution: "TD Canada Trust",
  balance: 0,
  type: "asset",
  group: "cash",
  updatedAt: "2099-08-01T00:00:00.000Z",
};
const CREDIT_CARD_ACCOUNT: FinancialAccount = {
  id: "synthetic-worker-credit-card-account",
  name: "Synthetic TD Credit Card",
  institution: "TD Canada Trust",
  balance: 0,
  type: "liability",
  group: "debts",
  updatedAt: "2099-08-01T00:00:00.000Z",
};

const exists = async (filePath: string) => access(filePath).then(() => true, () => false);
const eventually = async (predicate: () => boolean | Promise<boolean>, timeout = 2_000) => {
  const started = Date.now();
  while (!(await predicate())) {
    if (Date.now() - started > timeout) throw new Error("TEST_WAIT_TIMEOUT");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

const fixture = async ({
  registerAccount = true, relationshipProcessor,
}: {
  registerAccount?: boolean;
  relationshipProcessor?: { evaluate: (transactions: readonly CanonicalTransaction[], evaluatedAt: string) => void };
} = {}) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "vorvex-folder-worker-"));
  const folderPath = path.join(root, "Vorvex Bank Statements");
  await mkdir(folderPath, { mode: 0o700 });
  const key = randomBytes(32);
  const store = new LocalIngestionStore({ databasePath: path.join(root, "state", "ingestion.sqlite"), encryptionKey: key });
  if (registerAccount) {
    store.registerCanonicalAccount({
      account: ACCOUNT,
      providerId: "td",
      accountType: "chequing",
      registeredAt: ACCOUNT.updatedAt,
    });
    store.registerCanonicalAccount({
      account: CREDIT_CARD_ACCOUNT,
      providerId: "td",
      accountType: "credit-card",
      registeredAt: CREDIT_CARD_ACCOUNT.updatedAt,
    });
  }
  const worker = new StatementFolderWorker({
    config: { folderPath, approvedRoot: root },
    store,
    accountMappings: {
      "td-chequing": ACCOUNT.id,
      "td-credit-card": CREDIT_CARD_ACCOUNT.id,
    },
    stabilityIntervalMilliseconds: 20,
    reconciliationIntervalMilliseconds: 40,
    relationshipProcessor,
  });
  return {
    root,
    folderPath,
    key,
    store,
    worker,
    async cleanup() {
      await worker.stop();
      store.close();
      key.fill(0);
      await rm(root, { recursive: true, force: true });
    },
  };
};

test("invokes canonical relationship evaluation after a durable import", async () => {
  const evaluations: Array<{ count: number; evaluatedAt: string }> = [];
  const context = await fixture({ relationshipProcessor: {
    evaluate: (transactions, evaluatedAt) => evaluations.push({ count: transactions.length, evaluatedAt }),
  } });
  try {
    await writeFile(path.join(context.folderPath, "relationship-source.pdf"), buildSyntheticTdPdf());
    const [result] = await context.worker.scanNow();
    assert.equal(result.status, "imported");
    assert.equal(evaluations.length, 1);
    assert.equal(evaluations[0].count, context.store.getTransactionCount());
    assert.equal(Number.isNaN(Date.parse(evaluations[0].evaluatedAt)), false);
  } finally { await context.cleanup(); }
});

test("retains a committed source for safe retry when relationship evaluation fails", async () => {
  const context = await fixture({ relationshipProcessor: { evaluate: () => { throw new Error("synthetic failure"); } } });
  const sourcePath = path.join(context.folderPath, "relationship-retry.pdf");
  try {
    await writeFile(sourcePath, buildSyntheticTdPdf());
    const [result] = await context.worker.scanNow();
    assert.equal(result.status, "needs-attention");
    assert.equal(result.safeReasonCode, "RELATIONSHIP_EVALUATION_FAILED");
    assert.equal(await exists(sourcePath), true);
    assert.ok(context.store.getTransactionCount() > 0);
  } finally { await context.cleanup(); }
});

test("validates the configured private folder boundary", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "vorvex-folder-config-"));
  try {
    const missing = path.join(root, "missing");
    await assert.rejects(
      validateStatementFolder({ folderPath: missing, approvedRoot: root }),
      (error: unknown) => error instanceof StatementFolderConfigError && error.code === "STATEMENT_FOLDER_MISSING",
    );
    const unsafe = path.join(root, "unsafe");
    await mkdir(unsafe, { mode: 0o755 });
    const linked = path.join(root, "linked");
    await symlink(unsafe, linked);
    await assert.rejects(
      validateStatementFolder({ folderPath: linked, approvedRoot: root }),
      (error: unknown) => error instanceof StatementFolderConfigError && error.code === "STATEMENT_FOLDER_SYMLINK_PROHIBITED",
    );
    await chmod(unsafe, 0o755);
    await assert.rejects(
      validateStatementFolder({ folderPath: unsafe, approvedRoot: root }),
      (error: unknown) => error instanceof StatementFolderConfigError && error.code === "STATEMENT_FOLDER_PERMISSIONS_UNSAFE",
    );
    await chmod(unsafe, 0o700);
    assert.equal(
      (await validateStatementFolder({ folderPath: unsafe, approvedRoot: root })).folderPath,
      await realpath(unsafe),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("migrates an Action 8 schema to durable safe folder results", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "vorvex-folder-migration-"));
  const databasePath = path.join(root, "ingestion.sqlite");
  const legacy = new DatabaseSync(databasePath);
  legacy.exec("PRAGMA user_version = 1");
  legacy.close();
  const key = randomBytes(32);
  try {
    const store = new LocalIngestionStore({ databasePath, encryptionKey: key });
    assert.equal(store.schemaVersion, LOCAL_INGESTION_SCHEMA_VERSION);
    assert.deepEqual(store.getStatementFolderResults(), []);
    store.close();
  } finally {
    key.fill(0);
    await rm(root, { recursive: true, force: true });
  }
});

test("routes chequing and credit-card PDFs independently through one worker", async () => {
  const context = await fixture();
  try {
    const chequingPath = path.join(context.folderPath, "a-chequing.pdf");
    const cardPath = path.join(context.folderPath, "b-credit-card.pdf");
    await writeFile(chequingPath, buildSyntheticTdPdf());
    await writeFile(cardPath, buildSyntheticTdCreditCardPdf());
    const results = await context.worker.scanNow();
    assert.deepEqual(
      results.map((result) => [result.routeId, result.status]).sort(),
      [["td-chequing", "imported"], ["td-credit-card", "imported"]],
    );
    assert.equal(context.store.getTransactionsByAccount(ACCOUNT.id).length, 5);
    assert.equal(context.store.getTransactionsByAccount(CREDIT_CARD_ACCOUNT.id).length, 6);
    assert.equal(context.store.getStatementFactsByAccount(CREDIT_CARD_ACCOUNT.id).length, 1);
    assert.equal(await exists(chequingPath), false);
    assert.equal(await exists(cardPath), false);
  } finally {
    await context.cleanup();
  }
});

test("scans only the explicit inbox, approved immediate children, and never deeper or sideways", async () => {
  const context = await fixture();
  const sibling = path.join(context.root, "Founder archive");
  const approved = path.join(context.folderPath, "TD Chequing");
  const nested = path.join(approved, "nested");
  const siblingSource = path.join(sibling, "statement.pdf");
  const approvedSource = path.join(approved, "statement.pdf");
  const nestedSource = path.join(nested, "statement.pdf");
  try {
    await mkdir(sibling, { mode: 0o700 });
    await mkdir(approved, { mode: 0o700 });
    await mkdir(nested, { mode: 0o700 });
    await writeFile(siblingSource, buildSyntheticTdPdf());
    await writeFile(approvedSource, buildSyntheticTdPdf());
    await writeFile(nestedSource, buildSyntheticTdPdf());
    const results = await context.worker.scanNow();
    assert.equal(results.length, 1);
    assert.equal(results[0].status, "imported");
    assert.ok(context.store.getTransactionCount() > 0);
    assert.equal(await exists(siblingSource), true);
    assert.equal(await exists(approvedSource), true);
    assert.equal(await exists(nestedSource), true);
  } finally { await context.cleanup(); }
});

test("batch-imports multiple historical statements for both supported TD sources", async () => {
  const context = await fixture();
  try {
    const juneChequing = buildSyntheticTdPdf({ period: "May 31 - Jun 30, 2099", rows: [
      { descriptionBlocks: ["SYNTHETIC PAY", "SPLIT"], deposit: "1,000.00", date: "JUN1", balance: "2,000.00" },
      { descriptionBlocks: ["SYNTHETIC PURCHASE"], withdrawal: "300.00", date: "JUN2", balance: "1,700.00" },
      { descriptionBlocks: ["SEND E-TFR", "***REF-A"], withdrawal: "200.00", date: "JUN2" },
      { descriptionBlocks: ["SEND E-TFR", "***REF-B"], withdrawal: "100.00", date: "JUN2" },
      { descriptionBlocks: ["SYNTHETIC REBATE"], deposit: "50.00", date: "JUN3", balance: "1,450.00" },
    ] });
    const juneCard = buildSyntheticTdCreditCardPdf({
      statementDate: "July 04, 2099", statementPeriod: "June 07, 2099 to July 04, 2099", paymentDueDate: "July 25, 2099",
      rowsByStatementPage: {
        1: [
          { transactionDate: "JUN 8", postingDate: "JUN 9", description: "SYNTHETIC PURCHASE ALPHA", amount: "$100.00" },
          { transactionDate: "JUN 8", postingDate: "JUN 9", description: "SYNTHETIC PURCHASE BETA", amount: "$50.00" },
        ],
        3: [
          { transactionDate: "JUN 10", postingDate: "JUN 11", description: "PREAUTHORIZED PAYMENT", amount: "-$200.00" },
          { transactionDate: "JUN 12", postingDate: "JUN 13", description: "SYNTHETIC MERCHANT REFUND", amount: "-$30.00" },
          { transactionDate: "JUN 14", postingDate: "JUN 15", description: "INTEREST CHARGE", amount: "$10.00" },
        ],
        4: [{ transactionDate: "JUL 4", postingDate: "JUL 4", description: "ANNUAL FEE", amount: "$20.00" }],
      },
    });
    const sources = [
      ["june-chequing.pdf", juneChequing], ["july-chequing.pdf", buildSyntheticTdPdf()],
      ["june-card.pdf", juneCard], ["july-card.pdf", buildSyntheticTdCreditCardPdf()],
    ] as const;
    await Promise.all(sources.map(([name, bytes]) => writeFile(path.join(context.folderPath, name), bytes)));
    const results = await context.worker.scanNow();
    assert.equal(results.length, 4);
    assert.equal(results.every((result) => result.status === "imported"), true);
    assert.equal(context.store.getTransactionsByAccount(ACCOUNT.id).length, 10);
    assert.equal(context.store.getTransactionsByAccount(CREDIT_CARD_ACCOUNT.id).length, 12);
    assert.equal(context.store.getStatementFactsByAccount(CREDIT_CARD_ACCOUNT.id).length, 2);
    const dates = [
      ...context.store.getTransactionsByAccount(ACCOUNT.id),
      ...context.store.getTransactionsByAccount(CREDIT_CARD_ACCOUNT.id),
    ].map((item) => item.transactionDate).sort();
    assert.equal(dates[0], "2099-06-01");
    assert.equal(dates.at(-1), "2099-08-04");
  } finally { await context.cleanup(); }
});

test("detects, classifies, imports, persists, and deletes one stable TD PDF", async () => {
  const context = await fixture();
  try {
    const sourcePath = path.join(context.folderPath, "statement.pdf");
    await writeFile(sourcePath, buildSyntheticTdPdf());
    const [result] = await context.worker.scanNow();
    assert.equal(result.status, "imported");
    assert.equal(result.routeId, "td-chequing");
    assert.equal(result.providerId, "td");
    assert.equal(result.accountType, "chequing");
    assert.equal(result.transactionCount, 5);
    assert.equal(await exists(sourcePath), false);
    assert.equal(context.store.getTransactionCount(), 5);
    assert.deepEqual(Object.keys(result).sort(), [
      "accountType", "duplicateCount", "importId", "processedAt", "providerId", "resultId",
      "routeId", "safeReasonCode", "status", "transactionCount",
    ]);
    assert.equal(JSON.stringify(result).includes(ACCOUNT.id), false);
    assert.equal(JSON.stringify(result).includes(sourcePath), false);
    assert.equal(JSON.stringify(result).includes("SYNTHETIC PAY"), false);
  } finally {
    await context.cleanup();
  }
});

test("continued detection waits for a chunked file to become stable", async () => {
  const context = await fixture();
  try {
    await context.worker.start();
    const sourcePath = path.join(context.folderPath, "chunked.pdf");
    const bytes = buildSyntheticTdPdf();
    await writeFile(sourcePath, bytes.subarray(0, Math.floor(bytes.length / 2)));
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.equal(await exists(sourcePath), true);
    await appendFile(sourcePath, bytes.subarray(Math.floor(bytes.length / 2)));
    await eventually(async () => context.store.getTransactionCount() === 5 && !(await exists(sourcePath)));
  } finally {
    await context.cleanup();
  }
});

test("reports unsupported and malformed files safely and retains them", async () => {
  const context = await fixture();
  try {
    const textPath = path.join(context.folderPath, "notes.txt");
    const malformedPath = path.join(context.folderPath, "malformed.pdf");
    const unsupportedPath = path.join(context.folderPath, "unsupported.pdf");
    const parserRejectedPath = path.join(context.folderPath, "ambiguous-period.pdf");
    await writeFile(textPath, "not financial data");
    await writeFile(malformedPath, "%PDF-not-complete");
    await writeFile(unsupportedPath, buildSyntheticTdPdf({ includeTdMarker: false }));
    await writeFile(parserRejectedPath, buildSyntheticTdPdf({ period: "Jun 30 - Jul 31, 2099 and Jun 30 - Jul 31, 2099" }));
    const results = await context.worker.scanNow();
    assert.equal(results.length, 4);
    assert.ok(results.some((result) => result.status === "unsupported" && result.safeReasonCode === "UNSUPPORTED_FILE"));
    assert.ok(results.some((result) => result.status === "unsupported" && result.safeReasonCode === "STATEMENT_UNSUPPORTED"));
    assert.ok(results.some((result) => result.status === "rejected" && result.safeReasonCode === "INVALID_PDF"));
    assert.ok(results.some((result) => result.status === "rejected" && result.safeReasonCode === "TD_CHEQUING_STATEMENT_PERIOD_INVALID"));
    assert.equal(await exists(textPath), true);
    assert.equal(await exists(malformedPath), true);
    assert.equal(await exists(unsupportedPath), true);
    assert.equal(await exists(parserRejectedPath), true);
    assert.equal(context.store.getTransactionCount(), 0);
  } finally {
    await context.cleanup();
  }
});

test("retains a supported file when its approved account mapping is missing", async () => {
  const context = await fixture({ registerAccount: false });
  try {
    const sourcePath = path.join(context.folderPath, "statement.pdf");
    await writeFile(sourcePath, buildSyntheticTdPdf());
    const [result] = await context.worker.scanNow();
    assert.equal(result.status, "needs-attention");
    assert.equal(result.safeReasonCode, "IMPORT_ACCOUNT_NOT_FOUND");
    assert.equal(await exists(sourcePath), true);
    assert.equal(context.store.getTransactionCount(), 0);
  } finally {
    await context.cleanup();
  }
});

test("recognizes renamed file duplicates, preserves one ledger, and deletes both sources", async () => {
  const context = await fixture();
  try {
    const bytes = buildSyntheticTdPdf();
    const first = path.join(context.folderPath, "first.pdf");
    await writeFile(first, bytes);
    assert.equal((await context.worker.scanNow())[0].status, "imported");
    const renamed = path.join(context.folderPath, "renamed.pdf");
    await writeFile(renamed, bytes);
    const [duplicate] = await context.worker.scanNow();
    assert.equal(duplicate.status, "duplicate");
    assert.equal(duplicate.duplicateCount, 5);
    assert.equal(context.store.getTransactionCount(), 5);
    assert.equal(await exists(first), false);
    assert.equal(await exists(renamed), false);
  } finally {
    await context.cleanup();
  }
});

test("recovers a stale proposed import after restart and removes the lingering source", async () => {
  const context = await fixture();
  try {
    const sourcePath = path.join(context.folderPath, "recover.pdf");
    await writeFile(sourcePath, buildSyntheticTdPdf());
    const source = await validateLocalPdf({ sourcePath, allowedRoot: context.folderPath });
    const parsed = await parseTdChequingPdf({ source, importContext: { importId: "stale-folder-import" } });
    source.bytes.fill(0);
    const prepared = normalizeTdChequingStatement({ parsed, accountId: ACCOUNT.id, receivedAt: parsed.source.intakeTimestamp });
    context.store.createReceivedImport(prepared.journal);
    context.store.transitionImport({ importId: prepared.journal.importId, to: "parsing", timestamp: parsed.source.intakeTimestamp });
    context.store.transitionImport({
      importId: prepared.journal.importId,
      to: "proposed",
      timestamp: parsed.source.intakeTimestamp,
      parsedTransactionCount: prepared.transactions.length,
    });
    const [result] = await context.worker.scanNow();
    assert.equal(result.status, "imported");
    assert.equal(result.importId, "stale-folder-import");
    assert.equal(context.store.getTransactionCount(), 5);
    assert.equal(await exists(sourcePath), false);
  } finally {
    await context.cleanup();
  }
});

test("a lingering committed source becomes a safe duplicate after restart", async () => {
  const context = await fixture();
  try {
    const sourcePath = path.join(context.folderPath, "lingering.pdf");
    await writeFile(sourcePath, buildSyntheticTdPdf());
    const source = await validateLocalPdf({ sourcePath, allowedRoot: context.folderPath });
    const parsed = await parseTdChequingPdf({ source, importContext: { importId: "already-committed" } });
    source.bytes.fill(0);
    const { ingestParsedTdChequingStatement } = await import("../lib/imports/td-chequing-import.ts");
    ingestParsedTdChequingStatement({
      store: context.store,
      parsed,
      accountId: ACCOUNT.id,
      receivedAt: parsed.source.intakeTimestamp,
      committedAt: new Date().toISOString(),
    });
    const [result] = await context.worker.scanNow();
    assert.equal(result.status, "duplicate");
    assert.equal(context.store.getTransactionCount(), 5);
    assert.equal(await exists(sourcePath), false);
  } finally {
    await context.cleanup();
  }
});

test("duplicate events and worker instances cannot process one file concurrently", async () => {
  const context = await fixture();
  const secondWorker = new StatementFolderWorker({
    config: { folderPath: context.folderPath, approvedRoot: context.root },
    store: context.store,
    accountMappings: { "td-chequing": ACCOUNT.id },
    stabilityIntervalMilliseconds: 20,
  });
  try {
    await writeFile(path.join(context.folderPath, "one.pdf"), buildSyntheticTdPdf());
    const batches = await Promise.all([
      context.worker.scanNow(),
      context.worker.scanNow(),
      secondWorker.scanNow(),
    ]);
    assert.equal(batches.flat().filter((result) => result.status === "imported").length, 1);
    assert.equal(context.store.getTransactionCount(), 5);
  } finally {
    await secondWorker.stop();
    await context.cleanup();
  }
});

test("one bad file does not block a valid file and safe history survives reopen", async () => {
  const context = await fixture();
  try {
    const bad = path.join(context.folderPath, "a-bad.pdf");
    const good = path.join(context.folderPath, "b-good.pdf");
    await writeFile(bad, "%PDF-bad");
    await writeFile(good, buildSyntheticTdPdf());
    const results = await context.worker.scanNow();
    assert.ok(results.some((result) => result.status === "rejected"));
    assert.ok(results.some((result) => result.status === "imported"));
    assert.equal(await exists(bad), true);
    assert.equal(await exists(good), false);
    const history = context.worker.getSafeStatusHistory();
    assert.ok(history.length >= 2);
    assert.equal(JSON.stringify(history).includes(context.folderPath), false);
    assert.equal(JSON.stringify(history).includes(ACCOUNT.id), false);
    await context.worker.stop();
    context.store.close();
    const reopened = new LocalIngestionStore({
      databasePath: path.join(context.root, "state", "ingestion.sqlite"),
      encryptionKey: context.key,
    });
    assert.equal(reopened.getStatementFolderResults().length, history.length);
    reopened.close();
  } finally {
    await context.cleanup();
  }
});

test("persistence failure never deletes the source", async () => {
  const context = await fixture();
  try {
    const sourcePath = path.join(context.folderPath, "statement.pdf");
    await writeFile(sourcePath, buildSyntheticTdPdf());
    context.store.close();
    await assert.rejects(context.worker.scanNow());
    assert.equal(await exists(sourcePath), true);
  } finally {
    context.key.fill(0);
    await rm(context.root, { recursive: true, force: true });
  }
});
