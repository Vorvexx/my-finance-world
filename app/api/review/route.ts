import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { MoneyWorldKey } from "@/types/finance";
import type { FounderReviewChoice } from "@/types/review-interface";
import type { FinancialMeaning } from "@/types/transactions";
import { withReviewRuntime } from "@/lib/review/review-runtime";
import { appendSafeAuditEvent } from "@/lib/runtime/audit";

const text = (value: unknown) => typeof value === "string" ? value : "";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const actionToken = text(body.actionToken);
    const choice = text(body.choice) as FounderReviewChoice;
    const actionTokens = Array.isArray(body.actionTokens) ? body.actionTokens.filter((value): value is string => typeof value === "string" && value.length > 0) : [];
    if ((!actionToken && actionTokens.length === 0) || !["classify", "keep-unknown", "ignore", "review-later"].includes(choice)) return NextResponse.json({ message: "That review action is not valid." }, { status: 400 });
    if (choice === "classify" && actionTokens.length > 0) {
      const saved = withReviewRuntime(({ service }) => service.saveBulk(actionTokens, {
        financialMeaning: text(body.financialMeaning) as FinancialMeaning, category: text(body.category) || null,
        world: (text(body.world) || null) as MoneyWorldKey | null, userPhrase: text(body.userPhrase) || null,
      }));
      if (!saved) return NextResponse.json({ message: "Review could not be saved." }, { status: 503 });
      appendSafeAuditEvent({ at: new Date().toISOString(), event: "review-saved", authority: "founder", source: "local-ui", reason: `Founder classified ${saved.resolvedCount} explicitly selected transactions.` });
      revalidatePath("/");
      return NextResponse.json({ message: `${saved.resolvedCount} transaction${saved.resolvedCount === 1 ? "" : "s"} categorized as ${text(body.world) || "financial activity"} · ${text(body.category) || text(body.financialMeaning)}`, undoToken: saved.undoToken, resolvedCount: saved.resolvedCount });
    }
    const saved = withReviewRuntime(({ service }) => service.save({
      actionToken,
      choice,
      financialMeaning: choice === "classify" ? text(body.financialMeaning) as FinancialMeaning : null,
      category: choice === "classify" ? text(body.category) || null : null,
      world: choice === "classify" ? (text(body.world) || null) as MoneyWorldKey | null : null,
      scope: text(body.scope) === "group" ? "group" : text(body.scope) === "subset" ? "subset" : "one",
      selectedIndexes: Array.isArray(body.selectedIndexes) ? body.selectedIndexes.filter((value): value is number => Number.isInteger(value)) : [],
      userPhrase: text(body.userPhrase) || null,
    }));
    if (!saved) return NextResponse.json({ message: "Review could not be saved." }, { status: 503 });
    appendSafeAuditEvent({ at: new Date().toISOString(), event: "review-saved", authority: "founder", source: "local-ui", reason: choice === "classify" ? "Founder confirmed a transaction classification." : `Founder selected ${choice}.` });
    revalidatePath("/");
    return NextResponse.json({ message: choice === "review-later" ? "Set aside for later. Nothing was classified." : `Done — ${text(body.world) || "financial meaning"} → ${text(body.category) || text(body.financialMeaning)}`, undoToken: choice === "classify" ? actionToken : undefined });
  } catch {
    return NextResponse.json({ message: "Review could not be saved. Refresh and try again." }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const scope = text(body.scope) === "one" ? "one" : text(body.scope) === "subset" ? "subset" : "group";
    const selectedIndexes = Array.isArray(body.selectedIndexes) ? body.selectedIndexes.filter((value): value is number => Number.isInteger(value)) : [];
    const restored = text(body.actionToken) ? withReviewRuntime(({ service }) => service.undo(text(body.actionToken), new Date(), scope, selectedIndexes)) : null;
    if (!restored) return NextResponse.json({ message: "Undo could not be completed." }, { status: 400 });
    appendSafeAuditEvent({ at: new Date().toISOString(), event: "review-saved", authority: "founder", source: "local-ui", reason: "Founder reversed a recent review decision." });
    revalidatePath("/");
    return NextResponse.json({ message: "Undone. The previous understanding and learned match were restored safely." });
  } catch {
    return NextResponse.json({ message: "Undo could not be completed. Refresh and use Change." }, { status: 400 });
  }
}
