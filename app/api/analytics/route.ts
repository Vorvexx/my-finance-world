import { connection } from "next/server";
import { NextResponse } from "next/server";
import { buildHistoricalFinancialFlow } from "@/lib/analytics/monthly-financial-flow";
import { buildChequingStatementHistory } from "@/lib/analytics/chequing-statement-history";
import { loadCanonicalFinancialData } from "@/lib/financial-model/load-canonical-financial-data";

export async function GET() {
  await connection();
  const data = await loadCanonicalFinancialData();
  if (!data.transactions || !data.visibleTransactions || !data.imports || !data.investmentSnapshots) {
    return NextResponse.json({ status: "unavailable", message: "Canonical analytics are unavailable on this device." }, { status: 503 });
  }
  const latestDate = data.visibleTransactions.reduce<string | null>((latest, transaction) => !latest || transaction.transactionDate > latest ? transaction.transactionDate : latest, null);
  if (!latestDate) return NextResponse.json({ status: "unavailable", message: "No canonical transaction evidence is available." }, { status: 503 });
  const historicalStartMonth = data.chequingStatementFacts?.reduce<string | null>((oldest, fact) => {
    const month = fact.statementPeriodStart.slice(0, 7);
    return oldest === null || month < oldest ? month : oldest;
  }, null) ?? "2024-12";
  return NextResponse.json({
    status: "ready",
    currentPicture: {
      transactionCount: data.transactions.length,
      visibleTransactionCount: data.visibleTransactions.length,
      accountCount: data.model.money.accounts.length,
      decisionCount: data.reviewCounts?.decisions ?? null,
      ruleCount: data.reviewCounts?.rules ?? null,
      aliasCount: data.reviewCounts?.aliases ?? null,
      genuinelyUnknownCount: data.genuinelyUnknownTransactionIds?.size ?? null,
      intentionallyDeferredCount: data.intentionallyDeferredTransactionIds.size,
      investmentSnapshotCount: data.investmentSnapshots.length,
      availableCash: data.model.totalsByWorld.cash === null ? { status: "unknown", amount: null } : { status: "known", amount: data.model.totalsByWorld.cash },
      netWorth: data.model.summary === null ? { status: "unknown", amount: null } : { status: "known", amount: data.model.summary.netWorth },
    },
    timeline: buildHistoricalFinancialFlow({
      transactions: data.visibleTransactions,
      imports: data.imports,
      investmentSnapshots: data.investmentSnapshots,
      accountNames: data.accountNames,
      genuinelyUnknownIds: data.genuinelyUnknownTransactionIds,
      intentionallyDeferredIds: data.intentionallyDeferredTransactionIds,
      startMonth: historicalStartMonth,
      endDate: latestDate,
    }),
    chequingHistory: buildChequingStatementHistory(data.chequingStatementFacts ?? []),
  });
}
