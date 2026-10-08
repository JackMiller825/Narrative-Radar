import { contentHash, excerpt, mentionedPeople, resolveWatchedPeople, stripTags, type MarketPerson, type NormalizedItem } from "@radar/core/browser";

const LOOKBACK_MS = 12 * 60 * 60 * 1000;
export const NOTIFY_WINDOW_MS = 3 * 60 * 60 * 1000;

type AlgoliaHit = {
  objectID?: string;
  title?: string | null;
  url?: string | null;
  created_at?: string;
  story_text?: string | null;
};

type RssItem = { title?: string; link?: string; pubDate?: string; description?: string };

export async function fetchPersonStories(watched: string[], now: string): Promise<{ items: NormalizedItem[]; failed: number; attempted: number; google: number }> {
  const people = resolveWatchedPeople(watched);
  const cutoff = new Date(now).getTime() - LOOKBACK_MS;
  const queries = newsQueries(people);
  const batches = await Promise.all([
    ...queries.map((query) => googleFeed(query, people, now, cutoff)),
    hackerNews(people, now, cutoff),
  ]);
  const seen = new Set<string>();
  const items: NormalizedItem[] = [];
  for (const item of batches.flatMap((batch) => batch.items).sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))) {
    const key = item.canonicalUrl || item.providerItemId;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return {
    items: items.slice(0, 60),
    failed: batches.filter((batch) => batch.failed).length,
    attempted: batches.length,
    google: batches.filter((batch) => batch.source === "google" && !batch.failed).reduce((sum, batch) => sum + batch.items.length, 0),
  };
}

function newsQueries(people: MarketPerson[]): string[] {
  const names = people.map((person) => person.name.replaceAll(" ", "+"));
  const queries: string[] = [];
  for (let index = 0; index < names.length; index += 3) {
    queries.push(`${names.slice(index, index + 3).join("+OR+")}+when:1d`);
  }
  queries.push("ethereum+when:12h");
  return queries;
}

