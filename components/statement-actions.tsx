"use client";

import { useActionState } from "react";
import { openStatementInbox, scanNow, type StatementActionState } from "@/app/statements/actions";

const initial: StatementActionState = { status: "idle", message: "" };
function ActionButton({ action, label, pendingLabel }: { action: () => Promise<StatementActionState>; label: string; pendingLabel: string }) {
  const [state, run, pending] = useActionState(action, initial);
  return <form action={run}><button disabled={pending} className="rounded-full bg-emerald-300 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">{pending ? pendingLabel : label}</button>{state.message && <p role="status" className={`mt-3 max-w-sm text-xs ${state.status === "error" ? "text-amber-200" : "text-slate-400"}`}>{state.message}</p>}</form>;
}
export default function StatementActions() {
  return <div className="mt-6 flex flex-col gap-5 sm:flex-row"><ActionButton action={openStatementInbox} label="Open statement inbox" pendingLabel="Opening…" /><ActionButton action={scanNow} label="Scan now" pendingLabel="Scanning…" /></div>;
}
