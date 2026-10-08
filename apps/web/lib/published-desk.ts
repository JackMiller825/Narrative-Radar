import {
  applyCollision,
  applyIncoming,
  assertCustomInterval,
  assessStory,
  buildResearchPack,
  contentHash,
  defaultNewCandidateRule,
  describeTokenNarrative,
  excerpt,
  illustrationCacheKey,
  intervalSeconds,
  marketPeopleNames,
  materialReports,
  nextDue,
  normalizeWeights,
  pickMotif,
  pickPalette,
  refreshNarratives,
  repaintTemplates,
  renderTemplateSvg,
  replayItem,
  stripTags,
  suggestNames,
  textLayerKey,
  workPreview,
  type AlertArmState,
  type AlertRuleInput,
  type NarrativeView,
  type NormalizedItem,
  type PipelineAlert,
  type PipelineOptions,
  type ReportedNarrative,
  type SchedulePreset,
} from "@radar/core/browser";
import type { DeskData } from "./types";
import { attachMascotImages, focusedWatchList, mascotImageUrl } from "./mascot-images";
import { fetchPersonStories, notifyNarrative } from "./person-news";

const STORAGE_KEY = "narrative-radar-desk-v1";

type Memory = {
  desk: DeskData;
  arms: AlertArmState[];
  rules: AlertRuleInput[];
  audits: { id: string; narrativeId: string; previous: NarrativeView["board"] }[];
  pipelineAlerts: PipelineAlert[];
};

type ActionResult = {
  ok?: boolean;
  error?: string;
  reason?: string;
  detail?: string;
  auditId?: string;
  previous?: NarrativeView["board"];
  incoming?: number;
  removed?: number;
  instructions?: string;
  code?: string;
  status?: string;
  needsPaste?: boolean;
  skipped?: boolean;
};

let memory: Memory | null = null;
let timer: number | null = null;
let personBusy = false;
const listeners = new Set<() => void>();

