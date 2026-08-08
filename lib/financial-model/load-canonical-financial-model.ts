import "server-only";

import { createEmptyFinancialModel, ingestFinancialSnapshot } from "./canonical-financial-model";
import { localSnapshotProvider } from "./providers/local-snapshot-provider";
import type { FinancialDataProvider } from "@/types/finance";

const providers: readonly FinancialDataProvider[] = [localSnapshotProvider];

export const loadCanonicalFinancialModel = async () => {
  try {
    for (const provider of providers) {
      const rawSnapshot = await provider.load();
      if (rawSnapshot) return ingestFinancialSnapshot(rawSnapshot);
    }
    return createEmptyFinancialModel();
  } catch {
    return createEmptyFinancialModel("invalid");
  }
};
