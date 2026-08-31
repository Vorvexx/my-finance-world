"use client";

import { useState, type ReactNode } from "react";

export function FinancialHud({ children, onClose, open = true, onOpen, defaultExpanded = false }: { children: ReactNode; onClose: () => void; open?: boolean; onOpen?: () => void; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return <aside className="world-dock financial-hud" data-open={open || undefined} data-expanded={open && expanded || undefined} aria-live="polite">
    {!open && <button type="button" className="financial-hud__open" onClick={onOpen}>Open details</button>}
    {open && <>
    <button className="close-surface financial-hud__close" type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }} aria-label="Close information surface">×</button>
    <button className="financial-hud__expand" type="button" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>{expanded ? "Collapse" : "Expand details"}</button>
    <div className="dock-glow financial-hud__glow" aria-hidden="true" />
    <div className="financial-hud__content">{children}</div>
    </>}
  </aside>;
}
