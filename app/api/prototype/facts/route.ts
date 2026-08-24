import { randomUUID } from "node:crypto";
import { loadState, saveState } from "@/lib/prototype/store";
import type { FounderFactInput, FounderFactKind } from "@/types/prototype";

const kinds = new Set<FounderFactKind>(["cash", "investment", "liability", "home", "mortgage", "vehicle", "vehicle-financing"]);

export async function POST(request: Request) {
  try {
    const input = await request.json() as FounderFactInput;
    if (!input || !kinds.has(input.kind) || typeof input.name !== "string" || !input.name.trim() || input.name.length > 80 || typeof input.value !== "number" || !Number.isFinite(input.value) || input.value < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate)) return Response.json({ error: "Provide a valid type, name, non-negative value, and effective date." }, { status: 400 });
    const state = await loadState(); const now = new Date().toISOString();
    const fact = { id: input.id ?? randomUUID(), kind: input.kind, name: input.name.trim(), value: Math.round(input.value * 100) / 100, effectiveDate: input.effectiveDate, updatedAt: now, provenance: "founder" as const };
    state.facts = [...state.facts.filter((item) => item.id !== fact.id), fact]; state.updatedAt = now; await saveState(state);
    return Response.json({ ok: true, fact });
  } catch { return Response.json({ error: "Founder fact could not be saved; existing state was preserved." }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id"); if (!id) return Response.json({ error: "Fact ID is required." }, { status: 400 });
    const state = await loadState(); if (!state.facts.some((fact) => fact.id === id)) return Response.json({ error: "Fact was not found." }, { status: 404 });
    state.facts = state.facts.filter((fact) => fact.id !== id); state.updatedAt = new Date().toISOString(); await saveState(state); return Response.json({ ok: true });
  } catch { return Response.json({ error: "Founder fact could not be removed." }, { status: 500 }); }
}
