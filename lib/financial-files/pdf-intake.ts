import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import type {
  FinancialFileErrorCode,
  ValidatedPdfMetadata,
} from "../../types/financial-files.ts";

export const PDF_INTAKE_LIMITS = Object.freeze({
  maximumBytes: 10 * 1024 * 1024,
  maximumPages: 50,
  maximumTextItems: 25_000,
  maximumExtractedCharacters: 500_000,
  parserTimeoutMilliseconds: 5_000,
});

export class FinancialFileIntakeError extends Error {
  readonly code: FinancialFileErrorCode;

  constructor(code: FinancialFileErrorCode) {
    super(code);
    this.name = "FinancialFileIntakeError";
    this.code = code;
  }
}

export type ValidatedPdfSource = {
  metadata: ValidatedPdfMetadata;
  bytes: Uint8Array;
};

const isWithinRoot = (candidate: string, root: string) =>
  candidate.startsWith(`${root}${path.sep}`);

const hasPdfSignature = (bytes: Uint8Array) =>
  bytes.length >= 5 && Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-";

const hasPdfEndMarker = (bytes: Uint8Array) => {
  const tail = Buffer.from(bytes.subarray(Math.max(0, bytes.length - 1_024))).toString("latin1");
  return tail.includes("%%EOF");
};

export const validateLocalPdf = async ({
  sourcePath,
  allowedRoot,
  intakeTimestamp = new Date().toISOString(),
}: {
  sourcePath: string;
  allowedRoot: string;
  intakeTimestamp?: string;
}): Promise<ValidatedPdfSource> => {
  if (path.extname(sourcePath).toLowerCase() !== ".pdf") {
    throw new FinancialFileIntakeError("UNSUPPORTED_FILE");
  }

  let sourceRealPath: string;
  let allowedRootRealPath: string;
  try {
    const sourceInfo = await lstat(sourcePath);
    if (sourceInfo.isSymbolicLink() || !sourceInfo.isFile()) {
      throw new FinancialFileIntakeError("SOURCE_NOT_ALLOWED");
    }
    [sourceRealPath, allowedRootRealPath] = await Promise.all([
      realpath(sourcePath),
      realpath(allowedRoot),
    ]);
  } catch (error) {
    if (error instanceof FinancialFileIntakeError) throw error;
    throw new FinancialFileIntakeError("SOURCE_NOT_ALLOWED");
  }

  if (!isWithinRoot(sourceRealPath, allowedRootRealPath)) {
    throw new FinancialFileIntakeError("SOURCE_NOT_ALLOWED");
  }

  const noFollow = "O_NOFOLLOW" in constants ? constants.O_NOFOLLOW : 0;
  let handle;
  try {
    handle = await open(sourceRealPath, constants.O_RDONLY | noFollow);
    const sourceInfo = await handle.stat();
    if (!sourceInfo.isFile()) throw new FinancialFileIntakeError("SOURCE_NOT_ALLOWED");
    if (sourceInfo.size === 0) throw new FinancialFileIntakeError("INVALID_PDF");
    if (sourceInfo.size > PDF_INTAKE_LIMITS.maximumBytes) {
      throw new FinancialFileIntakeError("PDF_TOO_LARGE");
    }

    const bytes = new Uint8Array(await handle.readFile());
    if (bytes.byteLength > PDF_INTAKE_LIMITS.maximumBytes) {
      throw new FinancialFileIntakeError("PDF_TOO_LARGE");
    }
    if (!hasPdfSignature(bytes) || !hasPdfEndMarker(bytes)) {
      throw new FinancialFileIntakeError("INVALID_PDF");
    }

    return {
      metadata: {
        internalFileId: randomUUID(),
        byteSize: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        detectedFileType: "application/pdf",
        intakeTimestamp,
        validationResult: "accepted",
        status: "validated",
      },
      bytes,
    };
  } catch (error) {
    if (error instanceof FinancialFileIntakeError) throw error;
    throw new FinancialFileIntakeError("SOURCE_NOT_ALLOWED");
  } finally {
    await handle?.close();
  }
};
