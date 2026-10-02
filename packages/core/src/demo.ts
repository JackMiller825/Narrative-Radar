import type { NormalizedItem } from "./types";
import { contentHash } from "./text";

export const DEMO_NOW = "2026-10-02T13:00:00.000Z";

function item(input: Omit<NormalizedItem, "contentHash" | "language" | "fetchedAt" | "provenance"> & { language?: string | null; fetchedAt?: string; provenance?: Record<string, unknown> }): NormalizedItem {
  return {
    language: input.language ?? "en",
    fetchedAt: input.fetchedAt ?? input.discoveredAt,
    provenance: input.provenance ?? { fixture: true, label: "Demo" },
    contentHash: contentHash(input.title, input.excerpt),
    ...input,
  };
}

export function demoItems(now = DEMO_NOW): NormalizedItem[] {
  const recent = new Date(new Date(now).getTime() - 2 * 3_600_000).toISOString();
  const earlier = new Date(new Date(now).getTime() - 5 * 3_600_000).toISOString();
  const fading = new Date(new Date(now).getTime() - 120 * 3_600_000).toISOString();
  return [
    item({
      provider: "rss",
      providerItemId: "ef-blob-fees",
      canonicalUrl: "https://blog.ethereum.org/en/demo/blob-fees",
      title: "Blob fees fall to fractions of a cent",
      excerpt: "The Ethereum Foundation blog describes blob fees falling to fractions of a cent after a quiet weekend.",
      publisher: "Ethereum Foundation Blog",
      publishedAt: recent,
      discoveredAt: recent,
      entities: ["blob fee", "EIP-4844"],
      metrics: [
        { metric: "mentions", value: 2, observedAt: earlier },
        { metric: "mentions", value: 7, observedAt: recent },
      ],
    }),
    item({
      provider: "rss",
      providerItemId: "coindesk-blob-fees",
      canonicalUrl: "https://www.coindesk.com/demo/blob-fees",
      title: "Blob fees fall to fractions of a cent",
      excerpt: "The Ethereum Foundation blog describes blob fees falling to fractions of a cent after a quiet weekend.",
      publisher: "CoinDesk",
      publishedAt: recent,
      discoveredAt: now,
      entities: ["blob fee", "EIP-4844"],
    }),
    item({
      provider: "rss",
      providerItemId: "museum-vitalik",
      canonicalUrl: "https://www.theverge.com/demo/onchain-museum",
      title: "Vitalik Buterin opens a museum for on-chain art",
      excerpt: "Vitalik Buterin is opening a small museum for on-chain art in a converted reading room.",
      publisher: "The Verge",
      publishedAt: earlier,
      discoveredAt: earlier,
      entities: ["Vitalik Buterin", "on-chain art"],
    }),
    item({
      provider: "hackernews",
      providerItemId: "hn-robot-tax",
      canonicalUrl: "https://example.com/lisbon-robot-tax",
      discussionUrl: "https://news.ycombinator.com/item?id=1",
      title: "Lisbon robot files its own municipal tax form",
      excerpt: "A municipal office in Lisbon accepted a tax form prepared by a desk robot.",
      publisher: "Hacker News",
      publishedAt: recent,
      discoveredAt: recent,
      entities: ["Lisbon robot"],
    }),
    item({
      provider: "hackernews",
      providerItemId: "hn-robot-tax-update",
      canonicalUrl: "https://example.com/lisbon-robot-tax-receipt",
      discussionUrl: "https://news.ycombinator.com/item?id=2",
      title: "Lisbon robot tax form now includes a receipt",
      excerpt: "The Lisbon robot tax form now includes a receipt from the municipal office.",
      publisher: "Hacker News",
      publishedAt: now,
      discoveredAt: now,
      entities: ["Lisbon robot"],
    }),
    item({
      provider: "rss",
      providerItemId: "sourdough",
      canonicalUrl: "https://feeds.arstechnica.com/demo/sourdough",
      title: "Bakers timestamp sourdough loaves on Ethereum",
      excerpt: "A bakery collective is timestamping sourdough loaves on Ethereum as a proof of patience.",
      publisher: "Ars Technica",
      publishedAt: earlier,
      discoveredAt: earlier,
      entities: ["sourdough"],
    }),
    item({
      provider: "rss",
      providerItemId: "ens-rumor",
      canonicalUrl: "https://www.coindesk.com/demo/ens-rumor",
      title: "Unconfirmed rumor claims an airdrop for every ENS name",
      excerpt: "An unconfirmed rumor claims an airdrop for every ENS name. No foundation has confirmed it.",
      publisher: "CoinDesk",
      publishedAt: recent,
      discoveredAt: recent,
      entities: ["ENS"],
    }),
    item({
      provider: "rss",
      providerItemId: "old-airdrop-cycle",
      canonicalUrl: "https://www.coindesk.com/demo/old-airdrop",
      title: "Recycled airdrop thread circulates again",
      excerpt: "A recycled airdrop thread from last season is circulating again with little new reporting.",
      publisher: "CoinDesk",
      publishedAt: fading,
      discoveredAt: fading,
      entities: ["airdrop thread"],
      metrics: [
        { metric: "mentions", value: 20, observedAt: fading },
        { metric: "mentions", value: 8, observedAt: new Date(new Date(fading).getTime() + 3_600_000).toISOString() },
      ],
    }),
  ];
}

export function replayItem(now = new Date().toISOString()): NormalizedItem {
  return item({
    provider: "fixture",
    providerItemId: "replay-lighthouse-cat",
    canonicalUrl: "https://example.com/lighthouse-cat",
    title: "A lighthouse cat starts answering ship radios",
    excerpt: "Demo fixture: a lighthouse cat has started answering ship radios with weather meows.",
    publisher: "Demo fixture",
    publishedAt: now,
    discoveredAt: now,
    fetchedAt: now,
    entities: ["lighthouse cat"],
    provenance: { fixture: true, label: "Demo", replay: true },
  });
}
