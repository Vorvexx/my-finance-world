import { connection } from "next/server";
import { redirect } from "next/navigation";
import StatementActions from "@/components/statement-actions";
import { loadFounderConfiguration } from "@/lib/runtime/configuration";
import { loadOperationalView } from "@/lib/runtime/load-operational-view";
import { loadRuntimeHealth } from "@/lib/runtime/founder-runtime";
import VorvexShell from "@/components/vorvex-shell";

export default async function StatementsPage() {
  await connection();
  const configuration = loadFounderConfiguration();
  if (!configuration) redirect("/setup");
  const health = await loadRuntimeHealth();
  const operational = loadOperationalView();
  return <VorvexShell eyebrow="Statements" title="Build your financial history" description="Place supported TD Chequing or TD Credit Card statements in the protected inbox. Vorvex validates, avoids duplicates, and imports them locally.">
    <section className="mt-8 rounded-[28px] border border-white/10 bg-[#0b1821] p-6"><div className="flex flex-wrap items-center gap-3"><span className={`h-2.5 w-2.5 rounded-full ${health.status === "ready" ? "bg-emerald-300" : "bg-amber-300"}`} /><h2 className="text-xl font-semibold">{health.status === "ready" ? "Automatic scanning is active" : "Statement ingestion needs attention"}</h2></div><p className="mt-3 text-sm text-slate-400">{health.safeMessage}</p><p className="mt-5 text-xs text-slate-500">One inbox accepts both supported statement types. Vorvex identifies the statement and routes it to the configured account.</p><code className="mt-3 block overflow-x-auto rounded-xl bg-black/20 p-3 text-xs text-slate-300">{configuration.statementFolder}</code><StatementActions /></section>
    <section className="mt-8 grid gap-4 sm:grid-cols-4"><StatusCard label="Imported" value={operational.summary.imported} /><StatusCard label="Already processed" value={operational.summary.alreadyProcessed} /><StatusCard label="Needs Review" value={operational.summary.needsReview} /><StatusCard label="Failed / unsupported" value={operational.summary.failed} /></section>
    <section className="mt-8 rounded-[28px] border border-white/10 bg-[#0b1821] p-6"><h2 className="text-xl font-semibold">Available history</h2><p className="mt-3 text-sm text-slate-300">{operational.coverage.oldestTransaction && operational.coverage.newestTransaction ? `${operational.coverage.oldestTransaction} – ${operational.coverage.newestTransaction}` : "No imported transaction dates yet."}</p><p className="mt-2 text-xs leading-5 text-slate-500">{operational.coverage.explanation}</p></section>
    <section className="mt-8"><h2 className="text-xl font-semibold">Latest statement activity</h2>{operational.imports.length ? <div className="mt-4 space-y-3">{operational.imports.map((item, index) => <article key={`${item.at}-${item.outcome}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><strong className="text-sm">{item.outcome}</strong><span className="text-xs text-slate-500">{item.at}</span></div><p className="mt-2 text-sm text-slate-300">{item.source}{item.transactionCount ? ` · ${item.transactionCount} transactions` : ""}</p><p className="mt-2 text-xs leading-5 text-slate-500">{item.explanation}</p></article>)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-6 text-sm text-slate-400">No statement processing results yet. Add supported PDFs to begin.</div>}</section>
    <section className="mt-8 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.04] p-5 text-xs leading-5 text-slate-400"><strong className="text-emerald-200">Private by design.</strong> Statements stay on this device. Successfully committed or already processed source PDFs are removed from the inbox; unsupported or failed files remain for attention. Canonical financial data remains encrypted.</section>
  </VorvexShell>;
}

const StatusCard = ({ label, value }: { label: string; value: number }) => <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><span className="text-xs text-slate-500">{label}</span><strong className="mt-2 block text-2xl">{value}</strong></div>;
