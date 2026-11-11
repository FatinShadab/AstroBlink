"use client";

import { useEffect, useState } from "react";
import { useUserStore } from "@/lib/state/useUserStore";

/** True when the OS setting OR the in-app Reduced motion setting asks for less motion (rules §3.3). */
export function useReducedMotion(): boolean {
  const appSetting = useUserStore((s) => s.settings.reducedMotion);
  const [osSetting, setOsSetting] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setOsSetting(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return appSetting || osSetting;
}
