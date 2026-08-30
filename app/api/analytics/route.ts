import { connection } from "next/server";
import { NextResponse } from "next/server";
import { buildHistoricalFinancialFlow } from "@/lib/analytics/monthly-financial-flow";
import { loadCanonicalFinancialData } from "@/lib/financial-model/load-canonical-financial-data";

export async function GET() {
  await connection();
  const data = await loadCanonicalFinancialData();
  if (!data.visibleTransactions || !data.imports || !data.investmentSnapshots) {
    return NextResponse.json({ status: "unavailable", message: "Canonical analytics are unavailable on this device." }, { status: 503 });
  }
  const latestDate = data.visibleTransactions.reduce<string | null>((latest, transaction) => !latest || transaction.transactionDate > latest ? transaction.transactionDate : latest, null);
  if (!latestDate) return NextResponse.json({ status: "unavailable", message: "No canonical transaction evidence is available." }, { status: 503 });
  return NextResponse.json({
    status: "ready",
    timeline: buildHistoricalFinancialFlow({
      transactions: data.visibleTransactions,
      imports: data.imports,
      investmentSnapshots: data.investmentSnapshots,
      accountNames: data.accountNames,
      genuinelyUnknownIds: data.genuinelyUnknownTransactionIds,
      intentionallyDeferredIds: data.intentionallyDeferredTransactionIds,
      endDate: latestDate,
    }),
  });
}
