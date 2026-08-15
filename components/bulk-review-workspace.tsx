"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BrowserReviewItem, BrowserReviewSuggestion } from "@/types/review-interface";
import type { FinancialMeaning } from "@/types/transactions";

const WORLD_LABELS: Record<string, string> = { cash: "Lifestyle", home: "Home", vehicle: "Vehicle", investments: "Investments", creditDebt: "Liabilities", income: "Income", future: "Other", upcoming: "Upcoming" };
const dateLabel = (date: string | null) => date ? new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`)) : "Date unavailable";
const moneyLabel = (amount: number, direction: "inflow" | "outflow" | "unknown", currency: string) => `${direction === "inflow" ? "+" : direction === "outflow" ? "−" : ""}${new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(Math.abs(amount))}`;

type Row = {
  token: string; date: string | null; description: string; account: string; amount: number;
  direction: "inflow" | "outflow" | "unknown"; currency: string; world: string | null;
  category: string | null; meaning: string; suggestions: readonly BrowserReviewSuggestion[];
};

export default function BulkReviewWorkspace({ items }: { items: readonly BrowserReviewItem[] }) {
  const router = useRouter();
  const rows = useMemo<Row[]>(() => items.flatMap((item) => item.representativeTransactions.map((transaction) => ({
    token: transaction.actionToken, date: transaction.date, description: transaction.description, account: transaction.accountName,
    amount: transaction.amount, direction: transaction.direction, currency: item.currency, world: item.currentWorld,
    category: item.currentCategory, meaning: item.currentFinancialMeaning, suggestions: item.suggestions,
  }))), [items]);
  const [search, setSearch] = useState(""); const [account, setAccount] = useState(""); const [direction, setDirection] = useState("");
  const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [understanding, setUnderstanding] = useState("");
  const [sort, setSort] = useState("date-desc"); const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const [world, setWorld] = useState<string | null>(null); const [choice, setChoice] = useState<BrowserReviewSuggestion | null>(null);
  const [creating, setCreating] = useState(false); const [phrase, setPhrase] = useState(""); const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ message: string; undoToken: string } | null>(null); const [error, setError] = useState("");
  const accounts = useMemo(() => [...new Set(rows.map((row) => row.account))].sort(), [rows]);
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("en-CA"); const meaningQuery = understanding.trim().toLocaleLowerCase("en-CA");
    const visible = rows.filter((row) => (!query || row.description.toLocaleLowerCase("en-CA").includes(query))
      && (!account || row.account === account) && (!direction || row.direction === direction)
      && (!from || Boolean(row.date && row.date >= from)) && (!to || Boolean(row.date && row.date <= to))
      && (!meaningQuery || `${row.world ?? ""} ${row.category ?? ""} ${row.meaning}`.toLocaleLowerCase("en-CA").includes(meaningQuery)));
    return [...visible].sort((left, right) => sort === "date-asc" ? (left.date ?? "").localeCompare(right.date ?? "")
      : sort === "description-asc" ? left.description.localeCompare(right.description)
      : sort === "description-desc" ? right.description.localeCompare(left.description)
      : sort === "amount-asc" ? left.amount - right.amount : sort === "amount-desc" ? right.amount - left.amount
      : (right.date ?? "").localeCompare(left.date ?? ""));
  }, [rows, search, account, direction, from, to, understanding, sort]);
  const selected = useMemo(() => rows.filter((row) => selectedTokens.includes(row.token)), [rows, selectedTokens]);
  const suggestions = useMemo(() => {
    const source = selected.length ? selected : filtered;
    return [...new Map(source.flatMap((row) => row.suggestions).map((suggestion) => [suggestion.id, suggestion])).values()];
  }, [selected, filtered]);
  const worlds = useMemo(() => [...new Set(suggestions.map((suggestion) => suggestion.world).filter(Boolean))] as string[], [suggestions]);
  const choices = useMemo(() => suggestions.filter((suggestion) => suggestion.world === world), [suggestions, world]);

  const toggle = (token: string) => setSelectedTokens((current) => current.includes(token) ? current.filter((value) => value !== token) : [...current, token]);
  const selectVisible = () => setSelectedTokens(filtered.map((row) => row.token));
  const submit = async () => {
    if (!choice || selected.length === 0) return; setPending(true); setError("");
    try {
      const response = await fetch("/api/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ actionTokens: selected.map((row) => row.token), choice: "classify", financialMeaning: choice.financialMeaning, category: choice.category, world: choice.world, userPhrase: phrase.trim() }) });
      const body = await response.json() as { message?: string; undoToken?: string };
      if (!response.ok || !body.undoToken) throw new Error();
      setResult({ message: body.message ?? `${selected.length} transactions categorized`, undoToken: body.undoToken }); setSelectedTokens([]); setChoice(null); setCreating(false); setPhrase(""); router.refresh();
    } catch { setError("The selected transactions could not be categorized. Nothing else was changed."); } finally { setPending(false); }
  };
  const undo = async () => {
    if (!result) return; setPending(true); setError("");
    try {
      const response = await fetch("/api/review", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ actionToken: result.undoToken, scope: "group" }) });
      if (!response.ok) throw new Error(); setResult(null); router.refresh();
    } catch { setError("Undo could not be completed. Use Recently Understood to inspect the affected decisions."); } finally { setPending(false); }
  };

  return <section className="bulk-review" aria-label="Bulk transaction review">
    <div className="bulk-review-toolbar">
      <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search merchant or description" aria-label="Search merchant or description" />
      <select value={account} onChange={(event) => setAccount(event.target.value)} aria-label="Filter by account"><option value="">All accounts</option>{accounts.map((name) => <option key={name}>{name}</option>)}</select>
      <select value={direction} onChange={(event) => setDirection(event.target.value)} aria-label="Filter by direction"><option value="">Inflow and outflow</option><option value="outflow">Outflow</option><option value="inflow">Inflow</option><option value="unknown">Unknown direction</option></select>
      <label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      <input value={understanding} onChange={(event) => setUnderstanding(event.target.value)} placeholder="World, category or meaning" aria-label="Filter by World category or meaning" />
      <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort transactions"><option value="date-desc">Newest date</option><option value="date-asc">Oldest date</option><option value="description-asc">Merchant A–Z</option><option value="description-desc">Merchant Z–A</option><option value="amount-desc">Largest amount</option><option value="amount-asc">Smallest amount</option></select>
    </div>
    <div className="bulk-selection-bar"><button type="button" onClick={selectVisible}>Select all visible ({filtered.length})</button><button type="button" onClick={() => setSelectedTokens([])}>Clear selection</button><strong>{selected.length} transaction{selected.length === 1 ? "" : "s"} selected</strong><span>{filtered.length} unresolved transaction{filtered.length === 1 ? "" : "s"} visible</span></div>
    <div className="bulk-table-wrap"><table><thead><tr><th><span className="sr-only">Select</span></th><th>Date</th><th>Merchant / description</th><th>Account</th><th>Current understanding</th><th>Amount</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.token} className={selectedTokens.includes(row.token) ? "is-selected" : ""}><td><input type="checkbox" checked={selectedTokens.includes(row.token)} onChange={() => toggle(row.token)} aria-label={`Select ${row.description} ${dateLabel(row.date)}`} /></td><td>{dateLabel(row.date)}</td><td><strong>{row.description}</strong><small>Unresolved</small></td><td>{row.account}</td><td>{[row.world ? WORLD_LABELS[row.world] ?? row.world : null, row.category ?? (row.meaning !== "unknown" ? row.meaning : null)].filter(Boolean).join(" · ") || "Unknown"}</td><td className={row.direction}>{moneyLabel(row.amount, row.direction, row.currency)}</td></tr>)}</tbody></table>{filtered.length === 0 && <p className="bulk-empty">No unresolved transactions match these filters.</p>}</div>
    {selected.length > 0 && <aside className="bulk-classifier" aria-label="Categorize selected transactions"><header><div><p>Categorize selected</p><h2>{selected.length} transaction{selected.length === 1 ? "" : "s"}</h2></div><details><summary>Inspect exactly what will change</summary><ul>{selected.map((row) => <li key={row.token}><span>{dateLabel(row.date)} · {row.description} · {row.account}</span><b>{moneyLabel(row.amount, row.direction, row.currency)}</b></li>)}</ul></details></header><h3>1. Choose a World</h3><div className="bulk-choice-row">{worlds.map((key) => <button type="button" key={key} aria-pressed={world === key} onClick={() => { setWorld(key); setChoice(null); setCreating(false); }}>{WORLD_LABELS[key] ?? key}</button>)}</div>{world && <><h3>2. Choose meaning or category</h3><div className="bulk-choice-row">{choices.map((suggestion) => <button type="button" key={suggestion.id} aria-pressed={choice?.id === suggestion.id} onClick={() => { setChoice(suggestion); setCreating(false); }}>{suggestion.label}</button>)}<button type="button" onClick={() => { setCreating(true); setChoice(null); }}>+ New</button></div></>}{creating && <div className="bulk-new"><label>New category<input autoFocus value={phrase} onChange={(event) => { setPhrase(event.target.value); setChoice(null); }} /></label>{phrase.trim() && world && <div className="bulk-choice-row">{(["expense", "income", "refund", "transfer", "fee"] as FinancialMeaning[]).map((meaning) => <button type="button" key={meaning} onClick={() => setChoice({ id: `new-${meaning}`, label: phrase.trim(), path: `${WORLD_LABELS[world]} → ${phrase.trim()}`, financialMeaning: meaning, category: phrase.trim(), world: world as BrowserReviewSuggestion["world"], reason: "Created by the Founder.", searchTerms: phrase.trim(), recommended: false })}>{meaning}</button>)}</div>}<button type="button" onClick={() => { setCreating(false); setPhrase(""); setChoice(null); }}>Cancel</button></div>}<footer><button type="button" className="review-primary" disabled={!choice || pending} onClick={submit}>Confirm {selected.length}</button></footer></aside>}
    {result && <div className="bulk-result" role="status"><strong>{result.message}</strong><button type="button" onClick={undo} disabled={pending}>Undo</button></div>}{error && <p className="review-error" role="alert">{error}</p>}
  </section>;
}
