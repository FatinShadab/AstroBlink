"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (item: Omit<ToastItem, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Bottom-centre toasts, surface-3, radius-md, auto-hide 4s, aria-live polite (design §9.10).
 * Radix ToastPrimitive.Root announces with role="status" by default.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [nextId, setNextId] = useState(1);

  const toast = useCallback(
    (item: Omit<ToastItem, "id">) => {
      setItems((prev) => [...prev, { ...item, id: nextId }]);
      setNextId((n) => n + 1);
    },
    [nextId],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="down" duration={4000}>
        {children}
        {items.map((item) => (
          <ToastPrimitive.Root
            key={item.id}
            onOpenChange={(open) => {
              if (!open) setItems((prev) => prev.filter((t) => t.id !== item.id));
            }}
            className={cn(
              "grid gap-1 rounded-[var(--radius-md)] border border-border bg-surface-3 px-4 py-3 text-text-primary shadow-[0_12px_32px_rgba(0,0,0,0.45)]",
            )}
          >
            <ToastPrimitive.Title className="text-body-sm font-medium">
              {item.title}
            </ToastPrimitive.Title>
            {item.description && (
              <ToastPrimitive.Description className="text-caption text-text-secondary">
                {item.description}
              </ToastPrimitive.Description>
            )}
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-4 left-1/2 z-[60] flex w-[calc(100%-32px)] max-w-sm -translate-x-1/2 flex-col gap-2 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx.toast;
}
