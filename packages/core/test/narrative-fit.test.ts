import { describe, expect, it } from "vitest";
import { assessStory, describeTokenNarrative, materialReports } from "../src/narrative-fit";

describe("token narrative criteria", () => {
  it("accepts an ethereum-friendly meme with a visual character", () => {
    const fit = assessStory("Ethereum traders mint a frog mascot memecoin after a viral robot dance");
    expect(fit.major).toBe(true);
    expect(fit.ethereumFriendly).toBe(true);
    expect(fit.lanes).toEqual(expect.arrayContaining(["meme", "ethereum", "robotics"]));
  });

  it("rejects celebrity chatter, price recaps, and other-chain memes", () => {
    expect(assessStory("Elon Musk comments on markets").major).toBe(false);
    expect(assessStory("Ethereum gas fees and the eth price rise again").major).toBe(false);
    expect(assessStory("Solana frog mascot memecoin goes viral").ethereumFriendly).toBe(false);
    expect(assessStory("Bitcoin ETF inflows hit a record").major).toBe(false);
  });

  it("does not treat a named person as an endorsement", () => {
    const fit = assessStory("Vitalik Buterin posted a sketch as an Ethereum frog mascot memecoin went viral");
    const brief = describeTokenNarrative({
      title: "Vitalik Buterin posted a sketch as an Ethereum frog mascot memecoin went viral",
      name: "Froglet",
      ticker: "FRGLT",
      publishedAt: "2026-10-08T12:00:00.000Z",
      fit,
    });
    expect(brief.concept).toContain("Froglet (FRGLT)");
    expect(brief.concept).toContain("not an endorsement");
    expect(brief.whyNow).toContain("Breaking now");
    expect(brief.trigger).toContain("frog mascot");
  });

  it("keeps a verified statement distinct from adjacent name drops", () => {
    const fit = assessStory("Vitalik Buterin confirmed in a statement that he launched an official Ethereum frog mascot memecoin");
    expect(fit.endorsementVerified).toBe(true);
    const brief = describeTokenNarrative({
      title: "Statement",
      name: "Froglet",
      ticker: "FRGLT",
      publishedAt: null,
      fit,
    });
    expect(brief.concept).toContain("explicitly connect");
    expect(brief.concept).not.toContain("not an endorsement");
  });

  it("notifies only when a narrative is materially stronger or newer", () => {
    const history = [{ id: "old", score: 70, publishedAt: "2026-10-08T06:00:00.000Z" }];
    expect(materialReports([{ id: "new", score: 68, publishedAt: "2026-10-08T12:00:00.000Z", major: true }], history).map((item) => item.id)).toEqual(["new"]);
    expect(materialReports([{ id: "new", score: 60, publishedAt: "2026-10-08T12:00:00.000Z", major: true }], history)).toEqual([]);
    expect(materialReports([{ id: "old", score: 79, publishedAt: "2026-10-08T12:00:00.000Z", major: true }], history).map((item) => item.id)).toEqual(["old"]);
    expect(materialReports([{ id: "old", score: 72, publishedAt: "2026-10-08T08:00:00.000Z", major: true }], history)).toEqual([]);
    expect(materialReports([{ id: "old", score: 70, publishedAt: "2026-10-08T13:00:00.000Z", major: true }], history).map((item) => item.id)).toEqual(["old"]);
    expect(materialReports([{ id: "weak", score: 80, publishedAt: "2026-10-08T14:00:00.000Z", major: false }], history)).toEqual([]);
  });

  it("ignores baseline cards when deciding the first new report", () => {
    const history = [{ id: "demo", score: 90, publishedAt: "2026-10-08T15:00:00.000Z", baseline: true }];
    expect(materialReports([{ id: "fresh", score: 64, publishedAt: "2026-10-08T12:00:00.000Z", major: true }], history).map((item) => item.id)).toEqual(["fresh"]);
  });
});
