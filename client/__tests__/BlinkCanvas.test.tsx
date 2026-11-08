import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import BlinkCanvas, { niceStepDeg, planFrames, type BlinkCanvasProps } from "@/components/BlinkCanvas";
import { makeWcs } from "@/lib/coords";
import { buildScene, renderFrame, type BandKey, type Frame } from "@/lib/mock/spherexMockEngine";
import { DEFAULT_STRETCH } from "@/lib/render/pixelMath";

beforeAll(() => {
  // jsdom has no canvas implementation; the component treats a null context as a no-op.
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement["getContext"];
});

const CENTER = { ra: 133.795, dec: -7.245 };
const scene = buildScene(CENTER, 5);

function baseProps(overrides: Partial<BlinkCanvasProps> = {}): BlinkCanvasProps {
  return {
    loadFrame: (epochIndex: number, band: BandKey) => Promise.resolve<Frame | null>(renderFrame(scene, epochIndex, band)),
    epochIndex: 0,
    epochCount: 4,
    epochLabel: "Epoch 1",
    band: "stack",
    bandLabel: "All-array stack",
    rgb: [6, 4, 2],
    mode: "blink",
    stretch: DEFAULT_STRETCH,
    overlays: { gaia: false, wise: false, mask: false, grid: true, compass: true },
    overlayData: null,
    wcs: makeWcs(CENTER, 5),
    selectedPixel: null,
    marks: [],
    tagMode: false,
    ...overrides,
  };
}

describe("BlinkCanvas", () => {
  it("labels the active epoch and band for assistive tech", async () => {
    render(<BlinkCanvas {...baseProps()} />);
    expect(screen.getByRole("img", { name: /Epoch 1/ })).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Loading frames…")).toBeNull());
  });

  it("reports a missing tile when the loader has no frame", async () => {
    render(<BlinkCanvas {...baseProps({ loadFrame: () => Promise.resolve(null) })} />);
    expect(await screen.findByText("No image data loaded")).toBeTruthy();
  });

  it("requests the frames each display mode needs", async () => {
    const loadFrame = vi.fn(() => Promise.resolve<Frame | null>(renderFrame(scene, 0, "stack")));
    render(<BlinkCanvas {...baseProps({ loadFrame, mode: "diff", epochIndex: 2 })} />);
    await waitFor(() => expect(loadFrame).toHaveBeenCalledTimes(2));
    expect(loadFrame).toHaveBeenCalledWith(2, "stack");
    expect(loadFrame).toHaveBeenCalledWith(0, "stack");
  });
});

describe("planFrames", () => {
  it("loads only the current epoch for blink", () => {
    expect(planFrames(1, 4, "stack", [6, 4, 2], "blink")).toEqual([[1, "stack"]]);
  });

  it("loads every epoch for co-add", () => {
    expect(planFrames(1, 4, "a3", [6, 4, 2], "coadd")).toHaveLength(4);
  });

  it("loads the current epoch and the reference epoch 1 for difference imaging", () => {
    expect(planFrames(3, 4, "stack", [6, 4, 2], "diff")).toEqual([
      [3, "stack"],
      [0, "stack"],
    ]);
  });

  it("loads the three selected arrays for the RGB composite", () => {
    expect(planFrames(0, 4, "rgb", [6, 4, 2], "blink")).toEqual([
      [0, "a6"],
      [0, "a4"],
      [0, "a2"],
    ]);
  });
});

describe("niceStepDeg", () => {
  it("rounds grid spacing to 1, 2, 5 × 10ⁿ", () => {
    expect(niceStepDeg(0.9)).toBeCloseTo(1);
    expect(niceStepDeg(0.2)).toBeCloseTo(0.2);
    expect(niceStepDeg(4)).toBeCloseTo(5);
    expect(niceStepDeg(8)).toBeCloseTo(10);
  });
});
