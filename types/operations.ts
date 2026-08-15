export type SafeImportTimelineItem = {
  at: string;
  outcome: "Imported" | "Already processed" | "Rejected" | "Unsupported" | "Failed" | "Needs Review" | "Source removed";
  source: "TD Chequing" | "TD Credit Card" | "Unknown statement";
  transactionCount: number;
  explanation: string;
};

export type OperationalView = {
  coverage: { status: "Partial" | "Unknown"; oldestTransaction: string | null; newestTransaction: string | null; gapCount: number | null; explanation: string };
  imports: readonly SafeImportTimelineItem[];
  knowledge: readonly { at: string; kind: string; explanation: string }[];
  summary: { imported: number; alreadyProcessed: number; needsReview: number; failed: number };
};
