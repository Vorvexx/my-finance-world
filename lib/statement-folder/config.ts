import { mkdir, lstat, realpath, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const STATEMENT_FOLDER_NAME = "Vorvex Bank Statements";

export type StatementFolderConfig = {
  folderPath: string;
  approvedRoot: string;
};

export type ResolvedStatementFolder = {
  folderPath: string;
  approvedRoot: string;
};

export type StatementFolderConfigErrorCode =
  | "STATEMENT_FOLDER_MISSING"
  | "STATEMENT_FOLDER_NOT_DIRECTORY"
  | "STATEMENT_FOLDER_SYMLINK_PROHIBITED"
  | "STATEMENT_FOLDER_OUTSIDE_APPROVED_ROOT"
  | "STATEMENT_FOLDER_PERMISSIONS_UNSAFE"
  | "STATEMENT_FOLDER_OWNERSHIP_UNSAFE";

export class StatementFolderConfigError extends Error {
  readonly code: StatementFolderConfigErrorCode;

  constructor(code: StatementFolderConfigErrorCode) {
    super(code);
    this.name = "StatementFolderConfigError";
    this.code = code;
  }
}

export const defaultStatementFolderConfig = (): StatementFolderConfig => {
  const folderPath = process.env.VORVEX_BANK_STATEMENTS_DIR
    ? path.resolve(process.env.VORVEX_BANK_STATEMENTS_DIR)
    : path.join(os.homedir(), "Documents", STATEMENT_FOLDER_NAME);
  return {
    approvedRoot: folderPath,
    folderPath,
  };
};

const isWithinApprovedRoot = (candidate: string, root: string) =>
  candidate === root || candidate.startsWith(`${root}${path.sep}`);

export const createStatementFolder = async (
  config: StatementFolderConfig = defaultStatementFolderConfig(),
): Promise<ResolvedStatementFolder> => {
  const requested = path.resolve(config.folderPath);
  const parent = await realpath(path.dirname(requested));
  const candidate = path.join(parent, path.basename(requested));
  const requestedRoot = path.resolve(config.approvedRoot);
  const root = requestedRoot === requested ? candidate : await realpath(requestedRoot);
  if (!isWithinApprovedRoot(candidate, root)) {
    throw new StatementFolderConfigError("STATEMENT_FOLDER_OUTSIDE_APPROVED_ROOT");
  }
  await mkdir(candidate, { mode: 0o700, recursive: true });
  return validateStatementFolder({ folderPath: candidate, approvedRoot: root });
};

export const validateStatementFolder = async (
  config: StatementFolderConfig,
): Promise<ResolvedStatementFolder> => {
  let folderInfo;
  let root;
  try {
    folderInfo = await lstat(config.folderPath);
    root = await realpath(config.approvedRoot);
  } catch {
    throw new StatementFolderConfigError("STATEMENT_FOLDER_MISSING");
  }
  if (folderInfo.isSymbolicLink()) {
    throw new StatementFolderConfigError("STATEMENT_FOLDER_SYMLINK_PROHIBITED");
  }
  if (!folderInfo.isDirectory()) {
    throw new StatementFolderConfigError("STATEMENT_FOLDER_NOT_DIRECTORY");
  }
  const folderPath = await realpath(config.folderPath);
  if (!isWithinApprovedRoot(folderPath, root)) {
    throw new StatementFolderConfigError("STATEMENT_FOLDER_OUTSIDE_APPROVED_ROOT");
  }
  const resolvedInfo = await stat(folderPath);
  if ((resolvedInfo.mode & 0o077) !== 0) {
    throw new StatementFolderConfigError("STATEMENT_FOLDER_PERMISSIONS_UNSAFE");
  }
  if (typeof process.getuid === "function" && resolvedInfo.uid !== process.getuid()) {
    throw new StatementFolderConfigError("STATEMENT_FOLDER_OWNERSHIP_UNSAFE");
  }
  return { folderPath, approvedRoot: root };
};
