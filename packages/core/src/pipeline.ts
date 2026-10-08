import { evaluateAlerts, type AlertRuleInput, type AlertSubject } from "./alerts";
import { assertTemplateSvg, illustrationCacheKey, pickMotif, pickPalette, renderTemplateSvg, textLayerKey } from "./assets";
import { clusterItems } from "./clustering";
import { suggestNames } from "./naming";
import { componentValue, lifecycleFor, scoreNarrative } from "./scoring";
import type {
  AssetRecord,
  CollisionStatus,
  MetricPoint,
  NameOption,
  NarrativeView,
  NamingStyle,
  NormalizedItem,
  PipelineAlert,
  ScoreWeights,
  TimelineEvent,
} from "./types";
import { contentHash, hostnameOf, jaccard, relativeHours, shortHash, significantTokens } from "./text";
import type { AlertArmState } from "./types";

export interface PipelineWorld {
  narratives: NarrativeView[];
  alerts: PipelineAlert[];
  arms: AlertArmState[];
}

export interface PipelineOptions {
  now: string;
  chain: string;
  weights?: Partial<ScoreWeights> | null;
  style: NamingStyle;
  monitoringStartedAt: string | null;
  timezone: string;
  rules: AlertRuleInput[];
  deliveriesToday: number;
  watchedEntities: string[];
  excludedKeywords: string[];
}

export function emptyWorld(): PipelineWorld {
  return { narratives: [], alerts: [], arms: [] };
}

export function applyIncoming(world: PipelineWorld, items: NormalizedItem[], options: PipelineOptions): PipelineWorld {
  const narratives = world.narratives.map(cloneNarrative);
  const alerts = [...world.alerts];
  const arms = world.arms.map((arm) => ({ ...arm }));
  const touched = new Set<string>();

  const pending: NormalizedItem[] = [];
  for (const item of items) {
    const edited = attachEditedSource(narratives, item);
    if (edited) {
      touched.add(edited);
      continue;
    }
    if (narratives.some((narrative) => narrative.sources.some((source) => source.provider === item.provider && source.providerItemId === item.providerItemId))) {
      continue;
    }
    pending.push(item);
  }

  const fresh = pending.filter((item) => !item.deleted).map((item) => ({
    key: `${item.provider}:${item.providerItemId}`,
    title: item.title,
    entities: item.entities,
    contentHash: item.contentHash || contentHash(item.title, item.excerpt),
    publisher: item.publisher,
    canonicalUrl: item.canonicalUrl,
    item,
  }));

  const clusters = clusterItems(
    fresh,
    narratives.map((narrative) => ({ stableKey: narrative.stableKey, title: narrative.title, entities: narrative.entities })),
  );

  const created: NarrativeView[] = [];
  for (const cluster of clusters) {
    const target = cluster.matchedStableKey ? narratives.find((narrative) => narrative.stableKey === cluster.matchedStableKey) : undefined;
    if (target) {
      mergeCluster(target, cluster.items.map((item) => item.item), new Set(cluster.syndicatedKeys), options);
      touched.add(target.id);
      continue;
    }
    const narrative = createNarrative(cluster.items.map((item) => item.item), new Set(cluster.syndicatedKeys), options);
    narratives.push(narrative);
    created.push(narrative);
    touched.add(narrative.id);
  }

  for (const narrative of narratives) {
    if (touched.has(narrative.id)) continue;
    refreshNarrative(narrative, narratives, options, false);
  }
  for (const id of touched) {
    const narrative = narratives.find((item) => item.id === id);
    if (narrative) refreshNarrative(narrative, narratives, options, true);
  }

  const subjects: AlertSubject[] = narratives
    .filter((narrative) => touched.has(narrative.id) || created.some((item) => item.id === narrative.id))
    .map((narrative) => toSubject(narrative, created.some((item) => item.id === narrative.id)));

  const decision = evaluateAlerts(subjects, options.rules, {
    now: options.now,
    timezone: options.timezone,
    monitoringStartedAt: options.monitoringStartedAt,
    deliveriesToday: options.deliveriesToday + alerts.filter((alert) => alert.status !== "suppressed").length,
    existingKeys: alerts.map((alert) => alert.dedupeKey),
    arms,
    watchedEntities: options.watchedEntities,
  });

  return { narratives, alerts: [...alerts, ...decision.alerts], arms: decision.arms };
}

export function repaintTemplates(narratives: NarrativeView[], options: PipelineOptions): NarrativeView[] {
  return narratives.map((narrative) => {
    const next = cloneNarrative(narrative);
    syncTemplateAssets(next, options);
    return next;
  });
}

