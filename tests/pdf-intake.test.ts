import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  FinancialFileIntakeError,
  PDF_INTAKE_LIMITS,
  validateLocalPdf,
} from "../lib/financial-files/pdf-intake.ts";
import { analyzeTdChequingPdf } from "../lib/financial-files/td-chequing-pdf-analyzer.ts";

const fixtureRoot = path.resolve("tests/fixtures");
const fixture = (name: string) => path.join(fixtureRoot, name);
const sensitiveMarkers = [
  "SYNTHETIC_PERSON_NAME",
  "123 SYNTHETIC STREET",
  "4111111111111111",
  "SYNTHETIC_ACCOUNT_12345",
  "***REF-A",
  "***REF-B",
];
const markerPattern = (marker: string) => new RegExp(
  marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
);

let scratchRoot: string;

before(async () => {
  scratchRoot = await mkdtemp(path.join(os.tmpdir(), "vorvex-pdf-intake-test-"));
});

after(async () => {
  await rm(scratchRoot, { recursive: true, force: true });
});

const expectSafeError = async (
  operation: Promise<unknown>,
  expectedCode: FinancialFileIntakeError["code"],
) => {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof FinancialFileIntakeError);
    assert.equal(error.code, expectedCode);
    assert.equal(error.message, expectedCode);
    for (const marker of sensitiveMarkers) assert.doesNotMatch(error.message, markerPattern(marker));
    return true;
  });
};

test("accepts a valid PDF, recognizes its signature, and hashes deterministically", async () => {
  const first = await validateLocalPdf({
    sourcePath: fixture("synthetic-td-chequing.pdf"),
    allowedRoot: fixtureRoot,
    intakeTimestamp: "2099-01-01T00:00:00.000Z",
  });
  const second = await validateLocalPdf({
    sourcePath: fixture("synthetic-td-chequing.pdf"),
    allowedRoot: fixtureRoot,
    intakeTimestamp: "2099-01-01T00:00:00.000Z",
  });

  assert.equal(first.metadata.detectedFileType, "application/pdf");
  assert.equal(first.metadata.validationResult, "accepted");
  assert.equal(first.metadata.sha256, second.metadata.sha256);
  assert.notEqual(first.metadata.internalFileId, second.metadata.internalFileId);
  assert.equal(Buffer.from(first.bytes.subarray(0, 5)).toString("ascii"), "%PDF-");
});

test("rejects empty, fake, malformed, oversized, and unsupported files safely", async () => {
  const empty = path.join(scratchRoot, "empty.pdf");
  const fake = path.join(scratchRoot, "fake.pdf");
  const malformed = path.join(scratchRoot, "malformed.pdf");
  const oversized = path.join(scratchRoot, "oversized.pdf");
  const wrongExtension = path.join(scratchRoot, "statement.txt");
  await writeFile(empty, new Uint8Array());
  await writeFile(fake, "not a pdf");
  await writeFile(malformed, "%PDF-1.7\ninvalid structure\n%%EOF");
  const oversizedBytes = Buffer.alloc(PDF_INTAKE_LIMITS.maximumBytes + 1, 0x20);
  oversizedBytes.write("%PDF-", 0, "ascii");
  oversizedBytes.write("%%EOF", oversizedBytes.length - 5, "ascii");
  await writeFile(oversized, oversizedBytes);
  await writeFile(wrongExtension, "%PDF-1.7\n%%EOF");

  await expectSafeError(validateLocalPdf({ sourcePath: empty, allowedRoot: scratchRoot }), "INVALID_PDF");
  await expectSafeError(validateLocalPdf({ sourcePath: fake, allowedRoot: scratchRoot }), "INVALID_PDF");
  await expectSafeError(analyzeTdChequingPdf({ sourcePath: malformed, allowedRoot: scratchRoot }), "INVALID_PDF");
  await expectSafeError(validateLocalPdf({ sourcePath: oversized, allowedRoot: scratchRoot }), "PDF_TOO_LARGE");
  await expectSafeError(validateLocalPdf({ sourcePath: wrongExtension, allowedRoot: scratchRoot }), "UNSUPPORTED_FILE");
});

test("rejects excessive pages and password-protected PDFs with safe codes", async () => {
  await expectSafeError(analyzeTdChequingPdf({
    sourcePath: fixture("synthetic-51-pages.pdf"),
    allowedRoot: fixtureRoot,
  }), "PAGE_LIMIT_EXCEEDED");
  await expectSafeError(analyzeTdChequingPdf({
    sourcePath: fixture("synthetic-password-protected.pdf"),
    allowedRoot: fixtureRoot,
  }), "PASSWORD_PROTECTED");
});

