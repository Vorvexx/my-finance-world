"use client";

import { useMemo, useState } from "react";
import { reopenFounderReview } from "@/app/review/actions";

type Understanding = { actionToken: string; description: string; world?: string | null; category?: string | null; financialMeaning?: string | null };

export default function UnderstandingHistory({ decisions }: { decisions: readonly Understanding[] }) {
  const [expanded, setExpanded] = useState(false); const [query, setQuery] = useState("");
  const filtered = useMemo(() => decisions.filter((decision) => `${decision.description} ${decision.world} ${decision.category} ${decision.financialMeaning}`.toLowerCase().includes(query.trim().toLowerCase())), [decisions, query]);
  const visible = expanded || query ? filtered : filtered.slice(0, 8);
  return <><div className="understanding-tools"><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search merchant or meaning" aria-label="Search understandings" />{decisions.length > 8 && <button type="button" onClick={() => setExpanded((value) => !value)}>{expanded ? "Show recent" : "View all understandings"}</button>}</div><div className="mt-4 grid gap-3 sm:grid-cols-2">{visible.map((decision) => <article key={decision.actionToken} className="rounded-2xl border border-white/10 p-4"><strong>{decision.description}</strong><small className="mt-1 block text-slate-400">{decision.world ?? "Financial activity"} → {decision.category ?? decision.financialMeaning}</small><form action={reopenFounderReview} className="mt-3"><input type="hidden" name="actionToken" value={decision.actionToken} /><button className="text-sm font-semibold text-emerald-300">Change</button></form></article>)}</div>{visible.length === 0 && <p className="mt-4 text-sm text-slate-400">No understanding matches that search.</p>}</>;
}