export function refreshNarratives(world: PipelineWorld, options: PipelineOptions): PipelineWorld {
  const narratives = world.narratives.map(cloneNarrative);
  for (const narrative of narratives) refreshNarrative(narrative, narratives, options, false);
  const subjects = narratives.map((narrative) => toSubject(narrative, false));
  const decision = evaluateAlerts(subjects, options.rules, {
    now: options.now,
    timezone: options.timezone,
    monitoringStartedAt: options.monitoringStartedAt,
    deliveriesToday: options.deliveriesToday + world.alerts.filter((alert) => alert.status !== "suppressed").length,
    existingKeys: world.alerts.map((alert) => alert.dedupeKey),
    arms: world.arms,
    watchedEntities: options.watchedEntities,
  });
  return { narratives, alerts: [...world.alerts, ...decision.alerts], arms: decision.arms };
}

function attachEditedSource(narratives: NarrativeView[], item: NormalizedItem): string | null {
  for (const narrative of narratives) {
    const source = narrative.sources.find((entry) => entry.provider === item.provider && entry.providerItemId === item.providerItemId);
    if (!source) continue;
    const nextHash = item.contentHash || contentHash(item.title, item.excerpt);
    const previous = contentHash(source.title, source.excerpt);
    if (previous === nextHash) return null;
    source.title = item.title;
    source.excerpt = item.excerpt;
    source.publishedAt = item.publishedAt;
    source.entities = item.entities;
    narrative.timeline.push({ at: item.fetchedAt, kind: "edit", text: `A monitored item from ${item.publisher} was edited.` });
    return narrative.id;
  }
  return null;
}

function createNarrative(items: NormalizedItem[], syndicatedKeys: Set<string>, options: PipelineOptions): NarrativeView {
  const lead = items[0]!;
  const stableKey = shortHash(items.map((item) => `${item.provider}:${item.providerItemId}`).sort().join("|") + lead.title);
  const id = `nar_${stableKey}`;
  const narrative = blankNarrative(id, stableKey, lead, options);
  mergeCluster(narrative, items, syndicatedKeys, options);
  return narrative;
}

function blankNarrative(id: string, stableKey: string, lead: NormalizedItem, options: PipelineOptions): NarrativeView {
  return {
    id,
    stableKey,
    title: lead.title,
    category: categoryFor(lead.title, lead.entities),
    factualSummary: "",
    whyNow: "",
    creativeIdea: "",
    lifecycle: "insufficient_history",
    provisional: true,
    disputed: false,
    rumor: false,
    repetitionSignal: false,
    chainRelevance: 0,
    entities: [],
    sources: [],
    independentSources: 0,
    sourceCount: 0,
    firstDiscoveredAt: lead.discoveredAt,
    latestPublishedAt: null,
    latestMeaningfulAt: lead.discoveredAt,
    latestAnalysisAt: options.now,
    score: scoreNarrative({
      now: options.now,
      publishedAt: null,
      metrics: [],
      novelty: null,
      noveltyReason: "Not enough peers yet.",
      independentSources: 0,
      syndicatedSources: 0,
      repetitionSignal: false,
      meme: null,
      chain: options.chain,
      text: lead.title,
      collisionStatus: "not_checked",
      weights: options.weights,
      rumor: false,
      disputed: false,
    }),
    names: [],
    assets: [],
    collisionStatus: "not_checked",
    crowding: "Not checked",
    timeline: [],
    changeSummary: [],
    board: "new",
    pinned: false,
    saved: false,
    tags: [],
    notes: [],
    mergedIntoId: null,
    topName: null,
    topTicker: null,
  };
}

