"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Surfaces";

/** Browser-only embed viewer (rules §4.2.2). Loaded from a client component, as Next requires. */
const EmbedView = dynamic(() => import("./EmbedView").then((m) => m.EmbedView), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-[400px] w-full" />,
});

export function EmbedLoader() {
  return <EmbedView />;
}
