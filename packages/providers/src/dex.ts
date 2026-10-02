import type { CollisionMatch, CollisionStatus } from "@radar/core";
import { z } from "zod";
import { ProviderError, retryAfterFrom } from "./errors";

const pairSchema = z.object({
  chainId: z.string(),
  url: z.string().optional(),
  pairAddress: z.string().optional(),
  baseToken: z.object({
    address: z.string(),
    name: z.string().optional().default(""),
    symbol: z.string().optional().default(""),
  }),
});

const responseSchema = z.object({
  pairs: z.array(pairSchema).nullable().optional(),
});

export interface DexToken {
  chainId: string;
  tokenAddress: string;
  name: string;
  symbol: string;
  pairUrl: string;
}

export async function searchDex(query: string, fetchImpl: typeof fetch = fetch): Promise<DexToken[]> {
  const url = new URL("https://api.dexscreener.com/latest/dex/search");
  url.searchParams.set("q", query.slice(0, 80));
  const response = await fetchImpl(url, { headers: { accept: "application/json", "user-agent": "NarrativeRadar/0.1" } });
  if (response.status === 429) {
    throw new ProviderError("DEX Screener is rate limited.", "rate_limited", true, retryAfterFrom(response.headers.get("retry-after")), 429);
  }
  if (!response.ok) throw new ProviderError(`DEX Screener returned ${response.status}.`, response.status >= 500 ? "outage" : "http", response.status >= 500, null, response.status);
  const json = await response.json();
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) throw new ProviderError("DEX Screener response did not match the documented pair shape.", "malformed", false);
  const deduped = new Map<string, DexToken>();
  for (const pair of parsed.data.pairs ?? []) {
    const key = `${pair.chainId}:${pair.baseToken.address.toLowerCase()}`;
    if (deduped.has(key)) continue;
    deduped.set(key, {
      chainId: pair.chainId,
      tokenAddress: pair.baseToken.address,
      name: pair.baseToken.name,
      symbol: pair.baseToken.symbol,
      pairUrl: pair.url || `https://dexscreener.com/${pair.chainId}/${pair.pairAddress ?? pair.baseToken.address}`,
    });
  }
  return [...deduped.values()];
}

export function classifyNameCollisions(name: string, ticker: string, tokens: DexToken[]): { status: CollisionStatus; matches: CollisionMatch[] } {
  const matchesByToken = new Map<string, CollisionMatch>();
  const wantedName = name.trim().toLowerCase();
  const wantedTicker = ticker.trim().toLowerCase();
  const rank = { approximate: 1, exact_name: 2, exact_ticker: 3 };
  for (const token of tokens) {
    const tokenName = token.name.trim().toLowerCase();
    const symbol = token.symbol.trim().toLowerCase();
    let kind: CollisionMatch["matchKind"] | null = null;
    if (symbol === wantedTicker) kind = "exact_ticker";
    else if (tokenName === wantedName) kind = "exact_name";
    else if (symbol && (symbol.includes(wantedTicker) || wantedTicker.includes(symbol) || levenshtein(symbol, wantedTicker) <= 1)) kind = "approximate";
    else if (tokenName && tokenName.includes(wantedName)) kind = "approximate";
    if (!kind) continue;
    const key = `${token.chainId}:${token.tokenAddress.toLowerCase()}`;
    const match: CollisionMatch = {
      chainId: token.chainId,
      tokenAddress: token.tokenAddress,
      name: token.name,
      symbol: token.symbol,
      pairUrl: token.pairUrl,
      matchKind: kind,
    };
    const existing = matchesByToken.get(key);
    if (!existing || rank[kind] > rank[existing.matchKind]) matchesByToken.set(key, match);
  }
  const matches = [...matchesByToken.values()];
  const status: CollisionStatus = matches.some((match) => match.matchKind !== "approximate")
    ? "exact"
    : matches.length > 0
      ? "similar"
      : "none";
  return { status, matches };
}

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(current + 1, row[j - 1]! + 1, previous + cost);
      previous = current;
    }
  }
  return row[b.length]!;
}
