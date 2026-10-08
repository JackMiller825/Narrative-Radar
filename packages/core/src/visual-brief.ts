import type { Motif } from "./types";
import { isPersonEntity, significantTokens } from "./text";

export interface VisualBrief {
  narrativeId: string;
  version: 1;
  catalyst: string;
  sourceIds: string[];
  name: string;
  ticker: string;
  displayTicker: string;
  hook: string;
  species: string;
  motif: Motif;
  silhouette: string;
  expression: string;
  pose: string;
  signature: string;
  action: string;
  elementMap: { element: string; meaning: string }[];
  mustKeep: string[];
  unwanted: string[];
  label: "Template concept";
}

const FORMS: { test: RegExp; species: string; motif: Motif; signature: string; action: string; expression: string }[] = [
  { test: /\blighthouse\b/i, species: "lighthouse cat", motif: "star", signature: "lantern", action: "holding a lantern up to a tiny radio", expression: "alert and friendly" },
  { test: /\bfrog\b/i, species: "round frog", motif: "frog", signature: "lily pad", action: "standing on a lily pad and lifting a small coin", expression: "grinning" },
  { test: /\bpenguin\b/i, species: "round penguin", motif: "abstract", signature: "scarf", action: "waddling forward with a scarf trailing", expression: "cheerful" },
  { test: /\brobot\b|\bandroid\b|\bhumanoid\b/i, species: "small round robot", motif: "robot", signature: "task folder", action: "hugging an oversized task folder", expression: "determined" },
  { test: /\bbread\b|\bloaf\b|\bbaker\b|\bsourdough\b/i, species: "baker creature", motif: "cloud", signature: "scored loaf", action: "presenting a scored loaf", expression: "proud" },
  { test: /\bmuseum\b|\bgallery\b|\bart\b/i, species: "tiny curator", motif: "star", signature: "picture frame", action: "holding up a picture frame", expression: "curious" },
  { test: /\bcat\b|\bkitten\b/i, species: "round cat", motif: "abstract", signature: "bell collar", action: "sitting tall with a bell collar", expression: "calm" },
  { test: /\brocket\b|\bmoon\b/i, species: "round pilot", motif: "rocket", signature: "rocket pack", action: "leaning forward in a small rocket pack", expression: "excited" },
];

export function canonicalTicker(ticker: string): string {
  const cleaned = ticker.replace(/\$/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return cleaned.padEnd(3, "X").slice(0, 8);
}

export function displayTicker(ticker: string): string {
  return `$${canonicalTicker(ticker)}`;
}

export function buildVisualBrief(input: {
  narrativeId: string;
  title: string;
  summary?: string;
  name: string;
  ticker: string;
  sourceIds?: string[];
}): VisualBrief {
  const text = `${input.title} ${input.summary ?? ""}`;
  const people = mentionedNames(text);
  const form = FORMS.find((item) => item.test.test(text)) ?? fallbackForm(input.title, people);
  const catalyst = input.title.trim() || "A new narrative";
  const hook = `A ${form.expression} ${form.species} ${form.action}.`;
  return {
    narrativeId: input.narrativeId,
    version: 1,
    catalyst,
    sourceIds: input.sourceIds ?? [],
    name: input.name,
    ticker: canonicalTicker(input.ticker),
    displayTicker: displayTicker(input.ticker),
    hook,
    species: form.species,
    motif: form.motif,
    silhouette: `simple ${form.species} with a large head and a readable ${form.signature}`,
    expression: form.expression,
    pose: "full body, facing forward, one clear action",
    signature: form.signature,
    action: form.action,
    elementMap: [
      { element: form.species, meaning: "the character a viewer should recognize in about three seconds" },
      { element: form.signature, meaning: catalyst },
    ],
    mustKeep: [form.species, form.signature, form.expression, input.name, displayTicker(input.ticker)],
    unwanted: [
      "endorsement seal",
      "official partnership badge",
      "celebrity likeness",
      ...people.map((person) => `${person} portrait`),
    ],
    label: "Template concept",
  };
}

function mentionedNames(text: string): string[] {
  const chunks = text.match(/\b[A-Z][a-zA-Z'’-]+(?:\s+[A-Z][a-zA-Z'’-]+)+\b/g) ?? [];
  return chunks.filter((chunk) => isPersonEntity(chunk));
}

function fallbackForm(title: string, people: string[]): { species: string; motif: Motif; signature: string; action: string; expression: string } {
  const blocked = new Set(people.flatMap((person) => significantTokens(person)));
  const token = significantTokens(title).find((word) => !blocked.has(word) && word.length >= 4) ?? "spark";
  return {
    species: `round ${token} creature`,
    motif: "abstract",
    signature: `${token} badge`,
    action: `holding up a small ${token} badge`,
    expression: "friendly",
  };
}
