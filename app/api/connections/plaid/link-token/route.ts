import { NextResponse } from "next/server";
import { createPlaidLinkToken } from "@/lib/connections/plaid-connector";
export async function POST() { try { return NextResponse.json({ linkToken: await createPlaidLinkToken() }); } catch { return NextResponse.json({ message: "Plaid is not configured or could not be reached." }, { status: 503 }); } }
