import type { AlertArmState, PipelineAlert } from "./types";
import { shortHash } from "./text";

export interface AlertRuleInput {
  id: string;
  name: string;
  enabled: boolean;
  eventType: "new_candidate" | "score_cross" | "acceleration" | "watched_entity";
  minScore: number | null;
  minCoverage: number | null;
  categories: string[];
  freshnessHours: number | null;
  chainMinRelevance: number | null;
  excludeKeywords: string[];
  includeProvisional: boolean;
  includeRumors: boolean;
  mode: "immediate" | "digest";
  quietStart: string | null;
  quietEnd: string | null;
  cooldownMinutes: number;
  dailyCap: number;
  channels: { inbox: boolean; browser: boolean; telegram: boolean };
  priorityBypassQuiet: boolean;
  hysteresis: number;
}

export interface AlertSubject {
  id: string;
  title: string;
  name: string | null;
  ticker: string | null;
  category: string;
  score: number | null;
  coverage: number | null;
  confidence: number | null;
  provisional: boolean;
  rumor: boolean;
  discoveredAt: string;
  publishedAt: string | null;
  entities: string[];
  chainRelevance: number;
  acceleration: number | null;
  text: string;
  sourceUrl: string | null;
  isNew: boolean;
}

export interface AlertContext {
  now: string;
  timezone: string;
  monitoringStartedAt: string | null;
  deliveriesToday: number;
  existingKeys: string[];
  arms: AlertArmState[];
  watchedEntities: string[];
}

export function evaluateAlerts(subjects: AlertSubject[], rules: AlertRuleInput[], context: AlertContext): {
  alerts: PipelineAlert[];
  arms: AlertArmState[];
} {
  const alerts: PipelineAlert[] = [];
  const arms = context.arms.map((arm) => ({ ...arm }));
  let deliveries = context.deliveriesToday;
  const keys = new Set(context.existingKeys);

  for (const subject of subjects) {
    for (const rule of rules) {
      if (!rule.enabled) continue;
      const decision = decide(subject, rule, context, arms, keys, deliveries);
      if (decision.arm) {
        const index = arms.findIndex((arm) => arm.narrativeId === subject.id && arm.ruleId === rule.id);
        if (index >= 0) arms[index] = { ...arms[index]!, ...decision.arm, narrativeId: subject.id, ruleId: rule.id };
        else arms.push({ narrativeId: subject.id, ruleId: rule.id, armed: decision.arm.armed, lastFiredAt: decision.arm.lastFiredAt });
      }
      if (!decision.alert) continue;
      alerts.push(decision.alert);
      keys.add(decision.alert.dedupeKey);
      if (decision.alert.status !== "suppressed" && decision.alert.channels.includes("inbox")) deliveries += 1;
    }
  }

  return { alerts, arms };
}

function decide(
  subject: AlertSubject,
  rule: AlertRuleInput,
  context: AlertContext,
  arms: AlertArmState[],
  keys: Set<string>,
  deliveries: number,
): { alert: PipelineAlert | null; arm?: { armed: boolean; lastFiredAt: string | null } } {
  if (!matchesEvent(subject, rule, context.watchedEntities)) return { alert: null };
  const arm = arms.find((item) => item.narrativeId === subject.id && item.ruleId === rule.id) ?? {
    narrativeId: subject.id,
    ruleId: rule.id,
    armed: true,
    lastFiredAt: null,
  };

  if (rule.eventType === "score_cross") {
    const threshold = rule.minScore ?? 70;
    const score = subject.score;
    if (score === null) return { alert: null };
    if (!arm.armed) {
      if (score < threshold - rule.hysteresis) return { alert: null, arm: { armed: true, lastFiredAt: arm.lastFiredAt } };
      return { alert: null };
    }
    if (score < threshold) return { alert: null };
  }

  const dedupeKey = dedupeFor(subject, rule, arm);
  if (keys.has(dedupeKey)) return { alert: null };

  const suppression = suppressionReason(subject, rule, context, arm, deliveries);
  const channels = enabledChannels(rule);
  const naming = subject.name && subject.ticker ? `${subject.name} · ${subject.ticker}` : "Name still open";
  const body = [
    subject.title,
    naming,
    reasonLine(subject, rule),
    `Evidence confidence ${subject.confidence ?? "unknown"}. Coverage ${subject.coverage === null ? "unknown" : `${Math.round(subject.coverage * 100)}%`}.`,
    subject.sourceUrl ?? "No source link",
  ].join("\n");

  const status = suppression
    ? suppression === "digest"
      ? "held"
      : "suppressed"
    : rule.mode === "digest"
      ? "held"
      : "pending";

  const fired = status !== "suppressed";
  return {
    alert: {
      id: `alert_${shortHash(dedupeKey)}`,
      dedupeKey,
      ruleId: rule.id,
      narrativeId: subject.id,
      eventType: rule.eventType,
      status,
      reason: suppression && suppression !== "digest" ? suppression : reasonLine(subject, rule),
      title: subject.title,
      body,
      channels: status === "suppressed" ? [] : channels,
      createdAt: context.now,
      sourceUrl: subject.sourceUrl,
    },
    arm: fired
      ? { armed: rule.eventType === "score_cross" ? false : arm.armed, lastFiredAt: context.now }
      : undefined,
  };
}

