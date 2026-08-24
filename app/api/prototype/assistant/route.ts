import { answerFinancialQuestion } from "@/lib/prototype/assistant";
import { buildPrototypeView } from "@/lib/prototype/intelligence";
import { loadState } from "@/lib/prototype/store";
import type { PeriodKey } from "@/types/prototype";
export async function POST(request: Request) {
  try {
    const body = await request.json() as { question?: unknown; period?: unknown; end?: unknown };
    if (typeof body.question !== "string" || body.question.length > 500) return Response.json({ error: "Question must be between 1 and 500 characters." }, { status: 400 });
    const view = buildPrototypeView(await loadState(), (typeof body.period === "string" ? body.period : "month") as PeriodKey, typeof body.end === "string" ? body.end : undefined);
    return Response.json(answerFinancialQuestion(body.question, view));
  } catch { return Response.json({ error: "Vorvex could not answer from local data." }, { status: 500 }); }
}
