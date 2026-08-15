"use server";

import { spawnSync } from "node:child_process";
import { revalidatePath } from "next/cache";
import { loadFounderConfiguration } from "@/lib/runtime/configuration";
import { scanFounderStatements } from "@/lib/runtime/founder-runtime";

export type StatementActionState = { status: "idle" | "success" | "error"; message: string };

export async function scanNow(): Promise<StatementActionState> {
  try {
    const results = await scanFounderStatements();
    revalidatePath("/"); revalidatePath("/statements"); revalidatePath("/review");
    const imported = results.filter((item) => item.status === "imported").length;
    const already = results.filter((item) => item.status === "duplicate").length;
    const attention = results.filter((item) => !["imported", "duplicate"].includes(item.status)).length;
    return { status: "success", message: results.length
      ? `Scan complete: ${imported} imported, ${already} already processed, ${attention} need attention.`
      : "Scan complete. No new stable statements were waiting." };
  } catch { return { status: "error", message: "Vorvex could not scan the protected inbox. Existing financial data was not changed." }; }
}

export async function openStatementInbox(): Promise<StatementActionState> {
  const configuration = loadFounderConfiguration();
  if (!configuration) return { status: "error", message: "Complete local setup before opening the statement inbox." };
  const opened = spawnSync("/usr/bin/open", [configuration.statementFolder], { stdio: "ignore" });
  return opened.status === 0
    ? { status: "success", message: "The protected statement inbox was opened in Finder." }
    : { status: "error", message: "Vorvex could not open Finder. The inbox path is shown below." };
}
