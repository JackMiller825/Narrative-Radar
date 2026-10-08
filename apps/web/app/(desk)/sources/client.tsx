"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLiveDesk } from "@/lib/use-live-desk";
import { deskAction, formatWhen, isPublishedSnapshot } from "@/lib/utils";
import type { DeskData } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SourcesDesk({ desk }: { desk: DeskData }) {
  const router = useRouter();
  const liveDesk = useLiveDesk(desk);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [article, setArticle] = useState("");
  const [pasted, setPasted] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  async function act(body: Record<string, unknown>) {
    try {
      const result = await deskAction(body);
      setMessage(typeof result.reason === "string" ? result.reason : "Saved.");
      setPasted("");
      if (!isPublishedSnapshot()) router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed.");
    }
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-4xl">Sources</h1>
        <p className="max-w-2xl text-sm text-muted">RSS, Hacker News, and DEX Screener can run without extra keys. X, OpenAI, and Telegram stay unconfigured until server credentials exist. One broken feed does not fail the scan.</p>
      </div>
      <ul className="grid gap-3 md:grid-cols-2">
        {liveDesk.providers.map((provider) => (
          <li key={provider.id} className="rounded-3xl border border-line bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-medium">{provider.provider}</h2>
              <Badge>{provider.status}</Badge>
            </div>
            <p className="mt-2 text-sm text-muted">{provider.detail}</p>
            <p className="mt-2 text-xs text-muted">Last success {formatWhen(provider.lastSuccessAt, liveDesk.settings.timezone)}{provider.lastError ? ` · ${provider.lastError}` : ""}</p>
          </li>
        ))}
      </ul>
      <section className="rounded-3xl border border-line bg-card p-4">
        <h2 className="font-medium">Feeds</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {liveDesk.feeds.map((feed) => (
            <li key={feed.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2">
              <div>
                <p>{feed.title}</p>
                <p className="text-xs text-muted break-all">{feed.url}</p>
                {feed.lastError ? <p className="text-xs text-red-300">{feed.lastError}</p> : null}
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => act({ action: "feed-remove", id: feed.id })}>Remove</Button>
            </li>
          ))}
        </ul>
        <form className="mt-4 grid gap-2 md:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => { event.preventDefault(); void act({ action: "feed-add", url, title }); }}>
          <Input aria-label="Feed URL" placeholder="https://…" value={url} onChange={(event) => setUrl(event.target.value)} required />
          <Input aria-label="Feed title" placeholder="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
          <Button type="submit">Add feed</Button>
        </form>
      </section>
      <section className="rounded-3xl border border-line bg-card p-4">
        <h2 className="font-medium">Analyze a URL</h2>
        <p className="mt-1 text-sm text-muted">If the page cannot be fetched, paste the text you can see. Pasted text is labeled as pasted. Private-network URLs are blocked.</p>
        <form className="mt-3 space-y-2" onSubmit={(event) => { event.preventDefault(); void act({ action: "analyze", url: article, pastedText: pasted || undefined }); }}>
          <Input aria-label="Article URL" value={article} onChange={(event) => setArticle(event.target.value)} placeholder="https://…" required />
          <textarea aria-label="Optional pasted text" className="min-h-24 w-full rounded-xl border border-line bg-background p-3 text-sm" value={pasted} onChange={(event) => setPasted(event.target.value)} placeholder="Paste text only if the fetch fails" />
          <Button type="submit">Analyze</Button>
        </form>
      </section>
      {message ? <p className="text-sm text-mint" role="status">{message}</p> : null}
    </div>
  );
}
