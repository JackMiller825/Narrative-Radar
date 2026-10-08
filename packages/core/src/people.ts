export interface MarketPerson {
  name: string;
  aliases: string[];
}

export const MARKET_PEOPLE: MarketPerson[] = [
  { name: "Vitalik Buterin", aliases: ["vitalik buterin", "vitalik"] },
  { name: "Elon Musk", aliases: ["elon musk"] },
  { name: "Donald Trump", aliases: ["donald trump"] },
  { name: "Jerome Powell", aliases: ["jerome powell"] },
  { name: "Larry Fink", aliases: ["larry fink"] },
  { name: "Michael Saylor", aliases: ["michael saylor"] },
  { name: "Brian Armstrong", aliases: ["brian armstrong"] },
  { name: "Changpeng Zhao", aliases: ["changpeng zhao", "cz binance"] },
  { name: "Gary Gensler", aliases: ["gary gensler"] },
  { name: "Sam Altman", aliases: ["sam altman"] },
];

export function marketPeopleNames(): string[] {
  return MARKET_PEOPLE.map((person) => person.name);
}

export function resolveWatchedPeople(names: string[]): MarketPerson[] {
  const resolved: MarketPerson[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const name = raw.trim();
    if (name.length < 3) continue;
    const known = MARKET_PEOPLE.find((person) => person.name.toLowerCase() === name.toLowerCase() || person.aliases.includes(name.toLowerCase()));
    const person = known ?? { name, aliases: [name.toLowerCase()] };
    const key = person.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    resolved.push(person);
  }
  return resolved.slice(0, 12);
}

export function mentionedPeople(text: string, people: MarketPerson[]): string[] {
  return people.filter((person) => storyMentionsPerson(text, person)).map((person) => person.name);
}

export function storyMentionsPerson(text: string, person: MarketPerson): boolean {
  const haystack = text.toLowerCase();
  if (haystack.includes(person.name.toLowerCase())) return true;
  if (person.aliases.some((alias) => haystack.includes(alias))) return true;
  const last = person.name.split(" ").at(-1)?.toLowerCase() ?? "";
  if (last.length < 4) return false;
  return new RegExp(`\\b${last}\\b`, "i").test(text);
}
