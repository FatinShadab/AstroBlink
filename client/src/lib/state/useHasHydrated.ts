"use client";

import { useSyncExternalStore } from "react";
import { useUserStore } from "./useUserStore";

/**
 * True once the persisted user store has read localStorage.
 * Use it to avoid hydration mismatches for persisted-dependent UI (architecture §7.3).
 */
export function useHasHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const unsubscribe = useUserStore.persist.onFinishHydration(() => onChange());
      return unsubscribe;
    },
    () => useUserStore.persist.hasHydrated(),
    () => false,
  );
}
