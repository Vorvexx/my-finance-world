"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  computeNetWorthSummary,
  emptyForm,
  expectedCashFlows,
  formatCurrency,
  formatExactCurrency,
  formatUpdateTimestamp,
  getGroupAccounts,
  getGroupTotal,
  groups,
  sampleAccounts,
  sampleCashFlows,
  STORAGE_KEY,
  timeRanges,
  UPDATED_KEY,
} from "@/lib/constants/sample-data";
import type { AccountForm, CashFlow, FinancialAccount, GroupKey, TimeRangeKey } from "@/lib/constants/sample-data";

const groupIcons: Record<GroupKey, string> = {
  cash: "↙",
  investments: "↗",
  property: "⌂",
  debts: "−",
  other: "◇",
};

const sumFlows = (flows: CashFlow[]) => flows.reduce((sum, item) => sum + item.amount, 0);

export default function Home() {
  const [accounts, setAccounts] = useState<FinancialAccount[]>(sampleAccounts);
  const [loaded, setLoaded] = useState(false);
  const [range, setRange] = useState<TimeRangeKey>("month");
  const [selectedGroup, setSelectedGroup] = useState<GroupKey | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountForm>(emptyForm);
  const [lastUpdated, setLastUpdated] = useState("Sample snapshot");

  useEffect(() => {
    const savedAccounts = localStorage.getItem(STORAGE_KEY);
    const savedUpdatedTime = localStorage.getItem(UPDATED_KEY);
    const frame = requestAnimationFrame(() => {
      if (savedAccounts) {
        try {
          setAccounts(JSON.parse(savedAccounts) as FinancialAccount[]);
        } catch {
          setAccounts(sampleAccounts);
        }
      }
      if (savedUpdatedTime) setLastUpdated(savedUpdatedTime);
      setLoaded(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  }, [accounts, loaded]);

  const { totalAssets, totalLiabilities, netWorth } = useMemo(
    () => computeNetWorthSummary(accounts),
    [accounts],
  );

  const selectedRange = timeRanges.find((item) => item.key === range) ?? timeRanges[3];
  const rangeFlows = sampleCashFlows.filter((item) => item.daysAgo <= selectedRange.days);
  const inflows = rangeFlows.filter((item) => item.direction === "inflow");
  const outflows = rangeFlows.filter((item) => item.direction === "outflow");
  const totalInflow = sumFlows(inflows);
  const totalOutflow = sumFlows(outflows);
  const cashMovement = totalInflow - totalOutflow;

  const topInflows = [...inflows].sort((a, b) => b.amount - a.amount).slice(0, 3);
  const topOutflows = [...outflows].sort((a, b) => b.amount - a.amount).slice(0, 3);
  const categoryTotals = (() => {
    const totals = new Map<string, number>();
    outflows.forEach((item) => totals.set(item.category, (totals.get(item.category) ?? 0) + item.amount));
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  })();
  const maxCategory = categoryTotals[0]?.[1] ?? 1;

  const openAccountForm = (group: GroupKey = "cash", account?: FinancialAccount) => {
    setEditingId(account?.id ?? null);
    setForm(account ? {
      name: account.name,
      institution: account.institution,
      balance: String(account.balance),
      type: account.type,
      group: account.group,
    } : { ...emptyForm, group, type: groups.find((item) => item.key === group)?.defaultType ?? "asset" });
    setIsModalOpen(true);
  };

  const saveAccount = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const balance = Number(form.balance.replace(/[$,\s]/g, ""));
    if (!form.name.trim() || Number.isNaN(balance) || balance < 0) return;
    const updatedAt = formatUpdateTimestamp();
    const nextAccount = { ...form, balance, name: form.name.trim(), institution: form.institution.trim(), updatedAt };
    setAccounts((current) => editingId
      ? current.map((item) => item.id === editingId ? { ...item, ...nextAccount } : item)
      : [...current, { ...nextAccount, id: crypto.randomUUID() }]);
    setLastUpdated(updatedAt);
    localStorage.setItem(UPDATED_KEY, updatedAt);
    setIsModalOpen(false);
    setEditingId(null);
  };

  const deleteAccount = () => {
    if (!editingId || !window.confirm("Delete this financial account?")) return;
    setAccounts((current) => current.filter((item) => item.id !== editingId));
    setIsModalOpen(false);
  };

  const insight = totalOutflow === 0
    ? `No outflows are recorded for this ${selectedRange.label.toLowerCase()}. Your upcoming plan is still visible below.`
    : cashMovement >= 0
      ? `You kept ${formatCurrency(cashMovement)} more than you spent this ${selectedRange.label.toLowerCase()}. ${categoryTotals[0]?.[0] ?? "Your largest category"} was your largest spending area.`
      : `Outflows exceeded inflows by ${formatCurrency(Math.abs(cashMovement))} this ${selectedRange.label.toLowerCase()}. ${categoryTotals[0]?.[0] ?? "Your largest category"} is the first place worth reviewing.`;

  return (
    <main className="min-h-screen bg-[#071018] text-[#f4f7f5]">
      <div className="mx-auto max-w-[1440px] px-5 py-6 md:px-9 md:py-9">
        <header className="flex flex-col justify-between gap-5 border-b border-white/10 pb-7 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.26em] text-emerald-400">My Finance World</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Good afternoon, Inder.</h1>
            <p className="mt-2 text-sm text-slate-400">Here is the shape of your world today · {lastUpdated}</p>
          </div>
          <button onClick={() => openAccountForm()} className="rounded-full bg-emerald-400 px-5 py-3 text-sm font-bold text-[#071018] transition hover:bg-emerald-300">
            Update my numbers
          </button>
        </header>

        <nav aria-label="Dashboard time range" className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {timeRanges.map((item) => (
            <button key={item.key} onClick={() => setRange(item.key)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm transition ${range === item.key ? "bg-white text-slate-950" : "border border-white/10 text-slate-400 hover:border-white/25 hover:text-white"}`}>
              {item.label}
            </button>
          ))}
        </nav>

        <section className="mt-6 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <article className="relative overflow-hidden rounded-[32px] border border-emerald-400/20 bg-[radial-gradient(circle_at_25%_20%,rgba(52,211,153,0.17),transparent_42%),#0b1821] p-7 md:p-9">
            <p className="text-sm font-medium text-emerald-200">Your current net worth</p>
            <p className="mt-3 text-5xl font-semibold tracking-[-0.06em] md:text-7xl">{formatCurrency(netWorth)}</p>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">What you own, minus what you owe. This is your present position—not a score, and never a judgment.</p>
            <div className="mt-9 grid grid-cols-2 gap-3 md:max-w-lg">
              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <p className="text-xs text-slate-500">Assets</p>
                <p className="mt-1 text-lg font-semibold text-emerald-300">{formatCurrency(totalAssets)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <p className="text-xs text-slate-500">Liabilities</p>
                <p className="mt-1 text-lg font-semibold text-rose-300">{formatCurrency(totalLiabilities)}</p>
              </div>
            </div>
          </article>

          <article className="rounded-[32px] border border-white/10 bg-[#0b1821] p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Cash movement</p>
                <p className={`mt-2 text-3xl font-semibold ${cashMovement >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{cashMovement >= 0 ? "+" : "−"}{formatCurrency(Math.abs(cashMovement))}</p>
              </div>
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-400">{selectedRange.label}</span>
            </div>
            <div className="mt-8 space-y-5">
              <div>
                <div className="flex justify-between text-sm"><span className="text-slate-400">Money in</span><span className="text-emerald-300">{formatCurrency(totalInflow)}</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, totalInflow / Math.max(totalInflow, totalOutflow, 1) * 100)}%` }} /></div>
              </div>
              <div>
                <div className="flex justify-between text-sm"><span className="text-slate-400">Money out</span><span className="text-rose-300">{formatCurrency(totalOutflow)}</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-rose-400" style={{ width: `${Math.min(100, totalOutflow / Math.max(totalInflow, totalOutflow, 1) * 100)}%` }} /></div>
              </div>
            </div>
            <p className="mt-8 rounded-2xl bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">{insight}</p>
          </article>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          <FlowCard title="Top inflows" subtitle={`Largest additions this ${selectedRange.label.toLowerCase()}`} flows={topInflows} tone="green" />
          <FlowCard title="Top outflows" subtitle={`Largest commitments this ${selectedRange.label.toLowerCase()}`} flows={topOutflows} tone="rose" />
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-[28px] border border-white/10 bg-[#0b1821] p-6 md:p-7">
            <div className="flex items-end justify-between gap-4">
              <div><h2 className="text-xl font-semibold">Spending by category</h2><p className="mt-1 text-sm text-slate-500">Select a category to see what shaped it</p></div>
              <p className="text-sm text-slate-400">{formatCurrency(totalOutflow)} total</p>
            </div>
            <div className="mt-7 space-y-3">
              {categoryTotals.length ? categoryTotals.map(([category, amount]) => (
                <button key={category} onClick={() => setSelectedCategory(selectedCategory === category ? null : category)} className="group w-full rounded-2xl border border-transparent p-3 text-left transition hover:border-white/10 hover:bg-white/[0.03]">
                  <div className="flex items-center justify-between text-sm"><span>{category}</span><span className="text-slate-300">{formatCurrency(amount)}</span></div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-orange-400" style={{ width: `${amount / maxCategory * 100}%` }} /></div>
                  {selectedCategory === category && <div className="mt-4 space-y-2 border-t border-white/10 pt-3">{outflows.filter((item) => item.category === category).map((item) => <div key={item.id} className="flex justify-between text-xs text-slate-400"><span>{item.label}</span><span>{formatExactCurrency(item.amount)}</span></div>)}</div>}
                </button>
              )) : <EmptyState text="No spending in this range" />}
            </div>
          </article>

          <article className="rounded-[28px] border border-white/10 bg-[#0b1821] p-6 md:p-7">
            <h2 className="text-xl font-semibold">Coming up</h2>
            <p className="mt-1 text-sm text-slate-500">Expected over the next few weeks</p>
            <div className="mt-6 space-y-3">
              {expectedCashFlows.map((item) => (
                <div key={item.id} className="flex items-center gap-4 rounded-2xl bg-white/[0.035] p-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${item.direction === "inflow" ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"}`}>{item.direction === "inflow" ? "↓" : "↑"}</div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.label}</p><p className="mt-1 text-xs text-slate-500">In {item.dueInDays} days</p></div>
                  <p className={`text-sm font-semibold ${item.direction === "inflow" ? "text-emerald-300" : "text-rose-300"}`}>{item.direction === "inflow" ? "+" : "−"}{formatCurrency(item.amount)}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-5 rounded-[28px] border border-violet-400/20 bg-[linear-gradient(135deg,rgba(139,92,246,0.12),rgba(11,24,33,1)_55%)] p-6 md:flex md:items-center md:justify-between md:p-8">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">Your contextual summary</p>
            <h2 className="mt-3 text-2xl font-semibold">Your position is stable, with one near-term commitment to watch.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400">You have {formatCurrency(totalAssets - totalLiabilities)} in net worth and {formatCurrency(getGroupTotal(accounts, "cash"))} in cash. Your next salary arrives before the mortgage payment, leaving an expected buffer of {formatCurrency(expectedCashFlows[0].amount - expectedCashFlows[1].amount)} between those two events.</p>
          </div>
          <div className="mt-5 rounded-2xl border border-violet-300/15 bg-black/15 px-5 py-4 text-sm text-violet-200 md:ml-8 md:mt-0 md:max-w-xs">“Show me what changed” and richer questions can come next. For now, this summary is calculated locally from your snapshot.</div>
        </section>

        <section className="mt-10">
          <div className="flex items-end justify-between"><div><h2 className="text-xl font-semibold">Your worlds</h2><p className="mt-1 text-sm text-slate-500">Open a world to manage its balances. Detailed activity stays out of the way until you choose to drill in.</p></div></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {groups.map((group) => {
              const groupAccounts = getGroupAccounts(accounts, group.key);
              const isOpen = selectedGroup === group.key;
              return <article key={group.key} className={`rounded-3xl border p-5 transition ${isOpen ? "border-emerald-400/40 bg-emerald-400/[0.07]" : "border-white/10 bg-[#0b1821]"}`}>
                <button onClick={() => setSelectedGroup(isOpen ? null : group.key)} className="w-full text-left">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-lg text-emerald-300">{groupIcons[group.key]}</span>
                  <p className="mt-5 font-semibold">{group.name}</p><p className="mt-1 text-xl font-semibold">{formatCurrency(getGroupTotal(accounts, group.key))}</p><p className="mt-2 text-xs text-slate-500">{groupAccounts.length} balance{groupAccounts.length === 1 ? "" : "s"} · {isOpen ? "Close" : "Open world"}</p>
                </button>
                {isOpen && <div className="mt-4 space-y-2 border-t border-white/10 pt-4">{groupAccounts.map((account) => <button key={account.id} onClick={() => openAccountForm(group.key, account)} className="flex w-full justify-between gap-3 rounded-xl p-2 text-left text-xs hover:bg-white/5"><span className="truncate text-slate-400">{account.name}</span><span>{formatCurrency(account.type === "asset" ? account.balance : -account.balance)}</span></button>)}<button onClick={() => openAccountForm(group.key)} className="mt-2 text-xs font-semibold text-emerald-300">+ Add a balance</button></div>}
              </article>;
            })}
          </div>
        </section>
      </div>

      {isModalOpen && <AccountModal form={form} setForm={setForm} editingId={editingId} onClose={() => setIsModalOpen(false)} onSave={saveAccount} onDelete={deleteAccount} />}
    </main>
  );
}

function FlowCard({ title, subtitle, flows, tone }: { title: string; subtitle: string; flows: CashFlow[]; tone: "green" | "rose" }) {
  return <article className="rounded-[28px] border border-white/10 bg-[#0b1821] p-6 md:p-7"><h2 className="text-xl font-semibold">{title}</h2><p className="mt-1 text-sm text-slate-500">{subtitle}</p><div className="mt-6 space-y-3">{flows.length ? flows.map((item, index) => <div key={item.id} className="flex items-center gap-4 rounded-2xl bg-white/[0.035] p-4"><span className="text-sm font-semibold text-slate-600">0{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.label}</p><p className="mt-1 text-xs text-slate-500">{item.category}</p></div><p className={`text-sm font-semibold ${tone === "green" ? "text-emerald-300" : "text-rose-300"}`}>{tone === "green" ? "+" : "−"}{formatCurrency(item.amount)}</p></div>) : <EmptyState text="Nothing recorded in this range" />}</div></article>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">{text}</div>;
}

function AccountModal({ form, setForm, editingId, onClose, onSave, onDelete }: { form: AccountForm; setForm: React.Dispatch<React.SetStateAction<AccountForm>>; editingId: string | null; onClose: () => void; onSave: (event: FormEvent<HTMLFormElement>) => void; onDelete: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"><div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-[#0b1821] p-6 shadow-2xl"><div className="flex justify-between gap-4"><div><p className="text-sm text-emerald-400">Manual financial snapshot</p><h2 className="mt-1 text-2xl font-semibold">{editingId ? "Update balance" : "Add a balance"}</h2></div><button onClick={onClose} className="text-sm text-slate-400 hover:text-white">Close</button></div><form onSubmit={onSave} className="mt-6 space-y-4">
    <label className="block text-sm text-slate-300">World<select value={form.group} onChange={(event) => { const group = event.target.value as GroupKey; setForm((current) => ({ ...current, group, type: groups.find((item) => item.key === group)?.defaultType ?? current.type })); }} className="mt-2 w-full rounded-xl border border-white/10 bg-[#071018] px-4 py-3">{groups.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}</select></label>
    <div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => setForm((current) => ({ ...current, type: "asset" }))} className={`rounded-xl border p-3 text-sm ${form.type === "asset" ? "border-emerald-400 text-emerald-300" : "border-white/10 text-slate-500"}`}>Asset</button><button type="button" onClick={() => setForm((current) => ({ ...current, type: "liability" }))} className={`rounded-xl border p-3 text-sm ${form.type === "liability" ? "border-rose-400 text-rose-300" : "border-white/10 text-slate-500"}`}>Liability</button></div>
    <label className="block text-sm text-slate-300">Name<input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Everyday chequing" className="mt-2 w-full rounded-xl border border-white/10 bg-[#071018] px-4 py-3 outline-none focus:border-emerald-400" /></label>
    <label className="block text-sm text-slate-300">Institution or note<input value={form.institution} onChange={(event) => setForm((current) => ({ ...current, institution: event.target.value }))} placeholder="TD Bank" className="mt-2 w-full rounded-xl border border-white/10 bg-[#071018] px-4 py-3 outline-none focus:border-emerald-400" /></label>
    <label className="block text-sm text-slate-300">Current balance<input required min="0" step="0.01" type="number" value={form.balance} onChange={(event) => setForm((current) => ({ ...current, balance: event.target.value }))} placeholder="0.00" className="mt-2 w-full rounded-xl border border-white/10 bg-[#071018] px-4 py-3 outline-none focus:border-emerald-400" /></label>
    <button type="submit" className="w-full rounded-xl bg-emerald-400 px-5 py-3 font-bold text-slate-950">Save balance</button>{editingId && <button type="button" onClick={onDelete} className="w-full rounded-xl border border-rose-400/20 px-5 py-3 text-sm text-rose-300">Delete balance</button>}
  </form></div></div>;
}
