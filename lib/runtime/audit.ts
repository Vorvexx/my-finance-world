import { appendFileSync, chmodSync } from "node:fs";
import { founderRuntimePaths } from "./paths.ts";

export type SafeAuditEvent = {
  at: string;
  event: "provisioned" | "runtime-started" | "runtime-stopped" | "review-saved" | "relationship-saved";
  authority: "founder" | "engineering-rule" | "runtime";
  source: "local-ui" | "local-runtime";
  reason: string;
};

export const appendSafeAuditEvent = (event: SafeAuditEvent, home?: string) => {
  const file = founderRuntimePaths(home).auditFile;
  appendFileSync(file, `${JSON.stringify(event)}\n`, { encoding: "utf8", mode: 0o600 });
  chmodSync(file, 0o600);
};
