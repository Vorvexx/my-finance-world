"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { HomepageAccount, HomepageActivity, HomepageLifestyleCategory, HomepageMoney, HomepageViewModel } from "@/types/homepage";
import { TimeNavigator } from "@/components/time-navigator";
import WebglAurora from "@/components/webgl-aurora";
import InlineTransactionCorrection from "@/components/inline-transaction-correction";
import { FinancialOrb, FinancialWorldIcon, type FinancialOrbAccent } from "@/components/financial-orb";
import { FinancialHud } from "@/components/financial-hud";
import { FinancialConstellation, FinancialIntelligence, FinancialScene, SpatialTransition } from "@/components/financial-scene";
import { categoryIcon, VorvexIcon, type VorvexIconKey } from "@/components/vorvex-icon-system";

export type WorldKey = "cash" | "investments" | "liabilities" | "home" | "vehicle" | "lifestyle" | "cashflow";
type NavigationWorldKey = Exclude<WorldKey, "liabilities" | "cashflow">;
type CashflowChildKey = "money-in" | "money-out" | "recent" | "upcoming";
type FlowGroup = HomepageViewModel["cashflow"]["outflowGroups"][number];
type SpatialChild = { key: string; label: string; value: string; tone: FinancialOrbAccent; icon: ReactNode; reviewState?: boolean; positionState?: boolean; semanticType?: "period-flow" | "snapshot" | "statement-fact" | "expectation"; selected: boolean; select: () => void };

