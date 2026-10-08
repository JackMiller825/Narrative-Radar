import {
  DEFAULT_WEIGHTS,
  DEMO_NOW,
  applyIncoming,
  defaultNewCandidateRule,
  demoItems,
  emptyWorld,
  intervalSeconds,
  marketPeopleNames,
  workPreview,
} from "@radar/core";
import type { DeskData } from "./types";

const FEEDS = [
  { url: "https://blog.ethereum.org/en/feed.xml", title: "Ethereum Foundation Blog" },
  { url: "https://hnrss.org/frontpage", title: "Hacker News Front Page" },
  { url: "https://www.theverge.com/rss/index.xml", title: "The Verge" },
  { url: "https://feeds.arstechnica.com/arstechnica/index", title: "Ars Technica" },
  { url: "https://www.coindesk.com/arc/outboundfeeds/rss?outputType=xml", title: "CoinDesk" },
];

const PROVIDERS = [
  ["rss", "Curated feeds are saved. Live fetches run when the desk is in live mode."],
  ["hackernews", "Official public API. No key required. Live mode fetches new stories."],
  ["dexscreener", "Public search API. Used for name checks in live mode. Not a universal token registry."],
  ["x", "Not connected. Add X_BEARER_TOKEN for recent search on your account's access tier."],
  ["openai_text", "Not configured. Heuristic summaries are used until OPENAI_API_KEY and OPENAI_TEXT_MODEL are set."],
  ["openai_image", "Not configured. Template logos and banners are available without it."],
  ["telegram", "Not connected. Pair a bot to deliver alerts outside the browser."],
] as const;

let cached: DeskData | null = null;

export function staticDesk(): DeskData {
  if (cached) return cached;
  const publishedAt = new Date().toISOString();
  const rule = defaultNewCandidateRule();
  const world = applyIncoming(emptyWorld(), demoItems(DEMO_NOW), {
    now: DEMO_NOW,
    chain: "ethereum",
    weights: DEFAULT_WEIGHTS,
    style: "cute",
    monitoringStartedAt: "2026-10-01T00:00:00.000Z",
    timezone: "UTC",
    rules: [rule],
    deliveriesToday: 0,
    watchedEntities: ["Lisbon robot"],
    excludedKeywords: [],
  });
  const seconds = intervalSeconds("5m", 300);
  const desk: DeskData = {
    workspace: { id: "ws_pages", name: "Narrative desk", mode: "demo" },
    settings: {
      chainPreference: "ethereum",
      schedulePreset: "5m",
      customIntervalSeconds: 300,
      paused: false,
      timezone: "UTC",
      namingStyle: "cute",
      freshnessHours: 72,
      excludedKeywords: [],
      watchedEntities: marketPeopleNames(),
      categories: ["ethereum", "technology", "culture", "general"],
      languages: ["en"],
      scoreWeights: { ...DEFAULT_WEIGHTS },
      dailyRequestLimit: 2000,
      textBudgetUsd: null,
      imageBudgetUsd: null,
      imageQueueCap: 10,
      pauseOnBudget: true,
      retentionDays: 30,
      alertSound: false,
      browserNotifications: false,
      nextDueAt: new Date(Date.now() + seconds * 1000).toISOString(),
      lastAttemptedAt: publishedAt,
      lastSuccessfulAt: publishedAt,
      monitoringStartedAt: "2026-10-01T00:00:00.000Z",
      priceAssumptions: {
        note: "Assumptions only. Null means no dollar estimate is shown.",
        textPerCallUsd: null,
        imageEachUsd: null,
      },
    },
    narratives: world.narratives,
    alerts: world.alerts.map((alert) => ({
      id: alert.id,
      title: alert.title,
      body: alert.body,
      status: alert.status,
      reason: alert.reason,
      createdAt: alert.createdAt,
      readAt: null,
      eventType: alert.eventType,
      narrativeId: alert.narrativeId,
      sourceUrl: alert.sourceUrl,
      deliveries: alert.channels.map((channel) => ({ channel, status: "pending", lastError: null })),
    })),
    providers: PROVIDERS.map(([provider, detail]) => ({
      id: `provider_${provider}`,
      provider,
      status: "unconfigured",
      detail,
      lastSuccessAt: null,
      lastError: null,
      nextPermittedAt: null,
    })),
    feeds: FEEDS.map((feed) => ({
      id: `feed_${feed.title.toLowerCase().replaceAll(" ", "-")}`,
      url: feed.url,
      title: feed.title,
      enabled: true,
      lastSuccessAt: null,
      lastError: null,
    })),
    rules: [
      {
        id: rule.id,
        name: rule.name,
        enabled: rule.enabled,
        eventType: rule.eventType,
        mode: rule.mode,
        dailyCap: rule.dailyCap,
        includeRumors: rule.includeRumors,
        includeProvisional: rule.includeProvisional,
      },
    ],
    scans: [
      {
        id: "scan_pages_demo",
        status: "succeeded",
        trigger: "manual",
        error: null,
        createdAt: publishedAt,
        finishedAt: publishedAt,
      },
    ],
    worker: {
      online: false,
      beatAt: null,
      note: "GitHub Pages serves this demo snapshot. The worker runs only beside the hosted server.",
    },
    schedule: { seconds, preview: workPreview(seconds) },
    usage: {},
    telegram: { configured: false, paired: false, username: null, pairingCode: null },
  };
  cached = desk;
  return desk;
}

export function staticNarrativeIds() {
  return staticDesk().narratives.map((narrative) => narrative.id);
}
