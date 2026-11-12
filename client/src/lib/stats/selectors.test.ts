import { describe, expect, it } from "vitest";
import { myStats } from "./selectors";
import type { Classification } from "@/lib/state/useUserStore";

const base = (over: Partial<Classification>): Classification => ({
  id: "x",
  projectSlug: "hunt-moving-stars",
  fieldId: "f",
  answer: "no_change",
  flaggedInteresting: false,
  isTraining: false,
  createdAt: "2026-11-10T10:00:00.000Z",
  ...over,
});

describe("myStats", () => {
  const now = new Date("2026-11-12T12:00:00Z");

  it("leaves training answers out of personal counts", () => {
    const stats = myStats([base({ isTraining: true }), base({})], now);
    expect(stats.fieldsChecked).toBe(1);
  });

  it("computes agreement only over answers that were compared", () => {
    const stats = myStats(
      [base({ agrees: true }), base({ agrees: false }), base({ agrees: undefined })],
      now,
    );
    expect(stats.agreementCount).toBe(2);
    expect(stats.agreementRate).toBe(0.5);
  });

  it("returns a null agreement rate when nothing was compared", () => {
    expect(myStats([base({})], now).agreementRate).toBeNull();
  });

  it("counts projects joined and flags", () => {
    const stats = myStats(
      [base({ flaggedInteresting: true }), base({ projectSlug: "variable-watch" })],
      now,
    );
    expect(stats.projectsJoined).toBe(2);
    expect(stats.flagged).toBe(1);
  });

  it("builds a fourteen-day series, oldest first", () => {
    const stats = myStats([base({ createdAt: "2026-11-12T08:00:00.000Z" })], now);
    expect(stats.perDay).toHaveLength(14);
    expect(stats.perDay[13]).toEqual({ date: "2026-11-12", count: 1 });
  });
});
