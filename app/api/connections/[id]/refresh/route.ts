import { NextResponse } from "next/server";
import { PlaidConnector } from "@/lib/connections/plaid-connector";
import { withProviderStore } from "@/lib/connections/provider-runtime";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const existing = withProviderStore((store) => store.get(id)); if (!existing) return NextResponse.json({ message: "Connection was not found." }, { status: 404 }); const refreshed = await new PlaidConnector().refresh(existing); const saved = withProviderStore((store) => store.save(refreshed)); return saved ? NextResponse.json({ refreshed: true }) : NextResponse.json({ message: "Refresh could not be saved." }, { status: 503 }); }