function mergeCluster(narrative: NarrativeView, items: NormalizedItem[], syndicatedKeys: Set<string>, options: PipelineOptions): void {
  for (const item of items) {
    if (narrative.sources.some((source) => source.provider === item.provider && source.providerItemId === item.providerItemId)) continue;
    const syndicated = syndicatedKeys.has(`${item.provider}:${item.providerItemId}`) || narrative.sources.some((source) => contentHash(source.title, source.excerpt) === (item.contentHash || contentHash(item.title, item.excerpt)));
    narrative.sources.push({
      sourceId: `src_${shortHash(`${item.provider}:${item.providerItemId}`)}`,
      provider: item.provider,
      providerItemId: item.providerItemId,
      canonicalUrl: item.canonicalUrl,
      discussionUrl: item.discussionUrl ?? null,
      title: item.title,
      excerpt: item.excerpt,
      publisher: item.publisher,
      language: item.language,
      publishedAt: sanePublishedAt(item.publishedAt, options.now),
      discoveredAt: item.discoveredAt,
      independent: !syndicated,
      role: syndicated ? "syndicated" : "supporting",
      entities: item.entities,
    });
    narrative.timeline.push({
      at: item.discoveredAt,
      kind: syndicated ? "syndication" : "source",
      text: syndicated
        ? `${item.publisher} repeated an existing report. It is not counted as a new independent source.`
        : `${item.publisher} added a monitored source.`,
    });
  }
  const origins = new Set(
    narrative.sources.filter((source) => source.independent).map((source) => hostnameOf(source.canonicalUrl) || source.publisher.toLowerCase()),
  );
  narrative.independentSources = origins.size;
  narrative.sourceCount = narrative.sources.length;
  narrative.entities = [...new Set(narrative.sources.flatMap((source) => source.entities))];
  const published = narrative.sources.map((source) => source.publishedAt).filter((value): value is string => Boolean(value)).sort();
  narrative.latestPublishedAt = published.at(-1) ?? null;
  narrative.firstDiscoveredAt = narrative.sources.map((source) => source.discoveredAt).sort()[0] ?? narrative.firstDiscoveredAt;
  if (narrative.sources[0]) narrative.title = narrative.sources.find((source) => source.independent)?.title ?? narrative.sources[0].title;
  narrative.rumor = narrative.sources.some((source) => /rumor|unconfirmed|allegedly/i.test(`${source.title} ${source.excerpt}`));
  narrative.disputed = narrative.sources.some((source) => /dispute|correction|denies/i.test(`${source.title} ${source.excerpt}`));
  narrative.repetitionSignal = narrative.sources.filter((source) => !source.independent).length >= 2 && origins.size <= 1;
  if (narrative.names.length === 0) {
    narrative.names = suggestNames({ title: narrative.title, entities: narrative.entities, style: options.style, narrativeId: narrative.id });
    const top = narrative.names.find((option) => option.isTop) ?? narrative.names[0];
    narrative.topName = top?.name ?? null;
    narrative.topTicker = top?.ticker ?? null;
    narrative.timeline.push({ at: options.now, kind: "brand", text: top ? `Top creative suggestion: ${top.name} (${top.ticker}).` : "Naming produced no option." });
  }
  syncTemplateAssets(narrative, options);
  for (const item of items) {
    const source = narrative.sources.find((entry) => entry.provider === item.provider && entry.providerItemId === item.providerItemId);
    if (source && item.metrics && item.metrics.length > 0) source.metrics = item.metrics;
  }
}

