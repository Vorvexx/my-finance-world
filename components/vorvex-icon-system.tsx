import type { ReactNode } from "react";

export type VorvexIconKey = "net-worth" | "cash" | "chequing" | "cashflow" | "investments" | "liabilities" | "home" | "vehicle" | "lifestyle" | "dining" | "entertainment" | "shopping" | "convenience" | "alcohol" | "cannabis" | "telecom" | "subscriptions" | "utilities" | "review" | "income" | "outflow" | "recent" | "upcoming";

const common = { viewBox: "0 0 48 48", fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function VorvexIcon({ icon }: { icon: VorvexIconKey }) {
  if (icon === "net-worth") return <svg {...common}><circle cx="24" cy="24" r="16"/><path d="M15 29c4-10 9-15 18-14M15 22c6 0 12 3 18 11"/><circle cx="24" cy="24" r="3"/></svg>;
  if (icon === "cash") return <svg {...common}><path d="M10 16h27a4 4 0 0 1 4 4v17H10a4 4 0 0 1-4-4V15a5 5 0 0 1 5-5h23"/><path d="M31 24h10v8H31a4 4 0 0 1 0-8Z"/><circle cx="33" cy="28" r="1"/></svg>;
  if (icon === "chequing") return <svg {...common}><path d="M6 18 24 7l18 11M9 19h30M11 37h26M8 42h32"/><path d="M14 20v15M21 20v15M28 20v15M35 20v15"/></svg>;
  if (icon === "cashflow") return <svg {...common}><path d="M7 35 17 23l8 7 15-19"/><path d="M32 11h8v8"/><path d="M8 13v22h33"/></svg>;
  if (icon === "investments") return <svg {...common}><path d="M8 38h33"/><path d="M12 33V24h6v9M22 33V18h6v15M32 33V11h6v22"/><path d="m10 19 10-7 8 4 12-9"/></svg>;
  if (icon === "liabilities") return <svg {...common}><rect x="6" y="11" width="36" height="26" rx="4"/><path d="M6 18h36M12 30h9"/><circle cx="35" cy="29" r="2"/></svg>;
  if (icon === "home") return <svg {...common}><path d="m5 23 19-16 19 16"/><path d="M10 20v21h28V20M20 41V29h8v12"/><path d="M17 20h14"/></svg>;
  if (icon === "vehicle") return <svg {...common}><path d="m8 29 4-11a5 5 0 0 1 5-3h15a5 5 0 0 1 5 3l4 11v8h-5v-4H12v4H7v-8h34"/><path d="M13 27h22M17 22h14"/><circle cx="14" cy="29" r="2"/><circle cx="34" cy="29" r="2"/></svg>;
  if (icon === "lifestyle") return <svg {...common}><path d="M10 18h25v9a11 11 0 0 1-11 11h-3a11 11 0 0 1-11-11v-9Z"/><path d="M35 22h3a5 5 0 0 1 0 10h-5M16 12c-2-3 2-4 0-7M24 12c-2-3 2-4 0-7M32 12c-2-3 2-4 0-7"/></svg>;
  if (icon === "dining") return <svg {...common}><path d="M13 7v15M8 7v8a5 5 0 0 0 10 0V7M13 22v19M31 7v34M31 7c7 5 8 15 0 20"/></svg>;
  if (icon === "entertainment") return <svg {...common}><path d="M9 13h30v22H9z"/><path d="M15 8l6 5 8-6 6 6M17 24h14M24 18v12"/></svg>;
  if (icon === "shopping") return <svg {...common}><path d="M10 17h28l-3 24H13z"/><path d="M17 19v-5a7 7 0 0 1 14 0v5"/></svg>;
  if (icon === "convenience") return <svg {...common}><path d="M8 18h32v23H8zM6 18l4-11h28l4 11"/><path d="M14 25h8v16M28 26h7"/></svg>;
  if (icon === "alcohol") return <svg {...common}><path d="M13 7h22l-3 12a9 9 0 0 1-16 0Z"/><path d="M24 27v13M17 40h14M16 16h16"/></svg>;
  if (icon === "cannabis") return <svg {...common}><path d="M24 40V20M24 27c-8 1-13-4-14-11 8-1 13 4 14 11ZM24 22c7 0 12-5 13-12-7 0-12 5-13 12ZM24 32c5 1 9-2 11-7-5-1-9 2-11 7Z"/></svg>;
  if (icon === "telecom") return <svg {...common}><rect x="14" y="5" width="20" height="38" rx="4"/><path d="M19 11h10M21 36h6"/><circle cx="24" cy="29" r="1"/></svg>;
  if (icon === "subscriptions") return <svg {...common}><path d="M37 19a14 14 0 1 0 1 12"/><path d="m34 10 3 9-9-2M11 29l-1 9 9-3"/></svg>;
  if (icon === "utilities") return <svg {...common}><path d="M27 5 13 27h11l-3 16 14-24H24z"/></svg>;
  if (icon === "review") return <svg {...common}><circle cx="24" cy="24" r="18"/><path d="M24 14v12M24 34h.01"/></svg>;
  if (icon === "income") return <svg {...common}><path d="M24 7v30M13 18l11-11 11 11M9 41h30"/></svg>;
  if (icon === "outflow") return <svg {...common}><path d="M24 41V11M13 30l11 11 11-11M9 7h30"/></svg>;
  if (icon === "recent") return <svg {...common}><circle cx="24" cy="24" r="17"/><path d="M24 14v11l8 5M8 11v8h8"/></svg>;
  if (icon === "upcoming") return <svg {...common}><rect x="7" y="10" width="34" height="31" rx="4"/><path d="M15 6v8M33 6v8M7 19h34M16 27h7M27 27h6M16 34h7"/></svg>;
  return <svg {...common}><path d="M24 41V11M14 21l10-10 10 10"/><path d="M9 41h30"/></svg>;
}

export function categoryIcon(label: string): ReactNode {
  const value = label.toLowerCase();
  if (value.includes("review") || value.includes("unknown") || value.includes("unclassified")) return <VorvexIcon icon="review" />;
  if (value.includes("dining") || value.includes("restaurant") || value.includes("food")) return <VorvexIcon icon="dining" />;
  if (value.includes("entertain") || value.includes("outing")) return <VorvexIcon icon="entertainment" />;
  if (value.includes("shop") || value.includes("retail")) return <VorvexIcon icon="shopping" />;
  if (value.includes("convenience") || value.includes("grocery")) return <VorvexIcon icon="convenience" />;
  if (value.includes("alcohol") || value.includes("liquor")) return <VorvexIcon icon="alcohol" />;
  if (value.includes("cannabis")) return <VorvexIcon icon="cannabis" />;
  if (value.includes("telecom") || value.includes("phone") || value.includes("internet")) return <VorvexIcon icon="telecom" />;
  if (value.includes("subscription") || value.includes("service")) return <VorvexIcon icon="subscriptions" />;
  if (value.includes("utilit") || value.includes("hydro")) return <VorvexIcon icon="utilities" />;
  return <VorvexIcon icon="shopping" />;
}
