import { eventSignature, isPersonEntity, jaccard, normalizeTitle } from "./text";

export interface Clusterable {
  key: string;
  title: string;
  entities: string[];
  contentHash: string;
  publisher: string;
  canonicalUrl: string;
}

export interface ExistingCluster {
  stableKey: string;
  title: string;
  entities: string[];
}

export interface ItemCluster<T extends Clusterable> {
  items: T[];
  matchedStableKey: string | null;
  syndicatedKeys: string[];
}

const MATCH_EXISTING = 0.45;
const MATCH_FRESH = 0.5;

export function clusterItems<T extends Clusterable>(fresh: T[], existing: ExistingCluster[]): ItemCluster<T>[] {
  const parent = new Map<string, string>();
  const find = (key: string): string => {
    const current = parent.get(key) ?? key;
    if (current === key) return key;
    const root = find(current);
    parent.set(key, root);
    return root;
  };
  const union = (left: string, right: string) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent.set(b, a);
  };
  for (const item of fresh) parent.set(item.key, item.key);

  for (let i = 0; i < fresh.length; i += 1) {
    for (let j = i + 1; j < fresh.length; j += 1) {
      if (sameEvent(fresh[i]!, fresh[j]!)) union(fresh[i]!.key, fresh[j]!.key);
    }
  }

  const groups = new Map<string, T[]>();
  for (const item of fresh) {
    const root = find(item.key);
    const list = groups.get(root) ?? [];
    list.push(item);
    groups.set(root, list);
  }

  return [...groups.values()].map((items) => {
    const signature = combinedSignature(items);
    let matched: ExistingCluster | null = null;
    let best = 0;
    for (const candidate of existing) {
      const score = jaccard(signature, eventSignature(candidate.title, candidate.entities));
      const sharedSpecific = sharedNonPersonEntity(
        items.flatMap((item) => item.entities),
        candidate.entities,
      );
      const similarity = sharedSpecific ? Math.max(score, 0.5) : score;
      if (similarity > best) {
        best = similarity;
        matched = candidate;
      }
    }
    const syndicatedKeys = syndicatedMembers(items).map((item) => item.key);
    return {
      items,
      matchedStableKey: matched && best >= MATCH_EXISTING ? matched.stableKey : null,
      syndicatedKeys,
    };
  });
}

export function sameEvent(left: Clusterable, right: Clusterable): boolean {
  if (left.contentHash === right.contentHash) return true;
  if (normalizeTitle(left.title) === normalizeTitle(right.title)) return true;
  const leftSignature = eventSignature(left.title, left.entities);
  const rightSignature = eventSignature(right.title, right.entities);
  const overlap = jaccard(leftSignature, rightSignature);
  if (overlap >= MATCH_FRESH) return true;
  if (sharedNonPersonEntity(left.entities, right.entities) && overlap >= 0.34) return true;
  return false;
}

function combinedSignature(items: Clusterable[]): string[] {
  return [...new Set(items.flatMap((item) => eventSignature(item.title, item.entities)))];
}

function sharedNonPersonEntity(left: string[], right: string[]): boolean {
  const specific = new Set(left.filter((entity) => !isPersonEntity(entity)).map((entity) => entity.toLowerCase()));
  return right.some((entity) => !isPersonEntity(entity) && specific.has(entity.toLowerCase()));
}

function syndicatedMembers<T extends Clusterable>(items: T[]): T[] {
  const seenTitles = new Set<string>();
  const seenHashes = new Set<string>();
  const syndicated: T[] = [];
  const ordered = [...items];
  for (const item of ordered) {
    const title = normalizeTitle(item.title);
    const duplicate = seenHashes.has(item.contentHash) || seenTitles.has(title);
    seenHashes.add(item.contentHash);
    seenTitles.add(title);
    if (duplicate) syndicated.push(item);
  }
  return syndicated;
}
