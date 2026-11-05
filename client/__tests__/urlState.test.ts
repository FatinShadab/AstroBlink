import { describe, it, expect } from "vitest";
import { DEFAULT_STATE, parseState, serializeState } from "@/lib/url-state";
import { nextEpoch } from "@/components/Observatory";

describe("URL state", () => {
  it("round-trips the default view", () => {
    const qs = serializeState(DEFAULT_STATE);
    const parsed = parseState(qs);
    expect(parsed.ra).toBeCloseTo(DEFAULT_STATE.ra, 4);
    expect(parsed.dec).toBeCloseTo(DEFAULT_STATE.dec, 4);
    expect(parsed.fov).toBe(DEFAULT_STATE.fov);
    expect(parsed.band).toBe(DEFAULT_STATE.band);
    expect(parsed.mode).toBe(DEFAULT_STATE.mode);
    expect(parsed.epochIndex).toBe(DEFAULT_STATE.epochIndex);
  });

  it("carries ra, dec, fov, band, mode, speed and embed", () => {
    const parsed = parseState(
      new URLSearchParams("ra=269.452&dec=4.693&fov=15&band=ch46&mode=diff&speed=4&embed=true"),
    );
    expect(parsed).toMatchObject({ ra: 269.452, dec: 4.693, fov: 15, band: "ch46", mode: "diff", speed: 4, embed: true });
  });

  it("falls back to defaults for malformed values instead of throwing", () => {
    const parsed = parseState(new URLSearchParams("ra=abc&fov=7&band=nonsense&mode=spin&speed=999&embed=yes"));
    expect(parsed.ra).toBe(DEFAULT_STATE.ra);
    expect(parsed.fov).toBe(DEFAULT_STATE.fov);
    expect(parsed.band).toBe(DEFAULT_STATE.band);
    expect(parsed.mode).toBe(DEFAULT_STATE.mode);
    expect(parsed.speed).toBe(10); // clamped
    expect(parsed.embed).toBe(false);
  });

  it("only serializes the RGB arrays when the RGB band is active", () => {
    expect(serializeState(DEFAULT_STATE).has("rgb")).toBe(false);
    expect(serializeState({ ...DEFAULT_STATE, band: "rgb" }).get("rgb")).toBe("6,4,2");
  });

  it("serializes embed=true only when embedding", () => {
    expect(serializeState(DEFAULT_STATE).has("embed")).toBe(false);
    expect(serializeState({ ...DEFAULT_STATE, embed: true }).get("embed")).toBe("true");
  });
});

describe("playback", () => {
  it("loops forward and wraps", () => {
    expect(nextEpoch(3, 4, "forward", 1)).toEqual({ index: 0, dir: 1 });
    expect(nextEpoch(1, 4, "forward", 1)).toEqual({ index: 2, dir: 1 });
  });

  it("bounces at both ends in ping-pong mode", () => {
    let step = nextEpoch(2, 4, "pingpong", 1);
    expect(step).toEqual({ index: 3, dir: 1 });
    step = nextEpoch(step.index, 4, "pingpong", step.dir);
    expect(step).toEqual({ index: 2, dir: -1 });
    step = nextEpoch(0, 4, "pingpong", -1);
    expect(step).toEqual({ index: 1, dir: 1 });
  });
});
