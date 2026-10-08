"use client";

import { CandidateDetail } from "@/components/candidate-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLiveDesk } from "@/lib/use-live-desk";
import { ageLabel, deskAction, isPublishedSnapshot } from "@/lib/utils";
import type { DeskData } from "@/lib/types";
import type { NarrativeView } from "@radar/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export function RadarApp({ desk, now, initialQuery = "" }: { desk: DeskData; now: string; initialQuery?: string }) {
  const router = useRouter();
  const liveDesk = useLiveDesk(desk);
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState("all");
  const [lifecycle, setLifecycle] = useState("all");
  const [sort, setSort] = useState("recent");
  const [coverage, setCoverage] = useState(0);
  const [selected, setSelected] = useState<string | null>(liveDesk.narratives[0]?.id ?? null);
  const [fresh, setFresh] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [compare, setCompare] = useState<string[]>([]);

  useEffect(() => {
    if (initialQuery) return;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setQuery(q);
  }, [initialQuery]);

  useEffect(() => {
    if (isPublishedSnapshot()) return;
    let cancelled = false;
    let source: EventSource | null = null;
    let poll: number | null = null;
    const bump = () => { if (!cancelled) setFresh((count) => count + 1); };
    try {
      source = new EventSource("/api/events");
      source.addEventListener("scan", bump);
      source.addEventListener("candidate", bump);
      source.addEventListener("snapshot", bump);
      source.onerror = () => {
        source?.close();
        let primed = false;
        let cursor = 0;
        poll = window.setInterval(async () => {
          const response = await fetch(`/api/events?poll=1&after=${cursor}`);
          if (!response.ok) return;
          const body = (await response.json()) as { events?: { seq: number }[] };
          const events = body.events ?? [];
          const newest = events.at(-1)?.seq;
          if (typeof newest === "number") cursor = newest;
          if (!primed) {
            primed = true;
            return;
          }
          if (events.length > 0) bump();
        }, 8000);
      };
    } catch {
      poll = window.setInterval(() => bump(), 8000);
    }
    return () => {
      cancelled = true;
      source?.close();
      if (poll) window.clearInterval(poll);
    };
  }, []);

  const rows = useMemo(() => {
    const filtered = liveDesk.narratives.filter((narrative) => {
      const haystack = `${narrative.title} ${narrative.topName ?? ""} ${narrative.topTicker ?? ""}`.toLowerCase();
      if (query && !haystack.includes(query.toLowerCase())) return false;
      if (category !== "all" && narrative.category !== category) return false;
      if (lifecycle !== "all" && narrative.lifecycle !== lifecycle) return false;
      if (narrative.score.dataCoverage < coverage) return false;
      return true;
    });
    const copy = [...filtered];
    copy.sort((a, b) => {
      if (sort === "score") return (b.score.narrativeScore ?? -1) - (a.score.narrativeScore ?? -1);
      if (sort === "acceleration") return component(b) - component(a);
      if (sort === "crowding") return crowdRank(a.collisionStatus) - crowdRank(b.collisionStatus);
      return b.latestMeaningfulAt.localeCompare(a.latestMeaningfulAt);
    });
    return copy;
  }, [liveDesk.narratives, query, category, lifecycle, sort, coverage]);

  const active = rows.find((row) => row.id === selected) ?? rows[0] ?? null;
  const stale = liveDesk.settings.lastSuccessfulAt
    ? new Date(now).getTime() - new Date(liveDesk.settings.lastSuccessfulAt).getTime() > liveDesk.schedule.seconds * 2 * 1000
    : liveDesk.scans.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-4xl">Live Radar</h1>
          <p className="max-w-2xl text-sm text-muted">Ranked narrative candidates from the sources this desk actually checks. A green worker light means the background process is up, not that every provider is healthy.</p>
        </div>
        {liveDesk.workspace.mode === "demo" ? (
          <Button type="button" variant="outline" onClick={() => deskAction({ action: "replay" }).then((result) => { setMessage(typeof result.reason === "string" ? result.reason : "Fixture added."); if (!isPublishedSnapshot()) router.refresh(); }).catch((error) => setMessage(error.message))}>Introduce lighthouse cat fixture</Button>
        ) : null}
      </div>
      {!liveDesk.worker.online ? <Banner tone="warn">The worker looks offline. Scheduled scans wait until the worker process is running. Scan now still uses this web process.</Banner> : null}
      {liveDesk.workspace.mode === "demo" ? <Banner>Demo mode is on. Cards below come from labeled fixtures. External alerts and paid image calls stay off.</Banner> : null}
      {stale ? <Banner tone="warn">Scan data is stale or this desk has not completed a scan yet. Last success stays put when an attempt fails.</Banner> : null}
      {fresh > 0 ? (
        <button type="button" className="w-full rounded-2xl border border-mint/40 bg-card px-4 py-3 text-left text-sm" onClick={() => { setFresh(0); router.refresh(); }}>
          {fresh} new update{fresh === 1 ? "" : "s"} since this list was drawn. Refresh to fold them in. The order stays put until you do.
        </button>
      ) : null}
      <div className="grid gap-2 md:grid-cols-5">
        <Input aria-label="Search candidates" placeholder="Search title, name, ticker" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select aria-label="Category" className="h-10 w-full min-w-0 rounded-xl border border-line bg-card px-3" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="all">All categories</option>
          {liveDesk.settings.categories.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select aria-label="Lifecycle" className="h-10 w-full min-w-0 rounded-xl border border-line bg-card px-3" value={lifecycle} onChange={(event) => setLifecycle(event.target.value)}>
          <option value="all">All lifecycles</option>
          {["emerging", "accelerating", "established", "fading", "insufficient_history", "archived"].map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
        </select>
        <select aria-label="Sort" className="h-10 w-full min-w-0 rounded-xl border border-line bg-card px-3" value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="recent">Recent</option>
          <option value="score">Strongest narrative score</option>
          <option value="acceleration">Fastest observed acceleration</option>
          <option value="crowding">Least crowded among checked results</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-muted">Coverage
          <input aria-label="Minimum coverage" type="range" min={0} max={1} step={0.05} value={coverage} onChange={(event) => setCoverage(Number(event.target.value))} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">{rows.length} shown</span>
        <Button type="button" variant="ghost" size="sm" onClick={() => { setQuery(""); setCategory("all"); setLifecycle("all"); setCoverage(0); setSort("recent"); }}>Reset filters</Button>
        {compare.length > 0 ? <Link className="underline" href={`/compare?ids=${compare.join(",")}`}>Compare {compare.length}</Link> : null}
      </div>
      {message ? <p className="text-sm text-mint" role="status">{message}</p> : null}
      {rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line p-8">
          <h2 className="display text-2xl">No candidates in this slice</h2>
          <p className="mt-2 max-w-lg text-sm text-muted">Nothing matched these filters. Reset them, run a scan, or in demo mode introduce the lighthouse cat fixture.</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <ul className="space-y-3">
            {rows.map((narrative) => (
              <li key={narrative.id}>
                <CandidateCard
                  narrative={narrative}
                  selected={narrative.id === active?.id}
                  compared={compare.includes(narrative.id)}
                  onOpen={() => setSelected(narrative.id)}
                  onCompare={() => setCompare((current) => current.includes(narrative.id) ? current.filter((id) => id !== narrative.id) : current.length >= 4 ? current : [...current, narrative.id])}
                />
              </li>
            ))}
          </ul>
          <aside className="rounded-3xl border border-line bg-card p-4 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-auto">
            {active ? <CandidateDetail narrative={active} /> : null}
          </aside>
        </div>
      )}
      <p className="text-xs text-muted">{liveDesk.schedule.preview.note}</p>
    </div>
  );
}

