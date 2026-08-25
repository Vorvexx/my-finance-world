"use client";

import { useMemo, useState } from "react";
import { correctFounderTransaction, reopenFounderReview } from "@/app/review/actions";
import type { BrowserReviewSuggestion } from "@/types/review-interface";

const LABELS: Record<string, string> = { cash: "Lifestyle", home: "Home", vehicle: "Vehicle", investments: "Investments", creditDebt: "Liabilities", income: "Income", future: "Other" };
export default function InlineTransactionCorrection({ correction }: { correction: { actionToken: string; suggestions: readonly BrowserReviewSuggestion[] } }) {
  const [open, setOpen] = useState(false); const [world, setWorld] = useState<string | null>(null); const [choice, setChoice] = useState<BrowserReviewSuggestion | null>(null);
  const worlds = useMemo(() => [...new Set(correction.suggestions.map((item) => item.world).filter(Boolean))] as string[], [correction]);
  const meanings = correction.suggestions.filter((item) => item.world === world).slice(0, 7);
  if (!open) return <button type="button" className="transaction-change" onClick={() => setOpen(true)}>Change</button>;
  return <div className="inline-correction-wrap"><form action={correctFounderTransaction} className="inline-correction"><input type="hidden" name="actionToken" value={correction.actionToken} /><input type="hidden" name="financialMeaning" value={choice?.financialMeaning ?? ""} /><input type="hidden" name="category" value={choice?.category ?? ""} /><input type="hidden" name="world" value={choice?.world ?? ""} /><p>Move to</p><div>{worlds.map((key) => <button type="button" key={key} aria-pressed={world === key} onClick={() => { setWorld(key); setChoice(null); }}>{LABELS[key] ?? key}</button>)}</div>{world && <div>{meanings.map((item) => <button type="button" key={item.id} aria-pressed={choice?.id === item.id} onClick={() => setChoice(item)}>{item.label}</button>)}</div>}<footer><button disabled={!choice}>Confirm move</button><button type="button" onClick={() => setOpen(false)}>Cancel</button></footer></form><form action={reopenFounderReview}><input type="hidden" name="actionToken" value={correction.actionToken} /><button className="transaction-undo">Undo current understanding</button></form></div>;
}
