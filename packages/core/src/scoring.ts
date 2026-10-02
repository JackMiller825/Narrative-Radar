import {
  DEFAULT_WEIGHTS,
  type CollisionStatus,
  type Lifecycle,
  type MetricPoint,
  type ScoreComponent,
  type ScoreResult,
  type ScoreWeights,
} from "./types";
import { clamp, relativeHours } from "./text";

export const SCORE_VERSION = "narrative-score-v1";

const LABELS: Record<keyof ScoreWeights, string> = {
  freshness: "Freshness",
  acceleration: "Observed attention acceleration",
  novelty: "Novelty",
  spread: "Independent-source spread",
  meme: "Meme and visual potential",
  relevance: "Audience and chain relevance",
  distinctiveness: "Name distinctiveness",
};

export function normalizeWeights(input?: Partial<ScoreWeights> | null): ScoreWeights {
  const merged: ScoreWeights = { ...DEFAULT_WEIGHTS, ...input };
  const keys = Object.keys(DEFAULT_WEIGHTS) as (keyof ScoreWeights)[];
  for (const key of keys) {
    const value = merged[key];
    if (!Number.isFinite(value) || value < 0) merged[key] = 0;
  }
  const sum = keys.reduce((total, key) => total + merged[key], 0);
  if (sum === 100) return merged;
  if (sum <= 0) return { ...DEFAULT_WEIGHTS };
  const scaled = {} as ScoreWeights;
  let used = 0;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      scaled[key] = Math.round((100 - used) * 1000) / 1000;
      return;
    }
    const next = Math.round((merged[key] / sum) * 100 * 1000) / 1000;
    scaled[key] = next;
    used += next;
  });
  return scaled;
}

export function freshnessScore(publishedAt: string | null, now: string): { value: number | null; reason: string } {
  const hours = relativeHours(publishedAt, now);
  if (hours === null) {
    return { value: null, reason: "Publication time is unknown, so freshness is missing rather than zero." };
  }
  if (hours < -0.08) {
    return { value: null, reason: "The source timestamp is in the future, so it was not treated as fresh." };
  }
  const age = Math.max(0, hours);
  let value = 5;
  if (age <= 2) value = 100;
  else if (age <= 12) value = 80;
  else if (age <= 24) value = 60;
  else if (age <= 72) value = 40;
  else if (age <= 168) value = 20;
  return {
    value,
    reason: `Latest known publication is about ${age < 1 ? `${Math.round(age * 60)} minutes` : `${age.toFixed(1)} hours`} old.`,
  };
}

export function accelerationScore(points: MetricPoint[]): { value: number | null; reason: string; sampleSize: number } {
  const series = points
    .filter((point) => point.value !== null && point.value !== undefined)
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  if (series.length < 2) {
    return {
      value: null,
      reason: "Insufficient history. A single cumulative count is not a growth rate.",
      sampleSize: series.length,
    };
  }
  const previous = series[series.length - 2]!.value as number;
  const current = series[series.length - 1]!.value as number;
  if (previous === 0 && current === 0) {
    return { value: 0, reason: "Both recent windows are zero.", sampleSize: series.length };
  }
  if (previous === 0 && current > 0) {
    return {
      value: 80,
      reason: `New activity (${current} after a zero baseline). This is not an infinite growth rate.`,
      sampleSize: series.length,
    };
  }
  const delta = (current - previous) / Math.abs(previous);
  const value = clamp(40 + delta * 40, 0, 100);
  return {
    value: Math.round(value * 10) / 10,
    reason: `Same metric moved from ${previous} to ${current} across ${series.length} observations.`,
    sampleSize: series.length,
  };
}

export function lifecycleFor(input: {
  ageHours: number | null;
  observationWindows: number;
  independentSources: number;
  acceleration: number | null;
  hoursSinceUpdate: number | null;
}): Lifecycle {
  const { ageHours, observationWindows, independentSources, acceleration, hoursSinceUpdate } = input;
  if (hoursSinceUpdate !== null && hoursSinceUpdate > 168) return "archived";
  if (observationWindows < 2 && (ageHours === null || ageHours < 6)) return "insufficient_history";
  if (hoursSinceUpdate !== null && hoursSinceUpdate > 72 && (acceleration === null || acceleration <= 40)) {
    return "fading";
  }
  if (acceleration !== null && acceleration >= 65 && observationWindows >= 2) return "accelerating";
  if (independentSources >= 3 && ageHours !== null && ageHours >= 24) return "established";
  return "emerging";
}

export interface ScoreInput {
  now: string;
  publishedAt: string | null;
  metrics: MetricPoint[];
  novelty: number | null;
  noveltyReason: string;
  independentSources: number;
  syndicatedSources: number;
  repetitionSignal: boolean;
  meme: { value: number; reason: string; fromModel: boolean } | null;
  chain: string;
  text: string;
  collisionStatus: CollisionStatus;
  weights?: Partial<ScoreWeights> | null;
  rumor: boolean;
  disputed: boolean;
}

