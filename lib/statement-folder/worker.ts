import { randomUUID } from "node:crypto";
import { watch, type FSWatcher } from "node:fs";
import { lstat, readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { validateLocalPdf } from "../financial-files/pdf-intake.ts";
import type { LocalIngestionStore } from "../persistence/local-ingestion-store.ts";
import type {
  StatementFolderAccountMappings,
  StatementFolderResult,
} from "../../types/drop-folder.ts";
import type { CanonicalTransaction } from "../../types/transactions.ts";
import {
  classifyStatement,
  PRODUCTION_STATEMENT_ROUTES,
  type StatementRoute,
} from "./provider-router.ts";
import {
  validateStatementFolder,
  type ResolvedStatementFolder,
  type StatementFolderConfig,
} from "./config.ts";

type CandidateIdentity = {
  size: number;
  mtimeMs: number;
  dev: number;
  ino: number;
};

export type StatementFolderWorkerOptions = {
  config: StatementFolderConfig;
  store: LocalIngestionStore;
  accountMappings: StatementFolderAccountMappings;
  stabilityIntervalMilliseconds?: number;
  reconciliationIntervalMilliseconds?: number;
  routes?: readonly StatementRoute[];
  now?: () => Date;
  relationshipProcessor?: { evaluate: (transactions: readonly CanonicalTransaction[], evaluatedAt: string) => void };
};

const activeClaims = new Set<string>();
const AUTHORIZED_CHILD_FOLDERS = new Set(["TD Chequing", "TD Credit", "TD TFSA", "TD RRSP", "Desjardin DCP", "Canada Life PRPP"]);
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const identityKey = (identity: CandidateIdentity) => [
  identity.dev,
  identity.ino,
  identity.size,
  identity.mtimeMs,
].join(":");
const sameIdentity = (left: CandidateIdentity, right: CandidateIdentity) =>
  identityKey(left) === identityKey(right);

const safeCode = (error: unknown) => {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  return "STATEMENT_PROCESSING_FAILED";
};

const isTemporaryName = (name: string) =>
  name.startsWith(".")
  || name.endsWith("~")
  || /\.(?:crdownload|download|part|partial|tmp)$/i.test(name);

const readIdentity = async (candidatePath: string): Promise<CandidateIdentity | null> => {
  try {
    const info = await lstat(candidatePath);
    if (info.isSymbolicLink() || !info.isFile()) return null;
    return { size: info.size, mtimeMs: info.mtimeMs, dev: info.dev, ino: info.ino };
  } catch {
    return null;
  }
};

export class StatementFolderWorker {
  readonly #config: StatementFolderConfig;
  readonly #store: LocalIngestionStore;
  readonly #accountMappings: StatementFolderAccountMappings;
  readonly #stabilityIntervalMilliseconds: number;
  readonly #reconciliationIntervalMilliseconds: number;
  readonly #routes: readonly StatementRoute[];
  readonly #now: () => Date;
  readonly #relationshipProcessor: StatementFolderWorkerOptions["relationshipProcessor"];
  readonly #observed = new Map<string, string>();
  #folder: ResolvedStatementFolder | null = null;
  #watcher: FSWatcher | null = null;
  #reconciliationTimer: ReturnType<typeof setInterval> | null = null;
  #scanQueue: Promise<readonly StatementFolderResult[]> = Promise.resolve([]);

  constructor(options: StatementFolderWorkerOptions) {
    this.#config = options.config;
    this.#store = options.store;
    this.#accountMappings = options.accountMappings;
    this.#stabilityIntervalMilliseconds = options.stabilityIntervalMilliseconds ?? 250;
    this.#reconciliationIntervalMilliseconds = options.reconciliationIntervalMilliseconds ?? 2_000;
    this.#routes = options.routes ?? PRODUCTION_STATEMENT_ROUTES;
    this.#now = options.now ?? (() => new Date());
    this.#relationshipProcessor = options.relationshipProcessor;
  }

  async start() {
    if (this.#watcher) return;
    this.#folder = await validateStatementFolder(this.#config);
    this.#watcher = watch(this.#folder.folderPath, { persistent: false }, () => {
      void this.scanNow().catch(() => undefined);
    });
    this.#watcher.on("error", () => {
      void this.scanNow().catch(() => undefined);
    });
    this.#reconciliationTimer = setInterval(
      () => void this.scanNow().catch(() => undefined),
      this.#reconciliationIntervalMilliseconds,
    );
    this.#reconciliationTimer.unref();
    // Reconciliation must not delay application startup when the authorized inbox
    // already contains a large statement history.
    void this.scanNow().catch(() => undefined);
  }

  async stop() {
    this.#watcher?.close();
    this.#watcher = null;
    if (this.#reconciliationTimer) clearInterval(this.#reconciliationTimer);
    this.#reconciliationTimer = null;
    await this.#scanQueue;
  }

  scanNow(): Promise<readonly StatementFolderResult[]> {
    const run = () => this.#scan();
    this.#scanQueue = this.#scanQueue.then(run, run);
    return this.#scanQueue;
  }

  getSafeStatusHistory(): readonly StatementFolderResult[] {
    return this.#store.getStatementFolderResults();
  }

  async #scan(): Promise<readonly StatementFolderResult[]> {
    this.#folder = await validateStatementFolder(this.#config);
    const entries = await readdir(this.#folder.folderPath, { withFileTypes: true });
    const candidates: Array<{ entry: (typeof entries)[number]; directory: string; retainSource: boolean }> = [];
    for (const entry of entries) {
      if (entry.isFile()) candidates.push({ entry, directory: this.#folder.folderPath, retainSource: false });
      else if (entry.isDirectory() && AUTHORIZED_CHILD_FOLDERS.has(entry.name)) {
        const childPath = path.join(this.#folder.folderPath, entry.name);
        const childInfo = await lstat(childPath);
        if (childInfo.isSymbolicLink() || !childInfo.isDirectory()) continue;
        for (const childEntry of await readdir(childPath, { withFileTypes: true })) {
          if (childEntry.isFile()) candidates.push({ entry: childEntry, directory: childPath, retainSource: true });
        }
      }
    }
    const results: StatementFolderResult[] = [];
    for (const { entry, directory, retainSource } of candidates.sort((left, right) => path.join(left.directory, left.entry.name).localeCompare(path.join(right.directory, right.entry.name)))) {
      if (isTemporaryName(entry.name)) continue;
      const candidatePath = path.join(directory, entry.name);
      const result = await this.#consider(candidatePath, path.extname(entry.name).toLowerCase(), retainSource);
      if (result) results.push(result);
    }
    return results;
  }

  async #consider(candidatePath: string, extension: string, retainSource: boolean): Promise<StatementFolderResult | null> {
    if (activeClaims.has(candidatePath)) return null;
    const first = await readIdentity(candidatePath);
    if (!first || first.size === 0) return null;
    const signature = identityKey(first);
    if (this.#observed.get(candidatePath) === signature) return null;
    await wait(this.#stabilityIntervalMilliseconds);
    const second = await readIdentity(candidatePath);
    if (!second || !sameIdentity(first, second)) return null;

    activeClaims.add(candidatePath);
    try {
      if (extension !== ".pdf") {
        const result = this.#result({ status: "unsupported", safeReasonCode: "UNSUPPORTED_FILE" });
        this.#store.saveStatementFolderResult(result);
        this.#observed.set(candidatePath, signature);
        return result;
      }
      const result = await this.#processPdf(candidatePath, second, retainSource);
      if ((result.status !== "imported" && result.status !== "duplicate") || retainSource) {
        this.#observed.set(candidatePath, signature);
      } else {
        this.#observed.delete(candidatePath);
      }
      return result;
    } finally {
      activeClaims.delete(candidatePath);
    }
  }

  async #processPdf(
    candidatePath: string,
    claimedIdentity: CandidateIdentity,
    retainSource: boolean,
  ): Promise<StatementFolderResult> {
    const resultId = randomUUID();
    const processing = this.#result({ resultId, status: "processing" });
    this.#store.saveStatementFolderResult(processing);
    let source;
    let selectedRoute: StatementRoute | undefined;
    let selectedImportId: string | null = null;
    try {
      source = await validateLocalPdf({
        sourcePath: candidatePath,
        allowedRoot: this.#folder!.folderPath,
        intakeTimestamp: this.#now().toISOString(),
      });
      const classification = await classifyStatement(source, this.#routes);
      if (classification.status !== "supported") {
        const unsupported = this.#result({
          resultId,
          status: classification.status === "ambiguous" ? "needs-attention" : "unsupported",
          safeReasonCode: classification.safeReasonCode,
        });
        this.#store.saveStatementFolderResult(unsupported);
        return unsupported;
      }

      const { route } = classification;
      selectedRoute = route;
      const accountId = this.#accountMappings[route.id];
      if (!accountId) {
        const missing = this.#result({
          resultId,
          route,
          status: "needs-attention",
          safeReasonCode: "IMPORT_ACCOUNT_MAPPING_MISSING",
        });
        this.#store.saveStatementFolderResult(missing);
        return missing;
      }
      try {
        this.#store.assertAccountMapping(accountId, route.providerId, route.accountType);
      } catch (error) {
        const invalid = this.#result({
          resultId,
          route,
          status: "needs-attention",
          safeReasonCode: safeCode(error),
        });
        this.#store.saveStatementFolderResult(invalid);
        return invalid;
      }

      const recoverable = this.#store.findRecoverableImport({
        sourceSha256: source.metadata.sha256,
        accountId,
        providerId: route.providerId,
        accountType: route.accountType,
      });
      const importId = recoverable?.importId ?? `folder-import:${randomUUID()}`;
      selectedImportId = importId;
      const receipt = await route.importStatement({
        source,
        importId,
        accountId,
        store: this.#store,
        committedAt: this.#now().toISOString(),
      });
      const finalStatus = receipt.status === "duplicate" ? "duplicate" : "imported";
      const completed = this.#result({
        resultId,
        importId: receipt.importId,
        route,
        status: finalStatus,
        transactionCount: receipt.transactionCount,
        duplicateCount: receipt.duplicateCount,
      });
      if (this.#relationshipProcessor) {
        try {
          const accountIds = [...new Set(Object.values(this.#accountMappings).filter((value): value is string => Boolean(value)))];
          const transactions = accountIds.flatMap((mappedAccountId) => this.#store.getTransactionsByAccount(mappedAccountId));
          this.#relationshipProcessor.evaluate(transactions, this.#now().toISOString());
        } catch {
          const retained = { ...completed, status: "needs-attention" as const, safeReasonCode: "RELATIONSHIP_EVALUATION_FAILED" };
          this.#store.saveStatementFolderResult(retained);
          return retained;
        }
      }
      if (receipt.safeToDeleteSource && !retainSource) {
        const currentIdentity = await readIdentity(candidatePath);
        if (!currentIdentity || !sameIdentity(claimedIdentity, currentIdentity)) {
          const retained = { ...completed, status: "needs-attention" as const, safeReasonCode: "SOURCE_CHANGED_AFTER_PROCESSING" };
          this.#store.saveStatementFolderResult(retained);
          return retained;
        }
        try {
          await unlink(candidatePath);
        } catch {
          const retained = { ...completed, status: "needs-attention" as const, safeReasonCode: "SOURCE_DELETE_FAILED" };
          this.#store.saveStatementFolderResult(retained);
          return retained;
        }
      }
      this.#store.saveStatementFolderResult(completed);
      return completed;
    } catch (error) {
      const rejected = this.#result({
        resultId,
        importId: selectedImportId,
        route: selectedRoute,
        status: "rejected",
        safeReasonCode: safeCode(error),
      });
      this.#store.saveStatementFolderResult(rejected);
      return rejected;
    } finally {
      source?.bytes.fill(0);
    }
  }

  #result({
    resultId = randomUUID(),
    importId = null,
    route,
    status,
    transactionCount = 0,
    duplicateCount = 0,
    safeReasonCode = null,
  }: {
    resultId?: string;
    importId?: string | null;
    route?: StatementRoute;
    status: StatementFolderResult["status"];
    transactionCount?: number;
    duplicateCount?: number;
    safeReasonCode?: string | null;
  }): StatementFolderResult {
    return {
      resultId,
      importId,
      routeId: route?.id ?? null,
      providerId: route?.providerId ?? null,
      accountType: route?.accountType ?? null,
      status,
      transactionCount,
      duplicateCount,
      safeReasonCode,
      processedAt: this.#now().toISOString(),
    };
  }
}