export function subscribeDesk(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function getDeskSnapshot(): DeskData | null {
  return memory?.desk ?? null;
}

function emit() {
  if (memory) memory.desk.narratives = attachMascotImages(memory.desk.narratives);
  if (memory && typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  }
  listeners.forEach((callback) => callback());
}

function optionsFor(desk: DeskData, rules: AlertRuleInput[], now: string): PipelineOptions {
  return {
    now,
    chain: desk.settings.chainPreference,
    weights: desk.settings.scoreWeights,
    style: desk.settings.namingStyle as PipelineOptions["style"],
    monitoringStartedAt: desk.settings.monitoringStartedAt,
    timezone: desk.settings.timezone || "UTC",
    rules: rules.length > 0 ? rules : [defaultNewCandidateRule()],
    deliveriesToday: 0,
    watchedEntities: desk.settings.watchedEntities,
    excludedKeywords: desk.settings.excludedKeywords,
  };
}

function toDeskAlerts(previous: DeskData["alerts"], pipeline: PipelineAlert[]): DeskData["alerts"] {
  const read = new Map(previous.map((alert) => [alert.id, alert.readAt]));
  return pipeline.map((alert) => ({
    id: alert.id,
    title: alert.title,
    body: alert.body,
    status: alert.status,
    reason: alert.reason,
    createdAt: alert.createdAt,
    readAt: read.get(alert.id) ?? null,
    eventType: alert.eventType,
    narrativeId: alert.narrativeId,
    sourceUrl: alert.sourceUrl,
    deliveries: alert.channels.map((channel) => ({
      channel,
      status: alert.status === "suppressed" ? "suppressed" : "pending",
      lastError: null,
    })),
  }));
}

function applySchedule(desk: DeskData, now: string) {
  const preset = desk.settings.schedulePreset as SchedulePreset;
  const seconds = intervalSeconds(preset, desk.settings.customIntervalSeconds);
  desk.schedule = { seconds, preview: workPreview(seconds) };
  desk.settings.nextDueAt = nextDue(new Date(now), seconds).toISOString();
}

function touchWorker(desk: DeskData, now: string) {
  const auto = desk.settings.autoScan === true;
  desk.worker = {
    online: true,
    beatAt: now,
    note: auto
      ? "Auto mode checks on your interval and notifies only when a token narrative is materially stronger or newer. It stays quiet otherwise."
      : "Manual mode. Scan now looks for a major new token narrative. Press Start for automatic checks.",
  };
}

function recordScan(desk: DeskData, now: string, trigger: string, status: string, error: string | null) {
  desk.scans = [
    { id: `scan_${now}`, status, trigger, error, createdAt: now, finishedAt: now },
    ...desk.scans,
  ].slice(0, 8);
}

function setProvider(desk: DeskData, provider: string, status: string, detail: string, now: string) {
  const row = desk.providers.find((item) => item.provider === provider);
  if (!row) return;
  row.status = status;
  row.detail = detail;
  row.lastError = status === "error" ? detail : null;
  if (status === "healthy" || status === "connected") row.lastSuccessAt = now;
}

function commitWorld(draft: Memory, world: { narratives: NarrativeView[]; alerts: PipelineAlert[]; arms: AlertArmState[] }, now: string, trigger: string) {
  draft.desk.narratives = world.narratives;
  draft.pipelineAlerts = world.alerts;
  draft.arms = world.arms;
  draft.desk.alerts = toDeskAlerts(draft.desk.alerts, world.alerts);
  draft.desk.settings.lastAttemptedAt = now;
  draft.desk.settings.lastSuccessfulAt = now;
  applySchedule(draft.desk, now);
  touchWorker(draft.desk, now);
  recordScan(draft.desk, now, trigger, "succeeded", null);
}

function narrativeAt(draft: Memory, id: string) {
  const narrative = draft.desk.narratives.find((item) => item.id === id);
  if (!narrative) throw new Error("Candidate not found.");
  return narrative;
}

function replaceNarrative(draft: Memory, narrative: NarrativeView) {
  draft.desk.narratives = draft.desk.narratives.map((item) => (item.id === narrative.id ? narrative : item));
}

async function ingestLive(desk: DeskData, now: string): Promise<NormalizedItem[]> {
  const items: NormalizedItem[] = [];
  try {
    const listResponse = await fetch("https://hacker-news.firebaseio.com/v0/newstories.json");
    if (!listResponse.ok) throw new Error(`Hacker News list returned ${listResponse.status}.`);
    const ids = (await listResponse.json()) as unknown;
    if (!Array.isArray(ids)) throw new Error("Hacker News list was not an array.");
    for (const id of ids.filter((value): value is number => typeof value === "number").slice(0, 8)) {
      const response = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
      if (!response.ok) continue;
      const story = (await response.json()) as { id?: number; title?: string; url?: string; text?: string; time?: number; deleted?: boolean; dead?: boolean };
      if (!story?.title || story.deleted || story.dead) continue;
      const publishedAt = story.time ? new Date(story.time * 1000).toISOString() : null;
      const body = stripTags(story.text ?? "");
      items.push({
        provider: "hackernews",
        providerItemId: String(story.id ?? id),
        canonicalUrl: story.url || `https://news.ycombinator.com/item?id=${id}`,
        title: story.title,
        excerpt: excerpt(body || story.title),
        publisher: "Hacker News",
        language: "en",
        publishedAt,
        discoveredAt: now,
        fetchedAt: now,
        contentHash: contentHash(story.title, body || story.title),
        entities: [],
        provenance: { live: true },
        discussionUrl: `https://news.ycombinator.com/item?id=${id}`,
      });
    }
    setProvider(desk, "hackernews", "healthy", "Fetched new stories from the public Hacker News API.", now);
  } catch (error) {
    setProvider(desk, "hackernews", "error", error instanceof Error ? error.message : "Hacker News fetch failed.", now);
  }

  let feedOk = 0;
  for (const feed of desk.feeds.filter((item) => item.enabled)) {
    try {
      const response = await fetch(feed.url);
      if (!response.ok) throw new Error(`Feed returned ${response.status}.`);
      const xml = await response.text();
      const doc = new DOMParser().parseFromString(xml, "text/xml");
      if (doc.querySelector("parsererror")) throw new Error("Feed XML could not be parsed.");
      const nodes = [...doc.querySelectorAll("item, entry")].slice(0, 8);
      for (const node of nodes) {
        const title = node.querySelector("title")?.textContent?.trim() || feed.title;
        const link = node.querySelector("link")?.getAttribute("href") || node.querySelector("link")?.textContent?.trim() || feed.url;
        const raw = node.querySelector("description, summary, content")?.textContent ?? "";
        const body = stripTags(raw);
        const published = node.querySelector("pubDate, published, updated")?.textContent?.trim() ?? null;
        const publishedAt = published && !Number.isNaN(Date.parse(published)) ? new Date(published).toISOString() : null;
        items.push({
          provider: "rss",
          providerItemId: link.slice(0, 180),
          canonicalUrl: link,
          title,
          excerpt: excerpt(body || title),
          publisher: feed.title,
          language: "en",
          publishedAt,
          discoveredAt: now,
          fetchedAt: now,
          contentHash: contentHash(title, body || title),
          entities: [],
          provenance: { live: true, feed: feed.url },
        });
      }
      feed.lastSuccessAt = now;
      feed.lastError = null;
      feedOk += 1;
    } catch (error) {
      feed.lastError = error instanceof Error ? error.message : "Feed fetch failed.";
    }
  }
  setProvider(
    desk,
    "rss",
    feedOk > 0 ? "healthy" : "error",
    feedOk > 0 ? `Fetched ${feedOk} feed${feedOk === 1 ? "" : "s"} from this browser.` : "Feeds could not be fetched from this browser. A blocked feed does not fail the scan.",
    now,
  );
  return items;
}

function ensureMarketPeople(desk: DeskData) {
  desk.settings.watchedEntities = focusedWatchList(desk.settings.watchedEntities, marketPeopleNames());
}

async function pullPersonHeadlines(now: string, announce: boolean): Promise<{ incoming: number; reason?: string }> {
  if (!memory || memory.desk.settings.paused || personBusy) return { incoming: 0 };
  personBusy = true;
  try {
    const watched = memory.desk.settings.watchedEntities;
    const result = await fetchPersonStories(watched, now);
    const known = new Set(memory.desk.narratives.flatMap((narrative) => narrative.sources.map((source) => `${source.provider}:${source.providerItemId}`)));
    const fresh = result.items.filter((item) => !known.has(`${item.provider}:${item.providerItemId}`));
    const draft = structuredClone(memory);
    const reachable = result.attempted > 0 && result.failed < result.attempted;
    setProvider(
      draft.desk,
      "rss",
      reachable ? "healthy" : "error",
      reachable
        ? `Checked meme, AI, Ethereum, robotics, prediction-market, and adjacent coverage from the last 12 hours. ${result.google} Google News item${result.google === 1 ? "" : "s"} came back before the major-narrative filter.`
        : "Narrative coverage could not be reached from this browser.",
      now,
    );
    if (fresh.length === 0) {
      memory = draft;
      emit();
      return { incoming: 0, reason: "No major new token narrative. Nothing was added, and no alert was sent." };
    }
    const next = applyIncoming(
      { narratives: draft.desk.narratives, alerts: draft.pipelineAlerts, arms: draft.arms },
      fresh,
      optionsFor(draft.desk, draft.rules, now),
    );
    commitWorld(draft, next, now, "schedule");
    const history = draft.desk.settings.reportedNarratives ?? [];
    const candidates = fresh.flatMap((item) => {
      const narrative = draft.desk.narratives.find((entry) => entry.sources.some((source) => source.providerItemId === item.providerItemId));
      if (!narrative || narrative.score.narrativeScore === null) return [];
      const text = narrative.sources.map((source) => `${source.title} ${source.excerpt}`).join(" ");
      const fit = assessStory(`${narrative.title} ${text}`);
      return [{
        id: narrative.id,
        score: narrative.score.narrativeScore,
        publishedAt: narrative.latestPublishedAt,
        major: fit.major,
        narrative,
        fit,
        url: item.canonicalUrl,
      }];
    });
    const ranked = materialReports(candidates, history);
    const chosen = ranked[0];
    const chosenFull = chosen ? candidates.find((item) => item.id === chosen.id) : undefined;
    let brief: ReturnType<typeof describeTokenNarrative> | null = null;
    if (chosen && chosenFull) {
      const topName = chosenFull.narrative.topName ?? "Untitled";
      const topTicker = chosenFull.narrative.topTicker ?? "IDEA";
      brief = describeTokenNarrative({
        title: chosenFull.narrative.title,
        name: topName,
        ticker: topTicker,
        publishedAt: chosenFull.narrative.latestPublishedAt,
        fit: chosenFull.fit,
      });
      draft.desk.settings.reportedNarratives = rememberReport(history, {
        id: chosen.id,
        score: chosen.score,
        publishedAt: chosen.publishedAt,
      });
      if (announce) {
        draft.desk.alerts.unshift({
          id: `al_narrative_${chosen.id}_${now}`,
          title: `${topName} (${topTicker})`,
          body: `${brief.whyNow}\nTrigger: ${brief.trigger}\nConcept: ${brief.concept}`,
          status: "provisional",
          reason: "major_narrative",
          createdAt: now,
          readAt: null,
          eventType: "new_candidate",
          narrativeId: chosen.id,
          sourceUrl: chosenFull.url,
          deliveries: [{ channel: "browser", status: "pending", lastError: null }],
        });
        draft.desk.alerts = draft.desk.alerts.slice(0, 80);
        notifyNarrative({ ...brief, name: topName, ticker: topTicker, url: chosenFull.url });
      }
    }
    memory = draft;
    emit();
    if (!chosen || !chosenFull || !brief) {
      return {
        incoming: fresh.length,
        reason: `Added ${fresh.length} major candidate${fresh.length === 1 ? "" : "s"}. None were materially stronger or newer, so no alert was sent.`,
      };
    }
    const label = `${chosenFull.narrative.topName ?? "Untitled"} (${chosenFull.narrative.topTicker ?? "IDEA"})`;
    return {
      incoming: fresh.length,
      reason: announce
        ? `New narrative: ${label}. ${brief.whyNow} Trigger: ${brief.trigger}`
        : `Found ${label}. Manual scan keeps it on the board and does not send a desktop alert.`,
    };
  } catch {
    return { incoming: 0 };
  } finally {
    personBusy = false;
  }
}

function rememberReport(history: ReportedNarrative[], report: ReportedNarrative): ReportedNarrative[] {
  return [{ ...report, baseline: false }, ...history.filter((item) => item.id !== report.id)].slice(0, 80);
}

function ensureReportedBaseline(desk: DeskData) {
  if (Array.isArray(desk.settings.reportedNarratives)) return;
  desk.settings.reportedNarratives = desk.narratives.map((narrative) => ({
    id: narrative.id,
    score: narrative.score.narrativeScore ?? 0,
    publishedAt: narrative.latestPublishedAt,
    baseline: true,
  }));
}

function ensureCategories(desk: DeskData) {
  for (const category of ["meme", "ai", "robotics", "prediction"]) {
    if (!desk.settings.categories.includes(category)) desk.settings.categories.push(category);
  }
}

function retitle(asset: NarrativeView["assets"][number], narrative: NarrativeView, name: string, ticker: string) {
  const palette = pickPalette(narrative.stableKey);
  const svg = renderTemplateSvg(asset.kind, { motif: asset.motif, palette, name, ticker, narrativeTitle: narrative.title });
  return { ...asset, name, ticker, svg, textKey: textLayerKey({ illustrationKey: asset.illustrationKey, name, ticker }) };
}

export function primeDesk(seed: DeskData) {
  if (typeof window === "undefined" || memory) return;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Memory;
      if (parsed?.desk?.narratives && Array.isArray(parsed.pipelineAlerts)) memory = parsed;
    } catch {
      memory = null;
    }
  }
  if (!memory) {
    memory = {
      desk: structuredClone(seed),
      arms: [],
      rules: [defaultNewCandidateRule()],
      audits: [],
      pipelineAlerts: seed.alerts.map((alert) => ({
        id: alert.id,
        dedupeKey: alert.id,
        ruleId: "rule_new",
        narrativeId: alert.narrativeId ?? "",
        eventType: alert.eventType,
        status: alert.status === "held" || alert.status === "suppressed" ? alert.status : "pending",
        reason: alert.reason,
        title: alert.title,
        body: alert.body,
        channels: ["inbox"] as PipelineAlert["channels"],
        createdAt: alert.createdAt,
        sourceUrl: alert.sourceUrl,
      })),
    };
  }
  const now = new Date().toISOString();
  ensureMarketPeople(memory.desk);
  ensureReportedBaseline(memory.desk);
  ensureCategories(memory.desk);
  memory.desk.settings.autoScan = memory.desk.settings.autoScan === true;
  memory.desk.narratives = repaintTemplates(memory.desk.narratives, optionsFor(memory.desk, memory.rules, now));
  touchWorker(memory.desk, now);
  emit();
  window.addEventListener("focus", () => {
    if (document.title.startsWith("(")) document.title = "Narrative Radar";
  });
  if (timer === null) {
    timer = window.setInterval(() => {
      if (!memory || !memory.desk.settings.autoScan || memory.desk.settings.paused) return;
      const due = memory.desk.settings.nextDueAt;
      if (due && new Date(due).getTime() > Date.now()) return;
      void runPublishedAction({ action: "scan", trigger: "schedule" });
    }, 5000);
  }
}

