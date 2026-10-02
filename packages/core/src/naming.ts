import type { CollisionStatus, NameOption, NamingStyle } from "./types";
import { isPersonEntity, shortHash, significantTokens } from "./text";

const ENDINGS: Record<NamingStyle, string[]> = {
  cute: ["let", "ling", "pip", "mote", "bean"],
  absurd: ["honk", "wobble", "noodle", "goblin", "bonk"],
  minimalist: ["mark", "note", "form", "plain", "field"],
  futuristic: ["arc", "vector", "proto", "orbit", "signal"],
  ethereum: ["slot", "beacon", "lane", "rollup", "glint"],
};

const BANNED = /\b(ai|inu|pepe)\b/i;

export function suggestNames(input: {
  title: string;
  entities: string[];
  style: NamingStyle;
  narrativeId: string;
}): NameOption[] {
  const personTokens = new Set(
    input.entities.filter(isPersonEntity).flatMap((entity) => significantTokens(entity)),
  );
  const stems = significantTokens(`${input.title} ${input.entities.filter((entity) => !isPersonEntity(entity)).join(" ")}`)
    .filter((token) => !personTokens.has(token) && token.length >= 3 && token.length <= 12)
    .slice(0, 6);
  const usable = stems.length > 0 ? stems : ["lumen", "pebble", "nimbus", "marsh", "quark"];
  const endings = ENDINGS[input.style];
  const used = new Set<string>();
  const tickers = new Set<string>();
  const drafts: NameOption[] = [];

  for (let index = 0; index < 5; index += 1) {
    const stem = usable[index % usable.length]!;
    const ending = endings[index % endings.length]!;
    let name = `${capitalize(stem)}${ending}`;
    if (input.style === "minimalist" && index % 2 === 0) name = capitalize(stem);
    if (index === 3 && usable.length > 1) name = `${capitalize(stem)} ${capitalize(endings[(index + 1) % endings.length]!)}`;
    if (name.split(/\s+/).length > 3) name = capitalize(stem);
    if (BANNED.test(name) || used.has(name.toLowerCase())) name = `${capitalize(stem)}bit`;
    used.add(name.toLowerCase());
    let ticker = makeTicker(name);
    if (tickers.has(ticker)) ticker = ticker.slice(0, 7) + String(index + 1);
    ticker = ticker.slice(0, 8);
    if (ticker.length < 3) ticker = `${ticker}X`.slice(0, 4);
    tickers.add(ticker);
    const memorability = memorize(name);
    const narrativeFit = Math.max(35, 78 - index * 7 + (input.title.toLowerCase().includes(stem) ? 8 : 0));
    drafts.push({
      id: `name_${input.narrativeId}_${index + 1}`,
      rank: index + 1,
      name,
      ticker,
      story: `Creative idea: a ${input.style} symbol for the “${stem}” moment in this story. It is not a claim about the people or organizations in the sources.`,
      wordplay: `${name} keeps “${stem}” from the monitored wording and adds a ${input.style} ending so it can be read aloud in a chat.`,
      memorability,
      narrativeFit,
      style: input.style,
      pinned: false,
      isTop: false,
      userEdited: false,
      collisionStatus: "not_checked",
      collisionCheckedAt: null,
      matches: [],
    });
  }

  const ranked = [...drafts].sort((a, b) => b.memorability * 0.45 + b.narrativeFit * 0.55 - (a.memorability * 0.45 + a.narrativeFit * 0.55));
  const topId = ranked[0]?.id;
  return drafts
    .map((option) => ({ ...option, isTop: option.id === topId }))
    .sort((a, b) => Number(b.isTop) - Number(a.isTop) || b.narrativeFit - a.narrativeFit)
    .map((option, index) => ({ ...option, rank: index + 1 }));
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function memorize(name: string): number {
  const words = name.split(/\s+/).length;
  const lengthPenalty = Math.max(0, name.replace(/\s+/g, "").length - 8) * 4;
  const wordPenalty = Math.max(0, words - 2) * 12;
  return Math.max(40, Math.min(96, 90 - lengthPenalty - wordPenalty));
}

export function makeTicker(name: string): string {
  const letters = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const consonants = letters.replace(/[AEIOU]/g, "");
  const base = (consonants.length >= 3 ? consonants : letters).slice(0, 6);
  return base.padEnd(3, "X").slice(0, 8);
}

export function tickerIsValid(ticker: string): boolean {
  return /^[A-Z0-9]{3,8}$/.test(ticker);
}

export function nameSeed(title: string): string {
  return shortHash(title);
}
