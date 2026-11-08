/**
 * Per-viewer contribution history, stored in localStorage.
 *
 * This is a convenience record of what this browser has contributed; the
 * backend is the source of truth once it serves contributions. All storage
 * access is guarded so private windows and blocked storage degrade gracefully.
 */

export interface Contribution {
  id: string;
  userId: string;
  projectId: string;
  pictureId: string;
  category: string;
  ra: number;
  dec: number;
  createdAt: string;
}

const KEY = "astroblink.contributions.v1";

function readAll(): Contribution[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Contribution[]) : [];
  } catch {
    return [];
  }
}

function writeAll(items: Contribution[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Storage unavailable: contributions remain for this page session only.
  }
}

export function listContributions(userId?: string): Contribution[] {
  const all = readAll();
  return userId ? all.filter((c) => c.userId === userId) : all;
}

export function addContribution(c: Omit<Contribution, "id" | "createdAt">): Contribution {
  const entry: Contribution = {
    ...c,
    id: `con_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  writeAll([entry, ...readAll()]);
  return entry;
}

/** Pictures this user has contributed to within a project. */
export function contributedPictureIds(userId: string, projectId?: string): Set<string> {
  return new Set(
    listContributions(userId)
      .filter((c) => !projectId || c.projectId === projectId)
      .map((c) => c.pictureId),
  );
}
