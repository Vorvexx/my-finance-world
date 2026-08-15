import type { ButtonHTMLAttributes, ReactNode } from "react";

export type FinancialOrbSize = "compact" | "secondary" | "primary" | "hero";
export type FinancialOrbState = "idle" | "selected" | "parent" | "receded";

export type FinancialOrbProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  name: string;
  icon: ReactNode;
  value: string;
  accent: string;
  size?: FinancialOrbSize;
  state?: FinancialOrbState;
};

export function FinancialOrb({
  name, icon, value, accent, size = "secondary", state = "idle", className = "", type = "button", ...buttonProps
}: FinancialOrbProps) {
  return <button
    {...buttonProps}
    type={type}
    className={`financial-orb financial-orb--${size} financial-orb--${state} tone-${accent} ${className}`.trim()}
    data-orb-size={size}
    data-orb-state={state}
  >
    <span className="financial-orb__name">{name}</span>
    <span className="financial-orb__ball" aria-hidden="true"><span className="financial-orb__icon">{icon}</span></span>
    <strong className="financial-orb__value">{value}</strong>
  </button>;
}

export type FinancialWorldIconKey = "cash" | "investments" | "liabilities" | "home" | "vehicle" | "lifestyle" | "cashflow";

export function FinancialWorldIcon({ world }: { world: FinancialWorldIconKey }) {
  const common = { viewBox: "0 0 48 48", fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (world === "cash") return <svg {...common}><path d="M10 16h27a4 4 0 0 1 4 4v17H10a4 4 0 0 1-4-4V15a5 5 0 0 1 5-5h23"/><path d="M31 24h10v8H31a4 4 0 0 1 0-8Z"/><circle cx="33" cy="28" r="1"/></svg>;
  if (world === "cashflow") return <svg {...common}><path d="M7 35 17 23l8 7 15-19"/><path d="M32 11h8v8"/><path d="M8 13v22h33"/></svg>;
  if (world === "investments") return <svg {...common}><path d="M8 38h33"/><path d="M12 33V24h6v9M22 33V18h6v15M32 33V11h6v22"/><path d="m10 19 10-7 8 4 12-9"/></svg>;
  if (world === "lifestyle") return <svg {...common}><path d="M10 18h25v9a11 11 0 0 1-11 11h-3a11 11 0 0 1-11-11v-9Z"/><path d="M35 22h3a5 5 0 0 1 0 10h-5M16 12c-2-3 2-4 0-7M24 12c-2-3 2-4 0-7M32 12c-2-3 2-4 0-7"/></svg>;
  if (world === "liabilities") return <svg {...common}><rect x="6" y="11" width="36" height="26" rx="4"/><path d="M6 18h36M12 30h9"/><circle cx="35" cy="29" r="2"/></svg>;
  if (world === "vehicle") return <svg {...common}><path d="m8 29 4-11a5 5 0 0 1 5-3h15a5 5 0 0 1 5 3l4 11v8h-5v-4H12v4H7v-8h34"/><path d="M13 27h22M17 22h14"/><circle cx="14" cy="29" r="2"/><circle cx="34" cy="29" r="2"/></svg>;
  return <svg {...common}><path d="m5 23 19-16 19 16"/><path d="M10 20v21h28V20M20 41V29h8v12"/><path d="M17 20h14"/></svg>;
}