async function googleFeed(query: string, people: MarketPerson[], now: string, cutoff: number): Promise<{ items: NormalizedItem[]; failed: boolean; source: string }> {
  try {
    const rss = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
    const url = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rss)}`;
    const response = await fetch(url);
    if (!response.ok) return { items: [], failed: true, source: "google" };
    const body = (await response.json()) as { status?: string; items?: RssItem[] };
    if (body.status !== "ok") return { items: [], failed: true, source: "google" };
    return { items: (body.items ?? []).flatMap((item) => fromRss(item, people, now, cutoff)), failed: false, source: "google" };
  } catch {
    return { items: [], failed: true, source: "google" };
  }
}

async function hackerNews(people: MarketPerson[], now: string, cutoff: number): Promise<{ items: NormalizedItem[]; failed: boolean; source: string }> {
  try {
    const url = new URL("https://hn.algolia.com/api/v1/search_by_date");
    url.searchParams.set("tags", "story");
    url.searchParams.set("hitsPerPage", "40");
    url.searchParams.set("numericFilters", `created_at_i>${Math.floor(cutoff / 1000)}`);
    const response = await fetch(url);
    if (!response.ok) return { items: [], failed: true, source: "hn" };
    const body = (await response.json()) as { hits?: AlgoliaHit[] };
    return { items: (body.hits ?? []).flatMap((hit) => fromHn(hit, people, now, cutoff)), failed: false, source: "hn" };
  } catch {
    return { items: [], failed: true, source: "hn" };
  }
}

export function isRecentEnoughToNotify(item: NormalizedItem, now: string): boolean {
  const published = item.publishedAt ?? item.discoveredAt;
  const age = new Date(now).getTime() - new Date(published).getTime();
  return age >= 0 && age <= NOTIFY_WINDOW_MS;
}

export async function enableDesktopAlerts(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const permission = await Notification.requestPermission();
  return permission === "granted";
}

export function notifyHeadlines(items: NormalizedItem[]) {
  if (typeof window === "undefined" || items.length === 0) return;
  const shown = items.slice(0, 3);
  document.title = `(${items.length}) Narrative Radar`;
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    for (const item of shown) {
      const person = item.entities[0] ?? "Market mover";
      const notice = new Notification(`${person} is in the news`, {
        body: item.title,
        tag: item.providerItemId,
        icon: "/icon.svg",
      });
      notice.onclick = () => {
        window.focus();
        window.open(item.canonicalUrl, "_blank", "noopener");
        notice.close();
      };
    }
    if (items.length > shown.length) {
      new Notification("Narrative Radar", {
        body: `${items.length} new headlines about watched people.`,
        tag: "radar-batch",
        icon: "/icon.svg",
      });
    }
  }
  beep();
}

export function notifyEnabled() {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  new Notification("Narrative Radar alerts are on", {
    body: "New headlines about Vitalik, Elon, and the other watched people will ping you while this tab stays open, even if you are in another app.",
    tag: "radar-enabled",
    icon: "/icon.svg",
  });
}

function fromRss(item: RssItem, people: MarketPerson[], now: string, cutoff: number): NormalizedItem[] {
  if (!item.title || !item.link) return [];
  const publishedAt = parsePub(item.pubDate);
  if (!publishedAt || new Date(publishedAt).getTime() < cutoff) return [];
  const { headline, publisher } = splitTitle(item.title);
  const body = stripTags(item.description ?? "");
  const entities = entitiesFor(`${headline} ${body}`, people);
  if (entities.length === 0 && !/ethereum|bitcoin|crypto/i.test(`${headline} ${body}`)) return [];
  return [{
    provider: "rss",
    providerItemId: `gn-${contentHash(item.link, headline)}`,
    canonicalUrl: item.link,
    title: headline,
    excerpt: excerpt(body || headline),
    publisher,
    language: "en",
    publishedAt,
    discoveredAt: now,
    fetchedAt: now,
    contentHash: contentHash(headline, body || headline),
    entities: entities.length > 0 ? entities : ["Ethereum"],
    provenance: { live: true, wire: "google-news" },
  }];
}

function fromHn(hit: AlgoliaHit, people: MarketPerson[], now: string, cutoff: number): NormalizedItem[] {
  if (!hit.objectID || !hit.title) return [];
  const publishedAt = hit.created_at && !Number.isNaN(Date.parse(hit.created_at)) ? new Date(hit.created_at).toISOString() : null;
  if (!publishedAt || new Date(publishedAt).getTime() < cutoff) return [];
  const body = stripTags(hit.story_text ?? "");
  const entities = entitiesFor(`${hit.title} ${body}`, people);
  if (entities.length === 0 && !/ethereum|bitcoin|crypto|vitalik|musk/i.test(`${hit.title} ${body}`)) return [];
  return [{
    provider: "hackernews",
    providerItemId: `hn-${hit.objectID}`,
    canonicalUrl: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
    title: hit.title,
    excerpt: excerpt(body || hit.title),
    publisher: "Hacker News",
    language: "en",
    publishedAt,
    discoveredAt: now,
    fetchedAt: now,
    contentHash: contentHash(hit.title, body || hit.title),
    entities: entities.length > 0 ? entities : ["Ethereum"],
    provenance: { live: true },
    discussionUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
  }];
}

function entitiesFor(text: string, people: MarketPerson[]): string[] {
  return mentionedPeople(text, people);
}

function splitTitle(title: string): { headline: string; publisher: string } {
  const index = title.lastIndexOf(" - ");
  if (index < 8) return { headline: title, publisher: "Google News" };
  return { headline: title.slice(0, index), publisher: title.slice(index + 3) };
}

function parsePub(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const time = Date.parse(normalized);
  if (Number.isNaN(time)) return null;
  return new Date(time).toISOString();
}

function beep() {
  try {
    const context = new AudioContext();
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + 0.12);
    osc.onended = () => void context.close();
  } catch {
    // Autoplay rules can block sound until the tab has been clicked. The desktop notification still shows.
  }
}
