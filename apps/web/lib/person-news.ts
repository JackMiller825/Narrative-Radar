import { contentHash, excerpt, resolveWatchedPeople, storyMentionsPerson, stripTags, type NormalizedItem } from "@radar/core/browser";

const LOOKBACK_MS = 72 * 60 * 60 * 1000;
export const NOTIFY_WINDOW_MS = 45 * 60 * 1000;

type AlgoliaHit = {
  objectID?: string;
  title?: string | null;
  url?: string | null;
  created_at?: string;
  story_text?: string | null;
};

export async function fetchPersonStories(watched: string[], now: string): Promise<{ items: NormalizedItem[]; failed: number; attempted: number }> {
  const people = resolveWatchedPeople(watched);
  const cutoff = new Date(now).getTime() - LOOKBACK_MS;
  const batches = await Promise.all(people.map(async (person) => {
    try {
      const url = new URL("https://hn.algolia.com/api/v1/search_by_date");
      url.searchParams.set("query", `"${person.name}"`);
      url.searchParams.set("tags", "story");
      url.searchParams.set("hitsPerPage", "8");
      const response = await fetch(url);
      if (!response.ok) return { items: [] as NormalizedItem[], failed: true };
      const body = (await response.json()) as { hits?: AlgoliaHit[] };
      return { items: (body.hits ?? []).flatMap((hit) => toItem(hit, person, now, cutoff)), failed: false };
    } catch {
      return { items: [] as NormalizedItem[], failed: true };
    }
  }));
  const seen = new Set<string>();
  const items: NormalizedItem[] = [];
  for (const item of batches.flatMap((batch) => batch.items)) {
    if (seen.has(item.providerItemId)) continue;
    seen.add(item.providerItemId);
    items.push(item);
  }
  return { items, failed: batches.filter((batch) => batch.failed).length, attempted: people.length };
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

function toItem(hit: AlgoliaHit, person: { name: string; aliases: string[] }, now: string, cutoff: number): NormalizedItem[] {
  if (!hit.objectID || !hit.title) return [];
  const publishedAt = hit.created_at && !Number.isNaN(Date.parse(hit.created_at)) ? new Date(hit.created_at).toISOString() : null;
  if (!publishedAt || new Date(publishedAt).getTime() < cutoff) return [];
  const body = stripTags(hit.story_text ?? "");
  const text = `${hit.title} ${body}`;
  if (storyMentionsPerson(text, person) === false) return [];
  const canonicalUrl = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
  return [{
    provider: "hackernews",
    providerItemId: `hn-${hit.objectID}`,
    canonicalUrl,
    title: hit.title,
    excerpt: excerpt(body || hit.title),
    publisher: "Hacker News",
    language: "en",
    publishedAt,
    discoveredAt: now,
    fetchedAt: now,
    contentHash: contentHash(hit.title, body || hit.title),
    entities: [person.name],
    provenance: { live: true, person: person.name },
    discussionUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
  }];
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
