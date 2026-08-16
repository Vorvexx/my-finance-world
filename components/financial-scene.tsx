"use client";

import { Children, type CSSProperties, type ReactNode } from "react";

export type FinancialSceneDepth = "person" | "world" | "object";

type ConstellationStyle = CSSProperties & {
  "--constellation-x": string;
  "--constellation-y": string;
  "--constellation-delay": string;
};

const RINGS: Readonly<Record<number, readonly [number, number][]>> = {
  1: [[29, 13]],
  2: [[-29, 6], [29, 6]],
  3: [[-30, 9], [0, 43], [30, 9]],
  4: [[-31, -20], [31, -20], [-27, 27], [27, 27]],
  5: [[-33, -8], [33, -8], [-30, 25], [0, 43], [30, 25]],
  6: [[-35, -7], [35, -7], [-32, 25], [0, 43], [32, 25], [0, -31]],
  7: [[-35, -4], [35, -4], [-31, 28], [0, 43], [31, 28], [-20, -30], [20, -30]],
  8: [[-18, -31], [18, -31], [36, -8], [34, 25], [17, 43], [-17, 43], [-34, 25], [-36, -8]],
};

const coordinatesFor = (count: number) => {
  if (RINGS[count]) return RINGS[count];
  return Array.from({ length: count }, (_, index) => {
    const turn = index * 2.399963;
    const radius = Math.min(36, 11 + Math.sqrt(index + 1) * 8);
    return [Math.cos(turn) * radius, Math.sin(turn) * radius] as [number, number];
  });
};

export function FinancialScene({ depth, tone, travelling, children }: { depth: FinancialSceneDepth; tone: string; travelling: boolean; children: ReactNode }) {
  return <section className="financial-scene" data-depth={depth} data-scene-tone={tone} data-travelling={travelling || undefined} aria-label="Your financial Worlds">
    <div className="financial-scene__environment" aria-hidden="true" />
    {children}
  </section>;
}

export function FinancialConstellation({ children, label, role = "orbit" }: { children: ReactNode; label: string; role?: "orbit" | "children" }) {
  const items = Children.toArray(children);
  const coordinates = coordinatesFor(items.length);
  return <div className="financial-constellation" data-constellation-role={role} data-constellation-count={items.length} role="group" aria-label={label}>
    {items.map((item, index) => {
      const [x, y] = coordinates[index];
      const style: ConstellationStyle = {
        "--constellation-x": `${x}%`,
        "--constellation-y": `${y}%`,
        "--constellation-delay": `${80 + index * 42}ms`,
      };
      return <div className="financial-constellation__slot" style={style} key={index}>{item}</div>;
    })}
  </div>;
}

export function FinancialIntelligence({ children }: { children: ReactNode }) {
  return <aside className="financial-intelligence" aria-label="Contextual intelligence">{children}</aside>;
}

export function SpatialTransition({ active }: { active: boolean }) {
  return <div className="spatial-transition" data-active={active || undefined} aria-hidden="true"><span /><span /><span /></div>;
}
