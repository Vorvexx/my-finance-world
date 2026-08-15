import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { validateLocalPdf } from "../lib/financial-files/pdf-intake.ts";
import { parseTdCreditCardPdf } from "../lib/financial-files/td-credit-card-pdf-parser.ts";
import { ingestParsedTdCreditCardStatement } from "../lib/imports/td-credit-card-import.ts";
import { LocalIngestionError, LocalIngestionStore } from "../lib/persistence/local-ingestion-store.ts";
import { TD_CREDIT_CARD_FINGERPRINT_VERSION } from "../lib/transactions/td-credit-card-normalization.ts";
import type { FinancialAccount } from "../types/finance.ts";
import { buildSyntheticTdCreditCardPdf } from "./helpers/synthetic-td-credit-card-pdf.ts";

const RECEIVED_AT = "2099-08-04T12:00:00.000Z";
const COMMITTED_AT = "2099-08-04T12:00:01.000Z";
const ACCOUNT: FinancialAccount = {
  id: "synthetic-credit-card-account",
  name: "Synthetic Credit Card",
  institution: "TD Canada Trust",
  balance: 0,
  type: "liability",
  group: "debts",
  updatedAt: RECEIVED_AT,
};

const withFixture = async <T>(run: (context: {
  root: string;
  databasePath: string;
  store: LocalIngestionStore;
  parse: (importId: string, bytes?: Uint8Array) => Promise<Awaited<ReturnType<typeof parseTdCreditCardPdf>>>;
}) => Promise<T>) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "vorvex-card-ingestion-"));
  const databasePath = path.join(root, "ingestion.sqlite");
  const key = randomBytes(32);
  const store = new LocalIngestionStore({ databasePath, encryptionKey: key });
  store.registerCanonicalAccount({ account: ACCOUNT, providerId: "td", accountType: "credit-card", registeredAt: RECEIVED_AT });
  let sequence = 0;
  const parse = async (importId: string, bytes = buildSyntheticTdCreditCardPdf()) => {
    const sourcePath = path.join(root, `statement-${sequence += 1}.pdf`);
    await writeFile(sourcePath, bytes);
    const source = await validateLocalPdf({ sourcePath, allowedRoot: root, intakeTimestamp: RECEIVED_AT });
    try {
      return await parseTdCreditCardPdf({ source, importContext: { importId } });
    } finally {
      source.bytes.fill(0);
    }
  };
  try {
    return await run({ root, databasePath, store, parse });
  } finally {
    store.close();
    key.fill(0);
    await rm(root, { recursive: true, force: true });
  }
};

test("normalizes liability activity and atomically persists encrypted statement facts", async () => {
  await withFixture(async ({ databasePath, store, parse }) => {
    const parsed = await parse("card-first");
    const receipt = ingestParsedTdCreditCardStatement({
      store, parsed, accountId: ACCOUNT.id, receivedAt: RECEIVED_AT, committedAt: COMMITTED_AT,
    });
    assert.equal(receipt.status, "committed");
    assert.equal(receipt.transactionCount, 6);
    const transactions = store.getTransactionsByImport("card-first");
    assert.equal(transactions.length, 6);
    assert.ok(transactions.every((transaction) => transaction.postedDate !== null));
    assert.ok(transactions.every((transaction) => transaction.provenance.fingerprint.version === TD_CREDIT_CARD_FINGERPRINT_VERSION));
    assert.deepEqual(new Set(transactions.map((transaction) => transaction.financialMeaning)), new Set([
      "credit-card-purchase", "credit-card-payment", "refund", "interest", "fee",
    ]));
    assert.ok(transactions.filter((transaction) => transaction.financialMeaning === "credit-card-purchase").every((transaction) => transaction.direction === "outflow"));
    assert.ok(transactions.filter((transaction) => ["credit-card-payment", "refund"].includes(transaction.financialMeaning)).every((transaction) => transaction.direction === "inflow"));
    const facts = store.getStatementFactsByImport("card-first");
    assert.ok(facts);
    assert.equal(facts.accountId, ACCOUNT.id);
    assert.equal(facts.paymentDueDate, parsed.paymentDueDate);
    assert.equal(facts.minimumPaymentCents, parsed.minimumPaymentCents);
    const rawDatabase = await readFile(databasePath);
    assert.equal(rawDatabase.includes(Buffer.from("SYNTHETIC PURCHASE ALPHA")), false);
    assert.equal(rawDatabase.includes(Buffer.from(String(parsed.minimumPaymentCents))), false);
  });
});

test("deduplicates renamed and overlapping credit-card statements", async () => {
  await withFixture(async ({ store, parse }) => {
    const bytes = buildSyntheticTdCreditCardPdf();
    const first = await parse("card-dedup-first", bytes);
    const renamed = await parse("card-dedup-renamed", bytes);
    const ingest = (parsed: Awaited<ReturnType<typeof parseTdCreditCardPdf>>) => ingestParsedTdCreditCardStatement({
      store, parsed, accountId: ACCOUNT.id, receivedAt: RECEIVED_AT, committedAt: COMMITTED_AT,
    });
    assert.equal(ingest(first).status, "committed");
    assert.equal(ingest(renamed).status, "duplicate");
    const alternateBytes = Buffer.from(bytes);
    const harmlessOffset = alternateBytes.indexOf(Buffer.from("SPECIAL OFFERS", "latin1"));
    assert.ok(harmlessOffset >= 0);
    alternateBytes.set(Buffer.from("SPECIAL NOTICE", "latin1"), harmlessOffset);
    const overlapping = await parse("card-dedup-overlap", alternateBytes);
    const overlapReceipt = ingest(overlapping);
    assert.equal(overlapReceipt.status, "committed");
    assert.equal(overlapReceipt.transactionCount, 0);
    assert.equal(overlapReceipt.duplicateCount, 6);
    assert.equal(store.getTransactionCount(), 6);
  });
});

test("requires an explicit compatible TD liability account mapping", async () => {
  const key = randomBytes(32);
  const store = new LocalIngestionStore({ databasePath: ":memory:", encryptionKey: key });
  try {
    assert.throws(() => store.registerCanonicalAccount({
      account: { ...ACCOUNT, type: "asset", group: "cash" },
      providerId: "td",
      accountType: "credit-card",
      registeredAt: RECEIVED_AT,
    }), (error: unknown) => error instanceof LocalIngestionError && error.code === "IMPORT_ACCOUNT_INCOMPATIBLE");
  } finally {
    store.close();
    key.fill(0);
  }
});
