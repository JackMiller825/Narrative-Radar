"use client";

import { useLiveNarratives } from "@/lib/use-live-desk";
import type { NarrativeView } from "@radar/core";

export function SaturationDesk({ narratives }: { narratives: NarrativeView[] }) {
  const rows = useLiveNarratives(narratives);
  const groups = new Map<string, NarrativeView[]>();
  for (const narrative of rows) {
    const list = groups.get(narrative.category) ?? [];
    list.push(narrative);
    groups.set(narrative.category, list);
  }
  return (
    <div className="space-y-4">
      <h1 className="display text-4xl">Observed saturation</h1>
      <p className="max-w-2xl text-sm text-muted">Grouped by the category this desk assigned. Token overlap is only what DEX Screener returned when a check was run. This is not a map of every existing token.</p>
      {[...groups.entries()].map(([category, items]) => (
        <section key={category} className="rounded-3xl border border-line bg-card p-4">
          <h2 className="font-medium">{category}</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {items.map((narrative) => (
              <li key={narrative.id} className="flex flex-wrap justify-between gap-2">
                <span>{narrative.title} · {narrative.topTicker}</span>
                <span className="text-muted">{narrative.crowding}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
