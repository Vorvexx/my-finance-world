"use client";

import { useEffect, useState } from "react";
import type { PeriodKey, PrototypeView } from "@/types/prototype";

const cad = (value: number | null) => value == null ? "Unknown" : new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value);
const periods: Array<{ key: PeriodKey; label: string }> = [{ key: "day", label: "Day" }, { key: "week", label: "Week" }, { key: "fortnight", label: "Fortnight" }, { key: "month", label: "Month" }, { key: "quarter", label: "Quarter" }, { key: "year", label: "Year" }];
const worldMeta = { cash: ["Cash", "Available position", "◉"], cashflow: ["Cashflow", "Movement through time", "↕"], lifestyle: ["Lifestyle", "How life appears in money", "✦"], liabilities: ["Liabilities", "Recorded commitments", "−"], home: ["Home", "Property world", "⌂"], vehicle: ["Vehicle", "Mobility world", "◇"], statements: ["Statements", "Financial evidence", "▤"], review: ["Review", "Your context", "?"], } as const;

export default function FinancialHome() {
  const [period, setPeriod] = useState<PeriodKey>("month"); const [view, setView] = useState<PrototypeView | null>(null);
  const [loading, setLoading] = useState(true); const [notice, setNotice] = useState(""); const [selected, setSelected] = useState<keyof typeof worldMeta | null>("cashflow");
  const [question, setQuestion] = useState("What happened financially this month?"); const [answer, setAnswer] = useState(""); const [asking, setAsking] = useState(false);
  const load = async (nextPeriod = period) => { setLoading(true); setNotice(""); try { const response = await fetch(`/api/prototype?period=${nextPeriod}`, { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setView(data); } catch (error) { setNotice(error instanceof Error ? error.message : "Financial state is unavailable."); } finally { setLoading(false); } };
  useEffect(() => {
    let active = true;
    fetch(`/api/prototype?period=${period}`, { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => { if (!response.ok) throw new Error(data.error); if (active) setView(data); })
      .catch((error: unknown) => { if (active) setNotice(error instanceof Error ? error.message : "Financial state is unavailable."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [period]);
  const scan = async () => { setLoading(true); const response = await fetch("/api/prototype/scan", { method: "POST" }); const result = await response.json(); setNotice(response.ok ? `${result.processed} statement(s) processed · ${result.duplicates} duplicate(s) · ${result.quarantined} quarantined${result.errors?.length ? ` — ${result.errors.join(" ")}` : ""}` : result.error); await load(); };
  const ask = async () => { if (!question.trim()) return; setAsking(true); const response = await fetch("/api/prototype/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, period }) }); const result = await response.json(); setAnswer(result.answer ?? result.error); setAsking(false); };
  const correct = async (id: string) => { const category = window.prompt("What category should this be?", "Other"); if (!category) return; await fetch("/api/prototype/corrections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactionId: id, world: "future", category }) }); await load(); };
  return <main className="universe-shell">
    <header className="topbar"><div><p className="eyebrow">VORVEX · MY FINANCE WORLD</p><h1>Your living financial universe</h1></div><div className="top-actions"><span className={`coverage ${view?.coverage.status ?? "empty"}`}>{view?.coverage.status ?? "Loading"} history</span><button onClick={scan} disabled={loading}>Scan inbox</button></div></header>
    <nav className="periods" aria-label="Financial period">{periods.map((item) => <button key={item.key} className={period === item.key ? "active" : ""} onClick={() => setPeriod(item.key)}>{item.label}</button>)}</nav>
    {notice && <div className="notice" role="status">{notice}</div>}
    {loading && !view ? <section className="loading-state">Constructing your financial universe…</section> : view && <>
      <section className="person-core"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="person"><span>YOU</span><strong>{cad(view.totals.net)}</strong><small>net movement · {view.period.label}</small></div><div className="pulse inflow"><small>Inflows</small><strong>{cad(view.totals.inflow)}</strong></div><div className="pulse outflow"><small>Spending</small><strong>{cad(view.totals.spending)}</strong></div></section>
      <section className="coverage-panel"><div><strong>{view.coverage.message}</strong><span>Available: {view.coverage.availableStart ?? "Unknown"} → {view.coverage.availableEnd ?? "Unknown"}</span></div>{view.coverage.missingRanges.length > 0 && <span>Missing: {view.coverage.missingRanges.slice(0, 2).join(", ")}</span>}</section>
      <section className="world-grid">{Object.entries(worldMeta).map(([key, meta]) => { const world = view.worlds[key as keyof typeof view.worlds]; return <article key={key} className={`world-card ${selected === key ? "selected" : ""}`}><button onClick={() => setSelected(selected === key ? null : key as keyof typeof worldMeta)}><span className="world-icon">{meta[2]}</span><span><small>{meta[1]}</small><strong>{meta[0]}</strong></span><b>{cad(world.value)}</b></button><p>{world.detail}</p><span className={`state ${world.status}`}>{world.status}</span></article>; })}</section>
      <section className="intelligence-grid">
        <article className="panel"><p className="eyebrow">SIGNIFICANT MOVEMENTS</p><h2>What shaped this period</h2><div className="movement-list">{view.significant.length ? view.significant.map((item) => <div key={item.id}><span><strong>{item.name}</strong><small>{item.date} · {item.category}</small></span><b className={item.direction}>{item.direction === "inflow" ? "+" : "−"}{cad(item.amount)}</b></div>) : <p className="empty">No recorded movements in this period.</p>}</div></article>
        <article className="panel"><p className="eyebrow">LIFESTYLE SIGNALS</p><h2>Spending by context</h2><div className="category-list">{view.categories.slice(0, 5).map((category) => <div key={category.category}><span>{category.category}</span><span className="bar"><i style={{ width: `${Math.max(8, category.amount / Math.max(view.categories[0]?.amount ?? 1, 1) * 100)}%` }}/></span><b>{cad(category.amount)}</b></div>)}{!view.categories.length && <p className="empty">Categories will appear when statements provide spending evidence.</p>}</div>{view.previous && <p className="comparison">Previous-period spending: {cad(view.previous.spending)}</p>}</article>
        <article className="panel review-panel"><p className="eyebrow">NEEDS REVIEW</p><h2>{view.review.length} item{view.review.length === 1 ? "" : "s"} need your context</h2>{view.review.slice(0, 4).map((item) => <button key={item.id} onClick={() => correct(item.id)}><span>{item.name}<small>{item.date}</small></span><b>{cad(item.amount)}</b></button>)}{!view.review.length && <p className="empty">Everything currently has a supported classification.</p>}</article>
      </section>
      <section className="assistant-panel"><div><p className="eyebrow">VORVEX ASSISTANT · LOCAL & GROUNDED</p><h2>Ask your financial world</h2><p>Answers come only from canonical data. Partial and Unknown remain explicit.</p></div><div className="assistant-box"><div className="ask-row"><input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void ask()} aria-label="Ask Vorvex"/><button onClick={ask} disabled={asking}>{asking ? "Reading…" : "Ask"}</button></div>{answer && <div className="answer">{answer}</div>}<div className="suggestions">{["How much did I spend?", "What needs review?", "What data is missing?"].map((text) => <button key={text} onClick={() => setQuestion(text)}>{text}</button>)}</div></div></section>
    </>}
    <footer>Local financial data never leaves this device · State {view?.updatedAt ? `saved ${new Date(view.updatedAt).toLocaleString("en-CA")}` : "not yet created"}</footer>
  </main>;
}
