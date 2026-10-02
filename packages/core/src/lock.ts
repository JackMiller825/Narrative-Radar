export interface LockStore {
  tryAcquire(key: string, token: string, ttlMs: number, now: number): Promise<boolean>;
  heartbeat(key: string, token: string, ttlMs: number, now: number): Promise<boolean>;
  release(key: string, token: string): Promise<void>;
}

interface LockRow {
  token: string;
  expiresAt: number;
}

export function createMemoryLockStore(): LockStore {
  const rows = new Map<string, LockRow>();
  let chain: Promise<void> = Promise.resolve();
  const exclusive = async <T>(fn: () => T): Promise<T> => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = chain;
    chain = gate;
    await previous;
    try {
      return fn();
    } finally {
      release();
    }
  };
  return {
    tryAcquire(key, token, ttlMs, now) {
      return exclusive(() => {
        const current = rows.get(key);
        if (current && current.expiresAt > now) return false;
        rows.set(key, { token, expiresAt: now + ttlMs });
        return true;
      });
    },
    heartbeat(key, token, ttlMs, now) {
      return exclusive(() => {
        const current = rows.get(key);
        if (!current || current.token !== token) return false;
        current.expiresAt = now + ttlMs;
        return true;
      });
    },
    release(key, token) {
      return exclusive(() => {
        const current = rows.get(key);
        if (current?.token === token) rows.delete(key);
      });
    },
  };
}
