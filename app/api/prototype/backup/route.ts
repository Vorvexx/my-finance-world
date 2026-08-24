import { createBackup, readBackup } from "@/lib/prototype/backup";
import { loadState, saveState } from "@/lib/prototype/store";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { passphrase?: unknown }; if (typeof body.passphrase !== "string") return Response.json({ error: "Passphrase is required." }, { status: 400 });
    const backup = createBackup(await loadState(), body.passphrase);
    return new Response(backup, { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="vorvex-backup-${new Date().toISOString().slice(0, 10)}.vorvex"`, "Cache-Control": "no-store" } });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Backup could not be created." }, { status: 400 }); }
}

export async function PUT(request: Request) {
  try {
    const form = await request.formData(); const file = form.get("backup"); const passphrase = form.get("passphrase");
    if (!(file instanceof File) || typeof passphrase !== "string") return Response.json({ error: "Backup file and passphrase are required." }, { status: 400 });
    const restored = readBackup(Buffer.from(await file.arrayBuffer()), passphrase); await saveState(restored); return Response.json({ ok: true, restoredAt: new Date().toISOString() });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Restore failed safely; current state was preserved." }, { status: 400 }); }
}
