export type InvestmentAccountType = "tfsa" | "rrsp" | "dcp" | "prpp";

export type ParsedInvestmentSnapshot = {
  parserVersion: string;
  providerId: "td" | "desjardins" | "canada-life";
  accountType: InvestmentAccountType;
  statementPeriodStart: string;
  statementPeriodEnd: string;
  endingValueCents: number;
  bookCostCents: number | null;
  contributionsCents: number | null;
  withdrawalsCents: number | null;
  employeeContributionsCents: number | null;
  employerContributionsCents: number | null;
  sourceSha256: string;
};

export type CanonicalInvestmentSnapshot = ParsedInvestmentSnapshot & {
  id: string;
  accountId: string;
  recordedAt: string;
};
