import type { TdCreditCardParsedStatement } from "../../types/financial-files.ts";
import type { DurableImportReceipt } from "../../types/imports.ts";
import { LocalIngestionError, LocalIngestionStore } from "../persistence/local-ingestion-store.ts";
import { normalizeTdCreditCardStatement } from "../transactions/td-credit-card-normalization.ts";

const ensureIsoTimestamp = (value: string) => {
  if (Number.isNaN(Date.parse(value))) throw new LocalIngestionError("IMPORT_CONTEXT_INVALID");
};

export const ingestParsedTdCreditCardStatement = ({
  store,
  parsed,
  accountId,
  receivedAt,
  committedAt,
}: {
  store: LocalIngestionStore;
  parsed: TdCreditCardParsedStatement;
  accountId: string;
  receivedAt: string;
  committedAt: string;
}): DurableImportReceipt => {
  ensureIsoTimestamp(receivedAt);
  ensureIsoTimestamp(committedAt);
  store.assertAccountMapping(accountId, parsed.parser.providerId, parsed.parser.accountType);
  const prepared = normalizeTdCreditCardStatement({ parsed, accountId, receivedAt });
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
    current = store.transitionImport({ importId: current.importId, to: "parsing", timestamp: receivedAt });
  }
  if (current.status === "parsing") {
    current = store.transitionImport({
      importId: current.importId,
      to: "proposed",
      timestamp: receivedAt,
      parsedTransactionCount: prepared.transactions.length,
    });
  }
  if (current.status !== "proposed") throw new LocalIngestionError("IMPORT_INVALID_STATE");
  return store.commitPreparedImport(prepared, committedAt);
};
