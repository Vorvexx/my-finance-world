import Link from "next/link";
import { connection } from "next/server";
import ReviewDecisionForm from "@/components/review-decision-form";
import RelationshipDecisionForm from "@/components/relationship-decision-form";
import { loadReviewQueue } from "@/lib/review/review-runtime";
import { withReviewRuntime } from "@/lib/review/review-runtime";
import { loadCanonicalFinancialModel } from "@/lib/financial-model/load-canonical-financial-model";
import { loadPersistedFinancialSources } from "@/lib/persistence/load-persisted-financial-sources";
import { loadRelationshipQueue } from "@/lib/relationships/relationship-runtime";
import { applyDeterministicAttribution } from "@/lib/transactions/attribution";
import { applyReviewOutcomes } from "@/lib/review/apply-review-outcomes";
import VorvexShell from "@/components/vorvex-shell";
import UnderstandingHistory from "@/components/understanding-history";

const CLASSIFICATION_FOCUS_LIMIT = 24;
const RELATIONSHIP_FOCUS_LIMIT = 12;

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ focus?: string; sort?: string; change?: string }> }) {
  await connection();
  const query = await searchParams;
  const model = await loadCanonicalFinancialModel();
  const persisted = loadPersistedFinancialSources(model.money.accounts.map((account) => account.id));
  const evaluatedAt = new Date().toISOString();
  const attributed = persisted ? applyDeterministicAttribution(persisted.transactions) : [];
  const reviewed = withReviewRuntime(({ store }) => applyReviewOutcomes(attributed, store.evaluateTransactions(attributed, evaluatedAt), evaluatedAt)) ?? attributed;
  const queue = loadReviewQueue(reviewed, new Map(model.money.accounts.map((account) => [account.id, account.name])));
  const recentDecisions = withReviewRuntime(({ service }) => service.listRecentDecisions()) ?? [];
  const relationshipQueue = loadRelationshipQueue();
  const oldestFirst = query.sort === "oldest";
  const orderedClassifications = query.change ? [...queue.items].sort((left, right) => Number(right.description === query.change) - Number(left.description === query.change)) : queue.items;
  const orderedRelationships = relationshipQueue.status === "available" && !oldestFirst ? [...relationshipQueue.items].reverse() : relationshipQueue.items;
  const classificationItems = orderedClassifications.slice(0, CLASSIFICATION_FOCUS_LIMIT);
  const relationshipItems = orderedRelationships.slice(0, RELATIONSHIP_FOCUS_LIMIT);
  const showClassifications = query.focus !== "relationships";
  const showRelationships = query.focus !== "classifications" && relationshipQueue.items.length > 0;
  const totalPending = queue.items.length + relationshipQueue.items.length;
  const affectedTransactions = queue.items.reduce((total, item) => total + item.similarCount, 0) + relationshipQueue.items.length * 2;
  return (
    <VorvexShell eyebrow="Needs attention" title={`${totalPending} decision${totalPending === 1 ? "" : "s"} needed`} description={totalPending === 0 ? "Nothing needs your attention." : `These decisions affect ${affectedTransactions} transactions. Confirm the pattern once and Vorvex will remember it.`}>

        <nav className="mt-6 flex flex-wrap items-center gap-3 text-xs" aria-label="Review controls">
          <Link href="/review" className="rounded-full border border-white/10 px-4 py-2">All ({totalPending})</Link>
          <Link href="/review?focus=classifications" className="rounded-full border border-white/10 px-4 py-2">Transactions ({queue.items.length})</Link>
          {relationshipQueue.items.length > 0 && <Link href="/review?focus=relationships" className="rounded-full border border-white/10 px-4 py-2">Transfers and payments ({relationshipQueue.items.length})</Link>}
          <Link href={`/review?${query.focus ? `focus=${query.focus}&` : ""}sort=${oldestFirst ? "newest" : "oldest"}`} className="rounded-full border border-white/10 px-4 py-2">Show {oldestFirst ? "newest first" : "oldest first"}</Link>
          <span className="text-slate-500">{totalPending === 0 ? "Nothing needs attention" : `${affectedTransactions} transactions covered`}</span>
        </nav>

        {showClassifications && <section className="mt-8">
          <h2 className="text-xl font-semibold">What should Vorvex understand next?</h2>
        {queue.status === "unavailable" ? (
          <section className="mt-8 rounded-3xl border border-amber-300/20 bg-amber-300/[0.06] p-6 text-sm text-amber-100">{queue.message}</section>
        ) : queue.items.length === 0 ? (
          <section className="mt-8 rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.06] p-8">
            <h3 className="text-xl font-semibold">Everything here is understood</h3>
            <p className="mt-2 text-sm text-slate-400">There are no pending transactions that require a decision.</p>
          </section>
        ) : (
          <section id="pending-reviews" className="mt-8" aria-label="Pending reviews">
            <p className="text-sm text-slate-300">One decision at a time, starting with the most useful.</p>
            {classificationItems.slice(0, 1).map((item) => (
              <article key={item.actionToken} className="rounded-[28px] border border-white/10 bg-[#0b1821] p-6 md:p-7">
                <div className="review-transaction"><div><p>{item.recurring ? "Recurring transaction" : "Transaction"}</p><h3>{item.description}</h3><small>{item.accountNames.join(", ")} · {item.direction}</small></div><strong>{new Intl.NumberFormat("en-CA", { style: "currency", currency: item.currency }).format(item.totalAmount)}</strong></div>
                {item.similarCount > 1 && <p className="mt-3 text-sm text-emerald-200">One answer can update up to {item.similarCount} matching transactions.</p>}
                <details className="review-evidence"><summary>Why this suggestion?</summary><p>{item.explanation}</p><p>Representative description: {item.representativeDescription}</p></details>
                <ReviewDecisionForm item={item} />
              </article>
            ))}
          </section>
        )}
        </section>}

        {showRelationships && <section className="mt-12 border-t border-white/10 pt-8">
          <h2 className="text-xl font-semibold">Are these connected?</h2>
          <p className="mt-2 text-sm text-slate-400">Confirm only transfers or payments you recognize.</p>
          {relationshipQueue.status === "unavailable" ? (
            <div className="mt-6 rounded-3xl border border-amber-300/20 bg-amber-300/[0.06] p-6 text-sm text-amber-100">{relationshipQueue.message}</div>
          ) : (
            <div className="mt-6 space-y-5" aria-label="Relationship reviews">
              <p className="text-sm text-slate-400">Showing {relationshipItems.length} {oldestFirst ? "earliest" : "recent"} candidate{relationshipItems.length === 1 ? "" : "s"}. Only confirm relationships you recognize.</p>
              {relationshipItems.map((item) => (
                <article key={item.actionToken} className="rounded-[28px] border border-white/10 bg-[#0b1821] p-6 md:p-7">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">{item.proposedType.replaceAll("-", " ")}</p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-100">{item.firstDescription} ↔ {item.secondDescription}</h3>
                  <p className="mt-2 text-sm text-slate-400">{new Intl.NumberFormat("en-CA", { style: "currency", currency: item.currency }).format(item.amount)} · {item.firstDate} and {item.secondDate}</p>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl bg-white/[0.04] p-4"><h4 className="text-sm font-semibold">Supporting evidence</h4><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">{item.supportingEvidence.map((evidence) => <li key={evidence}>{evidence}</li>)}</ul></div>
                    <div className="rounded-2xl bg-white/[0.04] p-4"><h4 className="text-sm font-semibold">Missing evidence</h4><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">{item.missingEvidence.map((evidence) => <li key={evidence}>{evidence}</li>)}</ul></div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-300">{item.explanation}</p>
                  <RelationshipDecisionForm actionToken={item.actionToken} />
                </article>
              ))}
            </div>
          )}
        </section>}
        {recentDecisions.length > 0 && <section id="recent-decisions" className="mt-12 border-t border-white/10 pt-8"><h2 className="text-xl font-semibold">Recently understood</h2><p className="mt-2 text-sm text-slate-400">Mistakes are reversible. The newest decision is first; search older understandings and change one without creating another transaction.</p><UnderstandingHistory decisions={recentDecisions} /></section>}
    </VorvexShell>
  );
}
