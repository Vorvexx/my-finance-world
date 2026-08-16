"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { HomepageAccount, HomepageActivity, HomepageLifestyleCategory, HomepageMoney, HomepageViewModel } from "@/types/homepage";
import { FINANCIAL_PERIODS } from "@/lib/homepage/financial-period";
import WebglAurora from "@/components/webgl-aurora";
import InlineTransactionCorrection from "@/components/inline-transaction-correction";
import { FinancialOrb, FinancialWorldIcon, type FinancialOrbAccent } from "@/components/financial-orb";
import { FinancialHud } from "@/components/financial-hud";
import { FinancialConstellation, FinancialIntelligence, FinancialScene, SpatialTransition } from "@/components/financial-scene";
import { categoryIcon, VorvexIcon, type VorvexIconKey } from "@/components/vorvex-icon-system";

export type WorldKey = "cash" | "investments" | "liabilities" | "home" | "vehicle" | "lifestyle" | "cashflow";
type CashflowChildKey = "money-in" | "money-out" | "recent" | "upcoming";
type SpatialChild = { key: string; label: string; value: string; tone: FinancialOrbAccent; icon: ReactNode; reviewState?: boolean; selected: boolean; select: () => void };

const WORLD_META: ReadonlyArray<{ key: WorldKey; label: string; tone: FinancialOrbAccent }> = [
  { key: "cash", label: "Cash", tone: "cash" },
  { key: "investments", label: "Investments", tone: "investments" },
  { key: "liabilities", label: "Liabilities", tone: "liabilities" },
  { key: "home", label: "Home", tone: "home" },
  { key: "vehicle", label: "Vehicle", tone: "vehicle" },
  { key: "lifestyle", label: "Lifestyle", tone: "lifestyle" },
  { key: "cashflow", label: "Cashflow", tone: "cashflow" },
];
const formatMoney = (value: number, currency: string) => new Intl.NumberFormat("en-CA", {
  style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(value);
const moneyLabel = (value: HomepageMoney, currency: string) => value.status === "known"
  ? formatMoney(value.amount, currency)
  : "Unavailable";
const PeriodSelector = ({ selected }: { selected: HomepageViewModel["period"]["key"] }) => <nav className="period-selector" aria-label="Financial period">{FINANCIAL_PERIODS.map((period) => <Link key={period.key} href={`/?period=${period.key}`} aria-current={selected === period.key ? "page" : undefined}>{period.label}</Link>)}</nav>;

function WorldDetail({ world, view }: { world: WorldKey; view: HomepageViewModel }) {
  const currency = view.currency;
  if (world === "cash") {
    const names = new Set(view.cash.accounts.map((account) => account.displayName));
    const recent = view.recentAndUpcoming.recent.filter((item) => names.has(item.accountName));
    const upcoming = view.recentAndUpcoming.upcoming.filter((item) => names.has(item.accountName));
    const moneyIn = view.cash.accounts.reduce((sum, account) => sum + account.activity.moneyIn, 0);
    const moneyOut = view.cash.accounts.reduce((sum, account) => sum + account.activity.moneyOut, 0);
    return <>
      <p className="world-kicker">Cash</p>
      <h2>Cash</h2>
      <div className="pnn-grid"><section><p>Past</p><ActivityList title="Recent movements" items={recent} currency={currency} empty="No recent Cash activity is available." /></section><section><p>Now</p><strong>{formatMoney(moneyIn, currency)} entered</strong><small>{formatMoney(moneyOut, currency)} left across {view.cash.accountCount} account{view.cash.accountCount === 1 ? "" : "s"} this {view.period.label.toLowerCase()}</small><PeriodSelector selected={view.period.key} /></section><section><p>Next</p>{upcoming.slice(0, 3).map((item) => <span key={item.viewKey}><strong>{item.certainty === "known" ? "Known" : "Expected"} · {item.label}</strong><small>{item.date} · {formatMoney(item.amount, currency)}</small></span>)}{upcoming.length === 0 && <small>Nothing known or strongly expected yet.</small>}</section></div>
    </>;
  }
  if (world === "investments") return <>
    <p className="world-kicker">Investments</p>
    <h2>Investments</h2>
    <div className="pnn-grid"><section><p>Past</p>{view.investments.accounts.flatMap((account) => account.investmentHistory?.snapshots.slice(-1) ?? []).slice(0, 3).map((snapshot) => <span key={snapshot.date}><strong>Recorded account value</strong><small>{snapshot.date} · {formatMoney(snapshot.value, currency)}</small></span>)}</section><section><p>Now</p><strong>{view.investments.change.status === "known" ? `${view.investments.change.amount > 0 ? "+" : ""}${formatMoney(view.investments.change.amount, currency)} recorded value movement` : "Comparable movement unavailable"}</strong><small>{view.investments.changeMessage}</small></section><section><p>Next</p><small>Contributions and future performance remain Unknown unless canonical transaction or statement evidence supports them.</small></section></div>
  </>;
  if (world === "liabilities") {
    const names = new Set(view.liabilities.accounts.map((account) => account.displayName));
    const recent = view.recentAndUpcoming.recent.filter((item) => names.has(item.accountName));
    const upcoming = view.recentAndUpcoming.upcoming.filter((item) => names.has(item.accountName));
    return <><p className="world-kicker">Liabilities</p><h2>Obligations</h2><div className="pnn-grid"><section><p>Past</p><ActivityList title="Recent activity" items={recent} currency={currency} empty="No recent liability activity is available." /></section><section><p>Now</p><strong>{view.liabilities.accountCount} active obligation{view.liabilities.accountCount === 1 ? "" : "s"}</strong><small>Payments reduce liability and are excluded from Lifestyle.</small></section><section><p>Next</p>{upcoming.slice(0, 3).map((item) => <span key={item.viewKey}><strong>{item.certainty === "known" ? "Known obligation" : "Expected charge"}</strong><small>{item.date} · {formatMoney(item.amount, currency)}</small></span>)}{upcoming.length === 0 && <small>No supported upcoming obligation.</small>}</section></div></>;
  }
  if (world === "home") return <RealWorldDetail title="Home" heading="Home" object={view.home} currency={currency} manageFacts />;
  if (world === "vehicle") return <RealWorldDetail title="Vehicle" heading="Vehicle financing" object={view.vehicle} currency={currency} manageFacts />;
  if (world === "lifestyle") return <>
    <p className="world-kicker">Lifestyle</p>
    <h2>Lifestyle spending</h2>
    <div className="pnn-grid"><section><p>Past</p>{view.lifestyle.categories.slice(0, 3).map((category) => <span key={category.viewKey}><strong>{category.label}</strong><small>{category.transactions.length} transactions · {formatMoney(category.total, currency)}</small></span>)}</section><section><p>Now</p><strong>{view.lifestyle.understanding.status === "known" ? `${view.lifestyle.understanding.percentage}% of spending value understood` : "Understanding unavailable"}</strong><small>{view.lifestyle.understanding.status === "known" ? `${view.lifestyle.unclassifiedCount} unresolved in this period${view.lifestyle.reviewedLaterCount ? ` · ${view.lifestyle.reviewedLaterCount} reviewed later` : ""}` : view.lifestyle.understanding.reason}</small><PeriodSelector selected={view.period.key} /></section><section><p>Next</p><small>Grouped review improves future matching without requiring every historical transaction to be classified.</small></section></div>
    {view.lifestyle.actionableReviewCount > 0 && <Link className="review-beacon" href="/review">{view.lifestyle.actionableReviewCount} need review <span aria-hidden="true">↗</span></Link>}
  </>;
  return <>
    <p className="world-kicker">Cashflow</p>
    <h2>Cashflow</h2>
    <div className="pnn-grid"><section><p>Past</p><ActivityList title="Recent meaningful movements" items={view.recentAndUpcoming.recent} currency={currency} empty="No recent activity is available." /></section><section><p>Now</p><strong>{moneyLabel(view.cashflow.moneyIn, currency)} in · {moneyLabel(view.cashflow.moneyOut, currency)} out</strong><small>Net {moneyLabel(view.cashflow.net, currency)} · {view.coverage.message}</small><PeriodSelector selected={view.period.key} /></section><section><p>Next</p>{view.recentAndUpcoming.upcoming.slice(0, 3).map((item) => <span key={item.viewKey}><strong>{item.certainty === "known" ? "Known" : "Expected"} · {item.label}</strong><small>{item.date} · {formatMoney(item.amount, currency)}</small></span>)}</section></div>
  </>;
}

function AccountDetail({ account, world, view }: { account: HomepageAccount; world: "cash" | "investments" | "liabilities"; view: HomepageViewModel }) {
  const worldName = world === "cash" ? "Cash" : world === "investments" ? "Investments" : "Liabilities";
  const next = view.recentAndUpcoming.upcoming.find((item) => item.accountName === account.displayName);
  const snapshots = account.investmentHistory?.snapshots.slice(-3).reverse() ?? [];
  const recent = account.activity.recent.slice(0, 3);
  const isCreditCard = account.accountType === "Credit card";
  return <>
    <p className="world-kicker">{worldName} · Account</p>
    <h2>{account.displayName}</h2>
    <div className="pnn-grid">
      <section><p>Past</p>{snapshots.map((snapshot) => <span key={snapshot.date}><small>{snapshot.date}</small><strong>{formatMoney(snapshot.value, account.currency)}</strong></span>)}{snapshots.length === 0 && recent.map((item) => <span key={item.viewKey}><strong>{item.description}</strong><small>{item.date} · {item.direction === "inflow" ? "+" : "−"}{formatMoney(item.amount, account.currency)}</small></span>)}{snapshots.length === 0 && recent.length === 0 && <small>No recent factual activity</small>}</section>
      <section><p>Now</p><strong>{account.institution} · {account.accountType}</strong><small>{account.freshness.status === "known" ? `Balance recorded ${account.freshness.asOf}` : account.freshness.message}</small><small>{isCreditCard ? `${account.activity.purchases.length} recent purchases · ${account.activity.refunds.length} refunds · ${account.activity.payments.length} payments` : `${formatMoney(account.activity.moneyIn, account.currency)} in · ${formatMoney(account.activity.moneyOut, account.currency)} out this ${view.period.label.toLowerCase()}`}</small>{isCreditCard && account.activity.categoryDistribution.slice(0, 3).map((category) => <span key={category.category}><strong>{category.category}</strong><small>{formatMoney(category.amount, account.currency)}</small></span>)}</section>
      <section><p>Next</p>{next ? <><strong>{next.certainty === "known" ? `Known · due ${next.date}` : `Expected · around ${next.date}`}</strong><small>{next.certainty === "known" ? formatMoney(next.amount, account.currency) : `~${formatMoney(next.amount, account.currency)} from recurring evidence`}</small></> : account.activity.expected.slice(0, 2).map((item) => <span key={item.viewKey}><strong>Expected · around {item.date}</strong><small>~{formatMoney(item.amount, account.currency)} · {item.evidenceCount} observations</small></span>)}{!next && account.activity.expected.length === 0 && <small>Nothing known or strongly expected yet</small>}</section>
    </div>
    {account.statement && <section className="statement-facts">
      <h3>Latest known statement</h3>
      <dl>
        <div><dt>Statement balance</dt><dd>{formatMoney(account.statement.statementBalance, account.statement.currency)}</dd></div>
        <div><dt>Minimum payment</dt><dd>{formatMoney(account.statement.minimumPayment, account.statement.currency)}</dd></div>
        <div><dt>Payment due</dt><dd>{account.statement.paymentDueDate}</dd></div>
        <div><dt>Statement date</dt><dd>{account.statement.statementDate}</dd></div>
      </dl>
      <small>The statement balance is supporting statement evidence and does not replace or add to the canonical liability balance.</small>
    </section>}
    {account.contributionBreakdown && <section className="contribution-facts">
      <h3>Contribution breakdown</h3>
      {account.contributionBreakdown.status === "known" ? <dl><div><dt>Employee</dt><dd>{formatMoney(account.contributionBreakdown.employee, account.currency)}</dd></div><div><dt>Employer</dt><dd>{formatMoney(account.contributionBreakdown.employer, account.currency)}</dd></div></dl> : <p><strong>Unknown</strong>{account.contributionBreakdown.message}</p>}
      <small>Contribution portions are context only and are never added to the account total.</small>
    </section>}
    {account.investmentHistory && <InvestmentHistory history={account.investmentHistory} currency={account.currency} />}
  </>;
}

function InvestmentHistory({ history, currency }: { history: NonNullable<HomepageAccount["investmentHistory"]>; currency: string }) {
  const values = history.snapshots.map((point) => point.value);
  const minimum = Math.min(...values); const maximum = Math.max(...values); const span = Math.max(maximum - minimum, 1);
  const points = history.snapshots.map((point, index) => `${history.snapshots.length === 1 ? 50 : index * 100 / (history.snapshots.length - 1)},${44 - ((point.value - minimum) / span) * 36}`).join(" ");
  return <section className="investment-history"><div><p>Recorded value history</p><strong>{history.valueChange.status === "known" ? `${history.valueChange.amount > 0 ? "+" : ""}${formatMoney(history.valueChange.amount, currency)}` : "Change unavailable"}</strong></div>{history.snapshots.length > 1 && <svg viewBox="0 0 100 48" role="img" aria-label="Recorded account value history"><polyline points={points} /></svg>}<small>{history.message}</small></section>;
}

function ActivityList({ title, items, currency, empty, onSelect }: { title: string; items: HomepageViewModel["recentAndUpcoming"]["recent"]; currency: string; empty: string; onSelect?: (item: HomepageActivity) => void }) {
  const content = (item: HomepageActivity) => <><span><strong>{item.description}</strong><small>{item.date} · {item.kind}{item.needsReview ? " · needs review" : ""}</small></span><b className={item.direction}>{item.direction === "inflow" ? "+" : "−"}{formatMoney(item.amount, currency)}</b></>;
  const visible = items.slice(0, 3);
  return <div><h3>{title}</h3>{visible.length ? <ul className="activity-stream">{visible.map((item) => <li key={item.viewKey}>{onSelect ? <button type="button" className="activity-select" onClick={() => onSelect(item)}>{content(item)}</button> : content(item)}</li>)}</ul> : <p className="world-empty">{empty}</p>}{items.length > visible.length && <details className="more-facts"><summary>More ({items.length - visible.length})</summary><ul className="activity-stream">{items.slice(3).map((item) => <li key={item.viewKey}>{content(item)}</li>)}</ul></details>}</div>;
}

function IntelligenceRail({ view, world, account, category }: { view: HomepageViewModel; world: WorldKey; account: HomepageAccount | null; category: HomepageLifestyleCategory | null }) {
  const currency = view.currency;
  let content: ReactNode;
  if (account) content = <>
    <section><strong>{account.displayName}</strong><small>{account.institution} · {account.accountType}</small></section>
    <section><strong>{account.activity.recent.length} recent event{account.activity.recent.length === 1 ? "" : "s"}</strong><small>{formatMoney(account.activity.moneyIn, currency)} in · {formatMoney(account.activity.moneyOut, currency)} out this {view.period.label.toLowerCase()}</small></section>
    {account.accountType === "Credit card" && <section><strong>{account.activity.purchases.length} purchases · {account.activity.refunds.length} refunds</strong><small>{account.activity.payments.length} payment event{account.activity.payments.length === 1 ? "" : "s"}; payments do not become Lifestyle spending.</small></section>}
    {account.statement && <section className="insight-attention"><strong>Known payment obligation</strong><small>Minimum payment due {account.statement.paymentDueDate}; statement evidence does not duplicate the canonical balance.</small></section>}
    {account.investmentHistory && <section><strong>Recorded value movement only</strong><small>{account.investmentHistory.message}</small></section>}
  </>;
  else if (world === "cash") content = <><section><strong>{view.cash.accountCount} connected cash account{view.cash.accountCount === 1 ? "" : "s"}</strong><small>Liquidity is {moneyLabel(view.cash.total, currency)} from the canonical position.</small></section><section><strong>Deposits and withdrawals</strong><small>{formatMoney(view.cash.accounts.reduce((sum, item) => sum + item.activity.moneyIn, 0), currency)} in · {formatMoney(view.cash.accounts.reduce((sum, item) => sum + item.activity.moneyOut, 0), currency)} out this {view.period.label.toLowerCase()}.</small></section></>;
  else if (world === "cashflow") content = <><section><strong>{moneyLabel(view.cashflow.moneyIn, currency)} in</strong><small>{moneyLabel(view.cashflow.moneyOut, currency)} out · net {moneyLabel(view.cashflow.net, currency)}.</small></section><section><strong>{view.recentAndUpcoming.upcoming.length} known or expected movement{view.recentAndUpcoming.upcoming.length === 1 ? "" : "s"}</strong><small>Expected items remain evidence-based estimates, not obligations.</small></section></>;
  else if (world === "lifestyle") content = <><section><strong>{category ? category.label : view.lifestyle.topCategories[0]?.category ?? "Spending pattern"}</strong><small>{category ? `${category.transactions.length} supporting transaction${category.transactions.length === 1 ? "" : "s"}.` : view.lifestyle.topCategories[0] ? `${formatMoney(view.lifestyle.topCategories[0].amount, currency)} in the selected period.` : "No categorized spending is available."}</small></section><section><strong>{view.lifestyle.understanding.status === "known" ? `${view.lifestyle.understanding.percentage}% of spending value understood` : "Understanding unavailable"}</strong><small>{view.lifestyle.unclassifiedCount} unresolved transaction{view.lifestyle.unclassifiedCount === 1 ? "" : "s"} in this period.</small></section></>;
  else if (world === "investments") content = <><section><strong>{view.investments.accountCount} recorded investment account{view.investments.accountCount === 1 ? "" : "s"}</strong><small>{view.investments.changeMessage}</small></section><section><strong>Performance remains evidence-bound</strong><small>Recorded account-value movement is not described as return without complete contribution, withdrawal, fee and performance evidence.</small></section></>;
  else if (world === "liabilities") content = <><section><strong>{view.liabilities.accountCount} liability object{view.liabilities.accountCount === 1 ? "" : "s"}</strong><small>Current canonical balance: {moneyLabel(view.liabilities.total, currency)}.</small></section><section><strong>Payments are settlements</strong><small>Credit-card payments reduce liability and never become Lifestyle spending.</small></section></>;
  else content = <section><strong>Known facts only</strong><small>This World remains factual and Unknown where current evidence is incomplete.</small></section>;
  return <FinancialIntelligence><div><p className="world-kicker">{world} · Intelligence</p>{content}</div><div className="assistant-reserve"><span>Vorvex Assistant</span><small>Reserved for future guided intelligence.</small></div></FinancialIntelligence>;
}

function CashflowChildDetail({ child, view }: { child: CashflowChildKey; view: HomepageViewModel }) {
  const currency = view.currency;
  const expected = view.recentAndUpcoming.upcoming.filter((item) => item.certainty === "expected");
  if (child === "money-in") return <><p className="world-kicker">Cashflow · Money In</p><h2>Money In</h2><div className="pnn-grid"><section><p>Past</p><ActivityList title="Largest inflows" items={view.cashflow.topInflows} currency={currency} empty="No eligible inflows are available." /></section><section><p>Now</p><strong className="pnn-value">{moneyLabel(view.cashflow.moneyIn, currency)}</strong><small>Selected {view.period.label.toLowerCase()}</small></section><section><p>Next</p>{expected.filter((item) => item.direction === "inflow").slice(0, 2).map((item) => <span key={item.viewKey}><strong>{item.label}</strong><small>Around {item.date} · ~{formatMoney(item.amount, currency)}</small></span>)}{!expected.some((item) => item.direction === "inflow") && <small>Nothing known yet</small>}</section></div></>;
  if (child === "money-out") return <><p className="world-kicker">Cashflow · Money Out</p><h2>Money Out</h2><div className="pnn-grid"><section><p>Past</p><ActivityList title="Largest outflows" items={view.cashflow.topOutflows} currency={currency} empty="No eligible outflows are available." /></section><section><p>Now</p><strong className="pnn-value">{moneyLabel(view.cashflow.moneyOut, currency)}</strong><small>Selected {view.period.label.toLowerCase()}</small></section><section><p>Next</p>{expected.filter((item) => item.direction === "outflow").slice(0, 2).map((item) => <span key={item.viewKey}><strong>{item.label}</strong><small>Around {item.date} · ~{formatMoney(item.amount, currency)}</small></span>)}{!expected.some((item) => item.direction === "outflow") && <small>Nothing known yet</small>}</section></div></>;
  if (child === "recent") return <><p className="world-kicker">Cashflow · Recent</p><h2>Recent</h2><div className="pnn-grid"><section><p>Past</p><ActivityList title="Factual activity" items={view.recentAndUpcoming.recent} currency={currency} empty="No recent activity is available." /></section><section><p>Now</p><strong>{view.recentAndUpcoming.recent.length} recent events</strong><small>{view.cashflow.reviewNeededCount} still need understanding in the selected period.</small></section><section><p>Next</p><small>{view.recentAndUpcoming.upcoming.length ? `${view.recentAndUpcoming.upcoming.length} known or expected movement${view.recentAndUpcoming.upcoming.length === 1 ? "" : "s"} ahead.` : "Nothing known or strongly expected yet."}</small></section></div></>;
  const known = view.recentAndUpcoming.upcoming.filter((item) => item.certainty === "known");
  return <><p className="world-kicker">Cashflow · Upcoming</p><h2>Upcoming</h2><div className="pnn-grid"><section><p>Past</p><ActivityList title="Evidence behind expectations" items={view.recentAndUpcoming.recent.filter((item) => item.kind === "income" || item.kind === "spending")} currency={currency} empty="No supporting recent pattern is available." /></section><section><p>Now · Known</p>{known.slice(0, 3).map((item) => <span key={item.viewKey}><strong>{item.label}</strong><small>Due {item.date} · {formatMoney(item.amount, currency)}</small></span>)}{known.length === 0 && <small>Nothing known yet</small>}</section><section><p>Next · Expected</p>{expected.slice(0, 3).map((item) => <span key={item.viewKey}><strong>{item.label}</strong><small>Around {item.date} · ~{formatMoney(item.amount, currency)}</small></span>)}{expected.length === 0 && <small>No strong historical pattern is currently upcoming.</small>}</section></div></>;
}

function CategoryDetail({ category, currency, period, world }: { category: HomepageLifestyleCategory; currency: string; period: HomepageViewModel["period"]; world: string }) {
  return <>
    <p className="world-kicker">{world} · Category</p>
    <h2>{category.label}</h2>
    <div className="category-detail-grid"><section><p className="section-label">Transactions</p><ul className="lifestyle-transactions">{category.transactions.map((transaction) => <li key={transaction.viewKey}><span><strong>{transaction.description}</strong><small>{transaction.date} · {transaction.accountName}{transaction.needsReview ? " · needs review" : ""}</small>{transaction.correction && <InlineTransactionCorrection correction={transaction.correction} />}</span><b className={transaction.spendingImpact < 0 ? "refund" : "spending"}>{transaction.spendingImpact < 0 ? "−" : ""}{formatMoney(Math.abs(transaction.spendingImpact), currency)}</b></li>)}</ul></section><aside><p className="section-label">This period</p><strong className="category-total">{formatMoney(category.total, currency)}</strong><small>{category.transactions.length} transaction{category.transactions.length === 1 ? "" : "s"}</small><PeriodSelector selected={period.key} /></aside></div>
    {category.needsReview && <Link className="review-beacon" href="/review">Review these uncategorized transactions <span aria-hidden="true">↗</span></Link>}
  </>;
}
const UnknownWorld = ({ title, heading, message }: { title: string; heading: string; message: string }) => <><p className="world-kicker">{title}</p><h2>{heading}</h2><div className="unknown-horizon"><span>Unknown</span><p>{message}</p></div></>;

function RealWorldDetail({ title, heading, object, currency, manageFacts = false }: { title: string; heading: string; object: HomepageViewModel["home"]; currency: string; manageFacts?: boolean }) {
  const categorySummary = object.categories.length > 0 && <section className="world-category-summary"><p className="section-label">Classified activity · this period</p>{object.categories.map((category) => <span key={category.viewKey}><strong>{category.label}</strong><small>{category.transactions.length} transaction{category.transactions.length === 1 ? "" : "s"} · {formatMoney(category.total, currency)}</small></span>)}</section>;
  if (object.status === "unknown") return <><UnknownWorld title={title} heading={heading} message={object.message} />{categorySummary}{manageFacts && <Link className="review-beacon" href="/facts">Add factual information <span aria-hidden="true">→</span></Link>}</>;
  return <><p className="world-kicker">Person · {title} · Detail</p><h2>{heading}</h2><p className="world-provenance">{object.message}</p><dl className="account-facts">
    <div><dt>Property value</dt><dd>{object.asset ? moneyLabel(object.asset.value, currency) : "Unknown"}</dd></div>
    <div><dt>Outstanding</dt><dd>{object.financing ? moneyLabel(object.financing.balance, currency) : "Unknown"}</dd></div>
    <div><dt>Institution</dt><dd>{object.financing?.institution ?? "Unknown"}</dd></div>
    <div><dt>Effective date</dt><dd>{object.financing?.effectiveDate ?? object.asset?.effectiveDate ?? "Unknown"}</dd></div>
    <div><dt>Equity</dt><dd>{moneyLabel(object.equity, currency)}</dd></div>
  </dl>{categorySummary}{manageFacts && <Link className="review-beacon" href="/facts">Update factual information <span aria-hidden="true">→</span></Link>}</>;
}

const nodeValue = (world: WorldKey, view: HomepageViewModel) => {
  if (world === "cash") return moneyLabel(view.cash.total, view.currency);
  if (world === "investments") return moneyLabel(view.investments.total, view.currency);
  if (world === "liabilities") return moneyLabel(view.liabilities.total, view.currency);
  if (world === "home") return view.home.asset ? moneyLabel(view.home.asset.value, view.currency) : view.home.financing ? "Financing known" : "Unknown";
  if (world === "vehicle") return view.vehicle.financing ? "Financing known" : "Unknown";
  if (world === "lifestyle") return moneyLabel(view.lifestyle.qualifyingSpending, view.currency);
  return moneyLabel(view.cashflow.net, view.currency);
};

export default function FinancialHome({ view }: { view: HomepageViewModel }) {
  const [selected, setSelected] = useState<WorldKey | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<HomepageAccount | null>(null);
  const [selectedLifestyle, setSelectedLifestyle] = useState<string | null>(null);
  const [selectedRealWorldCategory, setSelectedRealWorldCategory] = useState<string | null>(null);
  const [selectedCashflow, setSelectedCashflow] = useState<CashflowChildKey | null>(null);
  const [surfaceOpen, setSurfaceOpen] = useState(false);
  const [travelling, setTravelling] = useState(false);
  const [surfaceAfterTravel, setSurfaceAfterTravel] = useState(false);
  const beginTravel = (showSurface: boolean) => {
    if (travelling) return;
    setSurfaceOpen(false);
    setSurfaceAfterTravel(showSurface);
    setTravelling(true);
  };
  useEffect(() => {
    if (!travelling) return;
    const timer = window.setTimeout(() => { setTravelling(false); setSurfaceOpen(surfaceAfterTravel); }, 620);
    return () => window.clearTimeout(timer);
  }, [travelling, surfaceAfterTravel]);
  const selectedLifestyleCategory = selectedLifestyle ? view.lifestyle.categories.find((category) => category.label === selectedLifestyle) ?? null : null;
  const selectedWorldCategory = selectedRealWorldCategory && (selected === "home" || selected === "vehicle") ? view[selected].categories.find((category) => category.label === selectedRealWorldCategory) ?? null : null;
  const selectWorld = (world: WorldKey) => { setSelected(world); setSelectedAccount(null); setSelectedLifestyle(null); setSelectedRealWorldCategory(null); setSelectedCashflow(null); beginTravel(true); };
  const leaveWorld = () => { setSelected(null); setSelectedAccount(null); setSelectedLifestyle(null); setSelectedRealWorldCategory(null); setSelectedCashflow(null); beginTravel(false); };
  const leaveObject = () => { setSelectedAccount(null); setSelectedLifestyle(null); setSelectedRealWorldCategory(null); setSelectedCashflow(null); beginTravel(true); };
  const closeSurface = () => { setSurfaceAfterTravel(false); setSurfaceOpen(false); };
  const accountWorld = selected === "cash" || selected === "investments" || selected === "liabilities" ? selected : null;
  const worldAccounts = accountWorld ? view[accountWorld].accounts : [];
  const depth = selectedAccount || selectedLifestyleCategory || selectedWorldCategory || selectedCashflow ? "object" : selected ? "world" : "person";
  const accountTone: FinancialOrbAccent = selected === "investments" ? "investments" : selected === "liabilities" ? "liabilities" : "cash";
  const accountIcon: VorvexIconKey = selected === "investments" ? "investments" : selected === "liabilities" ? "liabilities" : "cash";
  const accountChildren: SpatialChild[] = worldAccounts.map((account) => ({ key: account.viewKey, label: account.displayName, value: moneyLabel(account.balance, view.currency), tone: accountTone, icon: <VorvexIcon icon={accountIcon} />, selected: selectedAccount?.viewKey === account.viewKey, select: () => { setSelectedAccount(account); beginTravel(true); } }));
  const lifestyleChildren: SpatialChild[] = selected === "lifestyle" ? view.lifestyle.categories.map((category) => ({ key: category.viewKey, label: category.label, value: formatMoney(category.total, view.currency), tone: category.needsReview ? "review" : "lifestyle", icon: categoryIcon(category.label), reviewState: category.needsReview, selected: selectedLifestyleCategory?.viewKey === category.viewKey, select: () => { setSelectedLifestyle(category.label); beginTravel(true); } })) : [];
  const realWorldChildren: SpatialChild[] = selected === "home" || selected === "vehicle" ? view[selected].categories.map((category) => ({ key: category.viewKey, label: category.label, value: formatMoney(category.total, view.currency), tone: selected, icon: categoryIcon(category.label), selected: selectedWorldCategory?.viewKey === category.viewKey, select: () => { setSelectedRealWorldCategory(category.label); beginTravel(true); } })) : [];
  const cashflowDefinitions: ReadonlyArray<{ key: CashflowChildKey; label: string; value: string; tone: FinancialOrbAccent; icon: VorvexIconKey }> = [
    { key: "money-in", label: "Money In", value: moneyLabel(view.cashflow.moneyIn, view.currency), tone: "cashflow", icon: "income" },
    { key: "money-out", label: "Money Out", value: moneyLabel(view.cashflow.moneyOut, view.currency), tone: "cashflow", icon: "outflow" },
    { key: "recent", label: "Recent", value: `${view.recentAndUpcoming.recent.length} events`, tone: "cashflow", icon: "recent" },
    { key: "upcoming", label: "Upcoming", value: `${view.recentAndUpcoming.upcoming.length} known + expected`, tone: "cashflow", icon: "upcoming" },
  ];
  const cashflowChildren: SpatialChild[] = selected === "cashflow" ? cashflowDefinitions.map((child) => ({ ...child, icon: <VorvexIcon icon={child.icon} />, selected: selectedCashflow === child.key, select: () => { setSelectedCashflow(child.key); beginTravel(true); } })) : [];
  const spatialChildren = [...accountChildren, ...lifestyleChildren, ...realWorldChildren, ...cashflowChildren];
  const activeTone = selected ?? "net-worth";
  return <main className={`universe-shell depth-${depth} ${selected ? `world-${selected}` : ""} ${travelling ? "is-travelling" : ""}`} aria-busy={travelling}>
    <WebglAurora />
    <div className="space-dust" aria-hidden="true" />
    <header className="universe-header"><div><button type="button" className="universe-brand" onClick={leaveWorld} aria-label="Return to Universe">Vorvex</button><span>{view.snapshotDate ?? "Snapshot unavailable"}</span></div><nav className="header-actions" aria-label="Financial data tools"><Link href="/facts">My data</Link><Link href="/statements">Add statements</Link><Link href="/review" className="header-review">Needs attention {view.lifestyle.actionableReviewCount > 0 && <span>{view.lifestyle.actionableReviewCount}</span>}</Link></nav></header>
    <nav className="journey-trail" aria-label="Current location"><button type="button" onClick={leaveWorld} aria-current={!selected ? "page" : undefined}>Universe</button>{selected && <><span>›</span><button type="button" onClick={() => selectWorld(selected)} aria-current={depth === "world" ? "page" : undefined}>{WORLD_META.find((world) => world.key === selected)?.label}</button></>}{depth === "object" && <><span>›</span><b>{selectedAccount?.displayName ?? selectedLifestyleCategory?.label ?? selectedWorldCategory?.label ?? cashflowDefinitions.find((child) => child.key === selectedCashflow)?.label ?? "Detail"}</b></>}</nav>
    <FinancialScene depth={depth} tone={activeTone} travelling={travelling}>
      <SpatialTransition active={travelling} />
      <div className="financial-scene__center">
        <FinancialOrb name="Net Worth" value={moneyLabel(view.position.netWorth, view.currency)} icon={<VorvexIcon icon="net-worth" />} accent="net-worth" size="hero" state={selected ? "receded" : "selected"} onClick={leaveWorld} aria-label="Return to your universe" />
      </div>
      <FinancialConstellation label="Financial constellation">{WORLD_META.map((world) => { const isParent = depth === "object" && selected === world.key; const state = isParent ? "parent" : selected === world.key ? "selected" : selected ? "receded" : "idle"; return <FinancialOrb key={world.key} name={world.label} value={nodeValue(world.key, view)} icon={<FinancialWorldIcon world={world.key} />} accent={world.tone} size={selected === world.key ? "primary" : "secondary"} state={state} onClick={isParent ? leaveObject : () => selectWorld(world.key)} aria-label={isParent ? `Return to ${world.label}` : undefined} aria-pressed={selected === world.key} />; })}</FinancialConstellation>
      <FinancialConstellation label={selected ? `${selected} objects` : "Financial objects"} role="children">{spatialChildren.map((child) => <FinancialOrb key={child.key} name={child.label} value={child.value} icon={child.icon} accent={child.tone} size={child.selected ? "primary" : "secondary"} state={child.selected ? "selected" : depth === "object" ? "receded" : "idle"} className={child.reviewState ? "financial-orb--review-state" : ""} onClick={child.select} />)}</FinancialConstellation>
    </FinancialScene>
    {selected && (selectedAccount || selectedLifestyleCategory || selectedWorldCategory) && <IntelligenceRail view={view} world={selected} account={selectedAccount} category={selectedLifestyleCategory ?? selectedWorldCategory} />}
    {selected && !travelling && <FinancialHud open={surfaceOpen} onOpen={() => setSurfaceOpen(true)} onClose={closeSurface}>{selectedLifestyleCategory && selected === "lifestyle"
      ? <CategoryDetail category={selectedLifestyleCategory} currency={view.currency} period={view.period} world="Lifestyle" />
      : selectedWorldCategory && (selected === "home" || selected === "vehicle")
      ? <CategoryDetail category={selectedWorldCategory} currency={view.currency} period={view.period} world={selected === "home" ? "Home" : "Vehicle"} />
      : selectedCashflow && selected === "cashflow"
      ? <CashflowChildDetail child={selectedCashflow} view={view} />
      : selectedAccount && (selected === "cash" || selected === "investments" || selected === "liabilities")
      ? <AccountDetail account={selectedAccount} world={selected} view={view} />
      : <WorldDetail world={selected} view={view} />}</FinancialHud>}
    <footer className="universe-footer"><p>{view.coverage.message}</p><span>{view.period.startDate} — {view.period.endDate}</span></footer>
  </main>;
}