export async function runPublishedAction(body: Record<string, unknown>): Promise<ActionResult> {
  if (!memory) throw new Error("The desk is still opening. Try Scan now again.");
  const action = String(body.action ?? "");
  const now = new Date().toISOString();
  const draft = structuredClone(memory);

  if (action === "scan") {
    const trigger = body.trigger === "schedule" ? "schedule" : "manual";
    if (draft.desk.settings.paused && trigger === "schedule") return { ok: true, skipped: true };
    draft.desk.settings.lastAttemptedAt = now;
    const incoming = draft.desk.workspace.mode === "live" ? await ingestLive(draft.desk, now) : [];
    const current = { narratives: draft.desk.narratives, alerts: draft.pipelineAlerts, arms: draft.arms };
    const opts = optionsFor(draft.desk, draft.rules, now);
    const next = incoming.length > 0 ? applyIncoming(current, incoming, opts) : refreshNarratives(current, opts);
    commitWorld(draft, next, now, trigger);
    memory = draft;
    emit();
    const people = await pullPersonHeadlines(now, trigger === "schedule");
    const rescored = incoming.length === 0 ? "Candidates were rescored from the sources already on this desk." : `${incoming.length} new item${incoming.length === 1 ? "" : "s"} came in.`;
    return { ok: true, incoming: incoming.length + people.incoming, reason: people.reason ? `Scan finished. ${people.reason}` : `Scan finished. ${rescored}` };
  }

  if (action === "watch") {
    const enabled = body.enabled === true;
    draft.desk.settings.autoScan = enabled;
    applySchedule(draft.desk, now);
    touchWorker(draft.desk, now);
    memory = draft;
    emit();
    if (!enabled) return { ok: true, reason: "Manual mode. Scan now looks for a major new token narrative." };
    const result = await runPublishedAction({ action: "scan", trigger: "schedule" });
    return { ok: true, incoming: result.incoming, reason: `Auto mode is on. ${result.reason ?? "The first check just ran."}` };
  }

  if (action === "settings") {
    if (typeof body.mode === "string") draft.desk.workspace.mode = body.mode;
    if (typeof body.chainPreference === "string") draft.desk.settings.chainPreference = body.chainPreference;
    if (typeof body.schedulePreset === "string") draft.desk.settings.schedulePreset = body.schedulePreset;
    if (typeof body.customIntervalSeconds === "number") draft.desk.settings.customIntervalSeconds = body.customIntervalSeconds;
    if (typeof body.paused === "boolean") draft.desk.settings.paused = body.paused;
    if (typeof body.timezone === "string") draft.desk.settings.timezone = body.timezone;
    if (typeof body.namingStyle === "string") draft.desk.settings.namingStyle = body.namingStyle;
    if (Array.isArray(body.excludedKeywords)) draft.desk.settings.excludedKeywords = body.excludedKeywords.filter((item): item is string => typeof item === "string");
    if (Array.isArray(body.watchedEntities)) draft.desk.settings.watchedEntities = body.watchedEntities.filter((item): item is string => typeof item === "string");
    if (typeof body.retentionDays === "number") draft.desk.settings.retentionDays = body.retentionDays;
    if (typeof body.dailyRequestLimit === "number") draft.desk.settings.dailyRequestLimit = body.dailyRequestLimit;
    if (draft.desk.settings.schedulePreset === "custom") assertCustomInterval(draft.desk.settings.customIntervalSeconds);
    applySchedule(draft.desk, now);
    memory = draft;
    emit();
    return { ok: true };
  }

  if (action === "board") {
    const narrative = narrativeAt(draft, String(body.narrativeId));
    const previous = narrative.board;
    const board = String(body.board) as NarrativeView["board"];
    narrative.board = board;
    narrative.saved = board === "shortlisted" || narrative.saved;
    if (board === "dismissed") narrative.saved = false;
    const auditId = `audit_${now}_${narrative.id}`;
    draft.audits.unshift({ id: auditId, narrativeId: narrative.id, previous });
    memory = draft;
    emit();
    return { ok: true, auditId, previous };
  }

  if (action === "undo") {
    const audit = draft.audits.find((item) => item.id === String(body.auditId));
    if (!audit) return { ok: true };
    const narrative = narrativeAt(draft, audit.narrativeId);
    narrative.board = audit.previous;
    narrative.saved = audit.previous === "shortlisted" || narrative.saved;
    if (audit.previous === "dismissed") narrative.saved = false;
    memory = draft;
    emit();
    return { ok: true };
  }

  if (action === "note") {
    const narrative = narrativeAt(draft, String(body.narrativeId));
    const text = String(body.body ?? "").slice(0, 2000);
    narrative.notes = [...narrative.notes, { id: `note_${now}`, body: text, createdAt: now }];
    memory = draft;
    emit();
    return { ok: true };
  }

  if (action === "feedback") {
    const kind = String(body.kind);
    const weights = normalizeWeights(draft.desk.settings.scoreWeights);
    const deltas: Record<string, Partial<typeof weights>> = {
      useful: { relevance: weights.relevance + 2, freshness: Math.max(0, weights.freshness - 2) },
      too_generic: { distinctiveness: weights.distinctiveness + 2, meme: Math.max(0, weights.meme - 2) },
      already_crowded: { distinctiveness: weights.distinctiveness + 3 },
      too_old: { freshness: weights.freshness + 3 },
      irrelevant: { relevance: weights.relevance + 3, meme: Math.max(0, weights.meme - 2) },
    };
    const next = normalizeWeights({ ...weights, ...deltas[kind] });
    draft.desk.settings.scoreWeights = { ...next };
    memory = draft;
    emit();
    return { ok: true, detail: `Adjusted weights from your “${kind}” signal and renormalized them to 100. This is a transparent preference tweak, not a trained model.` };
  }

  if (action === "branding") {
    const narrative = narrativeAt(draft, String(body.narrativeId));
    if (body.regenerate === true) {
      const pinned = narrative.names.filter((option) => option.pinned || option.userEdited);
      const fresh = suggestNames({
        title: narrative.title,
        entities: narrative.entities,
        style: (typeof body.style === "string" ? body.style : draft.desk.settings.namingStyle) as NarrativeView["names"][number]["style"],
        narrativeId: narrative.id,
      });
      const kept = new Set(pinned.map((option) => option.name.toLowerCase()));
      const replacements = fresh.filter((option) => !kept.has(option.name.toLowerCase()));
      narrative.names = [...pinned, ...replacements].slice(0, 5).map((option, index) => ({ ...option, rank: index + 1, isTop: index === 0 ? true : option.pinned }));
      if (!narrative.names.some((option) => option.isTop) && narrative.names[0]) narrative.names[0].isTop = true;
    }
    if (typeof body.nameId === "string") {
      narrative.names = narrative.names.map((option) => option.id === body.nameId
        ? {
            ...option,
            name: typeof body.name === "string" ? body.name : option.name,
            ticker: (typeof body.ticker === "string" ? body.ticker : option.ticker).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8),
            pinned: typeof body.pinned === "boolean" ? body.pinned : option.pinned,
            userEdited: typeof body.name === "string" || typeof body.ticker === "string" || option.userEdited,
          }
        : option);
    }
    const top = narrative.names.find((option) => option.isTop) ?? narrative.names[0];
    narrative.topName = top?.name ?? null;
    narrative.topTicker = top?.ticker ?? null;
    if (top) narrative.assets = narrative.assets.map((asset) => asset.mode === "template" ? retitle(asset, narrative, top.name, top.ticker) : asset);
    narrative.timeline.push({ at: now, kind: "brand", text: "Branding text changed. Template illustration cache was kept." });
    memory = draft;
    emit();
    return { ok: true };
  }

  if (action === "palette") {
    const narrative = narrativeAt(draft, String(body.narrativeId));
    const shift = narrative.assets.filter((asset) => asset.mode === "template").length;
    const motif = pickMotif(`${narrative.stableKey}:${shift}`);
    const palette = pickPalette(narrative.stableKey, shift);
    const top = narrative.names.find((option) => option.isTop) ?? narrative.names[0];
    const name = top?.name ?? "Untitled";
    const ticker = top?.ticker ?? "IDEA";
    const illustrationKey = illustrationCacheKey({
      narrativeId: narrative.id,
      motif,
      paletteName: palette.name,
      style: draft.desk.settings.namingStyle as "cute",
      promptVersion: `template-v3-${shift}`,
    });
    narrative.assets = narrative.assets.map((asset) => {
      if (asset.mode !== "template") return asset;
      const svg = renderTemplateSvg(asset.kind, { motif, palette, name, ticker, narrativeTitle: narrative.title });
      return { ...asset, motif, paletteName: palette.name, illustrationKey, svg, textKey: textLayerKey({ illustrationKey, name, ticker }), version: asset.version + 1 };
    });
    memory = draft;
    emit();
    return { ok: true };
  }

  if (action === "image") {
    const narrative = narrativeAt(draft, String(body.narrativeId));
    const kind = body.kind === "banner" ? "banner" : body.kind === "mascot" ? "mascot" : "logo";
    const asset = narrative.assets.find((item) => item.kind === kind && item.mode === "template");
    if (asset) asset.imageUrl = mascotImageUrl(narrative, kind);
    memory = draft;
    emit();
    return { ok: true, reason: "Flux is drawing that image. It replaces the sketch when the render finishes." };
  }

  if (action === "check-names") {
    const narrative = narrativeAt(draft, String(body.narrativeId));
    if (draft.desk.workspace.mode !== "live") {
      narrative.collisionStatus = "not_checked";
      narrative.crowding = "Not checked / provider unavailable";
      memory = draft;
      emit();
      return { ok: false, reason: "Demo mode does not call DEX Screener. Switch to live mode for a real check." };
    }
    try {
      const { classifyNameCollisions, searchDex } = await import("@radar/providers/dex");
      let current = narrative;
      for (const option of [...current.names]) {
        const tokens = await searchDex(`${option.name} ${option.ticker}`);
        const classified = classifyNameCollisions(option.name, option.ticker, tokens);
        current = applyCollision(current, option.id, classified.status, classified.matches, now);
        replaceNarrative(draft, current);
      }
      setProvider(draft.desk, "dexscreener", "healthy", "Search checks are partial indexed coverage, not a universal registry.", now);
      memory = draft;
      emit();
      return { ok: true, status: draft.desk.narratives.find((item) => item.id === narrative.id)?.collisionStatus };
    } catch (error) {
      narrative.collisionStatus = "not_checked";
      narrative.crowding = "Not checked / provider unavailable";
      setProvider(draft.desk, "dexscreener", "error", error instanceof Error ? error.message : "DEX Screener check failed.", now);
      memory = draft;
      emit();
      return { ok: false, reason: error instanceof Error ? error.message : "DEX Screener check failed." };
    }
  }

  if (action === "analyze") {
    const rawUrl = String(body.url ?? "");
    const pasted = typeof body.pastedText === "string" ? body.pastedText : "";
    let title = "Pasted source";
    let summary = pasted.slice(0, 480);
    let provenance: Record<string, unknown> = { manual: true, userPasted: true };
    if (!pasted) {
      try {
        const response = await fetch(rawUrl);
        if (!response.ok) throw new Error(`The page returned ${response.status}.`);
        const html = await response.text();
        title = html.match(/<title>([^<]{1,180})<\/title>/i)?.[1]?.trim() || rawUrl;
        summary = stripTags(html).replace(/\s+/g, " ").trim().slice(0, 480);
        provenance = { manual: true, fetched: true };
      } catch (error) {
        return { ok: false, needsPaste: true, reason: error instanceof Error ? `${error.message} Paste the text you can see and it will be labeled as pasted.` : "The URL could not be fetched. Paste the text you can see and it will be labeled as pasted." };
      }
    } else {
      title = pasted.split("\n")[0]?.slice(0, 140) || "Pasted source";
    }
    const item: NormalizedItem = {
      provider: "manual",
      providerItemId: rawUrl.slice(0, 180) || `pasted-${now}`,
      canonicalUrl: rawUrl || "about:pasted",
      title,
      excerpt: summary,
      publisher: pasted ? "Pasted text" : "Fetched page",
      language: "en",
      publishedAt: now,
      discoveredAt: now,
      fetchedAt: now,
      contentHash: contentHash(title, summary),
      entities: [],
      provenance,
    };
    const next = applyIncoming(
      { narratives: draft.desk.narratives, alerts: draft.pipelineAlerts, arms: draft.arms },
      [item],
      optionsFor(draft.desk, draft.rules, now),
    );
    commitWorld(draft, next, now, "manual");
    memory = draft;
    emit();
    return { ok: true, reason: "The page was added to the desk." };
  }

  if (action === "feed-add") {
    const url = String(body.url ?? "").trim();
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("Feed URL must be http or https.");
    } catch (error) {
      throw new Error(error instanceof Error && error.message.includes("http") ? error.message : "Enter a valid feed URL.");
    }
    draft.desk.feeds.push({
      id: `feed_${Date.now()}`,
      url,
      title: String(body.title ?? "").trim() || url,
      enabled: true,
      lastSuccessAt: null,
      lastError: null,
    });
    memory = draft;
    emit();
    return { ok: true };
  }

  if (action === "feed-remove") {
    draft.desk.feeds = draft.desk.feeds.filter((feed) => feed.id !== String(body.id));
    memory = draft;
    emit();
    return { ok: true };
  }

  if (action === "alert-read") {
    draft.desk.alerts = draft.desk.alerts.map((alert) => alert.id === String(body.alertId) ? { ...alert, readAt: now } : alert);
    memory = draft;
    emit();
    return { ok: true };
  }

  if (action === "replay") {
    if (draft.desk.workspace.mode !== "demo") return { ok: false, reason: "Replay is a demo-mode fixture." };
    const next = applyIncoming(
      { narratives: draft.desk.narratives, alerts: draft.pipelineAlerts, arms: draft.arms },
      [replayItem(now)],
      optionsFor(draft.desk, draft.rules, now),
    );
    commitWorld(draft, next, now, "manual");
    memory = draft;
    emit();
    return { ok: true, reason: "Introduced the lighthouse cat fixture." };
  }

  if (action === "retention") {
    const cutoff = Date.now() - draft.desk.settings.retentionDays * 86_400_000;
    const before = draft.desk.narratives.length;
    draft.desk.narratives = draft.desk.narratives.filter((narrative) => {
      if (narrative.saved || narrative.board === "shortlisted") return true;
      return new Date(narrative.latestMeaningfulAt).getTime() >= cutoff;
    });
    const removed = before - draft.desk.narratives.length;
    memory = draft;
    emit();
    return { ok: true, removed };
  }

  if (action === "telegram-start" || action === "telegram-check" || action === "telegram-test") {
    return { ok: false, reason: "Telegram needs a bot token on a server. This published desk keeps the token off the page, so pairing stays unavailable." };
  }

  throw new Error("Unknown action.");
}

export function downloadNarrativePack(narrative: NarrativeView) {
  const assets = narrative.assets
    .filter((asset) => asset.mode === "template" && asset.svg)
    .map((asset) => ({ path: `${asset.kind}-${asset.mode}.svg`, bytes: new TextEncoder().encode(asset.svg ?? ""), label: asset.kind }));
  const pack = buildResearchPack(narrative, assets);
  const blob = new Blob([pack["summary.md"]], { type: "text/markdown" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `narrative-${narrative.id}.md`;
  link.click();
  URL.revokeObjectURL(link.href);
}
