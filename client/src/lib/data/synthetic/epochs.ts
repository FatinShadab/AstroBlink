/**
 * Visit (epoch) dates for the synthetic provider (architecture §5.2 step 3).
 * First visit = 15 May 2025 plus an RA-dependent offset of 0–180 days; then every 182 days
 * while the date is on or before "today". So the frame count grows over time on its own.
 */

const FIRST_VISIT_UTC = Date.UTC(2025, 4, 15);
const VISIT_INTERVAL_DAYS = 182;
const DAY_MS = 24 * 60 * 60 * 1000;

export function firstVisitUtc(raDeg: number): number {
  const offsetDays = Math.floor((raDeg / 360) * 181); // 0..180
  return FIRST_VISIT_UTC + offsetDays * DAY_MS;
}

/** All visit dates (UTC midnight) up to and including `today`. */
export function visitDates(raDeg: number, today: Date = new Date()): Date[] {
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const dates: Date[] = [];
  for (let t = firstVisitUtc(raDeg); t <= todayUtc; t += VISIT_INTERVAL_DAYS * DAY_MS) {
    dates.push(new Date(t));
  }
  return dates;
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
