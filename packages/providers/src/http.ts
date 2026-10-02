import { assertPublicHttpUrl } from "@radar/core";
import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";
import { ProviderError } from "./errors";

export interface SafeResponse {
  status: number;
  headers: Headers;
  body: Buffer;
  finalUrl: string;
}

export async function safeFetch(rawUrl: string, init?: {
  method?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxBytes?: number;
  accept?: string[];
}): Promise<SafeResponse> {
  const timeoutMs = init?.timeoutMs ?? 12_000;
  const maxBytes = init?.maxBytes ?? 1_000_000;
  let current = rawUrl;
  for (let hop = 0; hop < 4; hop += 1) {
    const url = await assertPublicHttpUrl(current, resolvePublic);
    const pinned = await resolvePublic(url.hostname.replace(/^\[|\]$/g, ""));
    const response = await requestOnce(url, pinned[0]!, init?.headers ?? {}, timeoutMs, maxBytes, init?.method ?? "GET");
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new ProviderError("Redirect was missing a location.", "blocked", false, null, response.status);
      current = new URL(location, url).toString();
      continue;
    }
    const type = (response.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    if (init?.accept && response.status !== 304 && !init.accept.some((allowed) => type.includes(allowed))) {
      throw new ProviderError(`Unexpected content type ${type || "unknown"}.`, "malformed", false, null, response.status);
    }
    return { ...response, finalUrl: url.toString() };
  }
  throw new ProviderError("Too many redirects.", "blocked", false);
}

async function resolvePublic(host: string): Promise<string[]> {
  if (isIP(host)) return [host];
  const records = await lookup(host, { all: true, verbatim: true });
  return records.map((record) => record.address);
}

function requestOnce(url: URL, pinnedIp: string, headers: Record<string, string>, timeoutMs: number, maxBytes: number, method: string): Promise<SafeResponse> {
  const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
  const family = isIP(pinnedIp);
  return new Promise((resolve, reject) => {
    const req = transport(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method,
        headers: { "user-agent": "NarrativeRadar/0.1", accept: "*/*", ...headers },
        lookup: (_hostname, _options, callback) => {
          callback(null, pinnedIp, family === 6 ? 6 : 4);
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            req.destroy();
            reject(new ProviderError("Response exceeded the size limit.", "malformed", false));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          const headerBag = new Headers();
          for (const [key, value] of Object.entries(res.headers)) {
            if (Array.isArray(value)) headerBag.set(key, value.join(", "));
            else if (value) headerBag.set(key, value);
          }
          resolve({ status: res.statusCode ?? 0, headers: headerBag, body: Buffer.concat(chunks), finalUrl: url.toString() });
        });
      },
    );
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new ProviderError("The request timed out.", "timeout", true));
    });
    req.on("error", (error) => reject(new ProviderError(error.message, "outage", true)));
    req.end();
  });
}
