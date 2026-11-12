"use client";

import { useEffect, useState } from "react";
import { getProvider } from "@/lib/data/provider";
import type { QueueField } from "@/lib/data/types";

interface QueueState {
  key: string;
  fields: QueueField[] | null;
  error: boolean;
}

/**
 * Loads a queue through the data provider. offset −1 means practice fields.
 * Results are keyed, so a stale response never shows for a different batch.
 */
export function useProjectQueue(
  slug: string,
  offset: number,
  size: number,
): {
  fields: QueueField[] | null;
  error: boolean;
} {
  const key = `${slug}|${offset}|${size}`;
  const [state, setState] = useState<QueueState>({ key: "", fields: null, error: false });

  useEffect(() => {
    let cancelled = false;
    getProvider()
      .getProjectQueue(slug, { batchSize: size, offset })
      .then((fields) => {
        if (!cancelled) setState({ key, fields, error: false });
      })
      .catch(() => {
        if (!cancelled) setState({ key, fields: null, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [key, slug, offset, size]);

  if (state.key !== key) return { fields: null, error: false };
  return { fields: state.fields, error: state.error };
}
