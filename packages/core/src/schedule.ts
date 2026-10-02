import type { SchedulePreset } from "./types";

export const PRESET_SECONDS: Record<Exclude<SchedulePreset, "custom">, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
};

export const MIN_INTERVAL_SECONDS = 60;
export const MAX_INTERVAL_SECONDS = 86_400;

export class ScheduleError extends Error {}

export function intervalSeconds(preset: SchedulePreset, customSeconds: number): number {
  if (preset !== "custom") return PRESET_SECONDS[preset];
  assertCustomInterval(customSeconds);
  return customSeconds;
}

export function assertCustomInterval(seconds: number): void {
  if (!Number.isInteger(seconds) || seconds < MIN_INTERVAL_SECONDS || seconds > MAX_INTERVAL_SECONDS) {
    throw new ScheduleError(`Custom interval must be an integer from ${MIN_INTERVAL_SECONDS} to ${MAX_INTERVAL_SECONDS} seconds.`);
  }
}

export function nextDue(from: Date, seconds: number): Date {
  return new Date(from.getTime() + seconds * 1000);
}

export function workPreview(seconds: number): { checksPerDay: number; note: string } {
  const checksPerDay = Math.floor(86_400 / seconds);
  return {
    checksPerDay,
    note:
      seconds === 60
        ? "A one-minute schedule asks eligible sources once per minute. That is up to 1,440 scheduled checks a day before pagination and enrichment. It does not mean every internet event arrives within a minute."
        : `This schedule asks eligible sources about ${checksPerDay} times per day. Provider limits can make the effective fetch slower.`,
  };
}

export function invalidateScheduled<T extends { scheduleVersion: number; status: string }>(jobs: T[], version: number): T[] {
  return jobs.map((job) =>
    job.status === "pending" && job.scheduleVersion !== version ? { ...job, status: "cancelled" } : job,
  );
}
