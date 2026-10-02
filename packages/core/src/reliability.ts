export interface ClassifiedError {
  status: "unconfigured" | "rate_limited" | "error";
  retryable: boolean;
  retryAfterMs: number | null;
  message: string;
}

export function classifyProviderFailure(input: {
  missingCredentials?: boolean;
  httpStatus?: number | null;
  timedOut?: boolean;
  malformed?: boolean;
  retryAfterMs?: number | null;
  message?: string;
}): ClassifiedError {
  if (input.missingCredentials) {
    return { status: "unconfigured", retryable: false, retryAfterMs: null, message: input.message ?? "Provider credentials are not configured." };
  }
  if (input.httpStatus === 429) {
    return {
      status: "rate_limited",
      retryable: true,
      retryAfterMs: input.retryAfterMs ?? 60_000,
      message: input.message ?? "The provider asked us to slow down.",
    };
  }
  if (input.timedOut) {
    return { status: "error", retryable: true, retryAfterMs: null, message: input.message ?? "The provider timed out." };
  }
  if (input.malformed) {
    return { status: "error", retryable: false, retryAfterMs: null, message: input.message ?? "The provider returned data we could not read." };
  }
  if ((input.httpStatus ?? 0) >= 500) {
    return { status: "error", retryable: true, retryAfterMs: null, message: input.message ?? "The provider had an outage." };
  }
  return { status: "error", retryable: false, retryAfterMs: null, message: input.message ?? "The provider request failed." };
}

export function backoffMs(attempt: number, retryAfterMs?: number | null, jitter = Math.random()): number {
  if (retryAfterMs && retryAfterMs > 0) return retryAfterMs;
  const base = Math.min(60_000, 500 * 2 ** Math.max(0, attempt));
  const factor = 0.5 + Math.min(1, Math.max(0, jitter)) * 0.5;
  return Math.round(base * factor);
}

export function planEventCatchup(lastId: number, sequences: number[], oldestRetained: number): "replay" | "snapshot" {
  if (lastId > 0 && lastId < oldestRetained) return "snapshot";
  if (sequences.length === 0) return "replay";
  if (lastId > 0 && sequences[0]! > lastId + 1) return "snapshot";
  return "replay";
}
