import { NextResponse } from "next/server";
import { PlaidConnector } from "@/lib/connections/plaid-connector";
import { withProviderStore } from "@/lib/connections/provider-runtime";
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const existing = withProviderStore((store) => store.get(id)); if (!existing) return NextResponse.json({ message: "Connection was not found." }, { status: 404 }); try { await new PlaidConnector().disconnect(existing); } catch { /* local disconnect still prevents future use */ } withProviderStore((store) => store.remove(id)); return NextResponse.json({ disconnected: true }); }
