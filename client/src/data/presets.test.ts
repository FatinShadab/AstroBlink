import { describe, expect, it } from "vitest";
import { parseCoordinatePair } from "@/lib/sky/coords";
import { hasRealData, presetAt, presetByName, PRESETS } from "./presets";

/** Coordinates as written in the challenge brief and the team brief. */
const BRIEF_COORDINATES: Record<string, string> = {
  "wise-0855": "08h55m10.831s -07d14m42.53s",
  barnard: "17h57m48.5s +04d41m36s",
  "eps-indi-b": "22h04m10.5s -56d46m58s",
  "r-dra": "16h32m40s +66d45m18s",
  "rw-aur": "05h07m49.5s +30d24m05s",
};

describe("coordinate search finds the real-data targets", () => {
  for (const [id, text] of Object.entries(BRIEF_COORDINATES)) {
    it(`opens real data for ${id} from "${text}"`, () => {
      const { raDeg, decDeg } = parseCoordinatePair(text);
      expect(presetAt({ raDeg, decDeg })?.id).toBe(id);
      expect(hasRealData({ raDeg, decDeg })).toBe(true);
    });
  }

  it("also matches each preset's own (epoch 2025.9) position", () => {
    for (const p of PRESETS) {
      expect(presetAt({ raDeg: p.raDeg, decDeg: p.decDeg })?.id).toBe(p.id);
    }
  });

  it("matches within 5′ but not beyond", () => {
    const wise = PRESETS.find((p) => p.id === "wise-0855")!;
    expect(presetAt({ raDeg: wise.raDeg, decDeg: wise.decDeg + 4.5 / 60 })?.id).toBe("wise-0855");
    expect(presetAt({ raDeg: wise.raDeg, decDeg: wise.decDeg + 9 / 60 })).toBeUndefined();
  });

  it("shows the simulated sky (and its banner) for random coordinates", () => {
    for (const [raDeg, decDeg] of [
      [10, 10],
      [200.5, -45],
      [0, 89],
      [120, 0],
    ]) {
      expect(hasRealData({ raDeg, decDeg })).toBe(false);
    }
  });
});

describe("presetByName", () => {
  it.each([
    ["Barnard's Star", "barnard"],
    ["barnards star", "barnard"],
    ["WISE 0855", "wise-0855"],
    ["WISE J085510.83-071442.5", "wise-0855"],
    ["R Dra", "r-dra"],
    ["R Draconis", "r-dra"],
    ["RW Aur", "rw-aur"],
    ["Eps Ind B", "eps-indi-b"],
    ["Epsilon Indi B", "eps-indi-b"],
  ])("finds %s", (name, id) => {
    expect(presetByName(name)?.id).toBe(id);
  });

  it("returns nothing for unknown or too-short names", () => {
    expect(presetByName("Andromeda")).toBeUndefined();
    expect(presetByName("R")).toBeUndefined();
  });
});
