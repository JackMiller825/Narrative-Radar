import { createHash } from "node:crypto";

const STOP = new Set([
  "the", "a", "an", "of", "and", "or", "to", "in", "on", "for", "with", "from", "by",
  "at", "as", "is", "are", "was", "were", "be", "this", "that", "it", "its", "new",
  "after", "over", "into", "about", "says", "said", "will", "has", "have", "had",
  "their", "his", "her", "not", "but", "than", "via", "using", "use", "ai", "ethereum",
  "crypto", "blockchain", "token", "news", "update", "own", "now", "includes", "include",
  "just", "more", "most", "how", "what", "when", "who", "why", "its", "per", "cent",
]);

export function sha1(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}

export function shortHash(value: string, length = 12): string {
  return sha1(value).slice(0, length);
}

export function stemToken(token: string): string {
  if (token.endsWith("ies") && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith("s") && !token.endsWith("ss") && token.length > 3) return token.slice(0, -1);
  return token;
}

export function significantTokens(text: string): string[] {
  const raw = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map(stemToken)
    .filter((token) => token.length > 2 && !STOP.has(token));
  return [...new Set(raw)];
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function jaccard(left: string[], right: string[]): number {
  const a = new Set(left);
  const b = new Set(right);
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function isPersonEntity(entity: string): boolean {
  const parts = entity.trim().split(/\s+/);
  return parts.length >= 2 && parts.every((part) => /^[A-Z][a-zA-Z'’-]+$/.test(part));
}

export function eventSignature(title: string, entities: string[]): string[] {
  const personTokens = new Set(
    entities.filter(isPersonEntity).flatMap((entity) => significantTokens(entity)),
  );
  const signature = significantTokens(title).filter((token) => !personTokens.has(token));
  return signature;
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function excerpt(text: string, limit = 480): string {
  const clean = stripTags(text).replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, limit - 1).trimEnd()}…`;
}

export function stripTags(value: string): string {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export function xmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&apos;";
    }
  });
}

export function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function redactSecrets(value: string): string {
  return value
    .replace(/bearer\s+[a-z0-9\-._~+/]+=*/gi, "bearer [redacted]")
    .replace(/\bsk-[a-zA-Z0-9_-]{8,}\b/g, "[redacted]")
    .replace(/\b\d{6,}:[a-zA-Z0-9_-]{10,}\b/g, "[redacted]");
}

export function csvCell(value: string): string {
  let cell = value.replaceAll('"', '""');
  if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  return `"${cell}"`;
}

export function contentHash(title: string, body: string): string {
  return sha1(`${normalizeTitle(title)}\n${normalizeTitle(body)}`);
}

export function relativeHours(fromIso: string | null, nowIso: string): number | null {
  if (!fromIso) return null;
  const delta = new Date(nowIso).getTime() - new Date(fromIso).getTime();
  if (Number.isNaN(delta)) return null;
  return delta / 3_600_000;
}
