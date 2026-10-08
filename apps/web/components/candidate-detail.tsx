"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { downloadNarrativePack } from "@/lib/published-desk";
import { useLiveNarratives } from "@/lib/use-live-desk";
import { deskAction, isPublishedSnapshot } from "@/lib/utils";
import type { NarrativeView } from "@radar/core";
import { useRouter } from "next/navigation";
import { useState } from "react";

const TABS = ["Overview", "Evidence", "Names", "Visuals", "Timeline"] as const;

export function CandidateDetail({ narrative: initial }: { narrative: NarrativeView }) {
  const router = useRouter();
  const rows = useLiveNarratives([initial]);
  const narrative = rows.find((item) => item.id === initial.id) ?? initial;
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const logo = narrative.assets.find((asset) => asset.kind === "logo" && asset.mode === "template" && asset.svg);
  const banner = narrative.assets.find((asset) => asset.kind === "banner" && asset.mode === "template" && asset.svg);

  async function run(body: Record<string, unknown>) {
    setMessage(null);
    try {
      const result = await deskAction(body);
      if (typeof result.detail === "string") setMessage(result.detail);
      else if (typeof result.reason === "string") setMessage(result.reason);
      if (!isPublishedSnapshot()) router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    }
  }

  return (
    <article className="space-y-4">
      <div className="flex flex-wrap items-start gap-4">
        {logo?.svg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" src={`data:image/svg+xml,${encodeURIComponent(logo.svg)}`} className="h-16 w-16 rounded-full border border-line" />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.16em] text-mint">{narrative.category} · {narrative.lifecycle.replaceAll("_", " ")}</p>
          <h2 className="display text-3xl leading-tight">{narrative.title}</h2>
          <p className="mt-1 text-sm text-muted">{narrative.topName} · {narrative.topTicker}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map((item) => (
          <button key={item} type="button" role="tab" aria-selected={tab === item} className={`rounded-full px-3 py-1 text-sm ${tab === item ? "bg-card text-foreground" : "text-muted"}`} onClick={() => setTab(item)}>{item}</button>
        ))}
      </div>
      {tab === "Overview" ? (
        <div className="space-y-3 text-sm leading-6">
          <p>{narrative.factualSummary}</p>
          <p><span className="font-medium">Why now. </span>{narrative.whyNow}</p>
          <p className="rounded-2xl bg-background p-3">{narrative.creativeIdea}</p>
          <ScoreList narrative={narrative} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => run({ action: "board", narrativeId: narrative.id, board: "shortlisted" })}>Shortlist</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => run({ action: "board", narrativeId: narrative.id, board: "dismissed" })}>Dismiss</Button>
            <a
              className="inline-flex h-8 items-center rounded-full border border-line px-3 text-xs"
              href={`/api/export/${narrative.id}`}
              onClick={(event) => {
                if (!isPublishedSnapshot()) return;
                event.preventDefault();
                downloadNarrativePack(narrative);
              }}
            >
              Download pack
            </a>
          </div>
          {(["useful", "too_generic", "already_crowded", "too_old", "irrelevant"] as const).map((kind) => (
            <Button key={kind} type="button" variant="ghost" size="sm" onClick={() => run({ action: "feedback", narrativeId: narrative.id, kind })}>{kind.replaceAll("_", " ")}</Button>
          ))}
        </div>
      ) : null}
      {tab === "Evidence" ? (
        <ul className="space-y-3">
          {narrative.sources.map((source) => (
            <li key={source.sourceId} className="rounded-2xl border border-line p-3 text-sm">
              <div className="mb-1 flex flex-wrap gap-2">
                <Badge>{source.provider}</Badge>
                <Badge>{source.independent ? "independent" : source.role}</Badge>
                <Badge>{source.publishedAt ? "dated" : "time unknown"}</Badge>
              </div>
              <a className="font-medium underline decoration-mint/50 underline-offset-4" href={source.canonicalUrl} target="_blank" rel="noreferrer">{source.title}</a>
              <p className="mt-1 text-muted">{source.publisher}</p>
              <p className="mt-2">{source.excerpt}</p>
              {source.discussionUrl ? <a className="mt-2 inline-block text-mint" href={source.discussionUrl} target="_blank" rel="noreferrer">Discussion</a> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {tab === "Names" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">{narrative.crowding}. Checked-token results are not a uniqueness, availability, or trademark claim.</p>
          {narrative.names.map((option) => (
            <form key={option.id} className="rounded-2xl border border-line p-3 text-sm" onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void run({ action: "branding", narrativeId: narrative.id, nameId: option.id, name: String(data.get("name")), ticker: String(data.get("ticker")), pinned: data.get("pinned") === "on" });
            }}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <strong>{option.isTop ? "Top creative suggestion" : `Option ${option.rank}`}</strong>
                <Badge>{option.collisionStatus.replaceAll("_", " ")}</Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input name="name" defaultValue={option.name} aria-label="Name" className="h-10 rounded-xl border border-line bg-background px-3" />
                <input name="ticker" defaultValue={option.ticker} aria-label="Ticker" className="h-10 rounded-xl border border-line bg-background px-3" />
              </div>
              <p className="mt-2">{option.story}</p>
              <p className="text-muted">{option.wordplay}</p>
              <p className="text-muted">Memorability {option.memorability} · narrative fit {option.narrativeFit}</p>
              <label className="mt-2 flex items-center gap-2"><input type="checkbox" name="pinned" defaultChecked={option.pinned} /> Pin this option</label>
              <Button type="submit" size="sm" variant="outline" className="mt-2">Save name</Button>
            </form>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => run({ action: "branding", narrativeId: narrative.id, regenerate: true })}>Regenerate unpinned names</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => run({ action: "check-names", narrativeId: narrative.id })}>Check names</Button>
          </div>
        </div>
      ) : null}
      {tab === "Visuals" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">Template concept. These are original vector sketches, not AI rasters and not existing token logos.</p>
          {banner?.svg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={`${narrative.topName ?? narrative.title} banner`} src={`data:image/svg+xml,${encodeURIComponent(banner.svg)}`} className="w-full rounded-2xl border border-line" />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => run({ action: "palette", narrativeId: narrative.id })}>Another template palette</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => run({ action: "image", narrativeId: narrative.id, kind: "logo" })}>Request AI logo</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => run({ action: "image", narrativeId: narrative.id, kind: "banner" })}>Request AI banner</Button>
          </div>
          <ul className="space-y-2 text-sm">
            {narrative.assets.map((asset) => (
              <li key={asset.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-line px-3 py-2">
                <span>{asset.mode} {asset.kind}</span>
                <span className="text-muted">{asset.status}{asset.error ? ` · ${asset.error}` : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {tab === "Timeline" ? (
        <ol className="space-y-2 text-sm">
          {narrative.timeline.map((event, index) => (
            <li key={`${event.at}-${index}`} className="rounded-xl border border-line px-3 py-2">
              <span className="text-muted">{event.at}</span> · {event.text}
            </li>
          ))}
          {narrative.changeSummary.map((line) => <li key={line} className="text-muted">{line}</li>)}
        </ol>
      ) : null}
      <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); void run({ action: "note", narrativeId: narrative.id, body: note }); setNote(""); }}>
        <label className="text-sm font-medium" htmlFor={`note-${narrative.id}`}>Private note</label>
        <Textarea id={`note-${narrative.id}`} value={note} onChange={(event) => setNote(event.target.value)} />
        <Button type="submit" size="sm" variant="outline">Save note</Button>
      </form>
      {narrative.notes.map((item) => <p key={item.id} className="text-sm text-muted">{item.body}</p>)}
      {message ? <p className="text-sm text-mint" role="status">{message}</p> : null}
    </article>
  );
}

function ScoreList({ narrative }: { narrative: NarrativeView }) {
  return (
    <div>
      <p className="font-medium" title="Narrative score is a weighted reading of signals and creative fit. It is not a forecast.">
        Narrative score {narrative.score.narrativeScore ?? "incomplete"} · confidence {narrative.score.evidenceConfidence ?? "unknown"} · coverage {Math.round(narrative.score.dataCoverage * 100)}%
      </p>
      <ul className="mt-2 space-y-1">
        {narrative.score.components.map((component) => (
          <li key={component.key} className="text-muted" title={component.reason}>
            {component.label}: {component.value === null ? "missing" : component.value} <span className="text-xs">({component.subjective ? "subjective" : "observed"}, weight {component.weight})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
