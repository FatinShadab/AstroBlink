"use client";

import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useEffect } from "react";
import { TooltipProvider } from "@/components/ui/Radix";
import { ToastProvider } from "@/components/ui/Toast";
import { LangProvider } from "@/lib/i18n/LangProvider";
import { useUserStore } from "@/lib/state/useUserStore";

/** Mirrors the in-app Reduced motion setting onto <html> so CSS can respond (globals.css). */
function ReducedMotionSync() {
  const reducedMotion = useUserStore((s) => s.settings.reducedMotion);
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reducedMotion);
  }, [reducedMotion]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <LangProvider>
        <TooltipProvider delayDuration={400}>
          <ToastProvider>
            <ReducedMotionSync />
            {children}
          </ToastProvider>
        </TooltipProvider>
      </LangProvider>
    </NuqsAdapter>
  );
}
