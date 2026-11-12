"use client";

import { useEffect, useState } from "react";

/** Shape of public/demo/community.json. Every number from it is demo data (rules §2.2). */
export interface CommunityDemo {
  totals: { volunteers: number; classifications: number; flagged: number; agreementRate: number };
  byProject: { slug: string; classifications: number }[];
  monthly: { month: string; classifications: number; volunteers: number }[];
}

/** Loads the demo community file once, in the browser. Returns null while loading or on failure. */
export function useCommunity(): CommunityDemo | null {
  const [data, setData] = useState<CommunityDemo | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/demo/community.json")
      .then((r) => (r.ok ? (r.json() as Promise<CommunityDemo>) : null))
      .then((json) => {
        if (!cancelled && json) setData(json);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return data;
}
