import { requireDesk } from "@/lib/guard";
import type { DeskData } from "@/lib/types";
import { redirect } from "next/navigation";

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const desk = await requireDesk();
  if (!desk) redirect("/login");
  const params = await searchParams;
  const ids = (params.ids ?? "").split(",").filter(Boolean).slice(0, 4);
  const narratives = (desk as unknown as DeskData).narratives.filter((narrative) => ids.includes(narrative.id));
  return (
    <div>
      <h1 className="display text-4xl">Compare</h1>
      <p className="mb-4 text-sm text-muted">Up to four candidates. Missing numbers stay blank.</p>
      {narratives.length === 0 ? <p className="text-sm text-muted">Choose Compare on the radar to add candidates.</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {narratives.map((narrative) => (
          <article key={narrative.id} className="rounded-3xl border border-line bg-card p-4 text-sm">
            <h2 className="display text-2xl">{narrative.title}</h2>
            <p>{narrative.topName} · {narrative.topTicker}</p>
            <p className="mt-2">{narrative.factualSummary}</p>
            <p className="mt-2 text-muted">Score {narrative.score.narrativeScore ?? "incomplete"} · confidence {narrative.score.evidenceConfidence ?? "unknown"} · coverage {Math.round(narrative.score.dataCoverage * 100)}%</p>
            <p className="text-muted">{narrative.independentSources} independent sources · {narrative.collisionStatus.replaceAll("_", " ")}</p>
            <ul className="mt-2 space-y-1 text-muted">
              {narrative.score.components.map((component) => <li key={component.key}>{component.label}: {component.value ?? "missing"}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
