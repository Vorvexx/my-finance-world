import { scanInbox } from "@/lib/prototype/scanner";
export async function POST() {
  try { return Response.json(await scanInbox()); }
  catch { return Response.json({ error: "Inbox scan failed safely. Existing financial state was preserved." }, { status: 500 }); }
}