function refreshNarrative(narrative: NarrativeView, all: NarrativeView[], options: PipelineOptions, meaningfulHint: boolean): void {
  const previousScore = narrative.score.narrativeScore;
  const previousLife = narrative.lifecycle;
  const text = `${narrative.title} ${narrative.sources.map((source) => `${source.title} ${source.excerpt}`).join(" ")} ${narrative.entities.join(" ")}`;
  const peers = all.filter((item) => item.id !== narrative.id);
  let novelty: number | null = null;
  let noveltyReason = "No other recent candidates to compare, so novelty is missing.";
  if (peers.length > 0) {
    const mine = significantTokens(narrative.title);
    const closest = Math.max(...peers.map((peer) => jaccard(mine, significantTokens(peer.title))));
    novelty = Math.round((1 - closest) * 1000) / 10;
    noveltyReason = `Closest recent title overlap is ${Math.round(closest * 100)}%.`;
  }
  const metrics = metricsFor(narrative);
  const collision = narrative.collisionStatus;
  narrative.score = scoreNarrative({
    now: options.now,
    publishedAt: narrative.latestPublishedAt,
    metrics,
    novelty,
    noveltyReason,
    independentSources: narrative.independentSources,
    syndicatedSources: narrative.sources.filter((source) => !source.independent).length,
    repetitionSignal: narrative.repetitionSignal,
    meme: null,
    chain: options.chain,
    text,
    collisionStatus: collision,
    weights: options.weights,
    rumor: narrative.rumor,
    disputed: narrative.disputed,
  });
  const acceleration = componentValue(narrative.score, "acceleration");
  const ageHours = relativeHours(narrative.latestPublishedAt, options.now);
  const lastActivity = [...narrative.sources.map((source) => source.publishedAt ?? source.discoveredAt)].sort().at(-1) ?? null;
  const hoursSinceUpdate = relativeHours(lastActivity, options.now);
  narrative.lifecycle = lifecycleFor({
    ageHours,
    observationWindows: metrics.length,
    independentSources: narrative.independentSources,
    acceleration,
    hoursSinceUpdate,
  });
  narrative.provisional = narrative.rumor || narrative.independentSources < 1 || !narrative.latestPublishedAt;
  narrative.chainRelevance = componentValue(narrative.score, "relevance") ?? 0;
  narrative.latestAnalysisAt = options.now;
  narrative.crowding = crowdingLabel(collision);
  const factualLead = narrative.sources.find((source) => source.independent) ?? narrative.sources[0];
  narrative.factualSummary = factualLead
    ? `${factualLead.publisher} reported “${factualLead.title}.” ${narrative.independentSources} independent origin${narrative.independentSources === 1 ? "" : "s"} and ${narrative.sources.length - narrative.independentSources} syndicated cop${narrative.sources.length - narrative.independentSources === 1 ? "y" : "ies"} are in the monitored set.`
    : "No source text is attached.";
  narrative.whyNow = narrative.latestPublishedAt
    ? `The latest known publication time is ${narrative.latestPublishedAt}.`
    : "Publication time is unknown, so recency is not assumed from the time we fetched it.";
  const top = narrative.names.find((option) => option.isTop) ?? narrative.names[0];
  narrative.creativeIdea = top
    ? `Creative idea, not a factual claim: ${top.story}`
    : "No creative name has been suggested yet.";
  syncTemplateAssets(narrative, options);
  narrative.category = categoryFor(text, narrative.entities);
  const changes: string[] = [];
  if (previousLife !== narrative.lifecycle) {
    changes.push(`Lifecycle moved from ${previousLife} to ${narrative.lifecycle}.`);
    narrative.timeline.push({ at: options.now, kind: "lifecycle", text: changes[0]! });
  }
  if (previousScore !== null && narrative.score.narrativeScore !== null && Math.abs(previousScore - narrative.score.narrativeScore) >= 3) {
    changes.push(`Narrative score moved from ${previousScore} to ${narrative.score.narrativeScore}.`);
  }
  if (meaningfulHint) changes.push("Sources or wording changed.");
  if (changes.length > 0) {
    narrative.changeSummary = changes;
    narrative.latestMeaningfulAt = options.now;
  }
}

function metricsFor(narrative: NarrativeView): MetricPoint[] {
  return narrative.sources.flatMap((source) => source.metrics ?? []);
}

const TEMPLATE_VERSION = "template-v2";

function syncTemplateAssets(narrative: NarrativeView, options: PipelineOptions): void {
  const templates = narrative.assets.filter((asset) => asset.mode === "template" && asset.status === "ready");
  const current = templates.length >= 3 && templates.every((asset) => asset.svg && asset.prompt?.includes(TEMPLATE_VERSION));
  if (!current) {
    narrative.assets = [...templateAssets(narrative, options), ...narrative.assets.filter((asset) => asset.mode === "ai")];
    return;
  }
  narrative.assets = narrative.assets.map((asset) => (asset.mode === "template" ? retitleAsset(asset, narrative) : asset));
}

function templateAssets(narrative: NarrativeView, options: PipelineOptions): AssetRecord[] {
  const top = narrative.names.find((option) => option.isTop) ?? narrative.names[0];
  const name = top?.name ?? "Untitled";
  const ticker = top?.ticker ?? "IDEA";
  const motif = pickMotif(narrative.stableKey);
  const palette = pickPalette(narrative.stableKey);
  const illustrationKey = illustrationCacheKey({
    narrativeId: narrative.id,
    motif,
    paletteName: palette.name,
    style: options.style,
    promptVersion: TEMPLATE_VERSION,
  });
  const textKey = textLayerKey({ illustrationKey, name, ticker });
  const art = { motif, palette, name, ticker, narrativeTitle: narrative.title };
  const logo = renderTemplateSvg("logo", art);
  const banner = renderTemplateSvg("banner", art);
  const mascot = renderTemplateSvg("mascot", art);
  assertTemplateSvg(logo);
  assertTemplateSvg(banner);
  assertTemplateSvg(mascot);
  const shared = {
    style: options.style,
    motif,
    paletteName: palette.name,
    illustrationKey,
    textKey,
    name,
    ticker,
    error: null,
    favorite: false,
    version: 1,
    prompt: `${TEMPLATE_VERSION}. Original mascot, logo, and banner.`,
    createdAt: options.now,
    mode: "template" as const,
    status: "ready" as const,
  };
  return [
    { ...shared, id: `asset_${narrative.id}_logo`, kind: "logo" as const, svg: logo },
    { ...shared, id: `asset_${narrative.id}_banner`, kind: "banner" as const, svg: banner },
    { ...shared, id: `asset_${narrative.id}_mascot`, kind: "mascot" as const, svg: mascot },
  ];
}

