"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveFounderRelationship, type RelationshipActionState } from "@/app/review/actions";

const initialState: RelationshipActionState = { status: "idle", message: "" };

export default function RelationshipDecisionForm({ actionToken }: { actionToken: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveFounderRelationship, initialState);
  useEffect(() => { if (state.status === "saved") router.refresh(); }, [router, state.status]);
  return (
    <form action={formAction} className="mt-5 border-t border-white/10 pt-5">
      <input type="hidden" name="actionToken" value={actionToken} />
      <div className="flex flex-wrap gap-3">
        <button name="decision" value="accept" disabled={pending} className="rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-[#071018] disabled:opacity-50">These are the same movement</button>
        <button name="decision" value="reject" disabled={pending} className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-slate-200 disabled:opacity-50">These are not related</button>
        <button name="decision" value="keep-unknown" disabled={pending} className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-slate-200 disabled:opacity-50">Keep Unknown</button>
        <button name="decision" value="ignore" disabled={pending} className="rounded-full px-5 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-300 disabled:opacity-50">Ignore</button>
      </div>
      {state.message && <p aria-live="polite" className={`mt-4 text-sm ${state.status === "error" ? "text-rose-300" : "text-emerald-300"}`}>{state.message}</p>}
    </form>
  );
}
