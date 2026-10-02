import { describe, expect, it } from "vitest";
import { classifyNameCollisions, fetchXRecent, formatAlertHtml, mapHnItem, parseFeedXml, searchDex } from "../src/index";

const NOW = "2026-10-02T13:00:00.000Z";

describe("providers", () => {
  it("parses RSS and rejects hostile DTDs", () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>Example</title><item><title>Blob fees fall</title><link>https://blog.ethereum.org/en/post</link><pubDate>Fri, 02 Oct 2026 12:00:00 GMT</pubDate><description>Fees fell.</description><guid>abc</guid></item></channel></rss>`;
    const items = parseFeedXml(xml, "https://blog.ethereum.org/en/feed.xml", NOW);
    expect(items).toHaveLength(1);
    expect(items[0]!.publishedAt).toBeTruthy();
    expect(items[0]!.canonicalUrl).toContain("blog.ethereum.org");
    expect(() => parseFeedXml(`<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><rss></rss>`, "https://example.com/feed", NOW)).toThrow(/DTD/);
  });

  it("keeps the Hacker News discussion distinct from the article", () => {
    const mapped = mapHnItem({ id: 42, type: "story", title: "A desk robot", url: "https://example.com/robot", by: "ada", time: 1_759_401_600, score: 12, descendants: 3 }, NOW);
    expect(mapped?.canonicalUrl).toBe("https://example.com/robot");
    expect(mapped?.discussionUrl).toBe("https://news.ycombinator.com/item?id=42");
    expect(mapped?.metrics).toHaveLength(2);
    expect(mapHnItem({ id: 7, deleted: true, title: "gone" }, NOW)).toBeNull();
  });

  it("dedupes DEX pairs and never calls a miss unique", () => {
    const tokens = [
      { chainId: "ethereum", tokenAddress: "0xabc", name: "Bloblet", symbol: "BLOBLT", pairUrl: "https://dexscreener.com/ethereum/1" },
      { chainId: "ethereum", tokenAddress: "0xabc", name: "Bloblet", symbol: "BLOBLT", pairUrl: "https://dexscreener.com/ethereum/2" },
      { chainId: "base", tokenAddress: "0xdef", name: "Other", symbol: "BLOB", pairUrl: "https://dexscreener.com/base/3" },
    ];
    const exact = classifyNameCollisions("Bloblet", "BLOBLT", tokens);
    expect(exact.status).toBe("exact");
    expect(exact.matches.filter((match) => match.tokenAddress === "0xabc")).toHaveLength(1);
    const none = classifyNameCollisions("Lighthouse", "LHCat", []);
    expect(none.status).toBe("none");
    expect(JSON.stringify(none)).not.toMatch(/unique|available/i);
  });

  it("reads a DEX search payload and dedupes pairs", async () => {
    const fetchImpl = async () => new Response(JSON.stringify({
      pairs: [
        { chainId: "ethereum", url: "https://dexscreener.com/ethereum/a", pairAddress: "a", baseToken: { address: "0x1", name: "Pepe", symbol: "PEPE" } },
        { chainId: "ethereum", url: "https://dexscreener.com/ethereum/b", pairAddress: "b", baseToken: { address: "0x1", name: "Pepe", symbol: "PEPE" } },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } });
    const tokens = await searchDex("PEPE", fetchImpl as typeof fetch);
    expect(tokens).toHaveLength(1);
  });

  it("reports X as not connected without a token", async () => {
    await expect(fetchXRecent({ query: "ethereum" })).rejects.toThrow(/not connected/i);
  });

  it("escapes telegram text", () => {
    const html = formatAlertHtml({ title: "<b>no</b>", body: "a & b", link: "https://example.com/a?q=1" });
    expect(html).toContain("&lt;b&gt;no&lt;/b&gt;");
    expect(html).toContain("a &amp; b");
    expect(html).not.toContain("<b>no</b>");
  });
});
