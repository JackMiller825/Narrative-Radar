import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatWhen(value: string | null | undefined, timezone = "UTC") {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function ageLabel(value: string | null | undefined) {
  if (!value) return "time unknown";
  const delta = Date.now() - new Date(value).getTime();
  if (Number.isNaN(delta)) return "time unknown";
  const minutes = Math.round(delta / 60000);
  if (Math.abs(minutes) < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function isPublishedSnapshot() {
  return typeof document !== "undefined" && document.documentElement.dataset.pages === "static";
}

export async function deskAction(body: Record<string, unknown>) {
  if (isPublishedSnapshot()) {
    const { runPublishedAction } = await import("./published-desk");
    const data = await runPublishedAction(body);
    if (data.ok === false) throw new Error(data.reason || data.error || "That action did not complete.");
    return data;
  }
  const response = await fetch("/api/desk", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; reason?: string; code?: string; instructions?: string; detail?: string; auditId?: string };
  if (!response.ok || data.ok === false) {
    throw new Error(data.reason || data.error || "That action did not complete.");
  }
  return data;
}
