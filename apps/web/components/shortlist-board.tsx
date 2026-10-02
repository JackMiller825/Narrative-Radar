"use client";

import { Button } from "@/components/ui/button";
import { deskAction } from "@/lib/utils";
import type { NarrativeView } from "@radar/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const COLUMNS = ["new", "reviewing", "shortlisted", "dismissed", "archived"] as const;

export function ShortlistBoard({ narratives }: { narratives: NarrativeView[] }) {
  const router = useRouter();
  const [undo, setUndo] = useState<string | null>(null);
  async function move(narrativeId: string, board: (typeof COLUMNS)[number]) {
    const result = await deskAction({ action: "board", narrativeId, board });
    if (typeof result.auditId === "string") setUndo(result.auditId);
    router.refresh();
  }
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="display text-4xl">Shortlist</h1>
          <p className="text-sm text-muted">Move a candidate by hand. Undo puts the last one back.</p>
        </div>
        {undo ? <Button type="button" size="sm" variant="outline" onClick={() => deskAction({ action: "undo", auditId: undo }).then(() => { setUndo(null); router.refresh(); })}>Undo last move</Button> : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {COLUMNS.map((column) => (
          <section key={column} className="rounded-3xl border border-line bg-card p-3">
            <h2 className="mb-2 text-sm uppercase tracking-wide text-muted">{column}</h2>
            <ul className="space-y-2">
              {narratives.filter((narrative) => narrative.board === column).length === 0 ? <li className="text-sm text-muted">Empty</li> : null}
              {narratives.filter((narrative) => narrative.board === column).map((narrative) => (
                <li key={narrative.id} className="rounded-2xl border border-line p-3 text-sm">
                  <Link href={`/radar/${narrative.id}`} className="font-medium">{narrative.title}</Link>
                  <p className="text-muted">{narrative.topName} · {narrative.topTicker}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {COLUMNS.filter((item) => item !== column).map((item) => (
                      <button key={item} type="button" className="rounded-full px-2 py-1 text-xs text-mint" onClick={() => move(narrative.id, item)}>{item}</button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
