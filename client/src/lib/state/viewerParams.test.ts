import { describe, expect, it } from "vitest";
import { resolveTarget } from "./viewerParams";

const none = { preset: null, ra: null, dec: null, fov: null, det: null };

describe("resolveTarget", () => {
  it("uses the preset's coordinates, FoV and detector when the URL has only a preset", () => {
    const result = resolveTarget({ ...none, preset: "barnard" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.target.raDeg).toBeCloseTo(269.4463, 3);
      expect(result.target.detector).toBe("D2");
      expect(result.target.fovArcmin).toBe(5);
    }
  });

  it("lets explicit URL values override the preset", () => {
    const result = resolveTarget({ ...none, preset: "wise-0855", det: "D5", fov: 10 });
    expect(result.ok && result.target.detector).toBe("D5");
    expect(result.ok && result.target.fovArcmin).toBe(10);
  });

  it("resolves Epsilon Indi B to its preset coordinates", () => {
    const result = resolveTarget({ ...none, preset: "eps-indi-b" });
    expect(result.ok).toBe(true);
    expect(result.ok && result.target.raDeg).toBeCloseTo(331.096448, 4);
    expect(result.ok && result.target.decDeg).toBeCloseTo(-56.800596, 4);
  });

  it("accepts raw coordinates and defaults to 5′ and D2", () => {
    const result = resolveTarget({ ...none, ra: 133.795, dec: -7.245 });
    expect(result.ok && result.target).toEqual({
      raDeg: 133.795,
      decDeg: -7.245,
      fovArcmin: 5,
      detector: "D2",
    });
  });

  it("rejects missing coordinates, out-of-range values and unsupported FoV", () => {
    expect(resolveTarget(none)).toMatchObject({ ok: false, code: "no-target" });
    expect(resolveTarget({ ...none, ra: 400, dec: 0 })).toMatchObject({
      ok: false,
      code: "ra-range",
    });
    expect(resolveTarget({ ...none, ra: 1, dec: 95 })).toMatchObject({
      ok: false,
      code: "dec-range",
    });
    expect(resolveTarget({ ...none, ra: 1, dec: 1, fov: 7 })).toMatchObject({
      ok: false,
      code: "bad-fov",
    });
  });
});
