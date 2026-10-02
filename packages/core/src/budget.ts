export interface BudgetLedger {
  reserve(amount: number): Promise<boolean>;
  settle(reserved: number, actual: number): Promise<void>;
  snapshot(): Promise<{ spent: number; reserved: number; limit: number }>;
}

export function createBudgetLedger(limit: number): BudgetLedger {
  let spent = 0;
  let reserved = 0;
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
    async reserve(amount: number) {
      if (!(amount > 0)) return false;
      return exclusive(() => {
        if (spent + reserved + amount > limit + 1e-9) return false;
        reserved += amount;
        return true;
      });
    },
    async settle(held: number, actual: number) {
      await exclusive(() => {
        reserved = Math.max(0, reserved - held);
        spent += Math.max(0, actual);
      });
    },
    snapshot() {
      return exclusive(() => ({ spent, reserved, limit }));
    },
  };
}
