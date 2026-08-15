import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { CanonicalFinancialModel, FinancialAccount } from "../../types/finance.ts";
import type { FounderWorldFacts } from "../../types/runtime.ts";
import { ingestFinancialSnapshot } from "../financial-model/canonical-financial-model.ts";
import { founderRuntimePaths } from "./paths.ts";

const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const validMoney = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0;
export const validateFounderWorldFacts = (value: unknown): FounderWorldFacts => {
  if (!value || typeof value !== "object") throw new Error("WORLD_FACTS_INVALID");
  const facts = value as FounderWorldFacts;
  const property = facts.home?.property;
  const mortgage = facts.home?.mortgage;
  const overrides = facts.accountOverrides ?? [];
  const additional = facts.additionalAccounts ?? [];
  const vehicle = facts.vehicle ?? null;
  if (facts.version !== 1 || !facts.home
    || (property !== null && (!validMoney(property?.value) || property.currency !== "CAD" || property.source !== "founder-manual" || !validDate(property.effectiveDate)))
    || (mortgage !== null && (!validMoney(mortgage?.balance) || !mortgage.institution?.trim() || mortgage.currency !== "CAD" || mortgage.source !== "founder-manual" || !validDate(mortgage.effectiveDate)))
    || !overrides.every((item) => item.canonicalAccountId?.trim() && validMoney(item.balance) && validDate(item.effectiveDate) && item.source === "founder-manual")
    || new Set(overrides.map((item) => item.canonicalAccountId)).size !== overrides.length
    || !additional.every((item) => item.id?.trim() && item.name?.trim() && item.institution?.trim() && validMoney(item.balance) && validDate(item.effectiveDate) && item.source === "founder-manual" && ["asset", "liability"].includes(item.type) && ["cash", "investments", "debts"].includes(item.group))
    || new Set(additional.map((item) => item.id)).size !== additional.length
    || (vehicle !== null && (!vehicle.description?.trim() || !validMoney(vehicle.value) || vehicle.currency !== "CAD" || vehicle.source !== "founder-manual" || !validDate(vehicle.effectiveDate)))) throw new Error("WORLD_FACTS_INVALID");
  return facts;
};

export const loadFounderWorldFacts = (home?: string): FounderWorldFacts | null => {
  const file = founderRuntimePaths(home).worldFactsFile;
  if (!existsSync(file)) return null;
  try { return validateFounderWorldFacts(JSON.parse(readFileSync(file, "utf8"))); } catch { return null; }
};

export const saveFounderWorldFacts = (facts: FounderWorldFacts, home?: string) => {
  const validated = validateFounderWorldFacts(facts);
  const file = founderRuntimePaths(home).worldFactsFile;
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.new`;
  writeFileSync(temporary, `${JSON.stringify(validated, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, file); chmodSync(file, 0o600);
};

export const applyFounderWorldFacts = (model: CanonicalFinancialModel, facts: FounderWorldFacts | null) => {
  if (model.status !== "loaded" || !facts) return model;
  const overrides = new Map((facts.accountOverrides ?? []).map((item) => [item.canonicalAccountId, item]));
  const accounts: FinancialAccount[] = model.money.accounts.map((account) => {
    const override = overrides.get(account.id);
    return override ? { ...account, balance: override.balance, updatedAt: override.effectiveDate } : account;
  });
  for (const account of facts.additionalAccounts ?? []) accounts.push({ id: account.id, name: account.name, institution: account.institution, balance: account.balance, type: account.type, group: account.group, updatedAt: account.effectiveDate });
  if (facts.home.property) accounts.push({ id: "founder-home-property", name: "Home", institution: "Founder-provided", balance: facts.home.property.value, type: "asset", group: "property", updatedAt: facts.home.property.effectiveDate });
  if (facts.home.mortgage) {
    const existingMortgage = accounts.findIndex((account) => account.type === "liability" && /mortgage/i.test(account.name));
    const mortgage: FinancialAccount = { id: existingMortgage >= 0 ? accounts[existingMortgage].id : "founder-home-mortgage", name: existingMortgage >= 0 ? accounts[existingMortgage].name : "Mortgage", institution: facts.home.mortgage.institution, balance: facts.home.mortgage.balance, type: "liability", group: "debts", updatedAt: facts.home.mortgage.effectiveDate };
    if (existingMortgage >= 0) accounts[existingMortgage] = mortgage; else accounts.push(mortgage);
  }
  if (facts.vehicle) accounts.push({ id: "founder-vehicle-asset", name: facts.vehicle.description, institution: "Founder-provided", balance: facts.vehicle.value, type: "asset", group: "other", updatedAt: facts.vehicle.effectiveDate });
  const dates = [model.money.lastUpdated, ...accounts.map((account) => account.updatedAt)].filter((value): value is string => Boolean(value)).sort();
  return ingestFinancialSnapshot({ accounts, lastUpdated: dates.at(-1) ?? null });
};
