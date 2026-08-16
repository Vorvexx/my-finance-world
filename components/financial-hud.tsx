import type { ReactNode } from "react";

export function FinancialHud({ children, onClose, open = true, onOpen }: { children: ReactNode; onClose: () => void; open?: boolean; onOpen?: () => void }) {
  return <aside className="world-dock financial-hud" data-open={open || undefined} aria-live="polite">
    {!open && <button type="button" className="financial-hud__open" onClick={onOpen}>Open details</button>}
    {open && <>
    <button className="close-surface financial-hud__close" type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }} aria-label="Close information surface">×</button>
    <div className="dock-glow financial-hud__glow" aria-hidden="true" />
    <div className="financial-hud__content">{children}</div>
    </>}
  </aside>;
}
