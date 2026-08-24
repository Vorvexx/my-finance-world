import { buildPrototypeView } from "@/lib/prototype/intelligence";
import { loadState } from "@/lib/prototype/store";
import type { PeriodKey } from "@/types/prototype";

const periods = new Set<PeriodKey>(["day", "week", "fortnight", "month", "quarter", "year"]);
export async function GET(request: Request) {
  try {
    const url = new URL(request.url); const candidate = url.searchParams.get("period") as PeriodKey | null;
    const period = candidate && periods.has(candidate) ? candidate : "month";
    return Response.json(buildPrototypeView(await loadState(), period, url.searchParams.get("end") ?? undefined), { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Local financial state could not be loaded safely." }, { status: 500 }); }
}
