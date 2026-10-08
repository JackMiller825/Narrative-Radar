import type { NarrativeView } from "@radar/core/browser";

const PREVIOUS_WATCH = new Set([
  "vitalik buterin",
  "elon musk",
  "donald trump",
  "jerome powell",
  "gary gensler",
  "michael saylor",
  "brian armstrong",
  "changpeng zhao",
  "larry fink",
  "justin sun",
  "lisbon robot",
]);

export function focusedWatchList(current: string[], defaults: string[]): string[] {
  const names = current.map((name) => name.trim()).filter(Boolean);
  const onlyPrevious = names.length === 0 || names.every((name) => PREVIOUS_WATCH.has(name.toLowerCase()) || defaults.some((item) => item.toLowerCase() === name.toLowerCase()));
  if (!onlyPrevious) {
    const have = new Set(names.map((name) => name.toLowerCase()));
    return [...names.filter((name) => name.toLowerCase() !== "lisbon robot" && name.toLowerCase() !== "justin sun"), ...defaults.filter((name) => !have.has(name.toLowerCase()))];
  }
  return defaults;
}

const FRAMES = {
  mascot: { width: 768, height: 768, seed: 1, pose: "full-body original mascot character, centered, simple background" },
  logo: { width: 768, height: 768, seed: 2, pose: "app-icon portrait of an original mascot character, big expressive face, simple background" },
  banner: { width: 1200, height: 628, seed: 3, pose: "wide scene, original mascot character standing on the left, open space on the right" },
} as const;

export function mascotImageUrl(narrative: Pick<NarrativeView, "id" | "title" | "topName" | "topTicker">, kind: keyof typeof FRAMES): string {
  const frame = FRAMES[kind];
  const name = narrative.topName ?? "unnamed narrative";
  const ticker = narrative.topTicker ?? "";
  const title = narrative.title.replace(/[^\w\s,'-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  const prompt = `${frame.pose} named ${name} ${ticker}. Story: ${title}. Distinctive digital illustration, unique silhouette and color, no text, no letters, no logo, no watermark`;
  return `https://placeholdr.dev/${frame.width}x${frame.height}/${encodeURIComponent(prompt)}?style=digital-art&seed=${frame.seed}`;
}

export function attachMascotImages<T extends { id: string; title: string; topName: string | null; topTicker: string | null; latestPublishedAt: string | null; assets: NarrativeView["assets"] }>(narratives: T[]): T[] {
  const ranked = [...narratives].sort((a, b) => (b.latestPublishedAt ?? "").localeCompare(a.latestPublishedAt ?? ""));
  const detailed = new Set(ranked.slice(0, 8).map((narrative) => narrative.id));
  return narratives.map((narrative) => ({
    ...narrative,
    assets: narrative.assets.map((asset) => {
      if (asset.mode !== "template") return asset;
      if (asset.kind !== "mascot" && asset.kind !== "logo" && asset.kind !== "banner") return asset;
      if (asset.kind !== "mascot" && !detailed.has(narrative.id)) return asset;
      if (asset.imageUrl) return asset;
      return { ...asset, imageUrl: mascotImageUrl(narrative, asset.kind) };
    }),
  }));
}

let active = 0;
const pending: Array<() => void> = [];

function pump() {
  while (active < 2 && pending.length > 0) {
    active += 1;
    const job = pending.shift();
    job?.();
  }
}

export function loadGeneratedImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const run = () => {
      void poll(url)
        .then(resolve, reject)
        .finally(() => {
          active -= 1;
          pump();
        });
    };
    pending.push(run);
    pump();
  });
}

async function poll(url: string): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      const type = response.headers.get("content-type") ?? "";
      if (response.status === 429 || response.status === 402) {
        await new Promise((resolve) => setTimeout(resolve, 8000));
        continue;
      }
      if (response.ok && (type.includes("jpeg") || type.includes("png") || type.includes("webp"))) {
        const blob = await response.blob();
        return URL.createObjectURL(blob);
      }
    } catch {
      // The image host can answer with a placeholder while Flux is still drawing.
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return url;
}
