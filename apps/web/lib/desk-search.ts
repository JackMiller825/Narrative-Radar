let query = "";
const listeners = new Set<() => void>();

export function subscribeSearch(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function getSearchQuery() {
  return query;
}

export function setSearchQuery(next: string) {
  if (next === query) return;
  query = next;
  listeners.forEach((callback) => callback());
}
