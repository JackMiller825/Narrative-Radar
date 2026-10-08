import { Prisma } from "@prisma/client";
import {
  DEFAULT_WEIGHTS,
  applyCollision,
  applyIncoming,
  assertCustomInterval,
  defaultNewCandidateRule,
  demoItems,
  describeChange,
  emptyWorld,
  illustrationCacheKey,
  intervalSeconds,
  marketPeopleNames,
  nextDue,
  normalizeWeights,
  pickMotif,
  pickPalette,
  refreshNarratives,
  renderTemplateSvg,
  replayItem,
  suggestNames,
  textLayerKey,
  workPreview,
  type AlertRuleInput,
  type NarrativeView,
  type PipelineOptions,
  type PipelineWorld,
  type SchedulePreset,
  type ScoreWeights,
} from "@radar/core";
import {
  CURATED_FEEDS,
  classifyNameCollisions,
  fetchHackerNews,
  fetchRss,
  fetchXRecent,
  formatAlertHtml,
  generateImage,
  searchDex,
  sendTelegramMessage,
  telegramCall,
} from "@radar/providers";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./client";

const PROVIDERS = ["rss", "hackernews", "dexscreener", "x", "openai_text", "openai_image", "telegram"] as const;

export async function ensureWorkspace() {
  const email = (process.env.OWNER_EMAIL || "owner@narrativeradar.local").toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  const user = existing ?? await prisma.user.create({
    data: {
      email,
      name: "Owner",
      passwordHash: "disabled",
      timezone: process.env.OWNER_TIMEZONE || "UTC",
    },
  });
  let workspace = await prisma.workspace.findFirst({ where: { ownerId: user.id } });
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        ownerId: user.id,
        name: "Narrative desk",
        mode: process.env.APP_MODE === "live" ? "live" : "demo",
      },
    });
    await prisma.workspaceSettings.create({ data: settingsCreate(workspace.id) });
    await prisma.alertRule.create({ data: ruleCreate(workspace.id, defaultNewCandidateRule()) });
    await prisma.feedSubscription.createMany({
      data: CURATED_FEEDS.map((feed) => ({ workspaceId: workspace!.id, url: feed.url, title: feed.title })),
    });
    await prisma.providerConnection.createMany({
      data: PROVIDERS.map((provider) => ({
        workspaceId: workspace!.id,
        provider,
        status: initialProviderStatus(provider),
        detail: providerDetail(provider),
      })),
    });
    await prisma.watchRule.create({ data: { workspaceId: workspace.id, entity: "Lisbon robot" } });
    const world = applyIncoming(emptyWorld(), demoItems(), await optionsFor(workspace.id, await mustSettings(workspace.id)));
    await persistWorld(workspace.id, emptyWorld(), world);
  }
  return { user, workspace };
}

export async function workspaceForUser(userId: string) {
  const workspace = await prisma.workspace.findFirst({ where: { ownerId: userId } });
  if (!workspace) throw new Error("Workspace missing.");
  return workspace;
}

export async function loadDesk(userId: string) {
  const workspace = await workspaceForUser(userId);
  const [settings, narratives, alerts, providers, feeds, rules, heartbeat, scans, usage, telegram, watches] = await Promise.all([
    mustSettings(workspace.id),
    prisma.narrative.findMany({ where: { workspaceId: workspace.id, mergedIntoId: null }, orderBy: { latestMeaningfulAt: "desc" } }),
    prisma.alertEvent.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" }, take: 80, include: { deliveries: true } }),
    prisma.providerConnection.findMany({ where: { workspaceId: workspace.id }, orderBy: { provider: "asc" } }),
    prisma.feedSubscription.findMany({ where: { workspaceId: workspace.id }, orderBy: { title: "asc" } }),
    prisma.alertRule.findMany({ where: { workspaceId: workspace.id } }),
    prisma.workerHeartbeat.findUnique({ where: { id: "primary" } }),
    prisma.scanRun.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.usageLedger.findMany({ where: { workspaceId: workspace.id, createdAt: { gte: startOfUtcDay() } } }),
    prisma.telegramLink.findUnique({ where: { workspaceId: workspace.id } }),
    prisma.watchRule.findMany({ where: { workspaceId: workspace.id } }),
  ]);
  const views = narratives.map((row) => overlay(row.payload, row));
  const workerOnline = heartbeat ? Date.now() - heartbeat.beatAt.getTime() < 20_000 : false;
  const preset = settings.schedulePreset as SchedulePreset;
  const seconds = intervalSeconds(preset, settings.customIntervalSeconds);
  return {
    workspace: { id: workspace.id, name: workspace.name, mode: workspace.mode },
    settings: {
      ...settings,
      categories: asStringArray(settings.categories),
      languages: asStringArray(settings.languages),
      regions: asStringArray(settings.regions),
      excludedKeywords: asStringArray(settings.excludedKeywords),
      watchedEntities: watches.map((watch) => watch.entity),
      excludedSources: asStringArray(settings.excludedSources),
      scoreWeights: normalizeWeights(settings.scoreWeights as Partial<ScoreWeights>),
      priceAssumptions: settings.priceAssumptions,
    },
    narratives: views,
    alerts,
    providers,
    feeds,
    rules,
    scans,
    worker: { online: workerOnline, beatAt: heartbeat?.beatAt ?? null, note: heartbeat?.note ?? "No heartbeat yet." },
    schedule: { seconds, preview: workPreview(seconds) },
    usage: summarizeUsage(usage),
    telegram: {
      configured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      paired: Boolean(telegram?.chatId),
      username: telegram?.username ?? null,
      pairingCode: telegram?.pairingCode && telegram.pairingExpiresAt && telegram.pairingExpiresAt > new Date() ? telegram.pairingCode : null,
    },
  };
}

