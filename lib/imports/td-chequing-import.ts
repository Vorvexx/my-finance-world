import type { TdChequingParsedStatement } from "../../types/financial-files.ts";
import type { DurableImportReceipt, PreparedTdChequingImport } from "../../types/imports.ts";
import {
  LocalIngestionError,
  LocalIngestionStore,
} from "../persistence/local-ingestion-store.ts";
import { normalizeTdChequingStatement } from "../transactions/td-chequing-normalization.ts";

const ensureIsoTimestamp = (value: string) => {
  if (Number.isNaN(Date.parse(value))) throw new LocalIngestionError("IMPORT_CONTEXT_INVALID");
};

export const ingestParsedTdChequingStatement = ({
  store,
  parsed,
  accountId,
  receivedAt,
  committedAt,
}: {
  store: LocalIngestionStore;
  parsed: TdChequingParsedStatement;
  accountId: string;
  receivedAt: string;
  committedAt: string;
}): DurableImportReceipt => {
  ensureIsoTimestamp(receivedAt);
  ensureIsoTimestamp(committedAt);
  store.assertAccountMapping(accountId, parsed.parser.providerId, parsed.parser.accountType);
  const prepared = normalizeTdChequingStatement({ parsed, accountId, receivedAt });

  const existing = store.getImportStatus(prepared.journal.importId);
  if (existing && ["committed", "duplicate"].includes(existing.status)) {
    const receipt = store.getReceipt(existing.importId);
    if (!receipt) throw new LocalIngestionError("IMPORT_INVALID_STATE");
    return receipt;
  }
  if (existing && ["rejected", "quarantined"].includes(existing.status)) {
    throw new LocalIngestionError("IMPORT_INVALID_STATE");
  }

  if (!existing && store.findCommittedFileDuplicate(prepared.journal)) {
    return store.markFileDuplicate(prepared.journal, committedAt);
  }

  let current = store.createReceivedImport(prepared.journal);
  if (current.status === "received") {
    current = store.transitionImport({
      importId: current.importId,
      to: "parsing",
      timestamp: receivedAt,
    });
  }
  if (current.status === "parsing") {
    current = store.transitionImport({
      importId: current.importId,
      to: "proposed",
      timestamp: receivedAt,
      parsedTransactionCount: prepared.transactions.length,
    });
  }
  if (current.status !== "proposed") {
    throw new LocalIngestionError("IMPORT_INVALID_STATE");
  }
  return store.commitPreparedImport(prepared, committedAt);
};

export const rejectPreparedTdChequingImport = ({
  store,
  prepared,
  safeErrorCode,
  rejectedAt,
}: {
  store: LocalIngestionStore;
  prepared: PreparedTdChequingImport;
  safeErrorCode: string;
  rejectedAt: string;
}): DurableImportReceipt => {
  let current = store.createReceivedImport(prepared.journal);
  if (!["received", "parsing", "proposed"].includes(current.status)) {
    throw new LocalIngestionError("IMPORT_INVALID_STATE");
  }
  current = store.transitionImport({
    importId: current.importId,
    to: "rejected",
    timestamp: rejectedAt,
    parsedTransactionCount: prepared.transactions.length,
    safeErrorCode,
  });
  const receipt = store.getReceipt(current.importId);
  if (!receipt) throw new LocalIngestionError("IMPORT_INVALID_STATE");
  return receipt;
};
