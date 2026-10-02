export class ProviderError extends Error {
  constructor(
    message: string,
    readonly code: "unconfigured" | "rate_limited" | "timeout" | "malformed" | "outage" | "blocked" | "http",
    readonly retryable: boolean,
    readonly retryAfterMs: number | null = null,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export function retryAfterFrom(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - Date.now());
}
