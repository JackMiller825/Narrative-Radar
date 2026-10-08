"use client";

import { getDeskSnapshot, primeDesk, subscribeDesk } from "@/lib/published-desk";
import type { DeskData } from "@/lib/types";
import type { NarrativeView } from "@radar/core/browser";
import { useEffect, useSyncExternalStore } from "react";

export function useLiveDesk(serverDesk: DeskData): DeskData {
  const snap = useSyncExternalStore(subscribeDesk, getDeskSnapshot, () => null);
  useEffect(() => {
    primeDesk(serverDesk);
  }, [serverDesk]);
  return snap ?? serverDesk;
}

export function useLiveNarratives(fallback: NarrativeView[]): NarrativeView[] {
  const snap = useSyncExternalStore(subscribeDesk, getDeskSnapshot, () => null);
  return snap?.narratives ?? fallback;
}
