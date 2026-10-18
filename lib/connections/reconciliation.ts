import type { CanonicalTransaction } from "../../types/transactions.ts";
import type { StagedProviderTransaction } from "../../types/financial-provider.ts";

const cents = (value: number) => Math.round(value * 100);
const dayDistance = (left: string, right: string) => Math.abs(Date.parse(`${left}T00:00:00Z`) - Date.parse(`${right}T00:00:00Z`)) / 86_400_000;
const words = (value: string) => new Set(value.toLocaleUpperCase("en-CA").replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((item) => item.length > 2));
const descriptionOverlap = (left: string, right: string) => { const a = words(left); const b = words(right); return [...a].some((word) => b.has(word)); };
export const measureCanonicalOverlap = (staged: readonly StagedProviderTransaction[], canonical: readonly CanonicalTransaction[], accountMap: ReadonlyMap<string, string>) => staged.map((candidate) => {
  const canonicalAccount = accountMap.get(candidate.providerAccountId); const matches = canonical.filter((item) => (!canonicalAccount || item.accountId === canonicalAccount) && cents(item.amount) === cents(Math.abs(candidate.amount)) && dayDistance(item.transactionDate, candidate.date) <= 3 && descriptionOverlap(item.rawDescription, candidate.merchant || candidate.description));
  return { providerTransactionId: candidate.providerTransactionId, status: matches.length === 1 ? "probable-overlap" as const : matches.length > 1 ? "ambiguous" as const : "unmatched" as const, canonicalTransactionIds: matches.map((item) => item.id) };
});
export const mergeProviderLifecycle = (current: readonly StagedProviderTransaction[], incoming: readonly StagedProviderTransaction[]) => { const values = new Map(current.map((item) => [item.providerTransactionId, item])); for (const item of incoming) { if (item.pendingTransactionId) values.delete(item.pendingTransactionId); values.set(item.providerTransactionId, item); } return [...values.values()]; };
