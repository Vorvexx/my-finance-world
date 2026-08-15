import { createHash } from "node:crypto";
import { validateLocalPdf } from "../financial-files/pdf-intake.ts";
import { parseTdInvestmentPdf } from "../financial-files/td-investment-pdf-parser.ts";
import type { LocalIngestionStore } from "../persistence/local-ingestion-store.ts";

export const importTdInvestmentStatement = async ({
  sourcePath, approvedRoot, accountId, expectedAccountType, store, recordedAt,
}: {
  sourcePath: string;
  approvedRoot: string;
  accountId: string;
  expectedAccountType: "tfsa" | "rrsp";
  store: LocalIngestionStore;
  recordedAt: string;
}) => {
  const source = await validateLocalPdf({ sourcePath, allowedRoot: approvedRoot, intakeTimestamp: recordedAt });
  const parsed = await parseTdInvestmentPdf(source);
  if (parsed.accountType !== expectedAccountType) throw new Error("TD_INVESTMENT_ACCOUNT_MISMATCH");
  const id = `investment-snapshot:${createHash("sha256").update(JSON.stringify([
    accountId, parsed.providerId, parsed.accountType, parsed.statementPeriodStart, parsed.statementPeriodEnd, parsed.sourceSha256,
  ])).digest("hex")}`;
  return store.saveInvestmentSnapshot({ ...parsed, id, accountId, recordedAt });
};
