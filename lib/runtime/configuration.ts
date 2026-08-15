import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import type { FounderRuntimeConfiguration } from "../../types/runtime.ts";
import { founderRuntimePaths } from "./paths.ts";

export const loadFounderConfiguration = (home?: string): FounderRuntimeConfiguration | null => {
  const file = founderRuntimePaths(home).configFile;
  if (!existsSync(file)) return null;
  try {
    const value = JSON.parse(readFileSync(file, "utf8")) as FounderRuntimeConfiguration;
    if (value.version !== 1 || !value.provisionedAt || !Array.isArray(value.accounts)
      || value.snapshotProvenance?.authority !== "founder-provided"
      || value.snapshotProvenance.validation !== "validated") return null;
    return value;
  } catch { return null; }
};

export const saveFounderConfiguration = (configuration: FounderRuntimeConfiguration, home?: string) => {
  const file = founderRuntimePaths(home).configFile;
  writeFileSync(file, `${JSON.stringify(configuration, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
  chmodSync(file, 0o600);
};
