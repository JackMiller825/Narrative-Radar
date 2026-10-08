import { MARKET_PEOPLE, mentionedPeople, type MarketPerson } from "./people";
import { clamp } from "./text";

export type NarrativeLane = "meme" | "ai" | "ethereum" | "person" | "robotics" | "prediction" | "internet";

export type StoryFit = {
  lanes: NarrativeLane[];
  meme: number;
  visual: number;
  ethereumFriendly: boolean;
  major: boolean;
  people: string[];
  endorsementVerified: boolean;
  routine: boolean;
};

export type ReportedNarrative = {
  id: string;
  score: number;
  publishedAt: string | null;
  baseline?: boolean;
};

export type ReportCandidate = {
  id: string;
  score: number;
  publishedAt: string | null;
  major: boolean;
};

const VISUAL = [
  "robot", "humanoid", "android", "frog", "cat", "dog", "penguin", "ape", "monkey", "alien",
  "ghost", "skull", "dragon", "bear", "bull", "fox", "mascot", "character", "blob", "helmet",
  "crown", "mask", "rocket", "brain", "statue", "toy", "orb", "lighthouse", "wizard", "knight",
  "pirate", "duck", "shiba", "pepe", "wojak", "cape", "hat",
];

const MEME_TERMS = ["meme", "memecoin", "viral", "mascot", "ticker", "token", "coin", ...VISUAL];

const LANE_LABEL: Record<NarrativeLane, string> = {
  meme: "a social or meme trend",
  ai: "an AI or superintelligence development",
  ethereum: "an Ethereum ecosystem development",
  person: "a famous-person-adjacent development",
  robotics: "a robotics story",
  prediction: "a prediction-market move",
  internet: "a fast-moving internet narrative",
};

const STRONGER_DELTA = 8;
const NEWER_MS = 6 * 60 * 60 * 1000;
const NEWER_SCORE_GAP = 6;

export function assessStory(text: string, people: MarketPerson[] = MARKET_PEOPLE): StoryFit {
  const lanes: NarrativeLane[] = [];
  if (hasTerm(text, "meme") || hasTerm(text, "memecoin") || hasTerm(text, "viral") || hasTerm(text, "mascot") || /meme coin/i.test(text)) lanes.push("meme");
  if (/\bai\b|superintelligence|\bagi\b|ai agent|artificial intelligence|openai|anthropic/i.test(text)) lanes.push("ai");
  if (/ethereum|\beth\b|rollup|layer 2|\bl2\b|erc-?20|onchain|on-chain|mainnet|\bblob\b|eip-/i.test(text)) lanes.push("ethereum");
  if (/robot|humanoid|robotics/i.test(text)) lanes.push("robotics");
  if (/polymarket|prediction market|kalshi/i.test(text)) lanes.push("prediction");
  const named = mentionedPeople(text, people);
  if (named.length > 0) lanes.push("person");
  if (/viral|trending|tiktok|reddit/i.test(text)) lanes.push("internet");

  const visualHits = VISUAL.filter((term) => hasTerm(text, term)).length;
  const memeHits = MEME_TERMS.filter((term) => hasTerm(text, term)).length;
  const visual = clamp(visualHits === 0 ? 18 : 30 + visualHits * 28, 0, 96);
  let meme = 16 + memeHits * 12;
  if (lanes.includes("meme")) meme += 14;
  if (lanes.includes("robotics") && visualHits > 0) meme += 10;
  if (lanes.includes("ai") && visualHits > 0) meme += 8;
  if (lanes.includes("prediction") && (lanes.includes("meme") || visualHits > 0)) meme += 8;
  meme = clamp(meme, 0, 96);

  const onEthereum = /ethereum|\beth\b|erc-?20|onchain|on-chain|mainnet|rollup|\bl2\b|layer 2|\bblob\b|eip-|uniswap/i.test(text);
  const cryptoNative = /polymarket|memecoin|meme coin|erc-?20|onchain|on-chain/i.test(text);
  const solanaOnly = /\bsolana\b/i.test(text) && !onEthereum;
  const bitcoinOnly = /\bbitcoin\b|\bbtc\b/i.test(text) && !onEthereum && !/polymarket/i.test(text);
  const ethereumFriendly = (onEthereum || cryptoNative) && !solanaOnly && !bitcoinOnly;
  const routine = /\b(price|prices|etf|staking yield|gas fees|market cap|earnings|quarterly)\b/i.test(text) && visualHits === 0 && !lanes.includes("meme");
  const fast = lanes.some((lane) => lane !== "person");
  const major = fast && ethereumFriendly && meme >= 58 && visual >= 55 && !routine;

  const claimsEndorsement = /\b(endorses?|backs|backed|launches?|launched|promotes?|official (token|coin|memecoin))\b/i.test(text);
  const explicit = /\b(confirmed|verified|official statement|in a statement)\b/i.test(text);
  return {
    lanes,
    meme,
    visual,
    ethereumFriendly,
    major,
    people: named,
    endorsementVerified: claimsEndorsement && explicit,
    routine,
  };
}

