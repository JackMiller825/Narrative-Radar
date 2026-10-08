export type Lifecycle =
  | "emerging"
  | "accelerating"
  | "established"
  | "fading"
  | "archived"
  | "insufficient_history";

export type CollisionStatus = "exact" | "similar" | "none" | "not_checked";

export type BoardStatus = "new" | "reviewing" | "shortlisted" | "dismissed" | "archived";

export type NamingStyle = "cute" | "absurd" | "minimalist" | "futuristic" | "ethereum";

export type Motif = "rocket" | "robot" | "frog" | "cloud" | "star" | "circuit" | "abstract";

export type SchedulePreset = "1m" | "5m" | "15m" | "1h" | "custom";

export interface ScoreWeights {
  freshness: number;
  acceleration: number;
  novelty: number;
  spread: number;
  meme: number;
  relevance: number;
  distinctiveness: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  freshness: 20,
  acceleration: 20,
  novelty: 15,
  spread: 15,
  meme: 15,
  relevance: 10,
  distinctiveness: 5,
};

export interface MetricPoint {
  metric: string;
  value: number | null;
  observedAt: string;
}

export interface NormalizedItem {
  provider: string;
  providerItemId: string;
  canonicalUrl: string;
  title: string;
  excerpt: string;
  publisher: string;
  language: string | null;
  publishedAt: string | null;
  discoveredAt: string;
  fetchedAt: string;
  contentHash: string;
  entities: string[];
  provenance: Record<string, unknown>;
  discussionUrl?: string | null;
  metrics?: MetricPoint[];
  deleted?: boolean;
}

export interface ScoreComponent {
  key: keyof ScoreWeights;
  label: string;
  weight: number;
  availableWeight: number;
  value: number | null;
  reason: string;
  subjective: boolean;
}

export interface ScoreResult {
  version: string;
  narrativeScore: number | null;
  evidenceConfidence: number | null;
  dataCoverage: number;
  provisional: boolean;
  weights: ScoreWeights;
  components: ScoreComponent[];
  calculatedAt: string;
  limitations: string[];
}

export interface NameOption {
  id: string;
  rank: number;
  name: string;
  ticker: string;
  story: string;
  wordplay: string;
  memorability: number;
  narrativeFit: number;
  style: NamingStyle;
  pinned: boolean;
  isTop: boolean;
  userEdited: boolean;
  collisionStatus: CollisionStatus;
  collisionCheckedAt: string | null;
  matches: CollisionMatch[];
}

export interface CollisionMatch {
  chainId: string;
  tokenAddress: string;
  name: string;
  symbol: string;
  pairUrl: string;
  matchKind: "exact_name" | "exact_ticker" | "approximate";
}

export interface AssetRecord {
  id: string;
  kind: "logo" | "banner" | "mascot";
  mode: "template" | "ai";
  status: "ready" | "queued" | "generating" | "failed";
  style: NamingStyle;
  motif: Motif;
  paletteName: string;
  illustrationKey: string;
  textKey: string;
  name: string;
  ticker: string;
  svg: string | null;
  error: string | null;
  favorite: boolean;
  version: number;
  prompt: string | null;
  createdAt: string;
}

export interface TimelineEvent {
  at: string;
  kind: string;
  text: string;
}

export interface NarrativeSourceView {
  sourceId: string;
  provider: string;
  providerItemId: string;
  canonicalUrl: string;
  discussionUrl: string | null;
  title: string;
  excerpt: string;
  publisher: string;
  language: string | null;
  publishedAt: string | null;
  discoveredAt: string;
  independent: boolean;
  role: "supporting" | "contrary" | "syndicated";
  entities: string[];
  metrics?: MetricPoint[];
}

export interface NarrativeView {
  id: string;
  stableKey: string;
  title: string;
  category: string;
  factualSummary: string;
  whyNow: string;
  creativeIdea: string;
  lifecycle: Lifecycle;
  provisional: boolean;
  disputed: boolean;
  rumor: boolean;
  repetitionSignal: boolean;
  chainRelevance: number;
  entities: string[];
  sources: NarrativeSourceView[];
  independentSources: number;
  sourceCount: number;
  firstDiscoveredAt: string;
  latestPublishedAt: string | null;
  latestMeaningfulAt: string;
  latestAnalysisAt: string;
  score: ScoreResult;
  names: NameOption[];
  assets: AssetRecord[];
  collisionStatus: CollisionStatus;
  crowding: string;
  timeline: TimelineEvent[];
  changeSummary: string[];
  board: BoardStatus;
  pinned: boolean;
  saved: boolean;
  tags: string[];
  notes: { id: string; body: string; createdAt: string }[];
  mergedIntoId: string | null;
  topName: string | null;
  topTicker: string | null;
}

export interface PipelineAlert {
  id: string;
  dedupeKey: string;
  ruleId: string;
  narrativeId: string;
  eventType: string;
  status: "pending" | "held" | "suppressed";
  reason: string;
  title: string;
  body: string;
  channels: ("inbox" | "browser" | "telegram")[];
  createdAt: string;
  sourceUrl: string | null;
}

export interface AlertArmState {
  narrativeId: string;
  ruleId: string;
  armed: boolean;
  lastFiredAt: string | null;
}
