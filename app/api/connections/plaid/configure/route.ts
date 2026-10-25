import { NextResponse } from "next/server";
import { isLocalSetupRequest, validatePlaidSetup, saveProductionPlaidSetup } from "@/lib/connections/plaid-setup";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!isLocalSetupRequest(request)) return NextResponse.json({ message: "Local same-origin setup is required." }, { status: 403, headers });
  try {
    const raw = await request.text();
    if (raw.length > 1024) return NextResponse.json({ message: "Invalid configuration." }, { status: 400, headers });
    const body: unknown = JSON.parse(raw);
    if (!validatePlaidSetup(body)) return NextResponse.json({ message: "Check the Client ID and Production secret." }, { status: 400, headers });
    saveProductionPlaidSetup(body.clientId, body.secret);
    return NextResponse.json({ configured: true }, { headers });
  } catch {
    return NextResponse.json({ message: "Keychain configuration could not be completed. Check local setup before connecting." }, { status: 503, headers });
  }
}
