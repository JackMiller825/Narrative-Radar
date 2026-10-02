import { contentHash, excerpt, type NormalizedItem } from "@radar/core";
import { XMLParser } from "fast-xml-parser";
import { ProviderError, retryAfterFrom } from "./errors";
import { safeFetch } from "./http";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  processEntities: false,
  htmlEntities: false,
  allowBooleanAttributes: false,
  removeNSPrefix: true,
});

export interface RssFetch {
  notModified: boolean;
  etag: string | null;
  lastModified: string | null;
  items: NormalizedItem[];
  retryAfterMs: number | null;
}

export function parseFeedXml(xml: string, feedUrl: string, now: string): NormalizedItem[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new ProviderError("Feed DTD and entities are rejected.", "malformed", false);
  let parsed: unknown;
  try {
    parsed = parser.parse(xml);
  } catch {
    throw new ProviderError("Feed XML could not be parsed.", "malformed", false);
  }
  const root = asRecord(parsed);
  const channel = asRecord(root.rss ? asRecord(root.rss).channel : root.feed);
  const rawItems = channel.item ?? channel.entry ?? [];
  const list = Array.isArray(rawItems) ? rawItems : [rawItems];
  const items: NormalizedItem[] = [];
  for (const entry of list) {
    const record = asRecord(entry);
    const title = textOf(record.title) || "Untitled";
    const link = linkOf(record, feedUrl);
    if (!link) continue;
    const body = textOf(record.description) || textOf(record.summary) || textOf(record.content) || "";
    const published = dateOf(record.pubDate) || dateOf(record.published) || dateOf(record.updated);
    const publisher = textOf(asRecord(channel).title) || new URL(feedUrl).hostname;
    items.push({
      provider: "rss",
      providerItemId: textOf(record.guid) || textOf(record.id) || link,
      canonicalUrl: link,
      title: excerpt(title, 180),
      excerpt: excerpt(body, 480),
      publisher: excerpt(publisher, 80),
      language: textOf(asRecord(channel).language) || null,
      publishedAt: published,
      discoveredAt: now,
      fetchedAt: now,
      contentHash: contentHash(title, body),
      entities: [],
      provenance: { feedUrl, label: "rss" },
    });
  }
  return items;
}

export async function fetchRss(feedUrl: string, opts?: { etag?: string | null; lastModified?: string | null; now?: string }): Promise<RssFetch> {
  const headers: Record<string, string> = {};
  if (opts?.etag) headers["if-none-match"] = opts.etag;
  if (opts?.lastModified) headers["if-modified-since"] = opts.lastModified;
  let response;
  try {
    response = await safeFetch(feedUrl, {
      headers,
      accept: ["xml", "rss", "atom", "text", "html"],
    });
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError(error instanceof Error ? error.message : "Feed request failed.", "outage", true);
  }
  if (response.status === 429) {
    throw new ProviderError("Feed is rate limited.", "rate_limited", true, retryAfterFrom(response.headers.get("retry-after")), 429);
  }
  if (response.status === 304) {
    return { notModified: true, etag: response.headers.get("etag"), lastModified: response.headers.get("last-modified"), items: [], retryAfterMs: null };
  }
  if (response.status >= 500) throw new ProviderError(`Feed returned ${response.status}.`, "outage", true, null, response.status);
  if (response.status >= 400) throw new ProviderError(`Feed returned ${response.status}.`, "http", false, null, response.status);
  const xml = response.body.toString("utf8");
  return {
    notModified: false,
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
    items: parseFeedXml(xml, response.finalUrl, opts?.now ?? new Date().toISOString()),
    retryAfterMs: null,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function textOf(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record["#text"] === "string") return record["#text"].trim();
  }
  return "";
}

function linkOf(record: Record<string, unknown>, feedUrl: string): string | null {
  const link = record.link;
  if (typeof link === "string") return absolute(link, feedUrl);
  if (Array.isArray(link)) {
    const alternate = link.map(asRecord).find((item) => item["@_rel"] === "alternate") ?? asRecord(link[0]);
    return absolute(textOf(alternate["@_href"] || alternate["#text"]), feedUrl);
  }
  if (link && typeof link === "object") return absolute(textOf((link as Record<string, unknown>)["@_href"]), feedUrl);
  return null;
}

function absolute(value: string, base: string): string | null {
  if (!value) return null;
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

function dateOf(value: unknown): string | null {
  const text = textOf(value);
  if (!text) return null;
  const time = Date.parse(text);
  if (Number.isNaN(time)) return null;
  return new Date(time).toISOString();
}

export const CURATED_FEEDS = [
  { url: "https://blog.ethereum.org/en/feed.xml", title: "Ethereum Foundation Blog" },
  { url: "https://hnrss.org/frontpage", title: "Hacker News Front Page" },
  { url: "https://www.theverge.com/rss/index.xml", title: "The Verge" },
  { url: "https://feeds.arstechnica.com/arstechnica/index", title: "Ars Technica" },
  { url: "https://www.coindesk.com/arc/outboundfeeds/rss?outputType=xml", title: "CoinDesk" },
];
