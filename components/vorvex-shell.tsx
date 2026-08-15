import Link from "next/link";
import type { ReactNode } from "react";

export default function VorvexShell({ eyebrow, title, description, children, width = "max-w-5xl" }: { eyebrow: string; title: string; description: string; children: ReactNode; width?: string }) {
  return <main className="vorvex-app-shell min-h-screen text-[#f4f7f5]">
    <header className="vorvex-app-header"><div><Link href="/" className="vorvex-shell-brand" aria-label="Return to your Universe">Vorvex</Link><span>Your financial universe</span></div><nav aria-label="Vorvex"><Link href="/">Universe</Link><Link href="/facts">My data</Link><Link href="/statements">Statements</Link><Link href="/review">Needs attention</Link></nav></header>
    <div className={`relative z-10 mx-auto ${width} px-5 pb-14 pt-8 md:px-9`}>
      <header className="border-b border-white/10 pb-8"><p className="text-xs font-bold uppercase tracking-[0.26em] text-emerald-300">{eyebrow}</p><h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1><p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">{description}</p></header>
      {children}
    </div>
  </main>;
}
