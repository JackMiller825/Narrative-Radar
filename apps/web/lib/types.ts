import type { NarrativeView } from "@radar/core";

export interface DeskData {
  workspace: { id: string; name: string; mode: string };
  settings: {
    chainPreference: string;
    schedulePreset: string;
    customIntervalSeconds: number;
    paused: boolean;
    timezone: string;
    namingStyle: string;
    freshnessHours: number;
    excludedKeywords: string[];
    watchedEntities: string[];
    categories: string[];
    languages: string[];
    scoreWeights: Record<string, number>;
    dailyRequestLimit: number;
    textBudgetUsd: number | null;
    imageBudgetUsd: number | null;
    imageQueueCap: number;
    pauseOnBudget: boolean;
    retentionDays: number;
    alertSound: boolean;
    browserNotifications: boolean;
    nextDueAt: string | null;
    lastAttemptedAt: string | null;
    lastSuccessfulAt: string | null;
    monitoringStartedAt: string | null;
    priceAssumptions: { note?: string; textPerCallUsd?: number | null; imageEachUsd?: number | null };
  };
  narratives: NarrativeView[];
  alerts: {
    id: string;
    title: string;
    body: string;
    status: string;
    reason: string;
    createdAt: string;
    readAt: string | null;
    eventType: string;
    narrativeId: string | null;
    sourceUrl: string | null;
    deliveries: { channel: string; status: string; lastError: string | null }[];
  }[];
  providers: { id: string; provider: string; status: string; detail: string; lastSuccessAt: string | null; lastError: string | null; nextPermittedAt: string | null }[];
  feeds: { id: string; url: string; title: string; enabled: boolean; lastSuccessAt: string | null; lastError: string | null }[];
  rules: { id: string; name: string; enabled: boolean; eventType: string; mode: string; dailyCap: number; includeRumors: boolean; includeProvisional: boolean }[];
  scans: { id: string; status: string; trigger: string; error: string | null; createdAt: string; finishedAt: string | null }[];
  worker: { online: boolean; beatAt: string | null; note: string };
  schedule: { seconds: number; preview: { checksPerDay: number; note: string } };
  usage: Record<string, { requests: number; estimatedUsd: number | null; measured: boolean }>;
  telegram: { configured: boolean; paired: boolean; username: string | null; pairingCode: string | null };
}