function CandidateCard({ narrative, selected, compared, onOpen, onCompare }: { narrative: NarrativeView; selected: boolean; compared: boolean; onOpen: () => void; onCompare: () => void }) {
  const logo = narrative.assets.find((asset) => asset.kind === "logo" && asset.svg);
  return (
    <article className={`rounded-3xl border bg-card p-4 ${selected ? "border-mint" : "border-line"}`}>
      <div className="flex gap-3">
        {logo?.svg ? (
          // Template SVG is generated by this app and is not a remote image.
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" src={`data:image/svg+xml,${encodeURIComponent(logo.svg)}`} className="h-14 w-14 rounded-full" />
        ) : <div className="h-14 w-14 rounded-full bg-background" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="display text-xl leading-tight">{narrative.title}</h2>
            <p className="text-right text-sm" title="Not a price forecast.">
              <span className="text-mint">{narrative.score.narrativeScore ?? "—"}</span>
              <span className="block text-xs text-muted">coverage {Math.round(narrative.score.dataCoverage * 100)}%</span>
            </p>
          </div>
          <p className="text-sm text-muted">{narrative.topName} · {narrative.topTicker}</p>
        </div>
      </div>
      <p className="mt-3 text-sm">{narrative.factualSummary}</p>
      <p className="mt-1 text-sm text-muted">{narrative.whyNow}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge>{narrative.lifecycle.replaceAll("_", " ")}</Badge>
        <Badge>{narrative.independentSources} independent</Badge>
        <Badge>{ageLabel(narrative.latestPublishedAt)}</Badge>
        <Badge>{narrative.collisionStatus.replaceAll("_", " ")}</Badge>
        {narrative.provisional ? <Badge>provisional</Badge> : null}
        {narrative.rumor ? <Badge>rumor</Badge> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onOpen}>Details</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCompare}>{compared ? "Remove compare" : "Compare"}</Button>
        <Link className="inline-flex h-8 items-center rounded-full px-3 text-xs underline" href={`/radar/${narrative.id}`}>Open page</Link>
        <Link className="inline-flex h-8 items-center rounded-full px-3 text-xs text-muted" href={narrative.sources[0]?.canonicalUrl ?? "#"}>Sources</Link>
      </div>
    </article>
  );
}

function Banner({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" }) {
  return <p className={`rounded-2xl border px-4 py-3 text-sm ${tone === "warn" ? "border-amber-400/40 bg-card" : "border-line bg-card"}`}>{children}</p>;
}

function component(narrative: NarrativeView) {
  return narrative.score.components.find((item) => item.key === "acceleration")?.value ?? -1;
}

function crowdRank(status: string) {
  if (status === "none") return 0;
  if (status === "similar") return 1;
  if (status === "exact") return 2;
  return 3;
}