export async function runScan(workspaceId: string, trigger: "schedule" | "manual") {
  const token = await tryLock(workspaceId, trigger);
  if (!token) return { ok: false as const, reason: "A scan is already running for this desk." };
  const settings = await mustSettings(workspaceId);
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  await prisma.workspaceSettings.update({ where: { workspaceId }, data: { lastAttemptedAt: new Date() } });
  const run = await prisma.scanRun.create({
    data: { workspaceId, scheduleVersion: settings.scheduleVersion, status: "running", trigger, startedAt: new Date() },
  });
  try {
    if (settings.paused && trigger === "schedule") {
      await finishRun(run.id, "coalesced", "Schedule is paused.");
      return { ok: true as const, skipped: true };
    }
    const requests = await countTodayRequests(workspaceId);
    if (settings.pauseOnBudget && requests >= settings.dailyRequestLimit) {
      await finishRun(run.id, "failed", "Daily request budget is paused.");
      await setProvider(workspaceId, "rss", "error", "Paused because the daily request budget was reached.");
      return { ok: false as const, reason: "Daily request budget is paused." };
    }
    const incoming = workspace.mode === "live" ? await ingestLive(workspaceId, settings.dailyRequestLimit - requests) : [];
    const current = await loadWorld(workspaceId);
    const options = await optionsFor(workspaceId, settings);
    const next = incoming.length > 0 ? applyIncoming(current, incoming, options) : refreshNarratives(current, options);
    await persistWorld(workspaceId, current, next);
    const due = nextDue(new Date(), intervalSeconds(settings.schedulePreset as SchedulePreset, settings.customIntervalSeconds));
    await prisma.workspaceSettings.update({ where: { workspaceId }, data: { lastSuccessfulAt: new Date(), nextDueAt: due } });
    await finishRun(run.id, "succeeded", null, { incoming: incoming.length, narratives: next.narratives.length });
    await emit(workspaceId, "scan", { at: new Date().toISOString(), trigger, incoming: incoming.length });
    return { ok: true as const, incoming: incoming.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed.";
    await finishRun(run.id, "failed", message);
    const due = nextDue(new Date(), intervalSeconds(settings.schedulePreset as SchedulePreset, settings.customIntervalSeconds));
    await prisma.workspaceSettings.update({ where: { workspaceId }, data: { nextDueAt: due } });
    return { ok: false as const, reason: message };
  } finally {
    await releaseLock(workspaceId, token);
  }
}

export async function saveSettings(workspaceId: string, input: {
  mode?: "demo" | "live";
  chainPreference?: string;
  schedulePreset?: SchedulePreset;
  customIntervalSeconds?: number;
  paused?: boolean;
  timezone?: string;
  namingStyle?: string;
  freshnessHours?: number;
  excludedKeywords?: string[];
  watchedEntities?: string[];
  categories?: string[];
  languages?: string[];
  scoreWeights?: Partial<ScoreWeights>;
  dailyRequestLimit?: number;
  textBudgetUsd?: number | null;
  imageBudgetUsd?: number | null;
  imageQueueCap?: number;
  pauseOnBudget?: boolean;
  retentionDays?: number;
  alertSound?: boolean;
  browserNotifications?: boolean;
}) {
  const current = await mustSettings(workspaceId);
  const preset = (input.schedulePreset ?? current.schedulePreset) as SchedulePreset;
  const custom = input.customIntervalSeconds ?? current.customIntervalSeconds;
  if (preset === "custom") assertCustomInterval(custom);
  const scheduleChanged = preset !== current.schedulePreset || custom !== current.customIntervalSeconds;
  const version = scheduleChanged ? current.scheduleVersion + 1 : current.scheduleVersion;
  if (scheduleChanged) {
    await prisma.scheduleJob.updateMany({
      where: { workspaceId, status: "pending", scheduleVersion: { not: version } },
      data: { status: "cancelled" },
    });
  }
  const weights = normalizeWeights(input.scoreWeights ?? (current.scoreWeights as Partial<ScoreWeights>));
  await prisma.workspaceSettings.update({
    where: { workspaceId },
    data: {
      chainPreference: input.chainPreference ?? current.chainPreference,
      schedulePreset: preset,
      customIntervalSeconds: custom,
      scheduleVersion: version,
      paused: input.paused ?? current.paused,
      timezone: input.timezone ?? current.timezone,
      namingStyle: input.namingStyle ?? current.namingStyle,
      freshnessHours: input.freshnessHours ?? current.freshnessHours,
      excludedKeywords: input.excludedKeywords ?? asStringArray(current.excludedKeywords),
      categories: input.categories ?? asStringArray(current.categories),
      languages: input.languages ?? asStringArray(current.languages),
      scoreWeights: json(weights),
      dailyRequestLimit: input.dailyRequestLimit ?? current.dailyRequestLimit,
      textBudgetUsd: input.textBudgetUsd === undefined ? current.textBudgetUsd : input.textBudgetUsd,
      imageBudgetUsd: input.imageBudgetUsd === undefined ? current.imageBudgetUsd : input.imageBudgetUsd,
      imageQueueCap: input.imageQueueCap ?? current.imageQueueCap,
      pauseOnBudget: input.pauseOnBudget ?? current.pauseOnBudget,
      retentionDays: input.retentionDays ?? current.retentionDays,
      alertSound: input.alertSound ?? current.alertSound,
      browserNotifications: input.browserNotifications ?? current.browserNotifications,
      nextDueAt: scheduleChanged ? new Date() : current.nextDueAt,
    },
  });
  if (input.mode) await prisma.workspace.update({ where: { id: workspaceId }, data: { mode: input.mode } });
  if (input.watchedEntities) {
    await prisma.watchRule.deleteMany({ where: { workspaceId } });
    if (input.watchedEntities.length > 0) {
      await prisma.watchRule.createMany({ data: input.watchedEntities.map((entity) => ({ workspaceId, entity })) });
    }
  }
  if (input.paused === false && current.paused) {
    await prisma.workspaceSettings.update({ where: { workspaceId }, data: { nextDueAt: new Date() } });
  }
}

export async function setBoard(workspaceId: string, narrativeId: string, board: NarrativeView["board"], actorId?: string) {
  const row = await ownedNarrative(workspaceId, narrativeId);
  const view = overlay(row.payload, row);
  const previous = view.board;
  view.board = board;
  view.saved = board === "shortlisted" || view.saved;
  if (board === "dismissed") view.saved = false;
  await prisma.narrative.update({
    where: { id: narrativeId },
    data: { board, saved: view.saved, payload: json(view) },
  });
  if (view.saved) {
    await prisma.savedCandidate.upsert({
      where: { workspaceId_narrativeId: { workspaceId, narrativeId } },
      update: {},
      create: { workspaceId, narrativeId },
    });
  } else {
    await prisma.savedCandidate.deleteMany({ where: { workspaceId, narrativeId } });
  }
  const audit = await prisma.auditLog.create({
    data: { workspaceId, actorId, action: "board", entityType: "narrative", entityId: narrativeId, detail: { previous, board } },
  });
  return { auditId: audit.id, previous };
}

export async function undoBoard(workspaceId: string, auditId: string) {
  const audit = await prisma.auditLog.findFirst({ where: { id: auditId, workspaceId, action: "board" } });
  if (!audit) return;
  const detail = audit.detail as { previous?: NarrativeView["board"] };
  if (!detail.previous) return;
  await setBoard(workspaceId, audit.entityId, detail.previous);
}

export async function addNote(workspaceId: string, narrativeId: string, body: string) {
  const note = await prisma.candidateNote.create({ data: { workspaceId, narrativeId, body: body.slice(0, 2000) } });
  const row = await ownedNarrative(workspaceId, narrativeId);
  const view = overlay(row.payload, row);
  view.notes = [...view.notes, { id: note.id, body: note.body, createdAt: note.createdAt.toISOString() }];
  await prisma.narrative.update({ where: { id: narrativeId }, data: { payload: json(view) } });
}

export async function markSeen(workspaceId: string, narrativeId: string) {
  const row = await ownedNarrative(workspaceId, narrativeId);
  const view = overlay(row.payload, row);
  const previous = row.lastSeenAt ? structuredClone(view) : null;
  await prisma.narrative.update({ where: { id: narrativeId }, data: { lastSeenAt: new Date() } });
  return describeChange(previous, view);
}

export async function recordFeedback(workspaceId: string, narrativeId: string, kind: string) {
  const settings = await mustSettings(workspaceId);
  const weights = normalizeWeights(settings.scoreWeights as Partial<ScoreWeights>);
  const deltas: Record<string, Partial<ScoreWeights>> = {
    useful: { relevance: weights.relevance + 2, freshness: Math.max(0, weights.freshness - 2) },
    too_generic: { distinctiveness: weights.distinctiveness + 2, meme: Math.max(0, weights.meme - 2) },
    already_crowded: { distinctiveness: weights.distinctiveness + 3 },
    too_old: { freshness: weights.freshness + 3 },
    irrelevant: { relevance: weights.relevance + 3, meme: Math.max(0, weights.meme - 2) },
  };
  const next = normalizeWeights({ ...weights, ...deltas[kind] });
  await prisma.workspaceSettings.update({ where: { workspaceId }, data: { scoreWeights: json(next) } });
  const detail = `Adjusted weights from your “${kind}” signal and renormalized them to 100. This is a transparent preference tweak, not a trained model.`;
  await prisma.feedback.create({ data: { workspaceId, narrativeId, kind, detail } });
  return { weights: next, detail };
}

export async function updateBranding(workspaceId: string, narrativeId: string, patch: { nameId?: string; name?: string; ticker?: string; pinned?: boolean; regenerate?: boolean; style?: NarrativeView["names"][number]["style"] }) {
  const row = await ownedNarrative(workspaceId, narrativeId);
  const view = overlay(row.payload, row);
  const settings = await mustSettings(workspaceId);
  if (patch.regenerate) {
    const pinned = view.names.filter((option) => option.pinned || option.userEdited);
    const fresh = suggestNames({ title: view.title, entities: view.entities, style: patch.style ?? (settings.namingStyle as NarrativeView["names"][number]["style"]), narrativeId });
    const kept = new Set(pinned.map((option) => option.name.toLowerCase()));
    const replacements = fresh.filter((option) => !kept.has(option.name.toLowerCase()));
    view.names = [...pinned, ...replacements].slice(0, 5).map((option, index) => ({ ...option, rank: index + 1, isTop: index === 0 ? true : option.pinned }));
    if (!view.names.some((option) => option.isTop) && view.names[0]) view.names[0].isTop = true;
  }
  if (patch.nameId) {
    view.names = view.names.map((option) => option.id === patch.nameId
      ? {
          ...option,
          name: patch.name ?? option.name,
          ticker: (patch.ticker ?? option.ticker).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8),
          pinned: patch.pinned ?? option.pinned,
          userEdited: patch.name !== undefined || patch.ticker !== undefined || option.userEdited,
        }
      : option);
  }
  const top = view.names.find((option) => option.isTop) ?? view.names[0];
  view.topName = top?.name ?? null;
  view.topTicker = top?.ticker ?? null;
  view.assets = view.assets.map((asset) => asset.mode === "template" && top ? retitle(asset, view, top.name, top.ticker) : asset);
  view.timeline.push({ at: new Date().toISOString(), kind: "brand", text: "Branding text changed. Template illustration cache was kept." });
  await saveView(row, view);
}

