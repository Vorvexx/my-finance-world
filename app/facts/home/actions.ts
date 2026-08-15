"use server";

import { redirect } from "next/navigation";
import { loadFounderWorldFacts, saveFounderWorldFacts } from "@/lib/runtime/world-facts";

const text = (data: FormData, name: string) => String(data.get(name) ?? "").trim();
const amount = (value: string) => value === "" ? null : Number(value);
export async function saveHomeFacts(data: FormData) {
  const propertyValue = amount(text(data, "propertyValue"));
  const propertyDate = text(data, "propertyDate");
  const mortgageBalance = amount(text(data, "mortgageBalance"));
  const mortgageInstitution = text(data, "mortgageInstitution");
  const mortgageDate = text(data, "mortgageDate");
  if ((propertyValue !== null && !propertyDate) || (propertyValue === null && propertyDate)
    || (mortgageBalance !== null && (!mortgageInstitution || !mortgageDate))
    || (mortgageBalance === null && (mortgageInstitution || mortgageDate))) throw new Error("Complete every field for each fact you provide.");
  const existing = loadFounderWorldFacts();
  saveFounderWorldFacts({ ...existing, version: 1, home: {
    property: propertyValue === null ? null : { value: propertyValue, currency: "CAD", effectiveDate: propertyDate, source: "founder-manual" },
    mortgage: mortgageBalance === null ? null : { institution: mortgageInstitution, balance: mortgageBalance, currency: "CAD", effectiveDate: mortgageDate, source: "founder-manual" },
  } });
  redirect("/");
}
