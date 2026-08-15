import { redirect } from "next/navigation";
import { loadFounderConfiguration } from "@/lib/runtime/configuration";
import { connection } from "next/server";
import FounderSetupForm from "@/components/founder-setup-form";

export default async function SetupPage() {
  await connection();
  if (loadFounderConfiguration()) redirect("/");
  return (
    <main className="min-h-screen bg-[#071018] px-5 py-10 text-[#f4f7f5]">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.26em] text-emerald-400">Vorvex local setup</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Connect your verified financial state</h1>
        <p className="mt-4 text-sm leading-6 text-slate-400">Setup keeps the encryption key in your macOS Keychain, migrates a validated copy of the selected snapshot into protected Vorvex storage, and leaves the original untouched.</p>
        <FounderSetupForm />
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-xs leading-5 text-slate-400"><strong className="text-slate-200">After setup:</strong> use Statements to add TD Chequing and Credit Card history, Facts to maintain values statements cannot provide, and Review whenever Vorvex needs your decision.</section>
        <section className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-5 text-xs leading-5 text-amber-100"><strong>Key recovery:</strong> encrypted Vorvex databases cannot be opened if the Keychain item is deleted or inaccessible. Vorvex will block safely and will never generate a replacement key over an existing datastore.</section>
      </div>
    </main>
  );
}
