import type { Classification } from "@/lib/state/useUserStore";

/**
 * Derived stats (architecture §7.3): computed from the stored classifications, never stored.
 * Training answers are kept out of the personal counts.
 */
export interface MyStats {
  fieldsChecked: number;
  flagged: number;
  projectsJoined: number;
  /** Share of answers that matched the demo community answer. Null when there are none. Demo basis. */
  agreementRate: number | null;
  agreementCount: number;
  byProject: Record<string, number>;
  /** Count per day for the last `days` days, oldest first. */
  perDay: { date: string; count: number }[];
  recent: Classification[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function isoDay(date: Date): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

export function myStats(
  list: readonly Classification[],
  now: Date = new Date(),
  days = 14,
): MyStats {
  const mine = list.filter((c) => !c.isTraining);
  const byProject: Record<string, number> = {};
  for (const c of mine) byProject[c.projectSlug] = (byProject[c.projectSlug] ?? 0) + 1;

  const compared = mine.filter((c) => c.agrees !== undefined);
  const agreed = compared.filter((c) => c.agrees === true).length;

  const perDay: { date: string; count: number }[] = [];
  const counts = new Map<string, number>();
  for (const c of mine) {
    const day = c.createdAt.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  for (let i = days - 1; i >= 0; i--) {
    const day = isoDay(new Date(now.getTime() - i * DAY_MS));
    perDay.push({ date: day, count: counts.get(day) ?? 0 });
  }

  return {
    fieldsChecked: mine.length,
    flagged: mine.filter((c) => c.flaggedInteresting).length,
    projectsJoined: Object.keys(byProject).length,
    agreementRate: compared.length > 0 ? agreed / compared.length : null,
    agreementCount: compared.length,
    byProject,
    perDay,
    recent: [...mine].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10),
  };
}
