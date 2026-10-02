import { contentHash, excerpt, stripTags, type NormalizedItem } from "@radar/core";
import { ProviderError } from "./errors";

const BASE = "https://hacker-news.firebaseio.com/v0";

interface HnItem {
  id?: number;
  deleted?: boolean;
  dead?: boolean;
  type?: string;
  by?: string;
  time?: number;
  text?: string;
  url?: string;
  score?: number;
  title?: string;
  descendants?: number;
}

export async function fetchHackerNews(opts: { cursor?: number; limit?: number; now?: string; fetchImpl?: typeof fetch }): Promise<{
  items: NormalizedItem[];
  cursor: number;
  requests: number;
}> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? new Date().toISOString();
  const limit = Math.min(opts.limit ?? 15, 30);
  let requests = 0;
  const listResponse = await fetchImpl(`${BASE}/newstories.json`);
  requests += 1;
  if (!listResponse.ok) throw new ProviderError(`Hacker News list returned ${listResponse.status}.`, listResponse.status >= 500 ? "outage" : "http", listResponse.status >= 500, null, listResponse.status);
  const ids = (await listResponse.json()) as unknown;
  if (!Array.isArray(ids)) throw new ProviderError("Hacker News list was not an array.", "malformed", false);
  const cursor = opts.cursor ?? 0;
  const selected = ids.filter((id): id is number => typeof id === "number" && id > cursor).slice(0, limit);
  const items: NormalizedItem[] = [];
  for (const id of selected) {
    const response = await fetchImpl(`${BASE}/item/${id}.json`);
    requests += 1;
    if (!response.ok) continue;
    const raw = (await response.json()) as HnItem | null;
    const mapped = raw ? mapHnItem(raw, now) : null;
    if (mapped) items.push(mapped);
  }
  const nextCursor = selected.length > 0 ? Math.max(...selected) : cursor;
  return { items, cursor: nextCursor, requests };
}

export function mapHnItem(item: HnItem, now: string): NormalizedItem | null {
  if (!item.id || item.deleted || item.dead || !item.title) return null;
  if (item.type && item.type !== "story" && item.type !== "job") return null;
  const discussionUrl = `https://news.ycombinator.com/item?id=${item.id}`;
  const article = item.url && item.url.startsWith("http") ? item.url : discussionUrl;
  const body = excerpt(stripTags(item.text ?? ""), 480);
  const publishedAt = typeof item.time === "number" ? new Date(item.time * 1000).toISOString() : null;
  return {
    provider: "hackernews",
    providerItemId: String(item.id),
    canonicalUrl: article,
    discussionUrl,
    title: excerpt(stripTags(item.title), 180),
    excerpt: body || "Hacker News discussion. The linked article was not copied.",
    publisher: item.by ? `HN · ${item.by}` : "Hacker News",
    language: null,
    publishedAt,
    discoveredAt: now,
    fetchedAt: now,
    contentHash: contentHash(item.title, body),
    entities: [],
    provenance: { discussionUrl, hnType: item.type ?? "story", label: "hackernews" },
    metrics: [
      { metric: "hn_score", value: typeof item.score === "number" ? item.score : null, observedAt: now },
      { metric: "hn_descendants", value: typeof item.descendants === "number" ? item.descendants : null, observedAt: now },
    ],
  };
}