export function scoreNarrative(input: ScoreInput): ScoreResult {
  const weights = normalizeWeights(input.weights);
  const freshness = freshnessScore(input.publishedAt, input.now);
  const acceleration = accelerationScore(input.metrics);
  const spreadValue = spreadScore(input.independentSources, input.syndicatedSources, input.repetitionSignal);
  const relevance = relevanceScore(input.text, input.chain);
  const distinctiveness = distinctivenessScore(input.collisionStatus);
  const meme = input.meme ?? {
    value: heuristicMeme(input.text),
    reason: "Heuristic reading of visual or character potential. This is a subjective label, not a measured audience.",
    fromModel: false,
  };

  const raw: ScoreComponent[] = [
    component("freshness", weights, freshness.value, freshness.reason, false),
    component("acceleration", weights, acceleration.value, acceleration.reason, false),
    component("novelty", weights, input.novelty, input.noveltyReason, false),
    component("spread", weights, spreadValue.value, spreadValue.reason, false),
    component("meme", weights, meme.value, meme.reason, true),
    component("relevance", weights, relevance.value, relevance.reason, false),
    component("distinctiveness", weights, distinctiveness.value, distinctiveness.reason, false),
  ];

  const available = raw.filter((item) => item.value !== null);
  const availableWeight = available.reduce((sum, item) => sum + item.weight, 0);
  const totalWeight = raw.reduce((sum, item) => sum + item.weight, 0);
  const dataCoverage = totalWeight === 0 ? 0 : availableWeight / totalWeight;
  const narrativeScore =
    availableWeight === 0
      ? null
      : Math.round(
          (available.reduce((sum, item) => sum + item.weight * (item.value as number), 0) / availableWeight) * 10,
        ) / 10;

  const components = raw.map((item) => ({
    ...item,
    availableWeight: item.value === null ? 0 : item.weight,
  }));

  const evidenceConfidence = confidenceScore({
    publishedAt: input.publishedAt,
    independentSources: input.independentSources,
    rumor: input.rumor,
    disputed: input.disputed,
    now: input.now,
  });

  const limitations: string[] = [];
  if (available.length !== raw.length) {
    limitations.push("Missing components were left out and the remaining weights were renormalized. They were not filled in as zero.");
  }
  if (acceleration.value === null) limitations.push(acceleration.reason);
  if (input.collisionStatus === "not_checked") {
    limitations.push("Name distinctiveness is missing because checked token sources were not queried.");
  }
  limitations.push("This score is an explainable reading of narrative signals and creative fit. It is not a probability of virality, accuracy, or price.");

  const provisional = dataCoverage < 0.75 || input.rumor || input.independentSources < 1 || freshness.value === null;

  return {
    version: SCORE_VERSION,
    narrativeScore,
    evidenceConfidence,
    dataCoverage: Math.round(dataCoverage * 1000) / 1000,
    provisional,
    weights,
    components,
    calculatedAt: input.now,
    limitations,
  };
}

function component(
  key: keyof ScoreWeights,
  weights: ScoreWeights,
  value: number | null,
  reason: string,
  subjective: boolean,
): ScoreComponent {
  return {
    key,
    label: LABELS[key],
    weight: weights[key],
    availableWeight: value === null ? 0 : weights[key],
    value,
    reason,
    subjective,
  };
}

function spreadScore(independentSources: number, syndicatedSources: number, repetitionSignal: boolean): { value: number; reason: string } {
  let value = clamp(independentSources * 28, independentSources === 0 ? 8 : 20, 100);
  const reasons = [`${independentSources} independent origin${independentSources === 1 ? "" : "s"}.`];
  if (syndicatedSources > 0) {
    value = Math.round(value * 0.75);
    reasons.push(`${syndicatedSources} syndicated cop${syndicatedSources === 1 ? "y was" : "ies were"} not counted as extra confirmation.`);
  }
  if (repetitionSignal) {
    value = Math.max(0, value - 15);
    reasons.push("Repeated near-identical text is labeled as a concentration signal, not a bot accusation.");
  }
  return { value, reason: reasons.join(" ") };
}

function relevanceScore(text: string, chain: string): { value: number; reason: string } {
  const haystack = text.toLowerCase();
  const chainName = chain.toLowerCase();
  const ethTerms = ["ethereum", "eth ", "blob", "rollup", "eip-", "beacon", "l2", "gas"];
  const terms = chainName === "ethereum" ? ethTerms : [chainName];
  const hits = terms.filter((term) => haystack.includes(term.trim()));
  if (hits.length === 0) {
    return { value: 18, reason: `Little direct language about ${chain} in the monitored excerpts.` };
  }
  return {
    value: clamp(35 + hits.length * 16, 0, 100),
    reason: `Mentions connected to ${chain}: ${hits.join(", ")}.`,
  };
}

function distinctivenessScore(status: CollisionStatus): { value: number | null; reason: string } {
  switch (status) {
    case "none":
      return { value: 90, reason: "No matches in the sources that were checked. This is not a global uniqueness claim." };
    case "similar":
      return { value: 35, reason: "Similar names or tickers showed up in checked sources." };
    case "exact":
      return { value: 8, reason: "An exact name or ticker match was found in checked sources." };
    default:
      return { value: null, reason: "Not checked, or the token-search provider is unavailable." };
  }
}

function heuristicMeme(text: string): number {
  const hints = ["robot", "frog", "cat", "dog", "bake", "bread", "museum", "cute", "blob", "lighthouse", "moon", "soup"];
  const hits = hints.filter((hint) => text.toLowerCase().includes(hint)).length;
  return clamp(28 + hits * 18, 20, 92);
}

function confidenceScore(input: {
  publishedAt: string | null;
  independentSources: number;
  rumor: boolean;
  disputed: boolean;
  now: string;
}): number | null {
  const time = freshnessScore(input.publishedAt, input.now);
  const timeScore = time.value === null ? 20 : clamp(time.value, 20, 90);
  const originScore = clamp(15 + input.independentSources * 25, 10, 90);
  let value = timeScore * 0.45 + originScore * 0.55;
  if (input.rumor) value -= 25;
  if (input.disputed) value -= 15;
  return Math.round(clamp(value, 0, 100) * 10) / 10;
}

export function componentValue(score: ScoreResult, key: keyof ScoreWeights): number | null {
  return score.components.find((item) => item.key === key)?.value ?? null;
}
