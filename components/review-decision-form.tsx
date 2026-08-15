"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveFounderReview, undoFounderReview, type ReviewActionState } from "@/app/review/actions";
import type { BrowserReviewItem, BrowserReviewSuggestion } from "@/types/review-interface";
import { WorldIcon, type WorldKey } from "@/components/financial-home";

const initialState: ReviewActionState = { status: "idle", message: "" };
const WORLD_LABELS: Record<string, string> = { cash: "Lifestyle", home: "Home", vehicle: "Vehicle", investments: "Investments", creditDebt: "Liabilities", income: "Income", future: "Other", upcoming: "Upcoming" };
const WORLD_VISUALS: Record<string, { world: WorldKey; tone: string }> = { cash: { world: "lifestyle", tone: "coral" }, home: { world: "home", tone: "amber" }, vehicle: { world: "vehicle", tone: "cyan" }, investments: { world: "investments", tone: "violet" }, creditDebt: { world: "liabilities", tone: "rose" }, income: { world: "cashflow", tone: "mint" }, future: { world: "cashflow", tone: "blue" }, upcoming: { world: "cashflow", tone: "blue" } };

export default function ReviewDecisionForm({ item }: { item: BrowserReviewItem }) {
  const router = useRouter();
  const recommendation = item.suggestions.find((suggestion) => suggestion.recommended) ?? null;
  const [state, formAction, pending] = useActionState(saveFounderReview, initialState);
  const [undoState, undoAction, undoPending] = useActionState(undoFounderReview, initialState);
  const [selected, setSelected] = useState<BrowserReviewSuggestion | null>(recommendation);
  const [world, setWorld] = useState<string | null>(recommendation?.world ?? null);
  const [changing, setChanging] = useState(!recommendation);
  const [creating, setCreating] = useState(false);
  const [phrase, setPhrase] = useState("");
  const worlds = useMemo(() => [...new Set(item.suggestions.map((suggestion) => suggestion.world).filter(Boolean))] as string[], [item.suggestions]);
  const choices = useMemo(() => item.suggestions.filter((suggestion) => suggestion.world === world && (!phrase.trim() || `${suggestion.label} ${suggestion.path} ${suggestion.searchTerms}`.toLowerCase().includes(phrase.trim().toLowerCase()))).slice(0, 6), [item.suggestions, phrase, world]);

  if (state.status === "saved") return <div className="review-done" role="status"><strong>{state.message}</strong><form action={undoAction}><input type="hidden" name="actionToken" value={item.actionToken} /><button disabled={undoPending}>Undo</button></form><button type="button" onClick={() => router.refresh()}>Next transaction</button>{undoState.message && <small>{undoState.message}</small>}</div>;

  return <form action={formAction} className="review-journey">
    <input type="hidden" name="actionToken" value={item.actionToken} /><input type="hidden" name="choice" value="classify" />
    <input type="hidden" name="financialMeaning" value={selected?.financialMeaning ?? ""} /><input type="hidden" name="category" value={selected?.category ?? ""} /><input type="hidden" name="world" value={selected?.world ?? ""} /><input type="hidden" name="userPhrase" value={phrase.trim()} />
    {recommendation && !changing ? <section className="review-recommendation"><p>Vorvex thinks this was</p><strong>{recommendation.path}</strong><small>{recommendation.reason}</small>{item.similarCount > 1 && <details className="review-matches"><summary>Inspect all {item.similarCount} matching transactions</summary><ul>{item.representativeTransactions.map((transaction, index) => <li key={`${transaction.date}-${index}`}><span><strong>{transaction.description}</strong><small>{transaction.date} · {transaction.accountName}</small></span><b>{new Intl.NumberFormat("en-CA", { style: "currency", currency: item.currency }).format(transaction.amount)}</b></li>)}</ul></details>}<div><button name="scope" value="group" disabled={pending} className="review-primary">Apply to all matching</button>{item.similarCount > 1 && <button name="scope" value="one" disabled={pending}>Only this transaction</button>}<button type="button" onClick={() => { setChanging(true); setSelected(null); }}>Change</button><button name="choice" value="review-later">Review later</button></div></section> : <>
      <section><h4>1. Choose a World</h4><div className="review-worlds">{worlds.map((key) => { const visual = WORLD_VISUALS[key] ?? WORLD_VISUALS.future; return <button key={key} type="button" className={`review-world-object tone-${visual.tone}`} aria-pressed={world === key} onClick={() => { setWorld(key); setSelected(null); setCreating(false); }}><i aria-hidden="true" /><WorldIcon world={visual.world} /><strong>{WORLD_LABELS[key] ?? key}</strong></button>; })}</div></section>
      {world && <section><h4>2. What did it mean?</h4><div className="review-meanings">{choices.map((suggestion) => <button key={suggestion.id} type="button" aria-pressed={selected?.id === suggestion.id} onClick={() => setSelected(suggestion)}><strong>{suggestion.label}</strong><small>{suggestion.path}</small></button>)}<button type="button" onClick={() => { setCreating(true); setSelected(null); }}>+ New</button></div></section>}
      {creating && <section className="review-new"><label>Describe it naturally<input autoFocus value={phrase} onChange={(event) => setPhrase(event.target.value)} placeholder="House maintenance, Lexus service…" /></label><p>Vorvex will propose an existing safe meaning when one fits. It will not silently invent or force a category.</p>{phrase && choices.length > 0 && <div className="review-meanings">{choices.map((suggestion) => <button key={suggestion.id} type="button" onClick={() => setSelected(suggestion)}><strong>{suggestion.label}</strong><small>{suggestion.path}</small></button>)}</div>}{phrase && choices.length === 0 && <p role="status">No supported meaning safely matches yet. Choose Review later; a genuinely new meaning requires a governed product addition.</p>}</section>}
      <footer><button name="scope" value="group" disabled={pending || !selected} className="review-primary">Confirm{item.similarCount > 1 ? ` for all ${item.similarCount}` : ""}</button>{item.similarCount > 1 && <button name="scope" value="one" disabled={pending || !selected}>Only this transaction</button>}<button name="choice" value="review-later" disabled={pending}>Review later</button></footer>
    </>}
    {state.message && <p aria-live="polite" className="review-error">{state.message}</p>}
  </form>;
}
