import { ingestTransactions } from "@/lib/transactions/ingestion";
import { loadState, saveState } from "@/lib/prototype/store";
import type { CorrectionInput } from "@/types/prototype";

export async function POST(request: Request) {
  try {
    const input = await request.json() as CorrectionInput;
    if (!input || typeof input.transactionId !== "string" || typeof input.category !== "string" || !input.category.trim() || input.category.length > 80) return Response.json({ error: "A valid transaction and category are required." }, { status: 400 });
    const state = await loadState(); if (!state.transactions.some((t) => t.id === input.transactionId)) return Response.json({ error: "Transaction was not found." }, { status: 404 });
    const correction = { transactionId: input.transactionId, world: input.world, category: input.category.trim(), correctedAt: new Date().toISOString() };
    state.corrections = [...state.corrections.filter((c) => c.transactionId !== input.transactionId), correction];
    const establishedRoles = new Map(state.transactions.map((transaction) => [transaction.id, transaction.financialRole]));
    state.transactions = ingestTransactions(state.transactions.map((t) => ({ id: t.id, accountId: t.accountId, date: t.date, amount: t.amount, direction: t.direction, description: t.rawDescription, status: t.status, sourceRecordId: t.provenance.sourceRecordId, source: t.provenance.providerId, sourceKind: t.provenance.sourceKind, observedAt: t.provenance.observedAt, sourceUpdatedAt: t.provenance.sourceUpdatedAt })), { corrections: state.corrections }).transactions.map((transaction) => {
      const role = establishedRoles.get(transaction.id);
      return role === "transfer" || role === "credit-card-payment" ? { ...transaction, financialRole: role } : transaction;
    });
    state.updatedAt = correction.correctedAt; await saveState(state); return Response.json({ ok: true });
  } catch { return Response.json({ error: "Correction could not be saved; existing state was preserved." }, { status: 500 }); }
}