function retitleAsset(asset: AssetRecord, narrative: NarrativeView): AssetRecord {
  const top = narrative.names.find((option) => option.isTop) ?? narrative.names[0];
  if (!top || (asset.name === top.name && asset.ticker === top.ticker)) return asset;
  const palette = pickPalette(narrative.stableKey);
  const motif = asset.motif;
  const textKey = textLayerKey({ illustrationKey: asset.illustrationKey, name: top.name, ticker: top.ticker });
  const svg = renderTemplateSvg(asset.kind, { motif, palette, name: top.name, ticker: top.ticker, narrativeTitle: narrative.title });
  return { ...asset, name: top.name, ticker: top.ticker, textKey, svg, prompt: "Text layer updated. Illustration cache was kept." };
}

function toSubject(narrative: NarrativeView, isNew: boolean): AlertSubject {
  return {
    id: narrative.id,
    title: narrative.title,
    name: narrative.topName,
    ticker: narrative.topTicker,
    category: narrative.category,
    score: narrative.score.narrativeScore,
    coverage: narrative.score.dataCoverage,
    confidence: narrative.score.evidenceConfidence,
    provisional: narrative.provisional,
    rumor: narrative.rumor,
    discoveredAt: narrative.firstDiscoveredAt,
    publishedAt: narrative.latestPublishedAt,
    entities: narrative.entities,
    chainRelevance: narrative.chainRelevance,
    acceleration: componentValue(narrative.score, "acceleration"),
    text: `${narrative.title} ${narrative.factualSummary}`,
    sourceUrl: narrative.sources.find((source) => source.independent)?.canonicalUrl ?? narrative.sources[0]?.canonicalUrl ?? null,
    isNew,
  };
}

function categoryFor(text: string, entities: string[]): string {
  const haystack = `${text} ${entities.join(" ")}`.toLowerCase();
  if (/ethereum|rollup|blob|eip-/.test(haystack)) return "ethereum";
  if (/robot|model|agent|chip/.test(haystack)) return "technology";
  if (/bread|frog|meme|museum|culture|art/.test(haystack)) return "culture";
  return "general";
}

function sanePublishedAt(value: string | null, now: string): string | null {
  if (!value) return null;
  const delta = new Date(value).getTime() - new Date(now).getTime();
  if (Number.isNaN(delta) || delta > 5 * 60_000) return null;
  return value;
}

function crowdingLabel(status: CollisionStatus): string {
  switch (status) {
    case "exact":
      return "Exact match found among checked tokens";
    case "similar":
      return "Similar results found among checked tokens";
    case "none":
      return "No matches found in checked sources";
    default:
      return "Not checked / provider unavailable";
  }
}

function cloneNarrative(narrative: NarrativeView): NarrativeView {
  return structuredClone(narrative);
}

export function applyCollision(narrative: NarrativeView, nameId: string, status: CollisionStatus, matches: NameOption["matches"], checkedAt: string): NarrativeView {
  const next = cloneNarrative(narrative);
  next.names = next.names.map((option) => option.id === nameId ? { ...option, collisionStatus: status, matches, collisionCheckedAt: checkedAt } : option);
  const top = next.names.find((option) => option.isTop);
  next.collisionStatus = top?.collisionStatus ?? status;
  next.crowding = crowdingLabel(next.collisionStatus);
  return next;
}

export function keepIllustrationOnRename(beforeKey: string, afterKey: string): boolean {
  return beforeKey === afterKey;
}

// Metrics ride along on source views. Re-attach them after mergeCluster pushes sources.
export function describeChange(previous: NarrativeView | null, current: NarrativeView): string[] {
  if (!previous) return ["First time this candidate is on the desk."];
  const lines = [...current.changeSummary];
  const previousSources = new Set(previous.sources.map((source) => source.providerItemId));
  for (const source of current.sources) {
    if (!previousSources.has(source.providerItemId) && source.independent) lines.push(`New independent source: ${source.publisher}.`);
  }
  if (previous.topName !== current.topName) lines.push(`Top name changed from ${previous.topName ?? "none"} to ${current.topName ?? "none"}.`);
  return lines.length > 0 ? lines : ["No meaningful change since the last reading."];
}

export function timelineStamp(events: TimelineEvent[]): TimelineEvent[] {
  return [...events].sort((a, b) => a.at.localeCompare(b.at));
}
