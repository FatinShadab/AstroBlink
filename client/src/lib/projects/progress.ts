import type { Classification } from "@/lib/state/useUserStore";

/** Derived progress (architecture §7.3: computed selectors, never stored). Training answers do not count. */
export function progressFor(
  classifications: readonly Classification[],
  projectSlug: string,
  fieldCount: number,
): { count: number; fraction: number } {
  const count = classifications.filter(
    (c) => c.projectSlug === projectSlug && !c.isTraining,
  ).length;
  return { count, fraction: fieldCount > 0 ? Math.min(1, count / fieldCount) : 0 };
}
