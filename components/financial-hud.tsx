import type { ReactNode } from "react";

export function FinancialHud({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return <aside className="world-dock financial-hud" aria-live="polite">
    <button className="close-surface financial-hud__close" type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }} aria-label="Close information surface">×</button>
    <div className="dock-glow financial-hud__glow" aria-hidden="true" />
    <div className="financial-hud__content">{children}</div>
  </aside>;
}
