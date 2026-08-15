"use server";

import { revalidatePath } from "next/cache";
import type { MoneyWorldKey } from "@/types/finance";
import type { FounderReviewChoice } from "@/types/review-interface";
import type { FinancialMeaning } from "@/types/transactions";
import { withReviewRuntime } from "@/lib/review/review-runtime";
import { withRelationshipRuntime } from "@/lib/relationships/relationship-runtime";
import type { RelationshipDecision } from "@/types/relationships";
import { appendSafeAuditEvent } from "@/lib/runtime/audit";

export type ReviewActionState = { status: "idle" | "saved" | "error"; message: string };
export type RelationshipActionState = ReviewActionState;

const value = (formData: FormData, name: string) => {
  const field = formData.get(name);
  return typeof field === "string" ? field : "";
};

export async function saveFounderReview(_previous: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const actionToken = value(formData, "actionToken");
  const choices = formData.getAll("choice");
  const choice = (typeof choices.at(-1) === "string" ? choices.at(-1) : "") as FounderReviewChoice;
  if (!actionToken || !["classify", "keep-unknown", "ignore", "review-later"].includes(choice)) {
    return { status: "error", message: "That review action is not valid. Refresh and try again." };
  }
  const saved = withReviewRuntime(({ service }) => service.save({
    actionToken,
    choice,
    financialMeaning: choice === "classify" ? value(formData, "financialMeaning") as FinancialMeaning : null,
    category: choice === "classify" ? value(formData, "category") : null,
    world: choice === "classify" ? (value(formData, "world") || null) as MoneyWorldKey | null : null,
    scope: value(formData, "scope") === "group" ? "group" : "one",
    userPhrase: value(formData, "userPhrase") || null,
  }));
  if (!saved) return { status: "error", message: "Review could not be saved. Refresh and try again." };
  appendSafeAuditEvent({ at: new Date().toISOString(), event: "review-saved", authority: "founder", source: "local-ui", reason: choice === "classify" ? "Founder confirmed a transaction classification." : `Founder selected ${choice}.` });
  revalidatePath("/");
  return { status: "saved", message: choice === "review-later" ? "Set aside for later. Nothing was classified." : `Done — ${value(formData, "world") || "financial meaning"} → ${value(formData, "category") || value(formData, "financialMeaning")}` };
}

export async function undoFounderReview(_previous: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const actionToken = value(formData, "actionToken");
  const restored = actionToken ? withReviewRuntime(({ service }) => service.undo(actionToken)) : null;
  if (!restored) return { status: "error", message: "Undo could not be completed. Refresh and use Change." };
  appendSafeAuditEvent({ at: new Date().toISOString(), event: "review-saved", authority: "founder", source: "local-ui", reason: "Founder reversed a recent review decision." });
  revalidatePath("/"); revalidatePath("/review");
  return { status: "saved", message: "Undone. The previous understanding and learned match were restored safely." };
}

export async function reopenFounderReview(formData: FormData) {
  const actionToken = value(formData, "actionToken");
  if (actionToken) withReviewRuntime(({ service }) => service.undo(actionToken));
  revalidatePath("/"); revalidatePath("/review");
}

export async function correctFounderTransaction(formData: FormData) {
  const actionToken = value(formData, "actionToken");
  const financialMeaning = value(formData, "financialMeaning") as FinancialMeaning;
  if (actionToken && financialMeaning) withReviewRuntime(({ service }) => service.correct(actionToken, { financialMeaning, category: value(formData, "category") || null, world: (value(formData, "world") || null) as MoneyWorldKey | null }));
  appendSafeAuditEvent({ at: new Date().toISOString(), event: "review-saved", authority: "founder", source: "local-ui", reason: "Founder corrected a transaction from its World context." });
  revalidatePath("/"); revalidatePath("/review");
}

export async function saveFounderRelationship(_previous: RelationshipActionState, formData: FormData): Promise<RelationshipActionState> {
  const actionToken = value(formData, "actionToken");
  const decision = value(formData, "decision") as RelationshipDecision;
  if (!actionToken || !["accept", "reject", "keep-unknown", "ignore"].includes(decision)) {
    return { status: "error", message: "That relationship action is not valid. Refresh and try again." };
  }
  const saved = withRelationshipRuntime(({ service }) => service.save({ actionToken, decision }));
  if (!saved) return { status: "error", message: "Relationship review could not be saved. Refresh and try again." };
  appendSafeAuditEvent({ at: new Date().toISOString(), event: "relationship-saved", authority: "founder", source: "local-ui", reason: `Founder selected ${decision} for a deterministic relationship candidate.` });
  revalidatePath("/");
  revalidatePath("/review");
  return { status: "saved", message: decision === "accept" ? "Relationship confirmed and saved." : "Relationship decision saved." };
}