function matchesEvent(subject: AlertSubject, rule: AlertRuleInput, watched: string[]): boolean {
  if (rule.eventType === "new_candidate") return subject.isNew;
  if (rule.eventType === "score_cross") return subject.score !== null;
  if (rule.eventType === "acceleration") return (subject.acceleration ?? 0) >= 70;
  const haystack = subject.entities.map((entity) => entity.toLowerCase());
  return watched.some((entity) => haystack.includes(entity.toLowerCase()));
}

function suppressionReason(
  subject: AlertSubject,
  rule: AlertRuleInput,
  context: AlertContext,
  arm: AlertArmState,
  deliveries: number,
): string | null {
  if (context.monitoringStartedAt && subject.discoveredAt < context.monitoringStartedAt && rule.eventType === "new_candidate") {
    return "Before monitoring started. Historical items stay in a digest instead of an immediate alert.";
  }
  if (subject.provisional && !rule.includeProvisional) return "Provisional candidate held until that inclusion is enabled.";
  if (subject.rumor && !rule.includeRumors) return "Rumor held. Rumor inclusion is off for this rule.";
  if (rule.minScore !== null && rule.eventType !== "score_cross" && (subject.score === null || subject.score < rule.minScore)) {
    return "Below the configured score minimum.";
  }
  if (rule.minCoverage !== null && (subject.coverage === null || subject.coverage < rule.minCoverage)) {
    return "Below the configured evidence coverage.";
  }
  if (rule.categories.length > 0 && !rule.categories.includes(subject.category)) return "Category is outside this rule.";
  if (rule.chainMinRelevance !== null && subject.chainRelevance < rule.chainMinRelevance) return "Chain relevance is below this rule.";
  if (rule.freshnessHours !== null && subject.publishedAt) {
    const age = (new Date(context.now).getTime() - new Date(subject.publishedAt).getTime()) / 3_600_000;
    if (age > rule.freshnessHours) return "Older than the freshness window.";
  }
  const text = `${subject.title} ${subject.text}`.toLowerCase();
  if (rule.excludeKeywords.some((keyword) => keyword && text.includes(keyword.toLowerCase()))) return "Matched an excluded keyword.";
  if (arm.lastFiredAt && rule.cooldownMinutes > 0) {
    const elapsed = (new Date(context.now).getTime() - new Date(arm.lastFiredAt).getTime()) / 60_000;
    if (elapsed < rule.cooldownMinutes) return "Cooldown is still active.";
  }
  if (isQuietHour(context.now, context.timezone, rule.quietStart, rule.quietEnd) && !rule.priorityBypassQuiet) {
    return rule.mode === "digest" ? "digest" : "Quiet hours.";
  }
  if (deliveries >= rule.dailyCap) return "Daily alert cap reached.";
  if (rule.mode === "digest") return "digest";
  return null;
}

function reasonLine(subject: AlertSubject, rule: AlertRuleInput): string {
  if (rule.eventType === "new_candidate") return "New narrative candidate from monitored sources.";
  if (rule.eventType === "score_cross") return `Narrative score crossed ${rule.minScore ?? 70}.`;
  if (rule.eventType === "acceleration") return "Observed attention accelerated on a repeated metric.";
  return `Watched entity matched ${subject.entities.join(", ") || "a saved watch"}.`;
}

function dedupeFor(subject: AlertSubject, rule: AlertRuleInput, arm: AlertArmState): string {
  if (rule.eventType === "new_candidate") return `new:${subject.id}:${rule.id}`;
  if (rule.eventType === "score_cross") return `score:${subject.id}:${rule.id}:${arm.lastFiredAt ?? "open"}`;
  if (rule.eventType === "acceleration") return `accel:${subject.id}:${rule.id}`;
  return `watch:${subject.id}:${rule.id}`;
}

export function enabledChannels(rule: AlertRuleInput): ("inbox" | "browser" | "telegram")[] {
  const channels: ("inbox" | "browser" | "telegram")[] = [];
  if (rule.channels.inbox) channels.push("inbox");
  if (rule.channels.browser) channels.push("browser");
  if (rule.channels.telegram) channels.push("telegram");
  return channels;
}

export function isQuietHour(nowIso: string, timeZone: string, start: string | null, end: string | null): boolean {
  if (!start || !end || start === end) return false;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(nowIso));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  const current = hour.padStart(2, "0") + ":" + minute.padStart(2, "0");
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

export function defaultNewCandidateRule(): AlertRuleInput {
  return {
    id: "rule_new",
    name: "New candidates",
    enabled: true,
    eventType: "new_candidate",
    minScore: null,
    minCoverage: null,
    categories: [],
    freshnessHours: null,
    chainMinRelevance: null,
    excludeKeywords: [],
    includeProvisional: false,
    includeRumors: false,
    mode: "immediate",
    quietStart: null,
    quietEnd: null,
    cooldownMinutes: 30,
    dailyCap: 40,
    channels: { inbox: true, browser: false, telegram: false },
    priorityBypassQuiet: false,
    hysteresis: 5,
  };
}
