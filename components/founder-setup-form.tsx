"use client";

import { useActionState } from "react";
import { completeFounderSetup, type SetupState } from "@/app/setup/actions";

const initial: SetupState = { status: "idle", message: "" };
export default function FounderSetupForm() {
  const [state, action, pending] = useActionState(completeFounderSetup, initial);
  return <form action={action} className="mt-8 space-y-6 rounded-[28px] border border-white/10 bg-[#0b1821] p-6">
    <label className="block"><span className="text-sm font-semibold">Verified account snapshot folder</span><span className="mt-1 block text-xs text-slate-500">Choose the folder containing the account snapshot you have verified. Vorvex copies the validated facts into protected local storage and does not retain this location.</span><input required name="snapshotDirectory" autoComplete="off" className="mt-3 w-full rounded-xl border border-white/10 bg-[#071018] px-4 py-3 text-sm" /></label>
    <label className="block"><span className="text-sm font-semibold">TD Chequing display name</span><span className="mt-1 block text-xs text-slate-500">Enter the exact account display name from the verified snapshot. Ambiguous or incompatible matches are rejected.</span><input required name="chequingDisplayName" autoComplete="off" className="mt-3 w-full rounded-xl border border-white/10 bg-[#071018] px-4 py-3 text-sm" /></label>
    <label className="block"><span className="text-sm font-semibold">TD Credit Card display name</span><span className="mt-1 block text-xs text-slate-500">These two mappings tell Vorvex where supported TD statement activity belongs.</span><input required name="creditCardDisplayName" autoComplete="off" className="mt-3 w-full rounded-xl border border-white/10 bg-[#071018] px-4 py-3 text-sm" /></label>
    <label className="flex gap-3 rounded-2xl bg-white/[0.04] p-4 text-sm leading-6 text-slate-300"><input required type="checkbox" name="confirmed" value="yes" className="mt-1" /><span>I confirm these are the intended accounts and authorize creation of local protected Vorvex state. Unknown or unproven values must remain Unknown.</span></label>
    {state.status === "error" && <p role="alert" className="rounded-xl bg-amber-300/10 p-3 text-sm text-amber-100">{state.message}</p>}
    <button disabled={pending} className="rounded-full bg-emerald-400 px-6 py-3 text-sm font-bold text-[#071018] hover:bg-emerald-300 disabled:opacity-50">{pending ? "Creating protected local state…" : "Complete local setup"}</button>
  </form>;
}
