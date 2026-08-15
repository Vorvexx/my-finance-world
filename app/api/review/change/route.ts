import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { withReviewRuntime } from "@/lib/review/review-runtime";
import { appendSafeAuditEvent } from "@/lib/runtime/audit";

const field = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
};

export async function POST(request: Request) {
  const form = await request.formData();
  const actionToken = field(form, "actionToken");
  const description = field(form, "description");
  if (!actionToken || !description) return NextResponse.redirect(new URL("/review", request.url), 303);
  const restored = withReviewRuntime(({ service }) => service.undo(actionToken, new Date(), "one"));
  if (!restored) return NextResponse.redirect(new URL("/review", request.url), 303);
  appendSafeAuditEvent({ at: new Date().toISOString(), event: "review-saved", authority: "founder", source: "local-ui", reason: "Founder opened a recent understanding for correction." });
  revalidatePath("/"); revalidatePath("/review");
  const target = new URL("/review", request.url);
  target.searchParams.set("change", description);
  target.hash = "pending-reviews";
  return NextResponse.redirect(target, 303);
}
