"use client";

import { useState } from "react";
import type { CanonicalFinancialModel, MoneyWorldKey } from "@/types/finance";

const formatMoney = (value: number, currency: string) =>
  new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const worldDefinitions: ReadonlyArray<{
  key: MoneyWorldKey;
  name: string;
  description: string;
  icon: string;
}> = [
  { key: "cash", name: "Cash", description: "Money available now", icon: "↙" },
  { key: "investments", name: "Investments", description: "Long-term financial assets", icon: "↗" },
  { key: "home", name: "Home", description: "Property and related commitments", icon: "⌂" },
  { key: "vehicle", name: "Vehicle", description: "Vehicle value and financing", icon: "◇" },
  { key: "creditDebt", name: "Credit / Debt", description: "Balances currently owed", icon: "−" },
  { key: "income", name: "Income", description: "Money entering your world", icon: "+" },
  { key: "upcoming", name: "Upcoming", description: "Known future financial events", icon: "○" },
  { key: "future", name: "Future Worlds", description: "Worlds not yet recorded", icon: "∞" },
];

export default function FinancialHome({ model }: { model: CanonicalFinancialModel }) {
  const [selectedWorld, setSelectedWorld] = useState<MoneyWorldKey | null>(null);
  const { summary, money, accountsByWorld, totalsByWorld } = model;
  const moneyLabel = (value: number | null | undefined) =>
    value == null ? "Unknown" : formatMoney(value, money.currency);

  return (
    <main className="min-h-screen bg-[#071018] text-[#f4f7f5]">
      <div className="mx-auto max-w-[1440px] px-5 py-6 md:px-9 md:py-9">
        <header className="border-b border-white/10 pb-7">
          <p className="text-xs font-bold uppercase tracking-[0.26em] text-emerald-400">My Finance World</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Your financial position</h1>
          <p className="mt-2 text-sm text-slate-400">
            {money.lastUpdated ? `Financial snapshot · ${money.lastUpdated}` : "Financial snapshot unavailable"}
          </p>
        </header>

        {model.status !== "loaded" && (
          <section className="mt-6 rounded-[28px] border border-amber-300/25 bg-amber-300/[0.07] p-6">
            <h2 className="text-lg font-semibold text-amber-100">{model.statusMessage}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Vorvex is ready, but financial values will remain Unknown until a valid private snapshot is available.
            </p>
          </section>
        )}

        <section className="mt-6 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <article className="relative overflow-hidden rounded-[32px] border border-emerald-400/20 bg-[radial-gradient(circle_at_25%_20%,rgba(52,211,153,0.17),transparent_42%),#0b1821] p-7 md:p-9">
            <p className="text-sm font-medium text-emerald-200">Your current net worth</p>
            <p className="mt-3 text-5xl font-semibold tracking-[-0.06em] md:text-7xl">
              {moneyLabel(summary?.netWorth)}
            </p>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">
              What is recorded as owned, minus what is recorded as owed. Unknown Worlds are excluded rather than estimated.
            </p>
            <div className="mt-9 grid grid-cols-2 gap-3 md:max-w-lg">
              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <p className="text-xs text-slate-500">Assets</p>
                <p className="mt-1 text-lg font-semibold text-emerald-300">{moneyLabel(summary?.totalAssets)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <p className="text-xs text-slate-500">Liabilities</p>
                <p className="mt-1 text-lg font-semibold text-rose-300">{moneyLabel(summary?.totalLiabilities)}</p>
              </div>
            </div>
          </article>

          <article className="rounded-[32px] border border-white/10 bg-[#0b1821] p-7">
            <p className="text-sm text-slate-400">Source integrity</p>
            <h2 className="mt-2 text-2xl font-semibold">Canonical financial model</h2>
            <dl className="mt-7 space-y-4 text-sm">
              <div className="flex justify-between border-b border-white/10 pb-4">
                <dt className="text-slate-500">Accounts</dt>
                <dd>{money.accounts.length}</dd>
              </div>
              <div className="flex justify-between border-b border-white/10 pb-4">
                <dt className="text-slate-500">Currency</dt>
                <dd>{money.currency}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Last updated</dt>
                <dd>{money.lastUpdated ?? "Unknown"}</dd>
              </div>
            </dl>
            <p className="mt-7 rounded-2xl bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">
              No sample balances, activity, income, property values, or upcoming events are included.
            </p>
          </article>
        </section>

        <section className="mt-10">
          <div>
            <h2 className="text-xl font-semibold">Money across your Worlds</h2>
            <p className="mt-1 text-sm text-slate-500">Select a World to see the records that support its position.</p>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {worldDefinitions.map((definition) => {
              const world = money.worlds[definition.key];
              const accounts = accountsByWorld[definition.key];
              const total = totalsByWorld[definition.key];
              const isOpen = selectedWorld === definition.key;

              return (
                <article
                  key={definition.key}
                  className={`rounded-3xl border p-5 transition ${
                    isOpen
                      ? "border-emerald-400/40 bg-emerald-400/[0.07]"
                      : "border-white/10 bg-[#0b1821]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedWorld(isOpen ? null : definition.key)}
                    className="w-full text-left"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-lg text-emerald-300">
                      {definition.icon}
                    </span>
                    <p className="mt-5 font-semibold">{definition.name}</p>
                    <p className="mt-1 text-xl font-semibold">
                      {moneyLabel(total)}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">{definition.description}</p>
                  </button>

                  {isOpen && (
                    <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
                      {world.status === "unknown" ? (
                        <p className="text-xs leading-5 text-slate-400">{world.reason}</p>
                      ) : (
                        accounts.map((account) => (
                          <div key={account.id} className="rounded-xl bg-white/[0.035] p-3 text-xs">
                            <div className="flex justify-between gap-3">
                              <span className="truncate text-slate-300">{account.name}</span>
                              <span className={account.type === "liability" ? "text-rose-300" : "text-emerald-300"}>
                                {formatMoney(account.balance, money.currency)}
                              </span>
                            </div>
                            <p className="mt-1 text-slate-500">{account.institution}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
