import { connection } from "next/server";
import FinancialHome from "@/components/financial-home";
import { loadCanonicalFinancialModel } from "@/lib/financial-model/load-canonical-financial-model";

export default async function Home() {
  await connection();
  const model = await loadCanonicalFinancialModel();

  return <FinancialHome model={model} />;
}
