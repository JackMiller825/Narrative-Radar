import { isIP } from "node:net";

export class SsrfError extends Error {}

export function ipIsBlocked(ip: string): boolean {
  const mapped = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (isIP(mapped) === 4) return ipv4Blocked(mapped);
  if (isIP(ip) === 6) return ipv6Blocked(ip);
  return true;
}

function ipv4Blocked(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return true;
  if (parts.some((part) => !/^\d{1,3}$/.test(part) || (part.length > 1 && part.startsWith("0")))) return true;
  const numbers = parts.map((part) => Number(part));
  if (numbers.some((part) => part > 255)) return true;
  const [a, b] = numbers as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0 && numbers[2] === 2) return true;
  if (a === 198 && b === 51 && numbers[2] === 100) return true;
  if (a === 203 && b === 0 && numbers[2] === 113) return true;
  if (a >= 224) return true;
  return false;
}

function ipv6Blocked(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true;
  return false;
}

export async function assertPublicHttpUrl(raw: string, lookup: (host: string) => Promise<string[]>): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfError("URL could not be parsed.");
  }
  if (url.username || url.password) throw new SsrfError("URLs with embedded credentials are blocked.");
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new SsrfError("Only HTTP and HTTPS URLs are allowed.");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host === "metadata.google.internal") {
    throw new SsrfError("That host is blocked.");
  }
  if (/^\d+$/.test(host)) throw new SsrfError("Numeric hosts are blocked.");
  const addresses = isIP(host) ? [host] : await lookup(host);
  if (addresses.length === 0) throw new SsrfError("DNS did not return an address.");
  for (const address of addresses) {
    if (ipIsBlocked(address)) throw new SsrfError(`Blocked destination ${address}.`);
  }
  return url;
}

export async function assertRedirectChain(urls: string[], lookup: (host: string) => Promise<string[]>): Promise<void> {
  for (const url of urls) await assertPublicHttpUrl(url, lookup);
}
