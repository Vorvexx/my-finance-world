"use server";

import { redirect } from "next/navigation";
import { provisionFounderRuntime } from "@/lib/runtime/provisioning";
import { startFounderRuntime } from "@/lib/runtime/founder-runtime";

const field = (data: FormData, name: string) => {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
};

export type SetupState = { status: "idle" | "error"; message: string };

export async function completeFounderSetup(_previous: SetupState, formData: FormData): Promise<SetupState> {
  try {
    const confirmed = field(formData, "confirmed") === "yes";
    if (!confirmed) return { status: "error", message: "Confirm the selected factual state before continuing." };
    await provisionFounderRuntime({
      snapshotDirectory: field(formData, "snapshotDirectory"),
      chequingDisplayName: field(formData, "chequingDisplayName"),
      creditCardDisplayName: field(formData, "creditCardDisplayName"),
    });
    const status = await startFounderRuntime();
    if (status !== "running") return { status: "error", message: "Protected setup completed, but a required runtime resource is unavailable." };
  } catch (error) {
    const code = error instanceof Error ? error.message : "SETUP_FAILED";
    const messages: Record<string, string> = {
      SNAPSHOT_NOT_FOUND: "The selected folder does not contain the required verified snapshot.",
      SNAPSHOT_DUPLICATE_ACCOUNT_ID: "The snapshot contains duplicate account identities and cannot be migrated.",
      SNAPSHOT_TIMESTAMP_INVALID: "The snapshot contains an invalid account or snapshot timestamp.",
      ACCOUNT_SELECTION_AMBIGUOUS: "An account display name is missing or ambiguous. No mapping was inferred.",
      CHEQUING_ACCOUNT_INCOMPATIBLE: "The selected chequing name is not a canonical cash asset.",
      CREDIT_ACCOUNT_INCOMPATIBLE: "The selected credit-card name is not a canonical debt liability.",
      KEYCHAIN_WRITE_FAILED: "Vorvex could not create its protected macOS Keychain item.",
      MANAGED_SNAPSHOT_CONFLICT: "Existing managed snapshot bytes differ from the selected verified source. Setup stopped without overwriting them.",
    };
    return { status: "error", message: messages[code] ?? "Setup stopped safely. No financial value was inferred or repaired." };
  }
  redirect("/");
}