export async function cyclePalette(workspaceId: string, narrativeId: string) {
  const row = await ownedNarrative(workspaceId, narrativeId);
  const view = overlay(row.payload, row);
  const settings = await mustSettings(workspaceId);
  const shift = view.assets.filter((asset) => asset.mode === "template").length;
  const motif = pickMotif(`${view.stableKey}:${shift}`);
  const palette = pickPalette(view.stableKey, shift);
  const top = view.names.find((option) => option.isTop) ?? view.names[0];
  const name = top?.name ?? "Untitled";
  const ticker = top?.ticker ?? "IDEA";
  const illustrationKey = illustrationCacheKey({
    narrativeId,
    motif,
    paletteName: palette.name,
    style: settings.namingStyle as "cute",
    promptVersion: `template-v3-${shift}`,
  });
  view.assets = view.assets.map((asset) => {
    if (asset.mode !== "template") return asset;
    const svg = renderTemplateSvg(asset.kind, { motif, palette, name, ticker, narrativeTitle: view.title });
    return { ...asset, motif, paletteName: palette.name, illustrationKey, svg, textKey: textLayerKey({ illustrationKey, name, ticker }), version: asset.version + 1 };
  });
  await saveView(row, view);
}

export async function queueImage(workspaceId: string, narrativeId: string, kind: "logo" | "banner") {
  const row = await ownedNarrative(workspaceId, narrativeId);
  const view = overlay(row.payload, row);
  const settings = await mustSettings(workspaceId);
  const queued = view.assets.filter((asset) => asset.mode === "ai" && (asset.status === "queued" || asset.status === "generating")).length;
  if (queued >= settings.imageQueueCap) return { ok: false as const, reason: "Image queue cap reached." };
  const id = `ai_${narrativeId}_${kind}_${Date.now()}`;
  const motif = pickMotif(view.stableKey);
  const palette = pickPalette(view.stableKey);
  const top = view.names.find((option) => option.isTop);
  view.assets.push({
    id,
    kind,
    mode: "ai",
    status: process.env.OPENAI_API_KEY && process.env.OPENAI_IMAGE_MODEL && process.env.OPENAI_IMAGE_SIZE ? "generating" : "failed",
    style: settings.namingStyle as "cute",
    motif,
    paletteName: palette.name,
    illustrationKey: `ai-${id}`,
    textKey: `ai-text-${id}`,
    name: top?.name ?? "",
    ticker: top?.ticker ?? "",
    svg: null,
    error: process.env.OPENAI_API_KEY ? null : "OpenAI image generation is not configured. The template preview is still available.",
    favorite: false,
    version: 1,
    prompt: `Original ${kind} illustration of a ${motif} character for “${top?.name ?? view.title}”. No text in the image.`,
    createdAt: new Date().toISOString(),
  });
  await saveView(row, view);
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_IMAGE_MODEL || !process.env.OPENAI_IMAGE_SIZE) {
    return { ok: false as const, reason: "Image generation is not configured." };
  }
  const reserved = settings.imageBudgetUsd ?? 0;
  if (reserved > 0 && !(await reserveUsd(workspaceId, "openai_image", reserved))) {
    await markAsset(view, id, { status: "failed", error: "Image budget reservation was refused." });
    await saveView(row, view);
    return { ok: false as const, reason: "Image budget reservation was refused." };
  }
  try {
    const image = await generateImage({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_IMAGE_MODEL,
      size: process.env.OPENAI_IMAGE_SIZE,
      prompt: view.assets.find((asset) => asset.id === id)?.prompt ?? view.title,
    });
    const dir = path.join(/* turbopackIgnore: true */ process.env.DATA_DIR || path.join(process.cwd(), "data"), workspaceId, narrativeId);
    await mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${id}.png`);
    await writeFile(filePath, Buffer.from(image.b64, "base64"));
    await markAsset(view, id, { status: "ready", error: null });
    await prisma.asset.update({ where: { id }, data: { status: "ready", filePath, error: null } }).catch(() => undefined);
    await saveView(row, view);
    if (reserved > 0) await settleUsd(workspaceId, "openai_image", reserved, reserved);
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image generation failed.";
    await markAsset(view, id, { status: "failed", error: message });
    await saveView(row, view);
    if (reserved > 0) await settleUsd(workspaceId, "openai_image", reserved, 0);
    return { ok: false as const, reason: message };
  }
}

export async function checkNames(workspaceId: string, narrativeId: string) {
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  const row = await ownedNarrative(workspaceId, narrativeId);
  const view = overlay(row.payload, row);
  if (workspace.mode !== "live") {
    view.collisionStatus = "not_checked";
    view.crowding = "Not checked / provider unavailable";
    await saveView(row, view);
    return { ok: false as const, reason: "Demo mode does not call DEX Screener. Switch to live mode for a real check." };
  }
  try {
    for (const option of view.names) {
      const tokens = await searchDex(`${option.name} ${option.ticker}`);
      const classified = classifyNameCollisions(option.name, option.ticker, tokens);
      const next = applyCollision(view, option.id, classified.status, classified.matches, new Date().toISOString());
      Object.assign(view, next);
      await prisma.collisionCheck.create({
        data: { narrativeId, query: `${option.name} ${option.ticker}`, status: classified.status, matches: json(classified.matches), checkedAt: new Date() },
      });
    }
    await setProvider(workspaceId, "dexscreener", "healthy", "Search checks are partial indexed coverage, not a universal registry.");
    await saveView(row, view);
    return { ok: true as const, status: view.collisionStatus };
  } catch (error) {
    view.collisionStatus = "not_checked";
    view.crowding = "Not checked / provider unavailable";
    await saveView(row, view);
    await setProvider(workspaceId, "dexscreener", "error", error instanceof Error ? error.message : "DEX search failed.");
    return { ok: false as const, reason: "Name search failed. Results stay “not checked” and are not described as unique." };
  }
}

export async function analyzeUrl(workspaceId: string, rawUrl: string, pastedText?: string) {
  const settings = await mustSettings(workspaceId);
  const now = new Date().toISOString();
  let title = "Pasted source";
  let excerpt = pastedText?.slice(0, 480) ?? "";
  let provenance: Record<string, unknown> = { manual: true };
  if (!pastedText) {
    try {
      const { safeFetch } = await import("@radar/providers");
      const response = await safeFetch(rawUrl, { accept: ["html", "text", "xml", "json"], maxBytes: 400_000 });
      const html = response.body.toString("utf8");
      title = html.match(/<title>([^<]{1,180})<\/title>/i)?.[1]?.trim() || rawUrl;
      excerpt = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 480);
      provenance = { manual: true, fetched: true };
    } catch (error) {
      return { ok: false as const, needsPaste: true, reason: error instanceof Error ? error.message : "The URL could not be fetched. Paste the text you can see and it will be labeled as pasted." };
    }
  } else {
    provenance = { manual: true, userPasted: true };
    title = pastedText.split("\n")[0]?.slice(0, 140) || "Pasted source";
  }
  const current = await loadWorld(workspaceId);
  const next = applyIncoming(current, [{
    provider: "manual",
    providerItemId: rawUrl.slice(0, 180),
    canonicalUrl: rawUrl,
    title,
    excerpt,
    publisher: pastedText ? "Pasted by owner" : "Fetched URL",
    language: null,
    publishedAt: null,
    discoveredAt: now,
    fetchedAt: now,
    contentHash: `${rawUrl}:${excerpt.slice(0, 40)}`,
    entities: [],
    provenance,
  }], await optionsFor(workspaceId, settings));
  await persistWorld(workspaceId, current, next);
  return { ok: true as const };
}

export async function addFeed(workspaceId: string, url: string, title: string) {
  await prisma.feedSubscription.create({ data: { workspaceId, url, title: title || url } });
}

export async function removeFeed(workspaceId: string, id: string) {
  await prisma.feedSubscription.deleteMany({ where: { id, workspaceId } });
}

export async function saveRule(workspaceId: string, input: AlertRuleInput & { id?: string }) {
  const data = ruleCreate(workspaceId, input);
  if (input.id) {
    const existing = await prisma.alertRule.findFirst({ where: { id: input.id, workspaceId } });
    if (existing) {
      await prisma.alertRule.update({ where: { id: existing.id }, data });
      return;
    }
  }
  await prisma.alertRule.create({ data });
}

export async function markAlertRead(workspaceId: string, alertId: string) {
  await prisma.alertEvent.updateMany({ where: { id: alertId, workspaceId }, data: { readAt: new Date() } });
}

export async function startTelegramPairing(workspaceId: string) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return { ok: false as const, reason: "Set TELEGRAM_BOT_TOKEN on the server. The token never goes to the browser." };
  const code = randomBytes(3).toString("hex");
  await prisma.telegramLink.upsert({
    where: { workspaceId },
    update: { pairingCode: code, pairingExpiresAt: new Date(Date.now() + 10 * 60_000) },
    create: { workspaceId, pairingCode: code, pairingExpiresAt: new Date(Date.now() + 10 * 60_000) },
  });
  return { ok: true as const, code, instructions: `Send /start ${code} to your bot within 10 minutes, then press Check pairing.` };
}

export async function completeTelegramPairing(workspaceId: string) {
  const link = await prisma.telegramLink.findUnique({ where: { workspaceId } });
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !link?.pairingCode) return { ok: false as const, reason: "Start pairing first." };
  const updates = await telegramCall(token, "getUpdates", { timeout: 0 }) as { message?: { text?: string; chat?: { id: number; username?: string } } }[];
  const match = updates.find((update) => update.message?.text?.includes(link.pairingCode!));
  if (!match?.message?.chat) return { ok: false as const, reason: "No matching /start message yet." };
  await prisma.telegramLink.update({
    where: { workspaceId },
    data: { chatId: String(match.message.chat.id), username: match.message.chat.username ?? null, pairedAt: new Date(), pairingCode: null, pairingExpiresAt: null },
  });
  await setProvider(workspaceId, "telegram", "connected", "Paired with your bot chat.");
  return { ok: true as const };
}

export async function sendTestAlert(workspaceId: string) {
  const link = await prisma.telegramLink.findUnique({ where: { workspaceId } });
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !link?.chatId) return { ok: false as const, reason: "Telegram is not paired." };
  await sendTelegramMessage(token, link.chatId, formatAlertHtml({ title: "Narrative Radar test", body: "This is a test alert for your paired chat.", link: null }));
  return { ok: true as const };
}

export async function replayDemo(workspaceId: string) {
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  if (workspace.mode !== "demo") return { ok: false as const, reason: "Replay is a demo-mode fixture." };
  const settings = await mustSettings(workspaceId);
  const current = await loadWorld(workspaceId);
  const next = applyIncoming(current, [replayItem(new Date().toISOString())], await optionsFor(workspaceId, settings));
  await persistWorld(workspaceId, current, next);
  await emit(workspaceId, "candidate", { title: "A lighthouse cat starts answering ship radios" });
  return { ok: true as const };
}

export async function applyRetention(workspaceId: string) {
  const settings = await mustSettings(workspaceId);
  const cutoff = new Date(Date.now() - settings.retentionDays * 86_400_000);
  const savedIds = new Set((await prisma.savedCandidate.findMany({ where: { workspaceId } })).map((row) => row.narrativeId));
  const old = await prisma.narrative.findMany({ where: { workspaceId, saved: false, latestMeaningfulAt: { lt: cutoff }, board: { not: "shortlisted" } } });
  const victims = old.filter((row) => !savedIds.has(row.id)).map((row) => row.id);
  if (victims.length > 0) await prisma.narrative.deleteMany({ where: { id: { in: victims } } });
  return { removed: victims.length };
}

export async function eventsAfter(workspaceId: string, after: number) {
  const events = await prisma.dashboardEvent.findMany({
    where: { workspaceId, seq: { gt: after } },
    orderBy: { seq: "asc" },
    take: 50,
  });
  const oldest = await prisma.dashboardEvent.findFirst({ where: { workspaceId }, orderBy: { seq: "asc" } });
  return { events, oldest: oldest?.seq ?? 0 };
}

export async function beat(note: string) {
  await prisma.workerHeartbeat.upsert({
    where: { id: "primary" },
    update: { beatAt: new Date(), note },
    create: { id: "primary", beatAt: new Date(), note },
  });
}

export async function dueWorkspaceIds() {
  const rows = await prisma.workspaceSettings.findMany({
    where: { paused: false, scheduleEnabled: true, OR: [{ nextDueAt: null }, { nextDueAt: { lte: new Date() } }] },
  });
  return rows.map((row) => row.workspaceId);
}

export async function buildExport(workspaceId: string, narrativeId: string) {
  const { buildResearchPack } = await import("@radar/core");
  const JSZip = (await import("jszip")).default;
  const row = await ownedNarrative(workspaceId, narrativeId);
  const view = overlay(row.payload, row);
  const assets = view.assets.filter((asset) => asset.mode === "template" && asset.svg).map((asset) => ({
    path: `${asset.kind}-${asset.mode}.svg`,
    bytes: Buffer.from(asset.svg!),
    label: asset.kind,
  }));
  const pack = buildResearchPack(view, assets.map((asset) => ({ path: asset.path, bytes: new Uint8Array(asset.bytes), label: asset.label })));
  const zip = new JSZip();
  zip.file("summary.md", pack["summary.md"]);
  zip.file("sources.json", pack["sources.json"]);
  zip.file("naming-options.csv", pack["naming-options.csv"]);
  zip.file("score-breakdown.json", pack["score-breakdown.json"]);
  zip.file("generation.json", pack["generation.json"]);
  for (const asset of assets) zip.file(asset.path, asset.bytes);
  try {
    const sharp = (await import("sharp")).default;
    for (const asset of view.assets) {
      if (!asset.svg) continue;
      const width = asset.kind === "banner" ? 1500 : 1024;
      const height = asset.kind === "banner" ? 500 : 1024;
      const png = await sharp(Buffer.from(asset.svg)).resize(width, height).png().toBuffer();
      zip.file(`${asset.kind}-${asset.mode}.png`, png);
    }
  } catch {
    zip.file("assets-readme.txt", "PNG conversion was unavailable in this environment. SVG template files are included. No placeholder PNG was invented.");
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

async function ingestLive(workspaceId: string, budget: number) {
  const feeds = await prisma.feedSubscription.findMany({ where: { workspaceId, enabled: true } });
  const items = [];
  let requests = 0;
  for (const feed of feeds) {
    if (requests >= budget) break;
    try {
      const result = await fetchRss(feed.url, { etag: feed.etag, lastModified: feed.lastModified });
      requests += 1;
      await prisma.usageLedger.create({ data: { workspaceId, provider: "rss", kind: "request", units: 1, measured: true, estimatedUsd: 0 } });
      await prisma.feedSubscription.update({
        where: { id: feed.id },
        data: { etag: result.etag, lastModified: result.lastModified, lastSuccessAt: new Date(), lastError: null },
      });
      items.push(...result.items);
    } catch (error) {
      await prisma.feedSubscription.update({
        where: { id: feed.id },
        data: { lastError: error instanceof Error ? error.message : "Feed failed." },
      });
    }
  }
  await setProvider(workspaceId, "rss", items.length >= 0 ? "healthy" : "error", `${feeds.length} configured feeds. One broken feed does not stop the others.`);
  if (requests < budget) {
    try {
      const cursorRow = await prisma.providerCursor.findUnique({ where: { workspaceId_provider: { workspaceId, provider: "hackernews" } } });
      const hn = await fetchHackerNews({ cursor: cursorRow ? Number(cursorRow.cursor) : 0, limit: 12 });
      requests += hn.requests;
      await prisma.usageLedger.create({ data: { workspaceId, provider: "hackernews", kind: "request", units: hn.requests, measured: true, estimatedUsd: 0 } });
      await prisma.providerCursor.upsert({
        where: { workspaceId_provider: { workspaceId, provider: "hackernews" } },
        update: { cursor: String(hn.cursor) },
        create: { workspaceId, provider: "hackernews", cursor: String(hn.cursor) },
      });
      items.push(...hn.items);
      await setProvider(workspaceId, "hackernews", "healthy", "Official Firebase API. No documented rate limit. Item text is separate from the linked article.");
    } catch (error) {
      await setProvider(workspaceId, "hackernews", "error", error instanceof Error ? error.message : "Hacker News failed.");
    }
  }
  if (process.env.X_BEARER_TOKEN) {
    try {
      const x = await fetchXRecent({ bearerToken: process.env.X_BEARER_TOKEN, query: process.env.X_SEARCH_QUERY || "ethereum lang:en" });
      items.push(...x.items);
      await setProvider(workspaceId, "x", "connected", "Recent search returned. Coverage is limited to your X API access.");
    } catch (error) {
      await setProvider(workspaceId, "x", "error", error instanceof Error ? error.message : "X request failed.");
    }
  } else {
    await setProvider(workspaceId, "x", "unconfigured", "Not connected. No bearer token is configured, so no posts are invented.");
  }
  await setProvider(workspaceId, "openai_text", process.env.OPENAI_API_KEY && process.env.OPENAI_TEXT_MODEL ? "connected" : "unconfigured", process.env.OPENAI_TEXT_MODEL ? "Model id is set by OPENAI_TEXT_MODEL." : "Set OPENAI_API_KEY and OPENAI_TEXT_MODEL. Heuristic notes are used until then.");
  await setProvider(workspaceId, "openai_image", process.env.OPENAI_API_KEY && process.env.OPENAI_IMAGE_MODEL ? "connected" : "unconfigured", "Template previews do not need this provider.");
  await setProvider(workspaceId, "telegram", process.env.TELEGRAM_BOT_TOKEN ? "connected" : "unconfigured", process.env.TELEGRAM_BOT_TOKEN ? "Bot token is set on the server." : "Not connected.");
  await setProvider(workspaceId, "dexscreener", "healthy", "Used when you run a name check. Partial indexed coverage.");
  return items;
}

async function loadWorld(workspaceId: string): Promise<PipelineWorld> {
  const [rows, alerts, arms] = await Promise.all([
    prisma.narrative.findMany({ where: { workspaceId } }),
    prisma.alertEvent.findMany({ where: { workspaceId } }),
    prisma.alertArm.findMany({ where: { workspaceId } }),
  ]);
  return {
    narratives: rows.map((row) => overlay(row.payload, row)),
    alerts: alerts.map((alert) => ({
      id: alert.id,
      dedupeKey: alert.dedupeKey,
      ruleId: alert.ruleId ?? "",
      narrativeId: alert.narrativeId ?? "",
      eventType: alert.eventType,
      status: alert.status as "pending",
      reason: alert.reason,
      title: alert.title,
      body: alert.body,
      channels: [],
      createdAt: alert.createdAt.toISOString(),
      sourceUrl: alert.sourceUrl,
    })),
    arms: arms.map((arm) => ({ narrativeId: arm.narrativeId, ruleId: arm.ruleId, armed: arm.armed, lastFiredAt: arm.lastFiredAt?.toISOString() ?? null })),
  };
}

async function persistWorld(workspaceId: string, previous: PipelineWorld, next: PipelineWorld) {
  for (const narrative of next.narratives) {
    const before = previous.narratives.find((item) => item.id === narrative.id) ?? null;
    narrative.changeSummary = describeChange(before, narrative);
    await prisma.narrative.upsert({
      where: { id: narrative.id },
      create: narrativeData(workspaceId, narrative),
      update: narrativeData(workspaceId, narrative),
    });
    for (const source of narrative.sources) {
      await prisma.sourceItem.upsert({
        where: { id: source.sourceId },
        create: sourceData(workspaceId, source),
        update: sourceData(workspaceId, source),
      });
      await prisma.narrativeSource.upsert({
        where: { narrativeId_sourceItemId: { narrativeId: narrative.id, sourceItemId: source.sourceId } },
        create: { narrativeId: narrative.id, sourceItemId: source.sourceId, independent: source.independent, role: source.role },
        update: { independent: source.independent, role: source.role },
      });
      if (source.metrics) {
        for (const metric of source.metrics) {
          const existing = await prisma.sourceObservation.findFirst({ where: { sourceItemId: source.sourceId, metric: metric.metric, observedAt: new Date(metric.observedAt) } });
          if (!existing) {
            await prisma.sourceObservation.create({ data: { sourceItemId: source.sourceId, metric: metric.metric, value: metric.value, observedAt: new Date(metric.observedAt) } });
          }
        }
      }
    }
    await prisma.brandingOption.deleteMany({ where: { narrativeId: narrative.id } });
    if (narrative.names.length > 0) {
      await prisma.brandingOption.createMany({
        data: narrative.names.map((option) => ({
          id: option.id,
          narrativeId: narrative.id,
          rank: option.rank,
          name: option.name,
          ticker: option.ticker,
          story: option.story,
          wordplay: option.wordplay,
          memorability: option.memorability,
          narrativeFit: option.narrativeFit,
          style: option.style,
          pinned: option.pinned,
          isTop: option.isTop,
          userEdited: option.userEdited,
          collisionStatus: option.collisionStatus,
          checkedAt: option.collisionCheckedAt ? new Date(option.collisionCheckedAt) : null,
          matches: json(option.matches),
        })),
      });
    }
    for (const asset of narrative.assets) {
      await prisma.asset.upsert({
        where: { id: asset.id },
        create: {
          id: asset.id,
          narrativeId: narrative.id,
          kind: asset.kind,
          mode: asset.mode,
          status: asset.status,
          illustrationKey: asset.illustrationKey,
          textKey: asset.textKey,
          svg: asset.svg,
          error: asset.error,
          favorite: asset.favorite,
          version: asset.version,
          prompt: asset.prompt,
        },
        update: { status: asset.status, svg: asset.svg, textKey: asset.textKey, illustrationKey: asset.illustrationKey, error: asset.error, version: asset.version },
      });
    }
    await prisma.scoreSnapshot.create({
      data: {
        narrativeId: narrative.id,
        version: narrative.score.version,
        weights: json(narrative.score.weights),
        components: json(narrative.score.components),
        narrativeScore: narrative.score.narrativeScore,
        evidenceConfidence: narrative.score.evidenceConfidence,
        dataCoverage: narrative.score.dataCoverage,
        calculatedAt: new Date(narrative.score.calculatedAt),
      },
    });
    const version = await prisma.narrativeVersion.count({ where: { narrativeId: narrative.id } });
    await prisma.narrativeVersion.create({ data: { narrativeId: narrative.id, version: version + 1, snapshot: json(narrative) } });
  }
  for (const alert of next.alerts) {
    if (previous.alerts.some((item) => item.dedupeKey === alert.dedupeKey)) continue;
    await prisma.alertEvent.upsert({
      where: { workspaceId_dedupeKey: { workspaceId, dedupeKey: alert.dedupeKey } },
      create: {
        id: `${workspaceId.slice(-4)}_${alert.id}`.slice(0, 40),
        workspaceId,
        narrativeId: alert.narrativeId || null,
        ruleId: alert.ruleId || null,
        eventType: alert.eventType,
        dedupeKey: alert.dedupeKey,
        title: alert.title,
        body: alert.body,
        status: alert.status,
        reason: alert.reason,
        sourceUrl: alert.sourceUrl,
      },
      update: {},
    });
    if (alert.status !== "suppressed") {
      const stored = await prisma.alertEvent.findUnique({ where: { workspaceId_dedupeKey: { workspaceId, dedupeKey: alert.dedupeKey } } });
      if (stored) {
        for (const channel of alert.channels) {
          await prisma.notificationDelivery.upsert({
            where: { alertEventId_channel: { alertEventId: stored.id, channel } },
            create: { alertEventId: stored.id, channel, status: alert.status === "held" ? "held" : "pending" },
            update: {},
          });
        }
        await prisma.outboxEvent.create({
          data: { workspaceId, type: "alert", payload: { alertId: stored.id, narrativeId: alert.narrativeId }, status: "pending" },
        });
      }
    }
  }
  for (const arm of next.arms) {
    await prisma.alertArm.upsert({
      where: { narrativeId_ruleId: { narrativeId: arm.narrativeId, ruleId: arm.ruleId } },
      create: { workspaceId, narrativeId: arm.narrativeId, ruleId: arm.ruleId, armed: arm.armed, lastFiredAt: arm.lastFiredAt ? new Date(arm.lastFiredAt) : null },
      update: { armed: arm.armed, lastFiredAt: arm.lastFiredAt ? new Date(arm.lastFiredAt) : null },
    });
  }
}

function narrativeData(workspaceId: string, narrative: NarrativeView): Prisma.NarrativeUncheckedCreateInput {
  return {
    id: narrative.id,
    workspaceId,
    stableKey: narrative.stableKey,
    title: narrative.title,
    category: narrative.category,
    lifecycle: narrative.lifecycle,
    provisional: narrative.provisional,
    rumor: narrative.rumor,
    narrativeScore: narrative.score.narrativeScore,
    evidenceConfidence: narrative.score.evidenceConfidence,
    dataCoverage: narrative.score.dataCoverage,
    collisionStatus: narrative.collisionStatus,
    independentSources: narrative.independentSources,
    sourceCount: narrative.sourceCount,
    topName: narrative.topName,
    topTicker: narrative.topTicker,
    chainRelevance: narrative.chainRelevance,
    board: narrative.board,
    pinned: narrative.pinned,
    saved: narrative.saved,
    tags: narrative.tags,
    firstDiscoveredAt: new Date(narrative.firstDiscoveredAt),
    latestPublishedAt: narrative.latestPublishedAt ? new Date(narrative.latestPublishedAt) : null,
    latestMeaningfulAt: new Date(narrative.latestMeaningfulAt),
    latestAnalysisAt: new Date(narrative.latestAnalysisAt),
    mergedIntoId: narrative.mergedIntoId,
    payload: json(narrative),
  };
}

function sourceData(workspaceId: string, source: NarrativeView["sources"][number]): Prisma.SourceItemUncheckedCreateInput {
  return {
    id: source.sourceId,
    workspaceId,
    provider: source.provider,
    providerItemId: source.providerItemId,
    canonicalUrl: source.canonicalUrl,
    title: source.title,
    excerpt: source.excerpt,
    publisher: source.publisher,
    language: source.language,
    publishedAt: source.publishedAt ? new Date(source.publishedAt) : null,
    discoveredAt: new Date(source.discoveredAt),
    fetchedAt: new Date(source.discoveredAt),
    contentHash: source.sourceId,
    entities: source.entities,
    provenance: { role: source.role },
  };
}

function overlay(payload: Prisma.JsonValue, row: { board: string; pinned: boolean; saved: boolean; tags: Prisma.JsonValue; lastSeenAt: Date | null }): NarrativeView {
  const view = payload as unknown as NarrativeView;
  view.board = row.board as NarrativeView["board"];
  view.pinned = row.pinned;
  view.saved = row.saved;
  view.tags = asStringArray(row.tags);
  return view;
}

async function saveView(row: { id: string; workspaceId: string }, view: NarrativeView) {
  await prisma.narrative.update({
    where: { id: row.id },
    data: {
      ...narrativeData(row.workspaceId, view),
      id: undefined,
      workspaceId: undefined,
      stableKey: undefined,
    },
  });
}

function retitle(asset: NarrativeView["assets"][number], narrative: NarrativeView, name: string, ticker: string): NarrativeView["assets"][number] {
  const palette = pickPalette(narrative.stableKey);
  const svg = renderTemplateSvg(asset.kind, { motif: asset.motif, palette, name, ticker, narrativeTitle: narrative.title });
  return { ...asset, name, ticker, svg, textKey: textLayerKey({ illustrationKey: asset.illustrationKey, name, ticker }) };
}

function markAsset(view: NarrativeView, id: string, patch: Partial<NarrativeView["assets"][number]>) {
  view.assets = view.assets.map((asset) => asset.id === id ? { ...asset, ...patch } : asset);
}

async function ownedNarrative(workspaceId: string, narrativeId: string) {
  const row = await prisma.narrative.findFirst({ where: { id: narrativeId, workspaceId } });
  if (!row) throw new Error("Candidate not found.");
  return row;
}

async function mustSettings(workspaceId: string) {
  return prisma.workspaceSettings.findUniqueOrThrow({ where: { workspaceId } });
}

async function watched(workspaceId: string) {
  return (await prisma.watchRule.findMany({ where: { workspaceId } })).map((watch) => watch.entity);
}

async function optionsFor(workspaceId: string, settings: Awaited<ReturnType<typeof mustSettings>>): Promise<PipelineOptions> {
  const [rules, entities, deliveries] = await Promise.all([
    prisma.alertRule.findMany({ where: { workspaceId } }),
    watched(workspaceId),
    prisma.notificationDelivery.count({ where: { status: { in: ["pending", "sent", "held"] }, alert: { workspaceId, createdAt: { gte: startOfUtcDay() } } } }),
  ]);
  return {
    now: new Date().toISOString(),
    chain: settings.chainPreference,
    weights: settings.scoreWeights as Partial<ScoreWeights>,
    style: settings.namingStyle as PipelineOptions["style"],
    monitoringStartedAt: settings.monitoringStartedAt?.toISOString() ?? null,
    timezone: settings.timezone,
    rules: rules.length > 0 ? rules.map(ruleFromRow) : [defaultNewCandidateRule()],
    deliveriesToday: deliveries,
    watchedEntities: entities,
    excludedKeywords: asStringArray(settings.excludedKeywords),
  };
}

function ruleFromRow(rule: { id: string; name: string; enabled: boolean; eventType: string; minScore: number | null; minCoverage: number | null; categories: Prisma.JsonValue; freshnessHours: number | null; chainMinRelevance: number | null; excludeKeywords: Prisma.JsonValue; includeProvisional: boolean; includeRumors: boolean; mode: string; quietStart: string | null; quietEnd: string | null; cooldownMinutes: number; dailyCap: number; channels: Prisma.JsonValue; priorityBypassQuiet: boolean; hysteresis: number }): AlertRuleInput {
  const channels = (rule.channels && typeof rule.channels === "object" ? rule.channels : { inbox: true, browser: false, telegram: false }) as AlertRuleInput["channels"];
  return {
    id: rule.id,
    name: rule.name,
    enabled: rule.enabled,
    eventType: rule.eventType as AlertRuleInput["eventType"],
    minScore: rule.minScore,
    minCoverage: rule.minCoverage,
    categories: asStringArray(rule.categories),
    freshnessHours: rule.freshnessHours,
    chainMinRelevance: rule.chainMinRelevance,
    excludeKeywords: asStringArray(rule.excludeKeywords),
    includeProvisional: rule.includeProvisional,
    includeRumors: rule.includeRumors,
    mode: rule.mode as AlertRuleInput["mode"],
    quietStart: rule.quietStart,
    quietEnd: rule.quietEnd,
    cooldownMinutes: rule.cooldownMinutes,
    dailyCap: rule.dailyCap,
    channels,
    priorityBypassQuiet: rule.priorityBypassQuiet,
    hysteresis: rule.hysteresis,
  };
}

function settingsCreate(workspaceId: string): Prisma.WorkspaceSettingsUncheckedCreateInput {
  return {
    workspaceId,
    categories: ["ethereum", "technology", "culture", "general"],
    languages: ["en"],
    regions: ["global"],
    excludedKeywords: [],
    watchedEntities: marketPeopleNames(),
    excludedSources: [],
    scoreWeights: json(DEFAULT_WEIGHTS),
    priceAssumptions: { updatedAt: new Date().toISOString(), note: "Assumptions only. Null means no dollar estimate is shown.", textPerCallUsd: null, imageEachUsd: null },
    monitoringStartedAt: new Date("2026-10-01T00:00:00.000Z"),
    nextDueAt: new Date(Date.now() + 5 * 60_000),
  };
}

function ruleCreate(workspaceId: string, rule: AlertRuleInput): Prisma.AlertRuleUncheckedCreateInput {
  return {
    workspaceId,
    name: rule.name,
    enabled: rule.enabled,
    eventType: rule.eventType,
    minScore: rule.minScore,
    minCoverage: rule.minCoverage,
    categories: rule.categories,
    freshnessHours: rule.freshnessHours,
    chainMinRelevance: rule.chainMinRelevance,
    excludeKeywords: rule.excludeKeywords,
    includeProvisional: rule.includeProvisional,
    includeRumors: rule.includeRumors,
    mode: rule.mode,
    quietStart: rule.quietStart,
    quietEnd: rule.quietEnd,
    cooldownMinutes: rule.cooldownMinutes,
    dailyCap: rule.dailyCap,
    channels: rule.channels,
    priorityBypassQuiet: rule.priorityBypassQuiet,
    hysteresis: rule.hysteresis,
  };
}

function initialProviderStatus(provider: string) {
  if (provider === "rss" || provider === "hackernews" || provider === "dexscreener") return "unconfigured";
  return "unconfigured";
}

function providerDetail(provider: string) {
  switch (provider) {
    case "rss":
      return "Curated feeds are saved. Live fetches run when the desk is in live mode.";
    case "hackernews":
      return "Official public API. No key required. Live mode fetches new stories.";
    case "dexscreener":
      return "Public search API. Used for name checks in live mode. Not a universal token registry.";
    case "x":
      return "Not connected. Add X_BEARER_TOKEN for recent search on your account's access tier.";
    case "openai_text":
      return "Not configured. Heuristic summaries are used until OPENAI_API_KEY and OPENAI_TEXT_MODEL are set.";
    case "openai_image":
      return "Not configured. Template logos and banners are available without it.";
    default:
      return "Not connected. Pair a bot to deliver alerts outside the browser.";
  }
}

async function setProvider(workspaceId: string, provider: string, status: string, detail: string) {
  await prisma.providerConnection.upsert({
    where: { workspaceId_provider: { workspaceId, provider } },
    update: { status, detail, lastSuccessAt: status === "healthy" || status === "connected" ? new Date() : undefined, lastError: status === "error" ? detail : null, lastErrorAt: status === "error" ? new Date() : undefined },
    create: { workspaceId, provider, status, detail },
  });
}

async function tryLock(workspaceId: string, holder: string) {
  const token = randomUUID();
  const expires = new Date(Date.now() + 90_000);
  const rows = await prisma.$queryRaw<{ token: string }[]>`
    INSERT INTO "WorkspaceLock" ("workspaceId", "token", "holder", "expiresAt", "heartbeatAt")
    VALUES (${workspaceId}, ${token}, ${holder}, ${expires}, NOW())
    ON CONFLICT ("workspaceId") DO UPDATE
      SET "token" = EXCLUDED."token", "holder" = EXCLUDED."holder", "expiresAt" = EXCLUDED."expiresAt", "heartbeatAt" = NOW()
      WHERE "WorkspaceLock"."expiresAt" < NOW()
    RETURNING "token"`;
  return rows[0]?.token === token ? token : null;
}

async function releaseLock(workspaceId: string, token: string) {
  await prisma.workspaceLock.deleteMany({ where: { workspaceId, token } });
}

async function finishRun(id: string, status: string, error: string | null, stats?: Record<string, number>) {
  await prisma.scanRun.update({ where: { id }, data: { status, error, stats, finishedAt: new Date() } });
}

async function emit(workspaceId: string, type: string, payload: Prisma.InputJsonValue) {
  const last = await prisma.dashboardEvent.findFirst({ where: { workspaceId }, orderBy: { seq: "desc" } });
  await prisma.dashboardEvent.create({ data: { workspaceId, seq: (last?.seq ?? 0) + 1, type, payload } });
}

async function countTodayRequests(workspaceId: string) {
  const rows = await prisma.usageLedger.findMany({ where: { workspaceId, kind: "request", createdAt: { gte: startOfUtcDay() } } });
  return rows.reduce((sum, row) => sum + row.units, 0);
}

async function reserveUsd(workspaceId: string, provider: string, amount: number) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "WorkspaceSettings" WHERE "workspaceId" = ${workspaceId} FOR UPDATE`;
    const settings = await tx.workspaceSettings.findUnique({ where: { workspaceId } });
    const limit = provider === "openai_image" ? settings?.imageBudgetUsd : settings?.textBudgetUsd;
    if (limit == null) return true;
    const rows = await tx.usageLedger.findMany({ where: { workspaceId, provider, createdAt: { gte: startOfUtcDay() } } });
    const used = rows.reduce((sum, row) => sum + (row.estimatedUsd ?? 0), 0);
    if (used + amount > limit) return false;
    await tx.usageLedger.create({ data: { workspaceId, provider, kind: "reservation", units: 1, estimatedUsd: amount, measured: false, reservation: true, settled: false } });
    return true;
  });
}

async function settleUsd(workspaceId: string, provider: string, reserved: number, actual: number) {
  await prisma.usageLedger.create({ data: { workspaceId, provider, kind: "settle", units: 1, estimatedUsd: actual - reserved, measured: false, reservation: false, settled: true } });
}

function summarizeUsage(rows: { provider: string; units: number; estimatedUsd: number | null; measured: boolean }[]) {
  const byProvider: Record<string, { requests: number; estimatedUsd: number | null; measured: boolean }> = {};
  for (const row of rows) {
    const current = byProvider[row.provider] ?? { requests: 0, estimatedUsd: row.estimatedUsd === null ? null : 0, measured: row.measured };
    current.requests += row.units;
    if (row.estimatedUsd !== null && current.estimatedUsd !== null) current.estimatedUsd += row.estimatedUsd;
    byProvider[row.provider] = current;
  }
  return byProvider;
}

function asStringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function startOfUtcDay() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export { prisma };
