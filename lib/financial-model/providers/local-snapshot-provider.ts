import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { FinancialDataProvider } from "@/types/finance";

const DEFAULT_BACKUP_DIRECTORY = path.join(
  process.cwd(),
  "local-backups",
  "financial-data",
  "2026-08-07",
);

const readOptionalFile = async (filePath: string) => {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};

export const localSnapshotProvider: FinancialDataProvider = {
  id: "local-snapshot",
  async load() {
    const directory = process.env.VORVEX_FINANCIAL_SNAPSHOT_DIR || DEFAULT_BACKUP_DIRECTORY;
    const accountsRaw = await readOptionalFile(
      path.join(directory, "my-finance-world-real-accounts-v1.json"),
    );
    if (accountsRaw === null) return null;

    const updatedRaw = await readOptionalFile(
      path.join(directory, "my-finance-world-last-updated-v1.txt"),
    );

    return {
      accounts: JSON.parse(accountsRaw) as unknown,
      lastUpdated: updatedRaw,
    };
  },
};