const WORLD_META: ReadonlyArray<{ key: NavigationWorldKey; label: string; tone: FinancialOrbAccent }> = [
  { key: "cash", label: "Cash", tone: "cash" },
  { key: "investments", label: "Investments", tone: "investments" },
  { key: "home", label: "Home", tone: "home" },
  { key: "vehicle", label: "Vehicle", tone: "vehicle" },
  { key: "lifestyle", label: "Lifestyle", tone: "lifestyle" },
];
const formatMoney = (value: number, currency: string) => new Intl.NumberFormat("en-CA", {
  style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(value);
const moneyLabel = (value: HomepageMoney, currency: string) => value.status === "known"
  ? formatMoney(value.amount, currency)
  : "Unavailable";

function FinancialFlowAnalytics({ view }: { view: HomepageViewModel }) {
  const timeline = view.analytics;
  if (!timeline) return <section className="financial-hud__expanded-evidence"><h3>Financial flow history</h3><p>Canonical analytics are unavailable on this device.</p></section>;
  const selected = timeline.months.find((month) => month.month === view.period.startDate.slice(0, 7)) ?? timeline.months.at(-1);
  if (!selected) return null;
  const percentage = selected.availableToAllocatePercentageChange === null ? "Not comparable" : `${selected.availableToAllocatePercentageChange >= 0 ? "+" : ""}${selected.availableToAllocatePercentageChange.toFixed(1)}%`;
  const remaining = selected.remainingAvailable.amount === null ? `${selected.remainingAvailable.status} · amount Unknown` : formatMoney(selected.remainingAvailable.amount, view.currency);
  return <section className="financial-hud__expanded-evidence flow-analytics">
    <h3>Allocation bridge</h3>
    <dl className="flow-now"><div><dt>Available Cash · Now</dt><dd>{moneyLabel(view.cash.total, view.currency)}</dd></div><div><dt>Money In</dt><dd>{formatMoney(selected.moneyIn, view.currency)}</dd></div><div><dt>Observed Required</dt><dd>{formatMoney(selected.observedRequiredCosts, view.currency)}</dd></div><div><dt>Normal Required Cost</dt><dd>{selected.requiredCostCoverage.normalizedMonthlyAmount === null ? "Partial" : formatMoney(selected.requiredCostCoverage.normalizedMonthlyAmount, view.currency)}</dd></div><div><dt>Available to Allocate</dt><dd>{formatMoney(selected.availableToAllocate, view.currency)}</dd></div><div><dt>Discretionary consumption</dt><dd>{formatMoney(selected.discretionaryConsumption, view.currency)}</dd></div><div><dt>Verified wealth allocation</dt><dd>{selected.verifiedWealthAllocation.amount === null ? "Unknown" : formatMoney(selected.verifiedWealthAllocation.amount, view.currency)}</dd></div><div><dt>Remaining Available</dt><dd>{remaining}</dd></div><div><dt>Available to Allocate · month over month</dt><dd>{percentage}</dd></div></dl>
    <small>{selected.coverage.message} Opening whole-person position remains {selected.openingPosition.status === "unknown" ? "Unknown" : "known"}.</small>
    <small>{selected.requiredCostCoverage.reason}</small>
    <details><summary>Required Cost evidence · normalized {selected.requiredCostCoverage.normalizedMonthlyAmount === null ? "insufficient coverage" : formatMoney(selected.requiredCostCoverage.normalizedMonthlyAmount, view.currency)}</summary>{selected.requiredCostComponents.length ? <ul className="activity-stream">{selected.requiredCostComponents.map((component) => <li key={component.key}><span><strong>{component.label}</strong><small>{component.kind} · {component.cadence} · {component.confidence} · {component.evidenceCount} observations</small></span><b>{formatMoney(component.normalizedMonthlyAmount, view.currency)}</b></li>)}</ul> : <p>No sufficiently supported recurring necessities yet.</p>}</details>
    <details><summary>Consumption by World and category</summary>{selected.byWorld.map((world) => <section key={world.key}><h3>{world.key} · {formatMoney(world.amount, view.currency)}</h3><dl>{world.categories.map((category) => <div key={category.key}><dt>{category.key}</dt><dd>{formatMoney(category.amount, view.currency)}</dd></div>)}</dl></section>)}</details>
    <details><summary>Monthly history · Dec 2024 to latest</summary><dl>{timeline.months.map((month) => <div key={month.month}><dt>{month.month} · {month.status}</dt><dd>In {formatMoney(month.moneyIn, view.currency)} · Observed required {formatMoney(month.observedRequiredCosts, view.currency)} · Available to Allocate {formatMoney(month.availableToAllocate, view.currency)} · Remaining Available {month.remainingAvailable.amount === null ? `${month.remainingAvailable.status}` : formatMoney(month.remainingAvailable.amount, view.currency)} · {month.availableToAllocatePercentageChange === null ? "MoM n/a" : `${month.availableToAllocatePercentageChange >= 0 ? "+" : ""}${month.availableToAllocatePercentageChange.toFixed(1)}% MoM`}</dd></div>)}</dl></details>
    <small>Verified wealth allocation remains Unknown where transfers, principal, or contributions cannot be linked factually. Transfers and card settlements are excluded from economic spending.</small>
  </section>;
}

function WorldDetail({ world, view }: { world: NavigationWorldKey; view: HomepageViewModel }) {
  const currency = view.currency;
  if (world === "cash") {
    const names = new Set(view.cash.accounts.map((account) => account.displayName));
    const upcoming = view.recentAndUpcoming.upcoming.filter((item) => names.has(item.accountName));
    return <>
      <p className="world-kicker">Everyday money</p>
      <h2>Position and movement</h2>
      <div className="pnn-grid"><section className="ranked-past"><p>Past · biggest movements</p><ActivityList title="Top Money In" items={view.cashflow.topInflows} currency={currency} empty="No supported inflows." /><ActivityList title="Top Money Out" items={view.cashflow.topOutflows} currency={currency} empty="No supported outflows." /></section><section><p>Now · {view.period.displayLabel}</p><dl className="flow-now"><div><dt>Money In</dt><dd>{moneyLabel(view.cashflow.moneyIn, currency)}</dd></div><div><dt>Money Out</dt><dd>{moneyLabel(view.cashflow.moneyOut, currency)}</dd></div><div><dt>Net movement</dt><dd>{moneyLabel(view.cashflow.net, currency)}</dd></div></dl><small>Cash position {moneyLabel(view.cash.total, currency)} · recorded {view.snapshotDate ?? "date Unknown"}</small></section><section><p>Next · ranked impact</p>{upcoming.slice(0, 3).map((item) => <span key={item.viewKey}><strong>{item.certainty === "known" ? "Known" : "Expected"} · {item.label}</strong><small>{item.certainty === "known" ? formatMoney(item.amount, currency) : `~${formatMoney(item.amount, currency)}`} · {item.date}</small></span>)}{upcoming.length === 0 && <small>Nothing known or strongly expected yet.</small>}</section></div>
      <section className="account-transaction-groups financial-hud__expanded-evidence"><ActivityList title="Recorded income · all imported coverage" items={view.cash.incomeHistory} currency={currency} empty="No supported income is recorded." /><ActivityList title="Still uncertain · all imported coverage" items={view.cash.uncertainHistory} currency={currency} empty="No genuinely uncertain Cash activity remains." /></section>
      <FinancialFlowAnalytics view={view} />
    </>;
  }
  if (world === "investments") return <>
    <p className="world-kicker">Investments</p>
    <h2>Investments</h2>
    <div className="pnn-grid"><section><p>Past</p>{view.investments.accounts.flatMap((account) => account.investmentHistory?.snapshots.slice(-1) ?? []).slice(0, 3).map((snapshot) => <span key={snapshot.date}><strong>Recorded account value</strong><small>{snapshot.date} · {formatMoney(snapshot.value, currency)}</small></span>)}</section><section><p>Now</p><strong>{view.investments.change.status === "known" ? `${view.investments.change.amount > 0 ? "+" : ""}${formatMoney(view.investments.change.amount, currency)} recorded value movement` : "Comparable movement unavailable"}</strong><small>{view.investments.changeMessage}</small></section><section><p>Next</p><small>Contributions and future performance remain Unknown unless canonical transaction or statement evidence supports them.</small></section></div>
  </>;
  if (world === "home") return <RealWorldDetail title="Home" heading="Home" object={view.home} currency={currency} manageFacts />;
  if (world === "vehicle") return <RealWorldDetail title="Vehicle" heading="Vehicle financing" object={view.vehicle} currency={currency} manageFacts />;
  if (world === "lifestyle") return <>
    <p className="world-kicker">Lifestyle</p>
    <h2>Lifestyle spending</h2>
    <div className="pnn-grid"><section><p>Past</p>{view.lifestyle.categories.slice(0, 3).map((category) => <span key={category.viewKey}><strong>{category.label}</strong><small>{category.transactions.length} transactions · {formatMoney(category.total, currency)}</small></span>)}</section><section><p>Now</p><strong>{view.lifestyle.understanding.status === "known" ? `${view.lifestyle.understanding.percentage}% of spending value understood` : "Understanding unavailable"}</strong><small>{view.lifestyle.understanding.status === "known" ? `${view.lifestyle.unclassifiedCount} category/meaning uncertainties in this period${view.lifestyle.reviewedLaterCount ? ` · ${view.lifestyle.reviewedLaterCount} deferred` : ""}` : view.lifestyle.understanding.reason}</small></section><section><p>Next</p><small>Founder attention is reserved for genuinely Unknown evidence.</small></section></div>
    {view.lifestyle.actionableReviewCount > 0 && <Link className="review-beacon" href="/review">{view.lifestyle.actionableReviewCount} need review <span aria-hidden="true">↗</span></Link>}
  </>;
  return null;
}

function AccountDetail({ account, world, view }: { account: HomepageAccount; world: "cash" | "investments"; view: HomepageViewModel }) {
  const worldName = world === "cash" ? "Cash" : "Investments";
  const next = view.recentAndUpcoming.upcoming.find((item) => item.accountName === account.displayName);
  const snapshots = account.investmentHistory?.snapshots.slice(-3).reverse() ?? [];
  const recent = account.activity.recent.slice(0, 3);
  const isCreditCard = account.accountType === "Credit card";
  return <>
    <p className="world-kicker">{worldName} · Account</p>
    <h2>{account.displayName}</h2>
    <div className="pnn-grid">
      <section><p>Past</p>{snapshots.map((snapshot) => <span key={snapshot.date}><small>{snapshot.date}</small><strong>{formatMoney(snapshot.value, account.currency)}</strong></span>)}{snapshots.length === 0 && recent.map((item) => <span key={item.viewKey}><strong>{item.description}</strong><small>{item.date} · {item.direction === "inflow" ? "+" : "−"}{formatMoney(item.amount, account.currency)}</small>{item.correction && <InlineTransactionCorrection correction={item.correction} />}</span>)}{snapshots.length === 0 && recent.length === 0 && <small>No recent factual activity</small>}</section>
      <section><p>Now</p><strong>{account.institution} · {account.accountType}</strong><small>{account.freshness.status === "known" ? `Latest recorded position · ${account.freshness.asOf}` : account.freshness.message}</small><small>{isCreditCard ? `${account.activity.purchases.length} displayed purchases · ${account.activity.refunds.length} displayed refunds · ${account.activity.payments.length} displayed payments` : `${formatMoney(account.activity.moneyIn, account.currency)} received · ${formatMoney(account.activity.moneyOut, account.currency)} sent this ${view.period.label.toLowerCase()}`}</small>{isCreditCard && account.activity.categoryDistribution.slice(0, 3).map((category) => <span key={category.category}><strong>{category.category}</strong><small>{formatMoney(category.amount, account.currency)}</small></span>)}</section>
      <section><p>Next</p>{next ? <><strong>{next.certainty === "known" ? `Known · due ${next.date}` : `Expected · around ${next.date}`}</strong><small>{next.certainty === "known" ? formatMoney(next.amount, account.currency) : `~${formatMoney(next.amount, account.currency)} from recurring evidence`}</small></> : account.activity.expected.slice(0, 2).map((item) => <span key={item.viewKey}><strong>Expected · Around {item.date}</strong><small>~{formatMoney(item.amount, account.currency)} · {item.evidenceCount} observations</small></span>)}{!next && account.activity.expected.length === 0 && <small>Nothing known or strongly expected yet</small>}</section>
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
    {isCreditCard && <section className="account-transaction-groups"><ActivityList title="Purchases" items={account.activity.purchases} currency={account.currency} empty="No purchases in this period." /><ActivityList title="Refunds" items={account.activity.refunds} currency={account.currency} empty="No refunds in this period." /><ActivityList title="Payments · excluded from spending" items={account.activity.payments} currency={account.currency} empty="No payment activity in this period." /></section>}
    {isCreditCard && <section className="card-reconciliation financial-hud__expanded-evidence"><h3>Period flow · {view.period.displayLabel}</h3><dl><div><dt>Purchases charged</dt><dd>{formatMoney(account.activity.reconciliation.purchases, account.currency)}</dd></div><div><dt>Refunds / credits</dt><dd>+{formatMoney(account.activity.reconciliation.refunds, account.currency)}</dd></div><div><dt>Payments received</dt><dd>−{formatMoney(account.activity.reconciliation.payments, account.currency)}</dd></div><div><dt>Fees / interest</dt><dd>{formatMoney(account.activity.reconciliation.fees, account.currency)}</dd></div><div><dt>Net card activity</dt><dd>{formatMoney(account.activity.reconciliation.netActivity, account.currency)}</dd></div></dl><h3>Position and statement facts</h3><dl><div><dt>Latest recorded position · {account.freshness.status === "known" ? account.freshness.asOf : "date Unknown"}</dt><dd>{moneyLabel(account.balance, account.currency)}</dd></div>{account.statement && <><div><dt>Latest statement balance · {account.statement.statementDate}</dt><dd>{formatMoney(account.statement.statementBalance, account.currency)}</dd></div><div><dt>Minimum due · {account.statement.paymentDueDate}</dt><dd>{formatMoney(account.statement.minimumPayment, account.currency)}</dd></div></>}</dl><small>Period flow follows the Time Navigator. Latest position and statement facts stay tied to their recorded dates. Payments settle the liability and never become a second spending event.</small></section>}
    {world === "cash" && <section className="account-transaction-groups financial-hud__expanded-evidence"><ActivityList title="Recorded income · all imported coverage" items={account.activity.incomeHistory} currency={account.currency} empty="No supported income is recorded for this account." /><ActivityList title="Still uncertain · all imported coverage" items={account.activity.uncertainHistory} currency={account.currency} empty="No genuinely uncertain activity remains for this account." /></section>}
    {world === "cash" && !isCreditCard && <section className="account-circulation financial-hud__expanded-evidence"><h3>Account circulation · {view.period.displayLabel}</h3><dl><div><dt>Recorded position</dt><dd>{moneyLabel(account.balance, account.currency)}</dd></div><div><dt>Money received</dt><dd>{formatMoney(account.activity.moneyIn, account.currency)}</dd></div><div><dt>Money sent</dt><dd>{formatMoney(account.activity.moneyOut, account.currency)}</dd></div><div><dt>Card settlements</dt><dd>{formatMoney(account.activity.reconciliation.payments, account.currency)}</dd></div></dl><small>Position recorded {account.freshness.status === "known" ? account.freshness.asOf : "on an Unknown date"}; transfers, settlements, fees and rebates retain their canonical meanings.</small><div className="account-transaction-groups"><ActivityList title="Significant received" items={account.activity.recent.filter((item) => item.direction === "inflow").sort((left, right) => right.amount - left.amount)} currency={account.currency} empty="No received activity in this period." /><ActivityList title="Significant sent" items={account.activity.recent.filter((item) => item.direction === "outflow").sort((left, right) => right.amount - left.amount)} currency={account.currency} empty="No sent activity in this period." /><ActivityList title="Card settlements" items={account.activity.payments} currency={account.currency} empty="No card settlement in this period." /></div></section>}
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
  const stateLabel = (item: HomepageActivity) => item.understandingState === "genuinely-unknown" ? " · genuinely Unknown" : item.understandingState === "intentionally-deferred" ? " · intentionally deferred" : item.understandingState === "category-ambiguous" ? " · category unclear" : "";
  const content = (item: HomepageActivity) => <><span><strong>{item.description}</strong><small>{item.date} · {item.kind}{stateLabel(item)}</small>{item.correction && <InlineTransactionCorrection correction={item.correction} />}</span><b className={item.direction}>{item.direction === "inflow" ? "+" : "−"}{formatMoney(item.amount, currency)}</b></>;
  const visible = items.slice(0, 3);
  return <div><h3>{title}</h3>{visible.length ? <ul className="activity-stream">{visible.map((item) => <li key={item.viewKey}>{onSelect ? <button type="button" className="activity-select" onClick={() => onSelect(item)}>{content(item)}</button> : content(item)}</li>)}</ul> : <p className="world-empty">{empty}</p>}{items.length > visible.length && <details className="more-facts"><summary>More ({items.length - visible.length})</summary><ul className="activity-stream">{items.slice(3).map((item) => <li key={item.viewKey}>{content(item)}</li>)}</ul></details>}</div>;
}

function FlowGroups({ title, groups, currency }: { title: string; groups: HomepageViewModel["cashflow"]["outflowGroups"]; currency: string }) {
  return <section className="flow-groups"><h3>{title}</h3>{groups.map((group) => <details key={group.key}><summary><span><strong>{group.label}</strong><small>{group.includedInPrimaryTotal ? "Included in primary total" : "Cash movement · excluded from spending total"}</small></span><b>{formatMoney(group.total, currency)}</b></summary><ActivityList title="Canonical transactions" items={group.transactions} currency={currency} empty="No transactions." /></details>)}</section>;
}

function FlowGroupDetail({ group, direction, currency }: { group: FlowGroup; direction: "inflow" | "outflow"; currency: string }) {
  return <><p className="world-kicker">Cash · Money {direction === "inflow" ? "In" : "Out"} · Context</p><h2>{group.label}</h2><div className="pnn-grid two"><section><p>Selected period</p><strong className="pnn-value">{formatMoney(group.total, currency)}</strong><small>{group.includedInPrimaryTotal ? `Reconciles into Money ${direction === "inflow" ? "In" : "Out"}.` : "Contextual cash movement; excluded from primary spending/income totals."}</small></section><section><p>Canonical evidence</p><strong>{group.transactions.length} transaction{group.transactions.length === 1 ? "" : "s"}</strong><small>One canonical transaction may appear here and in its World without duplication.</small></section></div><section className="financial-hud__expanded-evidence"><ActivityList title="Supporting transactions" items={group.transactions} currency={currency} empty="No supporting evidence." /></section></>;
}

function IntelligenceRail({ view, world, account, category }: { view: HomepageViewModel; world: NavigationWorldKey; account: HomepageAccount | null; category: HomepageLifestyleCategory | null }) {
  const currency = view.currency;
  let content: ReactNode;
  if (account) content = <>
    <section><strong>{account.displayName}</strong><small>{account.institution} · {account.accountType}</small></section>
    <section><strong>{account.activity.recent.length} recent event{account.activity.recent.length === 1 ? "" : "s"}</strong><small>{formatMoney(account.activity.moneyIn, currency)} in · {formatMoney(account.activity.moneyOut, currency)} out this {view.period.label.toLowerCase()}</small></section>
    {account.accountType === "Credit card" && <section><strong>{account.activity.purchases.length} purchases · {account.activity.refunds.length} refunds</strong><small>{account.activity.payments.length} payment event{account.activity.payments.length === 1 ? "" : "s"}; payments do not become Lifestyle spending.</small></section>}
    {account.statement && <section className="insight-attention"><strong>Known payment obligation</strong><small>Minimum payment due {account.statement.paymentDueDate}; statement evidence does not duplicate the canonical balance.</small></section>}
    {account.investmentHistory && <section><strong>Recorded value movement only</strong><small>{account.investmentHistory.message}</small></section>}
  </>;
  else if (world === "cash") content = <><section><strong>{view.cash.accountCount} everyday-money object{view.cash.accountCount === 1 ? "" : "s"}</strong><small>Known cash position is {moneyLabel(view.cash.total, currency)}; credit obligations remain liabilities while appearing here in context.</small></section><section><strong>{moneyLabel(view.cashflow.moneyIn, currency)} in · {moneyLabel(view.cashflow.moneyOut, currency)} out</strong><small>Net movement {moneyLabel(view.cashflow.net, currency)} this {view.period.label.toLowerCase()}.</small></section>{view.insights.slice(0, 3).map((insight) => <section key={insight.title} className={insight.tone === "attention" ? "insight-attention" : undefined}><strong>{insight.title}</strong><small>{insight.detail}</small></section>)}</>;
  else if (world === "lifestyle") content = <><section><strong>{category ? category.label : view.lifestyle.topCategories[0]?.category ?? "Spending pattern"}</strong><small>{category ? `${category.transactions.length} supporting transaction${category.transactions.length === 1 ? "" : "s"}.` : view.lifestyle.topCategories[0] ? `${formatMoney(view.lifestyle.topCategories[0].amount, currency)} in the selected period.` : "No categorized spending is available."}</small></section><section><strong>{view.lifestyle.understanding.status === "known" ? `${view.lifestyle.understanding.percentage}% of spending value understood` : "Understanding unavailable"}</strong><small>{view.lifestyle.unclassifiedCount} unresolved transaction{view.lifestyle.unclassifiedCount === 1 ? "" : "s"} in this period.</small></section></>;
  else if (world === "investments") content = <><section><strong>{view.investments.accountCount} recorded investment account{view.investments.accountCount === 1 ? "" : "s"}</strong><small>{view.investments.changeMessage}</small></section><section><strong>Performance remains evidence-bound</strong><small>Recorded account-value movement is not described as return without complete contribution, withdrawal, fee and performance evidence.</small></section></>;
  else content = <section><strong>Known facts only</strong><small>This World remains factual and Unknown where current evidence is incomplete.</small></section>;
  return <FinancialIntelligence><div><p className="world-kicker">{world} · Intelligence</p>{content}</div><div className="assistant-reserve"><span>Vorvex Assistant</span><small>Reserved for future guided intelligence.</small></div></FinancialIntelligence>;
}

function CashflowChildDetail({ child, view }: { child: CashflowChildKey; view: HomepageViewModel }) {
  const currency = view.currency;
  const expected = view.recentAndUpcoming.upcoming.filter((item) => item.certainty === "expected");
  if (child === "money-in") return <><p className="world-kicker">Cash · Money In</p><h2>Money In</h2><div className="pnn-grid"><section><p>Past · ranked</p><ActivityList title="Top incoming movements" items={view.cashflow.topInflows} currency={currency} empty="No eligible inflows are available." /></section><section><p>Now · {view.period.displayLabel}</p><strong className="pnn-value">{moneyLabel(view.cashflow.moneyIn, currency)}</strong><small>Verified genuine income only. Refunds, reimbursements, transfers, settlements and asset movements remain separate.</small></section><section><p>Next · ranked impact</p>{expected.filter((item) => item.direction === "inflow").slice(0, 3).map((item) => <span key={item.viewKey}><strong>{item.label}</strong><small>~+{formatMoney(item.amount, currency)} · {item.date} · {item.confidence}</small></span>)}{!expected.some((item) => item.direction === "inflow") && <small>Nothing known yet</small>}</section></div><div className="financial-hud__expanded-evidence"><FlowGroups title="Where incoming money came from" groups={view.cashflow.inflowGroups} currency={currency} /></div></>;
  if (child === "money-out") return <><p className="world-kicker">Cash · Money Out</p><h2>Money Out</h2><div className="pnn-grid"><section><p>Past · ranked</p><ActivityList title="Top Money Out" items={view.cashflow.topOutflows} currency={currency} empty="No eligible outflows are available." /></section><section><p>Now · {view.period.displayLabel}</p><strong className="pnn-value">{moneyLabel(view.cashflow.moneyOut, currency)}</strong><small>Qualifying outflow; card settlements and transfers are disclosed without becoming duplicate spending.</small></section><section><p>Next · ranked impact</p>{expected.filter((item) => item.direction === "outflow").slice(0, 3).map((item) => <span key={item.viewKey}><strong>{item.label}</strong><small>~−{formatMoney(item.amount, currency)} · {item.date} · {item.confidence}</small></span>)}{!expected.some((item) => item.direction === "outflow") && <small>Nothing known yet</small>}</section></div><div className="financial-hud__expanded-evidence"><FlowGroups title="Where Money Out went" groups={view.cashflow.outflowGroups} currency={currency} /></div></>;
  if (child === "recent") return <><p className="world-kicker">Cashflow · Recent</p><h2>Recent</h2><div className="pnn-grid"><section><p>Past</p><ActivityList title="Factual activity" items={view.recentAndUpcoming.recent} currency={currency} empty="No recent activity is available." /></section><section><p>Now</p><strong>{view.recentAndUpcoming.recent.length} recent events</strong><small>{view.cashflow.reviewNeededCount} still need understanding in the selected period.</small></section><section><p>Next</p><small>{view.recentAndUpcoming.upcoming.length ? `${view.recentAndUpcoming.upcoming.length} known or expected movement${view.recentAndUpcoming.upcoming.length === 1 ? "" : "s"} ahead.` : "Nothing known or strongly expected yet."}</small></section></div></>;
  const known = view.recentAndUpcoming.upcoming.filter((item) => item.certainty === "known");
  return <><p className="world-kicker">Cashflow · Upcoming</p><h2>Upcoming</h2><div className="pnn-grid"><section><p>Past</p><ActivityList title="Evidence behind expectations" items={view.recentAndUpcoming.recent.filter((item) => item.kind === "income" || item.kind === "spending")} currency={currency} empty="No supporting recent pattern is available." /></section><section><p>Now · Known</p>{known.slice(0, 3).map((item) => <span key={item.viewKey}><strong>{item.label}</strong><small>{formatMoney(item.amount, currency)} minimum payment · Due {item.date}</small></span>)}{known.length === 0 && <small>Nothing known yet</small>}</section><section><p>Next · expected impact</p>{expected.slice(0, 3).map((item) => <span key={item.viewKey}><strong>{item.label}</strong><small>~{formatMoney(item.amount, currency)} · {item.date} · {item.confidence}</small></span>)}{expected.length === 0 && <small>No strong historical pattern is currently upcoming.</small>}</section></div></>;
}

function CategoryDetail({ category, currency, period, world }: { category: HomepageLifestyleCategory; currency: string; period: HomepageViewModel["period"]; world: string }) {
  return <>
    <p className="world-kicker">{world} · Category</p>
    <h2>{category.label}</h2>
    <div className="category-detail-grid"><section><p className="section-label">Transactions</p><ul className="lifestyle-transactions">{category.transactions.map((transaction) => <li key={transaction.viewKey}><span><strong>{transaction.description}</strong><small>{transaction.date} · {transaction.accountName}{transaction.needsReview ? " · genuinely Unknown" : ""}</small>{transaction.correction && <InlineTransactionCorrection correction={transaction.correction} />}</span><b className={transaction.spendingImpact < 0 ? "refund" : "spending"}>{transaction.spendingImpact < 0 ? "−" : ""}{formatMoney(Math.abs(transaction.spendingImpact), currency)}</b></li>)}</ul></section><aside><p className="section-label">Selected period</p><strong className="category-total">{formatMoney(category.total, currency)}</strong><small>{category.transactions.length} transaction{category.transactions.length === 1 ? "" : "s"} · {period.displayLabel}</small></aside></div>
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

const nodeValue = (world: NavigationWorldKey, view: HomepageViewModel) => {
  if (world === "cash") return "Everyday circulation";
  if (world === "investments") return moneyLabel(view.investments.total, view.currency);
  if (world === "home") return view.home.asset ? moneyLabel(view.home.asset.value, view.currency) : view.home.financing ? "Financing known" : "Unknown";
  if (world === "vehicle") return view.vehicle.financing ? "Financing known" : "Unknown";
  return moneyLabel(view.lifestyle.qualifyingSpending, view.currency);
};

export default function FinancialHome({ view }: { view: HomepageViewModel }) {
  const [selected, setSelected] = useState<NavigationWorldKey | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<HomepageAccount | null>(null);
  const [selectedLifestyle, setSelectedLifestyle] = useState<string | null>(null);
  const [selectedRealWorldCategory, setSelectedRealWorldCategory] = useState<string | null>(null);
  const [selectedFinancing, setSelectedFinancing] = useState(false);
  const [selectedCashflow, setSelectedCashflow] = useState<CashflowChildKey | null>(null);
  const [selectedFlowGroup, setSelectedFlowGroup] = useState<FlowGroup | null>(null);
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
  const selectWorld = (world: NavigationWorldKey) => { setSelected(world); setSelectedAccount(null); setSelectedLifestyle(null); setSelectedRealWorldCategory(null); setSelectedFinancing(false); setSelectedCashflow(null); setSelectedFlowGroup(null); beginTravel(true); };
  const leaveWorld = () => { setSelected(null); setSelectedAccount(null); setSelectedLifestyle(null); setSelectedRealWorldCategory(null); setSelectedFinancing(false); setSelectedCashflow(null); setSelectedFlowGroup(null); beginTravel(false); };
  const leaveObject = () => { setSelectedAccount(null); setSelectedLifestyle(null); setSelectedRealWorldCategory(null); setSelectedFinancing(false); setSelectedCashflow(null); setSelectedFlowGroup(null); beginTravel(true); };
  const closeSurface = () => { setSurfaceAfterTravel(false); setSurfaceOpen(false); };
  const accountWorld = selected === "cash" || selected === "investments" ? selected : null;
  const worldAccounts = accountWorld ? view[accountWorld].accounts : [];
  const depth = selectedAccount || selectedLifestyleCategory || selectedWorldCategory || selectedFinancing || selectedCashflow ? "object" : selected ? "world" : "person";
  const recordedLabel = (account: HomepageAccount) => account.freshness.status === "known" ? account.freshness.asOf.replace(/, \d{1,2}:\d{2} [ap]\.m\.$/i, "") : "date Unknown";
  const accountChildren: SpatialChild[] = worldAccounts.map((account) => ({ key: account.viewKey, label: account.displayName, value: `${moneyLabel(account.balance, view.currency)}\nLatest · ${recordedLabel(account)}`, tone: account.accountType === "Credit card" ? "liabilities" : selected === "investments" ? "investments" : "cash", icon: <VorvexIcon icon={account.accountType === "Credit card" ? "liabilities" : selected === "investments" ? "investments" : "chequing"} />, semanticType: "snapshot", positionState: true, selected: selectedAccount?.viewKey === account.viewKey, select: () => { setSelectedAccount(account); beginTravel(true); } }));
  const lifestyleChildren: SpatialChild[] = selected === "lifestyle" ? view.lifestyle.categories.map((category) => ({ key: category.viewKey, label: category.label, value: formatMoney(category.total, view.currency), tone: category.needsReview ? "review" : "lifestyle", icon: categoryIcon(category.label), semanticType: "period-flow", reviewState: category.needsReview, selected: selectedLifestyleCategory?.viewKey === category.viewKey, select: () => { setSelectedLifestyle(category.label); beginTravel(true); } })) : [];
  const realWorldChildren: SpatialChild[] = selected === "home" || selected === "vehicle" ? [
    ...(view[selected].financing ? [{ key: `${selected}-financing`, label: view[selected].financing.displayName, value: moneyLabel(view[selected].financing.balance, view.currency), tone: selected, icon: <VorvexIcon icon={selected} />, selected: selectedFinancing, select: () => { setSelectedFinancing(true); beginTravel(true); } }] : []),
    ...view[selected].categories.map((category) => ({ key: category.viewKey, label: category.label, value: formatMoney(category.total, view.currency), tone: selected, icon: categoryIcon(category.label), semanticType: "period-flow" as const, selected: selectedWorldCategory?.viewKey === category.viewKey, select: () => { setSelectedRealWorldCategory(category.label); beginTravel(true); } })),
  ] : [];
  const cashflowDefinitions: ReadonlyArray<{ key: CashflowChildKey; label: string; value: string; tone: FinancialOrbAccent; icon: VorvexIconKey; semanticType?: "period-flow" | "expectation" }> = [
    { key: "money-in", label: "Money In", value: moneyLabel(view.cashflow.moneyIn, view.currency), tone: "cashflow", icon: "income", semanticType: "period-flow" },
    { key: "money-out", label: "Money Out", value: moneyLabel(view.cashflow.moneyOut, view.currency), tone: "cashflow", icon: "outflow", semanticType: "period-flow" },
    { key: "recent", label: "Recent", value: `${view.recentAndUpcoming.recent.length} events`, tone: "cashflow", icon: "recent" },
    { key: "upcoming", label: "Upcoming", value: `${view.recentAndUpcoming.upcoming.length} known + expected`, tone: "cashflow", icon: "upcoming", semanticType: "expectation" },
  ];
  const cashflowChildren: SpatialChild[] = selected === "cash" ? cashflowDefinitions.map((child) => ({ ...child, tone: "cash" as const, icon: <VorvexIcon icon={child.icon} />, selected: selectedCashflow === child.key, select: () => { setSelectedCashflow(child.key); beginTravel(true); } })) : [];
  const circulationGroups = selectedCashflow === "money-in" ? view.cashflow.inflowGroups : selectedCashflow === "money-out" ? view.cashflow.outflowGroups : [];
  const circulationIcon = (group: FlowGroup): VorvexIconKey => group.label === "Home" ? "home" : group.label === "Vehicle" ? "vehicle" : group.label === "Investments" ? "investments" : group.label === "Lifestyle" ? "lifestyle" : /card/i.test(group.label) ? "liabilities" : selectedCashflow === "money-in" ? "income" : "outflow";
  const circulationTone = (group: FlowGroup): FinancialOrbAccent => group.label === "Home" ? "home" : group.label === "Vehicle" ? "vehicle" : group.label === "Investments" ? "investments" : group.label === "Lifestyle" ? "lifestyle" : /card/i.test(group.label) ? "liabilities" : "cashflow";
  const openFlowGroup = (group: FlowGroup) => {
    if (group.label === "Home") return selectWorld("home");
    if (group.label === "Vehicle") return selectWorld("vehicle");
    if (group.label === "Investments") return selectWorld("investments");
    if (group.label === "Lifestyle") return selectWorld("lifestyle");
    if (/card/i.test(group.label)) { const card = view.cash.accounts.find((account) => account.accountType === "Credit card"); if (card) { setSelectedCashflow(null); setSelectedFlowGroup(null); setSelectedAccount(card); beginTravel(true); return; } }
    setSelectedFlowGroup(group); beginTravel(true);
  };
  const circulationChildren: SpatialChild[] = circulationGroups.map((group) => ({ key: `circulation-${group.key}`, label: group.label, value: formatMoney(group.total, view.currency), tone: circulationTone(group), icon: <VorvexIcon icon={circulationIcon(group)} />, semanticType: "period-flow", selected: false, select: () => openFlowGroup(group) }));
  const cardGroups = selectedAccount?.accountType === "Credit card" ? selectedAccount.activity.projectionGroups : [];
  const openCardGroup = (group: FlowGroup) => {
    if (group.label === "Home") return selectWorld("home");
    if (group.label === "Vehicle") return selectWorld("vehicle");
    if (group.label === "Investments") return selectWorld("investments");
    if (group.label === "Lifestyle") return selectWorld("lifestyle");
    if (group.label === "Payment from TD Chequing") { const chequing = view.cash.accounts.find((account) => account.accountType === "Chequing"); if (chequing) { setSelectedAccount(chequing); beginTravel(true); return; } }
    beginTravel(true);
  };
  const cardProjectionChildren: SpatialChild[] = cardGroups.map((group) => ({ key: `card-${group.key}`, label: group.label, value: formatMoney(group.total, view.currency), tone: circulationTone(group), icon: <VorvexIcon icon={group.label === "Payment from TD Chequing" ? "chequing" : circulationIcon(group)} />, semanticType: "period-flow", selected: false, select: () => openCardGroup(group) }));
  const spatialChildren = cardGroups.length ? [...accountChildren.filter((child) => child.selected), ...cardProjectionChildren] : circulationGroups.length ? [...cashflowChildren.filter((child) => child.selected), ...circulationChildren] : [...accountChildren, ...lifestyleChildren, ...realWorldChildren, ...cashflowChildren];
  const activeTone = selected ?? "net-worth";
  const hudContextKey = [selected, selectedAccount?.viewKey, selectedLifestyleCategory?.viewKey, selectedWorldCategory?.viewKey, selectedFinancing ? "financing" : "", selectedCashflow, selectedFlowGroup?.key].filter(Boolean).join(":");
  return <main className={`universe-shell depth-${depth} ${selected ? `world-${selected}` : ""} ${travelling ? "is-travelling" : ""}`} aria-busy={travelling}>
    <WebglAurora />
    <div className="space-dust" aria-hidden="true" />
    <header className="universe-header"><div><button type="button" className="universe-brand" onClick={leaveWorld} aria-label="Return to Universe">Vorvex</button><span>{view.snapshotDate ?? "Snapshot unavailable"}</span></div><nav className="header-actions" aria-label="Financial data tools"><Link href="/facts">My data</Link><Link href="/statements">Add statements</Link><Link href="/review" className="header-review">Genuinely Unknown {view.attention.genuinelyUnknownCount > 0 && <span>{view.attention.genuinelyUnknownCount}</span>}</Link></nav></header>
    <nav className="journey-trail" aria-label="Current location"><button type="button" onClick={leaveWorld} aria-current={!selected ? "page" : undefined}>Universe</button>{selected && <><span>›</span><button type="button" onClick={() => selectWorld(selected)} aria-current={depth === "world" ? "page" : undefined}>{WORLD_META.find((world) => world.key === selected)?.label}</button></>}{depth === "object" && <><span>›</span><b>{selectedFlowGroup?.label ?? selectedAccount?.displayName ?? selectedLifestyleCategory?.label ?? selectedWorldCategory?.label ?? (selectedFinancing && (selected === "home" || selected === "vehicle") ? view[selected].financing?.displayName : null) ?? cashflowDefinitions.find((child) => child.key === selectedCashflow)?.label ?? "Detail"}</b></>}</nav>
    {selected && <TimeNavigator period={view.period} />}
    <FinancialScene depth={depth} tone={activeTone} travelling={travelling}>
      <SpatialTransition active={travelling} />
      <div className="financial-scene__center">
        <FinancialOrb name="Net Worth" value={moneyLabel(view.position.netWorth, view.currency)} icon={<VorvexIcon icon="net-worth" />} accent="net-worth" semanticType="snapshot" size="hero" state={selected ? "receded" : "selected"} onClick={leaveWorld} aria-label="Return to your universe" />
      </div>
      <FinancialConstellation label="Financial constellation">{WORLD_META.map((world) => { const isParent = depth === "object" && selected === world.key; const state = isParent ? "parent" : selected === world.key ? "selected" : selected ? "receded" : "idle"; return <FinancialOrb key={world.key} name={world.label} value={nodeValue(world.key, view)} icon={<FinancialWorldIcon world={world.key} />} accent={world.tone} semanticType={world.key === "lifestyle" ? "period-flow" : world.key === "cash" ? undefined : "snapshot"} size={selected === world.key ? "primary" : "secondary"} state={state} onClick={isParent ? leaveObject : () => selectWorld(world.key)} aria-label={isParent ? `Return to ${world.label}` : undefined} aria-pressed={selected === world.key} />; })}</FinancialConstellation>
      <FinancialConstellation label={selected ? `${selected} objects` : "Financial objects"} role="children">{spatialChildren.map((child) => <FinancialOrb key={child.key} name={child.label} value={child.value} icon={child.icon} accent={child.tone} semanticType={child.semanticType} size={child.selected ? "primary" : "secondary"} state={child.selected ? "selected" : depth === "object" && circulationGroups.length === 0 && cardGroups.length === 0 ? "receded" : "idle"} className={[child.reviewState ? "financial-orb--review-state" : "", child.positionState ? "financial-orb--position" : ""].filter(Boolean).join(" ")} onClick={child.select} />)}</FinancialConstellation>
    </FinancialScene>
    {selected && (selectedAccount || selectedLifestyleCategory || selectedWorldCategory || selectedFinancing) && <IntelligenceRail view={view} world={selected} account={selectedAccount} category={selectedLifestyleCategory ?? selectedWorldCategory} />}
    {selected && !travelling && <FinancialHud key={hudContextKey} open={surfaceOpen} onOpen={() => setSurfaceOpen(true)} onClose={closeSurface}>{selectedLifestyleCategory && selected === "lifestyle"
      ? <CategoryDetail category={selectedLifestyleCategory} currency={view.currency} period={view.period} world="Lifestyle" />
      : selectedWorldCategory && (selected === "home" || selected === "vehicle")
      ? <CategoryDetail category={selectedWorldCategory} currency={view.currency} period={view.period} world={selected === "home" ? "Home" : "Vehicle"} />
      : selectedFinancing && (selected === "home" || selected === "vehicle")
      ? <RealWorldDetail title={selected === "home" ? "Home" : "Vehicle"} heading={view[selected].financing?.displayName ?? "Financing"} object={view[selected]} currency={view.currency} manageFacts />
      : selectedFlowGroup && selected === "cash" && !selectedAccount
      ? <FlowGroupDetail group={selectedFlowGroup} direction={selectedCashflow === "money-in" ? "inflow" : "outflow"} currency={view.currency} />
      : selectedCashflow && selected === "cash"
      ? <CashflowChildDetail child={selectedCashflow} view={view} />
      : selectedAccount && (selected === "cash" || selected === "investments")
      ? <AccountDetail account={selectedAccount} world={selected} view={view} />
      : <WorldDetail world={selected} view={view} />}</FinancialHud>}
    <footer className="universe-footer"><p>{view.coverage.message}</p><span>{view.period.displayLabel}</span></footer>
  </main>;
}
