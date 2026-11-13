import { describe, expect, it } from "vitest";
import { visibleLabels } from "./timelineLabels";

const sorted = (s: Set<number>) => [...s].sort((a, b) => a - b);

describe("visibleLabels", () => {
  it("shows every label when none overlap", () => {
    expect(sorted(visibleLabels([0, 100, 200, 300], 60))).toEqual([0, 1, 2, 3]);
  });

  it("shows first, middle and last when some would overlap", () => {
    expect(sorted(visibleLabels([0, 10, 150, 160, 300], 60))).toEqual([0, 2, 4]);
  });

  it("drops the middle when it would overlap an end", () => {
    expect(sorted(visibleLabels([0, 20, 40, 300], 60))).toEqual([0, 3]);
  });

  it("keeps one label when all dates sit together", () => {
    expect(sorted(visibleLabels([100, 101, 102], 60))).toEqual([0]);
  });
});
