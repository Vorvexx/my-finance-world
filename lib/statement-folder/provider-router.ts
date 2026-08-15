import type { ValidatedPdfSource } from "../financial-files/pdf-intake.ts";
import { analyzeValidatedTdChequingPdf } from "../financial-files/td-chequing-pdf-analyzer.ts";
import { parseTdChequingPdf } from "../financial-files/td-chequing-pdf-parser.ts";
import { analyzeValidatedTdCreditCardPdf } from "../financial-files/td-credit-card-pdf-analyzer.ts";
import { parseTdCreditCardPdf } from "../financial-files/td-credit-card-pdf-parser.ts";
import { ingestParsedTdChequingStatement } from "../imports/td-chequing-import.ts";
import { ingestParsedTdCreditCardStatement } from "../imports/td-credit-card-import.ts";
import type { LocalIngestionStore } from "../persistence/local-ingestion-store.ts";
import type { StatementRouteId } from "../../types/drop-folder.ts";
import type { DurableImportReceipt } from "../../types/imports.ts";

export type StatementRouteImportRequest = {
  source: ValidatedPdfSource;
  importId: string;
  accountId: string;
  store: LocalIngestionStore;
  committedAt: string;
};

export type StatementRoute = {
  id: StatementRouteId;
  providerId: "td";
  accountType: "chequing" | "credit-card";
  recognizes(source: ValidatedPdfSource): Promise<boolean>;
  importStatement(request: StatementRouteImportRequest): Promise<DurableImportReceipt>;
};

const tdChequingRoute: StatementRoute = {
  id: "td-chequing",
  providerId: "td",
  accountType: "chequing",
  async recognizes(source) {
    const analysis = await analyzeValidatedTdChequingPdf(source);
    return analysis.status === "recognized" && analysis.tdMarkerDetected;
  },
  async importStatement({ source, importId, accountId, store, committedAt }) {
    const parsed = await parseTdChequingPdf({ source, importContext: { importId } });
    return ingestParsedTdChequingStatement({
      store,
      parsed,
      accountId,
      receivedAt: parsed.source.intakeTimestamp,
      committedAt,
    });
  },
};

const tdCreditCardRoute: StatementRoute = {
  id: "td-credit-card",
  providerId: "td",
  accountType: "credit-card",
  async recognizes(source) {
    const analysis = await analyzeValidatedTdCreditCardPdf(source);
    return analysis.status === "recognized" && analysis.tdMarkerDetected;
  },
  async importStatement({ source, importId, accountId, store, committedAt }) {
    const parsed = await parseTdCreditCardPdf({ source, importContext: { importId } });
    return ingestParsedTdCreditCardStatement({
      store,
      parsed,
      accountId,
      receivedAt: parsed.source.intakeTimestamp,
      committedAt,
    });
  },
};

export const PRODUCTION_STATEMENT_ROUTES: readonly StatementRoute[] = [
  tdChequingRoute,
  tdCreditCardRoute,
];

export type StatementClassification =
  | { status: "supported"; route: StatementRoute }
  | { status: "unsupported"; safeReasonCode: "STATEMENT_UNSUPPORTED" }
  | { status: "ambiguous"; safeReasonCode: "STATEMENT_CLASSIFICATION_AMBIGUOUS" };

export const classifyStatement = async (
  source: ValidatedPdfSource,
  routes: readonly StatementRoute[] = PRODUCTION_STATEMENT_ROUTES,
): Promise<StatementClassification> => {
  const recognized: StatementRoute[] = [];
  for (const route of routes) {
    if (await route.recognizes(source)) recognized.push(route);
  }
  if (recognized.length === 0) return { status: "unsupported", safeReasonCode: "STATEMENT_UNSUPPORTED" };
  if (recognized.length > 1) {
    return { status: "ambiguous", safeReasonCode: "STATEMENT_CLASSIFICATION_AMBIGUOUS" };
  }
  return { status: "supported", route: recognized[0] };
};
