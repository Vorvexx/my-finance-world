"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FINANCIAL_PERIODS } from "@/lib/homepage/financial-period";
import type { HomepageViewModel } from "@/types/homepage";

const href = (period: string, anchor?: string, start?: string, end?: string) => {
  const query = new URLSearchParams({ period });
  if (anchor) query.set("anchor", anchor);
  if (start) query.set("start", start);
  if (end) query.set("end", end);
  return `/?${query}`;
};

export function TimeNavigator({ period }: { period: HomepageViewModel["period"] }) {
  const router = useRouter();
  const [customOpen, setCustomOpen] = useState(period.key === "custom");
  const [start, setStart] = useState(period.startDate);
  const [end, setEnd] = useState(period.endDate);
  const select = (key: string) => {
    if (key === "custom") { setCustomOpen(true); return; }
    setCustomOpen(false); router.replace(href(key, period.anchorDate));
  };
  return <aside className="time-navigator" aria-label="World time context">
    <button type="button" className="time-navigator__step" aria-label="Previous period" disabled={period.key === "custom"} onClick={() => router.replace(href(period.key, period.previousAnchor))}>‹</button>
    <div className="time-navigator__rail">{FINANCIAL_PERIODS.map((choice) => <button type="button" key={choice.key} aria-pressed={period.key === choice.key} onClick={() => select(choice.key)}>{choice.label}</button>)}</div>
    <button type="button" className="time-navigator__step" aria-label="Next period" disabled={period.key === "custom"} onClick={() => router.replace(href(period.key, period.nextAnchor))}>›</button>
    <span className="time-navigator__range"><b>{period.label}</b>{period.displayLabel}</span>
    {customOpen && <form className="time-navigator__custom" onSubmit={(event) => { event.preventDefault(); if (start && end && end >= start) router.replace(href("custom", undefined, start, end)); }}>
      <label>From<input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label>
      <label>To<input type="date" value={end} min={start} onChange={(event) => setEnd(event.target.value)} /></label>
      <button type="submit">Apply</button>
      <button type="button" onClick={() => setCustomOpen(false)}>Cancel</button>
    </form>}
  </aside>;
}
