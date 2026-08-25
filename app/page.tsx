import { connection } from "next/server";
import FinancialHome from "@/components/financial-home";
import { loadHomepageView } from "@/lib/homepage/load-homepage-view";
import { loadFounderConfiguration } from "@/lib/runtime/configuration";
import { redirect } from "next/navigation";
import { parseFinancialPeriod } from "@/lib/homepage/financial-period";

export default async function Home({ searchParams }: { searchParams: Promise<{ period?: string; anchor?: string; start?: string; end?: string }> }) {
  await connection();
  if (!loadFounderConfiguration()) redirect("/setup");
  const { period, anchor, start, end } = await searchParams;
  const view = await loadHomepageView({ periodKey: parseFinancialPeriod(period), periodAnchor: anchor, customStart: start, customEnd: end });
  return <FinancialHome view={view} />;
}
