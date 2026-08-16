import type { ButtonHTMLAttributes, ReactNode } from "react";
import { VorvexIcon, type VorvexIconKey } from "@/components/vorvex-icon-system";

export type FinancialOrbSize = "compact" | "secondary" | "primary" | "hero";
export type FinancialOrbState = "idle" | "selected" | "parent" | "receded";
export type FinancialOrbAccent = "net-worth" | "cash" | "investments" | "liabilities" | "home" | "vehicle" | "lifestyle" | "cashflow" | "review" | "mint" | "violet" | "rose" | "amber" | "cyan" | "coral" | "blue";

export type FinancialOrbProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  name: string;
  icon: ReactNode;
  value: string;
  accent: FinancialOrbAccent;
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
  return <VorvexIcon icon={world as VorvexIconKey} />;
}
