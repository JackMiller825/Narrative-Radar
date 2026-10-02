import type { NarrativeView } from "./types";
import { csvCell } from "./text";

export interface ResearchPackFiles {
  "summary.md": string;
  "sources.json": string;
  "naming-options.csv": string;
  "score-breakdown.json": string;
  "generation.json": string;
  assetNotes: { path: string; bytes?: Uint8Array; missing?: string }[];
}

export function buildResearchPack(narrative: NarrativeView, assets: { path: string; bytes: Uint8Array | null; label: string }[]): ResearchPackFiles {
  const summary = [
    `# ${narrative.title}`,
    "",
    "This pack separates monitored evidence from creative suggestions.",
    "",
    "## Factual summary",
    narrative.factualSummary,
    "",
    "## Why now",
    narrative.whyNow,
    "",
    "## Creative interpretation",
    narrative.creativeIdea,
    "",
    "## Selected creative suggestion",
    narrative.topName ? `${narrative.topName} (${narrative.topTicker ?? ""})` : "No name selected.",
    "",
    `Lifecycle: ${narrative.lifecycle}`,
    `Narrative score: ${narrative.score.narrativeScore ?? "incomplete"}`,
    `Evidence confidence: ${narrative.score.evidenceConfidence ?? "unknown"}`,
    `Data coverage: ${Math.round(narrative.score.dataCoverage * 100)}%`,
    "",
    narrative.score.limitations.map((line) => `- ${line}`).join("\n"),
  ].join("\n");

  const naming = [
    ["rank", "name", "ticker", "story", "wordplay", "memorability", "narrative_fit", "collision_status", "pinned"].join(","),
    ...narrative.names.map((option) =>
      [option.rank, option.name, option.ticker, option.story, option.wordplay, option.memorability, option.narrativeFit, option.collisionStatus, option.pinned]
        .map((value) => csvCell(String(value)))
        .join(","),
    ),
  ].join("\n");

  return {
    "summary.md": summary,
    "sources.json": JSON.stringify(
      narrative.sources.map((source) => ({
        provider: source.provider,
        providerItemId: source.providerItemId,
        url: source.canonicalUrl,
        title: source.title,
        publisher: source.publisher,
        publishedAt: source.publishedAt,
        independent: source.independent,
        role: source.role,
        excerpt: source.excerpt,
      })),
      null,
      2,
    ),
    "naming-options.csv": naming,
    "score-breakdown.json": JSON.stringify(narrative.score, null, 2),
    "generation.json": JSON.stringify(
      {
        narrativeId: narrative.id,
        names: narrative.names.map((option) => ({ name: option.name, ticker: option.ticker, isTop: option.isTop })),
        assets: narrative.assets.map((asset) => ({
          kind: asset.kind,
          mode: asset.mode,
          status: asset.status,
          illustrationKey: asset.illustrationKey,
          textKey: asset.textKey,
          prompt: asset.prompt,
          error: asset.error,
        })),
      },
      null,
      2,
    ),
    assetNotes: assets.map((asset) =>
      asset.bytes
        ? { path: asset.path, bytes: asset.bytes }
        : { path: asset.path, missing: `${asset.label} is not available. No placeholder file was invented.` },
    ),
  };
}