export function laneEntities(lanes: NarrativeLane[]): string[] {
  const labels: Record<NarrativeLane, string | null> = {
    meme: "Meme trend",
    ai: "AI",
    ethereum: "Ethereum",
    person: null,
    robotics: "Robotics",
    prediction: "Prediction markets",
    internet: "Internet narrative",
  };
  return lanes.flatMap((lane) => {
    const label = labels[lane];
    return label ? [label] : [];
  });
}

export function describeTokenNarrative(input: {
  title: string;
  name: string;
  ticker: string;
  publishedAt: string | null;
  fit: StoryFit;
}): { whyNow: string; trigger: string; concept: string; category: string } {
  const lanes = input.fit.lanes.filter((lane) => lane !== "person");
  const focus = (lanes.length > 0 ? lanes : ["internet" as NarrativeLane]).slice(0, 2).map((lane) => LANE_LABEL[lane]);
  const joined = focus.length === 1 ? focus[0] : `${focus[0]} and ${focus[1]}`;
  const when = input.publishedAt ? ` The latest item is ${input.publishedAt}.` : "";
  const whyNow = `Breaking now as ${joined}.${when}`;
  const conceptParts = [
    `${input.name} (${input.ticker}) is an Ethereum-friendly token concept: a distinct mascot for this moment, readable as a name and a ticker.`,
  ];
  if (input.fit.people.length > 0 && input.fit.endorsementVerified) {
    conceptParts.push(`Sources explicitly connect ${input.fit.people.join(", ")} to this development.`);
  } else if (input.fit.people.length > 0) {
    conceptParts.push(`${input.fit.people.join(", ")} appear in the coverage. That is adjacent context, not an endorsement.`);
  }
  const category = input.fit.lanes.includes("robotics")
    ? "robotics"
    : input.fit.lanes.includes("prediction")
      ? "prediction"
      : input.fit.lanes.includes("ai")
        ? "ai"
        : input.fit.lanes.includes("meme")
          ? "meme"
          : input.fit.lanes.includes("ethereum")
            ? "ethereum"
            : "general";
  return { whyNow, trigger: input.title, concept: conceptParts.join(" "), category };
}

export function materialReports(candidates: ReportCandidate[], history: ReportedNarrative[]): ReportCandidate[] {
  const bestById = new Map<string, ReportCandidate>();
  for (const candidate of candidates) {
    if (!candidate.major || !Number.isFinite(candidate.score)) continue;
    const current = bestById.get(candidate.id);
    if (!current || candidate.score > current.score) bestById.set(candidate.id, candidate);
  }
  return [...bestById.values()]
    .filter((candidate) => isMaterial(candidate, history))
    .sort((a, b) => b.score - a.score || (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
}

function isMaterial(candidate: ReportCandidate, history: ReportedNarrative[]): boolean {
  const same = history.find((item) => item.id === candidate.id);
  if (same && !same.baseline) {
    if (candidate.score >= same.score + STRONGER_DELTA) return true;
    return isNewer(same.publishedAt, candidate.publishedAt) && candidate.score + 0.01 >= same.score;
  }
  if (same?.baseline) {
    if (candidate.score >= same.score + STRONGER_DELTA) return true;
    return isNewer(same.publishedAt, candidate.publishedAt) && candidate.score + 0.01 >= same.score;
  }
  const prior = history.filter((item) => !item.baseline);
  if (prior.length === 0) return true;
  const best = Math.max(...prior.map((item) => item.score));
  const newest = prior.reduce((max, item) => ((item.publishedAt ?? "") > max ? item.publishedAt ?? "" : max), "");
  if (candidate.score >= best + STRONGER_DELTA) return true;
  return (candidate.publishedAt ?? "") > newest && candidate.score >= best - NEWER_SCORE_GAP;
}

function isNewer(previous: string | null, next: string | null): boolean {
  if (!previous || !next) return false;
  return new Date(next).getTime() - new Date(previous).getTime() >= NEWER_MS;
}

function hasTerm(text: string, term: string): boolean {
  if (term.length <= 4) return new RegExp(`\\b${term}\\b`, "i").test(text);
  return text.toLowerCase().includes(term);
}
