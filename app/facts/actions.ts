"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { loadCanonicalFinancialModel } from "@/lib/financial-model/load-canonical-financial-model";
import { loadFounderWorldFacts, saveFounderWorldFacts } from "@/lib/runtime/world-facts";

const text = (data: FormData, name: string) => String(data.get(name) ?? "").trim();
const money = (data: FormData, name: string) => { const value = Number(text(data, name)); if (!Number.isFinite(value) || value < 0) throw new Error("Enter a valid non-negative amount."); return value; };
const date = (data: FormData, name: string) => { const value = text(data, name); if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Choose an effective date."); return value; };
const currentFacts = () => loadFounderWorldFacts() ?? { version: 1 as const, home: { property: null, mortgage: null } };

export async function updateAccountFact(data: FormData) {
  const model = await loadCanonicalFinancialModel();
  const accounts = model.money.accounts.filter((account) => !["founder-home-property", "founder-home-mortgage", "founder-vehicle-asset"].includes(account.id));
  const match = /^account-(\d+)$/.exec(text(data, "accountKey"));
  const account = match ? accounts[Number(match[1]) - 1] : null;
  if (!account) throw new Error("The selected account is unavailable. Refresh and try again.");
  const facts = currentFacts();
  const effectiveDate = date(data, "effectiveDate");
  const balance = money(data, "balance");
  const additional = [...(facts.additionalAccounts ?? [])];
  const additionalIndex = additional.findIndex((item) => item.id === account.id);
  if (additionalIndex >= 0) additional[additionalIndex] = { ...additional[additionalIndex], balance, effectiveDate };
  const overrides = additionalIndex >= 0 ? [...(facts.accountOverrides ?? [])] : [
    ...(facts.accountOverrides ?? []).filter((item) => item.canonicalAccountId !== account.id),
    { canonicalAccountId: account.id, balance, effectiveDate, source: "founder-manual" as const },
  ];
  saveFounderWorldFacts({ ...facts, accountOverrides: overrides, additionalAccounts: additional });
  redirect("/facts?saved=account");
}

export async function addFinancialAccount(data: FormData) {
  const world = text(data, "world");
  if (!new Set(["cash", "investments", "liabilities"]).has(world)) throw new Error("Choose a supported financial World.");
  const name = text(data, "name"), institution = text(data, "institution");
  if (!name || !institution) throw new Error("Account name and institution are required.");
  const facts = currentFacts();
  const type = world === "liabilities" ? "liability" as const : "asset" as const;
  const group = world === "liabilities" ? "debts" as const : world === "investments" ? "investments" as const : "cash" as const;
  saveFounderWorldFacts({ ...facts, additionalAccounts: [...(facts.additionalAccounts ?? []), {
    id: `founder-account-${randomUUID()}`, name, institution, balance: money(data, "balance"), type, group,
    effectiveDate: date(data, "effectiveDate"), source: "founder-manual",
  }] });
  redirect("/facts?saved=new-account");
}

export async function updateHomeAndVehicleFacts(data: FormData) {
  const facts = currentFacts();
  const optionalMoney = (name: string) => text(data, name) ? money(data, name) : null;
  const propertyValue = optionalMoney("propertyValue"), mortgageBalance = optionalMoney("mortgageBalance"), vehicleValue = optionalMoney("vehicleValue");
  const propertyDate = text(data, "propertyDate"), mortgageDate = text(data, "mortgageDate"), vehicleDate = text(data, "vehicleDate");
  const mortgageInstitution = text(data, "mortgageInstitution"), vehicleDescription = text(data, "vehicleDescription");
  if ((propertyValue !== null) !== Boolean(propertyDate) || (mortgageBalance !== null) !== Boolean(mortgageDate && mortgageInstitution) || (vehicleValue !== null) !== Boolean(vehicleDate && vehicleDescription)) throw new Error("Complete every field for each fact you provide.");
  saveFounderWorldFacts({ ...facts, home: {
    property: propertyValue === null ? null : { value: propertyValue, currency: "CAD", effectiveDate: propertyDate, source: "founder-manual" },
    mortgage: mortgageBalance === null ? null : { institution: mortgageInstitution, balance: mortgageBalance, currency: "CAD", effectiveDate: mortgageDate, source: "founder-manual" },
  }, vehicle: vehicleValue === null ? null : { description: vehicleDescription, value: vehicleValue, currency: "CAD", effectiveDate: vehicleDate, source: "founder-manual" } });
  redirect("/facts?saved=worlds");
}
