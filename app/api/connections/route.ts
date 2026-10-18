import { NextResponse } from "next/server";
import { withProviderStore } from "@/lib/connections/provider-runtime";
import { plaidConfiguration } from "@/lib/connections/plaid-connector";

export async function GET() { return NextResponse.json({ plaid: plaidConfiguration(), connections: withProviderStore((store) => store.publicList()) ?? [] }); }
