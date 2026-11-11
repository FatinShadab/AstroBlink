"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Surfaces";

/** The viewer uses canvas and browser APIs, so it loads only in the browser (rules §4.2.2). */
const ExploreView = dynamic(() => import("./ExploreView").then((m) => m.ExploreView), {
  ssr: false,
  loading: () => (
    <div aria-busy="true" className="flex flex-col gap-4">
      <Skeleton className="h-10 w-1/3" />
      <Skeleton className="h-[min(60vh,640px)] w-full" />
    </div>
  ),
});

export function ExploreLoader() {
  return <ExploreView />;
}
