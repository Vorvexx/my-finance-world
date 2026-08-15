"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Understanding = { actionToken: string; description: string; world?: string | null; category?: string | null; financialMeaning?: string | null };

export default function UnderstandingHistory({ decisions }: { decisions: readonly Understanding[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false); const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const filtered = useMemo(() => decisions.filter((decision) => `${decision.description} ${decision.world} ${decision.category} ${decision.financialMeaning}`.toLowerCase().includes(query.trim().toLowerCase())), [decisions, query]);
  const visible = expanded || query ? filtered : filtered.slice(0, 8);
  const undo = async (decision: Understanding) => {
    const response = await fetch("/api/review", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ actionToken: decision.actionToken, scope: "one" }) });
    const result = await response.json() as { message?: string };
    setMessage(result.message ?? "Undo could not be completed.");
    if (response.ok) router.refresh();
  };
  return <><div className="understanding-tools"><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search merchant or meaning" aria-label="Search understandings" />{decisions.length > 8 && <button type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? "Show recent" : "View all understandings"}</button>}</div>{message && <p className="mt-3 text-sm text-emerald-200" role="status">{message}</p>}<div className="mt-4 grid gap-3 sm:grid-cols-2">{visible.map((decision) => <article key={decision.actionToken} className="rounded-2xl border border-white/10 p-4"><strong>{decision.description}</strong><small className="mt-1 block text-slate-400">{decision.world ?? "Financial activity"} → {decision.category ?? decision.financialMeaning}</small><div className="mt-3 flex gap-4"><form action="/api/review/change" method="post"><input type="hidden" name="actionToken" value={decision.actionToken} /><input type="hidden" name="description" value={decision.description} /><button className="text-sm font-semibold text-emerald-300">Change</button></form><button type="button" onClick={() => undo(decision)} className="text-sm font-semibold text-slate-300">Undo</button></div></article>)}</div>{visible.length === 0 && <p className="mt-4 text-sm text-slate-400">No understanding matches that search.</p>}</>;
}
