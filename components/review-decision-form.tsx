"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { BrowserReviewItem, BrowserReviewSuggestion } from "@/types/review-interface";
import type { FinancialMeaning } from "@/types/transactions";
import { WorldIcon, type WorldKey } from "@/components/financial-home";

const WORLD_LABELS: Record<string, string> = { cash: "Lifestyle", home: "Home", vehicle: "Vehicle", investments: "Investments", creditDebt: "Liabilities", income: "Income", future: "Other", upcoming: "Upcoming" };
const WORLD_VISUALS: Record<string, { world: WorldKey; tone: string }> = { cash: { world: "lifestyle", tone: "coral" }, home: { world: "home", tone: "amber" }, vehicle: { world: "vehicle", tone: "cyan" }, investments: { world: "investments", tone: "violet" }, creditDebt: { world: "liabilities", tone: "rose" }, income: { world: "cashflow", tone: "mint" }, future: { world: "cashflow", tone: "blue" }, upcoming: { world: "cashflow", tone: "blue" } };

export default function ReviewDecisionForm({ item }: { item: BrowserReviewItem }) {
  const router = useRouter();
  const recommendation = item.suggestions.find((suggestion) => suggestion.recommended) ?? null;
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [undoPending, setUndoPending] = useState(false);
  const [undoScope, setUndoScope] = useState<"one" | "subset" | "group">("group");
  const [undoIndexes, setUndoIndexes] = useState<number[]>([]);
  const [selected, setSelected] = useState<BrowserReviewSuggestion | null>(recommendation);
  const [world, setWorld] = useState<string | null>(recommendation?.world ?? null);
  const [changing, setChanging] = useState(!recommendation);
  const [creating, setCreating] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>(() => item.representativeTransactions.map((_, index) => index));
  const correctionRef = useRef<HTMLElement>(null);
  const worlds = useMemo(() => [...new Set(item.suggestions.map((suggestion) => suggestion.world).filter(Boolean))] as string[], [item.suggestions]);
  const choices = useMemo(() => item.suggestions.filter((suggestion) => suggestion.world === world && (!phrase.trim() || `${suggestion.label} ${suggestion.path} ${suggestion.searchTerms}`.toLowerCase().includes(phrase.trim().toLowerCase()))).slice(0, 6), [item.suggestions, phrase, world]);

  useEffect(() => {
    if (!changing) return;
    correctionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    correctionRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  }, [changing]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const choice = submitter?.name === "choice" ? submitter.value : "classify";
    const scope = submitter?.name === "scope" && submitter.value === "group" ? "group" : submitter?.name === "scope" && submitter.value === "subset" ? "subset" : "one";
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actionToken: item.actionToken, choice, financialMeaning: selected?.financialMeaning, category: selected?.category, world: selected?.world, scope, selectedIndexes, userPhrase: phrase.trim() }) });
      const result = await response.json() as { message?: string };
      setMessage(result.message ?? "Review could not be saved."); setStatus(response.ok ? "saved" : "error");
      if (response.ok) setUndoScope(choice === "review-later" ? "group" : scope);
      if (response.ok) setUndoIndexes(scope === "subset" ? selectedIndexes : []);
      if (response.ok) window.setTimeout(() => router.refresh(), 1600);
    } catch { setMessage("Review could not be saved. Refresh and try again."); setStatus("error"); }
    finally { setPending(false); }
  };
  const undo = async () => {
    setUndoPending(true);
    try {
      const response = await fetch("/api/review", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ actionToken: item.actionToken, scope: undoScope, selectedIndexes: undoIndexes }) });
      const result = await response.json() as { message?: string };
      setMessage(result.message ?? "Undo could not be completed.");
      if (response.ok) setStatus("idle");
    } catch { setMessage("Undo could not be completed. Refresh and use Change."); }
    finally { setUndoPending(false); }
  };

  if (status === "saved") return <div className="review-done" role="status"><strong>{message}</strong><button type="button" onClick={undo} disabled={undoPending}>Undo</button><small>Moving to the next useful decision…</small></div>;

  return <form onSubmit={submit} className="review-journey">
    <input type="hidden" name="actionToken" value={item.actionToken} /><input type="hidden" name="choice" value="classify" />
    <input type="hidden" name="financialMeaning" value={selected?.financialMeaning ?? ""} /><input type="hidden" name="category" value={selected?.category ?? ""} /><input type="hidden" name="world" value={selected?.world ?? ""} /><input type="hidden" name="userPhrase" value={phrase.trim()} />
    {item.similarCount > 1 && <details className="review-matches"><summary>Choose from all {item.similarCount} affected transactions</summary><div className="review-selection-tools"><button type="button" onClick={() => setSelectedIndexes(item.representativeTransactions.map((_, index) => index))}>Select all</button><button type="button" onClick={() => setSelectedIndexes([])}>Clear</button><strong>{selectedIndexes.length} selected</strong></div><ul>{item.representativeTransactions.map((transaction, index) => <li key={`${transaction.date}-${index}`}><label><input type="checkbox" checked={selectedIndexes.includes(index)} onChange={() => setSelectedIndexes((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index].sort((left, right) => left - right))} /><span><strong>{transaction.description}</strong><small>{transaction.date} · {transaction.accountName}</small></span><b>{new Intl.NumberFormat("en-CA", { style: "currency", currency: item.currency }).format(transaction.amount)}</b></label></li>)}</ul></details>}
    {recommendation && !changing ? <section className="review-recommendation"><p>Vorvex thinks this was</p><strong>{recommendation.path}</strong><small>{recommendation.reason}</small><div><button name="scope" value={selectedIndexes.length === item.similarCount ? "group" : "subset"} disabled={pending || selectedIndexes.length === 0} className="review-primary">Apply to {selectedIndexes.length} selected</button>{item.similarCount > 1 && <button name="scope" value="one" disabled={pending}>Only this transaction</button>}<button type="button" onClick={() => { setChanging(true); setSelected(null); }}>Change</button><button name="choice" value="review-later">Review later</button></div></section> : <section ref={correctionRef} className="review-correction"><section><h4>1. Choose a World</h4><div className="review-worlds">{worlds.map((key) => { const visual = WORLD_VISUALS[key] ?? WORLD_VISUALS.future; return <button key={key} type="button" className={`review-world-object tone-${visual.tone}`} aria-pressed={world === key} onClick={() => { setWorld(key); setSelected(null); setCreating(false); }}><i aria-hidden="true" /><strong>{WORLD_LABELS[key] ?? key}</strong><WorldIcon world={visual.world} /><small>Choose</small></button>; })}</div></section>
      {world && <section><h4>2. What did it mean?</h4><div className="review-meanings">{choices.map((suggestion) => <button key={suggestion.id} type="button" aria-pressed={selected?.id === suggestion.id} onClick={() => setSelected(suggestion)}><strong>{suggestion.label}</strong><small>{suggestion.path}</small></button>)}<button type="button" onClick={() => { setCreating(true); setSelected(null); }}>+ New</button></div></section>}
      {creating && <section className="review-new"><label>New category<input autoFocus value={phrase} onChange={(event) => { setPhrase(event.target.value); setSelected(null); }} placeholder="Childcare, Pet care…" /></label><p>Name the category, then choose what kind of money movement it is.</p>{phrase.trim() && world && <div className="review-meanings">{(["expense", "income", "refund", "transfer", "fee"] as FinancialMeaning[]).map((meaning) => <button key={meaning} type="button" aria-pressed={selected?.id === `new-${meaning}`} onClick={() => setSelected({ id: `new-${meaning}`, label: phrase.trim(), path: `${WORLD_LABELS[world] ?? world} → ${phrase.trim()}`, financialMeaning: meaning, category: phrase.trim(), world: world as BrowserReviewSuggestion["world"], reason: "Created by the Founder.", searchTerms: phrase.trim(), recommended: false })}><strong>{meaning.replaceAll("-", " ")}</strong><small>{phrase.trim()}</small></button>)}</div>}<button type="button" onClick={() => { setCreating(false); setPhrase(""); setSelected(null); }}>Cancel</button></section>}
      <footer><button name="scope" value={item.similarCount > 1 && selectedIndexes.length < item.similarCount ? "subset" : item.similarCount > 1 ? "group" : "one"} disabled={pending || !selected || (item.similarCount > 1 && selectedIndexes.length === 0)} className="review-primary">Confirm{item.similarCount > 1 ? ` for ${selectedIndexes.length} selected` : ""}</button>{item.similarCount > 1 && <button name="scope" value="one" disabled={pending || !selected}>Only this transaction</button>}<button name="choice" value="review-later" disabled={pending}>Review later</button></footer>
    </section>}
    {message && <p aria-live="polite" className="review-error">{message}</p>}
  </form>;
}
