import { connection } from "next/server";
import FinancialHome from "@/components/financial-home";
import { loadHomepageView } from "@/lib/homepage/load-homepage-view";
import { loadFounderConfiguration } from "@/lib/runtime/configuration";
import { redirect } from "next/navigation";
import { parseFinancialPeriod } from "@/lib/homepage/financial-period";

export default async function Home({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await connection();
  if (!loadFounderConfiguration()) redirect("/setup");
  const { period } = await searchParams;
  const view = await loadHomepageView({ periodKey: parseFinancialPeriod(period) });
  return <FinancialHome view={view} />;
}
