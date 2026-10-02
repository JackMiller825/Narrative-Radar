import { contentHash, excerpt, type NormalizedItem } from "@radar/core";
import { z } from "zod";
import { ProviderError, retryAfterFrom } from "./errors";

const tweetSchema = z.object({
  data: z.array(z.object({
    id: z.string(),
    text: z.string(),
    created_at: z.string().optional(),
    author_id: z.string().optional(),
    lang: z.string().optional(),
  })).optional(),
  meta: z.object({ newest_id: z.string().optional() }).optional(),
});

export async function fetchXRecent(opts: {
  bearerToken?: string;
  query: string;
  sinceId?: string;
  now?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ items: NormalizedItem[]; cursor: string | null }> {
  if (!opts.bearerToken) {
    throw new ProviderError("X is not connected. Add a bearer token for the search access your account actually has.", "unconfigured", false);
  }
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = new URL("https://api.x.com/2/tweets/search/recent");
  url.searchParams.set("query", opts.query.slice(0, 480));
  url.searchParams.set("max_results", "10");
  url.searchParams.set("tweet.fields", "created_at,author_id,lang");
  if (opts.sinceId) url.searchParams.set("since_id", opts.sinceId);
  const response = await fetchImpl(url, { headers: { authorization: `Bearer ${opts.bearerToken}`, accept: "application/json" } });
  if (response.status === 401 || response.status === 403) {
    throw new ProviderError("X rejected the token or the app does not have recent search access.", "unconfigured", false, null, response.status);
  }
  if (response.status === 429) throw new ProviderError("X rate limit reached.", "rate_limited", true, retryAfterFrom(response.headers.get("retry-after")), 429);
  if (!response.ok) throw new ProviderError(`X returned ${response.status}.`, response.status >= 500 ? "outage" : "http", response.status >= 500, null, response.status);
  const parsed = tweetSchema.safeParse(await response.json());
  if (!parsed.success) throw new ProviderError("X response did not match the expected recent-search shape.", "malformed", false);
  const now = opts.now ?? new Date().toISOString();
  const items = (parsed.data.data ?? []).map((tweet): NormalizedItem => ({
    provider: "x",
    providerItemId: tweet.id,
    canonicalUrl: `https://x.com/i/web/status/${tweet.id}`,
    title: excerpt(tweet.text, 140),
    excerpt: excerpt(tweet.text, 280),
    publisher: tweet.author_id ? `X ${tweet.author_id}` : "X",
    language: tweet.lang ?? null,
    publishedAt: tweet.created_at ?? null,
    discoveredAt: now,
    fetchedAt: now,
    contentHash: contentHash(tweet.text, tweet.id),
    entities: [],
    provenance: { label: "x", query: opts.query },
  }));
  return { items, cursor: parsed.data.meta?.newest_id ?? opts.sinceId ?? null };
}
