"use client";
import { useState, type FormEvent } from "react";
export default function PlaidSetup() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/connections/plaid/configure", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: fields.get("clientId"), secret: fields.get("secret") }) });
      form.reset();
      if (response.ok) location.reload();
      else { const body = await response.json() as { message?: string }; setMessage(body.message ?? "Setup was not completed. Check your Production credentials and local Keychain access."); }
    } catch { form.reset(); setMessage("Setup could not be saved."); }
    finally { setBusy(false); }
  };
  return <details className="mt-6 rounded-2xl border border-white/10 p-5"><summary>Configure Plaid Production / Trial</summary><p className="mt-3 text-sm text-slate-400">Enter your Plaid developer credentials here personally. The secret is saved in this Mac’s Keychain. Never enter TD login details here.</p><form onSubmit={(event) => void submit(event)} autoComplete="off" className="mt-4 grid gap-3"><label>Plaid Client ID<input name="clientId" required autoComplete="off" className="block w-full rounded bg-slate-800 p-2" /></label><label>Plaid Production secret<input name="secret" type="password" required autoComplete="new-password" className="block w-full rounded bg-slate-800 p-2" /></label><button disabled={busy} className="rounded-full bg-emerald-300 px-4 py-2 font-semibold text-slate-950">{busy ? "Saving…" : "Save Production credentials to Keychain"}</button><p role="status">{message}</p></form></details>;
}