test("rejects symlinks and sources outside the caller-approved root", async () => {
  const link = path.join(scratchRoot, "linked.pdf");
  await symlink(fixture("synthetic-td-chequing.pdf"), link);
  await expectSafeError(validateLocalPdf({ sourcePath: link, allowedRoot: scratchRoot }), "SOURCE_NOT_ALLOWED");
  await expectSafeError(validateLocalPdf({
    sourcePath: fixture("synthetic-td-chequing.pdf"),
    allowedRoot: scratchRoot,
  }), "SOURCE_NOT_ALLOWED");
});

test("detects text-based TD-like structure and emits only constrained evidence", async () => {
  const capturedLogs: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...values: unknown[]) => capturedLogs.push(values.map(String).join(" "));
  console.error = (...values: unknown[]) => capturedLogs.push(values.map(String).join(" "));

  let analysis;
  try {
    analysis = await analyzeTdChequingPdf({
      sourcePath: fixture("synthetic-td-chequing.pdf"),
      allowedRoot: fixtureRoot,
      intakeTimestamp: "2099-01-01T00:00:00.000Z",
    });
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  assert.equal(analysis.status, "recognized");
  assert.equal(analysis.pageCount, 1);
  assert.equal(analysis.textLayerPresent, true);
  assert.equal(analysis.transactionTableDetected, true);
  assert.equal(analysis.transactionTableBoundaryDetected, true);
  assert.equal(analysis.transactionHeaderOccurrenceCount, 1);
  assert.equal(analysis.likelyTransactionRowCount, 5);
  assert.equal(analysis.withdrawalRowCount, 3);
  assert.equal(analysis.depositRowCount, 2);
  assert.equal(analysis.rowsWithRunningBalanceCount, 5);
  assert.equal(analysis.startingBalanceDetected, true);
  assert.equal(analysis.closingBalanceDetected, true);
  assert.equal(analysis.withdrawalTotalDetected, true);
  assert.equal(analysis.depositTotalDetected, true);
  assert.equal(analysis.statementPeriodDetected, true);
  assert.equal(analysis.reconciliationFieldsDetected, true);
  assert.deepEqual(capturedLogs, []);

  const serialized = JSON.stringify(analysis);
  for (const marker of sensitiveMarkers) assert.doesNotMatch(serialized, markerPattern(marker));
  await access(fixture("synthetic-td-chequing.pdf"));
});

test("recognizes real TD extraction shapes without counting lower-page tables", async () => {
  const analysis = await analyzeTdChequingPdf({
    sourcePath: fixture("synthetic-td-chequing-real-layout.pdf"),
    allowedRoot: fixtureRoot,
  });

  assert.equal(analysis.status, "recognized");
  assert.equal(analysis.transactionTableDetected, true);
  assert.equal(analysis.transactionTableBoundaryDetected, true);
  assert.equal(analysis.transactionHeaderOccurrenceCount, 1);
  assert.equal(analysis.statementPeriodDetected, true);
  assert.equal(analysis.likelyTransactionRowCount, 5);
  assert.equal(analysis.withdrawalRowCount, 3);
  assert.equal(analysis.depositRowCount, 2);
  assert.equal(analysis.rowsWithRunningBalanceCount, 3);
  assert.equal(analysis.startingBalanceDetected, true);
  assert.equal(analysis.closingBalanceDetected, true);
  assert.equal(analysis.withdrawalTotalDetected, true);
  assert.equal(analysis.depositTotalDetected, true);
  assert.equal(analysis.reconciliationFieldsDetected, true);

  const serialized = JSON.stringify(analysis);
  for (const marker of sensitiveMarkers) assert.doesNotMatch(serialized, markerPattern(marker));
});

test("reports an image-only PDF without OCR or raw-content propagation", async () => {
  const analysis = await analyzeTdChequingPdf({
    sourcePath: fixture("synthetic-image-only.pdf"),
    allowedRoot: fixtureRoot,
  });

  assert.equal(analysis.status, "image-only");
  assert.equal(analysis.safeReasonCode, "IMAGE_ONLY_PDF");
  assert.equal(analysis.textLayerPresent, false);
  assert.equal(analysis.transactionTableDetected, false);
  assert.equal(analysis.transactionTableBoundaryDetected, false);
  assert.equal(analysis.transactionHeaderOccurrenceCount, 0);
  assert.equal(analysis.likelyTransactionRowCount, 0);
});
